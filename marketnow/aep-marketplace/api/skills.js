// Paginated skills API — replaces the 24MB skills.json blob
// catalog-version 2026-09-12: 67,593 entries (batch 2 ingest) — touch forces lambda re-bundle
// Usage: GET /api/skills?page=1&limit=100
//       GET /api/skills?page=1&limit=100&category=Security
//       GET /api/skills?page=1&limit=100&filter=free
//       GET /api/skills?sort=recent     (indexed_at desc — newest first)
//       GET /api/skills?sort=downloads  (npm_downloads_wk desc)
//       GET /api/skills?sort=trust      (trust_score_100 desc)
//       GET /api/skills?q=weather       (search in name/description/tags)
//       GET /api/skills?risk=red|yellow|green

import skillsData from '../public/api/skills-lite.json' with { type: 'json' };
import catalogMeta from '../public/api/catalog-meta.json' with { type: 'json' };

const SITE = 'https://www.marketnow.site';

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
  res.setHeader('Access-Control-Allow-Origin', '*');

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
  if (filter === 'free') {
    skills = skills.filter(s => s.is_free === true || s.free === true || s.price === 0);
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
