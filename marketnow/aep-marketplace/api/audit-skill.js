/**
 * ⚠️ SENTINEL PROPRIETARY — Copyright (c) 2026 AliceLabs LLC. All Rights Reserved.
 *
 * This file is part of the Sentinel Security Audit Engine.
 * DO NOT COPY, REDISTRIBUTE, OR BUILD COMPETING PRODUCTS.
 * See SENTINEL-LICENSE for full terms.
 *
 * "Sentinel" is a trademark of AliceLabs LLC.
 * Patent pending on the 3-layer audit pipeline (L1.5 → L1.6 → L2).
 *
 * For licensing: legal@alicelabs.site
 * For verification: https://marketnow.site/verify
 */

/**
 * MarketNow — Sentinel L1.5 + L1.6 + L2 Security Audit
 * =====================================================
 *
 * Runs TWO layers in real-time on every call:
 *   L1.5: 6 metadata checks (AUTH, injection, validation, CORS, OAuth, rate limiting)
 *   L1.6: 18 Semgrep rules + 18 secret patterns + OSV dependency check
 *
 * L2 (Docker sandbox) runs via GitHub Actions — results are static in the catalog.
 *
 * Endpoints:
 *   POST /api/audit-skill          → run audit for a skill
 *        Body: { "skillId": "mn-gen-00015" }
 *   GET  /api/audit-skill?skillId=mn-gen-00015
 *   GET  /api/audit-skill?sentinel-status=1   → batch audit status + L2 coverage
 *        (sub-endpoint merged here to stay under Vercel Hobby's 12-function limit)
 */

import { runL16, SEMGREP_RULES, SECRET_PATTERNS } from '../lib/sentinel-l16.mjs';
import { triggerL2, getL2Results } from '../lib/sentinel-l2-trigger.mjs';
import { checkRateLimit } from '../lib/rate-limit.mjs';
import { findSkill } from '../lib/skills-cache.mjs';
// FINDING P3 FIX (rushabdev): replace CORS * with allowlist (lib/cors.mjs).
// Agents (no Origin header) are unaffected — they don't enforce CORS.
// Browsers can only read responses if Origin is on the allowlist.
import { setCorsHeaders } from '../lib/cors.mjs';
import { secureLight } from '../lib/secure.mjs';

const GITHUB_TOKEN = process.env.MANDATES_GITHUB_TOKEN;
const REPO = process.env.MANDATES_REPO || 'edgarfloresguerra2011-a11y/marketnow';
const BRANCH = 'master';

// 5-minute in-memory cache for the sentinel-status sub-endpoint.
const STATUS_CACHE_TTL_MS = 5 * 60 * 1000;
let _statusCache = null;

async function fetchJsonFromRepo(path) {
  if (!GITHUB_TOKEN) return null;
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${path}`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'marketnow-sentinel',
        Accept: 'application/vnd.github.raw',
      },
    });
    if (res.status === 200) return await res.json();
    return null;
  } catch {
    return null;
  }
}

async function fetchL2ResultsIndex() {
  if (!GITHUB_TOKEN) return { count: 0, skills: [], summaries: [] };
  const url = `https://api.github.com/repos/${REPO}/contents/_data/l2_results?ref=${BRANCH}`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'marketnow-sentinel',
      },
    });
    if (res.status === 200) {
      const listing = await res.json();
      if (!Array.isArray(listing)) return { count: 0, skills: [], summaries: [] };
      const files = listing
        .filter(f => f.type === 'file' && f.name.endsWith('.json'))
        .map(f => ({ name: f.name.replace(/\.json$/, ''), download_url: f.download_url }));
      const skillIds = files.map(f => f.name);

      // Fetch each result file in parallel to extract execution_status,
      // failure_reason, and l2_score. Files are tiny (<2KB), so fanning
      // out is fine even at 50+ skills.
      const summaries = await Promise.all(files.map(async f => {
        try {
          const fileRes = await fetch(f.download_url, {
            headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'marketnow-sentinel' },
          });
          if (!fileRes.ok) return null;
          const d = await fileRes.json();
          return {
            skill_id: d.skill_id || f.name,
            execution_status: d.execution_status || 'unknown',
            l2_score: d.l2_score ?? null,
            l2_risk_level: d.l2_risk_level || 'unknown',
            failure_reason: d.failure_reason || null,
            timestamp: d.timestamp || null,
          };
        } catch {
          return null;
        }
      }));

      return {
        count: skillIds.length,
        skills: skillIds,
        summaries: summaries.filter(Boolean),
      };
    }
    return { count: 0, skills: [], summaries: [] };
  } catch {
    return { count: 0, skills: [], summaries: [] };
  }
}

