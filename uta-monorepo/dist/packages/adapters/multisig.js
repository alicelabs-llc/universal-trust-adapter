"use strict";
/**
 * P3-6: Multi-signature support for ATC v3.
 *
 * ATC v3 already supports a `signatures[]` array in the credential structure,
 * but issueATCv3() only adds one signature (from a single CA). This module
 * adds:
 *
 *   1. appendSignature(): add a signature from a second CA to an existing
 *      credential. Useful for "joint attestation" — e.g., a sentinel audit
 *      CA + an issuer CA both sign the same credential.
 *
 *   2. verifyMultiSig(): verify ALL signatures in signatures[]. The caller
 *      provides a map from key_id → public_key_pem. Every signature must
 *      verify with the key it claims to be from. Optional policy: require
 *      a minimum number of signatures (quorum) or require specific key_ids.
 *
 *   3. ATCv3MultiSigPolicy: a policy object that defines which signers
 *      are required for a credential to be considered valid.
 *
 * The signatures are over the SAME payload (everything except signatures[]).
 * Each signature includes its own key_id, signed_at, and signed_by.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendSignatures = appendSignatures;
exports.verifyMultiSig = verifyMultiSig;
exports.issueMultiSigATCv3 = issueMultiSigATCv3;
const node_crypto_1 = __importDefault(require("node:crypto"));
const crypto_js_1 = require("../core/crypto.js");
/**
 * Append one or more additional signatures to an existing ATC v3 credential.
 *
 * The signatures are computed over the credential payload WITHOUT the
 * signatures[] field — same as the primary signature. So all signatures
 * (primary + additional) verify against the same payload.
 *
 * Each additional signature includes:
 *   - its own key_id (derived from the signer's public key)
 *   - signed_by (human-readable name)
 *   - signed_at (ISO timestamp)
 *   - domain (UTA-ATC-V3-CREDENTIAL — same as primary)
 *   - evidence_hash (SHA-256 of canonical + signature)
 *
 * The credential's signatures[] array is extended in place.
 */
function appendSignatures(credential, signers) {
    // Build the payload (everything except signatures)
    const { signatures: _existingSigs, ...payload } = credential;
    const canonical = (0, crypto_js_1.canonicalize)(payload);
    const newSignatures = signers.map(signer => {
        const signatureValue = (0, crypto_js_1.sign)(payload, signer.keyPair.privateKeyPem, crypto_js_1.DOMAINS.ATC_V3_CREDENTIAL);
        const evidenceHash = `sha256:${node_crypto_1.default.createHash('sha256').update(canonical + signatureValue, 'utf-8').digest('hex')}`;
        return {
            algorithm: 'Ed25519 (RFC 8032)',
            value: signatureValue,
            signed_by: signer.signed_by,
            signed_at: new Date().toISOString(),
            domain: crypto_js_1.DOMAINS.ATC_V3_CREDENTIAL,
            key_id: signer.keyPair.keyId,
            canonicalization: 'RFC_8785_JCS',
            evidence_hash: evidenceHash,
        };
    });
    return {
        ...credential,
        signatures: [...(credential.signatures || []), ...newSignatures],
    };
}
/**
 * Verify all signatures on an ATC v3 credential.
 *
 * For each signature in signatures[]:
 *   1. Look up the public key by key_id in the provided `keys` map
 *   2. Verify the Ed25519 signature over the payload (credential WITHOUT signatures[])
 *   3. Verify the evidence_hash matches SHA-256(canonical + signature)
 *
 * Returns a per-signature result + aggregate verdict.
 */
