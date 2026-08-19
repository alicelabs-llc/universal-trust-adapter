#!/usr/bin/env node
/**
 * MarketNow — Sync ATC Static Files
 * ==================================
 *
 * Reads all ATC files from _data/atc/ (local repo) and creates:
 *   1. _data/atc/_index.json         — summary index (committed to repo)
 *   2. aep-marketplace/public/api/atc-index.json  — static file served by Vercel
 *   3. aep-marketplace/public/api/atc/ATC-*.json   — individual ATC static files
 *
 * This script runs locally AND in GitHub Actions. After committing changes,
 * a Vercel deploy will automatically pick up the updated static files.
 *
 * Why: GitHub shadowbanned the account edgarfloresguerra2011-a11y, so
 * raw.githubusercontent.com returns 404 even for public repos. The Vercel
 * serverless function reads from these static files instead of GitHub.
 *
 * Run locally:
 *   node scripts/sync-atc-static.mjs
 *
 * Run in CI (after generate-atc-index.mjs):
 *   node scripts/sync-atc-static.mjs
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const ATC_DATA_DIR = join(ROOT, '_data', 'atc');
const RECEIPTS_DATA_DIR = join(ROOT, '_data', 'receipts');
const PUBLIC_API_DIR = join(ROOT, 'aep-marketplace', 'public', 'api');
const PUBLIC_ATC_DIR = join(PUBLIC_API_DIR, 'atc');
const PUBLIC_RECEIPTS_DIR = join(PUBLIC_API_DIR, 'receipts');

function main() {
  console.log('=== MarketNow Static File Sync ===\n');

  // 1. Ensure public/api/atc/ and public/api/receipts/ exist
  mkdirSync(PUBLIC_ATC_DIR, { recursive: true });
  mkdirSync(PUBLIC_RECEIPTS_DIR, { recursive: true });
  console.log(`✓ Ensured ${PUBLIC_ATC_DIR} exists`);
  console.log(`✓ Ensured ${PUBLIC_RECEIPTS_DIR} exists`);

  // ── ATCs ──
  const allAtcFiles = readdirSync(ATC_DATA_DIR);
  const atcFiles = allAtcFiles.filter(f => f.startsWith('ATC-') && f.endsWith('.json'));
  console.log(`\n✓ Found ${atcFiles.length} ATC files in _data/atc/`);

  const index = {
    version: 1,
    updated_at: new Date().toISOString(),
    total: atcFiles.length,
    cards: [],
  };

  let copied = 0;
  for (const fileName of atcFiles) {
    const srcPath = join(ATC_DATA_DIR, fileName);
    const dstPath = join(PUBLIC_ATC_DIR, fileName);

    try {
      const content = readFileSync(srcPath, 'utf8');
      const atc = JSON.parse(content);

      copyFileSync(srcPath, dstPath);
      copied++;

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
    } catch (e) {
      console.error(`  ✗ ERROR ${fileName}: ${e.message}`);
    }
  }

  console.log(`✓ Copied ${copied}/${atcFiles.length} ATC files to public/api/atc/`);

  // Write _index.json
  const indexPath = join(ATC_DATA_DIR, '_index.json');
  writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
  console.log(`✓ Wrote _data/atc/_index.json (${index.total} cards)`);

  // Write static atc-index.json
  const staticIndexPath = join(PUBLIC_API_DIR, 'atc-index.json');
  writeFileSync(staticIndexPath, JSON.stringify(index, null, 2) + '\n');
  console.log(`✓ Wrote public/api/atc-index.json (static)`);

  // ── Receipts ──
  let receiptsCopied = 0;
  if (existsSync(RECEIPTS_DATA_DIR)) {
    const allReceiptFiles = readdirSync(RECEIPTS_DATA_DIR);
    const receiptFiles = allReceiptFiles.filter(f => f.startsWith('rcpt_') && f.endsWith('.json'));
    console.log(`\n✓ Found ${receiptFiles.length} receipts in _data/receipts/`);

    for (const fileName of receiptFiles) {
      const srcPath = join(RECEIPTS_DATA_DIR, fileName);
      const dstPath = join(PUBLIC_RECEIPTS_DIR, fileName);
      try {
        copyFileSync(srcPath, dstPath);
        receiptsCopied++;
      } catch (e) {
        console.error(`  ✗ ERROR ${fileName}: ${e.message}`);
      }
    }
    console.log(`✓ Copied ${receiptsCopied}/${receiptFiles.length} receipts to public/api/receipts/`);
  }

  // ── Summary ──
  console.log('\n=== Summary ===');
  console.log(`ATCs: ${index.total} (${copied} static files)`);
  console.log(`  Active: ${index.cards.filter(c => c.status === 'active').length}`);
  console.log(`  Revoked: ${index.cards.filter(c => c.status === 'revoked').length}`);
  console.log(`Receipts: ${receiptsCopied} static files`);
  console.log(`Total static files: ${copied + receiptsCopied + 1}`);
  console.log('\n✓ Done. Commit and deploy to Vercel to make changes live.');
}

main();
