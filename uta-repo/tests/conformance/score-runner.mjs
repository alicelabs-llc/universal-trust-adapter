#!/usr/bin/env node
// ============================================================================
// UTA conformance — REFERENCE SCORER (v1.5.0)
// ============================================================================
// v1.4.0 (anp2network round 3, dev.to comment 3ehcp):
//   1. ADVERSARIAL DISTRIBUTION — the lower bound of the validity window is
//      now exercised by a distribution, not a fixture:
//      `generate-accept-vectors.mjs --mode adversarial` emits correctly-
//      signed ca-test-2 cards whose only defect is a future issued_at
//      (expected_verify:false), interleaved with cards dated seconds INSIDE
//      the boundary (over-rejection probe). Offsets are sampled relative to
//      the scoring clock (this runner's NOW) and include values a few
//      seconds past the boundary. Score them: `--generated <dir>`.
//   2. GENERATED MUTANTS — the 10-mutant catalogue in runner-tests/mutants.json
//      is now complemented by a GENERATED sweep (runner-tests/generate-mutants.mjs):
//      a declared set of syntax-level operators applied at EVERY site in
//      this file; survivors are published (runner-tests/mutant-sweep.json),
//      equivalent mutants separated out. Survivor identities name checks the
//      suite does not enforce.
//   3. REKOR-IN-THE-LOOP — artifact verification no longer trusts the hub for
//      the digest: anchors/verify-artifact.mjs downloads the file, fetches
//      the Rekor entry live, authenticates the anchor statement against the
//      entry's committed hash, and compares the sha256 of the downloaded
//      bytes against the Rekor-rooted pins. The log is no longer decorative
//      in the verification path.
// v1.3.3 fixes (anp2 bug report, dev.to comment 3ec7d, 2026-09-08T21:35Z):
//   1. The validity window is TWO-SIDED: issued_at <= NOW < expires_at.
//      Previously the reference runner checked only the upper bound, so a
//      stricter runner rejecting a not-yet-valid card was scored WRONG.
//   2. Generated-card ground truth is DERIVED from the card bytes and the
//      pinned anchors — never from a default. The _generated-index.json
//      sidecar is demoted to a cross-check: if present it must AGREE with
//      the derived truth (mismatch = hard FATAL); if absent, scoring still
//      works and a true-by-default inversion is impossible.
// ============================================================================
// Implements stage_scoring_rule from _index.json:
//   - the runner's boolean must match expected_verify
//   - AND, for every vector carrying expected_stages, the runner's per-stage
//     outcomes must match stage by stage. ANY stage mismatch marks the vector
//     FAILED even when the boolean matches. A runner that fires the wrong
//     stage is wrong, not "healthy with a note".
//
// Modes:
//   node score-runner.mjs                       → reference runner vs the 14 fixed vectors
//   node score-runner.mjs --matrix              → simulate the cheat runners, print the table
//   node score-runner.mjs --generated DIR       → also score generated cards (all must pass;
//                                                  DIR may contain accept/self-signed/wrong-ca
//                                                  or ADVERSARIAL cards — expectations are
//                                                  always DERIVED, the sidecar only cross-checks)
//   node score-runner.mjs --generated DIR --matrix  → both
//
// The reference runner: pinned anchors {ca-test-1, ca-test-2} + policy
// (TWO-SIDED validity window, status) + tolerance for unknown x_* fields.
// Node ≥ 18, zero deps.
// ============================================================================

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash, verify as cryptoVerify, createPublicKey } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VECTORS = join(__dirname, 'vectors');
const WALL_NOW = new Date().toISOString().slice(0, 10) + 'T00:00:00Z';

const jcs = (v) => JSON.stringify(v, (k, x) =>
  (x !== null && typeof x === 'object' && !Array.isArray(x))
    ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    : x);

const sha256hex = (buf) => createHash('sha256').update(buf).digest('hex');

// --- args ---
const args = process.argv.slice(2);
const wantMatrix = args.includes('--matrix');
const genIdx = args.indexOf('--generated');
const genDir = genIdx !== -1 && args[genIdx + 1] && !args[genIdx + 1].startsWith('--') ? args[genIdx + 1] : null;

