/**
 * MarketNow — L4→L3 Integration
 * ===============================
 *
 * Connects L4 (in-process runtime monitoring via eBPF) with L3
 * (continuous runtime monitoring via weekly GitHub Actions re-audit).
 *
 * Flow:
 *   1. L4 eBPF programs detect runtime events (network, fs, process, creds)
 *   2. L4 policy engine classifies events into alert levels
 *   3. This module feeds L4 alerts into the L3 drift detection system
 *   4. L3 records the alerts in the skill's drift report
 *   5. If critical: L3 triggers ATC revocation + quarantine
 *
 * Integration points:
 *   - L4 events → L3 drift report (adds "runtime_drift" type)
 *   - L4 CRITICAL → L3 auto-revoke ATC
 *   - L3 re-audit → L4 baseline update (new allowlists)
 */

import { diffToolCatalogs } from './tool-catalog-diff.mjs';

/**
 * L4 alert types that feed into L3 drift detection.
 */
export const L4_DRIFT_TYPES = {
  NETWORK_DRIFT: 'network_drift',         // new domain not in baseline
  FILESYSTEM_VIOLATION: 'fs_violation',   // write to sensitive path
  PROCESS_DRIFT: 'process_drift',          // unapproved process spawned
  CREDENTIAL_ACCESS: 'credential_access',  // credential file accessed
  TOOL_CATALOG_DRIFT: 'tool_catalog_drift',// tools changed post-cert
};

/**
 * L3 drift types (existing, from sentinel-l3.mjs).
 */
export const L3_DRIFT_TYPES = {
  TOOL_CATALOG: 'tool_catalog',
  SUPPLY_CHAIN: 'supply_chain',
  NETWORK: 'network',
  CONFIG: 'config',
  CREDENTIAL: 'credential',
  PROCESS: 'process',
  RUNTIME: 'runtime',  // NEW — fed by L4
};

/**
 * Feed L4 alerts into the L3 drift report.
 *
 * @param {Object} l3Report - the existing L3 drift report
 * @param {Array} l4Alerts - alerts from L4 policy engine
 * @returns {Object} updated L3 report with L4 data
 */
export function integrateL4IntoL3(l3Report, l4Alerts) {
  if (!l3Report) {
    l3Report = {
      skill_id: null,
      audit_date: new Date().toISOString(),
      drift_detected: false,
      drift_types: [],
      findings: [],
      recommendation: 'pass',
    };
  }

  if (!l4Alerts || l4Alerts.length === 0) {
    return l3Report; // No L4 alerts — nothing to integrate
  }

  // Map L4 alerts to L3 drift types
  const l4ToL3Map = {
    [L4_DRIFT_TYPES.NETWORK_DRIFT]: L3_DRIFT_TYPES.NETWORK,
    [L4_DRIFT_TYPES.FILESYSTEM_VIOLATION]: L3_DRIFT_TYPES.RUNTIME,
    [L4_DRIFT_TYPES.PROCESS_DRIFT]: L3_DRIFT_TYPES.PROCESS,
    [L4_DRIFT_TYPES.CREDENTIAL_ACCESS]: L3_DRIFT_TYPES.CREDENTIAL,
    [L4_DRIFT_TYPES.TOOL_CATALOG_DRIFT]: L3_DRIFT_TYPES.TOOL_CATALOG,
  };

  let hasCritical = false;
  let hasHigh = false;

  for (const alert of l4Alerts) {
    const l3Type = l4ToL3Map[alert.category] || L3_DRIFT_TYPES.RUNTIME;

    // Add to L3 findings
    l3Report.findings.push({
      source: 'L4',
      type: l3Type,
      severity: alert.level,
      category: alert.category,
      message: alert.message,
      timestamp: alert.timestamp || new Date().toISOString(),
      pid: alert.pid,
      details: alert.details || {},
    });

    // Track drift types
    if (!l3Report.drift_types.includes(l3Type)) {
      l3Report.drift_types.push(l3Type);
    }

    // Track severity
    if (alert.level === 'critical') hasCritical = true;
    else if (alert.level === 'high') hasHigh = true;
  }

  // Update drift status
  l3Report.drift_detected = l4Alerts.length > 0;

  // Update recommendation
  if (hasCritical) {
    l3Report.recommendation = 'revoke';
  } else if (hasHigh) {
    l3Report.recommendation = 'quarantine';
  } else if (l4Alerts.some(a => a.level === 'warn')) {
    l3Report.recommendation = 'flag';
  }

  return l3Report;
}

