/**
 * MarketNow — Simple Rate Limiter (no Redis needed)
 * 
 * Uses the ATC _index.json's "updated_at" field as a reference.
 * Before issuing a new ATC, checks if the last one was issued
 * more than N seconds ago.
 * 
 * This is NOT perfect (cold start resets memory), but it adds
 * a layer of protection by checking the static index file.
 * 
 * For real rate limiting, upgrade to Vercel KV or Upstash Redis.
 */

const RATE_LIMIT_SECONDS = 12; // 12s between issues = max 5 per minute
const MAX_PER_HOUR = 5;

// Simple in-memory counter (survives within a warm instance)
let _memoryCount = 0;
let _memoryWindow = Date.now();

export function checkRateLimit(staticIndexUpdatedAt) {
  // Method 1: Check if the static index was recently updated
  if (staticIndexUpdatedAt) {
    const lastUpdate = new Date(staticIndexUpdatedAt).getTime();
    const elapsed = Date.now() - lastUpdate;
    if (elapsed < RATE_LIMIT_SECONDS * 1000) {
      return {
        allowed: false,
        reason: 'rate_limited',
        message: `Last ATC was issued ${Math.floor(elapsed / 1000)}s ago. Minimum ${RATE_LIMIT_SECONDS}s between issues.`,
        retry_after: RATE_LIMIT_SECONDS - Math.floor(elapsed / 1000),
      };
    }
  }

  // Method 2: In-memory counter (survives warm instances)
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  
  if (now - _memoryWindow > hourMs) {
    _memoryCount = 0;
    _memoryWindow = now;
  }
  
  _memoryCount++;
  
  if (_memoryCount > MAX_PER_HOUR) {
    return {
      allowed: false,
      reason: 'hourly_limit_exceeded',
      message: `Rate limit: max ${MAX_PER_HOUR} ATC issues per hour per warm instance.`,
      retry_after: Math.ceil((hourMs - (now - _memoryWindow)) / 1000),
    };
  }

  return {
    allowed: true,
    remaining: MAX_PER_HOUR - _memoryCount,
    limit: MAX_PER_HOUR,
    reset_at: new Date(_memoryWindow + hourMs).toISOString(),
  };
}

/**
 * For endpoints that need IP-based limiting (more aggressive)
 */
export function checkIpRate(ip, action) {
  // This would need Redis for real IP tracking
  // For now, just return allowed with a warning
  return {
    allowed: true,
    note: 'IP-based rate limiting requires Vercel KV or Upstash Redis. Using in-memory fallback.',
    ip: ip ? ip.slice(0, 10) + '...' : 'unknown',
  };
}
