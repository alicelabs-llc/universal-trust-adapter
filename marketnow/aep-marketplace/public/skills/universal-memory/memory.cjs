#!/usr/bin/env node
/**
 * universal-memory — memory.js
 * Persistent local memory for ANY AI agent. Zero dependencies, zero network.
 *
 * Store:   ~/.universal-memory/memory.jsonl  (global)
 *          ./.universal-memory/memory.jsonl  (project)
 * License: MIT — (c) 2026 AliceLabs / MarketNow
 *
 * Commands:
 *   remember <text> [--type T] [--scope S] [--tag x] [--agent A]  store a memory
 *   recall <query> [--limit N] [--scope S]                        search memories
 *   profile [--scope S]                                           grouped summary
 *   forget <id> [--scope S]                                        delete a memory (real delete)
 *   stats                                                         counts
 *   export [--format md|json] [--scope S]                          dump
 *   doctor                                                        health check
 *
 * Types:    decision | rule | preference | fact | context
 * Scopes:   global | project
 * Add --json to any command for machine-readable output.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const VERSION = '1.0.0';
const TYPES = ['decision', 'rule', 'preference', 'fact', 'context'];
const SCOPES = ['global', 'project'];
const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'to', 'and', 'or', 'in',
  'on', 'for', 'is', 'are', 'was', 'do', 'does', 'did', 'with', 'that',
  'this', 'it', 'we', 'i', 'you', 'my', 'our', 'me', 'what', 'how']);

function storePath(scope) {
  return scope === 'project'
    ? path.join(process.cwd(), '.universal-memory', 'memory.jsonl')
    : path.join(os.homedir(), '.universal-memory', 'memory.jsonl');
}

function readStore(file) {
  if (!fs.existsSync(file)) return [];
  const out = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip corrupt line, keep history */ }
  }
  return out;
}

function appendEntry(file, entry) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(entry) + '\n', 'utf8');
}

function rewriteWithout(file, entries) {
  const tmp = file + '.tmp-' + process.pid;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, entries.map(e => JSON.stringify(e)).join('\n') +
    (entries.length ? '\n' : ''), 'utf8');
  fs.renameSync(tmp, file); // atomic on POSIX; best-effort elsewhere
}

function newId() {
  return 'um-' + Date.now() + '-' +
    crypto.randomBytes(3).toString('hex');
}

function parseArgs(argv) {
  const cmd = argv[0];
  const opts = { _: [], type: 'fact', scope: undefined, limit: 5, format: 'md',
    agent: process.env.AGENT_NAME || process.env.AGENT_ID || 'unknown' };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--type') opts.type = argv[++i];
    else if (a === '--scope') opts.scope = argv[++i];
    else if (a === '--project') opts.scope = 'project';
    else if (a === '--global') opts.scope = 'global';
    else if (a === '--tag') (opts.tags = opts.tags || []).push(argv[++i]);
    else if (a === '--agent') opts.agent = argv[++i];
    else if (a === '--limit' || a === '-n') opts.limit = parseInt(argv[++i], 10) || 5;
    else if (a === '--format') opts.format = argv[++i];
    else if (a === '--json') opts.json = true;
    else opts._.push(a);
  }
  return { cmd, opts };
}

function tokenize(s) {
  return (s || '').toLowerCase().split(/[^a-z0-9]+/).filter(t =>
    t.length > 1 && !STOPWORDS.has(t));
}

function score(entry, tokens, phrase) {
  let s = 0;
  const text = (entry.text || '').toLowerCase();
  const tags = (entry.tags || []).map(t => String(t).toLowerCase());
  for (const t of tokens) {
    if (tags.includes(t)) s += 2.0;
    if (text.includes(t)) s += 1.0;
  }
  if (phrase && phrase.length > 3 && text.includes(phrase)) s += 0.5;
  return s;
}

const scopeEntries = (opts) => {
  if (opts.scope === 'all') {
    return readStore(storePath('global'))
      .map(e => ({ ...e, _f: 'global' }))
      .concat(readStore(storePath('project')).map(e => ({ ...e, _f: 'project' })));
  }
  return readStore(storePath(opts.scope)).map(e =>
    ({ ...e, _f: opts.scope }));
};

function show(e) {
  return `[${e.ts}] ${e._f}:${e.type} — ${e.text}` +
    (e.tags && e.tags.length ? `  (${e.tags.join(', ')})` : '') +
    (e.agent && e.agent !== 'unknown' ? `  {via ${e.agent}}` : '') +
    `  <${e.id}>`;
}

