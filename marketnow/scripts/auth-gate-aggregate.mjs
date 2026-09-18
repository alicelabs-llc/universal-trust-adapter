#!/usr/bin/env node
/**
 * MarketNow — Auth-Gate Aggregator
 * ================================
 * Reads probe results (JSONL, hashed endpoints) and produces:
 *   1. aep-marketplace/public/api/auth-gate-distribution.json  — public aggregate
 *   2. aep-marketplace/public/api/auth-gate-skills.json        — per-skill index (id + state)
 *
 * Aggregate-first: raw endpoint URLs never appear. Only SHA-256 hashes.
 *
 * Usage:
 *   node scripts/auth-gate-aggregate.mjs --results /tmp/auth-gate-full.jsonl
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i !== -1 && args[i + 1] ? args[i + 1] : def;
};
const RESULTS = opt('results', '/tmp/auth-gate-full.jsonl');
const CATALOG = opt('catalog', path.join(REPO_ROOT, 'aep-marketplace', 'src', 'data', 'all_skills.json'));

const sha = (s, n = 16) => crypto.createHash('sha256').update(s).digest('hex').slice(0, n);

// ---------- load results ----------
const byHash = new Map();
for (const line of fs.readFileSync(RESULTS, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  try {
    const r = JSON.parse(line);
    byHash.set(r.endpoint_hash, r); // last write wins on resume-duplicates
  } catch { }
}
console.log(`results loaded: ${byHash.size} unique endpoints`);

// ---------- load catalog → skill mapping (official-registry remotes) ----------
const skills = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const skillStates = [];
const protocolOf = new Map(); // endpoint hash → remote type
let registryEntries = 0, withRemotes = 0;
for (const it of skills) {
  const src = it.get ? it : it; // plain objects
  if (src?.source?.type !== 'official-registry') continue;
  registryEntries++;
  const remotes = src.source.remotes || [];
  if (!remotes.length) continue;
  withRemotes++;
  // One state per skill = state of its first remote that was probed
  let state = null, hash = null;
  for (const r of remotes) {
    const u = r.url;
    if (!u || !u.startsWith('http')) continue;
    const h = sha(u);
    protocolOf.set(h, r.type || 'unknown');
    const res = byHash.get(h);
    if (res) { state = res.state; hash = h; break; }
  }
  if (state) {
    skillStates.push({
      skill_id: src.id,
      name: src.name,
      state,
      endpoint_hash: hash,
      rfc9728_valid: byHash.get(hash)?.rfc9728?.valid === true,
      tools_served: byHash.get(hash)?.tools?.tools_count ?? null,
      probed_at: byHash.get(hash)?.ts,
    });
  }
}

// ---------- aggregate distribution ----------
const dist = {};
const counts = { OPEN: 0, LATE_GATE: 0, HARD_GATE: 0, RESPONDS_NOT_SERVING: 0, INVALID: 0, PROTOCOL_MISMATCH: 0, SERVER_ERROR: 0, CLIENT_ERROR: 0, UNREACHABLE: 0 };
for (const r of byHash.values()) {
  const k = counts[r.state] !== undefined ? r.state : 'UNREACHABLE';
  counts[k]++;
}
const total = byHash.size;
const pct = (n) => total ? +(100 * n / total).toFixed(1) : 0;
for (const [k, v] of Object.entries(counts)) dist[k] = { count: v, pct: pct(v) };

// RFC 9728
let rfcValid = 0, rfc200 = 0, gatedDiscoverable = 0, openWithManifest = 0;
for (const r of byHash.values()) {
  if (r.rfc9728?.status === 200) rfc200++;
  if (r.rfc9728?.valid) {
    rfcValid++;
    if (r.state === 'LATE_GATE' || r.state === 'HARD_GATE') gatedDiscoverable++;
    if (r.state === 'OPEN') openWithManifest++;
  }
}

// gated (any) totals
const gated = counts.LATE_GATE + counts.HARD_GATE;
const authRequired = gated + counts.RESPONDS_NOT_SERVING; // conservative: doesn't serve tools without token

// ---------- public aggregate file ----------
const distribution = {
  schema: 'marketnow-auth-gate/1.0',
  generated_at: new Date().toISOString(),
  description: 'Auth-gate distribution of remote MCP endpoints, measured live with receipts (HTTP 200 without a served tools array is NOT counted as open — the lesson from X190 v0.9.0). Aggregate-first: endpoints are SHA-256-hashed, raw URLs are never published.',
  scope: {
    population: 'official-registry entries in the MarketNow catalog',
    catalog_entries: registryEntries,
    entries_with_remotes: withRemotes,
    unique_endpoints_probed: total,
    protocol_types: Object.fromEntries([...protocolOf.values()].reduce((acc, t) => { acc.set(t, (acc.get(t) || 0) + 1); return acc; }, new Map())),
  },
  headline: {
    open_pct: dist.OPEN.pct,
    open_count: counts.OPEN,
    definition: 'initialize OK AND tools/list serves a tools array, without any token',
    auth_gated_pct: +(dist.LATE_GATE.pct + dist.HARD_GATE.pct).toFixed(1),
    rfc9728_valid_pct: pct(rfcValid),
    gated_but_discoverable_count: gatedDiscoverable,
  },
  distribution: dist,
  rfc9728: {
    method: 'GET {origin}/.well-known/oauth-protected-resource (RFC 9728)',
    http200: rfc200,
    valid_manifests: rfcValid,
    valid_pct: pct(rfcValid),
    valid_on_open_endpoints: openWithManifest,
    gated_but_discoverable: gatedDiscoverable,
  },
  comparison: {
    x190_v091: { sample: 100, open_pct: 45.0, rfc9728_functional_pct: 40.0, broken_challenge_pct: 9.0, source: 'unempyd/X190 public measurement 2026-09-11' },
    marketnow_this_scan: { sample: total, open_pct: dist.OPEN.pct, rfc9728_valid_pct: pct(rfcValid) },
  },
  methodology: {
    probe: 'Node fetch, single-shot (no retries), JSON-RPC 2.0 initialize (protocolVersion 2025-06-18) → notifications/initialized → tools/list; session header mcp-session-id forwarded when issued; SSE bodies read first-chunk-then-cancel',
    timeouts_ms: { initialize: 12000, tools_list: 12000, rfc9728: 6000 },
    concurrency: 16,
    user_agent: 'MarketNow-Sentinel-AuthStateProbe/1.0 (+https://marketnow.site)',
    privacy: 'endpoint_hash = sha256(url)[0:16]; host_hash = sha256(host)[0:12]; raw URLs never stored in published artifacts',
    states: {
      OPEN: 'initialize OK and tools/list serves a tools array without token',
      LATE_GATE: 'initialize OK, tools/list returns 401/403',
      HARD_GATE: 'initialize returns 401/403',
      RESPONDS_NOT_SERVING: 'endpoint speaks JSON-RPC at HTTP 200 but never serves tools (200 ≠ served)',
      INVALID: 'HTTP 200 but body is not valid JSON-RPC (login pages, HTML, CDNs)',
      PROTOCOL_MISMATCH: 'POST initialize → 404/405 (SSE-only endpoints or dead paths)',
      SERVER_ERROR: '5xx at initialize',
      CLIENT_ERROR: 'other 4xx at initialize',
      UNREACHABLE: 'DNS/TLS/connection/timeout failure',
    },
    limitations: [
      'single-shot: transient outages classify an endpoint as UNREACHABLE/SERVER_ERROR',
      'SSE-typed endpoints are probed via streamable-HTTP POST; those that only accept GET-SSE fall into PROTOCOL_MISMATCH',
      'auth challenges that redirect to IdP HTML pages classify as INVALID, not gated',
    ],
    rescan_policy: 'monthly re-scan planned; drift history retained (MarketNow moat)',
  },
  tools_served_stats: (() => {
    const counts2 = [...byHash.values()].filter(r => r.state === 'OPEN' && typeof r.tools?.tools_count === 'number').map(r => r.tools.tools_count);
    if (!counts2.length) return null;
    const sorted = counts2.slice().sort((a, b) => a - b);
    return {
      n: sorted.length,
      min: sorted[0], p50: sorted[Math.floor(sorted.length / 2)], p90: sorted[Math.floor(sorted.length * 0.9)], max: sorted[sorted.length - 1],
      mean: +(counts2.reduce((a, b) => a + b, 0) / counts2.length).toFixed(1),
    };
  })(),
};

const OUT1 = path.join(REPO_ROOT, 'aep-marketplace', 'public', 'api', 'auth-gate-distribution.json');
fs.writeFileSync(OUT1, JSON.stringify(distribution, null, 2));
console.log(`wrote ${OUT1}`);

// ---------- per-skill public index ----------
const OUT2 = path.join(REPO_ROOT, 'aep-marketplace', 'public', 'api', 'auth-gate-skills.json');
const skillsIdx = {
  schema: 'marketnow-auth-gate-skills/1.0',
  generated_at: new Date().toISOString(),
  source: 'results of auth-state-probe over official-registry remotes; join by skill_id with the MarketNow catalog',
  count: skillStates.length,
  skills: skillStates,
};
fs.writeFileSync(OUT2, JSON.stringify(skillsIdx));
console.log(`wrote ${OUT2} (${skillStates.length} skills mapped)`);

// ---------- console summary ----------
console.log('\n=== AUTH-GATE DISTRIBUTION (headline) ===');
console.log(`open (serves tools, no token): ${counts.OPEN}/${total} = ${dist.OPEN.pct}%`);
console.log(`late-gate: ${counts.LATE_GATE} (${dist.LATE_GATE.pct}%) | hard-gate: ${counts.HARD_GATE} (${dist.HARD_GATE.pct}%)`);
console.log(`gated-but-discoverable (RFC 9728 valid): ${gatedDiscoverable}`);
console.log(`RFC 9728 valid manifests: ${rfcValid} (${pct(rfcValid)}%)`);
console.log(`X190 v0.9.1 reference: 45% open of n=100`);