// 5-minute cache for certificate lookups (certificates are regenerated weekly).
let _certCache = null;
const CERT_CACHE_TTL_MS = 5 * 60 * 1000;

async function handleCertificate(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  const skillId = req.query.skillId;
  if (!skillId) {
    return res.status(400).json({ error: 'skillId required for certificate lookup' });
  }

  // Try to fetch the stored certificate from the repo
  if (!GITHUB_TOKEN) {
    return res.status(503).json({ error: 'Certificate lookup not configured (no GitHub token)' });
  }

  const certUrl = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/_data/sentinel_certificates/${skillId}.json`;
  try {
    const certRes = await fetch(certUrl, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'marketnow-sentinel',
        Accept: 'application/vnd.github.raw',
      },
    });

    if (certRes.status === 200) {
      const cert = await certRes.json();

      // C15 FIX: Check if certificate has expired
      if (cert.expires_at && new Date(cert.expires_at) < new Date()) {
        return res.status(410).json({
          status: 'expired',
          message: `Certificate for skill '${skillId}' expired on ${cert.expires_at}. The weekly batch audit regenerates certificates every Sunday at 01:00 UTC.`,
          skill_id: skillId,
          expired_at: cert.expires_at,
          certificate: cert,
        });
      }

      // SECURITY FIX: Actually verify the certificate signature server-side.
      // Previously the endpoint returned valid: true without checking —
      // "teatro de verificación". Now we call verifyCertificate() which
      // recomputes the SHA-256 hash and compares it to the stored signature.
      const { verifyCertificate } = await import('../lib/sentinel-audit.mjs');
      // SECURITY FIX: NO fallback secret. If SENTINEL_CERT_SECRET is missing,
      // we fail LOUD — return valid: false with an error message. Using a
      // hardcoded fallback secret would allow anyone to forge certificates
      // (the old default 'marketnow-sentinel-default-secret-2026' is now
      // public in git history and must never be used again).
      const CERT_SECRET = process.env.SENTINEL_CERT_SECRET;
      if (!CERT_SECRET) {
        console.error('CRITICAL: SENTINEL_CERT_SECRET env var is not set. Certificate verification cannot be performed.');
        return res.status(200).json({
          status: 'certified',
          certificate: cert,
          verification: {
            valid: false,
            message: 'ERROR: Server misconfiguration — SENTINEL_CERT_SECRET is not set. Certificate signature cannot be verified. Contact support@alicelabs.site.',
            verified_at: new Date().toISOString(),
          },
        });
      }
      let signatureValid = false;
      try {
        signatureValid = await verifyCertificate(cert, CERT_SECRET);
      } catch (e) {
        console.error('Certificate verification error:', e.message);
      }

      return res.status(200).json({
        status: 'certified',
        // Flat fields for agent compatibility (agents expect top-level fields)
        certificate_id: cert.certificate_id || cert.id || null,
        skill_id: cert.skill_id || skillId,
        overall_score: cert.overall_score || cert.score || null,
        max_score: cert.max_score || 10,
        risk_level: cert.risk_level || cert.risk || null,
        signature: cert.signature || null,
        signature_algorithm: cert.signature_algorithm || 'SHA-256',
        layers_run: cert.layers_run || {},
        expires_at: cert.expires_at || null,
        verification_url: `https://marketnow.site/verify?skillId=${skillId}`,
        // Nested structure (for human-readable verification)
        certificate: cert,
        verification: {
          valid: signatureValid,
          message: signatureValid
            ? 'Certificate signature verified server-side (SHA-256).'
            : 'WARNING: Certificate signature does NOT match. This certificate may be tampered.',
          verification_url: cert.verification_url,
          verified_at: new Date().toISOString(),
        },
      });
    }

    // Certificate not found — return a "not yet audited" response
    return res.status(404).json({
      status: 'not_audited',
      message: `No Sentinel certificate found for skill '${skillId}'. The weekly batch audit runs every Sunday at 01:00 UTC. You can trigger a real-time audit via POST /api/audit-skill with { skillId: '${skillId}' }.`,
      skill_id: skillId,
      next_batch_audit: 'Sunday 01:00 UTC',
    });
  } catch (err) {
    console.error('Certificate fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch certificate', message: err.message });
  }
}

