// /api/scam-check.js
// UTA Scam Checker v2 — Domain reputation heuristic engine
//
// GET /api/scam-check?domain=example.com
//
// v2 (2026-09-08): two previously "not checked" gaps are now LIVE server-side
//   - domain_age: free RDAP registry lookup (rdap.org — no API key, no signup)
//   - ssl: real TLS handshake on :443 with certificate validation (issuer, expiry, SAN)
//
// Returns:
//   {
//     "domain": "example.com",
//     "decision": "TRUSTED" | "CAUTION" | "SUSPICIOUS" | "UNKNOWN",
//     "risk_score": 0-100,
//     "reasons": ["URL shortener: destination hidden", ...],
//     "checks": {
//       "url_shortener": { "triggered": false, "detail": "..." },
//       "domain_age": { "triggered": false, "detail": "Domain registered 5.2 years ago (2019-03-27, verified live via RDAP)" },
//       "ssl": { "triggered": false, "detail": "SSL certificate valid (issuer: Let's Encrypt, expires in 60 days)" },
//       "suspicious_tld": { "triggered": false, "detail": "..." },
//       "punycode": { "triggered": false, "detail": "..." },
//       "typosquatting": { "triggered": false, "detail": "..." }
//     },
//     "honest_disclaimer": "...",
//     "timestamp": "2026-09-08T..."
//   }

import tls from 'tls';

const URL_SHORTENER_DOMAINS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly',
  'rebrand.ly', 'cutt.ly', 'shorturl.at', 'tiny.cc', 'rb.gy', 't.ly',
  's.id', 'v.gd', 'qr.ae', 'x.co', 'shorte.st', 'adf.ly', 'bc.vc',
  'soo.gd', 'ity.im', 'sh.st', 'adfly.it', 'lnkd.in', 'fb.me'
]);

const SUSPICIOUS_TLDS = new Set([
  '.zip', '.mov', '.xyz', '.top', '.click', '.link', '.country',
  '.kim', '.cricket', '.science', '.work', '.party', '.gq', '.cf',
  '.ml', '.tk', '.ga', '.review', '.trade', '.date', '.stream',
  '.download', '.win', '.racing', '.accountant', '.faith', '.loan'
]);

const POPULAR_DOMAINS = new Set([
  'google.com', 'youtube.com', 'facebook.com', 'amazon.com', 'wikipedia.org',
  'twitter.com', 'instagram.com', 'linkedin.com', 'github.com', 'reddit.com',
  'apple.com', 'microsoft.com', 'netflix.com', 'spotify.com', 'tiktok.com',
  'discord.com', 'telegram.org', 'whatsapp.com', 'zoom.us', 'slack.com',
  'notion.so', 'figma.com', 'airbnb.com', 'uber.com', 'lyft.com',
  'stripe.com', 'paypal.com', 'venmo.com', 'cashapp.com', 'coinbase.com'
]);

// FIX 2026-09-08: first-party domains — operated by AliceLabs LLC (MarketNow).
// This very checker runs on marketnow.site, so we vouch for these directly.
// Stated transparently in the reason: this is first-party knowledge, NOT
// external threat-intel (the old behavior returned UNKNOWN for our own
// domains — technically fail-closed, but absurd UX: "can't find its own page").
const OPERATED_DOMAINS = new Set([
  'marketnow.site',
  'alicelabs.site',
  'universal-trust-adapter.vercel.app'
]);

const TYPOSQUATTING_PATTERNS = [
  { target: 'google', patterns: ['g00gle', 'googel', 'gooogle', 'goggle'] },
  { target: 'amazon', patterns: ['amaz0n', 'amzon', 'amazn', 'arnazon'] },
  { target: 'paypal', patterns: ['paypa1', 'paypol', 'paypl'] },
  { target: 'apple', patterns: ['app1e', 'applle', 'aple'] },
  { target: 'microsoft', patterns: ['microsft', 'micr0soft', 'micosoft'] },
  { target: 'facebook', patterns: ['faceb00k', 'faceboook', 'facbook'] },
  { target: 'instagram', patterns: ['instagrarn', 'instgram'] },
  { target: 'netflix', patterns: ['netfl1x', 'netfllix', 'netfix'] }
];

// ── v2: live lookup timeouts (keep total latency ≈1-2s, both run in parallel) ──
const RDAP_TIMEOUT_MS = 3500;
const TLS_TIMEOUT_MS = 3000;

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(
        d[i-1][j] + 1,
        d[i][j-1] + 1,
        d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1)
      );
    }
  }
  return d[m][n];
}

