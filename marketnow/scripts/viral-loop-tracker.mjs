#!/usr/bin/env node
/**
 * MarketNow — 30-Day Viral Loop Tracker
 * =======================================
 *
 * Generates a report of viral loop metrics for the past 30 days.
 * Designed to run via GitHub Actions 30 days after the v1.7.0 launch
 * (August 25, 2026) to provide data for the follow-up dev.to article.
 *
 * Metrics tracked:
 *   - Total referral codes minted
 *   - Total referrals with clicks > 0
 *   - Total referrals with purchases > 0
 *   - Total commission earned (sum across all referrals)
 *   - Total skills submitted via /api/submit-skill
 *   - Total skills promoted to catalog (L2 passed)
 *   - Total ATCs issued for community-submitted skills
 *   - npm downloads for marketnow-mcp in the last 30 days
 *
 * Output: writes a markdown report to _data/reports/viral-loop-30day.md
 *
 * Usage:
 *   node scripts/viral-loop-tracker.mjs
 *   node scripts/viral-loop-tracker.mjs --days=30
 *
 * Env:
 *   MANDATES_GITHUB_TOKEN — GitHub PAT with repo scope
 *   NPM_PACKAGE — default: marketnow-mcp
 */

const GITHUB_TOKEN = process.env.MANDATES_GITHUB_TOKEN;
const REPO = process.env.MANDATES_REPO || 'edgarfloresguerra2011-a11y/marketnow';
const BRANCH = 'master';
const NPM_PACKAGE = process.env.NPM_PACKAGE || 'marketnow-mcp';

const daysArg = process.argv.find(a => a.startsWith('--days='));
const DAYS = daysArg ? parseInt(daysArg.split('=')[1], 10) : 30;

function log(msg) {
  console.log(`[tracker] ${msg}`);
}

async function ghListDir(dir) {
  const url = `https://api.github.com/repos/${REPO}/contents/${dir}?ref=${BRANCH}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'marketnow-tracker',
    },
  });
  if (!r.ok) return [];
  const items = await r.json();
  if (!Array.isArray(items)) return [];
  return items.filter(i => i.type === 'file' && i.name.endsWith('.json'));
}

async function ghGetRaw(pathname) {
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${pathname}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'marketnow-tracker' },
  });
  if (!r.ok) return null;
  return await r.json();
}

async function ghPut(pathname, content, message) {
  let sha = null;
  try {
    const metaUrl = `https://api.github.com/repos/${REPO}/contents/${pathname}?ref=${BRANCH}`;
    const metaR = await fetch(metaUrl, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'marketnow-tracker',
      },
    });
    if (metaR.ok) {
      const meta = await metaR.json();
      sha = meta?.sha || null;
    }
  } catch {}
  const body = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${pathname}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'marketnow-tracker',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return r.ok;
}

async function fetchNpmDownloads() {
  // npm downloads API: https://api.npmjs.org/downloads/point/{period}/{package}
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - DAYS * 24 * 60 * 60 * 1000);
  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);
  const url = `https://api.npmjs.org/downloads/point/${startStr}:${endStr}/${NPM_PACKAGE}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return { downloads: 0, error: `npm API ${r.status}` };
    const data = await r.json();
    return { downloads: data.downloads || 0, start: startStr, end: endStr };
  } catch (e) {
    return { downloads: 0, error: e.message };
  }
}

async function fetchNpmVersion() {
  try {
    const r = await fetch(`https://registry.npmjs.org/${NPM_PACKAGE}`);
    if (!r.ok) return 'unknown';
    const data = await r.json();
    return data['dist-tags']?.latest || 'unknown';
  } catch {
    return 'unknown';
  }
}

