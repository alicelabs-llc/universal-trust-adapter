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
/**
 * ATC revocation states — full lifecycle.
 * (These extend the original VALID/REVOKED to match the v5.1 roadmap.)
 */
export type AtcState = 'VALID' | 'EXPIRED' | 'REVOKED' | 'SUSPENDED' | 'SUPERSEDED';
/**
 * Why was the ATC revoked? Captured for audit trail.
 */
export type RevocationReason = 'key_compromise' | 'subject_key_compromise' | 'ca_termination' | 'affiliation_changed' | 'superseded' | 'cessation_of_operation' | 'certificate_hold' | 'remove_from_crl' | 'privilege_withdrawn' | 'aa_compromise' | 'tool_drift' | 'manual';
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
export declare class MerkleTree {
    private leaves;
    private cachedLevels;
    private dirty;
    /** Add a leaf hash to the tree */
    addLeaf(leafHash: string): void;
    /** Add multiple leaf hashes at once */
    addLeaves(leafHashes: string[]): void;
    /** Get the current tree size (number of leaves) */
    size(): number;
    /** Compute the root hash. Returns SHA-256("") for empty tree. */
    root(): string;
    /** Compute all levels of the tree, cached. */
    private rebuildIfDirty;
    /**
     * Compute the audit path for a leaf at index `leafIndex`.
     * Returns the path from leaf to root.
     */
    auditPath(leafIndex: number): Array<{
        hash: string;
        direction: 'left' | 'right';
    }>;
    /**
     * Verify an audit path against a known root.
     * Returns true if the path leads to the root.
     */
    static verifyAuditPath(leafHash: string, leafIndex: number, auditPath: Array<{
        hash: string;
        direction: 'left' | 'right';
    }>, expectedRoot: string): boolean;
    /**
     * Get all leaves (for serialization / backup).
     */
    getLeaves(): string[];
    /**
     * Load leaves from a serialized format (for restoring from backup).
     */
    static fromLeaves(leaves: string[]): MerkleTree;
}
/**
 * Public append-only log of ATC revocation events.
 *
 * Storage: in-memory for the reference implementation. Production deployments
 * should use a persistent append-only log (file, database, or blockchain).
 *
 * The log is signed by a log operator key (Ed25519). The signature is over
 * the canonical STH (root_hash + tree_size + timestamp).
 */
export declare class RevocationTransparencyLog {
    private tree;
    private entries;
    private sths;
    private operatorPrivateKey?;
    private operatorPublicKey;
    private sthInterval;
    private sthTimeInterval;
    private lastSthTime;
    constructor(params: {
        operatorPrivateKey?: Buffer;
        operatorPublicKey: string;
        sthInterval?: number;
        sthTimeInterval?: number;
    });
    /**
     * Resolve the operator private key into a crypto KeyObject.
     * Accepts PKCS8 PEM (as Buffer) or raw PKCS8 DER bytes.
     */
    private resolveOperatorKey;
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
    }): RevocationEntry;
    /**
     * Sign the current tree head.
     * Returns the STH and stores it in the log.
     */
    signTreeHead(): SignedTreeHead;
    /**
     * Get the latest STH (or undefined if no STHs have been signed).
     */
    getLatestSTH(): SignedTreeHead | undefined;
    /**
     * Get all STHs ever signed (for auditors).
     */
    getAllSTHs(): SignedTreeHead[];
    /**
     * Get all entries in the log.
     */
    getEntries(): RevocationEntry[];
    /**
     * Get entries in a range [start, end] inclusive.
     */
    getEntriesRange(start: number, end: number): RevocationEntry[];
    /**
     * Get a specific entry by index.
     */
    getEntry(index: number): RevocationEntry;
    /**
     * Find all entries for a specific card_id (a card may be revoked, then re-instated, then revoked again).
     */
    getEntriesForCard(cardId: string): RevocationEntry[];
    /**
     * Get the current state of a card based on the log.
     * Returns the state from the latest entry for that card_id.
     * If no entries exist, returns 'VALID' (default).
     */
    getCardState(cardId: string): AtcState;
    /**
     * Get an inclusion proof for a specific entry.
     */
    getInclusionProof(index: number): InclusionProof;
    /**
     * Verify an inclusion proof.
     */
    static verifyInclusionProof(proof: InclusionProof, sth: SignedTreeHead): boolean;
    /**
     * Verify an STH signature.
     */
    static verifySTH(sth: SignedTreeHead, operatorPublicKey: string): boolean;
    /**
     * Get the current tree size.
     */
    size(): number;
    /**
     * Get the current root hash.
     */
    root(): string;
}
/**
 * Compute the canonical leaf hash for an entry (without storing it).
 * Useful for verifying that a published entry matches what would have been
 * computed at append time.
 */
export declare function computeEntryLeafHash(entry: Omit<RevocationEntry, 'leaf_hash'>): string;
/**
 * Verify that an entry's stored leaf_hash matches what we'd compute from its content.
 */
export declare function verifyEntryHash(entry: RevocationEntry): boolean;
export declare const TRANSPARENCY_LOG_VERSION = "1.0.0";
export declare const TRANSPARENCY_LOG_HASH_ALGORITHM = "SHA-256";
export declare const TRANSPARENCY_LOG_SIGNATURE_ALGORITHM = "Ed25519 (RFC 8032)";
