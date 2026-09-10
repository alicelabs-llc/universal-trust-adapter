#!/usr/bin/env python3
"""
Task 47c: outreach FASE 1 v2 — selección ESTRICTA.
Solo repos cuyo nombre declara server MCP (name contains 'mcp'), stars>=80,
activos. Luego se verifican los stars reales vía GitHub API antes de contactar
(los del catálogo antiguo vienen inflados ~2x — herencia del auto-discovery).
"""
import json, re
from datetime import datetime, timezone

BASE = '/home/z/my-project/uta-repo/marketnow/aep-marketplace'
OUT = '/home/z/my-project/scripts/outreach_wave1_targets.json'
OWN = ('alicelabs', 'edgarflores', 'marketnow', 'universal-trust-adapter',
       'getlulu', 'glama', 'smithery', 'pulsemcp', 'mcpservers', 'punkpeye')

data = json.load(open(f'{BASE}/public/api/skills-lite.json'))
items = data if isinstance(data, list) else data.get('skills', [])

def repo_of(s):
    src = s.get('source') or {}
    url = (src.get('url') or src.get('repo_url') or '') if isinstance(src, dict) else ''
    m = re.match(r'https://github\.com/([^/\s]+)/([^/\s]+?)(?:\.git)?/?$', url)
    return (m.group(1), m.group(2)) if m else None

now = datetime.now(timezone.utc)
targets = {}
for s in items:
    src = s.get('source') or {}
    if not isinstance(src, dict) or src.get('type') != 'github':
        continue
    rp = repo_of(s)
    if not rp:
        continue
    owner, repo = rp
    full = (owner + '/' + repo).lower()
    if any(o in full for o in OWN):
        continue
    # CRITERIO ESTRICTO: el repo declara ser un MCP server en su nombre
    if 'mcp' not in repo.lower():
        continue
    if 'awesome' in repo.lower() or 'list' in repo.lower() or 'hub' == repo.lower().replace('-mcp',''):
        continue
    st = src.get('stars') if isinstance(src.get('stars'), int) else 0
    m = re.search(r'(\d[\d,]*)\s*stars', str(src.get('note', '')))
    if not st and m:
        st = int(m.group(1).replace(',', ''))
    if st < 60:
        continue
    lp = src.get('last_push') or ''
    if not lp:
        m = re.search(r'Last push:\s*([\d-]+T[\d:]+Z)', str(src.get('note', '')))
        lp = m.group(1) if m else ''
    if lp:
        try:
            if (now - datetime.fromisoformat(lp.replace('Z', '+00:00'))).days > 365:
                continue
        except Exception:
            pass
    key = f'{owner}/{repo}'
    if key not in targets or st > targets[key]['stars']:
        targets[key] = {
            'owner': owner, 'repo': repo, 'stars': st,
            'slug': s.get('slug'), 'name': s.get('name'),
            'trust': s.get('trust_score_100'), 'risk': s.get('risk_level'),
            'install': s.get('install'), 'lang': (src.get('language') or ''),
            'repo_url': f'https://github.com/{owner}/{repo}',
        }

ranked = sorted(targets.values(), key=lambda t: -t['stars'])
per_owner, final = {}, []
for t in ranked:
    per_owner[t['owner']] = per_owner.get(t['owner'], 0) + 1
    if per_owner[t['owner']] <= 2:
        final.append(t)
    if len(final) >= 45:
        break

json.dump(final, open(OUT, 'w'), indent=1)
print(f'objetivos estrictos: {len(final)} (de {len(targets)} repos mcp con stars)')
for t in final:
    print(f"  {t['stars']:>6}*  {t['owner']}/{t['repo']:<44} trust={t['trust']} {t['install'][:38]}")
