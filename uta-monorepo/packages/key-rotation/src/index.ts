/**
 * @marketnow/trust-key-rotation
 * P9-4: Automated CA key rotation with overlap period.
 *
 * Rotates the CA key pair on a schedule (e.g., every 90 days) while
 * maintaining an overlap period during which both old and new keys are
 * accepted for verification. This ensures:
 *   1. Credentials signed with the old key remain verifiable during the
 *      overlap period (no service disruption).
 *   2. New credentials are signed with the new key.
 *   3. After the overlap period expires, the old key is automatically
 *      revoked and old credentials must be re-issued.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */

import crypto from 'node:crypto';
import { generateEd25519KeyPair, type Ed25519KeyPair, DOMAINS } from '../core/crypto.js';

// ============================================================================
// Types
// ============================================================================

export interface KeyRotationState {
  /** Current active key (signs new credentials) */
  current: Ed25519KeyPair;
  /** Previous key(s) still accepted for verification (during overlap) */
  legacy: Array<{
    key_pair: Ed25519KeyPair;
    rotated_at: string;
    expires_at: string;
    revoked: boolean;
  }>;
  /** When the next rotation is scheduled */
  next_rotation: string;
  /** Rotation interval in days */
  rotation_interval_days: number;
  /** Overlap period in days (both old and new keys accepted) */
  overlap_days: number;
  /** Total rotations performed */
  rotation_count: number;
}

export interface RotationResult {
  rotated: boolean;
  old_key_id: string;
  new_key_id: string;
  next_rotation: string;
  legacy_keys_active: number;
}

// ============================================================================
// Key Rotation Manager
// ============================================================================

export class KeyRotationManager {
  private state: KeyRotationState;
  private onRotate?: (oldKey: Ed25519KeyPair, newKey: Ed25519KeyPair) => void;
  private onExpire?: (expiredKey: Ed25519KeyPair) => void;

  constructor(opts: {
    initialKeyPair: Ed25519KeyPair;
    rotation_interval_days?: number;  // default 90
    overlap_days?: number;             // default 30
    onRotate?: (oldKey: Ed25519KeyPair, newKey: Ed25519KeyPair) => void;
    onExpire?: (expiredKey: Ed25519KeyPair) => void;
  }) {
    const intervalDays = opts.rotation_interval_days || 90;
    const overlapDays = opts.overlap_days || 30;
    const now = new Date();
    const nextRotation = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

    this.state = {
      current: opts.initialKeyPair,
      legacy: [],
      next_rotation: nextRotation.toISOString(),
      rotation_interval_days: intervalDays,
      overlap_days: overlapDays,
      rotation_count: 0,
    };
    this.onRotate = opts.onRotate;
    this.onExpire = opts.onExpire;
  }

  /**
   * Get the current key pair (for signing new credentials).
   */
  getCurrentKey(): Ed25519KeyPair {
    return this.state.current;
  }

  /**
   * Get all valid key pairs (current + legacy during overlap).
   * Used for verification — try each key until one matches.
   */
  getValidKeys(): Ed25519KeyPair[] {
    return [
      this.state.current,
      ...this.state.legacy
        .filter(l => !l.revoked && new Date(l.expires_at) > new Date())
        .map(l => l.key_pair),
    ];
  }

  /**
   * Check if a rotation is due.
   */
  isRotationDue(now: Date = new Date()): boolean {
    return now >= new Date(this.state.next_rotation);
  }

  /**
   * Perform a key rotation.
   * - Moves current key to legacy (with overlap expiry)
   * - Generates new current key
   * - Calls onRotate callback if set
   */
  rotate(now: Date = new Date()): RotationResult {
    const oldKeyId = this.state.current.keyId;
    const newKeyPair = generateEd25519KeyPair();

    // Move current to legacy
    const overlapExpiry = new Date(now.getTime() + this.state.overlap_days * 24 * 60 * 60 * 1000);
    this.state.legacy.push({
      key_pair: this.state.current,
      rotated_at: now.toISOString(),
      expires_at: overlapExpiry.toISOString(),
      revoked: false,
    });

    // Set new current
    this.state.current = newKeyPair;
    this.state.rotation_count++;

    // Schedule next rotation
    const nextRotation = new Date(now.getTime() + this.state.rotation_interval_days * 24 * 60 * 60 * 1000);
    this.state.next_rotation = nextRotation.toISOString();

    // Callback
    if (this.onRotate) {
      this.onRotate(this.state.legacy[this.state.legacy.length - 1].key_pair, newKeyPair);
    }

    return {
      rotated: true,
      old_key_id: oldKeyId,
      new_key_id: newKeyPair.keyId,
      next_rotation: this.state.next_rotation,
      legacy_keys_active: this.state.legacy.filter(l => !l.revoked && new Date(l.expires_at) > now).length,
    };
  }

  /**
   * Expire legacy keys whose overlap period has ended.
   * Calls onExpire callback for each expired key.
   */
  expireLegacyKeys(now: Date = new Date()): number {
    let expired = 0;
    for (const legacy of this.state.legacy) {
      if (!legacy.revoked && new Date(legacy.expires_at) <= now) {
        legacy.revoked = true;
        expired++;
        if (this.onExpire) this.onExpire(legacy.key_pair);
      }
    }
    return expired;
  }

  /**
   * Manually revoke a legacy key (e.g., if compromised).
   */
  revokeLegacyKey(keyId: string): boolean {
    for (const legacy of this.state.legacy) {
      if (legacy.key_pair.keyId === keyId && !legacy.revoked) {
        legacy.revoked = true;
        if (this.onExpire) this.onExpire(legacy.key_pair);
        return true;
      }
    }
    return false;
  }

  /**
   * Get the current rotation state (for monitoring / dashboard).
   */
  getState(): KeyRotationState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Get the days until next rotation.
   */
  daysUntilRotation(now: Date = new Date()): number {
    const diff = new Date(this.state.next_rotation).getTime() - now.getTime();
    return Math.ceil(diff / (24 * 60 * 60 * 1000));
  }

  /**
   * Start an automated rotation timer.
   * Checks every hour if rotation is due.
   */
  startAutoRotation(): NodeJS.Timeout {
    return setInterval(() => {
      const now = new Date();
      if (this.isRotationDue(now)) {
        console.log(`[${now.toISOString()}] Auto-rotating CA key...`);
        this.rotate(now);
      }
      const expired = this.expireLegacyKeys(now);
      if (expired > 0) {
        console.log(`[${now.toISOString()}] Expired ${expired} legacy key(s)`);
      }
    }, 60 * 60 * 1000);  // every hour
  }
}

// ============================================================================
// Convenience: verify with key rotation support
// ============================================================================

export function verifyWithRotation(
  payload: unknown,
  signatureHex: string,
  domain: string,
  rotationManager: KeyRotationManager,
  verifyFn: (payload: unknown, sig: string, publicKeyPem: string, domain: string) => boolean,
): { valid: boolean; key_id?: string; used_legacy?: boolean } {
  const validKeys = rotationManager.getValidKeys();

  for (const key of validKeys) {
    if (verifyFn(payload, signatureHex, key.publicKeyPem, domain)) {
      return {
        valid: true,
        key_id: key.keyId,
        used_legacy: key.keyId !== rotationManager.getCurrentKey().keyId,
      };
    }
  }

  return { valid: false };
}
