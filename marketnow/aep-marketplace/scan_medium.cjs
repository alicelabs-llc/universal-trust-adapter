/**
 * MarketNow ??? scan_medium.cjs
 * ============================
 * Lee 3 archivos por repo (smithery.yaml, package.json/pyproject.toml, README.md l??nea 1-5)
 * Genera skills_index.json con shortDesc, tags y lang reales.
 * ~10-30 segundos para 9,248 repos.
 *
 * Uso: node scan_medium.cjs
 * Desde: D:\marketnow-repo-v2\
 */

const fs   = require('fs');
const path = require('path');

const SKILLS_DIR = 'D:\\skills git';
const OUTPUT_DIR = path.join(__dirname, 'public', 'api');

// ????????? Categor??as por keywords (slug del directorio) ????????????????????????????????????????????????????????????????????????????????????
const CAT_RULES = [
  [/ableton|music|audio|sound|midi|spotify|podcast|video|media|youtube|image|photo/i, 'Media'],
  [/financ|trading|stock|crypto|bitcoin|defi|wallet|payment|stripe|invoice|bank|price/i, 'Finance'],
  [/securi|auth|oauth|vault|encrypt|ssl|pentest|firewall|password|token|secret/i, 'Security'],
  [/network|http|proxy|dns|webhook|rest|graphql|websocket|request|fetch|curl/i, 'Network'],
  [/docker|kubernetes|k8s|terraform|ci|deploy|aws|gcp|azure|cloud|infra|devops/i, 'DevOps'],
  [/\bsql\b|database|postgres|mongo|redis|duckdb|supabase|mysql|sqlite|db\b/i, 'Data'],
  [/blockchain|web3|nft|solana|ethereum|smart.contract|defi|token\b/i, 'Blockchain'],
  [/\biot\b|sensor|raspberry|arduino|hardware|device|mqtt|esp32/i, 'IoT'],
  [/\bsales\b|crm|lead|outreach|marketing|hubspot|salesforce|prospect|email/i, 'Sales'],
  [/automat|workflow|n8n|zapier|make\b|rpa|scraper|crawler|browser\b/i, 'Automation'],
  [/search|tavily|perplexity|news|crawl|web\b|fetch|browse/i, 'Research'],
  [/analytic|chart|dashboard|bi\b|report|insight|tableau|metric|monitor/i, 'Analysis'],
  [/voice|speech|tts|stt|whisper|elevenlabs|transcri|audio/i, 'Voice'],
  [/slack|telegram|discord|whatsapp|chat|notify|message|email\b/i, 'Messaging'],
  [/\bai\b|llm|gpt|claude|ollama|embedding|vector|rag|langchain|openai|gemini/i, 'AI'],
  [/legal|law|contract|compliance|gdpr|tax|audit|regulation/i, 'Legal'],
  [/health|medical|clinical|fhir|ehr|pharmac|hospital|patient/i, 'Healthcare'],
  [/educat|learn|course|tutor|quiz|school|teach/i, 'Education'],
  [/logistic|shipping|tracking|inventory|warehouse|supply|fulfil/i, 'Logistics'],
  [/energy|power|grid|solar|utility|meter|electric/i, 'Energy'],
  [/\bsystem\b|file\b|shell|terminal|process|memory|cpu|os\b|linux|windows/i, 'System'],
  [/cogniti|reason|plan\b|agent|task|orchestrat|think|decision/i, 'Cognitive'],
];

function detectCategory(slug, smitheryText) {
  const text = slug + ' ' + (smitheryText || '');
  for (const [re, cat] of CAT_RULES) {
    if (re.test(text)) return cat;
  }
  return 'General';
}

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch { return ''; }
}

function detectLang(dir) {
  if (fs.existsSync(path.join(dir, 'package.json')))   return 'typescript';
  if (fs.existsSync(path.join(dir, 'pyproject.toml'))) return 'python';
  if (fs.existsSync(path.join(dir, 'Cargo.toml')))     return 'rust';
  if (fs.existsSync(path.join(dir, 'go.mod')))         return 'go';
  if (fs.existsSync(path.join(dir, 'pom.xml')))        return 'java';
  if (fs.existsSync(path.join(dir, 'composer.json')))  return 'php';
  return 'unknown';
}

function detectInstall(dir, slug, lang) {
  if (lang === 'typescript') {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      if (pkg.name) return `npx -y ${pkg.name}`;
    } catch {}
    return `npx -y @marketnow/${slug}`;
  }
  if (lang === 'python') {
    const raw = readSafe(path.join(dir, 'pyproject.toml'));
    const m = raw.match(/name\s*=\s*"([^"]+)"/);
    if (m) return `uvx ${m[1]}`;
    return `uvx ${slug}`;
  }
  return `# See README`;
}

