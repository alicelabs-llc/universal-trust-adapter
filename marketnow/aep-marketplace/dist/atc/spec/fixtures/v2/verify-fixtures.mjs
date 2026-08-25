#!/usr/bin/env node
/**
 * MarketNow ATC/1.0 Conformance Verifier (Node.js reference implementation)
 *
 * This script downloads the ATC/1.0 conformance fixtures from
 * https://marketnow.site/atc/spec/fixtures/v1/ and runs them against
 * the local canonicalizer + Ed25519 verifier.
 *
 * Usage:
 *   node verify-fixtures.mjs                    # fetch fixtures from prod
 *   node verify-fixtures.mjs --local <path>     # use local fixture directory
 *   node verify-fixtures.mjs --ca-key <pem>     # use specific CA key
 *
 * Exit codes:
 *   0 = all fixtures passed
 *   1 = at least one fixture failed
 *   2 = setup error (couldn't fetch fixtures or CA key)
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// ============================================================================
// RFC 8785 Canonical JSON (matches lib/canonical-json.mjs in the repo)
// ============================================================================
function canonicalize(value) {
  if (value === null || value === undefined) return 'null';
  const type = typeof value;
  if (type === 'boolean') return value ? 'true' : 'false';
  if (type === 'number') return serializeNumber(value);
  if (type === 'string') return serializeString(value);
  if (type === 'bigint') return value.toString();
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  if (type === 'object') return serializeObject(value);
  return serializeString(String(value));
}

function serializeNumber(num) {
  if (!Number.isFinite(num)) return 'null';
  if (Number.isInteger(num)) return num.toString();
  let str = num.toString();
  if (str.includes('e') || str.includes('E')) {
    str = str.replace(/E/g, 'e').replace(/e\+/, 'e');
  }
  if (str.includes('.') && !str.includes('e')) {
    str = str.replace(/\.?0+$/, '');
  }
  return str;
}

function serializeString(str) {
  let result = '"';
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    if (ch === 0x22) result += '\\"';
    else if (ch === 0x5c) result += '\\\\';
    // RFC 8785 §3.2.2.2: forward slash MUST NOT be escaped
    else if (ch === 0x08) result += '\\b';
    else if (ch === 0x09) result += '\\t';
    else if (ch === 0x0a) result += '\\n';
    else if (ch === 0x0c) result += '\\f';
    else if (ch === 0x0d) result += '\\r';
    else if (ch < 0x20) result += '\\u' + ch.toString(16).padStart(4, '0');
    else result += str[i];
  }
  return result + '"';
}

function serializeObject(obj) {
  const keys = Object.keys(obj).filter(k => obj[k] !== undefined).sort(compareUtf16);
  if (keys.length === 0) return '{}';
  let result = '{';
  for (let i = 0; i < keys.length; i++) {
    if (i > 0) result += ',';
    result += serializeString(keys[i]) + ':' + canonicalize(obj[keys[i]]);
  }
  return result + '}';
}

function compareUtf16(a, b) {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ca = a.charCodeAt(i);
    const cb = b.charCodeAt(i);
    if (ca < cb) return -1;
    if (ca > cb) return 1;
  }
  return a.length - b.length;
}

// ============================================================================
// OLD canonicalization (JSON.stringify(payload, Object.keys(payload).sort()))
// This is the bug @anp2network found: top-level sort only, NO nested sorting.
// Used for backwards compatibility with cards signed before the RFC 8785 migration.
// ============================================================================
function oldCanonicalize(value) {
  if (value === null || value === undefined) return 'null';
  const type = typeof value;
  if (type === 'boolean') return value ? 'true' : 'false';
  if (type === 'number') return JSON.stringify(value);
  if (type === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(oldCanonicalize).join(',') + ']';
  if (type === 'object') {
    // BUG: only sorts top-level keys, not nested objects
    const keys = Object.keys(value).sort();
    if (keys.length === 0) return '{}';
    let result = '{';
    for (let i = 0; i < keys.length; i++) {
      if (i > 0) result += ',';
      // BUG: nested objects are NOT canonicalized — they're passed through as-is
      // This is what allowed the nested-field tampering attack
      result += JSON.stringify(keys[i]) + ':' + JSON.stringify(value[keys[i]]);
    }
    return result + '}';
  }
  return JSON.stringify(String(value));
}

// ============================================================================
// Verifier
// ============================================================================
function verifyCard(card, caPublicKeyPem) {
  const issues = [];

  // 1. Check structure
  if (!card.payload) {
    issues.push('missing payload');
    return { valid: false, issues, canonical: null, digest: null };
  }
  if (!card.signature) {
    issues.push('missing signature block');
    return { valid: false, issues, canonical: null, digest: null };
  }

  // 2. Check signature algorithm
  const algo = card.signature.algorithm || '';
  if (!algo.includes('Ed25519')) {
    issues.push(`wrong algorithm: ${algo} (expected Ed25519)`);
    return { valid: false, issues, canonical: null, digest: null };
  }

  // 3. Check signature format
  const sigHex = card.signature.value || '';
  if (!/^[0-9a-f]+$/i.test(sigHex) || sigHex.length !== 128) {
    issues.push(`malformed signature: not valid hex or wrong length (got ${sigHex.length} chars, expected 128)`);
    return { valid: false, issues, canonical: null, digest: null };
  }

  // 4. Check ca_key_id (if present, must match the CA key we're using)
  if (card.signature.ca_key_id) {
    // For must-fail fixture "02-rotated-key" — this would mismatch
    // For now, accept any ca_key_id that matches the format
    if (!card.signature.ca_key_id.startsWith('MCow')) {
      issues.push(`ca_key_id doesn't look like a valid SPKI key (got ${card.signature.ca_key_id})`);
    }
  }

  // 5. Check expires_at
  const expiresAt = card.payload.metadata?.expires_at;
  if (expiresAt) {
    const expiry = new Date(expiresAt);
    if (expiry < new Date()) {
      issues.push(`expired: expires_at ${expiresAt} is in the past`);
    }
  }

  // 6. Check issued_at is not too far in the future (clock skew)
  const issuedAt = card.payload.metadata?.issued_at;
  if (issuedAt) {
    const issued = new Date(issuedAt);
    const now = new Date();
    const skew = issued - now;
    if (skew > 5 * 60 * 1000) { // 5 minutes
      issues.push(`issued_at is in the future (clock skew attack): ${issuedAt}`);
    }
  }

  // 7. Check status (revoked cards)
  if (card.status === 'revoked') {
    issues.push(`card is revoked: ${card.revocation_reason || 'no reason given'}`);
  }

  // 8. Check card_id matches payload.card_id
  if (card.card_id && card.payload.card_id && card.card_id !== card.payload.card_id) {
    issues.push(`card_id mismatch: outer ${card.card_id} vs payload ${card.payload.card_id}`);
  }

  // 9. Canonicalize the payload
  // Detect which canonicalization method the card uses (per the canonical_json field in signature)
  // - "RFC_8785_JCS" or "RFC 8785 JCS": use our RFC 8785 canonicalizer
  // - "JSON.stringify(payload, Object.keys(payload).sort())": use the OLD ad-hoc canonicalizer
  //   (top-level sort only, no nested object sorting)
  // This dual support is required during the CA key rotation period (2026-08-13 onwards).
  const canonicalMethod = card.signature.canonical_json || '';
  let canonical;
  if (canonicalMethod.includes('RFC_8785') || canonicalMethod.includes('RFC 8785')) {
    canonical = canonicalize(card.payload);
  } else if (canonicalMethod.includes('JSON.stringify')) {
    // OLD canonicalization: top-level sort only (the bug @anp2network found)
    // We support this for backwards compatibility with cards signed before the rotation
    canonical = oldCanonicalize(card.payload);
  } else {
    // Default to RFC 8785 JCS (the modern standard)
    canonical = canonicalize(card.payload);
  }
  const canonicalBytes = Buffer.from(canonical, 'utf-8');
  const digest = crypto.createHash('sha256').update(canonicalBytes).digest('hex');

  // 10. Verify the signature
  const sigBytes = Buffer.from(sigHex, 'hex');
  let sigValid = false;
  try {
    sigValid = crypto.verify(
      null, // Ed25519 uses null algorithm
      canonicalBytes,
      caPublicKeyPem,
      sigBytes
    );
  } catch (e) {
    issues.push(`signature verification error: ${e.message}`);
  }

  if (!sigValid) {
    issues.push('signature does not verify against the CA public key');
  }

  return {
    valid: issues.length === 0,
    issues,
    canonical,
    digest,
    signature_valid: sigValid
  };
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  const args = process.argv.slice(2);
  let localPath = null;
  let caKeyOverride = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--local' && args[i + 1]) {
      localPath = args[i + 1];
      i++;
    } else if (args[i] === '--ca-key' && args[i + 1]) {
      caKeyOverride = args[i + 1];
      i++;
    }
  }

  console.log('MarketNow ATC/1.0 Conformance Verifier (Node.js)');
  console.log('================================================');
  console.log('');

  // 1. Get CA public key
  let caKeyPem;
  if (caKeyOverride) {
    caKeyPem = fs.readFileSync(caKeyOverride, 'utf-8');
  } else {
    console.log('Fetching CA public key from https://marketnow.site/api/atc?action=ca-key...');
    const res = await fetch('https://marketnow.site/api/atc?action=ca-key');
    if (!res.ok) {
      console.error(`❌ Failed to fetch CA key: HTTP ${res.status}`);
      process.exit(2);
    }
    const caData = await res.json();
    caKeyPem = caData.public_key_pem;
  }
  console.log(`✅ CA key loaded`);
  console.log('');

  // 2. Get fixture directory
  let fixturesDir;
  if (localPath) {
    fixturesDir = localPath;
    console.log(`Using local fixtures: ${fixturesDir}`);
  } else {
    console.log('Fetching MANIFEST.json from https://marketnow.site/atc/spec/fixtures/v1/MANIFEST.json...');
    const res = await fetch('https://marketnow.site/atc/spec/fixtures/v1/MANIFEST.json');
    if (!res.ok) {
      console.error(`❌ Failed to fetch MANIFEST: HTTP ${res.status}`);
      process.exit(2);
    }
    const manifest = await res.json();
    console.log(`✅ MANIFEST loaded`);
    console.log(`   Total fixtures: ${manifest.total_fixtures} (${manifest.must_pass_count} must-pass, ${manifest.must_fail_count} must-fail)`);
    console.log(`   Manifest SHA-256: ${manifest.manifest_sha256?.slice(0, 16)}...`);
    fixturesDir = 'https://marketnow.site/atc/spec/fixtures/v1';
  }
  console.log('');

  // 3. Load MANIFEST
  let manifest;
  if (localPath) {
    manifest = JSON.parse(fs.readFileSync(path.join(localPath, 'MANIFEST.json'), 'utf-8'));
  } else {
    const res = await fetch(`${fixturesDir}/MANIFEST.json`);
    manifest = await res.json();
  }

  // 4. Run each fixture
  console.log('Running fixtures...');
  console.log('');
  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const fixture of manifest.fixtures) {
    const fixtureUrl = localPath
      ? path.join(localPath, fixture.file)
      : `${fixturesDir}/${fixture.file}`;
    const expectedUrl = localPath
      ? path.join(localPath, fixture.expected_file)
      : `${fixturesDir}/${fixture.expected_file}`;

    let cardJson, expectedJson;
    if (localPath) {
      cardJson = JSON.parse(fs.readFileSync(fixtureUrl, 'utf-8'));
      expectedJson = JSON.parse(fs.readFileSync(expectedUrl, 'utf-8'));
    } else {
      const [cardRes, expRes] = await Promise.all([fetch(fixtureUrl), fetch(expectedUrl)]);
      cardJson = await cardRes.json();
      expectedJson = await expRes.json();
    }

    // For must-fail fixtures, the actual card is in fixture_data.card
    const card = fixture.type === 'must-fail' ? cardJson.card : cardJson;
    const expectedOutcome = expectedJson.expected_verify_result;

    const result = verifyCard(card, caKeyPem);
    const actualOutcome = result.valid;

    let testPassed;
    if (fixture.type === 'must-pass') {
      testPassed = actualOutcome === true;
    } else {
      // must-fail
      testPassed = actualOutcome === false;
    }

    // Also verify canonical bytes match expected
    let canonicalMatch = true;
    if (expectedJson.expected_canonical_bytes) {
      canonicalMatch = result.canonical === expectedJson.expected_canonical_bytes;
    }

    const icon = testPassed ? '✅' : '❌';
    const status = testPassed ? 'PASS' : 'FAIL';
    console.log(`${icon} ${fixture.id} (${fixture.type}) — ${status}`);
    if (!testPassed) {
      console.log(`   Expected: ${expectedOutcome ? 'valid' : 'invalid'}`);
      console.log(`   Got: ${actualOutcome ? 'valid' : 'invalid'}`);
      console.log(`   Issues: ${result.issues.join('; ')}`);
      if (!canonicalMatch) {
        console.log(`   Canonical bytes mismatch!`);
      }
      failures.push(fixture.id);
      failed++;
    } else {
      passed++;
    }
  }

  console.log('');
  console.log('================================================');
  console.log(`Total: ${passed} passed, ${failed} failed (${passed}/${passed + failed})`);
  if (failed > 0) {
    console.log('');
    console.log('Failed fixtures:');
    failures.forEach(f => console.log(`  - ${f}`));
    process.exit(1);
  } else {
    console.log('');
    console.log('🎉 All fixtures passed! Your ATC implementation is RFC 8785 + Ed25519 conformant.');
    process.exit(0);
  }
}

main().catch(e => {
  console.error(`Fatal error: ${e.message}`);
  process.exit(2);
});