// --- load manifest + anchors ---
const index = JSON.parse(readFileSync(join(VECTORS, '_index.json'), 'utf8'));
const anchors = index.pinned_trust_anchors.anchors;
const validAtcSha = readFileSync(join(VECTORS, 'valid-atc.sha256'), 'utf8').trim(); // the memorized digest

// v1.5.0 — TWO CLOCKS (anp2network round 4, comment 3ehp6: "the fourteen
// fixed vectors stayed byte-identical while the generated boundary moved to
// the scoring clock. premature-atc is pinned at 2030-01-01, so its
// discriminating power decays as the wall clock walks toward it, and after
// that date it stops being premature at all. Either evaluate the frozen
// fixture against a pinned clock recorded next to the result, or derive the
// premature case per run" — we do the first, and the adversarial mode
// already does the second). FIXED_NOW evaluates the frozen fixtures against
// the clock RECORDED in _index.json (evaluation_clock): the fixed suite is a
// fixture and stops aging — premature-atc stays premature forever at its
// recorded clock and the accept vectors never lapse. Generated cards are
// still scored against the live wall clock (the generator's clock domain).
// --clock pins BOTH for byte-reproducible runs. NOW is `let`: it switches
// to WALL_NOW whenever generated cards are loaded or scored.
const clockArgIdx = args.indexOf('--clock');
const clockArg = clockArgIdx !== -1 && args[clockArgIdx + 1] && !args[clockArgIdx + 1].startsWith('--') ? args[clockArgIdx + 1] : null;
const FIXED_NOW = clockArg || index.evaluation_clock || WALL_NOW;
if (!/^\d{4}-\d{2}-\d{2}T00:00:00Z$/.test(FIXED_NOW)) { console.error(`FATAL: evaluation clock must be YYYY-MM-DDT00:00:00Z, got ${FIXED_NOW}`); process.exit(1); }
let NOW = FIXED_NOW;

// ============================================================================
// RUNNERS — each takes a card object and returns
//   { verify: boolean, stages: { signature_verification, trust_anchor_key_selection, expiry_check, status_check } }
// Unsigned (translation) vectors have no stages; runners still return a boolean.
// ============================================================================

const stagesOf = (sigOk, anchorOk, notExpired, statusOk) => ({
  signature_verification: sigOk ? 'pass' : 'fail',
  trust_anchor_key_selection: anchorOk ? 'pass' : 'fail',
  expiry_check: notExpired ? 'pass' : 'fail',
  status_check: statusOk ? 'pass' : 'fail',
});

// THE REFERENCE RUNNER — pinned anchors + two-sided policy + tolerance
const reference = (card, digest) => {
  if (!card.signature) return { verify: true, stages: null }; // translation family
  const { signature, ...subtree } = card;
  const buf = Buffer.from(jcs(subtree), 'utf8');
  const sigOk = cryptoVerify(null, buf, createPublicKey({ key: Buffer.from(card.payload.identity.public_key, 'base64'), format: 'der', type: 'spki' }), Buffer.from(signature.value, 'hex'));
  const anchorOk = anchors.includes(card.payload.identity.public_key);
  // v1.3.3: BOTH bounds — a card is in-window only if issued_at <= NOW < expires_at.
  // expired-atc closes the upper bound; premature-atc closes the lower bound.
  const inWindow = card.payload.metadata.expires_at > NOW && card.payload.metadata.issued_at <= NOW;
  const statusOk = card.status === 'active';
  return { verify: sigOk && anchorOk && inWindow && statusOk, stages: stagesOf(sigOk, anchorOk, inWindow, statusOk) };
};

// CHEAT RUNNERS
const alwaysTrue = (card) => ({ verify: true, stages: null });

const policyOnly = (card) => { // Ed25519 deleted from the runner
  if (!card.signature) return { verify: true, stages: null };
  const inWindow = card.payload.metadata.expires_at > NOW && card.payload.metadata.issued_at <= NOW;
  const statusOk = card.status === 'active';
  return { verify: inWindow && statusOk, stages: null };
};