function verifyMultiSig(credential, keys, // key_id → public_key_pem
policy = {}) {
    const issues = [];
    const minSignatures = policy.min_signatures ?? 1;
    const requiredKeyIds = policy.required_key_ids || [];
    const failClosedUnknown = policy.fail_closed_unknown_keys ?? true;
    if (!credential.signatures || credential.signatures.length === 0) {
        return {
            valid: false,
            credential_id: credential.credential_id || 'unknown',
            signature_count: 0,
            verified_count: 0,
            signatures: [],
            issues: ['no signatures found'],
        };
    }
    // Build the payload (everything except signatures)
    const { signatures, ...payload } = credential;
    const canonical = (0, crypto_js_1.canonicalize)(payload);
    const sigResults = [];
    let verifiedCount = 0;
    const presentKeyIds = new Set();
    for (const sig of credential.signatures) {
        const sigResult = {
            key_id: sig.key_id,
            signed_by: sig.signed_by,
            valid: false,
        };
        // 1. Check signature format
        if (!sig.value || sig.value.length !== 128 || !/^[0-9a-f]+$/i.test(sig.value)) {
            sigResult.reason = `malformed signature: ${sig.value?.length || 0} chars (expected 128 hex)`;
            sigResults.push(sigResult);
            continue;
        }
        // 2. Check domain
        if (sig.domain !== crypto_js_1.DOMAINS.ATC_V3_CREDENTIAL) {
            sigResult.reason = `wrong domain: ${sig.domain}`;
            sigResults.push(sigResult);
            continue;
        }
        // 3. Look up the public key
        const publicKeyPem = keys.get(sig.key_id);
        if (!publicKeyPem) {
            sigResult.reason = `key_id ${sig.key_id} not in trust registry`;
            if (failClosedUnknown) {
                issues.push(`unknown key_id: ${sig.key_id} (signed_by: ${sig.signed_by})`);
            }
            sigResults.push(sigResult);
            continue;
        }
        // 4. Verify Ed25519 signature
        const signatureValid = (0, crypto_js_1.verify)(payload, sig.value, publicKeyPem, crypto_js_1.DOMAINS.ATC_V3_CREDENTIAL);
        if (!signatureValid) {
            sigResult.reason = 'Ed25519 signature verification failed';
            sigResults.push(sigResult);
            continue;
        }
        // 5. Verify evidence_hash
        const expectedEvidenceHash = `sha256:${node_crypto_1.default.createHash('sha256').update(canonical + sig.value, 'utf-8').digest('hex')}`;
        if (sig.evidence_hash !== expectedEvidenceHash) {
            sigResult.reason = `evidence_hash mismatch`;
            sigResults.push(sigResult);
            continue;
        }
        sigResult.valid = true;
        verifiedCount++;
        presentKeyIds.add(sig.key_id);
        sigResults.push(sigResult);
    }
    // Quorum check
    const quorumMet = verifiedCount >= minSignatures;
    if (!quorumMet) {
        issues.push(`quorum not met: ${verifiedCount}/${minSignatures} signatures required`);
    }
    // Required signers check
    let requiredSignersPresent = true;
    if (requiredKeyIds.length > 0) {
        for (const requiredId of requiredKeyIds) {
            if (!presentKeyIds.has(requiredId)) {
                requiredSignersPresent = false;
                issues.push(`required signer missing: ${requiredId}`);
            }
        }
    }
    return {
        valid: issues.length === 0 && quorumMet && requiredSignersPresent,
        credential_id: credential.credential_id,
        signature_count: credential.signatures.length,
        verified_count: verifiedCount,
        signatures: sigResults,
        quorum_met: quorumMet,
        required_signers_present: requiredSignersPresent,
        issues,
    };
}
// ============================================================================
// Convenience: issue a multi-sig credential from scratch
// ============================================================================
function issueMultiSigATCv3(credential, primarySigner, additionalSigners = []) {
    // Remove existing signatures
    const { signatures: _drop, ...payload } = credential;
    const canonical = (0, crypto_js_1.canonicalize)(payload);
    const allSigners = [primarySigner, ...additionalSigners];
    const signatures = allSigners.map(signer => {
        const signatureValue = (0, crypto_js_1.sign)(payload, signer.keyPair.privateKeyPem, crypto_js_1.DOMAINS.ATC_V3_CREDENTIAL);
        const evidenceHash = `sha256:${node_crypto_1.default.createHash('sha256').update(canonical + signatureValue, 'utf-8').digest('hex')}`;
        return {
            algorithm: 'Ed25519 (RFC 8032)',
            value: signatureValue,
            signed_by: signer.signed_by,
            signed_at: new Date().toISOString(),
            domain: crypto_js_1.DOMAINS.ATC_V3_CREDENTIAL,
            key_id: signer.keyPair.keyId,
            canonicalization: 'RFC_8785_JCS',
            evidence_hash: evidenceHash,
        };
    });
    return {
        ...credential,
        signatures,
    };
}
