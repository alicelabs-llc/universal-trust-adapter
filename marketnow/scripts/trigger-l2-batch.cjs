#!/usr/bin/env node
/**
 * MarketNow — Trigger L2 sandbox audits for skills with source.url
 * =================================================================
 *
 * Walks the catalog, finds every skill with source.url pointing to a
 * GitHub repo, and triggers the Sentinel L2 Docker sandbox workflow
 * via GitHub repository_dispatch.
 *
 * Idempotent: skips skills that already have an L2 result committed
 * in _data/l2_results/{skillId}.json (fetched via raw.githubusercontent).
 *
 * Usage:
 *   node scripts/trigger-l2-batch.cjs                  # audit all eligible
 *   node scripts/trigger-l2-batch.cjs mn-mcp-filesystem # audit one specific
 *
 * Requires: MANDATES_GITHUB_TOKEN env var (or hardcoded fallback for local dev)
 */

const fs = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────────────
const GITHUB_TOKEN = process.env.MANDATES_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
const REPO = process.env.MANDATES_REPO || 'edgarfloresguerra2011-a11y/marketnow';
const BRANCH = 'master';

if (!GITHUB_TOKEN) {
  console.error('✗ MANDATES_GITHUB_TOKEN env var required.');
  process.exit(1);
}

// ─── Args ────────────────────────────────────────────────────────────────
const onlySkillId = process.argv[2] || null;
if (onlySkillId) {
  console.log(`Targeting single skill: ${onlySkillId}`);
}

// ─── Load catalog ────────────────────────────────────────────────────────
const skillsPath = path.join(__dirname, '..', 'aep-marketplace', 'public', 'api', 'skills_index.json');
const skills = JSON.parse(fs.readFileSync(skillsPath, 'utf8'));

// Filter to skills with source.url containing github.com
const eligible = skills.filter(s =>
  s.source?.url &&
  s.source.url.includes('github.com') &&
  (!onlySkillId || s.id === onlySkillId)
);

console.log(`Found ${eligible.length} skill(s) eligible for L2 audit (have source.url → github.com).`);

if (eligible.length === 0) {
  console.log('Nothing to do. Add source.url to skills first (see add-official-mcp-skills.cjs).');
  process.exit(0);
}

// ─── Check existing L2 results via GitHub Contents API ───────────────────
async function getExistingL2Results() {
  const url = `https://api.github.com/repos/${REPO}/contents/_data/l2_results?ref=${BRANCH}`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'marketnow-sentinel',
      },
    });
    if (res.status === 200) {
      const listing = await res.json();
      if (Array.isArray(listing)) {
        return new Set(listing
          .filter(f => f.type === 'file' && f.name.endsWith('.json'))
          .map(f => f.name.replace(/\.json$/, '')));
      }
    }
    return new Set();
  } catch {
    return new Set();
  }
}

// ─── Trigger L2 for a single skill ──────────────────────────────────────
async function triggerL2(skillId, repoUrl) {
  // Use repository_dispatch — same event_type the Vercel function uses.
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'marketnow-sentinel',
      },
      body: JSON.stringify({
        event_type: 'sentinel-l2-audit',
        client_payload: {
          skill_id: skillId,
          repo_url: repoUrl,
          triggered_at: new Date().toISOString(),
          triggered_by: 'trigger-l2-batch.cjs',
        },
      }),
    }
  );
  return res.status;
}

// ─── Main ────────────────────────────────────────────────────────────────
(async () => {
  console.log('Checking for existing L2 results (to skip already-audited skills)...');
  const existing = await getExistingL2Results();
  console.log(`  ${existing.size} skill(s) already have L2 results.`);

  let triggered = 0, skipped = 0, failed = 0;
  for (const skill of eligible) {
    if (existing.has(skill.id)) {
      console.log(`  ⊘ ${skill.id} — already audited, skipping`);
      skipped++;
      continue;
    }
    console.log(`  → ${skill.id} — dispatching L2 for ${skill.source.url}`);
    const status = await triggerL2(skill.id, skill.source.url);
    if (status === 204) {
      console.log(`    ✓ dispatched (HTTP 204)`);
      triggered++;
    } else {
      console.log(`    ✗ failed (HTTP ${status})`);
      failed++;
    }
    // GitHub Actions has a rate limit of ~15 repository_dispatch per minute.
    // Sleep 5s between dispatches to be safe.
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Triggered: ${triggered}`);
  console.log(`  Skipped (already audited): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`\nResults will appear in _data/l2_results/ as GitHub Actions completes (2-5 min each).`);
  console.log(`Monitor at: https://github.com/${REPO}/actions`);
  console.log(`Live status at: https://marketnow.site/api/audit-skill?sentinel-status=1`);
})();
