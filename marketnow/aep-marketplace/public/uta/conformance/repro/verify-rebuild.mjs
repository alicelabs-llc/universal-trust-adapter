#!/usr/bin/env node
/**
 * Stranger-flow verification: does the source tree rebuild to the published bytes?
 *
 *   1. DOWNLOAD agent-trust-card-1.1.2.tgz from the npm registry (or use --tarball)
 *   2. CHECK its sha256 against the Rekor-anchored digest f1b44ed2…
 *   3. REBUILD the tar layer from the source tree + the stated rule
 *   4. COMPARE byte-for-byte: gunzip(published .tgz) === rebuilt tar
 *   5. (optional) CHECK the per-file source manifest
 *
 * Requirements: Node >= 18, network access to registry.npmjs.org.
 *
 * Usage:
 *   node verify-rebuild.mjs --src <path-to-atc-sdk>            # full flow (downloads)
 *   node verify-rebuild.mjs --src <path> --tarball <file.tgz>  # offline tarball
 *   node verify-rebuild.mjs --src <path> --manifest <file>     # + per-file check
 *
 * Get the source:  git clone https://github.com/alicelabs-llc/universal-trust-adapter
 *                  node verify-rebuild.mjs --src universal-trust-adapter/marketnow/atc-sdk
 */
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildTar, RULE } from './build-agent-trust-card.mjs';

const here = dirname(fileURLToPath(import.meta.url));
// default source: <repo-root>/marketnow/atc-sdk relative to this script
const DEFAULT_SRC = resolve(here, '../../../marketnow/atc-sdk');

const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : def;
};

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

const srcDir = arg('--src', DEFAULT_SRC);
if (!srcDir || !existsSync(srcDir)) {
  console.error('usage: node verify-rebuild.mjs --src <atc-sdk source dir> [--tarball <file>] [--manifest <file>]');
  console.error(`       default --src resolved to: ${DEFAULT_SRC}`);
  console.error('       get the source: git clone https://github.com/alicelabs-llc/universal-trust-adapter');
  process.exit(2);
}

console.log('=== agent-trust-card@1.1.2 — source-tree rebuild verification ===\n');

// ---------- 1. obtain the published tarball ----------
let published;
const tarballPath = arg('--tarball', null);
if (tarballPath && existsSync(tarballPath)) {
  published = readFileSync(tarballPath);
  console.log(`tarball: local file ${tarballPath}`);
} else {
  const url = RULE.tarball.registry;
  const res = await fetch(url);
  if (!res.ok) { console.error(`✗ registry download failed: HTTP ${res.status}`); process.exit(1); }
  published = Buffer.from(await res.arrayBuffer());
  console.log(`tarball: downloaded from ${url}`);
}

// ---------- 2. anchored digest ----------
const pubSha = sha256(published);
check(`published .tgz sha256 === anchored digest (${RULE.tarball.sha256.slice(0, 16)}…)`,
  pubSha === RULE.tarball.sha256, `${pubSha} (${published.length} bytes)`);

// ---------- 3. rebuild from source ----------
let tar;
try {
  tar = buildTar(srcDir);
} catch (e) {
  check('rebuild from source', false, e.message);
  process.exit(1);
}
check('rebuild produced a tar', true, `${tar.length} bytes, sha256 ${sha256(tar).slice(0, 16)}…`);

// ---------- 4. byte-for-byte comparison ----------
const pubTar = gunzipSync(published);
check('gunzip(published) === rebuilt tar — BYTE-FOR-BYTE', pubTar.equals(tar),
  pubTar.equals(tar) ? `${pubTar.length} bytes identical` : 'differs');

// ---------- 5. per-file manifest (bytes published) ----------
const manifestPath = arg('--manifest', null);
if (manifestPath && existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  let allOk = true;
  for (const [srcRel, info] of Object.entries(manifest.files)) {
    const raw = readFileSync(`${srcDir}/${srcRel}`);
    const ok = sha256(raw) === info.sha256 && raw.length === info.bytes;
    if (!ok) { allOk = false; console.log(`    ✗ ${srcRel}: expected ${info.sha256.slice(0, 12)}…, got ${sha256(raw).slice(0, 12)}…`); }
  }
  check('per-file source manifest (12 files)', allOk);
} else {
  console.log('i (optional) per-file manifest: skipped — pass --manifest source-manifest.json');
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log('\nNext: verify the digests are anchored in Rekor — node verify-rekor.mjs (in tests/anchors/)');
process.exitCode = fail ? 1 : 0;