function extractShortDesc(dir, slug) {
  // Lee solo las primeras 10 l??neas del README
  try {
    const fd  = fs.openSync(path.join(dir, 'README.md'), 'r');
    const buf = Buffer.alloc(1000);
    fs.readSync(fd, buf, 0, 1000, 0);
    fs.closeSync(fd);
    const lines = buf.toString('utf8').split('\n');
    for (const line of lines) {
      const clean = line.replace(/^#+\s*/, '').trim();
      if (clean.length > 25 && !clean.startsWith('!') && !clean.startsWith('[') && !clean.startsWith('<')) {
        return clean.slice(0, 160);
      }
    }
  } catch {}
  return `MCP server for ${slug.replace(/-/g, ' ')}`;
}

function extractTags(slug, cat, lang, smithery) {
  const tags = new Set();
  tags.add(cat.toLowerCase());
  if (lang && lang !== 'unknown') tags.add(lang);

  // Tags desde el slug
  const words = slug.split('-').filter(w => w.length > 3 && !/^(mcp|server|the|for|and|with|from)$/.test(w));
  words.slice(0, 4).forEach(w => tags.add(w));

  // Tags desde smithery si tiene tools listadas
  if (smithery) {
    const m = smithery.match(/tools?:\s*\n([\s\S]{0,200})/i);
    if (m) {
      const toolNames = m[1].match(/[-\w]{3,}/g) || [];
      toolNames.slice(0, 3).forEach(t => tags.add(t.toLowerCase()));
    }
  }

  return [...tags].slice(0, 8);
}

// ????????? MAIN ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
function main() {
  console.log('???? Leyendo', SKILLS_DIR, '...');
  const t0 = Date.now();

  const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('{'))
    .map(d => d.name);

  console.log(`???? ${dirs.length} repos encontrados`);

  const index      = [];
  const byCategory = {};
  let errors = 0;

  for (let i = 0; i < dirs.length; i++) {
    const dirName = dirs[i];
    const dir     = path.join(SKILLS_DIR, dirName);
    const slug    = dirName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    try {
      const smithery  = readSafe(path.join(dir, 'smithery.yaml'));
      const lang      = detectLang(dir);
      const cat       = detectCategory(slug, smithery);
      const verified  = smithery.length > 10;
      const hasDocker = fs.existsSync(path.join(dir, 'Dockerfile'));
      const shortDesc = extractShortDesc(dir, slug);
      const tags      = extractTags(slug, cat, lang, smithery);
      const install   = detectInstall(dir, slug, lang);

      // Nombre legible
      const name = dirName
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .replace(/\bMcp\b/gi, 'MCP')
        .replace(/\bApi\b/gi, 'API')
        .replace(/\bAi\b/gi, 'AI')
        .replace(/\bSql\b/gi, 'SQL');

      const entry = {
        id:        `mn-${String(i).padStart(5, '0')}`,
        name,
        slug,
        shortDesc,
        category:  cat,
        lang,
        tags,
        install,
        verified,
        hasDocker,
      };

      index.push(entry);

      if (!byCategory[cat]) byCategory[cat] = 0;
      byCategory[cat]++;

      if (i % 1000 === 0) process.stdout.write(`\r   ${i}/${dirs.length}...`);

    } catch {
      errors++;
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n??? ${index.length} skills en ${elapsed}s | ??? ${errors} errores`);

  // Crear dirs
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Escribir ??ndice
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'skills_index.json'),
    JSON.stringify(index)
  );

  const sizeMB = (fs.statSync(path.join(OUTPUT_DIR, 'skills_index.json')).size / 1024 / 1024).toFixed(2);
  console.log(`???? skills_index.json ??? ${sizeMB} MB`);

  // Categor??as
  const categories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, slug: name.toLowerCase(), count }));

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'categories.json'),
    JSON.stringify(categories, null, 2)
  );

  // Manifest actualizado
  const manifest = {
    name:         'MarketNow Skills API',
    version:      '2.1.0',
    total_skills:  index.length,
    categories:    categories.length,
    endpoints: {
      index:    '/api/skills_index.json',
      categories: '/api/categories.json',
      search:   '/api/search?q={query}&cat={cat}&lang={lang}&limit={n}&offset={n}',
      register: 'POST /api/register',
    },
    generated_at: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log('\n???? Categor??as:');
  categories.forEach(c => console.log(`   ${c.name.padEnd(15)} ${c.count}`));

  console.log('\n???? Siguiente: ejecuta upload.bat ??? load_kv.bat');
}

main();

