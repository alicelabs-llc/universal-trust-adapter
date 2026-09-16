#!/usr/bin/env node
/**
 * verify-artifact.mjs — Rekor-in-the-loop artifact verification (v1.5.0)
 * ============================================================================
 * ROUND 3 (dev.to comment 3ehcp): "If a stranger pulls both the scorer and
 * its expected digest from the conformance hub, the comparison never leaves
 * that origin, and the log stays decorative in the actual verification path.
 * One line fixes it. Fetch the digest from the Rekor entry directly, verify
 * inclusion, then compare against the sha256 of the file just downloaded."
 * → Single-artifact mode. Unchanged from v1.4.0 (defaults re-pointed at the
 *   newest anchor, entry #6).
 *
 * ROUND 4 (dev.to comment 3ehp6): "Entry #5 anchors eleven digests and the
 * live fetch does close the substitution path you were aiming at. ... But
 * inclusion proves a record exists in the log. It says nothing about that
 * record being the current authorized state for score-runner. And the hub is
 * what hands verify-artifact.mjs the entry to check. Serve an older,
 * legitimately anchored runner together with the artifact that matched it at
 * the time, and every step you listed passes: statement authenticates,
 * signatures verify, the fold checks out, sha256 agrees. Rollback, fully
 * signed. ... What I would want is rollback resistance as a named verifier
 * property."
 * → Release-chain mode (--release). The answer to the round-4 closing
 *   question — "what authenticated per-identity freshness reference do you
 *   want verify-artifact.mjs to demand, so that a hub-chosen, previously
 *   valid runner cannot pass as the current release?":
 *
 *   THE RELEASE CHAIN. A persistent release identity (Ed25519 — the first
 *   key in this project that is NOT a throwaway and NOT published: it exists
 *   precisely so that counters cannot be forged; its public half is anchored
 *   in Rekor entry #6) signs monotone release statements:
 *
 *     release_counter: 1, 2, 3, ...        (strictly monotone)
 *     artifacts: { name: sha256 }           (the current authorized state)
 *     previous_release: { counter, sha256 } (hash chain to predecessor)
 *     released_at / suite_version
 *
 *   The verifier keeps LOCAL STATE (.uta-verify-state.json): the highest
 *   counter it has accepted, that statement's sha256, and the Rekor
 *   checkpoint it saw. It REFUSES:
 *     - a lower counter              (rollback to a previously-valid release)
 *     - a same counter, other hash   (fork / conflict at a counter)
 *   and when ADVANCING it consistency-proves: the new statement's
 *   previous_release.sha256 must chain to the accepted one, and its anchor
 *   must sit at a HIGHER log index than the accepted checkpoint recorded
 *   (monotone in the append-only log too).
 *
 *   FIRST CONTACT (the residual anp2network named: "a fresh verifier has no
 *   local memory and takes whatever prefix the hub shows it") is bounded two
 *   ways: (1) BOOTSTRAP FLOOR — the release anchor must live at a log index
 *   strictly greater than entry #5's (2787622029), the last pre-chain
 *   anchor, so history cannot be restarted below the known floor; (2) the
 *   release IDENTITY only exists in statements anchored at or after entry
 *   #6 — an older entry (#2, #5) carries no identity, so an old anchor
 *   cannot impersonate a release. What first contact still cannot do is know
 *   that a NEWER release than the one it found exists. That is irreducible
 *   without local memory or an out-of-band hint; the state file buys
 *   monotonicity from the first accepted release onward.
 *
 * Usage:
 *   node verify-artifact.mjs <artifact-url-or-path>            # round-3 flow (entry #6)
 *   node verify-artifact.mjs --release                         # round-4 flow, hub defaults
 *   node verify-artifact.mjs --release --artifact <url-or-path>
 *   node verify-artifact.mjs --release --statement <r1-url-or-path> --state <path>
 *
 * Node ≥ 18, zero dependencies.
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { createHash, createVerify, createPublicKey, verify } from 'node:crypto';

const REKOR = 'https://rekor.sigstore.dev';
const HUB = 'https://www.marketnow.site/uta/conformance';
const DEFAULT_RECORD = `${HUB}/anchors/anchor-record-v7.json`;
const DEFAULT_STATEMENT = [`${HUB}/anchors/anchor-statement-v7.json`, 'anchor-statement-v7.json'];
const DEFAULT_RELEASE = [`${HUB}/releases/release-statement-r2.json`, 'release-statement-r2.json'];
const DEFAULT_STATE = './.uta-verify-state.json';
// v1.5.0 — first-contact floor: the last pre-release-chain anchor (entry #5).
// A release anchor at or below this index is a restart of history, refused.
const BOOTSTRAP_FLOOR = 2787622029;

const sha256hex = (b) => createHash('sha256').update(b).digest('hex');
const sortedCanon = (o) => Array.isArray(o) ? o.map(sortedCanon) : (o !== null && typeof o === 'object') ? Object.fromEntries(Object.keys(o).sort().map(k => [k, sortedCanon(o[k])])) : o;

// ---------- args ----------
const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const RELEASE_MODE = argv.includes('--release');
// positional artifact = first token that is neither a flag nor a flag VALUE
const VALUE_FLAGS = new Set(['--record', '--statement', '--release-statement', '--artifact', '--state']);
const positional = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) { if (VALUE_FLAGS.has(argv[i])) i++; continue; }
  positional.push(argv[i]);
}
const artifactRef = positional[0];
const recordRef = arg('--record') || DEFAULT_RECORD;
const statementRefs = [arg('--statement'), ...DEFAULT_STATEMENT].filter(Boolean);
const releaseRefs = RELEASE_MODE ? [arg('--release-statement'), ...DEFAULT_RELEASE].filter(Boolean) : [];
const releaseArtifactRef = arg('--artifact') || artifactRef;
const statePath = arg('--state') || DEFAULT_STATE;

// ---------- fetchers ----------
const loadBytes = async (ref) => {
  if (ref.startsWith('http://') || ref.startsWith('https://')) {
    const r = await fetch(ref);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }
  if (!existsSync(ref)) throw new Error('file not found');
  return readFileSync(ref);
};
const loadJson = async (ref) => JSON.parse((await loadBytes(ref)).toString('utf8'));
const loadFirst = async (refs, what) => {
  const errs = [];
  for (const ref of refs) {
    try { return { ref, json: await loadJson(ref) }; } catch (e) { errs.push(`${ref}: ${e.message}`); }
  }
  throw new Error(`${what} could not be loaded — ${errs.join(' | ')}`);
};

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

// ---------- shared: fetch an entry LIVE + verify Rekor's signatures ----------
const verifyEntryLive = async (locator, label) => {
  const logIndex = locator?.log?.log_index;
  const entries = await (await fetch(`${REKOR}/api/v1/log/entries?logIndex=${logIndex}`, { headers: { Accept: 'application/json' } })).json();
  const uuid = Object.keys(entries)[0];
  const entry = entries[uuid];
  if (!entry) { check(`${label} fetched live from rekor.sigstore.dev`, false, `logIndex ${logIndex} not found`); return null; }
  check(`${label} fetched live from rekor.sigstore.dev`, uuid === locator?.log?.uuid,
    `logIndex ${logIndex}, integrated ${new Date((entry.integratedTime || 0) * 1000).toISOString()}`);
  const rekorPubPem = await (await fetch(`${REKOR}/api/v1/log/publicKey`, { headers: { Accept: 'application/x-pem-file' } })).text();
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
  check(`signedEntryTimestamp verifies with Rekor's live key (${ktype})`, setOk);
  const incl = entry.verification?.inclusionProof;
  let inclOk = false, cpOk = false, treeSize = null, rootHash = null;
  if (incl) {
    const leafData = Buffer.from(entry.body, 'base64');
    let node = createHash('sha256').update(Buffer.concat([Buffer.from([0x00]), leafData])).digest();
    treeSize = parseInt(incl.checkpoint.split('\n')[1], 10);
    rootHash = incl.rootHash;
    let i = incl.logIndex, last = treeSize - 1;
    for (const h of incl.hashes.map(x => Buffer.from(x, 'hex'))) {
      node = (i === last || i % 2 === 1)
        ? createHash('sha256').update(Buffer.concat([Buffer.from([0x01]), h, node])).digest()
        : createHash('sha256').update(Buffer.concat([Buffer.from([0x01]), node, h])).digest();
      i = Math.floor(i / 2); last = Math.floor(last / 2);
    }
    inclOk = node.toString('hex') === incl.rootHash;
    const sigLine = incl.checkpoint.slice(incl.checkpoint.lastIndexOf('— '));
    const noteText = incl.checkpoint.slice(0, incl.checkpoint.indexOf('— ')).replace(/\n\n$/, '\n');
    const sigAll = Buffer.from(sigLine.split(' ')[2].trim(), 'base64');
    const v2 = ktype === 'ed25519' ? createVerify(null) : createVerify('sha256');
    v2.update(Buffer.from(noteText, 'utf8'));
    try { cpOk = v2.verify(rekorPubPem, sigAll.subarray(4)); } catch { cpOk = false; }
  }
  check('inclusion proof folds the leaf into the checkpoint root', inclOk, `tree size ${treeSize}, ${incl?.hashes?.length ?? 0} proof hashes`);
  check('checkpoint (signed tree head) verifies with Rekor\'s key', cpOk);
  check('checkpoint tree size covers the entry', incl ? incl.logIndex < treeSize : false);
  const entryBody = JSON.parse(Buffer.from(entry.body, 'base64').toString('utf8'));
  const entryHash = entryBody.spec?.data?.hash?.value;
  const sigB64 = entryBody.spec?.signature?.content;
  const keyB64 = entryBody.spec?.signature?.publicKey?.content;
  return { entry, entryBody, entryHash, sigB64, keyB64, treeSize, rootHash, logIndex };
};

// ---------- shared: authenticate a statement against the entry's committed hash ----------
const authenticateStatement = async (live, refs, label) => {
  const errs = [];
  for (const ref of refs) {
    try {
      const j = await loadJson(ref);
      const c = Buffer.from(JSON.stringify(sortedCanon(j)), 'utf8');
      if (sha256hex(c) === live.entryHash) return { json: j, canon: c, from: ref };
      errs.push(`${ref}: hash mismatch (not the committed statement)`);
    } catch (e) { errs.push(`${ref}: ${e.message}`); }
  }
  check(`${label} authenticated: sha256(statement) === the entry's committed hash`, false, errs.join(' | ').slice(0, 220));
  return null;
};

// ---------- shared: publisher throwaway P-256 countersignature ----------
const verifyCountersignature = (live, canon, label) => {
  const v3 = createVerify('sha256');
  v3.update(canon);
  let csOk = false;
  try { csOk = v3.verify(Buffer.from(live.keyB64, 'base64').toString('utf8'), Buffer.from(live.sigB64, 'base64')); } catch { csOk = false; }
  check(`${label} countersignature (publisher throwaway P-256) verifies over the authenticated statement`, csOk);
  return csOk;
};

// ============================================================================
// RELEASE-CHAIN MODE — rollback resistance (round 4, v1.5.0)
// ============================================================================
if (RELEASE_MODE) {
  console.log('=== UTA release-chain verification (rollback resistance, v1.5.0) ===\n');

  // 1. the anchor entry, live (locator is untrusted metadata — wrong one fails closed)
  let locator;
  try { locator = await loadJson(recordRef); }
  catch (e) { console.error(`✗ entry locator could not be loaded from ${recordRef}: ${e.message}`); process.exit(2); }
  const live = await verifyEntryLive(locator, 'release anchor (entry #6)');

  // 2. first-contact floor: the release anchor must sit ABOVE the bootstrap floor
  check(`first-contact floor: anchor logIndex ${live?.logIndex} > bootstrap floor ${BOOTSTRAP_FLOOR} (entry #5)`,
    !!live && live.logIndex > BOOTSTRAP_FLOOR,
    live ? '' : 'entry not verifiable — refused');

  // 3. the anchor statement (release identity + release-statement hash), authenticated
  let anchorStatement = null;
  if (live) {
    anchorStatement = await authenticateStatement(live, statementRefs, 'anchor statement');
    if (anchorStatement) verifyCountersignature(live, anchorStatement.canon, 'anchor');
  }

  // 4. the release identity, extracted from the AUTHENTICATED anchor statement
  let releaseIdentity = null;
  if (anchorStatement) {
    releaseIdentity = anchorStatement.json.release_identity;
    check('release identity present in the authenticated anchor statement (public key + policy)',
      !!releaseIdentity?.public_key_spki_b64,
      releaseIdentity?.identity ?? 'missing');
  }

  // 5. the release statement: fetched from anywhere, authenticated by Ed25519
  //    under the identity from the live-anchored statement — NOT by provenance
  let release = null;
  if (releaseIdentity) {
    try {
      const { ref, json } = await loadFirst(releaseRefs, 'release statement');
      const { signature, ...subtree } = json;
      const canon = Buffer.from(JSON.stringify(sortedCanon(subtree)), 'utf8');
      const relSha = sha256hex(canon);
      // a) the anchor statement must commit to THIS release statement's hash
      const r1Pin = anchorStatement.json.release_statement?.sha256 || Object.entries(anchorStatement.json.digests || {}).find(([k]) => k.startsWith('release_statement'))?.[1]?.sha256;
      check('release statement is the one the anchor committed to (sha256 pinned in the authenticated anchor)',
        r1Pin === relSha, `release sha256 ${relSha.slice(0, 16)}…`);
      // b) Ed25519 signature under the persistent release identity
      const identKey = createPublicKey({ key: Buffer.from(releaseIdentity.public_key_spki_b64, 'base64'), format: 'der', type: 'spki' });
      let sigOk = false;
      if (signature?.value) {
        try { sigOk = verify(null, canon, identKey, Buffer.from(signature.value, 'hex')); } catch { sigOk = false; }
      }
      check('release statement signature verifies under the persistent release identity (Ed25519)', sigOk, `from ${ref}`);
      if (r1Pin === relSha && sigOk) release = { json, subtree, canon, sha: relSha };
    } catch (e) {
      check('release statement loads and authenticates', false, e.message.slice(0, 200));
    }
  }

  // 6. ROLLBACK RESISTANCE — the local-state rules
  if (release) {
    const counter = release.json.release_counter;
    console.log(`\nrelease counter ${counter} (suite v${release.json.suite_version}, ${release.json.released_at})`);
    const prior = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : null;
    if (prior) console.log(`local state: highest accepted counter ${prior.highest_counter} (logIndex ${prior.log_index})`);
    else console.log(`local state: none — FIRST CONTACT (bounded by the floor above)`);

    let accept = false;
    if (!prior) {
      accept = true;
      check('first contact: release counter >= 1 and anchor above the floor', counter >= 1 && live.logIndex > BOOTSTRAP_FLOOR);
    } else if (counter < prior.highest_counter) {
      check(`MONOTONICITY: counter ${counter} >= highest accepted ${prior.highest_counter}`, false,
        `REFUSED — ROLLBACK: this release was valid once; the hub is serving it as current. Accepting it would silently undo release ${prior.highest_counter}.`);
    } else if (counter === prior.highest_counter) {
      if (release.sha === prior.statement_sha256) {
        accept = true;
        check(`idempotent re-accept: counter ${counter}, same statement hash`, true, `${release.sha.slice(0, 16)}…`);
      } else {
        check(`NO CONFLICT at counter ${counter}: statement hash matches the accepted one`, false,
          `REFUSED — FORK: two different statements claim release counter ${counter}. The publisher's identity signed both only if the private key leaked.`);
      }
    } else { // counter > prior.highest_counter — advancing
      const prev = release.json.previous_release;
      const chainOk = prev ? (prev.counter === prior.highest_counter && prev.sha256 === prior.statement_sha256) : false;
      check(`chain linkage: previous_release (${prev ? prev.counter : 'null'}) matches the accepted release ${prior.highest_counter}`, chainOk,
        prev ? '' : `release ${counter} declares no predecessor but local state exists — REFUSED`);
      const logMonotone = live.logIndex > prior.log_index;
      check(`log monotonicity: anchor logIndex ${live.logIndex} > accepted ${prior.log_index}`, logMonotone,
        logMonotone ? '' : 'REFUSED — the new release anchors BELOW the previously accepted checkpoint: history is being rewritten, not appended');
      const treeGrew = live.treeSize > (prior.tree_size ?? 0);
      check(`consistency: checkpoint tree grew (${prior.tree_size ?? '?'} → ${live.treeSize})`, treeGrew,
        treeGrew ? `root ${live.rootHash.slice(0, 16)}…` : 'REFUSED — the tree did not grow: not a fresh append');
      accept = chainOk && logMonotone && treeGrew;
    }

    if (accept) {
      writeFileSync(statePath, JSON.stringify({
        highest_counter: counter,
        statement_sha256: release.sha,
        log_index: live.logIndex,
        tree_size: live.treeSize,
        root_hash: live.rootHash,
        recorded_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      }, null, 2) + '\n');
      check(`local state advanced → counter ${counter} recorded (${statePath})`, true);
    }

    // 7. optional artifact check against the CURRENT (non-rolled-back) release
    if (accept && releaseArtifactRef) {
      let artifactBytes;
      try { artifactBytes = await loadBytes(releaseArtifactRef); }
      catch (e) { check('artifact loads', false, e.message.slice(0, 160)); artifactBytes = null; }
      if (artifactBytes) {
        const aSha = sha256hex(artifactBytes);
        const arts = release.json.artifacts || {};
        const hit = Object.entries(arts).find(([name, a]) => (typeof a === 'string' ? a : a?.sha256) === aSha);
        check('the downloaded artifact IS the current release\'s pinned bytes', !!hit,
          hit ? `${hit[0]} (${aSha.slice(0, 16)}…, ${Object.keys(arts).length} artifacts pinned)` : `no pin in release ${counter} matches ${aSha.slice(0, 16)}… — the origin is serving bytes the current release never authorized`);
      }
    }
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail === 0
    ? '\nVERDICT: release chain verified — current release is the highest counter this verifier has ever accepted; rollbacks, forks and below-floor anchors are refused.'
    : '\nVERDICT: the release chain broke — treat this origin as serving a stale or unauthorized state.');
  process.exitCode = fail === 0 ? 0 : 1;
  process.exit(); // release mode does not also run the single-artifact flow
}

// ============================================================================
// SINGLE-ARTIFACT MODE — the round-3 "one line", unchanged (defaults → #6)
// ============================================================================
let artifactBytes;
try { artifactBytes = await loadBytes(artifactRef); }
catch (e) { console.error(`✗ artifact could not be loaded from ${artifactRef}: ${e.message}`); process.exit(2); }
const artifactSha = sha256hex(artifactBytes);

console.log('=== Rekor-in-the-loop artifact verification (entry #6) ===');
console.log(`artifact: ${artifactRef}`);
console.log(`sha256:   ${artifactSha} (${artifactBytes.length} bytes)\n`);

// the entry (live)
let record;
try { record = await loadJson(recordRef); }
catch (e) { console.error(`✗ entry locator could not be loaded from ${recordRef}: ${e.message}`); process.exit(2); }
const live = await verifyEntryLive(record, 'entry #6');

// the statement, authenticated against the entry's committed hash
let statement = null;
if (live) {
  statement = await authenticateStatement(live, statementRefs, 'anchor statement');
  if (statement) verifyCountersignature(live, statement.canon, 'anchor');
}

// THE comparison: downloaded bytes vs Rekor-committed digests
if (statement) {
  const pins = [];
  const walk = (node, path) => {
    if (Array.isArray(node)) { node.forEach((x, i) => walk(x, `${path}[${i}]`)); return; }
    if (node !== null && typeof node === 'object') {
      if (typeof node.sha256 === 'string' && /^[0-9a-f]{64}$/.test(node.sha256)) pins.push({ path: path.replace(/^digests\./, ''), sha256: node.sha256 });
      for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(statement.json, '');
  const match = pins.find(p => p.sha256 === artifactSha);
  check('the downloaded artifact IS a Rekor-committed pin', match !== undefined,
    match ? `pinned as "${match.path}" (${match.sha256.slice(0, 16)}…, ${pins.length} pins checked)` : `no pin matches ${artifactSha.slice(0, 16)}… (${pins.length} pins checked — the origin is serving bytes the log never saw, or the artifact is not the current release)`);
} else {
  check('the downloaded artifact IS a Rekor-committed pin', false, 'cannot compare — the statement was not authenticated');
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail === 0
  ? '\nVERDICT: the bytes you downloaded are the bytes Rekor committed to — the log is in the verification path, not decorative.\n(note: this proves the bytes are LOG-known, not that they are the CURRENT release — run with --release for rollback resistance)'
  : '\nVERDICT: the chain broke — do not trust the artifact bytes from this origin.');
process.exitCode = fail === 0 ? 0 : 1;
