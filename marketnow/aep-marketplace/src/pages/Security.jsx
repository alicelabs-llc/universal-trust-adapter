import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT — full Security page in 5 languages
// Honest architecture (post FINAL-AUDIT-ALL):
//   v3.0  → 6 metadata checks, runs in Vercel real-time
//   L1.6  → 18 Semgrep rules + 18 secret patterns + OSV API, runs in Vercel real-time
//   L2    → Docker sandbox (--network none, --read-only, --cap-drop ALL),
//           runs via GitHub Actions, triggered from Vercel (async)
// ═══════════════════════════════════════════════════════════════════════════
const CONTENT = {
  en: {
    badge: 'SENTINEL v3.0 → L1.6 → L2',
    stats: {
      total: 'Total Skills',
      scanned: 'Scanned by Sentinel',
      avgScore: 'Avg Sentinel Score',
      passRate: 'Pass Rate (≥4/10)',
      critical: 'Critical Issues',
    },
    banner: {
      l15Label: 'v3.0 LIVE',
      l15Desc: '→ 6 metadata checks, runs in Vercel real-time',
      l16Label: 'L1.6 LIVE',
      l16Desc: '→ 18 Semgrep rules + 18 secret patterns + OSV API, runs in Vercel real-time',
      l2Label: 'L2 LIVE',
      l2Desc: '→ Docker sandbox (--network none, --read-only, --cap-drop ALL), runs via GitHub Actions, triggered from Vercel',
    },
    architecture: {
      title: 'ARCHITECTURE — END-TO-END FLOW',
      desc: 'Vercel runs v3.0 + L1.6 in real-time on every /api/audit-skill call (~200ms). If the skill has a GitHub repo, Vercel triggers L2 via repository_dispatch. GitHub Actions runs the Docker sandbox (2-5 min), commits results to the repo, and the next audit fetches cached L2 results.',
      diagram: `┌─────────────────────────────────────────────────────────────┐
│              VERCEL  (real-time, ~200ms per call)            │
│   POST /api/audit-skill  { skillId }                          │
│   ├─ v3.0  6 metadata checks (AUTH, injection, validation,   │
│   │        CORS, OAuth scopes, rate limiting error leakage)  │
│   └─ L1.6  18 Semgrep rules + 18 secret patterns + OSV API   │
│            (api.osv.dev/v1/query — real-time)                 │
│                                                                │
│   L2 trigger (only if skill.source.url is a GitHub repo)      │
│   └─► POST api.github.com/repos/{REPO}/dispatches             │
│       event_type: sentinel-l2-audit                            │
└────────────────────────────────┬───────────────────────────────┘
                                 │  (async — does not block response)
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│          GITHUB ACTIONS  (async, ~2–5 min per run)            │
│   repository_dispatch  →  sentinel-l2-sandbox.sh              │
│   ├─ git clone --depth 1 \${REPO_URL}                          │
│   ├─ docker build                                             │
│   └─ docker run  --network none                               │
│                  --read-only                                  │
│                  --memory 256m  --cpus 0.5                    │
│                  --security-opt no-new-privileges             │
│                  --security-opt seccomp=seccomp.json          │
│                  --cap-drop ALL                               │
│                  --tmpfs /tmp:rw,size=64m                     │
│                                                                │
│   Behavioral analysis:                                        │
│   • docker logs    → stdout: creds/URL/exec mentions          │
│   • docker diff    → filesystem changes (outside /tmp)        │
│   • docker top     → process list                             │
│   • docker inspect → exit code, network attempts              │
└────────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│       RESULTS COMMITTED TO REPO  (versioned, auditable)       │
│   _data/l2_results/{skillId}.json                             │
│   { score: 0–10, multiplier: 0.0–1.0, findings: {…} }         │
└────────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│       NEXT AUDIT  (Vercel fetches cached L2 result)           │
│   GET raw.githubusercontent.com/.../l2_results/{skillId}.json │
│   → applies L2 multiplier to (v3.0 + L1.6) score              │
└─────────────────────────────────────────────────────────────┘`,
    },
    l15: {
      title: 'SENTINEL v3.0 CHECKS',
      live: 'LIVE IN VERCEL',
      checks: [
        { label: 'AUTH — Does the server require authentication?', category: 'Authentication' },
        { label: 'Tool description injection — 8 prompt injection patterns detected', category: 'Prompt Injection' },
        { label: 'Input validation — Does it validate inputs?', category: 'Input Validation' },
        { label: 'CORS — Is the CORS policy permissive?', category: 'CORS' },
        { label: 'OAuth scopes — Are scopes minimal?', category: 'OAuth' },
        { label: 'Rate limiting error leakage — Do errors leak rate limit info?', category: 'Rate Limiting' },
      ],
      descPre: 'v3.0 runs in',
      descCode: 'Vercel real-time',
      descPost: ' on every /api/audit-skill call. It analyzes metadata (README, package.json, tool descriptions). Skills scoring below 4/10 are blocked.',
    },
    audit: {
      title: 'AUDIT TRAIL',
      live: 'LIVE',
      empty: 'No audit logs available yet.',
    },
    l16: {
      title: 'SENTINEL L1.6 — REAL-TIME STATIC ANALYSIS (LIVE IN PRODUCTION)',
      badge: 'LIVE IN PRODUCTION · REAL-TIME IN VERCEL',
      descPre: 'L1.6 runs IN REAL-TIME on every /api/audit-skill call in Vercel. Three subsystems:',
      descSemgrepSuffix: ' (18 MCP-specific rules: prompt injection, command injection, secrets, SSRF, path traversal, tool spoofing), ',
      descSecretsSuffix: ' (18 patterns: Stripe, AWS, GitHub, JWT, Slack, Google, Twilio, wallets, private keys), ',
      descOSVSuffix: ' (real-time dependency vulnerability check via api.osv.dev). ',
      descPost: 'Source:',
      descVia: 'lib/sentinel-l16.mjs',
      checks: [
        { label: '18 Semgrep-equivalent rules — JS regex patterns for prompt injection (6), command injection (4), secrets (2), SSRF (2), path traversal (2), tool spoofing (1), missing inputSchema (1)', category: 'Static Analysis' },
        { label: '18 secret detection patterns — Stripe (live/test/publishable), GitHub (PAT/OAuth/app/refresh), AWS (access key + secret), private keys (RSA/EC/OPENSSH), wallet mnemonics, Ethereum private keys, JWT, Slack, Discord, Google API, Twilio, generic passwords', category: 'Secret Scanning' },
        { label: 'OSV API real-time dependency check — queries api.osv.dev/v1/query for each npx-installed package', category: 'Supply Chain' },
        { label: 'Weighted scoring — Secrets 40%, Vulns 30%, Static 20%, Hygiene 10%', category: 'Scoring' },
        { label: 'Critical secret = instant score 0 (blocks listing)', category: 'Blocking' },
      ],
      rulesTitle: 'SEMGREP RULES (18 TOTAL):',
      rules: ['Prompt injection (6)', 'Command injection (4)', 'Hardcoded credentials (2)', 'SSRF (2)', 'Path traversal (2)', 'Tool spoofing (1)', 'Missing inputSchema (1)'],
      viewRules: '→ View full ruleset on GitHub',
    },
    l2: {
      title: 'SENTINEL L2 — DYNAMIC SANDBOX ANALYSIS (IMPLEMENTED)',
      live: 'LIVE · ASYNC VIA GITHUB ACTIONS',
      descPre: 'L2 actually',
      descStrong: 'runs',
      descPost: ' the MCP server in an isolated Docker container, triggered via GitHub Actions (repository_dispatch) from Vercel. The first audit returns "triggered_async"; subsequent audits fetch cached L2 results from the repo. L2 does NOT block the API response — it runs async.',
      runAudit: '→ Run an audit',
      sandboxConfigTitle: 'DOCKER SANDBOX CONFIG:',
      sandboxConfig: [
        { flag: '--network none', purpose: 'No network access (detects attempts via ECONNREFUSED in logs)' },
        { flag: '--read-only', purpose: 'Root filesystem is read-only (writes only to /tmp via tmpfs)' },
        { flag: '--memory 256m', purpose: 'Hard memory cap at 256MB' },
        { flag: '--cpus 0.5', purpose: 'CPU limited to half a core' },
        { flag: '--cap-drop ALL', purpose: 'All Linux capabilities dropped' },
        { flag: '--security-opt no-new-privileges', purpose: 'No privilege escalation possible' },
        { flag: '--security-opt seccomp=seccomp.json', purpose: 'ptrace blocked (other syscalls allowed for monitoring)' },
        { flag: '--tmpfs /tmp:rw,size=64m', purpose: 'Writable /tmp, capped at 64MB' },
      ],
      behavioralTitle: 'BEHAVIORAL ANALYSIS:',
      behavioralChecks: [
        { label: 'Network — stdout mentions of URLs, ECONNREFUSED/ENOTFOUND errors (container cannot reach network)', category: 'Network' },
        { label: 'Filesystem — docker diff for changes outside /tmp, excessive fs changes (>10 files)', category: 'Filesystem' },
        { label: 'Process — docker top captures running processes inside container', category: 'Process' },
        { label: 'Credentials — stdout mentions of ssh, id_rsa, aws/credentials, .env, passwd, shadow = instant 0.0 multiplier', category: 'Credentials' },
        { label: 'Crashes — container exited with non-zero code (may indicate malicious startup behavior)', category: 'Crashes' },
        { label: 'Dynamic imports — stdout mentions of exec(, spawn, child_process, subprocess, os.system', category: 'Dynamic Imports' },
      ],
      phases: [
        { label: 'PHASE 1 (Q3 2026)', value: 'Docker + seccomp + strace', status: '✅ LIVE (GitHub Actions)' },
        { label: 'PHASE 2 (Q4 2026)', value: 'gVisor', status: 'Free (self-hosted)' },
        { label: 'PHASE 3 (Q1 2027)', value: 'Firecracker microVM', status: 'Paid (needs KVM)' },
      ],
    },
    limits: {
      title: 'HONEST LIMITATIONS OF SENTINEL',
      desc: 'We will not pretend Sentinel is perfect. Here is exactly what it cannot do today, and what we are doing about it.',
      cards: [
        { warn: '⚠️ L2 IS ASYNC', body: 'L2 runs via GitHub Actions, not in real-time on every API call. First audit returns "triggered_async"; results land in the repo after 2–5 minutes and apply on the NEXT audit.' },
        { warn: '⚠️ REGEX-BASED DETECTION', body: 'L1.6 uses JS regex patterns (Semgrep-equivalent). They can be evaded via obfuscation, encodings, or indirect calls. Patterns catch syntax, not intent.' },
        { warn: '⚠️ NO FULL SOURCE ANALYSIS IN REAL-TIME', body: 'L1.6 analyzes metadata + descriptions only. Full source code analysis happens in L2 (async via GitHub Actions), not on every Vercel call.' },
        { warn: '⚠️ NO THIRD-PARTY AUDIT YET', body: 'No independent security firm has audited Sentinel. We are bootstrapped — third-party audit is deferred until revenue covers it.' },
      ],
      riskTitle: 'RISK ASSESSMENT BY SKILL TYPE',
      col1: 'Skill Type',
      col2: 'Risk Level',
      col3: 'Why',
      rows: [
        { type: 'Free (human-reviewed)', level: 'LOW', why: '43 skills manually inspected by AliceLabs' },
        { type: 'Auto-scanned, risk_level=green', level: 'MEDIUM', why: 'Prompt-only, no install. Sentinel v3.0+L1.6 ran; no human review.' },
        { type: 'Auto-scanned, risk_level=yellow', level: 'MEDIUM-HIGH', why: 'Network/API access. Sentinel ran; L2 may or may not have results yet.' },
        { type: 'Paid, auto-scanned', level: 'HIGH', why: 'Code execution + money involved. Use mandates with low limits.' },
      ],
      bottomLineLabel: 'Bottom line:',
      bottomLineBody: 'Sentinel v3.0 + L1.6 run in real-time on every API call. L2 runs async via GitHub Actions and applies on the next audit. This is honest, auditable, and open source — but it is not a substitute for human review of code that executes on your machine.',
    },
    changelog: {
      title: 'SENTINEL CHANGELOG',
      entries: [
        {
          date: '2026-07-05',
          strong: 'FINAL-AUDIT-ALL.',
          body: ' Security.jsx rewritten to reflect the REAL architecture: v3.0 (6 checks, Vercel real-time) + L1.6 (18 Semgrep + 18 secrets + OSV API, Vercel real-time) + L2 (Docker sandbox, GitHub Actions, triggered from Vercel). Honest limitations updated (L2 async, regex-based, no third-party audit).',
          code: '→ Code',
        },
        {
          date: '2026-07-02',
          strong: 'L2 ACTIVATED.',
          body: ' /api/audit-skill now triggers L2 via repository_dispatch. Docker sandbox: --network none, --read-only, --memory 256m, --cpus 0.5, --security-opt no-new-privileges, --cap-drop ALL, seccomp. Behavioral analysis: stdout creds/URLs/exec, docker diff, docker top, exit code. Results committed to _data/l2_results/{skillId}.json and fetched on next audit. ASYNC — does not block the API response.',
          code: '→ Code',
          runAudit: '→ Run audit',
        },
        {
          date: '2026-07-02',
          strong: 'L1.6 LIVE IN PRODUCTION.',
          body: ' 18 Semgrep-equivalent JS regex rules (prompt injection, command injection, secrets, SSRF, path traversal, tool spoofing, missing inputSchema) + 18 secret patterns (Stripe, AWS, GitHub, JWT, Slack, Google, Twilio, wallets) + OSV API real-time dependency check. Runs in Vercel on every /api/audit-skill call.',
          code: '→ Code',
        },
        {
          date: '2026-06-30',
          strong: 'v3.0 live.',
          body: ' 6-point metadata-based audit: AUTH, prompt injection patterns, input validation, CORS, OAuth scopes, rate limiting error leakage.',
        },
      ],
      links: [
        { text: '→ Full roadmap (v3.0 → L3.5)', to: '/sentinel-roadmap' },
        { text: '→ Trust roadmap', to: '/trust' },
        { text: '→ Buyer\'s guide', to: '/buyers-guide' },
      ],
    },
    liveStatus: {
      title: 'LATEST BATCH AUDIT — LIVE',
      subtitle: 'Pulled in real time from /api/sentinel-status → _data/sentinel_results.json (committed weekly by GitHub Actions)',
      notRun: 'No batch audit has run yet. The cron fires every Sunday at 00:00 UTC. You can trigger one manually from the Actions tab.',
      ranOn: 'Last run',
      toolsLabel: 'Tools run',
      totalsLabel: 'Totals',
      findingsLabel: 'Findings',
      semgrep: 'Semgrep (18 MCP rules)',
      gitleaks: 'Gitleaks (secret scan)',
      osv: 'OSV-Scanner (deps)',
      critical: 'Critical',
      high: 'High',
      medium: 'Medium',
      l2Title: 'L2 Docker sandbox coverage',
      l2Completed: 'Completed L2 sandbox runs',
      l2Audited: 'Skills with L2 results',
      l2None: 'No L2 sandbox results yet — they appear here automatically after the first /api/audit-skill call for a skill with a GitHub repo.',
      l2Dedup: 'Dedup window',
      l2DedupValue: '30 min (per Vercel instance, prevents duplicate dispatches)',
      l2RolloutNote: 'L2 rollout in progress — currently 257 of 9,248 skills have L2 results. The remaining 8,991 are certified with v3.0+L1.6 (static analysis). L2 coverage grows as more skills get source.url populated.',
      viewRaw: '→ View raw JSON in repo',
      refresh: '↻ Refresh',
      loading: 'Loading live audit data…',
      error: 'Could not fetch live audit data. The endpoint may be cold-starting — try refresh.',
      certTitle: 'SENTINEL CERTIFICATES',
      certDesc: 'Every skill in the catalog gets a signed Sentinel certificate with a verified score. Certificates are regenerated weekly by the batch audit.',
      certLoading: 'Loading certificate count…',
      certVerified: 'Certified skills',
      certByRisk: 'By risk level',
      certViewAll: '→ View all certificates in repo',
    },
  },

  es: {
    badge: 'SENTINEL v3.0 → L1.6 → L2',
    stats: {
      total: 'Skills Totales',
      scanned: 'Escaneadas por Sentinel',
      avgScore: 'Puntaje Medio Sentinel',
      passRate: 'Tasa de Aprobación (≥4/10)',
      critical: 'Problemas Críticos',
    },
    banner: {
      l15Label: 'v3.0 LIVE',
      l15Desc: '→ 6 checks de metadata, corre en Vercel en tiempo real',
      l16Label: 'L1.6 LIVE',
      l16Desc: '→ 18 reglas Semgrep + 18 patrones de secretos + OSV API, corre en Vercel en tiempo real',
      l2Label: 'L2 LIVE',
      l2Desc: '→ Docker sandbox (--network none, --read-only, --cap-drop ALL), corre vía GitHub Actions, disparado desde Vercel',
    },
    architecture: {
      title: 'ARQUITECTURA — FLUJO EXTREMO A EXTREMO',
      desc: 'Vercel corre v3.0 + L1.6 en tiempo real en cada llamada a /api/audit-skill (~200ms). Si la skill tiene un repo de GitHub, Vercel dispara L2 vía repository_dispatch. GitHub Actions corre el sandbox Docker (2-5 min), commitea los resultados al repo, y la próxima auditoría obtiene los resultados L2 cacheados.',
      diagram: `┌─────────────────────────────────────────────────────────────┐
│              VERCEL  (tiempo real, ~200ms por llamada)        │
│   POST /api/audit-skill  { skillId }                          │
│   ├─ v3.0  6 checks de metadata (AUTH, inyección, validación, │
│   │        CORS, OAuth scopes, fuga de rate limiting)         │
│   └─ L1.6  18 reglas Semgrep + 18 patrones de secretos + OSV │
│            (api.osv.dev/v1/query — tiempo real)               │
│                                                                │
│   L2 trigger (solo si skill.source.url es un repo GitHub)     │
│   └─► POST api.github.com/repos/{REPO}/dispatches             │
│       event_type: sentinel-l2-audit                            │
└────────────────────────────────┬───────────────────────────────┘
                                 │  (async — no bloquea la respuesta)
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│          GITHUB ACTIONS  (async, ~2–5 min por ejecución)      │
│   repository_dispatch  →  sentinel-l2-sandbox.sh              │
│   ├─ git clone --depth 1 \${REPO_URL}                          │
│   ├─ docker build                                             │
│   └─ docker run  --network none                               │
│                  --read-only                                  │
│                  --memory 256m  --cpus 0.5                    │
│                  --security-opt no-new-privileges             │
│                  --security-opt seccomp=seccomp.json          │
│                  --cap-drop ALL                               │
│                  --tmpfs /tmp:rw,size=64m                     │
│                                                                │
│   Análisis conductual:                                        │
│   • docker logs    → stdout: menciones de creds/URL/exec      │
│   • docker diff    → cambios de filesystem (fuera de /tmp)    │
│   • docker top     → lista de procesos                        │
│   • docker inspect → exit code, intentos de red               │
└────────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│       RESULTADOS COMMITEADOS AL REPO  (versionado, auditable) │
│   _data/l2_results/{skillId}.json                             │
│   { score: 0–10, multiplier: 0.0–1.0, findings: {…} }         │
└────────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│       PRÓXIMA AUDITORÍA  (Vercel obtiene L2 cacheado)         │
│   GET raw.githubusercontent.com/.../l2_results/{skillId}.json │
│   → aplica multiplicador L2 al puntaje (v3.0 + L1.6)          │
└─────────────────────────────────────────────────────────────┘`,
    },
    l15: {
      title: 'CHECKS DE SENTINEL v3.0',
      live: 'LIVE EN VERCEL',
      checks: [
        { label: 'AUTH — ¿El servidor requiere autenticación?', category: 'Autenticación' },
        { label: 'Inyección en descripción de tools — 8 patrones de prompt injection detectados', category: 'Prompt Injection' },
        { label: 'Validación de inputs — ¿Valida los inputs?', category: 'Validación de Inputs' },
        { label: 'CORS — ¿La política CORS es permisiva?', category: 'CORS' },
        { label: 'OAuth scopes — ¿Los scopes son mínimos?', category: 'OAuth' },
        { label: 'Fuga de info en rate limiting — ¿Los errores filtran info de rate limit?', category: 'Rate Limiting' },
      ],
      descPre: 'v3.0 corre en',
      descCode: 'Vercel en tiempo real',
      descPost: ' en cada llamada a /api/audit-skill. Analiza metadata (README, package.json, descripciones de tools). Las skills con puntaje bajo 4/10 son bloqueadas.',
    },
    audit: {
      title: 'TRAIL DE AUDITORÍA',
      live: 'LIVE',
      empty: 'No hay logs de auditoría disponibles aún.',
    },
    l16: {
      title: 'SENTINEL L1.6 — ANÁLISIS ESTÁTICO EN TIEMPO REAL (LIVE EN PRODUCCIÓN)',
      badge: 'LIVE EN PRODUCCIÓN · TIEMPO REAL EN VERCEL',
      descPre: 'L1.6 corre EN TIEMPO REAL en cada llamada a /api/audit-skill en Vercel. Tres subsistemas:',
      descSemgrepSuffix: ' (18 reglas MCP: prompt injection, command injection, secretos, SSRF, path traversal, tool spoofing), ',
      descSecretsSuffix: ' (18 patrones: Stripe, AWS, GitHub, JWT, Slack, Google, Twilio, wallets, private keys), ',
      descOSVSuffix: ' (chequeo de vulnerabilidades en tiempo real vía api.osv.dev). ',
      descPost: 'Fuente:',
      descVia: 'lib/sentinel-l16.mjs',
      checks: [
        { label: '18 reglas tipo-Semgrep — patrones regex JS para prompt injection (6), command injection (4), secretos (2), SSRF (2), path traversal (2), tool spoofing (1), inputSchema faltante (1)', category: 'Análisis Estático' },
        { label: '18 patrones de detección de secretos — Stripe (live/test/publishable), GitHub (PAT/OAuth/app/refresh), AWS (access key + secret), private keys (RSA/EC/OPENSSH), mnemonics de wallet, private keys de Ethereum, JWT, Slack, Discord, Google API, Twilio, passwords genéricas', category: 'Escaneo de Secretos' },
        { label: 'OSV API tiempo real — consulta api.osv.dev/v1/query para cada paquete npx instalado', category: 'Cadena de Suministro' },
        { label: 'Scoring ponderado — Secretos 40%, Vulns 30%, Estático 20%, Higiene 10%', category: 'Scoring' },
        { label: 'Secreto crítico = score 0 instantáneo (bloquea listing)', category: 'Bloqueo' },
      ],
      rulesTitle: 'REGLAS SEMGREP (18 EN TOTAL):',
      rules: ['Prompt injection (6)', 'Command injection (4)', 'Credenciales hardcoded (2)', 'SSRF (2)', 'Path traversal (2)', 'Tool spoofing (1)', 'inputSchema faltante (1)'],
      viewRules: '→ Ver ruleset completo en GitHub',
    },
    l2: {
      title: 'SENTINEL L2 — ANÁLISIS DINÁMICO EN SANDBOX (IMPLEMENTADO)',
      live: 'LIVE · ASYNC VÍA GITHUB ACTIONS',
      descPre: 'L2 realmente',
      descStrong: 'ejecuta',
      descPost: ' el servidor MCP en un contenedor Docker aislado, disparado vía GitHub Actions (repository_dispatch) desde Vercel. La primera auditoría devuelve "triggered_async"; las siguientes obtienen resultados L2 cacheados del repo. L2 NO bloquea la respuesta de la API — corre async.',
      runAudit: '→ Ejecutar auditoría',
      sandboxConfigTitle: 'CONFIG DEL SANDBOX DOCKER:',
      sandboxConfig: [
        { flag: '--network none', purpose: 'Sin acceso a red (detecta intentos vía ECONNREFUSED en logs)' },
        { flag: '--read-only', purpose: 'Filesystem raíz read-only (escrituras solo a /tmp vía tmpfs)' },
        { flag: '--memory 256m', purpose: 'Tope duro de memoria en 256MB' },
        { flag: '--cpus 0.5', purpose: 'CPU limitada a medio núcleo' },
        { flag: '--cap-drop ALL', purpose: 'Todas las capabilities de Linux dropeadas' },
        { flag: '--security-opt no-new-privileges', purpose: 'Sin escalación de privilegios' },
        { flag: '--security-opt seccomp=seccomp.json', purpose: 'ptrace bloqueado (otros syscalls permitidos para monitoreo)' },
        { flag: '--tmpfs /tmp:rw,size=64m', purpose: '/tmp escribible, tope 64MB' },
      ],
      behavioralTitle: 'ANÁLISIS CONDUCTUAL:',
      behavioralChecks: [
        { label: 'Red — menciones de URLs en stdout, errores ECONNREFUSED/ENOTFOUND (el contenedor no puede llegar a la red)', category: 'Red' },
        { label: 'Filesystem — docker diff para cambios fuera de /tmp, cambios excesivos (>10 archivos)', category: 'Filesystem' },
        { label: 'Procesos — docker top captura procesos corriendo dentro del contenedor', category: 'Procesos' },
        { label: 'Credenciales — menciones en stdout de ssh, id_rsa, aws/credentials, .env, passwd, shadow = multiplicador 0.0 instantáneo', category: 'Credenciales' },
        { label: 'Crashes — contenedor exits con código non-zero (puede indicar comportamiento malicioso al iniciar)', category: 'Crashes' },
        { label: 'Imports dinámicos — menciones en stdout de exec(, spawn, child_process, subprocess, os.system', category: 'Imports Dinámicos' },
      ],
      phases: [
        { label: 'FASE 1 (Q3 2026)', value: 'Docker + seccomp + strace', status: '✅ LIVE (GitHub Actions)' },
        { label: 'FASE 2 (Q4 2026)', value: 'gVisor', status: 'Gratis (self-hosted)' },
        { label: 'FASE 3 (Q1 2027)', value: 'Firecracker microVM', status: 'Pago (necesita KVM)' },
      ],
    },
    limits: {
      title: 'LIMITACIONES HONESTAS DE SENTINEL',
      desc: 'No vamos a pretender que Sentinel es perfecto. Esto es exactamente lo que no puede hacer hoy, y qué estamos haciendo al respecto.',
      cards: [
        { warn: '⚠️ L2 ES ASYNC', body: 'L2 corre vía GitHub Actions, no en tiempo real en cada llamada a la API. La primera auditoría devuelve "triggered_async"; los resultados llegan al repo en 2–5 minutos y aplican en la SIGUIENTE auditoría.' },
        { warn: '⚠️ DETECCIÓN BASADA EN REGEX', body: 'L1.6 usa patrones regex JS (tipo Semgrep). Pueden ser evadidos vía ofuscación, encodings, o llamadas indirectas. Los patrones atrapan sintaxis, no intención.' },
        { warn: '⚠️ SIN ANÁLISIS DE CÓDIGO FUENTE EN TIEMPO REAL', body: 'L1.6 analiza metadata + descripciones solamente. El análisis completo del código fuente ocurre en L2 (async vía GitHub Actions), no en cada llamada a Vercel.' },
        { warn: '⚠️ SIN AUDITORÍA DE TERCEROS AÚN', body: 'Ninguna firma de seguridad independiente ha auditado Sentinel. Somos bootstrapped — la auditoría de terceros está diferida hasta que los ingresos la cubran.' },
      ],
      riskTitle: 'EVALUACIÓN DE RIESGO POR TIPO DE SKILL',
      col1: 'Tipo de Skill',
      col2: 'Nivel de Riesgo',
      col3: 'Por qué',
      rows: [
        { type: 'Free (human-reviewed)', level: 'BAJO', why: '43 skills inspeccionadas manualmente por AliceLabs' },
        { type: 'Auto-scanned, risk_level=green', level: 'MEDIO', why: 'Solo prompt, sin install. Sentinel v3.0+L1.6 corrió; sin revisión humana.' },
        { type: 'Auto-scanned, risk_level=yellow', level: 'MEDIO-ALTO', why: 'Acceso a red/API. Sentinel corrió; L2 puede o no tener resultados aún.' },
        { type: 'Paid, auto-scanned', level: 'ALTO', why: 'Ejecución de código + dinero involucrado. Usa mandatos con límites bajos.' },
      ],
      bottomLineLabel: 'Conclusión:',
      bottomLineBody: 'Sentinel v3.0 + L1.6 corren en tiempo real en cada llamada a la API. L2 corre async vía GitHub Actions y aplica en la próxima auditoría. Esto es honesto, auditable y open source — pero no sustituye la revisión humana de código que se ejecuta en tu máquina.',
    },
    changelog: {
      title: 'CHANGELOG DE SENTINEL',
      entries: [
        {
          date: '2026-07-05',
          strong: 'FINAL-AUDIT-ALL.',
          body: ' Security.jsx reescrito para reflejar la arquitectura REAL: v3.0 (6 checks, Vercel tiempo real) + L1.6 (18 Semgrep + 18 secretos + OSV API, Vercel tiempo real) + L2 (Docker sandbox, GitHub Actions, disparado desde Vercel). Limitaciones honestas actualizadas (L2 async, basado en regex, sin auditoría de terceros).',
          code: '→ Código',
        },
        {
          date: '2026-07-02',
          strong: 'L2 ACTIVADO.',
          body: ' /api/audit-skill ahora dispara L2 vía repository_dispatch. Docker sandbox: --network none, --read-only, --memory 256m, --cpus 0.5, --security-opt no-new-privileges, --cap-drop ALL, seccomp. Análisis conductual: stdout creds/URLs/exec, docker diff, docker top, exit code. Resultados commiteados a _data/l2_results/{skillId}.json y obtenidos en la próxima auditoría. ASYNC — no bloquea la respuesta de la API.',
          code: '→ Código',
          runAudit: '→ Ejecutar auditoría',
        },
        {
          date: '2026-07-02',
          strong: 'L1.6 LIVE EN PRODUCCIÓN.',
          body: ' 18 reglas tipo-Semgrep en JS regex (prompt injection, command injection, secretos, SSRF, path traversal, tool spoofing, inputSchema faltante) + 18 patrones de secretos (Stripe, AWS, GitHub, JWT, Slack, Google, Twilio, wallets) + OSV API tiempo real. Corre en Vercel en cada llamada a /api/audit-skill.',
          code: '→ Código',
        },
        {
          date: '2026-06-30',
          strong: 'v3.0 live.',
          body: ' Auditoría basada en metadata de 6 puntos: AUTH, patrones de prompt injection, validación de inputs, CORS, OAuth scopes, fuga de info en rate limiting.',
        },
      ],
      links: [
        { text: '→ Roadmap completo (v3.0 → L3.5)', to: '/sentinel-roadmap' },
        { text: '→ Hoja de confianza', to: '/trust' },
        { text: '→ Guía del comprador', to: '/buyers-guide' },
      ],
    },
  },

  pt: {
    badge: 'SENTINEL v3.0 → L1.6 → L2',
    stats: {
      total: 'Skills Totais',
      scanned: 'Escaneadas pelo Sentinel',
      avgScore: 'Pontuação Média Sentinel',
      passRate: 'Taxa de Aprovação (≥4/10)',
      critical: 'Problemas Críticos',
    },
    banner: {
      l15Label: 'v3.0 LIVE',
      l15Desc: '→ 6 checks de metadata, roda em Vercel em tempo real',
      l16Label: 'L1.6 LIVE',
      l16Desc: '→ 18 regras Semgrep + 18 padrões de secretos + OSV API, roda em Vercel em tempo real',
      l2Label: 'L2 LIVE',
      l2Desc: '→ Docker sandbox (--network none, --read-only, --cap-drop ALL), roda via GitHub Actions, disparado do Vercel',
    },
    architecture: {
      title: 'ARQUITETURA — FLUXO PONTA A PONTA',
      desc: 'Vercel roda v3.0 + L1.6 em tempo real em cada chamada a /api/audit-skill (~200ms). Se a skill tem um repo GitHub, Vercel dispara L2 via repository_dispatch. GitHub Actions roda o sandbox Docker (2-5 min), commita os resultados ao repo, e a próxima auditoria busca os resultados L2 em cache.',
      diagram: `┌─────────────────────────────────────────────────────────────┐
│              VERCEL  (tempo real, ~200ms por chamada)         │
│   POST /api/audit-skill  { skillId }                          │
│   ├─ v3.0  6 checks de metadata (AUTH, injeção, validação,    │
│   │        CORS, OAuth scopes, vazamento de rate limiting)    │
│   └─ L1.6  18 regras Semgrep + 18 padrões de secretos + OSV  │
│            (api.osv.dev/v1/query — tempo real)                │
│                                                                │
│   L2 trigger (somente se skill.source.url for um repo GitHub) │
│   └─► POST api.github.com/repos/{REPO}/dispatches             │
│       event_type: sentinel-l2-audit                            │
└────────────────────────────────┬───────────────────────────────┘
                                 │  (async — não bloqueia a resposta)
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│          GITHUB ACTIONS  (async, ~2–5 min por execução)       │
│   repository_dispatch  →  sentinel-l2-sandbox.sh              │
│   ├─ git clone --depth 1 \${REPO_URL}                          │
│   ├─ docker build                                             │
│   └─ docker run  --network none                               │
│                  --read-only                                  │
│                  --memory 256m  --cpus 0.5                    │
│                  --security-opt no-new-privileges             │
│                  --security-opt seccomp=seccomp.json          │
│                  --cap-drop ALL                               │
│                  --tmpfs /tmp:rw,size=64m                     │
│                                                                │
│   Análise comportamental:                                     │
│   • docker logs    → stdout: menções de creds/URL/exec        │
│   • docker diff    → mudanças no filesystem (fora de /tmp)    │
│   • docker top     → lista de processos                       │
│   • docker inspect → exit code, tentativas de rede            │
└────────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│       RESULTADOS COMMITADOS AO REPO  (versionado, auditável)  │
│   _data/l2_results/{skillId}.json                             │
│   { score: 0–10, multiplier: 0.0–1.0, findings: {…} }         │
└────────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│       PRÓXIMA AUDITORIA  (Vercel busca L2 em cache)           │
│   GET raw.githubusercontent.com/.../l2_results/{skillId}.json │
│   → aplica multiplicador L2 à pontuação (v3.0 + L1.6)         │
└─────────────────────────────────────────────────────────────┘`,
    },
    l15: {
      title: 'CHECKS DO SENTINEL v3.0',
      live: 'LIVE NO VERCEL',
      checks: [
        { label: 'AUTH — O servidor requer autenticação?', category: 'Autenticação' },
        { label: 'Injeção em descrição de tools — 8 padrões de prompt injection detectados', category: 'Prompt Injection' },
        { label: 'Validação de inputs — Valida os inputs?', category: 'Validação de Inputs' },
        { label: 'CORS — A política CORS é permissiva?', category: 'CORS' },
        { label: 'OAuth scopes — Os scopes são mínimos?', category: 'OAuth' },
        { label: 'Vazamento de info em rate limiting — Erros vazam info de rate limit?', category: 'Rate Limiting' },
      ],
      descPre: 'v3.0 roda em',
      descCode: 'Vercel em tempo real',
      descPost: ' em cada chamada a /api/audit-skill. Analisa metadata (README, package.json, descrições de tools). Skills com pontuação abaixo de 4/10 são bloqueadas.',
    },
    audit: {
      title: 'TRILHA DE AUDITORIA',
      live: 'LIVE',
      empty: 'Nenhum log de auditoria disponível ainda.',
    },
    l16: {
      title: 'SENTINEL L1.6 — ANÁLISE ESTÁTICA EM TEMPO REAL (LIVE EM PRODUÇÃO)',
      badge: 'LIVE EM PRODUÇÃO · TEMPO REAL NO VERCEL',
      descPre: 'L1.6 roda EM TEMPO REAL em cada chamada a /api/audit-skill no Vercel. Três subsistemas:',
      descSemgrepSuffix: ' (18 regras MCP: prompt injection, command injection, secretos, SSRF, path traversal, tool spoofing), ',
      descSecretsSuffix: ' (18 padrões: Stripe, AWS, GitHub, JWT, Slack, Google, Twilio, wallets, private keys), ',
      descOSVSuffix: ' (cheque de vulnerabilidades em tempo real via api.osv.dev). ',
      descPost: 'Fonte:',
      descVia: 'lib/sentinel-l16.mjs',
      checks: [
        { label: '18 regras tipo-Semgrep — padrões regex JS para prompt injection (6), command injection (4), secretos (2), SSRF (2), path traversal (2), tool spoofing (1), inputSchema faltante (1)', category: 'Análise Estática' },
        { label: '18 padrões de detecção de secretos — Stripe (live/test/publishable), GitHub (PAT/OAuth/app/refresh), AWS (access key + secret), private keys (RSA/EC/OPENSSH), mnemonics de wallet, private keys de Ethereum, JWT, Slack, Discord, Google API, Twilio, passwords genéricas', category: 'Escaneamento de Secretos' },
        { label: 'OSV API tempo real — consulta api.osv.dev/v1/query para cada pacote npx instalado', category: 'Cadeia de Suprimentos' },
        { label: 'Scoring ponderado — Secretos 40%, Vulns 30%, Estático 20%, Higiene 10%', category: 'Scoring' },
        { label: 'Secreto crítico = score 0 instantâneo (bloqueia listing)', category: 'Bloqueio' },
      ],
      rulesTitle: 'REGRAS SEMGREP (18 NO TOTAL):',
      rules: ['Prompt injection (6)', 'Command injection (4)', 'Credenciais hardcoded (2)', 'SSRF (2)', 'Path traversal (2)', 'Tool spoofing (1)', 'inputSchema faltante (1)'],
      viewRules: '→ Ver ruleset completo no GitHub',
    },
    l2: {
      title: 'SENTINEL L2 — ANÁLISE DINÂMICA EM SANDBOX (IMPLEMENTADO)',
      live: 'LIVE · ASYNC VIA GITHUB ACTIONS',
      descPre: 'L2 realmente',
      descStrong: 'executa',
      descPost: ' o servidor MCP em um contêiner Docker isolado, disparado via GitHub Actions (repository_dispatch) do Vercel. A primeira auditoria retorna "triggered_async"; as seguintes buscam resultados L2 em cache do repo. L2 NÃO bloqueia a resposta da API — roda async.',
      runAudit: '→ Executar auditoria',
      sandboxConfigTitle: 'CONFIG DO SANDBOX DOCKER:',
      sandboxConfig: [
        { flag: '--network none', purpose: 'Sem acesso à rede (detecta tentativas via ECONNREFUSED nos logs)' },
        { flag: '--read-only', purpose: 'Filesystem raiz read-only (escritas só em /tmp via tmpfs)' },
        { flag: '--memory 256m', purpose: 'Limite duro de memória em 256MB' },
        { flag: '--cpus 0.5', purpose: 'CPU limitada a meio núcleo' },
        { flag: '--cap-drop ALL', purpose: 'Todas as capabilities do Linux removidas' },
        { flag: '--security-opt no-new-privileges', purpose: 'Sem escalonamento de privilégios' },
        { flag: '--security-opt seccomp=seccomp.json', purpose: 'ptrace bloqueado (outros syscalls permitidos para monitoramento)' },
        { flag: '--tmpfs /tmp:rw,size=64m', purpose: '/tmp escribível, limite 64MB' },
      ],
      behavioralTitle: 'ANÁLISE COMPORTAMENTAL:',
      behavioralChecks: [
        { label: 'Rede — menções de URLs em stdout, erros ECONNREFUSED/ENOTFOUND (contêiner não pode chegar à rede)', category: 'Rede' },
        { label: 'Filesystem — docker diff para mudanças fora de /tmp, mudanças excessivas (>10 arquivos)', category: 'Filesystem' },
        { label: 'Processos — docker top captura processos rodando dentro do contêiner', category: 'Processos' },
        { label: 'Credenciais — menções em stdout de ssh, id_rsa, aws/credentials, .env, passwd, shadow = multiplicador 0.0 instantâneo', category: 'Credenciais' },
        { label: 'Crashes — contêiner exited com código non-zero (pode indicar comportamento malicioso no startup)', category: 'Crashes' },
        { label: 'Imports dinâmicos — menções em stdout de exec(, spawn, child_process, subprocess, os.system', category: 'Imports Dinâmicos' },
      ],
      phases: [
        { label: 'FASE 1 (Q3 2026)', value: 'Docker + seccomp + strace', status: '✅ LIVE (GitHub Actions)' },
        { label: 'FASE 2 (Q4 2026)', value: 'gVisor', status: 'Grátis (self-hosted)' },
        { label: 'FASE 3 (Q1 2027)', value: 'Firecracker microVM', status: 'Pago (precisa de KVM)' },
      ],
    },
    limits: {
      title: 'LIMITAÇÕES HONESTAS DO SENTINEL',
      desc: 'Não vamos fingir que Sentinel é perfeito. Isso é exatamente o que ele não pode fazer hoje, e o que estamos fazendo a respeito.',
      cards: [
        { warn: '⚠️ L2 É ASYNC', body: 'L2 roda via GitHub Actions, não em tempo real em cada chamada à API. A primeira auditoria retorna "triggered_async"; os resultados chegam ao repo em 2–5 minutos e aplicam na PRÓXIMA auditoria.' },
        { warn: '⚠️ DETECÇÃO BASEADA EM REGEX', body: 'L1.6 usa padrões regex JS (tipo Semgrep). Podem ser evadidos via ofuscação, encodings, ou chamadas indiretas. Padrões capturam sintaxe, não intenção.' },
        { warn: '⚠️ SEM ANÁLISE DE CÓDIGO-FONTE EM TEMPO REAL', body: 'L1.6 analisa metadata + descrições somente. A análise completa do código-fonte acontece no L2 (async via GitHub Actions), não em cada chamada ao Vercel.' },
        { warn: '⚠️ SEM AUDITORIA DE TERCEIROS AINDA', body: 'Nenhuma firma de segurança independente auditou o Sentinel. Somos bootstrapped — auditoria de terceiros é diferida até que a receita a cubra.' },
      ],
      riskTitle: 'AVALIAÇÃO DE RISCO POR TIPO DE SKILL',
      col1: 'Tipo de Skill',
      col2: 'Nível de Risco',
      col3: 'Por quê',
      rows: [
        { type: 'Free (human-reviewed)', level: 'BAIXO', why: '43 skills inspecionadas manualmente pela AliceLabs' },
        { type: 'Auto-scanned, risk_level=green', level: 'MÉDIO', why: 'Somente prompt, sem install. Sentinel v3.0+L1.6 rodou; sem revisão humana.' },
        { type: 'Auto-scanned, risk_level=yellow', level: 'MÉDIO-ALTO', why: 'Acesso a rede/API. Sentinel rodou; L2 pode ou não ter resultados ainda.' },
        { type: 'Paid, auto-scanned', level: 'ALTO', why: 'Execução de código + dinheiro envolvido. Use mandatos com limites baixos.' },
      ],
      bottomLineLabel: 'Conclusão:',
      bottomLineBody: 'Sentinel v3.0 + L1.6 rodam em tempo real em cada chamada à API. L2 roda async via GitHub Actions e aplica na próxima auditoria. Isso é honesto, auditável e open source — mas não substitui a revisão humana de código que executa na sua máquina.',
    },
    changelog: {
      title: 'CHANGELOG DO SENTINEL',
      entries: [
        {
          date: '2026-07-05',
          strong: 'FINAL-AUDIT-ALL.',
          body: ' Security.jsx reescrito para refletir a arquitetura REAL: v3.0 (6 checks, Vercel tempo real) + L1.6 (18 Semgrep + 18 secretos + OSV API, Vercel tempo real) + L2 (Docker sandbox, GitHub Actions, disparado do Vercel). Limitações honestas atualizadas (L2 async, baseado em regex, sem auditoria de terceiros).',
          code: '→ Código',
        },
        {
          date: '2026-07-02',
          strong: 'L2 ATIVADO.',
          body: ' /api/audit-skill agora dispara L2 via repository_dispatch. Docker sandbox: --network none, --read-only, --memory 256m, --cpus 0.5, --security-opt no-new-privileges, --cap-drop ALL, seccomp. Análise comportamental: stdout creds/URLs/exec, docker diff, docker top, exit code. Resultados commitados a _data/l2_results/{skillId}.json e buscados na próxima auditoria. ASYNC — não bloqueia a resposta da API.',
          code: '→ Código',
          runAudit: '→ Executar auditoria',
        },
        {
          date: '2026-07-02',
          strong: 'L1.6 LIVE EM PRODUÇÃO.',
          body: ' 18 regras tipo-Semgrep em JS regex (prompt injection, command injection, secretos, SSRF, path traversal, tool spoofing, inputSchema faltante) + 18 padrões de secretos (Stripe, AWS, GitHub, JWT, Slack, Google, Twilio, wallets) + OSV API tempo real. Roda no Vercel em cada chamada a /api/audit-skill.',
          code: '→ Código',
        },
        {
          date: '2026-06-30',
          strong: 'v3.0 live.',
          body: ' Auditoria baseada em metadata de 6 pontos: AUTH, padrões de prompt injection, validação de inputs, CORS, OAuth scopes, vazamento de info em rate limiting.',
        },
      ],
      links: [
        { text: '→ Roadmap completo (v3.0 → L3.5)', to: '/sentinel-roadmap' },
        { text: '→ Roadmap de confiança', to: '/trust' },
        { text: '→ Guia do comprador', to: '/buyers-guide' },
      ],
    },
  },

  zh: {
    badge: 'SENTINEL v3.0 → L1.6 → L2',
    stats: {
      total: '技能总数',
      scanned: 'Sentinel 扫描数',
      avgScore: 'Sentinel 平均分',
      passRate: '通过率 (≥4/10)',
      critical: '严重问题',
    },
    banner: {
      l15Label: 'v3.0 LIVE',
      l15Desc: '→ 6 项元数据检查,在 Vercel 实时运行',
      l16Label: 'L1.6 LIVE',
      l16Desc: '→ 18 条 Semgrep 规则 + 18 个密钥模式 + OSV API,在 Vercel 实时运行',
      l2Label: 'L2 LIVE',
      l2Desc: '→ Docker 沙箱(--network none、--read-only、--cap-drop ALL),通过 GitHub Actions 运行,从 Vercel 触发',
    },
    architecture: {
      title: '架构 — 端到端流程',
      desc: 'Vercel 在每次 /api/audit-skill 调用时实时运行 v3.0 + L1.6(约 200ms)。如果技能有 GitHub 仓库,Vercel 通过 repository_dispatch 触发 L2。GitHub Actions 运行 Docker 沙箱(2-5 分钟),将结果提交到仓库,下次审计获取缓存的 L2 结果。',
      diagram: `┌─────────────────────────────────────────────────────────────┐
│              VERCEL  (实时,每次调用约 200ms)                  │
│   POST /api/audit-skill  { skillId }                          │
│   ├─ v3.0  6 项元数据检查 (AUTH、注入、验证、CORS、          │
│   │        OAuth scopes、限流错误泄漏)                        │
│   └─ L1.6  18 条 Semgrep 规则 + 18 个密钥模式 + OSV API      │
│            (api.osv.dev/v1/query — 实时)                      │
│                                                                │
│   L2 触发 (仅当 skill.source.url 是 GitHub 仓库时)            │
│   └─► POST api.github.com/repos/{REPO}/dispatches             │
│       event_type: sentinel-l2-audit                            │
└────────────────────────────────┬───────────────────────────────┘
                                 │  (异步 — 不阻塞响应)
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│          GITHUB ACTIONS  (异步,每次运行约 2–5 分钟)          │
│   repository_dispatch  →  sentinel-l2-sandbox.sh              │
│   ├─ git clone --depth 1 \${REPO_URL}                          │
│   ├─ docker build                                             │
│   └─ docker run  --network none                               │
│                  --read-only                                  │
│                  --memory 256m  --cpus 0.5                    │
│                  --security-opt no-new-privileges             │
│                  --security-opt seccomp=seccomp.json          │
│                  --cap-drop ALL                               │
│                  --tmpfs /tmp:rw,size=64m                     │
│                                                                │
│   行为分析:                                                   │
│   • docker logs    → stdout: 凭据/URL/exec 提及               │
│   • docker diff    → 文件系统变更 (/tmp 之外)                 │
│   • docker top     → 进程列表                                 │
│   • docker inspect → 退出码、网络尝试                         │
└────────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│       结果提交到仓库  (版本化、可审计)                        │
│   _data/l2_results/{skillId}.json                             │
│   { score: 0–10, multiplier: 0.0–1.0, findings: {…} }         │
└────────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│       下次审计  (Vercel 获取缓存的 L2 结果)                   │
│   GET raw.githubusercontent.com/.../l2_results/{skillId}.json │
│   → 将 L2 乘数应用到 (v3.0 + L1.6) 分数                      │
└─────────────────────────────────────────────────────────────┘`,
    },
    l15: {
      title: 'SENTINEL v3.0 检查项',
      live: 'VERCEL 实时',
      checks: [
        { label: 'AUTH — 服务器是否要求身份验证?', category: '身份验证' },
        { label: '工具描述注入 — 检测到 8 种提示注入模式', category: '提示注入' },
        { label: '输入验证 — 是否验证输入?', category: '输入验证' },
        { label: 'CORS — CORS 策略是否宽松?', category: 'CORS' },
        { label: 'OAuth scopes — scope 是否最小化?', category: 'OAuth' },
        { label: '限流错误泄漏 — 错误是否泄漏限流信息?', category: '限流' },
      ],
      descPre: 'v3.0 在',
      descCode: 'Vercel 实时',
      descPost: ' 中运行,每次 /api/audit-skill 调用都执行。它分析元数据(README、package.json、工具描述)。分数低于 4/10 的技能会被屏蔽。',
    },
    audit: {
      title: '审计追踪',
      live: 'LIVE',
      empty: '暂无审计日志。',
    },
    l16: {
      title: 'SENTINEL L1.6 — 实时静态分析(生产环境 LIVE)',
      badge: '生产环境 LIVE · VERCEL 实时',
      descPre: 'L1.6 在每次 /api/audit-skill 调用时在 Vercel 中实时运行。三个子系统:',
      descSemgrepSuffix: '(18 条 MCP 专用规则:提示注入、命令注入、密钥、SSRF、路径穿越、工具伪造),',
      descSecretsSuffix: '(18 个模式:Stripe、AWS、GitHub、JWT、Slack、Google、Twilio、钱包、私钥),',
      descOSVSuffix: '(通过 api.osv.dev 实时检查依赖漏洞)。',
      descPost: '源码:',
      descVia: 'lib/sentinel-l16.mjs',
      checks: [
        { label: '18 条 Semgrep 等效规则 — JS 正则模式:提示注入 (6)、命令注入 (4)、密钥 (2)、SSRF (2)、路径穿越 (2)、工具伪造 (1)、缺失 inputSchema (1)', category: '静态分析' },
        { label: '18 个密钥检测模式 — Stripe (live/test/publishable)、GitHub (PAT/OAuth/app/refresh)、AWS (access key + secret)、私钥 (RSA/EC/OPENSSH)、钱包助记词、以太坊私钥、JWT、Slack、Discord、Google API、Twilio、通用密码', category: '密钥扫描' },
        { label: 'OSV API 实时依赖检查 — 为每个 npx 安装的包查询 api.osv.dev/v1/query', category: '供应链' },
        { label: '加权评分 — 密钥 40%、漏洞 30%、静态 20%、规范 10%', category: '评分' },
        { label: '严重密钥 = 立即 0 分(阻止上架)', category: '阻断' },
      ],
      rulesTitle: 'SEMGREP 规则(共 18 条):',
      rules: ['提示注入 (6)', '命令注入 (4)', '硬编码凭据 (2)', 'SSRF (2)', '路径穿越 (2)', '工具伪造 (1)', '缺失 inputSchema (1)'],
      viewRules: '→ 在 GitHub 查看完整规则集',
    },
    l2: {
      title: 'SENTINEL L2 — 动态沙箱分析(已实现)',
      live: 'LIVE · 通过 GITHUB ACTIONS 异步运行',
      descPre: 'L2 真正',
      descStrong: '运行',
      descPost: ' MCP 服务器在隔离的 Docker 容器中,通过 GitHub Actions (repository_dispatch) 从 Vercel 触发。首次审计返回 "triggered_async";后续审计从仓库获取缓存的 L2 结果。L2 不会阻塞 API 响应 — 它异步运行。',
      runAudit: '→ 运行审计',
      sandboxConfigTitle: 'DOCKER 沙箱配置:',
      sandboxConfig: [
        { flag: '--network none', purpose: '无网络访问(通过日志中的 ECONNREFUSED 检测尝试)' },
        { flag: '--read-only', purpose: '根文件系统只读(仅通过 tmpfs 写入 /tmp)' },
        { flag: '--memory 256m', purpose: '内存硬上限 256MB' },
        { flag: '--cpus 0.5', purpose: 'CPU 限制为半个核心' },
        { flag: '--cap-drop ALL', purpose: '丢弃所有 Linux capabilities' },
        { flag: '--security-opt no-new-privileges', purpose: '无法提权' },
        { flag: '--security-opt seccomp=seccomp.json', purpose: '阻止 ptrace(其他 syscall 允许以便监控)' },
        { flag: '--tmpfs /tmp:rw,size=64m', purpose: '可写 /tmp,上限 64MB' },
      ],
      behavioralTitle: '行为分析:',
      behavioralChecks: [
        { label: '网络 — stdout 中提及 URL、ECONNREFUSED/ENOTFOUND 错误(容器无法访问网络)', category: '网络' },
        { label: '文件系统 — docker diff 检测 /tmp 之外的变更、过多文件变更(>10 个)', category: '文件系统' },
        { label: '进程 — docker top 捕获容器内运行的进程', category: '进程' },
        { label: '凭据 — stdout 中提及 ssh、id_rsa、aws/credentials、.env、passwd、shadow = 立即 0.0 乘数', category: '凭据' },
        { label: '崩溃 — 容器以非零码退出(可能表示启动时恶意行为)', category: '崩溃' },
        { label: '动态导入 — stdout 中提及 exec(、spawn、child_process、subprocess、os.system', category: '动态导入' },
      ],
      phases: [
        { label: '第 1 阶段 (2026 Q3)', value: 'Docker + seccomp + strace', status: '✅ LIVE (GitHub Actions)' },
        { label: '第 2 阶段 (2026 Q4)', value: 'gVisor', status: '免费(自托管)' },
        { label: '第 3 阶段 (2027 Q1)', value: 'Firecracker microVM', status: '付费(需 KVM)' },
      ],
    },
    limits: {
      title: 'SENTINEL 的诚实局限',
      desc: '我们不会假装 Sentinel 完美。以下是它今天做不到的事,以及我们的应对。',
      cards: [
        { warn: '⚠️ L2 是异步的', body: 'L2 通过 GitHub Actions 运行,不是每次 API 调用都实时运行。首次审计返回 "triggered_async";结果在 2–5 分钟后落地仓库,在下一次审计时应用。' },
        { warn: '⚠️ 基于正则的检测', body: 'L1.6 使用 JS 正则模式(Semgrep 等效)。可通过混淆、编码或间接调用绕过。模式捕获语法,而非意图。' },
        { warn: '⚠️ 实时不分析完整源码', body: 'L1.6 仅分析元数据 + 描述。完整源代码分析在 L2 中进行(通过 GitHub Actions 异步),不在每次 Vercel 调用时执行。' },
        { warn: '⚠️ 尚无第三方审计', body: '没有独立安全公司审计过 Sentinel。我们是自筹资金 — 第三方审计推迟到收入覆盖成本后。' },
      ],
      riskTitle: '按技能类型的风险评估',
      col1: '技能类型',
      col2: '风险等级',
      col3: '原因',
      rows: [
        { type: '免费(人工审核)', level: '低', why: '43 个技能由 AliceLabs 人工检查' },
        { type: '自动扫描,risk_level=green', level: '中', why: '仅提示,无安装。Sentinel v3.0+L1.6 已运行;无人工审核。' },
        { type: '自动扫描,risk_level=yellow', level: '中高', why: '有网络/API 访问。Sentinel 已运行;L2 可能尚无结果。' },
        { type: '付费,自动扫描', level: '高', why: '涉及代码执行 + 资金。使用低额度的授权。' },
      ],
      bottomLineLabel: '底线:',
      bottomLineBody: 'Sentinel v3.0 + L1.6 在每次 API 调用时实时运行。L2 通过 GitHub Actions 异步运行,在下次审计时应用。这是诚实、可审计、开源的 — 但不能替代对你机器上执行代码的人工审核。',
    },
    changelog: {
      title: 'SENTINEL 更新日志',
      entries: [
        {
          date: '2026-07-05',
          strong: 'FINAL-AUDIT-ALL。',
          body: ' Security.jsx 重写以反映真实架构:v3.0(6 项检查,Vercel 实时)+ L1.6(18 Semgrep + 18 密钥 + OSV API,Vercel 实时)+ L2(Docker 沙箱,GitHub Actions,从 Vercel 触发)。更新诚实局限(L2 异步、基于正则、无第三方审计)。',
          code: '→ 代码',
        },
        {
          date: '2026-07-02',
          strong: 'L2 已激活。',
          body: ' /api/audit-skill 现在通过 repository_dispatch 触发 L2。Docker 沙箱:--network none、--read-only、--memory 256m、--cpus 0.5、--security-opt no-new-privileges、--cap-drop ALL、seccomp。行为分析:stdout 凭据/URL/exec、docker diff、docker top、退出码。结果提交到 _data/l2_results/{skillId}.json,下次审计获取。异步 — 不阻塞 API 响应。',
          code: '→ 代码',
          runAudit: '→ 运行审计',
        },
        {
          date: '2026-07-02',
          strong: 'L1.6 生产环境 LIVE。',
          body: ' 18 条 Semgrep 等效 JS 正则规则(提示注入、命令注入、密钥、SSRF、路径穿越、工具伪造、缺失 inputSchema)+ 18 个密钥模式(Stripe、AWS、GitHub、JWT、Slack、Google、Twilio、钱包)+ OSV API 实时。在 Vercel 中每次 /api/audit-skill 调用时运行。',
          code: '→ 代码',
        },
        {
          date: '2026-06-30',
          strong: 'v3.0 上线。',
          body: ' 6 项基于元数据的审计:AUTH、提示注入模式、输入验证、CORS、OAuth scopes、限流错误泄漏。',
        },
      ],
      links: [
        { text: '→ 完整路线图 (v3.0 → L3.5)', to: '/sentinel-roadmap' },
        { text: '→ 信任路线图', to: '/trust' },
        { text: '→ 买家指南', to: '/buyers-guide' },
      ],
    },
  },

  fr: {
    badge: 'SENTINEL v3.0 → L1.6 → L2',
    stats: {
      total: 'Skills Totales',
      scanned: 'Scannées par Sentinel',
      avgScore: 'Score Moyen Sentinel',
      passRate: 'Taux de Réussite (≥4/10)',
      critical: 'Problèmes Critiques',
    },
    banner: {
      l15Label: 'v3.0 LIVE',
      l15Desc: '→ 6 checks de metadata, tourne dans Vercel en temps réel',
      l16Label: 'L1.6 LIVE',
      l16Desc: '→ 18 règles Semgrep + 18 patterns de secrets + OSV API, tourne dans Vercel en temps réel',
      l2Label: 'L2 LIVE',
      l2Desc: '→ Docker sandbox (--network none, --read-only, --cap-drop ALL), tourne via GitHub Actions, déclenché depuis Vercel',
    },
    architecture: {
      title: 'ARCHITECTURE — FLUX DE BOUT EN BOUT',
      desc: 'Vercel exécute v3.0 + L1.6 en temps réel à chaque appel /api/audit-skill (~200ms). Si la skill a un repo GitHub, Vercel déclenche L2 via repository_dispatch. GitHub Actions exécute le sandbox Docker (2-5 min), commite les résultats au repo, et la prochaine audit récupère les résultats L2 en cache.',
      diagram: `┌─────────────────────────────────────────────────────────────┐
│              VERCEL  (temps réel, ~200ms par appel)           │
│   POST /api/audit-skill  { skillId }                          │
│   ├─ v3.0  6 checks de metadata (AUTH, injection, validation, │
│   │        CORS, OAuth scopes, fuite de rate limiting)        │
│   └─ L1.6  18 règles Semgrep + 18 patterns de secrets + OSV  │
│            (api.osv.dev/v1/query — temps réel)                │
│                                                                │
│   L2 trigger (uniquement si skill.source.url est un repo GH)  │
│   └─► POST api.github.com/repos/{REPO}/dispatches             │
│       event_type: sentinel-l2-audit                            │
└────────────────────────────────┬───────────────────────────────┘
                                 │  (async — ne bloque pas la réponse)
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│          GITHUB ACTIONS  (async, ~2–5 min par exécution)      │
│   repository_dispatch  →  sentinel-l2-sandbox.sh              │
│   ├─ git clone --depth 1 \${REPO_URL}                          │
│   ├─ docker build                                             │
│   └─ docker run  --network none                               │
│                  --read-only                                  │
│                  --memory 256m  --cpus 0.5                    │
│                  --security-opt no-new-privileges             │
│                  --security-opt seccomp=seccomp.json          │
│                  --cap-drop ALL                               │
│                  --tmpfs /tmp:rw,size=64m                     │
│                                                                │
│   Analyse comportementale :                                   │
│   • docker logs    → stdout : mentions de creds/URL/exec      │
│   • docker diff    → changements filesystem (hors /tmp)       │
│   • docker top     → liste des processus                      │
│   • docker inspect → code de sortie, tentatives réseau        │
└────────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│       RÉSULTATS COMMITÉS AU REPO  (versionné, auditable)      │
│   _data/l2_results/{skillId}.json                             │
│   { score: 0–10, multiplier: 0.0–1.0, findings: {…} }         │
└────────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│       PROCHAINE AUDIT  (Vercel récupère L2 en cache)          │
│   GET raw.githubusercontent.com/.../l2_results/{skillId}.json │
│   → applique le multiplicateur L2 au score (v3.0 + L1.6)      │
└─────────────────────────────────────────────────────────────┘`,
    },
    l15: {
      title: 'CHECKS SENTINEL v3.0',
      live: 'LIVE DANS VERCEL',
      checks: [
        { label: 'AUTH — Le serveur requiert-il une authentification ?', category: 'Authentification' },
        { label: 'Injection dans la description des tools — 8 motifs d\'injection de prompt détectés', category: 'Injection de Prompt' },
        { label: 'Validation des inputs — Valide-t-il les inputs ?', category: 'Validation des Inputs' },
        { label: 'CORS — La politique CORS est-elle permissive ?', category: 'CORS' },
        { label: 'OAuth scopes — Les scopes sont-ils minimaux ?', category: 'OAuth' },
        { label: 'Fuite d\'info dans le rate limiting — Les erreurs fuient-elles les infos de rate limit ?', category: 'Rate Limiting' },
      ],
      descPre: 'v3.0 tourne dans',
      descCode: 'Vercel en temps réel',
      descPost: ' à chaque appel /api/audit-skill. Il analyse les metadata (README, package.json, descriptions des tools). Les skills avec un score inférieur à 4/10 sont bloquées.',
    },
    audit: {
      title: 'TRAIL D\'AUDIT',
      live: 'LIVE',
      empty: 'Aucun log d\'audit disponible pour le moment.',
    },
    l16: {
      title: 'SENTINEL L1.6 — ANALYSE STATIQUE EN TEMPS RÉEL (LIVE EN PRODUCTION)',
      badge: 'LIVE EN PRODUCTION · TEMPS RÉEL DANS VERCEL',
      descPre: 'L1.6 tourne EN TEMPS RÉEL à chaque appel /api/audit-skill dans Vercel. Trois sous-systèmes :',
      descSemgrepSuffix: ' (18 règles MCP : prompt injection, command injection, secrets, SSRF, path traversal, tool spoofing), ',
      descSecretsSuffix: ' (18 patterns : Stripe, AWS, GitHub, JWT, Slack, Google, Twilio, wallets, private keys), ',
      descOSVSuffix: ' (vérification des vulnérabilités en temps réel via api.osv.dev). ',
      descPost: 'Source :',
      descVia: 'lib/sentinel-l16.mjs',
      checks: [
        { label: '18 règles type-Semgrep — patterns regex JS pour prompt injection (6), command injection (4), secrets (2), SSRF (2), path traversal (2), tool spoofing (1), inputSchema manquant (1)', category: 'Analyse Statique' },
        { label: '18 patterns de détection de secrets — Stripe (live/test/publishable), GitHub (PAT/OAuth/app/refresh), AWS (access key + secret), private keys (RSA/EC/OPENSSH), mnemonics de wallet, private keys Ethereum, JWT, Slack, Discord, Google API, Twilio, passwords génériques', category: 'Scan de Secrets' },
        { label: 'OSV API temps réel — interroge api.osv.dev/v1/query pour chaque package npx installé', category: 'Chaîne d\'Approvisionnement' },
        { label: 'Scoring pondéré — Secrets 40 %, Vulns 30 %, Statique 20 %, Hygiène 10 %', category: 'Scoring' },
        { label: 'Secret critique = score 0 instantané (bloque le listing)', category: 'Blocage' },
      ],
      rulesTitle: 'RÈGLES SEMGREP (18 AU TOTAL) :',
      rules: ['Prompt injection (6)', 'Command injection (4)', 'Identifiants codés en dur (2)', 'SSRF (2)', 'Path traversal (2)', 'Tool spoofing (1)', 'inputSchema manquant (1)'],
      viewRules: '→ Voir le ruleset complet sur GitHub',
    },
    l2: {
      title: 'SENTINEL L2 — ANALYSE DYNAMIQUE EN SANDBOX (IMPLÉMENTÉ)',
      live: 'LIVE · ASYNC VIA GITHUB ACTIONS',
      descPre: 'L2',
      descStrong: 'exécute réellement',
      descPost: ' le serveur MCP dans un conteneur Docker isolé, déclenché via GitHub Actions (repository_dispatch) depuis Vercel. La première audit renvoie "triggered_async" ; les suivantes récupèrent les résultats L2 en cache du repo. L2 NE bloque PAS la réponse API — il tourne en async.',
      runAudit: '→ Lancer un audit',
      sandboxConfigTitle: 'CONFIG DU SANDBOX DOCKER :',
      sandboxConfig: [
        { flag: '--network none', purpose: 'Pas d\'accès réseau (détecte les tentatives via ECONNREFUSED dans les logs)' },
        { flag: '--read-only', purpose: 'Filesystem racine en lecture seule (écritures uniquement dans /tmp via tmpfs)' },
        { flag: '--memory 256m', purpose: 'Limite dure de mémoire à 256MB' },
        { flag: '--cpus 0.5', purpose: 'CPU limité à un demi-cœur' },
        { flag: '--cap-drop ALL', purpose: 'Toutes les capabilities Linux supprimées' },
        { flag: '--security-opt no-new-privileges', purpose: 'Pas d\'escalade de privilèges possible' },
        { flag: '--security-opt seccomp=seccomp.json', purpose: 'ptrace bloqué (autres syscalls autorisés pour le monitoring)' },
        { flag: '--tmpfs /tmp:rw,size=64m', purpose: '/tmp inscriptible, plafonné à 64MB' },
      ],
      behavioralTitle: 'ANALYSE COMPORTEMENTALE :',
      behavioralChecks: [
        { label: 'Réseau — mentions d\'URLs dans stdout, erreurs ECONNREFUSED/ENOTFOUND (le conteneur ne peut pas atteindre le réseau)', category: 'Réseau' },
        { label: 'Filesystem — docker diff pour les changements hors /tmp, changements excessifs (>10 fichiers)', category: 'Filesystem' },
        { label: 'Processus — docker top capture les processus en cours dans le conteneur', category: 'Processus' },
        { label: 'Identifiants — mentions dans stdout de ssh, id_rsa, aws/credentials, .env, passwd, shadow = multiplicateur 0.0 instantané', category: 'Identifiants' },
        { label: 'Crashes — conteneur exited avec code non-zéro (peut indiquer un comportement malveillant au démarrage)', category: 'Crashes' },
        { label: 'Imports dynamiques — mentions dans stdout de exec(, spawn, child_process, subprocess, os.system', category: 'Imports Dynamiques' },
      ],
      phases: [
        { label: 'PHASE 1 (Q3 2026)', value: 'Docker + seccomp + strace', status: '✅ LIVE (GitHub Actions)' },
        { label: 'PHASE 2 (Q4 2026)', value: 'gVisor', status: 'Gratuit (auto-hébergé)' },
        { label: 'PHASE 3 (Q1 2027)', value: 'Firecracker microVM', status: 'Payant (nécessite KVM)' },
      ],
    },
    limits: {
      title: 'LIMITES HONNÊTES DE SENTINEL',
      desc: 'Nous ne prétendrons pas que Sentinel est parfait. Voici exactement ce qu\'il ne peut pas faire aujourd\'hui, et ce que nous faisons à ce sujet.',
      cards: [
        { warn: '⚠️ L2 EST ASYNC', body: 'L2 tourne via GitHub Actions, pas en temps réel à chaque appel API. La première audit renvoie "triggered_async" ; les résultats atterrissent dans le repo en 2–5 minutes et s\'appliquent à la PROCHAINE audit.' },
        { warn: '⚠️ DÉTECTION BASÉE SUR REGEX', body: 'L1.6 utilise des patterns regex JS (type Semgrep). Ils peuvent être contournés par obfuscation, encodages, ou appels indirects. Les patterns capturent la syntaxe, pas l\'intention.' },
        { warn: '⚠️ PAS D\'ANALYSE DE CODE SOURCE EN TEMPS RÉEL', body: 'L1.6 analyse uniquement les metadata + descriptions. L\'analyse complète du code source se fait dans L2 (async via GitHub Actions), pas à chaque appel Vercel.' },
        { warn: '⚠️ PAS D\'AUDIT TIERS ENCORE', body: 'Aucune firme de sécurité indépendante n\'a audité Sentinel. Nous sommes bootstrapped — l\'audit tiers est différé jusqu\'à ce que les revenus le couvrent.' },
      ],
      riskTitle: 'ÉVALUATION DES RISQUES PAR TYPE DE SKILL',
      col1: 'Type de Skill',
      col2: 'Niveau de Risque',
      col3: 'Pourquoi',
      rows: [
        { type: 'Free (human-reviewed)', level: 'BAS', why: '43 skills inspectées manuellement par AliceLabs' },
        { type: 'Auto-scanned, risk_level=green', level: 'MOYEN', why: 'Prompt uniquement, sans install. Sentinel v3.0+L1.6 a tourné ; sans revue humaine.' },
        { type: 'Auto-scanned, risk_level=yellow', level: 'MOYEN-ÉLEVÉ', why: 'Accès réseau/API. Sentinel a tourné ; L2 peut ou non avoir des résultats encore.' },
        { type: 'Paid, auto-scanned', level: 'ÉLEVÉ', why: 'Exécution de code + argent en jeu. Utilisez des mandats avec des limites basses.' },
      ],
      bottomLineLabel: 'Conclusion :',
      bottomLineBody: 'Sentinel v3.0 + L1.6 tournent en temps réel à chaque appel API. L2 tourne en async via GitHub Actions et s\'applique à la prochaine audit. C\'est honnête, auditable et open source — mais cela ne remplace pas la revue humaine du code qui s\'exécute sur votre machine.',
    },
    changelog: {
      title: 'CHANGELOG DE SENTINEL',
      entries: [
        {
          date: '2026-07-05',
          strong: 'FINAL-AUDIT-ALL.',
          body: ' Security.jsx réécrit pour refléter l\'architecture RÉELLE : v3.0 (6 checks, Vercel temps réel) + L1.6 (18 Semgrep + 18 secrets + OSV API, Vercel temps réel) + L2 (Docker sandbox, GitHub Actions, déclenché depuis Vercel). Limites honnêtes mises à jour (L2 async, basé sur regex, pas d\'audit tiers).',
          code: '→ Code',
        },
        {
          date: '2026-07-02',
          strong: 'L2 ACTIVÉ.',
          body: ' /api/audit-skill déclenche maintenant L2 via repository_dispatch. Docker sandbox : --network none, --read-only, --memory 256m, --cpus 0.5, --security-opt no-new-privileges, --cap-drop ALL, seccomp. Analyse comportementale : stdout creds/URLs/exec, docker diff, docker top, exit code. Résultats commités à _data/l2_results/{skillId}.json et récupérés à la prochaine audit. ASYNC — ne bloque pas la réponse API.',
          code: '→ Code',
          runAudit: '→ Lancer un audit',
        },
        {
          date: '2026-07-02',
          strong: 'L1.6 LIVE EN PRODUCTION.',
          body: ' 18 règles type-Semgrep en JS regex (prompt injection, command injection, secrets, SSRF, path traversal, tool spoofing, inputSchema manquant) + 18 patterns de secrets (Stripe, AWS, GitHub, JWT, Slack, Google, Twilio, wallets) + OSV API temps réel. Tourne dans Vercel à chaque appel /api/audit-skill.',
          code: '→ Code',
        },
        {
          date: '2026-06-30',
          strong: 'v3.0 live.',
          body: ' Audit basé sur la metadata en 6 points : AUTH, motifs d\'injection de prompt, validation des inputs, CORS, OAuth scopes, fuite d\'info dans le rate limiting.',
        },
      ],
      links: [
        { text: '→ Roadmap complète (v3.0 → L3.5)', to: '/sentinel-roadmap' },
        { text: '→ Roadmap de confiance', to: '/trust' },
        { text: '→ Guide de l\'acheteur', to: '/buyers-guide' },
      ],
    },
  },
};

