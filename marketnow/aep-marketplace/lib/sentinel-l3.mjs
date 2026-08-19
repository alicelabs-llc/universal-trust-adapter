/**
 * ⚠️ SENTINEL PROPRIETARY — Copyright (c) 2026 AliceLabs LLC. All Rights Reserved.
 *
 * MarketNow — Sentinel L3 Continuous Runtime Monitoring
 * =======================================================
 *
 * L1.5-L1.8 audit the skill at import time (static).
 * L2 runs the skill in a sandbox once (point-in-time baseline).
 * L3 re-runs the skill periodically and compares behavior against
 * the L2 baseline. If behavior drifts → alert + potential re-quarantine.
 *
 * This addresses the #1 feedback from the community:
 *   "Certification is point-in-time. Attacks are runtime."
 *   — @Correctover (CrewAI #6463)
 *   — @wrencalloway (dev.to)
 *   — @mads_hansen (dev.to)
 *   — @mayank609 (CrewAI #6463)
 *
 * Drift detection:
 *   1. TOOL CATALOG DRIFT — new tools appeared, or existing tools changed
 *      their inputSchema after certification. Strongest signal of post-audit update.
 *   2. SUPPLY CHAIN DRIFT — git commit SHA or npm version changed since certification.
 *   3. NETWORK DRIFT — skill contacts different domains than baseline.
 *   4. CONFIG DRIFT — declared permissions/allowed_paths changed.
 *   5. CREDENTIAL DRIFT — skill accesses env vars it didn't before.
 *   6. PROCESS DRIFT — skill spawns new processes not in baseline.
 *
 * L3 results stored in _data/l3_results/{skill_id}.json (publicly auditable).
 */

import crypto from 'crypto';

const DRIFT_SEVERITY = {
  TOOL_CATALOG_NEW_TOOLS: 'critical',
  TOOL_CATALOG_CHANGED_SCHEMA: 'critical',
  TOOL_CATALOG_REMOVED_TOOLS: 'medium',
  SUPPLY_CHAIN_GIT_SHA_CHANGED: 'critical',
  SUPPLY_CHAIN_NPM_VERSION_CHANGED: 'high',
  NETWORK_NEW_DOMAINS: 'high',
  NETWORK_NO_BASELINE: 'medium',
  CONFIG_PERMISSIONS_EXPANDED: 'critical',
  CONFIG_PERMISSIONS_NARROWED: 'low',
  CREDENTIAL_NEW_ENV_ACCESS: 'high',
  PROCESS_NEW_SPAWNS: 'high',
};

