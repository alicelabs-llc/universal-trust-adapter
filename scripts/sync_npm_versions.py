#!/usr/bin/env python3
"""
sync_npm_versions.py — single-source-of-truth version sync (npm registry → surfaces).

Kills the class of drift the 3rd/4th external audit rounds found (GitHub README
marketnow-mcp@1.10.3 vs npm 1.14.1; uta-conformance 1.3.3 vs npm 1.3.5; homepage
chips trust-core@1.0.1 vs npm 2.0.3; "9 NPM packages" vs 14 real): documentation
versions are re-derived from the npm registry dist-tags, never hand-edited.

Surfaces patched:
  uta-repo/README.md                                     (package table, badge, stats row)
  marketnow/aep-marketplace/public/uta/README.md         (package table, stats row, missing rows)
  marketnow/aep-marketplace/public/api/agent.json        (metrics.npm_latest_version)
  marketnow/aep-marketplace/public/.well-known/agent.json (copy — kept byte-identical)
  marketnow/aep-marketplace/lib/stats-base.json          (_stamp.npm_latest_version)
  marketnow/aep-marketplace/lib/npm-versions.json        (NEW — canonical table for /api/stats.json uta section)
  marketnow/aep-marketplace/src/utils/liveStats.js       (SPA fallback utaPackages — regenerated)

Usage:
  python3 scripts/sync_npm_versions.py            # patch + report
  python3 scripts/sync_npm_versions.py --check    # CI: exit 1 on any drift
"""
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent          # uta-repo/
MP = REPO / 'marketnow/aep-marketplace'

# Los 14 paquetes públicos del ecosistema (enumerados vía registry search;
# 10 con scope @marketnow + 4 sin scope).
PKGS = ['marketnow-mcp', 'agent-trust-card', 'marketnow-install-stack', 'marketnow-audit',
        '@marketnow/uts', '@marketnow/trust-core', '@marketnow/trust-adapters',
        '@marketnow/trust-gateway', '@marketnow/uta-verify', '@marketnow/uta-conformance',
        '@marketnow/cline-trust-plugin', '@marketnow/sentinel-rules',
        '@marketnow/trust-mcp-middleware', '@marketnow/trust-observability']

UTA_README_DESC = {
    'marketnow-mcp': 'MCP server with 15 trust tools (remote endpoint exposes 9)',
    'agent-trust-card': 'ATC/1.0 SDK (issue, verify, inspect)',
    'marketnow-install-stack': 'Multi-source installer',
    'marketnow-audit': 'Security audit CLI (domain scam-check, ATC verify, OCSP, catalog)',
    '@marketnow/uts': 'Universal Trust Schema',
    '@marketnow/trust-core': 'Trust Engine core',
    '@marketnow/trust-adapters': '9 format adapters',
    '@marketnow/trust-gateway': 'Gateway + post-exec filter',
    '@marketnow/uta-verify': 'CLI credential verifier (CI exit codes)',
    '@marketnow/uta-conformance': '14 signed vectors + reference scorer',
    '@marketnow/cline-trust-plugin': 'Interceptor: revocation gate + tool pinning',
    '@marketnow/sentinel-rules': '29 MCP security rules + zero-dep lite scanner',
    '@marketnow/trust-mcp-middleware': 'MCP tools/call wrapper: credential enforcement',
    '@marketnow/trust-observability': 'Zero-dep observability: logging, tracing, metrics',
}

CHECK_ONLY = '--check' in sys.argv

def npm_latest(pkg):
    with urllib.request.urlopen(f'https://registry.npmjs.org/{pkg}', timeout=20) as r:
        return json.load(r)['dist-tags']['latest']

def npm_month(pkg):
    try:
        with urllib.request.urlopen(f'https://api.npmjs.org/downloads/point/last-month/{pkg}', timeout=20) as r:
            return json.load(r)['downloads']
    except Exception:
        return 0

VER = {p: npm_latest(p) for p in PKGS}
MO = {p: npm_month(p) for p in PKGS}
TOTAL_MO = sum(MO.values())
CONF = VER['@marketnow/uta-conformance']
changes = []

# ── 0. lib/npm-versions.json (NUEVO — fuente de la sección uta de /api/stats.json) ──
npm_json = {
    '$schema': 'https://marketnow.site/api/npm-versions.schema.json',
    'generated_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'source': 'registry.npmjs.org dist-tags + api.npmjs.org downloads (last-month) — re-derived by scripts/sync_npm_versions.py (weekly workflow + audit gate)',
    'packages': [{'name': p, 'version': VER[p], 'dl_month': MO[p]} for p in PKGS],
    'totals': {'packages': len(PKGS), 'dl_month': TOTAL_MO},
    'conformance_version': CONF,
    'test_vectors': 41,           # 5 ATC/1.0 frozen + 36 ATC v3.0 (repo) — no deriva de npm
    'conformance_checks': 24,     # @marketnow/uta-conformance: 14 public vectors · 24 checks
}
p = MP / 'lib/npm-versions.json'
existing = p.read_text() if p.exists() else ''
new_text = json.dumps(npm_json, indent=2, ensure_ascii=False) + '\n'
if json.loads(existing).get('packages') != npm_json['packages'] or \
   json.loads(existing).get('totals') != npm_json['totals'] if existing else True:
    changes.append('lib/npm-versions.json')
    if not CHECK_ONLY:
        p.write_text(new_text)

