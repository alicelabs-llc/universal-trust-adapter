/**
 * P5-7: uta-verify CLI integration tests.
 */

const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..', '..');
const CLI = path.join(ROOT, 'packages', 'cli', 'dist', 'uta-verify.js');
const KEYS_DIR = path.join(ROOT, 'vectors', 'keys');
const VECTORS = path.join(ROOT, 'vectors');

let passed = 0, failed = 0;
const failures = [];

function check(name, fn) {
  try {
    const r = fn();
    if (r === true || (r && r.valid === true)) { passed++; console.log(`✅ ${name}`); }
    else {
      failed++;
      const reason = r?.reason || 'returned false';
      failures.push({ name, reason });
      console.log(`❌ ${name}: ${reason}`);
    }
  } catch (e) {
    failed++;
    failures.push({ name, reason: e.message });
    console.log(`❌ ${name}: ${e.message}`);
  }
}

function runCli(args) {
  try {
    const output = execSync(`node "${CLI}" ${args}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { exitCode: 0, output };
  } catch (e) {
    return { exitCode: e.status, output: e.stdout || e.stderr || e.message };
  }
}

console.log('── uta-verify CLI ──');

check('--version shows version', () => {
  const r = runCli('--version');
  return r.exitCode === 0 && r.output.includes('1.0.0');
});

check('--help shows usage', () => {
  const r = runCli('--help');
  return r.exitCode === 0 && r.output.includes('Usage:') && r.output.includes('--ca-key');
});

check('no args → exit code 2', () => {
  const r = runCli('');
  return r.exitCode === 2;
});

check('missing --ca-key → exit code 2', () => {
  const r = runCli(`"${path.join(VECTORS, 'positive', 'pos-001-atc-v3-valid.json')}"`);
  return r.exitCode === 2;
});

check('verifies valid ATC v3 (exit code 0)', () => {
  const r = runCli(`"${path.join(VECTORS, 'positive', 'pos-001-atc-v3-valid.json')}" --ca-key "${path.join(KEYS_DIR, 'ca_ed25519.pub.pem')}"`);
  return r.exitCode === 0 && r.output.includes('VALID');
});

check('rejects tampered ATC v3 (exit code 1)', () => {
  const r = runCli(`"${path.join(VECTORS, 'negative', 'neg-001-atc-tampered-sig.json')}" --ca-key "${path.join(KEYS_DIR, 'ca_ed25519.pub.pem')}"`);
  return r.exitCode === 1 && r.output.includes('INVALID');
});

check('verifies valid JWT EdDSA', () => {
  const r = runCli(`"${path.join(VECTORS, 'positive', 'pos-004-jwt-eddsa-valid.json')}" --ca-key "${path.join(KEYS_DIR, 'ca_ed25519.pub.pem')}"`);
  return r.exitCode === 0 && r.output.includes('VALID');
});

check('verifies valid W3C VC', () => {
  const r = runCli(`"${path.join(VECTORS, 'positive', 'pos-005-vc-ed25519-valid.json')}" --ca-key "${path.join(KEYS_DIR, 'ca_ed25519.pub.pem')}"`);
  return r.exitCode === 0 && r.output.includes('VALID');
});

check('rejects JWT alg=none', () => {
  const r = runCli(`"${path.join(VECTORS, 'negative', 'neg-006-jwt-alg-none.json')}" --ca-key "${path.join(KEYS_DIR, 'ca_ed25519.pub.pem')}"`);
  return r.exitCode === 1;
});

check('--json outputs valid JSON', () => {
  const r = runCli(`"${path.join(VECTORS, 'positive', 'pos-001-atc-v3-valid.json')}" --ca-key "${path.join(KEYS_DIR, 'ca_ed25519.pub.pem')}" --json`);
  if (r.exitCode !== 0) return { reason: `exit code ${r.exitCode}` };
  try {
    const j = JSON.parse(r.output);
    return j.format === 'atc-v3' && j.valid === true;
  } catch (e) {
    return { reason: `JSON parse error: ${e.message}` };
  }
});

check('nonexistent file → exit code 2', () => {
  const r = runCli(`/nonexistent/file.json --ca-key "${path.join(KEYS_DIR, 'ca_ed25519.pub.pem')}"`);
  return r.exitCode === 2 && r.output.includes('Error reading');
});

console.log('\n' + '='.repeat(60));
console.log(`UTA CLI Integration: ${passed}/${passed + failed} tests passed`);
console.log(`Conformant: ${failed === 0 ? 'YES ✅' : 'NO ❌'}`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f.name}: ${f.reason}`);
}
process.exit(failed > 0 ? 1 : 0);
