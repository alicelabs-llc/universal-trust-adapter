/**
 * MarketNow — Action Receipt (RFC 8785 + Ed25519)
 * =================================================
 *
 * A signed delivery proof emitted when an agent purchase completes.
 * This closes the gap identified in the MarketNow ↔ Vibe (doteyeso-ops)
 * integration: the agent gets a license key, but until now there was no
 * cryptographic receipt proving the transaction completed end-to-end.
 *
 * Join-key map (agreed with @doteyeso-ops on PipedreamHQ/awesome-mcp-servers#94):
 *
 *   | MarketNow               | Vibes join                              |
 *   |-------------------------|-----------------------------------------|
 *   | mandate ID              | decision_ref (content-addressed auth)   |
 *   | settle txHash           | payment / settle coordinates            |
 *   | ATC (identity)          | co-sign or cite — does NOT replace      |
 *   | signed delivery proof   | action-receipt → offline verify         |
 *
 * Receipt shape:
 *
 *   {
 *     receipt_id: "rcpt_<uuid>",
 *     receipt_version: "1.0.0",
 *     issued_at: "2026-07-25T...",
 *     mandate_id: "mand_xxx" | null,        // → Vibes decision_ref
 *     settle_txhash: "0xabc..." | null,      // → Vibes settle coordinate
 *     atc_card_id: "ATC-2026-xxx" | null,    // co-signed by ATC issuer
 *     delivered: {
 *       skill_id: "mn-mcp-xxx",
 *       license_key: "MN-XXXXXXXX-YYYY",
 *       content_sha256: "<sha256 of skill manifest>" | null
 *     },
 *     amount_usd: number,
 *     network: "base" | "none",
 *     signature: {
 *       algorithm: "Ed25519 (RFC 8032)",
 *       value: "<hex>",
 *       signed_by: "MarketNow Sentinel CA",
 *       signed_at: "2026-07-25T...",
 *       canonical_json: "RFC 8785 JCS"
 *     }
 *   }
 *
 * The signature is over the receipt payload EXCLUDING the `signature` field,
 * canonicalized via RFC 8785 JCS (same as ATC).
 *
 * Storage: persisted to `_data/receipts/{receipt_id}.json` in the public
 * GitHub repo (same audit-ledger pattern as ATC).
 */

import crypto from 'crypto';
import { canonicalize as rfc8785Canonicalize } from './canonical-json.mjs';

const GITHUB_TOKEN = process.env.MANDATES_GITHUB_TOKEN;
const REPO = process.env.MANDATES_REPO || 'alicelabs-llc/marketnow';
const BRANCH = 'master';
const RECEIPTS_DIR = '_data/receipts';

// ─── CA key loading (shared with atc.js) ─────────────────────────────────

let _caPrivateKey = null;
let _caPublicKey = null;
let _caPublicKeyPem = null;

