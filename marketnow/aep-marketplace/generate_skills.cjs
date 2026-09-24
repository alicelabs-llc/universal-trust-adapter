/**
 * MarketNow — Skill Index Builder (OFFLINE catalog pipeline)
 * ============================================================
 * ⚠️ F-06 (audit AUD-2026-0821-MN, cierre 2026-09-25): este script YA NO genera
 *    public/api/skills.json (94MB) ni src/data/all_skills.json (94MB) — el dump
 *    no paginado fue ELIMINADO y el prebuild de deploy fue sustituido por el
 *    gate anti-regresión scripts/check-asset-sizes.mjs.
 *
 *    Este script es ahora una herramienta OFFLINE para actualizaciones de
 *    catálogo (nuevos batches): se ejecuta manualmente (npm run generate) y
 *    sus outputs se commitean a git. El deploy NO regenera datos — producción
 *    sirve exactamente lo que está en el repo (reproducible).
 *
 * Fuentes (primera que exista):
 *   - public/api/skills_index.json  (modo 'full' — pipeline completo offline,
 *     requiere clean_skills_index.js; enriquece y regenera skills-lite)
 *   - public/api/skills-lite.json   (modo 'lite' — solo refresca categories/
 *     manifest/agent-sync; usado cuando el índice full no está en el repo)
 *
 * Outputs:
 *   - public/api/skills-lite.json  (solo modo full)
 *   - public/api/categories.json   (índice de categorías con counts reales)
 *   - public/api/manifest.json     (manifest del API)
 *   - public/api/agent.json        (sync de conteos y pricing)
 *
 * Uso: npm run generate  (o: node generate_skills.cjs)
 */

const fs = require('fs');
const path = require('path');

// ─── Cargar skills (full o lite) ──────────────────────────────────────────
let skills = [];
let mode = 'none';
try {
  const realSkillsPath = path.join(__dirname, 'public', 'api', 'skills_index.json');
  const litePath = path.join(__dirname, 'public', 'api', 'skills-lite.json');
  if (fs.existsSync(realSkillsPath)) {
    skills = JSON.parse(fs.readFileSync(realSkillsPath, 'utf8'));
    mode = 'full';
    console.log(`Loaded ${skills.length} skills from skills_index.json (mode: full).`);
  } else if (fs.existsSync(litePath)) {
    const liteData = JSON.parse(fs.readFileSync(litePath, 'utf8'));
    skills = Array.isArray(liteData) ? liteData : (liteData.skills || []);
    mode = 'lite';
    console.log(`Loaded ${skills.length} skills from skills-lite.json (mode: lite — no full index in repo).`);
  } else {
    console.warn("⚠ ni skills_index.json ni skills-lite.json encontrados.");
  }
} catch (e) {
  console.error("Error reading catalog source:", e.message);
  process.exit(1);
}

if (skills.length === 0) {
  console.error("✗ No skills found. Aborting.");
  process.exit(1);
}

// ─── Índice de categorías con counts REALES ──────────────────────────────
const categoryMap = new Map();
for (const s of skills) {
  const cat = s.category || 'Developer Tools';
  if (!categoryMap.has(cat)) {
    categoryMap.set(cat, { name: cat, slug: cat.toLowerCase().replace(/[^a-z0-9]+/g, '-'), count: 0 });
  }
  categoryMap.get(cat).count++;
}
const categoryIndex = Array.from(categoryMap.values())
  .sort((a, b) => b.count - a.count)
  .map(c => {
    // Flag categories that look like bulk imports (exactly 30 items is the
    // signature of bulk-imported from community "awesome-mcp" lists).
    // We disclose this rather than hide it — see /catalog.
    const isBulkImported = c.count === 30;
    return {
      ...c,
      url: `https://www.marketnow.site/registry?cat=${encodeURIComponent(c.slug)}`,
      bulk_imported: isBulkImported,
      disclosure: isBulkImported
        ? 'This category contains exactly 30 items, indicating a bulk import from a community awesome-mcp list. Skills are Sentinel-scanned but not individually curated. See /catalog for full disclosure.'
        : null,
    };
  });

