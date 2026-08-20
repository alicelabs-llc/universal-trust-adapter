/**
 * P4-3: Performance benchmarks.
 *
 * Measures the throughput of each cryptographic operation in the UTA pipeline.
 * Output goes to dist/benchmarks.json so it can be compared across runs / CI.
 *
 * Benchmarks:
 *   - canonicalize() — JCS over a typical ATC v3 credential (~2KB)
 *   - canonicalHash() — SHA-256 of canonical bytes
 *   - Ed25519 sign (issuance)
 *   - Ed25519 verify (verification)
 *   - RSA-SHA256 sign (RS256 JWT)
 *   - RSA-SHA256 verify
 *   - ECDSA P-256 sign (ES256 JWT, IEEE P1363)
 *   - ECDSA P-256 verify
 *   - W3C VC issue + verify (Ed25519Signature2020)
 *   - ATC v3 issue + verify (full flow)
 *   - Receipt generate + verify
 *   - PoP challenge + verify
 *   - Bitstring Status List decode + bit check
 *   - 12-stage pipeline (verifyCredential end-to-end)
 *   - Multi-sig verify (2 signatures)
 *
 * Run with: node packages/conformance/run-benchmarks.js
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
const corePipeline = require(path.join(DIST, 'core', 'verification-pipeline.js'));
const coreRevocation = require(path.join(DIST, 'core', 'revocation.js'));
const atcV3 = require(path.join(DIST, 'adapters', 'atc-v3.js'));
const cryptoAdapters = require(path.join(DIST, 'adapters', 'crypto-adapters.js'));
const receipts = require(path.join(DIST, 'gateway', 'receipts.js'));
const multisig = require(path.join(DIST, 'adapters', 'multisig.js'));

function makeCaKey() {
  return {
    privateKeyPem: KEYS.ca_ed25519.private_key_pem,
    publicKeyPem: KEYS.ca_ed25519.public_key_pem,
    publicKeyRaw: KEYS.ca_ed25519.public_key_raw_b64url,
    keyId: KEYS.ca_ed25519.key_id,
  };
}

function makeGatewayKey() {
  return {
    privateKeyPem: KEYS.gateway_ed25519.private_key_pem,
    publicKeyPem: KEYS.gateway_ed25519.public_key_pem,
    publicKeyRaw: KEYS.gateway_ed25519.public_key_raw_b64url,
    keyId: KEYS.gateway_ed25519.key_id,
  };
}

function makeValidCred() {
  const caKey = makeCaKey();
  return atcV3.issueATCv3({
    issuer: { did: 'did:marketnow:ca', name: 'Test CA', url: 'https://test.example', ca_key_id: caKey.keyId },
    subject: { agent_id: 'bench-001', agent_name: 'Bench Agent', public_key: KEYS.agent_ed25519.public_key_raw_b64url, key_algorithm: 'Ed25519', subject_type: 'agent' },
    capabilities: { provides: ['test'] },
    assessment: { methodology: 'Test', methodology_version: '1.0', score: 8, confidence: 'high', risk_level: 'low' },
    expires_in_days: 30,
    ca_key_pair: caKey,
  });
}

// ============================================================================
// Benchmark harness
// ============================================================================

/**
 * Run a benchmark. Returns ops/sec.
 * @param name - human-readable name
 * @param fn - the operation to time. Should be synchronous and side-effect free.
 * @param iterations - how many times to run. Default 1000.
 * @param warmup - warmup iterations (not timed). Default 100.
 */
function bench(name, fn, { iterations = 1000, warmup = 100 } = {}) {
  // Warmup
  for (let i = 0; i < warmup; i++) fn();

  // Timed run
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) fn();
  const end = process.hrtime.bigint();

  const ns = Number(end - start);
  const ms = ns / 1_000_000;
  const opsPerSec = Math.round((iterations / ms) * 1000);
  const usPerOp = (ms * 1000) / iterations;

  return {
    name,
    iterations,
    total_ms: Math.round(ms * 100) / 100,
    us_per_op: Math.round(usPerOp * 100) / 100,
    ops_per_sec: opsPerSec,
  };
}