/**
 * Check if L4 alerts warrant ATC revocation.
 *
 * @param {Array} l4Alerts - alerts from L4 policy engine
 * @returns {Object} { should_revoke, reason, severity }
 */
export function shouldRevokeATCFromL4(l4Alerts) {
  const critical = l4Alerts.filter(a => a.level === 'critical');

  if (critical.length === 0) {
    return { should_revoke: false, reason: null, severity: 'none' };
  }

  // Categorize critical alerts
  const credentialAlerts = critical.filter(a => a.category === L4_DRIFT_TYPES.CREDENTIAL_ACCESS);
  const fsAlerts = critical.filter(a => a.category === L4_DRIFT_TYPES.FILESYSTEM_VIOLATION);
  const processAlerts = critical.filter(a => a.category === L4_DRIFT_TYPES.PROCESS_DRIFT);

  if (credentialAlerts.length > 0) {
    return {
      should_revoke: true,
      reason: 'credential_access_detected',
      severity: 'critical',
      message: `L4 detected ${credentialAlerts.length} credential access attempts — ATC revoked`,
      details: credentialAlerts.map(a => a.details),
    };
  }

  if (fsAlerts.length > 0) {
    return {
      should_revoke: true,
      reason: 'sensitive_file_write',
      severity: 'critical',
      message: `L4 detected ${fsAlerts.length} writes to sensitive paths — ATC revoked`,
      details: fsAlerts.map(a => a.details),
    };
  }

  if (processAlerts.length > 0) {
    return {
      should_revoke: true,
      reason: 'unapproved_process_spawn',
      severity: 'critical',
      message: `L4 detected ${processAlerts.length} unapproved process spawns — ATC revoked`,
      details: processAlerts.map(a => a.details),
    };
  }

  return {
    should_revoke: true,
    reason: 'critical_l4_alert',
    severity: 'critical',
    message: `L4 detected ${critical.length} critical alerts — ATC revoked`,
  };
}

/**
 * Update L4 baseline after L3 re-audit.
 * When L3 re-audits a skill, it captures a new baseline.
 * This new baseline should be pushed to L4's allowlist maps.
 *
 * @param {Object} l3Baseline - new baseline from L3 re-audit
 * @returns {Object} L4 baseline update (for eBPF map updates)
 */
export function updateL4Baseline(l3Baseline) {
  return {
    network_allowlist: l3Baseline.network_domains || [],
    process_allowlist: l3Baseline.processes || [],
    tool_catalog: l3Baseline.tools || [],
    config_hash: l3Baseline.config_hash || null,
    updated_at: new Date().toISOString(),
    source: 'L3_re_audit',
  };
}

/**
 * Run a complete L4→L3 integration cycle.
 *
 * This is called by the L3 weekly re-audit workflow:
 *   1. L3 re-audits the skill (new baseline)
 *   2. L4 alerts are collected (from the past week)
 *   3. This function integrates them
 *   4. If critical: revoke ATC + quarantine
 *   5. Update L4 baseline for next week
 *
 * @param {Object} params
 * @param {string} params.skill_id
 * @param {Object} params.l3_baseline - new baseline from re-audit
 * @param {Array} params.l4_alerts - alerts from past week
 * @param {Object} params.l3_report - existing L3 report
 * @returns {Object} { report, should_revoke, revoke_reason, new_baseline }
 */
export function runL4L3IntegrationCycle(params) {
  const { skill_id, l3_baseline, l4_alerts, l3_report } = params;

  // 1. Integrate L4 alerts into L3 report
  const report = integrateL4IntoL3(l3_report, l4_alerts);
  report.skill_id = skill_id;
  report.integration_date = new Date().toISOString();

  // 2. Check if ATC should be revoked
  const revokeDecision = shouldRevokeATCFromL4(l4_alerts);

  // 3. Build new L4 baseline from L3 re-audit
  const new_baseline = updateL4Baseline(l3_baseline);

  return {
    report,
    should_revoke: revokeDecision.should_revoke,
    revoke_reason: revokeDecision.should_revoke ? revokeDecision : null,
    new_baseline,
    summary: {
      skill_id,
      l4_alerts_count: l4_alerts.length,
      critical_count: l4_alerts.filter(a => a.level === 'critical').length,
      high_count: l4_alerts.filter(a => a.level === 'high').length,
      recommendation: report.recommendation,
      should_revoke: revokeDecision.should_revoke,
    },
  };
}
