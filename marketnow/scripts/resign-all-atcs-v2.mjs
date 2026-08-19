#!/usr/bin/env node
/**
 * ATC Re-sign Script v2 — fixes @anp2network's forward-slash bug.
 *
 * Changes from v1:
 *   1. Uses the FIXED canonical-json.mjs (forward slash NOT escaped per RFC 8785 §3.2.2.2)
 *   2. Removes sentinel_score alias from payload BEFORE signing (was causing hash mismatch)
 *   3. Adds ca_key_id to each card's signature block
 *
 * Usage: node scripts/resign-all-atcs-v2.mjs
 */

import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalize } from '../aep-marketplace/lib/canonical-json.mjs';

const ATC_DIR = '/home/z/my-project/marketnow/aep-marketplace/public/api/atc';
const INDEX_PATH = '/home/z/my-project/marketnow/aep-marketplace/public/api/atc-index.json';
const CA_KEYPAIR_PATH = '/home/z/my-project/marketnow/_data/atc/ca-keypair.json';

console.log('=== ATC Re-sign v2 — forward-slash fix + alias removal ===\n');

// Step 1: Load existing CA keypair (generated in v1)
const caKeypair = JSON.parse(readFileSync(CA_KEYPAIR_PATH, 'utf8'));
const caPrivateKey = caKeypair.private_key_pem;
const caPublicKeyPem = caKeypair.public_key_pem;

// Import the private key
import { createPrivateKey, createPublicKey } from 'node:crypto';
const privateKey = createPrivateKey(caPrivateKey);
const publicKey = createPublicKey(caPublicKeyPem);

console.log('CA keypair loaded from', CA_KEYPAIR_PATH);
console.log('CA public key (first 40):', caKeypair.public_key_base64.slice(0, 40));
console.log('');

// Step 2: List all ATC files
const atcFiles = readdirSync(ATC_DIR).filter(f => f.endsWith('.json') && f.startsWith('ATC-'));
console.log('Found:', atcFiles.length, 'ATC files');

// Step 3: Re-sign each card with FIXED canonicalizer
console.log('\nRe-signing with corrected RFC 8785 JCS (no forward slash escaping)...');
let resigned = 0, failed = 0;
const errors = [];
const newIndexCards = [];

for (const file of atcFiles) {
  const filePath = join(ATC_DIR, file);
  try {
    const card = JSON.parse(readFileSync(filePath, 'utf8'));

    // Remove sentinel_score alias from payload BEFORE signing
    // (keep sentinel_review_score only — the alias was causing hash mismatch
    // because external verifiers see both fields but the signer should only
    // sign one)
    if (card.payload?.trust?.sentinel_score !== undefined) {
      delete card.payload.trust.sentinel_score;
    }

    // Canonicalize with FIXED canonicalizer (no forward slash escaping)
    const canonical = canonicalize(card.payload);
    const signature = sign(null, Buffer.from(canonical, 'utf8'), privateKey);
    const hash = createHash('sha256').update(canonical, 'utf8').digest('hex');

    // Update signature block
    card.signature.value = signature.toString('hex');
    card.signature.signed_payload_hash = hash;
    card.signature.canonical_json = 'RFC 8785 JCS (JSON Canonicalization Scheme)';
    card.signature.canonicalization_method = 'RFC_8785_JCS';
    card.signature.ca_key_id = caKeypair.public_key_base64.slice(0, 16); // key fingerprint
    card.signature.resigned_at = new Date().toISOString();
    card.signature.resign_reason = 'Aug 13, 2026: fixed forward-slash escaping per RFC 8785 §3.2.2.2, removed sentinel_score alias from signed payload, added ca_key_id. Bug reported by @anp2network.';

    writeFileSync(filePath, JSON.stringify(card, null, 2));
    resigned++;

    newIndexCards.push({
      card_id: card.card_id,
      status: card.status || 'active',
      agent_id: card.payload.agent_id,
      agent_name: card.payload.agent_name,
      sentinel_review_score: card.payload.trust?.sentinel_review_score ?? 0,
      risk_level: card.payload.trust?.risk_level ?? 'unknown',
      issued_at: card.payload.metadata.issued_at,
      expires_at: card.payload.metadata.expires_at,
    });

    if (resigned % 10 === 0) console.log(`  Progress: ${resigned}/${atcFiles.length}...`);
  } catch (err) {
    failed++;
    errors.push({ file, error: err.message });
    console.error(`  FAIL: ${file}: ${err.message}`);
  }
}

console.log(`\nRe-signed: ${resigned}/${atcFiles.length}`);
console.log(`Failed:    ${failed}`);

// Step 4: Update index
console.log('\nUpdating atc-index.json...');
const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
index.cards = newIndexCards;
index.schema_version = '1.2.0';
index.canonicalization_method = 'RFC_8785_JCS';
index.ca_public_key = caKeypair.public_key_base64;
index.ca_public_key_pem = caKeypair.public_key_pem;
index.ca_key_id = caKeypair.public_key_base64.slice(0, 16);
index.resigned_at = new Date().toISOString();
index.resign_reason = 'Aug 13, 2026: fixed forward-slash escaping + removed sentinel_score alias + added ca_key_id';
writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
console.log('Updated:', INDEX_PATH);

// Step 5: Verify a sample card
console.log('\nVerifying sample card...');
const sampleCard = JSON.parse(readFileSync(join(ATC_DIR, atcFiles[0]), 'utf8'));
const sampleCanonical = canonicalize(sampleCard.payload);
const sampleHash = createHash('sha256').update(sampleCanonical, 'utf8').digest('hex');
const sampleSigValid = sign(null, Buffer.from(sampleCanonical, 'utf8'), privateKey);
const { verify } = await import('node:crypto');
const verified = verify(null, Buffer.from(sampleCanonical, 'utf8'), publicKey, Buffer.from(sampleCard.signature.value, 'hex'));
console.log(`  Card: ${sampleCard.card_id}`);
console.log(`  Hash match:    ${sampleHash === sampleCard.signature.signed_payload_hash ? '✅' : '❌'}`);
console.log(`  Sig verifies:  ${verified ? '✅' : '❌'}`);
console.log(`  ca_key_id:     ${sampleCard.signature.ca_key_id}`);
console.log(`  has sentinel_score in payload: ${'sentinel_score' in sampleCard.payload.trust ? '❌ YES (should be removed)' : '✅ NO (removed)'}`);

// Step 6: Verify with Python-style JCS (no forward slash escaping)
console.log('\nCross-check: canonical string sample (first 120 chars):');
console.log('  ', sampleCanonical.slice(0, 120));
console.log('\n  Note: forward slashes should appear as "/" not "\\/" in the canonical output.');
const hasEscapedSlash = sampleCanonical.includes('\\/');
console.log(`  Contains \\/ escaped slashes: ${hasEscapedSlash ? '❌ YES (BUG)' : '✅ NO (fixed)'}`);

console.log('\n=== Done ===');
console.log(`  ${resigned} cards re-signed with corrected RFC 8785 JCS`);
console.log('  Deploy to Vercel + update CA private key env var.');
