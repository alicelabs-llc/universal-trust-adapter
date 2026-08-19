#!/usr/bin/env node
/**
 * MarketNow — ATC Index Generator
 * =================================
 *
 * Reads all ATC files from _data/atc/ and creates _index.json
 * with a summary of each ATC (card_id, status, agent_id, score, etc.)
 *
 * This reduces listATCs() from 58 API calls to 1 API call.
 *
 * Run:
 *   MANDATES_GITHUB_TOKEN=xxx node scripts/generate-atc-index.mjs
 *
 * Or automatically via GitHub Actions (hourly).
 */

const GITHUB_TOKEN = process.env.MANDATES_GITHUB_TOKEN || process.env.GH_TOKEN;
const REPO = process.env.MANDATES_REPO || 'alicelabs-llc/marketnow';
const BRANCH = 'master';
const ATC_DIR = '_data/atc';

if (!GITHUB_TOKEN) {
  console.error('ERROR: Set MANDATES_GITHUB_TOKEN or GH_TOKEN env var');
  process.exit(1);
}

async function ghGet(path) {
  const url = `https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'marketnow-index',
    },
  });
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${await r.text()}`);
  return r.json();
}

async function ghPut(path, content, message, sha = null) {
  const body = {
    message,
    content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;
  
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'marketnow-index',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`GitHub PUT ${r.status}: ${await r.text()}`);
  return r.json();
}

async function main() {
  console.log('Generating ATC index...');
  
  // List all ATC files
  const files = await ghGet(ATC_DIR);
  const atcFiles = files.filter(f => f.type === 'file' && f.name.startsWith('ATC-') && f.name.endsWith('.json'));
  console.log(`Found ${atcFiles.length} ATC files`);
  
  // Fetch each ATC and build index
  const index = {
    version: 1,
    updated_at: new Date().toISOString(),
    total: atcFiles.length,
    cards: [],
  };
  
  for (let i = 0; i < atcFiles.length; i++) {
    const f = atcFiles[i];
    try {
      const meta = await ghGet(`${ATC_DIR}/${f.name}`);
      const content = Buffer.from(meta.content, 'base64').toString('utf8');
      const atc = JSON.parse(content);
      
      index.cards.push({
        card_id: atc.card_id,
        status: atc.status || 'active',
        agent_id: atc.payload?.agent_id,
        agent_name: atc.payload?.agent_name,
        sentinel_review_score: atc.payload?.trust?.sentinel_review_score ?? atc.payload?.trust?.sentinel_score ?? 0,
        sentinel_score: atc.payload?.trust?.sentinel_review_score ?? atc.payload?.trust?.sentinel_score ?? 0,
        risk_level: atc.payload?.trust?.risk_level || 'unknown',
        issued_at: atc.payload?.metadata?.issued_at,
        expires_at: atc.payload?.metadata?.expires_at,
      });
      
      process.stdout.write(`\r  [${i + 1}/${atcFiles.length}] ${atc.card_id}`);
    } catch (e) {
      console.error(`\n  ERROR ${f.name}: ${e.message}`);
    }
    
    // Small delay to avoid rate limit
    if (i % 10 === 9) await new Promise(r => setTimeout(r, 500));
  }
  
  console.log(`\n\nIndex: ${index.total} cards`);
  console.log(`  Active: ${index.cards.filter(c => c.status === 'active').length}`);
  console.log(`  Revoked: ${index.cards.filter(c => c.status === 'revoked').length}`);
  
  // Upload index to GitHub
  let sha = null;
  try {
    const existing = await ghGet(`${ATC_DIR}/_index.json`);
    sha = existing.sha;
  } catch {}
  
  await ghPut(`${ATC_DIR}/_index.json`, index, `update ATC index (${index.total} cards)`, sha);
  console.log('✓ Index uploaded to GitHub');
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