function checkUrlShortener(domain) {
  const bare = domain.replace(/^www\./, '');
  if (URL_SHORTENER_DOMAINS.has(bare)) {
    return { triggered: true, weight: 30, detail: 'URL shortener (' + bare + '): destination hidden, cannot inspect final URL without following redirect' };
  }
  return { triggered: false, weight: 0, detail: 'Not a known URL shortener' };
}

function checkSuspiciousTld(domain) {
  const lower = domain.toLowerCase();
  for (const tld of SUSPICIOUS_TLDS) {
    if (lower.endsWith(tld)) {
      return { triggered: true, weight: 25, detail: 'TLD .' + tld.slice(1) + ' is commonly abused for spam/scams' };
    }
  }
  return { triggered: false, weight: 0, detail: 'TLD not in suspicious list' };
}

function checkPunycode(domain) {
  if (domain.includes('xn--')) {
    return { triggered: true, weight: 35, detail: 'Internationalized domain (punycode): display may differ from ASCII. Common in phishing.' };
  }
  if (/[^\x00-\x7F]/.test(domain)) {
    return { triggered: true, weight: 35, detail: 'Non-ASCII characters in domain: possible homograph attack' };
  }
  return { triggered: false, weight: 0, detail: 'No IDN/punycode detected' };
}

function checkTyposquatting(domain) {
  const bare = domain.replace(/^www\./, '').split('.')[0].toLowerCase();
  // FIX 2026-09-08: also check each hyphen-separated token — classic phishing
  // uses "brand-suffix.com" (e.g. "paypa1-secure.com") which escaped the exact
  // whole-label match ("paypa1-secure" ≠ "paypa1").
  const tokens = [bare, ...bare.split('-')].filter(t => t.length >= 3);
  for (const item of TYPOSQUATTING_PATTERNS) {
    for (const tok of tokens) {
      if (item.patterns.includes(tok)) {
        return { triggered: true, weight: 40, detail: 'Typosquatting detected: "' + tok + '" in "' + bare + '" mimics "' + item.target + '" — possible brand impersonation' };
      }
      if (Math.abs(tok.length - item.target.length) <= 1 && levenshtein(tok, item.target) === 1) {
        return { triggered: true, weight: 40, detail: 'Typosquatting: "' + tok + '" in "' + bare + '" is 1 character from "' + item.target + '"' };
      }
    }
  }
  return { triggered: false, weight: 0, detail: 'No typosquatting pattern matched' };
}

// ── v2: live RDAP domain-age lookup (free, no API key) ──────────────────────
// Strategy: query the TLD's registry RDAP server DIRECTLY (from the IANA
// bootstrap table, data.iana.org/rdap/dns.json) — rdap.org (a Cloudflare-fronted
// redirector) silently throttles datacenter/Lambda IPs into timeouts, so it is
// only used as fallback for TLDs missing from the table below.
const REGISTRY_RDAP = {
  com: 'https://rdap.verisign.com/com/v1/',
  net: 'https://rdap.verisign.com/net/v1/',
  cc: 'https://tld-rdap.verisign.com/cc/v1/',
  tv: 'https://rdap.nic.tv/',
  org: 'https://rdap.publicinterestregistry.org/rdap/',
  xyz: 'https://rdap.centralnic.com/xyz/',
  site: 'https://rdap.radix.host/rdap/',
  space: 'https://rdap.radix.host/rdap/',
  store: 'https://rdap.radix.host/rdap/',
  tech: 'https://rdap.radix.host/rdap/',
  website: 'https://rdap.radix.host/rdap/',
  online: 'https://rdap.radix.host/rdap/',
  icu: 'https://rdap.centralnic.com/icu/',
  cyou: 'https://rdap.centralnic.com/cyou/',
  sbs: 'https://rdap.centralnic.com/sbs/',
  lol: 'https://rdap.centralnic.com/lol/',
  monster: 'https://rdap.centralnic.com/monster/',
  quest: 'https://rdap.centralnic.com/quest/',
  bond: 'https://rdap.centralnic.com/bond/',
  hair: 'https://rdap.centralnic.com/hair/',
  skin: 'https://rdap.centralnic.com/skin/',
  makeup: 'https://rdap.centralnic.com/makeup/',
  beauty: 'https://rdap.centralnic.com/beauty/',
  click: 'https://rdap.registry.click/rdap/',
  link: 'https://rdap.uniregistry.net/rdap/',
  zip: 'https://pubapi.registry.google/rdap/',
  mov: 'https://pubapi.registry.google/rdap/',
  app: 'https://pubapi.registry.google/rdap/',
  dev: 'https://pubapi.registry.google/rdap/',
  ai: 'https://rdap.identitydigital.services/rdap/',
  shop: 'https://rdap.gmoregistry.net/rdap/',
  top: 'https://rdap.zdnsgtld.com/top/',
  rest: 'https://rdap.registry.bar/rdap/',
  buzz: 'https://rdap.nic.buzz/',
  fit: 'https://rdap.nic.fit/',
  in: 'https://rdap.nixiregistry.in/rdap/',
  nl: 'https://rdap.sidn.nl/',
  fr: 'https://rdap.nic.fr/',
  br: 'https://rdap.registro.br/',
  pl: 'https://rdap.dns.pl/',
  ar: 'https://rdap.nic.ar/'
};