export function runL3(skill, l2Baseline, currentState = null) {
  const findings = {
    drift_items: [],
    total_critical: 0,
    total_high: 0,
    total_medium: 0,
    total_low: 0,
  };

  if (!l2Baseline) {
    return {
      findings,
      drift_detected: false,
      drift_severity: 'none',
      quarantine_recommended: false,
      details: {
        l3_status: 'no_l2_baseline',
        message: 'No L2 sandbox baseline exists. L3 cannot detect drift without a baseline. Run L2 first.',
      },
    };
  }

  // 1. SUPPLY CHAIN DRIFT
  const baselineSha = l2Baseline.git_commit_sha || l2Baseline.source_sha;
  const baselineNpmVersion = l2Baseline.npm_version;
  const currentSha = currentState?.git_commit_sha || skill.source?.commit_sha;
  const currentNpmVersion = currentState?.npm_version || skill.version;

  if (baselineSha && currentSha && baselineSha !== currentSha) {
    findings.drift_items.push({
      type: 'SUPPLY_CHAIN_GIT_SHA_CHANGED',
      severity: 'critical',
      detail: `Git commit changed from ${String(baselineSha).slice(0,10)} to ${String(currentSha).slice(0,10)}. Source code updated after Sentinel certification.`,
      baseline: baselineSha,
      current: currentSha,
    });
  }

  if (baselineNpmVersion && currentNpmVersion && baselineNpmVersion !== currentNpmVersion) {
    findings.drift_items.push({
      type: 'SUPPLY_CHAIN_NPM_VERSION_CHANGED',
      severity: 'high',
      detail: `npm version changed from ${baselineNpmVersion} to ${currentNpmVersion}.`,
      baseline: baselineNpmVersion,
      current: currentNpmVersion,
    });
  }

  // 2. TOOL CATALOG DRIFT
  const baselineTools = l2Baseline.tools || [];
  const currentTools = currentState?.tools || [];

  if (baselineTools.length > 0 && currentTools.length > 0) {
    const baselineToolMap = new Map();
    for (const t of baselineTools) {
      baselineToolMap.set(t.name, hashSchema(t.inputSchema));
    }
    const currentToolNames = new Set();
    for (const t of currentTools) {
      currentToolNames.add(t.name);
      const baselineHash = baselineToolMap.get(t.name);
      if (!baselineHash) {
        findings.drift_items.push({
          type: 'TOOL_CATALOG_NEW_TOOLS',
          severity: 'critical',
          detail: `New tool "${t.name}" appeared after certification. Tool catalog was modified post-audit.`,
          tool_name: t.name,
        });
      } else {
        const currentHash = hashSchema(t.inputSchema);
        if (baselineHash !== currentHash) {
          findings.drift_items.push({
            type: 'TOOL_CATALOG_CHANGED_SCHEMA',
            severity: 'critical',
            detail: `Tool "${t.name}" changed its inputSchema after certification. Possible injection or privilege escalation.`,
            tool_name: t.name,
            baseline_hash: baselineHash,
            current_hash: currentHash,
          });
        }
      }
    }
    for (const [name] of baselineToolMap) {
      if (!currentToolNames.has(name)) {
        findings.drift_items.push({
          type: 'TOOL_CATALOG_REMOVED_TOOLS',
          severity: 'medium',
          detail: `Tool "${name}" was removed after certification.`,
          tool_name: name,
        });
      }
    }
  }

  // 3. NETWORK DRIFT
  const baselineDomains = new Set((l2Baseline.network_attempts || []).map(n => n.domain).filter(Boolean));
  const currentDomains = new Set((currentState?.network_attempts || []).map(n => n.domain).filter(Boolean));
  for (const domain of currentDomains) {
    if (!baselineDomains.has(domain)) {
      findings.drift_items.push({
        type: 'NETWORK_NEW_DOMAINS',
        severity: 'high',
        detail: `Skill now contacts ${domain}, which was not in the baseline. Possible exfiltration or supply chain update.`,
        domain,
      });
    }
  }

  // 4. CONFIG / PERMISSIONS DRIFT
  const baselinePaths = new Set((l2Baseline.permissions?.filesystem?.allowed_paths) || []);
  const currentPaths = new Set((currentState?.permissions?.filesystem?.allowed_paths) || (skill.permissions?.filesystem?.allowed_paths) || []);
  for (const path of currentPaths) {
    if (!baselinePaths.has(path)) {
      findings.drift_items.push({
        type: 'CONFIG_PERMISSIONS_EXPANDED',
        severity: 'critical',
        detail: `Filesystem access expanded: new path "${path}" not in baseline permissions.`,
        path,
      });
    }
  }

  // 5. CREDENTIAL DRIFT
  const baselineEnvVars = new Set(l2Baseline.env_vars_accessed || []);
  const currentEnvVars = new Set(currentState?.env_vars_accessed || []);
  for (const envVar of currentEnvVars) {
    if (!baselineEnvVars.has(envVar)) {
      findings.drift_items.push({
        type: 'CREDENTIAL_NEW_ENV_ACCESS',
        severity: 'high',
        detail: `Skill now accesses env var "${envVar}" which was not in baseline. Possible credential theft.`,
        env_var: envVar,
      });
    }
  }

  // 6. PROCESS DRIFT
  const baselineProcesses = new Set((l2Baseline.process_spawns || []).map(p => p.command).filter(Boolean));
  const currentProcesses = new Set((currentState?.process_spawns || []).map(p => p.command).filter(Boolean));
  for (const proc of currentProcesses) {
    if (!baselineProcesses.has(proc)) {
      findings.drift_items.push({
        type: 'PROCESS_NEW_SPAWNS',
        severity: 'high',
        detail: `Skill now spawns process "${proc}" which was not in baseline.`,
        process: proc,
      });
    }
  }

  // Count severities
  for (const item of findings.drift_items) {
    if (item.severity === 'critical') findings.total_critical++;
    else if (item.severity === 'high') findings.total_high++;
    else if (item.severity === 'medium') findings.total_medium++;
    else findings.total_low++;
  }

  const driftDetected = findings.drift_items.length > 0;
  const driftSeverity = findings.total_critical > 0 ? 'critical'
    : findings.total_high > 0 ? 'high'
    : findings.total_medium > 0 ? 'medium'
    : findings.total_low > 0 ? 'low' : 'none';

  const quarantineRecommended = findings.total_critical > 0 ||
    findings.total_high >= 2 ||
    findings.drift_items.some(d => d.type === 'SUPPLY_CHAIN_GIT_SHA_CHANGED');

  return {
    findings,
    drift_detected: driftDetected,
    drift_severity: driftSeverity,
    quarantine_recommended: quarantineRecommended,
    details: {
      l3_status: driftDetected ? 'drift_detected' : 'stable',
      baseline_captured_at: l2Baseline.timestamp || l2Baseline.captured_at,
      checked_at: new Date().toISOString(),
      drift_items_count: findings.drift_items.length,
      message: driftDetected
        ? `L3 detected ${findings.drift_items.length} drift item(s): ${findings.total_critical} critical, ${findings.total_high} high, ${findings.total_medium} medium, ${findings.total_low} low.`
        : 'No drift detected. Skill behavior matches L2 baseline.',
    },
  };
}

function hashSchema(schema) {
  if (!schema) return 'null';
  try {
    const canonical = JSON.stringify(schema, Object.keys(schema).sort());
    return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
  } catch {
    return 'null';
  }
}

export function generateFingerprint(l2Result) {
  return {
    timestamp: new Date().toISOString(),
    git_commit_sha: l2Result.git_commit_sha || null,
    npm_version: l2Result.npm_version || null,
    tools: (l2Result.tools || []).map(t => ({ name: t.name, schema_hash: hashSchema(t.inputSchema) })),
    network_domains: (l2Result.network_attempts || []).map(n => n.domain).filter(Boolean),
    env_vars_accessed: l2Result.env_vars_accessed || [],
    process_spawns: (l2Result.process_spawns || []).map(p => p.command).filter(Boolean),
    permissions: l2Result.permissions || {},
    execution_status: l2Result.execution_status,
    l2_score: l2Result.l2_score,
  };
}

export { DRIFT_SEVERITY };