const cryptoOnly = (card) => { // no expiry/status checks
  if (!card.signature) return { verify: true, stages: null };
  const { signature, ...subtree } = card;
  const buf = Buffer.from(jcs(subtree), 'utf8');
  const sigOk = cryptoVerify(null, buf, createPublicKey({ key: Buffer.from(card.payload.identity.public_key, 'base64'), format: 'der', type: 'spki' }), Buffer.from(signature.value, 'hex'));
  const anchorOk = anchors.includes(card.payload.identity.public_key);
  return { verify: sigOk && anchorOk, stages: null };
};

const tofu = (card) => { // embedded-key (trust-on-first-use) + policy
  if (!card.signature) return { verify: true, stages: null };
  const { signature, ...subtree } = card;
  const buf = Buffer.from(jcs(subtree), 'utf8');
  const sigOk = cryptoVerify(null, buf, createPublicKey({ key: Buffer.from(card.payload.identity.public_key, 'base64'), format: 'der', type: 'spki' }), Buffer.from(signature.value, 'hex'));
  const inWindow = card.payload.metadata.expires_at > NOW && card.payload.metadata.issued_at <= NOW;
  const statusOk = card.status === 'active';
  return { verify: sigOk && inWindow && statusOk, stages: null };
};

// THE MEMORIZER (anp2network's construct): true for unsigned, true for THE
// memorized valid-atc digest, false for every other signed card.
const memorizer = (card, digest) => {
  if (!card.signature) return { verify: true, stages: null };
  return { verify: digest === validAtcSha, stages: null };
};

// THE OVER-REJECTOR: reference runner that chokes on unknown-but-permitted fields
const overRejector = (card, digest) => {
  if (!card.signature) return { verify: true, stages: null };
  const hasUnknown = Object.keys(card.payload).some(k => k.startsWith('x_'));
  if (hasUnknown) return { verify: false, stages: null };
  return reference(card, digest);
};

// THE STAGE-LIAR: correct booleans (hardcoded), but reports signature_verification: fail for everything
const stageLiar = (card) => {
  if (!card.signature) return { verify: true, stages: null };
  const { signature, ...subtree } = card;
  const buf = Buffer.from(jcs(subtree), 'utf8');
  const sigOk = cryptoVerify(null, buf, createPublicKey({ key: Buffer.from(card.payload.identity.public_key, 'base64'), format: 'der', type: 'spki' }), Buffer.from(signature.value, 'hex'));
  const anchorOk = anchors.includes(card.payload.identity.public_key);
  const inWindow = card.payload.metadata.expires_at > NOW && card.payload.metadata.issued_at <= NOW;
  const statusOk = card.status === 'active';
  const truth = { verify: sigOk && anchorOk && inWindow && statusOk, stages: stagesOf(sigOk, anchorOk, inWindow, statusOk) };
  return { verify: truth.verify, stages: { ...truth.stages, signature_verification: 'fail' } }; // ← the lie
};

// ============================================================================
// SCORING — stage mismatches count as vector failures
// ============================================================================
const score = (runner, cards) => {
  let ok = 0;
  const failed = [];
  for (const { id, card, expected_verify, expected_stages, digest } of cards) {
    const r = runner(card, digest);
    let correct = r.verify === expected_verify;
    if (correct && expected_stages && r.stages) {
      for (const [stage, expected] of Object.entries(expected_stages)) {
        if (r.stages[stage] !== expected) { correct = false; break; }
      }
    }
    if (correct) ok++; else failed.push(id);
  }
  return { ok, total: cards.length, failed };
};

// ============================================================================
// LOAD the fixed vectors (+ generated, if any)
// ============================================================================
const loadCards = () => {
  const cards = [];
  for (const v of index.vectors) {
    const card = JSON.parse(readFileSync(join(VECTORS, v.original_vector_file), 'utf8'));
    let digest = null;
    if (v.signed_subtree) {
      const { signature, ...subtree } = card;
      digest = sha256hex(Buffer.from(jcs(subtree), 'utf8'));
      // byte-exactness against the published canonical bytes is asserted too
      const published = readFileSync(join(VECTORS, v.canonical_text_file), 'utf8');
      const rederived = jcs(subtree);
      if (rederived !== published) { console.error(`FATAL: ${v.id} re-derivation mismatch`); process.exit(1); }
      if (digest !== v.sha256) { console.error(`FATAL: ${v.id} digest mismatch vs _index.json`); process.exit(1); }
    }
    cards.push({ id: v.id, card, expected_verify: v.expected_verify, expected_stages: v.expected_stages || null, digest });
  }
  return cards;
};

