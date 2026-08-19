/**
 * MarketNow — Vibe Receipt Verifier
 * ==================================
 *
 * Verifies Vibe (vibes-coded.com / doteyeso-ops) action-receipts against
 * the Vibe CA public key. Implements the Vibe preimage format documented
 * at https://vibes-coded.com/patterns/CITATION_JOIN.md
 *
 * Vibe receipt preimage format (pipe-delimited):
 *   agent_id|action|payload_digest|nonce|quote|ts|rt:<receipt_type>(|decision_ref)(|ref:<ref_code>)
 *
 * Verification:
 *   1. Fetch Vibe CA public key from /api/v1/outcomes/action-receipt/public-key
 *   2. Build the preimage string per the format above
 *   3. Verify the Ed25519 signature over the preimage UTF-8 bytes
 *   4. If ref_bound=true, verify the ref_code matches the preimage trailing bytes
 *
 * This closes the MarketNow ↔ Vibe mutual hop: we can now verify Vibe
 * receipts client-side, just as Vibe can verify MarketNow receipts via
 * our /api/atc?action=verify-receipt endpoint.
 *
 * Usage:
 *   import { verifyVibeReceipt, fetchVibePublicKey } from './lib/vibe-verifier.mjs';
 *   const ok = await verifyVibeReceipt(receipt, { ref_bound: true });
 */

import crypto from 'crypto';

const VIBE_API_BASE = 'https://vibes-coded.com/api/v1/outcomes/action-receipt';

// Cache the Vibe CA public key (it changes rarely — CA rotation is explicit)
let _vibePublicKey = null;
let _vibePublicKeyFetchedAt = 0;
const VIBE_KEY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetch the Vibe CA Ed25519 public key (SPKI PEM).
 * @param {boolean} [forceRefresh=false] — bypass cache
 * @returns {Promise<crypto.KeyObject>}
 */
export async function fetchVibePublicKey(forceRefresh = false) {
  if (!forceRefresh && _vibePublicKey && Date.now() - _vibePublicKeyFetchedAt < VIBE_KEY_CACHE_TTL_MS) {
    return _vibePublicKey;
  }

  const r = await fetch(`${VIBE_API_BASE}/public-key`);
  if (!r.ok) {
    throw new Error(`Failed to fetch Vibe public key: ${r.status} ${await r.text()}`);
  }

  const data = await r.json();
  const pem = data.public_key || data.public_key_pem;
  if (!pem) {
    throw new Error('Vibe public-key response missing public_key field');
  }

  _vibePublicKey = crypto.createPublicKey(pem);
  _vibePublicKeyFetchedAt = Date.now();
  return _vibePublicKey;
}

/**
 * Build the Vibe preimage string from receipt fields.
 *
 * Format:
 *   agent_id|action|payload_digest|nonce|quote|ts|rt:<receipt_type>(|decision_ref)(|ref:<ref_code>)
 *
 * @param {object} receipt — Vibe receipt fields
 * @returns {string} preimage
 */
export function buildVibePreimage(receipt) {
  const parts = [
    receipt.agent_id,
    receipt.action,
    receipt.payload_digest,
    receipt.nonce,
    receipt.quote,
    receipt.ts || receipt.issued_at,
    `rt:${receipt.receipt_type || 'raw'}`,
  ];

  // Optional decision_ref (field 8)
  if (receipt.decision_ref) {
    parts.push(receipt.decision_ref);
  }

  // Optional ref_code (field 9, only present when ref_bound=true)
  if (receipt.ref_code) {
    parts.push(`ref:${receipt.ref_code}`);
  }

  return parts.join('|');
}

/**
 * Verify a Vibe action-receipt cryptographically.
 *
 * @param {object} receipt — full receipt object from Vibe API
 * @param {object} [opts]
 * @param {boolean} [opts.ref_bound=false] — if true, require ref_code to match
 * @param {boolean} [opts.fetch_public_key=true] — fetch Vibe public key (false for offline verify)
 * @param {crypto.KeyObject} [opts.public_key] — pre-fetched public key (for offline verify)
 * @returns {Promise<object>} { valid, reason?, ref_bound_match? }
 */
export async function verifyVibeReceipt(receipt, opts = {}) {
  const { ref_bound = false, fetch_public_key = true, public_key = null } = opts;

  if (!receipt || !receipt.signature && !receipt.ed25519_signature) {
    return { valid: false, reason: 'missing_signature' };
  }

  // Get public key
  let caKey;
  try {
    caKey = public_key || (fetch_public_key ? await fetchVibePublicKey() : null);
    if (!caKey) {
      return { valid: false, reason: 'no_public_key' };
    }
  } catch (e) {
    return { valid: false, reason: 'public_key_fetch_failed', message: e.message };
  }

  // Build preimage
  let preimage;
  try {
    preimage = buildVibePreimage(receipt);
  } catch (e) {
    return { valid: false, reason: 'preimage_build_failed', message: e.message };
  }

  // Get signature bytes — Vibe returns ed25519_signature as base64
  const sigB64 = receipt.ed25519_signature || receipt.signature;
  let signature;
  try {
    signature = Buffer.from(sigB64, 'base64');
  } catch {
    return { valid: false, reason: 'invalid_signature_encoding' };
  }

  // Verify Ed25519 signature
  try {
    const data = Buffer.from(preimage, 'utf8');
    const valid = crypto.verify(null, data, caKey, signature);
    if (!valid) {
      return { valid: false, reason: 'signature_invalid' };
    }
  } catch (e) {
    return { valid: false, reason: 'verification_error', message: e.message };
  }

  // If ref_bound=true, verify the ref_code is in the preimage
  let ref_bound_match = null;
  if (ref_bound) {
    if (!receipt.ref_code) {
      return { valid: false, reason: 'ref_bound_required_but_missing' };
    }
    // The preimage should end with `|ref:<ref_code>`
    const expectedSuffix = `|ref:${receipt.ref_code}`;
    ref_bound_match = preimage.endsWith(expectedSuffix);
    if (!ref_bound_match) {
      return {
        valid: false,
        reason: 'ref_code_mismatch',
        expected_suffix: expectedSuffix,
        preimage_tail: preimage.slice(-100),
      };
    }
  }

  return {
    valid: true,
    ref_bound_match,
    preimage_length: preimage.length,
    receipt_id: receipt.receipt_id,
    agent_id: receipt.agent_id,
    action: receipt.action,
  };
}

/**
 * Fetch and verify a Vibe sample receipt (for testing the integration).
 * Calls /api/v1/outcomes/action-receipt/sample?with_ref=true
 *
 * @returns {Promise<object>} { receipt, verification }
 */
export async function fetchAndVerifyVibeSample() {
  const r = await fetch(`${VIBE_API_BASE}/sample?with_ref=true`);
  if (!r.ok) {
    throw new Error(`Failed to fetch Vibe sample: ${r.status}`);
  }
  const data = await r.json();
  const receipt = data.receipt;

  const verification = await verifyVibeReceipt(receipt, {
    ref_bound: receipt.ref_bound === true,
  });

  return { receipt, verification, raw: data };
}
