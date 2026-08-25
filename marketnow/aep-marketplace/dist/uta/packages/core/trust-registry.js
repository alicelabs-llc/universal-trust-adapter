"use strict";
/**
 * @marketnow/trust-core
 * P1-4: Key Binding — Real cryptographic key verification
 *
 * Verifies that the key_id in the credential's signature block
 * matches a known CA key in the Trust Registry.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrustRegistry = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
class TrustRegistry {
    keys = new Map();
    /**
     * Register a trusted CA key.
     */
    registerKey(key) {
        this.keys.set(key.key_id, key);
    }
    /**
     * Look up a trusted key by its key_id.
     */
    getKey(keyId) {
        return this.keys.get(keyId) || null;
    }
    /**
     * Check if a key_id is trusted and active.
     */
    isTrusted(keyId) {
        const key = this.keys.get(keyId);
        if (!key)
            return false;
        if (key.status !== 'active')
            return false;
        if (key.expires_at && new Date(key.expires_at) < new Date())
            return false;
        return true;
    }
    /**
     * Verify that a credential's signature key_id matches a trusted CA key
     * AND that the credential's subject public key matches the PoP verification key.
     *
     * This establishes the full chain:
     *   Issuer (CA) → signs credential → contains subject.public_key → PoP verifies
     */
    verifyKeyBinding(signatureKeyId, subjectPublicKey, popPublicKey) {
        // 1. Check that signatureKeyId is in the trust registry
        const trustedKey = this.keys.get(signatureKeyId);
        if (!trustedKey) {
            return { valid: false, reason: `key_id '${signatureKeyId}' not in trust registry (untrusted issuer)` };
        }
        // 2. Check that the key is active
        if (trustedKey.status !== 'active') {
            return { valid: false, reason: `key_id '${signatureKeyId}' is ${trustedKey.status} (revoked at ${trustedKey.revoked_at || 'unknown'})` };
        }
        // 3. Check expiry
        if (trustedKey.expires_at && new Date(trustedKey.expires_at) < new Date()) {
            return { valid: false, reason: `key_id '${signatureKeyId}' expired at ${trustedKey.expires_at}` };
        }
        // 4. If PoP is being used, verify that the subject's public key
        //    matches the key used for PoP verification
        if (popPublicKey && subjectPublicKey) {
            if (popPublicKey !== subjectPublicKey) {
                return { valid: false, reason: `PoP key mismatch: credential subject has '${subjectPublicKey.slice(0, 20)}...' but PoP was verified with '${popPublicKey.slice(0, 20)}...'` };
            }
        }
        return { valid: true };
    }
    /**
     * Compute a deterministic key_id from a public key.
     * key_id = SHA-256(raw_public_key_bytes).hex().slice(0, 16)
     */
    static computeKeyId(publicKeyPem) {
        const publicKey = node_crypto_1.default.createPublicKey(publicKeyPem);
        const der = publicKey.export({ type: 'spki', format: 'der' });
        return node_crypto_1.default.createHash('sha256').update(der).digest('hex').slice(0, 16);
    }
    /**
     * List all trusted keys.
     */
    listTrustedKeys() {
        return Array.from(this.keys.values()).filter(k => k.status === 'active');
    }
    /**
     * Revoke a trusted key (e.g., after compromise).
     */
    revokeKey(keyId, reason) {
        const key = this.keys.get(keyId);
        if (key) {
            key.status = 'revoked';
            key.revoked_at = new Date().toISOString();
        }
    }
}
exports.TrustRegistry = TrustRegistry;
