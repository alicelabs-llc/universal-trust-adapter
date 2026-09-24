#!/usr/bin/env node
/**
 * MarketNow — Asset Size Gate (audit AUD-2026-0821-MN, F-06 anti-regression)
 * =====================================================================
 * Corre en CI (y localmente) ANTES de cada deploy. Falla si:
 *   1. Algún JSON público excede el límite duro (50MB) sin estar en la allowlist.
 *   2. Reaparecen los dumps eliminados el 2026-09-25 (skills.json, skills_index.json, *.bak-*).
 *   3. Aparecen blobs no importados > 5MB en src/ (all_skills.json class).
 *
 * La allowlist documenta CADA archivo grande que queda, con su justificación.
 * Usar: node scripts/check-asset-sizes.mjs [--quiet]
 * Exit codes: 0 = OK · 1 = gate violado
 */
import FS from 'fs';
import PATH from 'path';
import { fileURLToPath } from 'url';

const __dirname = PATH.dirname(fileURLToPath(import.meta.url));
const ROOT = PATH.join(__dirname, '..');

// Límites (bytes)
const HARD_LIMIT = 50 * 1024 * 1024;      // 50MB — GitHub ya avisa >50MB; preferimos fallar antes
const WARN_LIMIT = 2 * 1024 * 1024;       // 2MB — el plan de remediación exige API surface ≤ 2MB por endpoint

// Archivos grandes INTENCIONALES (datasets servidos estáticamente con propósito documentado)
const ALLOWLIST = {
  'public/api/skills-lite.json': '48MB — dataset "lite" que consume la UI y el fallback de skills-cache (F-06: se sirve comprimido por CDN)',
  'public/api/free-skills.json': '18MB — dataset público de skills free (enlazado desde for-agents.html para agentes)',
  'public/api/community-index.json': '12MB — bundle importado por api/certification.js (endpoint /api/community)',
  'public/api/certification-scans.json': '3.6MB — evidencia L2 de Sentinel (detail_url de certification.json)',
  'public/api/search-index.json': '2.5MB — índice de búsqueda server-side',
  'public/api/catalog-names.txt': '1.3MB — lista de nombres para lookups',
  'public/api/auth-gate-skills.json': '1.2MB — dataset auth-gate por skill',
  'public/sitemap-skills-b2.xml': '7.3MB — sitemap XML chunk (SEO, ya particionado)',
  'public/sitemap-skills-b3.xml': '2.6MB — sitemap XML chunk (SEO, ya particionado)',
};

// Dumps ELIMINADOS 2026-09-25 (audit F-06) — su reaparición es regresión automática
const FORBIDDEN = [
  'public/api/skills.json',
  'public/api/skills_index.json',
  'public/api/skills_index.json.bak-mnreal',
  'src/data/all_skills.json',
];

const walk = (dir, acc = []) => {
  for (const e of FS.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
    const p = PATH.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
};

let errors = [], warnings = [];

for (const rel of FORBIDDEN) {
  if (FS.existsSync(PATH.join(ROOT, rel))) {
    errors.push(`REGRESIÓN F-06: reapareció ${rel} (eliminado 2026-09-25). El dump completo NO debe volver a public/ ni src/data/.`);
  }
}

for (const p of walk(PATH.join(ROOT, 'public'))) {
  const rel = PATH.relative(ROOT, p).split(PATH.sep).join('/');
  if (!/\.(json|txt|xml|ld)$/.test(rel)) continue;
  const size = FS.statSync(p).size;
  if (size > HARD_LIMIT && !ALLOWLIST[rel]) {
    errors.push(`LÍMITE DURO: ${rel} = ${(size / 1048576).toFixed(1)}MB > 50MB y NO está en la allowlist. Páginalo o divídelo.`);
  } else if (size > WARN_LIMIT && !ALLOWLIST[rel]) {
    warnings.push(`AVISO: ${rel} = ${(size / 1048576).toFixed(1)}MB > 2MB (documentar en allowlist o reducir).`);
  } else if (size > WARN_LIMIT) {
    console.log(`  ok (allowlist) ${rel} — ${(size / 1048576).toFixed(1)}MB — ${ALLOWLIST[rel]}`);
  }
}

for (const p of walk(PATH.join(ROOT, 'src'))) {
  const rel = PATH.relative(ROOT, p).split(PATH.sep).join('/');
  if (!/\.json$/.test(rel)) continue;
  const size = FS.statSync(p).size;
  if (size > 5 * 1024 * 1024) {
    errors.push(`BLOB NO IMPORTADO: ${rel} = ${(size / 1048576).toFixed(1)}MB. Los datos grandes van en public/api/, no en src/ (el bundle de vite no debe crecer).`);
  }
}

if (warnings.length) for (const w of warnings) console.warn('  ' + w);
if (errors.length) {
  console.error('\n✗ ASSET SIZE GATE FALLIDO:');
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
console.log('\n✓ Asset size gate OK — sin dumps prohibidos, sin archivos > 50MB fuera de allowlist.');
