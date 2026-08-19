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
 * MarketNow — Sentinel Audit Engine (reusable)
 * ==============================================
 *
 * Extracts the full L1.5 + L1.6 + L2 audit logic from api/audit-skill.js
 * into a reusable module. Used by:
 *   - api/audit-skill.js (real-time per-skill audit)
 *   - scripts/audit-all-skills.mjs (batch certification of all 8582 skills)
 *
 * The audit runs 3 layers:
 *   L1.5: 6 metadata checks (AUTH, injection, validation, CORS, OAuth, rate limiting)
 *   L1.6: 18 Semgrep rules + 18 secret patterns + OSV dependency check
 *   L2:   Docker sandbox results (fetched from _data/l2_results/ if available)
 *
 * Output: a full audit report with overall_score, risk_level, risk_breakdown,
 * checks array, and layers summary.
 */

import { runL16, SEMGREP_RULES, SECRET_PATTERNS } from './sentinel-l16.mjs';
import { runL17, MALWARE_PATTERNS, quarantineSkill } from './sentinel-l17.mjs';
import { getL2Results } from './sentinel-l2-trigger.mjs';

/**
 * Run the full L1.5 + L1.6 + L1.7 + L2 audit on a skill.
 *
 * @param {Object} skill — full skill object from skills_index.json
 * @param {Object} [options]
 * @param {boolean} [options.skipL2] — if true, don't fetch L2 results (faster for batch)
 * @param {Buffer} [options.packageBuffer] — if provided, L1.7 will scan inside the zip
 * @returns {Object} audit report (same structure as /api/audit-skill response)
 */
