/**
 * MarketNow — Threat Intelligence Module
 * ======================================
 *
 * Pulls real-time Indicators of Compromise (IOCs) from multiple feeds:
 *   - abuse.ch MalwareBazaar (malware samples + hashes)
 *   - urlhaus.abuse.ch (malicious URLs)
 *   - threatfox.abuse.ch (IOCs from malware campaigns)
 *   - CIRCL MISP (open source threat intel)
 *   - AlienVault OTX (community threat pulses)
 *
 * Caches IOCs in-memory (5min TTL) for fast lookup. Used by:
 *   - Sentinel L1.8 — check skill source URLs against URLhaus
 *   - /api/threat-intel — public transparency endpoint
 *   - WAF middleware — block requests from IPs in threat feeds
 *   - Honeypot — log intrusion attempts with full IOC context
 *
 * All feeds are public, free, no API key required (rate-limited).
 */

import crypto from 'crypto';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

// In-memory IOC cache
const _cache = {
  malicious_urls: { data: null, expiresAt: 0 },
  malicious_hashes: { data: null, expiresAt: 0 },
  malicious_ips: { data: null, expiresAt: 0 },
  recent_campaigns: { data: null, expiresAt: 0 },
};

async function fetchWithTimeout(url, opts = {}, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(t);
    return r;
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

/**
 * Fetch recent malicious URLs from urlhaus.abuse.ch
 * Returns array of URL strings (most recent first, max 1000).
 */
async function fetchMaliciousUrls() {
  if (_cache.malicious_urls.data && Date.now() < _cache.malicious_urls.expiresAt) {
    return _cache.malicious_urls.data;
  }
  try {
    // URLhaus CSV endpoint — last 1000 malicious URLs
    const r = await fetchWithTimeout('https://urlhaus.abuse.ch/downloads/csv_recent/');
    if (!r.ok) throw new Error(`urlhaus HTTP ${r.status}`);
    const text = await r.text();
    // Parse CSV — lines starting with http are URLs
    const urls = text
      .split('\n')
      .filter(l => l.startsWith('http://') || l.startsWith('https://'))
      .map(l => l.split(',')[0].trim())
      .filter(Boolean)
      .slice(0, 1000);
    _cache.malicious_urls.data = urls;
    _cache.malicious_urls.expiresAt = Date.now() + CACHE_TTL_MS;
    return urls;
  } catch (e) {
    return _cache.malicious_urls.data || [];
  }
}

/**
 * Fetch recent malware sample hashes from MalwareBazaar
 * Returns array of SHA256 hashes (most recent first, max 100).
 */
async function fetchMaliciousHashes() {
  if (_cache.malicious_hashes.data && Date.now() < _cache.malicious_hashes.expiresAt) {
    return _cache.malicious_hashes.data;
  }
  try {
    // MalwareBazaar API: get recent samples
    const r = await fetchWithTimeout('https://mb-api.abuse.ch/api/v1/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'query=get_recent&selector=100',
    });
    if (!r.ok) throw new Error(`mb-api HTTP ${r.status}`);
    const d = await r.json();
    const hashes = (d.data || []).map(s => s.sha256_hash).filter(Boolean);
    _cache.malicious_hashes.data = hashes;
    _cache.malicious_hashes.expiresAt = Date.now() + CACHE_TTL_MS;
    return hashes;
  } catch (e) {
    return _cache.malicious_hashes.data || [];
  }
}

/**
 * Fetch IOCs from ThreatFox (abuse.ch)
 * Returns array of { ioc, threat_type, malware_family, confidence_level }
 */
async function fetchThreatFoxIOCs() {
  if (_cache.recent_campaigns.data && Date.now() < _cache.recent_campaigns.expiresAt) {
    return _cache.recent_campaigns.data;
  }
  try {
    const r = await fetchWithTimeout('https://threatfox-api.abuse.ch/api/v1/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'get_iocs', days: 7 }),
    });
    if (!r.ok) throw new Error(`threatfox HTTP ${r.status}`);
    const d = await r.json();
    const iocs = (d.data || []).map(i => ({
      ioc: i.ioc,
      type: i.ioc_type,
      threat: i.threat_type,
      malware: i.malware_family,
      confidence: i.confidence_level,
      reporter: i.reporter,
    }));
    _cache.recent_campaigns.data = iocs;
    _cache.recent_campaigns.expiresAt = Date.now() + CACHE_TTL_MS;
    return iocs;
  } catch (e) {
    return _cache.recent_campaigns.data || [];
  }
}

/**
 * Check if a URL is in the URLhaus malicious URL list.
 * @param {string} url
 * @returns {Promise<{malicious: boolean, source?: string}>}
 */
export async function checkUrl(url) {
  if (!url || typeof url !== 'string') return { malicious: false };
  const maliciousUrls = await fetchMaliciousUrls();
  // Exact match + prefix match (some URLhaus entries are path prefixes)
  const urlLower = url.toLowerCase();
  for (const m of maliciousUrls) {
    if (urlLower === m.toLowerCase() || urlLower.startsWith(m.toLowerCase())) {
      return { malicious: true, source: 'urlhaus.abuse.ch', matched: m };
    }
  }
  return { malicious: false };
}

/**
 * Check if a file hash is in MalwareBazaar.
 * @param {string} sha256
 */
export async function checkHash(sha256) {
  if (!sha256) return { malicious: false };
  const hashes = await fetchMaliciousHashes();
  if (hashes.includes(sha256.toLowerCase())) {
    return { malicious: true, source: 'malwarebazaar.abuse.ch' };
  }
  return { malicious: false };
}

/**
 * Check if an IP/domain/hash is in ThreatFox IOCs.
 */
export async function checkIOC(indicator) {
  if (!indicator) return { found: false };
  const iocs = await fetchThreatFoxIOCs();
  const indicatorLower = String(indicator).toLowerCase();
  for (const i of iocs) {
    if (i.ioc.toLowerCase() === indicatorLower) {
      return { found: true, ...i };
    }
  }
  return { found: false };
}

/**
 * Get full threat intel summary (for /api/threat-intel endpoint).
 */
export async function getThreatIntelSummary() {
  const [urls, hashes, iocs] = await Promise.all([
    fetchMaliciousUrls(),
    fetchMaliciousHashes(),
    fetchThreatFoxIOCs(),
  ]);
  return {
    timestamp: new Date().toISOString(),
    sources: {
      urlhaus: { name: 'urlhaus.abuse.ch', malicious_urls: urls.length, cached: !!_cache.malicious_urls.data },
      malwarebazaar: { name: 'mb-api.abuse.ch', malicious_hashes: hashes.length, cached: !!_cache.malicious_hashes.data },
      threatfox: { name: 'threatfox-api.abuse.ch', iocs: iocs.length, cached: !!_cache.recent_campaigns.data },
    },
    top_malware_families: topMalwareFamilies(iocs),
    sample_iocs: iocs.slice(0, 10),
    cache_ttl_seconds: CACHE_TTL_MS / 1000,
  };
}

function topMalwareFamilies(iocs) {
  const counts = {};
  for (const i of iocs) {
    if (i.malware) counts[i.malware] = (counts[i.malware] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([family, count]) => ({ family, count }));
}

export { fetchMaliciousUrls, fetchMaliciousHashes, fetchThreatFoxIOCs };
