/**
 * @marketnow/trust-audit
 * P8-2: Tamper-evident audit log using Merkle trees.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
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
    path: Array<{
        hash: string;
        direction: 'left' | 'right';
    }>;
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
export declare class MerkleTree {
    private leaves;
    private root;
    add(entry: Omit<AuditEntry, 'sequence'>): AuditEntry;
    private rebuild;
    getRoot(): string | null;
    size(): number;
    getLeaves(): AuditEntry[];
    getProof(leafIndex: number): MerkleProof | null;
    static verifyProof(proof: MerkleProof): boolean;
    signRoot(keyPair: Ed25519KeyPair): SignedMerkleRoot;
    static verifySignedRoot(signedRoot: SignedMerkleRoot, publicKeyPem: string): boolean;
    private hashEntry;
    static hashPair(left: string, right: string): string;
}
export declare class AuditLog {
    private tree;
    private signedRoots;
    constructor();
    add(receipt: {
        receipt_id: string;
        [key: string]: unknown;
    }): AuditEntry;
    getRoot(): string | null;
    size(): number;
    getProof(receiptId: string): MerkleProof | null;
    verifyReceipt(receiptId: string): {
        included: boolean;
        proof?: MerkleProof;
    };
    publishRoot(keyPair: Ed25519KeyPair): SignedMerkleRoot;
    getSignedRoots(): SignedMerkleRoot[];
    verifyIntegrity(publicKeyPem: string): {
        valid: boolean;
        expectedRoot: string | null;
        actualRoot: string | null;
    };
    getEntries(): AuditEntry[];
}
