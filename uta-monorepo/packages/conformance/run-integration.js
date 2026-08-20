/**
 * P3-1: Integration tests — imports the ACTUAL compiled TypeScript modules
 * from dist/ and runs verification against the test vectors.
 *
 * Unlike run-vectors.js (which uses faithful JS ports of the TS code),
 * this runner imports the real compiled .js + .d.ts files. If the TS
 * source has a bug that the JS port doesn't, this will catch it.
 *
 * Run with: node packages/conformance/run-integration.js
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist', 'packages');
const KEYS = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'vectors', 'keys', 'manifest.json'), 'utf-8')
).keys;

// ── Import the REAL compiled modules ──
const coreCrypto = require(path.join(DIST, 'core', 'crypto.js'));
const corePipeline = require(path.join(DIST, 'core', 'verification-pipeline.js'));
const coreRevocation = require(path.join(DIST, 'core', 'revocation.js'));
const coreSupplyChain = require(path.join(DIST, 'core', 'supply-chain.js'));
const coreNonceStore = require(path.join(DIST, 'core', 'nonce-store.js'));
const coreTrustRegistry = require(path.join(DIST, 'core', 'trust-registry.js'));
const atcV3 = require(path.join(DIST, 'adapters', 'atc-v3.js'));
const cryptoAdapters = require(path.join(DIST, 'adapters', 'crypto-adapters.js'));
const gateway = require(path.join(DIST, 'gateway', 'index.js'));
const receipts = require(path.join(DIST, 'gateway', 'receipts.js'));

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

function publicKeyFor(ref) {
  const k = KEYS[ref];
  if (!k) throw new Error(`unknown public_key_ref: ${ref}`);
  return k.public_key_pem;
}

function makeCaKey() {
  return {
    privateKeyPem: KEYS.ca_ed25519.private_key_pem,
    publicKeyPem: KEYS.ca_ed25519.public_key_pem,
    publicKeyRaw: KEYS.ca_ed25519.public_key_raw_b64url,
    keyId: KEYS.ca_ed25519.key_id,
  };
}

async function main() {
  // ── Module loading ──
  console.log('── Module loading ──');
  await check('coreCrypto exports canonicalize + sign + verify', () =>
    typeof coreCrypto.canonicalize === 'function' &&
    typeof coreCrypto.sign === 'function' &&
    typeof coreCrypto.verify === 'function'
  );
  await check('coreCrypto exports DOMAINS', () =>
    coreCrypto.DOMAINS && typeof coreCrypto.DOMAINS.ATC_V3_CREDENTIAL === 'string'
  );
  await check('corePipeline exports verifyCredential', () =>
    typeof corePipeline.verifyCredential === 'function'
  );
  await check('coreRevocation exports 4 checker classes', () =>
    typeof coreRevocation.CRLRevocationChecker === 'function' &&
    typeof coreRevocation.OCSPRevocationChecker === 'function' &&
    typeof coreRevocation.BitstringStatusListChecker === 'function' &&
    typeof coreRevocation.CompositeRevocationChecker === 'function'
  );
  await check('coreSupplyChain exports generateSBOM + verifySigstoreBundle', () =>
    typeof coreSupplyChain.generateSBOM === 'function' &&
    typeof coreSupplyChain.verifySigstoreBundle === 'function'
  );
  await check('coreNonceStore exports MemoryNonceStore + PoPManager', () =>
    typeof coreNonceStore.MemoryNonceStore === 'function' &&
    typeof coreNonceStore.PoPManager === 'function'
  );
  await check('coreTrustRegistry exports TrustRegistry', () =>
    typeof coreTrustRegistry.TrustRegistry === 'function'
  );
  await check('atcV3 exports issueATCv3 + verifyATCv3', () =>
    typeof atcV3.issueATCv3 === 'function' &&
    typeof atcV3.verifyATCv3 === 'function'
  );
  await check('cryptoAdapters exports verifyJWT + verifyW3CVC + issueW3CVC', () =>
    typeof cryptoAdapters.verifyJWT === 'function' &&
    typeof cryptoAdapters.verifyW3CVC === 'function' &&
    typeof cryptoAdapters.issueW3CVC === 'function'
  );
  await check('gateway exports TrustGateway', () =>
    typeof gateway.TrustGateway === 'function'
  );
  await check('receipts exports ReceiptGenerator + ReceiptStore', () =>
    typeof receipts.ReceiptGenerator === 'function' &&
    typeof receipts.ReceiptStore === 'function'
  );

  // ── ATC v3 issuance → verification (real modules) ──
  console.log('\n── ATC v3 issuance → verification (real modules) ──');
  await check('ATC v3 issueATCv3 returns valid credential', () => {
    const caKey = makeCaKey();
    const cred = atcV3.issueATCv3({
      issuer: { did: 'did:marketnow:ca', name: 'Test CA', url: 'https://test.example', ca_key_id: caKey.keyId },
      subject: { agent_id: 'int-test-001', agent_name: 'Integration Test Agent', public_key: KEYS.agent_ed25519.public_key_raw_b64url, key_algorithm: 'Ed25519', subject_type: 'agent' },
      capabilities: { provides: ['test'] },
      assessment: { methodology: 'Test', methodology_version: '1.0', score: 7, confidence: 'high', risk_level: 'low' },
      expires_in_days: 30,
      ca_key_pair: caKey,
    });
    return cred && cred.atc_version === '3.0.0' && cred.signatures.length === 1 && cred.signatures[0].value.length === 128;
  });

  await check('ATC v3 verifyATCv3 accepts freshly issued credential', () => {
    const caKey = makeCaKey();
    const cred = atcV3.issueATCv3({
      issuer: { did: 'did:marketnow:ca', name: 'Test CA', url: 'https://test.example', ca_key_id: caKey.keyId },
      subject: { agent_id: 'int-test-002', agent_name: 'Integration Test Agent 2', public_key: KEYS.agent_ed25519.public_key_raw_b64url, key_algorithm: 'Ed25519', subject_type: 'agent' },
      capabilities: { provides: ['test'] },
      assessment: { methodology: 'Test', methodology_version: '1.0', score: 7, confidence: 'high', risk_level: 'low' },
      expires_in_days: 30,
      ca_key_pair: caKey,
    });
    const result = atcV3.verifyATCv3(cred, KEYS.ca_ed25519.public_key_pem);
    return result.valid ? true : { valid: false, reason: result.issues.join('; ') };
  });

  await check('ATC v3 verifyATCv3 rejects tampered credential', () => {
    const caKey = makeCaKey();
    const cred = atcV3.issueATCv3({
      issuer: { did: 'did:marketnow:ca', name: 'Test CA', url: 'https://test.example', ca_key_id: caKey.keyId },
      subject: { agent_id: 'int-test-003', agent_name: 'Original', public_key: KEYS.agent_ed25519.public_key_raw_b64url, key_algorithm: 'Ed25519', subject_type: 'agent' },
      capabilities: { provides: ['test'] },
      assessment: { methodology: 'Test', methodology_version: '1.0', score: 7, confidence: 'high', risk_level: 'low' },
      expires_in_days: 30,
      ca_key_pair: caKey,
    });
    cred.subject.agent_name = 'TAMPERED';
    const result = atcV3.verifyATCv3(cred, KEYS.ca_ed25519.public_key_pem);
    return result.valid ? { valid: false, reason: 'tampered credential was accepted' } : true;
  });

  // ── JWT verification (real modules) ──
  console.log('\n── JWT verification (real modules) ──');
  await check('verifyJWT accepts valid EdDSA token', () => {
    const header = { alg: 'EdDSA', typ: 'JWT', kid: KEYS.ca_ed25519.key_id };
    const claims = { iss: 'https://test.example', sub: 'agent-x', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 };
    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const claimsB64 = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const signingInput = Buffer.from(`${headerB64}.${claimsB64}`, 'utf-8');
    const privateKey = crypto.createPrivateKey(KEYS.ca_ed25519.private_key_pem);
    const signature = crypto.sign(null, signingInput, privateKey);
    const jwt = `${headerB64}.${claimsB64}.${signature.toString('base64url')}`;
    const result = cryptoAdapters.verifyJWT(jwt, KEYS.ca_ed25519.public_key_pem);
    return result.valid ? true : { valid: false, reason: result.issues.join('; ') };
  });

  await check('verifyJWT rejects alg=none', () => {
    const header = { alg: 'none', typ: 'JWT' };
    const claims = { iss: 'https://test.example', sub: 'attacker' };
    const h = Buffer.from(JSON.stringify(header)).toString('base64url');
    const p = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const jwt = `${h}.${p}.`;
    const result = cryptoAdapters.verifyJWT(jwt, KEYS.ca_ed25519.public_key_pem);
    return result.valid ? { valid: false, reason: 'alg=none was accepted' } : true;
  });

  // ── W3C VC round-trip (real modules) ──
  console.log('\n── W3C VC round-trip (real modules) ──');
  await check('issueW3CVC → verifyW3CVC round-trip succeeds', () => {
    const cred = {
      '@context': ['https://www.w3.org/2018/credentials/v1', 'https://w3id.org/security/suites/ed25519-2020/v1'],
      id: 'urn:uuid:' + crypto.randomUUID(),
      type: ['VerifiableCredential', 'AgentTrustCredential'],
      issuer: 'did:marketnow:ca',
      issuanceDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      credentialSubject: { id: 'did:marketnow:agent:001', trust_score: 8 },
    };
    const signed = cryptoAdapters.issueW3CVC(cred, KEYS.ca_ed25519.private_key_pem);
    const result = cryptoAdapters.verifyW3CVC(signed, KEYS.ca_ed25519.public_key_pem);
    return result.valid ? true : { valid: false, reason: result.issues.join('; ') };
  });

  await check('verifyW3CVC rejects VC signed with wrong key', () => {
    const cred = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      id: 'urn:uuid:' + crypto.randomUUID(),
      type: ['VerifiableCredential'],
      issuer: 'did:marketnow:ca',
      issuanceDate: new Date().toISOString(),
      credentialSubject: { id: 'did:marketnow:agent:001' },
    };
    const signed = cryptoAdapters.issueW3CVC(cred, KEYS.agent_ed25519.private_key_pem);
    const result = cryptoAdapters.verifyW3CVC(signed, KEYS.ca_ed25519.public_key_pem);
    return result.valid ? { valid: false, reason: 'wrong-key VC was accepted' } : true;
  });

  // ── PoP with real NonceStore + PoPManager ──
  console.log('\n── PoP with real NonceStore + PoPManager ──');
  await check('PoPManager issueChallenge → createPoPResponse → verifyAndConsume succeeds', async () => {
    const store = new coreNonceStore.MemoryNonceStore();
    const manager = new coreNonceStore.PoPManager(store);
    const challenge = await manager.issueChallenge('ATC-2026-INTEG-001', 'marketnow-gateway');
    const { createPoPResponse } = coreCrypto;
    const response = createPoPResponse(challenge, KEYS.agent_ed25519.private_key_pem);
    try {
      const valid = await manager.verifyAndConsume(response, KEYS.agent_ed25519.public_key_pem, 'marketnow-gateway');
      return valid ? true : { valid: false, reason: 'verifyAndConsume returned false' };
    } catch (e) {
      return { valid: false, reason: `verifyAndConsume threw: ${e.message}` };
    }
  });

  await check('PoPManager rejects replay (second consume throws)', async () => {
    const store = new coreNonceStore.MemoryNonceStore();
    const manager = new coreNonceStore.PoPManager(store);
    const challenge = await manager.issueChallenge('ATC-2026-INTEG-002', 'marketnow-gateway');
    const { createPoPResponse } = coreCrypto;
    const response = createPoPResponse(challenge, KEYS.agent_ed25519.private_key_pem);
    await manager.verifyAndConsume(response, KEYS.agent_ed25519.public_key_pem, 'marketnow-gateway');
    try {
      await manager.verifyAndConsume(response, KEYS.agent_ed25519.public_key_pem, 'marketnow-gateway');
      return { valid: false, reason: 'second consume succeeded (replay allowed!)' };
    } catch (e) {
      return e.message.includes('replay') || e.message.includes('consumed') ? true : { valid: false, reason: `unexpected error: ${e.message}` };
    }
  });

  // ── TrustRegistry (real module) ──
  console.log('\n── TrustRegistry (real module) ──');
  await check('TrustRegistry registerKey → verifyKeyBinding succeeds', () => {
    const registry = new coreTrustRegistry.TrustRegistry();
    registry.registerKey({
      key_id: KEYS.ca_ed25519.key_id,
      public_key_pem: KEYS.ca_ed25519.public_key_pem,
      algorithm: 'Ed25519',
      issuer: 'did:marketnow:ca',
      status: 'active',
    });
    const result = registry.verifyKeyBinding(
      KEYS.ca_ed25519.key_id,
      KEYS.agent_ed25519.public_key_pem,
      KEYS.agent_ed25519.public_key_pem
    );
    return result.valid ? true : { valid: false, reason: result.reason };
  });

  await check('TrustRegistry rejects unknown key_id', () => {
    const registry = new coreTrustRegistry.TrustRegistry();
    const result = registry.verifyKeyBinding('unknown-key-id', 'pk1', 'pk1');
    return result.valid ? { valid: false, reason: 'unknown key was accepted' } : true;
  });

  await check('TrustRegistry rejects revoked key', () => {
    const registry = new coreTrustRegistry.TrustRegistry();
    registry.registerKey({
      key_id: KEYS.ca_ed25519.key_id,
      public_key_pem: KEYS.ca_ed25519.public_key_pem,
      algorithm: 'Ed25519',
      issuer: 'did:marketnow:ca',
      status: 'active',
    });
    registry.revokeKey(KEYS.ca_ed25519.key_id, 'compromise');
    const result = registry.verifyKeyBinding(KEYS.ca_ed25519.key_id, 'pk', 'pk');
    return result.valid ? { valid: false, reason: 'revoked key was accepted' } : true;
  });

  // ── Action receipts (real module) ──
  console.log('\n── Action receipts (real module) ──');
  await check('ReceiptGenerator generates signed receipt', () => {
    const store = new receipts.ReceiptStore();
    const gatewayKey = {
      privateKeyPem: KEYS.gateway_ed25519.private_key_pem,
      publicKeyPem: KEYS.gateway_ed25519.public_key_pem,
      publicKeyRaw: KEYS.gateway_ed25519.public_key_raw_b64url,
      keyId: KEYS.gateway_ed25519.key_id,
    };
    const gen = new receipts.ReceiptGenerator(store, gatewayKey);
    const r = gen.generate({
      decision: 'ALLOW',
      agent_id: 'test-agent',
      credential_id: 'ATC-2026-X',
      tool_name: 'test.tool',
      args: { foo: 'bar' },
      trust_score: 8,
    });
    return r && r.signature && r.signature.value.length === 128 && r.evidence_hash.startsWith('sha256:');
  });

  await check('ReceiptGenerator verify accepts valid receipt', () => {
    const store = new receipts.ReceiptStore();
    const gatewayKey = {
      privateKeyPem: KEYS.gateway_ed25519.private_key_pem,
      publicKeyPem: KEYS.gateway_ed25519.public_key_pem,
      publicKeyRaw: KEYS.gateway_ed25519.public_key_raw_b64url,
      keyId: KEYS.gateway_ed25519.key_id,
    };
    const gen = new receipts.ReceiptGenerator(store, gatewayKey);
    const r = gen.generate({
      decision: 'ALLOW', agent_id: 'test-agent', credential_id: 'ATC-2026-Y',
      tool_name: 'test.tool', args: { foo: 'bar' }, trust_score: 8,
    });
    return gen.verify(r, KEYS.gateway_ed25519.public_key_pem) ? true : { valid: false, reason: 'verify returned false' };
  });

  await check('ReceiptGenerator verify rejects tampered receipt', () => {
    const store = new receipts.ReceiptStore();
    const gatewayKey = {
      privateKeyPem: KEYS.gateway_ed25519.private_key_pem,
      publicKeyPem: KEYS.gateway_ed25519.public_key_pem,
      publicKeyRaw: KEYS.gateway_ed25519.public_key_raw_b64url,
      keyId: KEYS.gateway_ed25519.key_id,
    };
    const gen = new receipts.ReceiptGenerator(store, gatewayKey);
    const r = gen.generate({
      decision: 'ALLOW', agent_id: 'test-agent', credential_id: 'ATC-2026-Z',
      tool_name: 'test.tool', args: { foo: 'bar' }, trust_score: 8,
    });
    r.trust_score = 10;
    return gen.verify(r, KEYS.gateway_ed25519.public_key_pem) ? { valid: false, reason: 'tampered receipt was accepted' } : true;
  });

  // ── SBOM generation (real module) ──
  console.log('\n── SBOM generation (real module) ──');
  await check('generateSBOM produces SPDX 2.3 document for packages/core', () => {
    const sbom = coreSupplyChain.generateSBOM({
      rootDir: path.join(ROOT, 'packages', 'core'),
      creator: 'Organization: AliceLabs LLC',
    });
    return sbom.spdxVersion === 'SPDX-2.3' && sbom.packages.length > 0 && sbom.documentHash.startsWith('sha256:');
  });

  await check('generateSBOM documentHash is well-formed', () => {
    const sbom = coreSupplyChain.generateSBOM({ rootDir: path.join(ROOT, 'packages', 'core') });
    return sbom.documentHash.startsWith('sha256:') && sbom.documentHash.length === 'sha256:'.length + 64;
  });

  // ── Revocation (real modules) ──
  console.log('\n── Revocation (real modules) ──');
  await check('CRLRevocationChecker rejects credential listed in CRL', async () => {
    const caKey = makeCaKey();
    const crlPayload = {
      issuer: 'did:marketnow:ca',
      revoked: [{ credential_id: 'ATC-2026-REVOKED-FOR-TEST', revoked_at: new Date().toISOString(), reason: 'test' }],
      this_update: new Date().toISOString(),
      next_update: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      crl_number: 1,
    };
    const crl = coreRevocation.issueCRL(crlPayload, caKey.privateKeyPem, caKey.keyId);
    const checker = new coreRevocation.CRLRevocationChecker({ fetcher: async () => crl });
    const result = await checker.check({
      credential_id: 'ATC-2026-REVOKED-FOR-TEST',
      revocation_url: 'uta-fixture://crl/test.json',
      ca_public_key_pem: caKey.publicKeyPem,
    });
    return result.status === 'revoked' ? true : { valid: false, reason: `expected revoked, got ${result.status}` };
  });

  await check('CRLRevocationChecker accepts credential not in CRL', async () => {
    const caKey = makeCaKey();
    const crlPayload = {
      issuer: 'did:marketnow:ca',
      revoked: [],
      this_update: new Date().toISOString(),
      next_update: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      crl_number: 1,
    };
    const crl = coreRevocation.issueCRL(crlPayload, caKey.privateKeyPem, caKey.keyId);
    const checker = new coreRevocation.CRLRevocationChecker({ fetcher: async () => crl });
    const result = await checker.check({
      credential_id: 'ATC-2026-NOT-REVOKED',
      revocation_url: 'uta-fixture://crl/empty.json',
      ca_public_key_pem: caKey.publicKeyPem,
    });
    return result.status === 'good' ? true : { valid: false, reason: `expected good, got ${result.status}` };
  });

  await check('BitstringStatusListChecker rejects revoked bit', async () => {
    const caKey = makeCaKey();
    const zlib = require('node:zlib');
    const buf = Buffer.alloc(8192, 0);
    buf[1] |= (1 << (7 - 2));
    const encoded = zlib.gzipSync(buf).toString('base64url');
    const slc = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      id: 'uta-fixture://statuslist/test.json',
      type: ['VerifiableCredential', 'BitstringStatusListCredential'],
      issuer: 'did:marketnow:ca',
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: 'uta-fixture://statuslist/test.json#list',
        type: 'BitstringStatusList',
        statusPurpose: 'revocation',
        encodedList: encoded,
        ttl: 300,
      },
    };
    const { proof, ...rest } = slc;
    const canonical = coreCrypto.canonicalize(rest);
    const signingInput = Buffer.from('W3C-VC-DATA-INTEGRITY:' + canonical, 'utf-8');
    const signature = crypto.sign(null, signingInput, crypto.createPrivateKey(caKey.privateKeyPem));
    slc.proof = {
      type: 'Ed25519Signature2020',
      proofValue: signature.toString('base64url'),
      proofPurpose: 'assertionMethod',
      created: new Date().toISOString(),
    };
    const checker = new coreRevocation.BitstringStatusListChecker({ fetcher: async () => slc });
    const result = await checker.check({
      credential_id: 'ATC-2026-X',
      status_list_credential_url: 'uta-fixture://statuslist/test.json',
      status_list_index: 10,
      ca_public_key_pem: caKey.publicKeyPem,
    });
    return result.status === 'revoked' ? true : { valid: false, reason: `expected revoked, got ${result.status}` };
  });

  // ── Full pipeline (real modules) ──
  console.log('\n── Full pipeline (real modules) ──');
  await check('verifyCredential accepts valid ATC v3 credential', async () => {
    const caKey = makeCaKey();
    const cred = atcV3.issueATCv3({
      issuer: { did: 'did:marketnow:ca', name: 'Test CA', url: 'https://test.example', ca_key_id: caKey.keyId },
      subject: { agent_id: 'int-pipeline-001', agent_name: 'Pipeline Test', public_key: KEYS.agent_ed25519.public_key_raw_b64url, key_algorithm: 'Ed25519', subject_type: 'agent' },
      capabilities: { provides: ['test'] },
      assessment: { methodology: 'Test', methodology_version: '1.0', score: 8, confidence: 'high', risk_level: 'low' },
      expires_in_days: 30,
      ca_key_pair: caKey,
    });
    const result = await corePipeline.verifyCredential({
      credential: cred,
      ca_public_key: caKey.publicKeyPem,
      policy: { min_trust_score: 5, allowed_issuers: ['did:marketnow:ca'] },
    });
    if (result.decision === 'ALLOW') return true;
    const fails = result.stages.filter(s => s.result === 'FAIL').map(s => `${s.name}: ${s.reason}`).join('; ');
    return { valid: false, reason: `decision=${result.decision}, failures: ${fails}` };
  });

  await check('verifyCredential rejects expired ATC v3', async () => {
    const caKey = makeCaKey();
    const cred = atcV3.issueATCv3({
      issuer: { did: 'did:marketnow:ca', name: 'Test CA', url: 'https://test.example', ca_key_id: caKey.keyId },
      subject: { agent_id: 'int-pipeline-002', agent_name: 'Pipeline Test Expired', public_key: KEYS.agent_ed25519.public_key_raw_b64url, key_algorithm: 'Ed25519', subject_type: 'agent' },
      capabilities: { provides: ['test'] },
      assessment: { methodology: 'Test', methodology_version: '1.0', score: 8, confidence: 'high', risk_level: 'low' },
      expires_in_days: 30,
      ca_key_pair: caKey,
    });
    // Set expiry to past AND re-sign so the signature matches the modified payload.
    // The pipeline should detect expiry at stage 09 (LIFECYCLE), not stage 04 (CRYPTO).
    cred.lifecycle.expires_at = '2020-01-01T00:00:00.000Z';
    const { signatures, ...payload } = cred;
    const newSig = coreCrypto.sign(payload, caKey.privateKeyPem, coreCrypto.DOMAINS.ATC_V3_CREDENTIAL);
    const canonical = coreCrypto.canonicalize(payload);
    cred.signatures = [{
      ...signatures[0],
      value: newSig,
      evidence_hash: 'sha256:' + coreCrypto.canonicalHash(canonical + newSig),
    }];
    const result = await corePipeline.verifyCredential({
      credential: cred,
      ca_public_key: caKey.publicKeyPem,
      policy: { allowed_issuers: ['did:marketnow:ca'] },
    });
    return result.decision === 'DENY' && result.failure_stage === '09_LIFECYCLE'
      ? true
      : { valid: false, reason: `decision=${result.decision}, failure_stage=${result.failure_stage}` };
  });

  // ── Summary ──
  console.log('\n' + '='.repeat(60));
  console.log(`UTA Integration: ${passed}/${passed + failed} tests passed`);
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
