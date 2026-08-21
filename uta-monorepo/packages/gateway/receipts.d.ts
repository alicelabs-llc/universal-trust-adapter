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
import { type Ed25519KeyPair } from '../core/crypto.js';
export interface ActionReceipt {
    receipt_id: string;
    decision: 'ALLOW' | 'DENY';
    agent_id: string;
    credential_id: string;
    tool_name: string;
    args_hash: string;
    trust_score: number;
    reason?: string;
    verification_stages?: Array<{
        name: string;
        result: string;
    }>;
    timestamp: string;
    gateway_version: string;
    evidence_hash: string;
    signature?: {
        algorithm: 'Ed25519 (RFC 8032)';
        value: string;
        domain: string;
        key_id: string;
        signed_at: string;
    };
}
export declare class ReceiptStore {
    private receipts;
    store(receipt: ActionReceipt): void;
    retrieve(receiptId: string): ActionReceipt | null;
    list(filter?: {
        agent_id?: string;
        decision?: string;
    }): ActionReceipt[];
    count(): number;
}
export declare class ReceiptGenerator {
    private store;
    private gatewayKeyPair;
    constructor(store: ReceiptStore, gatewayKeyPair?: Ed25519KeyPair);
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
        verification_stages?: Array<{
            name: string;
            result: string;
        }>;
    }): ActionReceipt;
    /**
     * Verify a signed action receipt.
     */
    verify(receipt: ActionReceipt, publicKeyPem: string): boolean;
}
