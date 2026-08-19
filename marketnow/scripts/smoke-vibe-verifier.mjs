#!/usr/bin/env node
/**
 * Smoke test for the Vibe receipt verifier.
 * Fetches the Vibe sample receipt and verifies it locally with Ed25519.
 */

import { fetchAndVerifyVibeSample, fetchVibePublicKey, buildVibePreimage } from '../aep-marketplace/lib/vibe-verifier.mjs';

console.log('Vibe Receipt Verifier — Smoke Test');
console.log('===================================');
console.log('');

console.log('Step 1: Fetch Vibe sample receipt...');
try {
  const { receipt, verification, raw } = await fetchAndVerifyVibeSample();

  console.log('✓ Sample fetched');
  console.log(`  receipt_id: ${receipt.receipt_id}`);
  console.log(`  agent_id: ${receipt.agent_id}`);
  console.log(`  action: ${receipt.action}`);
  console.log(`  ref_code: ${receipt.ref_code}`);
  console.log(`  ref_bound: ${receipt.ref_bound}`);
  console.log(`  algorithm: ${receipt.algorithm}`);
  console.log(`  ed25519_signature: ${receipt.ed25519_signature?.slice(0, 40)}...`);
  console.log('');

  console.log('Step 2: Build preimage...');
  const preimage = buildVibePreimage(receipt);
  console.log('✓ Preimage built');
  console.log(`  preimage: ${preimage}`);
  console.log(`  length: ${preimage.length} chars`);
  console.log('');

  console.log('Step 3: Verify Ed25519 signature...');
  console.log('✓ Verification result:');
  console.log(JSON.stringify(verification, null, 2));
  console.log('');

  if (verification.valid) {
    console.log('🎉 SMOKE TEST PASSED');
    console.log('   Vibe receipt cryptographically verified with MarketNow-side code.');
    console.log('   Mutual hop is now bidirectional:');
    console.log('   - Vibe can verify MarketNow receipts via /api/atc?action=verify-receipt');
    console.log('   - MarketNow can verify Vibe receipts via lib/vibe-verifier.mjs');
  } else {
    console.log('✗ SMOKE TEST FAILED');
    console.log(`   Reason: ${verification.reason}`);
    if (verification.message) console.log(`   Message: ${verification.message}`);
    process.exit(1);
  }
} catch (e) {
  console.log('✗ Smoke test error:', e.message);
  if (e.cause) console.log('  Cause:', e.cause.message);
  process.exit(1);
}
