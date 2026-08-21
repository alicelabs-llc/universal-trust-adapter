/**
 * P6-5: Webhooks integration tests.
 */

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.join(__dirname, '..', '..');
const KEYS = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'vectors', 'keys', 'manifest.json'), 'utf-8')
).keys;

const webhooksModule = require(path.join(ROOT, 'packages', 'webhooks', 'dist', 'index.js'));

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
  console.log('── Webhooks (P6-5) ──');

  // ── Basic subscription ──
  await check('subscribe returns a subscription ID', () => {
    const mgr = new webhooksModule.WebhookManager({
      signingKeyPem: KEYS.gateway_ed25519.private_key_pem,
      signingKeyId: KEYS.gateway_ed25519.key_id,
    });
    const id = mgr.subscribe({
      url: 'https://example.com/webhook',
      events: ['revocation'],
    });
    return id.startsWith('wh_');
  });

  await check('listSubscriptions returns registered subscriptions', () => {
    const mgr = new webhooksModule.WebhookManager({
      signingKeyPem: KEYS.gateway_ed25519.private_key_pem,
      signingKeyId: KEYS.gateway_ed25519.key_id,
    });
    mgr.subscribe({ url: 'https://a.com/wh', events: ['revocation'] });
    mgr.subscribe({ url: 'https://b.com/wh', events: ['issuance'] });
    return mgr.listSubscriptions().length === 2;
  });

  await check('unsubscribe removes a subscription', () => {
    const mgr = new webhooksModule.WebhookManager({
      signingKeyPem: KEYS.gateway_ed25519.private_key_pem,
      signingKeyId: KEYS.gateway_ed25519.key_id,
    });
    const id = mgr.subscribe({ url: 'https://example.com/wh', events: ['revocation'] });
    return mgr.unsubscribe(id) && mgr.listSubscriptions().length === 0;
  });

  // ── Event delivery ──
  await check('emit delivers to matching subscribers', async () => {
    const mgr = new webhooksModule.WebhookManager({
      signingKeyPem: KEYS.gateway_ed25519.private_key_pem,
      signingKeyId: KEYS.gateway_ed25519.key_id,
      fetchImpl: async () => new Response('OK', { status: 200 }),
    });
    mgr.subscribe({ url: 'https://a.com/wh', events: ['revocation'] });
    const result = await mgr.emit({
      type: 'revocation',
      credential_id: 'ATC-001',
      issuer: 'did:marketnow:ca',
      payload: { reason: 'compromise' },
    });
    return result.delivered === 1 && result.failed === 0;
  });

  await check('emit does not deliver to non-matching subscribers', async () => {
    const mgr = new webhooksModule.WebhookManager({
      signingKeyPem: KEYS.gateway_ed25519.private_key_pem,
      signingKeyId: KEYS.gateway_ed25519.key_id,
      fetchImpl: async () => new Response('OK', { status: 200 }),
    });
    mgr.subscribe({ url: 'https://a.com/wh', events: ['issuance'] });  // different event
    const result = await mgr.emit({
      type: 'revocation',
      credential_id: 'ATC-002',
      payload: {},
    });
    return result.delivered === 0;
  });

  await check('emit retries on failure', async () => {
    let callCount = 0;
    const mgr = new webhooksModule.WebhookManager({
      signingKeyPem: KEYS.gateway_ed25519.private_key_pem,
      signingKeyId: KEYS.gateway_ed25519.key_id,
      fetchImpl: async () => {
        callCount++;
        if (callCount < 3) return new Response('Server Error', { status: 500 });
        return new Response('OK', { status: 200 });
      },
    });
    mgr.subscribe({ url: 'https://example.com/wh', events: ['revocation'] });
    const result = await mgr.emit({
      type: 'revocation',
      credential_id: 'ATC-RETRY-001',
      payload: {},
    });
    return result.delivered === 1 && callCount === 3;
  });

  await check('emit fails after 3 retries', async () => {
    const mgr = new webhooksModule.WebhookManager({
      signingKeyPem: KEYS.gateway_ed25519.private_key_pem,
      signingKeyId: KEYS.gateway_ed25519.key_id,
      fetchImpl: async () => new Response('Server Error', { status: 500 }),
    });
    mgr.subscribe({ url: 'https://example.com/wh', events: ['revocation'] });
    const result = await mgr.emit({
      type: 'revocation',
      credential_id: 'ATC-FAIL-001',
      payload: {},
    });
    return result.delivered === 0 && result.failed === 1;
  });

  // ── Filtering ──
  await check('credential_id_filter works', async () => {
    const mgr = new webhooksModule.WebhookManager({
      signingKeyPem: KEYS.gateway_ed25519.private_key_pem,
      signingKeyId: KEYS.gateway_ed25519.key_id,
      fetchImpl: async () => new Response('OK', { status: 200 }),
    });
    mgr.subscribe({
      url: 'https://a.com/wh',
      events: ['revocation'],
      credential_id_filter: 'ATC-2026',
    });
    const matchResult = await mgr.emit({
      type: 'revocation', credential_id: 'ATC-2026-MATCH', payload: {},
    });
    const noMatchResult = await mgr.emit({
      type: 'revocation', credential_id: 'ATC-2025-NOMATCH', payload: {},
    });
    return matchResult.delivered === 1 && noMatchResult.delivered === 0;
  });

  await check('issuer_filter works', async () => {
    const mgr = new webhooksModule.WebhookManager({
      signingKeyPem: KEYS.gateway_ed25519.private_key_pem,
      signingKeyId: KEYS.gateway_ed25519.key_id,
      fetchImpl: async () => new Response('OK', { status: 200 }),
    });
    mgr.subscribe({
      url: 'https://a.com/wh',
      events: ['revocation'],
      issuer_filter: 'did:marketnow:ca',
    });
    const matchResult = await mgr.emit({
      type: 'revocation', credential_id: 'ATC-X', issuer: 'did:marketnow:ca', payload: {},
    });
    const noMatchResult = await mgr.emit({
      type: 'revocation', credential_id: 'ATC-Y', issuer: 'did:other:ca', payload: {},
    });
    return matchResult.delivered === 1 && noMatchResult.delivered === 0;
  });

  // ── Signature verification ──
  await check('HMAC signature verifies with correct secret', () => {
    const secret = 'test-secret';
    const body = JSON.stringify({ event_id: 'evt-1', type: 'revocation' });
    const crypto = require('node:crypto');
    const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(body, 'utf-8').digest('hex');
    return webhooksModule.WebhookManager.verifyHmacSignature(body, sig, secret);
  });

  await check('HMAC signature rejects wrong secret', () => {
    const correctSecret = 'correct-secret';
    const wrongSecret = 'wrong-secret';
    const body = JSON.stringify({ event_id: 'evt-1', type: 'revocation' });
    const crypto = require('node:crypto');
    const sig = 'sha256=' + crypto.createHmac('sha256', correctSecret).update(body, 'utf-8').digest('hex');
    return !webhooksModule.WebhookManager.verifyHmacSignature(body, sig, wrongSecret);
  });

  await check('Ed25519 signature verifies with correct key', () => {
    const body = JSON.stringify({ test: true });
    const eventId = 'evt-123';
    // Sign with gateway private key
    const coreCrypto = require(path.join(ROOT, 'dist', 'packages', 'core', 'crypto.js'));
    const sig = coreCrypto.sign({ event_id: eventId, body }, KEYS.gateway_ed25519.private_key_pem, coreCrypto.DOMAINS.TRUST_DECISION);
    return webhooksModule.WebhookManager.verifyEd25519Signature(body, eventId, sig, KEYS.gateway_ed25519.public_key_pem);
  });

  await check('Ed25519 signature rejects wrong key', () => {
    const body = JSON.stringify({ test: true });
    const eventId = 'evt-124';
    const coreCrypto = require(path.join(ROOT, 'dist', 'packages', 'core', 'crypto.js'));
    const sig = coreCrypto.sign({ event_id: eventId, body }, KEYS.gateway_ed25519.private_key_pem, coreCrypto.DOMAINS.TRUST_DECISION);
    return !webhooksModule.WebhookManager.verifyEd25519Signature(body, eventId, sig, KEYS.ca_ed25519.public_key_pem);
  });

  await check('Ed25519 signature rejects tampered body', () => {
    const body = JSON.stringify({ test: true });
    const tamperedBody = JSON.stringify({ test: false });
    const eventId = 'evt-125';
    const coreCrypto = require(path.join(ROOT, 'dist', 'packages', 'core', 'crypto.js'));
    const sig = coreCrypto.sign({ event_id: eventId, body }, KEYS.gateway_ed25519.private_key_pem, coreCrypto.DOMAINS.TRUST_DECISION);
    return !webhooksModule.WebhookManager.verifyEd25519Signature(tamperedBody, eventId, sig, KEYS.gateway_ed25519.public_key_pem);
  });

  // ── Delivery log ──
  await check('getDeliveryLog returns emitted events', async () => {
    const mgr = new webhooksModule.WebhookManager({
      signingKeyPem: KEYS.gateway_ed25519.private_key_pem,
      signingKeyId: KEYS.gateway_ed25519.key_id,
      fetchImpl: async () => new Response('OK', { status: 200 }),
    });
    mgr.subscribe({ url: 'https://example.com/wh', events: ['revocation'] });
    await mgr.emit({ type: 'revocation', credential_id: 'ATC-LOG-001', payload: {} });
    await mgr.emit({ type: 'revocation', credential_id: 'ATC-LOG-002', payload: {} });
    const log = mgr.getDeliveryLog();
    return log.length === 2 && log[0].credential_id === 'ATC-LOG-002';  // newest first
  });

  await check('getDeliveryLog filters by credential_id', async () => {
    const mgr = new webhooksModule.WebhookManager({
      signingKeyPem: KEYS.gateway_ed25519.private_key_pem,
      signingKeyId: KEYS.gateway_ed25519.key_id,
      fetchImpl: async () => new Response('OK', { status: 200 }),
    });
    mgr.subscribe({ url: 'https://example.com/wh', events: ['revocation'] });
    await mgr.emit({ type: 'revocation', credential_id: 'ATC-FILTER-001', payload: {} });
    await mgr.emit({ type: 'revocation', credential_id: 'ATC-FILTER-002', payload: {} });
    const log = mgr.getDeliveryLog({ credential_id: 'ATC-FILTER-001' });
    return log.length === 1 && log[0].credential_id === 'ATC-FILTER-001';
  });

  // ── Real HTTP test ──
  await check('full HTTP delivery to a real server', async () => {
    // Spin up a local HTTP server to receive the webhook
    const received = [];
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        received.push({
          headers: req.headers,
          body,
        });
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('OK');
      });
    });

    const port = 21000 + Math.floor(Math.random() * 1000);
    await new Promise(r => server.listen(port, '127.0.0.1', r));

    try {
      const mgr = new webhooksModule.WebhookManager({
        signingKeyPem: KEYS.gateway_ed25519.private_key_pem,
        signingKeyId: KEYS.gateway_ed25519.key_id,
      });
      mgr.subscribe({
        url: `http://127.0.0.1:${port}/webhook`,
        events: ['revocation'],
        secret: 'test-secret',
      });

      const result = await mgr.emit({
        type: 'revocation',
        credential_id: 'ATC-HTTP-001',
        issuer: 'did:marketnow:ca',
        payload: { reason: 'compromise', revoked_at: new Date().toISOString() },
      });

      // Wait a bit for delivery
      await new Promise(r => setTimeout(r, 100));

      return result.delivered === 1 &&
             received.length === 1 &&
             received[0].headers['x-uta-signature'].startsWith('sha256=') &&
             received[0].headers['x-uta-ed25519-signature'] &&
             received[0].headers['x-uta-event-type'] === 'revocation';
    } finally {
      server.close();
    }
  });

  // ── Summary ──
  console.log('\n' + '='.repeat(60));
  console.log(`UTA Webhooks Integration: ${passed}/${passed + failed} tests passed`);
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
