/**
 * ⚠️ SENTINEL PROPRIETARY — Copyright (c) 2026 AliceLabs LLC. All Rights Reserved.
 *
 * MarketNow — Sentinel L1.9 Prompt Injection Defense
 * ====================================================
 *
 * The #1 attack against AI agents is prompt injection. Nobody solves it well.
 *
 * L1.9 scans MCP tool descriptions, system prompts, and skill metadata for
 * prompt injection patterns BEFORE they reach the LLM. If detected, the
 * content is sanitized or the skill is flagged.
 *
 * Detection categories:
 *   1. DIRECT INJECTION — "ignore previous instructions", "you are now"
 *   2. ROLE HIJACKING — attempts to change the agent's role/identity
 *   3. INSTRUCTION OVERRIDE — "instead of", "don't do X, do Y"
 *   4. DATA EXFILTRATION — "send to", "post to", "call this URL"
 *   5. PRIVILEGE ESCALATION — "as admin", "with root access", "bypass"
 *   6. CONTEXT POISONING — fake system messages, fake user messages
 *   7. ENCODING EVASION — base64, hex, unicode escape sequences
 *   8. SOCIAL ENGINEERING — "the developer says", "this is safe", "trust me"
 *   9. TOOL IMPERSONATION — pretending to be another tool
 *  10. MEMORY MANIPULATION — "remember that", "forget everything"
 */

