"use strict";
/**
 * @marketnow/trust-core
 * Drift Detection — v5.2.2
 *
 * Compares current runtime behavior against a stored baseline profile.
 * Detects statistical drift using multiple algorithms:
 * 1. Threshold-based (simple: current > N × baseline.max)
 * 2. KL-divergence (statistical: distribution shift)
 * 3. Z-score (how many stddevs from baseline mean)
 *
 * On drift detected: auto-degrade trust score, auto-revoke on critical.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEVERITY_SCORE_IMPACT = exports.DRIFT_THRESHOLDS = exports.DRIFT_VERSION = void 0;
exports.detectDrift = detectDrift;
const behavioral_baseline_js_1 = require("./behavioral-baseline.js");
// ============================================================================
// Threshold-based drift detection
// ============================================================================
const THRESHOLDS = {
    // If current.max > N × baseline.max, it's drift
    duration_multiplier: 3, // 3x baseline max duration
    response_size_multiplier: 5, // 5x baseline max response size
    calls_per_hour_multiplier: 4, // 4x baseline calls/hour
    hosts_per_call_multiplier: 2, // 2x baseline hosts/call (new hosts)
    spawns_per_call_multiplier: 3, // 3x baseline spawns/call
};
/**
 * Detect drift using threshold rules.
 * Simple: if any current metric exceeds N × baseline max, flag it.
 */
function detectThresholdDrift(baseline, current) {
    const signals = [];
    // Duration
    if (current.metrics.duration_ms.max > baseline.metrics.duration_ms.max * THRESHOLDS.duration_multiplier) {
        signals.push({
            metric: 'duration_ms.max',
            algorithm: 'threshold',
            baseline_value: baseline.metrics.duration_ms.max,
            current_value: current.metrics.duration_ms.max,
            drift_ratio: current.metrics.duration_ms.max / baseline.metrics.duration_ms.max,
            severity: 'high',
            description: `Max call duration ${current.metrics.duration_ms.max}ms is ${Math.round(current.metrics.duration_ms.max / baseline.metrics.duration_ms.max * 10) / 10}x baseline (${baseline.metrics.duration_ms.max}ms)`,
        });
    }
    // Response size
    if (current.metrics.response_size_bytes.max > baseline.metrics.response_size_bytes.max * THRESHOLDS.response_size_multiplier) {
        signals.push({
            metric: 'response_size_bytes.max',
            algorithm: 'threshold',
            baseline_value: baseline.metrics.response_size_bytes.max,
            current_value: current.metrics.response_size_bytes.max,
            drift_ratio: current.metrics.response_size_bytes.max / baseline.metrics.response_size_bytes.max,
            severity: 'medium',
            description: `Max response size ${current.metrics.response_size_bytes.max}B is ${Math.round(current.metrics.response_size_bytes.max / baseline.metrics.response_size_bytes.max * 10) / 10}x baseline`,
        });
    }
    // Calls per hour
    if (current.calls_per_hour > baseline.calls_per_hour * THRESHOLDS.calls_per_hour_multiplier) {
        signals.push({
            metric: 'calls_per_hour',
            algorithm: 'threshold',
            baseline_value: baseline.calls_per_hour,
            current_value: current.calls_per_hour,
            drift_ratio: current.calls_per_hour / baseline.calls_per_hour,
            severity: 'medium',
            description: `Call frequency ${current.calls_per_hour}/hr is ${Math.round(current.calls_per_hour / baseline.calls_per_hour * 10) / 10}x baseline`,
        });
    }
    // New hosts contacted
    const newHosts = current.network_baseline.unique_hosts.filter(h => !baseline.network_baseline.unique_hosts.includes(h));
    if (newHosts.length > 0) {
        signals.push({
            metric: 'network.new_hosts',
            algorithm: 'threshold',
            baseline_value: baseline.network_baseline.unique_hosts.length,
            current_value: current.network_baseline.unique_hosts.length,
            drift_ratio: newHosts.length,
            severity: newHosts.length > 3 ? 'critical' : 'high',
            description: `New network hosts contacted: ${newHosts.join(', ')}`,
        });
    }
    // New processes spawned
    const newProcesses = current.process_baseline.unique_processes.filter(p => !baseline.process_baseline.unique_processes.includes(p));
    if (newProcesses.length > 0) {
        signals.push({
            metric: 'process.new_spawns',
            algorithm: 'threshold',
            baseline_value: baseline.process_baseline.unique_processes.length,
            current_value: current.process_baseline.unique_processes.length,
            drift_ratio: newProcesses.length,
            severity: 'high',
            description: `New processes spawned: ${newProcesses.join(', ')}`,
        });
    }
    // New file paths accessed
    const newPaths = current.filesystem_baseline.unique_paths.filter(p => !baseline.filesystem_baseline.unique_paths.includes(p));
    // Check for credential paths
    const newCredentialPaths = newPaths.filter(p => p.match(/\.env|\.aws\/credentials|\.ssh\/|\.npmrc|\.git-credentials/i));
    if (newCredentialPaths.length > 0) {
        signals.push({
            metric: 'filesystem.credential_paths',
            algorithm: 'threshold',
            baseline_value: 0,
            current_value: newCredentialPaths.length,
            drift_ratio: Infinity,
            severity: 'critical',
            description: `Credential file access detected: ${newCredentialPaths.join(', ')}`,
        });
    }
    // Cloud metadata endpoint
    if (current.network_baseline.unique_hosts.some(h => h.includes('169.254.169.254') || h.includes('metadata.google.internal'))) {
        signals.push({
            metric: 'network.cloud_metadata',
            algorithm: 'threshold',
            baseline_value: 0,
            current_value: 1,
            drift_ratio: Infinity,
            severity: 'critical',
            description: 'Cloud metadata endpoint accessed (169.254.169.254 or metadata.google.internal)',
        });
    }
    return signals;
}
// ============================================================================
// Z-score drift detection
// ============================================================================
/**
 * Compute z-score for a value against a baseline summary.
 * z = (value - mean) / stddev
 */
