#!/usr/bin/env node
// ============================================================================
// UTA conformance — RUNNER TEST SUITE (v1.3.2)
// "Making the runner the tested thing, not just the cards."
// ============================================================================
// The reference scorer (score-runner.mjs) is code WE wrote. Until v1.3.2 a
// stranger had to trust it. This suite turns it from a trusted component
// into a tested component:
//
//   1. BYTES:   sha256(score-runner.mjs) must equal the digest pinned in the
//               answer key — and the answer key is anchored in Sigstore's
//               public Rekor log (entry #2), so it cannot be rewritten.
//   2. GOLDEN:  the runner's observable behavior — the 8-runner separation
//               matrix and the reference-mode verdict — must reproduce the
//               answer key exactly, row by row, including failure lists and
//               exit codes.
//   3. TEETH:   10 known-bad runner variants (deterministic byte patches of
//               the pristine runner, each digest pinned in the key) must
//               each DIVERGE from the key. A key that nothing can fail is
//               not a test; every mutant here is caught.
//
// The behavioral oracle is the answer key; the bytes oracle is Rekor. Between
// them, a stranger months later can re-derive: same bytes → same behavior →
// matches the anchored key — without having to ask us anything.
//
// Modes:
//   node runner-tests.mjs           → verify (fail-closed; exit 0 = passed)
//   node runner-tests.mjs --record  → regenerate answer-key.json from the
//                                      runner's live behavior. One-shot by
//                                      policy: a new key must be re-anchored
//                                      in Rekor (new entry, new throwaway key).
//
// Time: the key carries as_of / valid_until. valid_until is the day before
// the earliest future expires_at among the signed vectors — after that date
// the suite fails CLOSED with an explanation (vectors must be re-issued),
// it never silently passes on stale expectations.
//
// Node >= 18, zero dependencies. Layout (repo == site):
//   <conformance>/score-runner.mjs        ← the runner under test
//   <conformance>/vectors/…               ← 13 fixed vectors + _index.json
//   <conformance>/runner-tests/…          ← this suite + key + mutants
// ============================================================================
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONF = join(__dirname, '..'); // tests/conformance/ (repo) or  uta/conformance/ (site)
const RUNNER = join(CONF, 'score-runner.mjs');
const VECTORS = join(CONF, 'vectors');
const KEY_PATH = join(__dirname, 'answer-key.json');
const MUTANTS_PATH = join(__dirname, 'mutants.json');
const TMP_MUTANT = join(CONF, 'score-runner.mutant.tmp.mjs');

const sha256hex = (b) => createHash('sha256').update(b).digest('hex');
const argv = process.argv.slice(2);
const RECORD = argv.includes('--record');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

// ---------- prereqs (fail-closed) ----------
if (!existsSync(RUNNER)) {
  console.error(`✗ score-runner.mjs not found at ${RUNNER} — layout: runner-tests/ must sit beside score-runner.mjs and vectors/`);
  process.exit(2);
}
const runnerSrc = readFileSync(RUNNER, 'utf8');
const runnerSha = sha256hex(runnerSrc);
const mutantDefs = JSON.parse(readFileSync(MUTANTS_PATH, 'utf8')).mutants;
try { unlinkSync(TMP_MUTANT); } catch { /* nothing to clean */ }

const runRunner = (file, args) =>
  spawnSync(process.execPath, [file, ...args], { encoding: 'utf8', cwd: CONF, timeout: 90000 });

