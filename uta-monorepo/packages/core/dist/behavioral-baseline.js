"use strict";
/**
 * @marketnow/trust-core
 * Behavioral Baseline — v5.2.1
 *
 * Records runtime behavior of an MCP server over a time window,
 * stores it as a baseline profile, and enables drift detection
 * (v5.2.2 — drift-detection.ts will compare current vs baseline).
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MINIMUM_OBSERVATIONS_FOR_BASELINE = exports.DEFAULT_OBSERVATION_WINDOW_HOURS = exports.BASELINE_VERSION = void 0;
exports.computeBaseline = computeBaseline;
exports.storeBaseline = storeBaseline;
exports.getBaseline = getBaseline;
exports.listBaselines = listBaselines;
exports.deleteBaseline = deleteBaseline;
exports.hasEnoughObservations = hasEnoughObservations;
exports.hashBaseline = hashBaseline;
const node_crypto_1 = require("node:crypto");
// ============================================================================
// Statistics helpers
// ============================================================================
function computeSummary(values) {
    if (values.length === 0) {
        return {
            count: 0,
            min: 0,
            max: 0,
            mean: 0,
            median: 0,
            stddev: 0,
            p95: 0,
            p99: 0,
        };
    }
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stddev = Math.sqrt(variance);
    const percentile = (p) => {
        const idx = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
    };
    const medianIdx = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0
        ? (sorted[medianIdx - 1] + sorted[medianIdx]) / 2
        : sorted[medianIdx];
    return {
        count: values.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        mean: Math.round(mean * 1000) / 1000,
        median,
        stddev: Math.round(stddev * 1000) / 1000,
        p95: percentile(95),
        p99: percentile(99),
    };
}
// ============================================================================
// Baseline computation
// ============================================================================
/**
 * Compute a baseline profile from a set of observations.
 *
 * @param observations  Array of behavior observations from the observation window
 * @param serverId      MCP server identifier
 * @param serverVersion Server version
 * @param toolFingerprintHash  Hash from v5.1.1 Tool Fingerprinting
 * @param windowStart   Observation window start
 * @param windowEnd     Observation window end
 */
