#!/usr/bin/env node
/**
 * MarketNow CLI — Audit any MCP server for free
 * 
 * Usage:
 *   npx marketnow-mcp audit https://github.com/owner/repo
 *   node audit.mjs https://github.com/owner/repo
 *   node audit.mjs https://github.com/owner/repo --wait
 */

const API = 'https://marketnow.site/api/submit-skill';

async function main() {
  const repoUrl = process.argv[2];
  if (!repoUrl) {
    console.log('Usage: node audit.mjs <repo-url> [--wait]');
    console.log('Example: node audit.mjs https://github.com/owner/my-mcp-server');
    process.exit(1);
  }

  console.log(`MarketNow Security Audit`);
  console.log(`========================`);
  console.log(`Repository: ${repoUrl}`);
  console.log();

  // Submit
  console.log('Submitting...');
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo_url: repoUrl,
      submitter_agent_id: 'marketnow-cli',
    }),
  });

  const result = await res.json();

  if (result.error) {
    console.error(`Error: ${result.error}`);
    if (result.message) console.error(result.message);
    process.exit(1);
  }

  console.log(`  Status: ${result.status}`);
  console.log(`  Submission ID: ${result.submission_id}`);
  console.log(`  Skill ID: ${result.skill_id}`);
  console.log(`  L1.5 Score: ${result.audit?.l15_score}/10`);
  console.log(`  L2 Status: ${result.audit?.l2_status}`);
  console.log();

  if (result.ledger_url) {
    console.log(`Ledger: ${result.ledger_url}`);
  }
  console.log(`Check status: https://marketnow.site/api/submit-skill?submission_id=${result.submission_id}`);
  console.log();

  // Wait for L2 if --wait flag
  if (process.argv.includes('--wait')) {
    console.log('Waiting for L2 sandbox audit (~2 min)...');
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 10000));
      const statusRes = await fetch(`https://marketnow.site/api/submit-skill?submission_id=${result.submission_id}`);
      const status = await statusRes.json();
      if (status.status === 'promoted') {
        console.log(`\n🎉 PROMOTED! Score: ${status.audit?.overall_score}/10`);
        console.log(`ATC: ${status.atc_card_id}`);
        console.log(`Verify: https://marketnow.site/api/atc?action=verify&card_id=${status.atc_card_id}`);
        return;
      }
      if (status.status === 'l2_failed' || status.status === 'l2_low_score') {
        console.log(`\n❌ ${status.status}: ${status.audit?.l2_failure_reason || 'score too low'}`);
        return;
      }
      process.stdout.write('.');
    }
    console.log('\nTimed out waiting for L2. Check later.');
  } else {
    console.log('L2 audit queued. Check status in ~2 min.');
  }
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
