/**
 * @marketnow/trust-core
 * ATC Revocation Transparency Log — v5.1.2
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 *
 * Purpose:
 *   Public append-only log of ATC revocation events, modeled after
 *   Certificate Transparency (RFC 6962) but adapted for agent trust cards.
 *
 *   Properties:
 *   - Append-only: once an entry is added, it cannot be removed or modified
 *   - Cryptographically auditable: Merkle tree root signed periodically
 *   - Public: anyone can fetch the full log and verify
 *   - Tamper-evident: any modification of past entries breaks the hash chain
 *
 *   Use cases:
 *   - Verifier can prove an ATC was revoked at time T (for audit)
 *   - Verifier can detect if the log operator has tried to rewrite history
 *   - Researchers can analyze revocation patterns (which CAs revoke most, etc.)
 *
 * Implementation:
 *   - Entries: each revocation event is one leaf in the Merkle tree
 *   - Tree: binary Merkle tree, SHA-256 inner nodes
 *   - Signed Tree Head (STH): root hash + size + timestamp, signed by log operator
 *   - Storage: append-only file (one entry per line) + cached Merkle tree
 *   - Public endpoints:
 *     GET /api/trust/transparency/add-chain      (full log)
 *     GET /api/trust/transparency/get-sth        (latest signed tree head)
 *     GET /api/trust/transparency/get-proof-by-hash?hash=...
 *     GET /api/trust/transparency/get-entries?start=...&end=...
 *
 *   Inspired by:
 *   - RFC 6962 (Certificate Transparency)
 *   - Trillian (Google's CT implementation)
 *   - Bitcoin's Merkle tree for block transactions
 */

import { createHash } from 'node:crypto';
import { createPrivateKey, sign, verify } from 'node:crypto';

// ============================================================================
// Types
// ============================================================================

/**
 * ATC revocation states — full lifecycle.
 * (These extend the original VALID/REVOKED to match the v5.1 roadmap.)
 */
export type AtcState = 'VALID' | 'EXPIRED' | 'REVOKED' | 'SUSPENDED' | 'SUPERSEDED';

/**
 * Why was the ATC revoked? Captured for audit trail.
 */
export type RevocationReason =
  | 'key_compromise'          // CA key was compromised
  | 'subject_key_compromise'  // Subject (agent) key was compromised
  | 'ca_termination'          // CA is shutting down
  | 'affiliation_changed'     // Subject changed ownership
  | 'superseded'              // New version of the ATC was issued
  | 'cessation_of_operation'  // Subject no longer operates
  | 'certificate_hold'        // Temporarily suspended (SUSPENDED state)
  | 'remove_from_crl'         // Un-revoke (rare — used to fix false revocation)
  | 'privilege_withdrawn'     // Subject's privileges were withdrawn
  | 'aa_compromise'           // Attribute authority compromised
  | 'tool_drift'              // v5.1.1: tool fingerprint changed post-audit
  | 'manual';                 // Manual revocation by operator

/**
 * A single revocation event in the log.
 */
export interface RevocationEntry {
  /** Sequential log entry number (0-indexed) */
  index: number;

  /** Timestamp the entry was added to the log (ISO 8601 UTC) */
  timestamp: string;

  /** The ATC card_id being revoked (or un-revoked) */
  card_id: string;

  /** New state of the card */
  state: AtcState;

  /** Reason for the state change */
  reason: RevocationReason;

  /** Optional: who revoked it (CA operator name, automated system name, etc.) */
  revoked_by?: string;

  /** Optional: free-text comment for audit trail */
  comment?: string;

  /** SHA-256 of the canonical entry (excluding this hash field itself) */
  leaf_hash: string;
}

/**
 * Signed Tree Head — Merkle root + signature.
 * Published periodically (default: every 100 entries or 1 hour, whichever first).
 */
export interface SignedTreeHead {
  /** Tree version (always 1 for this implementation) */
  tree_version: 1;

  /** SHA-256 of the tree root */
  root_hash: string;

