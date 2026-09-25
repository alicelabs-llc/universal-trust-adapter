#!/usr/bin/env node
// audit-gate.mjs — Gate D/E de AUD-2026-0821-MN (Fase 4, paso 10)
// Corre los 14 checks de consistencia del sitio EN CADA PUSH (CI) y en la
// reauditoría programada (modo --live toca producción).
// Falla el build si algo diverge. Uso:
//   node scripts/audit-gate.mjs          → verificación de repositorio (CI)
//   node scripts/audit-gate.mjs --live   → además compara contra marketnow.site
//
// Gates:
//   1 AUDIT-STATUS  — audit-status.json íntegro, 14 findings cerrados, sin "pending"
//   2 PDF-SHA       — AUDIT_REPORT.pdf existe y su SHA-256/bytes coinciden
//   3 VERSIONS      — api/mcp.js == marketnow-mcp (npm pkg) == stats-base stamp
//   4 CATALOG       — skills-lite bundle vs stats-base vs catalog-meta vs landing
//   5 NPM-SYNC      — registry.npmjs.org/marketnow-mcp dist-tags vs local
//   6 NO-DUMPS      — los dumps prohibidos de F-06 no pueden volver
//   7 CERT-FRESH    — certificación L1 regenerada y consistente (S9, 2ª auditoría)
//   8 SECURITY-SURFACES — páginas/evidencia por capa presentes + rewrites correctos (S8)
//   9 BENCHMARK     — TP/FP/F1 recalculable, limitaciones y reproducibilidad (S8)
//  (live) LIVE-PROD — MCP initialize serverInfo + /api/stats.json vs bundle
//  (live) LIVE-SEC  — superficies de seguridad vivas + cert/benchmark vivo == repo

import { createHash } from 'node:crypto';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url))); // aep-marketplace/
const LIVE = process.argv.includes('--live');
const PROD = 'https://www.marketnow.site';
const fails = [];
const warns = [];
const oks = [];

const log = (icon, gate, msg) => {
  const line = `[${gate}] ${msg}`;
  if (icon === '✓') { oks.push(line); console.log(`\x1b[32m✓ ${line}\x1b[0m`); }
  else if (icon === '!') { warns.push(line); console.log(`\x1b[33m! ${line}\x1b[0m`); }
  else { fails.push(line); console.log(`\x1b[31m✗ ${line}\x1b[0m`); }
};
const j = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

// ── Gate 1: audit-status.json (F-14) ────────────────────────────────────────
try {
  const st = j('public/trust/audit-status.json');
  const fs = st.findings || [];
  if (!st.audit_id) log('✗', 'AUDIT-STATUS', 'audit_id ausente');
  if (fs.length < 14) log('✗', 'AUDIT-STATUS', `findings=${fs.length} (<14 — auditoría incompleta)`);
  const badStatus = fs.filter(f => ['open', 'pending', 'in_progress'].includes(f.status));
  const badCommit = fs.filter(f => /pending/i.test(String(f.fix_commit || '')));
  if (badStatus.length) log('✗', 'AUDIT-STATUS', `findings sin cerrar: ${badStatus.map(f => f.id).join(', ')}`);
  if (badCommit.length) log('✗', 'AUDIT-STATUS', `fix_commit "pending" en: ${badCommit.map(f => f.id).join(', ')}`);
  if (!/^[0-9a-f]{64}$/.test(st.pdf_sha256 || '')) log('✗', 'AUDIT-STATUS', 'pdf_sha256 ausente o malformado');
  if (!(st.pdf_bytes > 0)) log('✗', 'AUDIT-STATUS', 'pdf_bytes ausente');
  if (!badStatus.length && !badCommit.length && st.pdf_sha256 && st.pdf_bytes && fs.length >= 14)
    log('✓', 'AUDIT-STATUS', `${st.audit_id}: ${fs.length}/${fs.length} findings cerrados, pdf_sha256 presente`);
} catch (e) { log('✗', 'AUDIT-STATUS', `no se pudo parsear audit-status.json: ${e.message}`); }

