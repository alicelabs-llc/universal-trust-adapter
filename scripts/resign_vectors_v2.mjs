#!/usr/bin/env node
// Re-sign test vectors with a fresh deterministic test CA keypair
// so all 4 vectors share the same CA and the signed_payload_hash actually matches.

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalizeATC, issueATC } from '/home/z/my-project/marketnow/atc-sdk/src/issue.mjs';
import { generateKeyPair } from '/home/z/my-project/marketnow/atc-sdk/src/keys.mjs';

const VECTORS_DIR = '/home/z/my-project/marketnow/docs/atc-spec/test-vectors';

console.log('=== Re-signing test vectors with fresh test CA keypair ===\n');

// Generate ONE test CA keypair (used for all signed vectors)
const caKeyPair = generateKeyPair();
const agentKeyPair = generateKeyPair();

console.log(`Test CA public key:  ${caKeyPair.publicKey}`);
console.log(`Test agent pub key:  ${agentKeyPair.publicKey}`);
console.log('');

// === 1. minimal-valid.json ===
const minimalOrig = JSON.parse(readFileSync(`${VECTORS_DIR}/minimal-valid.json`, 'utf-8'));
const minimalPayload = {
  card_id: minimalOrig.atc.card_id,
  identity: minimalOrig.atc.identity,
  capabilities: minimalOrig.atc.capabilities,
  evidence: minimalOrig.atc.evidence,
  risk: minimalOrig.atc.risk,
  validity: minimalOrig.atc.validity,
  issuer: minimalOrig.atc.issuer,
};
const minimalATC = issueATC(caKeyPair, agentKeyPair, minimalPayload);
const minimalVector = {
  description: minimalOrig.description,
  ca_public_key: caKeyPair.publicKey,
  atc: minimalATC,
  expected: { valid: true, errors: [] }
};
writeFileSync(`${VECTORS_DIR}/minimal-valid.json`, JSON.stringify(minimalVector, null, 2));
console.log('✓ minimal-valid.json re-signed');
console.log(`  signed_payload_hash: ${minimalATC.attestation.signed_payload_hash}`);
console.log(`  computed SHA-256:    ${computeHash(minimalATC)}`);
console.log(`  match: ${minimalATC.attestation.signed_payload_hash === computeHash(minimalATC) ? 'YES ✓' : 'NO ✗'}`);
console.log('');

// === 2. expired.json (same ATC as minimal-valid, but expires_at in the past) ===
const expiredATC = issueATC(caKeyPair, agentKeyPair, {
  ...minimalPayload,
  validity: {
    ...minimalPayload.validity,
    expires_at: '2026-01-02T00:00:00Z',  // Force expired
  },
});
const expiredVector = {
  description: 'An ATC with expires_at in the past (2026-01-02). Should fail with "ATC expired".',
  ca_public_key: caKeyPair.publicKey,
  atc: expiredATC,
  expected: { valid: false, errors_contain: 'ATC expired' }
};
writeFileSync(`${VECTORS_DIR}/expired.json`, JSON.stringify(expiredVector, null, 2));
console.log('✓ expired.json re-signed');
console.log(`  signed_payload_hash: ${expiredATC.attestation.signed_payload_hash}`);
console.log(`  computed SHA-256:    ${computeHash(expiredATC)}`);
console.log(`  match: ${expiredATC.attestation.signed_payload_hash === computeHash(expiredATC) ? 'YES ✓' : 'NO ✗'}`);
console.log('');

// === 3. tampered-payload.json (same ATC as minimal-valid, but risk.trust_score modified AFTER signing) ===
const tamperedATC = JSON.parse(JSON.stringify(minimalATC));
if (!tamperedATC.risk) tamperedATC.risk = {};
tamperedATC.risk.trust_score = (tamperedATC.risk.trust_score || 8) - 5;  // Change the value
const tamperedVector = {
  description: 'An ATC where risk.trust_score was modified after signing. The signed_payload_hash and signature should fail to verify.',
  ca_public_key: caKeyPair.publicKey,
  atc: tamperedATC,
  expected: { valid: false, errors_contain: 'signed_payload_hash mismatch' }
};
writeFileSync(`${VECTORS_DIR}/tampered-payload.json`, JSON.stringify(tamperedVector, null, 2));
console.log('✓ tampered-payload.json re-signed (intentionally broken signature)');
console.log(`  original signed_payload_hash: ${minimalATC.attestation.signed_payload_hash}`);
console.log(`  recomputed SHA-256 (post-tamper): ${computeHash(tamperedATC)}`);
console.log(`  match (should be NO): ${tamperedATC.attestation.signed_payload_hash === computeHash(tamperedATC) ? 'YES (unexpected!)' : 'NO ✓ (tampering detected)'}`);
console.log('');

// === 4. wrong-ca-key.json (same ATC as minimal-valid, but verified with WRONG CA key) ===
const otherCA = generateKeyPair();
const wrongCaVector = {
  description: 'A valid ATC verified against the WRONG CA public key. Should fail with "CA public key mismatch".',
  ca_public_key: otherCA.publicKey,  // Different CA key
  atc: minimalATC,  // Same valid ATC
  expected: { valid: false, errors_contain: 'CA public key mismatch' }
};
writeFileSync(`${VECTORS_DIR}/wrong-ca-key.json`, JSON.stringify(wrongCaVector, null, 2));
console.log('✓ wrong-ca-key.json updated');
console.log(`  ATC signed by: ${caKeyPair.publicKey.slice(0, 30)}...`);
console.log(`  Vector's ca_public_key: ${otherCA.publicKey.slice(0, 30)}...`);
console.log(`  These are DIFFERENT (test will fail with CA mismatch) ✓`);
console.log('');

// Save the test CA private key so anp2network (or anyone) can re-derive signatures
const testCAManifest = {
  schema: 'atc-test-ca-manifest/v1',
  description: 'Test CA keypair for ATC/1.0 test vectors. This is a TEST keypair — do not use in production.',
  generated_at: new Date().toISOString(),
  ca_algorithm: 'Ed25519 (RFC 8032)',
  ca_public_key_spki_base64: caKeyPair.publicKey,
  ca_private_key_pkcs8_base64: caKeyPair.privateKey,
  agent_public_key_spki_base64: agentKeyPair.publicKey,
  agent_private_key_pkcs8_base64: agentKeyPair.privateKey,
  note: 'These keys are intentionally published so anyone can re-derive signatures in any language (Python, Go, Rust) and verify the ATC test vectors reproducibly.'
};
writeFileSync(`${VECTORS_DIR}/_test-ca-keys.json`, JSON.stringify(testCAManifest, null, 2));
console.log('✓ _test-ca-keys.json saved (test CA private key published for reproducibility)');
console.log('');

console.log('=== Done. All vectors re-signed and verified. ===');
console.log('Commit and push these to GitHub so anp2network can fetch them.');

function computeHash(atc) {
  const canonical = canonicalizeATC(atc);
  return createHash('sha256').update(canonical).digest('hex');
}
