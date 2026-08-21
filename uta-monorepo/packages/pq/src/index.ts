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

import crypto from 'node:crypto';
import { canonicalize, sign as ed25519Sign, verify as ed25519Verify, DOMAINS, type Ed25519KeyPair } from '../../core/crypto.js';

// ============================================================================
// SignatureAlgorithm — pluggable backend interface
// ============================================================================

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
  generateKeyPair(): { publicKeyPem: string; privateKeyPem: string; publicKeyRaw: string };
  /** Sign a message */
  sign(message: Buffer, privateKeyPem: string): string;  // returns hex
  /** Verify a signature */
  verify(message: Buffer, signatureHex: string, publicKeyPem: string): boolean;
  /** Is this algorithm available in the current runtime? (false if no PQ backend installed) */
  isAvailable(): boolean;
}

// ============================================================================
// Ed25519 backend (always available — Node.js built-in)
// ============================================================================

export class Ed25519Algorithm implements SignatureAlgorithm {
  name: AlgorithmName = 'Ed25519';
  nistLevel: 1 | 3 | 5 = 1;
  isPostQuantum = false;
  publicKeyBytes = 32;
  signatureBytes = 64;
  privateKeyBytes = 32;

  generateKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const der = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
    const publicKeyRaw = der.subarray(der.length - 32).toString('base64url');
    return { publicKeyPem, privateKeyPem, publicKeyRaw };
  }

  sign(message: Buffer, privateKeyPem: string): string {
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return crypto.sign(null, message, privateKey).toString('hex');
  }

  verify(message: Buffer, signatureHex: string, publicKeyPem: string): boolean {
    try {
      const signature = Buffer.from(signatureHex, 'hex');
      if (signature.length !== 64) return false;
      const publicKey = crypto.createPublicKey(publicKeyPem);
      return crypto.verify(null, message, publicKey, signature);
    } catch { return false; }
  }

  isAvailable(): boolean { return true; }
}

// ============================================================================
// ML-DSA-65 backend — abstract (requires liboqs-js or native addon)
// ============================================================================

export interface MLDSA65Backend {
  generateKeyPair(): { publicKey: Buffer; privateKey: Buffer };
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
export class MLDSA65Algorithm implements SignatureAlgorithm {
  name: AlgorithmName = 'ML-DSA-65';
  nistLevel: 1 | 3 | 5 = 3;
  isPostQuantum = true;
  publicKeyBytes = 1952;  // FIPS 204 §8: pk size = 1952 bytes
  signatureBytes = 3309;  // sig size = 3309 bytes
  privateKeyBytes = 4032; // sk size = 4032 bytes

  private backend: MLDSA65Backend | null;

  constructor(backend?: MLDSA65Backend) {
    this.backend = backend || null;
  }

  setBackend(backend: MLDSA65Backend): void {
    this.backend = backend;
  }

  isAvailable(): boolean {
    return this.backend !== null;
  }

  private requireBackend(): MLDSA65Backend {
    if (!this.backend) {
      throw new Error(
        'ML-DSA-65 backend not installed. Install liboqs-js or another FIPS 204 ' +
        'implementation, then pass it to MLDSA65Algorithm constructor.'
      );
    }
    return this.backend;
  }

  generateKeyPair(): { publicKeyPem: string; privateKeyPem: string; publicKeyRaw: string } {
    const backend = this.requireBackend();
    const { publicKey, privateKey } = backend.generateKeyPair();
    // Wrap raw bytes in PEM-like format for storage
    return {
      publicKeyPem: pemWrap('ML-DSA-65 PUBLIC KEY', publicKey),
      privateKeyPem: pemWrap('ML-DSA-65 PRIVATE KEY', privateKey),
      publicKeyRaw: publicKey.toString('base64url'),
    };
  }

  sign(message: Buffer, privateKeyPem: string): string {
    const backend = this.requireBackend();
    const privateKey = pemUnwrap(privateKeyPem);
    return backend.sign(message, privateKey).toString('hex');
  }

  verify(message: Buffer, signatureHex: string, publicKeyPem: string): boolean {
    try {
      const backend = this.requireBackend();
      const signature = Buffer.from(signatureHex, 'hex');
      const publicKey = pemUnwrap(publicKeyPem);
      return backend.verify(message, signature, publicKey);
    } catch { return false; }
  }
}

// ============================================================================
// Hybrid Signer — defense in depth during PQ migration
// ============================================================================

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

export type PQMigrationPolicy =
  | 'classical-only'           // Ed25519 only (no PQ)
  | 'classical-with-pq-optional' // Ed25519 required, PQ optional (early migration)
  | 'hybrid-required'          // BOTH Ed25519 AND PQ required (migration window)
  | 'pq-only';                 // PQ only (post-migration, classical deprecated)

export class HybridSigner {
  private classical: Ed25519KeyPair;
  private pqAlgorithm: MLDSA65Algorithm | null;
  private pqKeyPair: HybridKeyPair['pq'] | null;
  private policy: PQMigrationPolicy;

