#!/usr/bin/env node
/**
 * ⚠️ SENTINEL PROPRIETARY — Copyright (c) 2026 AliceLabs LLC. All Rights Reserved.
 *
 * MarketNow — Resolve GitHub repos for ALL skills via npm registry
 * ====================================================================
 *
 * For every skill in the catalog:
 *   1. If source.url already exists → keep it
 *   2. If install has `npx -y <package>` → query npm registry for repo URL
 *   3. If skill is prompt-only (mn-prompt-*) → mark as L2 not_applicable
 *   4. Otherwise → try to find repo from skill name/description
 *
 * Output: updates skills_index.json with source.url for all resolvable skills
 *
 * Usage: node scripts/resolve-all-repos.mjs
 *        node scripts/resolve-all-repos.mjs --max 100  (limit for testing)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.join(__dirname, '..');
const SKILLS_PATH = path.join(REPO_ROOT, 'aep-marketplace', 'public', 'api', 'skills_index.json');

const args = process.argv.slice(2);
const MAX_ARG = args.indexOf('--max');
const MAX_SKILLS = MAX_ARG > -1 ? parseInt(args[MAX_ARG + 1], 10) : 0;

// In-memory cache for npm registry lookups (many skills share the same package)
const _npmCache = new Map();

async function resolveNpmRepo(packageName) {
  if (_npmCache.has(packageName)) {
    return _npmCache.get(packageName);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      _npmCache.set(packageName, null);
      return null;
    }

    const data = await res.json();
    const repo = data.repository;
    let repoUrl = null;

    if (repo) {
      if (typeof repo === 'string') {
        repoUrl = repo;
      } else if (repo.url) {
        repoUrl = repo.url;
      }
    }

    // Also check homepage and bugs fields
    if (!repoUrl && data.homepage) {
      if (data.homepage.includes('github.com')) {
        repoUrl = data.homepage;
      }
    }
    if (!repoUrl && data.bugs) {
      const bugsUrl = typeof data.bugs === 'string' ? data.bugs : data.bugs.url;
      if (bugsUrl && bugsUrl.includes('github.com')) {
        repoUrl = bugsUrl;
      }
    }

    // Normalize GitHub URL
    if (repoUrl) {
      // git+ssh://git@github.com:owner/repo.git → https://github.com/owner/repo
      repoUrl = repoUrl
        .replace('git+ssh://git@github.com:', 'https://github.com/')
        .replace('git+https://github.com/', 'https://github.com/')
        .replace('git://github.com/', 'https://github.com/')
        .replace('git@github.com:', 'https://github.com/')
        .replace(/\.git$/, '')
        .replace(/\/tree\/main$/, '')
        .replace(/\/$/, '');

      // Only keep if it's a GitHub URL
      if (!repoUrl.includes('github.com')) {
        repoUrl = null;
      }
    }

    _npmCache.set(packageName, repoUrl);
    return repoUrl;
  } catch (e) {
    _npmCache.set(packageName, null);
    return null;
  }
}

function extractPackageName(install) {
  if (!install) return null;
  // npx -y @marketnow/install <slug> → @marketnow/install
  // npx -y <package-name> → package-name
  const match = install.match(/npx\s+(?:-y\s+)?(@?[a-zA-Z0-9][a-zA-Z0-9/._-]*)/);
  return match ? match[1] : null;
}

(async () => {
  console.log('MarketNow — Resolve GitHub repos for ALL skills');
  console.log('================================================\n');

  const skills = JSON.parse(fs.readFileSync(SKILLS_PATH, 'utf8'));
  console.log(`Loaded ${skills.length} skills.`);

  let targets = skills;
  if (MAX_SKILLS > 0) {
    targets = skills.slice(0, MAX_SKILLS);
    console.log(`Limited to first ${MAX_SKILLS} skills.`);
  }

  const stats = {
    already_has_url: 0,
    resolved_via_npm: 0,
    prompt_only: 0,
    could_not_resolve: 0,
    total: targets.length,
  };

  // Collect all unique npm packages to resolve
  const packagesToResolve = new Map(); // packageName → [skill indices]
  for (let i = 0; i < targets.length; i++) {
    const skill = targets[i];

    // Already has source.url
    if (skill.source?.url && skill.source.url.includes('github.com')) {
      stats.already_has_url++;
      continue;
    }

    // Prompt-only skills — L2 doesn't apply
    if (skill.id?.startsWith('mn-prompt-')) {
      if (!skill.source) skill.source = {};
      skill.source = {
        type: 'prompt-only',
        url: null,
        note: 'Hand-curated system prompt. L2 sandbox audit is not applicable — this skill is text, not executable code.',
        l2_status: 'not_applicable',
      };
      stats.prompt_only++;
      continue;
    }

    // Try to resolve via npm
    const packageName = extractPackageName(skill.install);
    if (packageName) {
      if (!packagesToResolve.has(packageName)) {
        packagesToResolve.set(packageName, []);
      }
      packagesToResolve.get(packageName).push(i);
    } else {
      stats.could_not_resolve++;
    }
  }

  console.log(`\nPackages to resolve via npm registry: ${packagesToResolve.size} unique packages`);
  console.log(`Skills already with source.url: ${stats.already_has_url}`);
  console.log(`Prompt-only skills (L2 N/A): ${stats.prompt_only}`);
  console.log(`Skills without npm package: ${stats.could_not_resolve}`);

  // Resolve all unique packages
  console.log(`\nResolving ${packagesToResolve.size} unique npm packages...\n`);

  let batchNum = 0;
  const packageEntries = Array.from(packagesToResolve.entries());
  const BATCH_SIZE = 10;

  for (let i = 0; i < packageEntries.length; i += BATCH_SIZE) {
    const batch = packageEntries.slice(i, i + BATCH_SIZE);
    batchNum++;

    const results = await Promise.all(
      batch.map(async ([packageName, skillIndices]) => {
        const repoUrl = await resolveNpmRepo(packageName);
        return { packageName, repoUrl, skillIndices };
      })
    );

    // Apply results to skills
    for (const { packageName, repoUrl, skillIndices } of results) {
      for (const idx of skillIndices) {
        const skill = targets[idx];
        if (repoUrl) {
          if (!skill.source) skill.source = {};
          skill.source = {
            type: 'github',
            url: repoUrl,
            note: `Resolved via npm registry (package: ${packageName}). L2 sandbox audit eligible.`,
            l2_eligible: true,
          };
          stats.resolved_via_npm++;
        } else {
          if (!skill.source) skill.source = {};
          skill.source = {
            type: 'no-repo',
            url: null,
            note: `No GitHub repo found for npm package "${packageName}". L2 sandbox audit not available — certified with L1.5+L1.6 only.`,
            l2_eligible: false,
          };
          stats.could_not_resolve++;
        }
      }
    }

    if (batchNum % 10 === 0) {
      console.log(`  Batch ${batchNum}: ${Math.min(i + BATCH_SIZE, packageEntries.length)}/${packageEntries.length} packages resolved`);
    }
  }

  // Write updated skills_index.json
  fs.writeFileSync(SKILLS_PATH, JSON.stringify(skills, null, 2));

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESOLUTION COMPLETE`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total skills:          ${stats.total}`);
  console.log(`Already had source.url: ${stats.already_has_url}`);
  console.log(`Resolved via npm:      ${stats.resolved_via_npm}`);
  console.log(`Prompt-only (L2 N/A):  ${stats.prompt_only}`);
  console.log(`Could not resolve:     ${stats.could_not_resolve}`);
  console.log(`\n✅ Updated skills_index.json with resolved source.url values`);
  console.log(`\nNext steps:`);
  console.log(`  1. node aep-marketplace/generate_skills.cjs (regenerate derived files)`);
  console.log(`  2. node scripts/trigger-l2-batch.cjs (run L2 on all newly-resolved skills)`);
  console.log(`  3. node scripts/audit-all-skills.mjs --force (regenerate all certificates with L2)`);
})();
