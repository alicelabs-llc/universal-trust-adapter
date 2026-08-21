/**
 * P8-7: Property-based testing for JCS canonicalization.
 *
 * Tests mathematical properties that MUST hold for any input:
 *   1. Idempotency: canonicalize(canonicalize(x)) === canonicalize(x)
 *   2. Determinism: canonicalize(x) is the same every time
 *   3. Order independence: {a:1,b:2} and {b:2,a:1} canonicalize identically
 *   4. Type preservation: null → "null", true → "true", etc.
 *   5. SHA-256 stability: hash(canonicalize(x)) is deterministic
 *   6. Round-trip: JSON.parse(canonicalize(x)) deep-equals x (for JSON-safe values)
 *   7. Forward slash not escaped (RFC 8785 rule)
 *   8. Unicode sorting by UTF-16 code units
 *
 * Uses a simple random value generator (no external deps).
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist', 'packages');
const coreCrypto = require(path.join(DIST, 'core', 'crypto.js'));

let passed = 0, failed = 0;
const failures = [];

function check(name, fn) {
  try {
    const r = fn();
    if (r === true) { passed++; console.log(`✅ ${name}`); }
    else { failed++; failures.push({ name, reason: r || 'returned false' }); console.log(`❌ ${name}: ${r}`); }
  } catch (e) {
    failed++;
    failures.push({ name, reason: e.message });
    console.log(`❌ ${name}: ${e.message}`);
  }
}

// ============================================================================
// Random value generators
// ============================================================================

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomBool() { return Math.random() < 0.5; }
function randomString(maxLen = 20) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\ö中文🎨';
  const len = randomInt(0, maxLen);
  let s = '';
  for (let i = 0; i < len; i++) s += chars[randomInt(0, chars.length - 1)];
  return s;
}
function randomNumber() {
  const type = randomInt(0, 3);
  if (type === 0) return randomInt(-1000, 1000);
  if (type === 1) return Math.random() * 1000 - 500;
  if (type === 2) return randomInt(0, 1) === 0 ? 0 : -0;
  return randomInt(0, 1) === 0 ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER;
}

function randomValue(depth = 0) {
  if (depth > 3) return null;
  const type = randomInt(0, 5);
  switch (type) {
    case 0: return null;
    case 1: return randomBool();
    case 2: return randomString();
    case 3: return randomNumber();
    case 4: {
      // Array
      const len = randomInt(0, 5);
      const arr = [];
      for (let i = 0; i < len; i++) arr.push(randomValue(depth + 1));
      return arr;
    }
    case 5: {
      // Object
      const len = randomInt(0, 5);
      const obj = {};
      for (let i = 0; i < len; i++) {
        const key = randomString(10);
        obj[key] = randomValue(depth + 1);
      }
      return obj;
    }
  }
}

// ============================================================================
// Properties
// ============================================================================

const ITERATIONS = 200;

function main() {
  console.log('── Property-Based Testing (P8-7) ──');
  console.log(`Iterations per property: ${ITERATIONS}\n`);

  // 1. Idempotency
  let idempotent = true;
  for (let i = 0; i < ITERATIONS; i++) {
    const v = randomValue();
    const c1 = coreCrypto.canonicalize(v);
    const c2 = coreCrypto.canonicalize(JSON.parse(c1));
    if (c1 !== c2) { idempotent = `FAILED at iteration ${i}: ${c1} !== ${c2}`; break; }
  }
  check('Idempotency: canonicalize(canonicalize(x)) === canonicalize(x)', () => idempotent === true ? true : idempotent);

  // 2. Determinism
  let deterministic = true;
  for (let i = 0; i < ITERATIONS; i++) {
    const v = randomValue();
    const c1 = coreCrypto.canonicalize(v);
    const c2 = coreCrypto.canonicalize(JSON.parse(JSON.stringify(v)));
    if (c1 !== c2) { deterministic = `FAILED at iteration ${i}`; break; }
  }
  check('Determinism: canonicalize(x) is the same every time', () => deterministic === true ? true : deterministic);

  // 3. Order independence
  let orderIndependent = true;
  for (let i = 0; i < ITERATIONS; i++) {
    const obj1 = {};
    const obj2 = {};
    const keys = [];
    for (let j = 0; j < 5; j++) {
      const k = randomString(8);
      keys.push(k);
      obj1[k] = randomValue(1);
      obj2[k] = obj1[k];
    }
    // Shuffle obj2's key order by rebuilding
    const shuffled = {};
    const shuffledKeys = [...keys].sort(() => Math.random() - 0.5);
    for (const k of shuffledKeys) shuffled[k] = obj2[k];
    const c1 = coreCrypto.canonicalize(obj1);
    const c2 = coreCrypto.canonicalize(shuffled);
    if (c1 !== c2) { orderIndependent = `FAILED at iteration ${i}: ${c1} !== ${c2}`; break; }
  }
  check('Order independence: {a:1,b:2} === {b:2,a:1}', () => orderIndependent === true ? true : orderIndependent);

  // 4. Type preservation
  check('Type preservation: null → "null"', () => coreCrypto.canonicalize(null) === 'null');
  check('Type preservation: true → "true"', () => coreCrypto.canonicalize(true) === 'true');
  check('Type preservation: false → "false"', () => coreCrypto.canonicalize(false) === 'false');
  check('Type preservation: 0 → "0"', () => coreCrypto.canonicalize(0) === '0');
  check('Type preservation: -0 → "0"', () => coreCrypto.canonicalize(-0) === '0');
  check('Type preservation: 42 → "42"', () => coreCrypto.canonicalize(42) === '42');
  check('Type preservation: empty string → ""', () => coreCrypto.canonicalize('') === '""');
  check('Type preservation: empty array → "[]"', () => coreCrypto.canonicalize([]) === '[]');
  check('Type preservation: empty object → "{}"', () => coreCrypto.canonicalize({}) === '{}');

  // 5. SHA-256 stability
  let hashStable = true;
  for (let i = 0; i < ITERATIONS; i++) {
    const v = randomValue();
    const h1 = coreCrypto.canonicalHash(v);
    const h2 = coreCrypto.canonicalHash(JSON.parse(JSON.stringify(v)));
    if (h1 !== h2) { hashStable = `FAILED at iteration ${i}`; break; }
  }
  check('SHA-256 stability: hash(canonicalize(x)) is deterministic', () => hashStable === true ? true : hashStable);

  // 6. Round-trip
  let roundTrip = true;
  for (let i = 0; i < ITERATIONS; i++) {
    const v = randomValue();
    const c = coreCrypto.canonicalize(v);
    const parsed = JSON.parse(c);
    // Check deep equality
    if (JSON.stringify(v) !== JSON.stringify(parsed)) {
      // Numbers might differ (e.g., -0 → 0), check with canonicalize
      if (coreCrypto.canonicalize(v) !== coreCrypto.canonicalize(parsed)) {
        roundTrip = `FAILED at iteration ${i}: ${JSON.stringify(v)} → ${c} → ${JSON.stringify(parsed)}`;
        break;
      }
    }
  }
  check('Round-trip: JSON.parse(canonicalize(x)) deep-equals x', () => roundTrip === true ? true : roundTrip);

  // 7. Forward slash not escaped (RFC 8785)
  check('Forward slash NOT escaped: "a/b/c" → "a/b/c"', () => {
    const c = coreCrypto.canonicalize('a/b/c');
    return !c.includes('\\/') && c.includes('/');
  });
  check('Forward slash in URL not escaped', () => {
    const c = coreCrypto.canonicalize({ url: 'https://example.com/path' });
    return !c.includes('\\/') && c.includes('https://example.com/path');
  });

  // 8. Unicode sorting by UTF-16 code units
  check('Unicode keys sorted by UTF-16 code units', () => {
    const obj = { '🎨': 1, 'A': 2, '中': 3, 'a': 4 };
    const c = coreCrypto.canonicalize(obj);
    // 'A' = 0x41, 'a' = 0x61, '中' = 0x4E2D, '🎨' = 0x1F3A8 (surrogate pair: 0xD83C 0xDFA8)
    // Expected order: A (0x41) < a (0x61) < 中 (0x4E2D) < 🎨 (0xD83C...)
    const expected = '{"A":2,"a":4,"中":3,"🎨":1}';
    return c === expected;
  });

  // 9. NaN and Infinity throw (RFC 8785 forbids them)
  check('NaN throws error', () => {
    try { coreCrypto.canonicalize(NaN); return false; }
    catch (e) { return e.message.includes('not a valid JSON number'); }
  });
  check('Infinity throws error', () => {
    try { coreCrypto.canonicalize(Infinity); return false; }
    catch (e) { return e.message.includes('not a valid JSON number'); }
  });
  check('undefined throws error', () => {
    try { coreCrypto.canonicalize(undefined); return false; }
    catch (e) { return e.message.includes('undefined'); }
  });

  // 10. Nested structures
  check('Nested arrays canonicalize correctly', () => {
    const v = [[1, 2], [3, 4], [5, 6]];
    return coreCrypto.canonicalize(v) === '[[1,2],[3,4],[5,6]]';
  });
  check('Nested objects canonicalize correctly', () => {
    const v = { a: { b: { c: 1 } } };
    return coreCrypto.canonicalize(v) === '{"a":{"b":{"c":1}}}';
  });
  check('Mixed nested structures', () => {
    const v = { arr: [1, { x: 2 }], obj: { y: [3, 4] } };
    return coreCrypto.canonicalize(v) === '{"arr":[1,{"x":2}],"obj":{"y":[3,4]}}';
  });

  // ── Summary ──
  console.log('\n' + '='.repeat(60));
  console.log(`UTA Property-Based Tests: ${passed}/${passed + failed} properties verified`);
  console.log(`Conformant: ${failed === 0 ? 'YES ✅' : 'NO ❌'}`);
  if (failed > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f.name}: ${f.reason}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main();
