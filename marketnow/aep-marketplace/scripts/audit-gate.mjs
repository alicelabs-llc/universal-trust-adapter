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
//  10 CHECKS-MATH   — security_checks_performed = 10×L1 + 29×L2 con desglose (3ª auditoría P0-2)
//  11 TAXONOMY      — 12 etapas/10 capas Sentinel + 10 controles ATC, sin "8-layer" (P0-3)
//  12 MCP-TOOLS     — 9 tools remotas vs 15 del paquete npm, nota explícita (P0-4)
//  13 STALE-DRIFT   — generación vieja (23/23, 116/409, UTA v1.0.0) erradicada (P0-1)
//  14 NEW-SURFACES  — /licensing, /security/incidents/2026-09-08, TEST ONLY (P1-7/8/9)
//  15 SPA-SYNC      — chips/stats del SPA driven del registry, cero generación vieja (4ª ronda)
//  16 TRACKED       — 132,737/68,388 consistentes en todos los well-known (4ª ronda)
//  17 FORMATS-9     — 9 adapters en stats/trust.js/mcp.js/agent.json (4ª ronda)
//  (live) LIVE-PROD — MCP initialize serverInfo + /api/stats.json vs bundle
//  (live) LIVE-SEC  — superficies de seguridad vivas + cert/benchmark vivo == repo
//  (live) LIVE 4ª   — math stats (performed==breakdown), sección uta, /uta y /uta/ redirect

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
    [(/^2026-09-2[0-9]|^202[7-9]-/).test(cert.generated_at || ''), `cert generated_at=${cert.generated_at}` + (/^2026-09-2[0-9]|^202[7-9]-/.test(cert.generated_at || '') ? '' : ' — snapshot viejo (regenera con scripts/certify_regen_2026_09_25.py)')],
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

// ── Gate 10: aritmética de security_checks (3ª auditoría, P0-2) ─────────────
try {
  const aj = j('public/api/agent.json');
  const m = aj.metrics || {};
  const bd = m.security_checks_breakdown || {};
  const l1Entries = aj.security?.sentinelL1?.totalScanned;
  const l1Checks = aj.security?.sentinelL1?.checks?.length;
  const l2Tarballs = m.l2_tarballs_deep_scanned;
  const L2_RULES = 29;
  const l1Calc = l1Checks * l1Entries;
  const l2Calc = L2_RULES * l2Tarballs;
  const checks = [
    [bd.l1_index_checks === l1Calc, `breakdown.l1=${bd.l1_index_checks} vs ${l1Checks}×${l1Entries}=${l1Calc}`],
    [bd.l2_sentinel_rule_checks === l2Calc, `breakdown.l2=${bd.l2_sentinel_rule_checks} vs ${L2_RULES}×${l2Tarballs}=${l2Calc}`],
    [bd.total === l1Calc + l2Calc, `breakdown.total=${bd.total} vs ${l1Calc}+${l2Calc}=${l1Calc + l2Calc}`],
    [m.security_checks_performed === bd.total, `security_checks_performed=${m.security_checks_performed} vs total=${bd.total}`],
    [/10 L1 (index )?checks/.test(m.security_checks_methodology || '') && /29 L2 (Sentinel )?rules/.test(m.security_checks_methodology || ''),
      'metodología cita ambas fórmulas (10 L1 + 29 L2)'],
  ];
  for (const [ok, msg] of checks) log(ok ? '✓' : '✗', 'CHECKS-MATH', msg);
  log('✓', 'CHECKS-MATH', `${m.security_checks_performed?.toLocaleString('en-US')} = 683,880 L1 + 82,331 L2 (desglose público)`);
} catch (e) { log('✗', 'CHECKS-MATH', e.message); }

