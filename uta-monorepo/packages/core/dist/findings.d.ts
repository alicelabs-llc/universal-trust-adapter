/**
 * @marketnow/trust-core
 * Evidence-First Findings — v5.1.3
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 *
 * Purpose:
 *   Each audit finding gets three metrics instead of one:
 *   - Risk Score: how dangerous is this finding? (0-10)
 *   - Confidence Score: how sure are we this is real? (0-100%)
 *   - Evidence Coverage: what % of the tool surface was verified?
 *
 *   Two audits of the same version should produce identical results
 *   (or explain the difference). This enables:
 *   - Reproducible audits
 *   - Comparing scanner versions
 *   - Comparing ruleset versions
 *   - Detecting "shadow" audits by malicious parties
 */
/**
 * Severity classification — maps to CVSS-style ratings but adapted for MCP/agent context.
 */
export type Severity = 'none' | 'info' | 'low' | 'medium' | 'high' | 'critical';
/**
 * Risk score (0-10) — how dangerous is this finding if true?
 *
 * 0  = informational only (no impact)
 * 1-2 = low (minor info disclosure, hard to exploit)
 * 3-4 = medium-low (e.g., verbose error messages, no PII)
 * 5-6 = medium (e.g., CORS misconfiguration, rate limit bypass)
 * 7-8 = high (e.g., prompt injection vector, SSRF potential)
 * 9-10 = critical (e.g., RCE, credential exfiltration, supply chain attack)
 */
export type RiskScore = number;
/**
 * Confidence score (0-100%) — how sure are we this is a real finding?
 *
 * 0-25%  = heuristic-only, may be false positive
 * 26-50% = pattern match, possible but not confirmed
 * 51-75% = static analysis with high confidence
 * 76-90% = sandbox-confirmed behavior
 * 91-100% = human reviewer confirmed + reproduction steps
 */
export type ConfidenceScore = number;
/**
 * Source of the finding.
 */
export type FindingSource = 'semgrep' | 'semgrep_custom' | 'secret_detection' | 'malware_pattern' | 'malware_family' | 'prompt_injection_rule' | 'sandbox_observation' | 'network_egress_log' | 'filesystem_access_log' | 'process_spawn_log' | 'dependency_scan' | 'sbom_mismatch' | 'tool_fingerprint_drift' | 'human_review' | 'external_report';
/**
 * A single evidence-First finding.
 */
export interface Finding {
    /** Unique finding ID (e.g. "F-2026-001") */
    finding_id: string;
    /** Layer that produced this finding (e.g. "L1.6", "L2.5") */
    layer: string;
    /** Source of the finding */
    source: FindingSource;
    /** Rule that matched (e.g. "semgrep:javascript.lang.security.audit.xss") */
    rule_id?: string;
    /** Severity classification */
    severity: Severity;
    /** Risk score (0-10) */
    risk_score: RiskScore;
    /** Confidence score (0-100) */
    confidence_score: ConfidenceScore;
    /** Human-readable title */
    title: string;
    /** Detailed description */
    description: string;
    /** Where the finding was detected (file:line or endpoint) */
    location: string;
    /** Code snippet showing the issue (truncated to 500 chars max) */
    evidence_snippet?: string;
    /** SHA-256 of the evidence snippet (for tamper-evidence) */
    evidence_hash?: string;
    /** Reproduction steps (how to trigger the issue) */
    reproduction?: string;
    /** Recommended remediation */
    remediation?: string;
    /** CWE (Common Weakness Enumeration) ID if applicable */
    cwe_id?: string;
    /** OWASP MCP Top 10 category if applicable (e.g. "MCP01") */
    owasp_mcp_category?: string;
    /** When the finding was detected */
    detected_at: string;
    /** Scanner version that produced this finding (for reproducibility) */
    scanner_version: string;
    /** Ruleset version (for reproducibility) */
    ruleset_version: string;
}
/**
 * Coverage metrics for an audit.
 */
export interface AuditCoverage {
    /** Total number of files scanned */
    files_scanned: number;
    /** Total number of lines scanned */
    lines_scanned: number;
    /** Number of tools in tools/list response */
    tools_count: number;
    /** Number of tools that were statically analyzed */
    tools_statically_analyzed: number;
    /** Number of tools that were sandboxed */
    tools_sandboxed: number;
    /** Number of tools that were network-monitored at runtime */
    tools_runtime_monitored: number;
    /** % of tool surface statically analyzed */
    static_coverage_pct: number;
    /** % of tool surface sandboxed */
    sandbox_coverage_pct: number;
    /** % of tool surface runtime-monitored */
    runtime_coverage_pct: number;
    /** Overall evidence coverage (weighted average) */
    overall_coverage_pct: number;
}
/**
 * Summary of all findings from an audit.
 */
