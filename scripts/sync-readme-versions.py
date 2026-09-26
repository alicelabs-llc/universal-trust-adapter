#!/usr/bin/env python3
"""
sync-readme-versions.py — UTA (split 2026-09-26)
================================================================
Re-deriva las versiones del README de ESTE repo (universal-trust-adapter)
del registry npm (dist-tags). Las superficies de datos del sitio las
sincroniza el workflow homónimo del repo marketplace
(eddyflores100-lang/marketnow) — este script toca SOLO README.md.

Uso:
  python3 scripts/sync-readme-versions.py            # parcha + reporta
  python3 scripts/sync-readme-versions.py --check    # CI: exit 1 si hay drift
"""
import json
import re
import sys
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

PKGS = ['marketnow-mcp', 'agent-trust-card', 'marketnow-install-stack', 'marketnow-audit',
        '@marketnow/uts', '@marketnow/trust-core', '@marketnow/trust-adapters',
        '@marketnow/trust-gateway', '@marketnow/uta-verify', '@marketnow/uta-conformance',
        '@marketnow/cline-trust-plugin', '@marketnow/sentinel-rules',
        '@marketnow/trust-mcp-middleware', '@marketnow/trust-observability']

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

# ── README.md (tabla de paquetes + badge conformance) ────────────────────────
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

if changes:
    print('DRIFT en superficies UTA:')
    for c in changes:
        print(f'  - {c}')
    print(f'  (npm: marketnow-mcp@{VER["marketnow-mcp"]}, conformance v{CONF})')
    if CHECK_ONLY:
        sys.exit(1)
    print('Parcheado.')
else:
    print(f'Sin drift — README sincronizado con npm (marketnow-mcp@{VER["marketnow-mcp"]}, conformance v{CONF}).')
