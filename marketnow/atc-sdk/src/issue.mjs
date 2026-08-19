/**
 * ATC/1.0 Card Issuance — sign an ATC envelope with a CA's private key
 *
 * Implements the ATC-006 signature process:
 *   1. Take the full ATC JSON document
 *   2. Set `attestation.signature = ""` AND `attestation.signed_payload_hash = ""`
 *   3. Apply RFC 8785 JCS to produce canonical bytes
 *   4. Compute SHA-256 of the canonical bytes → `signed_payload_hash`
 *   5. Sign the canonical bytes with the CA's Ed25519 private key → `signature`
 *
 * See: https://github.com/alicelabs-llc/marketnow/blob/master/docs/atc-spec/SPEC.md#atc-006--signature
 */

import { createHash } from 'node:crypto';
import canonicalize from 'canonicalize';
import { ATC_ALGORITHM, signMessage } from './keys.mjs';

export const ATC_SPEC_VERSION = 'ATC/1.0';
export const ATC_MAX_TTL_DAYS_DEFAULT = 90;

/**
 * Compute the canonical form of the ATC payload (with signature + hash blanked).
 *
 * @param {object} atc
 * @returns {string} — RFC 8785 JCS canonical JSON string
 */
export function canonicalizeATC(atc) {
  const payload = JSON.parse(JSON.stringify(atc));
  if (!payload.attestation) payload.attestation = {};
  payload.attestation.signature = '';
  payload.attestation.signed_payload_hash = '';
  const c = canonicalize(payload);
  if (!c) throw new Error('Canonicalization failed — likely a circular reference or non-serializable value');
  return c;
}

/**
 * Compute the SHA-256 hash of the canonical payload.
 *
 * @param {object} atc
 * @returns {string} — hex SHA-256
 */
export function computePayloadHash(atc) {
  return createHash('sha256').update(canonicalizeATC(atc)).digest('hex');
}

/**
 * Issue (sign) an Agent Trust Card.
 *
 * @param {object} caKeyPair — Output of `generateKeyPair()` or `loadKeyPairFromPrivate()`
 * @param {object} agentKeyPair — The agent's keypair (public key goes in the ATC)
 * @param {object} partialPayload — Card content (excluding auto-computed fields)
 * @returns {object} The complete, signed ATC document
 */
export function issueATC(caKeyPair, agentKeyPair, partialPayload) {
  const issuedAt = partialPayload.validity?.issued_at || new Date().toISOString();
  const maxTtlDays = partialPayload.validity?.max_ttl_days || ATC_MAX_TTL_DAYS_DEFAULT;
  const expiresAt = partialPayload.validity?.expires_at ||
    new Date(Date.parse(issuedAt) + maxTtlDays * 86400000).toISOString();

  const atc = {
    spec_version: ATC_SPEC_VERSION,
    card_id: partialPayload.card_id,
    issuer: {
      ca_id: partialPayload.issuer?.ca_id || 'alicelabs-sentinel-ca',
      ca_public_key: caKeyPair.publicKey,
      ca_algorithm: ATC_ALGORITHM,
      ca_url: partialPayload.issuer?.ca_url || 'https://marketnow.site/api/atc',
    },
    identity: partialPayload.identity,
    attestation: {
      subject_public_key: agentKeyPair.publicKey,
      subject_algorithm: ATC_ALGORITHM,
      signature: '',  // filled in after signing
      signed_payload_hash: '',  // filled in after hashing
    },
    capabilities: partialPayload.capabilities,
    evidence: partialPayload.evidence,
    risk: {
      ...partialPayload.risk,
      decision_authority: 'consumer',  // ATC/1.0 mandates this
    },
    revocation: partialPayload.revocation || {
      revocation_check_url: 'https://marketnow.site/api/atc?action=revocation-list',
      revocation_check_method: 'simple_json',
      revocation_check_required: true,
    },
    validity: {
      issued_at: issuedAt,
      expires_at: expiresAt,
      max_ttl_days: maxTtlDays,
    },
  };

  // Compute the canonical payload + hash
  const canonical = canonicalizeATC(atc);
  atc.attestation.signed_payload_hash = createHash('sha256').update(canonical).digest('hex');

  // Sign with the CA's private key
  atc.attestation.signature = signMessage(canonical, caKeyPair.rawPrivateKey);

  return atc;
}

/**
 * Re-sign an existing ATC (e.g. after editing a field).
 * Useful for test vectors and revocation list updates.
 *
 * @param {object} atc — the ATC to re-sign
 * @param {object} caKeyPair — the CA's keypair
 * @returns {object} the re-signed ATC
 */
export function resignATC(atc, caKeyPair) {
  const canonical = canonicalizeATC(atc);
  atc.attestation.signed_payload_hash = createHash('sha256').update(canonical).digest('hex');
  atc.attestation.signature = signMessage(canonical, caKeyPair.rawPrivateKey);
  return atc;
}
