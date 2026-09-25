#!/usr/bin/env python3
"""
sync_npm_versions.py — single-source-of-truth version sync (npm registry → surfaces).

Kills the class of drift the 3rd external audit round found (GitHub README
marketnow-mcp@1.10.3 vs npm 1.14.1; uta-conformance 1.3.3 vs npm 1.3.5):
documentation versions are re-derived from the npm registry dist-tags, never
hand-edited.

Surfaces patched:
  uta-repo/README.md                                     (package table, badge, stats row)
  marketnow/aep-marketplace/public/uta/README.md         (package table, stats row)
  marketnow/aep-marketplace/public/api/agent.json        (metrics.npm_latest_version)
  marketnow/aep-marketplace/lib/stats-base.json          (_stamp.npm_latest_version)

Usage:
  python3 scripts/sync_npm_versions.py            # patch + report
  python3 scripts/sync_npm_versions.py --check    # CI: exit 1 on any drift
"""
import json
import re
import sys
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent          # uta-repo/
MP = REPO / 'marketnow/aep-marketplace'

PKGS = ['marketnow-mcp', 'agent-trust-card', 'marketnow-install-stack',
        '@marketnow/uts', '@marketnow/trust-core', '@marketnow/trust-adapters',
        '@marketnow/trust-gateway', '@marketnow/cline-trust-plugin',
        '@marketnow/uta-conformance', '@marketnow/sentinel-rules',
        '@marketnow/trust-mcp-middleware', '@marketnow/trust-observability']

CHECK_ONLY = '--check' in sys.argv

def npm_latest(pkg):
    with urllib.request.urlopen(f'https://registry.npmjs.org/{pkg}', timeout=20) as r:
        return json.load(r)['dist-tags']['latest']

def npm_week(pkg):
    try:
        with urllib.request.urlopen(f'https://api.npmjs.org/downloads/point/last-week/{pkg}', timeout=20) as r:
            return json.load(r)['downloads']
    except Exception:
        return 0

VER = {p: npm_latest(p) for p in PKGS}
WK = {p: npm_week(p) for p in PKGS}
TOTAL_WK = sum(WK.values())
CONF = VER['@marketnow/uta-conformance']
changes = []

# ── 1. uta-repo/README.md ────────────────────────────────────────────────────
p = REPO / 'README.md'
t = p.read_text()
orig = t
t = t.replace('badge/conformance-v1.3.3-brightgreen', f'badge/conformance-v{CONF}-brightgreen')
# cualquier badge conformance-vX que no sea el vivo
t = re.sub(r'badge/conformance-v[0-9.]+-brightgreen', f'badge/conformance-v{CONF}-brightgreen', t)
for name in PKGS:
    t = re.sub(
        rf'(\|\s*\[`{re.escape(name)}`\]\([^)]*\)\s*\|\s*)[0-9]+\.[0-9]+\.[0-9]+',
        rf'\g<1>{VER[name]}', t)
    t = re.sub(
        rf'(\|\s*\[`{re.escape(name)}`\]\([^)]*\)\s*\|\s*[0-9]+\.[0-9]+\.[0-9]+\s*\|[^|]+\|)\s*[0-9,]+/wk\s*\|',
        rf'\g<1> {WK[name]:,}/wk |', t)
t = re.sub(r'\| NPM packages \| \d+ \(combined last-week downloads: [0-9,]+\+ \) \|',
           f'| NPM packages | {len(PKGS)} (combined last-week downloads: {TOTAL_WK:,}+) |', t)
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
    if f'`{name}`' not in t:
        continue
    t = re.sub(
        rf'(\|\s*\[`{re.escape(name)}`\]\([^)]*\)\s*\|\s*)[0-9]+\.[0-9]+\.[0-9]+',
        rf'\g<1>{VER[name]}', t)
t = re.sub(r'## 📊 Project stats \([^)]*\)',
           '## 📊 Project stats (auto-synced from npm registry + /api/stats.json — scripts/sync_npm_versions.py)', t)
if t != orig:
    changes.append('public/uta/README.md')
    if not CHECK_ONLY:
        p.write_text(t)

# ── 3. agent.json + stats-base stamp ────────────────────────────────────────
for rel in ['public/api/agent.json', 'public/.well-known/agent.json']:
    p = MP / rel
    d = json.loads(p.read_text())
    if d.get('metrics', {}).get('npm_latest_version') != VER['marketnow-mcp']:
        d['metrics']['npm_latest_version'] = VER['marketnow-mcp']
        changes.append(rel)
        if not CHECK_ONLY:
            p.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n")
p = MP / 'lib/stats-base.json'
d = json.loads(p.read_text())
st = d.get('_stamp', {})
if st.get('npm_latest_version') != VER['marketnow-mcp']:
    st['npm_latest_version'] = VER['marketnow-mcp']
    d['_stamp'] = st
    changes.append('lib/stats-base.json (_stamp)')
    if not CHECK_ONLY:
        p.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n")

# ── reporte ─────────────────────────────────────────────────────────────────
print(f'npm latest: marketnow-mcp@{VER["marketnow-mcp"]} · uta-conformance@{CONF} · {len(PKGS)} packages')
if changes:
    print('DRIFT DETECTADO en:', ', '.join(changes))
    if CHECK_ONLY:
        print('ejecuta: python3 scripts/sync_npm_versions.py  (o el workflow version-sync)')
        sys.exit(1)
    print('parcheado.')
else:
    print('sin drift — todas las superficies coinciden con el registry.')
