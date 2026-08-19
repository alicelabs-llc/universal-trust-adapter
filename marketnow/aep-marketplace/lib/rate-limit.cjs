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
 *
 * MEJORA FUTURA:
 *   - Upstash Redis (free tier: 10k req/day, suficiente para 100 usuarios)
 *   - Cloudflare Workers KV ($5/mes para 10M reads)
 */

const _ipMap = new Map(); // ip -> [{ timestamp, route }]
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
 *
 * Uso:
 *   import { checkRateLimit } from '../lib/rate-limit.cjs';
 *   const limited = checkRateLimit(req, res, 'purchase');
 *   if (limited) return;  // ya respondió 429
 *
 * @param {Request} req - Vercel request
 * @param {Response} res - Vercel response
 * @param {'search'|'audit'|'purchase'|'mandates'|'general'} tier
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

  // Filtrar entradas viejas (sliding window)
  entries = entries.filter(ts => now - ts < WINDOW_MS);

  if (entries.length >= limit) {
    // Rate limited
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

  // OK — registrar esta request
  entries.push(now);
  _ipMap.set(key, entries);

  // Headers informativos
  const remaining = limit - entries.length;
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil((now + WINDOW_MS) / 1000)));

  return false;
}

/**
 * Extrae la IP del cliente. Considera el header x-forwarded-for de Vercel.
 */
function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    // Vercel envía: "client-ip, proxy1, proxy2"
    return xff.split(',')[0].trim();
  }
  if (req.headers['x-real-ip']) {
    return req.headers['x-real-ip'];
  }
  if (req.socket?.remoteAddress) {
    return req.socket.remoteAddress;
  }
  return 'unknown';
}

/**
 * Limpia entradas expiradas para evitar memory leak.
 */
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

/**
 * Stats para /health o /trust.
 */
function getStats() {
  let totalRequests = 0;
  let uniqueIps = new Set();
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

/**
 * Reset (para tests).
 */
function reset() {
  _ipMap.clear();
  _lastCleanup = Date.now();
}

module.exports = {
  checkRateLimit,
  getClientIp,
  getStats,
  reset,
  TIERS,
};
