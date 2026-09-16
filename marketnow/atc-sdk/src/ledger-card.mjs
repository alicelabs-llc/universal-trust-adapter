/**
 * ATC/3.0-core (Unified Credential Profile) — production ledger-card verifier.
 *
 * NEW in agent-trust-card v1.2.0 — closes the audit-63 fragmentation finding:
 * the real production cards in the MarketNow ledger ({card_id, status, payload
 * (schema_version 1.1.0), signature}) were verifiable only by the hosted
 * /api/atc endpoint. This module gives the SDK — and the `atc verify` CLI —
 * the same verification, offline, with the CA key registry embedded
 * (rotation-aware, fail-closed on unknown/compromised keys).
 *
 * Spec: https://marketnow.site/atc/unified (SPEC-1.4-UVP.md)
 */

import {
  createPublicKey,
  createHash,
  verify as edVerify,
} from 'node:crypto';
import canonicalize from 'canonicalize';

// MarketNow CA key registry (public keys only — never private material).
const MN_CA_KEY_REGISTRY = {
  'ca-key-001': { spki_b64: 'MCowBQYDK2VwAyEA8p1XlAnt5QRCGbyDRi8+U9MCvt8Xyzq36Rar45JHszM=', status: 'retired' },
  'mn-ca-002': { spki_b64: 'MCowBQYDK2VwAyEATlD16v6Fy/+GM4je2SxwCz7yFEeo9d8LwqZf0yN8oFY=', status: 'retired-compromised' },
  'mn-ca-003': { spki_b64: 'MCowBQYDK2VwAyEAUWJgyMWp9oKIGwN9EG8ayz/mYYp1lcQBI58rtpOs8CM=', status: 'active' },
};

const ATC30_CANON_OK = new Set([
  'RFC_8785_JCS',
  'RFC 8785 JCS',
  'RFC 8785 JCS (JSON Canonicalization Scheme)',
]);

/**
 * Structural detection of a production ledger envelope (ATC/3.0-core).
 * Used by verifyATCSync()/verifyATC() auto-dispatch and the CLI.
 *
 * @param {object} doc
 * @returns {boolean}
 */
export function isLedgerCard(doc) {
  return !!(
    doc &&
    typeof doc === 'object' &&
    !Array.isArray(doc) &&
    typeof doc.card_id === 'string' &&
    doc.payload &&
    typeof doc.payload === 'object' &&
    doc.signature &&
    typeof doc.signature === 'object' &&
    typeof doc.payload.schema_version === 'string' &&
    doc.payload.schema_version.startsWith('1.')
  );
}

/**
 * Verify a production ledger card (ATC/3.0-core envelope) — real Ed25519,
 * registry-aware trust anchors, fail-closed.
 *
 * @param {object} card — {card_id, status, payload, signature}
 * @param {object} [options]
 * @param {string} [options.ca_public_key] — caller-supplied trust anchor override
 *   (PEM or base64 SPKI). When omitted, the MarketNow CA registry is used.
 * @returns {object} structured result
 */
