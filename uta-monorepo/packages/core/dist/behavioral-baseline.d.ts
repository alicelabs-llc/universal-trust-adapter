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
/**
 * A single observation of MCP server behavior during a sandbox run.
 * One of these is recorded per tool call during the observation window.
 */
export interface BehaviorObservation {
    /** Timestamp of the observation (ISO 8601 UTC) */
    timestamp: string;
    /** Tool that was called */
    tool_name: string;
    /** Call duration in milliseconds */
    duration_ms: number;
    /** Exit code (0 = success, non-zero = error) */
    exit_code: number;
    /** Network hosts contacted (empty array if none) */
    network_hosts: string[];
    /** Files accessed (paths, with mode: read/write) */
    files_accessed: Array<{
        path: string;
        mode: 'read' | 'write' | 'delete';
    }>;
    /** Processes spawned (empty array if none) */
    processes_spawned: string[];
    /** Environment variables read (names only, not values — privacy) */
    env_vars_read: string[];
    /** Response size in bytes */
    response_size_bytes: number;
    /** Whether the call was allowed by the interceptor */
    allowed: boolean;
    /** If blocked, which rule triggered */
    blocked_by?: string;
}
/**
 * Statistical summary of a single metric over the observation window.
 */
export interface MetricSummary {
    /** Number of observations */
    count: number;
    /** Minimum value */
    min: number;
    /** Maximum value */
    max: number;
    /** Mean (average) */
    mean: number;
    /** Median (50th percentile) */
    median: number;
    /** Standard deviation */
    stddev: number;
    /** 95th percentile */
    p95: number;
    /** 99th percentile */
    p99: number;
}
/**
 * A baseline profile for an MCP server version.
 * Computed from all observations in the observation window.
 */
export interface BaselineProfile {
    /** MCP server identifier (URL or npm package name) */
    server_id: string;
    /** Server version (commit SHA or npm version) */
    server_version: string;
    /** Tool fingerprint hash (from v5.1.1 — links baseline to fingerprint) */
    tool_fingerprint_hash: string;
    /** Observation window start (ISO 8601 UTC) */
    window_start: string;
    /** Observation window end (ISO 8601 UTC) */
    window_end: string;
    /** Total observations in the window */
    total_observations: number;
    /** Unique tools called */
    unique_tools: string[];
    /** Call frequency (calls per hour) */
    calls_per_hour: number;
    /** Per-metric summaries */
    metrics: {
        duration_ms: MetricSummary;
        response_size_bytes: MetricSummary;
        calls_per_tool: Record<string, number>;
    };
    /** Network behavior baseline */
    network_baseline: {
        /** All unique hosts contacted during observation */
        unique_hosts: string[];
        /** Hosts contacted per call (average) */
        hosts_per_call: number;
        /** Total bytes transferred (estimated) */
        total_bytes_transferred: number;
        /** DNS queries made */
        dns_queries: string[];
    };
    /** Filesystem behavior baseline */
    filesystem_baseline: {
        /** Unique paths accessed */
        unique_paths: string[];
        /** Read/write ratio */
        read_write_ratio: number;
        /** Paths accessed per call (average) */
        paths_per_call: number;
    };
    /** Process behavior baseline */
    process_baseline: {
        /** Unique processes spawned */
        unique_processes: string[];
        /** Process spawns per call (average) */
        spawns_per_call: number;
    };
    /** Anomaly flags detected during baseline (things that were unusual but not blocked) */
    anomaly_flags: string[];
    /** Baseline computed at */
    computed_at: string;
    /** Baseline algorithm version */
    baseline_version: '1.0.0';
}
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
export declare function computeBaseline(observations: BehaviorObservation[], params: {
    server_id: string;
    server_version: string;
    tool_fingerprint_hash: string;
    window_start: string;
    window_end: string;
}): BaselineProfile;
/**
 * Store a baseline profile.
 * Key: `${server_id}:${server_version}`
 */
export declare function storeBaseline(profile: BaselineProfile): void;
/**
 * Retrieve a baseline profile.
 */
export declare function getBaseline(serverId: string, serverVersion: string): BaselineProfile | undefined;
/**
 * List all stored baselines.
 */
export declare function listBaselines(): Array<{
    key: string;
    profile: BaselineProfile;
}>;
/**
 * Delete a baseline.
 */
export declare function deleteBaseline(serverId: string, serverVersion: string): boolean;
export declare const BASELINE_VERSION = "1.0.0";
export declare const DEFAULT_OBSERVATION_WINDOW_HOURS = 168;
export declare const MINIMUM_OBSERVATIONS_FOR_BASELINE = 50;
/**
 * Check if enough observations exist to compute a baseline.
 */
export declare function hasEnoughObservations(observations: BehaviorObservation[]): boolean;
/**
 * Compute a hash of the baseline profile (for tamper-evidence).
 */
export declare function hashBaseline(profile: BaselineProfile): string;
