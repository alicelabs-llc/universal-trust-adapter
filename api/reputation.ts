/**
 * api/reputation.ts — UTA Domain Reputation Endpoint (reference implementation)
 * Engine: uta-reputation-v1.1 · Spec: api/reputation-spec.md (canonical)
 *
 * SELF-CONTAINED: the engine (evaluateDomain) is inlined so this single file is
 * deployable anywhere that runs a Web-API request handler — tested on Vercel
 * Edge (drop into `api/`, zero config, zero env vars).
 *
 * PARITY NOTE: ProdIntel (alicelabs-llc/Scraper · services/sourceTrust.ts) runs
 * the same rules client-side for instant badges; this file is the canonical
 * server copy. Any rule change MUST land in both and bump the engine version.
 *
 * Design guarantees:
 *  - No secrets, no API keys, no external calls: free forever, zero egress.
 *  - Deterministic per (engine version, domain): safe to cache 24h (CDN + client).
 *  - Display consumers fail soft to local verdicts; fail-closed for ACTIONS is
 *    the caller's policy (spec §6).
 */

export const REPUTATION_ENGINE_VERSION = 'uta-reputation-v1.1';

export type SourceStatus = 'marketplace' | 'external' | 'caution' | 'risky';
export type TrustVerdict = 'trusted' | 'unknown' | 'caution' | 'risky';

export interface SourceAssessment {
  status: SourceStatus;
  verdict: TrustVerdict;
  score: number;
  domain: string;
  reasons: string[];
}

const KNOWN_MARKETPLACES = [
  'amazon.', 'amzn.to', 'tiktok.com', 'aliexpress.', 'alibaba.',
  'etsy.com', 'ebay.', 'walmart.com', 'target.com', 'bestbuy.com',
  'shein.com', 'temu.com', 'mercadolibre.', 'mercadolibre.com',
  'shopify.com', 'flipkart.', 'jd.com', 'rakuten.', 'wayfair.',
  'homedepot.com', 'lowes.com', 'chinabrands.', 'dhgate.',
];

const URL_SHORTENERS = [
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'cutt.ly',
  'rb.gy', 'shorturl.at', 'ow.ly', 'buff.ly', 'rebrand.ly', 'tiny.cc',
  'shorte.st', 'clk.sh', 'shrinkme.', 'urlshortener.',
];

const HIGH_ABUSE_TLDS = ['.zip', '.top', '.click', '.loan', '.review', '.country', '.download'];

/** Free-hosting / instant-store platforms: anyone can publish in minutes. */
const LOW_BARRIER_HOSTS = ['myshopify.', 'blogspot.', 'wixsite.', 'weebly.', '000webhostapp.'];

/** Typosquat lures: well-known brands deliberately misspelled (leetspeak). */
const BRAND_TYPOSQUAT = /(amaz[0o4]n|al[i1]express|payp[a4]l|go[o0]{2}gle|faceb[o0][o0]k|app[l1]e\.|m[i1]cr[o0]s[o0]ft|netf[l1]ix|st[r]?[i1]pe|w[a4]lm[a4]rt)/;

/** Brand impersonation amplifiers: credibility words paired with a brand token. */
const SUSPICIOUS_WORDS = /(login|secure|verify|account|support|billing|wallet|recovery|helpdesk)/;
const BRAND_TOKEN = /(amazon|aliexpress|paypal|google|facebook|apple|microsoft|netflix|stripe|walmart|tiktok|instagram|whatsapp|binance|metamask)/;

const BASE_SCORE: Record<SourceStatus, number> = { marketplace: 95, external: 55, caution: 35, risky: 8 };

/** Normalize any input (full URL or bare domain) to a parsable form. */
function toParsable(input: string): string {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return 'https://' + trimmed.replace(/^\/+/, '');
}

/**
 * Total function: evaluate ANY input (URL, bare domain, garbage) and return a
 * verdict with transparent reasons. Never throws, never returns null.
 */
