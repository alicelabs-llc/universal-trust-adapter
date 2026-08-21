/**
 * @marketnow/trust-rate-limit
 * P7-5: Distributed rate limiting with Redis (token bucket algorithm).
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
export interface RateLimitConfig {
    maxTokens: number;
    refillRatePerSecond: number;
    keyPrefix?: string;
    windowMs?: number;
}
export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
    limit: number;
}
export declare class InMemoryRateLimiter {
    private buckets;
    private config;
    constructor(config: RateLimitConfig);
    check(key: string): RateLimitResult;
    cleanup(): number;
}
export interface RedisClientLike {
    eval(script: string, keys: string[], args: string[]): Promise<number[]>;
}
export declare class RedisRateLimiter {
    private client;
    private config;
    constructor(client: RedisClientLike, config: RateLimitConfig);
    check(key: string): Promise<RateLimitResult>;
}
export declare function rateLimitHeaders(result: RateLimitResult): Record<string, string>;