export interface FindingsSummary {
    /** Total findings */
    total: number;
    /** Counts by severity */
    by_severity: Record<Severity, number>;
    /** Counts by source */
    by_source: Partial<Record<FindingSource, number>>;
    /** Counts by layer */
    by_layer: Record<string, number>;
    /** Average risk score across all findings */
    avg_risk_score: number;
    /** Average confidence score across all findings */
    avg_confidence_score: number;
    /** Coverage metrics */
    coverage: AuditCoverage;
    /** Audit ID (for reproducibility) */
    audit_id: string;
    /** Scanner version */
    scanner_version: string;
    /** Ruleset version */
    ruleset_version: string;
    /** Sandbox image SHA-256 (for reproducibility) */
    sandbox_image_sha?: string;
    /** When the audit was performed */
    audit_completed_at: string;
}
/**
 * Get the default risk score for a severity.
 */
export declare function defaultRiskScore(severity: Severity): RiskScore;
/**
 * Confidence score factors — each adds to the base confidence.
 *
 * Rationale:
 * - Pattern match only: 30%
 * - + Code path reachable: +20%
 * - + Sandbox-observed behavior: +25%
 * - + Reproducible (test vector exists): +15%
 * - + Human reviewer confirmed: +10%
 *
 * Max possible: 100%
 */
export interface ConfidenceFactors {
    /** Pattern matched in source code (default 30%) */
    pattern_match?: boolean;
    /** Code path from tool handler to the finding is reachable (default 20%) */
    code_path_reachable?: boolean;
    /** Sandbox observed the behavior at runtime (default 25%) */
    sandbox_observed?: boolean;
    /** Reproducible — test vector exists for this finding (default 15%) */
    reproducible?: boolean;
    /** Human reviewer confirmed (default 10%) */
    human_reviewed?: boolean;
}
/**
 * Compute confidence score from factors.
 */
export declare function computeConfidence(factors: ConfidenceFactors): ConfidenceScore;
/**
 * Compute coverage metrics from raw counts.
 *
 * Coverage weights:
 * - Static analysis: 40% of overall
 * - Sandbox: 35% of overall
 * - Runtime monitoring: 25% of overall
 *
 * If a tool wasn't sandboxed (e.g. because it requires network access),
 * the 35% sandbox weight goes to 0 — the tool can never reach 100% coverage
 * without sandboxing.
 */
export declare function computeCoverage(params: {
    files_scanned: number;
    lines_scanned: number;
    tools_count: number;
    tools_statically_analyzed: number;
    tools_sandboxed: number;
    tools_runtime_monitored: number;
}): AuditCoverage;
/**
 * Aggregate findings into a summary.
 *
 * @param findings  Array of findings
 * @param coverage  Coverage metrics for the audit
 * @param metadata  Scanner/ruleset version, audit ID, etc.
 */
export declare function summarizeFindings(findings: Finding[], coverage: AuditCoverage, metadata: {
    audit_id: string;
    scanner_version: string;
    ruleset_version: string;
    sandbox_image_sha?: string;
}): FindingsSummary;
/**
 * Audit context — everything needed to reproduce an audit.
 *
 * Two audits with the same context + same target should produce
 * identical findings (or explain the difference).
 */
export interface AuditContext {
    /** Audit ID (UUID v7 — time-ordered) */
    audit_id: string;
    /** Target being audited (URL, package name, or path) */
    target: string;
    /** Target version (commit SHA, package version, etc.) */
    target_version: string;
    /** Scanner version */
    scanner_version: string;
    /** Ruleset version (Semgrep rules, etc.) */
    ruleset_version: string;
    /** Sandbox image SHA-256 (Docker digest) */
    sandbox_image_sha?: string;
    /** Audit timestamp (ISO 8601 UTC) */
    audit_started_at: string;
    /** Audit completed timestamp */
    audit_completed_at?: string;
    /** Audit parameters (env vars, config, etc. — for reproducibility) */
    audit_parameters?: Record<string, string>;
}
/**
 * Compare two audit contexts to determine if they should produce identical results.
 *
 * Returns a list of differences. If the list is empty, the audits are reproducible.
 */
export declare function compareAuditContexts(a: AuditContext, b: AuditContext): string[];
/**
 * Compare two findings summaries (same audit, different runs).
 *
 * Returns the differences. If the list is empty, the audits are byte-identical.
 */
export declare function compareFindingsSummaries(a: FindingsSummary, b: FindingsSummary): string[];
export declare const FINDINGS_SPEC_VERSION = "1.0.0";
export declare const FINDINGS_HASH_ALGORITHM = "SHA-256";
export declare const COVERAGE_WEIGHTS: {
    readonly static_analysis: 0.4;
    readonly sandbox: 0.35;
    readonly runtime_monitoring: 0.25;
};
