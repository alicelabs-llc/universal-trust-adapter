/**
 * @marketnow/trust-core
 * P1-4: Key Binding — Real cryptographic key verification
 *
 * Verifies that the key_id in the credential's signature block
 * matches a known CA key in the Trust Registry.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
export interface TrustedKey {
    key_id: string;
    public_key_pem: string;
    algorithm: 'Ed25519' | 'ES256' | 'RS256';
    issuer: string;
    status: 'active' | 'revoked' | 'expired';
    revoked_at?: string;
    expires_at?: string;
}
export declare class TrustRegistry {
    private keys;
    /**
     * Register a trusted CA key.
     */
    registerKey(key: TrustedKey): void;
    /**
     * Look up a trusted key by its key_id.
     */
    getKey(keyId: string): TrustedKey | null;
    /**
     * Check if a key_id is trusted and active.
     */
    isTrusted(keyId: string): boolean;
    /**
     * Verify that a credential's signature key_id matches a trusted CA key
     * AND that the credential's subject public key matches the PoP verification key.
     *
     * This establishes the full chain:
     *   Issuer (CA) → signs credential → contains subject.public_key → PoP verifies
     */
    verifyKeyBinding(signatureKeyId: string, subjectPublicKey: string, popPublicKey: string | undefined): {
        valid: boolean;
        reason?: string;
    };
    /**
     * Compute a deterministic key_id from a public key.
     * key_id = SHA-256(raw_public_key_bytes).hex().slice(0, 16)
     */
    static computeKeyId(publicKeyPem: string): string;
    /**
     * List all trusted keys.
     */
    listTrustedKeys(): TrustedKey[];
    /**
     * Revoke a trusted key (e.g., after compromise).
     */
    revokeKey(keyId: string, reason: string): void;
}
