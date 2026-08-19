/**
 * ATC/1.0 Reference Implementation — Node.js
 *
 * This file is the canonical reference implementation of ATC/1.0.
 * Conformance test vectors are generated from this implementation.
 *
 * Dependencies:
 *   - Node.js >= 18 (built-in crypto for Ed25519 + SHA-256)
 *   - npm install canonicalize (RFC 8785 JCS implementation)
 *
 * Public API:
 *   - generateCAKeyPair()                 → { publicKey, privateKey, rawPublicKey, rawPrivateKey }
 *   - generateAgentKeyPair()              → { publicKey, privateKey, rawPublicKey, rawPrivateKey }
 *   - issueATC(caKeyPair, agentKeyPair, payload)
 *                                         → atc (signed)
 *   - verifyATC(atc, caPublicKeyBase64)   → { valid, errors }
 *   - canonicalizeATC(atc)                → canonical bytes
 *
 * Usage:
 *   See test-vectors/generate.mjs for end-to-end example.
 */

import {
  generateKeyPairSync,
  sign,
  verify,
  createPublicKey,
  createPrivateKey,
  createHash,
} from 'node:crypto';
import canonicalize from 'canonicalize';

// ─── ATC/1.0 constants ──────────────────────────────────────────────────────
export const ATC_SPEC_VERSION = 'ATC/1.0';
export const ATC_ALGORITHM = 'Ed25519';
export const ATC_MAX_TTL_DAYS_DEFAULT = 90;

// Ed25519 public key in DER/SPKI format starts with this 12-byte prefix.
// We store the full SPKI bytes in base64 so createPublicKey can decode it.
// (SPKI for Ed25519 is always 44 bytes total: 12-byte prefix + 32-byte key)
const ED25519_SPKI_PREFIX_HEX = '302a300506032b6570032100';

// ─── Key pair generation ────────────────────────────────────────────────────
// Returns the full SPKI base64 (44 chars) for public key, and PKCS8 base64 for private.
export function generateCAKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    // Full SPKI in base64 (44 chars for Ed25519)
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    // Full PKCS8 in base64 (48 chars for Ed25519)
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
    // Keep the KeyObject for signing inside this session
    rawPublicKey: publicKey,
    rawPrivateKey: privateKey,
  };
}

export function generateAgentKeyPair() {
  return generateCAKeyPair(); // Same algorithm
}

// ─── Helper: reconstruct a KeyObject from a base64 SPKI string ──────────────
function keyFromBase64(base64, isPublic) {
  const buf = Buffer.from(base64, 'base64');
  if (isPublic) {
    return createPublicKey({ key: buf, format: 'der', type: 'spki' });
  }
  return createPrivateKey({ key: buf, format: 'der', type: 'pkcs8' });
}

// ─── RFC 8785 JCS canonicalization ──────────────────────────────────────────
export function canonicalizeATC(atc) {
  const c = canonicalize(atc);
  if (!c) throw new Error('Canonicalization failed — likely a circular reference');
  return c;
}

// ─── Compute the signature payload ──────────────────────────────────────────
// Per ATC-006:
//   1. Take the full ATC JSON document
//   2. Set `attestation.signature = ""` AND `attestation.signed_payload_hash = ""`
//      (Both fields are part of the attestation envelope, NOT the signed payload.
//       The signed_payload_hash is computed FROM the payload, so it cannot be part
//       of the payload it hashes — classic chicken-and-egg.)
//   3. Apply RFC 8785 JCS
//   4. Compute SHA-256
export function computeSignaturePayload(atc) {
  const payload = JSON.parse(JSON.stringify(atc));
  if (!payload.attestation) payload.attestation = {};
  payload.attestation.signature = '';
  payload.attestation.signed_payload_hash = '';
  return canonicalizeATC(payload);
}

export function computePayloadHash(atc) {
  const canonical = computeSignaturePayload(atc);
  return createHash('sha256').update(canonical).digest('hex');
}

// ─── Issue an ATC ───────────────────────────────────────────────────────────
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
      signature: '',  // placeholder — filled in after signing
      signed_payload_hash: '',
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

  // Compute the canonical payload (with signature set to '')
  const canonical = computeSignaturePayload(atc);
  atc.attestation.signed_payload_hash = createHash('sha256').update(canonical).digest('hex');

  // Sign the canonical payload with the CA's private key
  const signature = sign(null, Buffer.from(canonical, 'utf8'), caKeyPair.rawPrivateKey);
  atc.attestation.signature = signature.toString('base64');

  return atc;
}

// ─── Verify an ATC ───────────────────────────────────────────────────────────
export function verifyATC(atc, caPublicKeyBase64) {
  const errors = [];

  // 1. Check spec_version
  if (atc.spec_version !== ATC_SPEC_VERSION) {
    errors.push(`Invalid spec_version: expected ${ATC_SPEC_VERSION}, got ${atc.spec_version}`);
  }

  // 2. Check signature presence
  if (!atc.attestation?.signature) {
    errors.push('Missing attestation.signature');
    return { valid: false, errors };
  }

  // 3. Check that the issuer's CA public key matches the one we were given
  if (atc.issuer.ca_public_key !== caPublicKeyBase64) {
    errors.push(`CA public key mismatch — issuer says ${atc.issuer.ca_public_key?.slice(0, 16)}..., verifier was given ${caPublicKeyBase64?.slice(0, 16)}...`);
  }

  // 4. Compute the canonical payload (with signature set to '')
  const signature = atc.attestation.signature;
  const canonical = computeSignaturePayload(atc);

  // 5. Verify the hash matches
  const computedHash = createHash('sha256').update(canonical).digest('hex');
  if (computedHash !== atc.attestation.signed_payload_hash) {
    errors.push(`signed_payload_hash mismatch — expected ${computedHash}, got ${atc.attestation.signed_payload_hash}`);
  }

  // 6. Verify the signature
  let signatureValid = false;
  try {
    const caPublicKey = keyFromBase64(caPublicKeyBase64, true);
    signatureValid = verify(
      null,
      Buffer.from(canonical, 'utf8'),
      caPublicKey,
      Buffer.from(signature, 'base64')
    );
  } catch (err) {
    errors.push(`Signature verification threw: ${err.message}`);
  }

  if (!signatureValid) {
    errors.push('Ed25519 signature verification failed');
  }

  // 7. Check validity window
  const now = Date.now();
  const issued = Date.parse(atc.validity?.issued_at);
  const expires = Date.parse(atc.validity?.expires_at);

  if (isNaN(issued)) errors.push('Invalid validity.issued_at');
  if (isNaN(expires)) errors.push('Invalid validity.expires_at');
  if (issued && now < issued - 5 * 60 * 1000) errors.push('ATC issued in the future (clock skew > 5min)');
  if (expires && now > expires + 5 * 60 * 1000) errors.push('ATC expired (clock skew > 5min)');

  return { valid: errors.length === 0, errors };
}

// ─── Detect tampering ───────────────────────────────────────────────────────
// Returns true if the ATC's signature no longer matches its payload.
// (verifyATC already does this — this is a convenience wrapper.)
export function detectTampering(atc, caPublicKeyBase64) {
  const result = verifyATC(atc, caPublicKeyBase64);
  return !result.valid;
}
