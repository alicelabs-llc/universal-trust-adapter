/**
 * P4-6 + P4-7: A2A + EAT adapter integration tests.
 *
 * Verifies that the A2A and EAT adapters now do REAL cryptographic verification
 * (was previously always returning valid=true).
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist', 'packages');
const KEYS = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'vectors', 'keys', 'manifest.json'), 'utf-8')
).keys;

const a2a = require(path.join(DIST, 'adapters', 'a2a-adapter.js'));
const eat = require(path.join(DIST, 'adapters', 'eat-adapter.js'));

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
  // ── A2A tests ──
  console.log('── A2A adapter (real Ed25519Signature2020 verification) ──');

  await check('issueA2ACard produces a card with proof', () => {
    const card = a2a.issueA2ACard({
      issuer_did: 'did:marketnow:ca',
      issuer_name: 'MarketNow CA',
      issuer_url: 'https://marketnow.site',
      agent_id: 'a2a-agent-001',
      agent_name: 'A2A Test Agent',
      agent_url: 'https://agents.example/a2a-001',
      capabilities: ['search', 'summarize'],
      public_key: KEYS.agent_ed25519.public_key_raw_b64url,
      expires_in_days: 30,
      ca_private_key_pem: KEYS.ca_ed25519.private_key_pem,
      ca_key_id: KEYS.ca_ed25519.key_id,
    });
    return card.agentCard && card.agentCard.proof && card.agentCard.proof.proofValue.length > 0;
  });

  await check('verifyA2ACard accepts correctly signed card', () => {
    const { agentCard } = a2a.issueA2ACard({
      issuer_did: 'did:marketnow:ca',
      issuer_name: 'MarketNow CA',
      issuer_url: 'https://marketnow.site',
      agent_id: 'a2a-002',
      agent_name: 'A2A Valid Agent',
      agent_url: 'https://agents.example/a2a-002',
      capabilities: ['search'],
      public_key: KEYS.agent_ed25519.public_key_raw_b64url,
      expires_in_days: 30,
      ca_private_key_pem: KEYS.ca_ed25519.private_key_pem,
      ca_key_id: KEYS.ca_ed25519.key_id,
    });
    const result = a2a.verifyA2ACard(agentCard, KEYS.ca_ed25519.public_key_pem);
    return result.valid ? true : { valid: false, reason: result.issues.join('; ') };
  });

  await check('verifyA2ACard rejects card signed with wrong key', () => {
    const { agentCard } = a2a.issueA2ACard({
      issuer_did: 'did:marketnow:ca',
      issuer_name: 'MarketNow CA',
      issuer_url: 'https://marketnow.site',
      agent_id: 'a2a-003',
      agent_name: 'A2A Wrong Key',
      agent_url: 'https://agents.example/a2a-003',
      capabilities: ['search'],
      public_key: KEYS.agent_ed25519.public_key_raw_b64url,
      expires_in_days: 30,
      ca_private_key_pem: KEYS.ca_ed25519.private_key_pem,
      ca_key_id: KEYS.ca_ed25519.key_id,
    });
    // Try to verify with the AGENT key (should fail)
    const result = a2a.verifyA2ACard(agentCard, KEYS.agent_ed25519.public_key_pem);
    return !result.valid ? true : { valid: false, reason: 'wrong-key card was accepted' };
  });

  await check('verifyA2ACard rejects tampered card', () => {
    const { agentCard } = a2a.issueA2ACard({
      issuer_did: 'did:marketnow:ca',
      issuer_name: 'MarketNow CA',
      issuer_url: 'https://marketnow.site',
      agent_id: 'a2a-004',
      agent_name: 'Original',
      agent_url: 'https://agents.example/a2a-004',
      capabilities: ['search'],
      public_key: KEYS.agent_ed25519.public_key_raw_b64url,
      expires_in_days: 30,
      ca_private_key_pem: KEYS.ca_ed25519.private_key_pem,
      ca_key_id: KEYS.ca_ed25519.key_id,
    });
    agentCard.name = 'TAMPERED';
    const result = a2a.verifyA2ACard(agentCard, KEYS.ca_ed25519.public_key_pem);
    return !result.valid ? true : { valid: false, reason: 'tampered card was accepted' };
  });

  await check('verifyA2ACard rejects expired card', () => {
    const { agentCard } = a2a.issueA2ACard({
      issuer_did: 'did:marketnow:ca',
      issuer_name: 'MarketNow CA',
      issuer_url: 'https://marketnow.site',
      agent_id: 'a2a-005',
      agent_name: 'Expired',
      agent_url: 'https://agents.example/a2a-005',
      capabilities: ['search'],
      public_key: KEYS.agent_ed25519.public_key_raw_b64url,
      expires_in_days: 1,
      ca_private_key_pem: KEYS.ca_ed25519.private_key_pem,
      ca_key_id: KEYS.ca_ed25519.key_id,
    });
    // Set expiry in the past
    agentCard.expires_at = '2020-01-01T00:00:00.000Z';
    const result = a2a.verifyA2ACard(agentCard, KEYS.ca_ed25519.public_key_pem);
    return !result.valid && result.expired ? true : { valid: false, reason: `expected expired, got valid=${result.valid}, expired=${result.expired}` };
  });

  await check('verifyA2ACard fail-closed when no proof', () => {
    const card = {
      name: 'Unsigned Card',
      url: 'https://agents.example/unsigned',
      public_key: KEYS.agent_ed25519.public_key_raw_b64url,
      issued_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    };
    const result = a2a.verifyA2ACard(card, KEYS.ca_ed25519.public_key_pem);
    return !result.valid && result.issues.some(i => i.includes('missing proof')) ? true : { valid: false, reason: `expected missing-proof failure, got: ${result.issues.join('; ')}` };
  });

  await check('A2AAdapter.verify() with real crypto', async () => {
    const adapter = new a2a.A2AAdapter();
    const { agentCard } = a2a.issueA2ACard({
      issuer_did: 'did:marketnow:ca',
      issuer_name: 'MarketNow CA',
      issuer_url: 'https://marketnow.site',
      agent_id: 'a2a-adapter-001',
      agent_name: 'Adapter Test',
      agent_url: 'https://agents.example/a2a-adapter-001',
      capabilities: ['search'],
      public_key: KEYS.agent_ed25519.public_key_raw_b64url,
      expires_in_days: 30,
      ca_private_key_pem: KEYS.ca_ed25519.private_key_pem,
      ca_key_id: KEYS.ca_ed25519.key_id,
    });
    const result = await adapter.verify({ agentCard }, { ca_public_key: KEYS.ca_ed25519.public_key_pem } );
    return result.valid ? true : { valid: false, reason: result.reason };
  });

  // ── EAT tests ──
  console.log('\n── EAT adapter (real COSE-style signature verification) ──');

  await check('issueEAT produces a token with signature', () => {
    const token = eat.issueEAT({
      issuer: 'did:marketnow:ca',
      subject: 'eat-agent-001',
      subject_name: 'EAT Test Agent',
      capabilities: ['attest'],
      trust_score: 8,
      trust_level: 'high',
      subject_public_key: KEYS.agent_ed25519.public_key_raw_b64url,
      expires_in_days: 30,
      issuer_private_key_pem: KEYS.ca_ed25519.private_key_pem,
      issuer_key_id: KEYS.ca_ed25519.key_id,
      alg: 'EdDSA',
    });
    return token && token.payload && token.signature && token.payload.iss === 'did:marketnow:ca';
  });

  await check('verifyEAT accepts correctly signed token', () => {
    const token = eat.issueEAT({
      issuer: 'did:marketnow:ca',
      subject: 'eat-agent-002',
      subject_name: 'EAT Valid',
      trust_score: 8,
      trust_level: 'high',
      subject_public_key: KEYS.agent_ed25519.public_key_raw_b64url,
      expires_in_days: 30,
      issuer_private_key_pem: KEYS.ca_ed25519.private_key_pem,
      issuer_key_id: KEYS.ca_ed25519.key_id,
      alg: 'EdDSA',
    });
    const result = eat.verifyEAT(token, KEYS.ca_ed25519.public_key_pem);
    return result.valid ? true : { valid: false, reason: result.issues.join('; ') };
  });

  await check('verifyEAT rejects token signed with wrong key', () => {
    const token = eat.issueEAT({
      issuer: 'did:marketnow:ca',
      subject: 'eat-agent-003',
      trust_score: 8,
      trust_level: 'high',
      subject_public_key: KEYS.agent_ed25519.public_key_raw_b64url,
      expires_in_days: 30,
      issuer_private_key_pem: KEYS.ca_ed25519.private_key_pem,
      issuer_key_id: KEYS.ca_ed25519.key_id,
      alg: 'EdDSA',
    });
    // Try to verify with the AGENT key
    const result = eat.verifyEAT(token, KEYS.agent_ed25519.public_key_pem);
    return !result.valid ? true : { valid: false, reason: 'wrong-key token was accepted' };
  });

  await check('verifyEAT rejects tampered token', () => {
    const token = eat.issueEAT({
      issuer: 'did:marketnow:ca',
      subject: 'eat-agent-004',
      trust_score: 8,
      trust_level: 'high',
      subject_public_key: KEYS.agent_ed25519.public_key_raw_b64url,
      expires_in_days: 30,
      issuer_private_key_pem: KEYS.ca_ed25519.private_key_pem,
      issuer_key_id: KEYS.ca_ed25519.key_id,
      alg: 'EdDSA',
    });
    token.payload.trust_score = 10;  // tamper
    const result = eat.verifyEAT(token, KEYS.ca_ed25519.public_key_pem);
    return !result.valid ? true : { valid: false, reason: 'tampered token was accepted' };
  });

  await check('verifyEAT rejects expired token', () => {
    const token = eat.issueEAT({
      issuer: 'did:marketnow:ca',
      subject: 'eat-agent-005',
      trust_score: 8,
      trust_level: 'high',
      subject_public_key: KEYS.agent_ed25519.public_key_raw_b64url,
      expires_in_days: 1,
      issuer_private_key_pem: KEYS.ca_ed25519.private_key_pem,
      issuer_key_id: KEYS.ca_ed25519.key_id,
      alg: 'EdDSA',
    });
    // Set expiry in the past
    token.payload.exp = Math.floor(Date.now() / 1000) - 86400;
    const result = eat.verifyEAT(token, KEYS.ca_ed25519.public_key_pem);
    return !result.valid && result.expired ? true : { valid: false, reason: `expected expired, got valid=${result.valid}, expired=${result.expired}` };
  });

  await check('verifyEAT supports ES256 algorithm', () => {
    const token = eat.issueEAT({
      issuer: 'did:marketnow:ca',
      subject: 'eat-agent-006',
      trust_score: 7,
      trust_level: 'medium',
      expires_in_days: 30,
      issuer_private_key_pem: KEYS.ca_ecdsa.private_key_pem,
      issuer_key_id: KEYS.ca_ecdsa.key_id,
      alg: 'ES256',
    });
    const result = eat.verifyEAT(token, KEYS.ca_ecdsa.public_key_pem);
    return result.valid ? true : { valid: false, reason: result.issues.join('; ') };
  });

  await check('verifyEAT supports RS256 algorithm', () => {
    const token = eat.issueEAT({
      issuer: 'did:marketnow:ca',
      subject: 'eat-agent-007',
      trust_score: 7,
      trust_level: 'medium',
      expires_in_days: 30,
      issuer_private_key_pem: KEYS.ca_rsa.private_key_pem,
      issuer_key_id: KEYS.ca_rsa.key_id,
      alg: 'RS256',
    });
    const result = eat.verifyEAT(token, KEYS.ca_rsa.public_key_pem);
    return result.valid ? true : { valid: false, reason: result.issues.join('; ') };
  });

  await check('EATAdapter.verify() with real crypto', async () => {
    const adapter = new eat.EATAdapter();
    const token = eat.issueEAT({
      issuer: 'did:marketnow:ca',
      subject: 'eat-adapter-001',
      subject_name: 'Adapter Test',
      trust_score: 8,
      trust_level: 'high',
      subject_public_key: KEYS.agent_ed25519.public_key_raw_b64url,
      expires_in_days: 30,
      issuer_private_key_pem: KEYS.ca_ed25519.private_key_pem,
      issuer_key_id: KEYS.ca_ed25519.key_id,
      alg: 'EdDSA',
    });
    const result = await adapter.verify(token, { ca_public_key: KEYS.ca_ed25519.public_key_pem });
    return result.valid ? true : { valid: false, reason: result.reason };
  });

  await check('EAT cross-format signature non-reuse (EAT sig does not verify as JWT)', () => {
    const token = eat.issueEAT({
      issuer: 'did:marketnow:ca',
      subject: 'eat-xdomain-001',
      trust_score: 8,
      trust_level: 'high',
      expires_in_days: 30,
      issuer_private_key_pem: KEYS.ca_ed25519.private_key_pem,
      issuer_key_id: KEYS.ca_ed25519.key_id,
      alg: 'EdDSA',
    });
    // The EAT signature was computed over "UTA-EAT-AI:canonicalize(payload)".
    // If we try to verify it as a JWT (signing input is "header.payload" base64url),
    // it MUST fail — proving cross-format non-reuse.
    const fakeJwt = `eyJhbGciOiJFZERTQSJ9.${Buffer.from(JSON.stringify(token.payload)).toString('base64url')}.${token.signature}`;
    const cryptoAdapters = require(path.join(DIST, 'adapters', 'crypto-adapters.js'));
    const result = cryptoAdapters.verifyJWT(fakeJwt, KEYS.ca_ed25519.public_key_pem);
    return !result.valid ? true : { valid: false, reason: 'EAT sig unexpectedly verified as JWT (cross-format reuse!)' };
  });

  // ── Summary ──
  console.log('\n' + '='.repeat(60));
  console.log(`UTA A2A + EAT Integration: ${passed}/${passed + failed} tests passed`);
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