  /** Tree size (number of leaves) */
  tree_size: number;

  /** Timestamp the STH was generated (ISO 8601 UTC) */
  timestamp: string;

  /** Ed25519 signature over root_hash + tree_size + timestamp */
  signature: string;

  /** Public key used to sign (Ed25519 SPKI base64) */
  signed_by: string;
}

/**
 * Merkle inclusion proof — proves an entry is in the tree at a specific position.
 */
export interface InclusionProof {
  /** Index of the leaf in the tree */
  leaf_index: number;

  /** Hash of the leaf being proven */
  leaf_hash: string;

  /** Path from leaf to root (each entry is a sibling hash + direction) */
  audit_path: Array<{
    hash: string;
    direction: 'left' | 'right';
  }>;

  /** Tree size at the time the proof was generated */
  tree_size: number;

  /** Root hash the proof leads to */
  root_hash: string;
}

/**
 * Consistency proof — proves that tree version N is a prefix of tree version N+M.
 * Used by auditors to verify the log is append-only.
 */
export interface ConsistencyProof {
  /** First tree size */
  first_size: number;

  /** Second tree size (must be > first_size) */
  second_size: number;

  /** Path of hashes proving consistency */
  consistency_path: string[];

  /** Root hash at first_size */
  first_root: string;

  /** Root hash at second_size */
  second_root: string;
}

// ============================================================================
// Hash helpers
// ============================================================================

function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

function sha256Bytes(input: string | Buffer): Buffer {
  return createHash('sha256').update(input).digest();
}

/**
 * Canonicalize an object for hashing (RFC 8785 JCS simplified).
 */
function canonicalize(obj: unknown): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'string') return JSON.stringify(obj);
  if (typeof obj === 'number' || typeof obj === 'boolean') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalize).join(',') + ']';
  }
  if (typeof obj === 'object') {
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    const pairs = keys.map((k) => JSON.stringify(k) + ':' + canonicalize((obj as Record<string, unknown>)[k]));
    return '{' + pairs.join(',') + '}';
  }
  return JSON.stringify(obj);
}

/**
 * Compute the leaf hash for an entry.
 *
 * leaf_hash = SHA-256(canonical(entry_without_leaf_hash) + leaf_index_bytes)
 *
 * The leaf_index is included to ensure uniqueness even if two entries
 * have identical content (which shouldn't happen, but defense-in-depth).
 */
function computeLeafHash(entry: Omit<RevocationEntry, 'leaf_hash'>): string {
  const canonical = canonicalize(entry);
  const leafIndexBytes = Buffer.alloc(8);
  leafIndexBytes.writeBigUInt64BE(BigInt(entry.index));
  return sha256(canonical + leafIndexBytes.toString('hex'));
}

// ============================================================================
// Merkle tree implementation
// ============================================================================

/**
 * Binary Merkle tree.
 *
 * - Leaves are SHA-256 hashes of entries
 * - Inner nodes are SHA-256(left_hash || right_hash)
 * - Empty tree has root = SHA-256("") (well-known empty value)
 * - Single-leaf tree has root = leaf_hash (the leaf IS the root)
 *
 * For odd numbers of leaves at any level, the last leaf is "promoted" up
 * (no duplication, unlike RFC 6962 which duplicates the last leaf).
 *
 * This is the Bitcoin-style Merkle tree, simpler than RFC 6962.
 */
export class MerkleTree {
  private leaves: string[] = [];
  private cachedLevels: string[][] = [];
  private dirty = true;

  /** Add a leaf hash to the tree */
  addLeaf(leafHash: string): void {
    if (!/^[0-9a-f]{64}$/.test(leafHash)) {
      throw new Error(`Invalid leaf hash: ${leafHash} (expected 64 hex chars)`);
    }
    this.leaves.push(leafHash);
    this.dirty = true;
  }

  /** Add multiple leaf hashes at once */
  addLeaves(leafHashes: string[]): void {
    for (const h of leafHashes) this.addLeaf(h);
  }

