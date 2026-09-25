// Paginated skills API — replaces the 24MB skills.json blob
// catalog-version 2026-09-12: 68,387 entries (5.9.3: aria-icons L2 merge — first external submission, replaces npm-indexed entry))
// Usage: GET /api/skills?page=1&limit=100
//       GET /api/skills?page=1&limit=100&category=Security
//       GET /api/skills?page=1&limit=100&filter=free
//       GET /api/skills?sort=recent     (indexed_at desc — newest first)
//       GET /api/skills?sort=downloads  (npm_downloads_wk desc)
//       GET /api/skills?sort=trust      (trust_score_100 desc)
//       GET /api/skills?q=weather       (search in name/description/tags)
//       GET /api/skills?risk=red|yellow|green
//
// ── Submission endpoints (mounted here via _mode — Hobby 12-function cap) ───
// POST /api/submit  → rewrite → /api/skills?_mode=submit  (public, no auth)
// GET  /api/submit  → docs schema
// GET  /api/submissions → rewrite → /api/skills?_mode=queue (public queue)
//
// ── F-06 closure endpoints (audit AUD-2026-0821-MN, Phase 2, 2026-09-25) ──
// GET /api/skills.json → rewrite → /api/skills?_mode=manifest (deprecation manifest;
//        the 94MB unpaginated dump was removed from public/)
// GET /api/stats.json  → rewrite → /api/skills?_mode=stats (live-computed stats —
//        kills the static-file drift: totals/versions derived from this bundle + stamp)

import skillsData from '../public/api/skills-lite.json' with { type: 'json' };
import catalogMeta from '../public/api/catalog-meta.json' with { type: 'json' };
import statsBase from '../lib/stats-base.json' with { type: 'json' };
import securityLayers from '../lib/security-layers.json' with { type: 'json' };
import npmVersions from '../lib/npm-versions.json' with { type: 'json' };
import quarantineManifest from '../public/_data/quarantine_decisions/MANIFEST.json' with { type: 'json' };
import { mountSubmission } from '../lib/submit-http.mjs';

const SITE = 'https://www.marketnow.site';

