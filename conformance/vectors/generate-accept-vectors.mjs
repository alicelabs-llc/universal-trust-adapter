#!/usr/bin/env node
// ============================================================================
// UTA conformance vectors — GENERATOR (v1.4.0)
// ============================================================================
// Produces unlimited fresh signed cards so the accept side of the suite can
// never be memorized. Any fixed vector set is learnable by recognition; this
// generator is not, because the content is random and the digest moves every
// run.
//
// v1.4.0 — adversarial mode (anp2network round 3, dev.to comment 3ehcp):
//   --mode adversarial emits correctly-signed ca-test-2 cards probing BOTH
//   bounds of the validity window relative to the scoring clock (the
//   runner's NOW: UTC truncated to the day — the boundary is midnight UTC).
//   Lower-bound probes carry a future issued_at (expected_verify:false) or
//   one dated at/inside the boundary (expected_verify:true — the
//   over-rejection probe, including issued_at === NOW exactly, the only
//   input distinguishing <= from <). Upper-bound probes are issued 30 days
//   in the past and expire at/around the boundary (expires_at === NOW
//   exactly is the only input distinguishing > from >=). Offsets are
//   SAMPLED from declared pools and include values a few seconds past the
//   boundary (+1s, +2s, +5s…) and a few seconds before it (−1s, −5s…).
//   The bound is tested by a DISTRIBUTION instead of a fixture. The
//   intended side is cross-checked against the runner's own clock semantics
//   before emission (fail-closed); the sidecar stays a cross-check, never
//   the source of truth. Keep FATAL for unintended window violations in
//   the valid-card modes (accept / self-signed / wrong-ca) — unchanged.
//   Caveat: generate and score within the same UTC day; across midnight the
//   boundary cards change side and the scorer's sidecar cross-check
//   fail-closes rather than scoring stale expectations.
//
// Modes:
//   accept      cards signed AND declared by ca-test-2  → expected_verify: true
//   self-signed fresh attacker key per card, declared AND signing
//               → fails trust_anchor_key_selection (expected_verify: false)
//   wrong-ca    declares ca-test-2, signed by a fresh key
//               → fails signature_verification (expected_verify: false)
//   adversarial correctly-signed ca-test-2 cards straddling the lower bound
//               → future issued_at: expected_verify: false (premature);
//                 seconds/minutes inside the boundary: expected_verify: true
//               → the bound is exercised by a distribution, not one fixture
//
// Usage:
//   node generate-accept-vectors.mjs                       # 10 accept cards → stdout
//   node generate-accept-vectors.mjs --count 50 --seed 42  # reproducible set
//   node generate-accept-vectors.mjs --mode self-signed --count 5
//   node generate-accept-vectors.mjs --out ./gen-challenge # writes files like the fixed set
//   node generate-accept-vectors.mjs --mode adversarial --count 24 --seed 3 --out ./adv-challenge
//   node ../score-runner.mjs --generated ./adv-challenge   # score the distribution
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

// v1.4.0 adversarial offset pools — seconds relative to the SCORING CLOCK
// (the runner's NOW = today 00:00:00Z, so the boundary is midnight UTC).
// LOWER-bound probes: FUTURE offsets land past the boundary (premature:
// expected_verify false); PAST offsets (and 0) land at-or-inside it
// (in-window: expected_verify true — the over-rejection probe). Bare +1s
// stays premature for the rest of the UTC day; bare −1s is already valid;
// offset 0 issues EXACTLY at the boundary point (issued_at === NOW), which
// is the only input that distinguishes `<=` from `<` — the first generated
// sweep showed the suite had no such card, so le-narrow mutants survived.
// UPPER-bound probes: the card is issued 30 days in the past and expires at
// an offset from the same clock — offset 0 expires EXACTLY at NOW (the only
// input distinguishing `>` from `>=`; gt-widen mutants survived the first
// sweep for the same reason), −1s is just-expired, +1s barely-valid.
// anp2network (3ehcp): "Sample the issuance offset relative to the scoring
// clock, and include values a few seconds past the boundary. Then the bound
// is tested by a distribution instead of a fixture."
const ADV_FUTURE = [1, 2, 5, 10, 30, 60, 300, 3600, 6 * 3600, 12 * 3600, 23 * 3600, 86400,
  2 * 86400, 7 * 86400, 30 * 86400, 90 * 86400, 365 * 86400, 1460 * 86400];