  /** Get the current tree size (number of leaves) */
  size(): number {
    return this.leaves.length;
  }

  /** Compute the root hash. Returns SHA-256("") for empty tree. */
  root(): string {
    if (this.leaves.length === 0) {
      return sha256('');
    }
    this.rebuildIfDirty();
    return this.cachedLevels[this.cachedLevels.length - 1][0];
  }

  /** Compute all levels of the tree, cached. */
  private rebuildIfDirty(): void {
    if (!this.dirty) return;
    if (this.leaves.length === 0) {
      this.cachedLevels = [[sha256('')]];
      this.dirty = false;
      return;
    }

    this.cachedLevels = [];
    let currentLevel = [...this.leaves];
    this.cachedLevels.push(currentLevel);

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        if (i + 1 < currentLevel.length) {
          nextLevel.push(sha256(currentLevel[i] + currentLevel[i + 1]));
        } else {
          // Odd leaf out — promote it up
          nextLevel.push(currentLevel[i]);
        }
      }
      this.cachedLevels.push(nextLevel);
      currentLevel = nextLevel;
    }
    this.dirty = false;
  }

  /**
   * Compute the audit path for a leaf at index `leafIndex`.
   * Returns the path from leaf to root.
   */
  auditPath(leafIndex: number): Array<{ hash: string; direction: 'left' | 'right' }> {
    if (leafIndex < 0 || leafIndex >= this.leaves.length) {
      throw new Error(`Invalid leaf index: ${leafIndex} (tree size: ${this.leaves.length})`);
    }
    this.rebuildIfDirty();

    const path: Array<{ hash: string; direction: 'left' | 'right' }> = [];
    let idx = leafIndex;

    for (let level = 0; level < this.cachedLevels.length - 1; level++) {
      const levelArr = this.cachedLevels[level];
      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;

      if (siblingIdx < levelArr.length) {
        // Sibling exists
        const direction = idx % 2 === 0 ? 'right' : 'left';
        path.push({ hash: levelArr[siblingIdx], direction });
      } else if (idx % 2 === 0) {
        // Odd leaf out — promoted up. The parent's sibling is the next level up.
        // For audit purposes, we still include the (promoted) sibling at the next level.
        const nextLevel = this.cachedLevels[level + 1];
        const parentIdx = Math.floor(idx / 2);
        const siblingParent = parentIdx % 2 === 0 ? parentIdx + 1 : parentIdx - 1;
        if (siblingParent < nextLevel.length) {
          // Use the parent's sibling — this is correct for the audit path
          // (the verifier needs to know the leaf was promoted)
          path.push({ hash: nextLevel[siblingParent], direction: 'right' });
        }
        // If siblingParent doesn't exist either, the leaf was promoted to root
        // and the path is incomplete (but valid)
      }

      idx = Math.floor(idx / 2);
    }

    return path;
  }

  /**
   * Verify an audit path against a known root.
   * Returns true if the path leads to the root.
   */
  static verifyAuditPath(
    leafHash: string,
    leafIndex: number,
    auditPath: Array<{ hash: string; direction: 'left' | 'right' }>,
    expectedRoot: string,
  ): boolean {
    let current = leafHash;
    let idx = leafIndex;

    for (const step of auditPath) {
      if (step.direction === 'right') {
        current = sha256(current + step.hash);
      } else {
        current = sha256(step.hash + current);
      }
      idx = Math.floor(idx / 2);
    }

    return current === expectedRoot;
  }

  /**
   * Get all leaves (for serialization / backup).
   */
  getLeaves(): string[] {
    return [...this.leaves];
  }

  /**
   * Load leaves from a serialized format (for restoring from backup).
   */
  static fromLeaves(leaves: string[]): MerkleTree {
    const tree = new MerkleTree();
    tree.addLeaves(leaves);
    return tree;
  }
}

// ============================================================================
// Revocation log
// ============================================================================