export function evaluateDomain(input: string): SourceAssessment {
  if (!input || typeof input !== 'string' || input.length > 2048) {
    return { status: 'caution', verdict: 'caution', score: 20, domain: 'invalid-input', reasons: ['empty or malformed input'] };
  }

  let parsed: URL;
  try {
    parsed = new URL(toParsable(input));
  } catch {
    return { status: 'caution', verdict: 'caution', score: 20, domain: 'invalid-url', reasons: ['malformed URL'] };
  }

  const host = parsed.hostname.toLowerCase();
  const reasons: string[] = [];
  let penalties = 0;

  // Risky: IP literal instead of a name
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return { status: 'risky', verdict: 'risky', score: 8, domain: host, reasons: ['host is a raw IP address'] };
  }

  // Risky: punycode (possible homoglyph attack: xn--)
  if (host.includes('xn--')) {
    return { status: 'risky', verdict: 'risky', score: 8, domain: host, reasons: ['punycode domain (possible look-alike)'] };
  }

  // Risky: URL shortener hides the real destination
  if (URL_SHORTENERS.some((s) => host === s || host.endsWith('.' + s) || host.includes(s))) {
    return { status: 'risky', verdict: 'risky', score: 8, domain: host, reasons: ['URL shortener (destination hidden)'] };
  }

  const lowBarrier = LOW_BARRIER_HOSTS.some((h) => host.includes(h));
  const marketplace = !lowBarrier && KNOWN_MARKETPLACES.some((m) => host.includes(m));

  // Risky: brand typosquat (amaz0n-pay.net) or brand + credibility word (amazon-secure.xyz).
  const typo = BRAND_TYPOSQUAT.test(host);
  const amplified = BRAND_TOKEN.test(host) && SUSPICIOUS_WORDS.test(host);
  if ((typo || amplified) && !marketplace) {
    reasons.push(typo ? 'brand typosquat pattern (possible look-alike)' : 'brand name paired with credential-phishing word');
    return { status: 'risky', verdict: 'risky', score: 8, domain: host, reasons };
  }

  // Caution signals (each adds a penalty)
  if (parsed.protocol === 'http:') { reasons.push('unencrypted (http)'); penalties += 15; }

  const params = [...parsed.searchParams.keys()];
  if (['url', 'redirect', 'goto', 'next', 'dest'].some((p) => params.includes(p))) {
    reasons.push('redirect parameter in URL'); penalties += 10;
  }

  if (HIGH_ABUSE_TLDS.some((t) => host.endsWith(t))) {
    reasons.push(`high-abuse TLD (${host.slice(host.lastIndexOf('.'))})`); penalties += 10;
  }

  if (lowBarrier) {
    reasons.push('hosted on instant-publish platform (low barrier)'); penalties += 10;
  }

  const hyphens = (host.match(/-/g) || []).length;
  if (!marketplace && hyphens >= 4) { reasons.push(`unusual domain structure (${hyphens} hyphens)`); penalties += 5; }

  if (marketplace) {
    return { status: 'marketplace', verdict: 'trusted', score: BASE_SCORE.marketplace - Math.min(penalties, 20), domain: host, reasons: ['known marketplace'] };
  }
  if (reasons.length > 0) {
    return { status: 'caution', verdict: 'caution', score: Math.max(5, BASE_SCORE.caution - penalties), domain: host, reasons };
  }
  return { status: 'external', verdict: 'unknown', score: BASE_SCORE.external, domain: host, reasons: [] };
}

// ---------------------------------------------------------------------------
// HTTP surface (Vercel Edge / any Web-API runtime)
// ---------------------------------------------------------------------------

const SPEC_URL = 'https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/api/reputation-spec.md';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      ...CORS,
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json({ error: 'method not allowed', engine: REPUTATION_ENGINE_VERSION }, 405);
  }

  const requestUrl = new URL(req.url);

  if (requestUrl.searchParams.has('probe')) {
    return json({ probe: true, engine: REPUTATION_ENGINE_VERSION, spec: SPEC_URL });
  }

  let input = requestUrl.searchParams.get('url') || requestUrl.searchParams.get('domain') || '';
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        input = (typeof b.url === 'string' && b.url) || (typeof b.domain === 'string' && b.domain) || input;
      }
    } catch {
      return json({ error: 'invalid JSON body', engine: REPUTATION_ENGINE_VERSION }, 400);
    }
  }

  if (!input) {
    return json(
      { error: 'missing input: pass ?url= or ?domain= (GET), or {"url"|"domain"} (POST)', engine: REPUTATION_ENGINE_VERSION, spec: SPEC_URL },
      400
    );
  }

  const a = evaluateDomain(input);
  return json({
    engine: REPUTATION_ENGINE_VERSION,
    input,
    domain: a.domain,
    verdict: a.verdict,
    status: a.status,
    score: a.score,
    reasons: a.reasons,
    checked_at: new Date().toISOString(),
    ttl: 86400,
  });
}

// Vercel Edge runtime marker (ignored by other hosts).
export const config = { runtime: 'edge' };