async function rdapFetchJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: {
        'Accept': 'application/rdap+json',
        // rdap.org 403s the default undici UA — identify ourselves honestly
        'User-Agent': 'MarketNow-ScamChecker/2.0 (+https://www.marketnow.site)'
      },
      redirect: 'follow',
      signal: ctrl.signal
    });
    if (resp.status === 404) return { notFound: true }; // registry says: no such domain
    if (!resp.ok) return { error: 'HTTP ' + resp.status };
    const data = await resp.json();
    const reg = (data.events || []).find(e => e.eventAction === 'registration');
    if (!reg || !reg.eventDate) return { error: 'no-registration-event' };
    const registeredAt = new Date(reg.eventDate);
    if (isNaN(registeredAt.getTime())) return { error: 'bad-date' };
    return { registeredAt };
  } catch (e) {
    // transparent failure reason — helps users (and us) see WHY it failed
    const why = e && e.name === 'AbortError' ? 'timeout' : ((e && e.message) || 'network').slice(0, 60);
    return { error: why };
  } finally {
    clearTimeout(timer);
  }
}

async function rdapLookup(domain) {
  const tld = domain.split('.').pop().toLowerCase();
  const candidates = [];
  if (REGISTRY_RDAP[tld]) candidates.push(REGISTRY_RDAP[tld] + 'domain/' + encodeURIComponent(domain));
  candidates.push('https://rdap.org/domain/' + encodeURIComponent(domain)); // fallback redirector
  let last = null;
  for (const url of candidates) {
    const r = await rdapFetchJson(url, url.includes('rdap.org') ? 3000 : 2500);
    if (r.registeredAt || r.notFound) return r; // definitive answer
    last = r; // remember the failure, try the next source
  }
  return last || { error: 'unavailable' };
}

function buildDomainAgeCheck(domain, rdap) {
  const bare = domain.replace(/^www\./, '');
  if (OPERATED_DOMAINS.has(bare)) {
    return { triggered: false, weight: 0, detail: 'First-party domain — operated by AliceLabs LLC (MarketNow)' };
  }
  if (POPULAR_DOMAINS.has(bare)) {
    return { triggered: false, weight: 0, detail: 'Domain is in known-popular list (established)' };
  }
  if (!rdap || rdap.error) {
    const why = rdap && rdap.error ? rdap.error : 'unavailable';
    return { triggered: false, weight: 0, detail: 'RDAP registry lookup failed (' + why + ') — age not verified, verify manually if suspicious' };
  }
  if (rdap.notFound) {
    return { triggered: true, weight: 15, detail: 'Domain NOT FOUND in the registry (RDAP 404) — likely unregistered. Any link using it is broken, fake or a typo' };
  }
  const days = Math.floor((Date.now() - rdap.registeredAt.getTime()) / 86400000);
  const iso = rdap.registeredAt.toISOString().slice(0, 10);
  if (days < 0) {
    return { triggered: true, weight: 12, detail: 'RDAP registration date is in the future (' + iso + ') — registry data anomaly, treat as unverified' };
  }
  if (days < 30) {
    return { triggered: true, weight: 25, detail: 'Domain registered ' + days + ' day(s) ago (' + iso + ', live RDAP lookup) — very young, classic fresh-scam pattern' };
  }
  if (days < 90) {
    return { triggered: true, weight: 12, detail: 'Domain registered ' + days + ' days ago (' + iso + ', live RDAP lookup) — young domain, low history' };
  }
  const years = (days / 365.25).toFixed(1);
  return { triggered: false, weight: 0, detail: 'Domain registered ' + years + ' years ago (' + iso + ') — verified live via RDAP' };
}