export default function handler(req, res) {
  // 404 real para rutas de archivo inexistentes (.sh etc.) — fix anp2network
  // (montado aqui via _mode por el cap de 12 funciones del plan Hobby)
  if (req.query._mode === 'notfound') {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-MarketNow-Note', 'static-miss');
    return res.status(404).send(
      '404 Not Found — MarketNow\n\n' +
      'This path does not exist as a static file.\n' +
      'If you expected a script here, verify the URL at https://www.marketnow.site/\n' +
      'Reported paths that end in .sh but do not exist intentionally return 404 (not HTML).\n'
    );
  }
  // submission endpoints (POST/GET /api/submit, GET /api/submissions)
  if (req.query._mode === 'submit' || req.query._mode === 'queue') {
    return mountSubmission(req, res);
  }
  // ── Security evidence endpoints (2nd external audit S8, 2026-09-25) ──
  // /api/security, /api/quarantine, /api/honeypot, /api/threat-intel,
  // /api/agent-analytics → rewritten here as _mode=security&view=<v>
  // (mounted via _mode for the Hobby 12-function cap; no api/security.js file)
  if (req.query._mode === 'security') {
    return securityResponse(req, res);
  }

  // ── 5ª ronda (2026-09-25): commerce endpoints declarados como PLANNED ──
  // /api/agent-purchase, /api/create-checkout-session, /api/stripe-webhook,
  // /api/verify-purchase, /api/mandates → rewritten here as _mode=commerce.
  // Antes 404aban (documento muerto en openapi + docs de agentes). Ahora
  // responden con el estado real: la implementación vive en server/routes/
  // (checkout.js) pero NO está desplegada en Vercel (cap 12 funciones Hobby +
  // STRIPE_SECRET_KEY sin configurar). Gate C1 del plan agent-commerce.
  if (req.query._mode === 'commerce') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      status: 'planned',
      gate: 'C1',
      note: 'Commerce endpoints are not live yet. This response replaces a former 404 so agents get a typed, honest answer.',
      implemented_but_not_deployed: [
        'server/routes/checkout.js (Stripe checkout + webhook, needs STRIPE_SECRET_KEY)',
        'server/routes/vault.js (USDC on Base payments)',
        'AP2 delegated mandates ledger (see /api/mandates-info.json for the policy)'
      ],
      what_works_today: {
        free_install: 'every free skill (68,387 of 68,388) installs directly — see /api/free-skills.json',
        skill_detail: '/s/<slug> (page) · /api/skills/<slug> (JSON)',
        trust: '/api/trust-score?skillId=<slug> · certificates: /api/audit-skill?certificate=1&skillId=<slug>',
        payments_today: 'none — no payment is collected anywhere on the site today'
      },
      see_also: [
        '/api/manifest.json', '/api/openapi.json', '/licensing',
        'https://marketnow.site/agent-protocol.json (payment.status)'
      ],
      source_of_truth: '/api/stats.json'
    });
  }

  // ── 5ª ronda: _mode=planned — respuesta tipada para endpoints declarados pero no implementados ──
  // /api/acp, /api/agent-register, /api/ai-match, /api/compare → rewritten here.
  // Antes 404aban siendo documentados en for-agents-quick/agent-discover/agent-endpoint.
  if (req.query._mode === 'planned') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      status: 'planned',
      note: 'This endpoint is documented but not implemented yet. The typed response replaces a former 404 so agents can rely on it.',
      planned: {
        '/api/acp': 'Agent Communication Protocol API (discover/negotiate/execute/rate) — design phase; today see /acp (docs) and /agent-protocol.json (MAP)',
        '/api/agent-register': 'agent registration — GitHub-issue based for now (see /agent-protocol.json agent_registration)',
        '/api/ai-match': 'AI matching — coming soon; today use /api/search?q= and filter client-side',
        '/api/compare': 'removed — use /api/skills?q=<ids> or /api/skills/<slug> (JSON) per skill'
      },
      wallet_info: '/api/agent-wallet.json (static, live)',
      source_of_truth: '/api/manifest.json'
    });
  }

  // ── 5ª ronda: POST /api/recommend (prometido en for-agents-quick/llms-full) ──
  // Recomendador heurístico real sobre el bundle: categorías de las tools
  // actuales → top skills libres por sentinel_score, excluyendo las que ya tiene.
  if (req.query._mode === 'recommend') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    let body = {};
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); } catch { body = {}; }
    const currentTools = Array.isArray(body.current_tools) ? body.current_tools.map(String) : [];
    const agentType = String(body.agent_type || 'general').toLowerCase();
    const list = skillsData.skills || skillsData || [];
    const owned = new Set(currentTools.map(t => t.toLowerCase()));
    // categorías preferidas: la del agent_type si existe mapeo, sino las más populares
    const CAT_BY_TYPE = {
      coding: ['developer-tools', 'version-control', 'search'], research: ['search', 'ai-ml', 'data'],
      data: ['data', 'developer-tools', 'monitoring'], finance: ['finance', 'security'],
      communication: ['communication', 'browser-automation'], security: ['security', 'monitoring']
    };
    const prefer = CAT_BY_TYPE[agentType] || ['developer-tools', 'search', 'ai-ml'];
    const scored = list
      .filter(s => (s.free === true || s.is_free === true || (s.price === 0 && !s.payment)))
      .filter(s => !owned.has(String(s.slug || '').toLowerCase()) && !owned.has(String(s.name || '').toLowerCase()))
      .map(s => {
        const cat = String(s.category || '').toLowerCase().trim().replace(/[\s/]+/g, '-');
        let score = (typeof s.sentinel_score === 'number' ? s.sentinel_score : 5) * 10;
        if (prefer.includes(cat)) score += 30;
        if (s.risk_level === 'red') score -= 100;
        return { slug: s.slug, name: s.name, category: s.category, sentinel_score: s.sentinel_score ?? null, risk_level: s.risk_level ?? 'unknown', install: s.install || null, score };
      })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    return res.status(200).json({
      ok: true,
      method: 'heuristic (category match + sentinel score; no ML in this endpoint)',
      input: { current_tools: currentTools.length, agent_type: agentType },
      recommendations: scored,
      note: 'Scores are Sentinel audit scores (0-10). Verify any skill with /api/trust-score?skillId=<slug> before installing.',
      see_also: ['/api/skills?sort=trust', '/api/free-skills.json']
    });
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const allSkills = skillsData.skills || skillsData || [];

  // ── F-06: deprecation manifest for the removed /api/skills.json blob ──
  if (req.query._mode === 'manifest') {
    return res.status(200).json({
      deprecated: true,
      resource: '/api/skills.json',
      removed_date: '2026-09-25',
      reason: 'Unpaginated full-catalog dump grew to 94MB (audit F-06 regression, 24MB → 94MB). Replaced by the paginated API; the same data the UI uses ships as skills-lite.json.',
      total_catalog: allSkills.length,
      alternatives: {
        paginated_api: '/api/skills?page=1&limit=100',
        paginated_params: 'page, limit (max 500), category, filter=free, sort=recent|downloads|trust|name, q, risk=red|yellow|green, tier=core|community',
        lite_dataset: '/api/skills-lite.json',
        free_dataset: '/api/free-skills.json',
        stats: '/api/stats.json',
        manifest: '/api/manifest.json',
        openapi: '/api/openapi.json'
      },
      note: 'clients that cached the old dump should re-fetch page-by-page; server-side search: /api/search?q='
    });
  }

  // ── N-09: live stats (replaces the drifting static stats.json) ──
  if (req.query._mode === 'stats') {
    const free = allSkills.filter(s => s.is_free === true || s.free === true || (s.price === 0 && !s.payment)).length;
    const cats = {};
    for (const s of allSkills) {
      const k = String(s.category || 'uncategorized').toLowerCase().trim().replace(/[\s/]+/g, '-');
      cats[k] = (cats[k] || 0) + 1;
    }
    const sortedCats = Object.fromEntries(Object.entries(cats).sort((a, b) => b[1] - a[1]));
    const base = JSON.parse(JSON.stringify(statsBase));
    const stamp = base._stamp || {};
    delete base._stamp;
    base.computed_at = new Date().toISOString();
    base.computed_from = 'skills-lite.json bundle (' + allSkills.length + ' entries) + catalog-meta.json + npm stamp ' + (stamp.stamped_at || 'n/a');
    base.discovery = {
      ...base.discovery,
      total_mcp_servers: allSkills.length,
      total_tracked_all_sources: catalogMeta.total_all,
      core_certified: catalogMeta.core_certified,
      community_indexed: catalogMeta.community_indexed,
      aggregate_tracked: catalogMeta.aggregate_tracked,
      free,
      free_to_install: allSkills.length,
      paid: allSkills.length - free,
      categories: sortedCats
    };
    if (base.security) {
      base.security.l1_index_certified = allSkills.length;
      // 4ª ronda (2026-09-26): el total debe incluir L1 + L2 (antes este override
      // dejaba security_checks_performed = 683,880 mientras el propio desglose
      // y agent.json decían 766,211 — contradicción interna en el mismo JSON).
      const l1Total = (base.security.l1_checks || 10) * allSkills.length;
      const l2Rules = base.security.l2_sentinel_rule_count || 29;
      const l2Scanned = base.security.l2_sentinel_scanned || 0;
      const l2Total = l2Rules * l2Scanned;
      base.security.security_checks_performed = l1Total + l2Total;
      base.security.security_checks_breakdown = {
        l1_index_checks: l1Total,
        l1_formula: `${base.security.l1_checks || 10} L1 checks x ${allSkills.length} entries`,
        l2_sentinel_rule_checks: l2Total,
        l2_formula: `${l2Rules} L2 rules x ${l2Scanned} tarballs`,
        total: l1Total + l2Total,
      };
      base.security.security_checks_methodology =
        `${(l1Total + l2Total).toLocaleString('en-US')} total = ${l1Total.toLocaleString('en-US')} L1 (${base.security.l1_checks || 10} L1 checks × ${allSkills.length} entries) + ${l2Total.toLocaleString('en-US')} L2 (${l2Rules} L2 rules × ${l2Scanned} tarballs; top ${base.security.l2_targets || 0} npm targets, ${base.security.l2_completion_pct || 0}% completion)`;
    }
    // 4ª ronda: sección uta — versiones npm vivas para el SPA (chips de paquetes,
    // stats de la página /uta). Fuente: lib/npm-versions.json (sync_npm_versions.py).
    if (npmVersions && npmVersions.packages) {
      base.uta = {
        packages: npmVersions.packages,
        packages_count: npmVersions.packages.length,
        monthly_downloads: npmVersions.totals?.dl_month ?? null,
        conformance_version: npmVersions.conformance_version,
        test_vectors: npmVersions.test_vectors,
        conformance_checks: npmVersions.conformance_checks,
        adapters: base.formats?.count || 9,
        source: 'lib/npm-versions.json — synced from registry.npmjs.org by scripts/sync_npm_versions.py (weekly workflow + gate)',
      };
    }
    if (stamp.mcp_server_version && base.tools) {
      base.tools.mcp_server_version = stamp.mcp_server_version;
      base.tools.atc_sdk_version = stamp.atc_sdk_version;
    }
    if (stamp.npm_latest_version && base.distribution) {
      base.distribution.npm_latest_version = stamp.npm_latest_version;
      base.distribution.npm_latest_release_date = stamp.npm_latest_release_date;
      base.distribution.npm_versions_published = stamp.npm_versions_published;
      base.distribution.npm_downloads_last_month = stamp.npm_downloads_last_month;
    }
    return res.status(200).json(base);
  }

  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || '100', 10)));
  const category = req.query.category;
  const filter = req.query.filter;
  const sort = (req.query.sort || '').toLowerCase();
  const q = (req.query.q || '').toLowerCase().trim();
  const risk = (req.query.risk || '').toLowerCase().trim();
  const tier = (req.query.tier || '').toLowerCase().trim();

  let skills = skillsData.skills || skillsData || [];

  // Filter by tier (core = evidence-gated | community = indexed, low signal)
  if (tier && ['core', 'community'].includes(tier)) {
    skills = skills.filter(s => (s.tier || 'core') === tier);
  }

  // Filter by category
  if (category) {
    skills = skills.filter(s => s.category === category);
  }

  // Filter by free
  // 5.9.2: vendor-priced usage (payment set, e.g. per-call x402) is not "free"
  // even though the listing price is 0 — the vendor bills usage directly.
  if (filter === 'free') {
    skills = skills.filter(s => s.is_free === true || s.free === true || (s.price === 0 && !s.payment));
  }

  // Filter by risk level (Sentinel)
  if (risk && ['red', 'yellow', 'green'].includes(risk)) {
    skills = skills.filter(s => (s.risk_level || '').toLowerCase() === risk);
  }

  // Search
  if (q) {
    skills = skills.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q) ||
      (s.tags || []).some(t => String(t).toLowerCase().includes(q))
    );
  }

  // Sort
  if (sort === 'recent') {
    skills = [...skills].sort((a, b) => String(b.indexed_at || '').localeCompare(String(a.indexed_at || '')) || (b.npm_downloads_wk || 0) - (a.npm_downloads_wk || 0));
  } else if (sort === 'downloads') {
    const dl = (s) => (s.npm_downloads_wk || 0) || ((s.source && typeof s.source === 'object' && s.source.pypi_downloads_wk) || 0);
    skills = [...skills].sort((a, b) => dl(b) - dl(a));
  } else if (sort === 'trust') {
    // trust desc con tiebreak por evidencia de adopción (dl/semana o stars)
    const ev = (s) => (s.npm_downloads_wk || 0) || ((s.source && typeof s.source === 'object' && s.source.pypi_downloads_wk) || 0) || ((s.source && typeof s.source === 'object' && s.source.stars) || 0);
    skills = [...skills].sort((a, b) =>
      ((b.trust_score_100 ?? (b.sentinel_score || 0) * 10) - (a.trust_score_100 ?? (a.sentinel_score || 0) * 10)) || ev(b) - ev(a));
  } else if (sort === 'name') {
    skills = [...skills].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }

  const total = skills.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  // Growth loop: cada skill devuelve su badge y página pública — los owners
  // las embeben en sus READMEs → backlinks → visibilidad para MarketNow.
  const pageSkills = skills.slice(offset, offset + limit).map(s => {
    const key = encodeURIComponent(s.slug || s.name || '');
    return { ...s, badge_url: `${SITE}/api/badge/${key}.svg`, page_url: `${SITE}/s/${key}` };
  });

  const qs = (extra) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (category) params.set('category', category);
    if (filter) params.set('filter', filter);
    if (sort) params.set('sort', sort);
    if (q) params.set('q', q);
    if (risk) params.set('risk', risk);
    if (tier) params.set('tier', tier);
    for (const [k, v] of Object.entries(extra || {})) params.set(k, v);
    return `/api/skills?${params.toString()}`;
  };

  // Source breakdown (catalog transparency)
  const sources = {};
  for (const s of (skillsData.skills || skillsData || [])) {
    const src = (s.source && typeof s.source === 'object' ? s.source.type : s.source) || 'original';
    sources[src] = (sources[src] || 0) + 1;
  }

  res.status(200).json({
    page,
    limit,
    total,
    total_catalog: (skillsData.skills || skillsData || []).length,
    // Full ecosystem scale (deduplicated): certified + community + aggregate tracking
    catalog_meta: {
      core_certified: catalogMeta.core_certified,
      community_indexed: catalogMeta.community_indexed,
      aggregate_tracked: catalogMeta.aggregate_tracked,
      total_all: catalogMeta.total_all,
      tiers_doc: 'core = evidence-gated (adoption/verification/age) | community = indexed with weak signal, trust<=55 | aggregate = tracking-only inventory (see /api/community)',
    },
    total_pages: totalPages,
    has_next: page < totalPages,
    has_prev: page > 1,
    sources,
    skills: pageSkills,
    _links: {
      self: qs(),
      next: page < totalPages ? qs({ page: page + 1 }) : null,
      prev: page > 1 ? qs({ page: page - 1 }) : null,
    }
  });
}