function zScore(value, summary) {
    if (summary.stddev === 0)
        return 0;
    return (value - summary.mean) / summary.stddev;
}
/**
 * Detect drift using z-scores.
 * If any metric is > 3 stddevs from baseline mean, flag it.
 */
function detectZScoreDrift(baseline, current) {
    const signals = [];
    // Duration mean
    const durationZ = zScore(current.metrics.duration_ms.mean, baseline.metrics.duration_ms);
    if (Math.abs(durationZ) > 3) {
        signals.push({
            metric: 'duration_ms.mean',
            algorithm: 'z_score',
            baseline_value: baseline.metrics.duration_ms.mean,
            current_value: current.metrics.duration_ms.mean,
            drift_ratio: current.metrics.duration_ms.mean / baseline.metrics.duration_ms.mean,
            z_score: Math.round(durationZ * 100) / 100,
            severity: Math.abs(durationZ) > 5 ? 'high' : 'medium',
            description: `Mean duration z-score=${Math.round(durationZ * 100) / 100} (${Math.abs(durationZ)} stddevs from baseline)`,
        });
    }
    // Response size mean
    const responseZ = zScore(current.metrics.response_size_bytes.mean, baseline.metrics.response_size_bytes);
    if (Math.abs(responseZ) > 3) {
        signals.push({
            metric: 'response_size_bytes.mean',
            algorithm: 'z_score',
            baseline_value: baseline.metrics.response_size_bytes.mean,
            current_value: current.metrics.response_size_bytes.mean,
            drift_ratio: current.metrics.response_size_bytes.mean / baseline.metrics.response_size_bytes.mean,
            z_score: Math.round(responseZ * 100) / 100,
            severity: Math.abs(responseZ) > 5 ? 'high' : 'medium',
            description: `Mean response size z-score=${Math.round(responseZ * 100) / 100}`,
        });
    }
    return signals;
}
// ============================================================================
// KL-divergence drift detection
// ============================================================================
/**
 * Compute KL-divergence between two distributions.
 * KL(P || Q) = Σ P(i) × log(P(i) / Q(i))
 *
 * Used to detect distribution shifts in call patterns.
 */
function klDivergence(p, q) {
    if (p.length !== q.length || p.length === 0)
        return 0;
    // Add small epsilon to avoid log(0)
    const epsilon = 1e-10;
    let kl = 0;
    for (let i = 0; i < p.length; i++) {
        const pi = p[i] + epsilon;
        const qi = q[i] + epsilon;
        kl += pi * Math.log(pi / qi);
    }
    return kl;
}
/**
 * Build a call distribution from observations.
 * Returns array of probabilities for each tool.
 */
function callDistribution(observations, tools) {
    const totalCalls = observations.length;
    if (totalCalls === 0)
        return tools.map(() => 0);
    return tools.map(t => observations.filter(o => o.tool_name === t).length / totalCalls);
}
/**
 * Detect drift using KL-divergence on call distribution.
 */
