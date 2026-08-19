#!/usr/bin/env node
/**
 * Lightweight L2 batch dispatcher — doesn't load full catalog into memory.
 * Reads only id + source.url, fires dispatches with minimal delay.
 */
import fs from 'fs';
import path from 'path';

const GITHUB_TOKEN = process.env.MANDATES_GITHUB_TOKEN;
const REPO = 'edgarfloresguerra2011-a11y/marketnow';
const SKILLS_PATH = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'aep-marketplace', 'public', 'api', 'skills_index.json');

// Read only what we need
console.log('Loading catalog (reading only id + source.url)...');
const raw = fs.readFileSync(SKILLS_PATH, 'utf8');
const allSkills = JSON.parse(raw);
const eligible = allSkills
  .filter(s => s.source?.url && s.source.url.includes('github.com'))
  .map(s => ({ id: s.id, url: s.source.url }));
// Free memory
allSkills.length = 0;

console.log(`Found ${eligible.length} L2-eligible skills.`);

// Check existing results
const resultsDir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '_data', 'l2_results');
const existing = new Set();
try {
  for (const f of fs.readdirSync(resultsDir)) {
    if (f.endsWith('.json')) existing.add(f.replace(/\.json$/, ''));
  }
} catch {}
console.log(`${existing.size} already have L2 results.`);

let dispatched = 0, skipped = 0, failed = 0;
const DELAY_MS = 1000; // 1s between dispatches (was 5s)

for (const skill of eligible) {
  if (existing.has(skill.id)) {
    skipped++;
    continue;
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
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
          skill_id: skill.id,
          repo_url: skill.url,
          triggered_at: new Date().toISOString(),
        },
      }),
    });

    if (res.status === 204) {
      dispatched++;
      if (dispatched % 50 === 0) {
        console.log(`  Progress: ${dispatched} dispatched, ${skipped} skipped, ${failed} failed`);
      }
    } else {
      failed++;
    }
  } catch {
    failed++;
  }

  // Minimal delay
  if (DELAY_MS > 0) await new Promise(r => setTimeout(r, DELAY_MS));
}

console.log(`\n=== COMPLETE ===`);
console.log(`Dispatched: ${dispatched}`);
console.log(`Skipped: ${skipped}`);
console.log(`Failed: ${failed}`);
console.log(`Total processed: ${dispatched + skipped + failed}/${eligible.length}`);
