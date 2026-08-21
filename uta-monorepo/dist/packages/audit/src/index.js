"use strict";
/**
 * @marketnow/trust-audit
 * P8-2: Tamper-evident audit log using Merkle trees.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLog = exports.MerkleTree = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const crypto_js_1 = require("../../core/crypto.js");
class MerkleTree {
    leaves = [];
    root = null;
    add(entry) {
        const fullEntry = { ...entry, sequence: this.leaves.length };
        this.leaves.push(fullEntry);
        this.rebuild();
        return fullEntry;
    }
    rebuild() {
        if (this.leaves.length === 0) {
            this.root = null;
            return;
        }
        const hashes = this.leaves.map(e => this.hashEntry(e));
        while (hashes.length > 1) {
            const next = [];
            for (let i = 0; i < hashes.length; i += 2) {
                const left = hashes[i];
                const right = hashes[i + 1] || left;
                next.push(MerkleTree.hashPair(left, right));
            }
            hashes.length = 0;
            hashes.push(...next);
        }
        this.root = hashes[0];
    }
    getRoot() { return this.root; }
    size() { return this.leaves.length; }
    getLeaves() { return [...this.leaves]; }
    getProof(leafIndex) {
        if (leafIndex < 0 || leafIndex >= this.leaves.length || !this.root)
            return null;
        const entry = this.leaves[leafIndex];
        const leafHash = this.hashEntry(entry);
        const path = [];
        let level = this.leaves.map(e => this.hashEntry(e));
        let idx = leafIndex;
        while (level.length > 1) {
            const isRight = idx % 2 === 1;
            const siblingIdx = isRight ? idx - 1 : idx + 1;
            if (siblingIdx < level.length) {
                path.push({ hash: level[siblingIdx], direction: isRight ? 'left' : 'right' });
            }
            const nextLevel = [];
            for (let i = 0; i < level.length; i += 2) {
                const l = level[i];
                const r = level[i + 1] || level[i];
                nextLevel.push(MerkleTree.hashPair(l, r));
            }
            level = nextLevel;
            idx = Math.floor(idx / 2);
        }
        return { leaf_hash: leafHash, leaf_index: leafIndex, path, root: this.root };
    }
    static verifyProof(proof) {
        let currentHash = proof.leaf_hash;
        for (const step of proof.path) {
            currentHash = step.direction === 'left'
                ? MerkleTree.hashPair(step.hash, currentHash)
                : MerkleTree.hashPair(currentHash, step.hash);
        }
        return currentHash === proof.root;
    }
    signRoot(keyPair) {
        if (!this.root)
            throw new Error('tree is empty');
        const payload = { root: this.root, tree_size: this.leaves.length, timestamp: new Date().toISOString() };
        const signatureValue = (0, crypto_js_1.sign)(payload, keyPair.privateKeyPem, crypto_js_1.DOMAINS.TRUST_DECISION);
        return { ...payload, signature: { algorithm: 'Ed25519 (RFC 8032)', value: signatureValue, domain: crypto_js_1.DOMAINS.TRUST_DECISION, key_id: keyPair.keyId } };
    }
    static verifySignedRoot(signedRoot, publicKeyPem) {
        const { signature, ...payload } = signedRoot;
        if (!signature || signature.domain !== crypto_js_1.DOMAINS.TRUST_DECISION)
            return false;
        return (0, crypto_js_1.verify)(payload, signature.value, publicKeyPem, crypto_js_1.DOMAINS.TRUST_DECISION);
    }
    hashEntry(entry) {
        return node_crypto_1.default.createHash('sha256').update((0, crypto_js_1.canonicalize)(entry), 'utf-8').digest('hex');
    }
    static hashPair(left, right) {
        return node_crypto_1.default.createHash('sha256').update(left + right, 'utf-8').digest('hex');
    }
}
exports.MerkleTree = MerkleTree;
class AuditLog {
    tree;
    signedRoots = [];
    constructor() { this.tree = new MerkleTree(); }
    add(receipt) {
        const receiptHash = 'sha256:' + (0, crypto_js_1.canonicalHash)(receipt);
        return this.tree.add({ receipt_id: receipt.receipt_id, receipt_hash: receiptHash, timestamp: new Date().toISOString() });
    }
    getRoot() { return this.tree.getRoot(); }
    size() { return this.tree.size(); }
    getProof(receiptId) {
        const leaves = this.tree.getLeaves();
        const idx = leaves.findIndex(l => l.receipt_id === receiptId);
        if (idx === -1)
            return null;
        return this.tree.getProof(idx);
    }
    verifyReceipt(receiptId) {
        const proof = this.getProof(receiptId);
        if (!proof)
            return { included: false };
        return { included: MerkleTree.verifyProof(proof), proof };
    }
    publishRoot(keyPair) {
        const signed = this.tree.signRoot(keyPair);
        this.signedRoots.push(signed);
        return signed;
    }
    getSignedRoots() { return [...this.signedRoots]; }
    verifyIntegrity(publicKeyPem) {
        const currentRoot = this.tree.getRoot();
        if (this.signedRoots.length === 0)
            return { valid: false, expectedRoot: null, actualRoot: currentRoot };
        const lastSigned = this.signedRoots[this.signedRoots.length - 1];
        if (!MerkleTree.verifySignedRoot(lastSigned, publicKeyPem))
            return { valid: false, expectedRoot: lastSigned.root, actualRoot: currentRoot };
        if (lastSigned.root !== currentRoot)
            return { valid: false, expectedRoot: lastSigned.root, actualRoot: currentRoot };
        return { valid: true, expectedRoot: lastSigned.root, actualRoot: currentRoot };
    }
    getEntries() { return this.tree.getLeaves(); }
}
exports.AuditLog = AuditLog;
