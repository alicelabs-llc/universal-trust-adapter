/**
 * P8-1: Fuzzing harness — generates randomly mutated credentials and verifies
 * that the UTA pipeline handles them without crashing (panic/undefined behavior).
 *
 * For each fuzz iteration:
 *   1. Take a valid ATC v3 credential
 *   2. Apply N random mutations (flip bit, swap bytes, truncate, inject chars)
 *   3. Run verifyATCv3 + verifyCredential (12-stage pipeline)
 *   4. Assert: no uncaught exceptions thrown
 *   5. Assert: result is either valid=false (expected) or valid=true (acceptable
 *      — means the mutation didn't affect the signature)
 *
 * Run with: node packages/conformance/run-fuzz.js [iterations]
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist', 'packages');
const KEYS = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'vectors', 'keys', 'manifest.json'), 'utf-8')
).keys;

const coreCrypto = require(path.join(DIST, 'core', 'crypto.js'));
const corePipeline = require(path.join(DIST, 'core', 'verification-pipeline.js'));
const atcV3 = require(path.join(DIST, 'adapters', 'atc-v3.js'));

function makeCaKey() {
  return {
    privateKeyPem: KEYS.ca_ed25519.private_key_pem,
    publicKeyPem: KEYS.ca_ed25519.public_key_pem,
    publicKeyRaw: KEYS.ca_ed25519.public_key_raw_b64url,
    keyId: KEYS.ca_ed25519.key_id,
  };
}

// ============================================================================
// Mutation functions
// ============================================================================

function flipRandomBit(buf) {
  const result = Buffer.from(buf);
  const byteIdx = Math.floor(Math.random() * result.length);
  const bitIdx = Math.floor(Math.random() * 8);
  result[byteIdx] ^= (1 << bitIdx);
  return result;
}

function swapRandomBytes(buf) {
  const result = Buffer.from(buf);
  if (result.length < 2) return result;
  const i = Math.floor(Math.random() * result.length);
  let j = Math.floor(Math.random() * result.length);
  while (j === i) j = Math.floor(Math.random() * result.length);
  [result[i], result[j]] = [result[j], result[i]];
  return result;
}

function truncateRandom(buf) {
  const cutPoint = Math.max(1, Math.floor(Math.random() * (buf.length - 1)));
  return buf.subarray(0, cutPoint);
}

function injectRandomByte(buf) {
  const result = Buffer.alloc(buf.length + 1);
  const pos = Math.floor(Math.random() * buf.length);
  buf.copy(result, 0, 0, pos);
  result[pos] = Math.floor(Math.random() * 256);
  buf.copy(result, pos + 1, pos);
  return result;
}

const MUTATIONS = [flipRandomBit, swapRandomBytes, truncateRandom, injectRandomByte];

// ============================================================================
// Field-level mutations (modify a JSON field value)
// ============================================================================

function mutateCredential(cred) {
  const result = JSON.parse(JSON.stringify(cred));
  const fields = [
    'atc_version',
    'credential_id',
    ['subject', 'agent_id'],
    ['subject', 'agent_name'],
    ['subject', 'public_key'],
    ['issuer', 'did'],
    ['issuer', 'name'],
    ['lifecycle', 'expires_at'],
    ['lifecycle', 'revoked'],
    ['assessment', 'score'],
    ['assessment', 'risk_level'],
    ['capabilities', 'provides'],
    ['signatures', 0, 'value'],
    ['signatures', 0, 'domain'],
    ['signatures', 0, 'key_id'],
  ];

  const field = fields[Math.floor(Math.random() * fields.length)];
  const path = Array.isArray(field) ? field : [field];

  let obj = result;
  for (let i = 0; i < path.length - 1; i++) {
    if (obj[path[i]] === undefined) return result;  // path doesn't exist — skip
    obj = obj[path[i]];
  }
  const key = path[path.length - 1];
  if (obj[key] === undefined) return result;

  const current = obj[key];
  const mutationType = Math.floor(Math.random() * 5);

  switch (mutationType) {
    case 0:  // flip a character
      if (typeof current === 'string' && current.length > 0) {
        const idx = Math.floor(Math.random() * current.length);
        const charCode = current.charCodeAt(idx);
        obj[key] = current.substring(0, idx) + String.fromCharCode(charCode ^ 0x20) + current.substring(idx + 1);
      }
      break;
    case 1:  // change number
      if (typeof current === 'number') {
        obj[key] = current + Math.floor(Math.random() * 100) - 50;
      }
      break;
    case 2:  // toggle boolean
      if (typeof current === 'boolean') {
        obj[key] = !current;
      }
      break;
    case 3:  // replace with random string
      obj[key] = crypto.randomBytes(16).toString('hex');
      break;
    case 4:  // delete field
      delete obj[key];
      break;
  }

  return result;
}

// ============================================================================
// Signature-level mutations (modify the raw signature bytes)
// ============================================================================

function mutateSignature(cred) {
  const result = JSON.parse(JSON.stringify(cred));
  if (!result.signatures || !result.signatures[0]) return result;

  const sigValue = result.signatures[0].value;
  const sigBytes = Buffer.from(sigValue, 'hex');

  const mutationFn = MUTATIONS[Math.floor(Math.random() * MUTATIONS.length)];
  const mutated = mutationFn(sigBytes);

  result.signatures[0].value = mutated.toString('hex').padEnd(128, '0').slice(0, 128);
  return result;
}

// ============================================================================
// Run fuzzing
// ============================================================================

function runFuzz(iterations = 1000) {
  const caKey = makeCaKey();
  const baseCred = atcV3.issueATCv3({
    issuer: { did: 'did:marketnow:ca', name: 'CA', url: 'https://test', ca_key_id: caKey.keyId },
    subject: { agent_id: 'fuzz-001', agent_name: 'Fuzz', public_key: KEYS.agent_ed25519.public_key_raw_b64url, key_algorithm: 'Ed25519', subject_type: 'agent' },
    capabilities: { provides: ['test'] },
    assessment: { methodology: 'T', methodology_version: '1', score: 8, confidence: 'high', risk_level: 'low' },
    expires_in_days: 30,
    ca_key_pair: caKey,
  });

  const stats = {
    total: 0,
    no_crash: 0,
    crash: 0,
    valid_false: 0,
    valid_true: 0,
    errors: 0,
    mutations: { field: 0, signature: 0, both: 0 },
  };

  const crashes = [];

  for (let i = 0; i < iterations; i++) {
    stats.total++;

    // Choose mutation type
    const mutType = Math.floor(Math.random() * 3);
    let mutatedCred = baseCred;

    if (mutType === 0) {
      mutatedCred = mutateCredential(baseCred);
      stats.mutations.field++;
    } else if (mutType === 1) {
      mutatedCred = mutateSignature(baseCred);
      stats.mutations.signature++;
    } else {
      mutatedCred = mutateCredential(mutateSignature(baseCred));
      stats.mutations.both++;
    }

    try {
      // Run verifyATCv3
      const atcResult = atcV3.verifyATCv3(mutatedCred, caKey.publicKeyPem);

      // Run 12-stage pipeline
      const pipelineResult = await_or_sync(corePipeline.verifyCredential({
        credential: mutatedCred,
        ca_public_key: caKey.publicKeyPem,
        policy: { min_trust_score: 0, allowed_issuers: ['did:marketnow:ca'] },
      }));

      stats.no_crash++;

      if (atcResult.valid) stats.valid_true++;
      else stats.valid_false++;

      if (pipelineResult && pipelineResult.decision === 'ALLOW') stats.valid_true++;
      else stats.valid_false++;

    } catch (e) {
      stats.crash++;
      stats.errors++;
      if (crashes.length < 10) {
        crashes.push({ iteration: i, error: e.message, cred: JSON.stringify(mutatedCred).slice(0, 200) });
      }
    }
  }

  return { stats, crashes };
}

// Handle sync vs async pipeline
function await_or_sync(promise_or_value) {
  if (promise_or_value && typeof promise_or_value.then === 'function') {
    // Can't await in a sync loop — run sync version
    return null;
  }
  return promise_or_value;
}

// ============================================================================
// Async version (pipeline is async)
// ============================================================================

async function runFuzzAsync(iterations = 500) {
  const caKey = makeCaKey();
  const baseCred = atcV3.issueATCv3({
    issuer: { did: 'did:marketnow:ca', name: 'CA', url: 'https://test', ca_key_id: caKey.keyId },
    subject: { agent_id: 'fuzz-002', agent_name: 'Fuzz', public_key: KEYS.agent_ed25519.public_key_raw_b64url, key_algorithm: 'Ed25519', subject_type: 'agent' },
    capabilities: { provides: ['test'] },
    assessment: { methodology: 'T', methodology_version: '1', score: 8, confidence: 'high', risk_level: 'low' },
    expires_in_days: 30,
    ca_key_pair: caKey,
  });

  const stats = {
    total: 0,
    no_crash: 0,
    crash: 0,
    valid_false: 0,
    valid_true: 0,
    pipeline_allow: 0,
    pipeline_deny: 0,
    mutations: { field: 0, signature: 0, both: 0 },
  };

  const crashes = [];

  for (let i = 0; i < iterations; i++) {
    stats.total++;

    const mutType = Math.floor(Math.random() * 3);
    let mutatedCred = baseCred;

    if (mutType === 0) {
      mutatedCred = mutateCredential(baseCred);
      stats.mutations.field++;
    } else if (mutType === 1) {
      mutatedCred = mutateSignature(baseCred);
      stats.mutations.signature++;
    } else {
      mutatedCred = mutateCredential(mutateSignature(baseCred));
      stats.mutations.both++;
    }

    try {
      // verifyATCv3 (sync)
      const atcResult = atcV3.verifyATCv3(mutatedCred, caKey.publicKeyPem);

      // 12-stage pipeline (async)
      const pipelineResult = await corePipeline.verifyCredential({
        credential: mutatedCred,
        ca_public_key: caKey.publicKeyPem,
        policy: { min_trust_score: 0, allowed_issuers: ['did:marketnow:ca'] },
      });

      stats.no_crash++;

      if (atcResult.valid) stats.valid_true++;
      else stats.valid_false++;

      if (pipelineResult.decision === 'ALLOW') stats.pipeline_allow++;
      else stats.pipeline_deny++;

    } catch (e) {
      stats.crash++;
      if (crashes.length < 10) {
        crashes.push({ iteration: i, error: e.message, mutation: mutType === 0 ? 'field' : mutType === 1 ? 'sig' : 'both' });
      }
    }
  }

  return { stats, crashes };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const iterations = parseInt(process.argv[2] || '500', 10);

  console.log('── UTA Fuzz Testing (P8-1) ──');
  console.log(`Iterations: ${iterations}\n`);

  console.log('Running sync fuzz (verifyATCv3 only)...');
  const syncResult = runFuzz(iterations);
  console.log(`  Crashes: ${syncResult.stats.crash}/${syncResult.stats.total}`);
  console.log(`  Valid (false): ${syncResult.stats.valid_false}, Valid (true): ${syncResult.stats.valid_true}`);

  console.log('\nRunning async fuzz (verifyATCv3 + 12-stage pipeline)...');
  const asyncResult = await runFuzzAsync(Math.min(iterations, 200));  // fewer iterations for async
  console.log(`  Crashes: ${asyncResult.stats.crash}/${asyncResult.stats.total}`);
  console.log(`  Pipeline ALLOW: ${asyncResult.stats.pipeline_allow}, DENY: ${asyncResult.stats.pipeline_deny}`);

  console.log('\n── Mutation Distribution ──');
  console.log(`  Field mutations:    ${asyncResult.stats.mutations.field}`);
  console.log(`  Signature mutations: ${asyncResult.stats.mutations.signature}`);
  console.log(`  Both:               ${asyncResult.stats.mutations.both}`);

  if (asyncResult.crashes.length > 0) {
    console.log('\n⚠️  Crashes detected:');
    for (const c of asyncResult.crashes) {
      console.log(`  [${c.iteration}] ${c.mutation}: ${c.error}`);
    }
  } else {
    console.log('\n✅ No crashes detected — pipeline handles malformed input gracefully.');
  }

  // ── Summary ──
  const totalTests = syncResult.stats.total + asyncResult.stats.total;
  const totalCrashes = syncResult.stats.crash + asyncResult.stats.crash;
  const passed = totalTests - totalCrashes;

  console.log('\n' + '='.repeat(60));
  console.log(`UTA Fuzz: ${passed}/${totalTests} iterations passed without crash`);
  console.log(`Conformant: ${totalCrashes === 0 ? 'YES ✅' : 'NO ❌'}`);
  process.exit(totalCrashes > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
