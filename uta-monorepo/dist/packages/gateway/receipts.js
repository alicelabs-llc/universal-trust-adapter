"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceiptGenerator = exports.ReceiptStore = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const crypto_js_1 = require("../core/crypto.js");
// ============================================================================
// Receipt Store (in-memory; production uses Redis/Supabase)
// ============================================================================
class ReceiptStore {
    receipts = new Map();
    store(receipt) {
        this.receipts.set(receipt.receipt_id, receipt);
    }
    retrieve(receiptId) {
        return this.receipts.get(receiptId) || null;
    }
    list(filter) {
        let results = Array.from(this.receipts.values());
        if (filter?.agent_id) {
            results = results.filter(r => r.agent_id === filter.agent_id);
        }
        if (filter?.decision) {
            results = results.filter(r => r.decision === filter.decision);
        }
        return results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }
    count() {
        return this.receipts.size;
    }
}
exports.ReceiptStore = ReceiptStore;
// ============================================================================
// Receipt Generator
// ============================================================================
class ReceiptGenerator {
    store;
    gatewayKeyPair;
    constructor(store, gatewayKeyPair) {
        this.store = store;
        this.gatewayKeyPair = gatewayKeyPair || null;
    }
    /**
     * Generate a signed action receipt.
     * Uses JCS for args_hash (NOT JSON.stringify).
     */
    generate(params) {
        const timestamp = new Date().toISOString();
        // P1-6: Use JCS for args_hash (not JSON.stringify)
        // This ensures deterministic hashing regardless of key order
        const argsHash = `sha256:${(0, crypto_js_1.canonicalHash)(params.args)}`; // canonicalHash canonicalizes internally
        const receiptId = `rcpt_${node_crypto_1.default.randomUUID().replace(/-/g, '').slice(0, 16)}`;
        // Build the receipt (without signature)
        const receipt = {
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
        // Compute evidence_hash = SHA-256(canonicalize(receipt_without_signature_with_evidence_hash_empty))
        const receiptForHash = { ...receipt };
        receiptForHash.evidence_hash = ''; // exclude self-reference
        receipt.evidence_hash = `sha256:${(0, crypto_js_1.canonicalHash)(receiptForHash)}`; // canonicalHash canonicalizes internally
        // Sign the receipt if we have a gateway key pair
        let signedReceipt;
        if (this.gatewayKeyPair) {
            const signatureValue = (0, crypto_js_1.sign)(receipt, this.gatewayKeyPair.privateKeyPem, crypto_js_1.DOMAINS.TRUST_DECISION);
            signedReceipt = {
                ...receipt,
                signature: {
                    algorithm: 'Ed25519 (RFC 8032)',
                    value: signatureValue,
                    domain: crypto_js_1.DOMAINS.TRUST_DECISION,
                    key_id: this.gatewayKeyPair.keyId,
                    signed_at: timestamp,
                },
            };
        }
        else {
            signedReceipt = { ...receipt };
        }
        // Store the receipt
        this.store.store(signedReceipt);
        return signedReceipt;
    }
    /**
     * Verify a signed action receipt.
     */
    verify(receipt, publicKeyPem) {
        if (!receipt.signature)
            return false;
        // 1. Verify evidence_hash
        const receiptForHash = { ...receipt };
        receiptForHash.signature = undefined;
        receiptForHash.evidence_hash = '';
        const expectedHash = `sha256:${(0, crypto_js_1.canonicalHash)(receiptForHash)}`; // canonicalHash canonicalizes internally
        if (receipt.evidence_hash !== expectedHash) {
            return false;
        }
        // 2. Verify Ed25519 signature
        const { signature: _sig, ...receiptWithoutSig } = receipt;
        return (0, crypto_js_1.verify)(receiptWithoutSig, receipt.signature.value, publicKeyPem, crypto_js_1.DOMAINS.TRUST_DECISION);
    }
}
exports.ReceiptGenerator = ReceiptGenerator;
