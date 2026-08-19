const fs = require('fs');
const path = require('path');

const SKILLS_DIR = 'D:\\skills git';
const OUT = 'C:\\Users\\Usuario\\.openclaw\\workspace\\aep-marketplace\\public\\api';

const CATS = {
  media: /ableton|music|audio|sound|midi|spotify|podcast|video|image|photo|gif|media/,
  finance: /finance|trading|stock|crypto|bitcoin|defi|wallet|payment|stripe|invoice|bank/,
  security: /security|auth|oauth|vault|encrypt|ssl|pentest|firewall|secret/,
  network: /network|http|proxy|dns|webhook|api|rest|graphql|websocket|tcp/,
  devops: /devops|docker|kubernetes|k8s|terraform|ci.cd|deploy|aws|gcp|azure|cloud/,
  data: /data|sql|database|postgres|mongo|redis|duckdb|csv|etl|pipeline|warehouse/,
  blockchain: /blockchain|web3|nft|solana|ethereum|smart.contract/,
  iot: /iot|sensor|raspberry|arduino|hardware|device|mqtt/,
  ai: /ai|llm|gpt|claude|ollama|embedding|vector|rag|langchain|openai|anthropic/,
  messaging: /slack|telegram|discord|whatsapp|chat|notify|message|irc|matrix/,
  automation: /automation|workflow|n8n|zapier|make|bot|scraper|crawler/,
  search: /search|browser|crawl|scrape|web|tavily|perplexity|news/,
  analytics: /analytics|chart|dashboard|bi|report|insight|tableau|metric/,
  voice: /voice|speech|tts|stt|whisper|elevenlabs|transcri/,
  system: /system|os|file|shell|terminal|process|memory|cpu|fs|unix/,
  productivity: /productivity|note|calendar|email|task|todo|sheet|doc/,
};

function detectCat(name) {
  for (const [cat, re] of Object.entries(CATS)) {
    if (re.test(name)) return cat;
  }
  return 'general';
}

function displayName(dn) {
  return dn
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\s+Mcp\b/gi, ' MCP')
    .replace(/\bMcp\b/gi, 'MCP')
    .trim();
}

console.log('Scanning ' + SKILLS_DIR);
const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('.'))
  .map(d => d.name);
console.log('Found ' + dirs.length + ' dirs');

fs.mkdirSync(path.join(OUT, 'skills'), { recursive: true });

const all = [];
const byCat = {};

for (let i = 0; i < dirs.length; i++) {
  const dn = dirs[i];
  const cat = detectCat(dn);
  const slug = dn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
  const id = 'mn-' + String(i).padStart(5, '0');
  const s = { id, name: displayName(dn), slug, category: cat, lang: 'unknown', verified: false };
  all.push(s);
  if (!byCat[cat]) byCat[cat] = [];
  byCat[cat].push(s);
  
  if ((i + 1) % 2000 === 0) {
    process.stdout.write('\r\u2192 ' + (i + 1) + '/' + dirs.length);
  }
}
process.stdout.write('\r\u2192 ' + dirs.length + '/' + dirs.length + '\n');

// Write index (minified)
const idx = all.map(s => ({ id: s.id, name: s.name, slug: s.slug, category: s.category, verified: s.verified }));
fs.writeFileSync(path.join(OUT, 'skills_index.json'), JSON.stringify(idx));
console.log('Index: ' + idx.length + ' entries');

// Write categories
const cats = Object.entries(byCat)
  .sort((a, b) => b[1].length - a[1].length)
  .map(([n, sk]) => ({
    name: n.charAt(0).toUpperCase() + n.slice(1),
    slug: n,
    count: sk.length
  }));
fs.writeFileSync(path.join(OUT, 'categories.json'), JSON.stringify(cats, null, 2));

// Write manifest
const mf = {
  name: 'MarketNow Skills API',
  version: '2.0.0',
  description: 'Open marketplace for AI agent MCP skills',
  base_url: 'https://www.marketnow.site/api',
  total_skills: all.length,
  categories: cats.length,
  endpoints: {
    index: '/api/skills_index.json',
    categories: '/api/categories.json',
    search: '/api/search?q={query}'
  },
  generated_at: new Date().toISOString()
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(mf, null, 2));

const sz = (fs.statSync(path.join(OUT, 'skills_index.json')).size / 1024 / 1024).toFixed(2);
console.log('Size: ' + sz + ' MB');
console.log('Categories: ' + cats.map(c => c.name + '(' + c.count + ')').join(', '));
console.log('Done!');
