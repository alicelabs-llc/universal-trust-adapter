/**
 * P3-6: Multi-signature ATC v3 integration tests.
 *
 * Tests:
 *   - Issue a credential with 2 signers (CA + Auditor)
 *   - Verify both signatures
 *   - Quorum policy (min_signatures)
 *   - Required signers policy (required_key_ids)
 *   - Tampering one signature invalidates only that one (others still valid)
 *   - verifyMultiSig returns per-signature results
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist', 'packages');
const KEYS = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'vectors', 'keys', 'manifest.json'), 'utf-8')
).keys;

const coreCrypto = require(path.join(DIST, 'core', 'crypto.js'));
const atcV3 = require(path.join(DIST, 'adapters', 'atc-v3.js'));
const multisig = require(path.join(DIST, 'adapters', 'multisig.js'));

let passed = 0, failed = 0;
const failures = [];

async function check(name, fn) {
  try {
    const r = await fn();
    if (r === true || (r && r.valid === true)) { passed++; console.log(`✅ ${name}`); }
    else {
      failed++;
      const reason = r?.reason || r?.issues?.join('; ') || 'returned false';
      failures.push({ name, reason });
      console.log(`❌ ${name}: ${reason}`);
    }
  } catch (e) {
    failed++;
    failures.push({ name, reason: e.message });
    console.log(`❌ ${name}: ${e.message}`);
  }
}

function makeKey(name) {
  return {
    privateKeyPem: KEYS[name].private_key_pem,
    publicKeyPem: KEYS[name].public_key_pem,
    publicKeyRaw: KEYS[name].public_key_raw_b64url,
    keyId: KEYS[name].key_id,
  };
}

async function main() {
  console.log('── Multi-signature ATC v3 ──');

  // ── 1. Issue credential with primary signer only ──
  await check('issueMultiSigATCv3 with 1 signer produces valid credential', () => {
    const caKey = makeKey('ca_ed25519');
    const cred = atcV3.issueATCv3({
      issuer: { did: 'did:marketnow:ca', name: 'Test CA', url: 'https://test.example', ca_key_id: caKey.keyId },
      subject: { agent_id: 'msig-001', agent_name: 'Multi-Sig Test', public_key: KEYS.agent_ed25519.public_key_raw_b64url, key_algorithm: 'Ed25519', subject_type: 'agent' },
      capabilities: { provides: ['test'] },
      assessment: { methodology: 'Test', methodology_version: '1.0', score: 8, confidence: 'high', risk_level: 'low' },
      expires_in_days: 30,
      ca_key_pair: caKey,
    });
    // Verify the existing single signature
    const keys = new Map([[caKey.keyId, caKey.publicKeyPem]]);
    const result = multisig.verifyMultiSig(cred, keys, { min_signatures: 1 });
    return result.valid && result.verified_count === 1 ? true : { valid: false, reason: `valid=${result.valid}, count=${result.verified_count}, issues=${result.issues.join('; ')}` };
  });

  // ── 2. Append a second signature ──
  await check('appendSignatures adds second signature to existing credential', () => {
    const caKey = makeKey('ca_ed25519');
    const gwKey = makeKey('gateway_ed25519');
    const cred = atcV3.issueATCv3({
      issuer: { did: 'did:marketnow:ca', name: 'Test CA', url: 'https://test.example', ca_key_id: caKey.keyId },
      subject: { agent_id: 'msig-002', agent_name: 'Multi-Sig Test 2', public_key: KEYS.agent_ed25519.public_key_raw_b64url, key_algorithm: 'Ed25519', subject_type: 'agent' },
      capabilities: { provides: ['test'] },
      assessment: { methodology: 'Test', methodology_version: '1.0', score: 8, confidence: 'high', risk_level: 'low' },
      expires_in_days: 30,
      ca_key_pair: caKey,
    });
    const multiCred = multisig.appendSignatures(cred, [
      { keyPair: gwKey, signed_by: 'Gateway Auditor' },
    ]);
    return multiCred.signatures.length === 2 ? true : { valid: false, reason: `expected 2 signatures, got ${multiCred.signatures.length}` };
  });

  // ── 3. Verify multi-sig with 2 signers ──
  await check('verifyMultiSig accepts credential with 2 valid signatures', () => {
    const caKey = makeKey('ca_ed25519');
    const gwKey = makeKey('gateway_ed25519');
    const cred = atcV3.issueATCv3({
      issuer: { did: 'did:marketnow:ca', name: 'Test CA', url: 'https://test.example', ca_key_id: caKey.keyId },
      subject: { agent_id: 'msig-003', agent_name: 'Multi-Sig Test 3', public_key: KEYS.agent_ed25519.public_key_raw_b64url, key_algorithm: 'Ed25519', subject_type: 'agent' },
      capabilities: { provides: ['test'] },
      assessment: { methodology: 'Test', methodology_version: '1.0', score: 8, confidence: 'high', risk_level: 'low' },
      expires_in_days: 30,
      ca_key_pair: caKey,
    });
    const multiCred = multisig.appendSignatures(cred, [
      { keyPair: gwKey, signed_by: 'Gateway Auditor' },
    ]);
    const keys = new Map([
      [caKey.keyId, caKey.publicKeyPem],
      [gwKey.keyId, gwKey.publicKeyPem],
    ]);
    const result = multisig.verifyMultiSig(multiCred, keys, { min_signatures: 2 });
    return result.valid && result.verified_count === 2 ? true : { valid: false, reason: `valid=${result.valid}, count=${result.verified_count}, issues=${result.issues.join('; ')}` };
  });

  // ── 4. Quorum policy: require 2 signatures, only 1 present ──
  await check('verifyMultiSig rejects when quorum not met (need 2, have 1)', () => {
    const caKey = makeKey('ca_ed25519');
    const cred = atcV3.issueATCv3({
      issuer: { did: 'did:marketnow:ca', name: 'Test CA', url: 'https://test.example', ca_key_id: caKey.keyId },
      subject: { agent_id: 'msig-004', agent_name: 'Multi-Sig Test 4', public_key: KEYS.agent_ed25519.public_key_raw_b64url, key_algorithm: 'Ed25519', subject_type: 'agent' },
      capabilities: { provides: ['test'] },
      assessment: { methodology: 'Test', methodology_version: '1.0', score: 8, confidence: 'high', risk_level: 'low' },
      expires_in_days: 30,
      ca_key_pair: caKey,
    });
    const keys = new Map([[caKey.keyId, caKey.publicKeyPem]]);
    const result = multisig.verifyMultiSig(cred, keys, { min_signatures: 2 });
    return !result.valid && result.issues.some(i => i.includes('quorum not met'))
      ? true
      : { valid: false, reason: `expected quorum failure, got valid=${result.valid}, issues=${result.issues.join('; ')}` };
  });

  // ── 5. Required signers policy ──
  await check('verifyMultiSig rejects when required signer missing', () => {
    const caKey = makeKey('ca_ed25519');
    const gwKey = makeKey('gateway_ed25519');
    const cred = atcV3.issueATCv3({
      issuer: { did: 'did:marketnow:ca', name: 'Test CA', url: 'https://test.example', ca_key_id: caKey.keyId },
      subject: { agent_id: 'msig-005', agent_name: 'Multi-Sig Test 5', public_key: KEYS.agent_ed25519.public_key_raw_b64url, key_algorithm: 'Ed25519', subject_type: 'agent' },
      capabilities: { provides: ['test'] },
      assessment: { methodology: 'Test', methodology_version: '1.0', score: 8, confidence: 'high', risk_level: 'low' },
      expires_in_days: 30,
      ca_key_pair: caKey,
    });
    // Only 1 signature (from CA). Policy requires BOTH CA + Gateway Auditor.
    const keys = new Map([
      [caKey.keyId, caKey.publicKeyPem],
      [gwKey.keyId, gwKey.publicKeyPem],
    ]);
    const result = multisig.verifyMultiSig(cred, keys, {
      min_signatures: 2,
      required_key_ids: [caKey.keyId, gwKey.keyId],
    });
    return !result.valid && result.issues.some(i => i.includes('required signer missing'))
      ? true
      : { valid: false, reason: `expected required signer failure, got valid=${result.valid}, issues=${result.issues.join('; ')}` };
  });

  // ── 6. Tamper one signature — only that one is invalid ──
  await check('verifyMultiSig: tampering one signature invalidates only that one', () => {
    const caKey = makeKey('ca_ed25519');
    const gwKey = makeKey('gateway_ed25519');
    const cred = atcV3.issueATCv3({
      issuer: { did: 'did:marketnow:ca', name: 'Test CA', url: 'https://test.example', ca_key_id: caKey.keyId },
      subject: { agent_id: 'msig-006', agent_name: 'Multi-Sig Test 6', public_key: KEYS.agent_ed25519.public_key_raw_b64url, key_algorithm: 'Ed25519', subject_type: 'agent' },
      capabilities: { provides: ['test'] },
      assessment: { methodology: 'Test', methodology_version: '1.0', score: 8, confidence: 'high', risk_level: 'low' },
      expires_in_days: 30,
      ca_key_pair: caKey,
    });
    const multiCred = multisig.appendSignatures(cred, [
      { keyPair: gwKey, signed_by: 'Gateway Auditor' },
    ]);
    // Tamper the second signature (first byte flipped)
    multiCred.signatures[1].value = 'ff' + multiCred.signatures[1].value.slice(2);
    const keys = new Map([
      [caKey.keyId, caKey.publicKeyPem],
      [gwKey.keyId, gwKey.publicKeyPem],
    ]);
    const result = multisig.verifyMultiSig(multiCred, keys, { min_signatures: 1 });
    // With min_signatures=1, the credential is valid because at least one signature (CA) is valid
    // But the gateway auditor signature is invalid
    return result.valid && result.verified_count === 1 && result.signatures[1].valid === false
      ? true
      : { valid: false, reason: `valid=${result.valid}, count=${result.verified_count}, sig2_valid=${result.signatures[1]?.valid}` };
  });

  // ── 7. Unknown key_id — fail-closed ──
  await check('verifyMultiSig: unknown key_id is rejected (fail-closed)', () => {
    const caKey = makeKey('ca_ed25519');
    const cred = atcV3.issueATCv3({
      issuer: { did: 'did:marketnow:ca', name: 'Test CA', url: 'https://test.example', ca_key_id: caKey.keyId },
      subject: { agent_id: 'msig-007', agent_name: 'Multi-Sig Test 7', public_key: KEYS.agent_ed25519.public_key_raw_b64url, key_algorithm: 'Ed25519', subject_type: 'agent' },
      capabilities: { provides: ['test'] },
      assessment: { methodology: 'Test', methodology_version: '1.0', score: 8, confidence: 'high', risk_level: 'low' },
      expires_in_days: 30,
      ca_key_pair: caKey,
    });
    // Provide an EMPTY key map — the CA's key is unknown
    const keys = new Map();
    const result = multisig.verifyMultiSig(cred, keys, { min_signatures: 1 });
    return !result.valid && result.issues.some(i => i.includes('unknown key_id'))
      ? true
      : { valid: false, reason: `expected unknown key_id failure, got valid=${result.valid}, issues=${result.issues.join('; ')}` };
  });

  // ── 8. Tampered payload — all signatures fail ──
  await check('verifyMultiSig: tampered payload invalidates ALL signatures', () => {
    const caKey = makeKey('ca_ed25519');
    const gwKey = makeKey('gateway_ed25519');
    const cred = atcV3.issueATCv3({
      issuer: { did: 'did:marketnow:ca', name: 'Test CA', url: 'https://test.example', ca_key_id: caKey.keyId },
      subject: { agent_id: 'msig-008', agent_name: 'Original', public_key: KEYS.agent_ed25519.public_key_raw_b64url, key_algorithm: 'Ed25519', subject_type: 'agent' },
      capabilities: { provides: ['test'] },
      assessment: { methodology: 'Test', methodology_version: '1.0', score: 8, confidence: 'high', risk_level: 'low' },
      expires_in_days: 30,
      ca_key_pair: caKey,
    });
    const multiCred = multisig.appendSignatures(cred, [
      { keyPair: gwKey, signed_by: 'Gateway Auditor' },
    ]);
    // Tamper the payload (not signatures) — both signatures should fail
    multiCred.subject.agent_name = 'TAMPERED';
    const keys = new Map([
      [caKey.keyId, caKey.publicKeyPem],
      [gwKey.keyId, gwKey.publicKeyPem],
    ]);
    const result = multisig.verifyMultiSig(multiCred, keys, { min_signatures: 1 });
    return !result.valid && result.verified_count === 0
      ? true
      : { valid: false, reason: `expected both sigs to fail, got valid=${result.valid}, count=${result.verified_count}` };
  });

  // ── 9. Three-signer credential ──
  await check('verifyMultiSig: 3 signers all verify', () => {
    const caKey = makeKey('ca_ed25519');
    const gwKey = makeKey('gateway_ed25519');
    const agKey = makeKey('agent_ed25519');
    const cred = atcV3.issueATCv3({
      issuer: { did: 'did:marketnow:ca', name: 'Test CA', url: 'https://test.example', ca_key_id: caKey.keyId },
      subject: { agent_id: 'msig-009', agent_name: 'Three-Sig Test', public_key: KEYS.agent_ed25519.public_key_raw_b64url, key_algorithm: 'Ed25519', subject_type: 'agent' },
      capabilities: { provides: ['test'] },
      assessment: { methodology: 'Test', methodology_version: '1.0', score: 8, confidence: 'high', risk_level: 'low' },
      expires_in_days: 30,
      ca_key_pair: caKey,
    });
    const multiCred = multisig.appendSignatures(cred, [
      { keyPair: gwKey, signed_by: 'Gateway Auditor' },
      { keyPair: agKey, signed_by: 'Agent Self-Attestation' },
    ]);
    const keys = new Map([
      [caKey.keyId, caKey.publicKeyPem],
      [gwKey.keyId, gwKey.publicKeyPem],
      [agKey.keyId, agKey.publicKeyPem],
    ]);
    const result = multisig.verifyMultiSig(multiCred, keys, { min_signatures: 3 });
    return result.valid && result.verified_count === 3 ? true : { valid: false, reason: `valid=${result.valid}, count=${result.verified_count}, issues=${result.issues.join('; ')}` };
  });

  // ── 10. issueMultiSigATCv3 from scratch (no pre-existing cred) ──
  await check('issueMultiSigATCv3 builds credential from scratch with multiple signers', () => {
    const caKey = makeKey('ca_ed25519');
    const gwKey = makeKey('gateway_ed25519');
    // Build a minimal ATC v3 credential without signatures
    const cred = {
      atc_version: '3.0.0',
      credential_id: 'ATC-2026-MSIG-SCRATCH',
      issuer: { did: 'did:marketnow:ca', name: 'Test CA', url: 'https://test.example', ca_key_id: caKey.keyId },
      subject: { agent_id: 'msig-scratch', agent_name: 'Scratch', public_key: KEYS.agent_ed25519.public_key_raw_b64url, key_algorithm: 'Ed25519', subject_type: 'agent' },
      attestations: [],
      capabilities: { provides: ['test'], requires: [], protocols: ['mcp'] },
      lifecycle: { issued_at: new Date().toISOString(), expires_at: new Date(Date.now() + 30 * 86400000).toISOString(), revoked: false, revocation_url: '', version: '3.0.0' },
      assessment: { methodology: 'Test', methodology_version: '1.0', score: 8, confidence: 'high', risk_level: 'low', computed_at: new Date().toISOString(), computed_by: 'Test CA' },
      signatures: [],
    };
    const multiCred = multisig.issueMultiSigATCv3(cred, { keyPair: caKey, signed_by: 'Test CA' }, [
      { keyPair: gwKey, signed_by: 'Gateway Auditor' },
    ]);
    const keys = new Map([
      [caKey.keyId, caKey.publicKeyPem],
      [gwKey.keyId, gwKey.publicKeyPem],
    ]);
    const result = multisig.verifyMultiSig(multiCred, keys, { min_signatures: 2 });
    return result.valid && result.verified_count === 2 ? true : { valid: false, reason: `valid=${result.valid}, count=${result.verified_count}, issues=${result.issues.join('; ')}` };
  });

  // ── Summary ──
  console.log('\n' + '='.repeat(60));
  console.log(`UTA Multi-Sig Integration: ${passed}/${passed + failed} tests passed`);
  console.log(`Conformant: ${failed === 0 ? 'YES ✅' : 'NO ❌'}`);
  if (failed > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f.name}: ${f.reason}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
