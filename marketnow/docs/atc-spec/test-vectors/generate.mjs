#!/usr/bin/env node
/**
 * ATC/1.0 Test Vectors Generator
 *
 * Generates deterministic test vectors for the conformance test suite.
 * Output: ./test-vectors/*.json
 *
 * Run:  node ./test-vectors/generate.mjs
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateCAKeyPair,
  generateAgentKeyPair,
  issueATC,
  verifyATC,
} from '../reference-impl/atc-1.0.mjs';
import canonicalize from 'canonicalize';
import { createHash, sign as edSign } from 'node:crypto';

const VECTORS_DIR = fileURLToPath(new URL('./', import.meta.url));

console.log('=== ATC/1.0 Test Vectors Generator ===\n');

// Generate fresh keypairs
const caKeyPair = generateCAKeyPair();
const agentKeyPair = generateAgentKeyPair();

console.log('CA public key:', caKeyPair.publicKey);
console.log('Agent public key:', agentKeyPair.publicKey);
console.log('');

// ─── Test vector 1: a minimal valid ATC ────────────────────────────────────
const minimalPayload = {
  card_id: 'ATC-2026-0000001',
  identity: {
    agent_id: 'alicelabs-test-agent-001',
    agent_name: 'Test Agent',
    agent_owner: 'AliceLabs LLC',
    owner_contact: 'mailto:test@alicelabs.site',
  },
  capabilities: {
    filesystem: { read: 'own_dir', write: 'own_dir' },
    network: { egress: 'allowlist', ingress: 'none' },
    shell: { exec: 'sandboxed', spawn: 'none' },
    credentials: { read_env: 'allowlist', read_files: 'none' },
    process: { subprocess: 'none', signals: 'own' },
  },
  evidence: {
    audit_pipeline: 'Sentinel L1.5 → L1.9 → L2.5 → L3',
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
    runtime_checks: {
      interceptor_rules_count: 5,
      interceptor_blocks: 0,
      interceptor_warns: 0,
    },
    findings: [],
  },
  risk: {
    trust_score: 9,
    risk_level: 'low',
    score_explanation: 'Clean audit, no findings, sandbox passed',
    scored_at: '2026-08-10T12:01:00Z',
  },
};

const minimalATC = issueATC(caKeyPair, agentKeyPair, minimalPayload);
console.log('Issued minimal ATC:', minimalATC.card_id);
console.log('  signature:', minimalATC.attestation.signature.slice(0, 32) + '...');
console.log('  signed_payload_hash:', minimalATC.attestation.signed_payload_hash);
console.log('');

// Verify it
const verifyResult = verifyATC(minimalATC, caKeyPair.publicKey);
console.log('Verification (minimal valid):', verifyResult);
if (!verifyResult.valid) {
  console.error('FAIL: minimal valid ATC did not verify');
  process.exit(1);
}

writeFileSync(join(VECTORS_DIR, 'minimal-valid.json'), JSON.stringify({
  description: 'A minimal valid ATC/1.0 card. Should pass all verification checks.',
  ca_public_key: caKeyPair.publicKey,
  atc: minimalATC,
  expected: { valid: true, errors: [] },
}, null, 2));
console.log('Saved: minimal-valid.json\n');

// ─── Test vector 2: tampered ATC (signature should fail) ────────────────────
const tamperedATC = JSON.parse(JSON.stringify(minimalATC));
tamperedATC.risk.trust_score = 1;  // Was 9 — should invalidate signature
const tamperedVerify = verifyATC(tamperedATC, caKeyPair.publicKey);
console.log('Verification (tampered):', tamperedVerify);
if (tamperedVerify.valid) {
  console.error('FAIL: tampered ATC verified as valid');
  process.exit(1);
}

writeFileSync(join(VECTORS_DIR, 'tampered-payload.json'), JSON.stringify({
  description: 'An ATC where risk.trust_score was modified after signing. Signature should fail.',
  ca_public_key: caKeyPair.publicKey,
  atc: tamperedATC,
  expected: { valid: false, errors_contain: 'signed_payload_hash mismatch' },
}, null, 2));
console.log('Saved: tampered-payload.json\n');

// ─── Test vector 3: expired ATC ────────────────────────────────────────────
const expiredPayload = JSON.parse(JSON.stringify(minimalPayload));
expiredPayload.validity = { max_ttl_days: 1 };
const expiredATC = issueATC(caKeyPair, agentKeyPair, expiredPayload);

// Override timestamps to be in the past, then re-sign
expiredATC.validity.issued_at = '2026-01-01T00:00:00Z';
expiredATC.validity.expires_at = '2026-01-02T00:00:00Z';

const expiredCanon = canonicalize(JSON.parse(JSON.stringify({
  ...expiredATC,
  attestation: { ...expiredATC.attestation, signature: '' },
})));
expiredATC.attestation.signed_payload_hash = createHash('sha256').update(expiredCanon).digest('hex');
expiredATC.attestation.signature = edSign(null, Buffer.from(expiredCanon, 'utf8'), caKeyPair.rawPrivateKey).toString('base64');

const expiredVerify = verifyATC(expiredATC, caKeyPair.publicKey);
console.log('Verification (expired):', expiredVerify);
if (expiredVerify.valid) {
  console.error('FAIL: expired ATC verified as valid');
  process.exit(1);
}

writeFileSync(join(VECTORS_DIR, 'expired.json'), JSON.stringify({
  description: 'An ATC with expires_at in the past (2026-01-02). Should fail with "ATC expired".',
  ca_public_key: caKeyPair.publicKey,
  atc: expiredATC,
  expected: { valid: false, errors_contain: 'ATC expired' },
}, null, 2));
console.log('Saved: expired.json\n');

// ─── Test vector 4: wrong CA public key ─────────────────────────────────────
const wrongCA = generateCAKeyPair();
const wrongCAVerify = verifyATC(minimalATC, wrongCA.publicKey);
console.log('Verification (wrong CA):', wrongCAVerify);
if (wrongCAVerify.valid) {
  console.error('FAIL: ATC verified against wrong CA key');
  process.exit(1);
}

writeFileSync(join(VECTORS_DIR, 'wrong-ca-key.json'), JSON.stringify({
  description: 'A valid ATC verified against the WRONG CA public key. Should fail with "CA public key mismatch".',
  ca_public_key: wrongCA.publicKey,
  atc: minimalATC,
  expected: { valid: false, errors_contain: 'CA public key mismatch' },
}, null, 2));
console.log('Saved: wrong-ca-key.json\n');

// ─── Test vector 5: capability manifest samples ────────────────────────────
writeFileSync(join(VECTORS_DIR, 'capability-samples.json'), JSON.stringify({
  description: 'Sample capability manifests covering the spectrum from minimal to full access.',
  samples: [
    {
      name: 'read-only agent (no writes, no network)',
      capabilities: {
        filesystem: { read: 'own_dir', write: 'none' },
        network: { egress: 'none', ingress: 'none' },
        shell: { exec: 'none', spawn: 'none' },
        credentials: { read_env: 'none', read_files: 'none' },
        process: { subprocess: 'none', signals: 'none' },
      },
    },
    {
      name: 'sandboxed dev agent',
      capabilities: {
        filesystem: { read: 'home_dir', write: 'temp_dir' },
        network: { egress: 'allowlist', ingress: 'none' },
        shell: { exec: 'sandboxed', spawn: 'none' },
        credentials: { read_env: 'allowlist', read_files: 'none' },
        process: { subprocess: 'sandboxed', signals: 'own' },
      },
    },
    {
      name: 'unrestricted agent (NOT RECOMMENDED — high blast radius)',
      capabilities: {
        filesystem: { read: 'all', write: 'all' },
        network: { egress: 'all', ingress: 'all' },
        shell: { exec: 'unrestricted', spawn: 'unrestricted' },
        credentials: { read_env: 'all', read_files: 'all' },
        process: { subprocess: 'unrestricted', signals: 'all' },
      },
    },
  ],
}, null, 2));
console.log('Saved: capability-samples.json\n');

console.log('=== All test vectors generated and verified ===');
