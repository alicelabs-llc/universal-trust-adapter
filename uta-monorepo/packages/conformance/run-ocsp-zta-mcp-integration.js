/**
 * P5-1 + P5-2 + P5-3: OCSP responder, ZTA adapter, MCP adapter integration tests.
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

const coreRevocation = require(path.join(DIST, 'core', 'revocation.js'));
const ztaAdapter = require(path.join(DIST, 'adapters', 'zta-adapter.js'));
const mcpAdapter = require(path.join(DIST, 'adapters', 'mcp-adapter.js'));

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

async function main() {
  // ════════════════════════════════════════════════════════════════════
  // P5-1: OCSP Responder
  // ════════════════════════════════════════════════════════════════════
  console.log('── OCSP Responder (P5-1) ──');

  const responderKeys = {
    did: 'did:marketnow:ocsp-responder',
    private_key_pem: KEYS.gateway_ed25519.private_key_pem,
    public_key_pem: KEYS.gateway_ed25519.public_key_pem,
    key_id: KEYS.gateway_ed25519.key_id,
  };

  await check('InMemoryRevocationStore sets + gets status', async () => {
    const store = new coreRevocation.InMemoryRevocationStore();
    store.setStatus('ATC-001', 'revoked', 'compromise');
    store.setStatus('ATC-002', 'good');
    const r1 = await store.getStatus('ATC-001');
    const r2 = await store.getStatus('ATC-002');
    const r3 = await store.getStatus('ATC-UNKNOWN');
    return r1.status === 'revoked' && r2.status === 'good' && r3.status === 'unknown';
  });

  await check('issueOCSPResponse produces signed response', () => {
    const nonce = crypto.randomBytes(32).toString('hex');
    const resp = coreRevocation.issueOCSPResponse({
      credential_id: 'ATC-OCSP-001',
      status: 'good',
      issuer_did: 'did:marketnow:ca',
      responder_did: responderKeys.did,
      responder_private_key_pem: responderKeys.private_key_pem,
      responder_key_id: responderKeys.key_id,
      nonce,
    });
    return resp && resp.signature && resp.signature.value.length === 128 && resp.nonce === nonce;
  });

  await check('verifyOCSPResponse accepts correctly signed response', () => {
    const nonce = crypto.randomBytes(32).toString('hex');
    const resp = coreRevocation.issueOCSPResponse({
      credential_id: 'ATC-OCSP-002',
      status: 'good',
      issuer_did: 'did:marketnow:ca',
      responder_did: responderKeys.did,
      responder_private_key_pem: responderKeys.private_key_pem,
      responder_key_id: responderKeys.key_id,
      nonce,
    });
    return coreRevocation.verifyOCSPResponse(resp, responderKeys.public_key_pem);
  });

  await check('verifyOCSPResponse rejects response signed with wrong key', () => {
    const nonce = crypto.randomBytes(32).toString('hex');
    const resp = coreRevocation.issueOCSPResponse({
      credential_id: 'ATC-OCSP-003',
      status: 'good',
      issuer_did: 'did:marketnow:ca',
      responder_did: responderKeys.did,
      responder_private_key_pem: responderKeys.private_key_pem,
      responder_key_id: responderKeys.key_id,
      nonce,
    });
    // Try to verify with the CA key (different from responder key)
    return !coreRevocation.verifyOCSPResponse(resp, KEYS.ca_ed25519.public_key_pem);
  });

  await check('verifyOCSPResponse rejects tampered response', () => {
    const nonce = crypto.randomBytes(32).toString('hex');
    const resp = coreRevocation.issueOCSPResponse({
      credential_id: 'ATC-OCSP-004',
      status: 'good',
      issuer_did: 'did:marketnow:ca',
      responder_did: responderKeys.did,
      responder_private_key_pem: responderKeys.private_key_pem,
      responder_key_id: responderKeys.key_id,
      nonce,
    });
    resp.status = 'revoked';  // tamper
    return !coreRevocation.verifyOCSPResponse(resp, responderKeys.public_key_pem);
  });

  await check('handleOCSPRequest returns 400 for missing credential_id', async () => {
    const store = new coreRevocation.InMemoryRevocationStore();
    const result = await coreRevocation.handleOCSPRequest({ nonce: 'a'.repeat(64) }, store, responderKeys);
    return result.status === 400 && result.body.error.includes('credential_id');
  });

  await check('handleOCSPRequest returns 400 for malformed nonce', async () => {
    const store = new coreRevocation.InMemoryRevocationStore();
    const result = await coreRevocation.handleOCSPRequest({ credential_id: 'ATC-1', nonce: 'short' }, store, responderKeys);
    return result.status === 400 && result.body.error.includes('nonce');
  });

  await check('handleOCSPRequest returns good status for non-revoked credential', async () => {
    const store = new coreRevocation.InMemoryRevocationStore();
    store.setStatus('ATC-GOOD-001', 'good');
    const result = await coreRevocation.handleOCSPRequest({
      credential_id: 'ATC-GOOD-001',
      nonce: crypto.randomBytes(32).toString('hex'),
    }, store, responderKeys);
    return !!(result.status === 200 && result.body.status === 'good' && result.body.signature);
  });

  await check('handleOCSPRequest returns revoked status for revoked credential', async () => {
    const store = new coreRevocation.InMemoryRevocationStore();
    store.setStatus('ATC-REVOKE-001', 'revoked', 'key compromise');
    const result = await coreRevocation.handleOCSPRequest({
      credential_id: 'ATC-REVOKE-001',
      nonce: crypto.randomBytes(32).toString('hex'),
    }, store, responderKeys);
    return result.status === 200 && result.body.status === 'revoked' && result.body.reason === 'key compromise';
  });

  await check('handleOCSPRequest returns unknown status for credential not in store', async () => {
    const store = new coreRevocation.InMemoryRevocationStore();
    const result = await coreRevocation.handleOCSPRequest({
      credential_id: 'ATC-UNKNOWN-001',
      nonce: crypto.randomBytes(32).toString('hex'),
    }, store, responderKeys);
    return result.status === 200 && result.body.status === 'unknown';
  });

  await check('handleOCSPRequest echoes nonce (replay protection)', async () => {
    const store = new coreRevocation.InMemoryRevocationStore();
    const nonce = crypto.randomBytes(32).toString('hex');
    const result = await coreRevocation.handleOCSPRequest({
      credential_id: 'ATC-NONCE-001',
      nonce,
    }, store, responderKeys);
    return result.body.nonce === nonce;
  });

  // ── Full HTTP server test ──
  await check('createOCSPServer starts and handles POST /ocsp', async () => {
    const store = new coreRevocation.InMemoryRevocationStore();
    store.setStatus('ATC-HTTP-001', 'good');
    const server = coreRevocation.createOCSPServer({ store, responderKeys });
    const port = 18080 + Math.floor(Math.random() * 1000);
    await server.listen(port, '127.0.0.1');

    // Wait for server to be ready
    await new Promise(r => setTimeout(r, 100));

    try {
      const resp = await new Promise((resolve, reject) => {
        const req = http.request({
          host: '127.0.0.1', port, path: '/ocsp', method: 'POST',
          headers: { 'content-type': 'application/json' },
        }, (res) => {
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }));
        });
        req.on('error', reject);
        req.write(JSON.stringify({ credential_id: 'ATC-HTTP-001', nonce: crypto.randomBytes(32).toString('hex') }));
        req.end();
      });
      return !!(resp.status === 200 && resp.body.status === 'good' && resp.body.signature);
    } finally {
      // Server cleanup is best-effort — Node's http server has no easy close here
    }
  });

  await check('createOCSPServer handles GET /health', async () => {
    const store = new coreRevocation.InMemoryRevocationStore();
    const server = coreRevocation.createOCSPServer({ store, responderKeys });
    const port = 18180 + Math.floor(Math.random() * 1000);
    await server.listen(port, '127.0.0.1');
    await new Promise(r => setTimeout(r, 100));

    const resp = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/health`, (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }));
      }).on('error', reject);
    });
    return resp.status === 200 && resp.body.ok === true && resp.body.responder === responderKeys.did;
  });

  await check('createOCSPServer handles GET /responder-key', async () => {
    const store = new coreRevocation.InMemoryRevocationStore();
    const server = coreRevocation.createOCSPServer({ store, responderKeys });
    const port = 18280 + Math.floor(Math.random() * 1000);
    await server.listen(port, '127.0.0.1');
    await new Promise(r => setTimeout(r, 100));

    const resp = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/responder-key`, (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
      }).on('error', reject);
    });
    return resp.status === 200 && resp.body.includes('BEGIN PUBLIC KEY');
  });

  // ════════════════════════════════════════════════════════════════════
  // P5-2: ZTA Adapter
  // ════════════════════════════════════════════════════════════════════
  console.log('\n── ZTA Adapter (P5-2) ──');

  await check('issueZTACard produces a card with signature', () => {
    const card = ztaAdapter.issueZTACard({
      agent_id: 'zta-agent-001',
      agent_name: 'ZTA Test Agent',
      public_key: KEYS.agent_ed25519.public_key_raw_b64url,
      did: 'did:marketnow:agent:zta-001',
      trust_score: 8,
      confidence: 'high',
      evidence: [{ type: 'sentinel-audit', source: 'marketnow', result: 'pass', details: 'Audit passed' }],
      provides: ['search'],
      expires_in_days: 30,
      issuer_did: 'did:marketnow:ca',
      issuer_name: 'MarketNow CA',
      issuer_private_key_pem: KEYS.ca_ed25519.private_key_pem,
      issuer_key_id: KEYS.ca_ed25519.key_id,
    });
    return card && card.signature && card.signature.value.length === 128 && card.signature.domain === 'UTA-ZTA-CARD';
  });

  await check('verifyZTACard accepts correctly signed card', () => {
    const card = ztaAdapter.issueZTACard({
      agent_id: 'zta-002',
      agent_name: 'ZTA Valid',
      trust_score: 7,
      confidence: 'medium',
      expires_in_days: 30,
      issuer_did: 'did:marketnow:ca',
      issuer_name: 'MarketNow CA',
      issuer_private_key_pem: KEYS.ca_ed25519.private_key_pem,
      issuer_key_id: KEYS.ca_ed25519.key_id,
    });
    const result = ztaAdapter.verifyZTACard(card, KEYS.ca_ed25519.public_key_pem);
    return result.valid ? true : { valid: false, reason: result.issues.join('; ') };
  });

  await check('verifyZTACard rejects card signed with wrong key', () => {
    const card = ztaAdapter.issueZTACard({
      agent_id: 'zta-003',
      agent_name: 'ZTA Wrong Key',
      trust_score: 7,
      confidence: 'medium',
      expires_in_days: 30,
      issuer_did: 'did:marketnow:ca',
      issuer_name: 'MarketNow CA',
      issuer_private_key_pem: KEYS.ca_ed25519.private_key_pem,
      issuer_key_id: KEYS.ca_ed25519.key_id,
    });
    const result = ztaAdapter.verifyZTACard(card, KEYS.agent_ed25519.public_key_pem);
    return !result.valid && result.issues.some(i => i.includes('verification failed'));
  });

  await check('verifyZTACard rejects tampered card', () => {
    const card = ztaAdapter.issueZTACard({
      agent_id: 'zta-004',
      agent_name: 'Original',
      trust_score: 7,
      confidence: 'medium',
      expires_in_days: 30,
      issuer_did: 'did:marketnow:ca',
      issuer_name: 'MarketNow CA',
      issuer_private_key_pem: KEYS.ca_ed25519.private_key_pem,
      issuer_key_id: KEYS.ca_ed25519.key_id,
    });
    card.agent_name = 'TAMPERED';
    const result = ztaAdapter.verifyZTACard(card, KEYS.ca_ed25519.public_key_pem);
    return !result.valid;
  });

  await check('verifyZTACard rejects expired card', () => {
    const card = ztaAdapter.issueZTACard({
      agent_id: 'zta-005',
      agent_name: 'Expired',
      trust_score: 7,
      confidence: 'medium',
      expires_in_days: 1,
      issuer_did: 'did:marketnow:ca',
      issuer_name: 'MarketNow CA',
      issuer_private_key_pem: KEYS.ca_ed25519.private_key_pem,
      issuer_key_id: KEYS.ca_ed25519.key_id,
    });
    card.metadata.expires_at = '2020-01-01T00:00:00.000Z';
    const result = ztaAdapter.verifyZTACard(card, KEYS.ca_ed25519.public_key_pem);
    return !result.valid && result.expired;
  });

  await check('verifyZTACard rejects card with no signature (fail-closed)', () => {
    const card = {
      agent_id: 'zta-006',
      metadata: { issued_at: new Date().toISOString() },
    };
    const result = ztaAdapter.verifyZTACard(card, KEYS.ca_ed25519.public_key_pem);
    return !result.valid && result.issues.some(i => i.includes('missing signature'));
  });

  await check('verifyZTACard rejects card with wrong signature domain', () => {
    const card = ztaAdapter.issueZTACard({
      agent_id: 'zta-007',
      agent_name: 'Wrong Domain',
      trust_score: 7,
      confidence: 'medium',
      expires_in_days: 30,
      issuer_did: 'did:marketnow:ca',
      issuer_name: 'MarketNow CA',
      issuer_private_key_pem: KEYS.ca_ed25519.private_key_pem,
      issuer_key_id: KEYS.ca_ed25519.key_id,
    });
    card.signature.domain = 'WRONG-DOMAIN';
    const result = ztaAdapter.verifyZTACard(card, KEYS.ca_ed25519.public_key_pem);
    return !result.valid && result.issues.some(i => i.includes('wrong domain'));
  });

  await check('ZTAAdapter.verify() end-to-end', async () => {
    const adapter = new ztaAdapter.ZTAAdapter();
    const card = ztaAdapter.issueZTACard({
      agent_id: 'zta-adapter-001',
      agent_name: 'Adapter Test',
      trust_score: 8,
      confidence: 'high',
      expires_in_days: 30,
      issuer_did: 'did:marketnow:ca',
      issuer_name: 'MarketNow CA',
      issuer_private_key_pem: KEYS.ca_ed25519.private_key_pem,
      issuer_key_id: KEYS.ca_ed25519.key_id,
    });
    const result = await adapter.verify(card, { ca_public_key: KEYS.ca_ed25519.public_key_pem });
    return result.valid;
  });

  await check('ZTA signature does NOT verify as ATC v3 (cross-domain non-reuse)', () => {
    const card = ztaAdapter.issueZTACard({
      agent_id: 'zta-xdomain-001',
      agent_name: 'Cross Domain',
      trust_score: 7,
      confidence: 'medium',
      expires_in_days: 30,
      issuer_did: 'did:marketnow:ca',
      issuer_name: 'MarketNow CA',
      issuer_private_key_pem: KEYS.ca_ed25519.private_key_pem,
      issuer_key_id: KEYS.ca_ed25519.key_id,
    });
    // Try to verify the ZTA signature using the ATC v3 domain
    const { signature, ...payload } = card;
    const coreCrypto = require(path.join(DIST, 'core', 'crypto.js'));
    const ok = coreCrypto.verify(payload, signature.value, KEYS.ca_ed25519.public_key_pem, coreCrypto.DOMAINS.ATC_V3_CREDENTIAL);
    return !ok;
  });

  // ════════════════════════════════════════════════════════════════════
  // P5-3: MCP Adapter
  // ════════════════════════════════════════════════════════════════════
  console.log('\n── MCP Adapter (P5-3) ──');

  await check('issueMCPCard produces a signed card', () => {
    const card = mcpAdapter.issueMCPCard({
      name: 'test-mcp-server',
      description: 'Test MCP server',
      url: 'https://mcp.example/test',
      transport: 'http',
      tools: [{ name: 'search' }, { name: 'fetch' }],
      expires_in_days: 30,
      registry_did: 'did:marketnow:mcp-registry',
      registry_name: 'MarketNow MCP Registry',
      registry_private_key_pem: KEYS.gateway_ed25519.private_key_pem,
      registry_key_id: KEYS.gateway_ed25519.key_id,
    });
    return card && card.signature && card.signature.value.length === 128 && card.signature.domain === 'UTA-MCP-CARD';
  });

  await check('verifyMCPCard accepts correctly signed card with trust_score=5', () => {
    const card = mcpAdapter.issueMCPCard({
      name: 'test-mcp-valid',
      tools: [{ name: 'search' }],
      expires_in_days: 30,
      registry_did: 'did:marketnow:mcp-registry',
      registry_name: 'MarketNow MCP Registry',
      registry_private_key_pem: KEYS.gateway_ed25519.private_key_pem,
      registry_key_id: KEYS.gateway_ed25519.key_id,
    });
    const result = mcpAdapter.verifyMCPCard(card, KEYS.gateway_ed25519.public_key_pem);
    return result.valid && result.signature_valid && result.trust_score === 5;
  });

  await check('verifyMCPCard accepts unsigned card with trust_score=0', () => {
    const card = {
      name: 'unsigned-mcp',
      tools: [{ name: 'search' }],
      transport: 'stdio',
    };
    const result = mcpAdapter.verifyMCPCard(card);
    return result.valid && !result.signature_valid && result.trust_score === 0;
  });

  await check('verifyMCPCard rejects signed card with wrong registry key', () => {
    const card = mcpAdapter.issueMCPCard({
      name: 'test-mcp-wrong-key',
      tools: [{ name: 'search' }],
      expires_in_days: 30,
      registry_did: 'did:marketnow:mcp-registry',
      registry_name: 'MarketNow MCP Registry',
      registry_private_key_pem: KEYS.gateway_ed25519.private_key_pem,
      registry_key_id: KEYS.gateway_ed25519.key_id,
    });
    const result = mcpAdapter.verifyMCPCard(card, KEYS.ca_ed25519.public_key_pem);  // wrong key
    return !result.valid && !result.signature_valid;
  });

  await check('verifyMCPCard rejects tampered card', () => {
    const card = mcpAdapter.issueMCPCard({
      name: 'test-mcp-tamper',
      tools: [{ name: 'search' }],
      expires_in_days: 30,
      registry_did: 'did:marketnow:mcp-registry',
      registry_name: 'MarketNow MCP Registry',
      registry_private_key_pem: KEYS.gateway_ed25519.private_key_pem,
      registry_key_id: KEYS.gateway_ed25519.key_id,
    });
    card.name = 'TAMPERED';
    const result = mcpAdapter.verifyMCPCard(card, KEYS.gateway_ed25519.public_key_pem);
    return !result.valid;
  });

  await check('verifyMCPCard rejects card with malformed signature', () => {
    const card = mcpAdapter.issueMCPCard({
      name: 'test-mcp-malformed',
      tools: [{ name: 'search' }],
      expires_in_days: 30,
      registry_did: 'did:marketnow:mcp-registry',
      registry_name: 'MarketNow MCP Registry',
      registry_private_key_pem: KEYS.gateway_ed25519.private_key_pem,
      registry_key_id: KEYS.gateway_ed25519.key_id,
    });
    card.signature.value = 'abc';  // too short
    const result = mcpAdapter.verifyMCPCard(card, KEYS.gateway_ed25519.public_key_pem);
    return !result.valid && result.issues.some(i => i.includes('malformed signature'));
  });

  await check('MCPAdapter.verify() with signed card', async () => {
    const adapter = new mcpAdapter.MCPAdapter();
    const card = mcpAdapter.issueMCPCard({
      name: 'test-mcp-adapter',
      tools: [{ name: 'search' }, { name: 'fetch' }],
      expires_in_days: 30,
      registry_did: 'did:marketnow:mcp-registry',
      registry_name: 'MarketNow MCP Registry',
      registry_private_key_pem: KEYS.gateway_ed25519.private_key_pem,
      registry_key_id: KEYS.gateway_ed25519.key_id,
    });
    const result = await adapter.verify(card, { registry_public_key: KEYS.gateway_ed25519.public_key_pem });
    return result.valid && result.uts.trust.score === 5;
  });

  await check('MCPAdapter.verify() with unsigned card returns warnings', async () => {
    const adapter = new mcpAdapter.MCPAdapter();
    const card = { name: 'unsigned-mcp', tools: [{ name: 'search' }], transport: 'stdio' };
    const result = await adapter.verify(card);
    return result.valid && result.warnings && result.warnings.some(w => w.includes('no registry signature'));
  });

  // ── Summary ──
  console.log('\n' + '='.repeat(60));
  console.log(`UTA OCSP + ZTA + MCP Integration: ${passed}/${passed + failed} tests passed`);
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
