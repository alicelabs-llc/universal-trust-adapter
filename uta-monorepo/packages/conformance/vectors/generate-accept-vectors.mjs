#!/usr/bin/env node
// ============================================================================
// UTA conformance vectors — GENERATOR (v1.7.0)
// ============================================================================
// Produces unlimited fresh signed cards so the accept side of the suite can
// never be memorized. Any fixed vector set is learnable by recognition; this
// generator is not, because the content is random and the digest moves every
// run.
//
// Modes:
//   accept      cards signed AND declared by ca-test-2  → expected_verify: true
//               v1.7.0: 20% of accept cards are issued TODAY — the boundary-in
//               band. String `<=` vs `<` mutants and clock-minus-one mutants
//               that would silently reject them are caught by the sidecar
//               cross-check (the sidecar pins the generation-time clock).
//   self-signed fresh attacker key per card, declared AND signing
//               → fails trust_anchor_key_selection (expected_verify: false)
//   wrong-ca    declares ca-test-2, signed by a fresh key
//               → fails signature_verification (expected_verify: false)
//   adversarial v1.7.0 (anp2 critique 3ehcp: "0/60 is a measurement of the
//               generator, not of the runner's window"): correctly signed by
//               ca-test-2, anchored, active — the ONLY defect is a violated
//               validity window, so expiry_check must fail and everything else
//               must pass. The lower bound is sampled as a DISTRIBUTION
//               relative to the scoring clock (55% future-issued with mass at
//               +2..7d, 35% already-expired including expires-at-NOW, 10%
//               empty window) instead of one frozen constant. Window
//               violations are EXPECTED failures here, not errors: FATAL is
//               reserved for valid-card modes. The mirror rule also applies —
//               an adversarial card that lands IN window is a FATAL, because
//               the generator failed to produce the defect it exists to
//               produce.
//
// Usage:
//   node generate-accept-vectors.mjs                       # 10 accept cards → stdout
//   node generate-accept-vectors.mjs --count 50 --seed 42  # reproducible set
//   node generate-accept-vectors.mjs --mode self-signed --count 5
//   node generate-accept-vectors.mjs --mode adversarial --count 40 --seed 7 --out ./adv
//   node generate-accept-vectors.mjs --out ./gen-challenge # writes files like the fixed set
//
// The ca-test-2 private key is read from _test-ca-keys.json — it is
// INTENTIONALLY PUBLISHED. Anyone can run this generator and challenge any
// runner with fresh cards the runner has never seen.
//
// Midnight stability (why adversarial future offsets start at +2 days, and
// boundary-in accept cards are issued TODAY): a generated set must stay
// re-scoreable after midnight without the sidecar cross-check flipping to
// FATAL. A card issued TODAY only drifts further into the past on re-score
// (stable, expected_verify stays true). A card at NOW+1d would flip to
// in-window after midnight — the derived truth would change while the sidecar
// pinned the old one, aborting the run. The +1d hole is therefore deliberate
// and is named in the mutation survivor list: a clock+1d runner survives,
// because catching it would cost midnight portability of generated sets.
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
if (!['accept', 'self-signed', 'wrong-ca', 'adversarial'].includes(mode)) {
  console.error(`unknown mode: ${mode} (use accept | self-signed | wrong-ca | adversarial)`);
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
  // v1.3.3 fix (anp2 bug 1): issued_at is DERIVED FROM THE CLOCK and clamped
  // to the past — 1..729 days back — so a generated card is never "not yet
  // valid". expires_at = issued_at + 3 years, always inside the future.
  // The old code drew the issue year as 2026|2027 and randomized month/day,
  // so ~half the cards were dated ahead of the clock while the sidecar still
  // declared expiry_check: pass. Dates now follow the wall clock, never the PRNG.
  const backDays = 1 + Math.floor(rand() * 729);
  const issuedOn = new Date(Date.now() - backDays * 86400000);
  const expiresOn = new Date(issuedOn.getTime() + 1095 * 86400000); // +3y ≥ now+366d
  const issuedAt = issuedOn.toISOString().slice(0, 10) + 'T00:00:00Z';
  const expiresAt = expiresOn.toISOString().slice(0, 10) + 'T00:00:00Z';
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
        issued_at: issuedAt,
        expires_at: expiresAt,
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

// --- the NOW stamp the scoring clock will use (date-granularity, same format) ---
const nowStamp = new Date().toISOString().slice(0, 10) + 'T00:00:00Z';
const stamp = (d) => d.toISOString().slice(0, 10) + 'T00:00:00Z';

// --- v1.7.0: adversarial window override — sample the offset relative to the
// scoring clock so the lower bound is tested by a distribution, not a fixture.
// Buckets: 55% future-issued (lower bound), 35% already-expired (upper bound,
// including expires_at == NOW — the `expires_at > NOW` boundary itself),
// 10% empty window (issued_at == expires_at in the future: a runner must not
// derive validity from a duration or a signed window size).
const adversarialWindow = (meta) => {
  const bucket = rand();
  if (bucket < 0.55) {
    let days;
    const b = rand();
    if (b < 0.30) days = 2 + Math.floor(rand() * 6);       // +2..7d  — just past the boundary band
    else if (b < 0.60) days = 8 + Math.floor(rand() * 83);  // +8..90d — near future
    else if (b < 0.90) days = 91 + Math.floor(rand() * 640);// +91..730d
    else days = 731 + Math.floor(rand() * 730);             // deep future (premature-atc territory)
    const issuedOn = new Date(Date.now() + days * 86400000);
    meta.issued_at = stamp(issuedOn);
    meta.expires_at = stamp(new Date(issuedOn.getTime() + 1095 * 86400000));
  } else if (bucket < 0.90) {
    let days;
    const b = rand();
    if (b < 0.20) days = 0;                                 // expires TODAY — `expires_at > NOW` is false at equality
    else if (b < 0.60) days = 1 + Math.floor(rand() * 30);  // expired 1..30d
    else days = 31 + Math.floor(rand() * 700);              // expired 31..730d
    const expiresOn = new Date(Date.now() - days * 86400000);
    meta.expires_at = stamp(expiresOn);
    // issued strictly before expires (1..364d), always in the past
    meta.issued_at = stamp(new Date(expiresOn.getTime() - (1 + Math.floor(rand() * 364)) * 86400000));
  } else {
    const days = 2 + Math.floor(rand() * 89);               // +2..90d
    const issuedOn = new Date(Date.now() + days * 86400000);
    meta.issued_at = meta.expires_at = stamp(issuedOn);     // empty window
  }
  return meta;
};

// --- generate + self-verify (fail-closed) ---
const results = [];
for (let i = 0; i < count; i++) {
  const card = randomCard();

  // v1.7.0 — mode-specific window shaping BEFORE signing (dates are inside the
  // signed subtree):
  //   accept:      20% boundary-in — issued_at == NOW (the `issued_at <= NOW`
  //                equality case). Catches `<` vs `<=` and clock-minus-one
  //                mutants via the sidecar cross-check.
  //   adversarial: the window override above.
  if (mode === 'accept' && rand() < 0.20) {
    card.payload.metadata.issued_at = nowStamp;
  } else if (mode === 'adversarial') {
    adversarialWindow(card.payload.metadata);
  }

  let declaredKey, signingPriv, expectedVerify;
  if (mode === 'accept') {
    declaredKey = ca2Spki; signingPriv = ca2Priv; expectedVerify = true;
  } else if (mode === 'adversarial') {
    // correctly signed by the real anchor — the window is the ONLY defect
    declaredKey = ca2Spki; signingPriv = ca2Priv; expectedVerify = false;
  } else if (mode === 'self-signed') {
    const kp = generateKeyPairSync('ed25519');
    declaredKey = kp.publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
    signingPriv = kp.privateKey; expectedVerify = false;
  } else { // wrong-ca
    const kp = generateKeyPairSync('ed25519');
    declaredKey = ca2Spki; signingPriv = kp.privateKey; expectedVerify = false;
  }

  card.payload.identity.public_key = declaredKey;
  // accept AND adversarial cards are genuinely signed by the anchor CA; the
  // other two modes declare/sign with other keys
  card.signature.ca_key_id = ['accept', 'adversarial'].includes(mode) ? ca2Spki : declaredKey;

  const { signature, ...subtree } = card;
  const canonical = jcs(subtree);
  const buf = Buffer.from(canonical, 'utf8');
  card.signature.value = cryptoSign(null, buf, signingPriv).toString('hex');

  // SELF-VERIFY before emitting anything — mode-aware fail-closed checks:
  //   accept:       signature verifies under declared ca-test-2, declared key IS the anchor
  //   self-signed:  signature verifies under the declared (attacker) key, declared key is NOT the anchor
  //   wrong-ca:     signature does NOT verify under declared ca-test-2 (signed by someone else)
  //   window:       issued_at <= NOW < expires_at — BOTH bounds, enforced at generation
  //                 in valid-card modes (FATAL on violation).
  //   adversarial:  the window MUST be violated (FATAL if the card lands IN
  //                 window — the generator failed to produce the defect), AND
  //                 the signature, anchor and status must all be clean, so the
  //                 only failing stage is expiry_check.
  const declaredPub = createPublicKey({ key: Buffer.from(card.payload.identity.public_key, 'base64'), format: 'der', type: 'spki' });
  const sigOk = cryptoVerify(null, buf, declaredPub, Buffer.from(card.signature.value, 'hex'));
  const isAnchor = card.payload.identity.public_key === ca2Spki;
  const notBeforeOk = card.payload.metadata.issued_at <= nowStamp;
  const notAfterOk = card.payload.metadata.expires_at > nowStamp;
  const windowOk = notBeforeOk && notAfterOk;
  if (mode !== 'adversarial' && !windowOk) {
    console.error(`FATAL: ${mode}-mode card ${card.card_id} violates the validity window (issued_at ${card.payload.metadata.issued_at} vs NOW ${nowStamp}, expires_at ${card.payload.metadata.expires_at}) — the clock-derived date clamp failed`);
    process.exit(1);
  }
  if (mode === 'adversarial' && windowOk) {
    console.error(`FATAL: adversarial card ${card.card_id} landed INSIDE the validity window (issued_at ${card.payload.metadata.issued_at}, expires_at ${card.payload.metadata.expires_at} vs NOW ${nowStamp}) — the generator failed to produce the window violation it exists to produce`);
    process.exit(1);
  }
  const expectations = {
    accept: { sigOk: true, isAnchor: true },
    'self-signed': { sigOk: true, isAnchor: false },
    'wrong-ca': { sigOk: false, isAnchor: true },
    adversarial: { sigOk: true, isAnchor: true },
  };
  const exp = expectations[mode];
  if (sigOk !== exp.sigOk || isAnchor !== exp.isAnchor) {
    console.error(`FATAL: ${mode}-mode card ${card.card_id} self-verification mismatch (sigOk=${sigOk}, isAnchor=${isAnchor}; expected sigOk=${exp.sigOk}, isAnchor=${exp.isAnchor})`);
    process.exit(1);
  }
  // cross-check with the reference semantics: accept AND adversarial cards
  // must verify under the real anchor key (the window is the adversarial
  // cards' ONLY defect)
  if (mode === 'accept' || mode === 'adversarial') {
    const verifiedUnderCa = cryptoVerify(null, buf, ca2Pub, Buffer.from(card.signature.value, 'hex'));
    if (!verifiedUnderCa) { console.error(`FATAL: ${mode}-mode card ${card.card_id} does not verify under ca-test-2`); process.exit(1); }
  }

  results.push({
    card_id: card.card_id,
    mode,
    expected_verify: expectedVerify,
    expected_stages: {
      signature_verification: sigOk ? 'pass' : 'fail',
      trust_anchor_key_selection: isAnchor ? 'pass' : 'fail',
      // valid-card modes: enforced by the self-check above (BOTH bounds hold).
      // adversarial: the DERIVED defect — the window is the only thing that
      // fails (cross-checked against derived truth at score time, never taken
      // from this sidecar alone).
      expiry_check: mode === 'adversarial' ? 'fail' : 'pass',
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