async function fetchCertificateIndex() {
  if (!GITHUB_TOKEN) return { count: 0, by_risk: {} };

  // The batch audit script writes _data/sentinel_certificates/_summary.json
  // with the exact total_certified count and by_risk breakdown. This is
  // MUCH faster and more accurate than listing 8583 files via the GitHub
  // Contents API (which is capped at 1000 entries per response).
  const summaryUrl = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/_data/sentinel_certificates/_summary.json`;
  try {
    const res = await fetch(summaryUrl, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'marketnow-sentinel' },
    });
    if (res.ok) {
      const summary = await res.json();
      return {
        count: summary.total_certified || 0,
        by_risk: summary.by_risk || {},
        by_score: summary.by_score || {},
        generated_at: summary.generated_at || null,
        with_l2: summary.with_l2 || 0,
      };
    }
  } catch {}

  // Fallback: try the Contents API (capped at 1000 files, but better than nothing)
  const url = `https://api.github.com/repos/${REPO}/contents/_data/sentinel_certificates?ref=${BRANCH}`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'marketnow-sentinel',
      },
    });
    if (res.status === 200) {
      const listing = await res.json();
      if (!Array.isArray(listing)) return { count: 0, by_risk: {} };
      const count = listing.filter(f => f.type === 'file' && f.name.endsWith('.json') && f.name !== '_summary.json').length;
      return { count, by_risk: {} };
    }
  } catch {}

  return { count: 0, by_risk: {} };
}

async function handleSentinelStatus(req, res) {
  // Cache headers — this data changes weekly + on-demand, so 5 min on edge is fine.
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  if (_statusCache && Date.now() - _statusCache.fetchedAt < STATUS_CACHE_TTL_MS) {
    return res.status(200).json(_statusCache.data);
  }
  try {
    const [batchResults, l2Index, certIndex] = await Promise.all([
      fetchJsonFromRepo('_data/sentinel_results.json'),
      fetchL2ResultsIndex(),
      fetchCertificateIndex(),
    ]);

    const data = {
      endpoint: '/api/audit-skill?sentinel-status=1',
      generated_at: new Date().toISOString(),
      architecture: 'L1.5 (Vercel real-time) → L1.6 (Vercel real-time + weekly batch) → L2 (GitHub Actions Docker sandbox)',
      l16_batch: batchResults
        ? {
            status: 'available',
            audit_type: batchResults.audit_type,
            timestamp: batchResults.timestamp,
            tools: batchResults.tools,
            totals: batchResults.totals,
            finding_counts: {
              semgrep: (batchResults.semgrep_findings || []).length,
              secrets: (batchResults.secret_findings || []).length,
              osv: (batchResults.osv_findings || []).length,
            },
            sample_findings: {
              semgrep: (batchResults.semgrep_findings || []).slice(0, 20),
              secrets: (batchResults.secret_findings || []).slice(0, 20),
              osv: (batchResults.osv_findings || []).slice(0, 20),
            },
            repo_path: `https://github.com/${REPO}/blob/${BRANCH}/_data/sentinel_results.json`,
          }
        : {
            status: 'not_run_yet',
            message: 'No L1.6 batch audit has run yet. The cron is weekly (Sunday midnight UTC). Manual dispatch: Actions tab → Sentinel L1.6 Batch Audit → Run workflow.',
          },
      l2_sandbox: {
        status: l2Index.count > 0 ? 'available' : 'no_results_yet',
        completed_runs: l2Index.count,
        audited_skills: l2Index.skills,
        // Per-skill summaries with execution_status + failure_reason so the
        // UI can show WHY a skill got a particular L2 result (ran, ran_idle,
        // failed_to_start with reason, etc.).
        summaries: l2Index.summaries || [],
        // Pre-computed breakdowns so the UI doesn't have to iterate.
        breakdown_by_status: (l2Index.summaries || []).reduce((acc, s) => {
          const k = s.execution_status || 'unknown';
          acc[k] = (acc[k] || 0) + 1;
          return acc;
        }, {}),
        breakdown_by_risk: (l2Index.summaries || []).reduce((acc, s) => {
          const k = s.l2_risk_level || 'unknown';
          acc[k] = (acc[k] || 0) + 1;
          return acc;
        }, {}),
        repo_path: `https://github.com/${REPO}/tree/${BRANCH}/_data/l2_results`,
      },
      l2_dedup: {
        ttl_minutes: 30,
        description: 'Vercel in-memory cache prevents re-dispatching the same skill_id within 30 min of the first trigger. After the first L2 result commits to _data/l2_results/{skillId}.json, getL2Results() short-circuits the trigger path entirely.',
      },
      certificates: {
        count: certIndex.count,
        by_risk: certIndex.by_risk,
        by_score: certIndex.by_score || {},
        with_l2: certIndex.with_l2 || 0,
        generated_at: certIndex.generated_at || null,
        repo_path: `https://github.com/${REPO}/tree/${BRANCH}/_data/sentinel_certificates`,
        description: 'Every skill in the catalog gets a signed Sentinel certificate with a verified score. Regenerated weekly by sentinel-certify-all.yml workflow.',
      },
    };

    _statusCache = { fetchedAt: Date.now(), data };
    return res.status(200).json(data);
  } catch (err) {
    console.error('sentinel-status error:', err);
    return res.status(500).json({ error: 'Failed to fetch sentinel status', message: err.message });
  }
}