const INJECTION_RULES = [
  // 1. DIRECT INJECTION
  { id: 'PI-001', category: 'direct_injection', severity: 'critical',
    pattern: /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions?|prompts?|rules?|context)/i,
    description: 'Classic prompt injection: "ignore previous instructions"' },
  { id: 'PI-002', category: 'direct_injection', severity: 'critical',
    pattern: /disregard\s+(?:the\s+)?(?:above|previous|prior|all)/i,
    description: 'Disregard previous context' },
  { id: 'PI-003', category: 'direct_injection', severity: 'critical',
    pattern: /forget\s+(?:everything|all|your\s+(?:instructions|rules|guidelines))/i,
    description: 'Memory wipe attempt' },
  { id: 'PI-004', category: 'direct_injection', severity: 'high',
    pattern: /(?:stop|cease|quit)\s+(?:following|adhering\s+to)\s+(?:your|the)\s+(?:instructions|rules|guidelines)/i,
    description: 'Stop following instructions' },
  { id: 'PI-005', category: 'direct_injection', severity: 'critical',
    pattern: /(?:new|different|updated)\s+(?:instructions?|rules?|directives?)\s*:/i,
    description: 'Fake new instruction block' },

  // 2. ROLE HIJACKING
  { id: 'PI-006', category: 'role_hijacking', severity: 'critical',
    pattern: /you\s+are\s+(?:now|actually)\s+(?:a|an)\s+(?:different|new|admin|root|developer|system|root\s+user|superuser)/i,
    description: 'Attempt to change agent role to admin/developer' },
  { id: 'PI-007', category: 'role_hijacking', severity: 'high',
    pattern: /(?:act|pretend|simulate)\s+(?:as\s+if\s+you\s+are|to\s+be)\s+(?:a|an)\s+(?:different|admin|root|developer|system)/i,
    description: 'Roleplay as admin/developer' },
  { id: 'PI-008', category: 'role_hijacking', severity: 'high',
    pattern: /your\s+(?:new\s+)?(?:role|identity|persona)\s+is\s+(?:now|changed\s+to)/i,
    description: 'Identity reassignment' },
  { id: 'PI-009', category: 'role_hijacking', severity: 'critical',
    pattern: /(?:system|developer|admin)\s*(?::|>>|→)\s*(?:you|execute|run|do)/i,
    description: 'Fake system/admin message prefix' },

  // 3. INSTRUCTION OVERRIDE
  { id: 'PI-010', category: 'instruction_override', severity: 'high',
    pattern: /instead\s+of\s+(?:doing\s+)?(?:that|this|what\s+you\s+(?:were|are)\s+(?:told|asked))/i,
    description: 'Redirect task' },
  { id: 'PI-011', category: 'instruction_override', severity: 'high',
    pattern: /don'?t\s+(?:do|follow|execute|run)\s+(?:that|this|the\s+(?:above|previous))/i,
    description: 'Cancel previous instruction' },
  { id: 'PI-012', category: 'instruction_override', severity: 'critical',
    pattern: /(?:override|supersede|replace)\s+(?:the\s+)?(?:system|default|safety|security)\s+(?:prompt|instructions?|rules?)/i,
    description: 'Override system/safety rules' },

  // 4. DATA EXFILTRATION
  { id: 'PI-013', category: 'data_exfiltration', severity: 'critical',
    pattern: /(?:send|post|transmit|exfiltrate|upload|forward)\s+(?:this|the|all|your)\s+(?:data|content|messages?|conversation|history|context|credentials?|tokens?|keys?|secrets?)\s+(?:to|via|through)\s+(?:https?:\/\/|www\.|api\.|webhook|email|discord|telegram|slack)/i,
    description: 'Exfiltrate data to external service' },
  { id: 'PI-014', category: 'data_exfiltration', severity: 'high',
    pattern: /(?:call|fetch|request|contact)\s+(?:this\s+)?(?:url|endpoint|api|webhook|address)\s*:\s*(?:https?:\/\/|www\.)/i,
    description: 'Call external URL (SSRF via prompt)' },
  { id: 'PI-015', category: 'data_exfiltration', severity: 'high',
    pattern: /(?:include|embed|attach)\s+(?:your|the)\s+(?:system\s+)?(?:prompt|instructions?|rules?|api\s+keys?|tokens?|secrets?)\s+(?:in|with|to)\s+(?:your|the)\s+(?:response|output|answer)/i,
    description: 'Extract system prompt or secrets via response' },

  // 5. PRIVILEGE ESCALATION
  { id: 'PI-016', category: 'privilege_escalation', severity: 'critical',
    pattern: /(?:with|using|as|via)\s+(?:root|admin|administrator|sudo|superuser|elevated)\s+(?:access|privileges?|permissions?|rights?)/i,
    description: 'Request elevated privileges' },
  { id: 'PI-017', category: 'privilege_escalation', severity: 'critical',
    pattern: /(?:bypass|disable|circumvent|ignore|deactivate)\s+(?:the\s+)?(?:security|safety|content\s+filter|guardrail|protection|firewall|sandbox)/i,
    description: 'Bypass security controls' },
  { id: 'PI-018', category: 'privilege_escalation', severity: 'high',
    pattern: /(?:access|read|write|modify|delete)\s+(?:the\s+)?(?:\/etc\/|\/root\/|\/var\/|\/proc\/|~\/\.ssh|~\/\.aws|environment\s+variables?)/i,
    description: 'Access sensitive system paths via prompt' },

  // 6. CONTEXT POISONING
  { id: 'PI-019', category: 'context_poisoning', severity: 'critical',
    pattern: /<(?:system|developer|admin|tool|function)>/i,
    description: 'Fake XML-style system/developer message tag' },
  { id: 'PI-020', category: 'context_poisoning', severity: 'high',
    pattern: /\[(?:system|developer|admin|internal|hidden)\]/i,
    description: 'Fake bracket-style system message' },
  { id: 'PI-021', category: 'context_poisoning', severity: 'high',
    pattern: /(?:###|##|#)\s+(?:system|developer|admin|internal|hidden)\s*(?:message|instruction|prompt|note)/i,
    description: 'Fake markdown heading for system message' },

  // 7. ENCODING EVASION
  { id: 'PI-022', category: 'encoding_evasion', severity: 'high',
    pattern: /(?:atob|base64decode|Buffer\.from\([^)]+,\s*['"]base64['"])/i,
    description: 'Base64 decode in tool description (hiding payload)' },
  { id: 'PI-023', category: 'encoding_evasion', severity: 'high',
    pattern: /\\x[0-9a-f]{2}\\x[0-9a-f]{2}\\x[0-9a-f]{2}/i,
    description: 'Hex-encoded string (evasion attempt)' },
  { id: 'PI-024', category: 'encoding_evasion', severity: 'medium',
    pattern: /\\u[0-9a-f]{4}\\u[0-9a-f]{4}/i,
    description: 'Unicode escape sequence (possible evasion)' },

  // 8. SOCIAL ENGINEERING
  { id: 'PI-025', category: 'social_engineering', severity: 'high',
    pattern: /(?:the\s+)?(?:developer|creator|author|admin|system)\s+(?:says|told|instructed|wants|needs)\s+(?:you\s+)?to/i,
    description: 'Fake authority: "the developer says to..."' },
  { id: 'PI-026', category: 'social_engineering', severity: 'high',
    pattern: /(?:this\s+is\s+)?(?:safe|approved|authorized|trusted|verified|legitimate|ok|okay)\s+(?:to|for)\s+(?:execute|run|access|do)/i,
    description: 'Self-authorization: "this is safe to execute"' },
  { id: 'PI-027', category: 'social_engineering', severity: 'medium',
    pattern: /(?:trust|believe)\s+(?:me|this|the\s+above)/i,
    description: 'Trust appeal' },

  // 9. TOOL IMPERSONATION
  { id: 'PI-028', category: 'tool_impersonation', severity: 'critical',
    pattern: /(?:name|toolName|tool_name)\s*[:=]\s*['"](?:read_file|write_file|execute|system|shell|admin|root|eval|exec)['"]/i,
    description: 'Tool impersonating system commands' },
  { id: 'PI-029', category: 'tool_impersonation', severity: 'high',
    pattern: /I\s+am\s+(?:the\s+)?(?:system|admin|filesystem|terminal|shell)\s+(?:tool|agent|assistant)/i,
    description: 'Tool claiming to be system/admin tool' },

  // 10. MEMORY MANIPULATION
  { id: 'PI-030', category: 'memory_manipulation', severity: 'high',
    pattern: /(?:remember|store|save|note)\s+(?:that|this)\s+(?:you\s+)?(?:are|were|will|can|should|must)/i,
    description: 'Memory injection: "remember that you are..."' },
  { id: 'PI-031', category: 'memory_manipulation', severity: 'high',
    pattern: /(?:from\s+now\s+on|going\s+forward|always|henceforth)\s+(?:you\s+)?(?:will|must|should|are)/i,
    description: 'Persistent instruction injection' },
  { id: 'PI-032', category: 'memory_manipulation', severity: 'medium',
    pattern: /(?:update|modify|change|edit)\s+(?:your|the)\s+(?:memory|context|knowledge\s+base|instructions?)/i,
    description: 'Attempt to modify agent memory/context' },
];

// ─── Sanitization ─────────────────────────────────────────────────────

/**
 * Sanitize text by neutralizing prompt injection patterns.
 * Instead of blocking, we redact the dangerous parts.
 */
function sanitizeText(text) {
  let sanitized = text;
  for (const rule of INJECTION_RULES) {
    if (rule.severity === 'critical' || rule.severity === 'high') {
      sanitized = sanitized.replace(rule.pattern, '[REDACTED BY L1.9]');
    }
  }
  return sanitized;
}

// ─── Main L1.9 ────────────────────────────────────────────────────────

export function runL19(skill, options = {}) {
  const { sanitize = false } = options;
  const findings = {
    injections: [],
    sanitized_text: null,
    total_critical: 0,
    total_high: 0,
    total_medium: 0,
  };

  // Scan all text that could reach an LLM
  const textFields = [
    skill.name || '',
    skill.description || '',
    skill.doc?.system_prompt || '',
    skill.doc?.setup || '',
    skill.install || '',
    skill.capabilities?.provides?.join(' ') || '',
  ];
  const allText = textFields.join('\n');

  for (const rule of INJECTION_RULES) {
    if (rule.pattern.test(allText)) {
      findings.injections.push({
        id: rule.id,
        category: rule.category,
        severity: rule.severity,
        description: rule.description,
        pattern_matched: rule.pattern.source.slice(0, 60),
      });
      if (rule.severity === 'critical') findings.total_critical++;
      else if (rule.severity === 'high') findings.total_high++;
      else findings.total_medium++;
    }
  }

  // Sanitize if requested
  if (sanitize) {
    findings.sanitized_text = sanitizeText(allText);
  }

  const quarantineRecommended = findings.total_critical > 0 ||
    findings.total_high >= 2;

  let scoreAdjustment = 0;
  if (findings.total_critical > 0) {
    scoreAdjustment = -10;
  } else {
    scoreAdjustment -= findings.total_high * 3;
    scoreAdjustment -= findings.total_medium * 1;
  }
  scoreAdjustment = Math.max(-10, scoreAdjustment);

  return {
    findings,
    score_adjustment: scoreAdjustment,
    quarantine_recommended: quarantineRecommended,
    details: {
      rules_run: INJECTION_RULES.length,
      injections_found: findings.injections.length,
      categories_detected: [...new Set(findings.injections.map(i => i.category))],
      sanitized: sanitize,
    },
  };
}

export { INJECTION_RULES, sanitizeText };