async function benchAsync(name, fn, { iterations = 1000, warmup = 100 } = {}) {
  for (let i = 0; i < warmup; i++) await fn();
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) await fn();
  const end = process.hrtime.bigint();
  const ns = Number(end - start);
  const ms = ns / 1_000_000;
  const opsPerSec = Math.round((iterations / ms) * 1000);
  const usPerOp = (ms * 1000) / iterations;
  return {
    name,
    iterations,
    total_ms: Math.round(ms * 100) / 100,
    us_per_op: Math.round(usPerOp * 100) / 100,
    ops_per_sec: opsPerSec,
  };
}

// ============================================================================
// Build fixtures
// ============================================================================

const cred = makeValidCred();
const credPayload = (() => { const { signatures, ...rest } = cred; return rest; })();
const credCanonical = coreCrypto.canonicalize(credPayload);
const credSignatureHex = cred.signatures[0].value;

const popChallenge = coreCrypto.generatePoPChallenge('ATC-2026-BENCH', 'marketnow-gateway');
const popResponse = coreCrypto.createPoPResponse(popChallenge, KEYS.agent_ed25519.private_key_pem);

const receipt = new receipts.ReceiptGenerator(new receipts.ReceiptStore(), makeGatewayKey()).generate({
  decision: 'ALLOW', agent_id: 'bench-agent', credential_id: 'ATC-2026-BENCH',
  tool_name: 'test', args: { x: 1 }, trust_score: 8,
});

// JWT fixtures
const jwtHeader = { alg: 'EdDSA', typ: 'JWT', kid: KEYS.ca_ed25519.key_id };
const jwtClaims = { iss: 'https://test.example', sub: 'bench-agent', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 };
const jwtHeaderB64 = Buffer.from(JSON.stringify(jwtHeader)).toString('base64url');
const jwtClaimsB64 = Buffer.from(JSON.stringify(jwtClaims)).toString('base64url');
const jwtSigningInput = Buffer.from(`${jwtHeaderB64}.${jwtClaimsB64}`, 'utf-8');
const jwtSignature = crypto.sign(null, jwtSigningInput, crypto.createPrivateKey(KEYS.ca_ed25519.private_key_pem));
const jwtString = `${jwtHeaderB64}.${jwtClaimsB64}.${jwtSignature.toString('base64url')}`;

// W3C VC fixture
const vcCred = {
  '@context': ['https://www.w3.org/2018/credentials/v1', 'https://w3id.org/security/suites/ed25519-2020/v1'],
  id: 'urn:uuid:bench',
  type: ['VerifiableCredential', 'AgentTrustCredential'],
  issuer: 'did:marketnow:ca',
  issuanceDate: new Date().toISOString(),
  expirationDate: new Date(Date.now() + 365 * 86400000).toISOString(),
  credentialSubject: { id: 'did:marketnow:agent:bench', trust_score: 8 },
};
const signedVc = cryptoAdapters.issueW3CVC(vcCred, KEYS.ca_ed25519.private_key_pem);

// Multi-sig fixture (2 signers)
const caKey = makeCaKey();
const gwKey = makeGatewayKey();
const multiCred = multisig.appendSignatures(cred, [{ keyPair: gwKey, signed_by: 'Gateway Auditor' }]);
const multiSigKeys = new Map([
  [caKey.keyId, caKey.publicKeyPem],
  [gwKey.keyId, gwKey.publicKeyPem],
]);

// ============================================================================
// Run benchmarks
// ============================================================================