export function verifyLedgerCard(card, options = {}) {
  const errors = [];
  const warnings = [];
  const controls_passed = [];
  const controls_failed = [];
  const fail = (c, m) => { controls_failed.push(c); errors.push(m); };

  if (!isLedgerCard(card)) {
    return {
      valid: false,
      format: 'ATC/3.0-core',
      errors: ['not a production ledger envelope — expected {card_id, status, payload (schema_version 1.x), signature}'],
      warnings,
      controls_passed: [],
      controls_failed: ['ATC30-ENVELOPE'],
      card_id: card && card.card_id ? card.card_id : null,
    };
  }
  controls_passed.push('ATC30-ENVELOPE');

  const p = card.payload;
  const sig = card.signature;

  // Payload structure
  if (p.card_id !== card.card_id) {
    fail('ATC30-PAYLOAD', `card_id mismatch: envelope "${card.card_id}" vs payload "${p.card_id}"`);
  } else if (!p.metadata || !p.metadata.issued_at || !p.metadata.expires_at) {
    fail('ATC30-PAYLOAD', 'payload.metadata.{issued_at,expires_at} required');
  } else if (!p.agent_id) {
    fail('ATC30-PAYLOAD', 'payload.agent_id required');
  } else {
    controls_passed.push('ATC30-PAYLOAD');
  }

  // Canonicalization documentation
  const canonDoc = sig.canonicalization_method || sig.canonical_json || '';
  if (canonDoc && !ATC30_CANON_OK.has(String(canonDoc).trim())) {
    fail('ATC30-CANON', `unsupported documented canonicalization: ${canonDoc}`);
  } else {
    if (!canonDoc) warnings.push('no canonicalization field — assuming RFC 8785 JCS');
    controls_passed.push('ATC30-CANON');
  }

  // Lifecycle
  if (card.status && card.status !== 'active') {
    fail('ATC30-LIFECYCLE', `card status is ${card.status} (revocation path — check the CRL/OCSP)`);
  } else if (p.metadata?.expires_at && Date.parse(p.metadata.expires_at) < Date.now()) {
    fail('ATC30-LIFECYCLE', `card expired at ${p.metadata.expires_at}`);
  } else {
    controls_passed.push('ATC30-LIFECYCLE');
  }

  // Crypto: JCS(payload) → sha256 pre-check → Ed25519 against resolved anchor
  let hash_valid = null;
  let signature_valid = null;
  let trust_anchor = null;
  let canonical_sha256 = null;
  try {
    const canonical = canonicalize(p);
    if (typeof canonical !== 'string') throw new Error('canonicalize failed');
    const canonicalBytes = Buffer.from(canonical, 'utf8');
    canonical_sha256 = createHash('sha256').update(canonicalBytes).digest('hex');

    if (sig.signed_payload_hash) {
      hash_valid = canonical_sha256 === sig.signed_payload_hash;
      if (hash_valid) controls_passed.push('ATC30-HASH');
      else fail('ATC30-HASH', 'sha256(canonical payload) does not match signature.signed_payload_hash');
    } else {
      warnings.push('signed_payload_hash absent — hash pre-check skipped');
    }

    let anchorPub = null;
    if (options.ca_public_key && typeof options.ca_public_key === 'string') {
      anchorPub = options.ca_public_key.includes('BEGIN')
        ? createPublicKey({ key: options.ca_public_key, format: 'pem' })
        : createPublicKey({ key: Buffer.from(options.ca_public_key, 'base64'), format: 'der', type: 'spki' });
      trust_anchor = 'caller-supplied';
    } else {
      const claimed = sig.ca_key_id || 'mn-ca-003';
      const entry = MN_CA_KEY_REGISTRY[claimed];
      if (!entry) {
        fail('ATC30-ANCHOR', `unknown CA key id "${claimed}" — resolve against GET /api/atc?action=ca-key (fail-closed)`);
      } else if (entry.status === 'retired-compromised') {
        fail('ATC30-ANCHOR', `signature claims CA key ${claimed}, which is retired-compromised — DO NOT verify against it`);
      } else {
        if (entry.status === 'retired') warnings.push(`CA key ${claimed} is retired (routine rotation) — signature verifies as historical evidence`);
        anchorPub = createPublicKey({ key: Buffer.from(entry.spki_b64, 'base64'), format: 'der', type: 'spki' });
        trust_anchor = claimed;
      }
    }

    if (anchorPub) {
      const sigHex = String(sig.value || '');
      if (!/^[0-9a-f]{128}$/.test(sigHex)) {
        fail('ATC30-SIGNATURE', 'signature.value must be 64 bytes as 128 hex chars');
      } else {
        signature_valid = edVerify(null, canonicalBytes, anchorPub, Buffer.from(sigHex, 'hex'));
        if (signature_valid) controls_passed.push('ATC30-SIGNATURE');
        else fail('ATC30-SIGNATURE', `Ed25519 signature verification failed against ${trust_anchor}`);
      }
    }
  } catch (e) {
    fail('ATC30-CRYPTO', `verification error: ${String(e && e.message ? e.message : e)}`);
  }

  controls_passed.sort();
  controls_failed.sort();

  return {
    valid: errors.length === 0,
    format: 'ATC/3.0-core (production ledger envelope)',
    spec_version: 'ATC/3.0', profile: 'core',
    controls_passed,
    controls_failed,
    errors,
    warnings,
    card_id: card.card_id,
    status: card.status || null,
    agent_id: p.agent_id || null,
    agent_name: p.agent_name || null,
    issuer: p.metadata?.issuer || null,
    trust: p.trust || null,
    issued_at: p.metadata?.issued_at || null,
    expires_at: p.metadata?.expires_at || null,
    crypto: {
      algorithm: 'Ed25519 (RFC 8032)',
      canonicalization: 'RFC 8785 JCS',
      canonical_sha256,
      hash_valid,
      signature_valid,
      trust_anchor,
    },
    revocation: {
      check_url: `https://marketnow.site/api/ocsp?card_id=${encodeURIComponent(card.card_id)}`,
      note: 'Caller MUST check revocation separately (fail-closed: UNKNOWN = DENY).',
    },
    decision_authority: 'consumer',
  };
}
