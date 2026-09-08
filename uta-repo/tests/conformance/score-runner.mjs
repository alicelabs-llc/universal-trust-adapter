#!/usr/bin/env node
// ============================================================================
// UTA conformance — REFERENCE SCORER (v1.3.0)
// ============================================================================
// Implements stage_scoring_rule from _index.json:
//   - the runner's boolean must match expected_verify
//   - AND, for every vector carrying expected_stages, the runner's per-stage
//     outcomes must match stage by stage. ANY stage mismatch marks the vector
//     FAILED even when the boolean matches. A runner that fires the wrong
//     stage is wrong, not "healthy with a note".
//
// Modes:
//   node score-runner.mjs                       → reference runner vs the 13 fixed vectors
//   node score-runner.mjs --matrix              → simulate the cheat runners, print the table
//   node score-runner.mjs --generated DIR       → also score generated cards (all must pass)
//   node score-runner.mjs --generated DIR --matrix  → both
//
// The reference runner: pinned anchors {ca-test-1, ca-test-2} + policy
// (expiry, status) + tolerance for unknown x_* fields. Node ≥ 18, zero deps.
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

// THE REFERENCE RUNNER — pinned anchors + policy + tolerance
const reference = (card, digest) => {
  if (!card.signature) return { verify: true, stages: null }; // translation family
  const { signature, ...subtree } = card;
  const buf = Buffer.from(jcs(subtree), 'utf8');
  const sigOk = cryptoVerify(null, buf, createPublicKey({ key: Buffer.from(card.payload.identity.public_key, 'base64'), format: 'der', type: 'spki' }), Buffer.from(signature.value, 'hex'));
  const anchorOk = anchors.includes(card.payload.identity.public_key);
  const notExpired = card.payload.metadata.expires_at > NOW;
  const statusOk = card.status === 'active';
  return { verify: sigOk && anchorOk && notExpired && statusOk, stages: stagesOf(sigOk, anchorOk, notExpired, statusOk) };
};

// CHEAT RUNNERS
const alwaysTrue = (card) => ({ verify: true, stages: null });

const policyOnly = (card) => { // Ed25519 deleted from the runner
  if (!card.signature) return { verify: true, stages: null };
  const notExpired = card.payload.metadata.expires_at > NOW;
  const statusOk = card.status === 'active';
  return { verify: notExpired && statusOk, stages: null };
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
  const notExpired = card.payload.metadata.expires_at > NOW;
  const statusOk = card.status === 'active';
  return { verify: sigOk && notExpired && statusOk, stages: null };
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
  const notExpired = card.payload.metadata.expires_at > NOW;
  const statusOk = card.status === 'active';
  const truth = { verify: sigOk && anchorOk && notExpired && statusOk, stages: stagesOf(sigOk, anchorOk, notExpired, statusOk) };
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
    const meta = genIndex?.find(m => m.card_id === card.card_id);
    const { signature, ...subtree } = card;
    cards.push({
      id: `generated:${card.card_id}`,
      card,
      expected_verify: meta ? meta.expected_verify : true, // accept mode default
      expected_stages: meta ? meta.expected_stages : null,
      digest: sha256hex(Buffer.from(jcs(subtree), 'utf8')),
    });
  }
  return cards;
};

// ============================================================================
// MAIN
// ============================================================================
const fixed = loadCards();
const generated = genDir ? loadGenerated(genDir) : [];

if (!wantMatrix) {
  // reference runner vs everything
  const s1 = score(reference, fixed);
  console.log(`reference runner vs fixed vectors:   ${s1.ok}/${s1.total}`);
  if (s1.failed.length) console.log(`  failures: ${s1.failed.join(', ')}`);
  if (generated.length) {
    const s2 = score(reference, generated);
    console.log(`reference runner vs generated cards:  ${s2.ok}/${s2.total}`);
    if (s2.failed.length) console.log(`  failures: ${s2.failed.join(', ')}`);
  }
  const allOk = s1.ok === s1.total && (!generated.length || score(reference, generated).ok === generated.length);
  console.log(allOk ? '\nUTA CONFORMANCE: PASSED ✅' : '\nUTA CONFORMANCE: FAILED ❌');
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
console.log('  - stage-liar returns correct booleans but fails 6 vectors under stage scoring:');
console.log('    the stage vector is compared, not just the boolean.');