const loadGenerated = (dir) => {
  const cards = [];
  const genIndex = existsSync(join(dir, '_generated-index.json'))
    ? JSON.parse(readFileSync(join(dir, '_generated-index.json'), 'utf8'))
    : null;
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json') && f !== '_generated-index.json' && !f.startsWith('_'))) {
    const card = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    // v1.3.3 (anp2 bug 2): ground truth is DERIVED from the card bytes and
    // the pinned anchors — the sidecar is a cross-check, never the source of
    // truth. A missing sidecar can no longer flip expectations, and a sidecar
    // that disagrees with the derived truth is a hard FATAL (fail closed).
    if (!card.signature?.value || !card.payload?.identity?.public_key ||
        !card.payload?.metadata?.issued_at || !card.payload?.metadata?.expires_at || !card.status) {
      console.error(`FATAL: ${f} is not a scoreable ATC card — cannot derive ground truth (missing signature / identity / metadata / status). Fail closed.`);
      process.exit(1);
    }
    const { signature, ...subtree } = card;
    const buf = Buffer.from(jcs(subtree), 'utf8');
    const digest = sha256hex(buf);
    // derived expectations — same pinned-anchor + two-sided-window semantics
    const sigOk = cryptoVerify(null, buf, createPublicKey({ key: Buffer.from(card.payload.identity.public_key, 'base64'), format: 'der', type: 'spki' }), Buffer.from(signature.value, 'hex'));
    const anchorOk = anchors.includes(card.payload.identity.public_key);
    const inWindow = card.payload.metadata.expires_at > NOW && card.payload.metadata.issued_at <= NOW;
    const statusOk = card.status === 'active';
    const expected_verify = sigOk && anchorOk && inWindow && statusOk;
    const expected_stages = stagesOf(sigOk, anchorOk, inWindow, statusOk);
    const meta = genIndex?.find(m => m.card_id === card.card_id);
    if (meta) {
      if (meta.expected_verify !== expected_verify) {
        console.error(`FATAL: ${card.card_id} — sidecar expected_verify=${meta.expected_verify} but derived truth is ${expected_verify}. The sidecar and the card bytes disagree; refusing to score.`);
        process.exit(1);
      }
      if (meta.expected_stages) {
        for (const [stage, expected] of Object.entries(meta.expected_stages)) {
          if (expected_stages[stage] !== expected) {
            console.error(`FATAL: ${card.card_id} — sidecar stage ${stage}=${expected} but derived truth is ${expected_stages[stage]}. The sidecar and the card bytes disagree; refusing to score.`);
            process.exit(1);
          }
        }
      }
    }
    cards.push({
      id: `generated:${card.card_id}`,
      card,
      expected_verify,
      expected_stages,
      digest,
    });
  }
  return cards;
};

// ============================================================================
// MAIN
// ============================================================================
const fixed = loadCards();
NOW = WALL_NOW;                       // v1.5.0: generated cards live in the wall-clock domain
const generated = genDir ? loadGenerated(genDir) : [];

if (!wantMatrix) {
  // reference runner vs everything (fixed at the pinned fixture clock)
  NOW = FIXED_NOW;
  const s1 = score(reference, fixed);
  console.log(`reference runner vs fixed vectors:   ${s1.ok}/${s1.total}`);
  if (s1.failed.length) console.log(`  failures: ${s1.failed.join(', ')}`);
  if (generated.length) {
    NOW = WALL_NOW;
    const s2 = score(reference, generated);
    console.log(`reference runner vs generated cards:  ${s2.ok}/${s2.total}`);
    if (s2.failed.length) console.log(`  failures: ${s2.failed.join(', ')}`);
    const allOk = s1.ok === s1.total && s2.ok === s2.total;
    console.log(allOk ? '\nUTA CONFORMANCE: PASSED ✅' : '\nUTA CONFORMANCE: FAILED ❌');
    process.exit(allOk ? 0 : 1);
  }
  const allOk1 = s1.ok === s1.total;
  console.log(allOk1 ? '\nUTA CONFORMANCE: PASSED ✅' : '\nUTA CONFORMANCE: FAILED ❌');
  process.exit(allOk1 ? 0 : 1);
}

