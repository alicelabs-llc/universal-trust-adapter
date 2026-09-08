#!/usr/bin/env node
// ============================================================================
// UTA conformance vectors — GENERATOR (v1.3.0)
// ============================================================================
// Produces unlimited fresh signed cards so the accept side of the suite can
// never be memorized. Any fixed vector set is learnable by recognition; this
// generator is not, because the content is random and the digest moves every
// run.
//
// Modes:
//   accept      cards signed AND declared by ca-test-2  → expected_verify: true
//   self-signed fresh attacker key per card, declared AND signing
//               → fails trust_anchor_key_selection (expected_verify: false)
//   wrong-ca    declares ca-test-2, signed by a fresh key
//               → fails signature_verification (expected_verify: false)
//
// Usage:
//   node generate-accept-vectors.mjs                       # 10 accept cards → stdout
//   node generate-accept-vectors.mjs --count 50 --seed 42  # reproducible set
//   node generate-accept-vectors.mjs --mode self-signed --count 5
//   node generate-accept-vectors.mjs --out ./gen-challenge # writes files like the fixed set
//
// The ca-test-2 private key is read from _test-ca-keys.json — it is
// INTENTIONALLY PUBLISHED. Anyone can run this generator and challenge any
// runner with fresh cards the runner has never seen.
//
// Node ≥ 18, zero dependencies. Fail-closed: every emitted card is
// self-verified before output; if verification fails, nothing is emitted.
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash, generateKeyPairSync, sign as cryptoSign, verify as cryptoVerify, createPublicKey, createPrivateKey, randomBytes, randomInt } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- RFC 8785 JCS (same function as the README snippet) ---
const jcs = (v) => JSON.stringify(v, (k, x) =>
  (x !== null && typeof x === 'object' && !Array.isArray(x))
    ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    : x);

const sha256hex = (buf) => createHash('sha256').update(buf).digest('hex');

// --- args ---
const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const count = Math.max(1, parseInt(getArg('count', '10'), 10) || 10);
const seed = getArg('seed', null);
const mode = getArg('mode', 'accept');
const outDir = getArg('out', null);
if (!['accept', 'self-signed', 'wrong-ca'].includes(mode)) {
  console.error(`unknown mode: ${mode} (use accept | self-signed | wrong-ca)`);
  process.exit(1);
}

// --- seeded PRNG (mulberry32) for --seed reproducibility; crypto-random otherwise ---
let rngState = null;
const seeded = seed !== null ? parseInt(seed, 10) >>> 0 : null;
const rand = () => {
  if (seeded === null) return randomBytes(4).readUInt32BE(0) / 0xffffffff;
  // mulberry32
  rngState = (rngState === null ? seeded : (rngState + 0x6d2b79f5) >>> 0);
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length) % arr.length];
const hex = (n) => {
  if (seeded === null) return randomBytes(n).toString('hex');
  let s = '';
  while (s.length < n * 2) s += Math.floor(rand() * 0xffffffff).toString(16).padStart(8, '0');
  return s.slice(0, n * 2);
};

// --- load the generator CA (private key PUBLISHED in _test-ca-keys.json) ---
const keysManifest = JSON.parse(readFileSync(join(__dirname, '_test-ca-keys.json'), 'utf8'));
const ca2 = keysManifest.ca_test_2;
const ca2Spki = ca2.public_key_spki_b64;
const ca2Priv = createPrivateKey({ key: Buffer.from(ca2.private_key_pkcs8_b64, 'base64'), format: 'der', type: 'pkcs8' });
const ca2Pub = createPublicKey({ key: Buffer.from(ca2Spki, 'base64'), format: 'der', type: 'spki' });

// --- random content pools ---
const NAMES = ['Orbit Scout', 'Vector Curator', 'Helios Fetcher', 'Quanta Reader', 'Nimbus Broker', 'Delta Scribe', 'Aurora Mapper', 'Cobalt Weaver', 'Lumen Packer', 'Zenith Router'];
const CAPS = ['search', 'read', 'fetch', 'translate', 'summarize', 'transcribe', 'embed', 'route'];
const PROTOCOLS = ['mcp', 'a2a', 'zta', 'uts'];
const EXT_NAMES = ['x_gen_priority', 'x_gen_region', 'x_gen_quota', 'x_gen_lane', 'x_gen_tier', 'x_gen_cache'];

