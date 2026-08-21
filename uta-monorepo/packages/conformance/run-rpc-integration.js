/**
 * P9-1: RPC service integration tests.
 */

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist', 'packages');
const KEYS = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'vectors', 'keys', 'manifest.json'), 'utf-8')
).keys;

let rpcModule;
try {
  rpcModule = require(path.join(ROOT, 'packages', 'rpc', 'dist', 'index.js'));
} catch (e) {
  console.error('RPC module not built. Run: cd packages/rpc && npx tsc');
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
      const reason = r?.reason || r?.error || 'returned false';
      failures.push({ name, reason });
      console.log(`❌ ${name}: ${reason}`);
    }
  } catch (e) {
    failed++;
    failures.push({ name, reason: e.message });
    console.log(`❌ ${name}: ${e.message}`);
  }
}

function rpcCall(baseUrl, method, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(`${baseUrl}/uta.trust.v1.TrustService/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch (e) { resolve({ status: res.statusCode, body: { error: e.message } }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('── RPC Service (P9-1) ──');

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

  const server = rpcModule.createRPCServer({
    caKeyPair: caKey,
    gatewayKeyPair: gwKey,
    adminApiKey: 'test-admin-rpc-key',
  });

  const port = 22000 + Math.floor(Math.random() * 1000);
  await server.listen(port, '127.0.0.1');
  const baseUrl = `http://127.0.0.1:${port}`;

  // ── Health ──
  await check('Health returns ok', async () => {
    const r = await rpcCall(baseUrl, 'Health', {});
    return r.status === 200 && r.body.ok === true;
  });

  // ── GetCAKey ──
  await check('GetCAKey returns CA public key', async () => {
    const r = await rpcCall(baseUrl, 'GetCAKey', {});
    return r.status === 200 && r.body.public_key_pem?.includes('BEGIN PUBLIC KEY');
  });

  // ── IssueATCv3 ──
  let issuedCred;
  await check('IssueATCv3 with valid admin key', async () => {
    const r = await rpcCall(baseUrl, 'IssueATCv3', {
      agent_id: 'rpc-test-001',
      agent_name: 'RPC Test',
      public_key: KEYS.agent_ed25519.public_key_raw_b64url,
      key_algorithm: 'Ed25519',
      provides: ['search'],
      trust_score: 8,
      confidence: 'high',
      risk_level: 'low',
      expires_in_days: 30,
      admin_api_key: 'test-admin-rpc-key',
    });
    if (r.status !== 200) return { reason: r.body.error };
    issuedCred = JSON.parse(r.body.credential_json);
    return r.body.credential_id?.startsWith('ATC-');
  });

  await check('IssueATCv3 rejects invalid admin key', async () => {
    const r = await rpcCall(baseUrl, 'IssueATCv3', {
      agent_id: 'rpc-noauth', agent_name: 'X', public_key: 'x', key_algorithm: 'Ed25519',
      admin_api_key: 'wrong-key',
    });
    return r.status === 401;
  });

  // ── VerifyCredential ──
  await check('VerifyCredential accepts valid ATC v3', async () => {
    const r = await rpcCall(baseUrl, 'VerifyCredential', {
      credential_json: JSON.stringify(issuedCred),
    });
    return r.status === 200 && r.body.valid === true && r.body.format === 'atc-v3';
  });

  await check('VerifyCredential rejects tampered credential', async () => {
    const tampered = JSON.parse(JSON.stringify(issuedCred));
    tampered.subject.agent_name = 'TAMPERED';
    const r = await rpcCall(baseUrl, 'VerifyCredential', {
      credential_json: JSON.stringify(tampered),
    });
    return r.status === 200 && r.body.valid === false;
  });

  await check('VerifyCredential includes duration_us', async () => {
    const r = await rpcCall(baseUrl, 'VerifyCredential', {
      credential_json: JSON.stringify(issuedCred),
    });
    return !!(r.body.duration_us > 0);
  });

  // ── CheckTrust ──
  await check('CheckTrust ALLOWs valid credential + safe args', async () => {
    const r = await rpcCall(baseUrl, 'CheckTrust', {
      credential_json: JSON.stringify(issuedCred),
      tool_name: 'search',
      arguments_json: JSON.stringify({ query: 'hello' }),
      allowed_issuers: ['did:marketnow:ca'],
    });
    if (r.status !== 200) return { reason: r.body.error };
    return r.body.allowed === true && r.body.decision === 'ALLOW' && r.body.receipt_json?.length > 0;
  });

  await check('CheckTrust DENYs .env access', async () => {
    const r = await rpcCall(baseUrl, 'CheckTrust', {
      credential_json: JSON.stringify(issuedCred),
      tool_name: 'filesystem.read',
      arguments_json: JSON.stringify({ path: '/home/user/.env' }),
      allowed_issuers: ['did:marketnow:ca'],
    });
    return r.status === 200 && r.body.allowed === false;
  });

  // ── CheckRevocation ──
  await check('CheckRevocation returns good for unrevoked', async () => {
    const r = await rpcCall(baseUrl, 'CheckRevocation', { credential_id: 'ATC-UNKNOWN-001' });
    return r.status === 200;
  });

  // ── RevokeCredential ──
  await check('RevokeCredential with valid admin key', async () => {
    const r = await rpcCall(baseUrl, 'RevokeCredential', {
      credential_id: 'ATC-RPC-REVOKE-001',
      reason: 'test revocation',
      admin_api_key: 'test-admin-rpc-key',
    });
    return r.status === 200 && r.body.success === true;
  });

  await check('RevokeCredential rejects invalid admin key', async () => {
    const r = await rpcCall(baseUrl, 'RevokeCredential', {
      credential_id: 'ATC-RPC-REVOKE-002',
      reason: 'test',
      admin_api_key: 'wrong',
    });
    return r.status === 401;
  });

  await check('CheckRevocation returns revoked after revocation', async () => {
    const r = await rpcCall(baseUrl, 'CheckRevocation', { credential_id: 'ATC-RPC-REVOKE-001' });
    return r.status === 200 && r.body.status === 'revoked';
  });

  // ── Client helper ──
  await check('TrustServiceClient.verifyCredential works', async () => {
    const client = new rpcModule.TrustServiceClient(baseUrl);
    const result = await client.verifyCredential(JSON.stringify(issuedCred));
    return result.valid === true;
  });

  await check('TrustServiceClient.health works', async () => {
    const client = new rpcModule.TrustServiceClient(baseUrl);
    const result = await client.health();
    return result.ok === true;
  });

  await check('TrustServiceClient.getCAKey works', async () => {
    const client = new rpcModule.TrustServiceClient(baseUrl);
    const result = await client.getCAKey();
    return result.key_id === caKey.keyId;
  });

  await check('TrustServiceClient.checkTrust works', async () => {
    const client = new rpcModule.TrustServiceClient(baseUrl);
    const result = await client.checkTrust(
      JSON.stringify(issuedCred),
      'search',
      { query: 'hello' },
      { allowed_issuers: ['did:marketnow:ca'] }
    );
    return result.allowed === true;
  });

  // ── Unknown method ──
  await check('Unknown method returns 404', async () => {
    const r = await rpcCall(baseUrl, 'NonexistentMethod', {});
    return r.status === 404;
  });

  // ── Summary ──
  console.log('\n' + '='.repeat(60));
  console.log(`UTA RPC Integration: ${passed}/${passed + failed} tests passed`);
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
