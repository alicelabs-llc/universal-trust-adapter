#!/usr/bin/env node
/**
 * Generate a compact search index from skills.json.
 * Output: public/api/search-index.json (~1-2MB instead of 22MB)
 * 
 * Format: [{ i: id, n: name, s: slug, c: category, d: description(200), 
 *           ss: sentinel_score, r: risk_level, t: tags }]
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const skillsPath = join(ROOT, 'aep-marketplace', 'public', 'api', 'skills.json');
const outputPath = join(ROOT, 'aep-marketplace', 'public', 'api', 'search-index.json');

console.log('Loading skills.json...');
const skills = JSON.parse(readFileSync(skillsPath, 'utf8'));
console.log(`Loaded ${skills.length} skills`);

const index = skills.map(s => ({
  i: s.id,
  n: s.name,
  s: s.slug,
  c: s.category,
  d: (s.description || '').slice(0, 200),
  ss: s.sentinel_score || 0,
  r: s.risk_level || 'unknown',
  t: (s.tags || []).slice(0, 5),
}));

const output = JSON.stringify(index);
writeFileSync(outputPath, output);
console.log(`✓ Wrote search-index.json (${(output.length / 1024 / 1024).toFixed(1)}MB)`);
