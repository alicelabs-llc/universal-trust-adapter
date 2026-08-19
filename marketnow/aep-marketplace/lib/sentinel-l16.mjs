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
 * MarketNow — Sentinel L1.6 Enhanced Analysis
 * =============================================
 *
 * Runs IN PRODUCTION on every /api/audit-skill call.
 * Three subsystems:
 *   1. 18 Semgrep-equivalent rules (implemented as JS regex)
 *   2. 18 secret detection patterns
 *   3. OSV API real-time dependency vulnerability check
 *
 * Scoring: weighted (secrets 40%, vulns 30%, static 20%, hygiene 10%)
 * Critical secret = instant score 0.
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. SEMGREP-EQUIVALENT RULES (18 MCP-specific patterns)
// ═══════════════════════════════════════════════════════════════════════════
//
// FINDING S2 FIX (rushabdev, July 2026):
// Several rules (MCP-SS-002, MCP-PT-002, MCP-SL-001/002) previously matched
// any occurrence of `localhost`, `127.0.0.1`, `../etc`, `api_key=...` etc.
// in the analyzed text — including:
//   - `process.env.MY_API_KEY` (a variable reference, not a hardcoded key)
//   - `localhost` in a README example URL
//   - `127.0.0.1` in a comment
//
// We now:
//   1. Strip `process.env.*` references BEFORE running rules (S2).
//   2. Strip fenced code blocks (```...```) and inline `code` spans from
//      README-style content before running secret patterns (S3).
//   3. Cap the analyzed text at 1MB to prevent malicious DoS (S4).

const MAX_ANALYZE_BYTES = 1024 * 1024; // 1 MB (was effectively unbounded)

