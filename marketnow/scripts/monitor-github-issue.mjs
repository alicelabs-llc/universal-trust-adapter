#!/usr/bin/env node
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
 * MarketNow — GitHub Issue Monitor
 * =================================
 *
 * Monitors the Sentinel proposal issue in modelcontextprotocol/servers
 * and alerts when there's new activity (comments, reactions, label changes).
 *
 * Designed to run as a cron job (every 30 min) on your local machine
 * or on a server. Stores state in a JSON file so it only alerts on
 * NEW activity.
 *
 * Usage:
 *   node scripts/monitor-github-issue.mjs
 *
 * Env:
 *   GITHUB_TOKEN — GitHub PAT for API access
 *   ALERT_EMAIL  — (optional) email to notify (future: SMTP)
 *   ALERT_WEBHOOK — (optional) Slack/Discord webhook URL
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.MANDATES_GITHUB_TOKEN;
const ALERT_WEBHOOK = process.env.ALERT_WEBHOOK;
const STATE_FILE = path.join(__dirname, '..', '.monitor-state.json');

// Issues to monitor (can add more)
const ISSUES_TO_MONITOR = [
  {
    repo: 'modelcontextprotocol/servers',
    issue_number: 4478,
    label: 'Sentinel Proposal (Anthropic MCP)',
    priority: 'critical',
  },
  {
    repo: 'punkpeye/awesome-mcp-servers',
    issue_number: 6472,  // PR, but same API
    label: 'MarketNow PR (awesome-mcp-servers)',
    priority: 'high',
  },
];

async function fetchIssue(repo, issueNumber) {
  const url = `https://api.github.com/repos/${repo}/issues/${issueNumber}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'marketnow-monitor',
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} for ${repo}#${issueNumber}`);
  }
  return await res.json();
}

async function fetchComments(repo, issueNumber) {
  const url = `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments?per_page=100`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'marketnow-monitor',
    },
  });
  if (!res.ok) return [];
  return await res.json();
}

async function sendAlert(message) {
  console.log('\n🔔 ALERT:', message);

  if (ALERT_WEBHOOK) {
    try {
      await fetch(ALERT_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
      });
    } catch (e) {
      console.error('Webhook failed:', e.message);
    }
  }
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function checkIssue(issueConfig) {
  const { repo, issue_number, label, priority } = issueConfig;
  const key = `${repo}#${issue_number}`;

  try {
    const [issue, comments] = await Promise.all([
      fetchIssue(repo, issue_number),
      fetchComments(repo, issue_number),
    ]);

    const state = loadState();
    const prev = state[key] || { comments: 0, reactions: 0, state: '' };

    const currentReactions = issue.reactions?.total_count || 0;
    const currentComments = issue.comments || 0;
    const currentState = issue.state || '';

    const newComments = currentComments - prev.comments;
    const newReactions = currentReactions - prev.reactions;
    const stateChanged = currentState !== prev.state && prev.state !== '';

    if (newComments > 0 || newReactions > 0 || stateChanged) {
      let message = `🚨 [${priority.toUpperCase()}] Activity on ${label}\n`;
      message += `   ${issue.html_url}\n`;

      if (stateChanged) {
        message += `   State changed: ${prev.state} → ${currentState}\n`;
      }
      if (newReactions > 0) {
        message += `   +${newReactions} new reaction(s) (total: ${currentReactions})\n`;
      }
      if (newComments > 0) {
        message += `   +${newComments} new comment(s):\n`;
        // Show the latest comments
        const recentComments = comments.slice(-newComments);
        for (const c of recentComments) {
          message += `     • @${c.user.login}: ${c.body.slice(0, 150).replace(/\n/g, ' ')}...\n`;
        }
      }

      await sendAlert(message);
    } else {
      console.log(`  ✓ ${label}: no new activity (comments=${currentComments}, reactions=${currentReactions}, state=${currentState})`);
    }

    // Update state
    state[key] = {
      comments: currentComments,
      reactions: currentReactions,
      state: currentState,
      lastChecked: new Date().toISOString(),
    };
    saveState(state);
  } catch (e) {
    console.error(`  ✗ Error checking ${label}:`, e.message);
  }
}

(async () => {
  console.log(`MarketNow — GitHub Issue Monitor`);
  console.log(`=================================`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Monitoring ${ISSUES_TO_MONITOR.length} issues\n`);

  if (!GITHUB_TOKEN) {
    console.error('✗ GITHUB_TOKEN env var required');
    process.exit(1);
  }

  for (const issue of ISSUES_TO_MONITOR) {
    await checkIssue(issue);
  }

  console.log('\n✅ Check complete. Run again in 30 min for fresh checks.');
})();