const ADV_PAST = [0, -1, -5, -30, -60, -300, -3600, -6 * 3600, -12 * 3600, -23 * 3600];
const ADV_EXPIRES = [-1, 0, 1, 5, 60, 3600, 12 * 3600, 23 * 3600, 86400, 7 * 86400]; // upper-bound probe pool
// deterministic head: the six boundary-straddling probes every run carries
const ADV_HEAD = [
  { bound: 'lower', offset: 1 },   // +1s past the lower boundary — premature
  { bound: 'lower', offset: -1 },  // −1s inside the lower boundary — in-window
  { bound: 'lower', offset: 0 },   // issued EXACTLY at NOW — the boundary point (<= vs <)
  { bound: 'upper', offset: 0 },   // expires EXACTLY at NOW — the boundary point (> vs >=)
  { bound: 'upper', offset: 1 },   // expires +1s inside — barely valid
  { bound: 'upper', offset: -1 },  // expires −1s — just expired
];
const pickAdversarialCard = (i) => {
  if (i < ADV_HEAD.length) return ADV_HEAD[i];
  const r = rand();
  if (r < 0.55) return { bound: 'lower', offset: rand() < 0.6 ? pick(ADV_FUTURE) : pick(ADV_PAST) };
  return { bound: 'upper', offset: pick(ADV_EXPIRES) };
};

