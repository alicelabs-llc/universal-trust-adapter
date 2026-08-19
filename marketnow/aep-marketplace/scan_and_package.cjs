/**
 * MarketNow — Scanner & Packager
 * ================================
 * Escanea D:\skills git\, extrae metadata real de cada repo MCP,
 * y genera los archivos de API en public/api/
 *
 * Salida:
 *   public/api/skills_index.json      ← índice ligero (búsqueda rápida)
 *   public/api/skills/{category}.json ← detalle completo por categoría
 *   public/api/categories.json        ← conteo por categoría
 *   public/api/manifest.json          ← metadata del marketplace
 *
 * Uso: node scan_and_package.cjs
 * Desde: D:\marketnow-repo-v2\
 */

const fs   = require('fs');
const path = require('path');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SKILLS_DIR  = 'D:\\skills git';
const OUTPUT_DIR  = path.join(__dirname, 'public', 'api');
const MAX_README  = 400;   // chars de README a guardar
const CONCURRENCY = 50;    // dirs procesadas a la vez

// Mapa de palabras → categoría
const CATEGORY_MAP = {
  'ableton|music|audio|sound|midi|spotify|podcast': 'Media',
  'finance|trading|stock|crypto|bitcoin|defi|wallet|payment|stripe|invoice': 'Finance',
  'security|auth|oauth|vault|encrypt|ssl|pentest|firewall': 'Security',
  'network|http|proxy|dns|webhook|api|rest|graphql|websocket': 'Network',
  'devops|docker|kubernetes|k8s|terraform|ci|deploy|aws|gcp|azure|cloud': 'DevOps',
  'data|sql|database|postgres|mongo|redis|duckdb|csv|etl|pipeline': 'Data',
  'blockchain|web3|nft|solana|ethereum|smart.contract': 'Blockchain',
  'iot|sensor|raspberry|arduino|hardware|device|mqtt': 'IoT',
  'sales|crm|lead|email|outreach|marketing|hubspot|salesforce': 'Sales',
  'automation|workflow|n8n|zapier|make|bot|scraper|rpa': 'Automation',
  'research|search|web|browser|crawl|tavily|perplexity|news': 'Research',
  'analysis|analytics|chart|dashboard|bi|report|insight|tableau': 'Analysis',
  'voice|speech|tts|stt|whisper|elevenlabs|transcri': 'Voice',
  'message|slack|telegram|discord|whatsapp|chat|notify': 'Messaging',
  'ai|llm|gpt|claude|ollama|embedding|vector|rag|langchain': 'AI',
  'legal|law|contract|compliance|gdpr|tax|audit': 'Legal',
  'health|medical|clinical|fhir|ehr|pharmacy': 'Healthcare',
  'education|learn|course|tutor|quiz|school': 'Education',
  'logistics|shipping|tracking|inventory|warehouse|supply': 'Logistics',
  'energy|power|grid|solar|utility|meter': 'Energy',
  'system|os|file|shell|terminal|process|memory|cpu': 'System',
  'cognitive|reason|plan|agent|task|orchestrat|memory': 'Cognitive',
};

function detectCategory(text) {
  const t = text.toLowerCase();
  for (const [pattern, cat] of Object.entries(CATEGORY_MAP)) {
    if (new RegExp(pattern).test(t)) return cat;
  }
  return 'General';
}

function readFileSafe(p, encoding = 'utf8') {
  try { return fs.readFileSync(p, encoding); }
  catch { return null; }
}

function extractSmithery(dir) {
  const raw = readFileSafe(path.join(dir, 'smithery.yaml'));
  if (!raw) return null;
  // Extrae tipo de comando (stdio, docker, etc.)
  const m = raw.match(/type:\s*(\w+)/);
  return m ? m[1] : 'stdio';
}

function extractLang(dir) {
  if (fs.existsSync(path.join(dir, 'package.json')))    return 'typescript';
  if (fs.existsSync(path.join(dir, 'pyproject.toml')))  return 'python';
  if (fs.existsSync(path.join(dir, 'Cargo.toml')))      return 'rust';
  if (fs.existsSync(path.join(dir, 'go.mod')))          return 'go';
  if (fs.existsSync(path.join(dir, 'pom.xml')))         return 'java';
  return 'unknown';
}

function extractNpmName(dir) {
  const raw = readFileSafe(path.join(dir, 'package.json'));
  if (!raw) return null;
  try { return JSON.parse(raw).name || null; } catch { return null; }
}

