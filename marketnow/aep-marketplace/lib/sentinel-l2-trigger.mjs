/**
 * ⚠️ SENTINEL PROPRIETARY — Copyright (c) 2026 AliceLabs LLC. All Rights Reserved.
 *
 * This file is part of the Sentinel Security Audit Engine.
 * DO NOT COPY, REDISTRIBUTE, OR BUILD COMPETING PRODUCTS.
 * See SENTINEL-LICENSE for full terms.
 *
 * "Sentinel" is a trademark of AliceLabs LLC.
 * Patent pending on the 3-layer audit pipeline (L1.5 → L1.6 → L2).
 *
 * For licensing: legal@alicelabs.site
 * For verification: https://marketnow.site/verify
 */

/**
 * MarketNow — Sentinel L2 Trigger
 * =================================
 *
 * Triggers L2 Docker sandbox analysis via GitHub Actions
 * from the Vercel serverless function.
 *
 * Flow:
 * 1. /api/audit-skill runs L1.5 + L1.6 in real-time
 * 2. If the skill has a GitHub repo, triggers L2 via GitHub repository_dispatch
 *    — but only if we haven't ALREADY triggered it recently (in-memory dedup)
 * 3. GitHub Actions runs Docker sandbox (--network none, --read-only, --cap-drop ALL)
 * 4. Results are committed to the repo and available on next audit
 */

const GITHUB_TOKEN = process.env.MANDATES_GITHUB_TOKEN;
const REPO = process.env.MANDATES_REPO || 'edgarfloresguerra2011-a11y/marketnow';

/**
 * In-memory dedup cache.
 *
 * Problem we're solving: every /api/audit-skill call for a skill with a GitHub
 * repo used to fire a fresh repository_dispatch — even if a sandbox run was
 * already in progress or had just finished. With real traffic this would
 * duplicate Docker runs for the same skill (cost + Actions quota).
 *
 * Solution: remember which skill_ids we've triggered in the last TTL ms.
 * The cache lives in the Vercel serverless instance memory — it's per-instance
 * (not shared across invocations on different lambdas) but it still eliminates
 * the bulk of redundant triggers from repeat visits. After the first L2
 * result lands in _data/l2_results/{skillId}.json, getL2Results() will short-
 * circuit the trigger path entirely.
 */
const TRIGGER_TTL_MS = 30 * 60 * 1000; // 30 minutes
const _triggeredAt = new Map(); // skillId → timestamp (ms)

function _wasTriggeredRecently(skillId) {
  const ts = _triggeredAt.get(skillId);
  if (!ts) return false;
  if (Date.now() - ts > TRIGGER_TTL_MS) {
    _triggeredAt.delete(skillId);
    return false;
  }
  return true;
}

function _markTriggered(skillId) {
  _triggeredAt.set(skillId, Date.now());
  // Defensive cleanup — don't let the map grow unbounded in a long-lived
  // lambda (Vercel can reuse an instance for many invocations).
  if (_triggeredAt.size > 500) {
    const cutoff = Date.now() - TRIGGER_TTL_MS;
    for (const [k, v] of _triggeredAt) {
      if (v < cutoff) _triggeredAt.delete(k);
    }
  }
}

/**
 * Trigger L2 Docker sandbox analysis via GitHub Actions.
 * @param {string} skillId - The skill ID
 * @param {string} repoUrl - GitHub repo URL of the MCP server
 * @returns {Object} { triggered, workflow_url, message }
 */
export async function triggerL2(skillId, repoUrl) {
  if (!GITHUB_TOKEN) {
    return { triggered: false, message: 'L2 trigger not configured (no GitHub token)' };
  }
  if (!repoUrl || !repoUrl.includes('github.com')) {
    return { triggered: false, message: 'L2 requires a GitHub repo URL' };
  }

  // Dedup: if we already triggered this skill in the last TRIGGER_TTL_MS,
  // skip the dispatch. The previous run is either in progress or already
  // committed results to _data/l2_results/ — a subsequent audit-skill call
  // will pick those up via getL2Results() once they land.
  if (_wasTriggeredRecently(skillId)) {
    return {
      triggered: false,
      deduped: true,
      message: `L2 already triggered for ${skillId} within the last 30 min — skipping duplicate dispatch. Results will appear once GitHub Actions completes.`,
      workflow_url: `https://github.com/${REPO}/actions`,
    };
  }

  try {
    // Trigger via repository_dispatch event
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
          },
        }),
      }
    );

    if (res.status === 204) {
      _markTriggered(skillId);
      return {
        triggered: true,
        message: `L2 Docker sandbox triggered for ${skillId}. Results will be available after GitHub Actions completes.`,
        workflow_url: `https://github.com/${REPO}/actions`,
      };
    }
    return { triggered: false, message: `GitHub API returned ${res.status}` };
  } catch (e) {
    return { triggered: false, message: e.message };
  }
}

/**
 * Check if L2 results exist for a skill.
 * @param {string} skillId
 * @returns {Object|null} L2 results or null
 */
export async function getL2Results(skillId) {
  if (!GITHUB_TOKEN) return null;
  const url = `https://raw.githubusercontent.com/${REPO}/master/_data/l2_results/${skillId}.json`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'marketnow-sentinel' },
    });
    if (res.status === 200) {
      return await res.json();
    }
    return null;
  } catch {
    return null;
  }
}
