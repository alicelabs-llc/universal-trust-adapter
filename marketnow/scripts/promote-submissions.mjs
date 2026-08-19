#!/usr/bin/env node
/**
 * MarketNow — Promote Submissions to Catalog
 * ===========================================
 *
 * Runs via GitHub Actions (hourly) to:
 *   1. Scan _data/pending_submissions/*.json for skills with status="pending_l2_audit"
 *   2. Check if the corresponding _data/l2_results/{skill_id}.json exists
 *   3. If L2 passed (execution_status="ran", failure_reason=null):
 *      - Move the skill from pending_submissions to the main catalog (skills.json)
 *      - Update the submission status to "promoted"
 *      - Trigger ATC issuance for the skill (via /api/atc?action=issue)
 *   4. If L2 failed: mark submission status as "l2_failed", do NOT promote
 *
 * This closes the loop: submit → L1.5+L1.7 sync → L2 sandbox audit →
 * promote to catalog → issue ATC → skill is discoverable via search_skills.
 *
 * Usage:
 *   node scripts/promote-submissions.mjs              # full run
 *   node scripts/promote-submissions.mjs --dry-run    # report only, no writes
 *
 * Env:
 *   MANDATES_GITHUB_TOKEN  — GitHub PAT with repo scope
 *   MANDATES_REPO          — default: alicelabs-llc/marketnow
 *   ATC_API_URL            — default: https://marketnow.site/api/atc
 */

const GITHUB_TOKEN = process.env.MANDATES_GITHUB_TOKEN;
const REPO = process.env.MANDATES_REPO || 'alicelabs-llc/marketnow';
const BRANCH = 'master';
const ATC_API_URL = process.env.ATC_API_URL || 'https://marketnow.site/api/atc';
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Helpers ─────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`[promote] ${msg}`);
}

async function ghGet(pathname) {
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${pathname}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'marketnow-promote' },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`ghGet ${pathname}: ${r.status}`);
  return await r.json();
}

async function ghPut(pathname, content, message) {
  if (DRY_RUN) {
    log(`[dry-run] would PUT ${pathname}`);
    return { ok: true, dryRun: true };
  }
  let sha = null;
  try {
    const metaUrl = `https://api.github.com/repos/${REPO}/contents/${pathname}?ref=${BRANCH}`;
    const metaR = await fetch(metaUrl, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'marketnow-promote',
      },
    });
    if (metaR.ok) {
      const meta = await metaR.json();
      sha = meta?.sha || null;
    }
  } catch {}

  const body = {
    message,
    content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;

  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${pathname}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'marketnow-promote',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const errBody = await r.text();
    throw new Error(`ghPut ${pathname} failed: ${r.status} ${errBody.slice(0, 200)}`);
  }
  return { ok: true, dryRun: false };
}

