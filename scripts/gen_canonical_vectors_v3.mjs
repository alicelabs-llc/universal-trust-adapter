#!/usr/bin/env node
// Generate _index.json with canonical bytes, SHA-256, AND verification results
// This gives anp2network everything they need in one file.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalizeATC } from '/home/z/my-project/marketnow/atc-sdk/src/issue.mjs';
import { verifyATCSync } from '/home/z/my-project/marketnow/atc-sdk/src/verify.mjs';

const VECTORS_DIR = '/home/z/my-project/marketnow/docs/atc-spec/test-vectors';
const OUTPUT_PATH = `${VECTORS_DIR}/_index.json`;

console.log('=== Generating comprehensive _index.json ===\n');

const vectorFiles = readdirSync(VECTORS_DIR)
  .filter(f => f.endsWith('.json') && f !== '_index.json')
  .sort();

const index = {
  schema: 'atc-test-vectors-index/v1',
  generated_at: new Date().toISOString(),
  spec_version: 'ATC/1.0',
  canonicalization: 'RFC 8785 JCS (JSON Canonicalization Scheme)',
  hash_algorithm: 'SHA-256',
  signature_algorithm: 'Ed25519 (RFC 8032)',
  description: 'Frozen, immutable test vectors for ATC/1.0 verifiers. Each vector includes (1) the canonical JCS bytes (hex + base64 + utf8), (2) the SHA-256 of those canonical bytes, (3) the signature, (4) the expected verification outcome. An independent verifier in any language can reproduce the canonical bytes from the ATC JSON, hash them, and compare.',
  how_to_use: [
    '1. Fetch any vector file (e.g., minimal-valid.json) from this directory.',
    '2. Apply RFC 8785 JCS to the ATC payload with attestation.signature="" and attestation.signed_payload_hash=""',
    '3. Compute SHA-256 of the canonical bytes.',
    '4. Compare to the SHA-256 listed in this _index.json (should match).',
    '5. Compare to the signed_payload_hash stored in the ATC (should also match, except for tampered-payload).',
    '6. To verify the signature: use the ca_public_key (Ed25519 SPKI base64) to verify the signature over the canonical bytes.'
  ],
  test_ca_keys_file: '_test-ca-keys.json',
  test_ca_keys_note: 'The test CA keypair (including private key) is published in _test-ca-keys.json so any third party can re-derive signatures in any language. These are TEST keys only — never use in production.',
  vectors: []
};

for (const filename of vectorFiles) {
  const filepath = `${VECTORS_DIR}/${filename}`;
  const raw = readFileSync(filepath, 'utf-8');
  const data = JSON.parse(raw);

  console.log(`Processing ${filename}...`);

  if (filename === '_test-ca-keys.json') {
    index.test_ca = {
      public_key_spki_base64: data.ca_public_key_spki_base64,
      algorithm: data.ca_algorithm,
      note: data.note
    };
    continue;
  }

  if (!data.atc) {
    index.vectors.push({
      name: filename.replace('.json', ''),
      file: filename,
      description: data.description,
      note: 'No ATC payload — capability samples only, no canonicalization needed.'
    });
    console.log(`  (no ATC — skipped)`);
    continue;
  }

  try {
    // Canonicalize and hash
    const canonicalBytes = canonicalizeATC(data.atc);
    const sha256 = createHash('sha256').update(canonicalBytes).digest('hex');
    const canonicalHex = Buffer.from(canonicalBytes, 'utf-8').toString('hex');
    const canonicalBase64 = Buffer.from(canonicalBytes, 'utf-8').toString('base64');

    // Verify using our own verifier
    let verifyResult;
    try {
      verifyResult = verifyATCSync(data.atc, { ca_public_key: data.ca_public_key });
    } catch (err) {
      verifyResult = { valid: false, errors: [err.message] };
    }

    const storedHash = data.atc.attestation?.signed_payload_hash;
    const storedHashMatches = storedHash === sha256;

    const vectorEntry = {
      name: filename.replace('.json', ''),
      file: filename,
      path: `marketnow/docs/atc-spec/test-vectors/${filename}`,
      description: data.description,
      ca_public_key_spki_base64: data.ca_public_key,
      atc_card_id: data.atc.card_id,
      atc_spec_version: data.atc.spec_version,
      expected: data.expected,
      canonical: {
        algorithm: 'RFC 8785 JCS',
        bytes_utf8: canonicalBytes,
        bytes_hex: canonicalHex,
        bytes_base64: canonicalBase64,
        byte_length: canonicalBytes.length,
      },
      sha256: sha256,
      signature_base64: data.atc.attestation?.signature || null,
      stored_signed_payload_hash: storedHash,
      stored_hash_matches_computed: storedHashMatches,
      notes: []
    };

    // Add notes about hash matching
    if (storedHashMatches) {
      vectorEntry.notes.push('stored signed_payload_hash MATCHES computed SHA-256 ✓');
    } else {
      vectorEntry.notes.push(`stored signed_payload_hash does NOT match computed hash. This is INTENTIONAL for tampered-payload.json (the test demonstrates that tampering invalidates the signature).`);
    }

    // Add verification result
    vectorEntry.verification_with_our_sdk = {
      valid: verifyResult.valid,
      errors: verifyResult.errors || [],
      error_count: verifyResult.errors?.length || 0,
      expected_to_be_valid: data.expected?.valid === true,
      matches_expected: verifyResult.valid === (data.expected?.valid === true),
    };

    if (verifyResult.valid === (data.expected?.valid === true)) {
      vectorEntry.notes.push(`SDK verification result MATCHES expected outcome ✓`);
    } else {
      vectorEntry.notes.push(`SDK verification result does NOT match expected outcome — investigation needed`);
    }

    index.vectors.push(vectorEntry);
    console.log(`  ✓ SHA-256: ${sha256}`);
    console.log(`  ✓ Canonical: ${canonicalBytes.length} bytes`);
    console.log(`  ✓ Stored hash matches: ${storedHashMatches ? 'YES' : 'NO (intentional for tampered-payload)'}`);
    console.log(`  ✓ SDK verify result: ${verifyResult.valid} (expected ${data.expected?.valid})`);
    console.log('');
  } catch (err) {
    console.log(`  ✗ ERROR: ${err.message}`);
    index.vectors.push({
      name: filename.replace('.json', ''),
      file: filename,
      error: err.message
    });
  }
}

writeFileSync(OUTPUT_PATH, JSON.stringify(index, null, 2));
console.log(`✓ Wrote ${OUTPUT_PATH}`);
console.log(`  ${index.vectors.length} vectors indexed`);
console.log('');
console.log('=== Summary ===');
let passExpected = 0, failExpected = 0, withCanonical = 0;
for (const v of index.vectors) {
  if (v.canonical) withCanonical++;
  if (v.expected?.result === 'pass' || v.expected?.valid === true) passExpected++;
  if (v.expected?.result === 'fail' || v.expected?.valid === false) failExpected++;
}
console.log(`  Vectors with canonical bytes: ${withCanonical}`);
console.log(`  Expected to PASS: ${passExpected}`);
console.log(`  Expected to FAIL: ${failExpected}`);
