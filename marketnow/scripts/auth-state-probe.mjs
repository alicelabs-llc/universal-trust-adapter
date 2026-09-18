#!/usr/bin/env node
/**
 * MarketNow — Sentinel Auth-State Probe (remote, 4-state taxonomy)
 * ================================================================
 * Complements (does NOT replace) the existing Sentinel pipeline:
 *   - l2-mcp-probe.py          → stdio adversarial probe (Docker sandbox, npm packages)
 *   - l3-continuous-monitor.mjs→ drift detection vs L2 baselines
 *   - THIS script              → REMOTE HTTP auth-gate measurement (streamable HTTP)
 *
 * Taxonomy (aligned with unempyd/X190 public methodology, spec#540):
 *   OPEN               — initialize OK AND tools/list serves a tools array, no token
 *   LATE_GATE          — initialize OK, tools/list → 401/403
 *   HARD_GATE          — initialize → 401/403
 *   RESPONDS_NOT_SERVING — HTTP 200 + JSON-RPC but tools never served (200 ≠ served)
 *   INVALID            — HTTP 200 but body is not valid JSON-RPC (login pages, HTML…)
 *   PROTOCOL_MISMATCH  — POST initialize → 404/405 (SSE-only or dead path)
 *   SERVER_ERROR       — 5xx at initialize
 *   CLIENT_ERROR       — other 4xx at initialize (400/402/429/422…)
 *   UNREACHABLE        — DNS / TLS / conn refused / timeout
 * RFC 9728 flag: gated-but-discoverable = any gate + valid
 *   /.well-known/oauth-protected-resource manifest on the origin.
 *
 * Aggregate-first privacy: endpoints are stored SHA-256-hashed (16 hex).
 * Raw URLs are NEVER written by this script.
 *
 * Usage:
 *   node scripts/auth-state-probe.mjs --input endpoints.json \
 *        --out _data/auth-gate/results.jsonl [--limit N] [--concurrency 16] [--resume]
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i !== -1 && args[i + 1] ? args[i + 1] : def;
};
const has = (name) => args.includes('--' + name);

const INPUT = opt('input', null);
const OUT = opt('out', path.join(process.cwd(), '_data', 'auth-gate', 'results.jsonl'));
const LIMIT = parseInt(opt('limit', '0'), 10); // 0 = all
const CONCURRENCY = parseInt(opt('concurrency', '16'), 10);
const TIMEOUT_MS = parseInt(opt('timeout', '12000'), 10);
const RESUME = has('resume');

const UA = 'MarketNow-Sentinel-AuthStateProbe/1.0 (+https://marketnow.site; contact: info@alicelabs.site)';

// A single flaky third-party server must never kill a 6,249-endpoint sweep.
process.on('unhandledRejection', (e) => {
  console.error(`[warn] unhandledRejection swallowed: ${e && (e.message || e)}`);
});
process.on('uncaughtException', (e) => {
  console.error(`[warn] uncaughtException swallowed: ${e && (e.message || e)}`);
});

if (!INPUT) { console.error('--input required'); process.exit(1); }

const sha = (s, n = 16) => crypto.createHash('sha256').update(s).digest('hex').slice(0, n);

// ---------- HTTP helpers ----------
async function fetchWithTimeout(url, opts, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort('timeout'), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, redirect: 'follow' });
  } finally { clearTimeout(t); }
}

// Read a response body with a HARD deadline and byte cap.
// Critical for text/event-stream servers that keep the connection open forever:
// we take the first chunks (enough to parse one JSON-RPC message) and cancel.
async function readBodyCapped(res, capBytes = 65536, deadlineMs = 6000) {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const started = Date.now();
  let text = '';
  try {
    while (text.length < capBytes) {
      const remaining = deadlineMs - (Date.now() - started);
      if (remaining <= 0) break;
      const chunk = await Promise.race([
        reader.read(),
        new Promise((resolve) => setTimeout(() => resolve({ done: true, timedOut: true }), remaining)),
      ]);
      if (chunk.done) break;
      if (chunk.value) {
        text += decoder.decode(chunk.value, { stream: true });
        // Early exit as soon as we have one complete SSE data line
        if (text.includes('data:') && text.includes('\n')) break;
      }
    }
  } catch { /* partial is fine */ }
  finally { try { reader.cancel(); } catch { } try { reader.releaseLock(); } catch { } }
  return text;
}