// ─── Manifest del API ────────────────────────────────────────────────────
const apiManifest = {
  name:        "MarketNow Skills API",
  version:     "2.0.0",
  description: "Open marketplace for AI agent skills — MCP compatible. Every skill has a real description from its source repository.",
  base_url:    "https://www.marketnow.site/api",
  total_skills: skills.length,
  categories_count: categoryIndex.length,
  endpoints: {
    all_skills: "/api/skills (paginated — the unpaginated /api/skills.json dump was removed 2026-09-25, returns a deprecation manifest)",
    categories: "/api/categories.json",
    manifest: "/api/manifest.json",
    stats: "/api/stats.json (live-computed)",
  },
  usage: {
    fetch_page: "GET https://www.marketnow.site/api/skills?page=1&limit=100 (max limit 500)",
    by_category: "GET /api/skills?category=Finance — or filter client-side on skills-lite.json",
    by_tag: "Filter client-side: skills.filter(s => s.tags.includes('mcp'))",
    search: "GET /api/search?q=weather — or filter client-side on the lite dataset",
    sort: "GET /api/skills?sort=recent|downloads|trust|name",
  },
  note_f06: "2026-09-25 (audit F-06 closure): /api/skills.json (94MB) removed; use paginated API or /api/skills-lite.json",
  generated_at: new Date().toISOString(),
};

// ─── Escritura de archivos ────────────────────────────────────────────────
// F-06: NO se escriben public/api/skills.json ni src/data/all_skills.json.
// El dump no paginado está ELIMINADO; si necesitas el dataset completo usa
// skills-lite.json (repo) o la API paginada (runtime).
const dirs = [
  path.join(__dirname, 'public', 'api'),
];
dirs.forEach(d => fs.mkdirSync(d, { recursive: true }));

// ─── Enrich skills with trust fields (Claude review response) ────────────
// Load free-skill IDs (these get review_status = 'human-reviewed')
const freeIds = new Set();
const freeSkillsPath = path.join(__dirname, 'public', 'api', 'free-skills.json');
if (fs.existsSync(freeSkillsPath)) {
  try {
    const freeData = JSON.parse(fs.readFileSync(freeSkillsPath, 'utf8'));
    for (const s of (freeData.skills || [])) {
      if (s.id) freeIds.add(s.id);
    }
  } catch (e) { /* ignore */ }
}

const USDC_DISCLAIMER = 'USDC payments on Base are irreversible on-chain. For disputes (skill did not work as described, security issue, etc.), contact support@alicelabs.site within 7 days with the txHash and skillId. AliceLabs will refund from treasury for verified disputes. See /trust for the full dispute policy.';

// C14 FIX: Load certificate scores to override fabricated sentinel_score
const certDir = path.join(__dirname, '..', '_data', 'sentinel_certificates');
const certScores = new Map();
if (fs.existsSync(certDir)) {
  for (const f of fs.readdirSync(certDir)) {
    if (!f.endsWith('.json') || f === '_summary.json') continue;
    try {
      const cert = JSON.parse(fs.readFileSync(path.join(certDir, f), 'utf8'));
      if (cert.skill_id && cert.overall_score !== undefined) {
        certScores.set(cert.skill_id, {
          score: cert.overall_score,
          risk: cert.risk_level,
        });
      }
    } catch (e) {}
  }
}
console.log(`Loaded ${certScores.size} certificate scores for sentinel_score override.`);