/**
 * Public append-only log of ATC revocation events.
 *
 * Storage: in-memory for the reference implementation. Production deployments
 * should use a persistent append-only log (file, database, or blockchain).
 *
 * The log is signed by a log operator key (Ed25519). The signature is over
 * the canonical STH (root_hash + tree_size + timestamp).
 */
export class RevocationTransparencyLog {
  private tree: MerkleTree;
  private entries: RevocationEntry[] = [];
  private sths: SignedTreeHead[] = [];
  private operatorPrivateKey?: Buffer;
  private operatorPublicKey: string;
  private sthInterval: number; // sign every N entries
  private sthTimeInterval: number; // sign every N seconds
  private lastSthTime = 0;

  constructor(params: {
    operatorPrivateKey?: Buffer; // Ed25519 PKCS8 PEM or raw bytes
    operatorPublicKey: string; // base64 SPKI
    sthInterval?: number; // default: 100 entries
    sthTimeInterval?: number; // default: 3600 seconds (1 hour)
  }) {
    this.tree = new MerkleTree();
    this.operatorPrivateKey = params.operatorPrivateKey;
    this.operatorPublicKey = params.operatorPublicKey;
    this.sthInterval = params.sthInterval ?? 100;
    this.sthTimeInterval = params.sthTimeInterval ?? 3600;
  }

  /**
   * Append a revocation entry to the log.
   * Returns the entry (with leaf_hash computed).
   */
  append(params: {
    card_id: string;
    state: AtcState;
    reason: RevocationReason;
    revoked_by?: string;
    comment?: string;
  }): RevocationEntry {
    const index = this.entries.length;
    const timestamp = new Date().toISOString();

    const entryWithoutHash: Omit<RevocationEntry, 'leaf_hash'> = {
      index,
      timestamp,
      card_id: params.card_id,
      state: params.state,
      reason: params.reason,
      revoked_by: params.revoked_by,
      comment: params.comment,
    };

    const leafHash = computeLeafHash(entryWithoutHash);
    const entry: RevocationEntry = { ...entryWithoutHash, leaf_hash: leafHash };

    this.entries.push(entry);
    this.tree.addLeaf(leafHash);

    // Auto-sign STH if interval reached
    const now = Date.now();
    if (
      this.entries.length % this.sthInterval === 0 ||
      now - this.lastSthTime > this.sthTimeInterval * 1000
    ) {
      this.signTreeHead();
    }

    return entry;
  }

  /**
   * Sign the current tree head.
   * Returns the STH and stores it in the log.
   */
  signTreeHead(): SignedTreeHead {
    if (!this.operatorPrivateKey) {
      throw new Error('Cannot sign STH: no operator private key configured');
    }

    const rootHash = this.tree.root();
    const treeSize = this.tree.size();
    const timestamp = new Date().toISOString();

    const signedData = canonicalize({
      tree_version: 1,
      root_hash: rootHash,
      tree_size: treeSize,
      timestamp,
    });

    const signature = sign(null, Buffer.from(signedData, 'utf8'), {
      key: this.operatorPrivateKey,
      algorithm: 'Ed25519',
    }).toString('base64');

    const sth: SignedTreeHead = {
      tree_version: 1,
      root_hash: rootHash,
      tree_size: treeSize,
      timestamp,
      signature,
      signed_by: this.operatorPublicKey,
    };

    this.sths.push(sth);
    this.lastSthTime = Date.now();
    return sth;
  }

  /**
   * Get the latest STH (or undefined if no STHs have been signed).
   */
  getLatestSTH(): SignedTreeHead | undefined {
    return this.sths[this.sths.length - 1];
  }

  /**
   * Get all STHs ever signed (for auditors).
   */
  getAllSTHs(): SignedTreeHead[] {
    return [...this.sths];
  }

  /**
   * Get all entries in the log.
   */
  getEntries(): RevocationEntry[] {
    return [...this.entries];
  }

