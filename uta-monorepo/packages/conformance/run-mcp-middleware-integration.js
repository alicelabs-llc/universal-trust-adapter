/**
 * P6-2: MCP Middleware integration tests.
 * Tests the MCPTrustMiddleware, withUTATrust wrapper, and MCPServerWrapper.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist', 'packages');
const KEYS = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'vectors', 'keys', 'manifest.json'), 'utf-8')
).keys;

const mcpModule = require(path.join(ROOT, 'packages', 'mcp-middleware', 'dist', 'index.js'));
const atcV3 = require(path.join(DIST, 'adapters', 'atc-v3.js'));

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

function makeValidCred() {
  const caKey = {
    privateKeyPem: KEYS.ca_ed25519.private_key_pem,
    publicKeyPem: KEYS.ca_ed25519.public_key_pem,
    publicKeyRaw: KEYS.ca_ed25519.public_key_raw_b64url,
    keyId: KEYS.ca_ed25519.key_id,
  };
  return atcV3.issueATCv3({
    issuer: { did: 'did:marketnow:ca', name: 'Test CA', url: 'https://test.example', ca_key_id: caKey.keyId },
    subject: { agent_id: 'mcp-test-001', agent_name: 'MCP Test Agent', public_key: KEYS.agent_ed25519.public_key_raw_b64url, key_algorithm: 'Ed25519', subject_type: 'agent' },
    capabilities: { provides: ['test'] },
    assessment: { methodology: 'Test', methodology_version: '1.0', score: 8, confidence: 'high', risk_level: 'low' },
    expires_in_days: 30,
    ca_key_pair: caKey,
  });
}

async function main() {
  console.log('── MCP Middleware (P6-2) ──');

  await check('MCPTrustMiddleware intercepts tools/call and ALLOWs', async () => {
    const mw = new mcpModule.MCPTrustMiddleware({
      ca_public_key: KEYS.ca_ed25519.public_key_pem,
      min_trust_score: 5,
      allowed_issuers: ['did:marketnow:ca'],
    });
    const cred = makeValidCred();
    const request = {
      method: 'tools/call',
      params: {
        name: 'search',
        arguments: { query: 'hello' },
        _meta: { utta_credential: cred },
      },
    };
    const result = await mw.intercept('tools/call', request, async (req) => ({
      content: [{ type: 'text', text: 'search results' }],
    }));
    return !!(result && !result.isError && result._meta?.uta_decision?.decision === 'ALLOW' && result._meta?.uta_receipt_id);
  });

  await check('MCPTrustMiddleware DENYs when no credential provided', async () => {
    const mw = new mcpModule.MCPTrustMiddleware({
      ca_public_key: KEYS.ca_ed25519.public_key_pem,
      min_trust_score: 5,
      allowed_issuers: ['did:marketnow:ca'],
    });
    const request = {
      method: 'tools/call',
      params: { name: 'search', arguments: { query: 'hello' } },
    };
    const result = await mw.intercept('tools/call', request, async (req) => ({
      content: [{ type: 'text', text: 'should not reach here' }],
    }));
    return result.isError === true && JSON.stringify(result.content).includes('No credential');
  });

  await check('MCPTrustMiddleware DENYs tampered credential', async () => {
    const mw = new mcpModule.MCPTrustMiddleware({
      ca_public_key: KEYS.ca_ed25519.public_key_pem,
      min_trust_score: 5,
      allowed_issuers: ['did:marketnow:ca'],
    });
    const cred = makeValidCred();
    cred.subject.agent_name = 'TAMPERED';
    const request = {
      method: 'tools/call',
      params: {
        name: 'search',
        arguments: { query: 'hello' },
        _meta: { utta_credential: cred },
      },
    };
    const result = await mw.intercept('tools/call', request, async (req) => ({
      content: [{ type: 'text', text: 'should not reach here' }],
    }));
    return result.isError === true && JSON.stringify(result.content).includes('TRUST_GATEWAY_DENY');
  });

  await check('MCPTrustMiddleware DENYs .env access', async () => {
    const mw = new mcpModule.MCPTrustMiddleware({
      ca_public_key: KEYS.ca_ed25519.public_key_pem,
      min_trust_score: 5,
      block_secret_reads: true,
      allowed_issuers: ['did:marketnow:ca'],
    });
    const cred = makeValidCred();
    const request = {
      method: 'tools/call',
      params: {
        name: 'filesystem.read',
        arguments: { path: '/home/user/.env' },
        _meta: { utta_credential: cred },
      },
    };
    const result = await mw.intercept('tools/call', request, async (req) => ({
      content: [{ type: 'text', text: 'should not reach here' }],
    }));
    return result.isError === true;
  });

  await check('MCPTrustMiddleware DENYs rm -rf', async () => {
    const mw = new mcpModule.MCPTrustMiddleware({
      ca_public_key: KEYS.ca_ed25519.public_key_pem,
      min_trust_score: 5,
      block_shell_exec: true,
      allowed_issuers: ['did:marketnow:ca'],
    });
    const cred = makeValidCred();
    const request = {
      method: 'tools/call',
      params: {
        name: 'shell.exec',
        arguments: { command: 'rm -rf /' },
        _meta: { utta_credential: cred },
      },
    };
    const result = await mw.intercept('tools/call', request, async (req) => ({
      content: [{ type: 'text', text: 'should not reach here' }],
    }));
    return result.isError === true;
  });

  await check('MCPTrustMiddleware passes through non-tools/call methods', async () => {
    const mw = new mcpModule.MCPTrustMiddleware({
      ca_public_key: KEYS.ca_ed25519.public_key_pem,
      min_trust_score: 5,
    });
    const request = { method: 'tools/list', params: {} };
    const result = await mw.intercept('tools/list', request, async (req) => ({
      content: [{ type: 'text', text: 'list of tools' }],
    }));
    return !result.isError && result.content[0].text === 'list of tools';
  });

  await check('withUTATrust wraps a handler function', async () => {
    const wrapped = mcpModule.withUTATrust(
      async (req) => ({ content: [{ type: 'text', text: 'executed' }] }),
      {
        ca_public_key: KEYS.ca_ed25519.public_key_pem,
        min_trust_score: 5,
        allowed_issuers: ['did:marketnow:ca'],
      }
    );
    const cred = makeValidCred();
    const request = {
      method: 'tools/call',
      params: { name: 'test', arguments: {}, _meta: { utta_credential: cred } },
    };
    const result = await wrapped(request);
    return result.content[0].text === 'executed' && result._meta?.uta_decision?.decision === 'ALLOW';
  });

  await check('attachCredential adds credential to request _meta', () => {
    const req = { method: 'tools/call', params: { name: 'test', arguments: {} } };
    const cred = makeValidCred();
    const result = mcpModule.attachCredential(req, cred);
    return result.params._meta.utta_credential === cred;
  });

  await check('attachCredential adds optional PoP response', () => {
    const req = { method: 'tools/call', params: { name: 'test', arguments: {} } };
    const cred = makeValidCred();
    const pop = { nonce: 'abc', signature: 'def' };
    const result = mcpModule.attachCredential(req, cred, pop);
    return result.params._meta.utta_pop_response === pop;
  });

  await check('MCPServerWrapper registers and dispatches tools', async () => {
    const server = new mcpModule.MCPServerWrapper({
      ca_public_key: KEYS.ca_ed25519.public_key_pem,
      min_trust_score: 5,
      allowed_issuers: ['did:marketnow:ca'],
    });
    server.registerTool('search', async (req) => ({
      content: [{ type: 'text', text: `searching for: ${req.params?.arguments?.query || ''}` }],
    }));
    server.registerTool('fetch', async (req) => ({
      content: [{ type: 'text', text: 'fetching' }],
    }));
    const cred = makeValidCred();
    const request = {
      method: 'tools/call',
      params: { name: 'search', arguments: { query: 'hello world' }, _meta: { utta_credential: cred } },
    };
    const result = await server.handleCall(request);
    return result.content[0].text === 'searching for: hello world' && result._meta?.uta_decision?.decision === 'ALLOW';
  });

  await check('MCPServerWrapper returns error for unknown tool', async () => {
    const server = new mcpModule.MCPServerWrapper({
      ca_public_key: KEYS.ca_ed25519.public_key_pem,
      min_trust_score: 5,
      allowed_issuers: ['did:marketnow:ca'],
    });
    const cred = makeValidCred();
    const request = {
      method: 'tools/call',
      params: { name: 'unknown_tool', arguments: {}, _meta: { utta_credential: cred } },
    };
    const result = await server.handleCall(request);
    return result.isError === true && JSON.stringify(result.content).includes('unknown tool');
  });

  await check('MCPTrustMiddleware generates receipts and stores them', async () => {
    const mw = new mcpModule.MCPTrustMiddleware({
      ca_public_key: KEYS.ca_ed25519.public_key_pem,
      min_trust_score: 5,
      allowed_issuers: ['did:marketnow:ca'],
    });
    const cred = makeValidCred();
    const request = {
      method: 'tools/call',
      params: { name: 'test', arguments: {}, _meta: { utta_credential: cred } },
    };
    const result = await mw.intercept('tools/call', request, async () => ({
      content: [{ type: 'text', text: 'ok' }],
    }));
    const receiptId = result._meta?.uta_receipt_id;
    const receipts = mw.listReceipts();
    return receiptId && receipts.length > 0;
  });

  await check('MCPTrustMiddleware with generateReceipts=false skips receipt generation', async () => {
    const mw = new mcpModule.MCPTrustMiddleware({
      ca_public_key: KEYS.ca_ed25519.public_key_pem,
      min_trust_score: 5,
      generateReceipts: false,
      allowed_issuers: ['did:marketnow:ca'],
    });
    const cred = makeValidCred();
    const request = {
      method: 'tools/call',
      params: { name: 'test', arguments: {}, _meta: { utta_credential: cred } },
    };
    const result = await mw.intercept('tools/call', request, async () => ({
      content: [{ type: 'text', text: 'ok' }],
    }));
    return result._meta?.uta_decision && !result._meta?.uta_receipt_id;
  });

  // ── Summary ──
  console.log('\n' + '='.repeat(60));
  console.log(`UTA MCP Middleware Integration: ${passed}/${passed + failed} tests passed`);
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