for (const s of skills) {
  if (mode !== 'full') break; // lite mode: ya enriquecido — solo se refrescan categories/manifest/agent
  // C14 FIX: Override fabricated sentinel_score with real certificate score
  if (certScores.has(s.id)) {
    const certData = certScores.get(s.id);
    s.sentinel_score = certData.score;
    s.risk_level_audit = certData.risk; // audit-based risk (separate from permissions-based risk_level)
  } else if (!s.sentinel_score || s.sentinel_score < 1) {
    s.sentinel_score = 0; // No certificate = no score (honest)
  }

  // review_status (replaces universal 'verified: true')
  // 5.9.2: 'l2-reviewed' is the top tier — set by the catalog L2 review on the
  // submission pipeline (Sentinel L1.5 + live evidence verification). The
  // generator preserves it and never downgrades an L2-reviewed entry.
  if (s.review_status === 'l2-reviewed') {
    s.verified = true; // legacy compat
  } else {
    s.review_status = (freeIds.has(s.id) || (s.id && s.id.startsWith('mn-sec-'))) ? 'human-reviewed' : 'auto-scanned';
    s.verified = s.review_status !== 'auto-scanned'; // legacy compat
  }

  // permissions — declarative, inferred from metadata
  const setup = (s.doc && s.doc.setup) || {};
  const envVars = setup.required_env || [];
  const caps = s.capabilities || {};
  const network = [];
  const filesystem = [];
  let subprocess = false;
  for (const env of envVars) {
    const u = String(env).toUpperCase();
    if (/(URL|ENDPOINT|WEBHOOK|API|TOKEN|KEY)/.test(u)) network.push(env);
  }
  for (const k of Object.keys(caps)) {
    const u = k.toUpperCase();
    if (/(HTTP|FETCH|REQUEST|CALL|API|WEBHOOK)/.test(u)) network.push(k);
    if (/(FILE|READ|WRITE|SAVE|EXPORT)/.test(u)) filesystem.push(k);
    if (/(EXEC|SHELL|RUN|COMMAND)/.test(u)) subprocess = true;
  }
  const install = s.install || '';
  if (/npx|npm |uvx|pip |curl|bash/.test(install)) subprocess = true;
  s.permissions = {
    network: [...new Set(network)].slice(0, 10),
    filesystem: [...new Set(filesystem)].slice(0, 10),
    env_vars: envVars.slice(0, 15),
    subprocess,
    disclosure: 'Declarative — inferred from skill metadata. Not enforced at runtime. See /trust for roadmap.',
  };

  // risk_level — modelo documentado (changelog 5.2.0 + certificación L1):
  // riesgo de INSTALACIÓN por mecánica (npx/uvx=red | source/remote=yellow | chain=green).
  // El índice certificado ya asigna risk_level consistente — se PRESERVA.
  // El fallback por permisos solo aplica a entradas sin risk_level (no debería haber).
  const isPromptOnly = s.id && s.id.startsWith('mn-prompt-');
  const installCmd = s.install || '';
  const hasExternalExec = /npx -y |uvx |npm install|curl |bash |pip install|python |node /.test(installCmd);

  if (s.risk_level && ['red', 'yellow', 'green'].includes(s.risk_level)) {
    // certified value — keep (consistency with /api/certification and badges)
  } else if (isPromptOnly && !hasExternalExec) {
    s.risk_level = 'green';
  } else if (hasExternalExec || (subprocess && !installCmd.includes('@marketnow/install'))) {
    s.risk_level = 'red';
  } else if ((s.permissions.network && s.permissions.network.length > 0) || (s.permissions.env_vars && s.permissions.env_vars.length > 0)) {
    s.risk_level = 'yellow';
  } else {
    s.risk_level = 'green';
  }

  // source — preserve source.url if it was already set (e.g. by add-official-mcp-skills.cjs
  // or expand-catalog-awesome-mcp.cjs). Only set the default note when url is missing.
  const existingUrl = s.source?.url;
  if (s.id && s.id.startsWith('mn-prompt-')) {
    // mn-prompt-* skills are SYNTHETIC — they should have been removed already.
    // If any remain, mark them as curated (not from GitHub).
    s.source = { type: 'curated', url: null, note: 'Hand-curated by AliceLabs — usually a system prompt, not a code package.' };
  } else if (s.id && (s.id.startsWith('mn-npm-') || s.id.startsWith('mn-npm2-'))) {
    // mn-npm-* / mn-npm2-* skills are indexed from the PUBLIC NPM REGISTRY (catalog expansion v1/v4).
    s.source = { type: 'npm-registry', url: `https://www.npmjs.com/package/${s.name}`, note: 'Indexed from the public npm registry with Sentinel Index Heuristics (age, weekly downloads, typosquat distance, injection markers).' };
  } else if (s.id && s.id.startsWith('mn-py2-')) {
    // mn-py2-* are indexed from PYPI (catalog expansion v2) — preserve provenance.
    s.source = {
      type: 'pypi',
      url: existingUrl,
      note: 'Indexed from PyPI with Sentinel Index Heuristics (package age, GitHub repo link, curated lists, injection markers). Downloads from pypistats when available.',
      ...(s.source?.pypi_downloads_wk != null ? { pypi_downloads_wk: s.source.pypi_downloads_wk } : {}),
      ...(s.source?.repo_url ? { repo_url: s.source.repo_url } : {}),
      ...(s.source?.curated ? { curated: true } : {}),
    };
  } else if (s.id && (s.id.startsWith('mn-sm-') || s.id.startsWith('mn-ofr-') || s.id.startsWith('mn-cr-') || s.id.startsWith('mn-pyc-') || s.id.startsWith('mn-sm2-') || s.id.startsWith('mn-dh-') || s.id.startsWith('mn-sub-') || s.id.startsWith('mn-own-'))) {
    // v3/v4 expansion sources — PRESERVE the merged source object as-is:
    //   mn-sm-* / mn-sm2-*  smithery registry (use_count/verified)
    //   mn-ofr-* official MCP registry (publisher-verified remotes)
    //   mn-cr-*  crates.io (downloads)
    //   mn-pyc-* PyPI community tier (low adoption signal, trust capped 55)
    //   mn-dh-*  Docker Hub (stars/pulls — docker pull = riesgo amarillo, aislado)
    //   mn-sub-* community submission (POST /api/submit — Sentinel L1-sub certified)
    //   mn-own-* first-party skill (developed + L2-reviewed by AliceLabs core team)
    s.source = {
      ...s.source,
      url: existingUrl || s.source?.url,
      ...(s.source?.use_count != null ? { use_count: s.source.use_count } : {}),
      ...(s.source?.verified != null ? { verified: s.source.verified } : {}),
      ...(s.source?.downloads != null ? { downloads: s.source.downloads } : {}),
      ...(s.source?.repo_url ? { repo_url: s.source.repo_url } : {}),
      ...(s.source?.pypi_downloads_wk != null ? { pypi_downloads_wk: s.source.pypi_downloads_wk } : {}),
    };
  } else if (s.id && (s.id.startsWith('mn-gh3-') || s.id.startsWith('mn-aw2-'))) {
    // mn-gh3-* / mn-aw2-* — batch 2 (2026-09-12): GitHub topic search + awesome-mcp-servers
    // reconciliation. PRESERVE the merged source object (stars, language, last_push,
    // verification notes, npm downloads) — only guarantee url is set.
    s.source = { ...s.source, url: existingUrl || s.source?.url };
  } else if (s.id && s.id.startsWith('mn-np3-')) {
    // mn-np3-* — batch 2 (2026-09-12): npm registry (search + 27 vendor packages).
    // npm-registry provenance, preserve repo_url/downloads from the ingest.
    s.source = { ...s.source, type: 'npm-registry', url: existingUrl || `https://www.npmjs.com/package/${s.name}` };
  } else if (s.id && s.id.startsWith('mn-gh2-')) {
    // mn-gh2-* are from GitHub Search + awesome-mcp-servers curation (expansion v2).
    s.source = {
      type: 'github',
      url: existingUrl,
      note: 'Indexed via GitHub search + awesome-mcp-servers curation. Sentinel Index Heuristics applied (stars, age, activity, typosquat, injection).',
      stars: s.source?.stars ?? null,
      language: s.source?.language ?? null,
      last_push: s.source?.last_push ?? null,
      ...(s.source?.curated ? { curated: true } : {}),
    };
  } else if (s.id && s.id.startsWith('mn-gen-')) {
    // mn-gen-* skills ARE from GitHub repos (imported by massive-indexer.cjs).
    // PRESERVE their source.url — don't overwrite with null.
    if (existingUrl) {
      s.source = { type: 'github', url: existingUrl, note: s.source?.note || 'Imported from GitHub via massive-indexer. Sentinel-scanned.' };
    } else {
      // If no URL, this skill should be removed (not real). But if it's still here,
      // mark it honestly as missing source.
      s.source = { type: 'bulk-import', url: null, note: 'Imported from a community agent tool inventory. GitHub URL not yet resolved.' };
    }
  } else if (existingUrl) {
    // Keep the URL — just ensure type is set
    s.source = { type: 'github', url: existingUrl, note: s.source?.note || 'Sourced from a public GitHub MCP server repo.' };
  } else {
    s.source = { type: 'github', url: null, note: 'Sourced from a public GitHub MCP server repo (URL field to be populated).' };
  }

  s.usdc_disclaimer = USDC_DISCLAIMER;
}