export async function auditSkill(skill, options = {}) {
  const { skipL2 = false, packageBuffer } = options;

  const caps = skill.capabilities || {};
  const setup = skill.doc?.setup || {};
  const sentinel = skill.sentinel || {};
  const prompt = skill.doc?.system_prompt || '';
  const tags = skill.tags || [];
  const desc = skill.description || '';
  const allText = `${skill.name} ${desc} ${tags.join(' ')} ${prompt}`.toLowerCase();

  // ═══ L1.5: 6 metadata checks ═══════════════════════════════════════════

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

  // ═══ Build L1.5 report ═══════════════════════════════════════════
  const checks = [authCheck, injectionCheck, validationCheck, corsCheck, oauthCheck, rateLimitCheck];
  const criticalCount = checks.filter(c => c.risk === 'critical').length;
  const highCount = checks.filter(c => c.risk === 'high').length;
  const mediumCount = checks.filter(c => c.risk === 'medium').length;
  const passCount = checks.filter(c => c.status === 'pass').length;
  const failCount = checks.filter(c => c.status === 'fail').length;
  const warningCount = checks.filter(c => c.status === 'warning').length;

  let overallScore = 10;
  overallScore -= criticalCount * 4;
  overallScore -= highCount * 2;
  overallScore -= mediumCount * 1;
  overallScore -= failCount * 2;
  overallScore = Math.max(0, Math.min(10, overallScore));

  // ═══ L1.6: Enhanced analysis (Semgrep + Secrets + OSV) ═══════════
  const l16Result = await runL16(skill);
  overallScore += l16Result.score_adjustment;
  overallScore = Math.max(0, Math.min(10, overallScore));

  // ═══ L1.7: Binary & malware detection (CRITICAL — quarantines on hit) ═══
  // Runs malware pattern detection on metadata always; scans the package
  // zip (if provided) for binaries, launchers, nested archives, obfuscated
  // bytecode. ANY critical finding → score 0 + quarantine_recommended=true.
  const l17Result = await runL17(skill, { packageBuffer });
  overallScore += l17Result.score_adjustment;
  overallScore = Math.max(0, Math.min(10, overallScore));

  // If L1.7 recommends quarantine, override risk to critical
  const l17Critical = l17Result.findings.total_critical > 0;
  const l17Quarantine = l17Result.quarantine_recommended;

  // ═══ L2: Docker sandbox results ═══════════════════════════════════
  let l2Data = { status: 'not_triggered', results: null, trigger: null };
  if (!skipL2) {
    const l2Existing = await getL2Results(skill.id);
    if (l2Existing) {
      const status = l2Existing.execution_status;
      l2Data.status = status === 'failed_to_start'
        ? 'failed_to_start'
        : (status === 'ran_idle' ? 'completed_idle' : 'completed');
      l2Data.results = l2Existing;
      if (l2Existing.l2_score !== undefined && status !== 'failed_to_start') {
        const l2Mult = l2Existing.l2_score / 10;
        overallScore = Math.round(overallScore * l2Mult);
      }
      // H15 FIX: If L2 failed to start, cap score at 5 and surface failure
      if (status === 'failed_to_start') {
        overallScore = Math.min(overallScore, 5);
      }
    } else if (skill.source?.url && skill.source.url.includes('github.com')) {
      l2Data.status = 'not_audited_yet';
    } else {
      l2Data.status = 'no_github_repo';
    }
  } else {
    l2Data.status = 'skipped';
  }

  // ═══ Build L1.6 checks for report ════════════════════════════════
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

  // ═══ L1.7 checks for report ════════════════════════════════════════
  const l17Checks = [];
  if (l17Result.findings.binary_files.length > 0) {
    l17Checks.push({
      name: 'L1.7 BINARY FILES',
      status: 'fail',
      detail: `${l17Result.findings.binary_files.length} Windows executable(s) found in skill package: ${l17Result.findings.binary_files.map(b => b.path).join(', ')}`,
      risk: 'critical',
      recommendation: 'QUARANTINE: skill package contains Windows binaries. Legitimate MCP skills do not ship .exe/.dll files.',
      files: l17Result.findings.binary_files,
    });
  }
  if (l17Result.findings.launcher_scripts.length > 0) {
    l17Checks.push({
      name: 'L1.7 LAUNCHER SCRIPTS',
      status: 'fail',
      detail: `${l17Result.findings.launcher_scripts.length} launcher script(s) found: ${l17Result.findings.launcher_scripts.map(s => s.path).join(', ')}`,
      risk: 'critical',
      recommendation: 'QUARANTINE: .bat/.cmd/.vbs/.ps1 files are not part of legitimate MCP skill packages.',
      files: l17Result.findings.launcher_scripts,
    });
  }
  if (l17Result.findings.nested_archives.length > 0) {
    l17Checks.push({
      name: 'L1.7 NESTED ARCHIVES',
      status: 'fail',
      detail: `${l17Result.findings.nested_archives.length} nested archive(s) found: ${l17Result.findings.nested_archives.map(a => a.path).join(', ')}`,
      risk: 'high',
      recommendation: 'Nested zips are a red flag — legitimate MCP skills ship source code, not zips-inside-zips. Inspect the nested archive manually.',
      files: l17Result.findings.nested_archives,
    });
  }
  if (l17Result.findings.malware_patterns.length > 0) {
    l17Checks.push({
      name: 'L1.7 MALWARE PATTERNS',
      status: 'fail',
      detail: `${l17Result.findings.malware_patterns.length} malware pattern(s) matched: ${l17Result.findings.malware_patterns.map(p => p.id).join(', ')}`,
      risk: l17Result.findings.total_critical > 0 ? 'critical' : 'high',
      recommendation: 'Malware pattern signature detected. Treat as compromised until manually reviewed.',
      patterns: l17Result.findings.malware_patterns,
    });
  }
  if (l17Result.findings.oversized_text_files.length > 0) {
    l17Checks.push({
      name: 'L1.7 OVERSIZED TEXT FILES',
      status: 'fail',
      detail: `${l17Result.findings.oversized_text_files.length} suspicious text file(s) >100KB (likely bytecode payload): ${l17Result.findings.oversized_text_files.map(f => f.path).join(', ')}`,
      risk: 'high',
      recommendation: 'Text files >100KB that are not valid JSON are typically obfuscated bytecode payloads (Lua, PowerShell). Inspect manually.',
      files: l17Result.findings.oversized_text_files,
    });
  }
  if (l17Checks.length === 0) {
    l17Checks.push({
      name: 'L1.7 MALWARE SCAN',
      status: 'pass',
      detail: `${MALWARE_PATTERNS.length} malware patterns checked, 0 binaries, 0 launchers, 0 nested archives`,
      risk: 'low',
      recommendation: '',
    });
  }

  // ═══ Final risk level ════════════════════════════════════════════
  const allChecks = [...checks, ...l16Checks, ...l17Checks];
  const allCritical = criticalCount + l16Result.findings.total_critical + l17Result.findings.total_critical;
  const allHigh = highCount + l16Result.findings.total_high + l17Result.findings.total_high;

  const riskRank = { low: 0, medium: 1, high: 2, critical: 3, unknown: 1 };
  const l15l16l17Risk = allCritical > 0 ? 'critical'
    : allHigh > 0 ? 'high'
    : mediumCount > 0 ? 'medium'
    : 'low';
  const l2Risk = l2Data.results?.l2_risk_level || null;
  // L1.7 quarantine overrides everything — even if L2 says "low", a trojan stays critical
  const finalRisk = l17Quarantine
    ? 'critical'
    : (l2Risk && riskRank[l2Risk] > riskRank[l15l16l17Risk])
      ? l2Risk
      : l15l16l17Risk;

  // ═══ Build report ════════════════════════════════════════════════
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
      auditor: 'Sentinel L1.5 + L1.6 + L1.7 + L2',
      overall_score: overallScore,
      max_score: 10,
      summary: `L1.5: ${passCount} passed, ${warningCount} warnings, ${failCount} failed | L1.6: ${l16Result.findings.semgrep.length} semgrep, ${l16Result.findings.secrets.length} secrets, ${l16Result.findings.osv.length} OSV vulns | L1.7: ${l17Result.findings.binary_files.length} binaries, ${l17Result.findings.launcher_scripts.length} launchers, ${l17Result.findings.nested_archives.length} nested archives, ${l17Result.findings.malware_patterns.length} malware patterns | L2: ${l2Data.status}`,
      risk_level: finalRisk,
      risk_breakdown: {
        l15_l16_l17: l15l16l17Risk,
        l17_quarantine_recommended: l17Quarantine,
        l2: l2Risk || 'not_available',
        final: finalRisk,
      },
      quarantine_recommended: l17Quarantine,
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
        l17: {
          malware_rules_run: MALWARE_PATTERNS.length,
          package_scanned: l17Result.details.package_scanned,
          binary_files: l17Result.findings.binary_files.length,
          launcher_scripts: l17Result.findings.launcher_scripts.length,
          nested_archives: l17Result.findings.nested_archives.length,
          malware_patterns: l17Result.findings.malware_patterns.length,
          oversized_text_files: l17Result.findings.oversized_text_files.length,
          quarantine_recommended: l17Quarantine,
        },
        l2: {
          status: l2Data.status,
          has_results: !!l2Data.results,
          score: l2Data.results?.l2_score,
          execution_status: l2Data.results?.execution_status || null,
        },
      },
    },
    checks: allChecks,
    l2_docker_sandbox: l2Data,
  };

  return report;
}

