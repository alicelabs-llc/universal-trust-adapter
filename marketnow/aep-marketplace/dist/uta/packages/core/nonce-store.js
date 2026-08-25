"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PoPManager = exports.RedisNonceStore = exports.MemoryNonceStore = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
// ============================================================================
// In-Memory NonceStore (for development / testing)
// ============================================================================
class MemoryNonceStore {
    entries = new Map();
    async store(challenge) {
        if (this.entries.has(challenge.nonce)) {
            throw new Error(`Nonce already exists (replay attempt?): ${challenge.nonce.slice(0, 16)}...`);
        }
        this.entries.set(challenge.nonce, { ...challenge, consumed: false });
    }
    async retrieve(nonce) {
        const entry = this.entries.get(nonce);
        if (!entry)
            return null;
        // Check expiry
        if (new Date(entry.expires_at) < new Date()) {
            this.entries.delete(nonce);
            return null;
        }
        return { ...entry };
    }
    async consume(nonce) {
        const entry = this.entries.get(nonce);
        if (!entry)
            return null;
        // Check if already consumed (replay attack)
        if (entry.consumed) {
            throw new Error(`Nonce already consumed (replay attack detected): ${nonce.slice(0, 16)}...`);
        }
        // Check expiry
        if (new Date(entry.expires_at) < new Date()) {
            this.entries.delete(nonce);
            throw new Error(`Nonce expired at ${entry.expires_at}`);
        }
        // Mark as consumed
        entry.consumed = true;
        entry.consumed_at = new Date().toISOString();
        // Keep in store for audit (but mark consumed) — delete after cleanup
        return { ...entry };
    }
    async cleanup() {
        const now = Date.now();
        let deleted = 0;
        for (const [nonce, entry] of this.entries) {
            const isExpired = new Date(entry.expires_at).getTime() < now;
            const isConsumedAndOld = entry.consumed && entry.consumed_at &&
                (now - new Date(entry.consumed_at).getTime() > 60 * 60 * 1000); // 1 hour after consumption
            if (isExpired || isConsumedAndOld) {
                this.entries.delete(nonce);
                deleted++;
            }
        }
        return deleted;
    }
}
exports.MemoryNonceStore = MemoryNonceStore;
// ============================================================================
// Redis NonceStore (for production — uses Upstash REST API)
// ============================================================================
class RedisNonceStore {
    redisUrl;
    redisToken;
    keyPrefix;
    constructor(opts) {
        this.redisUrl = opts.url;
        this.redisToken = opts.token;
        this.keyPrefix = opts.keyPrefix || 'uta:nonce:';
    }
    async redis(command, opts = {}) {
        const path = opts.ttl
            ? `/set/${this.keyPrefix}${command[1]}/${JSON.stringify(command[2])}?EX=${opts.ttl}`
            : `/get/${this.keyPrefix}${command[1]}`;
        const url = `${this.redisUrl}${path}`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${this.redisToken}` },
        });
        if (!res.ok)
            throw new Error(`Redis error: ${res.status} ${await res.text()}`);
        const data = await res.json();
        return data.result;
    }
    async store(challenge) {
        const key = challenge.nonce;
        const value = JSON.stringify(challenge);
        const ttlSeconds = Math.ceil((new Date(challenge.expires_at).getTime() - Date.now()) / 1000) + 60; // +60s grace
        // Use NX (set if not exists) to prevent nonce reuse
        const res = await fetch(`${this.redisUrl}/set/${this.keyPrefix}${key}/${encodeURIComponent(value)}?NX=true&EX=${ttlSeconds}`, {
            headers: { Authorization: `Bearer ${this.redisToken}` },
        });
        const data = await res.json();
        if (data.result === null) {
            throw new Error(`Nonce already exists (replay attempt?): ${key.slice(0, 16)}...`);
        }
    }
    async retrieve(nonce) {
        const res = await fetch(`${this.redisUrl}/get/${this.keyPrefix}${nonce}`, {
            headers: { Authorization: `Bearer ${this.redisToken}` },
        });
        const data = await res.json();
        if (!data.result)
            return null;
        return JSON.parse(data.result);
    }
    async consume(nonce) {
        const entry = await this.retrieve(nonce);
        if (!entry)
            return null;
        if (entry.consumed) {
            throw new Error(`Nonce already consumed (replay attack detected): ${nonce.slice(0, 16)}...`);
        }
        if (new Date(entry.expires_at) < new Date()) {
            // Delete expired nonce
            await fetch(`${this.redisUrl}/del/${this.keyPrefix}${nonce}`, {
                headers: { Authorization: `Bearer ${this.redisToken}` },
            });
            throw new Error(`Nonce expired at ${entry.expires_at}`);
        }
        // Mark as consumed (atomic: get + set with same TTL)
        entry.consumed = true;
        entry.consumed_at = new Date().toISOString();
        const ttlSeconds = Math.ceil((new Date(entry.expires_at).getTime() - Date.now()) / 1000) + 3600; // Keep 1h after expiry for audit
        await fetch(`${this.redisUrl}/set/${this.keyPrefix}${nonce}/${encodeURIComponent(JSON.stringify(entry))}?EX=${ttlSeconds}`, {
            headers: { Authorization: `Bearer ${this.redisToken}` },
        });
        return entry;
    }
    async cleanup() {
        // Redis auto-expires keys via TTL — no manual cleanup needed
        return 0;
    }
}
exports.RedisNonceStore = RedisNonceStore;
// ============================================================================
// PoP Manager — orchestrates challenge issuance + verification with store
// ============================================================================
class PoPManager {
    store;
    challengeTtlMs;
    constructor(store, opts = {}) {
        this.store = store;
        this.challengeTtlMs = opts.challengeTtlMs || 5 * 60 * 1000; // 5 minutes
    }
    /**
     * Issue a PoP challenge and store it.
     * The agent must sign this nonce to prove possession of its private key.
     */
    async issueChallenge(credentialId, audience) {
        const nonce = node_crypto_1.default.randomBytes(32).toString('hex');
        const now = new Date();
        const expires = new Date(now.getTime() + this.challengeTtlMs);
        const challenge = {
            nonce,
            credential_id: credentialId,
            audience,
            issued_at: now.toISOString(),
            expires_at: expires.toISOString(),
            consumed: false,
        };
        await this.store.store(challenge);
        return challenge;
    }
    /**
     * Verify a PoP response against the stored challenge.
     * The nonce is consumed after verification (one-time use).
     *
     * @returns true if PoP is valid
     * @throws Error if nonce not found, already consumed, expired, or signature invalid
     */
    async verifyAndConsume(popResponse, publicKeyPem, expectedAudience) {
        // 1. Retrieve the stored challenge (not reconstructed — the REAL one)
        const challenge = await this.store.retrieve(popResponse.nonce);
        if (!challenge) {
            throw new Error(`PoP nonce not found (unknown or expired): ${popResponse.nonce.slice(0, 16)}...`);
        }
        // 2. Verify credential_id matches
        if (challenge.credential_id !== popResponse.credential_id) {
            throw new Error(`PoP credential_id mismatch: challenge has ${challenge.credential_id}, response has ${popResponse.credential_id}`);
        }
        // 3. Verify audience matches
        if (challenge.audience !== popResponse.audience) {
            throw new Error(`PoP audience mismatch: challenge has ${challenge.audience}, response has ${popResponse.audience}`);
        }
        // 4. Verify audience is the expected one
        if (challenge.audience !== expectedAudience) {
            throw new Error(`PoP audience mismatch: expected ${expectedAudience}, got ${challenge.audience}`);
        }
        // 5. Verify timestamp matches challenge issued_at
        if (challenge.issued_at !== popResponse.timestamp) {
            throw new Error(`PoP timestamp mismatch: challenge has ${challenge.issued_at}, response has ${popResponse.timestamp}`);
        }
        // 6. Verify Ed25519 signature with domain separation
        const { verifyPoP } = await import('./crypto.js');
        const valid = verifyPoP(popResponse, publicKeyPem, {
            nonce: challenge.nonce,
            credential_id: challenge.credential_id,
            audience: challenge.audience,
            issued_at: challenge.issued_at,
            expires_at: challenge.expires_at,
        });
        if (!valid) {
            throw new Error('PoP Ed25519 signature verification failed');
        }
        // 7. Consume the nonce (prevents replay)
        await this.store.consume(popResponse.nonce);
        return true;
    }
}
exports.PoPManager = PoPManager;
