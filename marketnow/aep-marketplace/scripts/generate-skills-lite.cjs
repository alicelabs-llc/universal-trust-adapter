#!/usr/bin/env node
/**
 * generate-skills-lite.cjs
 * =========================
 * Genera public/api/skills-lite.json desde skills.json (30MB → ~4-5MB)
 * manteniendo solo los campos esenciales para las funciones serverless.
 */

const FS = require('fs');
const PATH = require('path');

const ROOT = PATH.join(__dirname, '..');
const SKILLS_FULL = PATH.join(ROOT, 'public', 'api', 'skills.json');
const SKILLS_LITE = PATH.join(ROOT, 'public', 'api', 'skills-lite.json');
const FREE_SKILLS = PATH.join(ROOT, 'public', 'api', 'free-skills.json');

console.log('[skills-lite] Generating lite version from skills.json...');

if (!FS.existsSync(SKILLS_FULL)) {
  console.error(`[skills-lite] ERROR: skills.json not found at ${SKILLS_FULL}`);
  process.exit(1);
}

const fullSize = FS.statSync(SKILLS_FULL).size;
console.log(`[skills-lite] Source size: ${(fullSize / 1024 / 1024).toFixed(2)} MB`);

let freeSkillIds = new Set();
if (FS.existsSync(FREE_SKILLS)) {
  try {
    const freeData = JSON.parse(FS.readFileSync(FREE_SKILLS, 'utf-8'));
    const freeList = freeData.skills || freeData || [];
    freeSkillIds = new Set(freeList.map(s => s.id || s.slug).filter(Boolean));
    console.log(`[skills-lite] Loaded ${freeSkillIds.size} free skill IDs`);
  } catch (e) {
    console.warn(`[skills-lite] Could not parse free-skills.json: ${e.message}`);
  }
}

const skills = JSON.parse(FS.readFileSync(SKILLS_FULL, 'utf-8'));
console.log(`[skills-lite] Loaded ${skills.length} skills from full catalog`);

const lite = skills.map(s => {
  const liteSkill = {
    id: s.id,
    slug: s.slug,
    name: s.name,
    description: s.description ? s.description.slice(0, 300) : '',
    category: s.category,
    price: s.price || 0,
    author: s.author || '',
    tags: Array.isArray(s.tags) ? s.tags.slice(0, 15) : [],
    install: s.install || null,
    sentinel_score: s.sentinel_score || null,
    review_status: s.review_status || 'auto-scanned',
    free: freeSkillIds.has(s.id || s.slug) || s.price === 0,
  };

  if (s.capabilities && typeof s.capabilities === 'object') {
    liteSkill.capabilities = {
      requires_auth: !!s.capabilities.requires_auth,
      requires_network: !!s.capabilities.requires_network,
      execution_context: s.capabilities.execution_context || null,
      input_types: Array.isArray(s.capabilities.input_types) ? s.capabilities.input_types : [],
    };
  }

  if (s.sentinel && typeof s.sentinel === 'object') {
    liteSkill.sentinel = {
      score: s.sentinel.score || null,
      level: s.sentinel.level || null,
      warnings: Array.isArray(s.sentinel.warnings) ? s.sentinel.warnings.slice(0, 5) : [],
      audited_at: s.sentinel.audited_at || null,
    };
  }

  // source — needed by /api/report-skill (auto-L2-trigger) and /api/audit-skill
  // to decide whether the skill has a GitHub repo for L2 sandbox audit.
  // Without this, findSkill() returns a skill without source.url and the
  // auto-trigger always returns 'no_github_repo'.
  if (s.source && typeof s.source === 'object') {
    liteSkill.source = {
      type: s.source.type || null,
      url: s.source.url || null,
    };
  }

  if (s.doc && typeof s.doc === 'object') {
    liteSkill.doc = {
      system_prompt: s.doc.system_prompt || '',
      setup: {
        required_env: Array.isArray(s.doc.setup?.required_env) ? s.doc.setup.required_env : [],
      },
    };
  }

  if (s.translations && typeof s.translations === 'object') {
    liteSkill.translations = Object.keys(s.translations).reduce((acc, lang) => {
      acc[lang] = true;
      return acc;
    }, {});
  }

  return liteSkill;
});

const liteJson = JSON.stringify(lite);
FS.writeFileSync(SKILLS_LITE, liteJson, 'utf-8');

const liteSize = Buffer.byteLength(liteJson, 'utf-8');
const reduction = ((1 - liteSize / fullSize) * 100).toFixed(1);

console.log(`[skills-lite] Generated ${SKILLS_LITE}`);
console.log(`[skills-lite]   Size: ${(liteSize / 1024 / 1024).toFixed(2)} MB (${reduction}% reduction)`);
console.log(`[skills-lite]   Skills: ${lite.length}`);
console.log(`[skills-lite]   Free skills marked: ${lite.filter(s => s.free).length}`);
console.log('[skills-lite] Done.');