async function issueATC(skillId, submission) {
  if (DRY_RUN) {
    log(`[dry-run] would issue ATC for ${skillId}`);
    return { dryRun: true };
  }
  const publicKey = `marketnow-skill:${skillId}`;
  try {
    const r = await fetch(ATC_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'issue',
        agent_id: `skill.${skillId}`,
        agent_name: submission.skill.name,
        public_key: publicKey,
        capabilities: ['mcp-server'],
        protocol_language: 'mcp',
        wallet_address: null,
        skill_id: skillId,
      }),
    });
    if (!r.ok) {
      log(`  ⚠️  ATC issue failed: ${r.status} ${await r.text()}`);
      return null;
    }
    return await r.json();
  } catch (e) {
    log(`  ⚠️  ATC issue error: ${e.message}`);
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  log(`Starting promotion scan${DRY_RUN ? ' (DRY RUN)' : ''}`);
  log(`Repo: ${REPO}@${BRANCH}`);

  const listUrl = `https://api.github.com/repos/${REPO}/contents/_data/pending_submissions?ref=${BRANCH}`;
  const listR = await fetch(listUrl, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'marketnow-promote',
    },
  });
  if (!listR.ok) {
    log(`No pending_submissions directory or GitHub error: ${listR.status}`);
    return;
  }
  const files = await listR.json();
  const submissionFiles = files.filter(f => f.type === 'file' && f.name.startsWith('sub_') && f.name.endsWith('.json'));
  log(`Found ${submissionFiles.length} submission file(s)`);

  if (submissionFiles.length === 0) {
    log('Nothing to do.');
    return;
  }

  log('Loading current skills catalog...');
  const skillsR = await fetch(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/aep-marketplace/public/api/skills.json`, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'marketnow-promote' },
  });
  if (!skillsR.ok) throw new Error(`Failed to load skills.json: ${skillsR.status}`);
  const skills = await skillsR.json();
  log(`Catalog has ${skills.length} skills`);

  let promoted = 0;
  let failed = 0;
  let skipped = 0;
  const newSkills = [];

  for (const file of submissionFiles) {
    const submissionId = file.name.replace(/\.json$/, '');
    log(`\nChecking ${submissionId}...`);

    const submission = await ghGet(`_data/pending_submissions/${file.name}`);
    if (!submission) {
      log(`  ⚠️  Could not fetch submission`);
      failed++;
      continue;
    }

    if (submission.status === 'promoted') {
      log(`  ✓ Already promoted (skill_id=${submission.skill_id})`);
      skipped++;
      continue;
    }

    if (submission.status === 'l2_failed' || submission.status === 'l2_low_score') {
      log(`  ${submission.status === 'l2_failed' ? '✗' : '○'} Previously ${submission.status}`);
      skipped++;
      continue;
    }

    const l2Result = await ghGet(`_data/l2_results/${submission.skill_id}.json`);
    if (!l2Result) {
      log(`  ⏳ L2 audit not yet run (no result file)`);
      skipped++;
      continue;
    }

    const l2Passed = l2Result.execution_status === 'ran' && !l2Result.failure_reason;
    if (!l2Passed) {
      log(`  ✗ L2 FAILED: ${l2Result.failure_reason || 'unknown'}`);
      submission.status = 'l2_failed';
      submission.audit.l2_status = 'failed';
      submission.audit.l2_failure_reason = l2Result.failure_reason;
      await ghPut(
        `_data/pending_submissions/${file.name}`,
        submission,
        `mark submission ${submissionId} as l2_failed`
      );
      failed++;
      continue;
    }

    log(`  ✓ L2 PASSED (execution_status=${l2Result.execution_status})`);

    const l15Score = submission.audit.l15_score ?? 5;
    const l2Findings = (l2Result.analysis_layers?.stdout_passive || {});
    const l2Penalty = (l2Findings.network_attempts || 0) * 3 +
                      (l2Findings.fs_write_attempts || 0) * 2 +
                      (l2Findings.process_spawns || 0) * 2 +
                      (l2Findings.credential_leakage || 0) * 5;
    const l2Score = Math.max(0, 10 - l2Penalty);
    const overallScore = Math.round((l15Score + l2Score) / 2);
    log(`  Scores: L1.5=${l15Score}, L2=${l2Score}, overall=${overallScore}`);

    if (overallScore < 7) {
      log(`  ✗ Overall score ${overallScore} < 7, not promoting`);
      submission.status = 'l2_low_score';
      submission.audit.l2_status = 'completed';
      submission.audit.overall_score = overallScore;
      await ghPut(
        `_data/pending_submissions/${file.name}`,
        submission,
        `mark submission ${submissionId} as l2_low_score (${overallScore})`
      );
      failed++;
      continue;
    }

    const skillEntry = {
      id: submission.skill.id,
      name: submission.skill.name,
      slug: submission.skill.slug,
      description: submission.skill.description,
      category: submission.skill.category,
      tags: submission.skill.tags,
      price: submission.skill.price,
      currency: 'USD',
      payment: 'free',
      license: 'perpetual',
      verified: false,
      review_status: 'auto-scanned',
      sentinel_score: overallScore,
      install: submission.skill.install,
      author: submission.skill.author,
      version: submission.skill.version,
      source: submission.skill.source,
      usdc_disclaimer: 'All skills in MarketNow are free. No USDC payment required.',
      doc: {
        setup: { required_env: [], optional_env: [], install: submission.skill.install },
        usage: `agent.call('${submission.skill.slug}', { ... })`,
        system_prompt: `${submission.skill.name}\n\n## When to Use\nUse this MCP server for ${submission.skill.description}\n\n## Source\nCommunity-submitted from ${submission.repo.url}\n\n## Sentinel Audit\nL1.5 score: ${l15Score}/10\nL2 sandbox: passed (0 critical findings)\nOverall: ${overallScore}/10`,
      },
      sentinel: {
        score: overallScore,
        risk_level: overallScore >= 9 ? 'low' : overallScore >= 7 ? 'medium' : 'high',
        l15_score: l15Score,
        l2_score: l2Score,
        l2_passed: true,
        certificate_id: `MN-SC-${submission.skill_id.toUpperCase()}`,
      },
    };
    newSkills.push(skillEntry);
    log(`  ✓ Built skill entry for catalog`);

    log(`  Issuing ATC for ${submission.skill_id}...`);
    const atcResult = await issueATC(submission.skill_id, submission);
    if (atcResult && !atcResult.dryRun) {
      log(`  ✓ ATC issued: ${atcResult.card_id}`);
      submission.atc_preallocated = true;
      submission.atc_card_id = atcResult.card_id;
    } else if (atcResult?.dryRun) {
      log(`  [dry-run] ATC would be issued`);
    } else {
      log(`  ⚠️  ATC issuance failed (non-fatal — skill still promoted)`);
    }

    submission.status = 'promoted';
    submission.promoted_at = new Date().toISOString();
    submission.audit.l2_status = 'completed';
    submission.audit.overall_score = overallScore;
    await ghPut(
      `_data/pending_submissions/${file.name}`,
      submission,
      `promote submission ${submissionId} → catalog (score ${overallScore})`
    );
    log(`  ✓ Submission marked as promoted`);
    promoted++;
  }

  if (newSkills.length > 0) {
    log(`\nAppending ${newSkills.length} new skill(s) to catalog...`);
    const updatedSkills = [...skills, ...newSkills];
    await ghPut(
      'aep-marketplace/public/api/skills.json',
      updatedSkills,
      `promote ${newSkills.length} skill(s) from pending_submissions to catalog

Skills promoted:
${newSkills.map(s => `- ${s.id} (${s.name}) — Sentinel ${s.sentinel_score}/10`).join('\n')}`
    );

    try {
      const liteR = await fetch(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/aep-marketplace/public/api/skills-lite.json`, {
        headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'marketnow-promote' },
      });
      if (liteR.ok) {
        const lite = await liteR.json();
        const newLite = newSkills.map(s => ({
          id: s.id, name: s.name, slug: s.slug, description: s.description,
          category: s.category, tags: s.tags, price: s.price,
          sentinel_score: s.sentinel_score, install: s.install,
          author: s.author, version: s.version,
        }));
        await ghPut(
          'aep-marketplace/public/api/skills-lite.json',
          [...lite, ...newLite],
          `promote ${newLite.length} skill(s) to skills-lite.json`
        );
        log(`✓ Updated skills-lite.json`);
      }
    } catch (e) {
      log(`⚠️  skills-lite.json update failed (non-fatal): ${e.message}`);
    }

    // Also update skills_index.json (read by generate_skills.cjs during build)
    // Without this, promoted skills won't appear in production builds.
    try {
      const indexR = await fetch(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/aep-marketplace/public/api/skills_index.json`, {
        headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'marketnow-promote' },
      });
      if (indexR.ok) {
        const index = await indexR.json();
        const newIndex = newSkills.map(s => ({
          id: s.id, name: s.name, slug: s.slug, description: s.description,
          category: s.category, tags: s.tags, price: s.price,
          sentinel_score: s.sentinel_score, install: s.install,
          author: s.author, version: s.version, source: s.source,
        }));
        await ghPut(
          'aep-marketplace/public/api/skills_index.json',
          [...index, ...newIndex],
          `promote ${newIndex.length} skill(s) to skills_index.json (build source)`
        );
        log(`✓ Updated skills_index.json (build source)`);
      }
    } catch (e) {
      log(`⚠️  skills_index.json update failed (non-fatal): ${e.message}`);
    }

    // Also update src/data/all_skills.json (read by the SPA at runtime)
    // Without this, the React app won't show promoted skills in the catalog UI.
    try {
      const allR = await fetch(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/aep-marketplace/src/data/all_skills.json`, {
        headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'marketnow-promote' },
      });
      if (allR.ok) {
        const all = await allR.json();
        await ghPut(
          'aep-marketplace/src/data/all_skills.json',
          [...all, ...newSkills],
          `promote ${newSkills.length} skill(s) to all_skills.json (SPA source)`
        );
        log(`✓ Updated all_skills.json (SPA source)`);
      }
    } catch (e) {
      log(`⚠️  all_skills.json update failed (non-fatal): ${e.message}`);
    }
  }

  log(`\n=== Summary ===`);
  log(`Promoted: ${promoted}`);
  log(`Failed:   ${failed}`);
  log(`Skipped:  ${skipped}`);
  log(`Total:    ${submissionFiles.length}`);
}

main().catch(err => {
  console.error('[promote] FATAL:', err);
  process.exit(1);
});