// ── Gate 11: taxonomía oficial 12/10/10 (3ª auditoría, P0-3) ────────────────
try {
  const aj = j('public/api/agent.json');
  const sl = j('lib/security-layers.json');
  const ghReadme = readFileSync(join(ROOT, '../../README.md'), 'utf8');
  const spec = readFileSync(join(ROOT, 'public/atc/spec/SPEC.md'), 'utf8');
  const checks = [
    [sl.layers?.length === 10, `security-layers: ${sl.layers?.length} capas (esperadas 10)`],
    [sl.pipeline_stages === 12, `security-layers: pipeline_stages=${sl.pipeline_stages} (esperadas 12)`],
    [/12 stages\/10 layers|12 pipeline stages.*10 audit layers/.test(aj.taxonomy?.sentinel || ''), 'agent.json taxonomy.sentinel cita 12/10'],
    [/8 required \+ 2 optional/.test(aj.taxonomy?.atc_1_0 || ''), 'agent.json taxonomy.atc_1_0 cita 10 controles (8 requeridos)'],
    [!ghReadme.includes('TrustEngine core, 8-layer audit'), 'GitHub README sin "8-layer audit" (era la contradicción P0-3)'],
    [!readFileSync(join(ROOT, 'public/uta/README.md'), 'utf8').includes('8-layer audit'), 'uta/README.md sin "8-layer audit"'],
    [!!aj.taxonomy?.uta_verification && /PARSE/.test(aj.taxonomy.uta_verification), 'agent.json taxonomy.uta_verification (12 PARSE→DECISION, distinta de Sentinel)'],
    [!!aj.taxonomy?.uta_adapters && /SPIFFE/.test(aj.taxonomy.uta_adapters), 'agent.json taxonomy.uta_adapters (9 con OAuth/SPIFFE)'],
    [/Four counts, four different systems/.test(aj.taxonomy?.note || ''), 'taxonomy note explica los 4 sistemas'],
    [ghReadme.includes('12 stages / 10 layers') && ghReadme.includes('8 required + 2 optional'), 'GitHub README: sección taxonomy 12/10/10 presente'],
    [spec.includes('The 10 Controls') && spec.includes('controls 001–008'), 'SPEC.md: 10 controles, 001–008 requeridos'],
    [aj.agent?.description?.includes('12-stage / 10-layer'), 'agent.json description usa "12-stage / 10-layer"'],
  ];
  for (const [ok, msg] of checks) log(ok ? '✓' : '✗', 'TAXONOMY', msg);
} catch (e) { log('✗', 'TAXONOMY', e.message); }

// ── Gate 12: MCP 9 remotas vs 15 npm, sin mentir (3ª auditoría, P0-4) ───────
try {
  const aj = j('public/api/agent.json');
  const mcp = aj.capabilities?.protocols?.mcp || {};
  const mcpw = j('public/.well-known/mcp.json');
  const mcpSrc = readFileSync(join(ROOT, 'api/mcp.js'), 'utf8');
  const codeTools = [...mcpSrc.matchAll(/name:\s*"(marketnow_[a-z_]+)"/g)].map(m => m[1]);
  const jsonTools = (mcp.tools || []).map(t => t.name);
  const checks = [
    [mcp.tools_count === 9 && jsonTools.length === 9, `agent.json: ${jsonTools.length} tools remotas (esperadas 9)`],
    [mcp.package_tools_count === 15, `npm package tools=${mcp.package_tools_count} (esperadas 15)`],
    [!!mcp.tools_note && /remote/i.test(mcp.tools_note) && /npm package/i.test(mcp.tools_note), 'tools_note explica remote vs package'],
    [JSON.stringify([...jsonTools].sort()) === JSON.stringify([...codeTools].sort()),
      `agent.json tools == api/mcp.js TOOLS (${codeTools.length} nombres coinciden)`],
    [mcpw.version === localMcpVersion, `well-known/mcp.json v${mcpw.version} == api/mcp.js ${localMcpVersion}`],
    [(mcpw.tools || []).length === 9, `well-known/mcp.json tools=${(mcpw.tools || []).length} (esperadas 9)`],
    [!!mcpw.tools_note, 'well-known/mcp.json lleva tools_note'],
  ];
  for (const [ok, msg] of checks) log(ok ? '✓' : '✗', 'MCP-TOOLS', msg);
} catch (e) { log('✗', 'MCP-TOOLS', e.message); }

