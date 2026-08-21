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
import { type Ed25519KeyPair } from '../core/crypto.js';
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
export declare class KeyRotationManager {
    private state;
    private onRotate?;
    private onExpire?;
    constructor(opts: {
        initialKeyPair: Ed25519KeyPair;
        rotation_interval_days?: number;
        overlap_days?: number;
        onRotate?: (oldKey: Ed25519KeyPair, newKey: Ed25519KeyPair) => void;
        onExpire?: (expiredKey: Ed25519KeyPair) => void;
    });
    /**
     * Get the current key pair (for signing new credentials).
     */
    getCurrentKey(): Ed25519KeyPair;
    /**
     * Get all valid key pairs (current + legacy during overlap).
     * Used for verification — try each key until one matches.
     */
    getValidKeys(): Ed25519KeyPair[];
    /**
     * Check if a rotation is due.
     */
    isRotationDue(now?: Date): boolean;
    /**
     * Perform a key rotation.
     * - Moves current key to legacy (with overlap expiry)
     * - Generates new current key
     * - Calls onRotate callback if set
     */
    rotate(now?: Date): RotationResult;
    /**
     * Expire legacy keys whose overlap period has ended.
     * Calls onExpire callback for each expired key.
     */
    expireLegacyKeys(now?: Date): number;
    /**
     * Manually revoke a legacy key (e.g., if compromised).
     */
    revokeLegacyKey(keyId: string): boolean;
    /**
     * Get the current rotation state (for monitoring / dashboard).
     */
    getState(): KeyRotationState;
    /**
     * Get the days until next rotation.
     */
    daysUntilRotation(now?: Date): number;
    /**
     * Start an automated rotation timer.
     * Checks every hour if rotation is due.
     */
    startAutoRotation(): NodeJS.Timeout;
}
export declare function verifyWithRotation(payload: unknown, signatureHex: string, domain: string, rotationManager: KeyRotationManager, verifyFn: (payload: unknown, sig: string, publicKeyPem: string, domain: string) => boolean): {
    valid: boolean;
    key_id?: string;
    used_legacy?: boolean;
};
