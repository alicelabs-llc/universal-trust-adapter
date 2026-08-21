/**
 * P6-1: REST API server integration tests.
 * Starts a real HTTP server on a random port and tests all endpoints.
 */

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist', 'packages');
const KEYS = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'vectors', 'keys', 'manifest.json'), 'utf-8')
).keys;

const coreCrypto = require(path.join(DIST, 'core', 'crypto.js'));
const atcV3 = require(path.join(DIST, 'adapters', 'atc-v3.js'));
const receipts = require(path.join(DIST, 'gateway', 'receipts.js'));
const coreRevocation = require(path.join(DIST, 'core', 'revocation.js'));
const trustRegistry = require(path.join(DIST, 'core', 'trust-registry.js'));
const nonceStore = require(path.join(DIST, 'core', 'nonce-store.js'));

// Load server module (compiled)
let serverModule;
try {
  serverModule = require(path.join(ROOT, 'packages', 'server', 'dist', 'index.js'));
} catch (e) {
  console.error('Server module not built. Run: cd packages/server && npx tsc');
  process.exit(1);
}

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

function httpRequest(port, method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      host: '127.0.0.1', port, path, method,
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
    };
    if (data) opts.headers['content-length'] = Buffer.byteLength(data);
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        let json = null;
        try { json = JSON.parse(text); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: json, text });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // Build config
  const caKey = {
    privateKeyPem: KEYS.ca_ed25519.private_key_pem,
    publicKeyPem: KEYS.ca_ed25519.public_key_pem,
    publicKeyRaw: KEYS.ca_ed25519.public_key_raw_b64url,
    keyId: KEYS.ca_ed25519.key_id,
  };
  const gwKey = {
    privateKeyPem: KEYS.gateway_ed25519.private_key_pem,
    publicKeyPem: KEYS.gateway_ed25519.public_key_pem,
    publicKeyRaw: KEYS.gateway_ed25519.public_key_raw_b64url,
    keyId: KEYS.gateway_ed25519.key_id,
  };

  const revStore = new coreRevocation.InMemoryRevocationStore();
  const receiptStore = new receipts.ReceiptStore();
  const store = new nonceStore.MemoryNonceStore();
  const registry = new trustRegistry.TrustRegistry();
  registry.registerKey({
    key_id: caKey.keyId,
    public_key_pem: caKey.publicKeyPem,
    algorithm: 'Ed25519',
    issuer: 'did:marketnow:ca',
    status: 'active',
  });

  const config = {
    port: 19000 + Math.floor(Math.random() * 1000),
    host: '127.0.0.1',
    caKeyPair: caKey,
    gatewayKeyPair: gwKey,
    adminApiKey: 'test-admin-key-secret',
    revocationStore: revStore,
    receiptStore,
    nonceStore: store,
    trustRegistry: registry,
    enableCors: true,
  };

  const server = serverModule.createServer(config);
  await new Promise(r => server.listen(config.port, config.host, r));

  const port = config.port;
  const adminHeaders = { 'x-api-key': 'test-admin-key-secret' };

  console.log('── REST API Server ──');

  // ── Health ──
  await check('GET /api/health returns ok', async () => {
    const r = await httpRequest(port, 'GET', '/api/health');
    return r.status === 200 && r.body.ok === true && r.body.ca_key_id === caKey.keyId;
  });

  // ── CA key ──
  await check('GET /api/ca/key returns PEM', async () => {
    const r = await httpRequest(port, 'GET', '/api/ca/key');
    return r.status === 200 && r.text.includes('BEGIN PUBLIC KEY');
  });

  await check('GET /api/ca/key-info returns key metadata', async () => {
    const r = await httpRequest(port, 'GET', '/api/ca/key-info');
    return r.status === 200 && r.body.key_id === caKey.keyId && r.body.algorithm === 'Ed25519';
  });

  // ── Verify endpoint ──
  await check('POST /api/verify accepts valid ATC v3', async () => {
    // First issue one
    const issueResp = await httpRequest(port, 'POST', '/api/issue/atc-v3', {
      subject: { agent_id: 'srv-test-001', agent_name: 'Server Test', public_key: KEYS.agent_ed25519.public_key_raw_b64url, key_algorithm: 'Ed25519', subject_type: 'agent' },
      capabilities: { provides: ['test'] },
      assessment: { methodology: 'Test', methodology_version: '1.0', score: 8, confidence: 'high', risk_level: 'low' },
      expires_in_days: 30,
    }, adminHeaders);
    const cred = issueResp.body.credential;
    const r = await httpRequest(port, 'POST', '/api/verify', { credential: cred });
    return r.status === 200 && r.body.valid === true && r.body.format === 'atc-v3';
  });

  await check('POST /api/verify rejects tampered ATC v3', async () => {
    const issueResp = await httpRequest(port, 'POST', '/api/issue/atc-v3', {
      subject: { agent_id: 'srv-test-002', agent_name: 'Original', public_key: KEYS.agent_ed25519.public_key_raw_b64url, key_algorithm: 'Ed25519', subject_type: 'agent' },
      capabilities: { provides: ['test'] },
      assessment: { methodology: 'Test', methodology_version: '1.0', score: 8, confidence: 'high', risk_level: 'low' },
      expires_in_days: 30,
    }, adminHeaders);
    const cred = issueResp.body.credential;
    cred.subject.agent_name = 'TAMPERED';
    const r = await httpRequest(port, 'POST', '/api/verify', { credential: cred });
    return r.status === 200 && r.body.valid === false;
  });

  // ── Issue endpoints ──
  await check('POST /api/issue/atc-v3 requires admin API key', async () => {
    const r = await httpRequest(port, 'POST', '/api/issue/atc-v3', {
      subject: { agent_id: 'srv-noauth', agent_name: 'X', public_key: 'x', key_algorithm: 'Ed25519', subject_type: 'agent' },
      capabilities: { provides: [] },
      assessment: { methodology: 'X', methodology_version: '1', score: 1, confidence: 'low', risk_level: 'high' },
      expires_in_days: 1,
    }, {});  // no API key
    return r.status === 401 && r.body.error.includes('X-API-Key');
  });

  await check('POST /api/issue/vc issues a W3C VC', async () => {
    const r = await httpRequest(port, 'POST', '/api/issue/vc', {
      credential: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        id: 'urn:uuid:' + crypto.randomUUID(),
        type: ['VerifiableCredential'],
        issuer: 'did:marketnow:ca',
        issuanceDate: new Date().toISOString(),
        credentialSubject: { id: 'did:marketnow:agent:1' },
      },
    }, adminHeaders);
    return !!(r.status === 201 && r.body.credential?.proof?.proofValue);
  });

  await check('POST /api/issue/a2a issues an A2A card', async () => {
    const r = await httpRequest(port, 'POST', '/api/issue/a2a', {
      agent_id: 'srv-a2a-001',
      agent_name: 'A2A Server Test',
      agent_url: 'https://agents.example/a2a-001',
      capabilities: ['search'],
      public_key: KEYS.agent_ed25519.public_key_raw_b64url,
      expires_in_days: 30,
    }, adminHeaders);
    return !!(r.status === 201 && r.body.agentCard?.proof?.proofValue);
  });

  await check('POST /api/issue/eat issues an EAT token', async () => {
    const r = await httpRequest(port, 'POST', '/api/issue/eat', {
      subject: 'srv-eat-001',
      trust_score: 7,
      trust_level: 'medium',
      expires_in_days: 30,
      alg: 'EdDSA',
    }, adminHeaders);
    return !!(r.status === 201 && r.body.token?.signature && r.body.token?.payload?.iss);
  });

  await check('POST /api/issue/zta issues a ZTA card', async () => {
    const r = await httpRequest(port, 'POST', '/api/issue/zta', {
      agent_id: 'srv-zta-001',
      agent_name: 'ZTA Server Test',
      trust_score: 7,
      confidence: 'medium',
      expires_in_days: 30,
    }, adminHeaders);
    return !!(r.status === 201 && r.body.card?.signature?.value);
  });

  await check('POST /api/issue/mcp issues an MCP card', async () => {
    const r = await httpRequest(port, 'POST', '/api/issue/mcp', {
      name: 'srv-mcp-test',
      tools: [{ name: 'search' }, { name: 'fetch' }],
      expires_in_days: 30,
    }, adminHeaders);
    return !!(r.status === 201 && r.body.card?.signature?.value);
  });

  // ── Revoke + OCSP ──
  await check('POST /api/revoke/:cred_id sets status to revoked', async () => {
    const r = await httpRequest(port, 'POST', '/api/revoke/ATC-REVOKE-TEST-001', { reason: 'compromise' }, adminHeaders);
    return r.status === 200 && r.body.status === 'revoked';
  });

  await check('GET /api/trust/:cred_id returns revoked status', async () => {
    const r = await httpRequest(port, 'GET', '/api/trust/ATC-REVOKE-TEST-001');
    return r.status === 200 && r.body.status === 'revoked';
  });

  await check('POST /api/ocsp returns signed response', async () => {
    const r = await httpRequest(port, 'POST', '/api/ocsp', {
      credential_id: 'ATC-REVOKE-TEST-001',
      nonce: crypto.randomBytes(32).toString('hex'),
    });
    return r.status === 200 && r.body.signature && r.body.status === 'revoked';
  });

  await check('GET /api/ocsp/:cred_id returns status', async () => {
    const r = await httpRequest(port, 'GET', '/api/ocsp/ATC-REVOKE-TEST-001');
    return r.status === 200 && r.body.status === 'revoked';
  });

  // ── Gateway check ──
  await check('POST /api/gateway/check ALLOWs valid credential', async () => {
    const issueResp = await httpRequest(port, 'POST', '/api/issue/atc-v3', {
      subject: { agent_id: 'srv-gw-001', agent_name: 'GW Test', public_key: KEYS.agent_ed25519.public_key_raw_b64url, key_algorithm: 'Ed25519', subject_type: 'agent' },
      capabilities: { provides: ['test'] },
      assessment: { methodology: 'Test', methodology_version: '1.0', score: 8, confidence: 'high', risk_level: 'low' },
      expires_in_days: 30,
    }, adminHeaders);
    const cred = issueResp.body.credential;
    const r = await httpRequest(port, 'POST', '/api/gateway/check', {
      credential: cred,
      tool_name: 'mcp.tools.search',
      args: { query: 'hello' },
      allowed_issuers: ['did:marketnow:ca'],
    });
    return !!(r.status === 200 && r.body.decision?.decision === 'ALLOW' && r.body.receipt?.signature);
  });

  await check('POST /api/gateway/check DENYs .env access', async () => {
    const issueResp = await httpRequest(port, 'POST', '/api/issue/atc-v3', {
      subject: { agent_id: 'srv-gw-002', agent_name: 'GW Secret', public_key: KEYS.agent_ed25519.public_key_raw_b64url, key_algorithm: 'Ed25519', subject_type: 'agent' },
      capabilities: { provides: ['test'] },
      assessment: { methodology: 'Test', methodology_version: '1.0', score: 8, confidence: 'high', risk_level: 'low' },
      expires_in_days: 30,
    }, adminHeaders);
    const cred = issueResp.body.credential;
    const r = await httpRequest(port, 'POST', '/api/gateway/check', {
      credential: cred,
      tool_name: 'filesystem.read',
      args: { path: '/home/user/.env' },
      allowed_issuers: ['did:marketnow:ca'],
    });
    return r.status === 200 && r.body.decision?.decision === 'DENY';
  });

  // ── Receipts ──
  await check('GET /api/receipts lists action receipts', async () => {
    const r = await httpRequest(port, 'GET', '/api/receipts');
    return r.status === 200 && Array.isArray(r.body.receipts) && r.body.count > 0;
  });

  // ── Metrics ──
  await check('GET /api/metrics returns Prometheus format', async () => {
    const r = await httpRequest(port, 'GET', '/api/metrics');
    return r.status === 200 && r.text.includes('uta_requests_total') && r.text.includes('uta_verifications_total');
  });

  // ── 404 ──
  await check('GET /api/nonexistent returns 404', async () => {
    const r = await httpRequest(port, 'GET', '/api/nonexistent');
    return r.status === 404;
  });

  // ── Summary ──
  console.log('\n' + '='.repeat(60));
  console.log(`UTA Server Integration: ${passed}/${passed + failed} tests passed`);
  console.log(`Conformant: ${failed === 0 ? 'YES ✅' : 'NO ❌'}`);
  if (failed > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f.name}: ${f.reason}`);
  }

  server.close();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
