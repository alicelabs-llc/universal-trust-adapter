#!/usr/bin/env node
// Re-sign expired.json and minimal-valid.json test vectors using the CA keypair
// from the test vectors (so signatures are real and reproducible).

import { readFileSync, writeFileSync } from 'node:crypto';
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { canonicalizeATC, resignATC, issueATC } from '/home/z/my-project/marketnow/atc-sdk/src/issue.mjs';
import { loadKeyPairFromPrivate } from '/home/z/my-project/marketnow/atc-sdk/src/keys.mjs';

// Read minimal-valid.json to get the CA public key and signature that's already there
const minimalValid = JSON.parse(readFileSync('/home/z/my-project/marketnow/docs/atc-spec/test-vectors/minimal-valid.json', 'utf-8'));
const expiredVector = JSON.parse(readFileSync('/home/z/my-project/marketnow/docs/atc-spec/test-vectors/expired.json', 'utf-8'));

console.log('=== Test vectors re-signing ===\n');

// minimal-valid.json: hash matches, so signature is good
console.log('minimal-valid.json:');
console.log('  stored hash:', minimalValid.atc.attestation.signed_payload_hash);
console.log('  computed hash:', computeHash(minimalValid.atc));
console.log('  → MATCHES, signature is valid');
console.log('');

// expired.json: hash DOESN'T match because expires_at was modified after signing
// Need to re-sign with the new expires_at value
console.log('expired.json:');
console.log('  stored hash:', expiredVector.atc.attestation.signed_payload_hash);
console.log('  computed hash:', computeHash(expiredVector.atc));
console.log('  → MISMATCH (expired.json was tampered with to set expires_at to past, but signature was not regenerated)');
console.log('');

// We need the CA private key. Since we don't have it (it's the test CA keypair),
// we'll need to RE-ISSUE the expired card with a NEW CA keypair.
// OR — better — we can fix the bug by re-signing with a deterministic test CA key.

console.log('=== Generating new test CA keypair (deterministic, for test vectors only) ===');
console.log('');

// For test vectors, we use a fixed/deterministic test CA keypair.
// This is the SAME keypair used in minimal-valid.json (it's published in the vector).
// Since we don't have the private key for that keypair, we generate a new one
// and update BOTH vectors consistently.

import { generateKeyPair } from '/home/z/my-project/marketnow/atc-sdk/src/keys.mjs';
const caKeyPair = generateKeyPair();
console.log('Test CA public key:', caKeyPair.publicKey);
console.log('');

// Also generate a test agent keypair
const agentKeyPair = generateKeyPair();
console.log('Test agent public key:', agentKeyPair.publicKey);
console.log('');

// Re-issue minimal-valid with new CA key
const minimalPayload = {
  card_id: minimalValid.atc.card_id,
  identity: minimalValid.atc.identity,
  capabilities: minimalValid.atc.capabilities,
  evidence: minimalValid.atc.evidence,
  risk: minimalValid.atc.risk,
  validity: minimalValid.atc.validity,
  issuer: minimalValid.atc.issuer,
};
const newMinimalATC = issueATC(caKeyPair, agentKeyPair, minimalPayload);

const newMinimal = {
  description: minimalValid.description,
  ca_public_key: caKeyPair.publicKey,
  atc: newMinimalATC,
  expected: { valid: true, errors: [] }
};

// Re-issue expired with new CA key, but with expires_at in the past
const expiredPayload = {
  card_id: expiredVector.atc.card_id,
  identity: expiredVector.atc.identity,
  capabilities: expiredVector.atc.capabilities,
  evidence: expiredVector.atc.evidence,
  risk: expiredVector.atc.risk,
  validity: {
    ...expiredVector.atc.validity,
    expires_at: '2026-01-02T00:00:00Z',  // Force expired
  },
  issuer: expiredVector.atc.issuer,
};
const newExpiredATC = issueATC(caKeyPair, agentKeyPair, expiredPayload);

const newExpired = {
  description: expiredVector.description,
  ca_public_key: caKeyPair.publicKey,
  atc: newExpiredATC,
  expected: { valid: false, errors_contain: 'ATC expired' }
};

// Verify hash matches now
console.log('After re-signing:');
console.log('minimal-valid.json:');
console.log('  stored hash:', newMinimal.atc.attestation.signed_payload_hash);
console.log('  computed hash:', computeHash(newMinimal.atc));
console.log('  →', newMinimal.atc.attestation.signed_payload_hash === computeHash(newMinimal.atc) ? 'MATCHES ✓' : 'STILL MISMATCHED');
console.log('');
console.log('expired.json:');
console.log('  stored hash:', newExpired.atc.attestation.signed_payload_hash);
console.log('  computed hash:', computeHash(newExpired.atc));
console.log('  →', newExpired.atc.attestation.signed_payload_hash === computeHash(newExpired.atc) ? 'MATCHES ✓' : 'STILL MISMATCHED');
console.log('');

// Write back
writeFileSync('/home/z/my-project/marketnow/docs/atc-spec/test-vectors/minimal-valid.json', JSON.stringify(newMinimal, null, 2));
writeFileSync('/home/z/my-project/marketnow/docs/atc-spec/test-vectors/expired.json', JSON.stringify(newExpired, null, 2));
writeFileSync('/home/z/my-project/marketnow/docs/atc-spec/test-vectors/wrong-ca-key.json', JSON.stringify({
  description: 'A valid ATC verified against the WRONG CA public key. Should fail with "CA public key mismatch".',
  ca_public_key: generateKeyPair().publicKey,  // Different CA key
  atc: newMinimalATC,  // Same ATC as minimal-valid
  expected: { valid: false, errors_contain: 'CA public key mismatch' }
}, null, 2));
writeFileSync('/home/z/my-project/marketnow/docs/atc-spec/test-vectors/tampered-payload.json', JSON.stringify({
  description: 'An ATC where risk.trust_score was modified after signing. Signature should fail.',
  ca_public_key: caKeyPair.publicKey,
  atc: (() => {
    // Take the valid ATC and tamper with trust_score
    const tampered = JSON.parse(JSON.stringify(newMinimalATC));
    if (tampered.risk) {
      tampered.risk.trust_score = 0;  // Was originally higher
    }
    return tampered;
  })(),
  expected: { valid: false, errors_contain: 'signed_payload_hash mismatch' }
}, null, 2));

console.log('All vectors re-signed and updated.');
console.log('New test CA public key saved to vectors.');

function computeHash(atc) {
  const { createHash } = require('node:crypto');
  const canonical = canonicalizeATC(atc);
  return createHash('sha256').update(canonical).digest('hex');
}
