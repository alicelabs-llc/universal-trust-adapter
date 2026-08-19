#!/usr/bin/env node
/**
 * ⚠️ SENTINEL PROPRIETARY — Copyright (c) 2026 AliceLabs LLC. All Rights Reserved.
 *
 * MarketNow — Auto-Discovery & Synthetic Replacement Engine
 * =================================================================
 *
 * This script runs automatically (weekly cron via GitHub Actions) to:
 *
 *   1. DISCOVER: Fetch MCP servers from multiple sources:
 *      - awesome-mcp-servers README (all repos, no star filter)
 *      - GitHub Search API (topic:mcp-server, topic:model-context-protocol)
 *      - GitHub Search API (description contains "mcp server")
 *
 *   2. DEDUP: Skip repos already in catalog (by source.url match)
 *
 *   3. IMPORT: Add new real MCP servers with full metadata from GitHub API
 *      (stars, language, description, license, last updated)
 *
 *   4. REPLACE: For synthetic skills (mn-gen-*, mn-sec-*, etc.) that have
 *      a real counterpart (matched by name similarity), replace the
 *      synthetic entry with the real one — keeping the same skill ID
 *      so existing links/certificates don't break.
 *
 *   5. MARK: For synthetic skills WITHOUT a real counterpart, mark them
 *      as `synthetic: true` so the UI can show "synthetic — no real repo"
 *      honestly.
 *
 *   6. OUTPUT: Updated skills_index.json + a report of what changed.
 *
 * Usage:
 *   node scripts/auto-discover-mcp.mjs                    # full run
 *   node scripts/auto-discover-mcp.mjs --source awesome   # only awesome-mcp
 *   node scripts/auto-discover-mcp.mjs --source github    # only GitHub search
 *   node scripts/auto-discover-mcp.mjs --dry-run          # report only, no writes
 *   node scripts/auto-discover-mcp.mjs --max 100          # limit new imports
 *
 * Env:
 *   GITHUB_TOKEN — required for GitHub API
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// L1.7 import: blocks skills whose metadata matches malware patterns
// (e.g. "Download Latest Release" badges pointing to external zips).
// This prevents typosquatting repos from entering the catalog.
import { runL17, MALWARE_PATTERNS } from '../aep-marketplace/lib/sentinel-l17.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.join(__dirname, '..');
const SKILLS_PATH = path.join(REPO_ROOT, 'aep-marketplace', 'public', 'api', 'skills_index.json');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.MANDATES_GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.error('✗ GITHUB_TOKEN env var required');
  process.exit(1);
}

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SOURCE_FILTER = args.includes('--source') ? args[args.indexOf('--source') + 1] : null;
const MAX_ARG = args.indexOf('--max');
const MAX_NEW = MAX_ARG > -1 ? parseInt(args[MAX_ARG + 1], 10) : 0;

const stats = {
  discovered_awesome: 0,
  discovered_github: 0,
  already_in_catalog: 0,
  imported: 0,
  replaced: 0,
  marked_synthetic: 0,
  total_before: 0,
  total_after: 0,
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. LOAD EXISTING CATALOG
// ═══════════════════════════════════════════════════════════════════════════

console.log('MarketNow — Auto-Discovery & Synthetic Replacement');
console.log('===================================================\n');

const skills = JSON.parse(fs.readFileSync(SKILLS_PATH, 'utf8'));
stats.total_before = skills.length;
console.log(`Loaded ${skills.length} existing skills.`);

// Build lookup sets
const existingUrls = new Set();
const existingRepos = new Set(); // "owner/repo" format
const syntheticSkills = []; // skills that are synthetic (mn-gen, mn-sec, etc. without real source.url)

for (const s of skills) {
  if (s.source?.url?.includes('github.com')) {
    existingUrls.add(s.source.url);
    const match = s.source.url.match(/github\.com\/([^/]+\/[^/]+)/);
    if (match) existingRepos.add(match[1].toLowerCase());
  } else if (s.id?.startsWith('mn-gen-') || s.id?.startsWith('mn-sec-') || s.id?.startsWith('mn-ai-') ||
             s.id?.startsWith('mn-dat-') || s.id?.startsWith('mn-res-') || s.id?.startsWith('mn-net-') ||
             s.id?.startsWith('mn-sal-') || s.id?.startsWith('mn-arl-') || s.id?.startsWith('mn-leg-') ||
             s.id?.startsWith('mn-asf-') || s.id?.startsWith('mn-apf-') || s.id?.startsWith('mn-atu-') ||
             s.id?.startsWith('mn-acm-') || s.id?.startsWith('mn-apd-') || s.id?.startsWith('mn-hea-') ||
             s.id?.startsWith('mn-web-') || s.id?.startsWith('mn-edte-') || s.id?.startsWith('mn-prop-') ||
             s.id?.startsWith('mn-blo-') || s.id?.startsWith('mn-code-') || s.id?.startsWith('mn-comm-') ||
             s.id?.startsWith('mn-data-') || s.id?.startsWith('mn-file-') || s.id?.startsWith('mn-auto-') ||
             s.id?.startsWith('mn-fint-') || s.id?.startsWith('mn-edu-') || s.id?.startsWith('mn-prod-') ||
             s.id?.startsWith('mn-soci-') || s.id?.startsWith('mn-lega-') || s.id?.startsWith('mn-heal-') ||
             s.id?.startsWith('mn-hrt-') || s.id?.startsWith('mn-voi-') || s.id?.startsWith('mn-clim-') ||
             s.id?.startsWith('mn-devo-') || s.id?.startsWith('mn-sale-') || s.id?.startsWith('mn-mark-') ||
             s.id?.startsWith('mn-seller-') || s.id?.startsWith('mn-sys-') || s.id?.startsWith('mn-aut-') ||
             s.id?.startsWith('mn-med-') || s.id?.startsWith('mn-dev-') || s.id?.startsWith('mn-fin-') ||
             s.id?.startsWith('mn-ana-') || s.id?.startsWith('mn-mar-') || s.id?.startsWith('mn-com-') ||
             s.id?.startsWith('mn-mes-') || s.id?.startsWith('mn-iot-')) {
    if (!s.source?.url?.includes('github.com')) {
      syntheticSkills.push(s);
    }
  }
}

console.log(`Existing GitHub repos in catalog: ${existingRepos.size}`);
console.log(`Synthetic skills (no real repo): ${syntheticSkills.length}`);
console.log(`Prompt-only skills (L2 N/A): ${skills.filter(s => s.id?.startsWith('mn-prompt-')).length}`);
console.log('');

// ═══════════════════════════════════════════════════════════════════════════
// 2. DISCOVER FROM awesome-mcp-servers
// ═══════════════════════════════════════════════════════════════════════════

async function discoverFromAwesome() {
  if (SOURCE_FILTER && SOURCE_FILTER !== 'awesome') return [];

  console.log('📡 Fetching awesome-mcp-servers README...');
  try {
    const res = await fetch('https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/README.md');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const readme = await res.text();

    const repos = [...new Set(
      [...readme.matchAll(/https:\/\/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)/g)]
        .map(m => `${m[1]}/${m[2]}`)
        .filter(r => !r.endsWith('.md') && !r.endsWith('.png') && !r.endsWith('.svg'))
    )];

    stats.discovered_awesome = repos.length;
    console.log(`  Found ${repos.length} repos in awesome-mcp-servers`);
    return repos;
  } catch (e) {
    console.error(`  ✗ Failed to fetch awesome-mcp-servers: ${e.message}`);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. DISCOVER FROM GitHub Search API
// ═══════════════════════════════════════════════════════════════════════════

async function discoverFromGitHubSearch() {
  if (SOURCE_FILTER && SOURCE_FILTER !== 'github') return [];

  console.log('📡 Searching GitHub for MCP servers...');
  const allRepos = [];

  const queries = [
    'topic:mcp-server',
    'topic:model-context-protocol',
    'mcp-server in:name,description',
    'model context protocol in:name,description',
  ];

  for (const q of queries) {
    try {
      let page = 1;
      while (page <= 5) { // max 5 pages = 250 results per query
        const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=50&page=${page}`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'marketnow-discovery',
          },
        });

        if (!res.ok) {
          console.log(`  Query "${q}" page ${page}: HTTP ${res.status}, skipping`);
          break;
        }

        const data = await res.json();
        if (!data.items || data.items.length === 0) break;

        for (const item of data.items) {
          allRepos.push({
            full_name: item.full_name,
            description: item.description,
            stars: item.stargazers_count,
            language: item.language,
            license: item.license?.spdx_id,
            html_url: item.html_url,
            default_branch: item.default_branch,
            pushed_at: item.pushed_at,
            archived: item.archived,
            topics: item.topics || [],
          });
        }

        if (data.items.length < 50) break; // no more pages
        page++;
        // Rate limit: sleep between pages
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (e) {
      console.error(`  Query "${q}" failed: ${e.message}`);
    }
  }

  // Dedup by full_name
  const seen = new Set();
  const unique = allRepos.filter(r => {
    const key = r.full_name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  stats.discovered_github = unique.length;
  console.log(`  Found ${unique.length} unique repos from GitHub Search`);
  return unique;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. FETCH METADATA FOR A REPO
// ═══════════════════════════════════════════════════════════════════════════

async function fetchRepoMetadata(ownerSlashRepo) {
  const url = `https://api.github.com/repos/${ownerSlashRepo}`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'marketnow-discovery',
      },
    });
    if (res.status === 404) return null;
    if (res.status === 403) {
      await new Promise(r => setTimeout(r, 5000));
      return fetchRepoMetadata(ownerSlashRepo);
    }
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. BUILD SKILL OBJECT FROM REPO METADATA
// ═══════════════════════════════════════════════════════════════════════════

function buildSkillFromRepo(meta) {
  const [owner, name] = meta.full_name.split('/');
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const skillId = `mn-real-${slug.replace(/-/g, '').slice(0, 20)}`;

  // Category heuristic
  const desc = (meta.description || '').toLowerCase();
  const topics = (meta.topics || []).join(' ').toLowerCase();
  const allText = desc + ' ' + topics;
  let category = 'Developer Tools';
  const cats = [
    ['browser|playwright|puppeteer|selenium|chrome', 'Browser Automation'],
    ['database|sql|postgres|mysql|sqlite|mongo|redis', 'Data'],
    ['file|filesystem', 'File System'],
    ['git|github|gitlab', 'Version Control'],
    ['slack|discord|telegram|whatsapp', 'Communication'],
    ['search|google|bing|brave', 'Search'],
    ['memory|knowledge|graph|rag|embed', 'AI/ML'],
    ['stripe|payment|finance|bank|crypto|blockchain', 'Finance'],
    ['weather|news|rss', 'Web APIs'],
    ['security|auth|oauth|jwt', 'Security'],
    ['cloud|aws|azure|gcp', 'Cloud Platforms'],
    ['monitoring|metrics|logs|observability', 'Monitoring'],
  ];
  for (const [pat, cat] of cats) {
    if (new RegExp(pat).test(allText)) { category = cat; break; }
  }

  const language = meta.language || 'Unknown';
  let install;
  if (language === 'Python') install = `pip install ${name} || uvx ${name}`;
  else if (language === 'Go') install = `go install github.com/${meta.full_name}`;
  else if (language === 'Rust') install = `cargo install ${name}`;
  else install = `npx -y ${name}`;

  return {
    id: skillId,
    name: name,
    slug: `real-${slug}`,
    description: (meta.description || `MCP server from ${owner}/${name}`).slice(0, 300),
    category,
    tags: ['mcp', 'real', language.toLowerCase(), owner.toLowerCase(), ...(meta.topics || []).slice(0, 5)],
    price: 0, currency: 'USD', payment: 'free',
    license: meta.license?.spdx_id || 'See repo',
    verified: false,
    sentinel_score: 7,
    install,
    author: owner,
    version: '1.0.0',
    doc: {
      setup: { required_env: [], install, estimated_cost: 'free' },
      usage: `agent.call('real-${slug}', { ... })`,
      system_prompt: `# ${name}\n\n## Source\n${meta.html_url}\n\n## Description\n${meta.description || '(no description)'}\n\n## Stars\n${meta.stargazers_count}\n\n## Language\n${language}\n`,
    },
    capabilities: {
      execution_context: 'local_runtime',
      requires_auth: false,
      requires_network: /http|api|webhook/i.test(desc),
      input_types: ['json'],
      output_types: ['json', 'text'],
    },
    sentinel: { scanned_at: new Date().toISOString(), scan_version: 'L1.5+L1.6+L1.7', warnings: [] },
    source: {
      type: 'github',
      url: meta.html_url,
      note: `Real MCP server. ${meta.stargazers_count} stars. Language: ${language}. Last push: ${meta.pushed_at}. Discovered via auto-discovery.`,
      stars: meta.stargazers_count,
      language,
      last_push: meta.pushed_at,
    },
    l2_eligible: true,
    synthetic: false,
    discovered_at: new Date().toISOString(),
    discovered_by: 'auto-discover-mcp.mjs',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. NAME MATCHING — find synthetic skills that match real repos
// ═══════════════════════════════════════════════════════════════════════════

function normalizeName(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/mc(p|pserver)|server/g, '');
}

function findSyntheticMatch(realRepo, synthetics) {
  const realName = normalizeName(realRepo.name || realRepo.full_name?.split('/')[1] || '');
  if (!realName) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const syn of synthetics) {
    const synName = normalizeName(syn.name || syn.id || '');
    if (!synName) continue;

    // Exact match
    if (synName === realName) {
      return syn; // perfect match, return immediately
    }

    // Contains match (one contains the other)
    if (synName.length > 3 && realName.length > 3) {
      if (synName.includes(realName) || realName.includes(synName)) {
        const score = Math.min(synName.length, realName.length) / Math.max(synName.length, realName.length);
        if (score > bestScore && score > 0.6) {
          bestScore = score;
          bestMatch = syn;
        }
      }
    }
  }

  return bestMatch;
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. MAIN
// ═══════════════════════════════════════════════════════════════════════════

(async () => {
  // Discover from all sources
  const awesomeRepos = await discoverFromAwesome();
  const githubRepos = await discoverFromGitHubSearch();

  // Merge: combine repo names from both sources
  const allRepoNames = new Set([
    ...awesomeRepos,
    ...githubRepos.map(r => r.full_name),
  ]);

  console.log(`\nTotal unique repos discovered: ${allRepoNames.size}`);

  // Filter out repos already in catalog
  const newRepos = [...allRepoNames].filter(r => !existingRepos.has(r.toLowerCase()));
  console.log(`Already in catalog: ${allRepoNames.size - newRepos.length}`);
  console.log(`New repos to import: ${newRepos.length}`);
  stats.already_in_catalog = allRepoNames.size - newRepos.length;

  // Limit if --max
  if (MAX_NEW > 0 && newRepos.length > MAX_NEW) {
    console.log(`Limiting to ${MAX_NEW} new imports (--max flag)`);
    newRepos.length = MAX_NEW;
  }

  // Fetch metadata for new repos (in batches of 10)
  console.log(`\nFetching metadata for ${newRepos.length} new repos...\n`);

  let imported = 0;
  let batchNum = 0;
  const newSkills = [];
  const replacements = []; // {synthetic_id, real_skill}
  const blocked = []; // {repo, reason, patterns} — L1.7 quarantine blocks

  for (let i = 0; i < newRepos.length; i += 10) {
    const batch = newRepos.slice(i, i + 10);
    batchNum++;

    const metas = await Promise.all(batch.map(r => fetchRepoMetadata(r)));

    for (const meta of metas) {
      if (!meta) continue;
      if (meta.archived) continue; // skip archived repos

      const skill = buildSkillFromRepo(meta);

      // ─── L1.7 PRE-IMPORT MALWARE SCAN ────────────────────────────────
      // Run L1.7 against the skill metadata BEFORE importing. If L1.7
      // recommends quarantine, skip the skill entirely and log it.
      // This prevents typosquatting repos (e.g. README promoting external
      // zip downloads) from entering the catalog in the first place.
      // See: incident #9 (prospector-email-finder trojan, July 2026).
      try {
        const l17 = await runL17(skill);
        if (l17.quarantine_recommended) {
          console.log(`  🚨 BLOCKED by L1.7: ${meta.full_name} — ${l17.findings.malware_patterns.length} malware pattern(s), ${l17.findings.binary_files.length} binary file(s)`);
          blocked.push({
            repo: meta.full_name,
            reason: 'L1.7 quarantine recommended',
            patterns: l17.findings.malware_patterns.map(p => p.id),
          });
          continue;
        }
      } catch (e) {
        // L1.7 itself failed — log but don't block (fail open for import,
        // batch audit will catch it later)
        console.error(`  ⚠ L1.7 scan failed for ${meta.full_name}: ${e.message}`);
      }

      // Check if this real repo matches a synthetic skill
      const match = findSyntheticMatch(meta, syntheticSkills);
      if (match) {
        // Replace the synthetic skill with the real one, keeping the same ID
        const oldId = match.id;
        skill.id = oldId; // keep the same ID so links/certs don't break
        skill.replaced_synthetic = true;
        skill.replaced_at = new Date().toISOString();

        // Find and replace in the skills array
        const idx = skills.findIndex(s => s.id === oldId);
        if (idx >= 0) {
          skills[idx] = skill;
          replacements.push({ synthetic_id: oldId, real_repo: meta.full_name });
          stats.replaced++;
          console.log(`  🔄 Replaced synthetic ${oldId} with real repo ${meta.full_name} (${meta.stargazers_count}★)`);
          continue;
        }
      }

      // No match — add as new skill
      newSkills.push(skill);
      stats.imported++;
    }

    if (batchNum % 10 === 0) {
      console.log(`  Processed ${Math.min(i + 10, newRepos.length)}/${newRepos.length} repos`);
    }
  }

  // Add all new skills
  skills.push(...newSkills);

  // Mark remaining synthetics as synthetic: true (honest disclosure)
  for (const s of skills) {
    if (s.id?.startsWith('mn-') && !s.id.startsWith('mn-prompt-') &&
        !s.id.startsWith('mn-mcp-') && !s.id.startsWith('mn-amcp-') &&
        !s.id.startsWith('mn-awmcp-') && !s.id.startsWith('mn-real-') &&
        !s.source?.url?.includes('github.com') && !s.replaced_synthetic) {
      s.synthetic = true;
      s.synthetic_note = 'This skill is catalog metadata only — no real GitHub repo. L2 sandbox audit not available. Certified with L1.5+L1.6 (static analysis only).';
      stats.marked_synthetic++;
    }
  }

  stats.total_after = skills.length;

  // Write updated catalog
  if (!DRY_RUN) {
    fs.writeFileSync(SKILLS_PATH, JSON.stringify(skills, null, 2));
    console.log(`\n✅ Updated skills_index.json`);
  } else {
    console.log(`\n[DRY RUN] No files written.`);
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`AUTO-DISCOVERY COMPLETE`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Catalog before:     ${stats.total_before}`);
  console.log(`Catalog after:      ${stats.total_after}`);
  console.log(`\nDiscovery sources:`);
  console.log(`  awesome-mcp-servers: ${stats.discovered_awesome} repos`);
  console.log(`  GitHub Search API:   ${stats.discovered_github} repos`);
  console.log(`  Already in catalog:  ${stats.already_in_catalog}`);
  console.log(`\nActions taken:`);
  console.log(`  New skills imported:   ${stats.imported}`);
  console.log(`  Synthetics replaced:   ${stats.replaced}`);
  console.log(`  Synthetics marked:     ${stats.marked_synthetic}`);
  console.log(`  🚨 Blocked by L1.7:    ${blocked.length} (malware/quarantine)`);
  if (blocked.length > 0) {
    console.log(`\nBlocked repos (L1.7 malware scan):`);
    for (const b of blocked) {
      console.log(`  - ${b.repo}  (${b.patterns.join(', ')})`);
    }
  }
  console.log(`\nNext steps (automated by workflow):`);
  console.log(`  1. Regenerate catalog (generate_skills.cjs)`);
  console.log(`  2. Trigger L2 batch for all new skills with source.url`);
  console.log(`  3. Regenerate certificates (audit-all-skills.mjs --force)`);
})();
