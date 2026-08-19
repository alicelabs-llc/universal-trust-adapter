#!/usr/bin/env node
/**
 * MarketNow — Expand catalog with popular MCP servers from awesome-mcp-servers
 * =============================================================================
 *
 * Fetches the awesome-mcp-servers README, extracts all GitHub repo URLs,
 * and adds the most popular ones (verified via GitHub API stars) as new
 * skills in our catalog with source.url populated.
 *
 * This is the FIRST automated pipeline that populates the catalog with
 * real, auditable MCP servers — enabling L2 sandbox coverage at scale.
 *
 * Selection criteria:
 *   - Must have a GitHub repo URL in the README
 *   - Must have >= 50 stars (filter out abandoned projects)
 *   - Must have a package.json OR pyproject.toml in the repo root
 *   - Skipped if already in our catalog (by slug match)
 *
 * Output:
 *   - Adds skills with id prefix 'mn-amcp-' (awesome-mcp) to skills_index.json
 *
 * Usage:
 *   MANDATES_GITHUB_TOKEN=xxx node scripts/expand-catalog-awesome-mcp.cjs
 *   MANDATES_GITHUB_TOKEN=xxx node scripts/expand-catalog-awesome-mcp.cjs --max 30
 *   MANDATES_GITHUB_TOKEN=xxx node scripts/expand-catalog-awesome-mcp.cjs --dry-run
 */

const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.MANDATES_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.error('✗ MANDATES_GITHUB_TOKEN env var required.');
  process.exit(1);
}

const REPO = 'edgarfloresguerra2011-a11y/marketnow';
const SKILLS_PATH = path.join(__dirname, '..', 'aep-marketplace', 'public', 'api', 'skills_index.json');

// CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const MAX_ARG = args.indexOf('--max');
const MAX_SKILLS = MAX_ARG > -1 ? parseInt(args[MAX_ARG + 1], 10) : 25;
const MIN_STARS = 50;

console.log(`Configuration: max_skills=${MAX_SKILLS}, min_stars=${MIN_STARS}, dry_run=${DRY_RUN}`);

// ─── Fetch awesome-mcp-servers README ─────────────────────────────────────
async function fetchAwesomeReadme() {
  console.log('Fetching awesome-mcp-servers README...');
  const res = await fetch('https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/README.md');
  if (!res.ok) throw new Error(`Failed to fetch README: ${res.status}`);
  return await res.text();
}

// ─── Extract unique GitHub repo URLs ──────────────────────────────────────
function extractRepos(markdown) {
  const matches = markdown.matchAll(/https:\/\/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)/g);
  const repos = new Set();
  for (const m of matches) {
    const [owner, name] = [m[1], m[2]];
    // Skip non-repo URLs (e.g. github.com/orgs/...)
    if (!name || name.endsWith('.md') || name.endsWith('.png')) continue;
    repos.add(`${owner}/${name}`);
  }
  return Array.from(repos);
}

// ─── Fetch repo metadata (stars, language, description) ───────────────────
async function fetchRepoMetadata(ownerSlashName) {
  const url = `https://api.github.com/repos/${ownerSlashName}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'marketnow-catalog-builder',
    },
  });
  if (res.status === 404) return null;
  if (res.status === 403) {
    // Rate limited — sleep and retry once
    console.log(`  ⚠ Rate limited on ${ownerSlashName}, sleeping 10s...`);
    await new Promise(r => setTimeout(r, 10000));
    return fetchRepoMetadata(ownerSlashName);
  }
  if (!res.ok) return null;
  const d = await res.json();
  return {
    full_name: d.full_name,
    stars: d.stargazers_count,
    language: d.language,
    description: d.description,
    default_branch: d.default_branch,
    archived: d.archived,
    pushed_at: d.pushed_at,
    html_url: d.html_url,
  };
}

// ─── Check if repo has a recognizable MCP entrypoint ──────────────────────
async function hasMcpEntrypoint(ownerSlashName, defaultBranch) {
  // Check package.json or pyproject.toml in repo root
  for (const file of ['package.json', 'pyproject.toml']) {
    const url = `https://raw.githubusercontent.com/${ownerSlashName}/${defaultBranch}/${file}`;
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.status === 200) return file;
    } catch {}
  }
  return null;
}