function computeBaseline(observations, params) {
    const { server_id, server_version, tool_fingerprint_hash, window_start, window_end } = params;
    // Extract metric arrays
    const durations = observations.map(o => o.duration_ms);
    const responseSizes = observations.map(o => o.response_size_bytes);
    // Unique tools
    const uniqueTools = [...new Set(observations.map(o => o.tool_name))];
    // Calls per tool
    const callsPerTool = {};
    for (const o of observations) {
        callsPerTool[o.tool_name] = (callsPerTool[o.tool_name] || 0) + 1;
    }
    // Calls per hour
    const windowStartMs = new Date(window_start).getTime();
    const windowEndMs = new Date(window_end).getTime();
    const windowHours = Math.max(1, (windowEndMs - windowStartMs) / (1000 * 60 * 60));
    const callsPerHour = observations.length / windowHours;
    // Network baseline
    const allHosts = observations.flatMap(o => o.network_hosts);
    const uniqueHosts = [...new Set(allHosts)];
    const hostsPerCall = allHosts.length / Math.max(1, observations.length);
    const totalBytes = observations.reduce((sum, o) => sum + o.response_size_bytes, 0);
    const dnsQueries = [...new Set(observations
            .flatMap(o => o.network_hosts)
            .filter(h => !h.match(/^\d+\.\d+\.\d+\.\d+$/)) // non-IP = DNS query
        )];
    // Filesystem baseline
    const allPaths = observations.flatMap(o => o.files_accessed.map(f => f.path));
    const uniquePaths = [...new Set(allPaths)];
    const reads = observations.flatMap(o => o.files_accessed.filter(f => f.mode === 'read')).length;
    const writes = observations.flatMap(o => o.files_accessed.filter(f => f.mode === 'write')).length;
    const readWriteRatio = writes > 0 ? reads / writes : reads;
    const pathsPerCall = allPaths.length / Math.max(1, observations.length);
    // Process baseline
    const allProcesses = observations.flatMap(o => o.processes_spawned);
    const uniqueProcesses = [...new Set(allProcesses)];
    const spawnsPerCall = allProcesses.length / Math.max(1, observations.length);
    // Anomaly detection during baseline
    const anomalyFlags = [];
    // Flag: any env vars read
    const envVarsRead = [...new Set(observations.flatMap(o => o.env_vars_read))];
    if (envVarsRead.length > 0) {
        if (envVarsRead.some(v => v.match(/SECRET|KEY|TOKEN|PASSWORD|CREDENTIAL/i))) {
            anomalyFlags.push(`sensitive_env_var_read: ${envVarsRead.filter(v => v.match(/SECRET|KEY|TOKEN|PASSWORD|CREDENTIAL/i)).join(', ')}`);
        }
    }
    // Flag: cloud metadata endpoint
    if (uniqueHosts.some(h => h.includes('169.254.169.254') || h.includes('metadata.google.internal'))) {
        anomalyFlags.push('cloud_metadata_endpoint_accessed');
    }
    // Flag: credential file paths
    const credentialPaths = uniquePaths.filter(p => p.match(/\.env|\.aws\/credentials|\.ssh\/|\.npmrc|\.git-credentials/i));
    if (credentialPaths.length > 0) {
        anomalyFlags.push(`credential_file_accessed: ${credentialPaths.join(', ')}`);
    }
    // Flag: long-running calls (duration > 5x p99)
    const durationSummary = computeSummary(durations);
    const longCalls = durations.filter(d => d > durationSummary.p99 * 5);
    if (longCalls.length > 0) {
        anomalyFlags.push(`anomalously_long_calls: ${longCalls.length} calls > 5x p99 (${durationSummary.p99}ms)`);
    }
    // Flag: blocked calls during baseline
    const blockedCalls = observations.filter(o => !o.allowed);
    if (blockedCalls.length > 0) {
        anomalyFlags.push(`blocked_calls_during_baseline: ${blockedCalls.length} calls blocked by ${[...new Set(blockedCalls.map(c => c.blocked_by))].join(', ')}`);
    }
    return {
        server_id,
        server_version,
        tool_fingerprint_hash,
        window_start,
        window_end,
        total_observations: observations.length,
        unique_tools: uniqueTools,
        calls_per_hour: Math.round(callsPerHour * 100) / 100,
        metrics: {
            duration_ms: durationSummary,
            response_size_bytes: computeSummary(responseSizes),
            calls_per_tool: callsPerTool,
        },
        network_baseline: {
            unique_hosts: uniqueHosts,
            hosts_per_call: Math.round(hostsPerCall * 1000) / 1000,
            total_bytes_transferred: totalBytes,
            dns_queries: dnsQueries,
        },
        filesystem_baseline: {
            unique_paths: uniquePaths,
            read_write_ratio: Math.round(readWriteRatio * 100) / 100,
            paths_per_call: Math.round(pathsPerCall * 1000) / 1000,
        },
        process_baseline: {
            unique_processes: uniqueProcesses,
            spawns_per_call: Math.round(spawnsPerCall * 1000) / 1000,
        },
        anomaly_flags: anomalyFlags,
        computed_at: new Date().toISOString(),
        baseline_version: '1.0.0',
    };
}
// ============================================================================
// Baseline storage (in-memory — production should use Redis/Supabase)
// ============================================================================
const baselineStore = new Map();
/**
 * Store a baseline profile.
 * Key: `${server_id}:${server_version}`
 */
function storeBaseline(profile) {
    const key = `${profile.server_id}:${profile.server_version}`;
    baselineStore.set(key, profile);
}
/**
 * Retrieve a baseline profile.
 */
function getBaseline(serverId, serverVersion) {
    return baselineStore.get(`${serverId}:${serverVersion}`);
}
/**
 * List all stored baselines.
 */
function listBaselines() {
    return Array.from(baselineStore.entries()).map(([key, profile]) => ({ key, profile }));
}
/**
 * Delete a baseline.
 */
function deleteBaseline(serverId, serverVersion) {
    return baselineStore.delete(`${serverId}:${serverVersion}`);
}
// ============================================================================
// Constants
// ============================================================================
exports.BASELINE_VERSION = '1.0.0';
exports.DEFAULT_OBSERVATION_WINDOW_HOURS = 168; // 7 days
exports.MINIMUM_OBSERVATIONS_FOR_BASELINE = 50; // need at least 50 calls
/**
 * Check if enough observations exist to compute a baseline.
 */
function hasEnoughObservations(observations) {
    return observations.length >= exports.MINIMUM_OBSERVATIONS_FOR_BASELINE;
}
/**
 * Compute a hash of the baseline profile (for tamper-evidence).
 */
function hashBaseline(profile) {
    const canonical = JSON.stringify({
        server_id: profile.server_id,
        server_version: profile.server_version,
        tool_fingerprint_hash: profile.tool_fingerprint_hash,
        window_start: profile.window_start,
        window_end: profile.window_end,
        total_observations: profile.total_observations,
        unique_tools: profile.unique_tools,
        calls_per_hour: profile.calls_per_hour,
    });
    return (0, node_crypto_1.createHash)('sha256').update(canonical).digest('hex');
}