# ── 0b. liveStats.js — fallback del SPA regenerado del registry ─────────────
p = MP / 'src/utils/liveStats.js'
t = p.read_text()
blocks = ",\n    ".join(f"{{ name: '{pk}', version: '{VER[pk]}' }}" for pk in PKGS)
new_block = (f"  utaPackages: [\n    {blocks},\n  ],\n"
             f"  utaPackagesCount: {len(PKGS)},\n"
             f"  utaMonthlyDownloads: {TOTAL_MO},")
pat = re.compile(r"  utaPackages: \[\n(?:.*?\n)*?  \],\n  utaPackagesCount: \d+,\n  utaMonthlyDownloads: \d+,")
if pat.search(t):
    t2 = pat.sub(new_block, t, count=1)
    if t2 != t:
        changes.append('liveStats.js (fallback utaPackages)')
        if not CHECK_ONLY:
            p.write_text(t2)
else:
    print('WARN: bloque utaPackages no encontrado en liveStats.js — patrón roto')
    if not CHECK_ONLY:
        sys.exit(1)

# ── 1. uta-repo/README.md ────────────────────────────────────────────────────
p = REPO / 'README.md'
t = p.read_text()
orig = t
t = re.sub(r'badge/conformance-v[0-9.]+-brightgreen', f'badge/conformance-v{CONF}-brightgreen', t)
for name in PKGS:
    t = re.sub(
        rf'(\|\s*\[`{re.escape(name)}`\]\([^)]*\)\s*\|\s*)[0-9]+\.[0-9]+\.[0-9]+',
        rf'\g<1>{VER[name]}', t)
t = re.sub(r'\| NPM packages \| \d+ \(combined last-week downloads: [0-9,]+\+ \) \|',
           f'| NPM packages | {len(PKGS)} (combined monthly downloads: {TOTAL_MO:,}+) |', t)
t = re.sub(r'\| Conformance \(live\) \| [^|]+· v[0-9.]+[^|]*\|',
           f'| Conformance (live) | 14 public vectors · 24 checks + 10 mutants · v{CONF} (npm-synced) |', t)
if t != orig:
    changes.append('README.md (root)')
    if not CHECK_ONLY:
        p.write_text(t)

# ── 2. public/uta/README.md ─────────────────────────────────────────────────
p = MP / 'public/uta/README.md'
t = p.read_text()
orig = t
for name in PKGS:
    t = re.sub(
        rf'(\|\s*\[`{re.escape(name)}`\]\([^)]*\)\s*\|\s*)[0-9]+\.[0-9]+\.[0-9]+',
        rf'\g<1>{VER[name]}', t)
# stats row: count + monthly downloads
t = re.sub(r'\| NPM packages \| \d+ \|', f'| NPM packages | {len(PKGS)} |', t)
t = re.sub(r'\| NPM monthly downloads \| [0-9,]+ \|', f'| NPM monthly downloads | {TOTAL_MO:,} |', t)
# filas faltantes: insertar las que no existan tras la fila de cline-trust-plugin
anchor = re.search(r'^\|\s*\[`@marketnow/cline-trust-plugin`\].*$', t, re.M)
if anchor:
    missing = [pk for pk in PKGS if f'`{pk}`' not in t]
    if missing:
        rows = "\n".join(
            f"| [`{pk}`](https://www.npmjs.com/package/{pk.replace('@', '%40') if pk.startswith('@') else pk}) | {VER[pk]} | {UTA_README_DESC[pk]} | {MO[pk]:,} |"
            for pk in missing)
        t = t[:anchor.end()] + "\n" + rows + t[anchor.end():]
        changes.append('public/uta/README.md (filas nuevas)')
if t != orig:
    changes.append('public/uta/README.md')
    if not CHECK_ONLY:
        p.write_text(t)

# ── 3. agent.json + stats-base stamp ────────────────────────────────────────
for rel in ['public/api/agent.json', 'public/.well-known/agent.json']:
    p = MP / rel
    d = json.loads(p.read_text())
    m = d.get('metrics', {})
    if m.get('npm_latest_version') != VER['marketnow-mcp'] or m.get('npm_packages_published') != len(PKGS):
        m['npm_latest_version'] = VER['marketnow-mcp']
        m['npm_packages_published'] = len(PKGS)
        m['npm_monthly_downloads'] = TOTAL_MO
        d['metrics'] = m
        changes.append(rel)
        if not CHECK_ONLY:
            p.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n")
# mantener la copia byte-idéntica
if not CHECK_ONLY:
    canon = (MP / 'public/api/agent.json').read_text()
    (MP / 'public/.well-known/agent.json').write_text(canon)
p = MP / 'lib/stats-base.json'
d = json.loads(p.read_text())
st = d.get('_stamp', {})
if st.get('npm_latest_version') != VER['marketnow-mcp'] or st.get('npm_packages_count') != len(PKGS):
    st['npm_latest_version'] = VER['marketnow-mcp']
    st['npm_packages_count'] = len(PKGS)
    st['npm_monthly_downloads'] = TOTAL_MO
    st['stamped_at'] = npm_json['generated_at']
    d['_stamp'] = st
    changes.append('lib/stats-base.json (_stamp)')
    if not CHECK_ONLY:
        p.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n")

# ── reporte ─────────────────────────────────────────────────────────────────
print(f'npm: marketnow-mcp@{VER["marketnow-mcp"]} · uta-conformance@{CONF} · {len(PKGS)} packages · {TOTAL_MO:,} dl/mo')
if changes:
    print('DRIFT DETECTADO en:', ', '.join(changes))
    if CHECK_ONLY:
        print('ejecuta: python3 scripts/sync_npm_versions.py  (o el workflow version-sync)')
        sys.exit(1)
    print('parcheado.')
else:
    print('sin drift — todas las superficies coinciden con el registry.')
