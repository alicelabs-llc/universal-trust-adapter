// ============================================================================
// MarketNow — Upstash Redis Client (distributed rate limiting)
// ============================================================================
// Replaces in-memory rate limiting (which was bypassable because each
// Vercel Lambda had its own state).
//
// Setup:
//   1. Create a database at https://upstash.com (free, 10k req/day)
//   2. Get the REST URL + token
//   3. Set Vercel env vars:
//        UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
//        UPSTASH_REDIS_REST_TOKEN=AY...
// ============================================================================

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// ============================================================================
// Rate limiter — distributed (works across all Lambda instances)
// ============================================================================

/**
 * Check rate limit using sliding window with Redis.
 *
 * @param {string} key - Identifier (e.g., IP address, mandate_id)
 * @param {number} limit - Max requests per window
 * @param {number} windowMs - Window size in milliseconds
 * @returns {Promise<{allowed: boolean, remaining: number, limit: number, resetAt: Date}>}
 */
export async function checkRateLimit(key, limit, windowMs) {
  const now = Date.now();
  const windowKey = `ratelimit:${key}:${Math.floor(now / windowMs)}`;

  // Atomic INCR + EXPIRE
  const count = await redis.incr(windowKey);
  if (count === 1) {
    // First request in this window — set expiration
    await redis.expire(windowKey, Math.ceil(windowMs / 1000));
  }

  const resetAt = new Date(Math.ceil(now / windowMs) * windowMs);

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    limit,
    resetAt,
  };
}

// ============================================================================
// Cache — for expensive operations (skills catalog, ATC cards)
// ============================================================================

export async function cacheGet(key) {
  try {
    return await redis.get(key);
  } catch (e) {
    console.warn('Cache get failed:', e.message);
    return null;
  }
}

export async function cacheSet(key, value, ttlSeconds = 300) {
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (e) {
    console.warn('Cache set failed:', e.message);
  }
}

export async function cacheDelete(key) {
  try {
    await redis.del(key);
  } catch (e) {
    console.warn('Cache delete failed:', e.message);
  }
}

// ============================================================================
// Distributed lock — for atomic operations (mandate spending)
// ============================================================================

/**
 * Acquire a distributed lock using Redis SET NX EX.
 * Prevents race conditions across Lambda instances.
 *
 * @param {string} resource - Resource to lock (e.g., mandate_id)
 * @param {number} ttlMs - Lock TTL in milliseconds
 * @returns {Promise<string|null>} Lock token if acquired, null otherwise
 */
export async function acquireLock(resource, ttlMs = 5000) {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const lockKey = `lock:${resource}`;
  const acquired = await redis.set(lockKey, token, { nx: true, ex: Math.ceil(ttlMs / 1000) });
  return acquired ? token : null;
}

export async function releaseLock(resource, token) {
  // Use Lua script to ensure atomic release (only release if we own the lock)
  const lockKey = `lock:${resource}`;
  const currentValue = await redis.get(lockKey);
  if (currentValue === token) {
    await redis.del(lockKey);
    return true;
  }
  return false;
}

// ============================================================================
// Honeypot tracker — for security monitoring
// ============================================================================

export async function trackHoneypot(ip, path) {
  const key = `honeypot:${ip}`;
  await redis.incr(`${key}:count`);
  await redis.sadd(`${key}:paths`, path);
  await redis.expire(`${key}:count`, 86400);  // 24h
  await redis.expire(`${key}:paths`, 86400);
}

export async function getHoneypotStats(ip) {
  const [count, paths] = await Promise.all([
    redis.get(`honeypot:${ip}:count`),
    redis.smembers(`honeypot:${ip}:paths`),
  ]);
  return { count: count || 0, paths: paths || [] };
}

// ============================================================================
// Rate limit configs
// ============================================================================

export const RATE_LIMITS = {
  // Per IP
  atc_issue: { limit: 5, windowMs: 60 * 60 * 1000 },     // 5 issues per hour per IP
  atc_revoke: { limit: 10, windowMs: 60 * 60 * 1000 },  // 10 revokes per hour per IP
  api_general: { limit: 100, windowMs: 60 * 1000 },     // 100 req/min per IP
  search: { limit: 60, windowMs: 60 * 1000 },            // 60 searches/min per IP
  honeypot_block: { limit: 3, windowMs: 60 * 1000 },     // 3 honeypot hits = block

  // Per mandate
  mandate_spend: { limit: 10, windowMs: 60 * 1000 },    // 10 purchases/min per mandate

  // Global
  global: { limit: 1000, windowMs: 60 * 1000 },          // 1000 req/min global
};

export async function checkRateLimitByType(type, identifier) {
  const config = RATE_LIMITS[type];
  if (!config) throw new Error(`Unknown rate limit type: ${type}`);
  return checkRateLimit(`${type}:${identifier}`, config.limit, config.windowMs);
}
