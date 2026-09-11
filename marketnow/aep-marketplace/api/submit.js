// POST /api/submit — PUBLIC skill submission endpoint (the write side)
// =====================================================================
// Anyone — human or AI agent — can submit a skill package. No API key,
// no login. The payload goes through the Sentinel L1-sub pipeline:
//
//   schema validation → injection/secret/dangerous-API/URL scan →
//   typosquat + catalog dedup → optional reachability probe →
//   ACCEPT (stored + certified-L1, pending L2) or REJECT (reasons returned)
//
// Accepted submissions are durably stored (audit trail) in the public
// repo alicelabs-llc/marketnow-submissions and are eligible for catalog merge.
//
// GET  /api/submit            → schema + rules documentation
// POST /api/submit            → submit (JSON body)
// POST /api/submit?dry_run=1  → validate + scan only, nothing stored
//
// Limits: 100KB payload, 8 submissions per IP per hour (best effort).

import { processSubmission } from '../lib/submit-core.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// best-effort per-instance rate limit (serverless: warm instances persist)
const BUCKET = new Map(); // ip:sha → [timestamps]
const RATE = { max: 8, windowMs: 3600 * 1000 };

function rateLimited(ip) {
  const now = Date.now();
  const arr = (BUCKET.get(ip) || []).filter(t => now - t < RATE.windowMs);
  if (arr.length >= RATE.max) return true;
  arr.push(now);
  BUCKET.set(ip, arr);
  if (BUCKET.size > 5000) BUCKET.clear(); // anti-crecimiento
  return false;
}

const DOCS = {
  endpoint: 'POST /api/submit',
  authentication: 'none — public, anyone can connect (rate limited)',
  limits: { payload_kb: 100, submissions_per_ip_per_hour: RATE.max },
  dry_run: 'POST /api/submit?dry_run=1 — full scan, nothing stored',
  queue: 'GET /api/submissions — public, auditable',
  mcp_tool: 'marketnow_submit_skill (via the MarketNow MCP server)',
  required: {
    name: 'string 2-60 chars, letters/digits/dot/dash/slash',
    version: 'semver-like x.y.z',
    description: 'string 10-600 chars',
    author: 'string (you or your org)',
  },
  recommended: {
    runtime: 'node | python | rust | go | dotnet | docker | luau | roblox | java | php | ruby | other',
    install: 'exact install/run command',
    repo_url: 'source repository',
    homepage: 'project page',
    license: 'SPDX name',
    tags: 'array, max 12',
    capabilities: 'object: requires_auth, requires_network, input_types, output_types, execution_context',
    'doc.usage': 'usage instructions',
    'doc.system_prompt': 'system prompt for the skill (scanned for injection)',
    files: 'object {filename: content} — max 60KB total (or use repo_url)',
    'test.url': 'https URL — Sentinel probes reachability if provided',
    price: 'number, default 0 (USD)',
  },
  pipeline: [
    'SCHEMA — structure and size validation',
    'INJECTION — prompt-injection patterns in descriptions/prompts/code',
    'SECRETS — embedded API keys/tokens/private keys',
    'DANGEROUS_API — eval/exec/loadstring, curl|sh, remote require, rm -rf, base64|sh',
    'URLS — shorteners, suspicious TLDs, punycode, internal addresses',
    'TYPOSQUAT — edit-distance vs popular skill names',
    'DEDUP — exact name match against the public catalog (69k+ entries)',
    'REACHABILITY — optional live probe of test.url',
  ],
  verdicts: {
    accepted: '201 — stored in the public submissions queue, status certified-L1 (auto-scan), pending L2 review; trust 25-60',
    rejected: '422 — reasons returned (blockers = critical/high findings); fix and resubmit',
  },
  example_curl: `curl -X POST https://www.marketnow.site/api/submit \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"my-mcp-skill","version":"1.0.0","description":"...","author":"you","runtime":"node","install":"npx my-mcp-skill"}'`,
  notes: 'We never ask for passwords or private keys in submissions. Do NOT include secrets — the scanner rejects them.',
};

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, docs: DOCS });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method not allowed — POST to submit, GET for docs' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (ip !== 'unknown' && rateLimited(ip)) {
    return res.status(429).json({
      ok: false, error: `rate limit: max ${RATE.max} submissions per hour — use dry_run=1 while you wait`,
    });
  }

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  if (!rawBody || rawBody === '{}' || rawBody === 'null' || rawBody.length < 30) {
    return res.status(400).json({ ok: false, error: 'empty or invalid JSON body — GET /api/submit for the schema' });
  }

  const dryRun = (req.query.dry_run || req.query.dryRun) === '1' || req.query.dry_run === 'true';
  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ ok: false, error: 'body is not valid JSON' });
  }

  let result;
  try {
    result = await processSubmission(payload, { dryRun, remoteIp: ip });
  } catch (e) {
    return res.status(500).json({ ok: false, error: `pipeline error: ${String(e && e.message || e).slice(0, 200)}` });
  }

  const body = {
    ok: result.accepted,
    submission_id: result.id,
    verdict: result.verdict,
    status: result.status,
    trust_score_100: result.trust_score_100,
    dry_run: result.dry_run,
    reasons: result.reasons,
    storage: result.storage,
    next_steps: result.accepted
      ? ['Your skill passed the Sentinel L1-sub auto-scan and is stored in the public queue.',
         'It is now pending L2 review (deeper checks + catalog merge).',
         'Track it: GET /api/submissions or https://github.com/alicelabs-llc/marketnow-submissions']
      : ['Fix the blockers listed in reasons and resubmit.',
         'Use POST /api/submit?dry_run=1 to pre-check without storing.'],
  };
  return res.status(result.http).json(body);
}
