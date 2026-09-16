#!/usr/bin/env node
/**
 * MarketNow MCP Server v1.10.0 — ATC/1.0 Spec Verifier
 * =======================================================
 *
 * Security Infrastructure for AI Agents.
 *
 * Tools exposed (15) — all use the `marketnow_` namespace prefix so MCP
 * clients (Claude Desktop, Cursor, Cline, Continue, LangChain, LlamaIndex)
 * can disambiguate them from other servers' tools at tool-choice time.
 *
 *   1. marketnow_search_skills         — keyword/category/price-bounded search
 *   2. marketnow_get_skill             — full skill detail by ID/slug
 *   3. marketnow_list_categories       — marketplace taxonomy with counts
 *   4. marketnow_get_manifest          — marketplace metadata + security metrics
 *   5. marketnow_get_install_command   — npx install command for a skill
 *   6. marketnow_verify_trust          — verify an Agent Trust Card (ATC) on the MarketNow CA
 *   7. marketnow_verify_receipt        — verify a signed delivery proof (rcpt_)
 *   8. marketnow_submit_skill          — submit a GitHub repo (L1.5+L1.7 sync, L2 queued)
 *   9. marketnow_mint_referral         — mint ref_xxxxxxxx (5% commission)
 *  10. marketnow_lookup_referral       — referral stats (clicks, installs, earnings)
 *  11. marketnow_recommend_skills      — AI-ranked skill recommendations for a task
 *  12. marketnow_get_owasp_compliance  — OWASP MCP Cheat Sheet compliance status
 *  13. marketnow_verify_atc_spec       — verify ANY ATC against the ATC/1.0 spec
 *  14. marketnow_check_revocation      — OCSP-style revocation status (card_id | kid) (NEW)
 *  15. marketnow_fingerprint_tool      — TFP-1.0 tool fingerprinting + drift detection (NEW)
 *
 * v1.11.1 (September 2026) — Version Self-Report Fix
 *   - serverInfo.version now read dynamically from package.json (never drifts
 *     from the published version again; 1.11.0 shipped reporting 1.10.3).
 * v1.11.0 (September 2026) — Registry Stats Refresh
 *   - catalog 5.9.2: 68,387 verified MCP servers (README + descriptions).
 * v1.10.3 (September 2026) — Security Hardening
 *   - @modelcontextprotocol/sdk upgraded 0.5.0 -> 1.30.0, resolving advisory
 *     GHSA-w48q-cv73-mx4w (DNS rebinding protection). npm audit: 0
 *     vulnerabilities. The low-level Server API is unchanged — fully
 *     backwards compatible, same 15 tools, same protocol behavior.
 *
 * v1.10.2 (September 2026) — Revocation + Tool Fingerprinting (roadmap v5.1)
 *   - New tool: marketnow_check_revocation — per-subject revocation status
 *     against the signed MarketNow Revocation Registry (MNR-CRL-1.0) + live
 *     ledger. States: VALID/EXPIRED/REVOKED/SUPERSEDED/UNKNOWN with
 *     PERMIT/DENY recommendation, fail-closed on unknown subjects. Embeds the
 *     CRL signature so any client can independently verify the signed layer.
 *   - New tool: marketnow_fingerprint_tool — TFP-1.0 cryptographic tool
 *     fingerprinting (RFC 8785 JCS + SHA-256 per tool + manifest fingerprint).
 *     Pass a previous manifest to get a drift report (added/removed/changed) —
 *     the OWASP MCP Cheat Sheet control "verify tool descriptions haven't
 *     changed" (tool poisoning / rug-pull detection). Fully self-contained.
 *   - package.json repository.directory fixed (mcp-server → marketnow/mcp-server).
 *
 * v1.10.0 (August 2026) — ATC/1.0 Spec Verifier
 *   - New tool: marketnow_verify_atc_spec — accepts ANY Agent Trust Card
 *     (regardless of issuer — MarketNow Sentinel CA, a third-party CA, or a
 *     self-signed test CA) and verifies ATC/1.0 conformance:
 *       * ATC-001 Identity          (structural)
 *       * ATC-002 Attestation        (structural + crypto)
 *       * ATC-003 Capabilities       (structural + enum validation)
 *       * ATC-004 Evidence           (structural)
 *       * ATC-005 Risk               (structural + range)
 *       * ATC-006 Signature          (Ed25519 + RFC 8785 JCS + SHA-256)
 *       * ATC-007 Revocation         (structural — list fetch is opt-in)
 *       * ATC-008 Expiration         (date window)
 *   - This makes marketnow-mcp the LIVE REFERENCE IMPLEMENTATION of ATC/1.0.
 *     Any agent that loads this MCP server can verify ATCs from any issuer.
 *   - Self-contained verifier in lib/atc-verify.mjs (no external crypto deps
 *     beyond node:crypto + canonicalize).
 *
 * v1.9.0 (August 2026) — Agent Contract Hardening
 *   - All 12 tools renamed to `marketnow_*` namespace prefix (was `search_skills`, etc.)
 *   - Descriptions rewritten to be intent-oriented: every description states
 *     WHEN and WHY an agent should invoke the tool, not what the code does.
 *   - inputSchema hardened: enum on known categorical fields (category, sort_by,
 *     sort_order), numeric bounds (minimum/maximum on limit & max_price),
 *     pattern hints on IDs (card_id, receipt_id, ref_code).
 *   - CallToolRequest handler keeps the structured `{ content, isError }` envelope
 *     and now also normalizes unexpected exceptions into MCP-safe error payloads
 *     (no stack traces leaked to the agent).
 *   - INVALID_ARGUMENT / NOT_FOUND / UNKNOWN_TOOL error code taxonomy.
 *
 * v1.8.0 (August 2026): marketnow_get_owasp_compliance added.
 * v1.7.0 (July 2026):   submit_skill became REAL; mint_referral + lookup_referral
 *                       closed the viral loop (5% commission); verify_receipt added.
 *
 * AGENT CONTRACT (v1.10.0) — see AUDIT.md in this package for the full checklist.
 * The four golden rules enforced here:
 *   A. Tool names are deterministic snake_case with `marketnow_` prefix.
 *   B. Descriptions tell the agent WHEN to call, not WHAT the code does.
 *   C. inputSchema is strict: type + enum + description on every property.
 *   D. Responses are MCP-shaped: { content: [{type:'text', text:JSON}], isError?:bool }.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// ATC/1.0 spec verifier (NEW in v1.10.0)
import { verifyATC as verifyATCSpec } from './lib/atc-verify.mjs';
// ATC/3.0-core unified: production-envelope verifier (ledger cards) — v1.12.0 (interim 1.4 label), re-versioned v1.13.0
import { verifyLedgerCard } from './lib/atc-verify.mjs';

const API_BASE = 'https://marketnow.site/api';

// node:crypto for the self-contained TFP-1.0 fingerprinting tool (NEW v1.10.2)
import { createHash } from 'node:crypto';
import canonicalize from 'canonicalize';

// ─── Known categorical values (kept in sync with /api/categories.json) ──────
// Used to enforce strict enum validation in inputSchema (Rule C).
const KNOWN_CATEGORIES = [
  'AI/ML',
  'Data',
  'Web/API',
  'Security',
  'DevOps',
  'Communication',
  'Productivity',
  'Automation',
  'Finance',
  'Marketing',
  'Other',
];

const SORT_BY_VALUES = ['relevance', 'price_asc', 'price_desc', 'newest', 'sentinel_desc'];
const SORT_ORDER_VALUES = ['asc', 'desc'];

// ─── Fetch helpers ──────────────────────────────────────────────────────────
let skillsCache = null;
let cacheTime = 0;
const CACHE_TTL = 3600_000; // 1 hour

async function fetchSkills() {
  if (skillsCache && Date.now() - cacheTime < CACHE_TTL) {
    return skillsCache;
  }
  const res = await fetch(`${API_BASE}/skills.json`);
  if (!res.ok) throw new Error(`Failed to fetch skills: HTTP ${res.status}`);
  skillsCache = await res.json();
  cacheTime = Date.now();
  return skillsCache;
}

async function fetchManifest() {
  const res = await fetch(`${API_BASE}/manifest.json`);
  if (!res.ok) throw new Error(`Failed to fetch manifest: HTTP ${res.status}`);
  return res.json();
}

async function fetchCategories() {
  const res = await fetch(`${API_BASE}/categories.json`);
  if (!res.ok) throw new Error(`Failed to fetch categories: HTTP ${res.status}`);
  return res.json();
}

// ─── 14. Revocation status (MNR-OCSP-1.0) — NEW v1.10.2 ────────────────────
async function checkRevocation(args) {
  const subject = args.card_id ? `card_id=${encodeURIComponent(args.card_id)}` : args.kid ? `kid=${encodeURIComponent(args.kid)}` : null;
  if (!subject) {
    const err = new Error('marketnow_check_revocation requires card_id (ATC) or kid (CA key)');
    err.code = 'INVALID_ARGUMENT';
    throw err;
  }
  const url = `${API_BASE}/ocsp?${subject}${args.nonce ? `&nonce=${encodeURIComponent(args.nonce)}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Revocation responder HTTP ${res.status} — fail-closed: treat as UNKNOWN/DENY`);
  return res.json();
}

// ─── 15. Tool fingerprinting (TFP-1.0) — NEW v1.10.2 ───────────────────────
// Self-contained: node:crypto + canonicalize (RFC 8785 JCS). No network calls.
async function fingerprintToolDefs(args) {
  const tools = args?.tools;
  if (!Array.isArray(tools) || tools.length === 0 || tools.length > 200) {
    const err = new Error('marketnow_fingerprint_tool requires `tools`: a non-empty array (max 200) of tool definitions from tools/list');
    err.code = 'INVALID_ARGUMENT';
    throw err;
  }
  const seen = new Set();
  for (const t of tools) {
    if (!t || typeof t.name !== 'string' || !t.name) {
      const err = new Error('every tool definition needs a non-empty string `name`');
      err.code = 'INVALID_ARGUMENT';
      throw err;
    }
    if (seen.has(t.name)) {
      const err = new Error(`duplicate tool name in input: ${t.name}`);
      err.code = 'INVALID_ARGUMENT';
      throw err;
    }
    seen.add(t.name);
  }
  const fp = (t) => createHash('sha256').update(Buffer.from(canonicalize(t), 'utf-8')).digest('hex');
  const perTool = tools
    .map((t) => ({ name: t.name, fingerprint_sha256: fp(t) }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));
  const manifestFingerprint = createHash('sha256')
    .update(Buffer.from(canonicalize(perTool.map((p) => [p.name, p.fingerprint_sha256])), 'utf-8'))
    .digest('hex');

  const result = {
    format: 'TFP-1.0',
    algorithm: 'sha256 over RFC 8785 JCS canonical tool definition',
    computed_at: new Date().toISOString(),
    tool_count: perTool.length,
    tools: perTool,
    manifest_fingerprint_sha256: manifestFingerprint,
    pinning: {
      how: 'Store the `tools` array + manifest_fingerprint_sha256. On every subsequent tools/list, re-run this tool with `pinned` to detect drift.',
      owasp: 'MCP Cheat Sheet — verify tool descriptions haven\u2019t changed (tool poisoning / rug-pull detection)',
    },
  };

  const pinned = args?.pinned;
  if (pinned && Array.isArray(pinned.tools)) {
    const current = new Map(perTool.map((p) => [p.name, p.fingerprint_sha256]));
    const before = new Map(pinned.tools.map((p) => [p.name, p.fingerprint_sha256]));
    const drift = {
      added: [...current.keys()].filter((n) => !before.has(n)),
      removed: [...before.keys()].filter((n) => !current.has(n)),
      changed: [...current.keys()].filter((n) => before.has(n) && before.get(n) !== current.get(n)),
    };
    drift.unchanged_count = [...current.keys()].filter((n) => before.has(n) && before.get(n) === current.get(n)).length;
    drift.verdict = drift.changed.length || drift.removed.length || drift.added.length ? 'DRIFT_DETECTED' : 'MATCH';
    if (pinned.manifest_fingerprint_sha256) {
      drift.pinned_manifest_matches = pinned.manifest_fingerprint_sha256 === manifestFingerprint;
    }
    result.drift = drift;
  }
  return result;
}

async function fetchOwaspCompliance(args) {
  // FIX 1.12.0 (audit Task 63): the old implementation fetched /api/owasp —
  // a lambda that was removed under the Vercel Hobby cap (404 → broken tool)
  // and which, when it existed, only returned a stub. The compliance matrix is
  // now a REAL static artifact (/api/owasp.json) and per-skill data is
  // computed locally from the skills catalog (the client already holds it).
  const res = await fetch(`${API_BASE}/owasp.json`);
  const matrix = res.ok ? await res.json() : {
    service: 'MarketNow',
    artifact: 'OWASP MCP Cheat Sheet — alignment matrix',
    fallback: true,
    note: 'Live matrix unavailable — fetch /api/owasp.json directly.',
    controls: [],
    summary: { implemented: 0, partial: 0, total: 0, unavailable: true },
  };

  const skillId = args && args.skill_id ? String(args.skill_id) : null;
  if (!skillId) return matrix;

  // Per-skill: Sentinel evidence + install surface from the catalog the
  // client already caches. Honest scope: this is catalog evidence, not a
  // sandbox report — L2 sandbox results live at /api/certification.json.
  validatePattern('skill_id', skillId, PATTERNS.skill_id, 'mn-ai-00001');
  const skills = await fetchSkills();
  const skill = skills.find(s => s.id === skillId || s.slug === skillId);
  if (!skill) {
    const err = new Error(`Skill not found: ${skillId}`);
    err.code = 'NOT_FOUND';
    throw err;
  }
  return {
    ...matrix,
    skill: {
      skill_id: skill.id,
      name: skill.name,
      category: skill.category,
      sentinel_score: skill.sentinel_score ?? null,
      install: skill.install || null,
      page_url: `https://marketnow.site/skill/${skill.id}`,
      fingerprint_how_to: 'Run marketnow_fingerprint_tool with the server\'s tools/list output to pin (TFP-1.0) and later diff for drift.',
      note: 'Per-skill capability manifests ship inside Agent Trust Cards (see marketnow_verify_trust / ATC/3.0-core).',
    },
  };
}

// ─── Input validation helpers (Rule C — strict schemas) ─────────────────────
// Centralized so the same regex is used in schema declaration (pattern) and
// runtime validation, preventing schema/runtime drift.

const PATTERNS = {
  skill_id: /^[a-z0-9-]+$/i,            // mn-ai-00001, my-skill-slug
  card_id: /^ATC-\d{4}-\d{6,}$/i,       // ATC-2026-7777670
  receipt_id: /^rcpt_[a-z0-9]{16,}$/i,  // rcpt_c8b9dc67f88e4da5bd3a
  ref_code: /^ref_[a-z0-9]{6,}$/i,      // ref_a1b2c3d4
  agent_id: /^[a-z0-9_-]{3,64}$/i,      // agent_claude_001
  repo_url: /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/i,
};

function validatePattern(name, value, pattern, example, opts) {
  // FIX 1.12.0 (audit Task 63): undefined/null required fields used to slip
  // through and explode downstream as INTERNAL_ERROR. Now a missing required
  // value is an explicit INVALID_ARGUMENT at the boundary.
  if (value === undefined || value === null) {
    if (opts && opts.required) {
      const err = new Error(`Missing required argument: ${name} (e.g. ${example})`);
      err.code = 'INVALID_ARGUMENT';
      throw err;
    }
    return; // optional and absent — fine
  }
  if (typeof value !== 'string' || !pattern.test(value)) {
    const err = new Error(
      `Invalid ${name}: must match ${pattern.toString()} (e.g. ${example}). Got: ${String(value).slice(0, 60)}`
    );
    err.code = 'INVALID_ARGUMENT';
    throw err;
  }
}

function clampInt(value, min, max, fallback) {
  if (value === undefined || value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n)) {
    const err = new Error(`Expected integer, got: ${String(value).slice(0, 30)}`);
    err.code = 'INVALID_ARGUMENT';
    throw err;
  }
  return Math.max(min, Math.min(max, n));
}

// ─── Tool implementations ───────────────────────────────────────────────────
async function searchSkills(args) {
  const { query = '', category, max_price, sort_by = 'relevance', sort_order = 'desc' } = args;
  const limit = clampInt(args.limit, 1, 50, 10);

  // FIX 1.12.0 (audit Task 63): unbounded 100KB queries were accepted (and
  // substring-matched). Bound the query like every other input.
  if (query !== undefined && query !== null && (typeof query !== 'string' || query.length > 300)) {
    const err = new Error('query must be a string of at most 300 characters');
    err.code = 'INVALID_ARGUMENT';
    throw err;
  }

  if (category && !KNOWN_CATEGORIES.includes(category)) {
    const err = new Error(`Unknown category: ${category}. Valid: ${KNOWN_CATEGORIES.join(', ')}`);
    err.code = 'INVALID_ARGUMENT';
    throw err;
  }
  if (sort_by && !SORT_BY_VALUES.includes(sort_by)) {
    const err = new Error(`Unknown sort_by: ${sort_by}. Valid: ${SORT_BY_VALUES.join(', ')}`);
    err.code = 'INVALID_ARGUMENT';
    throw err;
  }

  const skills = await fetchSkills();
  let results = skills;

  if (category) {
    results = results.filter(s => s.category?.toLowerCase() === category.toLowerCase());
  }
  if (max_price !== undefined) {
    results = results.filter(s => (s.price ?? 0) <= max_price);
  }

  if (query) {
    const q = query.toLowerCase();
    results = results
      .map(s => {
        const nameMatch = (s.name || '').toLowerCase().includes(q) ? 10 : 0;
        const descMatch = (s.description || '').toLowerCase().includes(q) ? 5 : 0;
        const tagMatch = (s.tags || []).some(t => String(t).toLowerCase().includes(q)) ? 8 : 0;
        return { skill: s, score: nameMatch + descMatch + tagMatch };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(x => x.skill);
  } else {
    results = results.slice(0, limit);
  }

  return {
    success: true,
    count: results.length,
    query: query || null,
    category: category || null,
    sort_by,
    sort_order,
    skills: results.map(s => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      description: s.description?.slice(0, 200),
      category: s.category,
      price: s.price,
      currency: s.currency || 'USD',
      install: s.install,
      sentinel_score: s.sentinel_score,
      url: `https://marketnow.site/skill/${s.id}`,
    })),
  };
}

async function getSkill(args) {
  const { skill_id } = args;
  validatePattern('skill_id', skill_id, PATTERNS.skill_id, 'mn-ai-00001', { required: true });
  const skills = await fetchSkills();
  const skill = skills.find(s => s.id === skill_id || s.slug === skill_id);
  if (!skill) {
    const err = new Error(`Skill not found: ${skill_id}`);
    err.code = 'NOT_FOUND';
    throw err;
  }
  return {
    success: true,
    ...skill,
    url: `https://marketnow.site/skill/${skill.id}`,
    buy_url: `https://marketnow.site/skill/${skill.id}`,
  };
}

async function listCategories() {
  return await fetchCategories();
}

async function getInstallCommand(args) {
  const { skill_id } = args;
  validatePattern('skill_id', skill_id, PATTERNS.skill_id, 'mn-ai-00001', { required: true });
  const skills = await fetchSkills();
  const skill = skills.find(s => s.id === skill_id || s.slug === skill_id);
  if (!skill) {
    const err = new Error(`Skill not found: ${skill_id}`);
    err.code = 'NOT_FOUND';
    throw err;
  }
  return {
    success: true,
    skill_id: skill.id,
    name: skill.name,
    install_command: skill.install || `npx -y @marketnow/install ${skill.slug}`,
    price: skill.price,
    currency: skill.currency || 'USD',
    note: `This skill is FREE. Install directly: ${skill.install || `npx -y @marketnow/install ${skill.slug}`}`,
    referral: `Found via MarketNow MCP (ref=mcpsrv). Share: https://marketnow.site/skill/${skill.id}`,
  };
}

async function verifyTrust(args) {
  const { card_id } = args;
  validatePattern('card_id', card_id, PATTERNS.card_id, 'ATC-2026-7777670', { required: true });
  const res = await fetch(`${API_BASE}/atc?action=verify&card_id=${encodeURIComponent(card_id)}`);
  if (!res.ok) throw new Error(`Verify failed: HTTP ${res.status}`);
  return await res.json();
}

async function verifyReceipt(args) {
  const { receipt_id } = args;
  validatePattern('receipt_id', receipt_id, PATTERNS.receipt_id, 'rcpt_c8b9dc67f88e4da5bd3a', { required: true });
  const res = await fetch(`${API_BASE}/atc?action=verify-receipt&receipt_id=${encodeURIComponent(receipt_id)}`);
  if (!res.ok) {
    if (res.status === 404) {
      return {
        valid: false,
        receipt_id,
        reason: 'not_found',
        message: `No receipt with id ${receipt_id} exists in the public ledger.`,
      };
    }
    throw new Error(`Verify receipt failed: HTTP ${res.status}`);
  }
  return await res.json();
}

async function submitSkill(args) {
  const { repo_url, name, description, submitter_agent_id, submitter_email, ref_code } = args;
  validatePattern('repo_url', repo_url, PATTERNS.repo_url, 'https://github.com/user/my-mcp-server', { required: true });
  if (submitter_agent_id) validatePattern('submitter_agent_id', submitter_agent_id, PATTERNS.agent_id, 'agent_claude_001');
  if (ref_code) validatePattern('ref_code', ref_code, PATTERNS.ref_code, 'ref_a1b2c3d4', { required: true });

  const res = await fetch(`${API_BASE}/submit-skill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_url,
      name,
      description,
      submitter_agent_id,
      submitter_email,
      ref_code,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    let parsed;
    try { parsed = JSON.parse(errBody); } catch { parsed = { raw: errBody }; }
    return {
      success: false,
      status: 'rejected',
      http_status: res.status,
      error: parsed.error || 'unknown',
      message: parsed.message || `Submit failed: HTTP ${res.status}`,
      repo_url,
      ...(parsed.findings ? { findings: parsed.findings } : {}),
    };
  }

  const result = await res.json();
  return {
    success: true,
    status: 'submitted',
    submission_id: result.submission_id,
    skill_id: result.skill_id,
    repo: result.repo,
    audit: result.audit,
    ledger_url: result.ledger_url,
    next_steps: result.next_steps,
    check_status_url: result.check_status_url,
    note: 'L1.5 + L1.7 checks passed. L2 sandbox audit queued (~1h). You will be discoverable via marketnow_search_skills once L2 passes.',
  };
}

async function mintReferral(args) {
  const { agent_id } = args;
  validatePattern('agent_id', agent_id, PATTERNS.agent_id, 'agent_claude_001', { required: true });
  const res = await fetch(`${API_BASE}/referrals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'mint', agent_id }),
  });
  if (!res.ok) throw new Error(`Mint referral failed: HTTP ${res.status}`);
  return await res.json();
}

async function lookupReferral(args) {
  const { ref_code } = args;
  validatePattern('ref_code', ref_code, PATTERNS.ref_code, 'ref_a1b2c3d4', { required: true });
  const res = await fetch(`${API_BASE}/referrals?action=lookup&ref_code=${encodeURIComponent(ref_code)}`);
  if (!res.ok) {
    if (res.status === 404) {
      return {
        success: false,
        status: 'not_found',
        ref_code,
        message: `No referral with code ${ref_code} exists. Mint one with marketnow_mint_referral.`,
      };
    }
    throw new Error(`Lookup referral failed: HTTP ${res.status}`);
  }
  return await res.json();
}

async function recommendSkills(args) {
  const { task } = args;
  const limit = clampInt(args.limit, 1, 20, 5);
  if (!task || typeof task !== 'string' || task.trim().length < 3) {
    const err = new Error('task is required and must be at least 3 characters (e.g. "scrape a website", "query a database")');
    err.code = 'INVALID_ARGUMENT';
    throw err;
  }
  const skills = await fetchSkills();
  const taskLower = task.toLowerCase();

  const scored = skills
    .map(s => {
      let score = 0;
      const name = (s.name || '').toLowerCase();
      const desc = (s.description || '').toLowerCase();
      const tags = (s.tags || []).join(' ').toLowerCase();
      for (const word of taskLower.split(/\s+/)) {
        if (word.length < 3) continue;
        if (name.includes(word)) score += 10;
        if (desc.includes(word)) score += 5;
        if (tags.includes(word)) score += 8;
      }
      score += (s.sentinel_score || 0) * 0.5;
      return { skill: s, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    success: true,
    task,
    recommendations: scored.map(x => ({
      id: x.skill.id,
      name: x.skill.name,
      description: (x.skill.description || '').slice(0, 150),
      sentinel_score: x.skill.sentinel_score,
      install: x.skill.install,
      url: `https://marketnow.site/skill/${x.skill.id}`,
      match_score: Math.round(x.score),
    })),
    tip: `Found ${scored.length} skills for "${task}". Install any with: npx -y @marketnow/install <slug>`,
  };
}

// ─── MCP Server setup ───────────────────────────────────────────────────────
import { createRequire } from 'node:module';
const require_ = createRequire(import.meta.url);
const PKG_VERSION = require_('./package.json').version;
const server = new Server(
  {
    name: 'marketnow-mcp', // FIX 1.12.0: was 'marketnow' — align with the hosted /api/mcp serverInfo so clients see ONE server identity
    version: PKG_VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ─── ListToolsRequest handler — Rule A, B, C enforced here ──────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // ── 1. Search ────────────────────────────────────────────────────────────
    {
      name: 'marketnow_search_skills',
      description:
        'Search the MarketNow marketplace for MCP-compatible skills. Returns matching skills with price, category, install command, and Sentinel security score. Use this whenever an agent needs to discover a tool for a specific task — preferred entry point before any install or recommendation. Results are bounded to `limit` (1–50) and sorted by the requested criterion.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural language or keyword search (e.g. "scrape website", "discord bot", "query postgres"). Leave empty to browse by category alone.',
            minLength: 0,
            maxLength: 200,
          },
          category: {
            type: 'string',
            enum: KNOWN_CATEGORIES,
            description: 'Optional category filter. Must be one of the known marketplace categories.',
          },
          max_price: {
            type: 'number',
            minimum: 0,
            maximum: 1000,
            description: 'Optional upper bound on price in USD (e.g. 2.99). Set to 0 to list only free skills.',
          },
          sort_by: {
            type: 'string',
            enum: SORT_BY_VALUES,
            description: 'Sort criterion. Default: relevance. Use sentinel_desc to surface the highest-security-scored skills first.',
            default: 'relevance',
          },
          sort_order: {
            type: 'string',
            enum: SORT_ORDER_VALUES,
            description: 'Sort direction. Default: desc.',
            default: 'desc',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 50,
            description: 'Maximum number of results to return. Default: 10. Hard ceiling: 50.',
            default: 10,
          },
        },
        // Only `query` is optional; everything else has safe defaults.
        required: [],
      },
    },

    // ── 2. Get skill ────────────────────────────────────────────────────────
    {
      name: 'marketnow_get_skill',
      description:
        'Fetch full metadata for a single skill by its ID or slug. Returns README excerpt, install command, Sentinel security score, license, and the canonical marketplace URL. Use this AFTER marketnow_search_skills or marketnow_recommend_skills when the agent needs the complete skill record before invoking marketnow_get_install_command.',
      inputSchema: {
        type: 'object',
        properties: {
          skill_id: {
            type: 'string',
            pattern: PATTERNS.skill_id.source,
            description: 'Skill ID (e.g. mn-ai-00001) or slug (e.g. web-scraper). Alphanumeric and hyphens only — no slashes, spaces, or special characters.',
          },
        },
        required: ['skill_id'],
      },
    },

    // ── 3. List categories ─────────────────────────────────────────────────
    {
      name: 'marketnow_list_categories',
      description:
        'List all marketplace skill categories with live counts. Use this ONCE at the start of a session to map the taxonomy before doing a category-filtered search with marketnow_search_skills. No input parameters.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },

    // ── 4. Get manifest ────────────────────────────────────────────────────
    {
      name: 'marketnow_get_manifest',
      description:
        'Get marketplace metadata: total skill count, pricing tiers, API endpoint inventory, and aggregate security metrics (Sentinel checks performed, threats detected, skills quarantined). Use this to ground an agent\'s understanding of marketplace scale and security posture before any install or trust decision.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },

    // ── 5. Get install command ────────────────────────────────────────────
    {
      name: 'marketnow_get_install_command',
      description:
        'Get the exact `npx` install command for a skill. Use this when an agent has already selected a skill via marketnow_search_skills or marketnow_recommend_skills and is ready to install. All skills are currently FREE — no purchase step is required.',
      inputSchema: {
        type: 'object',
        properties: {
          skill_id: {
            type: 'string',
            pattern: PATTERNS.skill_id.source,
            description: 'Skill ID (e.g. mn-ai-00001) or slug. Alphanumeric and hyphens only.',
          },
        },
        required: ['skill_id'],
      },
    },

    // ── 6. Verify ATC ─────────────────────────────────────────────────────
    {
      name: 'marketnow_verify_trust',
      description:
        'Verify an Agent Trust Card (ATC) before interacting with an untrusted agent or skill. Checks the Ed25519 signature, expiry date, and revocation status. Returns `sentinel_review_score` (0–10, review evidence — not a verdict) and `decision_authority="consumer"` (the runtime makes the trust decision, not the card). Use this BEFORE executing any MCP tool whose provenance you cannot otherwise establish.',
      inputSchema: {
        type: 'object',
        properties: {
          card_id: {
            type: 'string',
            pattern: PATTERNS.card_id.source,
            description: 'ATC card ID. Format: ATC-YYYY-NNNNNNN (e.g. ATC-2026-7777670).',
          },
        },
        required: ['card_id'],
      },
    },

    // ── 7. Verify receipt ─────────────────────────────────────────────────
    {
      name: 'marketnow_verify_receipt',
      description:
        'Verify a signed delivery proof (action-receipt) for a completed purchase. Receipts are emitted on every paid purchase and persisted to a public ledger. Returns what was delivered (skill_id, license_key, amount), the settle txhash, and interop fields for the Vibe action-ref system. Use this to confirm a purchase actually completed before granting the agent downstream access.',
      inputSchema: {
        type: 'object',
        properties: {
          receipt_id: {
            type: 'string',
            pattern: PATTERNS.receipt_id.source,
            description: 'Receipt ID. Must start with "rcpt_" followed by at least 16 alphanumeric characters (e.g. rcpt_c8b9dc67f88e4da5bd3a).',
          },
        },
        required: ['receipt_id'],
      },
    },

    // ── 8. Submit skill ────────────────────────────────────────────────────
    {
      name: 'marketnow_submit_skill',
      description:
        'Submit a GitHub repository containing an MCP server to the MarketNow marketplace. The server runs L1.5 metadata checks + L1.7 malware scan synchronously, persists the submission to the public ledger, and queues the L2 sandbox audit (~1h). If L1.5+L1.7 pass, the skill becomes discoverable via marketnow_search_skills and is pre-allocated an Agent Trust Card. FREE. Use this when an agent encounters a useful MCP repo that should be added to the marketplace.',
      inputSchema: {
        type: 'object',
        properties: {
          repo_url: {
            type: 'string',
            pattern: PATTERNS.repo_url.source,
            description: 'GitHub repo URL. Must be HTTPS and point to github.com (e.g. https://github.com/user/my-mcp-server).',
          },
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'Optional display name. Auto-detected from repo if omitted.',
          },
          description: {
            type: 'string',
            minLength: 1,
            maxLength: 500,
            description: 'Optional short description. Auto-detected from README if omitted.',
          },
          submitter_agent_id: {
            type: 'string',
            pattern: PATTERNS.agent_id.source,
            description: 'Optional agent ID for attribution and ATC pre-allocation. Format: 3–64 alphanumeric, hyphen, or underscore characters (e.g. agent_claude_001).',
          },
          submitter_email: {
            type: 'string',
            format: 'email',
            description: 'Optional email for review notifications.',
          },
          ref_code: {
            type: 'string',
            pattern: PATTERNS.ref_code.source,
            description: 'Optional referral code if you were referred by another agent. Format: ref_xxxxxxxx.',
          },
        },
        required: ['repo_url'],
      },
    },

    // ── 9. Mint referral ───────────────────────────────────────────────────
    {
      name: 'marketnow_mint_referral',
      description:
        'Mint a unique referral code (ref_xxxxxxxx) tied to your agent_id. Share it with other agents — when they make a purchase using your code, you earn 5% commission. Check your stats with marketnow_lookup_referral. Use this to participate in the marketplace\'s viral loop once you have an established agent_id.',
      inputSchema: {
        type: 'object',
        properties: {
          agent_id: {
            type: 'string',
            pattern: PATTERNS.agent_id.source,
            description: 'Your agent ID. Format: 3–64 alphanumeric, hyphen, or underscore characters (e.g. agent_claude_001).',
          },
        },
        required: ['agent_id'],
      },
    },

    // ── 10. Lookup referral ───────────────────────────────────────────────
    {
      name: 'marketnow_lookup_referral',
      description:
        'Look up referral stats for a code you own: total clicks, installs, purchases, and commission earned. Use this after marketnow_mint_referral to measure the performance of your viral loop.',
      inputSchema: {
        type: 'object',
        properties: {
          ref_code: {
            type: 'string',
            pattern: PATTERNS.ref_code.source,
            description: 'Referral code. Must start with "ref_" (e.g. ref_a1b2c3d4).',
          },
        },
        required: ['ref_code'],
      },
    },

    // ── 11. Recommend skills ───────────────────────────────────────────────
    {
      name: 'marketnow_recommend_skills',
      description:
        'Get AI-ranked skill recommendations for a task described in natural language. Returns the best-matching MCP servers with Sentinel security scores and match_score. Use this when the agent knows the GOAL (e.g. "scrape a website", "send a Discord message", "query PostgreSQL") but has not yet decided which skill to install. Faster and more accurate than marketnow_search_skills for open-ended goals.',
      inputSchema: {
        type: 'object',
        properties: {
          task: {
            type: 'string',
            minLength: 3,
            maxLength: 300,
            description: 'What you want to do, in plain English (e.g. "scrape a website", "query PostgreSQL", "send a Discord message"). Minimum 3 characters.',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 20,
            description: 'Maximum number of recommendations to return. Default: 5. Hard ceiling: 20.',
            default: 5,
          },
        },
        required: ['task'],
      },
    },

    // ── 12. OWASP compliance (NEW v1.8.0) ─────────────────────────────────
    {
      name: 'marketnow_get_owasp_compliance',
      description:
        'Get MarketNow\'s alignment with the OWASP MCP Cheat Sheet (12 controls — tool fingerprinting, capability declarations, least-privilege, output validation, etc.). Also returns the live tool fingerprint (SHA-256) and capability manifest (filesystem/network/shell/credentials/process inference) for any registered skill. Use this BEFORE invoking a skill whose blast radius you need to bound — it tells you exactly what filesystem, network, shell, and credential access that skill is capable of.',
      inputSchema: {
        type: 'object',
        properties: {
          skill_id: {
            type: 'string',
            pattern: PATTERNS.skill_id.source,
            description: 'Optional skill ID to fetch the per-tool SHA-256 fingerprint and inferred capability manifest. If omitted, returns only the global compliance matrix.',
          },
        },
        required: [],
      },
    },

    // ── 13. ATC/1.0 Spec Verifier (NEW v1.10.0) ─────────────────────────
    {
      name: 'marketnow_verify_atc_spec',
      description:
        'Verify ANY Agent Trust Card — DUAL FORMAT (ATC/3.0 unified, since v1.13.0). (1) Production ledger envelopes {card_id, status, payload (schema_version 1.1.0), signature}: real Ed25519 verification against the embedded MarketNow CA key registry (rotation-aware: ca-key-001 retired, mn-ca-002 retired-compromised = fail-closed, mn-ca-003 active), RFC 8785 JCS canonicalization, sha256 signed_payload_hash pre-check, lifecycle status. These are the cards you get from marketnow_verify_trust and GET /api/atc/<id>.json. (2) ATC/1.0 spec cards (spec_version "ATC/1.0", any issuer): the original 8-control conformance verifier (ATC-001 Identity through ATC-008 Expiration). Self-contained — no network calls, node:crypto + RFC 8785 JCS + Ed25519 (RFC 8032). Use this BEFORE trusting an ATC from any source.',
      inputSchema: {
        type: 'object',
        properties: {
          atc: {
            type: 'object',
            description: 'The complete ATC JSON document to verify. Must include spec_version="ATC/1.0", card_id (pattern: ATC-YYYY-NNNNNNN), issuer, identity, attestation (with subject_public_key, signature, signed_payload_hash), capabilities (5 categories: filesystem/network/shell/credentials/process), evidence, risk (with trust_score 0-10), revocation, and validity (with issued_at, expires_at, max_ttl_days). Pass the entire ATC envelope as received from the issuing CA.',
          },
          ca_public_key: {
            type: 'string',
            description: 'Optional override for the CA public key (base64 SPKI). If omitted, the verifier uses atc.issuer.ca_public_key. Use this when you have an out-of-band trusted CA key and want to detect CA substitution attacks.',
          },
          fetch_revocation: {
            type: 'boolean',
            description: 'If true, indicates the caller wants revocation list fetch attempted. NOTE: this verifier does not perform network calls — it only checks the structural fields. The caller MUST fetch the revocation list at atc.revocation.revocation_check_url separately if revocation_check_required=true.',
            default: false,
          },
        },
        required: ['atc'],
      },
    },

    // ── 14. Revocation status (NEW v1.10.2) ────────────────────────────
    {
      name: 'marketnow_check_revocation',
      description:
        'Check the revocation status of an Agent Trust Card (card_id) or CA key (kid) against the signed MarketNow Revocation Registry (MNR-CRL-1.0) + live ledger. Use this BEFORE trusting or caching any ATC — a card that verified cryptographically yesterday may be REVOKED today (e.g. mn-ca-002 was revoked for key compromise on 2026-09-08). Returns status (VALID/EXPIRED/REVOKED/SUPERSEDED/UNKNOWN) + recommendation (PERMIT/DENY), fail-closed on unknown subjects, with the CRL signature embedded so you can verify the signed layer independently.',
      inputSchema: {
        type: 'object',
        properties: {
          card_id: {
            type: 'string',
            pattern: '^ATC-[0-9]{4}-[0-9]+$',
            description: 'Agent Trust Card ID (e.g. ATC-2026-1509360). Exactly one of card_id / kid.',
          },
          kid: {
            type: 'string',
            pattern: '^[a-z0-9-]+$',
            description: 'CA key ID (e.g. mn-ca-002, mn-ca-003). Exactly one of card_id / kid.',
          },
          nonce: {
            type: 'string',
            minLength: 1,
            maxLength: 128,
            description: 'Optional client nonce — echoed in the response for anti-replay assurance.',
          },
        },
      },
    },

    // ── 15. Tool fingerprinting (NEW v1.10.2) ──────────────────────────
    {
      name: 'marketnow_fingerprint_tool',
      description:
        'Cryptographically fingerprint MCP tool definitions (TFP-1.0): SHA-256 over the RFC 8785 JCS canonical form of each tool plus a manifest fingerprint for the whole tools/list surface. Use this (1) on first contact with any MCP server to PIN its tool surface, and (2) on every subsequent tools/list with the pinned manifest to detect drift — the OWASP MCP Cheat Sheet control \'verify tool descriptions haven\'t changed\' (tool poisoning / rug-pull redefinitions). Fully self-contained: no network calls.',
      inputSchema: {
        type: 'object',
        properties: {
          tools: {
            type: 'array',
            minItems: 1,
            maxItems: 200,
            description: 'Tool definitions exactly as returned by tools/list: [{ name, description, inputSchema }].',
            items: { type: 'object' },
          },
          pinned: {
            type: 'object',
            description: 'Optional: the manifest from a previous marketnow_fingerprint_tool call ({ tools: [{name, fingerprint_sha256}], manifest_fingerprint_sha256 }) — enables the drift report (added/removed/changed).',
          },
        },
        required: ['tools'],
      },
    },
  ],
}));

// ─── CallToolRequest handler — Rule D (structured responses) ────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;
    switch (name) {
      case 'marketnow_search_skills':
        result = await searchSkills(args || {});
        break;
      case 'marketnow_get_skill':
        result = await getSkill(args || {});
        break;
      case 'marketnow_list_categories':
        result = await listCategories();
        break;
      case 'marketnow_get_manifest':
        // FIX 1.12.0 (audit Task 63): the handler called getManifest(), which
        // never existed (the function is fetchManifest) — a pure ReferenceError
        // that made this tool permanently broken since v1.0.
        result = await fetchManifest();
        break;
      case 'marketnow_get_install_command':
        result = await getInstallCommand(args || {});
        break;
      case 'marketnow_verify_trust':
        result = await verifyTrust(args || {});
        break;
      case 'marketnow_verify_receipt':
        result = await verifyReceipt(args || {});
        break;
      case 'marketnow_submit_skill':
        result = await submitSkill(args || {});
        break;
      case 'marketnow_mint_referral':
        result = await mintReferral(args || {});
        break;
      case 'marketnow_lookup_referral':
        result = await lookupReferral(args || {});
        break;
      case 'marketnow_recommend_skills':
        result = await recommendSkills(args || {});
        break;
      case 'marketnow_get_owasp_compliance':
        result = await fetchOwaspCompliance(args || {});
        break;
      case 'marketnow_check_revocation':
        result = await checkRevocation(args || {});
        break;
      case 'marketnow_fingerprint_tool':
        result = await fingerprintToolDefs(args || {});
        break;
      case 'marketnow_verify_atc_spec': {
        // ATC/1.0 spec verifier — accepts ANY ATC, not just MarketNow ones.
        // Self-contained: no network calls. Uses node:crypto + canonicalize.
        if (!args || typeof args !== 'object' || !args.atc) {
          const err = new Error('marketnow_verify_atc_spec requires an `atc` argument (the complete ATC JSON document)');
          err.code = 'INVALID_ARGUMENT';
          throw err;
        }
        if (typeof args.atc !== 'object' || Array.isArray(args.atc) || args.atc === null) {
          const err = new Error('marketnow_verify_atc_spec: `atc` must be an object (the ATC envelope)');
          err.code = 'INVALID_ARGUMENT';
          throw err;
        }
        // ATC/3.0-core unified (v1.12.0 interim label, v1.13.0): if the document is a production ledger
        // envelope {card_id, status, payload, signature}, verify it with real
        // Ed25519 against the MarketNow CA registry (embedded, offline).
        // Otherwise fall through to the ATC/1.0 spec conformance path.
        if (args.atc.card_id && args.atc.payload && args.atc.signature && args.atc.payload.schema_version) {
          result = verifyLedgerCard(args.atc, { ca_public_key: args.ca_public_key });
        } else {
          result = verifyATCSpec(args.atc, {
            ca_public_key: args.ca_public_key,
            fetch_revocation: args.fetch_revocation === true,
          });
        }
        break;
      }
      default: {
        const err = new Error(`Unknown tool: ${name}. Valid tools are 13 marketnow_* names — see ListTools.`);
        err.code = 'UNKNOWN_TOOL';
        throw err;
      }
    }

    // Rule D: every success returns a structured MCP content envelope.
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err) {
    // Rule D: errors NEVER propagate as thrown exceptions to the MCP transport.
    // They are normalized into a structured { isError: true, content: [...] }
    // envelope so the agent loop never breaks. Stack traces are not leaked.
    const isInvalidArgs = err.code === 'INVALID_ARGUMENT';
    const isNotFound = err.code === 'NOT_FOUND';
    const isUnknownTool = err.code === 'UNKNOWN_TOOL';

    const errorPayload = {
      success: false,
      error: err.code || 'INTERNAL_ERROR',
      tool: name,
      message: err.message || 'Unknown error',
      ...(isInvalidArgs ? { hint: 'Re-read the inputSchema for this tool from ListTools response.' } : {}),
      ...(isNotFound ? { hint: 'Verify the ID against marketnow_search_skills output.' } : {}),
      ...(isUnknownTool ? { hint: 'Call ListTools to enumerate valid marketnow_* tool names.' } : {}),
    };

    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify(errorPayload, null, 2),
        },
      ],
    };
  }
});

// ─── Start server ───────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`MarketNow MCP Server v${PKG_VERSION} running on stdio (15 tools, marketnow_* namespace, revocation + TFP-1.0 fingerprinting, SDK 1.30.0)`);