function extractPyName(dir) {
  const raw = readFileSafe(path.join(dir, 'pyproject.toml'));
  if (!raw) return null;
  const m = raw.match(/name\s*=\s*"([^"]+)"/);
  return m ? m[1] : null;
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function processSkill(dirName, idx) {
  const dir      = path.join(SKILLS_DIR, dirName);
  const readme   = readFileSafe(path.join(dir, 'README.md')) || '';
  const lang     = extractLang(dir);
  const transport = extractSmithery(dir) || 'stdio';
  const npmName  = extractNpmName(dir);
  const pyName   = extractPyName(dir);
  const pkgName  = npmName || pyName || dirName;

  // Nombre legible: quitar guiones, capitalizar
  const displayName = dirName
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\s+Mcp\b/gi, ' MCP')
    .replace(/\bMcp\b/gi, 'MCP');

  // Descripción: primera línea no-vacía del README (sin #)
  const firstLine = readme.split('\n')
    .map(l => l.replace(/^#+\s*/, '').trim())
    .find(l => l.length > 20 && !l.startsWith('!') && !l.startsWith('[')) || '';

  const shortDesc = firstLine.slice(0, 150) || `MCP server for ${displayName}`;
  const fullDesc  = readme.slice(0, MAX_README).replace(/\n+/g, ' ').trim();

  // Categoría
  const category = detectCategory(dirName + ' ' + readme.slice(0, 500));

  // Tags
  const tags = [category.toLowerCase(), lang, transport]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);

  // Comando de instalación
  let install = '';
  if (lang === 'typescript' && npmName) {
    install = `npx -y ${npmName}`;
  } else if (lang === 'python' && pyName) {
    install = `uvx ${pyName}`;
  } else if (lang === 'typescript') {
    install = `npx -y @marketnow/${slugify(dirName)}`;
  } else {
    install = `# See README: ${dirName}`;
  }

  const id = `mn-${String(idx).padStart(5, '0')}-${slugify(dirName).slice(0, 20)}`;

  return {
    id,
    name:      displayName,
    slug:      slugify(dirName),
    shortDesc,
    fullDesc,
    category,
    lang,
    transport,
    tags,
    install,
    pkgName,
    verified:  fs.existsSync(path.join(dir, 'smithery.yaml')),
    hasDocker: fs.existsSync(path.join(dir, 'Dockerfile')),
    repoDir:   dirName,
    addedAt:   new Date().toISOString().split('T')[0],
    price:     0,     // free por defecto — proveedores pueden actualizar
  };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔍 Escaneando skills en:', SKILLS_DIR);

  const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'))
    .map(d => d.name);

  console.log(`📦 ${dirs.length} carpetas encontradas`);

  // Crear dirs de salida
  fs.mkdirSync(path.join(OUTPUT_DIR, 'skills'), { recursive: true });

  const allSkills   = [];
  const byCategory  = {};
  let   processed   = 0;
  let   errors      = 0;

  for (let i = 0; i < dirs.length; i++) {
    try {
      const skill = processSkill(dirs[i], i);
      allSkills.push(skill);

      if (!byCategory[skill.category]) byCategory[skill.category] = [];
      byCategory[skill.category].push(skill);

      processed++;
      if (processed % 500 === 0) {
        process.stdout.write(`\r   → ${processed}/${dirs.length} procesadas...`);
      }
    } catch (e) {
      errors++;
    }
  }

  console.log(`\n✅ ${processed} skills procesadas | ❌ ${errors} errores`);

  // ── 1. Índice ligero (para búsqueda rápida del Worker) ──────────────────
  const index = allSkills.map(s => ({
    id: s.id, name: s.name, slug: s.slug,
    shortDesc: s.shortDesc, category: s.category,
    lang: s.lang, tags: s.tags, verified: s.verified,
    install: s.install,
  }));

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'skills_index.json'),
    JSON.stringify(index)  // sin pretty-print → más ligero
  );
  console.log(`📄 skills_index.json → ${index.length} entries`);

  // ── 2. Detalle por categoría ─────────────────────────────────────────────
  for (const [cat, skills] of Object.entries(byCategory)) {
    const fname = cat.toLowerCase().replace(/[^a-z]/g, '_') + '.json';
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'skills', fname),
      JSON.stringify(skills, null, 2)
    );
  }
  console.log(`📁 ${Object.keys(byCategory).length} archivos de categoría generados`);

  // ── 3. Índice de categorías ──────────────────────────────────────────────
  const categories = Object.entries(byCategory)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, skills]) => ({
      name,
      slug:  name.toLowerCase().replace(/[^a-z]/g, '_'),
      count: skills.length,
      file:  `/api/skills/${name.toLowerCase().replace(/[^a-z]/g, '_')}.json`,
    }));

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'categories.json'),
    JSON.stringify(categories, null, 2)
  );

  // ── 4. Manifest ─────────────────────────────────────────────────────────
  const manifest = {
    name:         'MarketNow Skills API',
    version:      '2.0.0',
    description:  'Open marketplace for AI agent MCP skills',
    base_url:     'https://www.marketnow.site/api',
    total_skills: allSkills.length,
    categories:   categories.length,
    endpoints: {
      index:      '/api/skills_index.json',
      categories: '/api/categories.json',
      by_category:'/api/skills/{category}.json',
      search:     '/api/search?q={query}&cat={category}&lang={lang}&limit={n}&offset={n}',
      register:   'POST /api/register',
      manifest:   '/api/manifest.json',
    },
    generated_at: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  // ── 5. Resumen de tamaños ─────────────────────────────────────────────────
  const indexSize = (fs.statSync(path.join(OUTPUT_DIR, 'skills_index.json')).size / 1024 / 1024).toFixed(2);
  console.log(`\n📊 Resumen:`);
  console.log(`   skills_index.json → ${indexSize} MB`);
  console.log(`   Total skills: ${allSkills.length}`);
  console.log(`   Categorías: ${categories.map(c => c.name + '(' + c.count + ')').join(', ')}`);
  console.log(`\n🎯 Próximo paso: ejecutar upload.bat`);
}

main().catch(console.error);