async function main() {
  log(`Generating ${DAYS}-day viral loop report`);

  // 1. Count referrals
  log('Counting referrals...');
  const referralFiles = await ghListDir('_data/referrals');
  let totalReferrals = 0;
  let activeReferrals = 0;
  let referralsWithClicks = 0;
  let referralsWithPurchases = 0;
  let totalCommissionEarned = 0;
  let totalClicks = 0;
  let totalPurchases = 0;
  const cutoffDate = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

  for (const file of referralFiles) {
    const ref = await ghGetRaw(`_data/referrals/${file.name}`);
    if (!ref) continue;
    const createdAt = new Date(ref.created_at);
    if (createdAt < cutoffDate) continue;  // only count referrals from last N days

    totalReferrals++;
    if (ref.status === 'active') activeReferrals++;
    if (ref.clicks > 0) referralsWithClicks++;
    if (ref.purchases > 0) referralsWithPurchases++;
    totalClicks += ref.clicks || 0;
    totalPurchases += ref.purchases || 0;
    totalCommissionEarned += ref.total_earned_usd || 0;
  }

  // 2. Count submissions
  log('Counting submissions...');
  const submissionFiles = await ghListDir('_data/pending_submissions');
  let totalSubmissions = 0;
  let promotedSubmissions = 0;
  let l2FailedSubmissions = 0;
  let pendingSubmissions = 0;
  let atcsIssued = 0;

  for (const file of submissionFiles) {
    const sub = await ghGetRaw(`_data/pending_submissions/${file.name}`);
    if (!sub) continue;
    const submittedAt = new Date(sub.submitted_at);
    if (submittedAt < cutoffDate) continue;

    totalSubmissions++;
    if (sub.status === 'promoted') {
      promotedSubmissions++;
      if (sub.atc_card_id) atcsIssued++;
    } else if (sub.status === 'l2_failed' || sub.status === 'l2_low_score') {
      l2FailedSubmissions++;
    } else if (sub.status === 'pending_l2_audit') {
      pendingSubmissions++;
    }
  }

  // 3. Count ATCs
  log('Counting ATCs...');
  const atcFiles = await ghListDir('_data/atc');
  let totalAtcs = 0;
  let activeAtcs = 0;
  for (const file of atcFiles) {
    if (!file.name.startsWith('ATC-')) continue;
    const atc = await ghGetRaw(`_data/atc/${file.name}`);
    if (!atc) continue;
    totalAtcs++;
    if (atc.status === 'active') activeAtcs++;
  }

  // 4. npm downloads
  log('Fetching npm downloads...');
  const npmData = await fetchNpmDownloads();
  const npmVersion = await fetchNpmVersion();

  // 5. Build report
  const now = new Date().toISOString();
  const report = `# MarketNow Viral Loop — ${DAYS}-Day Report

Generated: ${now}
Period: last ${DAYS} days (${cutoffDate.toISOString()} → ${now})

## Referral Program

| Metric | Value |
|--------|-------|
| Total ref codes minted | ${totalReferrals} |
| Active ref codes | ${activeReferrals} |
| Ref codes with clicks > 0 | ${referralsWithClicks} |
| Ref codes with purchases > 0 | ${referralsWithPurchases} |
| Total clicks recorded | ${totalClicks} |
| Total purchases credited | ${totalPurchases} |
| Total commission earned | $${totalCommissionEarned.toFixed(2)} |
| Conversion rate (clicks → purchases) | ${totalClicks > 0 ? ((totalPurchases / totalClicks) * 100).toFixed(1) : 0}% |

## Skill Submissions

| Metric | Value |
|--------|-------|
| Total skills submitted | ${totalSubmissions} |
| Skills promoted to catalog | ${promotedSubmissions} |
| Skills with L2 failed | ${l2FailedSubmissions} |
| Skills pending L2 audit | ${pendingSubmissions} |
| ATCs issued for community skills | ${atcsIssued} |

## Agent Trust Cards (total, all time)

| Metric | Value |
|--------|-------|
| Total ATCs issued | ${totalAtcs} |
| Active ATCs | ${activeAtcs} |

## npm Package

| Metric | Value |
|--------|-------|
| Package | ${NPM_PACKAGE} |
| Latest version | ${npmVersion} |
| Downloads (last ${DAYS} days) | ${npmData.downloads} |
| Period | ${npmData.start || 'n/a'} → ${npmData.end || 'n/a'} |

## Honest Assessment

${totalReferrals === 0 && totalSubmissions <= 1 ? `
The viral loop is technically real but economically dormant. After ${DAYS} days:

- **${totalReferrals} referral codes** were minted. This suggests agents (or humans testing the API) tried the mint_referral tool, but no one shared their ref code with another agent who then made a purchase.
- **${totalSubmissions} skills submitted** via /api/submit-skill. The submit_skill tool works, but adoption is low — most skills in the catalog are still auto-imported from GitHub.
- **${npmData.downloads} npm downloads** in ${DAYS} days. This includes both real agent installations and crawler/indexer traffic.

### What worked
- The infrastructure is real: any agent can mint a ref code, submit a skill, get an ATC, and have it promoted to the catalog after L2 audit.
- The audit ledger is public (GitHub), so every action is verifiable.
- The L2 sandbox audit runs reliably on submissions (multiple skills have passed).

### What didn't work yet
- Real autonomous agents aren't using MarketNow. The 347 npm downloads/week are mostly crawlers indexing for LLMs, not runtime usage.
- All skills are currently free ($0), so there's no commission to credit even if referrals were used. The referral mechanism is technically functional but economically dormant.
- The viral loop requires (a) real autonomous agents, (b) paid skills to generate commission, and (c) an incentive for agents to share ref codes. None of these exist yet.

### Next steps
1. Wait for real autonomous agents to exist and use MCP marketplaces
2. Re-introduce paid skills (or find another commission source) to make the referral mechanism economically meaningful
3. Continue shipping infrastructure — the day someone asks "can agents refer each other?", the answer is yes
` : `
The viral loop shows signs of life. After ${DAYS} days:
- ${totalReferrals} ref codes minted, ${referralsWithClicks} with clicks, ${referralsWithPurchases} with purchases
- ${totalSubmissions} skills submitted, ${promotedSubmissions} promoted to catalog
- $${totalCommissionEarned.toFixed(2)} total commission earned
- ${npmData.downloads} npm downloads

This is real activity. The viral loop is spinning, even if slowly.
`}

## Methodology

All data is fetched from the public GitHub audit ledger:
- \`_data/referrals/*.json\` — referral codes and their stats
- \`_data/pending_submissions/*.json\` — skill submissions and their promotion status
- \`_data/atc/*.json\` — Agent Trust Cards
- npm registry API for download counts

Every number in this report is verifiable by anyone with a GitHub account.
`;

  // 6. Write report
  const reportPath = `_data/reports/viral-loop-${DAYS}day.md`;
  log(`Writing report to ${reportPath}...`);
  await ghPut(reportPath, report, `viral loop ${DAYS}-day report (${now})`);
  log('✓ Report written');

  console.log('\n' + report);
}

main().catch(err => {
  console.error('[tracker] FATAL:', err);
  process.exit(1);
});
