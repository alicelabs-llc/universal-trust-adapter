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
import type { BaselineProfile, BehaviorObservation } from './behavioral-baseline.js';
export type DriftSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';
export type DriftAlgorithm = 'threshold' | 'kl_divergence' | 'z_score';
export interface DriftSignal {
    /** What metric drifted */
    metric: string;
    /** Algorithm that detected the drift */
    algorithm: DriftAlgorithm;
    /** Baseline value */
    baseline_value: number;
    /** Current value */
    current_value: number;
    /** How much it drifted (ratio: current/baseline) */
    drift_ratio: number;
    /** Z-score (how many stddevs from mean) */
    z_score?: number;
    /** Severity */
    severity: DriftSeverity;
    /** Human-readable description */
    description: string;
}
export interface DriftResult {
    /** Overall severity (max of all signals) */
    severity: DriftSeverity;
    /** All drift signals detected */
    signals: DriftSignal[];
    /** Should the trust score be degraded? */
    should_degrade_score: boolean;
    /** How much to degrade (e.g., 9 → 7 means degrade by 2) */
    score_degradation: number;
    /** Should the ATC be auto-revoked? */
    should_auto_revoke: boolean;
    /** Revocation reason (if auto-revoke) */
    revocation_reason?: string;
    /** Summary */
    summary: string;
    /** Comparison window */
    comparison_window: {
        baseline_start: string;
        baseline_end: string;
        current_start: string;
        current_end: string;
    };
    /** Algorithm version */
    drift_version: '1.0.0';
}
/**
 * Detect drift between baseline and current behavior.
 *
 * @param baseline           The stored baseline profile
 * @param baselineObservations  Original observations that produced the baseline
 * @param currentObservations   New observations from the current window
 * @param currentWindow         Current observation window parameters
 */
export declare function detectDrift(baseline: BaselineProfile, baselineObservations: BehaviorObservation[], currentObservations: BehaviorObservation[], currentWindow: {
    window_start: string;
    window_end: string;
}): DriftResult;
export declare const DRIFT_VERSION = "1.0.0";
export declare const DRIFT_THRESHOLDS: {
    duration_multiplier: number;
    response_size_multiplier: number;
    calls_per_hour_multiplier: number;
    hosts_per_call_multiplier: number;
    spawns_per_call_multiplier: number;
};
export declare const SEVERITY_SCORE_IMPACT: Record<DriftSeverity, number>;
