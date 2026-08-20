/**
 * @marketnow/gateway
 * P1-5: Action Receipts — Signed audit trail
 * P1-6: JCS args_hash (not JSON.stringify)
 *
 * Every ALLOW/DENY decision produces a signed receipt.
 * The receipt is stored and can be verified by any third party.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */

import crypto from 'node:crypto';
import { canonicalize, canonicalHash, sign as ed25519Sign, verify as ed25519Verify, DOMAINS, type Ed25519KeyPair } from '../core/crypto.js';

// ============================================================================
// Action Receipt
// ============================================================================

export interface ActionReceipt {
  receipt_id: string;
  decision: 'ALLOW' | 'DENY';
  agent_id: string;
  credential_id: string;
  tool_name: string;
  args_hash: string; // JCS(args) → SHA-256 (NOT JSON.stringify)
  trust_score: number;
  reason?: string;
  verification_stages?: Array<{ name: string; result: string }>;
  timestamp: string;
  gateway_version: string;
  evidence_hash: string; // tamper-evident hash of the receipt
  signature?: {
    algorithm: 'Ed25519 (RFC 8032)';
    value: string;
    domain: string;
    key_id: string;
    signed_at: string;
  };
}

// ============================================================================
// Receipt Store (in-memory; production uses Redis/Supabase)
// ============================================================================

export class ReceiptStore {
  private receipts = new Map<string, ActionReceipt>();

  store(receipt: ActionReceipt): void {
    this.receipts.set(receipt.receipt_id, receipt);
  }

  retrieve(receiptId: string): ActionReceipt | null {
    return this.receipts.get(receiptId) || null;
  }

  list(filter?: { agent_id?: string; decision?: string }): ActionReceipt[] {
    let results = Array.from(this.receipts.values());
    if (filter?.agent_id) {
      results = results.filter(r => r.agent_id === filter.agent_id);
    }
    if (filter?.decision) {
      results = results.filter(r => r.decision === filter.decision);
    }
    return results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  count(): number {
    return this.receipts.size;
  }
}

// ============================================================================
// Receipt Generator
// ============================================================================

export class ReceiptGenerator {
  private store: ReceiptStore;
  private gatewayKeyPair: Ed25519KeyPair | null;

  constructor(store: ReceiptStore, gatewayKeyPair?: Ed25519KeyPair) {
    this.store = store;
    this.gatewayKeyPair = gatewayKeyPair || null;
  }

  /**
   * Generate a signed action receipt.
   * Uses JCS for args_hash (NOT JSON.stringify).
   */
  generate(params: {
    decision: 'ALLOW' | 'DENY';
    agent_id: string;
    credential_id: string;
    tool_name: string;
    args: Record<string, unknown>;
    trust_score: number;
    reason?: string;
    verification_stages?: Array<{ name: string; result: string }>;
  }): ActionReceipt {
    const timestamp = new Date().toISOString();

    // P1-6: Use JCS for args_hash (not JSON.stringify)
    // This ensures deterministic hashing regardless of key order
    const argsCanonical = canonicalize(params.args);
    const argsHash = `sha256:${canonicalHash(argsCanonical)}`;

    const receiptId = `rcpt_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    // Build the receipt (without signature)
    const receipt: Omit<ActionReceipt, 'signature'> = {
      receipt_id: receiptId,
      decision: params.decision,
      agent_id: params.agent_id,
      credential_id: params.credential_id,
      tool_name: params.tool_name,
      args_hash: argsHash,
      trust_score: params.trust_score,
      reason: params.reason,
      verification_stages: params.verification_stages,
      timestamp,
      gateway_version: '1.0.0',
      evidence_hash: '', // computed below
    };

    // Compute evidence_hash = SHA-256(JCS(receipt_without_signature_and_evidence_hash))
    const receiptForHash = { ...receipt };
    receiptForHash.evidence_hash = ''; // exclude self-reference
    const receiptCanonical = canonicalize(receiptForHash);
    receipt.evidence_hash = `sha256:${canonicalHash(receiptCanonical)}`;

    // Sign the receipt if we have a gateway key pair
    let signedReceipt: ActionReceipt;
    if (this.gatewayKeyPair) {
      const signatureValue = ed25519Sign(
        receipt,
        this.gatewayKeyPair.privateKeyPem,
        DOMAINS.TRUST_DECISION
      );

      signedReceipt = {
        ...receipt,
        signature: {
          algorithm: 'Ed25519 (RFC 8032)',
          value: signatureValue,
          domain: DOMAINS.TRUST_DECISION,
          key_id: this.gatewayKeyPair.keyId,
          signed_at: timestamp,
        },
      };
    } else {
      signedReceipt = { ...receipt };
    }

    // Store the receipt
    this.store.store(signedReceipt);

    return signedReceipt;
  }

  /**
   * Verify a signed action receipt.
   */
  verify(receipt: ActionReceipt, publicKeyPem: string): boolean {
    if (!receipt.signature) return false;

    // 1. Verify evidence_hash
    const receiptForHash = { ...receipt };
    receiptForHash.signature = undefined;
    receiptForHash.evidence_hash = '';
    const expectedHash = `sha256:${canonicalHash(canonicalize(receiptForHash))}`;
    if (receipt.evidence_hash !== expectedHash) {
      return false;
    }

    // 2. Verify Ed25519 signature
    const { signature: _sig, ...receiptWithoutSig } = receipt;
    return ed25519Verify(
      receiptWithoutSig,
      receipt.signature.value,
      publicKeyPem,
      DOMAINS.TRUST_DECISION
    );
  }
}
