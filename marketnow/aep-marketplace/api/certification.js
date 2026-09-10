// MarketNow Certification API — L1 (index) + L2 (sentinel deep-scan) + L3 (trust chain)
// ==================================================================================
// GET /api/certification                 → reporte completo (metodología + checks + deep-scan)
// GET /api/certification?package=<name>  → resultado del deep-scan de un paquete
// GET /api/certification?summary=1       → solo stats (ligero)
//
// Diferenciador vs getlulu.dev: esto NO es un score de popularidad — son los
// resultados crudos de nuestros validadores (Sentinel 29 reglas sobre el
// artefacto publicado, con shasum verificable) + la certificación del índice
// completo. Publicamos hasta los hallazgos incómodos.

import cert from '../public/api/certification.json' with { type: 'json' };
import scans from '../public/api/certification-scans.json' with { type: 'json' };
import catalogMeta from '../public/api/catalog-meta.json' with { type: 'json' };
import community from '../public/api/community-index.json' with { type: 'json' };

// ── Community mode (merged from api/community.js — Hobby plan 12-function cap) ──
// /api/community reescribe aquí con _mode=community.
function communityResponse(req, res) {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || '100', 10)));
  const q = (req.query.q || '').toLowerCase().trim();

  let entries = community.entries || [];
  if (q) {
    entries = entries.filter(e =>
      String(e.n || '').toLowerCase().includes(q) ||
      String(e.o || '').toLowerCase().includes(q)
    );
  }

  const total = entries.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const offset = (page - 1) * limit;
  const pageEntries = entries.slice(offset, offset + limit).map(e => ({
    id: e.i, name: e.n, owner: e.o, repo_url: e.g, glama_url: e.l, tier: 'aggregate',
  }));

  const qs = (extra) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (q) params.set('q', q);
    for (const [k, v] of Object.entries(extra || {})) params.set(k, v);
    return `/api/community?${params.toString()}`;
  };

  res.status(200).json({
    tier: 'aggregate',
    description: community.description,
    disclaimer: 'Tracking-only inventory: NO trust score, NO install command, NO review. For certified entries use /api/skills (tiers core|community) or /api/certification.',
    page, limit, total,
    total_pages: totalPages,
    has_next: page < totalPages,
    has_prev: page > 1,
    source: community.source,
    generated_at: community.generated_at,
    entries: pageEntries,
    _links: {
      self: qs(),
      next: page < totalPages ? qs({ page: page + 1 }) : null,
      prev: page > 1 ? qs({ page: page - 1 }) : null,
    },
  });
}

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // /api/community (rewrite) → modo community
  if (req.query._mode === 'community') { communityResponse(req, res); return; }

  const pkg = (req.query.package || '').toLowerCase().trim();

  // Deep-scan lookup por paquete
  if (pkg) {
    const hit = (scans.scans || []).find(s => String(s.name).toLowerCase() === pkg);
    if (!hit) {
      return res.status(404).json({
        found: false,
        package: pkg,
        note: 'Not in the deep-scan set (top npm by adoption + own packages). It may still be L1 index-certified — check /api/skills?q=.',
      });
    }
    return res.status(200).json({
      found: true,
      level: 2,
      level_name: 'sentinel-scanned',
      scan: hit,
      verify_command: `npm view ${hit.name}@${hit.version} dist.shasum  # expect ${hit.shasum}`,
    });
  }

  if (req.query.summary) {
    return res.status(200).json({
      schema: cert.schema,
      generated_at: cert.generated_at,
      catalog: {
        total_all: catalogMeta.total_all,
        core_certified: catalogMeta.core_certified,
        community_indexed: catalogMeta.community_indexed,
        aggregate_tracked: catalogMeta.aggregate_tracked,
      },
      index_certification: cert.index_certification,
      deep_scan: scans.stats || cert.deep_scan,
      endpoints: {
        full: '/api/certification',
        scans: '/api/certification-scans.json',
        per_package: '/api/certification?package=<npm-name>',
      },
    });
  }

  res.status(200).json({
    ...cert,
    // L2 stats viven en certification-scans.json (fuente de verdad del deep-scan)
    deep_scan: { ...(scans.stats || {}), report: '/api/certification-scans.json' },
    catalog: {
      total_all: catalogMeta.total_all,
      core_certified: catalogMeta.core_certified,
      community_indexed: catalogMeta.community_indexed,
      aggregate_tracked: catalogMeta.aggregate_tracked,
      sources: catalogMeta.sources,
    },
    levels: {
      L1: 'index-certified — every catalog entry passes the 10 documented checks (unique id/slug, provenance, risk model, scoring bounds). Report: /api/certification (this endpoint).',
      L2: 'sentinel-scanned — the shipped registry artifact (tarball, shasum-verified) is scanned with the 29 MarketNow rules in tarball mode. Results: /api/certification-scans.json. Per package: ?package=<name>.',
      L3: 'trust-chain — ATC/OCSP/CRL/TFP verification for the MarketNow ecosystem. See /api/trust, /api/ocsp, /api/crl, /api/atc.',
    },
    growth_loop: 'Owners: your badge (/api/badge/<slug>.svg) reflects your trust score. Scanned packages show their verdict at /api/certification?package=<name>.',
  });
}
