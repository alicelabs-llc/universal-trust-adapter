/**
 * MarketNow — Submission Core (the "write side")
 * ==============================================
 * Shared by:
 *   - api/submit.js      (public HTTP endpoint: POST /api/submit)
 *   - api/mcp.js         (MCP tool: marketnow_submit_skill)
 *   - api/submissions.js (public queue listing)
 *
 * Pipeline: schema validation → Sentinel L1-sub scan → catalog dedup
 *           → verdict → (accepted) durable storage in the public
 *           alicelabs-llc/marketnow-submissions repo (audit trail),
 *           ready for L2 review + catalog merge.
 *
 * Storage auth: process.env.MN_SUBMIT_TOKEN (GitHub PAT, org-scoped).
 * The token NEVER appears in source or in responses.
 */

import { createHash } from 'node:crypto';

const SUBMIT_REPO = process.env.MN_SUBMIT_REPO || 'alicelabs-llc/marketnow-submissions';
const GH_API = 'https://api.github.com';
const CATALOG_NAMES_URL = 'https://www.marketnow.site/api/catalog-names.txt';
const MAX_PAYLOAD_BYTES = 100 * 1024; // 100 KB

// ─── catalog names cache (dedup) ────────────────────────────────────────────
let namesCache = { at: 0, names: null };
async function getCatalogNames() {
  const TTL = 12 * 3600 * 1000;
  if (namesCache.names && Date.now() - namesCache.at < TTL) return namesCache.names;
  try {
    const r = await fetch(CATALOG_NAMES_URL, { signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      const txt = await r.text();
      namesCache = { at: Date.now(), names: new Set(txt.split('\n').map(s => s.trim().toLowerCase()).filter(Boolean)) };
    }
  } catch { /* dedup degrada a repositorio local */ }
  return namesCache.names;
}

// ─── schema ─────────────────────────────────────────────────────────────────
const RUNTIMES = new Set(['node', 'python', 'rust', 'go', 'dotnet', 'docker', 'luau', 'roblox', 'java', 'php', 'ruby', 'other']);

const REQUIRED = [
  ['name', 'string', 2, 60],
  ['version', 'string', 1, 20],
  ['description', 'string', 10, 600],
  ['author', 'string', 1, 60],
];

function validateSchema(skill) {
  const errors = [];
  for (const [key, type, min, max] of REQUIRED) {
    const v = skill[key];
    if (typeof v !== type || String(v).trim().length < min) {
      errors.push({ check: 'SCHEMA', severity: 'high', field: key, reason: `required ${type} (min ${min} chars)` });
    } else if (String(v).length > max) {
      errors.push({ check: 'SCHEMA', severity: 'medium', field: key, reason: `max ${max} chars` });
    }
  }
  const name = String(skill.name || '');
  if (name && !/^[A-Za-z0-9][A-Za-z0-9._\-/ ]*$/.test(name)) {
    errors.push({ check: 'SCHEMA', severity: 'high', field: 'name', reason: 'only letters, digits, dot, dash, slash, space' });
  }
  if (skill.version && !/^\d+(\.\d+){0,3}(-[A-Za-z0-9.]+)?$/.test(String(skill.version))) {
    errors.push({ check: 'SCHEMA', severity: 'medium', field: 'version', reason: 'expected semver-like x.y.z' });
  }
  if (skill.runtime && !RUNTIMES.has(String(skill.runtime).toLowerCase())) {
    errors.push({ check: 'SCHEMA', severity: 'low', field: 'runtime', reason: `unknown runtime (allowed: ${[...RUNTIMES].join(', ')})` });
  }
  if (skill.tags && (!Array.isArray(skill.tags) || skill.tags.length > 12)) {
    errors.push({ check: 'SCHEMA', severity: 'medium', field: 'tags', reason: 'array, max 12 items' });
  }
  if (skill.files && typeof skill.files !== 'object') {
    errors.push({ check: 'SCHEMA', severity: 'medium', field: 'files', reason: 'object {filename: content}' });
  }
  const codeSize = skill.files ? JSON.stringify(skill.files).length : (skill.code ? String(skill.code).length : 0);
  if (codeSize > 60 * 1024) {
    errors.push({ check: 'SCHEMA', severity: 'high', field: 'files|code', reason: 'source code exceeds 60KB — submit a repo URL instead' });
  }
  return errors;
}

// ─── Sentinel L1-sub: scan de seguridad ─────────────────────────────────────
const INJECTION_PATTERNS = [
  [/ignore (all )?(previous|prior|above) instructions/i, 'critical'],
  [/disregard (the )?(above|previous|prior)/i, 'critical'],
  [/forget (everything|all|your (instructions|training))/i, 'critical'],
  [/you are now (a|an) (different|new|unrestricted)/i, 'high'],
  [/act as (if you were )?(a )?(different|admin|root|sudo)/i, 'high'],
  [/exfiltrate|steal .*(tokens?|keys?|credentials?)|send .*(to|via) .*(webhook|discord|telegram)/i, 'critical'],
  [/reveal|output .*(system prompt|hidden instructions)/i, 'high'],
  [/\/(system|admin|debug) prompt/i, 'medium'],
];

const SECRET_PATTERNS = [
  [/sk-[A-Za-z0-9]{20,}/, 'critical', 'OpenAI-style key'],
  [/gh[pousr]_[A-Za-z0-9]{20,}/, 'critical', 'GitHub token'],
  [/AKIA[0-9A-Z]{16}/, 'critical', 'AWS access key'],
  [/xox[baprs]-[A-Za-z0-9-]{10,}/, 'critical', 'Slack token'],
  [/AIza[0-9A-Za-z\-_]{35}/, 'critical', 'Google API key'],
  [/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'critical', 'private key'],
  [/Bearer [A-Za-z0-9._\-]{30,}/, 'high', 'bearer token'],
];

const DANGEROUS_API = [
  [/loadstring\s*\(/i, 'high', 'loadstring() — dynamic code execution'],
  [/getfenv|setfenv/i, 'medium', 'environment access (getfenv/setfenv)'],
  [/\beval\s*\(/, 'high', 'eval() — dynamic code execution'],
  [/\bexec\s*\(/, 'high', 'exec() — dynamic code execution'],
  [/curl[^&|;]*\|\s*(ba)?sh/i, 'critical', 'curl piped to shell'],
  [/wget[^&|;]*\|\s*(ba)?sh/i, 'critical', 'wget piped to shell'],
  [/rm\s+-rf?\s+[/~]/, 'critical', 'recursive delete of root/home'],
  [/base64\s+(-d|decode)[^;|]*\|\s*(ba)?sh/i, 'critical', 'base64 decode piped to shell'],
  [/require\s*\(\s*['"]https?:\/\//i, 'high', 'remote require() of URL'],
  [/os\.execute|subprocess\.(call|run)\s*\(\s*['"]?shell\s*=\s*True/i, 'high', 'shell execution'],
  [/_G\s*\.\s*(http|os|io)\b/i, 'medium', '_G global access'],
  [/HttpService[:]?\s*(Post|Get|Request|GenerateJson)/i, 'low', 'Roblox HttpService call (needs HttpEnabled)'],
];

const SUSPICIOUS_URLS = [
  [/https?:\/\/(bit\.ly|tinyurl\.com|t\.co|is\.gd|cutt\.ly|rb\.gy|shorturl\.at)\//i, 'high', 'URL shortener'],
  [/https?:\/\/[^\s]+\.(zip|tk|top|xyz|gq|cf|ml)\b/i, 'medium', 'suspicious TLD'],
  [/https?:\/\/xn--/i, 'high', 'punycode host'],
  [/https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|169\.254\.169\.254)/i, 'medium', 'internal/localhost URL'],
];

const POPULAR_NAMES = ['brave', 'github', 'slack', 'notion', 'sqlite', 'postgres', 'puppeteer', 'playwright', 'filesystem', 'memory', 'everything', 'sequential-thinking', 'fetch', 'google-drive', 'google-maps', 'sentry', 'serena', 'mcp-server', 'modelcontextprotocol', 'anthropic', 'openai', 'claude', 'obsidian', 'gitlab', 'figma', 'linear', 'stripe'];

function damerau(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 99;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

function scanText(blob, patterns, findings, source) {
  for (const [re, severity, label] of patterns) {
    const m = re.exec(blob);
    if (m) findings.push({ check: 'SENTINEL', severity, source, reason: label || 'pattern match', match: String(m[0]).slice(0, 60) });
  }
}

async function reachabilityProbe(url) {
  if (!/^https:\/\//i.test(url)) return { check: 'REACHABILITY', severity: 'medium', source: 'test.url', reason: 'test url must be https' };
  try {
    const r = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(6000), redirect: 'follow' });
    if (r.status >= 200 && r.status < 500) return { ok: true, status: r.status };
    return { check: 'REACHABILITY', severity: 'medium', source: 'test.url', reason: `probe returned HTTP ${r.status}` };
  } catch (e) {
    return { check: 'REACHABILITY', severity: 'medium', source: 'test.url', reason: `probe failed: ${String(e.cause || e).slice(0, 80)}` };
  }
}

// ─── veredicto ──────────────────────────────────────────────────────────────
function severityRank(s) { return { critical: 0, high: 1, medium: 2, low: 3 }[s] ?? 4; }

export async function processSubmission(payload, { dryRun = false, remoteIp = 'unknown' } = {}) {
  const started = Date.now();
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  if (raw.length > MAX_PAYLOAD_BYTES) {
    return { accepted: false, http: 413, verdict: 'rejected', reasons: [{ check: 'SCHEMA', severity: 'high', reason: `payload exceeds ${MAX_PAYLOAD_BYTES / 1024}KB limit` }] };
  }
  const skill = (typeof payload === 'string' ? JSON.parse(payload) : payload) || {};

  // 1. schema
  const findings = validateSchema(skill);
  if (findings.some(f => f.severity === 'high' && f.check === 'SCHEMA')) {
    return { accepted: false, http: 422, verdict: 'rejected', reasons: findings };
  }

  // 2. texto escaneable = todo lo que el skill dice de sí mismo
  const textBlob = [
    skill.name, skill.description, skill.author, skill.category, skill.runtime,
    skill.install, skill.homepage, skill.repo_url, skill.license,
    skill.doc?.usage, skill.doc?.system_prompt, skill.doc?.setup?.install,
    Array.isArray(skill.tags) ? skill.tags.join(' ') : '',
    skill.files ? Object.values(skill.files).join(' ') : '',
    skill.code || '',
  ].map(x => String(x || '')).join('\n');

  scanText(textBlob, INJECTION_PATTERNS, findings, 'description/prompt/code');
  scanText(textBlob, SECRET_PATTERNS, findings, 'payload');
  scanText(textBlob, DANGEROUS_API, findings, 'code');
  scanText(textBlob, SUSPICIOUS_URLS, findings, 'urls');

  // 3. typosquat
  const lname = String(skill.name).toLowerCase();
  for (const pop of POPULAR_NAMES) {
    const dist = damerau(lname, pop);
    if (dist > 0 && dist <= 1 && lname.length >= 4) {
      findings.push({ check: 'TYPOSQUAT', severity: 'high', source: 'name', reason: `edit-distance ${dist} from popular "${pop}"` });
      break;
    }
  }

  // 4. dedup contra catálogo público
  const catalog = await getCatalogNames();
  if (catalog && catalog.has(lname)) {
    findings.push({ check: 'DEDUP', severity: 'high', source: 'name', reason: `"${skill.name}" already exists in the catalog (${catalog.size.toLocaleString()} entries) — submit an update instead (version bump + repo_url)` });
  }

  // 5. reachability opcional
  let probe = null;
  if (skill.test?.url) { probe = await reachabilityProbe(skill.test.url); if (probe && !probe.ok) findings.push(probe); }

  // 6. veredicto
  const blockers = findings.filter(f => f.severity === 'critical' || f.severity === 'high');
  const warnings = findings.filter(f => f.severity === 'medium' || f.severity === 'low');
  const accepted = blockers.length === 0;

  // trust: heurística de submission (sin señales de adopción aún)
  let trust = 38;
  if (skill.repo_url) trust += 4;
  if (skill.homepage) trust += 2;
  if (skill.doc?.usage) trust += 3;
  if (skill.capabilities) trust += 3;
  if (skill.files || skill.code) trust += 3;
  if (skill.license) trust += 2;
  if (skill.test?.url && probe?.ok) trust += 8;
  trust -= warnings.length * 2;
  trust = Math.max(25, Math.min(60, trust));

  const id = 'mn-sub-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' +
    createHash('sha256').update(raw).digest('hex').slice(0, 6);
  const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '');
  const path = `submissions/${yyyymm}/${id}.json`;

  const record = {
    id, verdict: accepted ? 'accepted' : 'rejected',
    status: accepted ? 'certified-L1 (auto-scan) — pending L2 review' : 'rejected',
    skill: {
      name: skill.name, version: skill.version, description: skill.description,
      author: skill.author, category: skill.category || 'Developer Tools',
      runtime: skill.runtime || 'other', tags: Array.isArray(skill.tags) ? skill.tags.slice(0, 12) : ['mcp'],
      install: skill.install || '(not provided)', homepage: skill.homepage || null,
      repo_url: skill.repo_url || null, license: skill.license || null,
      price: typeof skill.price === 'number' ? skill.price : 0,
    },
    sentinel: {
      scan_version: 'L1-sub/1.0', scanned_at: new Date().toISOString(),
      duration_ms: Date.now() - started, findings: { blockers, warnings },
      trust_score_100: accepted ? trust : null,
      // toda submission de comunidad arranca yellow: sin señales de adopción aún
      risk_level: accepted ? 'yellow' : 'red',
    },
    // IP solo se guarda hasheada (privacidad + trazabilidad anti-abuso)
    submitted_from: remoteIp === 'unknown' ? null : `ip:${createHash('sha256').update(String(remoteIp) + 'mn').digest('hex').slice(0, 12)}`,
    submitted_at: new Date().toISOString(),
    submitted_by: 'public-api',
    merge: { eligible: accepted, catalog_slug: lname.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || id },
  };

  let storage = null;
  if (accepted && !dryRun) {
    const token = process.env.MN_SUBMIT_TOKEN;
    if (!token) {
      storage = { ok: false, reason: 'MN_SUBMIT_TOKEN not configured (contact info@alicelabs.site)' };
      record.status = 'accepted (scan passed) — STORAGE DEGRADED';
    } else {
      try {
        const body = {
          message: `submission: ${skill.name} v${skill.version} — ${accepted ? 'certified-L1' : 'rejected'} (${id})`,
          content: Buffer.from(JSON.stringify(record, null, 1)).toString('base64'),
          branch: 'main',
        };
        const r = await fetch(`${GH_API}/repos/${SUBMIT_REPO}/contents/${path}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'marketnow-submit', 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(20000),
        });
        const j = await r.json().catch(() => ({}));
        storage = r.ok
          ? { ok: true, repo: SUBMIT_REPO, path, commit: (j.commit || {}).sha, url: (j.content || {}).html_url }
          : { ok: false, reason: `github ${r.status}: ${String(j.message || '').slice(0, 120)}` };
        if (!storage.ok) record.status = 'accepted (scan passed) — STORAGE FAILED';
      } catch (e) {
        storage = { ok: false, reason: `network: ${String(e.cause || e).slice(0, 120)}` };
        record.status = 'accepted (scan passed) — STORAGE FAILED';
      }
    }
  }

  return {
    accepted, http: accepted ? 201 : 422, verdict: record.verdict, id,
    status: record.status, trust_score_100: accepted ? trust : null,
    reasons: accepted ? { blockers: [], warnings } : { blockers, warnings },
    storage, dry_run: !!dryRun, record,
  };
}

// ─── lectura de la cola ─────────────────────────────────────────────────────
export async function listSubmissions(limit = 100) {
  const token = process.env.MN_SUBMIT_TOKEN;
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'marketnow-submit' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${GH_API}/repos/${SUBMIT_REPO}/git/trees/main?recursive=1`, { headers, signal: AbortSignal.timeout(15000) });
  if (!r.ok) return { ok: false, reason: `github ${r.status}` };
  const j = await r.json();
  const entries = (j.tree || []).filter(t => t.type === 'blob' && t.path.startsWith('submissions/') && t.path.endsWith('.json'));
  const recent = entries.slice(-limit).reverse();
  const items = await Promise.all(recent.slice(0, 50).map(async t => {
    try {
      const c = await fetch(`${GH_API}/repos/${SUBMIT_REPO}/contents/${t.path}`, { headers, signal: AbortSignal.timeout(10000) });
      if (!c.ok) return null;
      const cj = await c.json();
      const rec = JSON.parse(Buffer.from(cj.content, 'base64').toString('utf-8'));
      return { id: rec.id, name: rec.skill?.name, version: rec.skill?.version, verdict: rec.verdict,
               status: rec.status, trust: rec.sentinel?.trust_score_100, submitted_at: rec.submitted_at,
               path: t.path, url: cj.html_url };
    } catch { return null; }
  }));
  return { ok: true, total: entries.length, items: items.filter(Boolean), note: 'Full queue (auditable): https://github.com/alicelabs-llc/marketnow-submissions' };
}
