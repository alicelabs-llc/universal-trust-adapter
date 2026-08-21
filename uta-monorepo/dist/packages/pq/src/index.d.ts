/**
 * @marketnow/trust-pq
 * P6-7: Post-Quantum Cryptography abstraction for UTA.
 *
 * ML-DSA-65 (Module-Lattice-Based Digital Signature Algorithm, FIPS 204)
 * is a NIST-standardized post-quantum signature scheme. It will eventually
 * replace Ed25519/RSA/ECDSA when large-scale quantum computers become
 * practical.
 *
 * This package defines the abstraction layer for PQ signatures in UTA:
 *   - SignatureAlgorithm interface — pluggable backends (Ed25519 today, ML-DSA-65 tomorrow)
 *   - AlgorithmRegistry — maps algorithm names to implementations
 *   - PQMigrationPath — tracks the hybrid (classical + PQ) transition
 *   - HybridSigner — signs with BOTH classical AND PQ keys, verifies BOTH
 *     (defense in depth during the migration window)
 *
 * Why an abstraction? Node.js does not ship native ML-DSA-65 support yet.
 * Production deployments will use `liboqs-js` or a Rust-backed native
 * addon. This module provides:
 *
 *   1. A stable interface that doesn't change when the backend changes.
 *   2. A "hybrid mode" that allows a credential to carry both an Ed25519
 *      AND an ML-DSA-65 signature, so the credential remains verifiable
 *      even if one algorithm is broken.
 *   3. A migration tracker that warns when PQ migration is overdue.
 *
 * Spec: FIPS 204 (final, August 2024). ATC v2 spec already mentions
 * ML-DSA-65 in the algorithm enum.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
import { type Ed25519KeyPair } from '../../core/crypto.js';
export type AlgorithmName = 'Ed25519' | 'ML-DSA-65' | 'ML-DSA-87' | 'SLH-DSA-SHA2-128s';
export interface SignatureAlgorithm {
    name: AlgorithmName;
    /** NIST security level (1, 3, or 5) */
    nistLevel: 1 | 3 | 5;
    /** Is this algorithm post-quantum secure? */
    isPostQuantum: boolean;
    /** Public key size in bytes */
    publicKeyBytes: number;
    /** Signature size in bytes */
    signatureBytes: number;
    /** Private key size in bytes */
    privateKeyBytes: number;
    /** Generate a new key pair */
    generateKeyPair(): {
        publicKeyPem: string;
        privateKeyPem: string;
        publicKeyRaw: string;
    };
    /** Sign a message */
    sign(message: Buffer, privateKeyPem: string): string;
    /** Verify a signature */
    verify(message: Buffer, signatureHex: string, publicKeyPem: string): boolean;
    /** Is this algorithm available in the current runtime? (false if no PQ backend installed) */
    isAvailable(): boolean;
}
export declare class Ed25519Algorithm implements SignatureAlgorithm {
    name: AlgorithmName;
    nistLevel: 1 | 3 | 5;
    isPostQuantum: boolean;
    publicKeyBytes: number;
    signatureBytes: number;
    privateKeyBytes: number;
    generateKeyPair(): {
        publicKeyPem: string;
        privateKeyPem: string;
        publicKeyRaw: string;
    };
    sign(message: Buffer, privateKeyPem: string): string;
    verify(message: Buffer, signatureHex: string, publicKeyPem: string): boolean;
    isAvailable(): boolean;
}
export interface MLDSA65Backend {
    generateKeyPair(): {
        publicKey: Buffer;
        privateKey: Buffer;
    };
    sign(message: Buffer, privateKey: Buffer): Buffer;
    verify(message: Buffer, signature: Buffer, publicKey: Buffer): boolean;
}
/**
 * ML-DSA-65 algorithm — wraps a pluggable backend.
 *
 * To enable real ML-DSA-65 signatures:
 *   1. Install a backend (e.g., `npm install liboqs-js` or build a Rust addon)
 *   2. Implement MLDSA65Backend
 *   3. Pass it to the constructor: `new MLDSA65Algorithm(myBackend)`
 *
 * Without a backend, `isAvailable()` returns false and all operations throw.
 */
