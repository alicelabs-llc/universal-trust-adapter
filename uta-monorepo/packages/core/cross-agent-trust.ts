/**
 * @marketnow/trust-core
 * Cross-Agent Trust + Memory Poisoning Detection — v6.0
 *
 * Cross-Agent Trust: Agent A delegates to Agent B, verifies Trust Card first.
 * Memory Poisoning: Detect when agent memory has been poisoned by malicious
 * tool responses or prompt injection attacks.
 *
 * Closes GitHub Issues #10 and #11.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */

import { createHash } from 'node:crypto';

// ============================================================================
// Cross-Agent Trust Types
// ============================================================================

export interface DelegationRequest {
  delegation_id: string;
  from_agent_id: string;
  to_agent_id: string;
  task_description: string;
  required_capabilities: string[];
  required_trust_score: number;
  timestamp: string;
  expires_at: string;
}

export interface DelegationResult {
  delegation_id: string;
  approved: boolean;
  reason: string;
  from_trust_score: number;
  to_trust_score: number;
  capability_match: boolean;
  checks: DelegationCheck[];
  timestamp: string;
}

export interface DelegationCheck {
  check_name: string;
  passed: boolean;
  details: string;
}

/**
 * Evaluate whether Agent A can delegate a task to Agent B.
 *
 * Checks:
 * 1. Agent B's Trust Card is valid and not revoked
 * 2. Agent B's trust score ≥ required_trust_score
 * 3. Agent B's capabilities match the required_capabilities
 * 4. Agent B has not been flagged for suspicious behavior
 * 5. Delegation chain depth is within limits (max 5 hops)
 */
