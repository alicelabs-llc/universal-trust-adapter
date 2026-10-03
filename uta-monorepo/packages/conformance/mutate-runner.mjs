#!/usr/bin/env node
// ============================================================================
// UTA conformance — MUTATION RUNNER (v1.7.0)
// ============================================================================
// v1.7.0 answers anp2network's critique (dev.to comment 3ehcp, 2026-09-10):
// a hand-listed mutant catalogue is a closed set — "memorizing wins whenever
// the set it has to cover is closed and small", which was our own argument
// against the memorizer, pointed at the test suite. This tool replaces the
// catalogue with GENERATION: a declared set of syntax-level operators applied
// mechanically at every applicable site in score-runner.mjs, one mutant per
// site, every mutant actually executed against the full suite.
//
// DECLARED OPERATOR SET (exhaustive — no hand-picking):
//   cmp-swap       every comparison operator on the scored path:
//                  <= ↔ >=, < ↔ >, === ↔ !==
//   guard-drop     every single-line `if (cond) return x;` guard, deleted
//   branch-negate  every block `if (cond) {` condition on the scored path,
//                  wrapped in logical negation
//   clock+1d       NOW advanced one day
//   clock-1d       NOW retarded one day
//
// SCOPE: the scored path — everything in score-runner.mjs EXCEPT the cheat
// simulators (alwaysTrue/policyOnly/... they are diagnostic fixtures, not the
// runner under test) and the --matrix diagnostics output block. The scanned
// line ranges are printed in the report so the scope is verifiable.
//
// CLASSIFICATION (mechanical, no judgment calls):
//   caught        the suite FAILS under the mutant (exit != 0) — the suite
//                 enforces the mutated check
//   equivalent    exit == 0 and byte-identical --json output vs the reference
//                 run — no observable behavior change ON THIS SUITE. Suite-
//                 equivalence, not true equivalence, is the honest claim.
//   observable    exit == 0 but the --json output DIFFERS from the reference
//                 run — the mutant changed observable behavior and the suite
//                 still passed. Each one names a check the suite doesn't
//                 enforce (or an interface contract nobody checks).
//
// Usage:
//   node mutate-runner.mjs                                  # fixed vectors only
//   node mutate-runner.mjs --generated /path/to/adv-set     # + adversarial cards
//   node mutate-runner.mjs --out mutation-survivors.json    # persist report
//   node mutate-runner.mjs --strict                         # exit 1 on any
//                                                            observable survivor
//
// The survivor list is the PUBLISHED claim: each survivor names a check the
// suite doesn't enforce. A caught-count is not a claim.
// Node ≥ 18, zero deps. Mutants run from this directory (same __dirname as
// score-runner.mjs so relative vector paths resolve).
// ============================================================================

import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNNER = join(__dirname, 'score-runner.mjs');
const MUTANT = join(__dirname, 'mutant-tmp-under-test.mjs');

// --- args ---
const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const genDir = getArg('generated', null);
const outFile = getArg('out', null);
const strict = args.includes('--strict');

// --- load the runner source and compute the scored-path scope ---
const src = readFileSync(RUNNER, 'utf8');
const lines = src.split('\n');

// Exclusion 1: the cheat simulators block — from the `// CHEAT RUNNERS` banner
// to the banner that starts the SCORING section.
// Exclusion 2: the --matrix diagnostics block — from its banner comment to EOF.
let cheatStart = -1, cheatEnd = -1, matrixStart = -1;
lines.forEach((l, i) => {
  if (/^\/\/ CHEAT RUNNERS/.test(l) && cheatStart === -1) cheatStart = i;
  if (/^\/\/ SCORING/.test(l) && cheatStart !== -1 && cheatEnd === -1) cheatEnd = i;
  if (/^\/\/ --matrix:/.test(l) && matrixStart === -1) matrixStart = i;
});
if (cheatStart === -1 || cheatEnd === -1 || matrixStart === -1) {
  console.error('FATAL: could not locate section banners in score-runner.mjs (CHEAT RUNNERS / SCORING / --matrix) — the source layout changed; update mutate-runner.mjs anchors');
  process.exit(1);
}
const excluded = (i) => (i >= cheatStart && i < cheatEnd) || i >= matrixStart;
const isCode = (l) => l.trim() !== '' && !/^\s*\/\//.test(l);

// --- declared operators: enumerate every applicable site ---
const mutants = [];
const CMP = /(?<![=!<>])(===|!==|<=|>=|<|>)(?!=)/g;
const SWAP = { '===': '!==', '!==': '===', '<=': '>=', '>=': '<=', '<': '>', '>': '<' };