export default secureLight(async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  // FINDING P3 FIX (rushabdev): CORS allowlist instead of '*'.
  // setCorsHeaders() sets Access-Control-Allow-Origin only if the request's
  // Origin is on the allowlist (marketnow.site, *.vercel.app previews, localhost).
  // Agents (curl, httpx, MCP clients) don't send Origin → unaffected.
  setCorsHeaders(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS' || req.method === 'HEAD') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // H3 FIX: Rate limit audit endpoint (30 req/min — each call does 6+ fetches)
  if (checkRateLimit(req, res, 'audit')) return;

  // ─── Sub-endpoint: GET /api/audit-skill?sentinel-status=1 ─────────────
  // Returns the latest L1.6 batch audit + L2 sandbox coverage. Merged here
  // to stay under Vercel Hobby's 12-serverless-function-per-deploy limit.
  if (req.method === 'GET' && (req.query['sentinel-status'] || req.query.sentinelStatus)) {
    return handleSentinelStatus(req, res);
  }

  // ─── Sub-endpoint: GET /api/audit-skill?certificate=1&skillId=X ───────
  // Returns the stored Sentinel certificate for a skill (if it has been
  // audited by the weekly batch). Falls back to real-time audit if no
  // certificate exists yet.
  if (req.method === 'GET' && (req.query['certificate'] || req.query.certificate)) {
    return handleCertificate(req, res);
  }

  try {
    // Support both POST body and GET query param
    const skillId = req.method === 'POST' 
      ? (req.body || {}).skillId 
      : req.query.skillId;

    if (!skillId) {
      return res.status(400).json({ error: 'skillId required' });
    }

    // Fetch skill — use local cache (skills-cache.mjs) instead of self-fetch.
    // H1 FIX: Previously used req.headers.host for self-fetch (SSRF risk).
    // H3 FIX: Self-fetch of 40MB skills.json was slow and no rate limit.
    // Now uses findSkill() which reads from local filesystem (fast, no network).
    const skill = await findSkill(skillId);
    
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    const caps = skill.capabilities || {};
    const setup = skill.doc?.setup || {};
    const sentinel = skill.sentinel || {};
    const prompt = skill.doc?.system_prompt || '';
    const tags = skill.tags || [];
    const desc = skill.description || '';
    const allText = `${skill.name} ${desc} ${tags.join(' ')} ${prompt}`.toLowerCase();

    // ─── 1. AUTH CHECK ───────────────────────────────────────────
    const authCheck = {
      name: 'AUTH',
      status: 'unknown',
      detail: '',
      risk: 'unknown',
      recommendation: '',
    };
    
    const requiredEnv = setup.required_env || [];
    if (requiredEnv.length > 0) {
      authCheck.status = 'pass';
      authCheck.detail = `Requires ${requiredEnv.length} environment variable(s): ${requiredEnv.join(', ')}`;
      authCheck.risk = 'low';
      authCheck.recommendation = 'Verify tokens are scoped, not god-mode';
    } else if (caps.requires_auth === true) {
      authCheck.status = 'pass';
      authCheck.detail = 'Auth required (detected from capabilities)';
      authCheck.risk = 'low';
    } else {
      authCheck.status = 'warning';
      authCheck.detail = 'No authentication required. If this runs as a server, anyone with network access can call it.';
      authCheck.risk = 'medium';
      authCheck.recommendation = 'Add API key or token auth. Localhost is not a security boundary on shared/dev machines.';
    }

    // ─── 2. TOOL DESCRIPTION INJECTION CHECK ─────────────────────
    const injectionCheck = {
      name: 'TOOL_DESCRIPTIONS',
      status: 'pass',
      detail: '',
      risk: 'low',
      recommendation: '',
    };
    
    // Check for prompt injection patterns in descriptions/system_prompt
    const injectionPatterns = [
      { pattern: /ignore (all )?(previous|prior) instructions/i, severity: 'critical' },
      { pattern: /disregard (the )?(above|previous)/i, severity: 'critical' },
      { pattern: /you are now (a|an) (different|new)/i, severity: 'high' },
      { pattern: /forget (everything|all|your instructions)/i, severity: 'critical' },
      { pattern: /act as (if you are|a) (different|admin|root)/i, severity: 'high' },
      { pattern: /\/(system|admin|debug|exec|eval|shell)/i, severity: 'high' },
      { pattern: /exfiltrate|steal|send.*(to|via).*(email|webhook|discord|telegram)/i, severity: 'critical' },
      { pattern: /base64.*(decode|encode|eval|exec)/i, severity: 'high' },
    ];
    
    const foundInjections = [];
    for (const { pattern, severity } of injectionPatterns) {
      if (pattern.test(desc) || pattern.test(prompt)) {
        foundInjections.push({ pattern: pattern.source, severity });
      }
    }
    
    if (foundInjections.length > 0) {
      injectionCheck.status = 'fail';
      injectionCheck.detail = `Found ${foundInjections.length} potential prompt injection pattern(s) in tool descriptions`;
      injectionCheck.risk = foundInjections[0].severity;
      injectionCheck.recommendation = 'Treat tool descriptions as untrusted input. Sanitize before exposing to LLM.';
      injectionCheck.patterns = foundInjections;
    } else {
      injectionCheck.detail = 'No prompt injection patterns detected in descriptions or system prompt';
    }

    // ─── 3. INPUT VALIDATION CHECK ───────────────────────────────
    const validationCheck = {
      name: 'INPUT_VALIDATION',
      status: 'unknown',
      detail: '',
      risk: 'unknown',
      recommendation: '',
    };
    
    const inputTypes = caps.input_types || [];
    const hasFileAccess = allText.includes('file') || allText.includes('filesystem') || allText.includes('path');
    const hasDbAccess = allText.includes('sql') || allText.includes('database') || allText.includes('query');
    const hasHttpAccess = allText.includes('http') || allText.includes('url') || allText.includes('fetch');
    
    const risks = [];
    if (hasFileAccess) risks.push('path traversal (fs access detected)');
    if (hasDbAccess) risks.push('SQL injection (db access detected)');
    if (hasHttpAccess) risks.push('SSRF (HTTP access detected)');
    
    if (risks.length > 0) {
      validationCheck.status = 'warning';
      validationCheck.detail = `Skill has access to: ${risks.join(', ')}. Verify input validation is in place.`;
      validationCheck.risk = 'medium';
      validationCheck.recommendation = 'Test with path traversal (../../etc/passwd), SQL injection (1\' OR 1=1), and SSRF (http://169.254.169.254) payloads.';
    } else {
      validationCheck.status = 'pass';
      validationCheck.detail = 'No direct fs/db/http access detected from metadata';
      validationCheck.risk = 'low';
    }

    // ─── 4. CORS / ORIGIN CHECK ──────────────────────────────────
    const corsCheck = {
      name: 'CORS_ORIGIN',
      status: 'pass',
      detail: '',
      risk: 'low',
      recommendation: '',
    };
    
    if (caps.execution_context === 'server_side' || caps.requires_network) {
      corsCheck.status = 'warning';
      corsCheck.detail = 'Skill runs server-side or requires network. If accessible from browser, verify CORS is restricted.';
      corsCheck.risk = 'medium';
      corsCheck.recommendation = 'Set Access-Control-Allow-Origin to specific domains, not *. Verify Origin header on requests.';
    } else {
      corsCheck.detail = 'Skill runs locally (stdio/local_runtime). CORS not applicable.';
    }

    // ─── 5. OAUTH / SCOPES CHECK ─────────────────────────────────
    const oauthCheck = {
      name: 'OAUTH_SCOPES',
      status: 'unknown',
      detail: '',
      risk: 'unknown',
      recommendation: '',
    };
    
    if (requiredEnv.length > 0) {
      const hasScopedTokens = requiredEnv.some(e => 
        e.includes('KEY') || e.includes('TOKEN') || e.includes('SECRET')
      );
      if (hasScopedTokens) {
        oauthCheck.status = 'warning';
        oauthCheck.detail = `Uses API keys/tokens (${requiredEnv.join(', ')}). Verify tokens are scoped (read-only) not god-mode.`;
        oauthCheck.risk = 'medium';
        oauthCheck.recommendation = 'Use least-privilege scopes. For Stripe: read-only for analytics, restricted for charges.';
      } else {
        oauthCheck.status = 'pass';
        oauthCheck.detail = 'No OAuth tokens detected';
      }
    } else {
      oauthCheck.status = 'pass';
      oauthCheck.detail = 'No OAuth/token-based access detected';
    }

    // ─── 6. RATE LIMITING + ERROR LEAKAGE ────────────────────────
    const rateLimitCheck = {
      name: 'RATE_LIMITING_ERROR_LEAKAGE',
      status: 'warning',
      detail: '',
      risk: 'medium',
      recommendation: '',
    };
    
    const sentinelWarnings = sentinel.warnings || [];
    if (sentinelWarnings.includes('no_rate_limiting')) {
      rateLimitCheck.status = 'fail';
      rateLimitCheck.detail = 'No rate limiting detected. Skill can be called unlimited times.';
      rateLimitCheck.risk = 'high';
      rateLimitCheck.recommendation = 'Add rate limiting (e.g., 60 req/min). Without it, skill can be abused for DoS or cost bombing.';
    } else if (sentinelWarnings.includes('external_fetch_detected')) {
      rateLimitCheck.status = 'warning';
      rateLimitCheck.detail = 'External network calls detected. Verify errors don\'t leak stack traces or secrets.';
      rateLimitCheck.risk = 'medium';
      rateLimitCheck.recommendation = 'Test by sending malformed inputs. Check if error responses contain stack traces, API keys, or internal URLs.';
    } else {
      rateLimitCheck.status = 'pass';
      rateLimitCheck.detail = 'No rate limiting concerns detected from metadata';
      rateLimitCheck.risk = 'low';
    }

    // ─── BUILD REPORT ─────────────────────────────────────────────
    const checks = [authCheck, injectionCheck, validationCheck, corsCheck, oauthCheck, rateLimitCheck];
    
    const criticalCount = checks.filter(c => c.risk === 'critical').length;
    const highCount = checks.filter(c => c.risk === 'high').length;
    const mediumCount = checks.filter(c => c.risk === 'medium').length;
    const passCount = checks.filter(c => c.status === 'pass').length;
    const failCount = checks.filter(c => c.status === 'fail').length;
    const warningCount = checks.filter(c => c.status === 'warning').length;
    
    // Overall score (L1.5)
    let overallScore = 10;
    overallScore -= criticalCount * 4;
    overallScore -= highCount * 2;
    overallScore -= mediumCount * 1;
    overallScore -= failCount * 2;
    overallScore = Math.max(0, Math.min(10, overallScore));

    // ═══ L1.6: Run enhanced analysis (Semgrep + Secrets + OSV) ═══
    const l16Result = await runL16(skill);

    // Apply L1.6 score adjustment
    overallScore += l16Result.score_adjustment;
    overallScore = Math.max(0, Math.min(10, overallScore));

    // ═══ L2: Check existing Docker sandbox results + trigger async ═══
    let l2Data = { status: 'not_triggered', results: null, trigger: null };
    const l2Existing = await getL2Results(skill.id);
    if (l2Existing) {
      // Three execution_status values:
      //   'ran'             → server started and produced output. Trust score.
      //   'ran_idle'        → server started, waited for stdin (normal MCP stdio
      //                        behavior). Trust score — no malicious behavior.
      //   'failed_to_start' → server crashed / MODULE_NOT_FOUND / etc. DON'T
      //                        trust the score (it would be 0/unknown). Surface
      //                        the failure to the user.
      const status = l2Existing.execution_status;
      l2Data.status = status === 'failed_to_start'
        ? 'failed_to_start'
        : (status === 'ran_idle' ? 'completed_idle' : 'completed');
      l2Data.results = l2Existing;
      if (l2Existing.l2_score !== undefined && status !== 'failed_to_start') {
        const l2Mult = l2Existing.l2_score / 10;
        overallScore = Math.round(overallScore * l2Mult);
      }
    } else if (skill.source?.url && skill.source.url.includes('github.com')) {
      const l2Trig = await triggerL2(skill.id, skill.source.url);
      l2Data.status = l2Trig.triggered ? 'triggered_async' : (l2Trig.deduped ? 'deduped' : 'not_available');
      l2Data.trigger = l2Trig;
    } else {
      l2Data.status = 'no_github_repo';
    }

    // Build L1.6 checks for report
    const l16Checks = [];
    if (l16Result.findings.semgrep.length > 0) {
      l16Checks.push({
        name: 'L1.6 SEMGREP RULES',
        status: 'fail',
        detail: `${l16Result.findings.semgrep.length} finding(s): ${l16Result.findings.semgrep.map(s => s.name).join(', ')}`,
        risk: l16Result.findings.total_critical > 0 ? 'critical' : 'high',
        recommendation: l16Result.findings.semgrep[0]?.fix || 'Review Semgrep findings',
        patterns: l16Result.findings.semgrep,
      });
    } else {
      l16Checks.push({
        name: 'L1.6 SEMGREP RULES',
        status: 'pass',
        detail: `${SEMGREP_RULES.length} rules checked, 0 findings`,
        risk: 'low',
        recommendation: '',
      });
    }

    if (l16Result.findings.secrets.length > 0) {
      l16Checks.push({
        name: 'L1.6 SECRET DETECTION',
        status: 'fail',
        detail: `${l16Result.findings.secrets.length} secret(s) found: ${l16Result.findings.secrets.map(s => s.name).join(', ')}`,
        risk: l16Result.findings.secrets.some(s => s.severity === 'critical') ? 'critical' : 'high',
        recommendation: 'Remove all hardcoded secrets immediately',
        patterns: l16Result.findings.secrets,
      });
    } else {
      l16Checks.push({
        name: 'L1.6 SECRET DETECTION',
        status: 'pass',
        detail: `${SECRET_PATTERNS.length} patterns checked, 0 secrets found`,
        risk: 'low',
        recommendation: '',
      });
    }

    if (l16Result.findings.osv.length > 0) {
      l16Checks.push({
        name: 'L1.6 OSV DEPENDENCIES',
        status: 'fail',
        detail: `${l16Result.findings.osv.length} vulnerable dependencies: ${l16Result.findings.osv.map(v => v.id).join(', ')}`,
        risk: 'high',
        recommendation: 'Update vulnerable dependencies to patched versions',
        vulnerabilities: l16Result.findings.osv,
      });
    } else {
      l16Checks.push({
        name: 'L1.6 OSV DEPENDENCIES',
        status: 'pass',
        detail: 'OSV API checked — no known vulnerabilities',
        risk: 'low',
        recommendation: '',
      });
    }

    // Merge L1.5 + L1.6 checks
    const allChecks = [...checks, ...l16Checks];
    const allCritical = criticalCount + l16Result.findings.total_critical;
    const allHigh = highCount + l16Result.findings.total_high;

    // ─── FINAL risk_level: take the WORST of (L1.5+L1.6) and (L2 sandbox) ───
    // L2 detects runtime behavior (credential exfiltration, network calls, fs writes)
    // that static analysis cannot see — if L2 says critical, the skill is critical
    // even if the static score looks clean. Bug fix: previously L2 only adjusted
    // overall_score, never risk_level — a sandbox-detected credential thief could
    // end up with score 0 but risk_level: "low".
    //
    // Special case: L2 risk='unknown' (sandbox couldn't execute the server) is
    // treated as 'medium' for ranking purposes — we refuse to call a skill 'low'
    // risk when we couldn't actually observe its runtime behavior. The user
    // sees risk_breakdown.l2 = 'unknown' so they know it's not a real 'medium'.
    const riskRank = { low: 0, medium: 1, high: 2, critical: 3, unknown: 1 };
    const l15l16Risk = allCritical > 0 ? 'critical'
      : allHigh > 0 ? 'high'
      : mediumCount > 0 ? 'medium'
      : 'low';
    const l2Risk = l2Data.results?.l2_risk_level || null;
    const finalRisk = (l2Risk && riskRank[l2Risk] > riskRank[l15l16Risk])
      ? l2Risk
      : l15l16Risk;

    const report = {
      skill: {
        id: skill.id,
        name: skill.name,
        slug: skill.slug,
        category: skill.category,
        price: skill.price,
        author: skill.author,
      },
      audit: {
        timestamp: new Date().toISOString(),
        auditor: 'Sentinel L1.5 + L1.6 + L2 (Real-time Security Audit)',
        overall_score: overallScore,
        max_score: 10,
        summary: `L1.5: ${passCount} passed, ${warningCount} warnings, ${failCount} failed | L1.6: ${l16Result.findings.semgrep.length} semgrep, ${l16Result.findings.secrets.length} secrets, ${l16Result.findings.osv.length} OSV vulns | L2: ${l2Data.status}`,
        risk_level: finalRisk,
        risk_breakdown: {
          l15_l16: l15l16Risk,
          l2: l2Risk || 'not_available',
          final: finalRisk,
        },
        layers: {
          l15: { checks_run: 6, findings: criticalCount + highCount + mediumCount },
          l16: {
            semgrep_rules_run: SEMGREP_RULES.length,
            secret_patterns_run: SECRET_PATTERNS.length,
            osv_checked: true,
            semgrep_findings: l16Result.findings.semgrep.length,
            secret_findings: l16Result.findings.secrets.length,
            osv_findings: l16Result.findings.osv.length,
          },
          l2: { status: l2Data.status, has_results: !!l2Data.results, score: l2Data.results?.l2_score },
        },
      },
      checks: allChecks,
      recommendations: allChecks
        .filter(c => c.recommendation)
        .map(c => `[${c.name}] ${c.recommendation}`),
      testing_guide: {
        step1: 'Send raw JSON-RPC requests manually (not via polished client that hides errors)',
        step2: 'Test with malformed inputs — check if stack traces or secrets leak in error responses',
        step3: 'Test path traversal (../../etc/passwd) if fs access detected',
        step4: 'Test SQL injection (1\' OR 1=1) if db access detected',
        step5: 'Test SSRF (http://169.254.169.254) if http access detected',
        step6: 'Verify rate limiting by sending 100 rapid requests',
      },
      l2_docker_sandbox: l2Data,
    };

    return res.status(200).json(report);
  } catch (err) {
    console.error('Audit error:', err);
    return res.status(500).json({ error: 'Audit failed', message: err.message });
  }
});
