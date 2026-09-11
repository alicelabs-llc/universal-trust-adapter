#!/usr/bin/env node
/**
 * verify-artifact.mjs — Rekor-in-the-loop artifact verification (v1.4.0)
 * ============================================================================
 * anp2network (round 3, dev.to comment 3ehcp): "If a stranger pulls both the
 * scorer and its expected digest from the conformance hub, the comparison
 * never leaves that origin, and the log stays decorative in the actual
 * verification path. One line fixes it. Fetch the digest from the Rekor entry
 * directly, verify inclusion, then compare against the sha256 of the file
 * just downloaded."
 *
 * This is that line, made executable. The chain:
 *
 *   1. DOWNLOAD the artifact (any origin: the hub, GitHub, a local copy) and
 *      compute sha256 of the exact bytes received.
 *   2. FETCH the Rekor entry LIVE from rekor.sigstore.dev (by logIndex; the
 *      locator record is untrusted metadata — a wrong logIndex fails closed).
 *   3. VERIFY Rekor's own signatures: signedEntryTimestamp over the entry
 *      blob, the inclusion proof folding the leaf into the checkpoint root,
 *      and the checkpoint (signed tree head) signature.
 *   4. AUTHENTICATE the anchor statement: sha256(canonical statement) must
 *      equal the hash the ENTRY commits to. The statement may come from any
 *      origin — only Rekor's committed hash vouches for it.
 *   5. VERIFY the publisher's countersignature (throwaway P-256, key inside
 *      the entry) over the authenticated statement bytes.
 *   6. COMPARE the downloaded artifact's sha256 against the digests pinned in
 *      the AUTHENTICATED statement. A match means the bytes you downloaded
 *      are the bytes Rekor committed to at integration time. No match means
 *      the origin is serving something the log never saw.
 *
 * The digest never comes from the hub: the hub serves bytes, Rekor vouches.
 *
 * Usage:
 *   node verify-artifact.mjs <artifact-url-or-path>
 *   node verify-artifact.mjs https://www.marketnow.site/uta/conformance/score-runner.mjs
 *   node verify-artifact.mjs ./score-runner.mjs --statement ./anchor-statement-v5.json
 *   node verify-artifact.mjs <artifact> --record <anchor-record-v5 url-or-path>
 *                                       --statement <anchor-statement-v5 url-or-path>
 *
 * Node ≥ 18, zero dependencies.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash, createVerify, createPublicKey } from 'node:crypto';

const REKOR = 'https://rekor.sigstore.dev';
const HUB = 'https://www.marketnow.site/uta/conformance';
const DEFAULT_RECORD = `${HUB}/anchors/anchor-record-v5.json`;
const DEFAULT_STATEMENT = [`${HUB}/anchors/anchor-statement-v5.json`, 'anchor-statement-v5.json'];

const sha256hex = (b) => createHash('sha256').update(b).digest('hex');

// ---------- args ----------
const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const artifactRef = argv.find(a => !a.startsWith('--'));
if (!artifactRef) { console.error('usage: node verify-artifact.mjs <artifact-url-or-path> [--record <loc>] [--statement <loc>]'); process.exit(2); }
const recordRef = arg('--record') || DEFAULT_RECORD;
const statementRefs = [arg('--statement'), ...DEFAULT_STATEMENT].filter(Boolean);

// ---------- fetchers (URL or local path) ----------
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

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

// ---------- 1. the artifact ----------
let artifactBytes;
try { artifactBytes = await loadBytes(artifactRef); }
catch (e) { console.error(`✗ artifact could not be loaded from ${artifactRef}: ${e.message}`); process.exit(2); }
const artifactSha = sha256hex(artifactBytes);

console.log('=== Rekor-in-the-loop artifact verification (entry #5) ===');
console.log(`artifact: ${artifactRef}`);
console.log(`sha256:   ${artifactSha} (${artifactBytes.length} bytes)\n`);

// ---------- 2. the entry (live) ----------
let record;
try { record = await loadJson(recordRef); }
catch (e) { console.error(`✗ entry locator could not be loaded from ${recordRef}: ${e.message}`); process.exit(2); }
const logIndex = record?.log?.log_index;
const entries = await (await fetch(`${REKOR}/api/v1/log/entries?logIndex=${logIndex}`, { headers: { Accept: 'application/json' } })).json();
const uuid = Object.keys(entries)[0];
const entry = entries[uuid];
check('entry #5 fetched live from rekor.sigstore.dev', uuid === record?.log?.uuid,
  `logIndex ${logIndex}, integrated ${new Date((entry?.integratedTime || 0) * 1000).toISOString()}`);

// ---------- 3. Rekor's signatures ----------
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
check(`signedEntryTimestamp verifies with Rekor's live public key (${ktype})`, setOk);

const incl = entry.verification?.inclusionProof;
let inclOk = false, cpOk = false, treeSize = null;
if (incl) {
  const leafData = Buffer.from(entry.body, 'base64');
  let node = createHash('sha256').update(Buffer.concat([Buffer.from([0x00]), leafData])).digest();
  treeSize = parseInt(incl.checkpoint.split('\n')[1], 10);
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
check('checkpoint tree size covers our entry', incl ? incl.logIndex < treeSize : false);

// ---------- 4. the statement, authenticated against the entry ----------
const entryBody = JSON.parse(Buffer.from(entry.body, 'base64').toString('utf8'));
const entryHash = entryBody.spec?.data?.hash?.value;
const sortedCanon = (o) => Array.isArray(o) ? o.map(sortedCanon) : (o !== null && typeof o === 'object') ? Object.fromEntries(Object.keys(o).sort().map(k => [k, sortedCanon(o[k])])) : o;
let statement = null, canon = null, stFrom = null;
const stErrs = [];
for (const ref of statementRefs) {
  try {
    const j = await loadJson(ref);
    const c = Buffer.from(JSON.stringify(sortedCanon(j)), 'utf8');
    if (sha256hex(c) === entryHash) { statement = j; canon = c; stFrom = ref; break; }
    stErrs.push(`${ref}: hash mismatch (not the committed statement)`);
  } catch (e) { stErrs.push(`${ref}: ${e.message}`); }
}
check('anchor statement authenticated: sha256(statement) === the entry\'s committed hash', statement !== null, statement ? `from ${stFrom}` : stErrs.join(' | ').slice(0, 200));

// ---------- 5. the publisher's countersignature ----------
if (statement) {
  const sigB64 = entryBody.spec?.signature?.content;
  const keyB64 = entryBody.spec?.signature?.publicKey?.content;
  const v3 = createVerify('sha256');
  v3.update(canon);
  let csOk = false;
  try { csOk = v3.verify(Buffer.from(keyB64, 'base64').toString('utf8'), Buffer.from(sigB64, 'base64')); } catch { csOk = false; }
  check('countersignature (publisher throwaway P-256) verifies over the authenticated statement', csOk);
}

// ---------- 6. THE comparison: downloaded bytes vs Rekor-committed digests ----------
if (statement) {
  const pins = [];
  const walk = (node, path) => {
    if (Array.isArray(node)) { node.forEach((x, i) => walk(x, `${path}[${i}]`)); return; }
    if (node !== null && typeof node === 'object') {
      if (typeof node.sha256 === 'string' && /^[0-9a-f]{64}$/.test(node.sha256)) pins.push({ path: path.replace(/^digests\./, ''), sha256: node.sha256 });
      for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(statement, '');
  const match = pins.find(p => p.sha256 === artifactSha);
  check('the downloaded artifact IS a Rekor-committed pin', match !== undefined,
    match ? `pinned as "${match.path}" (${match.sha256.slice(0, 16)}…, ${pins.length} pins checked)` : `no pin matches ${artifactSha.slice(0, 16)}… (${pins.length} pins checked — the origin is serving bytes the log never saw, or the artifact is not v1.4.0)`);
} else {
  check('the downloaded artifact IS a Rekor-committed pin', false, 'cannot compare — the statement was not authenticated');
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail === 0
  ? '\nVERDICT: the bytes you downloaded are the bytes Rekor committed to — the log is in the verification path, not decorative.'
  : '\nVERDICT: the chain broke — do not trust the artifact bytes from this origin.');
process.exitCode = fail === 0 ? 0 : 1;
