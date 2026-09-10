#!/usr/bin/env node
// ============================================================================
// @marketnow/sentinel-rules — zero-dep MCP security scanner (lite mode)
// ============================================================================
// Scans source files for the 29 MarketNow MCP security rules:
// prompt injection in tool descriptions, tool poisoning, exfiltration,
// attack chains, command injection, stale-trust caching...
//
// Lite mode needs NO semgrep install (regex engine). For full AST matching
// (the 7 structural rules) run semgrep with rules/semgrep-mcp-rules.yml.
//
// Usage:
//   npx @marketnow/sentinel-rules --path <file|dir>   scan (default: .)
//   npx @marketnow/sentinel-rules --list              list the 29 rules
//   npx @marketnow/sentinel-rules --json              JSON output
//   npx @marketnow/sentinel-rules --soft              always exit 0
//   npx @marketnow/sentinel-rules --rules <file.json> custom lite rules
//
// Exit codes: 0 clean | 1 findings | 2 usage error
// Node >= 18, zero dependencies.
// ============================================================================
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, statSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEV_ORDER = { ERROR: 3, WARNING: 2, INFO: 1 };
const SCANNABLE = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.py', '.json']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.venv', '__pycache__', '.cache']);
// --no-skip: scan shipped artifacts too (dist/, build/) — required when the
// scan target is an extracted REGISTRY TARBALL (npm/PyPI), where dist/ IS the
// code that runs on the user's machine. Default skip stays for source-repo scanning.
let SCAN_ARTIFACTS = false;

function usage() {
  console.log(`Usage: sentinel-scan [options]

  --path <file|dir>   target to scan (default: current directory)
  --list              list all rules and exit
  --json              emit findings as JSON
  --no-skip           scan dist/ and build/ too (registry-tarball mode)
  --rules <file>      custom rules file (lite JSON format)
  --soft              exit 0 even with findings
  --semgrep           print the semgrep command for full AST matching
  --help              this help`);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') out.list = true;
    else if (a === '--json') out.json = true;
    else if (a === '--no-skip') SCAN_ARTIFACTS = true;
    else if (a === '--soft') out.soft = true;
    else if (a === '--semgrep') out.semgrep = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--path') out.path = argv[++i];
    else if (a === '--rules') out.rules = argv[++i];
    else { console.error(`unknown option: ${a}`); process.exit(2); }
  }
  return out;
}

function loadRules(customPath) {
  const p = customPath || join(__dirname, '..', 'rules', 'rules-lite.json');
  if (!existsSync(p)) { console.error(`rules file not found: ${p}`); process.exit(2); }
  const doc = JSON.parse(readFileSync(p, 'utf8'));
  return doc.rules || doc;
}

function walk(target, acc = []) {
  const st = statSync(target);
  if (st.isFile()) { acc.push(target); return acc; }
  for (const name of readdirSync(target)) {
    if (SKIP_DIRS.has(name) && !SCAN_ARTIFACTS) continue;
    const full = join(target, name);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, acc);
    else if (SCANNABLE.has(extOf(name)) && s.size < 5 * 1024 * 1024) acc.push(full);
  }
  return acc;
}

function extOf(name) {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i);
}

function lineOfIndex(src, idx) {
  let line = 1;
  for (let i = 0; i < idx && i < src.length; i++) if (src[i] === '\n') line++;
  return line;
}

function compile(rules) {
  const compiled = [];
  for (const r of rules) {
    let re;
    try { re = new RegExp(r.regex, 'g'); }
    catch (e) { console.error(`rule ${r.id}: bad regex (${e.message}) — skipped`); continue; }
    compiled.push({ ...r, re });
  }
  return compiled;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || Object.keys(args).length === 0) { usage(); process.exit(0); }

if (args.semgrep) {
  const yml = join(__dirname, '..', 'rules', 'semgrep-mcp-rules.yml');
  console.log(`# Full AST matching (all 29 rules, exact):
semgrep --config ${yml} --json .

# Or from the installed npm package:
semgrep --config "$(node -p "require('path').dirname(require.resolve('@marketnow/sentinel-rules/package.json'))")/rules/semgrep-mcp-rules.yml" .`);
  process.exit(0);
}

const rules = loadRules(args.rules);

if (args.list) {
  console.log(`MarketNow MCP security rules — ${rules.length} rules (v2)\n`);
  for (const r of rules) {
    const mode = r.mode === 'exact' ? '' : '  [lite-approx]';
    console.log(`  ${r.id.padEnd(12)} ${String(r.severity).padEnd(7)} ${r.message}${mode}`);
  }
  process.exit(0);
}

const target = args.path || '.';
if (!existsSync(target)) { console.error(`path not found: ${target}`); process.exit(2); }
const targetRoot = statSync(target).isDirectory() ? resolve(target) : null;

const compiled = compile(rules);
const files = walk(target);
const findings = [];

for (const file of files) {
  let src;
  try { src = readFileSync(file, 'utf8'); }
  catch { continue; }
  for (const rule of compiled) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(src)) !== null) {
      const line = lineOfIndex(src, m.index);
      const snippet = src.slice(m.index, Math.min(m.index + 60, src.length)).replace(/\s+/g, ' ').trim().slice(0, 48);
      const absFile = resolve(file);
      const shown = targetRoot && absFile.startsWith(targetRoot) ? relative(targetRoot, absFile) : absFile;
      findings.push({
        file: shown || file,
        line,
        rule: rule.id,
        severity: rule.severity,
        message: rule.message,
        mode: rule.mode,
        snippet,
      });
      if (m.index === rule.re.lastIndex) rule.re.lastIndex++; // zero-width guard
    }
  }
}

findings.sort((a, b) => (SEV_ORDER[b.severity] || 0) - (SEV_ORDER[a.severity] || 0) || a.file.localeCompare(b.file) || a.line - b.line);

if (args.json) {
  const out = { scanner: '@marketnow/sentinel-rules', mode: 'lite', files_scanned: files.length, rules: compiled.length, findings: findings.length, items: findings };
  console.log(JSON.stringify(out, null, 2));
} else {
  const bySev = { ERROR: 0, WARNING: 0, INFO: 0 };
  for (const f of findings) bySev[f.severity] = (bySev[f.severity] || 0) + 1;
  for (const f of findings) {
    console.log(`${f.file}:${f.line}  [${f.severity}]  ${f.rule}  ${f.message}`);
    if (f.mode === 'lite-approximation') console.log(`    ↳ lite approximation — snippet: ${f.snippet}`);
    else console.log(`    ↳ ${f.snippet}`);
  }
  console.log(`\nScanned ${files.length} files with ${compiled.length} rules — ${findings.length} findings` +
    ` (ERROR: ${bySev.ERROR}, WARNING: ${bySev.WARNING}, INFO: ${bySev.INFO})`);
  if (findings.length > 0) {
    console.log(`\nFull AST matching (incl. the 7 structural rules, exact): re-run with semgrep:`);
    console.log(`  semgrep --config rules/semgrep-mcp-rules.yml .`);
  }
}

if (findings.length > 0 && !args.soft) process.exit(1);
process.exit(0);
