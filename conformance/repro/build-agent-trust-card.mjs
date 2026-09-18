#!/usr/bin/env node
/**
 * Deterministic rebuild of the agent-trust-card@1.1.2 npm tarball — TAR LAYER.
 *
 * The published .tgz (sha256 f1b44ed2…) is an npm artifact whose deflate stream
 * depends on the publisher's zlib build. The rebuild claim therefore targets the
 * layer that is fully determined by content + rule: the uncompressed tar.
 *
 * Rule (empirically derived, verified against the published bytes):
 *   1. Twelve file entries, in a fixed order (see RULE.entries).
 *   2. Every entry: typeflag '0', mode 0644, mtime 499162500, uid/gid fields
 *      all-NUL (empty), uname/gname empty, magic "ustar\0", version "00",
 *      devmajor/devminor "000000\0 " (6 zeros + space + NUL), prefix empty,
 *      checksum = sum(header with checksum field as 8 spaces) as 6 octal digits
 *      + space + NUL. Numeric fields are 11 octal digits + space + NUL; mode is
 *      6 octal digits + space + NUL.
 *   3. Content transformation:
 *      - package.json: parsed as JSON and re-serialized with the publisher's
 *        format (UTF-8 BOM, CRLF, 4-space base indent, two spaces after each
 *        colon, nested object/array openers aligned at column
 *        indent + keyLen + 5 with children at opener+4 and closers at opener,
 *        `<`/`>` escaped as \u003c/\u003e, file ends with `}\r\n`).
 *      - all other files: every LF converted to CRLF, bytes otherwise verbatim.
 *   4. Tar ends with two 512-byte zero blocks; no trailing bytes.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const RULE = {
  tarball: {
    name: 'agent-trust-card-1.1.2.tgz',
    sha256: 'f1b44ed29eea0ca9eee65c1e0974c5d2b4b512378c6d21edb6344daf9184641a',
    bytes: 26782,
    registry: 'https://registry.npmjs.org/agent-trust-card/-/agent-trust-card-1.1.2.tgz',
  },
  fixed: { mode: 0o644, mtime: 499162500 },
  // [tarPath, sourcePath] — tar entry order is part of the rule
  entries: [
    ['package/LICENSE', 'LICENSE'],
    ['package/src/v3/atc-v3.js', 'src/v3/atc-v3.js'],
    ['package/package.json', 'package.json'],
    ['package/CONFORMANCE.md', 'CONFORMANCE.md'],
    ['package/README.md', 'README.md'],
    ['package/bin/atc.mjs', 'bin/atc.mjs'],
    ['package/src/index.mjs', 'src/index.mjs'],
    ['package/src/issue.mjs', 'src/issue.mjs'],
    ['package/src/keys.mjs', 'src/keys.mjs'],
    ['package/src/verify.mjs', 'src/verify.mjs'],
    ['package/src/v3/atc-v3.d.ts', 'src/v3/atc-v3.d.ts'],
    ['package/src/v3/atc-v3.ts', 'src/v3/atc-v3.ts'],
  ],
};

// ---------- publisher-format JSON serializer (PowerShell 5.1 ConvertTo-Json shape) ----------
function psEscape(s) {
  let out = '';
  for (const ch of s) {
    if (ch === '"') out += '\\"';
    else if (ch === '\\') out += '\\\\';
    else if (ch === '<') out += '\\u003c';
    else if (ch === '>') out += '\\u003e';
    else if (ch === '&') out += '\\u0026';
    else if (ch === '\b') out += '\\b';
    else if (ch === '\f') out += '\\f';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (ch.charCodeAt(0) < 0x20) out += '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');
    else out += ch; // non-ASCII stays raw UTF-8
  }
  return out;
}

function psPrimitive(v) {
  if (v === null) return 'null';
  if (typeof v === 'string') return `"${psEscape(v)}"`;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return String(v);
  throw new Error(`unsupported primitive: ${typeof v}`);
}

/** Serialize a non-empty object/array in the publisher's format.
 *  childIndent: column of this container's child lines (opener sits at
 *  childIndent-4 for the top level; nested openers are computed per-key).
 *  Returns { opener, childLines, closer }: opener is '{' or '[', closer is
 *  the closing line at column childIndent-4, childLines carry their commas. */
function psContainer(value, childIndent) {
  const lines = [];
  let opener, closer;
  if (Array.isArray(value)) {
    if (value.length === 0) throw new Error('empty array not supported');
    opener = '[';
    closer = ' '.repeat(childIndent - 4) + ']';
    for (let i = 0; i < value.length; i++) {
      const comma = i === value.length - 1 ? '' : ',';
      lines.push(' '.repeat(childIndent) + psPrimitive(value[i]) + comma);
    }
    return { opener, childLines: lines, closer };
  }
  const keys = Object.keys(value);
  if (keys.length === 0) throw new Error('empty object not supported');
  opener = '{';
  closer = ' '.repeat(childIndent - 4) + '}';
  for (let idx = 0; idx < keys.length; idx++) {
    const k = keys[idx];
    const v = value[k];
    const comma = idx === keys.length - 1 ? '' : ',';
    if (v !== null && typeof v === 'object') {
      const openerCol = childIndent + k.length + 5; // "key":  { … opener column
      const sub = psContainer(v, openerCol + 4);
      lines.push(' '.repeat(childIndent) + `"${k}":  ${sub.opener}`);
      lines.push(...sub.childLines);
      lines.push(sub.closer + comma); // closer already carries its own indent
    } else {
      lines.push(' '.repeat(childIndent) + `"${k}":  ${psPrimitive(v)}${comma}`);
    }
  }
  return { opener, childLines: lines, closer };
}

