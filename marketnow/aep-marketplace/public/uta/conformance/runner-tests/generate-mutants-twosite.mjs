#!/usr/bin/env node
// ============================================================================
// UTA conformance — TWO-SITE COORDINATED MUTATION SWEEP (v1.5.0)
// "A cheap probe: add a small family of coordinated two-site mutations
//  around one shared invariant, score them in a separate column, and leave
//  the existing number untouched so it stays comparable across releases."
//  — anp2network, round 4 (dev.to comment 3ehp6)
// ============================================================================
// The single-site sweep (generate-mutants.mjs) applies one operator at one
// site. It "cannot express a fault that lives across two sites": a runner
// whose window check AND whose expectation oracle are corrupted COHERENTLY
// can pass every single-site probe, because the answer key moves with the
// fault. This sweep generates those coordinated pairs:
//
//   1. INVARIANT FAMILIES are DECLARED below (like the operator set): the
//      two-sided window, the pinned-anchor set, the signature verification,
//      the fail-closed exits. A site belongs to a family when its containing
//      line carries the family's marker token — mechanical, a pure function
//      of the target bytes.
//   2. A TWO-SITE MUTANT is an unordered pair of sites from the SAME family
//      AND the SAME operator, both edits applied together. The classic case:
//      the window comparison in the reference runner AND the same comparison
//      in the derived-truth oracle (loadGenerated) — runner and answer key
//      corrupted in one stroke.
//   3. Each pair is observed through the same five-surface oracle as the
//      single-site sweep. Divergence = CAUGHT; identical output = SURVIVOR.
//   4. Results go to mutant-sweep-twosite.json — a SEPARATE column. The
//      single-site number (92/113 on v1.4.0 bytes) is untouched and stays
//      comparable across releases.
//
// Modes:
//   node generate-mutants-twosite.mjs          → run, write mutant-sweep-twosite.json
//   node generate-mutants-twosite.mjs --check  → re-run, verify published results reproduce
//
// Node ≥ 18, zero dependencies. Same-day determinism as the single-site
// sweep (the adversarial challenge is clock-relative; score within the UTC day).
// ============================================================================
import { readFileSync, writeFileSync, unlinkSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONF = join(__dirname, '..'); // <conformance>/
const RUNNER = join(CONF, 'score-runner.mjs');
const VECTORS = join(CONF, 'vectors');
const TMP = join(CONF, 'score-runner.twosite-tmp.mjs');
const SWEEP_PATH = join(__dirname, 'mutant-sweep-twosite.json');
const KEY_PATH = join(__dirname, 'answer-key.json');

const sha256hex = (b) => createHash('sha256').update(b).digest('hex');
const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');

// ============================================================================
// LEXER — code ranges only (identical to generate-mutants.mjs; copied to
// keep the published single-site script byte-stable)
// ============================================================================
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
    if (/[)\]'"]/.test(prevSig)) return false;
    return true;
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
// OPERATOR SCANNERS — identical to the single-site sweep (same ids, so a
// two-site pair is always "the same fault, twice, coherently")
// ============================================================================
const scanLiteral = (find, replace) => (src, ranges) => {
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
const scanBareGt = () => (src, ranges) => {
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
const scanBareLt = () => (src, ranges) => {
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

const OPERATORS = [
  { id: 'and-or', label: '&& → || (two sites)', scan: scanLiteral('&&', '||') },
  { id: 'or-and', label: '|| → && (two sites)', scan: scanLiteral('||', '&&') },
  { id: 'eq-flip', label: '=== → !== (two sites)', scan: scanLiteral('===', '!==') },
  { id: 'le-narrow', label: '<= → < (two sites)', scan: scanLiteral('<=', '<') },
  { id: 'lt-widen', label: '< → <= (two sites)', scan: scanBareLt() },
  { id: 'gt-widen', label: '> → >= (two sites)', scan: scanBareGt() },
];

// ============================================================================
// DECLARED INVARIANT FAMILIES — the shared invariants coordinated faults
// corrupt. Membership: the site's containing LINE carries the marker.
// (Mechanical: pure function of the target bytes + this declared table.)
// ============================================================================
const FAMILIES = [
  { id: 'window',       label: 'two-sided validity window', markers: ['expires_at', 'issued_at', 'inWindow'] },
  { id: 'anchor',       label: 'pinned trust-anchor set',   markers: ['anchors'] },
  { id: 'signature',    label: 'Ed25519 signature verify',  markers: ['cryptoVerify'] },
  { id: 'fail-closed',  label: 'fail-closed aborts',        markers: ['FATAL'] },
];

const lineOf = (src, pos) => { let l = 1; for (let p = 0; p < pos; p++) if (src[p] === '\n') l++; return l; };
const lineStart = (src, pos) => { let p = pos; while (p > 0 && src[p - 1] !== '\n') p--; return p; };
const lineText = (src, pos) => { const s = lineStart(src, pos); const e = src.indexOf('\n', s); return src.slice(s, e === -1 ? src.length : e); };
const colOf = (src, pos) => pos - lineStart(src, pos) + 1;

// ============================================================================
// OBSERVATION — same five surfaces, same code as the single-site sweep
// ============================================================================
const GEN = join(VECTORS, 'generate-accept-vectors.mjs');
const ADV_SEED = 3, ADV_COUNT = 24;
const ADV_DIR = join(CONF, 'adv-challenge.twosite.tmp');
const MAL_DIR = join(CONF, 'failclosed-malformed.twosite.tmp');
const POI_DIR = join(CONF, 'failclosed-poisoned.twosite.tmp');
const runRunner = (file, args) =>
  spawnSync(process.execPath, [file, ...args], { encoding: 'utf8', cwd: CONF, timeout: 20000 });

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
  delete card.signature;
  writeFileSync(p, JSON.stringify(card, null, 2) + '\n');
}
if (prep('accept', 11, POI_DIR).status !== 0) { console.error('✗ poisoned-probe preparation failed'); process.exit(2); }
{
  const sp = join(POI_DIR, '_generated-index.json');
  const sidecar = JSON.parse(readFileSync(sp, 'utf8'));
  sidecar[0].expected_verify = !sidecar[0].expected_verify;
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
      rows.push({ name: r[1], ok: parseInt(r[2], 10), total: parseInt(r[3], 10), failed: r[4] ? r[4].split(', ').map((s) => s.replace(/…$/, '')) : [], generated: r[5] });
    }
  }
  if (!header || rows.length === 0) return null;
  return { header, rows };
};
const parseReference = (stdout) => {
  const m = stdout.match(/reference runner vs fixed vectors:\s*(\d+)\/(\d+)/);
  return { score: m ? `${m[1]}/${m[2]}` : null, passed: stdout.includes('UTA CONFORMANCE: PASSED ✅'), failed_listed: /failures:/.test(stdout) };
};
const parseChallenge = (stdout) => {
  const m = stdout.match(/reference runner vs generated cards:\s*(\d+)\/(\d+)/);
  return { score: m ? `${m[1]}/${m[2]}` : null, passed: stdout.includes('UTA CONFORMANCE: PASSED ✅') };
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

// classify sites into declared families
const siteFamily = (pos) => {
  const lt = lineText(runnerSrc, pos);
  for (const fam of FAMILIES) if (fam.markers.some(m => lt.includes(m))) return fam.id;
  return null;
};

// build all two-site pairs: same operator, same declared family
const pairs = [];
const familyStats = {};
for (const op of OPERATORS) {
  const sites = op.scan(runnerSrc, ranges).map(s => ({ ...s, line: lineOf(runnerSrc, s.start), col: colOf(runnerSrc, s.start) }));
  for (const fam of FAMILIES) {
    const inFam = sites.filter(s => siteFamily(s.start) === fam.id);
    familyStats[fam.id] = familyStats[fam.id] || {};
    familyStats[fam.id][op.id] = inFam.length;
    for (let i = 0; i < inFam.length; i++) {
      for (let j = i + 1; j < inFam.length; j++) {
        pairs.push({ op: op.id, fam: fam.id, a: inFam[i], b: inFam[j] });
      }
    }
  }
}

console.log(`two-site candidates: ${pairs.length} coordinated pairs\n`);
const results = [];
let caught = 0, survivors = 0, invalid = 0;

for (const p of pairs) {
  // apply BOTH edits (a then b — offsets are absolute; apply later-position
  // edit first so the earlier offset stays valid)
  const [first, second] = p.a.start <= p.b.start ? [p.a, p.b] : [p.b, p.a];
  const patched = runnerSrc.slice(0, first.start) + first.replace + runnerSrc.slice(first.end, second.start) + second.replace + runnerSrc.slice(second.end);
  const id = `${p.op}#${p.fam}@L${p.a.line}:c${p.a.col}+L${p.b.line}:c${p.b.col}`;
  const mutantSha = sha256hex(patched);
  const base = {
    id,
    op: p.op,
    family: p.fam,
    site_a: { line: p.a.line, col: p.a.col, token: p.a.token, replacement: p.a.replacement, context: lineText(runnerSrc, p.a.start).trim().slice(0, 110) },
    site_b: { line: p.b.line, col: p.b.col, token: p.b.token, replacement: p.b.replacement, context: lineText(runnerSrc, p.b.start).trim().slice(0, 110) },
  };
  writeFileSync(TMP, patched);
  const syn = spawnSync(process.execPath, ['--check', TMP], { encoding: 'utf8', timeout: 10000 });
  if (syn.status !== 0) {
    invalid++;
    results.push({ ...base, status: 'invalid-syntax', note: 'coordinated application produced unparsable JavaScript — counted, not silently dropped' });
    continue;
  }
  const { where, matrixExit } = observeAll(TMP);
  if (matrixExit !== 0 && matrixExit !== null) where.push(`exit-${matrixExit}`);
  const isSurvivor = where.length === 0;
  if (isSurvivor) survivors++; else caught++;
  results.push({ ...base, status: isSurvivor ? 'SURVIVOR' : 'caught', diverges_at: where, sha256: mutantSha });
  console.log(`  · ${id.padEnd(42)} ${isSurvivor ? 'SURVIVOR' : `caught (${where.join(', ')})`}`);
  try { unlinkSync(TMP); } catch { /* already gone */ }
}

// ============================================================================
// OUTPUT
// ============================================================================
const keySha = existsSync(KEY_PATH) ? sha256hex(readFileSync(KEY_PATH, 'utf8')) : null;
const sweep = {
  schema: 'uta-runner-twosite-mutation-sweep/1.0',
  as_of: new Date().toISOString().slice(0, 10),
  target: 'score-runner.mjs',
  target_sha256: runnerSha,
  oracle: {
    answer_key_sha256: keySha,
    surfaces: ['--matrix separation table (8 rows, failure lists included)', 'reference-mode verdict + exit code', 'adversarial challenge (seeded two-bound distribution via --generated)', 'fail-closed probe: malformed card (exit 1 + marker)', 'fail-closed probe: poisoned sidecar (exit 1 + marker)'],
    note: 'Same oracle as the single-site sweep. A coordinated pair the suite cannot distinguish from pristine on ANY surface is a survivor — it names a fault that lives across two sites, exactly the class the single-site sweep cannot express.',
  },
  declared_families: FAMILIES.map(f => ({ id: f.id, label: f.label, membership_markers: f.markers })),
  family_site_counts: familyStats,
  operators: OPERATORS.map(o => o.id),
  pairing_rule: 'unordered pairs of sites from the SAME operator AND the SAME declared invariant family (both edits applied together)',
  totals: {
    pairs: pairs.length,
    valid: results.filter(r => r.status !== 'invalid-syntax').length,
    caught,
    survivors,
    invalid_syntax: invalid,
  },
  pairs: results,
  survivors_detail: results.filter(r => r.status === 'SURVIVOR').map(r => ({
    id: r.id, op: r.op, family: r.family, site_a: r.site_a, site_b: r.site_b,
    classification: null, // editorial pass: 'equivalent' | 'coherent-blind-spot' | 'real'
    justification: null,
  })),
  relationship_to_single_site: 'SEPARATE column by design (anp2network round 4, 3ehp6): the single-site number in mutant-sweep.json is untouched and stays comparable across releases. Two-site results speak only to coordinated faults; they are not comparable to single-site counts and are not summed with them.',
  reproducibility: { regenerate: 'node generate-mutants-twosite.mjs --check', deterministic: true },
  note: 'Generated two-site coordinated mutation sweep: pairs of same-operator edits inside one declared invariant family (window / anchor / signature / fail-closed), applied together and observed through the answer-key oracle. The interesting survivor is a coherent corruption of a check in BOTH the runner and the derived-truth oracle — the fault class where the answer key moves with the fault.',
};

if (!CHECK) {
  writeFileSync(SWEEP_PATH, JSON.stringify(sweep, null, 1) + '\n');
  console.log(`\ntwo-site sweep written: ${SWEEP_PATH}`);
  console.log(`target ${runnerSha.slice(0, 16)}… | ${pairs.length} pairs | caught ${caught} | SURVIVORS ${survivors} | invalid ${invalid}`);
  if (survivors > 0) console.log(`⚠ ${survivors} survivors — classify them (equivalent / coherent-blind-spot / real) before publishing`);
  process.exit(0);
}

if (!existsSync(SWEEP_PATH)) { console.error('✗ mutant-sweep-twosite.json not found — run without --check first'); process.exit(2); }
const published = JSON.parse(readFileSync(SWEEP_PATH, 'utf8'));
let mismatch = 0;
const cmp = (name, a, b) => { if (a !== b) { console.error(`✗ ${name}: published ${b} vs re-run ${a}`); mismatch++; } };
cmp('target_sha256', runnerSha, published.target_sha256);
cmp('totals.pairs', pairs.length, published.totals.pairs);
cmp('totals.caught', caught, published.totals.caught);
cmp('totals.survivors', survivors, published.totals.survivors);
cmp('totals.invalid_syntax', invalid, published.totals.invalid_syntax);
const pubIds = new Map(published.pairs.map(m => [m.id, m]));
if (pubIds.size !== results.length) { console.error(`✗ pair count mismatch: published ${pubIds.size} vs re-run ${results.length}`); mismatch++; }
for (const r of results) {
  const pub = pubIds.get(r.id);
  if (!pub) { console.error(`✗ pair ${r.id} missing from published sweep`); mismatch++; continue; }
  if (pub.status !== r.status) { console.error(`✗ pair ${r.id}: published ${pub.status} vs re-run ${r.status}`); mismatch++; }
}
const unclassified = published.survivors_detail.filter(s => !s.classification);
if (unclassified.length) { console.error(`✗ ${unclassified.length} two-site survivors lack classification`); mismatch++; }
console.log(mismatch === 0
  ? `\nTWO-SITE SWEEP REPRODUCES ✅ — ${pairs.length} pairs, ${caught} caught, ${survivors} survivors (${unclassified.length === 0 ? 'all classified' : '??'})`
  : `\nTWO-SITE SWEEP DIVERGES ❌ — ${mismatch} mismatches`);
process.exit(mismatch === 0 ? 0 : 1);