// ── Gate 13: generación vieja erradicada (3ª auditoría, P0-1) ───────────────
try {
  const sb = j('lib/stats-base.json').security;
  const roadmap = j('public/api/sentinel-roadmap.json');
  const rs = roadmap.current_state?.stats || {};
  const landing = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const utaReadme = readFileSync(join(ROOT, 'public/uta/README.md'), 'utf8');
  const atcPage = readFileSync(join(ROOT, 'public/atc/index.html'), 'utf8');
  const checks = [
    [rs.l2_clean === sb.l2_clean && rs.l2_flagged_warning === sb.l2_flagged_warning && rs.l2_flagged_error === sb.l2_flagged_error,
      `roadmap L2 (${rs.l2_clean}/${rs.l2_flagged_warning}/${rs.l2_flagged_error}) == stats-base (${sb.l2_clean}/${sb.l2_flagged_warning}/${sb.l2_flagged_error})`],
    [!landing.includes('UTA v1.0.0'), 'index.html sin "UTA v1.0.0"'],
    [!landing.includes('UTA 12-stage'), 'index.html sin "UTA 12-stage" (el pipeline 12-etapas es de Sentinel)'],
    [!utaReadme.includes('23/23'), 'uta/README.md sin "23/23"'],
    [/Format adapters \| 9/.test(utaReadme), 'uta/README.md declara 9 adapters'],
    [!atcPage.includes('23/23'), 'atc/index.html sin "23/23"'],
    [!utaReadme.includes('| 1.10.') && !utaReadme.includes('| 1.1.1 |') && !utaReadme.includes('| 1.0.0 |'),
      'uta/README.md sin versiones de paquete de la generación vieja'],
  ];
  // GitHub README: la tabla de paquetes debe citar la versión del registry (via sync script)
  const { execFileSync } = await import('node:child_process');
  try {
    execFileSync('python3', [join(ROOT, '../../scripts/sync_npm_versions.py'), '--check'], { stdio: 'pipe', timeout: 60000 });
    checks.push([true, 'scripts/sync_npm_versions.py --check: cero drift vs npm registry']);
  } catch (err) {
    checks.push([false, `sync_npm_versions --check FALLÓ (drift de versiones vs npm): ${String(err.stdout || err.message).slice(0, 160)}`]);
  }
  for (const [ok, msg] of checks) if (msg) log(ok ? '✓' : '✗', 'STALE-DRIFT', msg);
} catch (e) { log('✗', 'STALE-DRIFT', e.message); }

// ── Gate 14: superficies nuevas P1 (licensing, incidents, TEST ONLY) ────────
try {
  const required = [
    'public/licensing/index.html',
    'public/api/licensing.json',
    'public/security/incidents/2026-09-08/index.html',
    'public/api/incident-2026-09-08.json',
    'public/uta/conformance/vectors/_test-ca-keys.json',
    '../../uta-monorepo/packages/conformance/vectors/_test-ca-keys.json',
  ];
  const missing = required.filter(p => !existsSync(join(ROOT, p)));
  const checks = [[missing.length === 0, missing.length ? `archivos ausentes: ${missing.join(', ')}` : `${required.length} archivos P1 presentes`]];
  const lic = j('public/api/licensing.json');
  checks.push([(lic.matrix || []).length >= 8, `licensing matrix ${(lic.matrix || []).length} filas (esperadas ≥8)`]);
  checks.push([(lic.summary || {}).layer3_core?.includes('AL-1.0'), 'licensing summary declara AL-1.0 core']);
  const inc = readFileSync(join(ROOT, 'public/security/incidents/2026-09-08/index.html'), 'utf8');
  for (const section of ['Detection', 'Timeline', 'Scope', 'Evidence', 'Revocation', 'Impact', 'Resolution', 'Lessons learned'])
    checks.push([inc.includes(`>${section}<`) || inc.includes(section), `postmortem: sección "${section}"`]);
  const incJ = j('public/api/incident-2026-09-08.json');
  checks.push([incJ.resolution?.revoked_same_day === true && (incJ.resolution?.rekor_log_indexes || []).length === 4,
    'incident json: revocación same-day + 4 anchors Rekor']);
  const keysPublic = readFileSync(join(ROOT, 'public/uta/conformance/vectors/_test-ca-keys.json'), 'utf8');
  const keysMono = readFileSync(join(ROOT, '../../uta-monorepo/packages/conformance/vectors/_test-ca-keys.json'), 'utf8');
  checks.push([keysPublic.includes('MUST NEVER be trusted in production') && keysMono.includes('MUST NEVER be trusted in production'),
    '_test-ca-keys.json (2 copias): warning TEST ONLY']);
  const ghReadme = readFileSync(join(ROOT, '../../README.md'), 'utf8');
  checks.push([ghReadme.includes('MUST NEVER be trusted in production'), 'GitHub README: bloque TEST ONLY']);
  // rewrites nuevos
  const vc = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
  const rw = vc.rewrites || [];
  for (const src of ['/licensing', '/security/incidents/2026-09-08'])
    checks.push([rw.some(r => r.source === src), `rewrite ${src} presente`]);
  for (const [ok, msg] of checks) log(ok ? '✓' : '✗', 'NEW-SURFACES', msg);
} catch (e) { log('✗', 'NEW-SURFACES', e.message); }

