#!/usr/bin/env node
/**
 * Smoke test for the referral tracker module.
 *
 * Tests:
 *   1. mintReferral() produces a well-formed ref_code
 *   2. creditReferral() increments counts + computes commission
 *   3. lookupReferral() returns the updated record
 *   4. recordReferralClick() increments click counter
 *   5. listReferralsByAgent() filters by agent_id
 *
 * NOTE: This test calls the real GitHub API (no mock). It writes real
 * referral records to _data/referrals/ in the repo. Run with:
 *
 *   MANDATES_GITHUB_TOKEN=ghp_xxx node scripts/smoke-referral-tracker.mjs
 *
 * If no token is set, the test still runs but skips persistence assertions.
 */

import {
  mintReferral,
  creditReferral,
  recordReferralClick,
  lookupReferral,
  listReferralsByAgent,
  newRefCode,
} from '../aep-marketplace/lib/referral-tracker.mjs';

const hasGithub = !!process.env.MANDATES_GITHUB_TOKEN;
console.log(`GitHub token: ${hasGithub ? 'configured' : 'NOT configured (persistence skipped)'}`);
console.log('');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const TEST_AGENT_ID = 'agent_smoke_test_' + Date.now();
let mintedRefCode = null;

test('newRefCode() returns ref_-prefixed 12-char code', () => {
  const code = newRefCode('test_agent');
  if (!code.startsWith('ref_')) throw new Error(`Expected ref_ prefix, got: ${code}`);
  if (code.length !== 12) throw new Error(`Expected length 12, got: ${code.length} (${code})`);
  return code;
});

test('mintReferral() creates a record with correct defaults', async () => {
  const referral = await mintReferral(TEST_AGENT_ID);
  mintedRefCode = referral.ref_code;

  if (!referral.ref_code.startsWith('ref_')) throw new Error('Bad ref_code');
  if (referral.agent_id !== TEST_AGENT_ID) throw new Error('Bad agent_id');
  if (referral.status !== 'active') throw new Error('Bad status');
  if (referral.clicks !== 0) throw new Error('Bad initial clicks');
  if (referral.installs !== 0) throw new Error('Bad initial installs');
  if (referral.purchases !== 0) throw new Error('Bad initial purchases');
  if (referral.total_earned_usd !== 0) throw new Error('Bad initial earnings');
  if (!Array.isArray(referral.history)) throw new Error('Missing history');
  return referral;
});

test('recordReferralClick() increments click counter', async () => {
  if (!mintedRefCode) throw new Error('No minted ref_code from previous test');
  const updated = await recordReferralClick(mintedRefCode);
  if (!updated) throw new Error('recordReferralClick returned null');
  if (updated.clicks !== 1) throw new Error(`Expected clicks=1, got ${updated.clicks}`);
  if (updated.history.length !== 1) throw new Error(`Expected history length 1, got ${updated.history.length}`);
  if (updated.history[0].action !== 'click') throw new Error('Bad history action');
  return updated;
});

test('creditReferral() computes 5% commission and increments purchases', async () => {
  if (!mintedRefCode) throw new Error('No minted ref_code');
  const purchase = {
    skill_id: 'mn-test-001',
    license_key: 'MN-TEST1234-ABCD',
    amount_usd: 4.99,
    tx_hash: '0xtest' + Date.now(),
    receipt_id: 'rcpt_test' + Date.now(),
  };
  const updated = await creditReferral(mintedRefCode, purchase);
  if (!updated) throw new Error('creditReferral returned null');
  if (updated.purchases !== 1) throw new Error(`Expected purchases=1, got ${updated.purchases}`);
  if (updated.installs !== 1) throw new Error(`Expected installs=1, got ${updated.installs}`);
  // 5% of 4.99 = 0.2495 → rounded to 0.25
  if (updated.total_earned_usd !== 0.25) throw new Error(`Expected earnings=0.25, got ${updated.total_earned_usd}`);
  if (updated.history.length !== 2) throw new Error(`Expected history length 2, got ${updated.history.length}`);
  if (updated.history[1].action !== 'purchase') throw new Error('Bad history action');
  if (updated.history[1].commission_earned_usd !== 0.25) throw new Error('Bad commission amount');
  return updated;
});

test('creditReferral() rejects invalid ref_code format', async () => {
  const result = await creditReferral('invalid_code', {
    skill_id: 'x', license_key: 'y', amount_usd: 1,
  });
  if (result !== null) throw new Error('Expected null for invalid ref_code');
  return 'rejected as expected';
});

test('creditReferral() returns null for non-existent ref_code', async () => {
  const result = await creditReferral('ref_zzzzzzzz', {
    skill_id: 'x', license_key: 'y', amount_usd: 1,
  });
  if (result !== null) throw new Error('Expected null for non-existent ref_code');
  return 'returned null as expected';
});

test('lookupReferral() returns the updated record', async () => {
  if (!mintedRefCode) throw new Error('No minted ref_code');
  const referral = await lookupReferral(mintedRefCode);
  if (!referral) throw new Error('lookupReferral returned null');
  if (referral.ref_code !== mintedRefCode) throw new Error('Bad ref_code');
  if (referral.purchases !== 1) throw new Error(`Expected purchases=1, got ${referral.purchases}`);
  if (referral.clicks !== 1) throw new Error(`Expected clicks=1, got ${referral.clicks}`);
  return referral;
});

test('listReferralsByAgent() includes the test referral', async () => {
  const list = await listReferralsByAgent(TEST_AGENT_ID);
  if (!Array.isArray(list)) throw new Error('Expected array');
  // Persistence may have been skipped — be lenient
  if (hasGithub) {
    if (list.length === 0) throw new Error('Expected at least 1 referral for test agent');
    const found = list.find(r => r.ref_code === mintedRefCode);
    if (!found) throw new Error(`Minted ref_code ${mintedRefCode} not in list`);
    return `Found ${list.length} referral(s) for ${TEST_AGENT_ID}`;
  }
  return `No GitHub token — list returned ${list.length} items (expected 0 without persistence)`;
});

// Run tests
let passed = 0;
let failed = 0;
for (const { name, fn } of tests) {
  try {
    const result = await fn();
    console.log(`✓ ${name}`);
    if (result !== undefined) {
      const preview = typeof result === 'string' ? result.slice(0, 100) : JSON.stringify(result).slice(0, 150);
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
console.log(`\nTest agent: ${TEST_AGENT_ID}`);
console.log(`Test ref_code: ${mintedRefCode}`);
if (mintedRefCode && hasGithub) {
  console.log(`Inspect: https://marketnow.site/api/referrals?action=lookup&ref_code=${mintedRefCode}`);
}
process.exit(failed > 0 ? 1 : 0);