// batch3: catalog 67,759 (2026-09-12) — touch forces skills-lite.json re-bundle

// batch4: catalog 68,387 (2026-09-12) — touch forces skills-lite.json re-bundle

// batch6: catalog 68,388 (2026-09-18 universal-memory first-party sync) — touch forces re-bundle

// ─────────────────────────────────────────────────────────────────────────────
// Security evidence API (2nd external audit S8 closure, 2026-09-25)
// Mounted via _mode=security because the Hobby plan caps Serverless Functions
// at 12 (audit-skill.js exists = 12 in use). All numbers come from artifacts
// that live in the repo/deploy — nothing is invented at request time.
// Views: overview (default) | quarantine | honeypot | threat-intel | analytics
// ─────────────────────────────────────────────────────────────────────────────
function securityResponse(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
  res.setHeader('Access-Control-Allow-Origin', '*');
  const view = String(req.query.view || 'overview');

  if (view === 'quarantine') {
    return res.status(200).json({
      view: 'quarantine',
      description: 'Tamper-evident public ledger of every quarantine decision. Third parties can audit FP/FN rate over time.',
      ledger: quarantineManifest,
      how_to_verify: 'Every record carries record_sha256; the manifest lists each file under /_data/quarantine_decisions/.',
      benchmark: { url: '/api/sentinel-benchmark.json', html: '/security/sentinel-benchmark' },
    });
  }

  if (view === 'honeypot') {
    // lib/honeypot.mjs keeps logs in-memory per instance (ephemeral by design);
    // this endpoint publishes the METHODOLOGY, never fabricated counts.
    return res.status(200).json({
      view: 'honeypot',
      description: 'Fake vulnerable endpoints monitored for attacker reconnaissance. Logs are in-memory per server instance (ephemeral); any hit auto-bans the IP for 24h.',
      paths: ['/admin', '/.env', '/wp-admin', '/.git/config', '/phpmyadmin', '/api/internal/debug'],
      enforcement: 'first hit → 24h auto-ban (lib/waf.mjs); IPs cross-checked against threat-intel feeds',
      honesty_note: 'Live hit counters are per-instance and NOT published as historical truth — only the quarantine ledger (/api/quarantine) is a durable public record.',
      source: 'lib/honeypot.mjs (repo)',
    });
  }

  if (view === 'threat-intel') {
    return res.status(200).json({
      view: 'threat-intel',
      description: 'IOC feeds consulted at scan time (Sentinel L1.8 checks skill source URLs against URLhaus).',
      feeds: [
        { name: 'abuse.ch MalwareBazaar', what: 'malware samples + hashes' },
        { name: 'urlhaus.abuse.ch', what: 'malicious URLs' },
        { name: 'threatfox.abuse.ch', what: 'IOCs from campaigns' },
        { name: 'CIRCL MISP', what: 'open-source threat intel' },
        { name: 'AlienVault OTX', what: 'community pulses' },
      ],
      cache: 'in-memory, 5-min TTL (lib/threat-intel.mjs)',
      honesty_note: 'IOC lookups run when scans run; this endpoint publishes the feed list, not a live mirror.',
    });
  }

  if (view === 'analytics') {
    const s = statsBase.security || {};
    return res.status(200).json({
      view: 'analytics',
      description: 'Aggregate security analytics computed from the catalog bundle and L2 scan artifacts.',
      l1: { index_certified: s.l1_index_certified, checks: s.l1_checks, checks_passed: s.l1_checks_passed,
            checks_performed: s.security_checks_performed },
      l2: { targets: s.l2_targets, scanned: s.l2_sentinel_scanned, completion_pct: s.l2_completion_pct,
            clean: s.l2_clean, flagged_warning: s.l2_flagged_warning, flagged_error: s.l2_flagged_error,
            scan_errors: s.l2_scan_errors, own_packages: s.l2_own_packages },
      npm_vulnerabilities_own_packages: s.npm_vulnerabilities_own_packages,
      methodology_url: '/api/certification.json',
    });
  }

  // overview (default): the layer-by-layer evidence map — what the agent claims
  // (10-layer Sentinel pipeline) mapped to where each claim can be verified.
  return res.status(200).json({
    ...securityLayers,
    computed_at: new Date().toISOString(),
    computed_from: 'lib/security-layers.json + quarantine MANIFEST + stats stamp (repo artifacts)',
    endpoints: {
      overview: '/api/security',
      quarantine_ledger: '/api/security?view=quarantine (alias /api/quarantine)',
      honeypot: '/api/security?view=honeypot (alias /api/honeypot)',
      threat_intel: '/api/security?view=threat-intel (alias /api/threat-intel)',
      analytics: '/api/security?view=analytics (alias /api/agent-analytics)',
    },
    human_pages: {
      sentinel_v3: '/security/sentinel-v3.0',
      evidence_matrix: '/security/evidence',
      benchmark: '/security/sentinel-benchmark',
      audit_2026_08_19: '/security/audit-2026-08-19',
      latest_audit: '/trust/aud-2026-0925.html',
    },
  });
}