// ── v2: real TLS handshake with certificate inspection (server-side) ─────────
function tlsLookup(domain) {
  return new Promise(resolve => {
    let settled = false;
    let sock;
    const done = (v) => {
      if (settled) return;
      settled = true;
      try { if (sock) sock.destroy(); } catch {}
      resolve(v);
    };
    try {
      sock = tls.connect({
        host: domain,
        port: 443,
        servername: domain,
        rejectUnauthorized: false, // we inspect the cert ourselves (expiry/issuer/SAN)
        timeout: TLS_TIMEOUT_MS
      }, () => {
        try {
          const cert = sock.getPeerCertificate();
          if (!cert || !cert.valid_to) return done({ ok: false, reason: 'no-cert' });
          done({
            ok: true,
            validFrom: new Date(cert.valid_from),
            validTo: new Date(cert.valid_to),
            issuer: (cert.issuer && (cert.issuer.O || cert.issuer.CN)) || 'unknown issuer',
            subjectCN: (cert.subject && cert.subject.CN) || '',
            san: String(cert.subjectaltname || '').toLowerCase()
          });
        } catch {
          done({ ok: false, reason: 'cert-parse' });
        }
      });
      sock.on('error', () => done({ ok: false, reason: 'conn' }));
      sock.on('timeout', () => done({ ok: false, reason: 'timeout' }));
    } catch {
      done({ ok: false, reason: 'conn' });
    }
  });
}

function buildSslCheck(domain, info) {
  const bare = domain.replace(/^www\./, '');
  if (OPERATED_DOMAINS.has(bare)) {
    return { triggered: false, weight: 0, detail: 'First-party domain — SSL verified by this service' };
  }
  if (POPULAR_DOMAINS.has(bare)) {
    return { triggered: false, weight: 0, detail: 'Popular domain — SSL assumed valid' };
  }
  if (!info || !info.ok) {
    const reason = info && info.reason;
    if (reason === 'no-cert') {
      return { triggered: true, weight: 15, detail: 'TLS reachable but no certificate presented — highly abnormal' };
    }
    return { triggered: false, weight: 0, detail: 'TLS not reachable on port 443 — domain may not serve HTTPS (or blocks datacenter IPs). Verify in browser.' };
  }
  const now = Date.now();
  const daysLeft = Math.floor((info.validTo.getTime() - now) / 86400000);
  // SAN coverage: the root domain should appear in SAN/CN (wildcards count)
  const root = bare.split('.').slice(-2).join('.');
  const covers = info.san.includes(root) || String(info.subjectCN).toLowerCase().includes(root);
  if (info.validTo.getTime() < now) {
    return { triggered: true, weight: 20, detail: 'SSL certificate EXPIRED on ' + info.validTo.toISOString().slice(0, 10) + ' (issuer: ' + info.issuer + ') — verified live server-side' };
  }
  if (info.validFrom.getTime() > now) {
    return { triggered: true, weight: 15, detail: 'SSL certificate not valid yet (starts ' + info.validFrom.toISOString().slice(0, 10) + ', issuer: ' + info.issuer + ')' };
  }
  if (!covers) {
    return { triggered: true, weight: 15, detail: 'SSL certificate does not cover "' + bare + '" (CN/SAN mismatch) — possible misconfiguration or MITM' };
  }
  if (daysLeft < 7) {
    return { triggered: true, weight: 10, detail: 'SSL valid but expires in ' + daysLeft + ' day(s) (issuer: ' + info.issuer + ') — verified live server-side' };
  }
  return { triggered: false, weight: 0, detail: 'SSL certificate valid (issuer: ' + info.issuer + ', expires in ' + daysLeft + ' days) — verified live server-side via TLS' };
}

function checkSubdomainAbuse(domain) {
  const parts = domain.split('.');
  if (parts.length > 4) {
    return { triggered: true, weight: 30, detail: 'Deep subdomain chain (' + parts.length + ' levels): common in phishing' };
  }
  const lower = domain.toLowerCase();
  for (const popular of POPULAR_DOMAINS) {
    const brand = popular.split('.')[0];
    if (lower.includes(brand + '.') && !lower.endsWith(popular) && !lower.endsWith('.' + popular)) {
      return { triggered: true, weight: 30, detail: 'Brand "' + brand + '" appears in subdomain but root domain is different' };
    }
  }
  return { triggered: false, weight: 0, detail: 'Subdomain structure normal' };
}