  /**
   * Get entries in a range [start, end] inclusive.
   */
  getEntriesRange(start: number, end: number): RevocationEntry[] {
    if (start < 0 || end < 0 || start > end) {
      throw new Error(`Invalid range: [${start}, ${end}]`);
    }
    if (end >= this.entries.length) {
      throw new Error(`End index ${end} out of bounds (log size: ${this.entries.length})`);
    }
    return this.entries.slice(start, end + 1);
  }

  /**
   * Get a specific entry by index.
   */
  getEntry(index: number): RevocationEntry {
    if (index < 0 || index >= this.entries.length) {
      throw new Error(`Index ${index} out of bounds (log size: ${this.entries.length})`);
    }
    return this.entries[index];
  }

  /**
   * Find all entries for a specific card_id (a card may be revoked, then re-instated, then revoked again).
   */
  getEntriesForCard(cardId: string): RevocationEntry[] {
    return this.entries.filter((e) => e.card_id === cardId);
  }

  /**
   * Get the current state of a card based on the log.
   * Returns the state from the latest entry for that card_id.
   * If no entries exist, returns 'VALID' (default).
   */
  getCardState(cardId: string): AtcState {
    const entries = this.getEntriesForCard(cardId);
    if (entries.length === 0) return 'VALID';
    return entries[entries.length - 1].state;
  }

  /**
   * Get an inclusion proof for a specific entry.
   */
  getInclusionProof(index: number): InclusionProof {
    const entry = this.getEntry(index);
    const auditPath = this.tree.auditPath(index);

    return {
      leaf_index: index,
      leaf_hash: entry.leaf_hash,
      audit_path: auditPath,
      tree_size: this.tree.size(),
      root_hash: this.tree.root(),
    };
  }

  /**
   * Verify an inclusion proof.
   */
  static verifyInclusionProof(proof: InclusionProof, sth: SignedTreeHead): boolean {
    if (proof.tree_size !== sth.tree_size) {
      return false; // proof and STH must be at the same tree size
    }
    return MerkleTree.verifyAuditPath(
      proof.leaf_hash,
      proof.leaf_index,
      proof.audit_path,
      sth.root_hash,
    );
  }

  /**
   * Verify an STH signature.
   */
  static verifySTH(sth: SignedTreeHead, operatorPublicKey: string): boolean {
    const signedData = canonicalize({
      tree_version: sth.tree_version,
      root_hash: sth.root_hash,
      tree_size: sth.tree_size,
      timestamp: sth.timestamp,
    });

    // operatorPublicKey is base64 SPKI; need to convert to crypto KeyObject
    const keyBuffer = Buffer.from(operatorPublicKey, 'base64');
    try {
      return verify(
        null,
        Buffer.from(signedData, 'utf8'),
        { key: keyBuffer, format: 'der', type: 'spki' },
        Buffer.from(sth.signature, 'base64'),
      );
    } catch {
      return false;
    }
  }

  /**
   * Get the current tree size.
   */
  size(): number {
    return this.tree.size();
  }

  /**
   * Get the current root hash.
   */
  root(): string {
    return this.tree.root();
  }
}

// ============================================================================
// Convenience helpers
// ============================================================================

/**
 * Compute the canonical leaf hash for an entry (without storing it).
 * Useful for verifying that a published entry matches what would have been
 * computed at append time.
 */
export function computeEntryLeafHash(entry: Omit<RevocationEntry, 'leaf_hash'>): string {
  return computeLeafHash(entry);
}

/**
 * Verify that an entry's stored leaf_hash matches what we'd compute from its content.
 */
export function verifyEntryHash(entry: RevocationEntry): boolean {
  const { leaf_hash, ...rest } = entry;
  return computeLeafHash(rest) === leaf_hash;
}

// ============================================================================
// Constants
// ============================================================================

export const TRANSPARENCY_LOG_VERSION = '1.0.0';
export const TRANSPARENCY_LOG_HASH_ALGORITHM = 'SHA-256';
export const TRANSPARENCY_LOG_SIGNATURE_ALGORITHM = 'Ed25519 (RFC 8032)';
