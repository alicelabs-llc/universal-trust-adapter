#!/usr/bin/env node
/**
 * MarketNow — L3 Continuous Runtime Monitor (Batch)
 * ===================================================
 *
 * Runs weekly via GitHub Actions. For each skill with an L2 baseline:
 *   1. Fetches the L2 baseline from _data/l2_results/{skill_id}.json
 *   2. Fetches the skill's current state from the catalog
 *   3. Runs L3 drift detection (tool catalog, supply chain, network, config, credential, process)
 *   4. Saves results to _data/l3_results/{skill_id}.json
 *   5. If drift detected + quarantine recommended → moves cert to _data/quarantine/
 *
 * Usage:
 *   node scripts/l3-continuous-monitor.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runL3, generateFingerprint } from '../aep-marketplace/lib/sentinel-l3.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.join(__dirname, '..');

const L2_DIR = path.join(REPO_ROOT, '_data', 'l2_results');
const L3_DIR = path.join(REPO_ROOT, '_data', 'l3_results');
const SKILLS_PATH = path.join(REPO_ROOT, 'aep-marketplace', 'public', 'api', 'skills_index.json');
const CERTS_DIR = path.join(REPO_ROOT, '_data', 'sentinel_certificates');
const QUARANTINE_DIR = path.join(REPO_ROOT, '_data', 'quarantine');

// Ensure dirs exist
fs.mkdirSync(L3_DIR, { recursive: true });
fs.mkdirSync(QUARANTINE_DIR, { recursive: true });

// Load skills
const skills = JSON.parse(fs.readFileSync(SKILLS_PATH, 'utf8'));
const skillMap = new Map(skills.map(s => [s.id, s]));

// Load L2 results
const l2Files = fs.existsSync(L2_DIR)
  ? fs.readdirSync(L2_DIR).filter(f => f.endsWith('.json'))
  : [];

console.log(`\nMarketNow — L3 Continuous Runtime Monitor`);
console.log(`==========================================`);
console.log(`Skills in catalog: ${skills.length}`);
console.log(`L2 baselines available: ${l2Files.length}`);
console.log();

if (l2Files.length === 0) {
  console.log('No L2 baselines found. L3 requires L2 results to compare against.');
  console.log('Run sentinel-l2-sandbox workflow first.');
  process.exit(0);
}

const stats = {
  total: 0,
  stable: 0,
  drift_detected: 0,
  quarantined: 0,
  no_baseline: 0,
  errors: 0,
};

const driftSummary = [];

for (const l2File of l2Files) {
  const skillId = l2File.replace('.json', '');
  const skill = skillMap.get(skillId);

  if (!skill) {
    console.log(`  SKIP ${skillId} — not in catalog`);
    continue;
  }

  stats.total++;

  try {
    // Load L2 baseline
    const l2Baseline = JSON.parse(fs.readFileSync(path.join(L2_DIR, l2File), 'utf8'));

    // Run L3
    // In production, this would re-run the sandbox. For now, we compare
    // the L2 baseline against the current skill metadata (supply chain drift,
    // config drift). Full runtime re-audit requires the Docker sandbox.
    const currentState = {
      git_commit_sha: skill.source?.commit_sha,
      npm_version: skill.version,
      tools: skill.capabilities?.tools,
      permissions: skill.permissions,
    };

    const l3Result = runL3(skill, l2Baseline, currentState);

    // Save L3 result
    const l3Record = {
      skill_id: skillId,
      skill_name: skill.name,
      checked_at: new Date().toISOString(),
      l3_status: l3Result.details.l3_status,
      drift_detected: l3Result.drift_detected,
      drift_severity: l3Result.drift_severity,
      quarantine_recommended: l3Result.quarantine_recommended,
      drift_items: l3Result.findings.drift_items,
      baseline_captured_at: l3Result.details.baseline_captured_at,
      message: l3Result.details.message,
    };

    fs.writeFileSync(
      path.join(L3_DIR, `${skillId}.json`),
      JSON.stringify(l3Record, null, 2)
    );

    if (l3Result.drift_detected) {
      stats.drift_detected++;
      driftSummary.push({
        skill_id: skillId,
        skill_name: skill.name,
        drift_severity: l3Result.drift_severity,
        drift_items: l3Result.findings.drift_items.length,
        quarantine: l3Result.quarantine_recommended,
      });

      console.log(`  ⚠ DRIFT ${skillId} (${skill.name}) — ${l3Result.drift_severity}: ${l3Result.findings.drift_items.length} item(s)`);

      // Quarantine if recommended
      if (l3Result.quarantine_recommended) {
        stats.quarantined++;
        const certPath = path.join(CERTS_DIR, `${skillId}.json`);
        if (fs.existsSync(certPath)) {
          const cert = JSON.parse(fs.readFileSync(certPath, 'utf8'));
          cert.status = 'quarantined';
          cert.quarantined_at = new Date().toISOString();
          cert.quarantined_reason = `L3 drift detected: ${l3Result.drift_severity}`;
          cert.quarantined_findings = { l3: l3Record };
          cert.overall_score = 0;
          cert.risk_level = 'critical';
          fs.writeFileSync(path.join(QUARANTINE_DIR, `${skillId}.json`), JSON.stringify(cert, null, 2));
          fs.unlinkSync(certPath);
          console.log(`    → QUARANTINED (moved to _data/quarantine/)`);
        }
      }
    } else if (l3Result.details.l3_status === 'no_l2_baseline') {
      stats.no_baseline++;
    } else {
      stats.stable++;
      console.log(`  ✓ STABLE ${skillId} (${skill.name})`);
    }
  } catch (e) {
    stats.errors++;
    console.log(`  ✗ ERROR ${skillId}: ${e.message}`);
  }
}

// Summary
console.log(`\n${'='.repeat(60)}`);
console.log(`L3 CONTINUOUS MONITOR COMPLETE`);
console.log(`${'='.repeat(60)}`);
console.log(`Total checked:    ${stats.total}`);
console.log(`Stable:           ${stats.stable}`);
console.log(`Drift detected:   ${stats.drift_detected}`);
console.log(`Quarantined:      ${stats.quarantined}`);
console.log(`No baseline:      ${stats.no_baseline}`);
console.log(`Errors:           ${stats.errors}`);

if (driftSummary.length > 0) {
  console.log(`\nDrift summary:`);
  for (const d of driftSummary) {
    console.log(`  ${d.skill_id} | ${d.drift_severity} | ${d.drift_items} items | quarantine=${d.quarantine}`);
  }
}

// Save summary
const summary = {
  generated_at: new Date().toISOString(),
  total_checked: stats.total,
  stable: stats.stable,
  drift_detected: stats.drift_detected,
  quarantined: stats.quarantined,
  no_baseline: stats.no_baseline,
  errors: stats.errors,
  drift_summary: driftSummary,
};
fs.writeFileSync(path.join(L3_DIR, '_summary.json'), JSON.stringify(summary, null, 2));
console.log(`\nSummary saved to _data/l3_results/_summary.json`);