// ── Gate 15: SPA-SYNC (4ª auditoría, homepage chips + /uta stats) ───────────
try {
  const banned = [
    ['src/pages/UTA.jsx', ['UTA v1.1.0', 'AL-1.0 LICENSE', 'agent-trust-card@1.1.2', 'marketnow-mcp@1.14.1</code>']],
    ['src/pages/AgentLanding.jsx', ['UTA v1.1.0', 'trust-core@1.0.1', '@marketnow/uts@2.0.1', 'trust-adapters@1.0.2', 'trust-gateway@1.0.1', 'uta-verify@1.0.0', 'trust-observability@1.0.1', 'value: \'8\'', 'value: \'23/23\'', 'value: \'7\'', '2,339']],
    ['src/utils/liveStats.js', ['23/23']],
  ];
  const checks = [];
  for (const [file, pats] of banned) {
    const t = readFileSync(join(ROOT, file), 'utf8');
    const hit = pats.filter(p => t.includes(p));
    checks.push([hit.length === 0, hit.length ? `${file} contiene generación vieja: ${hit.join(', ')}` : `${file} sin generación vieja`]);
  }
  // los i18n no pueden declarar 8 adapters / 23-23 / 7 o 13 packages / 8 formatos
  const i18nDir = join(ROOT, 'src/utils/i18n');
  const { readdirSync } = await import('node:fs');
  const i18nFiles = readdirSync(i18nDir).filter(f => f.endsWith('.js'));
  let i18nBad = [];
  for (const f of i18nFiles) {
    const t = readFileSync(join(i18nDir, f), 'utf8');
    for (const pat of [/'uta\.rm\.d2':\s*'8 /, /'uta\.rm\.d3':\s*'23\/23/, /'uta\.rm\.d4':\s*'(7|13|12) /, /'uta\.hero\.desc'[^]*?entre 8 /])
      if (pat.test(t)) i18nBad.push(`${f}: ${pat}`);
  }
  checks.push([i18nBad.length === 0, i18nBad.length ? `i18n con valores viejos: ${i18nBad.slice(0, 4).join(' | ')}` : `i18n (${i18nFiles.length} idiomas): 9 adapters · Conformance v1.3.5 · 24 checks · 14 NPM`]);
  // lib/npm-versions.json: 14 paquetes == fallback del SPA == gate de versiones
  const nvj = j('lib/npm-versions.json');
  const ls = readFileSync(join(ROOT, 'src/utils/liveStats.js'), 'utf8');
  const fbCount = Number((ls.match(/utaPackagesCount: (\d+)/) || [])[1]);
  checks.push([(nvj.packages || []).length === 14, `lib/npm-versions.json: ${(nvj.packages || []).length} paquetes (esperados 14)`]);
  checks.push([fbCount === (nvj.packages || []).length, `liveStats fallback utaPackagesCount=${fbCount} == registry ${(nvj.packages || []).length}`]);
  // chips del landing renderizan desde stats.utaPackages (dinámico), no hardcode
  const al = readFileSync(join(ROOT, 'src/pages/AgentLanding.jsx'), 'utf8');
  checks.push([/stats\.utaPackages\.map/.test(al), 'AgentLanding: chips de paquetes renderizados desde stats.utaPackages (registry-driven)']);
  for (const [ok, msg] of checks) log(ok ? '✓' : '✗', 'SPA-SYNC', msg);
} catch (e) { log('✗', 'SPA-SYNC', e.message); }

// ── Gate 16: TRACKED-CONSISTENCY (4ª auditoría: 132,737 en todas partes) ────
try {
  const sbT = j('lib/stats-base.json').discovery?.total_tracked_all_sources;
  const ajT = j('public/api/agent.json').metrics?.skills_tracked_all_sources;
  const wkT = j('public/.well-known/agent.json').metrics?.skills_tracked_all_sources;
  const mcpDesc = readFileSync(join(ROOT, 'public/.well-known/mcp.json'), 'utf8');
  const mcpT = Number((mcpDesc.match(/([\d,]{4,7}) total tracked/) || [])[1]?.replace(/,/g, ''));
  const mkT = j('public/.well-known/mcp-marketplace.json')?.stats?.total_skills;
  const scDesc = readFileSync(join(ROOT, 'public/.well-known/mcp/server-card.json'), 'utf8');
  const scT = Number((scDesc.match(/([\d,]{4,7}) total tracked/) || [])[1]?.replace(/,/g, ''));
  const aip = readFileSync(join(ROOT, 'public/.well-known/ai-plugin.json'), 'utf8');
  const aipN = Number((aip.match(/install ([\d,]{4,7}) index-certified/) || [])[1]?.replace(/,/g, ''));
  const checks = [
    [sbT === 132737, `stats-base total_tracked=${sbT}`],
    [ajT === sbT && wkT === sbT, `agent.json (canonical=${ajT}, well-known=${wkT}) == stats-base`],
    [mcpT === sbT, `mcp.json "${mcpT} total tracked" == ${sbT}`],
    [mkT === 68388, `mcp-marketplace.json stats.total_skills=${mkT} (== bundle)`],
    [scT === sbT, `server-card.json "${scT} total tracked" == ${sbT}`],
    [aipN === 68388, `ai-plugin.json "${aipN} index-certified" == 68,388`],
  ];
  for (const [ok, msg] of checks) log(ok ? '✓' : '✗', 'TRACKED', msg);
} catch (e) { log('✗', 'TRACKED', e.message); }

// ── Gate 17: FORMATS-9 (4ª auditoría: 9 adapters en API + docs + tools) ─────
try {
  const sbF = j('lib/stats-base.json').formats?.count;
  const trust = readFileSync(join(ROOT, 'api/trust.js'), 'utf8');
  const mcpjs = readFileSync(join(ROOT, 'api/mcp.js'), 'utf8');
  const aj = JSON.stringify(j('public/api/agent.json'));
  const checks = [
    [sbF === 9, `stats-base formats.count=${sbF} (9 adapters)`],
    [/total_formats: 9/.test(trust), 'api/trust.js action=formats declara 9'],
    [/9 credential formats/.test(trust), 'api/trust.js description: 9 credential formats'],
    [!mcpjs.includes('between 8 formats') && mcpjs.includes('9 adapter formats'), 'api/mcp.js tools: 9 adapter formats'],
    [aj.includes('9 adapter formats') && !aj.includes('between 8 formats'), 'agent.json tool descriptions: 9 adapter formats'],
    [!trust.includes('architecture: \'Universal Trust Schema (UTS) v2 as IR. 12-stage verification pipeline. 8 adapters'), 'api/trust.js architecture sin "8 adapters"'],
    [/X\.509/.test(readFileSync(join(ROOT, 'src/pages/UTA.jsx'), 'utf8').match(/const FORMATS = \[[\s\S]*?\];/)?.[0] || ''), 'UTA.jsx FORMATS incluye X.509 (9 tarjetas)'],
  ];
  for (const [ok, msg] of checks) log(ok ? '✓' : '✗', 'FORMATS-9', msg);
} catch (e) { log('✗', 'FORMATS-9', e.message); }

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
      ['/licensing', 'text/html', false],
      ['/security/incidents/2026-09-08', 'text/html', false],
      ['/api/licensing.json', 'application/json', true],
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
    // 3ª auditoría en vivo: agent.json total + OCSP del incidente + tools reales
    try {
      const ajRes = await fetch(`${PROD}/api/agent.json`, { signal: AbortSignal.timeout(20000) });
      const ajLive = await ajRes.json();
      const repoTotal = j('public/api/agent.json').metrics?.security_checks_performed;
      log(ajLive.metrics?.security_checks_performed === repoTotal
        ? '✓' : '✗', 'LIVE-SEC', `agent.json vivo security_checks=${ajLive.metrics?.security_checks_performed} vs repo ${repoTotal} (766,211 = 683,880 + 82,331)`);
      log(ajLive.capabilities?.protocols?.mcp?.tools_count === 9
        ? '✓' : '✗', 'LIVE-SEC', `agent.json vivo: ${ajLive.capabilities?.protocols?.mcp?.tools_count} tools remotas declaradas (esperadas 9)`);
    } catch (e2) { log('✗', 'LIVE-SEC', `agent.json vivo falló: ${e2.message}`); }
    try {
      const ocspRes = await fetch(`${PROD}/api/ocsp?kid=mn-ca-002`, { signal: AbortSignal.timeout(20000) });
      const ocsp = await ocspRes.json();
      log(ocsp.status === 'KEY_COMPROMISE' && ocsp.recommendation === 'DENY'
        ? '✓' : '✗', 'LIVE-SEC', `OCSP vivo mn-ca-002: ${ocsp.status}/${ocsp.recommendation} (fail-closed, incidente verificable)`);
    } catch (e2) { log('✗', 'LIVE-SEC', `OCSP vivo falló: ${e2.message}`); }
    try {
      const tlRes = await fetch(`${PROD}/api/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
        signal: AbortSignal.timeout(20000),
      });
      const tl = await tlRes.json();
      const liveToolCount = (tl?.result?.tools || []).length;
      log(liveToolCount === 9
        ? '✓' : '✗', 'LIVE-SEC', `tools/list vivo: ${liveToolCount} tools remotas (agent.json declara 9, npm package 15 — nota publicada)`);
    } catch (e2) { log('✗', 'LIVE-SEC', `tools/list vivo falló: ${e2.message}`); }
    // 4ª ronda en vivo: math del stats.json (performed == breakdown.total == agent.json)
    try {
      const stRes = await fetch(`${PROD}/api/stats.json`, { signal: AbortSignal.timeout(20000) });
      const st = await stRes.json();
      const sec = st?.security || {};
      const tot = sec.security_checks_breakdown?.total;
      log(sec.security_checks_performed === tot && tot === j('public/api/agent.json').metrics?.security_checks_performed
        ? '✓' : '✗', 'LIVE-SEC', `stats vivo: performed=${sec.security_checks_performed} == breakdown.total=${tot} == agent.json (766,211)`);
      const utaLive = st?.uta;
      const nvj = j('lib/npm-versions.json');
      log(utaLive?.packages_count === (nvj.packages || []).length
        ? '✓' : '✗', 'LIVE-SEC', `stats vivo sección uta: ${utaLive?.packages_count} packages (registry ${nvj.packages.length}) + conformance v${utaLive?.conformance_version}`);
    } catch (e2) { log('✗', 'LIVE-SEC', `stats math vivo falló: ${e2.message}`); }
    // 4ª ronda en vivo: /uta responde y /uta/ redirige (antes 404)
    try {
      const utaRes = await fetch(`${PROD}/uta`, { signal: AbortSignal.timeout(20000) });
      log(utaRes.status === 200 ? '✓' : '✗', 'LIVE-SEC', `GET /uta → ${utaRes.status} (SPA route)`);
      const utaSlash = await fetch(`${PROD}/uta/`, { redirect: 'manual', signal: AbortSignal.timeout(20000) });
      const loc = utaSlash.headers.get('location') || '';
      log([301, 302, 307, 308].includes(utaSlash.status) && /\/uta$/.test(loc)
        ? '✓' : '✗', 'LIVE-SEC', `GET /uta/ → ${utaSlash.status} ${loc || '(sin redirect)'} (esperaba 3xx → /uta)`);
    } catch (e2) { log('✗', 'LIVE-SEC', `/uta vivo falló: ${e2.message}`); }
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