export function evaluateDelegation(
  request: DelegationRequest,
  params: {
    from_trust_score: number;
    to_trust_score: number;
    to_capabilities: string[];
    to_revoked: boolean;
    to_suspicious_flags: string[];
    delegation_chain_depth: number;
    max_delegation_depth?: number;
  },
): DelegationResult {
  const checks: DelegationCheck[] = [];
  let approved = true;
  const reasons: string[] = [];
  const maxDepth = params.max_delegation_depth ?? 5;

  // Check 1: Trust Card validity
  const notRevoked = !params.to_revoked;
  checks.push({
    check_name: 'trust_card_valid',
    passed: notRevoked,
    details: notRevoked ? 'Agent B trust card is valid' : 'Agent B trust card is revoked',
  });
  if (!notRevoked) {
    approved = false;
    reasons.push('Agent B trust card is revoked');
  }

  // Check 2: Trust score
  const scoreSufficient = params.to_trust_score >= request.required_trust_score;
  checks.push({
    check_name: 'trust_score_sufficient',
    passed: scoreSufficient,
    details: `Agent B score ${params.to_trust_score} ${scoreSufficient ? '≥' : '<'} required ${request.required_trust_score}`,
  });
  if (!scoreSufficient) {
    approved = false;
    reasons.push(`Trust score ${params.to_trust_score} below required ${request.required_trust_score}`);
  }

  // Check 3: Capability match
  const missingCaps = request.required_capabilities.filter(c => !params.to_capabilities.includes(c));
  const capsMatch = missingCaps.length === 0;
  checks.push({
    check_name: 'capability_match',
    passed: capsMatch,
    details: capsMatch ? 'All required capabilities present' : `Missing: ${missingCaps.join(', ')}`,
  });
  if (!capsMatch) {
    approved = false;
    reasons.push(`Missing capabilities: ${missingCaps.join(', ')}`);
  }

  // Check 4: Suspicious behavior
  const notSuspicious = params.to_suspicious_flags.length === 0;
  checks.push({
    check_name: 'no_suspicious_behavior',
    passed: notSuspicious,
    details: notSuspicious ? 'No suspicious flags' : `Flags: ${params.to_suspicious_flags.join(', ')}`,
  });
  if (!notSuspicious) {
    approved = false;
    reasons.push(`Agent B has suspicious flags: ${params.to_suspicious_flags.join(', ')}`);
  }

  // Check 5: Delegation chain depth
  const withinDepth = params.delegation_chain_depth < maxDepth;
  checks.push({
    check_name: 'delegation_depth',
    passed: withinDepth,
    details: `Chain depth ${params.delegation_chain_depth} ${withinDepth ? '<' : '≥'} max ${maxDepth}`,
  });
  if (!withinDepth) {
    approved = false;
    reasons.push(`Delegation chain too deep (${params.delegation_chain_depth} ≥ ${maxDepth})`);
  }

  // Check 6: From-agent trust (Agent A must be trusted to delegate)
  const fromTrusted = params.from_trust_score >= 5;
  checks.push({
    check_name: 'from_agent_trusted',
    passed: fromTrusted,
    details: `Agent A score ${params.from_trust_score} ${fromTrusted ? '≥' : '<'} 5`,
  });
  if (!fromTrusted) {
    approved = false;
    reasons.push(`Agent A trust score too low to delegate (${params.from_trust_score})`);
  }

  return {
    delegation_id: request.delegation_id,
    approved,
    reason: approved ? 'All delegation checks passed' : reasons.join('; '),
    from_trust_score: params.from_trust_score,
    to_trust_score: params.to_trust_score,
    capability_match: capsMatch,
    checks,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// Memory Poisoning Detection Types
// ============================================================================

export interface MemoryEntry {
  entry_id: string;
  session_id: string;
  source: 'user' | 'tool' | 'llm' | 'system' | 'external';
  source_tool?: string;
  content_hash: string;
  content_preview: string;
  timestamp: string;
  is_sensitive: boolean;
}

export interface PoisoningSignal {
  signal_type: 'instruction_injection' | 'data_exfiltration' | 'privilege_escalation' | 'identity_spoofing' | 'replay_attack';
  severity: 'warn' | 'high' | 'critical';
  description: string;
  evidence: string;
  affected_entries: string[];
  timestamp: string;
}

export interface PoisoningScanResult {
  session_id: string;
  total_entries: number;
  signals: PoisoningSignal[];
  is_poisoned: boolean;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  scanned_at: string;
}

// ============================================================================
// Poisoning detection patterns
// ============================================================================

const INJECTION_PATTERNS = [
  /ignore (previous|prior|all) (instructions|prompts|rules)/i,
  /you are now (a|an) (different|new)/i,
  /disregard (everything|all) (above|before)/i,
  /forget (your|all) (previous|prior) (instructions|rules)/i,
  /act as if you (are|were) (not|no longer) (constrained|restricted)/i,
  /override (your|the) (safety|security) (rules|guidelines)/i,
  /new instructions?:/i,
  /system (prompt|instruction):/i,
  /\[INST\]/i,
  /<\|im_start\|>/i,
];

const EXFILTRATION_PATTERNS = [
  /send (this|the) (data|content|file|information) to/i,
  /upload (to|via) (http|https|ftp):\/\//i,
  /exfiltrate/i,
  /post (this|data|content) to/i,
  /curl .+ \| (bash|sh)/i,
  /wget .+ && (sh|bash|python)/i,
  /eval\(atob\(/i,
  /base64 (decode|encode).*exec/i,
];

const PRIVILEGE_ESCALATION_PATTERNS = [
  /sudo (rm|chmod|chown|dd|mkfs)/i,
  /chmod 777/i,
  /chown root/i,
  /\/etc\/sudoers/i,
  /escalat(e|ion)/i,
  /gain (root|admin|elevated)/i,
];

const IDENTITY_SPOOFING_PATTERNS = [
  /I am (the|your) (admin|administrator|root|developer|owner)/i,
  /my (role|clearance|level) is (admin|root|superuser)/i,
  /authorized (by|from) (the|your) (admin|developer|owner)/i,
  /trust me,? I'?m (an? )?(admin|developer|root)/i,
];

const REPLAY_PATTERNS = [
  // Same content hash appearing from different sources
  // Detected programmatically, not via regex
];

// ============================================================================
// Memory poisoning detection
// ============================================================================

/**
 * Scan agent memory for poisoning signals.
 */
export function scanMemoryForPoisoning(entries: MemoryEntry[]): PoisoningScanResult {
  const signals: PoisoningSignal[] = [];
  const sessionId = entries[0]?.session_id || 'unknown';

  for (const entry of entries) {
    const content = entry.content_preview;

    // Check for instruction injection
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(content)) {
        signals.push({
          signal_type: 'instruction_injection',
          severity: 'critical',
          description: `Instruction injection detected in memory entry from ${entry.source}${entry.source_tool ? ` (${entry.source_tool})` : ''}`,
          evidence: `Pattern "${pattern.source}" matched in: ${content.slice(0, 100)}`,
          affected_entries: [entry.entry_id],
          timestamp: new Date().toISOString(),
        });
        break;
      }
    }

    // Check for data exfiltration commands
    for (const pattern of EXFILTRATION_PATTERNS) {
      if (pattern.test(content)) {
        signals.push({
          signal_type: 'data_exfiltration',
          severity: 'critical',
          description: `Data exfiltration command detected in memory entry from ${entry.source}`,
          evidence: `Pattern "${pattern.source}" matched in: ${content.slice(0, 100)}`,
          affected_entries: [entry.entry_id],
          timestamp: new Date().toISOString(),
        });
        break;
      }
    }

    // Check for privilege escalation
    for (const pattern of PRIVILEGE_ESCALATION_PATTERNS) {
      if (pattern.test(content)) {
        signals.push({
          signal_type: 'privilege_escalation',
          severity: 'high',
          description: `Privilege escalation attempt in memory entry from ${entry.source}`,
          evidence: `Pattern "${pattern.source}" matched in: ${content.slice(0, 100)}`,
          affected_entries: [entry.entry_id],
          timestamp: new Date().toISOString(),
        });
        break;
      }
    }

    // Check for identity spoofing
    for (const pattern of IDENTITY_SPOOFING_PATTERNS) {
      if (pattern.test(content)) {
        signals.push({
          signal_type: 'identity_spoofing',
          severity: 'high',
          description: `Identity spoofing attempt in memory entry from ${entry.source}`,
          evidence: `Pattern "${pattern.source}" matched in: ${content.slice(0, 100)}`,
          affected_entries: [entry.entry_id],
          timestamp: new Date().toISOString(),
        });
        break;
      }
    }
  }

  // Check for replay attacks (same content from different sources)
  const hashCounts: Record<string, MemoryEntry[]> = {};
  for (const entry of entries) {
    if (!hashCounts[entry.content_hash]) {
      hashCounts[entry.content_hash] = [];
    }
    hashCounts[entry.content_hash].push(entry);
  }

  for (const [hash, entriesWithHash] of Object.entries(hashCounts)) {
    if (entriesWithHash.length > 1) {
      const sources = [...new Set(entriesWithHash.map(e => e.source))];
      if (sources.length > 1) {
        signals.push({
          signal_type: 'replay_attack',
          severity: 'warn',
          description: `Content hash ${hash.slice(0, 16)} appears from ${sources.length} different sources: ${sources.join(', ')}`,
          evidence: `Entries: ${entriesWithHash.map(e => e.entry_id).join(', ')}`,
          affected_entries: entriesWithHash.map(e => e.entry_id),
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  // Check for sensitive data in tool-sourced entries
  const sensitiveFromTools = entries.filter(e =>
    e.source === 'tool' && e.is_sensitive
  );
  if (sensitiveFromTools.length > 0) {
    signals.push({
      signal_type: 'data_exfiltration',
      severity: 'warn',
      description: `${sensitiveFromTools.length} memory entries from tools contain sensitive data`,
      evidence: `Entry IDs: ${sensitiveFromTools.map(e => e.entry_id).slice(0, 5).join(', ')}`,
      affected_entries: sensitiveFromTools.map(e => e.entry_id),
      timestamp: new Date().toISOString(),
    });
  }

  // Calculate risk score
  const criticalCount = signals.filter(s => s.severity === 'critical').length;
  const highCount = signals.filter(s => s.severity === 'high').length;
  const warnCount = signals.filter(s => s.severity === 'warn').length;

  let riskScore = 0;
  if (criticalCount > 0) riskScore = 10;
  else if (highCount > 0) riskScore = Math.min(8, 5 + highCount);
  else if (warnCount > 0) riskScore = Math.min(4, warnCount);

  const riskLevel = riskScore >= 8 ? 'critical' : riskScore >= 5 ? 'high' : riskScore >= 3 ? 'medium' : 'low';
  const isPoisoned = signals.length > 0 && (criticalCount > 0 || highCount > 0);

  // Recommendations
  const recommendations: string[] = [];
  if (criticalCount > 0) {
    recommendations.push('CRITICAL: Memory has been poisoned. Flush all tool-sourced memory entries immediately.');
  }
  if (signals.some(s => s.signal_type === 'instruction_injection')) {
    recommendations.push('BLOCK: Instruction injection detected. Agent may be compromised. Re-verify all recent actions.');
  }
  if (signals.some(s => s.signal_type === 'data_exfiltration')) {
    recommendations.push('BLOCK: Data exfiltration pattern detected. Audit all recent network calls.');
  }
  if (signals.some(s => s.signal_type === 'privilege_escalation')) {
    recommendations.push('WARN: Privilege escalation attempt. Restrict agent permissions.');
  }
  if (signals.some(s => s.signal_type === 'identity_spoofing')) {
    recommendations.push('WARN: Identity spoofing detected. Re-verify agent identity via ATC.');
  }
  if (signals.some(s => s.signal_type === 'replay_attack')) {
    recommendations.push('INFO: Possible replay attack. Check if content was duplicated across sources.');
  }
  if (recommendations.length === 0) {
    recommendations.push('PASS: No memory poisoning detected.');
  }

  return {
    session_id: sessionId,
    total_entries: entries.length,
    signals,
    is_poisoned: isPoisoned,
    risk_score: riskScore,
    risk_level: riskLevel,
    recommendations,
    scanned_at: new Date().toISOString(),
  };
}

/**
 * Helper: create a memory entry hash.
 */
export function hashMemoryEntry(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

// ============================================================================
// Constants
// ============================================================================

export const CROSS_AGENT_VERSION = '1.0.0';
export const MAX_DELEGATION_DEPTH = 5;
export const MEMORY_POISONING_VERSION = '1.0.0';

export const POISONING_PATTERNS = {
  injection: INJECTION_PATTERNS,
  exfiltration: EXFILTRATION_PATTERNS,
  privilege_escalation: PRIVILEGE_ESCALATION_PATTERNS,
  identity_spoofing: IDENTITY_SPOOFING_PATTERNS,
};
