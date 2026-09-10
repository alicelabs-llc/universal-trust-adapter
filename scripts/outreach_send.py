#!/usr/bin/env python3
"""
Task 47e: outreach DIRECTO a dueños de MCP servers (ola 1, 45 repos).
- Verifica stars reales vía shields.io (sin quota de GitHub)
- Verifica que /s/<slug> y el badge del objetivo respondan 200 ANTES de citarlos
- Abre 1 issue personalizado por repo (datos reales + badge listo para pegar)
- State file resumible; respeta rate limit (aborta limpio si queda <5)
Uso: python3 outreach_send.py [--dry]
"""
import json, time, urllib.request, ssl

GH_TOKEN = open('/home/z/my-project/scripts/tokens/gh-token').read().strip()
TARGETS = json.load(open('/home/z/my-project/scripts/outreach_wave1_verified.json'))
STATE = '/home/z/my-project/scripts/outreach_wave1_state.json'
REPORT = '/home/z/my-project/scripts/outreach_wave1_report.json'
DRY = '--dry' in __import__('sys').argv
SITE = 'https://www.marketnow.site'

RISK_EXPLAIN = {
    'red': 'installing runs registry code on every start (npx/uvx) — flagged for review-before-install, not a verdict against your project',
    'yellow': 'installs from source or a registry-verified remote — reviewable/sandboxed surface',
    'green': 'verified trust chain',
}

def http_json(url, headers=None, timeout=15, method='GET', data=None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, json.loads(r.read().decode())

def gh_remaining():
    try:
        _, d = http_json('https://api.github.com/rate_limit',
                         {'Authorization': f'Bearer {GH_TOKEN}', 'User-Agent': 'marketnow-outreach'})
        return d['resources']['core']['remaining']
    except Exception:
        return 0

# ── 1. verificación de superficie propia (página + badge vivos) ──────────
def our_page_ok(slug):
    try:
        req = urllib.request.Request(f'{SITE}/s/{slug}', method='HEAD',
                                     headers={'User-Agent': 'outreach-check'})
        with urllib.request.urlopen(req, timeout=12) as r:
            return r.status == 200
    except Exception:
        return False

def our_badge_ok(slug):
    try:
        req = urllib.request.Request(f'{SITE}/api/badge/{slug}.svg', method='HEAD',
                                     headers={'User-Agent': 'outreach-check'})
        with urllib.request.urlopen(req, timeout=12) as r:
            return r.status == 200
    except Exception:
        return False

def stars_shields(owner_repo):
    try:
        _, d = http_json(f'https://img.shields.io/github/stars/{owner_repo}.json', timeout=10)
        v = str(d.get('value', '')).replace(',', '').replace('k', '')
        return v
    except Exception:
        return '?'

# ── 2. cargar state ──────────────────────────────────────────────────────
try:
    state = json.load(open(STATE))
except Exception:
    state = {'done': [], 'failed': []}

def issue_body(t):
    badge_md = f'[![MarketNow trust](https://www.marketnow.site/api/badge/{t["slug"]}.svg)](https://www.marketnow.site/s/{t["slug"]})'
    return f"""Hi @{t['owner']} 👋

**[{t['name'] or t['repo']}]({t['repo_url']})** is indexed in [MarketNow](https://www.marketnow.site) — an MCP server directory that scores **security and evidence first**, not popularity.

Your current public profile:

| | |
|---|---|
| Public page | https://www.marketnow.site/s/{t['slug']} |
| Trust score | **{t['trust']}/100** (evidence-based: repo activity, adoption signals, registry data) |
| Install risk | **{t['risk']}** — {RISK_EXPLAIN.get(t['risk'], '')} |
| GitHub stars (at verification) | {stars_shields(t['owner'] + '/' + t['repo'])} |

**Free badge for your README** (live SVG, updates automatically):

```md
{badge_md}
```

{badge_md}

If you want the score to reflect something we missed (new release, security posture, adoption data), reply here or open a correction at the [public certification report](https://www.marketnow.site/api/certification) — our scoring methodology and raw deep-scan findings (29 Sentinel rules over shipped tarballs) are public, including the uncomfortable ones.

Not affiliated with you, no paid placement — this is an automated index of public registries/GitHub. Want it removed? Reply here or email info@alicelabs.site and we'll take it down.

— [MarketNow](https://www.marketnow.site) · security-first MCP directory ({json.load(open('/home/z/my-project/uta-repo/marketnow/aep-marketplace/public/api/catalog-meta.json'))['total_all']:,} tracked) · by AliceLabs LLC"""

# ── 3. enviar ────────────────────────────────────────────────────────────
results = []
sent = 0
for t in TARGETS:
    full = f"{t['owner']}/{t['repo']}"
    if full in state['done']:
        print(f'  = ya enviado: {full}')
        continue
    rem = gh_remaining()
    if rem < 5:
        print(f'  ⚠ rate limit bajo ({rem}) — abortando limpio, reanudable')
        break
    if not our_page_ok(t['slug']) or not our_badge_ok(t['slug']):
        state['failed'].append({'repo': full, 'reason': 'page/badge no responde 200'})
        print(f'  ✗ SKIP {full}: /s/ o badge no viven')
        continue
    title = 'Your MCP server is indexed on MarketNow — free trust badge for your README'
    if DRY:
        print(f'  [DRY] {full}: trust={t["trust"]} risk={t["risk"]} page OK')
        continue
    try:
        _, d = http_json(
            f'https://api.github.com/repos/{full}/issues',
            {'Authorization': f'Bearer {GH_TOKEN}', 'Accept': 'application/vnd.github+json',
             'Content-Type': 'application/json', 'User-Agent': 'marketnow-outreach'},
            method='POST', data=json.dumps({'title': title, 'body': issue_body(t)}).encode(),
            timeout=20)
        state['done'].append(full)
        results.append({'repo': full, 'issue': d.get('html_url'), 'ok': True})
        sent += 1
        print(f"  ✓ #{d.get('number'):>5} {full}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:200]
        state['failed'].append({'repo': full, 'reason': f'HTTP {e.code}: {body}'})
        print(f'  ✗ {full}: HTTP {e.code} — {body[:120]}')
        if e.code == 403:
            print('  ⛔ rate limit/abuse — parando')
            break
    time.sleep(4)  # cortesía anti-burst

json.dump(state, open(STATE, 'w'), indent=1)
json.dump(results, open(REPORT, 'w'), indent=1)
print(f'\nenviados esta corrida: {sent} | total done: {len(state["done"])}/{len(TARGETS)} | fallos: {len(state["failed"])}')