const randomCard = (adv) => {
  const nCaps = 1 + Math.floor(rand() * 3);
  const caps = [...CAPS].sort(() => rand() - 0.5).slice(0, nCaps).sort();
  let issuedAt, expiresAt;
  if (adv) {
    // adversarial: date the card relative to the SCORING CLOCK, not the past clamp
    const midnight = Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
    if (adv.bound === 'lower') {
      const issuedOn = new Date(midnight + adv.offset * 1000);
      const expiresOn = new Date(issuedOn.getTime() + 1095 * 86400000); // +3y, always future
      issuedAt = issuedOn.toISOString().slice(0, 19) + 'Z'; // seconds precision
      expiresAt = expiresOn.toISOString().slice(0, 10) + 'T00:00:00Z';
    } else { // upper probe: issued deep in the past, expiry near the boundary
      const issuedOn = new Date(midnight - 30 * 86400000);
      const expiresOn = new Date(midnight + adv.offset * 1000);
      issuedAt = issuedOn.toISOString().slice(0, 10) + 'T00:00:00Z';
      expiresAt = expiresOn.toISOString().slice(0, 19) + 'Z'; // seconds precision
    }
  } else {
    // v1.3.3 fix (anp2 bug 1): issued_at is DERIVED FROM THE CLOCK and clamped
    // to the past — 1..729 days back — so a generated card is never "not yet
    // valid". expires_at = issued_at + 3 years, always inside the future.
    // The old code drew the issue year as 2026|2027 and randomized month/day,
    // so ~half the cards were dated ahead of the clock while the sidecar still
    // declared expiry_check: pass. Dates now follow the wall clock, never the PRNG.
    const backDays = 1 + Math.floor(rand() * 729);
    const issuedOn = new Date(Date.now() - backDays * 86400000);
    const expiresOn = new Date(issuedOn.getTime() + 1095 * 86400000); // +3y ≥ now+366d
    issuedAt = issuedOn.toISOString().slice(0, 10) + 'T00:00:00Z';
    expiresAt = expiresOn.toISOString().slice(0, 10) + 'T00:00:00Z';
  }
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

// --- generate + self-verify (fail-closed) ---
const results = [];
const scoringClock = new Date().toISOString().slice(0, 10) + 'T00:00:00Z'; // the runner's NOW
for (let i = 0; i < count; i++) {
  const adv = mode === 'adversarial' ? pickAdversarialCard(i) : null;
  const card = randomCard(adv);

  let declaredKey, signingPriv, expectedVerify;
  if (mode === 'accept') {
    declaredKey = ca2Spki; signingPriv = ca2Priv; expectedVerify = true;
  } else if (mode === 'adversarial') {
    // correctly signed AND anchored — the window is the ONLY defect (or, for
    // inside-boundary offsets, the only thing keeping the card valid):
    //   lower-bound probe: issued_at <= NOW (offset <= 0) → in-window → true
    //   upper-bound probe: expires_at >  NOW (offset >  0) → in-window → true
    declaredKey = ca2Spki; signingPriv = ca2Priv;
    expectedVerify = adv.bound === 'lower' ? adv.offset <= 0 : adv.offset > 0;
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
  //   adversarial: intended side cross-checked against the runner's own clock semantics
  //   window (valid modes): issued_at <= NOW < expires_at — BOTH bounds, enforced at generation
  const declaredPub = createPublicKey({ key: Buffer.from(card.payload.identity.public_key, 'base64'), format: 'der', type: 'spki' });
  const sigOk = cryptoVerify(null, buf, declaredPub, Buffer.from(card.signature.value, 'hex'));
  const isAnchor = card.payload.identity.public_key === ca2Spki;
  const nowStamp = scoringClock;
  const notBeforeOk = card.payload.metadata.issued_at <= nowStamp;
  const notAfterOk = card.payload.metadata.expires_at > nowStamp;
  if (mode === 'adversarial') {
    // v1.4.0: the intended side is DERIVED from the runner's clock
    // semantics (issued_at <= NOW < expires_at) and must equal the probe's
    // intent on its bound — and the OTHER bound must hold so the probed
    // bound is the only thing under test. Fail-closed before emission.
    const inWindow = notBeforeOk && notAfterOk;
    const intendedInWindow = adv.bound === 'lower' ? adv.offset <= 0 : adv.offset > 0;
    if (inWindow !== intendedInWindow) {
      console.error(`FATAL: adversarial card ${card.card_id} (${adv.bound}-bound offset ${adv.offset}s from ${nowStamp}) derived inWindow=${inWindow} but intended ${intendedInWindow} — the clock-relative offset math failed; refusing to emit`);
      process.exit(1);
    }
    if (adv.bound === 'lower' && !notAfterOk) {
      console.error(`FATAL: adversarial card ${card.card_id} expires_at ${card.payload.metadata.expires_at} is not future — the lower bound would not be the only defect; refusing to emit`);
      process.exit(1);
    }
    if (adv.bound === 'upper' && !notBeforeOk) {
      console.error(`FATAL: adversarial card ${card.card_id} issued_at ${card.payload.metadata.issued_at} is not in the past — the upper bound would not be the only defect; refusing to emit`);
      process.exit(1);
    }
  } else if (!notBeforeOk || !notAfterOk) {
    console.error(`FATAL: ${mode}-mode card ${card.card_id} violates the validity window (issued_at ${card.payload.metadata.issued_at} vs NOW ${nowStamp}, expires_at ${card.payload.metadata.expires_at}) — the clock-derived date clamp failed`);
    process.exit(1);
  }
  const expectations = {
    accept: { sigOk: true, isAnchor: true },
    adversarial: { sigOk: true, isAnchor: true },
    'self-signed': { sigOk: true, isAnchor: false },
    'wrong-ca': { sigOk: false, isAnchor: true },
  };
  const exp = expectations[mode];
  if (sigOk !== exp.sigOk || isAnchor !== exp.isAnchor) {
    console.error(`FATAL: ${mode}-mode card ${card.card_id} self-verification mismatch (sigOk=${sigOk}, isAnchor=${isAnchor}; expected sigOk=${exp.sigOk}, isAnchor=${exp.isAnchor})`);
    process.exit(1);
  }
  // cross-check with the reference semantics: accept/adversarial cards must fully verify under ca-test-2
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
      // v1.4.0: adversarial cards that fall outside the window fail
      // expiry_check on their probed bound (the stage covers the whole
      // two-sided window); inside-boundary cards pass it.
      expiry_check: (mode === 'adversarial' && !expectedVerify) ? 'fail' : 'pass',
      status_check: 'pass',
    },
    ...(mode === 'adversarial' ? {
      adversarial: {
        bound: adv.bound,
        offset_seconds: adv.offset,
        scoring_clock: scoringClock,
        side: adv.bound === 'lower'
          ? (adv.offset > 0 ? 'past-lower-bound/premature' : 'at-or-inside-lower-bound/over-rejection-probe')
          : (adv.offset > 0 ? 'inside-upper-bound/barely-valid' : 'at-or-past-upper-bound/expired'),
      },
    } : {}),
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
if (mode === 'adversarial') {
  const lower = results.filter(r => r.adversarial.bound === 'lower');
  const upper = results.filter(r => r.adversarial.bound === 'upper');
  const out = (a) => a.filter(r => !r.expected_verify).length;
  console.error(`adversarial distribution: ${lower.length} lower-bound probes (${out(lower)} premature / ${lower.length - out(lower)} in-window) + ${upper.length} upper-bound probes (${out(upper)} expired / ${upper.length - out(upper)} valid) | head cards: issued+1s, issued−1s, issued==NOW, expires==NOW, expires+1s, expires−1s | scoring clock ${scoringClock} | score within the same UTC day`);
}
