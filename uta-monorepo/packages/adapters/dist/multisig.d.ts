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
import { type Ed25519KeyPair } from '../core/crypto.js';
import type { ATCv3Credential } from './atc-v3.js';
export interface AdditionalSigner {
    /** Ed25519 key pair for this signer */
    keyPair: Ed25519KeyPair;
    /** Human-readable name (e.g., "Sentinel Audit CA") */
    signed_by: string;
}
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
export declare function appendSignatures(credential: ATCv3Credential, signers: AdditionalSigner[]): ATCv3Credential;
export interface MultiSigVerifyResult {
    valid: boolean;
    credential_id: string;
    signature_count: number;
    verified_count: number;
    /** Per-signature verification results */
    signatures: Array<{
        key_id: string;
        signed_by: string;
        valid: boolean;
        reason?: string;
    }>;
    /** Quorum check (if policy.min_signatures was set) */
    quorum_met?: boolean;
    /** Required signers check (if policy.required_key_ids was set) */
    required_signers_present?: boolean;
    issues: string[];
}
export interface MultiSigPolicy {
    /** Minimum number of valid signatures required (default 1) */
    min_signatures?: number;
    /** Required key_ids that MUST be present (any subset). If empty, no specific requirement. */
    required_key_ids?: string[];
    /** Whether to fail-closed if a signature's key_id is not in the trust registry.
     *  Default true. */
    fail_closed_unknown_keys?: boolean;
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
export declare function verifyMultiSig(credential: ATCv3Credential, keys: Map<string, string>, // key_id → public_key_pem
policy?: MultiSigPolicy): MultiSigVerifyResult;
export declare function issueMultiSigATCv3(credential: ATCv3Credential, primarySigner: AdditionalSigner, additionalSigners?: AdditionalSigner[]): ATCv3Credential;