(async () => {
  console.log('UTA Performance Benchmarks');
  console.log('==========================\n');
  console.log(`Node.js ${process.version}, ${process.arch}, ${require('os').cpus().length} CPUs\n`);

  const results = [];

  // ── JCS canonicalization ──
  results.push(bench('canonicalize (ATC v3 ~2KB)', () => {
    coreCrypto.canonicalize(credPayload);
  }));

  results.push(bench('canonicalize (small flat object)', () => {
    coreCrypto.canonicalize({ a: 1, b: 'hello', c: true, d: null });
  }, { iterations: 10000 }));

  results.push(bench('canonicalHash (ATC v3 payload)', () => {
    coreCrypto.canonicalHash(credPayload);
  }));

  // ── Ed25519 sign + verify ──
  const ed25519PrivateKey = crypto.createPrivateKey(KEYS.ca_ed25519.private_key_pem);
  const ed25519PublicKey = crypto.createPublicKey(KEYS.ca_ed25519.public_key_pem);
  const signingBytes = Buffer.from(coreCrypto.DOMAINS.ATC_V3_CREDENTIAL + ':' + credCanonical, 'utf-8');

  results.push(bench('Ed25519 sign', () => {
    crypto.sign(null, signingBytes, ed25519PrivateKey);
  }));

  results.push(bench('Ed25519 verify', () => {
    crypto.verify(null, signingBytes, ed25519PublicKey, Buffer.from(credSignatureHex, 'hex'));
  }));

  // ── RSA-SHA256 (RS256 JWT) sign + verify ──
  const rsaPrivateKey = crypto.createPrivateKey(KEYS.ca_rsa.private_key_pem);
  const rsaPublicKey = crypto.createPublicKey(KEYS.ca_rsa.public_key_pem);
  const rsaSig = crypto.sign('RSA-SHA256', jwtSigningInput, rsaPrivateKey);

  results.push(bench('RSA-SHA256 sign (RS256, 2048-bit)', () => {
    crypto.sign('RSA-SHA256', jwtSigningInput, rsaPrivateKey);
  }, { iterations: 500 }));

  results.push(bench('RSA-SHA256 verify (RS256, 2048-bit)', () => {
    crypto.verify('RSA-SHA256', jwtSigningInput, rsaPublicKey, rsaSig);
  }, { iterations: 500 }));

  // ── ECDSA P-256 (ES256 JWT) sign + verify ──
  const ecPrivateKey = crypto.createPrivateKey(KEYS.ca_ecdsa.private_key_pem);
  const ecPublicKey = crypto.createPublicKey(KEYS.ca_ecdsa.public_key_pem);
  const ecSig = crypto.sign('SHA256', jwtSigningInput, { key: ecPrivateKey, dsaEncoding: 'ieee-p1363' });

  results.push(bench('ECDSA P-256 sign (ES256, IEEE P1363)', () => {
    crypto.sign('SHA256', jwtSigningInput, { key: ecPrivateKey, dsaEncoding: 'ieee-p1363' });
  }));

  results.push(bench('ECDSA P-256 verify (ES256, IEEE P1363)', () => {
    crypto.verify('SHA256', jwtSigningInput, { key: ecPublicKey, dsaEncoding: 'ieee-p1363' }, ecSig);
  }));

  // ── W3C VC issue + verify ──
  results.push(bench('W3C VC issue (Ed25519Signature2020)', () => {
    cryptoAdapters.issueW3CVC(vcCred, KEYS.ca_ed25519.private_key_pem);
  }));

  results.push(bench('W3C VC verify (Ed25519Signature2020)', () => {
    cryptoAdapters.verifyW3CVC(signedVc, KEYS.ca_ed25519.public_key_pem);
  }));

  // ── ATC v3 issue + verify ──
  results.push(bench('ATC v3 issue (issueATCv3)', () => {
    atcV3.issueATCv3({
      issuer: { did: 'did:marketnow:ca', name: 'Test CA', url: 'https://test.example', ca_key_id: caKey.keyId },
      subject: { agent_id: 'bench-iter', agent_name: 'Bench', public_key: KEYS.agent_ed25519.public_key_raw_b64url, key_algorithm: 'Ed25519', subject_type: 'agent' },
      capabilities: { provides: ['test'] },
      assessment: { methodology: 'Test', methodology_version: '1.0', score: 8, confidence: 'high', risk_level: 'low' },
      expires_in_days: 30,
      ca_key_pair: caKey,
    });
  }));

  results.push(bench('ATC v3 verify (verifyATCv3)', () => {
    atcV3.verifyATCv3(cred, KEYS.ca_ed25519.public_key_pem);
  }));

  // ── Receipt generate + verify ──
  const receiptStore = new receipts.ReceiptStore();
  const receiptGen = new receipts.ReceiptGenerator(receiptStore, makeGatewayKey());

  results.push(bench('Receipt generate (signed)', () => {
    receiptGen.generate({
      decision: 'ALLOW', agent_id: 'a', credential_id: 'ATC-1', tool_name: 't',
      args: { foo: 'bar' }, trust_score: 8,
    });
  }));

  results.push(bench('Receipt verify', () => {
    receiptGen.verify(receipt, KEYS.gateway_ed25519.public_key_pem);
  }));

  // ── PoP challenge + verify ──
  results.push(bench('PoP generatePoPChallenge', () => {
    coreCrypto.generatePoPChallenge('ATC-BENCH', 'marketnow-gateway');
  }));

  results.push(bench('PoP createPoPResponse', () => {
    coreCrypto.createPoPResponse(popChallenge, KEYS.agent_ed25519.private_key_pem);
  }));

  results.push(bench('PoP verifyPoP', () => {
    coreCrypto.verifyPoP(popResponse, KEYS.agent_ed25519.public_key_pem, popChallenge);
  }));

  // ── Bitstring Status List decode + bit check ──
  const zlib = require('node:zlib');
  const statusListBuf = Buffer.alloc(8192, 0);
  statusListBuf[100] |= 0x01;  // set bit at index 801
  const encodedList = zlib.gzipSync(statusListBuf).toString('base64url');

  results.push(bench('Bitstring Status List decode (gzip + base64url, 8KB)', () => {
    const compressed = Buffer.from(encodedList, 'base64url');
    zlib.gunzipSync(compressed);
  }));

  const decodedList = zlib.gunzipSync(Buffer.from(encodedList, 'base64url'));
  results.push(bench('Bitstring Status List bit check', () => {
    const idx = 801;
    const byteIdx = Math.floor(idx / 8);
    const bitIdx = idx % 8;
    (decodedList[byteIdx] >> (7 - bitIdx)) & 1;
  }, { iterations: 100000 }));

  // ── 12-stage pipeline ──
  results.push(await benchAsync('12-stage pipeline (verifyCredential, ALLOW)', async () => {
    await corePipeline.verifyCredential({
      credential: cred,
      ca_public_key: KEYS.ca_ed25519.public_key_pem,
      policy: { min_trust_score: 5, allowed_issuers: ['did:marketnow:ca'] },
    });
  }, { iterations: 500 }));

  // ── Multi-sig verify (2 signatures) ──
  results.push(bench('Multi-sig verify (2 signatures)', () => {
    multisig.verifyMultiSig(multiCred, multiSigKeys, { min_signatures: 2 });
  }));

  // ── Multi-sig verify (3 signatures) ──
  const agentKey = {
    privateKeyPem: KEYS.agent_ed25519.private_key_pem,
    publicKeyPem: KEYS.agent_ed25519.public_key_pem,
    publicKeyRaw: KEYS.agent_ed25519.public_key_raw_b64url,
    keyId: KEYS.agent_ed25519.key_id,
  };
  const threeCred = multisig.appendSignatures(multiCred, [{ keyPair: agentKey, signed_by: 'Agent' }]);
  const threeKeys = new Map([
    [caKey.keyId, caKey.publicKeyPem],
    [gwKey.keyId, gwKey.publicKeyPem],
    [agentKey.keyId, agentKey.publicKeyPem],
  ]);

  results.push(bench('Multi-sig verify (3 signatures)', () => {
    multisig.verifyMultiSig(threeCred, threeKeys, { min_signatures: 3 });
  }));

  // ── Print results ──
  console.log('─'.repeat(80));
  console.log('Benchmark                              | ops/sec  | μs/op   | total (ms)');
  console.log('─'.repeat(80));
  for (const r of results) {
    console.log(
      r.name.padEnd(40) + ' | ' +
      r.ops_per_sec.toString().padStart(8) + ' | ' +
      r.us_per_op.toFixed(2).padStart(7) + ' | ' +
      r.total_ms.toFixed(2).padStart(9)
    );
  }
  console.log('─'.repeat(80));

  // ── Save to dist/benchmarks.json ──
  const report = {
    generated_at: new Date().toISOString(),
    node_version: process.version,
    platform: process.platform,
    arch: process.arch,
    cpus: require('os').cpus().length,
    cpu_model: require('os').cpus()[0]?.model || 'unknown',
    benchmarks: results,
  };

  const outPath = path.join(ROOT, 'dist', 'benchmarks.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf-8');
  console.log(`\n✅ Saved to ${path.relative(process.cwd(), outPath)}`);
})();
