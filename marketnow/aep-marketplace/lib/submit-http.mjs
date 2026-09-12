/**
 * MarketNow — Submission HTTP layer
 * ===================================
 * Mounted on api/skills.js via _mode routing (Hobby plan 12-function cap —
 * same pattern as api/community → api/certification?_mode=community):
 *
 *   POST /api/submit            → rewrite → /api/skills?_mode=submit
 *   GET  /api/submit            → docs (same rewrite)
 *   POST /api/submit?dry_run=1  → scan only, nothing stored
 *   GET  /api/submissions       → rewrite → /api/skills?_mode=queue
 *   GET  /api/submissions?id=…  → single record
 *
 * The MCP tool (marketnow_submit_skill) calls lib/submit-core.mjs directly.
 */

import { processSubmission, listSubmissions, getSubmission } from './submit-core.mjs';

const RATE = { max: 8, windowMs: 3600 * 1000 };
const BUCKET = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const arr = (BUCKET.get(ip) || []).filter(t => now - t < RATE.windowMs);
  if (arr.length >= RATE.max) return true;
  arr.push(now);
  BUCKET.set(ip, arr);
  if (BUCKET.size > 5000) BUCKET.clear();
  return false;
}

const DOCS = {
  endpoint: 'POST /api/submit',
  authentication: 'none — public, anyone can connect (rate limited: 8/hour per IP)',
  limits: { payload_kb: 100, submissions_per_ip_per_hour: RATE.max },
  dry_run: 'POST /api/submit?dry_run=1 — full scan, nothing stored',
  queue: 'GET /api/submissions — public, auditable',
  mcp_tool: 'marketnow_submit_skill (via the MarketNow MCP server)',
  human_docs: 'https://www.marketnow.site/submit.html',
  required: { name: 'string 2-60', version: 'semver x.y.z', description: '10-600 chars', author: 'string' },
  recommended: {
    runtime: 'node|python|rust|go|dotnet|docker|luau|roblox|java|php|ruby|other',
    install: 'exact install command', repo_url: 'source repo', homepage: 'project page',
    license: 'SPDX', tags: 'array max 12', capabilities: 'object',
    'doc.usage': 'string', 'doc.system_prompt': 'string (scanned for injection)',
    files: '{filename: content} max 60KB', 'test.url': 'https (probed live)', price: 'number USD',
  },
  pipeline: ['SCHEMA', 'INJECTION', 'SECRETS', 'DANGEROUS_API', 'URLS', 'TYPOSQUAT', 'DEDUP (live vs 69k+ catalog names)', 'CLAIMS_VERIFIED (repo + install package probed live)', 'REACHABILITY', 'DURABLE_RATE_LIMIT (queue-backed, 8/h, anti-flood 25/10min)'],
  verdicts: {
    accepted: '201 — stored, certified-L1.5 (claims verified), pending L2 + catalog merge (trust 25-60)',
    accepted_description_only: '201 — stored as pending-L2 (description-only): attach files, code or a verifiable repo_url to become merge-eligible',
    rejected: '422 — reasons returned (includes false claims: repo 404, install package 404)',
    rate_limited: '429 — durable limit exceeded',
  },
  honesty: 'Claims are verified live: if your repo_url 404s or your install references a package that does not exist on npm/PyPI/crates/Docker Hub, the submission is REJECTED. Description-only submissions never reach the catalog.',
  warning: 'Never include secrets — the scanner rejects them. We never ask for passwords or private keys.',
  example_curl: `curl -X POST https://www.marketnow.site/api/submit -H 'Content-Type: application/json' -d '{"name":"my-skill","version":"1.0.0","description":"what it does","author":"you","runtime":"node","install":"npx my-skill"}'`,
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function mountSubmission(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader('Content-Type', 'application/json');

  const mode = (req.query._mode || '').toLowerCase();

  // OPTIONS (preflight de AIs desde cualquier origen)
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }

  // ── GET/POST /api/submit (mode=submit) ────────────────────────────────────
  if (mode === 'submit') {
    if (req.method === 'GET') {
      res.status(200).json({ ok: true, docs: DOCS });
      return true;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'method not allowed — POST to submit, GET for docs' });
      return true;
    }
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    if (ip !== 'unknown' && rateLimited(ip)) {
      res.status(429).json({ ok: false, error: `rate limit: max ${RATE.max} submissions per hour — use dry_run=1 while you wait` });
      return true;
    }
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    if (!rawBody || rawBody === '{}' || rawBody === 'null' || rawBody.length < 30) {
      res.status(400).json({ ok: false, error: 'empty or invalid JSON body — GET /api/submit for the schema' });
      return true;
    }
    let payload;
    try {
      payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      res.status(400).json({ ok: false, error: 'body is not valid JSON' });
      return true;
    }
    const dryRun = req.query.dry_run === '1' || req.query.dry_run === 'true' || req.query.dryRun === '1';
    try {
      const result = await processSubmission(payload, { dryRun, remoteIp: ip });
      res.status(result.http).json({
        ok: result.accepted,
        submission_id: result.id,
        verdict: result.verdict,
        status: result.status,
        trust_score_100: result.trust_score_100,
        dry_run: result.dry_run,
        reasons: result.reasons,
        storage: result.storage,
        next_steps: result.accepted
          ? [String(result.status).startsWith('pending-L2')
              ? 'Stored, but description-only: attach files, code, or a verifiable repo_url to become merge-eligible.'
              : 'Passed Sentinel L1.5 (scan + claims verified) — stored in the public queue.',
             'Pending L2 review + catalog merge.',
             'Track: GET /api/submissions or https://github.com/alicelabs-llc/marketnow-submissions']
          : result.verdict === 'rate_limited'
            ? ['Wait for the rate window to reset (8/hour per source, anti-flood 25/10min).', 'Pre-check anytime: POST /api/submit?dry_run=1']
            : ['Fix the blockers listed in reasons and resubmit.',
               'Claims are verified live: repo_url must exist and install must reference a real registry package.',
               'Pre-check anytime: POST /api/submit?dry_run=1'],
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: `pipeline error: ${String(e && e.message || e).slice(0, 200)}` });
    }
    return true;
  }

  // ── GET /api/submissions (mode=queue) ─────────────────────────────────────
  if (mode === 'queue') {
    if (req.method !== 'GET') { res.status(405).json({ ok: false, error: 'GET only' }); return true; }
    const id = (req.query.id || '').trim();
    if (id) {
      if (!/^mn-sub-[a-z0-9-]+$/i.test(id)) {
        res.status(400).json({ ok: false, error: 'invalid submission id format' });
        return true;
      }
      try {
        const q = await getSubmission(id);
        res.status(q.ok ? 200 : 404).json(q);
      } catch (e) {
        res.status(502).json({ ok: false, error: `queue read failed: ${String(e && e.message || e).slice(0, 120)}` });
      }
      return true;
    }
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '100', 10) || 100));
    try {
      const q = await listSubmissions(limit);
      if (!q.ok) { res.status(502).json({ ok: false, error: `queue read failed: ${q.reason}` }); return true; }
      res.status(200).json({ ok: true, total_submissions: q.total, showing: q.items.length, items: q.items, audit_trail: q.note, submit_docs: 'GET /api/submit' });
    } catch (e) {
      res.status(502).json({ ok: false, error: `queue read failed: ${String(e && e.message || e).slice(0, 120)}` });
    }
    return true;
  }

  return false; // no era un modo de submission — skills.js sigue su curso normal
}
