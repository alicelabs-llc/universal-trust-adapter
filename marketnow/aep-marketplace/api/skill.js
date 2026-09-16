// MarketNow per-skill public page — SEO + schema.org (Lulu parity)
// catalog-version 2026-09-12: 68,387 entries (5.9.2: +humanmirror-x402-catalog (first vendor-priced x402 listing, L2-reviewed))
// =================================================================
// GET /api/skill?slug=<slug>   (rewrite: /s/:slug -> here)
//
// Cada MCP/skill del catálogo tiene una URL pública indexable:
//   https://www.marketnow.site/s/<slug>
// con JSON-LD (SoftwareApplication + FAQPage), OG tags y badge.
// Diferenciador: la página muestra el trust score security-first con
// explicación de señales (edad, adopción, typosquat, inyección) y el
// riesgo de instalación — no solo popularidad.

import skillsData from '../public/api/skills-lite.json' with { type: 'json' };

const SITE = 'https://www.marketnow.site';
const esc = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function findSkill(slug) {
  const target = String(slug || '').toLowerCase().trim();
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

const RISK_COPY = {
  green: { label: 'Low install risk', color: '#2ea44f', note: 'No registry code execution during install (git clone based) and no red flags found by Sentinel Index Heuristics.' },
  yellow: { label: 'Review advised', color: '#e3b341', note: 'Heuristic signals advise review before installing: young package, low adoption, stale repository, or name similarity to a popular package.' },
  red: { label: 'Runs registry code', color: '#d73a49', note: 'Installing via npx/uvx/npm install executes arbitrary code from the public registry on your machine. This is the install-risk semantic of the MarketNow catalog — verify the publisher before running it.' },
};

function page(skill) {
  const name = skill.name || skill.slug;
  const desc = (skill.description || `${name} is an MCP server indexed by the MarketNow registry.`).slice(0, 300);
  const trust = Number.isFinite(skill.trust_score_100) ? Math.max(0, Math.min(100, Math.round(skill.trust_score_100))) : (skill.sentinel_score || 0) * 10;
  const risk = RISK_COPY[String(skill.risk_level || 'yellow').toLowerCase()] || RISK_COPY.yellow;
  const src = (skill.source && typeof skill.source === 'object') ? skill.source : {};
  const srcType = src.type || 'original';
  const stars = typeof src.stars === 'number' ? src.stars : null;
  const dl = typeof skill.npm_downloads_wk === 'number' ? skill.npm_downloads_wk
    : (typeof src.pypi_downloads_wk === 'number' ? src.pypi_downloads_wk : null);
  const repoUrl = src.url && srcType !== 'npm-registry' && srcType !== 'pypi' ? src.url : (src.repo_url || null);
  const pkgUrl = srcType === 'pypi' ? src.url : (srcType === 'npm-registry' ? src.url : null);
  const install = skill.install || '';
  const category = skill.category || 'Developer Tools';
  const author = skill.author || 'unknown';
  const version = skill.version || '';
  const badge = `${SITE}/api/badge/${encodeURIComponent(skill.slug || name)}.svg`;

  const adoptionLine = [
    stars !== null ? `<strong>${stars.toLocaleString('en-US')}</strong> GitHub stars` : null,
    dl !== null ? `<strong>${dl.toLocaleString('en-US')}</strong> weekly registry downloads` : null,
    src.curated ? 'listed in the curated <em>awesome-mcp-servers</em> list' : null,
  ].filter(Boolean).join(' &middot; ');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name,
        description: desc,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Cross-platform',
        url: `${SITE}/s/${skill.slug}`,
        author: { '@type': 'Person', name: author },
        softwareVersion: version || undefined,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        ...(repoUrl || pkgUrl ? { sameAs: [repoUrl, pkgUrl].filter(Boolean) } : {}),
        ...(skill.tags && skill.tags.length ? { keywords: skill.tags.slice(0, 6).join(', ') } : {}),
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `What is ${name}?`,
            acceptedAnswer: { '@type': 'Answer', text: `${desc} It is indexed in the MarketNow MCP registry with a security-first trust score of ${trust}/100 (${risk.label}).` },
          },
          {
            '@type': 'Question',
            name: `How do I install ${name}?`,
            acceptedAnswer: { '@type': 'Answer', text: install ? `Run: ${install}. ${risk.note}` : `See the project repository for install instructions. ${risk.note}` },
          },
          {
            '@type': 'Question',
            name: 'What does the MarketNow trust score mean?',
            acceptedAnswer: { '@type': 'Answer', text: `MarketNow scores MCP servers with Sentinel Index Heuristics: package age, verified adoption (registry downloads or GitHub stars), typosquat distance against popular packages, and injection markers in descriptions. ${name} scores ${trust}/100. This is a risk heuristic computed from public signals — not a popularity ranking and not a guarantee.` },
          },
        ],
      },
    ],
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)} — MCP server, trust ${trust}/100 | MarketNow Registry</title>
<meta name="description" content="${esc(desc).slice(0, 160)}">
<link rel="canonical" href="${SITE}/s/${esc(skill.slug)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="MarketNow">
<meta property="og:title" content="${esc(name)} — trust ${trust}/100">
<meta property="og:description" content="${esc(desc).slice(0, 160)}">
<meta property="og:url" content="${SITE}/s/${esc(skill.slug)}">
<meta name="twitter:card" content="summary">
<meta name="robots" content="index, follow">
<script type="application/ld+json">${esc(JSON.stringify(jsonLd))}</script>
<style>
:root{--bg:#0d1117;--card:#161b22;--line:#30363d;--fg:#e6edf3;--mut:#8b949e;--ac:#58a6ff}
*{box-sizing:border-box;margin:0;padding:0}
body{font:16px/1.65 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:var(--fg)}
main{max-width:820px;margin:0 auto;padding:48px 20px 80px}
a{color:var(--ac);text-decoration:none}a:hover{text-decoration:underline}
.crumb{color:var(--mut);font-size:13px;margin-bottom:18px}
h1{font-size:30px;line-height:1.25;letter-spacing:-.5px;margin-bottom:10px;word-break:break-word}
.desc{color:#c9d1d9;font-size:17px;max-width:64ch}
.row{display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin:22px 0}
.badge img{display:block;vertical-align:middle}
.chip{display:inline-block;padding:3px 10px;border:1px solid var(--line);border-radius:999px;font-size:12px;color:var(--mut)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:26px 0}
.cell{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
.cell .k{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--mut)}
.cell .v{font-size:15px;margin-top:4px;font-weight:600}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:20px;margin:18px 0}
.card h2{font-size:15px;margin-bottom:10px;color:var(--fg)}
code{font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#0d1117;border:1px solid var(--line);padding:10px 12px;border-radius:6px;display:block;overflow-x:auto;white-space:pre;color:#7ee787}
.note{font-size:13.5px;color:var(--mut);margin-top:10px}
.faq details{border:1px solid var(--line);border-radius:8px;padding:12px 16px;margin:10px 0;background:var(--card)}
.faq summary{cursor:pointer;font-weight:600;font-size:14.5px}
.faq p{font-size:14px;color:#c9d1d9;margin-top:8px}
footer{border-top:1px solid var(--line);margin-top:40px;padding-top:18px;font-size:13px;color:var(--mut);display:flex;flex-wrap:wrap;gap:8px 22px}
</style>
</head>
<body>
<main>
<p class="crumb"><a href="${SITE}/registry">MarketNow Registry</a> / <a href="${SITE}/api/skills?category=${encodeURIComponent(category)}">${esc(category)}</a> / ${esc(name)}</p>
<h1>${esc(name)}</h1>
<p class="desc">${esc(desc)}</p>
<div class="row">
  <span class="badge"><a href="${SITE}/s/${esc(skill.slug)}"><img src="${esc(badge)}" alt="MarketNow trust score ${trust}/100" width="178" height="20"></a></span>
  <span class="chip">${esc(category)}</span>
  ${version ? `<span class="chip">v${esc(version)}</span>` : ''}
  ${src.curated ? '<span class="chip">curated list</span>' : ''}
  <span class="chip">by ${esc(author)}</span>
</div>

<div class="grid">
  <div class="cell"><div class="k">Trust score</div><div class="v" style="color:${risk.color}">${trust}/100</div></div>
  <div class="cell"><div class="k">Install risk</div><div class="v" style="color:${risk.color}">${risk.label}</div></div>
  ${stars !== null ? `<div class="cell"><div class="k">GitHub stars</div><div class="v">${stars.toLocaleString('en-US')}</div></div>` : ''}
  ${dl !== null ? `<div class="cell"><div class="k">Downloads / week</div><div class="v">${dl.toLocaleString('en-US')}</div></div>` : ''}
  <div class="cell"><div class="k">Source</div><div class="v">${esc(srcType)}</div></div>
  ${skill.indexed_at ? `<div class="cell"><div class="k">Indexed</div><div class="v">${esc(skill.indexed_at)}</div></div>` : ''}
</div>

${install ? `<div class="card"><h2>Install</h2><code>$ ${esc(install)}</code><p class="note">${risk.note}</p></div>` : ''}

${adoptionLine ? `<p class="note" style="margin-top:14px">Adoption evidence: ${adoptionLine}.</p>` : ''}

<div class="card"><h2>How MarketNow scored this</h2>
<p class="note" style="margin-top:0">Sentinel Index Heuristics — a security-first estimate from public signals:</p>
<ul style="font-size:14px;color:#c9d1d9;margin:10px 0 0 20px;line-height:1.8">
<li>Package age and release activity (stale repositories lose points)</li>
<li>Verified adoption: registry downloads or GitHub stars, not follower counts</li>
<li>Typosquat distance against the 150 most-installed MCP packages</li>
<li>Injection markers scanned in the package description</li>
</ul>
<p class="note">Heuristic, not a guarantee. For verified agent credentials and revocation, see the <a href="${SITE}/api/trust">MarketNow Trust API</a>.</p></div>

<div class="faq">
<details open><summary>What is ${esc(name)}?</summary><p>${esc(desc)} Indexed by MarketNow with trust ${trust}/100 (${risk.label}).</p></details>
<details><summary>How do I install it?</summary><p>${install ? `Run <code style="display:inline;padding:2px 6px">$ ${esc(install)}</code>` : 'See the project repository.'} ${esc(risk.note)}</p></details>
<details><summary>What does the trust score mean?</summary><p>Security-first heuristic over public signals (age, adoption, typosquat distance, injection markers). It is not a popularity ranking and not a guarantee of safety. ${esc(name)} scores ${trust}/100.</p></details>
</div>

<footer>
<span><a href="${SITE}/registry">Browse registry</a></span>
${repoUrl ? `<span><a href="${esc(repoUrl)}" rel="nofollow noopener">Source repository</a></span>` : ''}
${pkgUrl ? `<span><a href="${esc(pkgUrl)}" rel="nofollow noopener">Package page</a></span>` : ''}
<span><a href="${SITE}/api/skills?q=${encodeURIComponent(name)}">API query</a></span>
<span><a href="${SITE}/api/agent.json">For AI agents</a></span>
</footer>
</main>
</body>
</html>`;
}

function notFound(slug) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Not indexed — MarketNow</title>
<meta name="robots" content="noindex">
<style>body{font:16px/1.6 -apple-system,sans-serif;background:#0d1117;color:#e6edf3;display:grid;place-items:center;min-height:100vh;margin:0}main{text-align:center;max-width:420px;padding:20px}a{color:#58a6ff}</style>
</head>
<body><main>
<h1 style="font-size:22px">Skill not found</h1>
<p style="color:#8b949e;margin:14px 0">“${esc(slug)}” is not in the MarketNow index.</p>
<p><a href="https://www.marketnow.site/registry">Browse the registry →</a></p>
</main></body></html>`;
}

// ── Badge mode (merged from api/badge.js — Hobby plan 12-function cap) ────
// /api/badge/:slug y /api/badge?slug= reescriben aquí con _mode=badge.
function shield(leftText, rightText, color, subtitle) {
  const L = 72 + leftText.length * 6.6;
  const R = 26 + rightText.length * 7.2;
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

function badgeResponse(req, res) {
  const slug = (req.query.slug || '').replace(/\.svg$/i, '');
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

export default function handler(req, res) {
  // /api/badge/:slug (rewrite) y /api/badge?slug= (rewrite) → modo badge
  if (req.query._mode === 'badge') { badgeResponse(req, res); return; }

  const slug = String(req.query.slug || '').toLowerCase().trim();
  const skill = findSkill(slug);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (!skill) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(404).send(notFound(slug));
    return;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=21600');
  res.status(200).send(page(skill));
}

// batch3: catalog 67,759 (2026-09-12) — touch forces skills-lite.json re-bundle

// batch4: catalog 68,387 (2026-09-12) — touch forces skills-lite.json re-bundle

// batch5: catalog 68,387 (2026-09-12) — public submit endpoint live — touch forces re-bundle