// Parse a JSON-RPC payload from a JSON or text/event-stream body.
function parseRpcBody(text) {
  if (!text) return null;
  text = text.trim();
  try { const j = JSON.parse(text); return j; } catch { /* continue */ }
  // SSE: collect data: lines, return first parseable JSON
  const dataLines = text.split(/\r?\n/).filter(l => l.startsWith('data:'));
  for (const line of dataLines) {
    const payload = line.slice(5).trim();
    if (!payload) continue;
    try { return JSON.parse(payload); } catch { /* next */ }
  }
  return null;
}

async function postRpc(url, body, headers = {}, timeoutMs = TIMEOUT_MS) {
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Accept-Encoding': 'identity', // avoid undici Brotli decompression crashes on flaky servers
      'User-Agent': UA,
      ...headers,
    },
    body: JSON.stringify(body),
  }, timeoutMs);
  const text = await readBodyCapped(res);
  return { res, rpc: parseRpcBody(text), textLen: text.length };
}

const INIT_BODY = {
  jsonrpc: '2.0', id: 1, method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'marketnow-sentinel-auth-state-probe', version: '1.0.0' },
  },
};

// ---------- Per-endpoint probe ----------
async function probeEndpoint(url) {
  const rec = {
    endpoint_hash: sha(url),
    host_hash: sha(new URL(url).host, 12),
    ts: new Date().toISOString(),
    state: null, note: null,
    init: {}, tools: {}, rfc9728: {},
  };
  try {
    // -- Phase A: initialize (JSON-RPC over streamable HTTP) --
    let init;
    try {
      init = await postRpc(url, INIT_BODY);
      rec.init = {
        status: init.res.status,
        latency_ms: null, // filled below via re-timing is skipped; use duration
        jsonrpc: init.rpc !== null,
        has_result: !!(init.rpc && init.rpc.result),
        content_type: (init.res.headers.get('content-type') || '').split(';')[0],
      };
    } catch (e) {
      rec.init = { status: 0, error: String(e && e.name || e) };
    }

    const st = rec.init.status;

    if (st === 0) {
      rec.state = 'UNREACHABLE';
      rec.note = rec.init.error; // timeout / ECONNREFUSED / ENOTFOUND / TLS
    } else if (st === 401 || st === 403) {
      rec.state = 'HARD_GATE';
    } else if (st === 404 || st === 405 || st === 405.1) {
      rec.state = 'PROTOCOL_MISMATCH';
    } else if (st >= 500) {
      rec.state = 'SERVER_ERROR';
    } else if (st >= 400) {
      rec.state = 'CLIENT_ERROR';
    } else if (st === 200 && !rec.init.jsonrpc) {
      rec.state = 'INVALID'; // HTTP 200 but not MCP (the "200 ≠ served" trap)
    } else if (st === 200 && rec.init.jsonrpc) {
      // -- Phase B: session + notification + tools/list --
      const session = init.res.headers.get('mcp-session-id');
      const hdrs = session ? { 'mcp-session-id': session } : {};
      try {
        const nres = await fetchWithTimeout(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'Accept-Encoding': 'identity',
            'User-Agent': UA,
            ...hdrs,
          },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
        }, 4000);
        try { nres.body.cancel(); } catch { }
      } catch { /* notification is best-effort */ }

      let tools;
      try {
        tools = await postRpc(url, { jsonrpc: '2.0', id: 2, method: 'tools/list' }, hdrs);
        rec.tools = {
          status: tools.res.status,
          jsonrpc: tools.rpc !== null,
          tools_count: (tools.rpc && tools.rpc.result && Array.isArray(tools.rpc.result.tools))
            ? tools.rpc.result.tools.length : null,
        };
      } catch (e) {
        rec.tools = { status: 0, error: String(e && e.name || e) };
      }

      const ts = rec.tools.status;
      if (ts === 401 || ts === 403) {
        rec.state = 'LATE_GATE';
      } else if (ts === 200 && rec.tools.tools_count !== null) {
        rec.state = 'OPEN';
        rec.tools.served = true;
      } else if (ts === 0) {
        // initialize worked, tools/list timed out — endpoint speaks MCP unauthenticated
        rec.state = 'RESPONDS_NOT_SERVING';
        rec.note = 'tools/list timeout';
      } else if (ts === 404 || ts === 405) {
        rec.state = 'PROTOCOL_MISMATCH';
      } else {
        rec.state = 'RESPONDS_NOT_SERVING';
        rec.note = `tools/list status ${ts}, no tools served`;
      }
    } else {
      rec.state = 'INVALID';
    }

    // -- Phase C: RFC 9728 manifest on origin (parallel-able, run serially here for simplicity) --
    const origin = new URL(url).origin;
    try {
      const r = await fetchWithTimeout(origin + '/.well-known/oauth-protected-resource', {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'Accept-Encoding': 'identity', 'User-Agent': UA },
      }, 6000);
      const bodyText = await readBodyCapped(r, 16384, 4000);
      let manifest = null;
      try { manifest = JSON.parse(bodyText); } catch { }
      rec.rfc9728 = {
        status: r.status,
        valid: r.status === 200 && manifest !== null && typeof manifest === 'object',
        resource: manifest && manifest.resource ? String(manifest.resource).slice(0, 120) : null,
        auth_servers: manifest && Array.isArray(manifest.authorization_servers) ? manifest.authorization_servers.length : null,
      };
    } catch (e) {
      rec.rfc9728 = { status: 0, error: String(e && e.name || e) };
    }
  } catch (e) {
    rec.state = 'UNREACHABLE';
    rec.note = String(e && e.name || e);
  }
  return rec;
}