// ── commands ──────────────────────────────────────────────────────────────
const commands = {
  remember(opts) {
    const text = opts._.join(' ').trim();
    if (!text) { console.error('usage: memory.cjs remember <text> [--type] [--scope] [--tag] [--agent]'); process.exit(2); }
    if (!TYPES.includes(opts.type)) { console.error(`invalid --type (use: ${TYPES.join(', ')})`); process.exit(2); }
    if (opts.scope === undefined) opts.scope = 'global';
    if (!SCOPES.includes(opts.scope)) { console.error(`invalid --scope (use: ${SCOPES.join(', ')})`); process.exit(2); }
    const file = storePath(opts.scope);
    const entry = {
      id: newId(),
      ts: new Date().toISOString(),
      type: opts.type,
      scope: opts.scope,
      text: text.slice(0, 2000),
      tags: opts.tags || [],
      agent: opts.agent,
    };
    appendEntry(file, entry);
    if (opts.json) { console.log(JSON.stringify({ ok: true, stored: entry, file })); }
    else console.log(`stored ${entry.type} [${entry.scope}]: ${entry.text}\n  id: ${entry.id}`);
  },

  recall(opts) {
    const q = opts._.join(' ').trim();
    if (!q) { console.error('usage: memory.cjs recall <query> [--limit N] [--scope S]'); process.exit(2); }
    const tokens = tokenize(q);
    const hits = scopeEntries({ ...opts, scope: opts.scope || 'all' })
      .map(e => ({ e, s: score(e, tokens, q.toLowerCase()) }))
      .filter(h => h.s > 0)
      .sort((a, b) => b.s - a.s || (b.e.ts > a.e.ts ? 1 : -1))
      .slice(0, opts.limit);
    if (opts.json) { console.log(JSON.stringify({ ok: true, query: q, hits: hits.map(h => h.e) })); }
    else if (!hits.length) console.log('no memories match that query.');
    else hits.forEach(h => console.log(show(h.e)));
  },

  profile(opts) {
    const all = scopeEntries({ scope: opts.scope || 'all' });
    const by = {};
    for (const e of all) (by[e.type] = by[e.type] || []).push(e);
    if (opts.json) { console.log(JSON.stringify({ ok: true, profile: by })); return; }
    if (!all.length) { console.log('nothing remembered yet.'); return; }
    console.log(`universal-memory profile — ${all.length} entries\n`);
    for (const type of TYPES) {
      const list = by[type];
      if (!list) continue;
      console.log(`${type.toUpperCase()} (${list.length})`);
      list.slice(-5).reverse().forEach(e => console.log('  ' + show(e)));
      console.log('');
    }
  },

  forget(opts) {
    const id = opts._[0];
    if (!id) { console.error('usage: memory.cjs forget <id> [--scope S]'); process.exit(2); }
    const scopes = opts.scope === 'project' ? ['project']
      : opts.scope === 'global' ? ['global'] : ['global', 'project'];
    for (const sc of scopes) {
      const file = storePath(sc);
      const entries = readStore(file);
      const keep = entries.filter(e => e.id !== id);
      if (keep.length !== entries.length) {
        rewriteWithout(file, keep);
        if (opts.json) console.log(JSON.stringify({ ok: true, forgot: id, scope: sc }));
        else console.log(`forgot ${id} (${sc}). real delete — no shadow copy.`);
        return;
      }
    }
    console.error(`id not found: ${id}`);
    process.exit(1);
  },

  stats(opts) {
    const g = readStore(storePath('global'));
    const p = readStore(storePath('project'));
    const byType = {};
    for (const e of g.concat(p)) byType[e.type] = (byType[e.type] || 0) + 1;
    const byAgent = {};
    for (const e of g.concat(p)) byAgent[e.agent || 'unknown'] = (byAgent[e.agent || 'unknown'] || 0) + 1;
    const out = { ok: true, global: g.length, project: p.length, by_type: byType, by_agent: byAgent };
    if (opts.json) console.log(JSON.stringify(out));
    else {
      console.log(`global: ${g.length} | project: ${p.length}`);
      for (const [k, v] of Object.entries(byType)) console.log(`  ${k}: ${v}`);
      const agents = Object.entries(byAgent);
      if (agents.length > 1) console.log('agents sharing this store: ' +
        agents.map(([a, n]) => `${a}(${n})`).join(', '));
    }
  },

  export(opts) {
    const all = scopeEntries({ scope: 'all' });
    if (opts.format === 'json') {
      console.log(JSON.stringify(all.map(({ _f, ...e }) => e), null, 2));
      return;
    }
    console.log('# Universal Memory export\n');
    console.log(`_exported: ${new Date().toISOString()}_\n`);
    for (const f of ['global', 'project']) {
      const list = all.filter(e => e._f === f);
      if (!list.length) continue;
      console.log(`## ${f}\n`);
      for (const type of TYPES) {
        const t = list.filter(e => e.type === type);
        if (!t.length) continue;
        console.log(`### ${type}\n`);
        t.forEach(e => console.log(`- [${e.ts}] ${e.text} _(${e.agent})_ <${e.id}>`));
        console.log('');
      }
    }
  },

  doctor(opts) {
    const out = { ok: true, version: VERSION, node: process.version, checks: [] };
    for (const sc of SCOPES) {
      const file = storePath(sc);
      let ok = true, detail = 'missing (created on first remember)';
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const probe = path.join(path.dirname(file), '.probe-' + process.pid);
        fs.writeFileSync(probe, '');
        fs.unlinkSync(probe);
        const n = readStore(file).length;
        detail = `writable, ${n} entries`;
      } catch (err) { ok = false; detail = 'NOT writable: ' + err.message; out.ok = false; }
      out.checks.push({ scope: sc, path: file, ok, detail });
    }
    if (opts.json) console.log(JSON.stringify(out));
    else {
      console.log(`universal-memory ${VERSION} (node ${process.version})`);
      out.checks.forEach(c => console.log(`  ${c.ok ? 'OK ' : 'FAIL'} ${c.scope}: ${c.path} — ${c.detail}`));
      // zero-network proof: this file performs no network calls whatsoever.
    }
    if (!out.ok) process.exit(1);
  },
};

// ── main ──────────────────────────────────────────────────────────────────
const { cmd, opts } = parseArgs(process.argv.slice(2));
if (!cmd || !commands[cmd] || cmd === 'constructor') {
  console.error('universal-memory ' + VERSION +
    ' — commands: remember | recall | profile | forget | stats | export | doctor');
  process.exit(2);
}
commands[cmd](opts);
