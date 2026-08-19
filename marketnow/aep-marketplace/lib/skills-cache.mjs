/**
 * MarketNow — Skills Catalog Cache
 * =================================
 *
 * PROBLEMA: skills.json es 30MB. Cada llamada serverless hace fetch + parse
 *           = 300MB RAM pico + 3-10s de latencia. Con 100 usuarios concurrentes
 *           el sitio cae.
 *
 * SOLUCIÓN: 
 *   1. Cargar skills-lite.json (4.6MB) en vez de skills.json (30MB)
 *   2. Cache en memoria del módulo con TTL de 5 minutos
 *   3. Eliminar self-fetch (fetch al propio dominio)
 *   4. Fallback a skills.json si lite no existe
 *
 * Notas:
 *   - El cache sobrevive warm starts en Vercel (module-level)
 *   - En cold start se reinicia, pero es acceptable (TTL corto)
 *   - Para >500 usuarios, migrar a Upstash Redis
 */

import FS from 'fs';
import PATH from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = PATH.dirname(__filename);

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
let _cache = null;       // { data: Skill[], expiresAt: number, source: string }
let _freeCache = null;   // cache separado para free-skills.json
let _loadingPromise = null;

/**
 * Devuelve la lista de skills desde cache o carga fresca.
 */
async function getSkills() {
  const now = Date.now();

  // Cache hit
  if (_cache && _cache.expiresAt > now) {
    return _cache.data;
  }

  // Evitar thundering herd
  if (_loadingPromise) {
    return _loadingPromise;
  }

  _loadingPromise = _loadSkills();
  try {
    const data = await _loadingPromise;
    return data;
  } finally {
    _loadingPromise = null;
  }
}

async function _loadSkills() {
  const now = Date.now();

  // Estrategia 1: leer archivo desde filesystem (build-time embed)
  const candidates = [
    PATH.join(process.cwd(), 'public', 'api', 'skills-lite.json'),
    PATH.join(process.cwd(), 'dist', 'api', 'skills-lite.json'),
    PATH.join(process.cwd(), 'public', 'api', 'skills.json'),
    PATH.join(__dirname, '..', 'public', 'api', 'skills-lite.json'),
  ];

  for (const file of candidates) {
    try {
      if (FS.existsSync(file)) {
        const raw = FS.readFileSync(file, 'utf-8');
        const data = JSON.parse(raw);
        const size = Buffer.byteLength(raw, 'utf-8');
        _cache = {
          data,
          expiresAt: now + CACHE_TTL_MS,
          source: file,
          sizeBytes: size,
          loadedAt: now,
        };
        console.log(`[skills-cache] Loaded ${data.length} skills from ${PATH.basename(file)} (${(size / 1024 / 1024).toFixed(2)} MB)`);
        return data;
      }
    } catch (e) {
      console.error(`[skills-cache] Failed to read ${file}:`, e.message);
      continue;
    }
  }

  // Estrategia 2: fetch del propio dominio (fallback, último recurso)
  console.warn('[skills-cache] No local files found, falling back to HTTP self-fetch (slow)');
  try {
    const baseUrl = `https://${process.env.VERCEL_URL || 'marketnow.site'}`;
    const res = await fetch(`${baseUrl}/api/skills-lite.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    _cache = {
      data,
      expiresAt: now + CACHE_TTL_MS,
      source: `${baseUrl}/api/skills-lite.json`,
      sizeBytes: 0,
      loadedAt: now,
    };
    return data;
  } catch (e) {
    console.error('[skills-cache] HTTP fallback also failed:', e.message);
    if (!_cache) {
      _cache = { data: [], expiresAt: now + 30 * 1000, source: 'empty-fallback', sizeBytes: 0, loadedAt: now };
    }
    return _cache.data;
  }
}

/**
 * Busca un skill por id o slug en el cache.
 */
async function findSkill(skillIdOrSlug) {
  const skills = await getSkills();
  return skills.find(s => s.id === skillIdOrSlug || s.slug === skillIdOrSlug) || null;
}

/**
 * Cache de free-skills.json.
 */
async function getFreeSkills() {
  const now = Date.now();
  if (_freeCache && _freeCache.expiresAt > now) {
    return _freeCache.data;
  }

  const candidates = [
    PATH.join(process.cwd(), 'public', 'api', 'free-skills.json'),
    PATH.join(process.cwd(), 'dist', 'api', 'free-skills.json'),
    PATH.join(__dirname, '..', 'public', 'api', 'free-skills.json'),
  ];

  for (const file of candidates) {
    try {
      if (FS.existsSync(file)) {
        const raw = FS.readFileSync(file, 'utf-8');
        const data = JSON.parse(raw);
        _freeCache = {
          data,
          expiresAt: now + CACHE_TTL_MS,
          source: file,
        };
        return data;
      }
    } catch (e) {
      continue;
    }
  }

  _freeCache = { data: { skills: [] }, expiresAt: now + 30 * 1000, source: 'empty' };
  return _freeCache.data;
}

/**
 * Busca un skill en el catálogo Y en la lista free.
 */
async function findSkillMerged(skillIdOrSlug) {
  const [skill, freeData] = await Promise.all([
    findSkill(skillIdOrSlug),
    getFreeSkills(),
  ]);

  const freeList = freeData.skills || freeData || [];
  const freeSkill = freeList.find(s => s.id === skillIdOrSlug || s.slug === skillIdOrSlug);

  if (freeSkill && skill) {
    return { ...skill, ...freeSkill, price: 0, free: true };
  }
  if (freeSkill) {
    return { ...freeSkill, price: 0, free: true };
  }
  return skill;
}

function getStats() {
  return {
    cached: !!_cache,
    source: _cache?.source || null,
    size_mb: _cache ? (_cache.sizeBytes / 1024 / 1024).toFixed(2) : 0,
    count: _cache?.data?.length || 0,
    expires_in_ms: _cache ? Math.max(0, _cache.expiresAt - Date.now()) : 0,
    free_cached: !!_freeCache,
  };
}

function invalidate() {
  _cache = null;
  _freeCache = null;
  _loadingPromise = null;
}

export {
  getSkills,
  findSkill,
  findSkillMerged,
  getFreeSkills,
  getStats,
  invalidate,
};