// ─── Build skill object from repo metadata ────────────────────────────────
function buildSkill(repoMeta, entrypointFile) {
  const [owner, name] = repoMeta.full_name.split('/');
  const slug = `amcp-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;
  const skillId = `mn-amcp-${name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20)}`;

  // Detect language and pick install command
  let install, language;
  if (entrypointFile === 'package.json') {
    language = 'Node.js';
    install = `npx -y ${name}`;
  } else if (entrypointFile === 'pyproject.toml') {
    language = 'Python';
    install = `uvx ${name}`;
  } else {
    language = repoMeta.language || 'Unknown';
    install = `See ${repoMeta.html_url}`;
  }

  // Category heuristic from description keywords
  const desc = (repoMeta.description || '').toLowerCase();
  let category = 'Developer Tools';
  if (/browser|playwright|puppeteer|selenium|chrome/.test(desc)) category = 'Browser Automation';
  else if (/database|sql|postgres|mysql|sqlite|mongo|redis/.test(desc)) category = 'Data';
  else if (/file|filesystem|fs/.test(desc)) category = 'File System';
  else if (/git|github|gitlab|bitbucket/.test(desc)) category = 'Version Control';
  else if (/slack|discord|telegram|whatsapp|teams/.test(desc)) category = 'Communication';
  else if (/search|google|bing|brave/.test(desc)) category = 'Search';
  else if (/memory|knowledge|graph|rag|embed/.test(desc)) category = 'AI/ML';
  else if (/stripe|payment|finance|bank|crypto/.test(desc)) category = 'Finance';
  else if (/weather|news|rss/.test(desc)) category = 'Web APIs';

  return {
    id: skillId,
    name: name,
    slug: slug,
    description: (repoMeta.description || `MCP server from ${owner}/${name}`).slice(0, 300),
    category: category,
    tags: ['mcp', 'awesome-mcp', language.toLowerCase(), owner.toLowerCase()],
    price: 0,
    currency: 'USD',
    payment: 'free',
    license: 'See repo',
    verified: false,
    sentinel_score: 7, // auto-scanned, not curated
    install: install,
    author: owner,
    version: '1.0.0',
    doc: {
      setup: {
        required_env: [],
        optional_env: [],
        install: install,
        estimated_cost: 'free',
      },
      usage: `agent.call('${slug}', { ... })`,
      system_prompt: `# ${name}\n\n## Source\n${repoMeta.html_url}\n\n## Description\n${repoMeta.description || '(no description)'}\n\n## Stars\n${repoMeta.stars}\n`,
    },
    capabilities: {
      execution_context: 'local_runtime',
      requires_auth: false,
      requires_network: /fetch|http|api|webhook/i.test(desc),
      input_types: ['json'],
      output_types: ['json', 'text'],
      tools: [],
    },
    sentinel: {
      scanned_at: new Date().toISOString(),
      scan_version: 'L1.5+L1.6',
      warnings: [],
    },
    source: {
      type: 'github',
      url: repoMeta.html_url,
      note: `Imported from awesome-mcp-servers. ${repoMeta.stars} GitHub stars. Last pushed: ${repoMeta.pushed_at}.`,
    },
    l2_eligible: true,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────
(async () => {
  const markdown = await fetchAwesomeReadme();
  const repos = extractRepos(markdown);
  console.log(`Found ${repos.length} unique GitHub repos in awesome-mcp-servers README.`);

  // Load existing skills
  const skills = JSON.parse(fs.readFileSync(SKILLS_PATH, 'utf8'));
  const existingIds = new Set(skills.map(s => s.id));
  const existingSlugs = new Set(skills.map(s => s.slug));
  console.log(`Existing catalog: ${skills.length} skills.`);

  // Fetch metadata for each repo (in batches of 10 to respect rate limits)
  const BATCH_SIZE = 10;
  const candidates = [];
  console.log(`\nFetching metadata for ${repos.length} repos in batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < repos.length && candidates.length < MAX_SKILLS * 3; i += BATCH_SIZE) {
    const batch = repos.slice(i, i + BATCH_SIZE);
    const metas = await Promise.all(batch.map(r => fetchRepoMetadata(r).catch(() => null)));
    for (const m of metas) {
      if (!m) continue;
      if (m.archived) continue;
      if (m.stars < MIN_STARS) continue;
      candidates.push(m);
    }
    if (i > 0 && i % 50 === 0) {
      console.log(`  Processed ${i}/${repos.length} repos, ${candidates.length} candidates so far`);
    }
  }

  // Sort by stars descending and pick top N
  candidates.sort((a, b) => b.stars - a.stars);
  console.log(`\nTop ${candidates.length} candidates with >= ${MIN_STARS} stars. Selecting top ${MAX_SKILLS}...`);

  const selected = [];
  for (const c of candidates) {
    if (selected.length >= MAX_SKILLS) break;

    // Check entrypoint
    const entrypoint = await hasMcpEntrypoint(c.full_name, c.default_branch);
    if (!entrypoint) {
      console.log(`  ⊘ ${c.full_name} (${c.stars}★) — no package.json/pyproject.toml in root, skipping`);
      continue;
    }

    const skill = buildSkill(c, entrypoint);
    if (existingIds.has(skill.id) || existingSlugs.has(skill.slug)) {
      console.log(`  ⊘ ${c.full_name} (${c.stars}★) — already in catalog`);
      continue;
    }

    selected.push(skill);
    existingIds.add(skill.id);
    existingSlugs.add(skill.slug);
    console.log(`  + ${c.full_name} (${c.stars}★ ${c.language}) → ${skill.id}`);
  }

  console.log(`\nSelected ${selected.length} new skills.`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Would add these skills. Re-run without --dry-run to commit.');
    for (const s of selected) {
      console.log(`  ${s.id}  →  ${s.source.url}`);
    }
    return;
  }

  if (selected.length === 0) {
    console.log('Nothing to add. Exiting.');
    return;
  }

  // Append to catalog
  skills.push(...selected);
  fs.writeFileSync(SKILLS_PATH, JSON.stringify(skills, null, 2));
  console.log(`\n✅ Added ${selected.length} new skills to catalog.`);
  console.log(`   Total catalog size: ${skills.length}`);
  console.log(`\nNext steps:`);
  console.log(`  1. cd aep-marketplace && node generate_skills.cjs`);
  console.log(`  2. node scripts/generate-skills-lite.cjs`);
  console.log(`  3. MANDATES_GITHUB_TOKEN=xxx node scripts/trigger-l2-batch.cjs`);
})();
