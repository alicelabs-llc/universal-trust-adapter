#!/usr/bin/env node
// ============================================================================
// UTA conformance — REFERENCE SCORER (v1.7.0)
// ============================================================================
// v1.3.3 fixes (anp2 bug report, dev.to comment 3ec7d, 2026-09-08T21:35Z):
//   1. The validity window is TWO-SIDED: issued_at <= NOW < expires_at.
//      Previously the reference runner checked only the upper bound, so a
//      stricter runner rejecting a not-yet-valid card was scored WRONG.
//   2. Generated-card ground truth is DERIVED from the card bytes and the
//      pinned anchors — never from a default. The _generated-index.json
//      sidecar is demoted to a cross-check: if present it must AGREE with
//      the derived truth (mismatch = hard FATAL); if absent, scoring still
//      works and a true-by-default inversion is impossible.
// v1.7.0 (anp2 critique 3ehcp, 2026-09-10 — "0/60 is a measurement of the
//      generator, not of the runner's window"):
//   3. --generated DIR now happily scores ADVERSARIAL cards (correctly
//      signed, anchored, active — the only defect is a violated validity
//      window). Derivation needed no change: a window violation derives
//      expected_verify: false with expiry_check: 'fail' from the card bytes.
//      The sidecar cross-check pins the generation-time clock, which is what
//      catches clock-shifted runners (a clock-minus-one runner derives a
//      different truth than the sidecar pinned → hard FATAL).
//   4. --json prints machine-readable output (fixed + generated + per-vector
//      detail) so mutation testing (mutate-runner.mjs) can compare observable
//      behavior byte-for-byte and separate equivalent survivors from escapes.
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
//   node score-runner.mjs --generated DIR       → also score generated cards (any mode; all must pass)
//   node score-runner.mjs --generated DIR --matrix  → both
//   node score-runner.mjs --json [--generated DIR] → machine-readable (for mutate-runner.mjs)
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
const NOW = new Date().toISOString().slice(0, 10) + 'T00:00:00Z';

const jcs = (v) => JSON.stringify(v, (k, x) =>
  (x !== null && typeof x === 'object' && !Array.isArray(x))
    ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    : x);

const sha256hex = (buf) => createHash('sha256').update(buf).digest('hex');

// --- args ---
const args = process.argv.slice(2);
const wantMatrix = args.includes('--matrix');
const wantJson = args.includes('--json');
const genIdx = args.indexOf('--generated');
const genDir = genIdx !== -1 && args[genIdx + 1] && !args[genIdx + 1].startsWith('--') ? args[genIdx + 1] : null;

// --- load manifest + anchors ---
const index = JSON.parse(readFileSync(join(VECTORS, '_index.json'), 'utf8'));
const anchors = index.pinned_trust_anchors.anchors;
const validAtcSha = readFileSync(join(VECTORS, 'valid-atc.sha256'), 'utf8').trim(); // the memorized digest

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
// detail (v1.7.0): per-vector observable behavior, so mutation testing can
// compare outputs byte-for-byte and separate equivalent survivors from real
// escapes. Collecting detail does not change pass/fail semantics.
// ============================================================================
const score = (runner, cards) => {
  let ok = 0;
  const failed = [];
  const detail = [];
  for (const { id, card, expected_verify, expected_stages, digest } of cards) {
    const r = runner(card, digest);
    let correct = r.verify === expected_verify;
    let stageMismatch = null;
    if (correct && expected_stages && r.stages) {
      for (const [stage, expected] of Object.entries(expected_stages)) {
        if (r.stages[stage] !== expected) { correct = false; stageMismatch = stage; break; }
      }
    }
    if (correct) ok++; else failed.push(id);
    detail.push({ id, expected_verify, got_verify: r.verify, stages_expected: expected_stages || null, stages_got: r.stages || null, correct, stage_mismatch: stageMismatch });
  }
  return { ok, total: cards.length, failed, detail };
};

// ============================================================================
// LOAD the fixed vectors (+ generated, if any)
// ============================================================================
const loadCards = () => {
  const cards = [];
  let byteAsserted = 0; // v1.7.0 meta-integrity: the runner counts its own checks
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
      byteAsserted++;
    }
    cards.push({ id: v.id, card, expected_verify: v.expected_verify, expected_stages: v.expected_stages || null, digest });
  }
  // v1.7.0 (found by mutation testing): a runner can silently SKIP the
  // byte-exactness assertions and look healthy — the counter proves the
  // checks ran, one per signed vector, neither more nor fewer.
  const signedCount = index.vectors.filter(v => v.signed_subtree).length;
  if (byteAsserted !== signedCount) {
    console.error(`FATAL: byte-exactness assertions ran ${byteAsserted} times but ${signedCount} signed vectors exist — the runner is not performing its own checks`);
    process.exit(1);
  }
  return cards;
};