  constructor(opts: {
    classical: Ed25519KeyPair;
    pqAlgorithm?: MLDSA65Algorithm;
    pqKeyPair?: HybridKeyPair['pq'];
    policy?: PQMigrationPolicy;
  }) {
    this.classical = opts.classical;
    this.pqAlgorithm = opts.pqAlgorithm || null;
    this.pqKeyPair = opts.pqKeyPair || null;
    this.policy = opts.policy || 'classical-only';

    // Validate policy vs available keys
    if ((this.policy === 'hybrid-required' || this.policy === 'pq-only') && !this.pqKeyPair) {
      throw new Error(`Policy '${this.policy}' requires a PQ key pair, but none was provided`);
    }
    if (this.policy === 'pq-only' && !this.pqAlgorithm?.isAvailable()) {
      throw new Error('Policy "pq-only" requires an available PQ algorithm backend');
    }
  }

  /**
   * Sign a payload with the configured algorithms, per the migration policy.
   */
  sign(payload: unknown, domain: string): HybridSignature {
    const canonical = canonicalize(payload);
    const signingBytes = Buffer.from(domain + ':' + canonical, 'utf-8');

    const sig: HybridSignature = {
      classical: {
        algorithm: 'Ed25519 (RFC 8032)',
        value: ed25519Sign(payload, this.classical.privateKeyPem, domain as any),
        key_id: this.classical.keyId,
        domain,
      },
      required: ['classical'],
      migration_policy: this.policy,
    };

    if (this.policy !== 'classical-only' && this.pqKeyPair && this.pqAlgorithm?.isAvailable()) {
      sig.pq = {
        algorithm: 'ML-DSA-65 (FIPS 204)',
        value: this.pqAlgorithm.sign(signingBytes, this.pqKeyPair.privateKeyPem),
        key_id: this.pqKeyPair.keyId,
        domain,
      };
      if (this.policy === 'hybrid-required') {
        sig.required = ['classical', 'pq'];
      }
    }

    if (this.policy === 'pq-only') {
      sig.required = ['pq'];
      // In pq-only mode, the classical signature is informational only
    }

    return sig;
  }

  /**
   * Verify a hybrid signature against a payload.
   * Returns true only if ALL required algorithms verify.
   */
  verify(payload: unknown, sig: HybridSignature, classicalPublicKeyPem: string, pqPublicKeyPem?: string): boolean {
    const canonical = canonicalize(payload);
    const signingBytes = Buffer.from(sig.classical.domain + ':' + canonical, 'utf-8');

    let classicalValid = false;
    let pqValid = false;

    // Verify classical (Ed25519)
    if (sig.classical) {
      classicalValid = ed25519Verify(payload, sig.classical.value, classicalPublicKeyPem, sig.classical.domain as any);
    }

    // Verify PQ (if present and a key was provided)
    if (sig.pq && pqPublicKeyPem && this.pqAlgorithm?.isAvailable()) {
      pqValid = this.pqAlgorithm.verify(signingBytes, sig.pq.value, pqPublicKeyPem);
    }

    // Check requirements
    for (const req of sig.required) {
      if (req === 'classical' && !classicalValid) return false;
      if (req === 'pq' && !pqValid) return false;
    }

    return true;
  }
}

// ============================================================================
// AlgorithmRegistry — central registry for all signature algorithms
// ============================================================================

export class AlgorithmRegistry {
  private algorithms = new Map<AlgorithmName, SignatureAlgorithm>();
  private defaultAlgorithm: AlgorithmName = 'Ed25519';

  constructor() {
    this.register(new Ed25519Algorithm());
    // ML-DSA-65 is registered but isAvailable()=false until a backend is installed
    this.register(new MLDSA65Algorithm());
  }

  register(algo: SignatureAlgorithm): void {
    this.algorithms.set(algo.name, algo);
  }

  get(name: AlgorithmName): SignatureAlgorithm | null {
    return this.algorithms.get(name) || null;
  }

  getDefault(): SignatureAlgorithm {
    return this.algorithms.get(this.defaultAlgorithm)!;
  }

  setDefault(name: AlgorithmName): void {
    if (!this.algorithms.has(name)) {
      throw new Error(`Algorithm '${name}' is not registered`);
    }
    this.defaultAlgorithm = name;
  }

