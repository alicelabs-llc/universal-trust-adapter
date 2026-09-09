"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANSPARENCY_LOG_SIGNATURE_ALGORITHM = exports.TRANSPARENCY_LOG_HASH_ALGORITHM = exports.TRANSPARENCY_LOG_VERSION = exports.RevocationTransparencyLog = exports.MerkleTree = void 0;
exports.computeEntryLeafHash = computeEntryLeafHash;
exports.verifyEntryHash = verifyEntryHash;
const node_crypto_1 = require("node:crypto");
const node_crypto_2 = require("node:crypto");
// ============================================================================
// Hash helpers
// ============================================================================
function sha256(input) {
    return (0, node_crypto_1.createHash)('sha256').update(input).digest('hex');
}
function sha256Bytes(input) {
    return (0, node_crypto_1.createHash)('sha256').update(input).digest();
}
/**
 * Canonicalize an object for hashing (RFC 8785 JCS simplified).
 */
function canonicalize(obj) {
    if (obj === null || obj === undefined)
        return 'null';
    if (typeof obj === 'string')
        return JSON.stringify(obj);
    if (typeof obj === 'number' || typeof obj === 'boolean')
        return JSON.stringify(obj);
    if (Array.isArray(obj)) {
        return '[' + obj.map(canonicalize).join(',') + ']';
    }
    if (typeof obj === 'object') {
        const keys = Object.keys(obj).sort();
        const pairs = keys.map((k) => JSON.stringify(k) + ':' + canonicalize(obj[k]));
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
function computeLeafHash(entry) {
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
class MerkleTree {
    leaves = [];
    cachedLevels = [];
    dirty = true;
    /** Add a leaf hash to the tree */
    addLeaf(leafHash) {
        if (!/^[0-9a-f]{64}$/.test(leafHash)) {
            throw new Error(`Invalid leaf hash: ${leafHash} (expected 64 hex chars)`);
        }
        this.leaves.push(leafHash);
        this.dirty = true;
    }
    /** Add multiple leaf hashes at once */
    addLeaves(leafHashes) {
        for (const h of leafHashes)
            this.addLeaf(h);
    }
    /** Get the current tree size (number of leaves) */
    size() {
        return this.leaves.length;
    }
    /** Compute the root hash. Returns SHA-256("") for empty tree. */
    root() {
        if (this.leaves.length === 0) {
            return sha256('');
        }
        this.rebuildIfDirty();
        return this.cachedLevels[this.cachedLevels.length - 1][0];
    }
    /** Compute all levels of the tree, cached. */
    rebuildIfDirty() {
        if (!this.dirty)
            return;
        if (this.leaves.length === 0) {
            this.cachedLevels = [[sha256('')]];
            this.dirty = false;
            return;
        }
        this.cachedLevels = [];
        let currentLevel = [...this.leaves];
        this.cachedLevels.push(currentLevel);
        while (currentLevel.length > 1) {
            const nextLevel = [];
            for (let i = 0; i < currentLevel.length; i += 2) {
                if (i + 1 < currentLevel.length) {
                    nextLevel.push(sha256(currentLevel[i] + currentLevel[i + 1]));
                }
                else {
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
    auditPath(leafIndex) {
        if (leafIndex < 0 || leafIndex >= this.leaves.length) {
            throw new Error(`Invalid leaf index: ${leafIndex} (tree size: ${this.leaves.length})`);
        }
        this.rebuildIfDirty();
        const path = [];
        let idx = leafIndex;
        for (let level = 0; level < this.cachedLevels.length - 1; level++) {
            const levelArr = this.cachedLevels[level];
            const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
            if (siblingIdx < levelArr.length) {
                // Sibling exists
                const direction = idx % 2 === 0 ? 'right' : 'left';
                path.push({ hash: levelArr[siblingIdx], direction });
            }
            else if (idx % 2 === 0) {
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
    static verifyAuditPath(leafHash, leafIndex, auditPath, expectedRoot) {
        let current = leafHash;
        let idx = leafIndex;
        for (const step of auditPath) {
            if (step.direction === 'right') {
                current = sha256(current + step.hash);
            }
            else {
                current = sha256(step.hash + current);
            }
            idx = Math.floor(idx / 2);
        }
        return current === expectedRoot;
    }
    /**
     * Get all leaves (for serialization / backup).
     */
    getLeaves() {
        return [...this.leaves];
    }
    /**
     * Load leaves from a serialized format (for restoring from backup).
     */
    static fromLeaves(leaves) {
        const tree = new MerkleTree();
        tree.addLeaves(leaves);
        return tree;
    }
}
exports.MerkleTree = MerkleTree;
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
class RevocationTransparencyLog {
    tree;
    entries = [];
    sths = [];
    operatorPrivateKey;
    operatorPublicKey;
    sthInterval; // sign every N entries
    sthTimeInterval; // sign every N seconds
    lastSthTime = 0;
    constructor(params) {
        this.tree = new MerkleTree();
        this.operatorPrivateKey = params.operatorPrivateKey;
        this.operatorPublicKey = params.operatorPublicKey;
        this.sthInterval = params.sthInterval ?? 100;
        this.sthTimeInterval = params.sthTimeInterval ?? 3600;
    }
    /**
     * Resolve the operator private key into a crypto KeyObject.
     * Accepts PKCS8 PEM (as Buffer) or raw PKCS8 DER bytes.
     */
    resolveOperatorKey() {
        if (!this.operatorPrivateKey) {
            throw new Error('RevocationTransparencyLog: no operator private key configured');
        }
        const buf = this.operatorPrivateKey;
        if (buf.includes('PRIVATE KEY')) {
            return (0, node_crypto_2.createPrivateKey)(buf.toString('utf8'));
        }
        return (0, node_crypto_2.createPrivateKey)({ key: buf, format: 'der', type: 'pkcs8' });
    }
    /**
     * Append a revocation entry to the log.
     * Returns the entry (with leaf_hash computed).
     */
    append(params) {
        const index = this.entries.length;
        const timestamp = new Date().toISOString();
        const entryWithoutHash = {
            index,
            timestamp,
            card_id: params.card_id,
            state: params.state,
            reason: params.reason,
            revoked_by: params.revoked_by,
            comment: params.comment,
        };
        const leafHash = computeLeafHash(entryWithoutHash);
        const entry = { ...entryWithoutHash, leaf_hash: leafHash };
        this.entries.push(entry);
        this.tree.addLeaf(leafHash);
        // Auto-sign STH if interval reached
        const now = Date.now();
        if (this.entries.length % this.sthInterval === 0 ||
            now - this.lastSthTime > this.sthTimeInterval * 1000) {
            this.signTreeHead();
        }
        return entry;
    }
    /**
     * Sign the current tree head.
     * Returns the STH and stores it in the log.
     */
    signTreeHead() {
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
        const signature = (0, node_crypto_2.sign)(null, Buffer.from(signedData, 'utf8'), this.resolveOperatorKey()).toString('base64');
        const sth = {
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
    getLatestSTH() {
        return this.sths[this.sths.length - 1];
    }
    /**
     * Get all STHs ever signed (for auditors).
     */
    getAllSTHs() {
        return [...this.sths];
    }
    /**
     * Get all entries in the log.
     */
    getEntries() {
        return [...this.entries];
    }
    /**
     * Get entries in a range [start, end] inclusive.
     */
    getEntriesRange(start, end) {
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
    getEntry(index) {
        if (index < 0 || index >= this.entries.length) {
            throw new Error(`Index ${index} out of bounds (log size: ${this.entries.length})`);
        }
        return this.entries[index];
    }
    /**
     * Find all entries for a specific card_id (a card may be revoked, then re-instated, then revoked again).
     */
    getEntriesForCard(cardId) {
        return this.entries.filter((e) => e.card_id === cardId);
    }
    /**
     * Get the current state of a card based on the log.
     * Returns the state from the latest entry for that card_id.
     * If no entries exist, returns 'VALID' (default).
     */
    getCardState(cardId) {
        const entries = this.getEntriesForCard(cardId);
        if (entries.length === 0)
            return 'VALID';
        return entries[entries.length - 1].state;
    }
    /**
     * Get an inclusion proof for a specific entry.
     */
    getInclusionProof(index) {
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
    static verifyInclusionProof(proof, sth) {
        if (proof.tree_size !== sth.tree_size) {
            return false; // proof and STH must be at the same tree size
        }
        return MerkleTree.verifyAuditPath(proof.leaf_hash, proof.leaf_index, proof.audit_path, sth.root_hash);
    }
    /**
     * Verify an STH signature.
     */
    static verifySTH(sth, operatorPublicKey) {
        const signedData = canonicalize({
            tree_version: sth.tree_version,
            root_hash: sth.root_hash,
            tree_size: sth.tree_size,
            timestamp: sth.timestamp,
        });
        // operatorPublicKey is base64 SPKI; need to convert to crypto KeyObject
        const keyBuffer = Buffer.from(operatorPublicKey, 'base64');
        try {
            return (0, node_crypto_2.verify)(null, Buffer.from(signedData, 'utf8'), { key: keyBuffer, format: 'der', type: 'spki' }, Buffer.from(sth.signature, 'base64'));
        }
        catch {
            return false;
        }
    }
    /**
     * Get the current tree size.
     */
    size() {
        return this.tree.size();
    }
    /**
     * Get the current root hash.
     */
    root() {
        return this.tree.root();
    }
}
exports.RevocationTransparencyLog = RevocationTransparencyLog;
// ============================================================================
// Convenience helpers
// ============================================================================
/**
 * Compute the canonical leaf hash for an entry (without storing it).
 * Useful for verifying that a published entry matches what would have been
 * computed at append time.
 */
function computeEntryLeafHash(entry) {
    return computeLeafHash(entry);
}
/**
 * Verify that an entry's stored leaf_hash matches what we'd compute from its content.
 */
function verifyEntryHash(entry) {
    const { leaf_hash, ...rest } = entry;
    return computeLeafHash(rest) === leaf_hash;
}
// ============================================================================
// Constants
// ============================================================================
exports.TRANSPARENCY_LOG_VERSION = '1.0.0';
exports.TRANSPARENCY_LOG_HASH_ALGORITHM = 'SHA-256';
exports.TRANSPARENCY_LOG_SIGNATURE_ALGORITHM = 'Ed25519 (RFC 8032)';
