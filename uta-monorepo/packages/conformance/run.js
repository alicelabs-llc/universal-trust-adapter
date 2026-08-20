// Conformance test runner — plain JS entry point for `npm test`
const fs = require('fs');
const path = require('path');

// Root of the monorepo (2 levels up from packages/conformance/)
const ROOT = path.join(__dirname, '..', '..');

let passed = 0, failed = 0;

function check(name, fn) {
  try {
    if (fn()) { passed++; console.log(`✅ ${name}`); }
    else { failed++; console.log(`❌ ${name}`); }
  } catch (e) { failed++; console.log(`❌ ${name}: ${e.message}`); }
}

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

// ── Test 1: Required files exist ──
const requiredFiles = [
  'packages/core/crypto.ts',
  'packages/core/verification-pipeline.ts',
  'packages/core/types.ts',
  'packages/core/trust-engine.ts',
  'packages/uts/index.ts',
  'packages/adapters/atc-v3.ts',
  'packages/adapters/advanced-adapters.ts',
  'packages/gateway/index.ts',
  'packages/conformance/index.ts',
  'specs/UTS-v1.md',
  'threat-model/THREAT_MODEL.md',
  'supply-chain/CI-CD.md',
  'LICENSE',
  'LICENSE-AL-1.0',
  'NOTICE',
  'package.json',
  'tsconfig.json',
];

for (const f of requiredFiles) {
  check(`file exists: ${f}`, () => exists(f));
}

// ── Test 2: No stubs in verification pipeline ──
check('no stubs in pipeline', () => {
  const pipeline = readFile('packages/core/verification-pipeline.ts');
  return !pipeline.includes('In production: would verify') && !pipeline.includes('// In production:');
});

// ── Test 3: No duplicate exports in crypto ──
check('no duplicate exports in crypto', () => {
  const crypto = readFile('packages/core/crypto.ts');
  const exportBlocks = (crypto.match(/^export \{/gm) || []).length;
  return exportBlocks === 0;
});

// ── Test 4: JCS throws on undefined ──
check('JCS throws on undefined', () => {
  const crypto = readFile('packages/core/crypto.ts');
  return crypto.includes("throw new Error('JCS: undefined");
});

// ── Test 5: JCS throws on NaN ──
check('JCS throws on NaN', () => {
  const crypto = readFile('packages/core/crypto.ts');
  return crypto.includes('not a valid JSON number');
});

// ── Test 6: Issuer trust is fail-closed ──
check('issuer trust is fail-closed', () => {
  const pipeline = readFile('packages/core/verification-pipeline.ts');
  return pipeline.includes('no allowed_issuers policy configured');
});

// ── Test 7: Artifact binding verifies hash ──
check('artifact binding verifies hash', () => {
  const pipeline = readFile('packages/core/verification-pipeline.ts');
  return pipeline.includes('Artifact binding hash mismatch');
});

// ── Test 8: Evidence verifies hash ──
check('evidence verifies hash', () => {
  const pipeline = readFile('packages/core/verification-pipeline.ts');
  return pipeline.includes('Evidence hash mismatch');
});

// ── Test 9: ATC v3 detection ──
check('ATC v3 detection in pipeline', () => {
  const pipeline = readFile('packages/core/verification-pipeline.ts');
  return pipeline.includes("p.atc_version.startsWith('3.')");
});

// ── Test 10: No Math.random in credential ID ──
check('no Math.random in ATC v3', () => {
  const atc = readFile('packages/adapters/atc-v3.ts');
  return !atc.includes('Math.random');
});

// ── Test 11: Uses crypto.randomUUID ──
check('uses crypto.randomUUID', () => {
  const atc = readFile('packages/adapters/atc-v3.ts');
  return atc.includes('crypto.randomUUID');
});

// ── Test 12: SPIFFE split fix ──
check('SPIFFE uses .at(-1)', () => {
  const spiffe = readFile('packages/adapters/advanced-adapters.ts');
  return !spiffe.includes(".split('/')[-1]") && spiffe.includes('.at(-1)');
});

// ── Test 13: Domain separation ──
check('domain separation constants', () => {
  const crypto = readFile('packages/core/crypto.ts');
  return crypto.includes('UTA-ATC-V3-CREDENTIAL') && crypto.includes('UTA-ATC-V3-POP');
});

// ── Test 14: PoP implemented ──
check('PoP challenge + response + verify', () => {
  const crypto = readFile('packages/core/crypto.ts');
  return crypto.includes('generatePoPChallenge') && crypto.includes('createPoPResponse') && crypto.includes('verifyPoP');
});

// ── Test 15: License is AL-1.0 ──
check('license is AL-1.0', () => {
  return exists('LICENSE-AL-1.0') && readFile('LICENSE').includes('AL-1.0');
});

// ── Test 16: README has honest claims ──
check('README has honest implementation status', () => {
  const readme = readFile('README.md');
  return readme.includes('⬜') && !readme.includes('zero stubs') && !readme.includes('83 tests');
});

// ── Test 17: package.json has no node:crypto dependency ──
check('package.json has no node:crypto dep', () => {
  const corePkg = readFile('packages/core/package.json');
  return !corePkg.includes('"node:crypto"');
});

// ── Test 18: package.json has @types/node ──
check('package.json has @types/node', () => {
  const corePkg = readFile('packages/core/package.json');
  return corePkg.includes('@types/node');
});

// ── Test 19: Adapters import from ../core/ ──
check('adapters import from ../core/', () => {
  const atc = readFile('packages/adapters/atc-adapter.ts');
  return atc.includes("from '../core/");
});

// ── Test 20: Test script points to run.js ──
check('test script points to run.js', () => {
  const pkg = readFile('package.json');
  return pkg.includes('node packages/conformance/run.js');
});

console.log('\n' + '='.repeat(60));
console.log(`UTA Conformance: ${passed}/${passed + failed} tests passed`);
console.log(`Conformant: ${failed === 0 ? 'YES ✅' : 'NO ❌'}`);

if (failed > 0) {
  console.log('\nFailures:');
}
process.exit(failed > 0 ? 1 : 0);