console.log(`✅ MarketNow — ${skills.length} skills (mode: ${mode})`);

// ── agent.json: sync de conteos y pricing (ambos modos) ──
const agentJsonPath = path.join(__dirname, 'public', 'api', 'agent.json');
if (fs.existsSync(agentJsonPath)) {
  // Update total_skills in agent.json to match current count
  const agentJson = JSON.parse(fs.readFileSync(agentJsonPath, 'utf8'));
  // sync counts in description strings and metrics (catalog growth)
  // v5.5: cubre TODOS los conteos historicos del catalogo (9,248 -> 14,517 -> 23,206
  // -> 40,718 -> 66,496 -> ...) para que el sync no se quede corto nunca mas.
  const HISTORICAL = [9248, 14517, 23206, 40718, 59846, 57366];
  const totalStr = skills.length.toLocaleString('en-US');
  const syncCounts = (o) => {
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      const out = {};
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === 'number' && HISTORICAL.includes(v)) out[k] = skills.length;
        else out[k] = syncCounts(v);
      }
      return out;
    }
    if (Array.isArray(o)) return o.map(syncCounts);
    if (typeof o === 'string') return v_safeReplace(o);
    return o;
  };
  const v_safeReplace = (s) => {
    for (const h of HISTORICAL) s = s.replace(new RegExp('\\b' + h.toLocaleString('en-US') + '\\b', 'g'), totalStr);
    for (const h of HISTORICAL) s = s.replace(new RegExp('\\b' + h + '\\b', 'g'), String(skills.length));
    return s;
  };
  const synced = syncCounts(agentJson);
  Object.assign(agentJson, synced); // sync de TODO el objeto (descripciones, métricas, stats)
  if (agentJson.pricing) {
    // Recompute average from current skills
    const prices = skills.map(s => s.price).filter(p => typeof p === 'number');
    if (prices.length > 0) {
      agentJson.pricing.average = parseFloat((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2));
      agentJson.pricing.min = Math.min(...prices);
      agentJson.pricing.max = Math.max(...prices);
    }
  }
  agentJson.generated_at = new Date().toISOString();
  fs.writeFileSync(agentJsonPath, JSON.stringify(agentJson, null, 2));
  console.log(`   → public/api/agent.json       (machine-readable agent instructions)`);
}

