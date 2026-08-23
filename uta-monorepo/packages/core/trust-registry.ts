/**
 * @marketnow/trust-core
 * P1-4: Key Binding — Real cryptographic key verification
 *
 * Verifies that the key_id in the credential's signature block
 * matches a known CA key in the Trust Registry.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */

import crypto from 'node:crypto';
import { canonicalHash } from './crypto.js';

// ============================================================================
// Trust Registry — maps key_ids to public keys
// ============================================================================

export interface TrustedKey {
  key_id: string;
  public_key_pem: string;
  algorithm: 'Ed25519' | 'ES256' | 'RS256';
  issuer: string;
  status: 'active' | 'revoked' | 'expired';
  revoked_at?: string;
  expires_at?: string;
}

export class TrustRegistry {
  private keys = new Map<string, TrustedKey>();

  /**
   * Register a trusted CA key.
   */
  registerKey(key: TrustedKey): void {
    this.keys.set(key.key_id, key);
  }

  /**
   * Look up a trusted key by its key_id.
   */
  getKey(keyId: string): TrustedKey | null {
    return this.keys.get(keyId) || null;
  }

  /**
   * Check if a key_id is trusted and active.
   */
  isTrusted(keyId: string): boolean {
    const key = this.keys.get(keyId);
    if (!key) return false;
    if (key.status !== 'active') return false;
    if (key.expires_at && new Date(key.expires_at) < new Date()) return false;
    return true;
  }

  /**
   * Verify that a credential's signature key_id matches a trusted CA key
   * AND that the credential's subject public key matches the PoP verification key.
   *
   * This establishes the full chain:
   *   Issuer (CA) → signs credential → contains subject.public_key → PoP verifies
   */
  verifyKeyBinding(
    signatureKeyId: string,
    subjectPublicKey: string,
    popPublicKey: string | undefined
  ): { valid: boolean; reason?: string } {
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
  static computeKeyId(publicKeyPem: string): string {
    const publicKey = crypto.createPublicKey(publicKeyPem);
    const der = publicKey.export({ type: 'spki', format: 'der' });
    return crypto.createHash('sha256').update(der).digest('hex').slice(0, 16);
  }

  /**
   * List all trusted keys.
   */
  listTrustedKeys(): TrustedKey[] {
    return Array.from(this.keys.values()).filter(k => k.status === 'active');
  }

  /**
   * Revoke a trusted key (e.g., after compromise).
   */
  revokeKey(keyId: string, reason: string): void {
    const key = this.keys.get(keyId);
    if (key) {
      key.status = 'revoked';
      key.revoked_at = new Date().toISOString();
    }
  }
}

// ============================================================================
// External Reputation Hook — @topstar_ai asked about this
// ============================================================================

export interface ExternalReputationSource {
  name: string;
  fetchScore(subject_id: string): Promise<{ score: number; confidence: 'low' | 'medium' | 'high'; source: string }>;
}

declare module './trust-registry.js' {
  interface TrustRegistry {
    externalSources: ExternalReputationSource[];
    addExternalSource(source: ExternalReputationSource): void;
    getExternalScore(subject_id: string): Promise<{ score: number; confidence: string; source: string } | null>;
  }
}

// Extend the TrustRegistry class prototype
TrustRegistry.prototype.externalSources = [];
TrustRegistry.prototype.addExternalSource = function(source: ExternalReputationSource) {
  this.externalSources.push(source);
};
TrustRegistry.prototype.getExternalScore = async function(subject_id: string) {
  for (const source of this.externalSources) {
    try {
      const result = await source.fetchScore(subject_id);
      if (result) return result;
    } catch { /* skip failed source */ }
  }
  return null;
};