export declare class MLDSA65Algorithm implements SignatureAlgorithm {
    name: AlgorithmName;
    nistLevel: 1 | 3 | 5;
    isPostQuantum: boolean;
    publicKeyBytes: number;
    signatureBytes: number;
    privateKeyBytes: number;
    private backend;
    constructor(backend?: MLDSA65Backend);
    setBackend(backend: MLDSA65Backend): void;
    isAvailable(): boolean;
    private requireBackend;
    generateKeyPair(): {
        publicKeyPem: string;
        privateKeyPem: string;
        publicKeyRaw: string;
    };
    sign(message: Buffer, privateKeyPem: string): string;
    verify(message: Buffer, signatureHex: string, publicKeyPem: string): boolean;
}
export interface HybridKeyPair {
    classical: Ed25519KeyPair;
    pq?: {
        algorithm: 'ML-DSA-65';
        publicKeyPem: string;
        privateKeyPem: string;
        publicKeyRaw: string;
        keyId: string;
    };
}
export interface HybridSignature {
    classical: {
        algorithm: 'Ed25519 (RFC 8032)';
        value: string;
        key_id: string;
        domain: string;
    };
    pq?: {
        algorithm: 'ML-DSA-65 (FIPS 204)';
        value: string;
        key_id: string;
        domain: string;
    };
    /** Which algorithms must verify for this signature to be considered valid */
    required: ('classical' | 'pq')[];
    /** Migration policy in effect when this signature was produced */
    migration_policy: PQMigrationPolicy;
}
export type PQMigrationPolicy = 'classical-only' | 'classical-with-pq-optional' | 'hybrid-required' | 'pq-only';
export declare class HybridSigner {
    private classical;
    private pqAlgorithm;
    private pqKeyPair;
    private policy;
    constructor(opts: {
        classical: Ed25519KeyPair;
        pqAlgorithm?: MLDSA65Algorithm;
        pqKeyPair?: HybridKeyPair['pq'];
        policy?: PQMigrationPolicy;
    });
    /**
     * Sign a payload with the configured algorithms, per the migration policy.
     */
    sign(payload: unknown, domain: string): HybridSignature;
    /**
     * Verify a hybrid signature against a payload.
     * Returns true only if ALL required algorithms verify.
     */
    verify(payload: unknown, sig: HybridSignature, classicalPublicKeyPem: string, pqPublicKeyPem?: string): boolean;
}
export declare class AlgorithmRegistry {
    private algorithms;
    private defaultAlgorithm;
    constructor();
    register(algo: SignatureAlgorithm): void;
    get(name: AlgorithmName): SignatureAlgorithm | null;
    getDefault(): SignatureAlgorithm;
    setDefault(name: AlgorithmName): void;
    /**
     * List all registered algorithms with their availability.
     */
    list(): Array<{
        name: AlgorithmName;
        available: boolean;
        postQuantum: boolean;
        nistLevel: number;
    }>;
    /**
     * Check if PQ migration is available (i.e., at least one PQ algorithm is ready).
     */
    isPQReady(): boolean;
}
export interface MigrationStatus {
    current_policy: PQMigrationPolicy;
    recommended_policy: PQMigrationPolicy;
    pq_available: boolean;
    /** Days until the migration window closes (best estimate). Set to null if no deadline. */
    days_until_deadline: number | null;
    warning?: string;
}
/**
 * Assess the current PQ migration status.
 *
 * Recommendations (per AliceLabs migration plan):
 *   - Before 2030: 'classical-with-pq-optional' (start issuing hybrid credentials)
 *   - 2030-2035: 'hybrid-required' (both signatures required)
 *   - After 2035: 'pq-only' (classical deprecated, assuming quantum computers arrive)
 *
 * This is a heuristic — adjust based on your threat model.
 */
export declare function assessMigrationStatus(currentPolicy: PQMigrationPolicy, pqAvailable: boolean, now?: Date): MigrationStatus;
/**
 * A deterministic test backend for ML-DSA-65 that uses SHA-256 + HMAC
 * to simulate PQ signatures. NOT cryptographically secure — for testing
 * the abstraction layer only.
 */
export declare class TestMLDSA65Backend implements MLDSA65Backend {
    generateKeyPair(): {
        publicKey: Buffer;
        privateKey: Buffer;
    };
    sign(message: Buffer, privateKey: Buffer): Buffer;
    verify(message: Buffer, signature: Buffer, publicKey: Buffer): boolean;
}