function loadCAKeys() {
  if (_caPrivateKey) {
    return {
      privateKey: _caPrivateKey,
      publicKey: _caPublicKey,
      publicKeyPem: _caPublicKeyPem,
    };
  }
  const CA_PRIVATE_KEY_PEM = process.env.MARKETNOW_ATC_CA_PRIVATE_KEY;
  if (!CA_PRIVATE_KEY_PEM) {
    throw new Error(
      'CA private key not configured. Set MARKETNOW_ATC_CA_PRIVATE_KEY env var.'
    );
  }
  _caPrivateKey = crypto.createPrivateKey(CA_PRIVATE_KEY_PEM);
  _caPublicKey = crypto.createPublicKey(_caPrivateKey);
  _caPublicKeyPem = _caPublicKey.export({ type: 'spki', format: 'pem' }).trim();
  return {
    privateKey: _caPrivateKey,
    publicKey: _caPublicKey,
    publicKeyPem: _caPublicKeyPem,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function canonicalJson(obj) {
  return rfc8785Canonicalize(obj);
}

/**
 * Sign a receipt payload with the CA Ed25519 key.
 * @param {Object} payload - receipt fields EXCLUDING signature
 * @returns {string} hex signature
 */
export function signReceipt(payload) {
  const { privateKey } = loadCAKeys();
  const data = Buffer.from(canonicalJson(payload), 'utf8');
  const signature = crypto.sign(null, data, privateKey);
  return signature.toString('hex');
}

/**
 * Verify a receipt signature against the CA public key.
 * @param {Object} payload - receipt fields EXCLUDING signature
 * @param {string} signatureHex - hex signature
 * @returns {boolean}
 */
export function verifyReceiptSignature(payload, signatureHex) {
  try {
    const { publicKey } = loadCAKeys();
    const data = Buffer.from(canonicalJson(payload), 'utf8');
    const signature = Buffer.from(signatureHex, 'hex');
    return crypto.verify(null, data, publicKey, signature);
  } catch {
    return false;
  }
}

/**
 * Generate a new receipt ID (uuid v4 prefixed for readability).
 */
export function newReceiptId() {
  return 'rcpt_' + crypto.randomUUID().replace(/-/g, '').slice(0, 20);
}

/**
 * Build a complete receipt object from purchase parameters.
 *
 * @param {Object} params
 * @param {string} params.skillId
 * @param {string} params.licenseKey
 * @param {string|null} [params.mandateId]
 * @param {string|null} [params.txHash]
 * @param {string|null} [params.atcCardId]
 * @param {number} params.amountUsd
 * @param {string} [params.network='base']
 * @param {string|null} [params.contentSha256]
 * @returns {Object} complete signed receipt (payload + signature)
 */
export function buildReceipt({
  skillId,
  licenseKey,
  mandateId = null,
  txHash = null,
  atcCardId = null,
  amountUsd,
  network = 'base',
  contentSha256 = null,
}) {
  const receiptId = newReceiptId();
  const now = new Date().toISOString();

  const payload = {
    receipt_id: receiptId,
    receipt_version: '1.0.0',
    issued_at: now,
    mandate_id: mandateId,
    settle_txhash: txHash,
    atc_card_id: atcCardId,
    delivered: {
      skill_id: skillId,
      license_key: licenseKey,
      content_sha256: contentSha256,
    },
    amount_usd: Number(amountUsd.toFixed(2)),
    network,
  };

  const signatureValue = signReceipt(payload);

  return {
    ...payload,
    signature: {
      algorithm: 'Ed25519 (RFC 8032)',
      value: signatureValue,
      signed_by: 'MarketNow Sentinel CA',
      signed_at: now,
      canonical_json: 'RFC 8785 JCS',
      verify_with: 'GET /api/atc?action=ca-key',
    },
  };
}

// ─── GitHub persistence ─────────────────────────────────────────────────

/**
 * Persist a receipt to _data/receipts/{receipt_id}.json in the GitHub repo.
 * Same pattern as ATC persistence — file-per-record, atomic SHA-based replace.
 */
export async function persistReceipt(receipt) {
  if (!GITHUB_TOKEN) {
    // Dev / no-token mode: skip persistence, return success
    return { persisted: false, reason: 'no_github_token' };
  }

  const receiptId = receipt.receipt_id;
  const filePath = `${RECEIPTS_DIR}/${encodeURIComponent(receiptId)}.json`;

  // Check if file already exists (shouldn't, but be safe)
  let sha = null;
  try {
    const metaUrl = `https://api.github.com/repos/${REPO}/contents/${filePath}?ref=${encodeURIComponent(BRANCH)}`;
    const metaR = await fetch(metaUrl, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'marketnow-receipts',
      },
    });
    if (metaR.ok) {
      const meta = await metaR.json();
      sha = meta?.sha || null;
    }
    // 404 is expected for a new receipt — sha stays null
  } catch {
    // Network error etc — proceed without sha, will create new file
  }

  const content = Buffer.from(JSON.stringify(receipt, null, 2)).toString('base64');
  const url = `https://api.github.com/repos/${REPO}/contents/${filePath}`;
  const body = {
    message: `issue receipt ${receiptId}`,
    content,
    branch: BRANCH,
  };
  if (sha) body.sha = sha;

  const r = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'marketnow-receipts',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const errBody = await r.text();
    throw new Error(
      `GitHub receipt persist failed: ${r.status} ${errBody.slice(0, 200)}`
    );
  }

  return { persisted: true, sha };
}

/**
 * Fetch a receipt from GitHub by receipt_id.
 * Uses Contents API (not raw) to bypass CDN cache — same reason as ATC.
 */
export async function fetchReceipt(receiptId) {
  if (!receiptId) return null;

  // ── WORKAROUND: GitHub account shadowbanned. Use static file bundled in
  // this deployment first. Falls back to GitHub Contents API if not found.
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://marketnow.site';
    const r = await fetch(`${baseUrl}/api/receipts/${encodeURIComponent(receiptId)}.json`);
    if (r.ok) {
      return await r.json();
    }
  } catch {
    // Static file not available — fall through to GitHub API
  }

  // ── FALLBACK: GitHub Contents API (works for non-flagged accounts) ──
  const filePath = `${RECEIPTS_DIR}/${encodeURIComponent(receiptId)}.json`;
  const url = `https://api.github.com/repos/${REPO}/contents/${filePath}?ref=${encodeURIComponent(BRANCH)}`;

  try {
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'marketnow-receipts',
      },
    });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    const meta = await r.json();
    const content = Buffer.from(meta.content, 'base64').toString('utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Verify a full receipt object: signature valid + receipt_id matches.
 * @param {Object} receipt - full receipt including signature
 * @returns {{valid: boolean, reason?: string, receipt_id: string}}
 */
export function verifyReceipt(receipt) {
  if (!receipt || !receipt.receipt_id || !receipt.signature) {
    return { valid: false, reason: 'malformed', receipt_id: null };
  }

  // Strip signature field to reconstruct the signed payload
  const { signature, ...payload } = receipt;
  const sigValid = verifyReceiptSignature(payload, signature.value);

  if (!sigValid) {
    return {
      valid: false,
      reason: 'signature_invalid',
      receipt_id: receipt.receipt_id,
    };
  }

  return { valid: true, receipt_id: receipt.receipt_id };
}
