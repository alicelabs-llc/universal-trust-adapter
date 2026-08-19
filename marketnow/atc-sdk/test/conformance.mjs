#!/usr/bin/env node
/**
 * ATC/1.0 Conformance Test Suite
 *
 * Verifies that the atc-sdk implementation passes all 8 required controls.
 * Other implementations can use these same test vectors to verify conformance.
 *
 * Run:  node test/conformance.mjs
 */

import {
  generateKeyPair,
  issueATC,
  verifyATCSync,
  resignATC,
} from '../src/index.mjs';

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}`);
    failed++;
  }
}

function assertRejects(fn, name) {
  try {
    fn();
    console.log(`  ✗ ${name} (expected throw, got success)`);
    failed++;
  } catch (err) {
    console.log(`  ✓ ${name}`);
    passed++;
  }
}

console.log('=== ATC/1.0 Conformance Test Suite ===\n');

// ─── Test 1: A valid ATC verifies ──────────────────────────────────────────
console.log('Test 1: A valid ATC verifies all 8 controls');
{
  const ca = generateKeyPair();
  const agent = generateKeyPair();
  const atc = issueATC(ca, agent, {
    card_id: 'ATC-2026-0000001',
    identity: { agent_id: 'test-001', agent_name: 'Test', agent_owner: 'Org' },
    capabilities: {
      filesystem: { read: 'own_dir', write: 'own_dir' },
      network: { egress: 'allowlist', ingress: 'none' },
      shell: { exec: 'sandboxed', spawn: 'none' },
      credentials: { read_env: 'none', read_files: 'none' },
      process: { subprocess: 'none', signals: 'own' },
    },
    evidence: {
      audit_pipeline: 'Sentinel L1.5',
      audit_completed_at: '2026-08-10T12:00:00Z',
      static_checks: {
        metadata: true,
        semgrep_rules_count: 36,
        secret_patterns_count: 18,
        dependency_scan: true,
        malware_patterns_count: 8,
        malware_family_signatures_count: 48,
        prompt_injection_rules_count: 32,
      },
      dynamic_checks: {
        sandbox_run: true,
        sandbox_runtime_ms: 12453,
        sandbox_exit_code: 0,
        sandbox_network_blocked: true,
        sandbox_fs_read_only: true,
        sandbox_cap_drop_all: true,
      },
      runtime_checks: { interceptor_rules_count: 5, interceptor_blocks: 0, interceptor_warns: 0 },
      findings: [],
    },
    risk: {
      trust_score: 9,
      risk_level: 'low',
      score_explanation: 'clean',
      scored_at: '2026-08-10T12:01:00Z',
    },
  });

  const result = verifyATCSync(atc);
  assert(result.valid === true, 'Verification succeeds');
  assert(result.controls_passed.length === 8, 'All 8 required controls pass');
  assert(result.controls_failed.length === 0, 'No controls failed');
  assert(result.errors.length === 0, 'No errors');
  assert(result.card_id === 'ATC-2026-0000001', 'card_id extracted correctly');
  assert(result.trust_score === 9, 'trust_score extracted correctly');
  assert(result.risk_level === 'low', 'risk_level extracted correctly');
}

// ─── Test 2: Tampered payload fails ATC-006 ─────────────────────────────────
console.log('\nTest 2: Tampered payload fails ATC-006');
{
  const ca = generateKeyPair();
  const agent = generateKeyPair();
  const atc = issueATC(ca, agent, {
    card_id: 'ATC-2026-0000002',
    identity: { agent_id: 'test-002', agent_name: 'Test', agent_owner: 'Org' },
    capabilities: {
      filesystem: { read: 'own_dir', write: 'own_dir' },
      network: { egress: 'allowlist', ingress: 'none' },
      shell: { exec: 'sandboxed', spawn: 'none' },
      credentials: { read_env: 'none', read_files: 'none' },
      process: { subprocess: 'none', signals: 'own' },
    },
    evidence: {
      audit_pipeline: 'Sentinel L1.5',
      audit_completed_at: '2026-08-10T12:00:00Z',
      static_checks: {
        metadata: true,
        semgrep_rules_count: 36,
        secret_patterns_count: 18,
        dependency_scan: true,
        malware_patterns_count: 8,
        malware_family_signatures_count: 48,
        prompt_injection_rules_count: 32,
      },
      dynamic_checks: {
        sandbox_run: true,
        sandbox_runtime_ms: 12453,
        sandbox_exit_code: 0,
        sandbox_network_blocked: true,
        sandbox_fs_read_only: true,
        sandbox_cap_drop_all: true,
      },
      runtime_checks: { interceptor_rules_count: 5, interceptor_blocks: 0, interceptor_warns: 0 },
      findings: [],
    },
    risk: {
      trust_score: 9,
      risk_level: 'low',
      score_explanation: 'clean',
      scored_at: '2026-08-10T12:01:00Z',
    },
  });

  // Tamper
  atc.risk.trust_score = 1;
  const result = verifyATCSync(atc);
  assert(result.valid === false, 'Tampered ATC fails verification');
  assert(result.controls_failed.includes('ATC-006'), 'ATC-006 is in failed list');
  assert(result.errors.some(e => e.includes('signed_payload_hash mismatch')), 'Hash mismatch reported');
}

// ─── Test 3: Wrong CA key fails ─────────────────────────────────────────────
console.log('\nTest 3: Wrong CA key fails ATC-006');
{
  const ca = generateKeyPair();
  const wrongCA = generateKeyPair();
  const agent = generateKeyPair();
  const atc = issueATC(ca, agent, {
    card_id: 'ATC-2026-0000003',
    identity: { agent_id: 'test-003', agent_name: 'Test', agent_owner: 'Org' },
    capabilities: {
      filesystem: { read: 'own_dir', write: 'own_dir' },
      network: { egress: 'allowlist', ingress: 'none' },
      shell: { exec: 'sandboxed', spawn: 'none' },
      credentials: { read_env: 'none', read_files: 'none' },
      process: { subprocess: 'none', signals: 'own' },
    },
    evidence: {
      audit_pipeline: 'Sentinel L1.5',
      audit_completed_at: '2026-08-10T12:00:00Z',
      static_checks: {
        metadata: true,
        semgrep_rules_count: 36,
        secret_patterns_count: 18,
        dependency_scan: true,
        malware_patterns_count: 8,
        malware_family_signatures_count: 48,
        prompt_injection_rules_count: 32,
      },
      dynamic_checks: {
        sandbox_run: true,
        sandbox_runtime_ms: 12453,
        sandbox_exit_code: 0,
        sandbox_network_blocked: true,
        sandbox_fs_read_only: true,
        sandbox_cap_drop_all: true,
      },
      runtime_checks: { interceptor_rules_count: 5, interceptor_blocks: 0, interceptor_warns: 0 },
      findings: [],
    },
    risk: {
      trust_score: 9,
      risk_level: 'low',
      score_explanation: 'clean',
      scored_at: '2026-08-10T12:01:00Z',
    },
  });

  const result = verifyATCSync(atc, { ca_public_key: wrongCA.publicKey });
  assert(result.valid === false, 'Wrong CA key fails verification');
  assert(result.controls_failed.includes('ATC-006'), 'ATC-006 failed');
}

// ─── Test 4: Invalid card_id fails ─────────────────────────────────────────
console.log('\nTest 4: Invalid card_id format');
{
  const ca = generateKeyPair();
  const agent = generateKeyPair();
  const atc = issueATC(ca, agent, {
    card_id: 'INVALID-CARD-ID',
    identity: { agent_id: 'test-004', agent_name: 'Test', agent_owner: 'Org' },
    capabilities: {
      filesystem: { read: 'own_dir', write: 'own_dir' },
      network: { egress: 'allowlist', ingress: 'none' },
      shell: { exec: 'sandboxed', spawn: 'none' },
      credentials: { read_env: 'none', read_files: 'none' },
      process: { subprocess: 'none', signals: 'own' },
    },
    evidence: {
      audit_pipeline: 'Sentinel L1.5',
      audit_completed_at: '2026-08-10T12:00:00Z',
      static_checks: {
        metadata: true,
        semgrep_rules_count: 36,
        secret_patterns_count: 18,
        dependency_scan: true,
        malware_patterns_count: 8,
        malware_family_signatures_count: 48,
        prompt_injection_rules_count: 32,
      },
      dynamic_checks: {
        sandbox_run: true,
        sandbox_runtime_ms: 12453,
        sandbox_exit_code: 0,
        sandbox_network_blocked: true,
        sandbox_fs_read_only: true,
        sandbox_cap_drop_all: true,
      },
      runtime_checks: { interceptor_rules_count: 5, interceptor_blocks: 0, interceptor_warns: 0 },
      findings: [],
    },
    risk: {
      trust_score: 9,
      risk_level: 'low',
      score_explanation: 'clean',
      scored_at: '2026-08-10T12:01:00Z',
    },
  });

  const result = verifyATCSync(atc);
  assert(result.valid === false, 'Invalid card_id fails');
  assert(result.errors.some(e => e.includes('card_id must match')), 'card_id pattern error reported');
}

// ─── Test 5: Invalid capability enum fails ─────────────────────────────────
console.log('\nTest 5: Invalid capability enum');
{
  const ca = generateKeyPair();
  const agent = generateKeyPair();
  const atc = issueATC(ca, agent, {
    card_id: 'ATC-2026-0000005',
    identity: { agent_id: 'test-005', agent_name: 'Test', agent_owner: 'Org' },
    capabilities: {
      filesystem: { read: 'everything', write: 'own_dir' }, // 'everything' is not valid
      network: { egress: 'allowlist', ingress: 'none' },
      shell: { exec: 'sandboxed', spawn: 'none' },
      credentials: { read_env: 'none', read_files: 'none' },
      process: { subprocess: 'none', signals: 'own' },
    },
    evidence: {
      audit_pipeline: 'Sentinel L1.5',
      audit_completed_at: '2026-08-10T12:00:00Z',
      static_checks: {
        metadata: true,
        semgrep_rules_count: 36,
        secret_patterns_count: 18,
        dependency_scan: true,
        malware_patterns_count: 8,
        malware_family_signatures_count: 48,
        prompt_injection_rules_count: 32,
      },
      dynamic_checks: {
        sandbox_run: true,
        sandbox_runtime_ms: 12453,
        sandbox_exit_code: 0,
        sandbox_network_blocked: true,
        sandbox_fs_read_only: true,
        sandbox_cap_drop_all: true,
      },
      runtime_checks: { interceptor_rules_count: 5, interceptor_blocks: 0, interceptor_warns: 0 },
      findings: [],
    },
    risk: {
      trust_score: 9,
      risk_level: 'low',
      score_explanation: 'clean',
      scored_at: '2026-08-10T12:01:00Z',
    },
  });

  const result = verifyATCSync(atc);
  assert(result.valid === false, 'Invalid enum fails');
  assert(result.controls_failed.includes('ATC-003'), 'ATC-003 failed');
}

// ─── Test 6: Trust score out of range ──────────────────────────────────────
console.log('\nTest 6: Trust score out of range');
{
  const ca = generateKeyPair();
  const agent = generateKeyPair();
  const atc = issueATC(ca, agent, {
    card_id: 'ATC-2026-0000006',
    identity: { agent_id: 'test-006', agent_name: 'Test', agent_owner: 'Org' },
    capabilities: {
      filesystem: { read: 'own_dir', write: 'own_dir' },
      network: { egress: 'allowlist', ingress: 'none' },
      shell: { exec: 'sandboxed', spawn: 'none' },
      credentials: { read_env: 'none', read_files: 'none' },
      process: { subprocess: 'none', signals: 'own' },
    },
    evidence: {
      audit_pipeline: 'Sentinel L1.5',
      audit_completed_at: '2026-08-10T12:00:00Z',
      static_checks: {
        metadata: true,
        semgrep_rules_count: 36,
        secret_patterns_count: 18,
        dependency_scan: true,
        malware_patterns_count: 8,
        malware_family_signatures_count: 48,
        prompt_injection_rules_count: 32,
      },
      dynamic_checks: {
        sandbox_run: true,
        sandbox_runtime_ms: 12453,
        sandbox_exit_code: 0,
        sandbox_network_blocked: true,
        sandbox_fs_read_only: true,
        sandbox_cap_drop_all: true,
      },
      runtime_checks: { interceptor_rules_count: 5, interceptor_blocks: 0, interceptor_warns: 0 },
      findings: [],
    },
    risk: {
      trust_score: 15, // out of range
      risk_level: 'low',
      score_explanation: 'clean',
      scored_at: '2026-08-10T12:01:00Z',
    },
  });

  // Need to re-sign because we modified after issueATC (issueATC clamps to 10 via the spread, but let's force a bad value)
  atc.risk.trust_score = 15;
  resignATC(atc, ca);
  const result = verifyATCSync(atc);
  assert(result.valid === false, 'trust_score=15 fails');
  assert(result.controls_failed.includes('ATC-005'), 'ATC-005 failed');
}

// ─── Test 7: Expiration in the past ────────────────────────────────────────
console.log('\nTest 7: ATC expired');
{
  const ca = generateKeyPair();
  const agent = generateKeyPair();
  const atc = issueATC(ca, agent, {
    card_id: 'ATC-2026-0000007',
    identity: { agent_id: 'test-007', agent_name: 'Test', agent_owner: 'Org' },
    capabilities: {
      filesystem: { read: 'own_dir', write: 'own_dir' },
      network: { egress: 'allowlist', ingress: 'none' },
      shell: { exec: 'sandboxed', spawn: 'none' },
      credentials: { read_env: 'none', read_files: 'none' },
      process: { subprocess: 'none', signals: 'own' },
    },
    evidence: {
      audit_pipeline: 'Sentinel L1.5',
      audit_completed_at: '2026-08-10T12:00:00Z',
      static_checks: {
        metadata: true,
        semgrep_rules_count: 36,
        secret_patterns_count: 18,
        dependency_scan: true,
        malware_patterns_count: 8,
        malware_family_signatures_count: 48,
        prompt_injection_rules_count: 32,
      },
      dynamic_checks: {
        sandbox_run: true,
        sandbox_runtime_ms: 12453,
        sandbox_exit_code: 0,
        sandbox_network_blocked: true,
        sandbox_fs_read_only: true,
        sandbox_cap_drop_all: true,
      },
      runtime_checks: { interceptor_rules_count: 5, interceptor_blocks: 0, interceptor_warns: 0 },
      findings: [],
    },
    risk: {
      trust_score: 9,
      risk_level: 'low',
      score_explanation: 'clean',
      scored_at: '2026-08-10T12:01:00Z',
    },
    validity: {
      issued_at: '2026-01-01T00:00:00Z',
      expires_at: '2026-01-02T00:00:00Z',
      max_ttl_days: 1,
    },
  });

  const result = verifyATCSync(atc);
  assert(result.valid === false, 'Expired ATC fails');
  assert(result.controls_failed.includes('ATC-008'), 'ATC-008 failed');
  assert(result.errors.some(e => e.includes('ATC expired')), 'Expiration error reported');
}

// ─── Test 8: Missing required fields ───────────────────────────────────────
console.log('\nTest 8: Missing required fields');
{
  const result = verifyATCSync({ spec_version: 'ATC/1.0' });
  assert(result.valid === false, 'Empty ATC fails');
  assert(result.controls_failed.length === 8, 'All 8 controls fail');
}

console.log('\n=== Summary ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
