"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.COVERAGE_WEIGHTS = exports.FINDINGS_HASH_ALGORITHM = exports.FINDINGS_SPEC_VERSION = void 0;
exports.defaultRiskScore = defaultRiskScore;
exports.computeConfidence = computeConfidence;
exports.computeCoverage = computeCoverage;
exports.summarizeFindings = summarizeFindings;
exports.compareAuditContexts = compareAuditContexts;
exports.compareFindingsSummaries = compareFindingsSummaries;
// ============================================================================
// Severity → Risk Score mapping
// ============================================================================
/**
 * Default risk score per severity.
 * Findings can override this if they have more context.
 */
const SEVERITY_TO_RISK = {
    none: 0,
    info: 1,
    low: 2.5,
    medium: 5,
    high: 7.5,
    critical: 9.5,
};
/**
 * Get the default risk score for a severity.
 */
function defaultRiskScore(severity) {
    return SEVERITY_TO_RISK[severity];
}
/**
 * Compute confidence score from factors.
 */
function computeConfidence(factors) {
    let score = 0;
    if (factors.pattern_match)
        score += 30;
    if (factors.code_path_reachable)
        score += 20;
    if (factors.sandbox_observed)
        score += 25;
    if (factors.reproducible)
        score += 15;
    if (factors.human_reviewed)
        score += 10;
    return Math.min(100, score);
}
// ============================================================================
// Coverage computation
// ============================================================================
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
function computeCoverage(params) {
    const { files_scanned, lines_scanned, tools_count, tools_statically_analyzed, tools_sandboxed, tools_runtime_monitored, } = params;
    const staticPct = tools_count === 0 ? 0 : (tools_statically_analyzed / tools_count) * 100;
    const sandboxPct = tools_count === 0 ? 0 : (tools_sandboxed / tools_count) * 100;
    const runtimePct = tools_count === 0 ? 0 : (tools_runtime_monitored / tools_count) * 100;
    // Weighted average
    const overallPct = (staticPct * 0.40) + (sandboxPct * 0.35) + (runtimePct * 0.25);
    return {
        files_scanned,
        lines_scanned,
        tools_count,
        tools_statically_analyzed,
        tools_sandboxed,
        tools_runtime_monitored,
        static_coverage_pct: Math.round(staticPct * 100) / 100,
        sandbox_coverage_pct: Math.round(sandboxPct * 100) / 100,
        runtime_coverage_pct: Math.round(runtimePct * 100) / 100,
        overall_coverage_pct: Math.round(overallPct * 100) / 100,
    };
}
// ============================================================================
// Findings summary
// ============================================================================
/**
 * Aggregate findings into a summary.
 *
 * @param findings  Array of findings
 * @param coverage  Coverage metrics for the audit
 * @param metadata  Scanner/ruleset version, audit ID, etc.
 */
function summarizeFindings(findings, coverage, metadata) {
    const by_severity = {
        none: 0,
        info: 0,
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
    };
    const by_source = {};
    const by_layer = {};
    let totalRisk = 0;
    let totalConfidence = 0;
    for (const f of findings) {
        by_severity[f.severity]++;
        by_source[f.source] = (by_source[f.source] ?? 0) + 1;
        by_layer[f.layer] = (by_layer[f.layer] ?? 0) + 1;
        totalRisk += f.risk_score;
        totalConfidence += f.confidence_score;
    }
    const count = findings.length;
    return {
        total: count,
        by_severity,
        by_source,
        by_layer,
        avg_risk_score: count === 0 ? 0 : Math.round((totalRisk / count) * 100) / 100,
        avg_confidence_score: count === 0 ? 0 : Math.round((totalConfidence / count) * 100) / 100,
        coverage,
        audit_id: metadata.audit_id,
        scanner_version: metadata.scanner_version,
        ruleset_version: metadata.ruleset_version,
        sandbox_image_sha: metadata.sandbox_image_sha,
        audit_completed_at: new Date().toISOString(),
    };
}
/**
 * Compare two audit contexts to determine if they should produce identical results.
 *
 * Returns a list of differences. If the list is empty, the audits are reproducible.
 */
function compareAuditContexts(a, b) {
    const diffs = [];
    if (a.scanner_version !== b.scanner_version) {
        diffs.push(`scanner_version: ${a.scanner_version} vs ${b.scanner_version}`);
    }
    if (a.ruleset_version !== b.ruleset_version) {
        diffs.push(`ruleset_version: ${a.ruleset_version} vs ${b.ruleset_version}`);
    }
    if (a.sandbox_image_sha !== b.sandbox_image_sha) {
        diffs.push(`sandbox_image_sha: ${a.sandbox_image_sha ?? 'none'} vs ${b.sandbox_image_sha ?? 'none'}`);
    }
    if (a.target !== b.target) {
        diffs.push(`target: ${a.target} vs ${b.target}`);
    }
    if (a.target_version !== b.target_version) {
        diffs.push(`target_version: ${a.target_version} vs ${b.target_version}`);
    }
    return diffs;
}
/**
 * Compare two findings summaries (same audit, different runs).
 *
 * Returns the differences. If the list is empty, the audits are byte-identical.
 */
function compareFindingsSummaries(a, b) {
    const diffs = [];
    if (a.total !== b.total) {
        diffs.push(`total: ${a.total} vs ${b.total}`);
    }
    for (const sev of ['critical', 'high', 'medium', 'low', 'info', 'none']) {
        if (a.by_severity[sev] !== b.by_severity[sev]) {
            diffs.push(`by_severity.${sev}: ${a.by_severity[sev]} vs ${b.by_severity[sev]}`);
        }
    }
    if (a.avg_risk_score !== b.avg_risk_score) {
        diffs.push(`avg_risk_score: ${a.avg_risk_score} vs ${b.avg_risk_score}`);
    }
    if (a.avg_confidence_score !== b.avg_confidence_score) {
        diffs.push(`avg_confidence_score: ${a.avg_confidence_score} vs ${b.avg_confidence_score}`);
    }
    if (a.coverage.overall_coverage_pct !== b.coverage.overall_coverage_pct) {
        diffs.push(`overall_coverage_pct: ${a.coverage.overall_coverage_pct} vs ${b.coverage.overall_coverage_pct}`);
    }
    return diffs;
}
// ============================================================================
// Constants
// ============================================================================
exports.FINDINGS_SPEC_VERSION = '1.0.0';
exports.FINDINGS_HASH_ALGORITHM = 'SHA-256';
exports.COVERAGE_WEIGHTS = {
    static_analysis: 0.40,
    sandbox: 0.35,
    runtime_monitoring: 0.25,
};
