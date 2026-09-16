#!/usr/bin/env node
// ============================================================================
// UTA conformance — RUNNER TEST SUITE (v1.5.0)
// "Making the runner the tested thing, not just the cards."
// ============================================================================
// The reference scorer (score-runner.mjs) is code WE wrote. Until v1.3.2 a
// stranger had to trust it. This suite turns it from a trusted component
// into a tested component:
//
//   1. BYTES:   sha256(score-runner.mjs) must equal the digest pinned in the
//               answer key — and the answer key is anchored in Sigstore's
//               public Rekor log (entry #6 for v1.5.0), so it cannot be
//               rewritten. `--rekor` puts the log in the actual verification
//               path: the digest chain is re-rooted at the live entry before
//               any local check runs (anp2network round 3: "the log stays
//               decorative in the actual verification path" — not anymore).
//   2. GOLDEN:  the runner's observable behavior must reproduce the answer
//               key exactly: the 8-runner separation matrix, the reference-
//               mode verdict, the ADVERSARIAL CHALLENGE (a seeded two-bound
//               boundary distribution, generated fresh and scored through
//               --generated), and two FAIL-CLOSED PROBES (a malformed card
//               and a sidecar that disagrees with derived truth — both must
//               abort with exit 1, never silently score).
//   3. TEETH:   10 known-bad runner variants (deterministic byte patches of
//               the pristine runner, each digest pinned in the key) must
//               each DIVERGE from the key on at least one surface.
//               v1.4.0 adds the GENERATED SWEEP (generate-mutants.mjs): a
//               declared operator set applied at every code site, with
//               survivors published and classified — 10/10 is teeth, the
//               sweep is the measurement of what else walks through.
//
// The behavioral oracle is the answer key; the bytes oracle is Rekor. Between
// them, a stranger months later can re-derive: same bytes → same behavior →
// matches the anchored key — without having to ask us anything.
//
// Modes:
//   node runner-tests.mjs           → verify (fail-closed; exit 0 = passed)
//   node runner-tests.mjs --rekor   → verify, but first re-root the digest
//                                      chain at the live Rekor entry #6
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
//   <conformance>/vectors/…               ← 14 fixed vectors + _index.json + generator
//   <conformance>/runner-tests/…          ← this suite + key + mutants + sweep
//   <conformance>/anchors/…               ← Rekor records/statements/verifiers
// ============================================================================
import { readFileSync, writeFileSync, unlinkSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { createHash, createVerify, createPublicKey } from 'node:crypto';
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
const GEN = join(VECTORS, 'generate-accept-vectors.mjs');

// v1.4.0 — surface 3 (adversarial challenge) + surface 4 (fail-closed probes)
const ADV_SEED = 3;
const ADV_COUNT = 24;
const ADV_DIR = join(CONF, 'adv-challenge.tmp');
const MAL_DIR = join(CONF, 'failclosed-malformed.tmp');
const POI_DIR = join(CONF, 'failclosed-poisoned.tmp');

// v1.5.0 — entry #6 locator (untrusted metadata: everything that matters is
// re-verified against the live entry; a wrong locator simply fails closed)
const HUB = 'https://www.marketnow.site/uta/conformance';
const RECORD_CANDIDATES = [
  join(__dirname, '..', 'anchors', 'anchor-record-v6.json'),       // hub layout
  join(__dirname, '..', '..', 'anchors', 'anchor-record-v6.json'), // repo layout
  'anchor-record-v6.json',
  `${HUB}/anchors/anchor-record-v6.json`,
];
const STATEMENT_CANDIDATES = [
  join(__dirname, '..', 'anchors', 'anchor-statement-v6.json'),
  join(__dirname, '..', '..', 'anchors', 'anchor-statement-v6.json'),
  'anchor-statement-v6.json',
  `${HUB}/anchors/anchor-statement-v6.json`,
];

const sha256hex = (b) => createHash('sha256').update(b).digest('hex');
const argv = process.argv.slice(2);
const RECORD = argv.includes('--record');
const REKOR = argv.includes('--rekor');

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

// ---------- v1.4.0 surfaces 3 + 4: adversarial challenge & fail-closed probes ----------
// Surface 3 — the seeded ADVERSARIAL CHALLENGE: generated fresh relative to
// TODAY's scoring clock (offsets straddle BOTH bounds of the validity window,
// including issued_at === NOW and expires_at === NOW exactly), then scored
// through the runner's --generated path. This puts the loadGenerated code
// path INSIDE the pinned oracle — the first generated sweep showed it was
// outside, which is why mutants in it survived.
// Surface 4 — FAIL-CLOSED PROBES: a malformed card (missing signature) and
// a sidecar that disagrees with the derived truth. Both must abort with
// exit 1; a runner that silently scores either is divergent.
if (!existsSync(GEN)) {
  console.error(`✗ generator not found at ${GEN} — the adversarial challenge is part of the oracle since v1.4.0`);
  process.exit(2);
}
for (const d of [ADV_DIR, MAL_DIR, POI_DIR]) { try { rmSync(d, { recursive: true, force: true }); } catch { /* ok */ } }
const genRun = spawnSync(process.execPath, [GEN, '--mode', 'adversarial', '--count', String(ADV_COUNT), '--seed', String(ADV_SEED), '--out', ADV_DIR], { encoding: 'utf8', timeout: 60000 });
if (genRun.status !== 0) { console.error(`✗ adversarial challenge generation failed: ${(genRun.stderr || '').slice(0, 300)}`); process.exit(2); }
// probe A: malformed card — strip the signature from a valid generated card
const genA = spawnSync(process.execPath, [GEN, '--mode', 'accept', '--count', '3', '--seed', '9', '--out', MAL_DIR], { encoding: 'utf8', timeout: 60000 });
if (genA.status !== 0) { console.error(`✗ malformed-probe generation failed: ${(genA.stderr || '').slice(0, 300)}`); process.exit(2); }
{
  const files = readdirSync(MAL_DIR).filter(f => f.endsWith('.json') && f !== '_generated-index.json').sort();
  const p = join(MAL_DIR, files[0]);
  const card = JSON.parse(readFileSync(p, 'utf8'));
  delete card.signature; // unscoreable: loadGenerated must refuse, not score
  writeFileSync(p, JSON.stringify(card, null, 2) + '\n');
}
// probe B: poisoned sidecar — the sidecar disagrees with the derived truth
const genB = spawnSync(process.execPath, [GEN, '--mode', 'accept', '--count', '3', '--seed', '11', '--out', POI_DIR], { encoding: 'utf8', timeout: 60000 });
if (genB.status !== 0) { console.error(`✗ poisoned-probe generation failed: ${(genB.stderr || '').slice(0, 300)}`); process.exit(2); }
{
  const sp = join(POI_DIR, '_generated-index.json');
  const sidecar = JSON.parse(readFileSync(sp, 'utf8'));
  sidecar[0].expected_verify = !sidecar[0].expected_verify; // flip one — must FATAL
  writeFileSync(sp, JSON.stringify(sidecar, null, 2) + '\n');
}
const cleanupTmp = () => { for (const d of [ADV_DIR, MAL_DIR, POI_DIR]) { try { rmSync(d, { recursive: true, force: true }); } catch { /* ok */ } } };
process.on('exit', cleanupTmp);

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

// ---------- pristine observations (v1.4.0: five surfaces) ----------
// The matrix observation includes the generated challenge (v1.4.0): the
// separation table's "generated" column was pinned as n/a before — the
// first sweep showed that left the cheat runners' window handling free to
// mutate. Now the pinned matrix is matrix-over-fixed-AND-challenge.
const matrixRun = runRunner(RUNNER, ['--matrix', '--generated', ADV_DIR]);
const pristineMatrix = matrixRun.status === 0 ? parseMatrix(matrixRun.stdout) : null;
const refRun = runRunner(RUNNER, []);
const pristineRef = refRun.status === 0 ? parseReference(refRun.stdout) : null;
if (!pristineMatrix || !pristineRef) {
  console.error('✗ pristine score-runner.mjs failed to produce parseable output — refusing to proceed');
  console.error((matrixRun.stderr || '').slice(0, 400));
  process.exit(2);
}
const advRun = runRunner(RUNNER, ['--generated', ADV_DIR]);
const pristineAdv = advRun.status === 0 ? parseChallenge(advRun.stdout) : null;
const malRun = runRunner(RUNNER, ['--generated', MAL_DIR]);
const poiRun = runRunner(RUNNER, ['--generated', POI_DIR]);
const pristineMal = parseFatal(malRun);
const pristinePoi = parseFatal(poiRun);
if (!pristineAdv || pristineAdv.score !== `${ADV_COUNT}/${ADV_COUNT}` || !pristineAdv.passed) {
  console.error(`✗ pristine runner failed the adversarial challenge (${pristineAdv ? pristineAdv.score : 'unparsable'}) — the two-bound boundary distribution is not passing`);
  process.exit(2);
}
if (pristineMal.exit !== 1 || pristinePoi.exit !== 1) {
  console.error(`✗ pristine runner did not fail closed on the probes (malformed exit=${pristineMal.exit}, poisoned exit=${pristinePoi.exit})`);
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
    const mRun = runRunner(TMP_MUTANT, ['--matrix', '--generated', ADV_DIR]);
    const rRun = runRunner(TMP_MUTANT, []);
    const aRun = runRunner(TMP_MUTANT, ['--generated', ADV_DIR]);
    const fA = runRunner(TMP_MUTANT, ['--generated', MAL_DIR]);
    const fB = runRunner(TMP_MUTANT, ['--generated', POI_DIR]);
    const matrix = mRun.status === 0 ? parseMatrix(mRun.stdout) : null;
    const where = [];
    if (matrix === null || JSON.stringify(matrix) !== JSON.stringify(pristineMatrix)) where.push('matrix');
    const ref = rRun.status === 0 ? parseReference(rRun.stdout) : null;
    if (ref === null || JSON.stringify(ref) !== JSON.stringify(pristineRef) || rRun.status !== refRun.status) where.push('reference');
    const adv = aRun.status === 0 ? parseChallenge(aRun.stdout) : null;
    if (adv === null || JSON.stringify(adv) !== JSON.stringify(pristineAdv) || aRun.status !== advRun.status) where.push('adversarial');
    if (JSON.stringify(parseFatal(fA)) !== JSON.stringify(pristineMal)) where.push('failclosed-malformed');
    if (JSON.stringify(parseFatal(fB)) !== JSON.stringify(pristinePoi)) where.push('failclosed-poisoned');
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
    schema: 'uta-runner-answer-key/1.1',
    as_of: today,
    valid_until: validUntil,
    earliest_future_expiry: minExp,
    earliest_future_issued_at: minIssued,
    runner: { file: '../score-runner.mjs', sha256: runnerSha, bytes: Buffer.byteLength(runnerSrc, 'utf8') },
    matrix: pristineMatrix,
    reference: { ...pristineRef, exit_code: refRun.status },
    adversarial: {
      seed: ADV_SEED,
      count: ADV_COUNT,
      generated: pristineAdv.score,
      passed: pristineAdv.passed,
      exit: advRun.status,
      note: 'the seeded two-bound boundary distribution (offsets relative to the scoring clock, incl. issued_at===NOW and expires_at===NOW), regenerated fresh each run and scored through --generated',
    },
    failclosed: {
      malformed_card: pristineMal,
      poisoned_sidecar: pristinePoi,
      note: 'a malformed card and a sidecar that disagrees with derived truth must both abort (exit 1) — never silently score',
    },
    mutant_count: mutantDefs.length,
    mutants,
    note: 'Behavioral oracle for score-runner.mjs, recorded from live behavior across five surfaces (matrix, reference, adversarial challenge, two fail-closed probes). The key is a derived artifact: every value here is observed, none asserted by hand. Anchored in Sigstore Rekor (entry #5 — anchor-record-v6.json; verify the chain in-loop with --rekor or anchors/verify-artifact.mjs); a re-anchored successor supersedes this key. After valid_until the suite fails closed: re-issue vectors, re-record, re-anchor.',
  };
  writeFileSync(KEY_PATH, JSON.stringify(key, null, 2) + '\n');
  console.log(`\nanswer-key.json written — runner sha256 ${runnerSha.slice(0, 16)}…, ${pristineMatrix.rows.length} matrix rows, adversarial ${pristineAdv.score}, 2 fail-closed probes, ${mutantDefs.length} mutants, valid ${today} → ${validUntil}`);
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

// 0. REKOR-IN-THE-LOOP (v1.4.0, --rekor): the digest chain this suite is about
// to trust is re-rooted at the LIVE entry before any local check runs. The
// answer key's digest never comes from the hub alone: the entry commits to the
// statement's hash, the statement pins the key's sha256 — Rekor is on the
// actual verification path (anp2network round 3: "the log stays decorative in
// the actual verification path. One line fixes it." — this is that line).
if (REKOR) {
  console.log('--- rekor: the digest chain re-rooted at the live entry #6 ---');
  const fetchJson = async (url) => {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  };
  const loadCandidate = async (cands) => {
    const errs = [];
    for (const c of cands) {
      try {
        if (c.startsWith('http')) return { where: c, json: await fetchJson(c) };
        if (existsSync(c)) return { where: c, json: JSON.parse(readFileSync(c, 'utf8')) };
      } catch (e) { errs.push(`${c}: ${e.message}`); }
    }
    return { error: errs.join(' | ') };
  };
  const rec = await loadCandidate(RECORD_CANDIDATES);
  if (rec.error) {
    check('entry #6 locator found (anchor-record-v6.json — untrusted locator, everything else is verified live)', false, rec.error.slice(0, 200));
  } else {
    const logIndex = rec.json?.log?.log_index;
    const entries = await fetchJson(`https://rekor.sigstore.dev/api/v1/log/entries?logIndex=${logIndex}`);
    const uuid = Object.keys(entries)[0];
    const entry = entries[uuid];
    check('entry #6 fetched live from rekor.sigstore.dev', uuid === rec.json?.log?.uuid, `logIndex ${logIndex}, integrated ${new Date((entry.integratedTime || 0) * 1000).toISOString()}`);
    // Rekor's own signature over the entry (signedEntryTimestamp)
    const rekorPubPem = await (await fetch('https://rekor.sigstore.dev/api/v1/log/publicKey', { headers: { Accept: 'application/x-pem-file' } })).text();
    const rekorKey = createPublicKey(rekorPubPem);
    const ktype = rekorKey.asymmetricKeyType;
    const set = entry.verification?.signedEntryTimestamp;
    let setOk = false;
    if (set) {
      const blob = Buffer.from(JSON.stringify({ body: entry.body, integratedTime: entry.integratedTime, logID: entry.logID, logIndex: entry.logIndex }), 'utf8');
      const v = ktype === 'ed25519' ? createVerify(null) : createVerify('sha256');
      v.update(blob);
      try { setOk = v.verify(rekorPubPem, Buffer.from(set, 'base64')); } catch { setOk = false; }
    }
    check('signedEntryTimestamp verifies with Rekor\'s live public key', setOk);
    // inclusion proof + checkpoint
    const incl = entry.verification?.inclusionProof;
    let inclOk = false, cpOk = false, treeSize = null;
    if (incl) {
      const leafData = Buffer.from(entry.body, 'base64');
      let node = createHash('sha256').update(Buffer.concat([Buffer.from([0x00]), leafData])).digest();
      treeSize = parseInt(incl.checkpoint.split('\n')[1], 10);
      let i2 = incl.logIndex, last = treeSize - 1;
      for (const h of incl.hashes.map(x => Buffer.from(x, 'hex'))) {
        node = (i2 === last || i2 % 2 === 1)
          ? createHash('sha256').update(Buffer.concat([Buffer.from([0x01]), h, node])).digest()
          : createHash('sha256').update(Buffer.concat([Buffer.from([0x01]), node, h])).digest();
        i2 = Math.floor(i2 / 2); last = Math.floor(last / 2);
      }
      inclOk = node.toString('hex') === incl.rootHash;
      const sigLine = incl.checkpoint.slice(incl.checkpoint.lastIndexOf('— '));
      const noteText = incl.checkpoint.slice(0, incl.checkpoint.indexOf('— ')).replace(/\n\n$/, '\n');
      const sigAll = Buffer.from(sigLine.split(' ')[2].trim(), 'base64');
      const v2 = ktype === 'ed25519' ? createVerify(null) : createVerify('sha256');
      v2.update(Buffer.from(noteText, 'utf8'));
      try { cpOk = v2.verify(rekorPubPem, sigAll.subarray(4)); } catch { cpOk = false; }
    }
    check('inclusion proof folds the leaf into the checkpoint root', inclOk, `tree size ${treeSize}`);
    check('checkpoint (signed tree head) verifies with Rekor\'s key', cpOk);
    // the statement, authenticated against the ENTRY's committed hash
    const entryBody = JSON.parse(Buffer.from(entry.body, 'base64').toString('utf8'));
    const entryHash = entryBody.spec?.data?.hash?.value;
    const sortedCanon = (o) => Array.isArray(o) ? o.map(sortedCanon) : (o !== null && typeof o === 'object') ? Object.fromEntries(Object.keys(o).sort().map(k => [k, sortedCanon(o[k])])) : o;
    const st = await loadCandidate(STATEMENT_CANDIDATES);
    let stOk = false, canon = null;
    if (!st.error) {
      canon = Buffer.from(JSON.stringify(sortedCanon(st.json)), 'utf8');
      stOk = sha256hex(canon) === entryHash;
    }
    check('anchor statement authenticated: sha256(statement) === the entry\'s committed hash', stOk, st.error ? st.error.slice(0, 160) : `from ${st.where}`);
    if (stOk) {
      const sigB64 = entryBody.spec?.signature?.content;
      const keyB64 = entryBody.spec?.signature?.publicKey?.content;
      const v3 = createVerify('sha256');
      v3.update(canon);
      let csOk = false;
      try { csOk = v3.verify(Buffer.from(keyB64, 'base64').toString('utf8'), Buffer.from(sigB64, 'base64')); } catch { csOk = false; }
      check('countersignature (publisher throwaway P-256) verifies over the authenticated statement', csOk);
      // THE loop: the digests this suite is about to trust, from the Rekor-rooted statement
      const pins = st.json.digests || {};
      const pinOf = (prefix) => Object.entries(pins).find(([k2]) => k2.startsWith(prefix))?.[1];
      const keyPin = pinOf('runner_answer_key') ?? pinOf('answer_key');
      const runnerPin = pinOf('score_runner');
      const keyBytes = readFileSync(KEY_PATH, 'utf8');
      check('answer-key.json bytes === the Rekor-rooted pinned digest', keyPin ? keyPin.sha256 === sha256hex(keyBytes) : false, keyPin ? keyPin.sha256.slice(0, 16) + '…' : 'pin not found in statement');
      check('score-runner.mjs bytes === the Rekor-rooted pinned digest', runnerPin ? runnerPin.sha256 === runnerSha : false, runnerPin ? runnerPin.sha256.slice(0, 16) + '…' : 'pin not found in statement');
    }
  }
}

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

// 4b. golden: adversarial challenge + fail-closed probes (v1.4.0)
if (key.adversarial) {
  check(`adversarial challenge — ${key.adversarial.count} two-bound probes, ${key.adversarial.generated}, ${key.adversarial.passed ? 'PASSED ✅' : 'FAILED ❌'}, exit ${key.adversarial.exit}`,
    pristineAdv.score === key.adversarial.generated && pristineAdv.passed === key.adversarial.passed && advRun.status === key.adversarial.exit,
    `got ${pristineAdv ? pristineAdv.score : 'unparsable'}, exit ${advRun.status}`);
} else {
  check('adversarial challenge present in the key (v1.4.0 surface 3)', false, 'key predates v1.4.0 — re-record');
}
if (key.failclosed) {
  check(`fail-closed probe: malformed card aborts (exit ${key.failclosed.malformed_card.exit}, "${key.failclosed.malformed_card.stderr_marker}")`,
    JSON.stringify(pristineMal) === JSON.stringify(key.failclosed.malformed_card),
    `got exit ${pristineMal.exit}, marker ${pristineMal.stderr_marker}`);
  check(`fail-closed probe: poisoned sidecar aborts (exit ${key.failclosed.poisoned_sidecar.exit}, "${key.failclosed.poisoned_sidecar.stderr_marker}")`,
    JSON.stringify(pristinePoi) === JSON.stringify(key.failclosed.poisoned_sidecar),
    `got exit ${pristinePoi.exit}, marker ${pristinePoi.stderr_marker}`);
} else {
  check('fail-closed probes present in the key (v1.4.0 surface 4)', false, 'key predates v1.4.0 — re-record');
}

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