// --matrix: the separation table, reproducible
console.log(`\nRunner separation matrix (v${index.schema_version}, ${fixed.length} fixed vectors${generated.length ? ` + ${generated.length} generated` : ''})\n`);
const rows = [
  ['always-true', alwaysTrue],
  ['policy-only (Ed25519 deleted)', policyOnly],
  ['crypto-only (no expiry/status)', cryptoOnly],
  ['embedded-key + policy (TOFU)', tofu],
  ['memorizer (hardcodes valid-atc digest)', memorizer],
  ['over-rejector (chokes on x_* fields)', overRejector],
  ['stage-liar (all fire at sig-verification)', stageLiar],
  ['reference (pinned + policy + tolerance)', reference],
];
console.log('| Runner | fixed vectors | generated |');
console.log('|---|---|---|');
for (const [name, runner] of rows) {
  NOW = FIXED_NOW;                                    // fixtures at the pinned clock
  const sf = score(runner, fixed);
  NOW = WALL_NOW;                                     // generated at the wall clock
  const sg = generated.length ? score(runner, generated) : null;
  console.log(`| ${name} | ${sf.ok}/${sf.total} ${sf.failed.length ? `← fails ${sf.failed.slice(0, 3).join(', ')}${sf.failed.length > 3 ? '…' : ''}` : ''} | ${sg ? `${sg.ok}/${sg.total}` : 'n/a'} |`);
}
console.log('\nReading the table:');
console.log('  - memorizer passed 11/11 on v1.2.0; on v1.3.0 it fails valid-atc-2 and valid-unknown-field,');
console.log('    and it scores 0 against generated cards — recognition cannot survive a generator.');
console.log('  - over-rejector fails valid-unknown-field (and every generated card with x_gen_* fields):');
console.log('    false rejections no longer read as healthy.');
console.log('  - stage-liar returns correct booleans but fails vectors under stage scoring:');
console.log('    the stage vector is compared, not just the boolean.');
console.log('  - premature-atc (v1.3.3): a properly-signed, anchored, active card whose only');
console.log('    defect is a FUTURE issued_at. crypto-only and always-true accept it — the');
console.log('    lower bound of the validity window has teeth now.');
console.log('  - generated expectations are DERIVED from card bytes + pinned anchors (v1.3.3):');
console.log('    deleting _generated-index.json cannot invert the scoring anymore, and a');
console.log('    sidecar that disagrees with the derived truth aborts the run (FATAL).');
console.log('  - adversarial mode (v1.4.0): generate-accept-vectors.mjs --mode adversarial straddles');
console.log('    the lower bound with a clock-relative offset distribution (+1s … +4y premature,');
console.log('    −1s … −23h in-window) — the bound is tested by a distribution, not one fixture,');
console.log('    and over-rejection at the boundary is caught by the same run (--generated DIR).');
console.log('  - generated mutants (v1.4.0): runner-tests/generate-mutants.mjs applies a declared set of');
console.log('    syntax-level operators at EVERY site in this file and publishes the survivors');
console.log('    (runner-tests/mutant-sweep.json) with equivalent mutants separated out.');
console.log('  - rekor-in-the-loop (v1.4.0): anchors/verify-artifact.mjs compares the sha256 of the');
console.log('    downloaded artifact against Rekor-committed digests — the log is in the actual');
console.log('    verification path, not decorative (anp2network, round 3).');
console.log('  - two clocks (v1.5.0): the fixed suite is evaluated against evaluation_clock from');
console.log('    _index.json (a pinned clock recorded next to the result) — premature-atc never');
console.log('    decays and the accept vectors never lapse. Generated cards stay on the wall clock.');
console.log('    Pass --clock YYYY-MM-DDT00:00:00Z to pin both for byte-reproducible runs.');