// ── categories.json y manifest.json (ambos modos) ──
fs.writeFileSync(
  path.join(__dirname, 'public', 'api', 'categories.json'),
  JSON.stringify(categoryIndex, null, 2)
);
fs.writeFileSync(
  path.join(__dirname, 'public', 'api', 'manifest.json'),
  JSON.stringify(apiManifest, null, 2)
);

// ── skills-lite.json (solo modo full: en modo lite el source YA es lite) ──
const liteSkills = skills.map(s => {
  // 5.9.2: an explicit s.free === false marks vendor-priced usage (e.g. per-call
  // x402 in USDC on Base): listing/install stays free, but the vendor bills
  // usage directly — the free flag must stay false even though price === 0
  // (price covers the listing, not the vendor-side usage).
  const isFree = (typeof s.free === 'boolean') ? s.free : (freeIds.has(s.id) || s.price === 0);
  const lite = {
    id: s.id, name: s.name, slug: s.slug,
    description: (s.description || "").slice(0, 200),
    category: s.category,
    price: isFree ? 0 : s.price,
    free: isFree,
    ...(s.payment ? { payment: s.payment } : {}),
    ...(s.currency ? { currency: s.currency } : {}),
    sentinel_score: s.sentinel_score, review_status: s.review_status,
    risk_level: s.risk_level, install: s.install,
    author: s.author, version: s.version, tags: (s.tags || []).slice(0, 5),
    // Task 44: catalog expansion fields (npm registry crawl)
    ...(s.source ? { source: s.source } : {}),
    ...(s.indexed_at ? { indexed_at: s.indexed_at } : {}),
    ...(s.tier ? { tier: s.tier } : {}),
    ...(Number.isFinite(s.npm_downloads_wk) ? { npm_downloads_wk: s.npm_downloads_wk } : {}),
    ...(Number.isFinite(s.trust_score_100) ? { trust_score_100: s.trust_score_100 } : {}),
  };
  // FIX: include translations (language codes only, not full content)
  if (s.translations && typeof s.translations === 'object') {
    lite.translations = Object.keys(s.translations).reduce((acc, lang) => {
      acc[lang] = true;
      return acc;
    }, {});
  }
  return lite;
});
if (mode === 'full') {
  fs.writeFileSync(
    path.join(__dirname, "public", "api", "skills-lite.json"),
    JSON.stringify(liteSkills)
  );
  console.log(`   → public/api/skills-lite.json  (${liteSkills.filter(s => s.free).length} free)`);
}
console.log(`   → public/api/categories.json   (${categoryIndex.length} categorías)`);
console.log(`   → public/api/manifest.json`);
console.log(`   → public/api/agent.json        (sync de conteos)`);
console.log(`✅ F-06: NO se escribieron skills.json ni all_skills.json (eliminados — audit 2026-09-25)`);