function serializePackageJson(obj) {
  const top = psContainer(obj, 4); // top-level keys at indent 4, closer at 0
  const body = top.childLines.join('\r\n');
  return Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]), // BOM
    Buffer.from(`${top.opener}\r\n${body}\r\n${top.closer}\r\n`, 'utf8'),
  ]);
}

// ---------- USTAR header writer (publisher's exact field formats) ----------
function octal(value, digits) {
  const s = value.toString(8).padStart(digits, '0');
  return s + ' \0'; // digits + space + NUL
}

function tarHeader(name, size, mtime, mode) {
  const h = Buffer.alloc(512);
  h.write(name, 0, 'utf8'); // NUL padding stays 0
  h.write(octal(mode, 6), 100, 'ascii'); // "000644 \0"
  // uid/gid: 8 NUL bytes each (empty fields) — already zero
  h.write(octal(size, 10), 124, 'ascii'); // 10 octal digits + space + NUL
  h.write(octal(mtime, 10), 136, 'ascii');
  // checksum placeholder: 8 spaces
  h.fill(0x20, 148, 156);
  h[156] = 0x30; // typeflag '0'
  h.write('ustar\0', 257, 'ascii');
  h.write('00', 263, 'ascii');
  h.write('000000 \0', 329, 'ascii'); // devmajor
  h.write('000000 \0', 337, 'ascii'); // devminor
  // checksum: sum of all header bytes with checksum field as spaces
  let sum = 0;
  for (const b of h) sum += b;
  const chk = sum.toString(8).padStart(6, '0') + ' \0';
  h.write(chk, 148, 'ascii');
  return h;
}

function pad512(size) {
  const rem = size % 512;
  return rem === 0 ? 0 : 512 - rem;
}

// ---------- build ----------
function buildTar(srcDir, { verbose = false } = {}) {
  const chunks = [];
  for (const [tarPath, srcRel] of RULE.entries) {
    const srcPath = `${srcDir}/${srcRel}`;
    if (!existsSync(srcPath)) throw new Error(`missing source file: ${srcPath}`);
    const raw = readFileSync(srcPath);
    let content;
    if (srcRel === 'package.json') {
      content = serializePackageJson(JSON.parse(raw.toString('utf8')));
    } else {
      content = Buffer.from(raw.toString('utf8').replace(/\r?\n/g, '\r\n'), 'utf8');
    }
    const header = tarHeader(tarPath, content.length, RULE.fixed.mtime, RULE.fixed.mode);
    chunks.push(header, content, Buffer.alloc(pad512(content.length)));
    if (verbose) console.error(`  + ${tarPath} (${content.length} bytes)`);
  }
  chunks.push(Buffer.alloc(1024)); // two zero blocks
  return Buffer.concat(chunks);
}

// ---------- CLI ----------
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const argv = process.argv.slice(2);
  const srcIdx = argv.indexOf('--src');
  const outIdx = argv.indexOf('--out');
  const verifyIdx = argv.indexOf('--verify');

  const srcDir = srcIdx >= 0 ? argv[srcIdx + 1] : '/home/z/my-project/uta-repo/marketnow/atc-sdk';
  const tar = buildTar(srcDir, { verbose: true });
  const tarSha = createHash('sha256').update(tar).digest('hex');
  console.log(`built tar: ${tar.length} bytes, sha256 ${tarSha}`);

  if (outIdx >= 0) {
    writeFileSync(argv[outIdx + 1], tar);
    console.log(`written: ${argv[outIdx + 1]}`);
  }

  if (verifyIdx >= 0) {
    const published = readFileSync(argv[verifyIdx + 1]);
    const pubSha = createHash('sha256').update(published).digest('hex');
    const pubTar = gunzipSync(published);
    console.log(`published .tgz sha256: ${pubSha} ${pubSha === RULE.tarball.sha256 ? '✓ matches anchored digest' : '✗ MISMATCH'}`);
    console.log(`tar layer identical: ${pubTar.equals(tar) ? '✓ YES — byte-for-byte' : '✗ NO'}`);
    if (!pubTar.equals(tar)) {
      const n = Math.min(pubTar.length, tar.length);
      let first = -1;
      for (let i = 0; i < n; i++) if (pubTar[i] !== tar[i]) { first = i; break; }
      console.log(`first difference at byte ${first} (lengths: published ${pubTar.length} vs built ${tar.length})`);
      process.exitCode = 1;
    }
  }
}

export { buildTar, RULE, serializePackageJson };
