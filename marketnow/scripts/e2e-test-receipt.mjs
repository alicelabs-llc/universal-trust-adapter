/**
 * End-to-end test: emit a real receipt against production.
 *
 * Since all skills are currently free (post-pivot July 16), we can't trigger
 * a receipt via /api/agent-purchase on production. Instead, this script:
 *   1. Builds a receipt locally using the same lib/action-receipt.mjs
 *   2. Persists it to _data/receipts/ via the GitHub Contents API
 *      (same path the production /api/agent-purchase uses)
 *   3. Calls production GET /api/atc?action=verify-receipt to verify
 *      production can read + verify the receipt
 *
 * This proves end-to-end that:
 *   - The lib/action-receipt.mjs module is correct
 *   - The /api/atc?action=verify-receipt endpoint works on production
 *   - The CA key (env var MARKETNOW_ATC_CA_PRIVATE_KEY) is the same
 *     used by production
 *
 * Usage:
 *   MARKETNOW_ATC_CA_PRIVATE_KEY="<pem>" \
 *   MANDATES_GITHUB_TOKEN="ghp_..." \
 *   node scripts/e2e-test-receipt.mjs
 */

import crypto from 'crypto';
import { buildReceipt, persistReceipt } from '../aep-marketplace/lib/action-receipt.mjs';

const CA_KEY_PEM = process.env.MARKETNOW_ATC_CA_PRIVATE_KEY;
const GH_TOKEN = process.env.MANDATES_GITHUB_TOKEN;
const PRODUCTION_URL = 'https://marketnow.site';

if (!CA_KEY_PEM) {
  console.error('✗ MARKETNOW_ATC_CA_PRIVATE_KEY not set. Cannot sign receipt.');
  process.exit(1);
}
if (!GH_TOKEN) {
  console.error('✗ MANDATES_GITHUB_TOKEN not set. Cannot persist receipt.');
  process.exit(1);
}

console.log('✓ CA key configured');
console.log('✓ GitHub token configured');
console.log('');

// Step 1: Build a receipt for a simulated purchase
console.log('Step 1: Building receipt...');
const receipt = buildReceipt({
  skillId: 'mn-e2e-test-001',
  licenseKey: 'MN-E2ETEST-' + Date.now().toString(36).toUpperCase(),
  mandateId: 'mand_e2e_test',
  txHash: '0xe2etest' + Date.now().toString(16),
  atcCardId: 'ATC-2026-7777670',
  amountUsd: 4.99,
  network: 'base',
  contentSha256: crypto.createHash('sha256').update('test-content').digest('hex'),
});
console.log(`✓ Receipt built: ${receipt.receipt_id}`);
console.log(`  Signature: ${receipt.signature.value.slice(0, 32)}...`);
console.log('');

// Step 2: Persist to GitHub
console.log('Step 2: Persisting to GitHub (_data/receipts/)...');
try {
  const result = await persistReceipt(receipt);
  if (result.persisted) {
    console.log(`✓ Receipt persisted. SHA: ${(result.sha || 'unknown').slice(0, 12)}...`);
  } else {
    console.log(`⚠️  Persistence skipped: ${result.reason}`);
  }
} catch (e) {
  console.error(`✗ Persistence failed: ${e.message}`);
  process.exit(1);
}
console.log('');

// Wait for GitHub raw to be consistent
console.log('Step 3: Waiting 3s for GitHub raw to propagate...');
await new Promise(r => setTimeout(r, 3000));

// Step 4: Verify via production
console.log('Step 4: Calling production verify-receipt endpoint...');
const verifyUrl = `${PRODUCTION_URL}/api/atc?action=verify-receipt&receipt_id=${receipt.receipt_id}`;
console.log(`  URL: ${verifyUrl}`);

const r = await fetch(verifyUrl);
const body = await r.json();
console.log(`  HTTP: ${r.status}`);
console.log(`  valid: ${body.valid}`);
console.log(`  signature_valid: ${body.signature_valid}`);

if (body.valid && body.signature_valid) {
  console.log('');
  console.log('🎉 E2E TEST PASSED!');
  console.log(`   Receipt ${body.receipt_id} verified against production.`);
  console.log(`   Issued at: ${body.issued_at}`);
  console.log(`   Skill: ${body.delivered.skill_id}`);
  console.log(`   License: ${body.delivered.license_key}`);
  console.log(`   Amount: $${body.amount_usd}`);
  console.log(`   Network: ${body.network}`);
  console.log(`   Interop: ${JSON.stringify(body.interop)}`);
  process.exit(0);
} else {
  console.log('');
  console.log('✗ E2E TEST FAILED');
  console.log(`   Reason: ${body.reason || 'unknown'}`);
  console.log(`   Message: ${body.message}`);
  console.log(`   Full response: ${JSON.stringify(body, null, 2)}`);
  process.exit(1);
}
