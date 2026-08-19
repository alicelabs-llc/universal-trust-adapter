/**
 * MarketNow — Signed Revocation List (SRL) with short TTL
 * ========================================================
 *
 * Like OCSP stapling in SSL: a signed list of revoked ATC card_ids
 * that clients can cache for 60 seconds. This avoids hitting the
 * GitHub API on every verify call.
 *
 * The list is signed by the MarketNow CA (same Ed25519 key as ATCs).
 * Clients fetch GET /api/atc?action=revocation-list, cache for 60s,
 * and check locally before falling back to full GitHub verification.
 */

import crypto from 'crypto';
import { canonicalize } from './canonical-json.mjs';

const REVOCATION_TTL_MS = 60 * 1000; // 60 seconds
let _cachedList = null;
let _cachedAt = 0;

/**
 * Build and sign the current revocation list.
 * Fetches all ATCs, filters revoked ones, signs the list.
 */
export async function buildSignedRevocationList(fetchATCs) {
  const now = Date.now();
  
  // Check cache (60s TTL)
  if (_cachedList && (now - _cachedAt) < REVOCATION_TTL_MS) {
    return _cachedList;
  }
  
  const atcs = await fetchATCs();
  const revoked = atcs
    .filter(a => a.status === 'revoked')
    .map(a => ({
      card_id: a.payload?.card_id || a.card_id,
      revoked_at: a.revoked_at,
      reason: a.revocation_reason,
    }));
  
  const list = {
    version: 1,
    issued_at: new Date().toISOString(),
    expires_at: new Date(now + REVOCATION_TTL_MS).toISOString(),
    revoked_count: revoked.length,
    revoked_cards: revoked,
  };
  
  // Sign the list with the CA key
  const CA_PRIVATE_KEY_PEM = process.env.MARKETNOW_ATC_CA_PRIVATE_KEY;
  if (CA_PRIVATE_KEY_PEM) {
    const privateKey = crypto.createPrivateKey(CA_PRIVATE_KEY_PEM);
    const data = Buffer.from(canonicalize(list), 'utf8');
    const signature = crypto.sign(null, data, privateKey);
    list.signature = {
      algorithm: 'Ed25519 (RFC 8032)',
      value: signature.toString('hex'),
      signed_by: 'MarketNow Sentinel CA',
      canonical_json: 'RFC 8785 JCS',
    };
  }
  
  _cachedList = list;
  _cachedAt = now;
  return list;
}

/**
 * Verify a signed revocation list (client-side).
 * @param {Object} list - the revocation list
 * @param {crypto.KeyObject} caPublicKey - CA public key
 * @returns {boolean}
 */
export function verifySignedRevocationList(list, caPublicKey) {
  if (!list || !list.signature) return false;
  try {
    const { signature, ...payload } = list;
    const data = Buffer.from(canonicalize(payload), 'utf8');
    const sig = Buffer.from(list.signature.value, 'hex');
    return crypto.verify(null, data, caPublicKey, sig);
  } catch {
    return false;
  }
}

/**
 * Check if a card_id is in the revocation list.
 * @param {Object} list - signed revocation list
 * @param {string} cardId - card ID to check
 * @returns {boolean} true if revoked
 */
export function isCardRevoked(list, cardId) {
  if (!list || !list.revoked_cards) return false;
  return list.revoked_cards.some(c => c.card_id === cardId);
}
