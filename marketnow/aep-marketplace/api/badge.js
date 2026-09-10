// MarketNow Trust Badge — public growth loop
// ============================================
// GET /api/badge/<slug>.svg   (rewrite: /api/badge/:slug -> here with ?slug=)
// GET /api/badge?slug=<slug>
//
// Diferenciador vs getlulu.dev: nuestro badge refleja el trust_score_100
// calculado con heurística security-first (edad, adopción, typosquat,
// inyección) — no popularidad de marketing. Los owners de MCPs lo embeben
// en su README → backlink + visibilidad para MarketNow.
//
// Cacheable: 24h public (el score no cambia intra-día).

import skillsData from '../public/api/skills-lite.json' with { type: 'json' };

const esc = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function findSkill(slug) {
  const target = String(slug || '').toLowerCase().replace(/\.svg$/, '').trim();
  if (!target) return null;
  const list = skillsData.skills || skillsData || [];
  for (const s of list) {
    if (String(s.slug || '').toLowerCase() === target) return s;
  }
  for (const s of list) {
    if (String(s.name || '').toLowerCase() === target) return s;
  }
  return null;
}

function shield(leftText, rightText, color, subtitle) {
  // shields.io-style flat badge, zero deps
  const L = 72 + leftText.length * 6.6;          // "MarketNow"
  const R = 26 + rightText.length * 7.2;         // "trust 84/100"
  const W = Math.round(L + R);
  const sub = subtitle ? `\n  <text x="${Math.round(L + 14)}" y="9" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="7" fill="#ffffff" opacity="0.85">${esc(subtitle)}</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="20" role="img" aria-label="${esc(leftText)}: ${esc(rightText)}">
  <title>${esc(leftText)}: ${esc(rightText)}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${W}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${Math.round(L)}" height="20" fill="#555"/>
    <rect x="${Math.round(L)}" width="${Math.round(R)}" height="20" fill="${color}"/>
    <rect width="${W}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${Math.round(L / 2)}" y="15">${esc(leftText)}</text>
    <text x="${Math.round(L + R / 2)}" y="15" fill="#fff">${esc(rightText)}</text>
  </g>${sub}
</svg>`;
}

export default function handler(req, res) {
  const slug = (req.query.slug || (req.url || '').split('/').pop() || '').replace(/\.svg$/i, '');
  const skill = findSkill(slug);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (!skill) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.status(404).send(shield('MarketNow', 'not indexed', '#4a5568', 'registry.marketnow.site'));
    return;
  }

  const trust = Number.isFinite(skill.trust_score_100)
    ? skill.trust_score_100
    : (skill.sentinel_score || 0) * 10;
  const risk = String(skill.risk_level || 'yellow').toLowerCase();
  const color = risk === 'green' ? '#2ea44f' : risk === 'red' ? '#d73a49' : '#e3b341';
  const sub = risk === 'green' ? 'security-first scoring' : risk === 'red' ? 'review before install' : 'heuristic review advised';

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.status(200).send(shield('MarketNow', `trust ${Math.max(0, Math.min(100, Math.round(trust)))}/100`, color, sub));
}