function detectKLDivergenceDrift(baseline, baselineObservations, currentObservations) {
    const signals = [];
    // All tools (union of baseline and current)
    const allTools = [...new Set([
            ...baseline.unique_tools,
            ...currentObservations.map(o => o.tool_name)
        ])].sort();
    const baselineDist = callDistribution(baselineObservations, allTools);
    const currentDist = callDistribution(currentObservations, allTools);
    const kl = klDivergence(currentDist, baselineDist);
    // KL > 0.5 is significant drift
    if (kl > 0.5) {
        signals.push({
            metric: 'call_distribution',
            algorithm: 'kl_divergence',
            baseline_value: 0,
            current_value: Math.round(kl * 1000) / 1000,
            drift_ratio: kl,
            severity: kl > 2 ? 'high' : 'medium',
            description: `KL-divergence=${Math.round(kl * 1000) / 1000} — call pattern distribution has shifted significantly`,
        });
    }
    return signals;
}
// ============================================================================
// Main drift detection function
// ============================================================================
/**
 * Detect drift between baseline and current behavior.
 *
 * @param baseline           The stored baseline profile
 * @param baselineObservations  Original observations that produced the baseline
 * @param currentObservations   New observations from the current window
 * @param currentWindow         Current observation window parameters
 */
function detectDrift(baseline, baselineObservations, currentObservations, currentWindow) {
    // Compute current baseline from current observations
    const currentBaseline = (0, behavioral_baseline_js_1.computeBaseline)(currentObservations, {
        server_id: baseline.server_id,
        server_version: baseline.server_version,
        tool_fingerprint_hash: baseline.tool_fingerprint_hash,
        window_start: currentWindow.window_start,
        window_end: currentWindow.window_end,
    });
    // Run all drift detection algorithms
    const thresholdSignals = detectThresholdDrift(baseline, currentBaseline);
    const zScoreSignals = detectZScoreDrift(baseline, currentBaseline);
    const klSignals = detectKLDivergenceDrift(baseline, baselineObservations, currentObservations);
    const allSignals = [...thresholdSignals, ...zScoreSignals, ...klSignals];
    // Determine overall severity (max of all signals)
    const severityOrder = ['none', 'low', 'medium', 'high', 'critical'];
    let maxSeverity = 'none';
    for (const signal of allSignals) {
        if (severityOrder.indexOf(signal.severity) > severityOrder.indexOf(maxSeverity)) {
            maxSeverity = signal.severity;
        }
    }
    // Score degradation
    let scoreDegradation = 0;
    if (maxSeverity === 'low')
        scoreDegradation = 1;
    else if (maxSeverity === 'medium')
        scoreDegradation = 2;
    else if (maxSeverity === 'high')
        scoreDegradation = 3;
    else if (maxSeverity === 'critical')
        scoreDegradation = 5;
    // Auto-revoke on critical
    const shouldAutoRevoke = maxSeverity === 'critical';
    const shouldDegradeScore = maxSeverity !== 'none';
    // Revocation reason
    let revocationReason;
    if (shouldAutoRevoke) {
        const criticalSignals = allSignals.filter(s => s.severity === 'critical');
        revocationReason = criticalSignals.map(s => s.description).join('; ');
    }
    // Summary
    const summary = allSignals.length === 0
        ? 'No drift detected — current behavior matches baseline'
        : `${allSignals.length} drift signal(s) detected (severity: ${maxSeverity}): ${allSignals.map(s => s.metric).join(', ')}`;
    return {
        severity: maxSeverity,
        signals: allSignals,
        should_degrade_score: shouldDegradeScore,
        score_degradation: scoreDegradation,
        should_auto_revoke: shouldAutoRevoke,
        revocation_reason: revocationReason,
        summary,
        comparison_window: {
            baseline_start: baseline.window_start,
            baseline_end: baseline.window_end,
            current_start: currentWindow.window_start,
            current_end: currentWindow.window_end,
        },
        drift_version: '1.0.0',
    };
}
// ============================================================================
// Constants
// ============================================================================
exports.DRIFT_VERSION = '1.0.0';
exports.DRIFT_THRESHOLDS = THRESHOLDS;
exports.SEVERITY_SCORE_IMPACT = {
    none: 0,
    low: -1,
    medium: -2,
    high: -3,
    critical: -5,
};
