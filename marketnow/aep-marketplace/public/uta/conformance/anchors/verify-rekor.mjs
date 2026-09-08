#!/usr/bin/env node
/**
 * Verify the UTA Rekor anchor — the stranger flow (no trust in this repo's bytes
 * beyond what the third party serves):
 *
 *   1. FETCH the entry from rekor.sigstore.dev by logIndex (third-party storage)
 *   2. CONTENT: the entry's data hash must equal sha256(anchor-statement canonical bytes)
 *   3. COUNTERSIGNATURE: the entry's ECDSA signature must verify with the published
 *      public key over sha256(statement)
 *   4. TIMESTAMP: Rekor's signedEntryTimestamp must verify with Rekor's public key
 *   5. INCLUSION: the Merkle proof must fold the leaf into the checkpoint root
 *   6. CHECKPOINT: the signed tree head must be signed by Rekor's key (C2SP note:
 *      4-byte key-hint prefix + signature over the note text before the "—" line)
 *
 * Usage: node verify-rekor.mjs [--record anchor-record.json] [--statement anchor-statement.json]
 */
import { readFileSync } from 'node:fs';
import { createHash, createVerify, createPublicKey } from 'node:crypto';

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : def;
};
const recordPath = arg('--record', 'anchor-record.json');
const statementPath = arg('--statement', 'anchor-statement.json');

const BASE = 'https://rekor.sigstore.dev';
const sha256 = (b) => createHash('sha256').update(b).digest('hex');

// ---------- load local anchor files ----------
const record = JSON.parse(readFileSync(recordPath, 'utf8'));
const statement = JSON.parse(readFileSync(statementPath, 'utf8'));

// canonical statement bytes (same rule as submission: recursive sorted keys, no whitespace)
function sorted(obj) {
  if (Array.isArray(obj)) return obj.map(sorted);
  if (obj !== null && typeof obj === 'object') {
    const out = {};
    for (const k of Object.keys(obj).sort()) out[k] = sorted(obj[k]);
    return out;
  }
  return obj;
}
const canonical = Buffer.from(JSON.stringify(sorted(statement)), 'utf8');
const statementSha = sha256(canonical);

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

console.log('=== UTA Rekor anchor verification ===');
console.log(`statement: ${statementSha} (${canonical.length} canonical bytes)\n`);

// ---------- 1. fetch the entry ----------
const entryUrl = `${BASE}/api/v1/log/entries?logIndex=${record.log.log_index}`;
const res = await fetch(entryUrl, { headers: { Accept: 'application/json' } });
if (!res.ok) { console.error(`✗ entry fetch failed: HTTP ${res.status}`); process.exit(1); }
const entries = JSON.parse(await res.text());
const key = Object.keys(entries)[0];
const entry = entries[key];
check('entry exists in rekor.sigstore.dev', key === record.log.uuid, `uuid ${key.slice(0, 16)}…`);
check('entry logID matches record', entry.logID === record.log.log_id, entry.logID.slice(0, 16) + '…');

// ---------- 2. content: entry hash === statement digest ----------
const entryBody = JSON.parse(Buffer.from(entry.body, 'base64').toString('utf8'));
const entryHash = entryBody.spec?.data?.hash?.value ?? entryBody.apiObject?.data?.hash?.value;
check('entry data hash === sha256(anchor-statement canonical bytes)', entryHash === statementSha, entryHash);

// ---------- 3. countersignature ----------
const sigB64 = entryBody.spec?.signature?.content ?? entryBody.apiObject?.signature?.content;
const keyB64 = entryBody.spec?.signature?.publicKey?.content ?? entryBody.apiObject?.signature?.publicKey?.content;
const sig = Buffer.from(sigB64, 'base64');
const pubPem = Buffer.from(keyB64, 'base64').toString('utf8');
const verify = createVerify('sha256');
verify.update(canonical);
let sigOk = false;
try { sigOk = verify.verify(pubPem, sig); } catch (e) { sigOk = false; }
check('countersignature verifies (ECDSA P-256 over sha256(statement))', sigOk);
const keyMatches = pubPem.trim() === record.countersignature.public_key_spki_pem.trim();
check('countersignature key matches the published anchor key', keyMatches);

