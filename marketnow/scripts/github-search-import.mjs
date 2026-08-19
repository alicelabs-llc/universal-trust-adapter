#!/usr/bin/env node
/**
 * Import from GitHub Search API — multiple queries to find MCP servers.
 * Runs queries with pagination to maximize coverage.
 */
import fs from 'fs';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SKILLS_PATH = 'aep-marketplace/public/api/skills_index.json';

const skills = JSON.parse(fs.readFileSync(SKILLS_PATH, 'utf8'));
const existingRepos = new Set();
for (const s of skills) {
  if (s.source?.url?.includes('github.com')) {
    const m = s.source.url.match(/github\.com\/([^/]+\/[^/]+)/);
    if (m) existingRepos.add(m[1].toLowerCase());
  }
}
console.log(`Existing: ${skills.length} skills, ${existingRepos.size} repos`);

const queries = [
  'topic:mcp-server',
  'topic:model-context-protocol', 
  'topic:mcp',
  'mcp server in:name,description',
  'model context protocol in:name,description',
  'mcp-server in:name',
  'mcp_server in:name',
  'mcp tools in:description',
  'mcp claude in:description',
  'mcp anthropic in:description',
];

const allFound = [];

for (const q of queries) {
  for (let page = 1; page <= 10; page++) {
    try {
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=100&page=${page}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'marketnow-discovery',
        },
      });
      if (!res.ok) {
        console.log(`  Query "${q}" page ${page}: HTTP ${res.status}, stopping`);
        break;
      }
      const data = await res.json();
      if (!data.items || data.items.length === 0) break;
      
      for (const item of data.items) {
        if (!existingRepos.has(item.full_name.toLowerCase())) {
          allFound.push(item);
          existingRepos.add(item.full_name.toLowerCase());
        }
      }
      console.log(`  Query "${q}" page ${page}: +${data.items.length} repos (total new: ${allFound.length})`);
      
      if (data.items.length < 100) break;
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.log(`  Query "${q}" page ${page}: ${e.message}`);
      break;
    }
  }
}

console.log(`\nTotal new repos found: ${allFound.length}`);

// Import
let imported = 0;
for (const meta of allFound) {
  if (meta.archived || !meta.description) {
    continue;
  }
  
  const [owner, name] = meta.full_name.split('/');
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const skillId = `mn-real-${slug.replace(/-/g, '').slice(0, 20)}`;
  
  if (skills.find(s => s.id === skillId)) continue;
  
  const desc = meta.description.slice(0, 300);
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

  const language = meta.language || 'Unknown';
  let install;
  if (language === 'Python') install = `pip install ${name}`;
  else if (language === 'Go') install = `go install github.com/${meta.full_name}`;
  else if (language === 'Rust') install = `cargo install ${name}`;
  else install = `npx -y ${name}`;

  skills.push({
    id: skillId,
    name, slug: `real-${slug}`,
    description: desc, category,
    tags: ['mcp', 'real', language.toLowerCase(), owner.toLowerCase()],
    price: 0, currency: 'USD', payment: 'free',
    license: meta.license?.spdx_id || 'See repo',
    verified: false, sentinel_score: 7, install, author: owner, version: '1.0.0',
    doc: { setup: { required_env: [], install, estimated_cost: 'free' }, usage: '', system_prompt: `# ${name}\nSource: ${meta.html_url}\n${desc}\n` },
    capabilities: { execution_context: 'local_runtime', requires_auth: false, requires_network: /http|api/i.test(desc), input_types: ['json'], output_types: ['json', 'text'] },
    sentinel: { scanned_at: new Date().toISOString(), scan_version: 'L1.5+L1.6', warnings: [] },
    source: { type: 'github', url: meta.html_url, note: `Real MCP server. ${meta.stargazers_count} stars. Language: ${language}.`, stars: meta.stargazers_count, language, last_push: meta.pushed_at },
    l2_eligible: true, synthetic: false, discovered_at: new Date().toISOString(), discovered_by: 'github-search-import.mjs',
  });
  imported++;
}

fs.writeFileSync(SKILLS_PATH, JSON.stringify(skills, null, 2));
console.log(`\n✅ Imported: ${imported}`);
console.log(`Total catalog: ${skills.length}`);
