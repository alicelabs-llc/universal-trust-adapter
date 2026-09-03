// /api/scam-check.js
// UTA Scam Checker — Domain reputation heuristic engine
// 
// GET /api/scam-check?domain=example.com
// 
// Returns:
//   {
//     "domain": "example.com",
//     "decision": "TRUSTED" | "CAUTION" | "SUSPICIOUS" | "UNKNOWN",
//     "risk_score": 0-100,
//     "reasons": ["URL shortener: destination hidden", ...],
//     "checks": {
//       "url_shortener": { "triggered": false, "detail": "..." },
//       "domain_age": { "triggered": false, "detail": "..." },
//       "ssl": { "triggered": false, "detail": "..." },
//       "suspicious_tld": { "triggered": false, "detail": "..." },
//       "punycode": { "triggered": false, "detail": "..." },
//       "typosquatting": { "triggered": false, "detail": "..." }
//     },
//     "honest_disclaimer": "Heuristic v1. No threat feeds. A new clean scam returns UNKNOWN, not TRUSTED.",
//     "timestamp": "2026-09-03T..."
//   }

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
    return { triggered: true, detail: 'URL shortener (' + bare + '): destination hidden, cannot inspect final URL without following redirect' };
  }
  return { triggered: false, detail: 'Not a known URL shortener' };
}

function checkSuspiciousTld(domain) {
  const lower = domain.toLowerCase();
  for (const tld of SUSPICIOUS_TLDS) {
    if (lower.endsWith(tld)) {
      return { triggered: true, detail: 'TLD .' + tld.slice(1) + ' is commonly abused for spam/scams' };
    }
  }
  return { triggered: false, detail: 'TLD not in suspicious list' };
}

function checkPunycode(domain) {
  if (domain.includes('xn--')) {
    return { triggered: true, detail: 'Internationalized domain (punycode): display may differ from ASCII. Common in phishing.' };
  }
  if (/[^\x00-\x7F]/.test(domain)) {
    return { triggered: true, detail: 'Non-ASCII characters in domain: possible homograph attack' };
  }
  return { triggered: false, detail: 'No IDN/punycode detected' };
}

function checkTyposquatting(domain) {
  const bare = domain.replace(/^www\./, '').split('.')[0].toLowerCase();
  for (const item of TYPOSQUATTING_PATTERNS) {
    if (item.patterns.includes(bare)) {
      return { triggered: true, detail: 'Typosquatting detected: "' + bare + '" mimics "' + item.target + '" — possible brand impersonation' };
    }
    if (Math.abs(bare.length - item.target.length) <= 1 && levenshtein(bare, item.target) === 1) {
      return { triggered: true, detail: 'Typosquatting: "' + bare + '" is 1 character from "' + item.target + '"' };
    }
  }
  return { triggered: false, detail: 'No typosquatting pattern matched' };
}

function checkDomainAge(domain) {
  const bare = domain.replace(/^www\./, '');
  if (POPULAR_DOMAINS.has(bare)) {
    return { triggered: false, detail: 'Domain is in known-popular list (established)' };
  }
  return { triggered: false, detail: 'WHOIS age not checked (no API key) — verify manually if suspicious' };
}

function checkSubdomainAbuse(domain) {
  const parts = domain.split('.');
  if (parts.length > 4) {
    return { triggered: true, detail: 'Deep subdomain chain (' + parts.length + ' levels): common in phishing' };
  }
  const lower = domain.toLowerCase();
  for (const popular of POPULAR_DOMAINS) {
    const brand = popular.split('.')[0];
    if (lower.includes(brand + '.') && !lower.endsWith(popular) && !lower.endsWith('.' + popular)) {
      return { triggered: true, detail: 'Brand "' + brand + '" appears in subdomain but root domain is different' };
    }
  }
  return { triggered: false, detail: 'Subdomain structure normal' };
}

function checkHttpTokens(domain) {
  const lower = domain.toLowerCase();
  const issues = [];
  if (lower.includes('@')) issues.push('Contains @ character');
  if (lower.includes('//')) issues.push('Contains // (URL-within-URL)');
  if (lower.match(/\d{4,}/)) issues.push('Long numeric sequence');
  
  if (issues.length) {
    return { triggered: true, detail: issues.join('; ') };
  }
  return { triggered: false, detail: 'No suspicious tokens' };
}

function checkSsl(domain) {
  const bare = domain.replace(/^www\./, '');
  if (POPULAR_DOMAINS.has(bare)) {
    return { triggered: false, detail: 'Popular domain — SSL assumed valid' };
  }
  return { triggered: false, detail: 'SSL not checked server-side. Verify in browser.' };
}

module.exports = async (req, res) => {
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
      version: '1.0.0',
      description: 'Free domain reputation heuristic. No API key, no registration, CORS open, cacheable.',
      usage: 'GET /api/scam-check?domain=example.com',
      honest_disclaimer: 'Heuristic v1. No threat feeds. A new clean scam returns UNKNOWN, not TRUSTED.',
      checks_available: [
        'url_shortener', 'suspicious_tld', 'punycode', 'typosquatting',
        'domain_age', 'subdomain_abuse', 'http_tokens', 'ssl'
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
  
  const checks = {
    url_shortener: checkUrlShortener(cleanDomain),
    suspicious_tld: checkSuspiciousTld(cleanDomain),
    punycode: checkPunycode(cleanDomain),
    typosquatting: checkTyposquatting(cleanDomain),
    domain_age: checkDomainAge(cleanDomain),
    subdomain_abuse: checkSubdomainAbuse(cleanDomain),
    http_tokens: checkHttpTokens(cleanDomain),
    ssl: checkSsl(cleanDomain),
  };
  
  let riskScore = 0;
  const reasons = [];
  
  const weights = {
    url_shortener: 30, typosquatting: 40, punycode: 35, suspicious_tld: 25,
    subdomain_abuse: 30, http_tokens: 20, domain_age: 0, ssl: 0
  };
  
  for (const name of Object.keys(checks)) {
    if (checks[name].triggered) {
      riskScore += weights[name] || 15;
      reasons.push(checks[name].detail);
    }
  }
  
  if (POPULAR_DOMAINS.has(cleanDomain)) {
    riskScore = 0;
  }
  
  riskScore = Math.min(riskScore, 100);
  
  let decision;
  if (riskScore === 0 && POPULAR_DOMAINS.has(cleanDomain)) {
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
    reasons,
    checks,
    honest_disclaimer: 'Heuristic v1. No threat feeds. A new clean scam returns UNKNOWN, not TRUSTED. Not a substitute for commercial threat intelligence.',
    spec: 'https://github.com/alicelabs-llc/universal-trust-adapter',
    api: 'https://www.marketnow.site/api/scam-check',
    timestamp: new Date().toISOString()
  });
};