lines.forEach((line, i) => {
  if (excluded(i) || !isCode(line)) return;
  // cmp-swap: every comparison operator on the line (one mutant per site)
  for (const m of line.matchAll(CMP)) {
    if (m[0] === '<' && line.includes('=>')) { /* arrows handled by lookbehind */ }
    mutants.push({
      id: `cmp-swap:L${i + 1}:${m.index}`,
      op: 'cmp-swap',
      line_no: i + 1,
      line: line.trim(),
      mutate: (ls) => {
        const l = ls[i];
        ls[i] = l.slice(0, m.index) + SWAP[m[0]] + l.slice(m.index + m[0].length);
      },
    });
  }
  // guard-drop: single-line `if (cond) return ...;`
  if (/^\s*if \(.+\) return .+;\s*$/.test(line)) {
    mutants.push({
      id: `guard-drop:L${i + 1}`,
      op: 'guard-drop',
      line_no: i + 1,
      line: line.trim(),
      mutate: (ls) => { ls[i] = ''; },
    });
  }
  // branch-negate: `if (cond) {` block headers (skip one-line FATAL guards —
  // cmp-swap already mutates their comparisons)
  const bm = line.match(/^(\s*)if \((.+)\) \{\s*$/);
  if (bm && !/console\.error/.test(line)) {
    mutants.push({
      id: `branch-negate:L${i + 1}`,
      op: 'branch-negate',
      line_no: i + 1,
      line: line.trim(),
      mutate: (ls) => { ls[i] = `${bm[1]}if (!(${bm[2]})) {`; },
    });
  }
});

// clock ±1d: the NOW line (two fixed mutants)
const clockLine = lines.findIndex((l) => /^const NOW = new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/.test(l));
if (clockLine === -1) {
  console.error('FATAL: could not locate the NOW line in score-runner.mjs');
  process.exit(1);
}
for (const [name, delta] of [['clock+1d', '+'], ['clock-1d', '-']]) {
  mutants.push({
    id: `${name}:L${clockLine + 1}`,
    op: name,
    line_no: clockLine + 1,
    line: lines[clockLine].trim(),
    mutate: (ls) => { ls[clockLine] = `const NOW = new Date(Date.now() ${delta} 86400000).toISOString().slice(0, 10) + 'T00:00:00Z';`; },
  });
}

// --- run a copy of the runner (mutated or not) and capture (exit, stdout) ---
const runSuite = (file) => {
  try {
    const stdout = execFileSync('node', [file, '--json', ...(genDir ? ['--generated', genDir] : [])], {
      cwd: __dirname, timeout: 20000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { exit: 0, stdout };
  } catch (e) {
    return { exit: e.status ?? (e.signal ? 124 : 1), stdout: typeof e.stdout === 'string' ? e.stdout : '' };
  }
};

// --- reference run ---
const ref = runSuite(RUNNER);
if (ref.exit !== 0) {
  console.error('FATAL: the UNMUTATED score-runner.mjs does not pass — fix the suite before mutation testing');
  process.exit(1);
}

// --- run every mutant ---
const report = {
  tool: 'mutate-runner.mjs',
  suite_version: 'v1.7.0',
  generated: genDir,
  operators: {
    'cmp-swap': 'every comparison operator on the scored path: <= ↔ >=, < ↔ >, === ↔ !==',
    'guard-drop': 'every single-line `if (cond) return x;` guard, deleted',
    'branch-negate': 'every block `if (cond) {` condition, logically negated',
    'clock+1d': 'NOW advanced one day',
    'clock-1d': 'NOW retarded one day',
  },
  scope: {
    runner: 'score-runner.mjs',
    scored_path: `lines 1-${cheatStart} and ${cheatEnd + 1}-${matrixStart} of the scored path`,
    excluded: 'cheat simulators (diagnostic fixtures, not the runner under test) and the --matrix diagnostics block',
  },
  totals: { mutants: mutants.length, caught: 0, equivalent: 0, observable: 0 },
  survivors: [],
};

process.stderr.write(`running ${mutants.length} mutants (generated dir: ${genDir ?? 'none'})...\n`);
for (const mu of mutants) {
  const ls = [...lines];
  mu.mutate(ls);
  writeFileSync(MUTANT, ls.join('\n'));
  let res;
  try {
    res = runSuite(MUTANT);
  } finally {
    if (existsSync(MUTANT)) unlinkSync(MUTANT);
  }
  // interface contract: --json must produce parseable JSON; a mutant that
  // breaks the output format is caught-by-tooling (labelled honestly)
  let classification;
  let parsed = null;
  try { parsed = JSON.parse(res.stdout); } catch { /* not JSON */ }
  if (res.exit !== 0) classification = 'caught';
  else if (!parsed) classification = 'caught (interface broken: --json output unparseable)';
  else if (res.stdout === ref.stdout) classification = 'equivalent';
  else classification = 'observable';

  if (classification === 'caught') report.totals.caught++;
  else if (classification.startsWith('caught')) report.totals.caught++;
  else if (classification === 'equivalent') report.totals.equivalent++;
  else report.totals.observable++;

  if (classification !== 'caught' && classification !== 'equivalent') {
    report.survivors.push({ id: mu.id, op: mu.op, line_no: mu.line_no, line: mu.line, classification });
  } else if (classification === 'equivalent') {
    report.survivors.push({ id: mu.id, op: mu.op, line_no: mu.line_no, line: mu.line, classification });
  }
}

// --- human report (stderr) ---
const E = report.totals.equivalent, O = report.totals.observable;
process.stderr.write(`\nmutants: ${report.totals.mutants} | caught: ${report.totals.caught} | survivors: ${E + O} (equivalent-on-suite: ${E}, observable-escape: ${O})\n`);
if (O > 0) {
  process.stderr.write('\nOBSERVABLE SURVIVORS — each names a check the suite does not enforce:\n');
  for (const s of report.survivors.filter((s) => s.classification === 'observable')) {
    process.stderr.write(`  [${s.id}] ${s.line}\n`);
  }
}
if (E > 0) {
  process.stderr.write('\nEQUIVALENT-ON-SUITE SURVIVORS — no observable change on this suite (suite-equivalence, not true equivalence):\n');
  for (const s of report.survivors.filter((s) => s.classification === 'equivalent')) {
    process.stderr.write(`  [${s.id}] ${s.line}\n`);
  }
}

if (outFile) {
  writeFileSync(outFile, JSON.stringify(report, null, 2) + '\n');
  process.stderr.write(`\nsurvivor list written to ${outFile}\n`);
}

if (strict && O > 0) {
  process.stderr.write('\n--strict: exiting 1 (observable survivors present)\n');
  process.exit(1);
}
process.exit(0);