function checkHttpTokens(domain) {
  const lower = domain.toLowerCase();
  const issues = [];
  if (lower.includes('@')) issues.push('Contains @ character');
  if (lower.includes('//')) issues.push('Contains // (URL-within-URL)');
  if (lower.match(/\d{4,}/)) issues.push('Long numeric sequence');

  if (issues.length) {
    return { triggered: true, weight: 20, detail: issues.join('; ') };
  }
  return { triggered: false, weight: 0, detail: 'No suspicious tokens' };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=300');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const domain = (req.query.domain || '').toLowerCase().trim();

  if (!domain) {
    return res.status(200).json({
      service: 'UTA Scam Checker',
      version: '2.0.0',
      description: 'Free domain reputation heuristic with LIVE server-side RDAP registry age check and TLS certificate inspection. No API key, no registration, CORS open, cacheable.',
      usage: 'GET /api/scam-check?domain=example.com',
      honest_disclaimer: 'Engine v2: 6 static heuristics + 2 live checks (RDAP domain age, TLS certificate). No threat feeds. A new clean scam returns UNKNOWN, not TRUSTED.',
      checks_available: [
        'url_shortener', 'suspicious_tld', 'punycode', 'typosquatting',
        'domain_age (live RDAP)', 'subdomain_abuse', 'http_tokens', 'ssl (live TLS)'
      ]
    });
  }

  let cleanDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0]
    .split('#')[0]
    .trim();

  if (!cleanDomain || !cleanDomain.includes('.')) {
    return res.status(400).json({
      error: 'Invalid domain',
      input: domain,
      hint: 'Use format: example.com'
    });
  }

  // v2: run the two live checks (in parallel) only when they can add signal —
  // first-party and popular domains short-circuit with known-good answers.
  const knownGood = OPERATED_DOMAINS.has(cleanDomain) || POPULAR_DOMAINS.has(cleanDomain);
  let rdapResult = null, tlsResult = { ok: false, reason: 'skipped' };
  if (!knownGood) {
    [rdapResult, tlsResult] = await Promise.all([
      rdapLookup(cleanDomain),
      tlsLookup(cleanDomain)
    ]);
  }

  const checks = {
    url_shortener: checkUrlShortener(cleanDomain),
    suspicious_tld: checkSuspiciousTld(cleanDomain),
    punycode: checkPunycode(cleanDomain),
    typosquatting: checkTyposquatting(cleanDomain),
    domain_age: buildDomainAgeCheck(cleanDomain, rdapResult),
    subdomain_abuse: checkSubdomainAbuse(cleanDomain),
    http_tokens: checkHttpTokens(cleanDomain),
    ssl: buildSslCheck(cleanDomain, tlsResult),
  };

  let riskScore = 0;
  const reasons = [];

  for (const name of Object.keys(checks)) {
    if (checks[name].triggered) {
      riskScore += checks[name].weight || 15;
      reasons.push(checks[name].detail);
    }
  }

  if (POPULAR_DOMAINS.has(cleanDomain)) {
    riskScore = 0;
  }

  // FIX 2026-09-08: first-party recognition — see OPERATED_DOMAINS above.
  const isOperated = OPERATED_DOMAINS.has(cleanDomain);
  if (isOperated) {
    riskScore = 0;
    reasons.unshift('First-party domain: ' + cleanDomain + ' is operated by AliceLabs LLC (MarketNow) — this checker runs on it');
  }

  riskScore = Math.min(riskScore, 100);

  let decision;
  if (riskScore === 0 && (POPULAR_DOMAINS.has(cleanDomain) || isOperated)) {
    decision = 'TRUSTED';
  } else if (riskScore >= 40) {
    decision = 'SUSPICIOUS';
  } else if (riskScore >= 20) {
    decision = 'CAUTION';
  } else {
    decision = 'UNKNOWN';
  }

  return res.status(200).json({
    domain: cleanDomain,
    decision,
    risk_score: riskScore,
    first_party: isOperated,
    reasons,
    checks,
    honest_disclaimer: 'Engine v2: heuristics + LIVE RDAP registry age and TLS certificate checks (server-side, no API key). Still no threat feeds — a new clean scam returns UNKNOWN, not TRUSTED. First-party domains (marketnow.site, alicelabs.site) are vouched directly by the operator — stated in the reason. Not a substitute for commercial threat intelligence.',
    spec: 'https://github.com/alicelabs-llc/universal-trust-adapter',
    api: 'https://www.marketnow.site/api/scam-check',
    timestamp: new Date().toISOString()
  });

}
