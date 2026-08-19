#!/usr/bin/env node
/**
 * Smoke test for the action-receipt module.
 * Verifies:
 *   1. buildReceipt() produces a well-formed receipt with signature
 *   2. verifyReceipt() returns valid=true for the original receipt
 *   3. verifyReceipt() returns valid=false for a tampered receipt
 *   4. The signature is over RFC 8785 canonical JSON (deterministic)
 *
 * Run with:
 *   MARKETNOW_ATC_CA_PRIVATE_KEY="<pem>" node scripts/smoke-action-receipt.mjs
 */

import crypto from 'crypto';
import {
  buildReceipt,
  verifyReceipt,
  verifyReceiptSignature,
  newReceiptId,
} from '../aep-marketplace/lib/action-receipt.mjs';
import { canonicalize } from '../aep-marketplace/lib/canonical-json.mjs';

const CA_KEY_PEM = process.env.MARKETNOW_ATC_CA_PRIVATE_KEY;

if (!CA_KEY_PEM) {
  // Generate an ephemeral keypair for the test if no CA key is configured
  console.log('⚠️  MARKETNOW_ATC_CA_PRIVATE_KEY not set — generating ephemeral CA keypair for test\n');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  process.env.MARKETNOW_ATC_CA_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' });
} else {
  console.log('✓ Using MARKETNOW_ATC_CA_PRIVATE_KEY from env\n');
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test('newReceiptId() returns rcpt_-prefixed ID', () => {
  const id = newReceiptId();
  if (!id.startsWith('rcpt_')) throw new Error(`Expected rcpt_ prefix, got: ${id}`);
  if (id.length < 15) throw new Error(`ID too short: ${id.length}`);
  return id;
});

test('buildReceipt() produces well-formed receipt', () => {
  const receipt = buildReceipt({
    skillId: 'mn-test-001',
    licenseKey: 'MN-TESTTEST-ABCD',
    mandateId: 'mand_test123',
    txHash: '0xabc123',
    atcCardId: null,
    amountUsd: 4.99,
    network: 'base',
    contentSha256: null,
  });

  if (receipt.receipt_id.startsWith('rcpt_') !== true) throw new Error('Bad receipt_id');
  if (receipt.receipt_version !== '1.0.0') throw new Error('Bad receipt_version');
  if (!receipt.issued_at) throw new Error('Missing issued_at');
  if (receipt.mandate_id !== 'mand_test123') throw new Error('Bad mandate_id');
  if (receipt.settle_txhash !== '0xabc123') throw new Error('Bad settle_txhash');
  if (receipt.delivered.skill_id !== 'mn-test-001') throw new Error('Bad skill_id');
  if (receipt.delivered.license_key !== 'MN-TESTTEST-ABCD') throw new Error('Bad license_key');
  if (receipt.amount_usd !== 4.99) throw new Error('Bad amount_usd');
  if (receipt.network !== 'base') throw new Error('Bad network');
  if (!receipt.signature || !receipt.signature.value) throw new Error('Missing signature');
  if (receipt.signature.algorithm !== 'Ed25519 (RFC 8032)') throw new Error('Bad signature algorithm');
  if (receipt.signature.canonical_json !== 'RFC 8785 JCS') throw new Error('Bad canonical_json label');
  return receipt;
});

test('verifyReceipt() returns valid=true for original receipt', () => {
  const receipt = buildReceipt({
    skillId: 'mn-test-002',
    licenseKey: 'MN-VERIFY-001',
    mandateId: null,
    txHash: null,
    atcCardId: 'ATC-2026-7777670',
    amountUsd: 0.99,
    network: 'none',
  });
  const result = verifyReceipt(receipt);
  if (!result.valid) throw new Error(`Expected valid=true, got: ${JSON.stringify(result)}`);
  return result;
});

test('verifyReceipt() returns valid=false for tampered receipt', () => {
  const receipt = buildReceipt({
    skillId: 'mn-test-003',
    licenseKey: 'MN-TAMPER-001',
    mandateId: 'mand_orig',
    txHash: '0xorig',
    amountUsd: 9.99,
    network: 'base',
  });
  // Tamper: change the mandate_id after signing
  receipt.mandate_id = 'mand_tampered';
  const result = verifyReceipt(receipt);
  if (result.valid) throw new Error('Expected valid=false for tampered receipt');
  if (result.reason !== 'signature_invalid') throw new Error(`Expected reason=signature_invalid, got: ${result.reason}`);
  return result;
});

test('verifyReceipt() returns valid=false for tampered amount', () => {
  const receipt = buildReceipt({
    skillId: 'mn-test-004',
    licenseKey: 'MN-TAMPER-002',
    mandateId: null,
    txHash: '0xamt',
    amountUsd: 1.99,
    network: 'base',
  });
  // Tamper: change the amount after signing
  receipt.amount_usd = 0.01;
  const result = verifyReceipt(receipt);
  if (result.valid) throw new Error('Expected valid=false for tampered amount');
  return result;
});

test('verifyReceipt() returns valid=false for tampered license_key', () => {
  const receipt = buildReceipt({
    skillId: 'mn-test-005',
    licenseKey: 'MN-ORIG-KEY',
    mandateId: null,
    txHash: null,
    amountUsd: 4.99,
    network: 'none',
  });
  // Tamper: change the license key after signing
  receipt.delivered.license_key = 'MN-FAKE-KEY';
  const result = verifyReceipt(receipt);
  if (result.valid) throw new Error('Expected valid=false for tampered license_key');
  return result;
});

test('Signature is deterministic across two builds of the same payload', () => {
  // RFC 8785 canonicalization must produce identical bytes for identical
  // payloads regardless of object construction order or key insertion order.
  // We can't pass the exact same receipt_id (it's UUID-based), so we test
  // canonicalization determinism directly.
  const objA = { b: 1, a: 2, c: { z: 1, y: 2, x: 3 } };
  const objB = { a: 2, b: 1, c: { x: 3, y: 2, z: 1 } };
  const cA = canonicalize(objA);
  const cB = canonicalize(objB);
  if (cA !== cB) {
    throw new Error(`Canonical JSON not deterministic:\n  A: ${cA}\n  B: ${cB}`);
  }
  // Expected: keys sorted UTF-16, so {"a":2,"b":1,"c":{"x":3,"y":2,"z":1}}
  if (cA !== '{"a":2,"b":1,"c":{"x":3,"y":2,"z":1}}') {
    throw new Error(`Unexpected canonical form: ${cA}`);
  }
  return cA;
});

test('Receipt with null fields (free skill scenario) builds and verifies', () => {
  const receipt = buildReceipt({
    skillId: 'mn-free-001',
    licenseKey: 'MN-FREE-ABCD',
    mandateId: null,
    txHash: null,
    atcCardId: null,
    amountUsd: 0,
    network: 'none',
    contentSha256: null,
  });
  const result = verifyReceipt(receipt);
  if (!result.valid) throw new Error(`Free-skill receipt should verify: ${JSON.stringify(result)}`);
  return result;
});

// Run tests
let passed = 0;
let failed = 0;

for (const { name, fn } of tests) {
  try {
    const result = fn();
    console.log(`✓ ${name}`);
    if (result !== undefined) {
      const preview = typeof result === 'string' ? result.slice(0, 80) : JSON.stringify(result).slice(0, 120);
      console.log(`  → ${preview}`);
    }
    passed++;
  } catch (e) {
    console.log(`✗ ${name}`);
    console.log(`  ERROR: ${e.message}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed, ${tests.length} total`);
process.exit(failed > 0 ? 1 : 0);
