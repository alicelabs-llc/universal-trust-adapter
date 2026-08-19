/**
 * MarketNow — Provenance Verification
 * ===================================
 *
 * Verifies that an MCP server's npm package or GitHub release
 * was built from the expected source commit.
 *
 * Q4 2026 roadmap item.
 *
 * Checks:
 *   1. npm package: verify the package was published from a specific commit
 *   2. GitHub release: verify the release tag matches a commit SHA
 *   3. Git import: verify the imported version matches the audited version
 */

import crypto from 'crypto';

/**
 * Build a provenance record for an audited skill.
 * @param {Object} params
 * @param {string} params.skill_id
 * @param {string} params.repo_url - GitHub repo URL
 * @param {string} params.commit_sha - the commit SHA that was audited
 * @param {string} params.npm_package - npm package name (optional)
 * @param {string} params.npm_version - npm version (optional)
 * @returns {Object} provenance record
 */
export function buildProvenanceRecord(params) {
  const { skill_id, repo_url, commit_sha, npm_package, npm_version } = params;
  
  return {
    skill_id,
    provenance_version: '1.0.0',
    created_at: new Date().toISOString(),
    source: {
      type: 'github',
      repo_url,
      commit_sha,
      // Short SHA for display
      commit_short: commit_sha.slice(0, 7),
    },
    npm: npm_package ? {
      package: npm_package,
      version: npm_version,
      // We can't verify npm provenance without Sigstore, but we document it
      provenance_available: false,
      note: 'Enable npm --provenance flag to enable Sigstore verification',
    } : null,
    // The audit was run against this specific commit
    audit_commit: commit_sha,
    // Verification: re-running the audit on a different commit should produce
    // the same Sentinel score (or flag drift if the score changes)
  };
}

/**
 * Verify provenance of a skill at runtime.
 * Checks if the currently installed version matches the audited version.
 *
 * @param {Object} provenance - the provenance record from certification
 * @param {string} currentCommitSha - the current commit SHA of the repo
 * @returns {Object} { verified, reason, drift_detected }
 */
export function verifyProvenance(provenance, currentCommitSha) {
  if (!provenance || !provenance.source) {
    return { verified: false, reason: 'no_provenance_record' };
  }

  if (provenance.source.commit_sha === currentCommitSha) {
    return {
      verified: true,
      reason: 'commit_match',
      drift_detected: false,
    };
  }

  // Commit changed — this is expected over time, but the consumer
  // should be aware that the audit was for a different commit
  return {
    verified: false,
    reason: 'commit_mismatch',
    drift_detected: true,
    audited_commit: provenance.source.commit_short,
    current_commit: currentCommitSha.slice(0, 7),
    message: `Audited commit ${provenance.source.commit_short} differs from current ${currentCommitSha.slice(0, 7)}. The audit may no longer be accurate. Re-audit recommended.`,
  };
}

/**
 * Fetch the latest commit SHA from a GitHub repo.
 * @param {string} repoUrl - https://github.com/owner/repo
 * @param {string} token - GitHub token
 * @returns {Promise<string>} commit SHA
 */
export async function fetchLatestCommitSha(repoUrl, token) {
  const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/]+)/);
  if (!match) throw new Error('Invalid GitHub URL');
  
  const owner = match[1];
  const repo = match[2].replace(/\.git$/, '');
  
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/master`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'marketnow-provenance',
    },
  });
  
  if (!r.ok) {
    // Try 'main' branch
    const r2 = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/main`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'marketnow-provenance',
      },
    });
    if (!r2.ok) throw new Error(`Cannot fetch commits: ${r2.status}`);
    const data = await r2.json();
    return data.sha;
  }
  
  const data = await r.json();
  return data.sha;
}
