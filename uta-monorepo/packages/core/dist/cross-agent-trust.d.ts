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
export declare function evaluateDelegation(request: DelegationRequest, params: {
    from_trust_score: number;
    to_trust_score: number;
    to_capabilities: string[];
    to_revoked: boolean;
    to_suspicious_flags: string[];
    delegation_chain_depth: number;
    max_delegation_depth?: number;
}): DelegationResult;
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
/**
 * Scan agent memory for poisoning signals.
 */
export declare function scanMemoryForPoisoning(entries: MemoryEntry[]): PoisoningScanResult;
/**
 * Helper: create a memory entry hash.
 */
export declare function hashMemoryEntry(content: string): string;
export declare const CROSS_AGENT_VERSION = "1.0.0";
export declare const MAX_DELEGATION_DEPTH = 5;
export declare const MEMORY_POISONING_VERSION = "1.0.0";
export declare const POISONING_PATTERNS: {
    injection: RegExp[];
    exfiltration: RegExp[];
    privilege_escalation: RegExp[];
    identity_spoofing: RegExp[];
};
