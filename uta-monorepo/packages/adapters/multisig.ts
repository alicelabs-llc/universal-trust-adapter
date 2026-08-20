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

import crypto from 'node:crypto';
import {
  canonicalize,
  canonicalHash,
  sign as ed25519Sign,
  verify as ed25519Verify,
  DOMAINS,
  type Ed25519KeyPair,
} from '../core/crypto.js';
import type { ATCv3Credential, ATCSignature } from './atc-v3.js';

// ============================================================================
// Multi-signature issuance
// ============================================================================

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
export function appendSignatures(
  credential: ATCv3Credential,
  signers: AdditionalSigner[]
): ATCv3Credential {
  // Build the payload (everything except signatures)
  const { signatures: _existingSigs, ...payload } = credential;
  const canonical = canonicalize(payload);

  const newSignatures: ATCSignature[] = signers.map(signer => {
    const signatureValue = ed25519Sign(
      payload,
      signer.keyPair.privateKeyPem,
      DOMAINS.ATC_V3_CREDENTIAL
    );
    const evidenceHash = `sha256:${crypto.createHash('sha256').update(canonical + signatureValue, 'utf-8').digest('hex')}`;
    return {
      algorithm: 'Ed25519 (RFC 8032)',
      value: signatureValue,
      signed_by: signer.signed_by,
      signed_at: new Date().toISOString(),
      domain: DOMAINS.ATC_V3_CREDENTIAL,
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

// ============================================================================
// Multi-signature verification
// ============================================================================

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
export function verifyMultiSig(
  credential: ATCv3Credential,
  keys: Map<string, string>, // key_id → public_key_pem
  policy: MultiSigPolicy = {}
): MultiSigVerifyResult {
  const issues: string[] = [];
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
  const canonical = canonicalize(payload);

  const sigResults: MultiSigVerifyResult['signatures'] = [];
  let verifiedCount = 0;
  const presentKeyIds = new Set<string>();

  for (const sig of credential.signatures) {
    const sigResult: MultiSigVerifyResult['signatures'][0] = {
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
    if (sig.domain !== DOMAINS.ATC_V3_CREDENTIAL) {
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
    const signatureValid = ed25519Verify(payload, sig.value, publicKeyPem, DOMAINS.ATC_V3_CREDENTIAL);
    if (!signatureValid) {
      sigResult.reason = 'Ed25519 signature verification failed';
      sigResults.push(sigResult);
      continue;
    }

    // 5. Verify evidence_hash
    const expectedEvidenceHash = `sha256:${crypto.createHash('sha256').update(canonical + sig.value, 'utf-8').digest('hex')}`;
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

export function issueMultiSigATCv3(
  credential: ATCv3Credential,
  primarySigner: AdditionalSigner,
  additionalSigners: AdditionalSigner[] = []
): ATCv3Credential {
  // Remove existing signatures
  const { signatures: _drop, ...payload } = credential;
  const canonical = canonicalize(payload);

  const allSigners = [primarySigner, ...additionalSigners];
  const signatures: ATCSignature[] = allSigners.map(signer => {
    const signatureValue = ed25519Sign(payload, signer.keyPair.privateKeyPem, DOMAINS.ATC_V3_CREDENTIAL);
    const evidenceHash = `sha256:${crypto.createHash('sha256').update(canonical + signatureValue, 'utf-8').digest('hex')}`;
    return {
      algorithm: 'Ed25519 (RFC 8032)',
      value: signatureValue,
      signed_by: signer.signed_by,
      signed_at: new Date().toISOString(),
      domain: DOMAINS.ATC_V3_CREDENTIAL,
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
