#!/usr/bin/env node
// Generate canonical JCS bytes + SHA-256 hashes for all ATC test vectors
// This is what @anp2network asked for:
//   "record the canonical JCS bytes per vector as hex or base64, alongside the SHA-256"

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalizeATC, computePayloadHash } from '/home/z/my-project/marketnow/atc-sdk/src/issue.mjs';
import { verifyATCSync } from '/home/z/my-project/marketnow/atc-sdk/src/verify.mjs';

const VECTORS_DIR = '/home/z/my-project/marketnow/docs/atc-spec/test-vectors';
const OUTPUT_PATH = '/home/z/my-project/marketnow/docs/atc-spec/test-vectors/_index.json';

console.log('=== Generating canonical JCS bytes + SHA-256 for test vectors ===\n');

// Read all vector files
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
  description: 'Frozen, immutable test vectors for ATC/1.0 verifiers. Each vector includes the canonical JCS bytes (hex) and SHA-256 hash that an independent verifier can use to reproduce the signature verification step.',
  vectors: []
};

for (const filename of vectorFiles) {
  const filepath = `${VECTORS_DIR}/${filename}`;
  const raw = readFileSync(filepath, 'utf-8');
  const data = JSON.parse(raw);

  console.log(`Processing ${filename}...`);
  console.log(`  Description: ${data.description || '(no description)'}`);

  // For vectors that have an ATC payload
  if (data.atc) {
    try {
      // Compute canonical JCS bytes
      const canonicalBytes = canonicalizeATC(data.atc);
      const sha256 = createHash('sha256').update(canonicalBytes).digest('hex');
      
      // Convert canonical string to hex
      const canonicalHex = Buffer.from(canonicalBytes, 'utf-8').toString('hex');
      const canonicalBase64 = Buffer.from(canonicalBytes, 'utf-8').toString('base64');
      
      const vectorEntry = {
        name: filename.replace('.json', ''),
        file: filename,
        path: `marketnow/docs/atc-spec/test-vectors/${filename}`,
        description: data.description,
        ca_public_key: data.ca_public_key,
        expected: data.expected,
        canonical: {
          algorithm: 'RFC 8785 JCS',
          bytes_utf8: canonicalBytes,
          bytes_hex: canonicalHex,
          bytes_base64: canonicalBase64,
          byte_length: canonicalBytes.length,
        },
        sha256: sha256,
        signature: data.atc.attestation?.signature || null,
        signed_payload_hash_in_card: data.atc.attestation?.signed_payload_hash || null,
        notes: []
      };

      // Cross-check: does the stored hash match computed?
      const storedHash = data.atc.attestation?.signed_payload_hash;
      if (storedHash && storedHash !== sha256) {
        vectorEntry.notes.push(`NOTE: stored signed_payload_hash (${storedHash}) does NOT match computed hash (${sha256}). This may indicate the card was signed with a different canonicalization function — see https://github.com/eddyflores100-lang/universal-trust-adapter/issues for context.`);
      } else if (storedHash === sha256) {
        vectorEntry.notes.push('stored signed_payload_hash MATCHES computed SHA-256 ✓');
      }
      
      index.vectors.push(vectorEntry);
      console.log(`  ✓ SHA-256: ${sha256}`);
      console.log(`  ✓ Canonical bytes: ${canonicalBytes.length} bytes (hex: ${canonicalHex.length} chars)`);
      console.log(`  ✓ Expected: ${data.expected?.result || 'unknown'}`);
    } catch (err) {
      console.log(`  ✗ ERROR: ${err.message}`);
      index.vectors.push({
        name: filename.replace('.json', ''),
        file: filename,
        error: err.message
      });
    }
  } else {
    // capability-samples.json doesn't have ATCs, just samples
    console.log(`  (no ATC payload — skipping canonicalization)`);
    index.vectors.push({
      name: filename.replace('.json', ''),
      file: filename,
      description: data.description,
      note: 'No ATC payload — capability samples only, no canonicalization needed.'
    });
  }
  console.log('');
}

// Write index file
writeFileSync(OUTPUT_PATH, JSON.stringify(index, null, 2));
console.log(`✓ Wrote ${OUTPUT_PATH}`);
console.log(`  ${index.vectors.length} vectors indexed`);
console.log('');
console.log('=== Summary ===');
let passExpected = 0, failExpected = 0, withCanonical = 0;
for (const v of index.vectors) {
  if (v.canonical) withCanonical++;
  if (v.expected?.result === 'pass') passExpected++;
  if (v.expected?.result === 'fail') failExpected++;
}
console.log(`  Vectors with canonical bytes: ${withCanonical}`);
console.log(`  Expected to PASS: ${passExpected}`);
console.log(`  Expected to FAIL: ${failExpected}`);
