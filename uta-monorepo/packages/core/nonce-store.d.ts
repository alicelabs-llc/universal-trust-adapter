/**
 * @marketnow/trust-core
 * P1-1: NonceStore — PoP challenge persistence + anti-replay
 *
 * Stores issued nonces and prevents replay attacks.
 * Production: uses Upstash Redis (distributed).
 * Development: uses in-memory Map (per-process).
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
export interface StoredChallenge {
    nonce: string;
    credential_id: string;
    audience: string;
    issued_at: string;
    expires_at: string;
    consumed: boolean;
    consumed_at?: string;
}
export interface NonceStore {
    store(challenge: StoredChallenge): Promise<void>;
    retrieve(nonce: string): Promise<StoredChallenge | null>;
    consume(nonce: string): Promise<StoredChallenge | null>;
    cleanup(): Promise<number>;
}
export declare class MemoryNonceStore implements NonceStore {
    private entries;
    store(challenge: StoredChallenge): Promise<void>;
    retrieve(nonce: string): Promise<StoredChallenge | null>;
    consume(nonce: string): Promise<StoredChallenge | null>;
    cleanup(): Promise<number>;
}
export declare class RedisNonceStore implements NonceStore {
    private redisUrl;
    private redisToken;
    private keyPrefix;
    constructor(opts: {
        url: string;
        token: string;
        keyPrefix?: string;
    });
    private redis;
    store(challenge: StoredChallenge): Promise<void>;
    retrieve(nonce: string): Promise<StoredChallenge | null>;
    consume(nonce: string): Promise<StoredChallenge | null>;
    cleanup(): Promise<number>;
}
export declare class PoPManager {
    private store;
    private challengeTtlMs;
    constructor(store: NonceStore, opts?: {
        challengeTtlMs?: number;
    });
    /**
     * Issue a PoP challenge and store it.
     * The agent must sign this nonce to prove possession of its private key.
     */
    issueChallenge(credentialId: string, audience: string): Promise<StoredChallenge>;
    /**
     * Verify a PoP response against the stored challenge.
     * The nonce is consumed after verification (one-time use).
     *
     * @returns true if PoP is valid
     * @throws Error if nonce not found, already consumed, expired, or signature invalid
     */
    verifyAndConsume(popResponse: {
        nonce: string;
        credential_id: string;
        audience: string;
        timestamp: string;
        signature: string;
    }, publicKeyPem: string, expectedAudience: string): Promise<boolean>;
}