/**
 * Generate a Sentinel certificate from an audit report.
 *
 * The certificate is a signed JSON object that proves the skill was
 * audited on a specific date with a specific score. The signature is
 * a SHA-256 hash of the certificate payload + a secret salt.
 *
 * @param {Object} report — the audit report from auditSkill()
 * @param {string} secret — signing secret (from env var SENTINEL_CERT_SECRET)
 * @returns {Object} certificate
 */
export async function generateCertificate(report, secret) {
  const { createHash } = await import('crypto');

  const certId = `MN-SC-${new Date().getFullYear()}-${String(Date.now()).slice(-7)}`;
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  const payload = {
    certificate_id: certId,
    skill_id: report.skill.id,
    skill_name: report.skill.name,
    issued_at: issuedAt,
    expires_at: expiresAt,
    auditor: 'Sentinel L1.5 + L1.6 + L2',
    overall_score: report.audit.overall_score,
    max_score: report.audit.max_score,
    risk_level: report.audit.risk_level,
    risk_breakdown: report.audit.risk_breakdown,
    layers_run: {
      l15: true,
      l16: true,
      l2: report.audit.layers.l2.has_results,
    },
    layer_details: {
      l15_findings: report.audit.layers.l15.findings,
      l16_semgrep_findings: report.audit.layers.l16.semgrep_findings,
      l16_secret_findings: report.audit.layers.l16.secret_findings,
      l16_osv_findings: report.audit.layers.l16.osv_findings,
      l2_score: report.audit.layers.l2.score,
      l2_execution_status: report.audit.layers.l2.execution_status,
    },
  };

  // Sign: SHA-256 of canonical JSON + secret
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  const signature = createHash('sha256')
    .update(canonical + '|' + secret)
    .digest('hex');

  return {
    ...payload,
    signature,
    signature_algorithm: 'SHA-256',
    verification_url: `https://marketnow.site/api/audit-skill?certificate=1&skillId=${report.skill.id}`,
  };
}

/**
 * Verify a Sentinel certificate's signature.
 *
 * @param {Object} cert — the certificate object (must include signature)
 * @param {string} secret — same secret used to sign
 * @returns {boolean} true if signature is valid
 */
export async function verifyCertificate(cert, secret) {
  const { createHash } = await import('crypto');
  const { signature, ...payload } = cert;
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  const expected = createHash('sha256')
    .update(canonical + '|' + secret)
    .digest('hex');
  return signature === expected;
}