// ---------- 4. signedEntryTimestamp (Rekor's signature over the entry blob) ----------
const rekorKeyRes = await fetch(`${BASE}/api/v1/log/publicKey`, {
  headers: { Accept: 'application/x-pem-file' },
});
const rekorPubPem = await rekorKeyRes.text();
const rekorKey = createPublicKey(rekorPubPem);
const rekorKeyType = rekorKey.asymmetricKeyType;
const set = entry.verification?.signedEntryTimestamp;
if (set) {
  // payload: Go struct order — body, integratedTime, logId, logIndex (NOT alphabetical)
  const blob = Buffer.from(
    JSON.stringify({
      body: entry.body,
      integratedTime: entry.integratedTime,
      logID: entry.logID,
      logIndex: entry.logIndex,
    }),
    'utf8',
  );
  const v = rekorKeyType === 'ed25519' ? createVerify(null) : createVerify('sha256');
  v.update(blob);
  let tsOk = false;
  try { tsOk = v.verify(rekorPubPem, Buffer.from(set, 'base64')); } catch { tsOk = false; }
  check(`signedEntryTimestamp verifies with Rekor key (${rekorKeyType})`, tsOk);
} else {
  check('signedEntryTimestamp present', false);
}

// ---------- 5. inclusion proof (local Merkle fold, RFC 6962 style) ----------
const incl = entry.verification?.inclusionProof;
if (incl) {
  const leafData = Buffer.from(entry.body, 'base64');
  const leafHash = Buffer.concat([Buffer.from([0x00]), leafData]);
  let node = createHash('sha256').update(leafHash).digest();
  const treeSize = parseInt(incl.checkpoint.split('\n')[1], 10);
  let idx = incl.logIndex;
  let last = treeSize - 1;
  const hashes = incl.hashes.map((h) => Buffer.from(h, 'hex'));
  for (const p of hashes) {
    let parent;
    if (idx === last || idx % 2 === 1) {
      parent = createHash('sha256').update(Buffer.concat([Buffer.from([0x01]), p, node])).digest();
    } else {
      parent = createHash('sha256').update(Buffer.concat([Buffer.from([0x01]), node, p])).digest();
    }
    node = parent;
    idx = Math.floor(idx / 2);
    last = Math.floor(last / 2);
  }
  check('inclusion proof folds leaf into rootHash', node.toString('hex') === incl.rootHash,
    `leaf idx ${incl.logIndex}, tree size ${treeSize}, ${incl.hashes.length} proof hashes`);

  // ---------- 6. checkpoint signature (C2SP signed note) ----------
  const checkpoint = incl.checkpoint;
  const sigLine = checkpoint.slice(checkpoint.lastIndexOf('— '));
  // C2SP note: signed blob = note text with a single trailing newline,
  // signature line = "— <key name> <base64(4-byte hint + signature)>"
  const noteText = checkpoint.slice(0, checkpoint.indexOf('— ')).replace(/\n\n$/, '\n');
  const noteBlob = Buffer.from(noteText, 'utf8');
  const sigAll = Buffer.from(sigLine.split(' ')[2].trim(), 'base64');
  const cpSig = sigAll.subarray(4); // strip 4-byte key-hint prefix
  const v2 = rekorKeyType === 'ed25519' ? createVerify(null) : createVerify('sha256');
  v2.update(noteBlob);
  let cpOk = false;
  try { cpOk = v2.verify(rekorPubPem, cpSig); } catch { cpOk = false; }
  check(`checkpoint (signed tree head) verifies with Rekor key (${rekorKeyType})`, cpOk,
    `tree size ${treeSize}, root ${incl.rootHash.slice(0, 16)}…`);
  check('checkpoint tree size covers our tree log index', incl.logIndex < treeSize);
} else {
  check('inclusion proof present', false);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