const loadGenerated = (dir) => {
  const cards = [];
  let crossChecked = 0;     // v1.7.0 meta-integrity counters
  let stageCrossChecked = 0;
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
      // v1.7.0 (found by mutation testing): bind the sidecar entry to THESE
      // card bytes — on a uniform set, cross-checking against the WRONG
      // entry still agrees on expected_verify; the sha256 does not.
      if (meta.sha256 && meta.sha256 !== digest) {
        console.error(`FATAL: ${card.card_id} — sidecar entry sha256 does not bind to these card bytes (sidecar ${meta.sha256.slice(0, 12)}…, card ${digest.slice(0, 12)}…). Cross-checking against the wrong sidecar row is a FATAL, not a pass.`);
        process.exit(1);
      }
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
        stageCrossChecked++;
      }
      crossChecked++;
    }
    cards.push({
      id: `generated:${card.card_id}`,
      card,
      expected_verify,
      expected_stages,
      digest,
    });
  }
  // v1.7.0 (found by mutation testing): a runner can silently DISABLE the
  // sidecar cross-check and look healthy — the counters prove the cross-check
  // ran once per sidecar entry (and the stage cross-check once per entry that
  // carries stages). A skipped cross-check is a FATAL, not a green run.
  if (genIndex) {
    if (crossChecked !== genIndex.length) {
      console.error(`FATAL: sidecar cross-check ran ${crossChecked} times but the sidecar has ${genIndex.length} entries — the runner is not cross-checking every generated card`);
      process.exit(1);
    }
    const withStages = genIndex.filter(m => m.expected_stages).length;
    if (stageCrossChecked !== withStages) {
      console.error(`FATAL: stage cross-check ran ${stageCrossChecked} times but ${withStages} sidecar entries carry expected_stages — the runner is not performing its own stage cross-checks`);
      process.exit(1);
    }
  }
  return cards;
};

// ============================================================================
// MAIN
// ============================================================================
const fixed = loadCards();
const generated = genDir ? loadGenerated(genDir) : [];
// v1.7.0 fail-closed (found by mutation testing): a mutant of the argument
// parsing silently NULLS OUT --generated, scores 14/14 and prints PASSED.
// The assertion is on the COMMAND LINE, not the parsed result: if the flag
// appeared, it must have been parsed AND produced scoreable cards.
if (genIdx !== -1 && (genDir === null || generated.length === 0)) {
  console.error(`FATAL: --generated appeared on the command line but ${genDir === null ? 'the argument could not be parsed (the flag cannot be silently ignored)' : `produced 0 scoreable cards from ${genDir}`} — refusing to score a silently-partial run`);
  process.exit(1);
}

if (!wantMatrix) {
  // reference runner vs everything
  const s1 = score(reference, fixed);
  const s2 = generated.length ? score(reference, generated) : null;
  const allOk = s1.ok === s1.total && (!s2 || s2.ok === s2.total);

  if (wantJson) {
    // machine-readable single object (for mutate-runner.mjs and CI)
    const out = {
      version: index.schema_version,
      runner: 'reference',
      fixed: { ok: s1.ok, total: s1.total, failed: s1.failed },
      generated: s2 ? { ok: s2.ok, total: s2.total, failed: s2.failed } : null,
      per_vector: [...s1.detail, ...(s2 ? s2.detail : [])],
      result: allOk ? 'PASSED' : 'FAILED',
    };
    console.log(JSON.stringify(out));
  } else {
    console.log(`reference runner vs fixed vectors:   ${s1.ok}/${s1.total}`);
    if (s1.failed.length) console.log(`  failures: ${s1.failed.join(', ')}`);
    if (s2) {
      console.log(`reference runner vs generated cards:  ${s2.ok}/${s2.total}`);
      if (s2.failed.length) console.log(`  failures: ${s2.failed.join(', ')}`);
    }
    console.log(allOk ? '\nUTA CONFORMANCE: PASSED ✅' : '\nUTA CONFORMANCE: FAILED ❌');
  }
  process.exit(allOk ? 0 : 1);
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
  const sf = score(runner, fixed);
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