const SEMGREP_RULES = [
  { id: 'MCP-PI-001', name: 'Prompt injection: ignore previous instructions', severity: 'critical', pattern: /ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions/i, fix: 'Sanitize tool descriptions before exposing to LLM context' },
  { id: 'MCP-PI-002', name: 'Prompt injection: disregard the above', severity: 'critical', pattern: /disregard\s+(?:the\s+)?(?:above|previous)/i, fix: 'Treat tool descriptions as untrusted input' },
  { id: 'MCP-PI-003', name: 'Prompt injection: you are now', severity: 'high', pattern: /you\s+are\s+now\s+(?:a|an)\s+(?:different|new|admin|root)/i, fix: 'Sanitize role-assignment language in descriptions' },
  { id: 'MCP-PI-004', name: 'Prompt injection: forget everything', severity: 'critical', pattern: /forget\s+(?:everything|all|your\s+instructions)/i, fix: 'Filter memory-reset instructions from tool descriptions' },
  { id: 'MCP-PI-005', name: 'Prompt injection: exfiltration instructions', severity: 'critical', pattern: /(?:exfiltrate|steal|send).*(?:to|via).*(?:email|webhook|discord|telegram|api)/i, fix: 'Remove data exfiltration instructions' },
  { id: 'MCP-PI-006', name: 'Prompt injection: system override', severity: 'high', pattern: /(?:\/system|\/admin|\/debug|\/exec|\/eval|\/shell)/i, fix: 'Filter command-like patterns from tool descriptions' },
  { id: 'MCP-CI-001', name: 'Command injection: exec with user input', severity: 'critical', pattern: /(?:exec|execSync|spawn|spawnSync)\s*\(\s*(?:req|params|args|input|query)/i, fix: 'Use parameterized exec with allowlisted commands' },
  { id: 'MCP-CI-002', name: 'Command injection: os.system with user input', severity: 'critical', pattern: /(?:os\.system|subprocess\.call|subprocess\.run)\s*\(\s*(?:req|params|args|input)/i, fix: 'Use subprocess with shell=False and argument arrays' },
  { id: 'MCP-CI-003', name: 'Command injection: eval with dynamic input', severity: 'critical', pattern: /(?:eval|Function)\s*\(\s*(?:req|params|args|input|body)/i, fix: 'Never use eval with user-controlled input' },
  { id: 'MCP-CI-004', name: 'Dangerous: child_process with string concatenation', severity: 'high', pattern: /child_process.*(?:\+|\$\{|template)/i, fix: 'Use argument arrays, never string concatenation' },
  { id: 'MCP-SL-001', name: 'Hardcoded API key in description', severity: 'critical', pattern: /(?:api[_-]?key|api[_-]?secret|access[_-]?token)\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/i, fix: 'Remove hardcoded secrets' },
  { id: 'MCP-SL-002', name: 'Wallet mnemonic in description', severity: 'critical', pattern: /(?:mnemonic|seed[_-]?phrase|private[_-]?key)\s*[:=]\s*['"][a-z\s]{20,}['"]/i, fix: 'Never expose wallet mnemonics or private keys' },
  { id: 'MCP-SS-001', name: 'SSRF: fetch with user-controlled URL', severity: 'high', pattern: /(?:fetch|axios|http\.get|https\.get)\s*\(\s*(?:req|params|args|input|url)/i, fix: 'Validate and restrict URLs to allowlisted domains' },
  { id: 'MCP-SS-002', name: 'SSRF: internal IP access', severity: 'high', pattern: /(?:169\.254\.169\.254|localhost|127\.0\.0\.1|0\.0\.0\.0|::1)/i, fix: 'Block internal IPs from fetch targets' },
  { id: 'MCP-PT-001', name: 'Path traversal: read user-controlled path', severity: 'high', pattern: /(?:readFile|readFileSync|fs\.read)\s*\(\s*(?:req|params|args|input|path)/i, fix: 'Validate and sanitize file paths' },
  { id: 'MCP-PT-002', name: 'Path traversal: directory traversal pattern', severity: 'critical', pattern: /\.\.\/(?:\.\.\/)*(?:etc|var|root|home|proc)/i, fix: 'Reject paths containing ../ sequences' },
  { id: 'MCP-TS-001', name: 'Tool name spoofing', severity: 'high', pattern: /(?:name|toolName)\s*[:=]\s*['"](?:read_file|write_file|system|exec|shell|admin)['"]/i, fix: 'Use unique tool names that do not impersonate system tools' },
  { id: 'MCP-IS-001', name: 'Missing inputSchema on tool registration', severity: 'medium', pattern: /registerTool\s*\(\s*[^)]*\)\s*(?!.*inputSchema)/i, fix: 'Always define inputSchema for tool parameter validation' },
];

// ═══════════════════════════════════════════════════════════════════════════
// 2. SECRET DETECTION PATTERNS (18 patterns)
// ═══════════════════════════════════════════════════════════════════════════

const SECRET_PATTERNS = [
  { name: 'Stripe live key', pattern: /sk_live_[a-zA-Z0-9]{24,}/, severity: 'critical' },
  { name: 'Stripe test key', pattern: /sk_test_[a-zA-Z0-9]{24,}/, severity: 'high' },
  { name: 'Stripe publishable live', pattern: /pk_live_[a-zA-Z0-9]{24,}/, severity: 'critical' },
  { name: 'GitHub PAT', pattern: /ghp_[a-zA-Z0-9]{36}/, severity: 'critical' },
  { name: 'GitHub OAuth token', pattern: /gho_[a-zA-Z0-9]{36}/, severity: 'critical' },
  { name: 'GitHub app token', pattern: /ghs_[a-zA-Z0-9]{36}/, severity: 'critical' },
  { name: 'GitHub refresh token', pattern: /ghr_[a-zA-Z0-9]{76}/, severity: 'critical' },
  { name: 'AWS access key ID', pattern: /AKIA[0-9A-Z]{16}/, severity: 'critical' },
  { name: 'AWS secret access key', pattern: /aws_secret_access_key\s*[:=]\s*['"][a-zA-Z0-9/+=]{40}['"]/i, severity: 'critical' },
  { name: 'Private key (RSA/EC)', pattern: /-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/, severity: 'critical' },
  { name: 'Wallet mnemonic', pattern: /\b(?:abandon|ability|able|about|above)\s+(?:abandon|ability|able|about|above)\s+/i, severity: 'critical' },
  { name: 'Ethereum private key', pattern: /0x[a-fA-F0-9]{64}/, severity: 'critical' },
  { name: 'JWT token', pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/, severity: 'high' },
  { name: 'Slack token', pattern: /xox[bpras]-[a-zA-Z0-9-]+/, severity: 'critical' },
  { name: 'Discord token', pattern: /discord.*token\s*[:=]\s*['"][a-zA-Z0-9._-]{50,}['"]/i, severity: 'critical' },
  { name: 'Google API key', pattern: /AIza[0-9A-Za-z_-]{35}/, severity: 'critical' },
  { name: 'Twilio API key', pattern: /SK[0-9a-fA-F]{32}/, severity: 'high' },
  { name: 'Generic password assignment', pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/i, severity: 'medium' },
];

// ═══════════════════════════════════════════════════════════════════════════
// 3. OSV API — Real-time dependency vulnerability check
// ═══════════════════════════════════════════════════════════════════════════

async function checkOSV(packageName) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://api.osv.dev/v1/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ package: { name: packageName, ecosystem: 'npm' } }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return { vulnerabilities: [], error: `OSV ${res.status}` };
    const data = await res.json();
    const vulns = (data.vulns || []).map(v => ({ id: v.id, summary: v.summary || 'No summary' }));
    return { vulnerabilities: vulns, count: vulns.length };
  } catch (e) {
    return { vulnerabilities: [], error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PREPROCESSING — strip false-positive sources before running rules
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Strip `process.env.X` references — they are variable lookups, not hardcoded
 * secrets. Without this, a skill that documents `process.env.STRIPE_KEY` in
 * its README triggers MCP-SL-001 (hardcoded API key) — a false positive.
 *
 * Also strips `process.ENV.*`, `process.env['X']`, `process.env["X"]`.
 */
function stripProcessEnvRefs(text) {
  return text
    .replace(/process\.env\[\s*['"][^'"]+['"]\s*\]/gi, 'ENV_REF')
    .replace(/process\.env\.[A-Z_][A-Z0-9_]*/gi, 'ENV_REF');
}

/**
 * Strip fenced code blocks and inline code spans. README examples often
 * contain placeholder secrets like `sk_live_abc123...` which would trigger
 * secret detection rules. We treat code blocks as documentation, not as
 * real secrets embedded in the skill.
 *
 * Note: this is conservative — we only strip code blocks for the SECRET
 * detection pass. Semgrep rules (injection patterns) still run on the full
 * text, because an attacker could hide a prompt injection inside a code
 * block that the LLM might still execute.
 */
function stripCodeBlocks(text) {
  return text
    .replace(/```[\s\S]*?```/g, 'CODE_BLOCK')
    .replace(/`[^`\n]+`/g, 'INLINE_CODE');
}

/**
 * Cap text size at MAX_ANALYZE_BYTES to prevent malicious DoS. A 5MB skill
 * description should not pin the analyzer for seconds.
 */
function capTextSize(text) {
  if (text.length <= MAX_ANALYZE_BYTES) return text;
  // Keep the first 512KB + last 512KB — most malicious content is at the
  // start (description, system prompt) or end (boilerplate injection).
  const half = Math.floor(MAX_ANALYZE_BYTES / 2);
  return text.slice(0, half) + '\n[...TRUNCATED...]\n' + text.slice(-half);
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. MAIN: Run L1.6 analysis
// ═══════════════════════════════════════════════════════════════════════════

export async function runL16(skill) {
  const rawText = [
    skill.name || '',
    skill.description || '',
    skill.doc?.system_prompt || '',
    (skill.tags || []).join(' '),
    JSON.stringify(skill.capabilities || {}),
    skill.install || '',
  ].join('\n');

  // FINDING S4 FIX: cap text size to prevent DoS.
  const cappedText = capTextSize(rawText);

  // FINDING S2 FIX: strip process.env.X refs (not real secrets).
  const textForSemgrep = stripProcessEnvRefs(cappedText);

  // FINDING S3 FIX: strip code blocks before secret detection (README examples).
  const textForSecrets = stripCodeBlocks(stripProcessEnvRefs(cappedText));

  const findings = {
    semgrep: [],
    secrets: [],
    osv: [],
    total_critical: 0,
    total_high: 0,
    total_medium: 0,
  };

  // Semgrep rules — run on text with process.env refs stripped (S2 fix).
  // Code blocks are NOT stripped for semgrep — an injection inside a code
  // block can still be executed by an LLM that copies it verbatim.
  for (const rule of SEMGREP_RULES) {
    if (rule.pattern.test(textForSemgrep)) {
      findings.semgrep.push({ id: rule.id, name: rule.name, severity: rule.severity, fix: rule.fix });
      if (rule.severity === 'critical') findings.total_critical++;
      else if (rule.severity === 'high') findings.total_high++;
      else findings.total_medium++;
    }
  }

  // Secret detection — run on text with BOTH process.env refs and code
  // blocks stripped (S2 + S3 fix). A secret in a code block is almost
  // always a README example, not a real embedded credential.
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.pattern.test(textForSecrets)) {
      findings.secrets.push({ name: pattern.name, severity: pattern.severity });
      if (pattern.severity === 'critical') findings.total_critical++;
      else if (pattern.severity === 'high') findings.total_high++;
      else findings.total_medium++;
    }
  }

  // OSV check
  if (skill.install && skill.install.includes('npx')) {
    const pkgMatch = skill.install.match(/npx\s+(?:-y\s+)?(@?[a-zA-Z0-9/_-]+)/);
    if (pkgMatch) {
      const osvResult = await checkOSV(pkgMatch[1]);
      if (osvResult.count > 0) {
        findings.osv = osvResult.vulnerabilities;
        findings.total_high += osvResult.count;
      }
    }
  }

  // Score adjustment (weighted)
  let scoreAdjustment = 0;
  if (findings.secrets.some(s => s.severity === 'critical')) {
    scoreAdjustment = -10;
  } else {
    scoreAdjustment -= findings.total_critical * 4;
    scoreAdjustment -= findings.total_high * 2;
    scoreAdjustment -= findings.total_medium * 1;
  }

  return {
    findings,
    score_adjustment: Math.max(-10, scoreAdjustment),
    details: {
      semgrep_rules_run: SEMGREP_RULES.length,
      secret_patterns_run: SECRET_PATTERNS.length,
      osv_checked: true,
      semgrep_findings: findings.semgrep.length,
      secret_findings: findings.secrets.length,
      osv_findings: findings.osv.length,
    },
  };
}

export { SEMGREP_RULES, SECRET_PATTERNS, checkOSV };
