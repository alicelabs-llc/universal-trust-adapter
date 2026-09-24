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
      base.security.security_checks_performed = (base.security.l1_checks || 10) * allSkills.length;
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
