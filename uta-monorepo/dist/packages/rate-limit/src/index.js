"use strict";
/**
 * @marketnow/trust-rate-limit
 * P7-5: Distributed rate limiting with Redis (token bucket algorithm).
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisRateLimiter = exports.InMemoryRateLimiter = void 0;
exports.rateLimitHeaders = rateLimitHeaders;
// ============================================================================
// In-memory rate limiter
// ============================================================================
class InMemoryRateLimiter {
    buckets = new Map();
    config;
    constructor(config) {
        this.config = config;
    }
    check(key) {
        const now = Date.now();
        const maxTokens = this.config.maxTokens;
        const refillRate = this.config.refillRatePerSecond;
        let bucket = this.buckets.get(key);
        if (!bucket) {
            bucket = { tokens: maxTokens, lastRefill: now };
            this.buckets.set(key, bucket);
        }
        const elapsedSec = (now - bucket.lastRefill) / 1000;
        const refilled = elapsedSec * refillRate;
        bucket.tokens = Math.min(maxTokens, bucket.tokens + refilled);
        bucket.lastRefill = now;
        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfterSeconds: 0, limit: maxTokens };
        }
        const retryAfter = Math.ceil((1 - bucket.tokens) / refillRate);
        return { allowed: false, remaining: 0, retryAfterSeconds: retryAfter, limit: maxTokens };
    }
    cleanup() {
        const now = Date.now();
        let deleted = 0;
        const maxTokens = this.config.maxTokens;
        const refillRate = this.config.refillRatePerSecond;
        for (const [key, bucket] of this.buckets) {
            const elapsedSec = (now - bucket.lastRefill) / 1000;
            if (bucket.tokens + elapsedSec * refillRate >= maxTokens) {
                this.buckets.delete(key);
                deleted++;
            }
        }
        return deleted;
    }
}
exports.InMemoryRateLimiter = InMemoryRateLimiter;
// ============================================================================
// Redis-backed rate limiter
// ============================================================================
const TOKEN_BUCKET_LUA = `
local key = KEYS[1]
local max_tokens = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if tokens == nil then
  tokens = max_tokens
  last_refill = now
end

local elapsed_sec = (now - last_refill) / 1000.0
local refilled = elapsed_sec * refill_rate
tokens = math.min(max_tokens, tokens + refilled)

local allowed = false
local retry_after = 0

if tokens >= 1 then
  tokens = tokens - 1
  allowed = true
else
  retry_after = math.ceil((1 - tokens) / refill_rate)
end

redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
redis.call('EXPIRE', key, ttl)

return {allowed and 1 or 0, math.floor(tokens), retry_after, max_tokens}
`;
class RedisRateLimiter {
    client;
    config;
    constructor(client, config) {
        this.client = client;
        this.config = config;
    }
    async check(key) {
        const redisKey = `${this.config.keyPrefix || 'rate_limit:'}${key}`;
        const now = Date.now();
        const ttl = Math.ceil(this.config.maxTokens / this.config.refillRatePerSecond) + 60;
        const result = await this.client.eval(TOKEN_BUCKET_LUA, [redisKey], [String(this.config.maxTokens), String(this.config.refillRatePerSecond), String(now), String(ttl)]);
        return {
            allowed: result[0] === 1,
            remaining: result[1],
            retryAfterSeconds: result[2],
            limit: this.config.maxTokens,
        };
    }
}
exports.RedisRateLimiter = RedisRateLimiter;
function rateLimitHeaders(result) {
    const headers = {
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
    };
    if (!result.allowed) {
        headers['Retry-After'] = String(result.retryAfterSeconds);
    }
    return headers;
}