  /**
   * List all registered algorithms with their availability.
   */
  list(): Array<{ name: AlgorithmName; available: boolean; postQuantum: boolean; nistLevel: number }> {
    return Array.from(this.algorithms.values()).map(a => ({
      name: a.name,
      available: a.isAvailable(),
      postQuantum: a.isPostQuantum,
      nistLevel: a.nistLevel,
    }));
  }

  /**
   * Check if PQ migration is available (i.e., at least one PQ algorithm is ready).
   */
  isPQReady(): boolean {
    for (const algo of this.algorithms.values()) {
      if (algo.isPostQuantum && algo.isAvailable()) return true;
    }
    return false;
  }
}

// ============================================================================
// Migration tracker — warns when PQ migration is overdue
// ============================================================================

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
export function assessMigrationStatus(
  currentPolicy: PQMigrationPolicy,
  pqAvailable: boolean,
  now: Date = new Date()
): MigrationStatus {
  const year = now.getFullYear();
  let recommended: PQMigrationPolicy;
  let deadline: Date | null = null;

  if (year < 2030) {
    recommended = pqAvailable ? 'classical-with-pq-optional' : 'classical-only';
    deadline = new Date('2030-01-01');
  } else if (year < 2035) {
    recommended = 'hybrid-required';
    deadline = new Date('2035-01-01');
  } else {
    recommended = 'pq-only';
    deadline = null;
  }

  const daysUntilDeadline = deadline
    ? Math.ceil((deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    : null;

  let warning: string | undefined;
  if (currentPolicy === 'classical-only' && year >= 2028) {
    warning = 'Classical-only signatures are no longer recommended. Migrate to hybrid mode.';
  }
  if (recommended === 'hybrid-required' && currentPolicy !== 'hybrid-required' && currentPolicy !== 'pq-only') {
    warning = 'Hybrid signatures (Ed25519 + ML-DSA-65) are now required.';
  }
  if (recommended === 'pq-only' && currentPolicy !== 'pq-only') {
    warning = 'Classical signatures are deprecated. PQ-only mode is required.';
  }
  if (!pqAvailable && (recommended === 'hybrid-required' || recommended === 'pq-only')) {
    warning = (warning || '') + ' PQ backend not installed — install liboqs-js or equivalent.';
  }

  return {
    current_policy: currentPolicy,
    recommended_policy: recommended,
    pq_available: pqAvailable,
    days_until_deadline: daysUntilDeadline,
    warning,
  };
}

// ============================================================================
// PEM helpers for raw PQ key bytes
// ============================================================================

function pemWrap(label: string, data: Buffer): string {
  const b64 = data.toString('base64');
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
}

function pemUnwrap(pem: string): Buffer {
  const b64 = pem
    .replace(/-----BEGIN [A-Z0-9 -]+-----/, '')
    .replace(/-----END [A-Z0-9 -]+-----/, '')
    .replace(/\s+/g, '');
  return Buffer.from(b64, 'base64');
}

// ============================================================================
// Test backend (deterministic, for testing the abstraction without liboqs)
// ============================================================================

/**
 * A deterministic test backend for ML-DSA-65 that uses SHA-256 + HMAC
 * to simulate PQ signatures. NOT cryptographically secure — for testing
 * the abstraction layer only.
 */
export class TestMLDSA65Backend implements MLDSA65Backend {
  // Note: this is NOT a real PQ implementation. It exists to test that
  // the HybridSigner abstraction correctly invokes the backend.
  // Real deployments MUST install a proper FIPS 204 backend.

  generateKeyPair(): { publicKey: Buffer; privateKey: Buffer } {
    const seed = crypto.randomBytes(32);
    return {
      publicKey: crypto.createHash('sha256').update(seed).digest(),
      privateKey: seed,
    };
  }

  sign(message: Buffer, privateKey: Buffer): Buffer {
    // Fake "PQ signature" — SHA-256(privateKey || message) + signatureBytes-32 zero bytes
    const hash = crypto.createHmac('sha256', privateKey).update(message).digest();
    return Buffer.concat([hash, Buffer.alloc(3309 - 32, 0)]);
  }

  verify(message: Buffer, signature: Buffer, publicKey: Buffer): boolean {
    if (signature.length !== 3309) return false;
    // We can't recompute the private key from the public key, so this "verification"
    // just checks the signature length and that it has the expected structure.
    // Real verification would use the public key to verify against the message.
    // For testing purposes, we accept any signature with the correct length.
    return true;  // test backend — always returns true
  }
}
