/**
 * MarketNow — Distributed rate limiter via Upstash Redis
 * =======================================================
 *
 * Replaces the in-memory Map in lib/rate-limit.mjs for production use.
 *
 * Why Upstash?
 *   - Free tier (10k requests/day) covers MarketNow's traffic.
 *   - REST API works on Vercel Edge / serverless (no persistent TCP).
 *   - Global, survives cold starts and multi-region deployments.
 *
 * Algorithm: fixed-window counter
 *   - Key:   `${prefix}:${bucket}`  where bucket = floor(now/windowMs)
 *   - INCR is atomic → no race conditions.
 *   - EXPIRE on first creation so the key auto-evicts.
 *
 * Fallback: if UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN are not
 * configured, the module falls back to an in-memory Map. This is per-process
 * (per Vercel instance) and resets on cold start — fine for local dev, not
 * for production. The Supabase-backed fallback in lib/supabase-client.mjs
 * is preferred for production-without-Redis scenarios.
 *
 * Required env vars (only for the Redis path):
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * Optional:
 *   RATE_LIMIT_REDIS_PREFIX  default 'mn:rl:'
 *   RATE_LIMIT_DEBUG=1       log every check to stderr
 */

const PREFIX = process.env.RATE_LIMIT_REDIS_PREFIX || 'mn:rl:';
const DEBUG = process.env.RATE_LIMIT_DEBUG === '1';

// ─── Lazy Redis singleton ──────────────────────────────────────────────────
let _redis = null;
let _redisInitAttempted = false;
let _redisInitError = null;

async function getRedis() {
  if (_redisInitAttempted) {
    if (_redisInitError) throw _redisInitError;
    return _redis;
  }
  _redisInitAttempted = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    _redisInitError = new Error('UPSTASH_REDIS_REST_URL/TOKEN not set');
    throw _redisInitError;
  }

  let mod;
  try {
    mod = await import('@upstash/redis');
  } catch (err) {
    _redisInitError = new Error(
      '@upstash/redis not installed. Run: npm install @upstash/redis'
    );
    throw _redisInitError;
  }

  // The Upstash SDK exposes `Redis` as a named export and also has a
  // `Redis.fromEnv()` helper that reads the same env vars. We construct
  // explicitly so we can pass them through Vercel's env interpolation.
  const RedisCtor = mod.Redis || mod.default?.Redis;
  if (!RedisCtor) {
    _redisInitError = new Error('@upstash/redis: Redis export not found');
    throw _redisInitError;
  }
  _redis = new RedisCtor({ url, token });
  return _redis;
}

// ─── In-memory fallback ─────────────────────────────────────────────────────
// Mirrors the legacy Map in lib/rate-limit.mjs. Used only when Upstash env
// vars are missing. NOT safe for multi-instance production.
const _memMap = new Map();

function memCheck(key, limit, windowMs) {
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const redisKey = `${PREFIX}${key}:${bucket}`;
  const entry = _memMap.get(redisKey);
  let count = 0;
  if (entry && entry.expiresAt > now) {
    count = entry.count + 1;
  } else {
    count = 1;
  }
  _memMap.set(redisKey, { count, expiresAt: bucket * windowMs + windowMs });

  // Opportunistic cleanup
  if (_memMap.size > 10_000) {
    for (const [k, v] of _memMap) {
      if (v.expiresAt <= now) _memMap.delete(k);
    }
  }

  const allowed = count <= limit;
  const retryAfterMs = allowed ? 0 : bucket * windowMs + windowMs - now;
  if (DEBUG) console.warn(`[rate-limit-redis:mem] key=${key} count=${count}/${limit} allowed=${allowed}`);
  return {
    allowed,
    remaining: Math.max(0, limit - count),
    retry_after_ms: retryAfterMs,
    source: 'memory',
  };
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Check rate limit against Upstash Redis. Falls back to in-memory if Upstash
 * is not configured.
 *
 * @param {string} key       opaque identifier, e.g. "atc_issue:192.168.1.1"
 * @param {number} limit     max requests per window
 * @param {number} windowMs  window size in milliseconds (default 60_000 = 1 min)
 * @returns {Promise<{allowed: boolean, remaining: number, retry_after_ms: number, source: 'redis'|'memory'|'error'}>}
 */
export async function checkRateLimit(key, limit, windowMs = 60_000) {
  if (!key || typeof key !== 'string') {
    throw new TypeError('checkRateLimit: key must be a non-empty string');
  }
  if (typeof limit !== 'number' || limit <= 0) {
    throw new TypeError('checkRateLimit: limit must be a positive number');
  }

  let redis;
  try {
    redis = await getRedis();
  } catch (err) {
    // Upstash not configured → memory fallback.
    return memCheck(key, limit, windowMs);
  }

  try {
    const now = Date.now();
    const bucket = Math.floor(now / windowMs);
    const redisKey = `${PREFIX}${key}:${bucket}`;
    const ttlSec = Math.ceil(windowMs / 1000) + 1; // +1s grace

    // Pipeline INCR + EXPIRE so we only do one round-trip.
    // Returns [count, expireResult]; we only need the count.
    const pipeline = redis.pipeline();
    pipeline.incr(redisKey);
    pipeline.expire(redisKey, ttlSec);
    const results = await pipeline.exec();

    const count = Number(Array.isArray(results) ? results[0] : results);
    const allowed = count <= limit;
    const retryAfterMs = allowed ? 0 : bucket * windowMs + windowMs - now;

    if (DEBUG) {
      console.warn(
        `[rate-limit-redis:redis] key=${key} bucket=${bucket} count=${count}/${limit} allowed=${allowed}`
      );
    }

    return {
      allowed,
      remaining: Math.max(0, limit - count),
      retry_after_ms: retryAfterMs,
      source: 'redis',
    };
  } catch (err) {
    // Network / auth error — fall back to memory so the API keeps serving.
    if (DEBUG) console.warn('[rate-limit-redis] redis failed, using memory:', err.message);
    const mem = memCheck(key, limit, windowMs);
    return { ...mem, source: 'error' };
  }
}

/**
 * Get the underlying Redis client (for testing or non-rate-limit use cases).
 * Throws if Upstash is not configured.
 */
export async function getClient() {
  return await getRedis();
}

/**
 * Returns true if Upstash Redis is configured.
 */
export function isConfigured() {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

/**
 * Lightweight health-check. Returns { ok, source, error? }.
 * Never throws.
 */
export async function ping() {
  if (!isConfigured()) {
    return { ok: true, source: 'memory', configured: false };
  }
  try {
    const redis = await getRedis();
    // PING costs 1 of the 10k daily free requests — acceptable for /api/health.
    const pong = await redis.ping();
    return { ok: pong === true || pong === 'PONG', source: 'redis', configured: true };
  } catch (err) {
    return { ok: false, source: 'redis', configured: true, error: err.message };
  }
}

/**
 * Reset the in-memory fallback map. Exposed for tests.
 */
export function _resetMemory() {
  _memMap.clear();
}

export default {
  checkRateLimit,
  getClient,
  isConfigured,
  ping,
};
