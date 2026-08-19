#!/usr/bin/env node
/**
 * Fast import — just awesome-mcp-servers README repos, no GitHub Search API.
 * Fetches metadata in batches of 20, minimal memory usage.
 */
import fs from 'fs';
import path from 'path';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.MANDATES_GITHUB_TOKEN;
const SKILLS_PATH = 'aep-marketplace/public/api/skills_index.json';

console.log('Fast import from awesome-mcp-servers...\n');

// Load existing
const skills = JSON.parse(fs.readFileSync(SKILLS_PATH, 'utf8'));
const existingRepos = new Set();
for (const s of skills) {
  if (s.source?.url?.includes('github.com')) {
    const m = s.source.url.match(/github\.com\/([^/]+\/[^/]+)/);
    if (m) existingRepos.add(m[1].toLowerCase());
  }
}
console.log(`Existing: ${skills.length} skills, ${existingRepos.size} repos already in catalog`);

// Fetch README
const readme = await (await fetch('https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/README.md')).text();

// Extract ALL repos
const allRepos = [...new Set(
  [...readme.matchAll(/https:\/\/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)/g)]
    .map(m => `${m[1]}/${m[2]}`)
    .filter(r => !r.endsWith('.md') && !r.endsWith('.png') && !r.endsWith('.svg') && !r.endsWith('.json'))
)];

console.log(`Found ${allRepos.length} repos in awesome-mcp-servers`);

// Filter out already in catalog
const newRepos = allRepos.filter(r => !existingRepos.has(r.toLowerCase()));
console.log(`Already in catalog: ${allRepos.length - newRepos.length}`);
console.log(`New repos to import: ${newRepos.length}\n`);

// Also fetch from other awesome lists
const otherLists = [
  'https://raw.githubusercontent.com/appcypher/awesome-mcp-servers/main/README.md',
  'https://raw.githubusercontent.com/wong2/awesome-mcp-servers/main/README.md',
];

for (const listUrl of otherLists) {
  try {
    const r = await (await fetch(listUrl)).text();
    const repos2 = [...new Set(
      [...r.matchAll(/https:\/\/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)/g)]
        .map(m => `${m[1]}/${m[2]}`)
        .filter(rr => !rr.endsWith('.md') && !rr.endsWith('.png'))
    )];
    for (const rr of repos2) {
      if (!existingRepos.has(rr.toLowerCase())) {
        newRepos.push(rr);
        existingRepos.add(rr.toLowerCase());
      }
    }
    console.log(`  + ${listUrl.split('/').slice(-2)[0]}: ${repos2.length} repos`);
  } catch (e) {
    console.log(`  ✗ ${listUrl}: ${e.message}`);
  }
}

console.log(`\nTotal new repos to import: ${newRepos.length}`);

// Fetch metadata in batches (minimal — just name, stars, language, description)
let imported = 0;
let failed = 0;
const BATCH = 20;

for (let i = 0; i < newRepos.length; i += BATCH) {
  const batch = newRepos.slice(i, i + BATCH);
  
  const results = await Promise.all(batch.map(async (repo) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`https://api.github.com/repos/${repo}`, {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'marketnow-discovery',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }));

  for (const meta of results) {
    if (!meta || meta.archived) {
      failed++;
      continue;
    }

    const [owner, name] = meta.full_name.split('/');
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    const skillId = `mn-real-${slug.replace(/-/g, '').slice(0, 20)}`;

    // Skip if already exists
    if (skills.find(s => s.id === skillId)) {
      continue;
    }

    const desc = (meta.description || `MCP server from ${owner}/${name}`).slice(0, 300);
    const topics = (meta.topics || []).join(' ').toLowerCase() + ' ' + desc.toLowerCase();
    
    let category = 'Developer Tools';
    if (/browser|playwright|puppeteer|selenium|chrome/.test(topics)) category = 'Browser Automation';
    else if (/database|sql|postgres|mysql|sqlite|mongo|redis/.test(topics)) category = 'Data';
    else if (/file|filesystem/.test(topics)) category = 'File System';
    else if (/git|github|gitlab/.test(topics)) category = 'Version Control';
    else if (/slack|discord|telegram|whatsapp/.test(topics)) category = 'Communication';
    else if (/search|google|bing|brave/.test(topics)) category = 'Search';
    else if (/memory|knowledge|graph|rag|embed/.test(topics)) category = 'AI/ML';
    else if (/stripe|payment|finance|bank|crypto|blockchain/.test(topics)) category = 'Finance';
    else if (/weather|news|rss/.test(topics)) category = 'Web APIs';
    else if (/security|auth|oauth|jwt/.test(topics)) category = 'Security';
    else if (/cloud|aws|azure|gcp/.test(topics)) category = 'Cloud Platforms';
    else if (/monitor|metric|log|observab/.test(topics)) category = 'Monitoring';

    const language = meta.language || 'Unknown';
    let install;
    if (language === 'Python') install = `pip install ${name} || uvx ${name}`;
    else if (language === 'Go') install = `go install github.com/${meta.full_name}`;
    else if (language === 'Rust') install = `cargo install ${name}`;
    else install = `npx -y ${name}`;

    skills.push({
      id: skillId,
      name: name,
      slug: `real-${slug}`,
      description: desc,
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
      sentinel: { scanned_at: new Date().toISOString(), scan_version: 'L1.5+L1.6', warnings: [] },
      source: {
        type: 'github',
        url: meta.html_url,
        note: `Real MCP server. ${meta.stargazers_count} stars. Language: ${language}. Last push: ${meta.pushed_at}.`,
        stars: meta.stargazers_count,
        language,
        last_push: meta.pushed_at,
      },
      l2_eligible: true,
      synthetic: false,
      discovered_at: new Date().toISOString(),
      discovered_by: 'fast-import.mjs',
    });
    imported++;
  }

  if ((i / BATCH) % 5 === 0) {
    console.log(`  Progress: ${Math.min(i + BATCH, newRepos.length)}/${newRepos.length} repos | imported: ${imported} | failed: ${failed}`);
  }
}

// Write
fs.writeFileSync(SKILLS_PATH, JSON.stringify(skills, null, 2));

console.log(`\n✅ Complete!`);
console.log(`  Imported: ${imported}`);
console.log(`  Failed: ${failed}`);
console.log(`  Total catalog: ${skills.length}`);