// ── Gate 2: PDF real con SHA-256 (F-14) ─────────────────────────────────────
try {
  const st = j('public/trust/audit-status.json');
  const pdfPath = join(ROOT, 'public/AUDIT_REPORT.pdf');
  if (!existsSync(pdfPath)) log('✗', 'PDF-SHA', 'public/trust/AUDIT_REPORT.pdf no existe');
  else {
    const buf = readFileSync(pdfPath);
    const sha = createHash('sha256').update(buf).digest('hex');
    if (sha !== st.pdf_sha256) log('✗', 'PDF-SHA', `SHA-256 diverge: archivo=${sha.slice(0, 16)}… vs audit-status=${String(st.pdf_sha256).slice(0, 16)}…`);
    else if (buf.length !== st.pdf_bytes) log('✗', 'PDF-SHA', `bytes divergen: ${buf.length} vs ${st.pdf_bytes}`);
    else log('✓', 'PDF-SHA', `AUDIT_REPORT.pdf íntegro (${buf.length} B, sha ${sha.slice(0, 12)}…)`);
  }
} catch (e) { log('✗', 'PDF-SHA', e.message); }

// ── Gate 3: versiones sincronizadas (N-02) ──────────────────────────────────
let localMcpVersion = null;
try {
  const mcpSrc = readFileSync(join(ROOT, 'api/mcp.js'), 'utf8');
  const m = mcpSrc.match(/version:\s*"(\d+\.\d+\.\d+)"/);
  localMcpVersion = m ? m[1] : null;
  const npmPkg = j('../mcp-server/package.json');
  const stamp = j('lib/stats-base.json')._stamp;
  if (!localMcpVersion) log('✗', 'VERSIONS', 'SERVER_INFO.version no encontrado en api/mcp.js');
  else if (npmPkg.version !== localMcpVersion) log('✗', 'VERSIONS', `api/mcp.js=${localMcpVersion} ≠ marketnow-mcp@${npmPkg.version}`);
  else if (stamp.mcp_server_version !== localMcpVersion) log('✗', 'VERSIONS', `stats-base stamp=${stamp.mcp_server_version} ≠ ${localMcpVersion}`);
  else log('✓', 'VERSIONS', `mcp ${localMcpVersion} = npm pkg = stats-base stamp (sync-versions)`);
} catch (e) { log('✗', 'VERSIONS', e.message); }

