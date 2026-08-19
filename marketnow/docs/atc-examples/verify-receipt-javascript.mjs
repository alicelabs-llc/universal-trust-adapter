/**
 * MarketNow — Action Receipt verification example (JavaScript / Node.js)
 *
 * Verifies a MarketNow action-receipt cryptographically against the
 * MarketNow CA public key. No server-side trust required — fetch the
 * receipt + CA key, verify the Ed25519 signature client-side.
 *
 * Receipts are signed delivery proofs for completed purchases.
 * Use this to confirm that a purchase actually completed end-to-end.
 *
 * Interop with Vibe (doteyeso-ops):
 *   receipt_id     ↔ vibe_action_receipt (offline-verifiable delivery proof)
 *   mandate_id     ↔ vibe_decision_ref  (content-addressed auth citation)
 *   settle_txhash  ↔ vibe_settle_coordinate (orthogonal to receipt)
 *
 * Usage:
 *   node verify-receipt-javascript.mjs rcpt_c8b9dc67f88e4da5bd3a
 *   node verify-receipt-javascript.mjs  # uses default demo receipt
 *
 * No external dependencies — uses Node.js built-in crypto.
 */

import crypto from 'crypto';

const API_BASE = 'https://marketnow.site';
const DEFAULT_RECEIPT_ID = 'rcpt_c8b9dc67f88e4da5bd3a';

// ─── RFC 8785 JCS Canonical JSON (minimal implementation) ─────────────────
// Matches MarketNow's lib/canonical-json.mjs

function canonicalize(value) {
  if (value === null || value === undefined) return 'null';
  const type = typeof value;
  if (type === 'boolean') return value ? 'true' : 'false';
  if (type === 'number') return serializeNumber(value);
  if (type === 'string') return serializeString(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  if (type === 'object') return serializeObject(value);
  return serializeString(String(value));
}

function serializeNumber(num) {
  if (!Number.isFinite(num)) return 'null';
  if (Number.isInteger(num)) return num.toString();
  let str = num.toString();
  if (str.includes('e') || str.includes('E')) {
    str = str.replace(/E/g, 'e').replace(/e\+/, 'e');
  }
  if (str.includes('.') && !str.includes('e')) {
    str = str.replace(/\.?0+$/, '');
  }
  return str;
}

function serializeString(str) {
  let result = '"';
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    if (ch === 0x22) result += '\\"';
    else if (ch === 0x5c) result += '\\\\';
    else if (ch === 0x08) result += '\\b';
    else if (ch === 0x09) result += '\\t';
    else if (ch === 0x0a) result += '\\n';
    else if (ch === 0x0c) result += '\\f';
    else if (ch === 0x0d) result += '\\r';
    else if (ch < 0x20) result += '\\u' + ch.toString(16).padStart(4, '0');
    else result += str[i];
  }
  return result + '"';
}

function serializeObject(obj) {
  const keys = Object.keys(obj).filter(k => obj[k] !== undefined).sort(compareUtf16);
  if (keys.length === 0) return '{}';
  let result = '{';
  for (let i = 0; i < keys.length; i++) {
    if (i > 0) result += ',';
    result += serializeString(keys[i]) + ':' + canonicalize(obj[keys[i]]);
  }
  return result + '}';
}

function compareUtf16(a, b) {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ca = a.charCodeAt(i);
    const cb = b.charCodeAt(i);
    if (ca < cb) return -1;
    if (ca > cb) return 1;
  }
  return a.length - b.length;
}

// ─── Receipt verification ───────────────────────────────────────────────────

async function fetchCAPublicKey() {
  const r = await fetch(`${API_BASE}/api/atc?action=ca-key`);
  if (!r.ok) throw new Error(`Failed to fetch CA key: ${r.status}`);
  const data = await r.json();
  // Parse PEM and return KeyObject
  return crypto.createPublicKey(data.public_key_pem);
}

async function fetchReceipt(receiptId) {
  const r = await fetch(
    `${API_BASE}/api/atc?action=verify-receipt&receipt_id=${receiptId}`
  );
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Failed to fetch receipt: ${r.status}`);
  return await r.json();
}

async function fetchRawReceipt(receiptId) {
  const url = `https://raw.githubusercontent.com/edgarfloresguerra2011-a11y/marketnow/master/_data/receipts/${receiptId}.json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch raw receipt: ${r.status}`);
  return await r.json();
}

function verifyReceiptSignature(rawReceipt, caPublicKey) {
  const { signature, ...payload } = rawReceipt;
  if (!signature || !signature.value) {
    throw new Error('Receipt missing signature block');
  }
  const canonical = canonicalize(payload);
  const sigBytes = Buffer.from(signature.value, 'hex');
  return crypto.verify(null, Buffer.from(canonical, 'utf8'), caPublicKey, sigBytes);
}

async function main() {
  const receiptId = process.argv[2] || DEFAULT_RECEIPT_ID;

  console.log(`Verifying receipt: ${receiptId}`);
  console.log(`API: ${API_BASE}`);
  console.log();

  // Step 1: Fetch CA public key
  console.log('[1/3] Fetching CA public key...');
  const caKey = await fetchCAPublicKey();
  console.log('      ✓ CA key loaded (Ed25519)');

  // Step 2: Fetch receipt from API
  console.log('[2/3] Fetching receipt from ledger...');
  const receipt = await fetchReceipt(receiptId);
  if (!receipt) {
    console.log('      ✗ Receipt not found in ledger');
    process.exit(1);
  }
  if (!receipt.valid) {
    console.log(`      ✗ Receipt invalid: ${receipt.reason}`);
    process.exit(1);
  }
  console.log(`      ✓ Receipt found, signature_valid=${receipt.signature_valid}`);

  // Step 3: Verify signature locally (don't trust the server)
  console.log('[3/3] Verifying signature locally against CA key...');
  const rawReceipt = await fetchRawReceipt(receiptId);
  const valid = verifyReceiptSignature(rawReceipt, caKey);
  if (!valid) {
    console.log('      ✗ Signature INVALID — receipt may have been tampered with');
    process.exit(1);
  }
  console.log('      ✓ Signature verified (Ed25519, RFC 8785 JCS)');

  console.log();
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  ✓ RECEIPT VERIFIED: ${receiptId}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Issued at:     ${receipt.issued_at}`);
  console.log(`  Mandate ID:    ${receipt.mandate_id || '(null — direct purchase)'}`);
  console.log(`  Settle txHash: ${receipt.settle_txhash || '(null)'}`);
  console.log(`  ATC card ID:   ${receipt.atc_card_id || '(null)'}`);
  console.log('  Delivered:');
  console.log(`    Skill ID:    ${receipt.delivered.skill_id}`);
  console.log(`    License key: ${receipt.delivered.license_key}`);
  console.log(`    SHA-256:     ${receipt.delivered.content_sha256 || '(null)'}`);
  console.log(`  Amount:        $${receipt.amount_usd} (${receipt.network})`);
  console.log();
  console.log('  Interop (Vibe join-key map):');
  if (receipt.interop) {
    console.log(`    vibe_decision_ref:      ${receipt.interop.vibe_decision_ref}`);
    console.log(`    vibe_settle_coordinate: ${receipt.interop.vibe_settle_coordinate}`);
    console.log(`    vibe_action_receipt:    ${receipt.interop.vibe_action_receipt}`);
  }
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
