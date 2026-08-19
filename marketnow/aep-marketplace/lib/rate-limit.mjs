/**
 * MarketNow — Rate Limiter (in-memory, IP-based)
 * ================================================
 *
 * PROBLEMA: Los headers X-RateLimit-Limit eran cosméticos. Sin enforcement,
 *           un usuario podía hacer 1000 req/s y agotar GitHub API o Base RPC.
 *
 * SOLUCIÓN:
 *   - Map en memoria del módulo (sobrevive warm starts)
 *   - Sliding window de 60 segundos
 *   - Tres tiers: search/audit (60/min), purchase (20/min), mandates (30/min)
 *   - Limpieza periódica de IPs expiradas (cada 5 min)
 *
 * LIMITACIONES:
 *   - En cold start, el Map se reinicia. Un atacante que pegue funciones frías
 *     podría evadirlo parcialmente. Para fix real, migrar a Upstash Redis.
 *   - En Vercel, cada región tiene su propio Map (no es global).
 */

const _ipMap = new Map();
const WINDOW_MS = 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let _lastCleanup = Date.now();

const TIERS = {
  search: 60,       // 60 req/min — read-only, cheap
  audit: 30,        // 30 req/min — heavier compute
  purchase: 20,     // 20 req/min — money involved
  mandates: 30,     // 30 req/min — mandate CRUD
  general: 60,      // default
};

/**
 * Middleware de rate limiting.
 * @returns {boolean} true si fue rate-limited (y respondió), false si OK
 */
function checkRateLimit(req, res, tier = 'general') {
  const ip = getClientIp(req);
  const limit = TIERS[tier] || TIERS.general;
  const now = Date.now();

  // Cleanup periódico
  if (now - _lastCleanup > CLEANUP_INTERVAL_MS) {
    _cleanupOldEntries(now);
    _lastCleanup = now;
  }

  const key = `${ip}:${tier}`;
  let entries = _ipMap.get(key) || [];

  entries = entries.filter(ts => now - ts < WINDOW_MS);

  if (entries.length >= limit) {
    const oldest = entries[0];
    const retryAfter = Math.ceil((WINDOW_MS - (now - oldest)) / 1000);

    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', String(Math.ceil((oldest + WINDOW_MS) / 1000)));
    res.setHeader('Retry-After', String(retryAfter));

    res.status(429).json({
      error: 'rate_limited',
      message: `Too many requests. Limit: ${limit} per minute for ${tier}.`,
      retry_after_seconds: retryAfter,
      tier,
      limit,
      window_seconds: 60,
    });
    return true;
  }

  entries.push(now);
  _ipMap.set(key, entries);

  const remaining = limit - entries.length;
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil((now + WINDOW_MS) / 1000)));

  return false;
}

function getClientIp(req) {
  // SECURITY FIX: Use x-vercel-forwarded-for (Vercel's trusted header) first.
  // This header is set by Vercel's edge network and CANNOT be spoofed by clients.
  // Then fall back to the LAST value in x-forwarded-for (the real client IP
  // added by the proxy), NOT the first value (which can be spoofed by the client).
  //
  // Previously: xff.split(',')[0] — the client could send a fake
  // X-Forwarded-For: 1.2.3.4 header, and we'd use that as the IP,
  // bypassing rate limits entirely.
  const vercelIp = req.headers['x-vercel-forwarded-for'];
  if (vercelIp) {
    return vercelIp.split(',').pop().trim();
  }
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    // Use the LAST value — proxies append the real client IP at the end.
    // The first value can be client-controlled and spoofed.
    const parts = xff.split(',').map(s => s.trim());
    return parts[parts.length - 1] || 'unknown';
  }
  if (req.headers['x-real-ip']) {
    return req.headers['x-real-ip'];
  }
  if (req.socket?.remoteAddress) {
    return req.socket.remoteAddress;
  }
  return 'unknown';
}

function _cleanupOldEntries(now) {
  for (const [key, entries] of _ipMap.entries()) {
    const filtered = entries.filter(ts => now - ts < WINDOW_MS);
    if (filtered.length === 0) {
      _ipMap.delete(key);
    } else {
      _ipMap.set(key, filtered);
    }
  }
}

function getStats() {
  let totalRequests = 0;
  const uniqueIps = new Set();
  for (const [key, entries] of _ipMap.entries()) {
    totalRequests += entries.length;
    uniqueIps.add(key.split(':')[0]);
  }
  return {
    tracked_keys: _ipMap.size,
    unique_ips: uniqueIps.size,
    requests_in_window: totalRequests,
    tiers: TIERS,
    window_seconds: 60,
  };
}

function reset() {
  _ipMap.clear();
  _lastCleanup = Date.now();
}

export {
  checkRateLimit,
  getClientIp,
  getStats,
  reset,
  TIERS,
};
