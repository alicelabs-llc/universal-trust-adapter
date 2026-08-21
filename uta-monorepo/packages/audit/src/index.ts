/**
 * @marketnow/trust-audit
 * P8-2: Tamper-evident audit log using Merkle trees.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */

import crypto from 'node:crypto';
import { canonicalize, canonicalHash, sign as ed25519Sign, verify as ed25519Verify, DOMAINS } from '../../core/crypto.js';
import type { Ed25519KeyPair } from '../../core/crypto.js';

export interface MerkleNode {
  hash: string;
  left?: string;
  right?: string;
  data?: string;
  index?: number;
}

export interface MerkleProof {
  leaf_hash: string;
  leaf_index: number;
  path: Array<{ hash: string; direction: 'left' | 'right' }>;
  root: string;
}

export interface AuditEntry {
  sequence: number;
  receipt_id: string;
  receipt_hash: string;
  timestamp: string;
}

export interface SignedMerkleRoot {
  root: string;
  tree_size: number;
  timestamp: string;
  signature: {
    algorithm: 'Ed25519 (RFC 8032)';
    value: string;
    domain: string;
    key_id: string;
  };
}

export class MerkleTree {
  private leaves: AuditEntry[] = [];
  private root: string | null = null;

  add(entry: Omit<AuditEntry, 'sequence'>): AuditEntry {
    const fullEntry: AuditEntry = { ...entry, sequence: this.leaves.length };
    this.leaves.push(fullEntry);
    this.rebuild();
    return fullEntry;
  }

  private rebuild(): void {
    if (this.leaves.length === 0) { this.root = null; return; }
    const hashes = this.leaves.map(e => this.hashEntry(e));
    while (hashes.length > 1) {
      const next: string[] = [];
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

  getRoot(): string | null { return this.root; }
  size(): number { return this.leaves.length; }
  getLeaves(): AuditEntry[] { return [...this.leaves]; }

  getProof(leafIndex: number): MerkleProof | null {
    if (leafIndex < 0 || leafIndex >= this.leaves.length || !this.root) return null;
    const entry = this.leaves[leafIndex];
    const leafHash = this.hashEntry(entry);
    const path: MerkleProof['path'] = [];
    let level = this.leaves.map(e => this.hashEntry(e));
    let idx = leafIndex;

    while (level.length > 1) {
      const isRight = idx % 2 === 1;
      const siblingIdx = isRight ? idx - 1 : idx + 1;
      if (siblingIdx < level.length) {
        path.push({ hash: level[siblingIdx], direction: isRight ? 'left' : 'right' });
      }
      const nextLevel: string[] = [];
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

  static verifyProof(proof: MerkleProof): boolean {
    let currentHash = proof.leaf_hash;
    for (const step of proof.path) {
      currentHash = step.direction === 'left'
        ? MerkleTree.hashPair(step.hash, currentHash)
        : MerkleTree.hashPair(currentHash, step.hash);
    }
    return currentHash === proof.root;
  }

  signRoot(keyPair: Ed25519KeyPair): SignedMerkleRoot {
    if (!this.root) throw new Error('tree is empty');
    const payload = { root: this.root, tree_size: this.leaves.length, timestamp: new Date().toISOString() };
    const signatureValue = ed25519Sign(payload, keyPair.privateKeyPem, DOMAINS.TRUST_DECISION);
    return { ...payload, signature: { algorithm: 'Ed25519 (RFC 8032)', value: signatureValue, domain: DOMAINS.TRUST_DECISION, key_id: keyPair.keyId } };
  }

  static verifySignedRoot(signedRoot: SignedMerkleRoot, publicKeyPem: string): boolean {
    const { signature, ...payload } = signedRoot;
    if (!signature || signature.domain !== DOMAINS.TRUST_DECISION) return false;
    return ed25519Verify(payload, signature.value, publicKeyPem, DOMAINS.TRUST_DECISION);
  }

  private hashEntry(entry: AuditEntry): string {
    return crypto.createHash('sha256').update(canonicalize(entry), 'utf-8').digest('hex');
  }

  static hashPair(left: string, right: string): string {
    return crypto.createHash('sha256').update(left + right, 'utf-8').digest('hex');
  }
}

export class AuditLog {
  private tree: MerkleTree;
  private signedRoots: SignedMerkleRoot[] = [];

  constructor() { this.tree = new MerkleTree(); }

  add(receipt: { receipt_id: string; [key: string]: unknown }): AuditEntry {
    const receiptHash = 'sha256:' + canonicalHash(receipt);
    return this.tree.add({ receipt_id: receipt.receipt_id, receipt_hash: receiptHash, timestamp: new Date().toISOString() });
  }

  getRoot(): string | null { return this.tree.getRoot(); }
  size(): number { return this.tree.size(); }

  getProof(receiptId: string): MerkleProof | null {
    const leaves = this.tree.getLeaves();
    const idx = leaves.findIndex(l => l.receipt_id === receiptId);
    if (idx === -1) return null;
    return this.tree.getProof(idx);
  }

  verifyReceipt(receiptId: string): { included: boolean; proof?: MerkleProof } {
    const proof = this.getProof(receiptId);
    if (!proof) return { included: false };
    return { included: MerkleTree.verifyProof(proof), proof };
  }

  publishRoot(keyPair: Ed25519KeyPair): SignedMerkleRoot {
    const signed = this.tree.signRoot(keyPair);
    this.signedRoots.push(signed);
    return signed;
  }

  getSignedRoots(): SignedMerkleRoot[] { return [...this.signedRoots]; }

  verifyIntegrity(publicKeyPem: string): { valid: boolean; expectedRoot: string | null; actualRoot: string | null } {
    const currentRoot = this.tree.getRoot();
    if (this.signedRoots.length === 0) return { valid: false, expectedRoot: null, actualRoot: currentRoot };
    const lastSigned = this.signedRoots[this.signedRoots.length - 1];
    if (!MerkleTree.verifySignedRoot(lastSigned, publicKeyPem)) return { valid: false, expectedRoot: lastSigned.root, actualRoot: currentRoot };
    if (lastSigned.root !== currentRoot) return { valid: false, expectedRoot: lastSigned.root, actualRoot: currentRoot };
    return { valid: true, expectedRoot: lastSigned.root, actualRoot: currentRoot };
  }

  getEntries(): AuditEntry[] { return this.tree.getLeaves(); }
}