const randomCard = () => {
  const nCaps = 1 + Math.floor(rand() * 3);
  const caps = [...CAPS].sort(() => rand() - 0.5).slice(0, nCaps).sort();
  const year = 2026 + Math.floor(rand() * 2);
  const month = 1 + Math.floor(rand() * 12);
  const day = 1 + Math.floor(rand() * 28);
  const expYear = year + 2;
  const score = 6 + Math.floor(rand() * 5);
  const card = {
    card_id: `ATC-GEN-${hex(4).toUpperCase()}`,
    status: 'active',
    payload: {
      card_id: '',
      schema_version: '2.0.0',
      agent_id: `gen-agent-${hex(6)}`,
      agent_name: pick(NAMES),
      identity: { public_key: '', key_algorithm: 'Ed25519' },
      trust: {
        sentinel_review_score: score,
        sentinel_score: score,
        audit_layers_passed: { 'L1.5': true, 'L2.5': rand() > 0.3 },
        composite_trust: score,
        risk_level: score >= 8 ? 'low' : 'medium',
      },
      capabilities: { provides: caps, protocol_language: pick(PROTOCOLS), translate: rand() > 0.5 },
      payment: { method: 'none', wallet_address: null },
      metadata: {
        issued_at: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00Z`,
        expires_at: `${expYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00Z`,
        issuer: 'MarketNow Sentinel Generator CA',
      },
    },
    signature: {
      algorithm: 'Ed25519 (RFC 8032)',
      value: '',
      signed_by: 'generated by generate-accept-vectors.mjs (ca-test-2, private key published)',
      signed_at: new Date().toISOString().slice(0, 10) + 'T00:00:00Z',
      canonical_json: 'RFC_8785_JCS',
      ca_key_id: '',
      evidence_hash: `sha256:gen_${hex(4)}`,
      policy_version: '2.0.0',
    },
  };
  card.payload.card_id = card.card_id;

  // 1-3 random extension fields — the over-rejection defense rides along
  const nExt = 1 + Math.floor(rand() * 3);
  const exts = [...EXT_NAMES].sort(() => rand() - 0.5).slice(0, nExt);
  for (const e of exts) {
    card.payload[e] = rand() > 0.5 ? { value: 1 + Math.floor(rand() * 99), generated: true } : `gen-${hex(4)}`;
  }
  return card;
};

// --- generate + self-verify (fail-closed) ---
const results = [];
for (let i = 0; i < count; i++) {
  const card = randomCard();

  let declaredKey, signingPriv, expectedVerify;
  if (mode === 'accept') {
    declaredKey = ca2Spki; signingPriv = ca2Priv; expectedVerify = true;
  } else if (mode === 'self-signed') {
    const kp = generateKeyPairSync('ed25519');
    declaredKey = kp.publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
    signingPriv = kp.privateKey; expectedVerify = false;
  } else { // wrong-ca
    const kp = generateKeyPairSync('ed25519');
    declaredKey = ca2Spki; signingPriv = kp.privateKey; expectedVerify = false;
  }

  card.payload.identity.public_key = declaredKey;
  card.signature.ca_key_id = mode === 'accept' ? ca2Spki : declaredKey;

  const { signature, ...subtree } = card;
  const canonical = jcs(subtree);
  const buf = Buffer.from(canonical, 'utf8');
  card.signature.value = cryptoSign(null, buf, signingPriv).toString('hex');

  // SELF-VERIFY before emitting anything — mode-aware fail-closed checks:
  //   accept:      signature verifies under declared ca-test-2, declared key IS the anchor
  //   self-signed: signature verifies under the declared (attacker) key, declared key is NOT the anchor
  //   wrong-ca:    signature does NOT verify under declared ca-test-2 (signed by someone else)
  const declaredPub = createPublicKey({ key: Buffer.from(card.payload.identity.public_key, 'base64'), format: 'der', type: 'spki' });
  const sigOk = cryptoVerify(null, buf, declaredPub, Buffer.from(card.signature.value, 'hex'));
  const isAnchor = card.payload.identity.public_key === ca2Spki;
  const expectations = {
    accept: { sigOk: true, isAnchor: true },
    'self-signed': { sigOk: true, isAnchor: false },
    'wrong-ca': { sigOk: false, isAnchor: true },
  };
  const exp = expectations[mode];
  if (sigOk !== exp.sigOk || isAnchor !== exp.isAnchor) {
    console.error(`FATAL: ${mode}-mode card ${card.card_id} self-verification mismatch (sigOk=${sigOk}, isAnchor=${isAnchor}; expected sigOk=${exp.sigOk}, isAnchor=${exp.isAnchor})`);
    process.exit(1);
  }
  // cross-check with the reference semantics: accept cards must fully verify
  if (mode === 'accept') {
    const verifiedUnderCa = cryptoVerify(null, buf, ca2Pub, Buffer.from(card.signature.value, 'hex'));
    if (!verifiedUnderCa) { console.error(`FATAL: accept-mode card ${card.card_id} does not verify under ca-test-2`); process.exit(1); }
  }

  results.push({
    card_id: card.card_id,
    mode,
    expected_verify: expectedVerify,
    expected_stages: {
      signature_verification: sigOk ? 'pass' : 'fail',
      trust_anchor_key_selection: isAnchor ? 'pass' : 'fail',
      expiry_check: 'pass', // expires 2 years after a 2026-2027 issue date
      status_check: 'pass',
    },
    sha256: sha256hex(buf),
    canonical_bytes_length: buf.length,
    card,
  });
}

// --- output ---
if (outDir) {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  for (const r of results) {
    const { signature, ...subtree } = r.card;
    const canonical = jcs(subtree);
    writeFileSync(join(outDir, `${r.card_id}.json`), JSON.stringify(r.card, null, 2) + '\n');
    writeFileSync(join(outDir, `${r.card_id}.canonical.txt`), canonical);
    writeFileSync(join(outDir, `${r.card_id}.sha256`), r.sha256 + '\n');
  }
  writeFileSync(join(outDir, '_generated-index.json'), JSON.stringify(results.map(({ card, ...meta }) => meta), null, 2) + '\n');
  console.error(`wrote ${results.length} ${mode} cards to ${outDir} (+ _generated-index.json)`);
} else {
  console.log(JSON.stringify(results, null, 2));
}

console.error(`generated ${results.length} ${mode} cards | seed=${seed ?? 'crypto-random'} | anchor=${ca2Spki}`);