// ---------- Runner ----------
const endpoints = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const done = new Set();
if (RESUME && fs.existsSync(OUT)) {
  for (const line of fs.readFileSync(OUT, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { done.add(JSON.parse(line).endpoint_hash); } catch { }
  }
  console.error(`[resume] ${done.size} already probed, skipping`);
}

const queue = endpoints.filter(u => !done.has(sha(u)));
const targets = LIMIT > 0 ? queue.slice(0, LIMIT) : queue;
console.error(`[probe] ${targets.length} endpoints to probe (concurrency ${CONCURRENCY}, timeout ${TIMEOUT_MS}ms)`);

const started = Date.now();
let i = 0, written = 0;
const out = fs.createWriteStream(OUT, { flags: 'a' });

async function worker(id) {
  while (true) {
    const idx = i++;
    if (idx >= targets.length) return;
    const url = targets[idx];
    const t0 = Date.now();
    let rec;
    try { rec = await probeEndpoint(url); }
    catch (e) { rec = { endpoint_hash: sha(url), state: 'UNREACHABLE', note: String(e) }; }
    rec.probe_ms = Date.now() - t0;
    out.write(JSON.stringify(rec) + '\n');
    written++;
    if (written % 50 === 0) {
      const el = ((Date.now() - started) / 1000).toFixed(0);
      const eta = ((targets.length - written) * ((Date.now() - started) / written)).toFixed(0);
      console.error(`[probe ${el}s] ${written}/${targets.length} (ETA ${eta}s) — last: ${rec.state}`);
    }
    await new Promise(r => setTimeout(r, 50 + Math.floor(Math.random() * 200))); // jitter
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, (_, k) => worker(k)));
await new Promise(r => out.end(r));
console.error(`[probe] DONE: ${written} probed in ${((Date.now() - started) / 1000).toFixed(0)}s → ${OUT}`);