// ── Gate 4: consistencia del catálogo (N-09) ────────────────────────────────
try {
  const t0 = Date.now();
  const bundle = j('public/api/skills-lite.json');
  const sb = j('lib/stats-base.json');
  const cm = j('public/api/catalog-meta.json');
  const d = sb.discovery;
  const checks = [
    [bundle.length === d.total_mcp_servers, `bundle len=${bundle.length} vs total_mcp_servers=${d.total_mcp_servers}`],
    [d.total_tracked_all_sources === cm.total_all, `stats total_tracked=${d.total_tracked_all_sources} vs catalog-meta total_all=${cm.total_all}`],
    [d.core_certified === cm.core_certified && d.community_indexed === cm.community_indexed && d.aggregate_tracked === cm.aggregate_tracked,
      `tiers stats(${d.core_certified}/${d.community_indexed}/${d.aggregate_tracked}) vs meta(${cm.core_certified}/${cm.community_indexed}/${cm.aggregate_tracked})`],
    [cm.core_certified + cm.community_indexed + cm.aggregate_tracked === cm.total_all,
      `tiers suman ${cm.core_certified + cm.community_indexed + cm.aggregate_tracked} == total_all ${cm.total_all}`],
  ];
  const free = bundle.filter(s => s.is_free === true || s.free === true || (s.price === 0 && !s.payment)).length;
  const paid = bundle.length - free;
  checks.push([free === d.free, `free del bundle=${free} vs stats free=${d.free}`]);
  checks.push([paid === d.paid, `paid del bundle=${paid} vs stats paid=${d.paid}`]);
  // categorías vivas vs template
  const cats = {};
  for (const s of bundle) { const c = String(s.category || 'uncategorized').toLowerCase().trim().replace(/[\s/]+/g, '-'); cats[c] = (cats[c] || 0) + 1; }
  const catsKeys = Object.keys(cats).sort();
  const sbKeys = Object.keys(d.categories || {}).sort();
  let catsOk = catsKeys.length === sbKeys.length;
  const drift = [];
  for (const k of catsKeys) {
    if ((d.categories || {})[k] !== cats[k]) { catsOk = false; drift.push(`${k}: bundle=${cats[k]} vs stats=${(d.categories || {})[k]}`); }
  }
  checks.push([catsOk, drift.length ? `categorías divergen: ${drift.slice(0, 4).join('; ')}${drift.length > 4 ? ` (+${drift.length - 4})` : ''}` : 'categorías consistentes']);
  // landing SEO
  const landing = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const nf = (n) => n.toLocaleString('en-US');
  checks.push([landing.includes(nf(bundle.length)) && landing.includes(nf(cm.total_all)),
    `landing debe citar ${nf(bundle.length)} y ${nf(cm.total_all)}`]);
  // agent.json (docs públicos de agentes) — cifras del catálogo
  const agentJson = readFileSync(join(ROOT, 'public/api/agent.json'), 'utf8');
  checks.push([agentJson.includes(nf(bundle.length)) && agentJson.includes(nf(cm.total_all)),
    `agent.json debe citar ${nf(bundle.length)} (indexed) y ${nf(cm.total_all)} (tracked)`]);
  for (const [ok, msg] of checks) log(ok ? '✓' : '✗', 'CATALOG', msg);
  log('✓', 'CATALOG', `bundle de ${bundle.length} skills parseado en ${((Date.now() - t0) / 1000).toFixed(1)}s`);
} catch (e) { log('✗', 'CATALOG', e.message); }

