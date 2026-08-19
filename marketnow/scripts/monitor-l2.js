#!/usr/bin/env node
/**
 * MarketNow — L2 Coverage Monitor
 * ================================
 *
 * Reports how many skills in the catalog have L2 sandbox results, broken
 * down by execution_status. Useful for tracking L2 coverage as the catalog
 * grows.
 *
 * Usage: node scripts/monitor-l2.js
 */

const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.MANDATES_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
const REPO = process.env.MANDATES_REPO || 'alicelabs-llc/marketnow';
const BRANCH = 'master';

async function fetchJson(url, headers = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'marketnow-monitor', ...headers },
    });
    if (res.status === 200) return await res.json();
    return null;
  } catch {
    return null;
  }
}

async function fetchL2Results() {
  const url = `https://api.github.com/repos/${REPO}/contents/_data/l2_results?ref=${BRANCH}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'marketnow-monitor',
    },
  });
  if (res.status !== 200) return [];
  const listing = await res.json();
  if (!Array.isArray(listing)) return [];

  // Fetch each result file in parallel (small files, OK to fan out)
  const files = listing.filter(f => f.type === 'file' && f.name.endsWith('.json'));
  console.log(`Fetching ${files.length} L2 result files...`);
  const results = await Promise.all(files.map(async f => {
    const data = await fetchJson(
      `https://raw.githubusercontent.com/${REPO}/${BRANCH}/_data/l2_results/${f.name}`,
      { Authorization: `Bearer ${GITHUB_TOKEN}` }
    );
    return data;
  }));
  return results.filter(Boolean);
}

(async () => {
  console.log(`\nMarketNow — L2 Coverage Monitor`);
  console.log(`================================\n`);

  // Load catalog
  const skillsPath = path.join(__dirname, '..', 'marketnow', 'aep-marketplace', 'public', 'api', 'skills_index.json');
  const skills = JSON.parse(fs.readFileSync(skillsPath, 'utf8'));
  const eligible = skills.filter(s => s.source?.url && s.source.url.includes('github.com'));
  console.log(`Catalog:           ${skills.length} skills total`);
  console.log(`L2-eligible:       ${eligible.length} skills (have source.url → github.com)`);
  console.log(`  by type:`);
  const byType = {};
  for (const s of eligible) {
    byType[s.source.type] = (byType[s.source.type] || 0) + 1;
  }
  for (const [t, c] of Object.entries(byType)) {
    console.log(`    ${t}: ${c}`);
  }
  console.log('');

  // Fetch L2 results
  const results = await fetchL2Results();
  console.log(`L2 results:        ${results.length} files in _data/l2_results/`);

  if (results.length === 0) {
    console.log(`\nNo L2 results yet. Trigger audits with: node scripts/trigger-l2-batch.cjs`);
    return;
  }

  // Breakdown by execution_status
  const byStatus = { ran: 0, ran_idle: 0, failed_to_start: 0, unknown: 0 };
  const byRisk = { low: 0, medium: 0, high: 0, critical: 0, unknown: 0 };
  let totalScore = 0;
  let ranCount = 0;

  for (const r of results) {
    const status = r.execution_status || (r.l2_score === 0 ? 'unknown' : 'ran');
    byStatus[status] = (byStatus[status] || 0) + 1;
    byRisk[r.l2_risk_level] = (byRisk[r.l2_risk_level] || 0) + 1;
    // 'ran' and 'ran_idle' both count as successful execution
    if (status === 'ran' || status === 'ran_idle') {
      totalScore += r.l2_score;
      ranCount++;
    }
  }

  console.log(`\nBreakdown by execution_status:`);
  console.log(`  ran:              ${byStatus.ran}        (server started + produced output)`);
  console.log(`  ran_idle:         ${byStatus.ran_idle}        (server started, waited for stdin — normal MCP stdio)`);
  console.log(`  failed_to_start:  ${byStatus.failed_to_start}        (crash / MODULE_NOT_FOUND / etc.)`);
  console.log(`  unknown (legacy): ${byStatus.unknown}`);

  console.log(`\nBreakdown by l2_risk_level:`);
  console.log(`  low:       ${byRisk.low}`);
  console.log(`  medium:    ${byRisk.medium}`);
  console.log(`  high:      ${byRisk.high}`);
  console.log(`  critical:  ${byRisk.critical}`);
  console.log(`  unknown:   ${byRisk.unknown}`);

  if (ranCount > 0) {
    console.log(`\nAverage L2 score (only 'ran' results): ${(totalScore / ranCount).toFixed(2)}/10`);
  }

  // Coverage percentage
  const coverage = (results.length / Math.max(eligible.length, 1) * 100).toFixed(1);
  console.log(`\nL2 coverage: ${results.length}/${eligible.length} eligible skills (${coverage}%)`);

  // List skills that need re-audit (failed_to_start)
  const failed = results.filter(r => r.execution_status === 'failed_to_start');
  if (failed.length > 0) {
    console.log(`\n⚠ ${failed.length} skill(s) failed to start in sandbox — need entrypoint fix:`);
    for (const f of failed) {
      console.log(`  ${f.skill_id}`);
      console.log(`    reason: ${f.failure_reason || '(no reason recorded)'}`);
    }
  }

  console.log('');
})();