// ---------- parse the runner's two observable surfaces ----------
const parseMatrix = (stdout) => {
  const rows = [];
  let header = null;
  for (const line of stdout.split(/\r?\n/)) {
    const h = line.match(/^Runner separation matrix \(v([\d.]+), (\d+) fixed vectors/);
    if (h) { header = { version: h[1], fixed: parseInt(h[2], 10) }; continue; }
    const r = line.match(/^\|\s*(.+?)\s*\|\s*(\d+)\/(\d+)\s*(?:← fails (.*?))?\s*\|\s*(\S+)\s*\|$/);
    if (r && !r[1].startsWith('---') && r[1] !== 'Runner') {
      rows.push({
        name: r[1],
        ok: parseInt(r[2], 10),
        total: parseInt(r[3], 10),
        failed: r[4] ? r[4].split(', ').map((s) => s.replace(/…$/, '')) : [],
        generated: r[5],
      });
    }
  }
  if (!header || rows.length === 0) return null; // unparsable output = divergence
  return { header, rows };
};

const parseReference = (stdout) => {
  const m = stdout.match(/reference runner vs fixed vectors:\s*(\d+)\/(\d+)/);
  return {
    score: m ? `${m[1]}/${m[2]}` : null,
    passed: stdout.includes('UTA CONFORMANCE: PASSED ✅'),
    failed_listed: /failures:/.test(stdout),
  };
};

// ---------- validity window: earliest future expiry AND earliest future ----------
// ---------- issued_at among signed vectors (v1.3.3: the window is two-sided) ------
const today = new Date().toISOString().slice(0, 10);
const nowStamp = new Date().toISOString().slice(0, 10) + 'T00:00:00Z'; // same NOW the runner truncates to
const idx = JSON.parse(readFileSync(join(VECTORS, '_index.json'), 'utf8'));
let minExp = null;   // earliest FUTURE expires_at (a true verdict flips to false here)
let minIssued = null; // earliest FUTURE issued_at (a premature verdict flips to true here — v1.3.3)
for (const v of idx.vectors) {
  if (!v.signed_subtree) continue; // translation family: no expiry dependency
  const card = JSON.parse(readFileSync(join(VECTORS, v.original_vector_file), 'utf8'));
  const exp = card?.payload?.metadata?.expires_at;
  if (exp && exp > nowStamp && (!minExp || exp < minExp)) minExp = exp;
  const iss = card?.payload?.metadata?.issued_at;
  if (iss && iss > nowStamp && (!minIssued || iss < minIssued)) minIssued = iss;
}
if (!minExp) { console.error('✗ no signed vectors with future expires_at found — cannot compute validity window'); process.exit(2); }
const earliestFlip = (minIssued && minIssued < minExp) ? minIssued : minExp;
const validUntil = new Date(new Date(earliestFlip).getTime() - 86400000).toISOString().slice(0, 10);

// ---------- pristine observations ----------
const matrixRun = runRunner(RUNNER, ['--matrix']);
const pristineMatrix = matrixRun.status === 0 ? parseMatrix(matrixRun.stdout) : null;
const refRun = runRunner(RUNNER, []);
const pristineRef = refRun.status === 0 ? parseReference(refRun.stdout) : null;
if (!pristineMatrix || !pristineRef) {
  console.error('✗ pristine score-runner.mjs failed to produce parseable output — refusing to proceed');
  console.error((matrixRun.stderr || '').slice(0, 400));
  process.exit(2);
}

// ---------- mutant machinery ----------
const applyPatch = (src, def) => {
  const count = src.split(def.find).length - 1;
  if (count !== def.occurrences) {
    return { error: `occurrence mismatch: expected ${def.occurrences}, found ${count} — the target source changed` };
  }
  const patched = def.mode === 'all'
    ? src.split(def.find).join(def.replace)
    : src.replace(def.find, def.replace);
  if (patched === src) return { error: 'patch is a no-op — mutant definition is broken' };
  return { patched };
};

const observeMutant = (def) => {
  const { patched, error } = applyPatch(runnerSrc, def);
  if (error) return { error };
  writeFileSync(TMP_MUTANT, patched);
  try {
    const mRun = runRunner(TMP_MUTANT, ['--matrix']);
    const rRun = runRunner(TMP_MUTANT, []);
    const matrix = mRun.status === 0 ? parseMatrix(mRun.stdout) : null;
    const where = [];
    if (matrix === null || JSON.stringify(matrix) !== JSON.stringify(pristineMatrix)) where.push('matrix');
    const ref = rRun.status === 0 ? parseReference(rRun.stdout) : null;
    if (ref === null || JSON.stringify(ref) !== JSON.stringify(pristineRef) || rRun.status !== refRun.status) where.push('reference');
    return { sha256: sha256hex(patched), diverges: where.length > 0, where, exit: mRun.status };
  } finally {
    try { unlinkSync(TMP_MUTANT); } catch { /* already gone */ }
  }
};

// ============================================================================
// RECORD MODE — capture the runner's behavior as the answer key
// ============================================================================
if (RECORD) {
  console.log('=== runner test suite — RECORD MODE (one-shot; re-anchor the new key in Rekor) ===\n');
  if (today > validUntil) {
    console.error(`✗ cannot record: today ${today} is past valid_until ${validUntil} — re-issue vectors first`);
    process.exit(2);
  }
  const mutants = {};
  let allCaught = true;
  for (const def of mutantDefs) {
    const obs = observeMutant(def);
    if (obs.error) { console.error(`✗ mutant ${def.id}: ${obs.error}`); process.exit(2); }
    mutants[def.id] = { sha256: obs.sha256, diverges: obs.diverges, where: obs.where };
    if (!obs.diverges) {
      allCaught = false;
      console.log(`  ⚠ mutant ${def.id} was NOT caught — the key has a blind spot for this bug; fix the mutant or the suite`);
    } else {
      console.log(`  · ${def.id}: caught (diverges at ${obs.where.join(' + ')})`);
    }
  }
  const key = {
    schema: 'uta-runner-answer-key/1.0',
    as_of: today,
    valid_until: validUntil,
    earliest_future_expiry: minExp,
    earliest_future_issued_at: minIssued,
    runner: { file: '../score-runner.mjs', sha256: runnerSha, bytes: Buffer.byteLength(runnerSrc, 'utf8') },
    matrix: pristineMatrix,
    reference: { ...pristineRef, exit_code: refRun.status },
    mutant_count: mutantDefs.length,
    mutants,
    note: 'Behavioral oracle for score-runner.mjs, recorded from live behavior. The key is a derived artifact: every value here is observed, none asserted by hand. Anchored in Sigstore Rekor (see tests/anchors/anchor-record-v2.json); a re-anchored successor supersedes this key. After valid_until the suite fails closed: re-issue vectors, re-record, re-anchor.',
  };
  writeFileSync(KEY_PATH, JSON.stringify(key, null, 2) + '\n');
  console.log(`\nanswer-key.json written — runner sha256 ${runnerSha.slice(0, 16)}…, ${pristineMatrix.rows.length} matrix rows, ${mutantDefs.length} mutants, valid ${today} → ${validUntil}`);
  if (!allCaught) { console.error('\n✗ RECORDING INCOMPLETE: at least one mutant was not caught — DO NOT publish this key'); process.exit(1); }
  console.log('all mutants caught — the key has teeth');
  process.exit(0);
}

// ============================================================================
// VERIFY MODE — the stranger flow
// ============================================================================
console.log('=== UTA runner test suite — the runner is the tested thing ===');
console.log(`runner: score-runner.mjs sha256 ${runnerSha.slice(0, 16)}… (${runnerSrc.length} bytes)\n`);

const key = JSON.parse(readFileSync(KEY_PATH, 'utf8'));

// 1. bytes oracle
check('runner bytes match the answer key (bytes oracle #1: sha256 pinned, key itself Rekor-anchored)',
  runnerSha === key.runner.sha256, key.runner.sha256);

// 2. validity window (fail closed)
check(`date within validity window (fail-closed: today ${today} ≤ ${key.valid_until})`,
  today <= key.valid_until,
  today > key.valid_until ? 'EXPIRED — re-issue vectors, re-record, re-anchor' : `earliest verdict flip: ${key.earliest_future_issued_at && key.earliest_future_issued_at < key.earliest_future_expiry ? `premature-atc becomes valid at ${key.earliest_future_issued_at}` : `earliest future vector expiry: ${key.earliest_future_expiry}`}`);

// 3. golden: matrix
console.log('--- golden: the runner reproduces the answer key ---');
check(`separation matrix header — v${key.matrix.header.version}, ${key.matrix.header.fixed} fixed vectors`,
  pristineMatrix.header.version === key.matrix.header.version && pristineMatrix.header.fixed === key.matrix.header.fixed,
  `v${pristineMatrix.header.version}, ${pristineMatrix.header.fixed}`);
check(`matrix has all ${key.matrix.rows.length} runner rows, in order`,
  pristineMatrix.rows.length === key.matrix.rows.length &&
  pristineMatrix.rows.every((r, i) => r.name === key.matrix.rows[i].name),
  pristineMatrix.rows.map((r) => r.name.split(' ')[0]).join(', '));
for (let i = 0; i < key.matrix.rows.length; i++) {
  const want = key.matrix.rows[i];
  const got = pristineMatrix.rows[i];
  const same = JSON.stringify(got) === JSON.stringify(want);
  check(`matrix row ${want.name} — ${want.ok}/${want.total}${want.failed.length ? ` ← fails ${want.failed.join(', ')}` : ''}`,
    same, same ? '' : `got ${got.ok}/${got.total}${got.failed.length ? ` ← fails ${got.failed.join(', ')}` : ''}`);
}

// 4. golden: reference mode
check(`reference mode verdict — ${key.reference.score}, ${key.reference.passed ? 'PASSED ✅' : 'FAILED ❌'}, exit ${key.reference.exit_code}`,
  pristineRef.score === key.reference.score && pristineRef.passed === key.reference.passed &&
  pristineRef.failed_listed === key.reference.failed_listed && refRun.status === key.reference.exit_code,
  `got ${pristineRef.score}, exit ${refRun.status}`);

// 5. teeth: mutation sweep
console.log('--- teeth: known-bad runner variants must be caught ---');
let caught = 0;
for (const def of mutantDefs) {
  const pinned = key.mutants[def.id];
  if (!pinned) { check(`mutant ${def.id}`, false, 'not present in answer key'); continue; }
  const obs = observeMutant(def);
  if (obs.error) { check(`mutant ${def.id} — ${def.bug}`, false, obs.error); continue; }
  const bytesOk = obs.sha256 === pinned.sha256;
  const caughtOk = obs.diverges === true && pinned.diverges === true;
  const ok = bytesOk && caughtOk;
  if (ok) caught++;
  check(`mutant ${def.id} CAUGHT — ${def.bug}`,
    ok,
    ok ? `diverges at ${obs.where.join(' + ')}, mutant sha256 matches the pinned digest` :
      `bytes=${bytesOk ? 'match' : 'DIFFER'} diverges=${obs.diverges} (key says ${pinned.diverges})`);
}
check(`all ${mutantDefs.length} mutants caught — the key has teeth`, caught === mutantDefs.length, `${caught}/${mutantDefs.length}`);

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail === 0 ? '\nRUNNER UNDER TEST: PASSED ✅ — the scorer is no longer a trusted component' : '\nRUNNER UNDER TEST: FAILED ❌');
process.exitCode = fail === 0 ? 0 : 1;