// ── Gate 5: sync con npm registry (N-02) ────────────────────────────────────
try {
  const res = await fetch('https://registry.npmjs.org/marketnow-mcp', {
    headers: { accept: 'application/vnd.npm.install-v1+json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) log('!', 'NPM-SYNC', `registry respondió ${res.status} — no verificable`);
  else {
    const dist = (await res.json())['dist-tags'];
    const latest = dist?.latest;
    if (!latest || !localMcpVersion) log('!', 'NPM-SYNC', 'no pude comparar versiones npm');
    else if (latest === localMcpVersion) {
      log('✓', 'NPM-SYNC', `npm marketnow-mcp@${latest} == repo ${localMcpVersion}`);
      const stamp = j('lib/stats-base.json')._stamp;
      if (stamp.npm_latest_version !== latest) log('!', 'NPM-SYNC', `stamp de verificación desactualizado (${stamp.npm_latest_version} vs ${latest}) — refresca el stamp`);
    } else {
      const [lMaj, lMin, lPat] = localMcpVersion.split('.').map(Number);
      const [rMaj, rMin, rPat] = latest.split('.').map(Number);
      const npmAhead = (rMaj > lMaj) || (rMaj === lMaj && (rMin > lMin || (rMin === lMin && rPat > lPat)));
      if (npmAhead) log('✗', 'NPM-SYNC', `npm va ADELANTE (@${latest} > repo ${localMcpVersion}) — main está detrás de lo publicado: sube la versión del repo antes de mergear`);
      else log('!', 'NPM-SYNC', `repo ${localMcpVersion} aún no publicado en npm (@${latest}) — estado transitorio de release`);
    }
  }
} catch (e) { log('!', 'NPM-SYNC', `registry inaccesible desde CI: ${e.message}`); }

// ── Gate 6: dumps prohibidos de F-06 no pueden volver ──────────────────────
try {
  const banned = ['public/api/skills.json', 'public/api/skills_index.json', 'src/data/all_skills.json', 'public/api/skills.json.bak-mnreal', 'skills_index.json'];
  const present = banned.filter(p => existsSync(join(ROOT, p)));
  if (present.length) log('✗', 'NO-DUMPS', `archivos prohibidos presentes: ${present.join(', ')}`);
  else log('✓', 'NO-DUMPS', 'ningún dump prohibido de F-06 en el árbol');
} catch (e) { log('✗', 'NO-DUMPS', e.message); }

// ── Gate 7: certificación L1 fresca y consistente (S9, 2ª auditoría) ───────
try {
  const cert = j('public/api/certification.json');
  const bundle = j('public/api/skills-lite.json');
  const sb = j('lib/stats-base.json');
  const checks = [
    [cert.catalog_total === bundle.length, `cert catalog_total=${cert.catalog_total} vs bundle=${bundle.length}`],
    [/^2026-09-2[0-9]/.test(cert.generated_at || ''), `cert generated_at=${cert.generated_at} — snapshot viejo (regenera con scripts/certify_regen_2026_09_25.py)`],
    [(cert.checks || []).length === 10, `cert checks=${(cert.checks || []).length} (esperados 10)`],
    [cert.index_certification?.checks_passed === sb.security?.l1_checks_passed,
      `cert checks_passed=${cert.index_certification?.checks_passed} vs stats l1_checks_passed=${sb.security?.l1_checks_passed}`],
    [!!cert.benchmark?.f1 && typeof cert.benchmark.f1 === 'number', 'cert debe enlazar el benchmark (f1 numérico)'],
  ];
  for (const [ok, msg] of checks) log(ok ? '✓' : '✗', 'CERT-FRESH', msg);
  // C4 exceptions must be documented, not hidden
  const c4 = (cert.checks || []).find(c => c.id === 'C4');
  if (c4 && c4.fail > 0 && !(c4.examples || []).length)
    log('✗', 'CERT-FRESH', 'C4 tiene fails sin examples documentados (honestidad: publica los casos)');
  else if (c4) log('✓', 'CERT-FRESH', `C4: ${c4.fail} excepciones documentadas con ejemplos`);
} catch (e) { log('✗', 'CERT-FRESH', e.message); }

// ── Gate 8: superficies de seguridad públicas (S8, 2ª auditoría) ───────────
try {
  const required = [
    'public/security/sentinel-v3.0.html',
    'public/security/sentinel-v3.0.md',
    'public/security/evidence.html',
    'public/security/sentinel-benchmark.html',
    'public/security/audit-2026-08-19.html',
    'public/api/sentinel-benchmark.json',
    'lib/security-layers.json',
    'public/_data/quarantine_decisions/MANIFEST.json',
  ];
  const missing = required.filter(p => !existsSync(join(ROOT, p)));
  if (missing.length) log('✗', 'SECURITY-SURFACES', `archivos ausentes: ${missing.join(', ')}`);
  else log('✓', 'SECURITY-SURFACES', `${required.length} superficies de seguridad presentes`);
  // rewrites: /api/security → _mode=security y clean URLs de páginas
  const vc = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
  const rw = vc.rewrites || [];
  const need = [
    ['/api/security', '/api/skills?_mode=security'],
    ['/api/quarantine', '/api/skills?_mode=security&view=quarantine'],
    ['/api/honeypot', '/api/skills?_mode=security&view=honeypot'],
    ['/api/threat-intel', '/api/skills?_mode=security&view=threat-intel'],
    ['/api/agent-analytics', '/api/skills?_mode=security&view=analytics'],
    ['/security/sentinel-v3.0', '/security/sentinel-v3.0.html'],
    ['/security/evidence', '/security/evidence.html'],
    ['/security/sentinel-benchmark', '/security/sentinel-benchmark.html'],
    ['/security/audit-2026-08-19', '/security/audit-2026-08-19.html'],
  ];
  const badRw = need.filter(([s, d]) => !rw.some(r => r.source === s && r.destination === d));
  if (badRw.length) log('✗', 'SECURITY-SURFACES', `rewrites faltantes: ${badRw.map(b => b[0]).join(', ')}`);
  else log('✓', 'SECURITY-SURFACES', `9 rewrites de seguridad correctos en vercel.json`);
  // ninguna superficie puede apuntar a la función inexistente /api/security.js
  const stale = rw.filter(r => String(r.destination).startsWith('/api/security?'));
  if (stale.length) log('✗', 'SECURITY-SURFACES', `rewrites huérfanos hacia /api/security? (función inexistente): ${stale.map(s => s.source).join(', ')}`);
  // el handler realmente monta el modo security
  const skillsSrc = readFileSync(join(ROOT, 'api/skills.js'), 'utf8');
  log(skillsSrc.includes("_mode === 'security'") ? '✓' : '✗', 'SECURITY-SURFACES',
    "api/skills.js monta _mode=security (patrón Hobby 12-funciones)");
} catch (e) { log('✗', 'SECURITY-SURFACES', e.message); }

// ── Gate 9: benchmark honesto y verificable (S8, 2ª auditoría) ─────────────
try {
  const bm = j('public/api/sentinel-benchmark.json');
  const m = bm.methodology || {};
  const cm = m.confusion_matrix || {};
  const met = m.metrics || {};
  const tp = cm.true_positives, fp = cm.false_positives, fn = cm.false_negatives, tn = cm.true_negatives;
  const pCalc = tp / (tp + fp), rCalc = tp / (tp + fn);
  const f1Calc = 2 * pCalc * rCalc / (pCalc + rCalc);
  const checks = [
    [[tp, fp, fn, tn].every(x => typeof x === 'number' && x >= 0), 'matriz de confusión completa y numérica'],
    [Math.abs(met.precision - pCalc) < 0.001, `precision=${met.precision} vs recalculada=${pCalc.toFixed(3)}`],
    [Math.abs(met.recall - rCalc) < 0.001, `recall=${met.recall} vs recalculada=${rCalc.toFixed(3)}`],
    [Math.abs(met.f1 - f1Calc) < 0.001, `f1=${met.f1} vs recalculada=${f1Calc.toFixed(3)}`],
    [(m.limitations || []).length >= 3, `limitaciones documentadas (${(m.limitations || []).length}) — el benchmark debe publicar sus debilidades`],
    [(m.reproducibility || []).length >= 3, `pasos de reproducibilidad (${(m.reproducibility || []).length})`],
  ];
  for (const [ok, msg] of checks) log(ok ? '✓' : '✗', 'BENCHMARK', msg);
  // el ledger citado debe existir y coincidir en conteo de positivos
  const man = j('public/_data/quarantine_decisions/MANIFEST.json');
  const posRecords = (m.corpora?.positives?.records || []);
  const ledgerIds = new Set((man.records || []).map(r => r.decision_id));
  const cited = posRecords.filter(r => ledgerIds.has(r.id)).length;
  log(posRecords.filter(r => r.id?.startsWith('qd_')).length === cited
    ? '✓' : '✗', 'BENCHMARK', `positivos citados existen en el ledger (${cited}/${posRecords.filter(r => r.id?.startsWith('qd_')).length})`);
} catch (e) { log('✗', 'BENCHMARK', e.message); }

// ── Gate live: producción (solo --live / reauditoría) ───────────────────────
if (LIVE) {
  try {
    const res = await fetch(`${PROD}/api/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'audit-gate', version: '1.0.0' } } }),
      signal: AbortSignal.timeout(20000),
    });
    const body = await res.json().catch(() => ({}));
    const v = body?.result?.serverInfo?.version;
    if (v === localMcpVersion) log('✓', 'LIVE-PROD', `producción MCP ${v} == repo ${localMcpVersion}`);
    else log('✗', 'LIVE-PROD', `producción MCP=${v || 'sin version'} ≠ repo ${localMcpVersion}`);
  } catch (e) { log('✗', 'LIVE-PROD', `MCP initialize falló: ${e.message}`); }
  try {
    const res = await fetch(`${PROD}/api/stats.json`, { signal: AbortSignal.timeout(20000) });
    const live = await res.json();
    const bundle = j('public/api/skills-lite.json');
    const d = live?.discovery || {};
    if (d.total_mcp_servers === bundle.length && d.total_tracked_all_sources === j('public/api/catalog-meta.json').total_all)
      log('✓', 'LIVE-PROD', `/api/stats.json vivo coincide con el repo (${d.total_mcp_servers} / ${d.total_tracked_all_sources})`);
    else log('✗', 'LIVE-PROD', `stats en vivo (${d.total_mcp_servers}/${d.total_tracked_all_sources}) ≠ repo (${bundle.length}/${j('public/api/catalog-meta.json').total_all})`);
  } catch (e) { log('✗', 'LIVE-PROD', `stats en vivo falló: ${e.message}`); }

  // superficies de seguridad en producción (S8): 200 + JSON bien formado
  try {
    const surfaces = [
      ['/api/security', 'application/json', true],
      ['/api/quarantine', 'application/json', true],
      ['/api/honeypot', 'application/json', true],
      ['/api/threat-intel', 'application/json', true],
      ['/security/sentinel-v3.0', 'text/html', false],
      ['/security/evidence', 'text/html', false],
      ['/security/sentinel-benchmark', 'text/html', false],
      ['/security/audit-2026-08-19', 'text/html', false],
    ];
    let okCount = 0;
    for (const [path, ctype, json] of surfaces) {
      try {
        const res = await fetch(`${PROD}${path}`, { signal: AbortSignal.timeout(20000) });
        const ct = String(res.headers.get('content-type') || '');
        if (res.status !== 200 || !ct.includes(ctype)) {
          log('✗', 'LIVE-SEC', `${path} → ${res.status} ${ct} (esperaba 200 ${ctype})`);
          continue;
        }
        if (json) await res.json(); // debe parsear
        okCount++;
      } catch (e2) { log('✗', 'LIVE-SEC', `${path} falló: ${e2.message}`); }
    }
    if (okCount === surfaces.length) log('✓', 'LIVE-SEC', `${okCount}/${surfaces.length} superficies de seguridad vivas y bien tipadas`);
    // certificación viva == repo
    const certRes = await fetch(`${PROD}/api/certification.json`, { signal: AbortSignal.timeout(20000) });
    const certLive = await certRes.json();
    const certRepo = j('public/api/certification.json');
    if (certLive.catalog_total === certRepo.catalog_total && (certLive.generated_at || '') === (certRepo.generated_at || ''))
      log('✓', 'LIVE-SEC', `certificación viva = repo (total ${certLive.catalog_total}, ${certLive.generated_at})`);
    else log('✗', 'LIVE-SEC', `cert viva (${certLive.catalog_total}/${certLive.generated_at}) ≠ repo (${certRepo.catalog_total}/${certRepo.generated_at})`);
    // benchmark vivo == repo
    const bmRes = await fetch(`${PROD}/api/sentinel-benchmark.json`, { signal: AbortSignal.timeout(20000) });
    const bmLive = await bmRes.json();
    const bmRepo = j('public/api/sentinel-benchmark.json');
    log(bmLive.methodology?.metrics?.f1 === bmRepo.methodology?.metrics?.f1
      ? '✓' : '✗', 'LIVE-SEC', `benchmark vivo F1=${bmLive.methodology?.metrics?.f1} vs repo F1=${bmRepo.methodology?.metrics?.f1}`);
  } catch (e) { log('✗', 'LIVE-SEC', `verificación de superficies falló: ${e.message}`); }
}

// ── Resumen ────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(64)}`);
console.log(`AUDIT GATE — ${oks.length} ok, ${warns.length} warn, ${fails.length} FAIL`);
for (const w of warns) console.log(`  warn: ${w}`);
for (const f of fails) console.log(`  fail: ${f}`);
if (LIVE) console.log('(modo --live: producción verificada)');
console.log('═'.repeat(64));
process.exit(fails.length ? 1 : 0);
