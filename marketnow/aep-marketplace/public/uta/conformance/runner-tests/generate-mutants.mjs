#!/usr/bin/env node
// ============================================================================
// UTA conformance — GENERATED MUTATION SWEEP (v1.4.0)
// "Generating the mutants instead of listing them." (anp2network, round 3)
// ============================================================================
// The 10 mutants in mutants.json are a closed catalogue written after the
// defects were known — "10/10 caught" cannot estimate what fraction of the
// remaining failure space walks through. It is the argument that killed the
// memorizer, pointed at the test suite: memorizing wins whenever the set it
// has to cover is closed and small. This sweep replaces the estimate with a
// measurement:
//
//   1. A DECLARED set of syntax-level operators (OPERATORS below) is applied
//      at EVERY site where it applies in score-runner.mjs. A lexer excludes
//      comments, string literals, template-literal text and regex literals,
//      so operators only land on executable syntax.
//   2. Each generated mutant is a SINGLE-SITE edit: one operator, one site.
//      Syntax validity is fail-closed-checked (node --check); invalid edits
//      are counted, never silently dropped.
//   3. Each valid mutant is observed through the SAME oracle the answer key
//      pins: the --matrix table and the reference-mode verdict. Divergence
//      (any difference, including crashes) = CAUGHT. Identical output on
//      both surfaces = SURVIVOR.
//   4. Survivors are published in mutant-sweep.json with equivalent mutants
//      separated out and per-survivor justification. Survivor identities
//      carry more than a caught-count does: each one names a check the
//      suite does not enforce.
//
// Modes:
//   node generate-mutants.mjs          → run the sweep, write mutant-sweep.json
//   node generate-mutants.mjs --check  → re-run the sweep and verify the
//                                        published results reproduce exactly
//                                        (fail-closed; classifications are
//                                        editorial and not re-compared)
//
// Node ≥ 18, zero dependencies. Deterministic: the operator set and the site
// scan are pure functions of the target bytes, and the observation is
// deterministic within the suite's validity window.
// ============================================================================
import { readFileSync, writeFileSync, unlinkSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONF = join(__dirname, '..'); // <conformance>/ — layout: runner-tests/ beside score-runner.mjs and vectors/
const RUNNER = join(CONF, 'score-runner.mjs');
const VECTORS = join(CONF, 'vectors');
const TMP = join(CONF, 'score-runner.sweep-tmp.mjs');
const SWEEP_PATH = join(__dirname, 'mutant-sweep.json');
const KEY_PATH = join(__dirname, 'answer-key.json');

const sha256hex = (b) => createHash('sha256').update(b).digest('hex');
const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');

// ============================================================================
// LEXER — code ranges only (comments, strings, template text, regex excluded)
// ============================================================================
// Returns [start,end) character ranges that are executable code. Handles
// line/block comments, single/double-quoted strings, template literals with
// nested ${} expressions (including nested templates inside those), regex
// literals vs division (prev-significant-char heuristic with keyword lookback).
function codeRanges(src) {
  const ranges = [];
  let start = -1;
  const open = (end) => { if (start !== -1 && end > start) ranges.push([start, end]); start = -1; };
  const resume = (i) => { if (start === -1) start = i; };

  const REGEX_KEYWORDS = new Set(['return', 'typeof', 'case', 'delete', 'void', 'new', 'in', 'of', 'do', 'else', 'yield', 'await', 'instanceof']);
  const wordBefore = (pos) => { let j = pos - 1; while (j >= 0 && /[\w$]/.test(src[j])) j--; return src.slice(j + 1, pos); };

  const stack = [];
  let prevSig = '';
  let i = 0;
  const n = src.length;

  const regexAllowed = () => {
    if (prevSig === '') return true;
    if (/[\w$]/.test(prevSig)) return REGEX_KEYWORDS.has(wordBefore(i));
    if (/[)\]'"]/.test(prevSig)) return false; // expression closers → division context
    return true; // operators / punctuation / statement boundaries → regex context
  };

  while (i < n) {
    const c = src[i];
    const d = i + 1 < n ? src[i + 1] : '';
    const f = stack[stack.length - 1];
    const inCode = f === undefined || f.kind === 'tmplExpr';

    if (inCode) {
      if (c === '/' && d === '/') { open(i); stack.push({ kind: 'line' }); i += 2; continue; }
      if (c === '/' && d === '*') { open(i); stack.push({ kind: 'block' }); i += 2; continue; }
      if (c === "'" || c === '"') { open(i); stack.push({ kind: 'str', q: c }); i++; continue; }
      if (c === '`') { open(i); stack.push({ kind: 'tmpl' }); i++; continue; }
      if (c === '/' && regexAllowed()) { open(i); stack.push({ kind: 'regex' }); i++; continue; }
      if (f && f.kind === 'tmplExpr') {
        if (c === '{') { f.depth++; }
        else if (c === '}') {
          if (f.depth === 0) { open(i); stack.pop(); resume(i + 1); prevSig = 'a'; i++; continue; }
          f.depth--;
        }
      }
      if (!/\s/.test(c)) prevSig = c;
      resume(i);
      i++;
      continue;
    }
    if (f.kind === 'line') { if (c === '\n') { stack.pop(); resume(i); prevSig = ';'; } i++; continue; }
    if (f.kind === 'block') { if (c === '*' && d === '/') { stack.pop(); resume(i + 2); prevSig = ';'; i += 2; continue; } i++; continue; }
    if (f.kind === 'str') {
      if (c === '\\') { i += 2; continue; }
      if (c === f.q) { stack.pop(); resume(i + 1); prevSig = 'a'; i++; continue; }
      i++; continue;
    }
    if (f.kind === 'tmpl') {
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { stack.pop(); resume(i + 1); prevSig = 'a'; i++; continue; }
      if (c === '$' && d === '{') { stack.push({ kind: 'tmplExpr', depth: 0 }); resume(i + 2); prevSig = '('; i += 2; continue; }
      i++; continue;
    }
    if (f.kind === 'regex') {
      if (c === '\\') { i += 2; continue; }
      if (c === '[') { stack.push({ kind: 'regexClass' }); i++; continue; }
      if (c === '/') {
        i++;
        while (i < n && /[a-z]/.test(src[i])) i++;
        stack.pop(); resume(i); prevSig = 'a';
        continue;
      }
      i++; continue;
    }
    if (f.kind === 'regexClass') { if (c === '\\') { i += 2; continue; } if (c === ']') stack.pop(); i++; continue; }
    i++;
  }
  open(n);
  return ranges;
}

// ============================================================================
// DECLARED OPERATOR SET — syntax-level, applied at every applicable site
// ============================================================================
// Each scanner receives (src, ranges) and returns sites:
//   { start, end, replace, token, replacement } — a single-site edit.
const isWordBoundary = (src, pos) => pos < 0 || pos >= src.length || !/[\w$]/.test(src[pos]);

function scanLiteral(find, replace) {
  return (src, ranges) => {
    const sites = [];
    for (const [a, b] of ranges) {
      const seg = src.slice(a, b);
      let idx = seg.indexOf(find);
      while (idx !== -1) {
        sites.push({ start: a + idx, end: a + idx + find.length, replace, token: find, replacement: replace });
        idx = seg.indexOf(find, idx + find.length);
      }
    }
    return sites;
  };
}

function scanBareLt() { // '<' NOT part of '<=' (widening: < → <=)
  return (src, ranges) => {
    const sites = [];
    for (const [a, b] of ranges) {
      for (let p = a; p < b; p++) {
        if (src[p] === '<' && src[p + 1] !== '=' && src[p + 1] !== '<') {
          sites.push({ start: p, end: p + 1, replace: '<=', token: '<', replacement: '<=' });
        }
      }
    }
    return sites;
  };
}

function scanBareGt() { // '>' NOT part of '>=' or '=>' (widening: > → >=)
  return (src, ranges) => {
    const sites = [];
    for (const [a, b] of ranges) {
      for (let p = a; p < b; p++) {
        if (src[p] === '>' && src[p + 1] !== '=' && src[p + 1] !== '>' && src[p - 1] !== '=' && src[p - 1] !== '>') {
          sites.push({ start: p, end: p + 1, replace: '>=', token: '>', replacement: '>=' });
        }
      }
    }
    return sites;
  };
}

function scanNot() { // unary '!' (not '!' of '!=', '!==', or '!!')
  return (src, ranges) => {
    const sites = [];
    for (const [a, b] of ranges) {
      for (let p = a; p < b; p++) {
        if (src[p] === '!' && src[p + 1] !== '=' && src[p - 1] !== '!') {
          sites.push({ start: p, end: p + 1, replace: '', token: '!', replacement: '(removed)' });
        }
      }
    }
    return sites;
  };
}

function scanWord(word, replacement) {
  return (src, ranges) => {
    const sites = [];
    const re = new RegExp(`(?<![\\w$.])${word}(?![\\w$])`, 'g');
    for (const [a, b] of ranges) {
      const seg = src.slice(a, b);
      let m;
      re.lastIndex = 0;
      while ((m = re.exec(seg)) !== null) {
        sites.push({ start: a + m.index, end: a + m.index + word.length, replace: replacement, token: word, replacement });
      }
    }
    return sites;
  };
}

function scanIntBump() { // integer literal n → n+1 (skips hex/octal-ish and identifiers)
  return (src, ranges) => {
    const sites = [];
    const re = /(?<![\w$.])(\d+)(?![\w$.])/g;
    for (const [a, b] of ranges) {
      const seg = src.slice(a, b);
      let m;
      re.lastIndex = 0;
      while ((m = re.exec(seg)) !== null) {
        const bumped = String(parseInt(m[1], 10) + 1);
        sites.push({ start: a + m.index, end: a + m.index + m[1].length, replace: bumped, token: m[1], replacement: bumped });
      }
    }
    return sites;
  };
}

const OPERATORS = [
  { id: 'eq-flip', label: '=== → !==', description: 'flip strict equality to strict inequality', scan: scanLiteral('===', '!==') },
  { id: 'neq-flip', label: '!== → ===', description: 'flip strict inequality to strict equality', scan: scanLiteral('!==', '===') },
  { id: 'and-or', label: '&& → ||', description: 'replace logical AND with logical OR', scan: scanLiteral('&&', '||') },
  { id: 'or-and', label: '|| → &&', description: 'replace logical OR with logical AND', scan: scanLiteral('||', '&&') },
  { id: 'not-drop', label: 'unary ! removed', description: 'delete a unary negation', scan: scanNot() },
  { id: 'true-false', label: 'true → false', description: 'flip a boolean literal', scan: scanWord('true', 'false') },
  { id: 'false-true', label: 'false → true', description: 'flip a boolean literal', scan: scanWord('false', 'true') },
  { id: 'lt-widen', label: '< → <=', description: 'widen a strict less-than', scan: scanBareLt() },
  { id: 'gt-widen', label: '> → >=', description: 'widen a strict greater-than', scan: scanBareGt() },
  { id: 'le-narrow', label: '<= → <', description: 'narrow a less-than-or-equal', scan: scanLiteral('<=', '<') },
  { id: 'ge-narrow', label: '>= → >', description: 'narrow a greater-than-or-equal', scan: scanLiteral('>=', '>') },
  { id: 'int-bump', label: 'integer n → n+1', description: 'off-by-one an integer literal', scan: scanIntBump() },
];

// ============================================================================
// OBSERVATION — the same FIVE surfaces the answer key pins (v1.4.0: matrix,
// reference, adversarial challenge, malformed-card probe, poisoned-sidecar probe)
// ============================================================================
const GEN = join(VECTORS, 'generate-accept-vectors.mjs');
const ADV_SEED = 3, ADV_COUNT = 24;
const ADV_DIR = join(CONF, 'adv-challenge.sweep.tmp');
const MAL_DIR = join(CONF, 'failclosed-malformed.sweep.tmp');
const POI_DIR = join(CONF, 'failclosed-poisoned.sweep.tmp');
const runRunner = (file, args) =>
  spawnSync(process.execPath, [file, ...args], { encoding: 'utf8', cwd: CONF, timeout: 20000 });

// prepare the challenge + probe dirs ONCE per sweep (deterministic given the
// seed and today's scoring clock; mutants only read them)
if (!existsSync(GEN)) { console.error(`✗ generator not found at ${GEN}`); process.exit(2); }
for (const d of [ADV_DIR, MAL_DIR, POI_DIR]) { try { rmSync(d, { recursive: true, force: true }); } catch { /* ok */ } }
const prep = (mode, seed, dir) =>
  spawnSync(process.execPath, [GEN, '--mode', mode, '--count', mode === 'adversarial' ? String(ADV_COUNT) : '3', '--seed', String(seed), '--out', dir], { encoding: 'utf8', timeout: 60000 });
if (prep('adversarial', ADV_SEED, ADV_DIR).status !== 0) { console.error('✗ challenge preparation failed'); process.exit(2); }
if (prep('accept', 9, MAL_DIR).status !== 0) { console.error('✗ malformed-probe preparation failed'); process.exit(2); }
{
  const files = readdirSync(MAL_DIR).filter(f => f.endsWith('.json') && f !== '_generated-index.json').sort();
  const p = join(MAL_DIR, files[0]);
  const card = JSON.parse(readFileSync(p, 'utf8'));
  delete card.signature; // unscoreable: loadGenerated must refuse, not score
  writeFileSync(p, JSON.stringify(card, null, 2) + '\n');
}
if (prep('accept', 11, POI_DIR).status !== 0) { console.error('✗ poisoned-probe preparation failed'); process.exit(2); }
{
  const sp = join(POI_DIR, '_generated-index.json');
  const sidecar = JSON.parse(readFileSync(sp, 'utf8'));
  sidecar[0].expected_verify = !sidecar[0].expected_verify; // flip one — must FATAL
  writeFileSync(sp, JSON.stringify(sidecar, null, 2) + '\n');
}
const cleanupTmp = () => { for (const d of [ADV_DIR, MAL_DIR, POI_DIR]) { try { rmSync(d, { recursive: true, force: true }); } catch { /* ok */ } } };
process.on('exit', cleanupTmp);

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
  if (!header || rows.length === 0) return null;
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

const parseChallenge = (stdout) => {
  const m = stdout.match(/reference runner vs generated cards:\s*(\d+)\/(\d+)/);
  return {
    score: m ? `${m[1]}/${m[2]}` : null,
    passed: stdout.includes('UTA CONFORMANCE: PASSED ✅'),
  };
};
const parseFatal = (res) => ({
  exit: res.status,
  stderr_marker: /not a scoreable ATC card/.test(res.stderr || '') ? 'unscoreable' :
    /refusing to score|disagree/.test(res.stderr || '') ? 'sidecar-disagrees' :
    (res.stderr || '').split('\n').find(l => l.startsWith('FATAL'))?.slice(0, 60) ?? null,
});

// ============================================================================
// SWEEP
// ============================================================================
const runnerSrc = readFileSync(RUNNER, 'utf8');
const runnerSha = sha256hex(runnerSrc);
const ranges = codeRanges(runnerSrc);

const matrixRun = runRunner(RUNNER, ['--matrix', '--generated', ADV_DIR]);
const refRun = runRunner(RUNNER, []);
const advRun = runRunner(RUNNER, ['--generated', ADV_DIR]);
const malRun = runRunner(RUNNER, ['--generated', MAL_DIR]);
const poiRun = runRunner(RUNNER, ['--generated', POI_DIR]);
const pristineMatrix = matrixRun.status === 0 ? parseMatrix(matrixRun.stdout) : null;
const pristineRef = refRun.status === 0 ? parseReference(refRun.stdout) : null;
const pristineAdv = advRun.status === 0 ? parseChallenge(advRun.stdout) : null;
const pristineMal = parseFatal(malRun);
const pristinePoi = parseFatal(poiRun);
if (!pristineMatrix || !pristineRef || !pristineAdv) {
  console.error('✗ pristine score-runner.mjs failed to produce parseable output — refusing to sweep');
  process.exit(2);
}

// full five-surface observation of one runner variant (pristine or mutant);
// the matrix surface is scored over the fixed vectors AND the generated
// challenge (the table's "generated" column is part of the pinned oracle)
const observeAll = (file) => {
  const mRun = runRunner(file, ['--matrix', '--generated', ADV_DIR]);
  const rRun = runRunner(file, []);
  const aRun = runRunner(file, ['--generated', ADV_DIR]);
  const fA = runRunner(file, ['--generated', MAL_DIR]);
  const fB = runRunner(file, ['--generated', POI_DIR]);
  const where = [];
  const mMatrix = mRun.status === 0 ? parseMatrix(mRun.stdout) : null;
  if (mMatrix === null || JSON.stringify(mMatrix) !== JSON.stringify(pristineMatrix)) where.push('matrix');
  const mRef = rRun.status === 0 ? parseReference(rRun.stdout) : null;
  if (mRef === null || JSON.stringify(mRef) !== JSON.stringify(pristineRef) || rRun.status !== refRun.status) where.push('reference');
  const adv = aRun.status === 0 ? parseChallenge(aRun.stdout) : null;
  if (adv === null || JSON.stringify(adv) !== JSON.stringify(pristineAdv) || aRun.status !== advRun.status) where.push('adversarial');
  if (JSON.stringify(parseFatal(fA)) !== JSON.stringify(pristineMal)) where.push('failclosed-malformed');
  if (JSON.stringify(parseFatal(fB)) !== JSON.stringify(pristinePoi)) where.push('failclosed-poisoned');
  return { where, matrixExit: mRun.status };
};

const lineCol = (pos) => {
  let line = 1, ls = 0;
  for (let p = 0; p < pos; p++) {
    if (runnerSrc[p] === '\n') { line++; ls = p + 1; }
  }
  return { line, col: pos - ls + 1, lineText: runnerSrc.slice(ls, runnerSrc.indexOf('\n', ls) === -1 ? runnerSrc.length : runnerSrc.indexOf('\n', ls)) };
};

const results = { ops: [], mutants: [] };
let totalSites = 0, validMutants = 0, invalidSkipped = 0, caught = 0, survivors = 0;

for (const op of OPERATORS) {
  const sites = op.scan(runnerSrc, ranges);
  totalSites += sites.length;
  let opCaught = 0, opSurvivors = 0, opInvalid = 0, opValid = 0;
  for (const site of sites) {
    const patched = runnerSrc.slice(0, site.start) + site.replace + runnerSrc.slice(site.end);
    const mutantSha = sha256hex(patched);
    const { line, col, lineText } = lineCol(site.start);
    const id = `${op.id}@L${line}:c${col}`;
    const base = {
      id, op: op.id, line, col,
      original: runnerSrc.slice(Math.max(0, site.start - 30), site.end + 30).replace(/\n/g, '⏎'),
      token: site.token, replacement: site.replacement,
      context: lineText.trim().slice(0, 120),
    };
    // syntax fail-closed check
    writeFileSync(TMP, patched);
    const syn = spawnSync(process.execPath, ['--check', TMP], { encoding: 'utf8', timeout: 10000 });
    if (syn.status !== 0) {
      invalidSkipped++; opInvalid++;
      results.mutants.push({ ...base, status: 'invalid-syntax', note: 'operator application produced unparsable JavaScript — counted, not silently dropped' });
      continue;
    }
    opValid++; validMutants++;
    // observe: same five-surface oracle as the answer key
    const { where, matrixExit } = observeAll(TMP);
    if (matrixExit !== 0 && matrixExit !== null) where.push(`exit-${matrixExit}`);
    const isSurvivor = where.length === 0;
    if (isSurvivor) { survivors++; opSurvivors++; } else { caught++; opCaught++; }
    results.mutants.push({ ...base, status: isSurvivor ? 'SURVIVOR' : 'caught', diverges_at: where, sha256: mutantSha });
  }
  results.ops.push({ id: op.id, label: op.label, description: op.description, sites: sites.length, valid: opValid, caught: opCaught, survivors: opSurvivors, invalid_syntax: opInvalid });
  console.log(`  · ${op.id.padEnd(12)} sites ${String(sites.length).padStart(3)} | valid ${String(opValid).padStart(3)} | caught ${String(opCaught).padStart(3)} | survivors ${String(opSurvivors).padStart(3)} | invalid ${String(opInvalid).padStart(2)}`);
  try { unlinkSync(TMP); } catch { /* already gone */ }
}

// ============================================================================
// OUTPUT
// ============================================================================
const keySha = existsSync(KEY_PATH) ? sha256hex(readFileSync(KEY_PATH, 'utf8')) : null;
const sweep = {
  schema: 'uta-runner-mutation-sweep/1.0',
  as_of: new Date().toISOString().slice(0, 10),
  target: 'score-runner.mjs',
  target_sha256: runnerSha,
  target_bytes: Buffer.byteLength(runnerSrc, 'utf8'),
  oracle: {
    answer_key_sha256: keySha,
    surfaces: ['--matrix separation table (8 rows, failure lists included)', 'reference-mode verdict + exit code', 'adversarial challenge (seeded two-bound distribution via --generated)', 'fail-closed probe: malformed card (exit 1 + marker)', 'fail-closed probe: poisoned sidecar (exit 1 + marker)'],
    note: 'The kill oracle is exactly the behavior the answer key pins — five surfaces, no more, no less. A mutant the suite cannot distinguish from pristine on ANY surface is a survivor by definition of the published oracle. Survivors name checks the suite does not enforce.',
  },
  operators: results.ops.map(({ id, label, description, sites, valid, caught: c, survivors: s, invalid_syntax }) =>
    ({ id, label, description, sites, valid, caught: c, survivors: s, invalid_syntax })),
  totals: {
    operators: OPERATORS.length,
    sites: totalSites,
    valid_mutants: validMutants,
    caught,
    survivors,
    invalid_syntax: invalidSkipped,
    survivor_rate: validMutants ? Number((survivors / validMutants * 100).toFixed(1)) : null,
  },
  mutants: results.mutants,
  survivors: results.mutants.filter(m => m.status === 'SURVIVOR').map(m => ({
    id: m.id, op: m.op, line: m.line, col: m.col,
    original: m.original, context: m.context,
    classification: null, // filled in editorial pass: 'equivalent' | 'real' — see note
    justification: null,  // why the suite cannot (or need not) distinguish this mutant
  })),
  reproducibility: {
    regenerate: 'node generate-mutants.mjs --check',
    deterministic: true,
    note: 'Operator set + site scan are pure functions of the target bytes; observation re-runs the same two surfaces the answer key pins. Classifications and justifications are editorial and pinned here, not re-derived by --check.',
  },
  note: 'Generated mutation sweep (anp2network round 3, comment 3ehcp): a declared set of syntax-level operators applied at every applicable site in score-runner.mjs, each mutant observed through the answer-key oracle. Survivors are the point: each one names a check the suite does not enforce. Equivalents are separated from real blind spots by the per-survivor classification.',
};

if (!CHECK) {
  writeFileSync(SWEEP_PATH, JSON.stringify(sweep, null, 1) + '\n');
  console.log(`\nsweep written: ${SWEEP_PATH}`);
  console.log(`target sha256 ${runnerSha.slice(0, 16)}… | ${validMutants} valid mutants | caught ${caught} | SURVIVORS ${survivors} | invalid ${invalidSkipped}`);
  if (survivors > 0) console.log(`⚠ ${survivors} survivors — classify them (equivalent vs real) in mutant-sweep.json before publishing`);
  process.exit(0);
}

// --check: the published results must reproduce exactly
if (!existsSync(SWEEP_PATH)) { console.error('✗ mutant-sweep.json not found — run without --check first'); process.exit(2); }
const published = JSON.parse(readFileSync(SWEEP_PATH, 'utf8'));
let mismatch = 0;
const cmp = (name, a, b) => { if (a !== b) { console.error(`✗ ${name}: published ${b} vs re-run ${a}`); mismatch++; } };
cmp('target_sha256', runnerSha, published.target_sha256);
cmp('totals.sites', totalSites, published.totals.sites);
cmp('totals.valid_mutants', validMutants, published.totals.valid_mutants);
cmp('totals.caught', caught, published.totals.caught);
cmp('totals.survivors', survivors, published.totals.survivors);
cmp('totals.invalid_syntax', invalidSkipped, published.totals.invalid_syntax);
const pubIds = new Map(published.mutants.map(m => [m.id, m]));
const rerunIds = new Map(results.mutants.map(m => [m.id, m]));
if (pubIds.size !== rerunIds.size) { console.error(`✗ mutant count mismatch: published ${pubIds.size} vs re-run ${rerunIds.size}`); mismatch++; }
for (const [id, m] of rerunIds) {
  const p = pubIds.get(id);
  if (!p) { console.error(`✗ mutant ${id} missing from published sweep`); mismatch++; continue; }
  if (p.status !== m.status) { console.error(`✗ mutant ${id}: published ${p.status} vs re-run ${m.status}`); mismatch++; }
}
const unclassified = published.survivors.filter(s => !s.classification);
if (unclassified.length) { console.error(`✗ ${unclassified.length} survivors lack classification — editorial pass incomplete`); mismatch++; }
console.log(mismatch === 0
  ? `\nSWEEP REPRODUCES ✅ — ${validMutants} mutants, ${caught} caught, ${survivors} survivors (${unclassified.length === 0 ? 'all classified' : '??'})`
  : `\nSWEEP DIVERGES ❌ — ${mismatch} mismatches vs published mutant-sweep.json`);
process.exit(mismatch === 0 ? 0 : 1);
