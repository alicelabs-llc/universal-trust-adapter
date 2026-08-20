// ============================================================================
// MarketNow — Crypto Library v2.0 (Ed25519 + RFC 8785 JCS + Licenses)
// ============================================================================
// Implements:
//   - ATC v2.0 signature verification (with ca_key_id + evidence_hash)
//   - Ed25519-signed license tokens (offline-verifiable)
//   - License verification without server contact
// ============================================================================

import crypto from 'crypto';
import { canonicalize } from './canonical-json.mjs';

// ============================================================================
// ATC v2.0 Signature Verification
// ============================================================================

/**
 * Verify an ATC v2.0 card's signature.
 *
 * v2.0 requirements:
 *   - signature.ca_key_id is REQUIRED
 *   - signature.evidence_hash is REQUIRED
 *   - signature.policy_version is REQUIRED (must be valid semver)
 *   - signature.canonical_json MUST be "RFC_8785_JCS"
 *
 * @param {Object} card - The ATC card (with payload + signature)
 * @param {string} caPublicKeyPem - The CA's public key in PEM format
 * @returns {Promise<{valid: boolean, issues: string[], canonical: string, digest: string}>}
 */
export async function verifyAtcSignature(card, caPublicKeyPem) {
  const issues = [];

  // ── v2.0 Schema validation ──
  if (!card.payload) {
    return { valid: false, issues: ['missing payload'], canonical: null, digest: null };
  }
  if (!card.signature) {
    return { valid: false, issues: ['missing signature block'], canonical: null, digest: null };
  }

  const sig = card.signature;

  // v2.0 required fields
  if (!sig.ca_key_id) {
    issues.push('v2_violation: ca_key_id is required');
  }
  if (!sig.evidence_hash) {
    issues.push('v2_violation: evidence_hash is required');
  }
  if (!sig.policy_version) {
    issues.push('v2_violation: policy_version is required');
  } else if (!/^\d+\.\d+\.\d+$/.test(sig.policy_version) && !/^\d{4}-\d{2}-\d{2}$/.test(sig.policy_version)) {
    issues.push(`v2_violation: policy_version "${sig.policy_version}" is not valid semver or date`);
  }

  // v2.0 canonicalization MUST be RFC_8785_JCS
  if (sig.canonical_json && sig.canonical_json !== 'RFC_8785_JCS') {
    issues.push(`v2_violation: canonical_json "${sig.canonical_json}" is deprecated in v2.0 — only RFC_8785_JCS accepted`);
  }

  // ── Standard checks ──
  // Algorithm
  if (!sig.algorithm?.includes('Ed25519')) {
    issues.push(`wrong algorithm: ${sig.algorithm}`);
    return { valid: false, issues, canonical: null, digest: null };
  }

  // Signature format
  const sigHex = sig.value || '';
  if (!/^[0-9a-f]+$/i.test(sigHex) || sigHex.length !== 128) {
    issues.push(`malformed signature: expected 128 hex chars, got ${sigHex.length}`);
    return { valid: false, issues, canonical: null, digest: null };
  }

  // Expires_at
  const expiresAt = card.payload.metadata?.expires_at;
  if (expiresAt) {
    if (new Date(expiresAt) < new Date()) {
      issues.push(`expired: expires_at ${expiresAt} is in the past`);
    }
  }

  // Issued_at clock skew
  const issuedAt = card.payload.metadata?.issued_at;
  if (issuedAt) {
    const skew = new Date(issuedAt) - new Date();
    if (skew > 5 * 60 * 1000) {
      issues.push(`issued_at is in the future (clock skew): ${issuedAt}`);
    }
  }

  // Status
  if (card.status === 'revoked') {
    issues.push(`card is revoked: ${card.revocation_reason || 'no reason'}`);
  }

  // card_id match
  if (card.card_id && card.payload.card_id && card.card_id !== card.payload.card_id) {
    issues.push(`card_id mismatch: outer ${card.card_id} vs payload ${card.payload.card_id}`);
  }

  // ── Canonicalize (RFC 8785 JCS only in v2) ──
  const canonical = canonicalize(card.payload);
  const canonicalBytes = Buffer.from(canonical, 'utf-8');
  const digest = crypto.createHash('sha256').update(canonicalBytes).digest('hex');

  // ── Verify Ed25519 signature ──
  const sigBytes = Buffer.from(sigHex, 'hex');
  let sigValid = false;
  try {
    sigValid = crypto.verify(null, canonicalBytes, caPublicKeyPem, sigBytes);
  } catch (e) {
    issues.push(`verification error: ${e.message}`);
  }
  if (!sigValid) {
    issues.push('signature does not verify against the CA public key');
  }

  // ── Verify evidence_hash (v2.0 new check) ──
  if (sig.evidence_hash) {
    const expectedEvidenceHash = `sha256:${crypto.createHash('sha256')
      .update(canonical + sigHex)
      .digest('hex')}`;
    if (sig.evidence_hash !== expectedEvidenceHash) {
      issues.push(`evidence_hash mismatch: expected ${expectedEvidenceHash.slice(0, 20)}, got ${sig.evidence_hash.slice(0, 20)}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    canonical,
    digest,
    signature_valid: sigValid,
    v2_compliant: !issues.some(i => i.startsWith('v2_violation')),
  };
}

// ============================================================================
// Ed25519-Signed License Tokens (NEW in v2.0)
// ============================================================================
//
// License format: <header>.<payload>.<signature>
//   - header: base64url(JSON({alg:"Ed25519", typ:"MN-LICENSE", v:"2.0"}))
//   - payload: base64url(JSON({skill_id, buyer_wallet, issued_at, expires_at, issuer, evidence_hash}))
//   - signature: base64url(Ed25519.sign(header.payload, CA_PRIVATE_KEY))
//
// Clients can verify licenses OFFLINE without calling the server.
// Uses the SAME CA key as ATC cards (no new key management).
// ============================================================================

/**
 * Issue a new Ed25519-signed license token.
 *
 * @param {Object} params
 * @param {string} params.skill_id - The skill being licensed
 * @param {string} params.buyer_wallet - Buyer's wallet address
 * @param {string} params.buyer_email - Buyer's email (optional)
 * @param {string} params.expires_at - ISO date string
 * @returns {Promise<{license_id: string, license_token: string, signature_value: string, ca_key_id: string, evidence_hash: string}>}
 */
export async function issueLicenseToken({ skill_id, buyer_wallet, buyer_email, expires_at }) {
  const caPrivateKey = process.env.MARKETNOW_ATC_CA_PRIVATE_KEY;
  const caPublicKeyPem = process.env.ATC_CA_PUBLIC_KEY_PEM;

  if (!caPrivateKey) {
    throw new Error('CA private key not configured (MARKETNOW_ATC_CA_PRIVATE_KEY env var)');
  }

  const license_id = `lic_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const issued_at = new Date().toISOString();

  const header = {
    alg: 'Ed25519',
    typ: 'MN-LICENSE',
    v: '2.0',
  };
  const payload = {
    license_id,
    skill_id,
    buyer_wallet,
    buyer_email: buyer_email || null,
    issued_at,
    expires_at,
    issuer: 'MarketNow',
    issuer_url: 'https://marketnow.site',
  };

  // Compute evidence_hash (tamper-evidence)
  const payloadJson = JSON.stringify(payload, Object.keys(payload).sort());
  const evidence_hash = `sha256:${crypto.createHash('sha256').update(payloadJson).digest('hex')}`;
  payload.evidence_hash = evidence_hash;

  // Encode header and payload
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const message = `${headerB64}.${payloadB64}`;

  // Sign with Ed25519
  const signature = crypto.sign(null, Buffer.from(message), caPrivateKey);
  const sigB64 = signature.toString('base64url');

  const license_token = `${message}.${sigB64}`;

  return {
    license_id,
    license_token,
    signature_value: sigB64,
    ca_key_id: 'MCowBQYDK2VwAyEA', // First 20 chars of CA public key (SPKI prefix)
    evidence_hash,
    payload,
  };
}

/**
 * Verify a license token OFFLINE (no server contact).
 *
 * @param {string} license_token - The full license token (header.payload.signature)
 * @param {string} caPublicKeyPem - The CA's public key in PEM format
 * @returns {Promise<{valid: boolean, payload: Object, issues: string[]}>}
 */
export async function verifyLicenseOffline(license_token, caPublicKeyPem) {
  const issues = [];

  // Parse token
  const parts = license_token.split('.');
  if (parts.length !== 3) {
    return { valid: false, issues: ['malformed token: expected 3 parts separated by "."'], payload: null };
  }

  const [headerB64, payloadB64, sigB64] = parts;
  const message = `${headerB64}.${payloadB64}`;

  let header, payload;
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
  } catch (e) {
    return { valid: false, issues: [`malformed base64: ${e.message}`], payload: null };
  }

  // Check header
  if (header.alg !== 'Ed25519') {
    issues.push(`wrong algorithm: ${header.alg}`);
  }
  if (header.typ !== 'MN-LICENSE') {
    issues.push(`wrong type: ${header.typ}`);
  }
  if (header.v !== '2.0') {
    issues.push(`wrong version: ${header.v} (expected 2.0)`);
  }

  // Check expires_at
  if (payload.expires_at) {
    if (new Date(payload.expires_at) < new Date()) {
      issues.push(`license expired: ${payload.expires_at}`);
    }
  }

  // Check evidence_hash
  if (payload.evidence_hash) {
    const payloadForHash = { ...payload };
    delete payloadForHash.evidence_hash;
    const expectedHash = `sha256:${crypto.createHash('sha256')
      .update(JSON.stringify(payloadForHash, Object.keys(payloadForHash).sort()))
      .digest('hex')}`;
    if (payload.evidence_hash !== expectedHash) {
      issues.push(`evidence_hash mismatch: payload tampered`);
    }
  }

  // Verify Ed25519 signature
  const sigBytes = Buffer.from(sigB64, 'base64url');
  let sigValid = false;
  try {
    sigValid = crypto.verify(null, Buffer.from(message), caPublicKeyPem, sigBytes);
  } catch (e) {
    issues.push(`verification error: ${e.message}`);
  }
  if (!sigValid) {
    issues.push('signature does not verify against the CA public key');
  }

  return {
    valid: issues.length === 0,
    issues,
    payload,
    signature_valid: sigValid,
  };
}
