#!/usr/bin/env node
/**
 * scan_verify.cjs — Real Sentinel L0 scan for all 9,248 skills
 * 
 * What this does:
 *   1. Reads skills_index.json
 *   2. For each skill, verifies its directory on disk
 *   3. Runs lightweight checks: README exists, install command valid, no placeholder
 *   4. Assigns a REAL sentinel_score (0-8) based on actual file evidence
 */
const fs = require('fs');
const path = require('path');
const SKILLS_DIR = 'D:\\skills git';

const index = JSON.parse(fs.readFileSync('public/api/skills_index.json', 'utf-8'));
console.log(`Loaded ${index.length} skills. Scanning directories...\n`);

const CHECKS = [
  { id: 1, name: 'directory_exists' },
  { id: 2, name: 'has_readme' },
  { id: 3, name: 'has_package_json_or_pyproject' },
  { id: 4, name: 'has_smithery_yaml' },
  { id: 5, name: 'has_valid_install_cmd' },
  { id: 6, name: 'desc_minimum' },
  { id: 7, name: 'no_placeholder_install' },
  { id: 8, name: 'has_tags' },
];

const MIN_README_BYTES = 50;
const MIN_DESC_CHARS = 20;

let results = [];
let passedCounts = {};

let batch = [];
const BATCH_SIZE = 100;

for (let i = 0; i < index.length; i++) {
  const s = index[i];
  const dirName = s.slug || s.id;
  const dirPath = path.join(SKILLS_DIR, dirName);

  const checkResults = {};

  // 1. Directory exists
  const dirOk = fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  checkResults[1] = dirOk;

  // 2. Has README
  let readmeOk = false;
  if (dirOk) {
    for (const r of ['README.md', 'readme.md', 'README', 'Readme.md']) {
      const rp = path.join(dirPath, r);
      if (fs.existsSync(rp) && fs.statSync(rp).size > MIN_README_BYTES) {
        readmeOk = true;
        break;
      }
    }
  }
  checkResults[2] = readmeOk;

  // 3. Has package.json or pyproject.toml
  let pkgOk = false;
  if (dirOk) {
    pkgOk = fs.existsSync(path.join(dirPath, 'package.json')) ||
            fs.existsSync(path.join(dirPath, 'pyproject.toml')) ||
            fs.existsSync(path.join(dirPath, 'setup.py')) ||
            fs.existsSync(path.join(dirPath, 'Cargo.toml')) ||
            fs.existsSync(path.join(dirPath, 'go.mod')) ||
            fs.existsSync(path.join(dirPath, 'composer.json'));
  }
  checkResults[3] = pkgOk;

  // 4. Has smithery.yaml
  let smithOk = false;
  if (dirOk) {
    smithOk = fs.existsSync(path.join(dirPath, 'smithery.yaml'));
  }
  checkResults[4] = smithOk;

  // 5. Has valid install command (not empty, not placeholder)
  let installOk = false;
  if (s.install && s.install.trim()) {
    const cmd = s.install.trim();
    installOk = !cmd.startsWith('#') && cmd !== '' && !cmd.includes('See README') && !cmd.includes('see readme');
  }
  checkResults[5] = installOk;

  // 6. Description minimum
  const descOk = s.shortDesc && s.shortDesc.length > MIN_DESC_CHARS;
  checkResults[6] = descOk;

  // 7. No placeholder install (separate from #5 for score)
  let noPlaceholder = !s.install || (
    s.install && !s.install.includes('# See README') &&
    !s.install.includes('# See') && !s.install.includes('# Check')
  );
  checkResults[7] = noPlaceholder;

  // 8. Has tags
  const tagsOk = s.tags && Array.isArray(s.tags) && s.tags.length > 0;
  checkResults[8] = tagsOk;

  const score = Object.values(checkResults).filter(Boolean).length;
  for (const [k, v] of Object.entries(checkResults)) {
    if (v) passedCounts[k] = (passedCounts[k] || 0) + 1;
  }

  results.push({
    id: s.id,
    name: s.name,
    slug: s.slug,
    sentinel_score: score,
    checks: checkResults,
  });

  batch.push(results[results.length - 1]);

  if (batch.length >= BATCH_SIZE || i === index.length - 1) {
    // Progress
    if ((i + 1) % 1000 === 0 || i === index.length - 1) {
      const pct = ((i + 1) / index.length * 100).toFixed(1);
      process.stdout.write(`\r  Scanned ${i + 1}/${index.length} (${pct}%) — current 8/8: ${batch.filter(r => r.sentinel_score === 8).length}`);
    }
  }
}

// Summary
console.log('\n\n=== REAL SENTINEL SCAN RESULTS ===');
console.log(`Total scanned: ${index.length}`);
console.log('');

const pass5 = results.filter(r => r.sentinel_score >= 5).length;
const pass8 = results.filter(r => r.sentinel_score === 8).length;
const avgScore = (results.reduce((a, r) => a + r.sentinel_score, 0) / results.length).toFixed(2);

for (let score = 8; score >= 0; score--) {
  const count = results.filter(r => r.sentinel_score === score).length;
  const pct = (count / index.length * 100).toFixed(1);
  console.log(`  Score ${score}/8: ${count} skills (${pct}%)`);
}

console.log(`\nAverage Sentinel Score: ${avgScore}/8`);
console.log(`Skills with 5+ checks passed: ${pass5} (${(pass5/index.length*100).toFixed(1)}%)`);
console.log(`Fully verified (8/8): ${pass8} (${(pass8/index.length*100).toFixed(1)}%)`);
console.log('');

console.log('=== CHECKS BREAKDOWN ===');
for (const c of CHECKS) {
  const passed = passedCounts[c.id] || 0;
  console.log(`  ${c.id}. ${c.name}: ${passed}/${index.length} (${(passed/index.length*100).toFixed(1)}%)`);
}

// Write results
fs.writeFileSync('public/api/sentinel_scan.json', JSON.stringify(results, null, 2));
console.log(`\n✅ Results written to public/api/sentinel_scan.json`);