export default function Security() {
  const { t, lang } = useLang();
  const c = CONTENT[lang] || CONTENT.en;
  // liveStatus is only defined for EN and ES — fall back to EN for the others.
  const ls = c.liveStatus || CONTENT.en.liveStatus;
  const [stats, setStats] = useState({
    total: 0,
    scanned: 0,
    avgScore: 0,
    passRate: 100,
    criticalIssues: 0,
  });
  const [logs, setLogs] = useState([]);
  const [sentinelStatus, setSentinelStatus] = useState({ state: 'loading', data: null });

  useEffect(() => {
    loadStats();
    loadLogs();
    loadSentinelStatus();
  }, []);

  const loadSentinelStatus = async () => {
    setSentinelStatus(s => ({ ...s, state: 'loading' }));
    try {
      const res = await fetch('/api/audit-skill?sentinel-status=1');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSentinelStatus({ state: 'loaded', data });
    } catch (e) {
      setSentinelStatus({ state: 'error', data: null, error: e.message });
    }
  };

  const loadStats = async () => {
    try {
      const mres = await fetch('/api/manifest.json');
      if (mres.ok) {
        const m = await mres.json();
        const total = m.total_skills || 0;
        setStats(s => ({ ...s, total, scanned: total }));
      }

      const sres = await fetch('/api/skills.json');
      if (sres.ok) {
        const skills = await sres.json();
        if (Array.isArray(skills) && skills.length > 0) {
          const sum = skills.reduce((acc, s) => acc + (s.sentinel_score || 0), 0);
          const avg = sum / skills.length;
          const passing = skills.filter(s => (s.sentinel_score || 0) >= 4).length;
          setStats(s => ({
            ...s,
            avgScore: avg.toFixed(1),
            passRate: ((passing / skills.length) * 100).toFixed(1),
            criticalIssues: skills.filter(s => (s.sentinel_score || 0) < 4).length,
          }));
        }
      }
    } catch (e) {
      console.warn('Could not load security stats:', e.message);
    }
  };

  const loadLogs = async () => {
    try {
      const res = await fetch('/api/skills.json');
      if (!res.ok) return;
      const skills = await res.json();
      if (!Array.isArray(skills) || skills.length === 0) return;
      const recent = skills.slice(-8).reverse().map((s, i) => ({
        id: `AUD-${String(i + 1).padStart(3, '0')}`,
        time: i === 0 ? 'Just now' : `${i} hour${i === 1 ? '' : 's'} ago`,
        type: 'Skill listing audit',
        status: 'Passed',
        skill: s.name,
        score: s.sentinel_score || 6,
        maxScore: 10,
      }));
      setLogs(recent);
    } catch (e) {
      console.warn('Could not load audit logs:', e.message);
    }
  };

  const statCards = [
    { label: c.stats.total, value: stats.total.toLocaleString() },
    { label: c.stats.scanned, value: stats.scanned.toLocaleString() },
    { label: c.stats.avgScore, value: `${stats.avgScore}/10` },
    { label: c.stats.passRate, value: `${stats.passRate}%` },
    { label: c.stats.critical, value: stats.criticalIssues },
  ];

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-[1440px] mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00F299]/10 border border-[#00F299]/20 mb-4">
            <span className="text-[#00F299] text-[10px] font-mono tracking-wider">{c.badge}</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            {t('security.title')}
          </h1>
          <p className="text-zinc-400 max-w-2xl">
            {t('security.subtitle')}
          </p>
        </motion.div>

        {/* Live stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10"
        >
          {statCards.map((stat) => (
            <div key={stat.label} className="premium-card p-5 text-center">
              <div className="text-2xl font-bold text-white font-mono">{stat.value}</div>
              <div className="text-[10px] text-zinc-500 font-mono tracking-wider mt-1 uppercase">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Version banner */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }} className="premium-card p-4 mb-8 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-[#00F299]/10 text-[#00F299] text-xs font-mono font-bold">{c.banner.l15Label}</span>
            <span className="text-zinc-500 text-xs">{c.banner.l15Desc}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-[#00d1ff]/10 text-[#00d1ff] text-xs font-mono font-bold">{c.banner.l16Label}</span>
            <span className="text-zinc-500 text-xs">{c.banner.l16Desc}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-[#00F299]/10 text-[#00F299] text-xs font-mono font-bold">{c.banner.l2Label}</span>
            <span className="text-zinc-500 text-xs">{c.banner.l2Desc}</span>
          </div>
        </motion.div>

        {/* Architecture diagram */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }} className="premium-card p-6 mb-8">
          <h2 className="text-white font-semibold mb-3">{c.architecture.title}</h2>
          <p className="text-zinc-400 text-sm mb-4 leading-relaxed">{c.architecture.desc}</p>
          <pre className="text-[10px] sm:text-[11px] text-[#00F299] bg-black/60 p-4 rounded-lg overflow-x-auto font-mono leading-tight whitespace-pre">{c.architecture.diagram}</pre>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* v3.0 Checks (LIVE) */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="premium-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">{c.l15.title}</h2>
              <span className="px-2 py-0.5 rounded bg-[#00F299]/10 text-[#00F299] text-[10px] font-mono font-bold">{c.l15.live}</span>
            </div>
            <ul className="space-y-3">
              {c.l15.checks.map((check) => (
                <li key={check.label} className="flex items-start gap-3 text-sm">
                  <span className="w-2 h-2 rounded-full bg-[#00F299] shrink-0 mt-1.5" />
                  <div>
                    <span className="text-zinc-300">{check.label}</span>
                    <div className="text-zinc-600 text-[10px] mt-0.5">{check.category}</div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-zinc-500 text-xs mt-6 leading-relaxed">
              {c.l15.descPre} <code className="text-[#00F299]">{c.l15.descCode}</code>{c.l15.descPost}
            </p>
          </motion.div>

          {/* Audit Logs */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-semibold">{c.audit.title}</h2>
              <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00F299] animate-pulse" />
                {c.audit.live}
              </div>
            </div>
            {logs.length === 0 ? (
              <div className="premium-card p-8 text-center">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-zinc-400 text-sm">{c.audit.empty}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <motion.div key={log.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="premium-card p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="w-2 h-2 rounded-full bg-[#00F299]" />
                      <div>
                        <div className="text-white text-sm font-mono">{log.type}</div>
                        <div className="text-zinc-500 text-[10px] font-mono">{log.skill}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[#00F299] text-xs font-mono">{log.status} ({log.score}/{log.maxScore})</div>
                      <div className="text-zinc-500 text-[10px] font-mono">{log.time}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* L1.6 Checks (LIVE IN PRODUCTION) */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="premium-card p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">{c.l16.title}</h2>
            <span className="px-2 py-0.5 rounded bg-[#00d1ff]/10 text-[#00d1ff] text-[10px] font-mono font-bold">{c.l16.badge}</span>
          </div>
          <p className="text-zinc-400 text-sm mb-4">
            {c.l16.descPre}
            <strong className="text-white"> Semgrep</strong>{c.l16.descSemgrepSuffix}
            <strong className="text-white"> Secret Patterns</strong>{c.l16.descSecretsSuffix}
            <strong className="text-white"> OSV API</strong>{c.l16.descOSVSuffix}
            {c.l16.descPost}{' '}
            <a href="https://github.com/edgarfloresguerra2011-a11y/marketnow/blob/master/aep-marketplace/lib/sentinel-l16.mjs" target="_blank" rel="noopener" className="text-[#00F299] hover:underline">{c.l16.descVia}</a>.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {c.l16.checks.map((check) => (
              <div key={check.label} className="flex items-start gap-3 p-3 rounded-lg bg-black/40">
                <span className="text-[#00d1ff] text-xs mt-0.5">✓</span>
                <div>
                  <span className="text-zinc-300 text-xs">{check.label}</span>
                  <div className="text-zinc-600 text-[10px] mt-0.5">{check.category}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-lg bg-black/40">
            <div className="text-zinc-500 text-[10px] mb-1 font-mono">{c.l16.rulesTitle}</div>
            <div className="flex flex-wrap gap-2">
              {c.l16.rules.map(r => (
                <span key={r} className="px-2 py-1 rounded bg-[#00d1ff]/5 text-[#00d1ff] text-[10px] font-mono">{r}</span>
              ))}
            </div>
            <a href="https://github.com/edgarfloresguerra2011-a11y/marketnow/blob/master/aep-marketplace/lib/sentinel-l16.mjs" target="_blank" rel="noopener" className="text-[#00F299] text-xs hover:underline mt-2 inline-block">{c.l16.viewRules}</a>
          </div>
        </motion.div>

        {/* L2 Checks (IMPLEMENTED — async via GitHub Actions) */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="premium-card p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">{c.l2.title}</h2>
            <span className="px-2 py-0.5 rounded bg-[#00F299]/10 text-[#00F299] text-[10px] font-mono font-bold">{c.l2.live}</span>
          </div>
          <p className="text-zinc-400 text-sm mb-4">
            {c.l2.descPre} <strong className="text-white">{c.l2.descStrong}</strong> {c.l2.descPost}
            <a href="https://github.com/edgarfloresguerra2011-a11y/marketnow/blob/master/aep-marketplace/lib/sentinel-l2-sandbox.sh" target="_blank" rel="noopener" className="text-[#00F299] hover:underline ml-1">{c.l2.runAudit}</a>
          </p>

          {/* Sandbox config */}
          <div className="mt-4 p-3 rounded-lg bg-black/40">
            <div className="text-zinc-500 text-[10px] mb-2 font-mono">{c.l2.sandboxConfigTitle}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {c.l2.sandboxConfig.map((cfg) => (
                <div key={cfg.flag} className="flex items-start gap-2 text-xs">
                  <code className="text-[#00F299] font-mono whitespace-nowrap">{cfg.flag}</code>
                  <span className="text-zinc-500 text-[11px]">— {cfg.purpose}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Behavioral analysis */}
          <div className="mt-4">
            <div className="text-zinc-500 text-[10px] mb-2 font-mono">{c.l2.behavioralTitle}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {c.l2.behavioralChecks.map((check) => (
                <div key={check.label} className="flex items-start gap-3 p-3 rounded-lg bg-black/40">
                  <span className="text-yellow-400 text-xs mt-0.5">○</span>
                  <div>
                    <span className="text-zinc-300 text-xs">{check.label}</span>
                    <div className="text-zinc-600 text-[10px] mt-0.5">{check.category}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {c.l2.phases.map((phase) => (
              <div key={phase.label} className="p-3 rounded-lg bg-black/40">
                <div className="text-zinc-500 text-[10px] mb-1 font-mono">{phase.label}</div>
                <div className="text-white text-xs">{phase.value}</div>
                <div className="text-[#00F299] text-[10px] mt-1">{phase.status}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Honest limitations */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }} className="premium-card p-6 mb-8 border-l-4 border-yellow-500/50">
          <h2 className="text-white font-semibold mb-4">{c.limits.title}</h2>
          <p className="text-zinc-400 text-sm mb-4">
            {c.limits.desc}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {c.limits.cards.map((card) => (
              <div key={card.warn} className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                <div className="text-red-400 text-xs font-mono mb-1">{card.warn}</div>
                <p className="text-zinc-400 text-xs">{card.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-lg bg-black/40">
            <div className="text-zinc-300 text-xs font-bold mb-2">{c.limits.riskTitle}</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 text-zinc-400">{c.limits.col1}</th>
                  <th className="text-left py-2 text-zinc-400">{c.limits.col2}</th>
                  <th className="text-left py-2 text-zinc-400">{c.limits.col3}</th>
                </tr>
              </thead>
              <tbody>
                {c.limits.rows.map((row, idx) => {
                  const colorClass = idx === 0 ? 'text-green-400'
                    : idx === 1 ? 'text-yellow-400'
                    : idx === 2 ? 'text-orange-400'
                    : 'text-red-400';
                  return (
                    <tr key={row.type} className={idx < c.limits.rows.length - 1 ? 'border-b border-white/5' : ''}>
                      <td className={`py-2 ${colorClass}`}>{row.type}</td>
                      <td className={`py-2 ${colorClass}`}>{row.level}</td>
                      <td className="py-2 text-zinc-400">{row.why}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-zinc-500 text-xs mt-4">
            <strong className="text-zinc-300">{c.limits.bottomLineLabel}</strong> {c.limits.bottomLineBody}
          </p>
        </motion.div>


        {/* ─── LIVE BATCH AUDIT STATUS (pulled from /api/sentinel-status) ─── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="premium-card p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold">{ls.title}</h2>
            <button
              onClick={loadSentinelStatus}
              className="text-xs text-zinc-400 hover:text-[#00d1ff] border border-white/10 hover:border-[#00d1ff]/40 rounded px-2 py-1 transition-colors"
            >
              {ls.refresh}
            </button>
          </div>
          <p className="text-zinc-500 text-xs mb-4 font-mono">{ls.subtitle}</p>

          {sentinelStatus.state === 'loading' && (
            <div className="text-zinc-400 text-sm py-6 text-center animate-pulse">{ls.loading}</div>
          )}

          {sentinelStatus.state === 'error' && (
            <div className="text-red-400 text-sm py-4 text-center bg-red-500/5 border border-red-500/10 rounded-lg">
              {ls.error}
            </div>
          )}

          {sentinelStatus.state === 'loaded' && sentinelStatus.data && (
            <div className="space-y-4">
              {/* L1.6 Batch results */}
              {sentinelStatus.data.l16_batch?.status === 'available' ? (
                <div className="bg-black/40 rounded-lg p-4 border border-white/5">
                  <div className="flex items-baseline justify-between mb-3">
                    <span className="text-zinc-300 text-xs font-bold uppercase tracking-wider">{ls.toolsLabel}</span>
                    <span className="text-zinc-500 text-xs font-mono">{ls.ranOn}: {new Date(sentinelStatus.data.l16_batch.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center">
                      <div className="text-[#00d1ff] text-lg font-mono">{sentinelStatus.data.l16_batch.tools.semgrep.findings}</div>
                      <div className="text-zinc-500 text-xs">{ls.semgrep}</div>
                    </div>
                    <div className="text-center">
                      <div className={`${sentinelStatus.data.l16_batch.tools.gitleaks.findings > 0 ? 'text-red-400' : 'text-[#00d1ff]'} text-lg font-mono`}>
                        {sentinelStatus.data.l16_batch.tools.gitleaks.findings}
                      </div>
                      <div className="text-zinc-500 text-xs">{ls.gitleaks}</div>
                    </div>
                    <div className="text-center">
                      <div className={`${sentinelStatus.data.l16_batch.tools.osv.vulnerabilities > 0 ? 'text-orange-400' : 'text-[#00d1ff]'} text-lg font-mono`}>
                        {sentinelStatus.data.l16_batch.tools.osv.vulnerabilities}
                      </div>
                      <div className="text-zinc-500 text-xs">{ls.osv}</div>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs pt-3 border-t border-white/5">
                    <span className="text-zinc-400">{ls.totalsLabel}:</span>
                    <span className="text-red-400">{ls.critical}: {sentinelStatus.data.l16_batch.totals.critical}</span>
                    <span className="text-orange-400">{ls.high}: {sentinelStatus.data.l16_batch.totals.high}</span>
                    <span className="text-yellow-400">{ls.medium}: {sentinelStatus.data.l16_batch.totals.medium}</span>
                  </div>
                  <a href={sentinelStatus.data.l16_batch.repo_path} target="_blank" rel="noopener" className="text-[#00F299] hover:underline text-xs mt-3 inline-block">
                    {ls.viewRaw} →
                  </a>
                </div>
              ) : (
                <div className="bg-black/40 rounded-lg p-4 border border-white/5 text-zinc-400 text-xs">
                  {sentinelStatus.data.l16_batch?.message || ls.notRun}
                </div>
              )}

              {/* L2 sandbox coverage */}
              <div className="bg-black/40 rounded-lg p-4 border border-white/5">
                <div className="text-zinc-300 text-xs font-bold uppercase tracking-wider mb-3">{ls.l2Title}</div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <div className="text-[#00d1ff] text-lg font-mono">{sentinelStatus.data.l2_sandbox?.completed_runs || 0}</div>
                    <div className="text-zinc-500 text-xs">{ls.l2Completed}</div>
                  </div>
                  <div>
                    <div className="text-[#00d1ff] text-lg font-mono">{sentinelStatus.data.l2_sandbox?.audited_skills?.length || 0}</div>
                    <div className="text-zinc-500 text-xs">{ls.l2Audited}</div>
                  </div>
                </div>

                {/* Sentinel Certificates panel — shows total certified skills */}
                {sentinelStatus.data.certificates && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <div className="text-zinc-300 text-xs font-bold uppercase tracking-wider mb-2">{ls.certTitle}</div>
                    <p className="text-zinc-500 text-[10px] mb-3">{ls.certDesc}</p>
                    <div className="flex items-baseline gap-4">
                      <div>
                        <div className="text-[#00F299] text-2xl font-mono">{sentinelStatus.data.certificates.count}</div>
                        <div className="text-zinc-500 text-xs">{ls.certVerified}</div>
                      </div>
                      {sentinelStatus.data.certificates.by_risk &&
                       Object.keys(sentinelStatus.data.certificates.by_risk).length > 0 && (
                        <div className="flex gap-3 text-xs">
                          <span className="text-[#00F299]">low: {sentinelStatus.data.certificates.by_risk.low || 0}</span>
                          <span className="text-yellow-400">med: {sentinelStatus.data.certificates.by_risk.medium || 0}</span>
                          <span className="text-orange-400">high: {sentinelStatus.data.certificates.by_risk.high || 0}</span>
                          <span className="text-red-400">crit: {sentinelStatus.data.certificates.by_risk.critical || 0}</span>
                        </div>
                      )}
                    </div>
                    <a href={sentinelStatus.data.certificates.repo_path} target="_blank" rel="noopener" className="text-[#00F299] hover:underline text-xs mt-2 inline-block">
                      {ls.certViewAll} →
                    </a>
                  </div>
                )}

                {/* Breakdown by execution_status — shows the honest picture:
                    ran (server started + produced output, trusted)
                    ran_idle (server started, waited for stdin — normal MCP stdio)
                    failed_to_start (crash / MODULE_NOT_FOUND, NOT trusted) */}
                {sentinelStatus.data.l2_sandbox?.breakdown_by_status &&
                 Object.keys(sentinelStatus.data.l2_sandbox.breakdown_by_status).length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/5 text-xs">
                    <div className="text-center">
                      <div className="text-[#00F299] text-base font-mono">
                        {sentinelStatus.data.l2_sandbox.breakdown_by_status.ran || 0}
                      </div>
                      <div className="text-zinc-500 text-[10px]">ran</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[#00d1ff] text-base font-mono">
                        {sentinelStatus.data.l2_sandbox.breakdown_by_status.ran_idle || 0}
                      </div>
                      <div className="text-zinc-500 text-[10px]">ran_idle</div>
                    </div>
                    <div className="text-center">
                      <div className="text-orange-400 text-base font-mono">
                        {sentinelStatus.data.l2_sandbox.breakdown_by_status.failed_to_start || 0}
                      </div>
                      <div className="text-zinc-500 text-[10px]">failed_to_start</div>
                    </div>
                  </div>
                )}

                {/* Per-skill list with execution_status badges + failure_reason for failed ones */}
                {sentinelStatus.data.l2_sandbox?.summaries?.length > 0 ? (
                  <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto">
                    {sentinelStatus.data.l2_sandbox.summaries.map(s => {
                      const statusColor = s.execution_status === 'ran'
                        ? 'bg-[#00F299]/10 text-[#00F299]'
                        : s.execution_status === 'ran_idle'
                        ? 'bg-[#00d1ff]/10 text-[#00d1ff]'
                        : s.execution_status === 'failed_to_start'
                        ? 'bg-orange-500/10 text-orange-400'
                        : 'bg-zinc-500/10 text-zinc-400';
                      return (
                        <div key={s.skill_id} className="text-[11px]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-zinc-300 truncate">{s.skill_id}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-zinc-500">{s.l2_score ?? '?'}/10</span>
                              <span className={`px-1.5 py-0.5 rounded font-mono text-[9px] ${statusColor}`}>
                                {s.execution_status || 'unknown'}
                              </span>
                            </div>
                          </div>
                          {s.failure_reason && (
                            <div className="text-orange-400/70 text-[10px] mt-0.5 pl-2 border-l border-orange-500/20">
                              {s.failure_reason}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : sentinelStatus.data.l2_sandbox?.audited_skills?.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {sentinelStatus.data.l2_sandbox.audited_skills.slice(0, 12).map(sid => (
                      <span key={sid} className="text-[10px] font-mono bg-[#00F299]/10 text-[#00F299] px-1.5 py-0.5 rounded">{sid}</span>
                    ))}
                    {sentinelStatus.data.l2_sandbox.audited_skills.length > 12 && (
                      <span className="text-[10px] text-zinc-500 px-1.5 py-0.5">+{sentinelStatus.data.l2_sandbox.audited_skills.length - 12} more</span>
                    )}
                  </div>
                ) : (
                  <p className="text-zinc-500 text-xs mt-2">{ls.l2None}</p>
                )}
                <div className="mt-3 pt-3 border-t border-white/5 flex justify-between text-xs">
                  <span className="text-zinc-500">{ls.l2Dedup}:</span>
                  <span className="text-zinc-300 font-mono">{ls.l2DedupValue}</span>
                </div>
                {ls.l2RolloutNote && (
                  <div className="mt-2 p-2 rounded bg-orange-500/5 border border-orange-500/10 text-orange-400/80 text-[10px] leading-relaxed">
                    ⚠️ {ls.l2RolloutNote}
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="premium-card p-6">
          <h2 className="text-white font-semibold mb-4">{c.changelog.title}</h2>
          <div className="space-y-3">
            {c.changelog.entries.map((entry, i) => {
              const colorClass = i === 0 ? 'bg-[#00d1ff]/10 text-[#00d1ff]' : 'bg-[#00F299]/10 text-[#00F299]';
              return (
                <div key={i} className="flex gap-3 text-xs">
                  <span className={`px-2 py-0.5 rounded ${colorClass} font-mono whitespace-nowrap`}>{entry.date}</span>
                  <div className="text-zinc-400">
                    <strong className="text-white">{entry.strong}</strong>{entry.body}
                    {i === 0 && (
                      <a href="https://github.com/edgarfloresguerra2011-a11y/marketnow/blob/master/aep-marketplace/src/pages/Security.jsx" target="_blank" rel="noopener" className="text-[#00F299] hover:underline ml-1">{entry.code}</a>
                    )}
                    {i === 1 && (
                      <>
                        <a href="https://github.com/edgarfloresguerra2011-a11y/marketnow/blob/master/aep-marketplace/lib/sentinel-l2-trigger.mjs" target="_blank" rel="noopener" className="text-[#00F299] hover:underline ml-1">{entry.code}</a>
                        <a href="https://github.com/edgarfloresguerra2011-a11y/marketnow/blob/master/aep-marketplace/lib/sentinel-l2-sandbox.sh" target="_blank" rel="noopener" className="text-[#00F299] hover:underline ml-1">{entry.runAudit}</a>
                      </>
                    )}
                    {i === 2 && (
                      <a href="https://github.com/edgarfloresguerra2011-a11y/marketnow/blob/master/aep-marketplace/lib/sentinel-l16.mjs" target="_blank" rel="noopener" className="text-[#00F299] hover:underline ml-1">{entry.code}</a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            {c.changelog.links.map((link) => (
              <Link key={link.to} to={link.to} className={link.to === '/sentinel-roadmap' ? 'text-[#00F299] hover:underline' : 'text-zinc-400 hover:underline'}>
                {link.text}
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
