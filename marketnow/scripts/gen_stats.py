#!/usr/bin/env python3
r"""
gen_stats.py — ÚNICA FUENTE DE VERDAD de las métricas de MarketNow.

Lee el catálogo real (aep-marketplace/public/api/search-index.json) y los
contadores de _data/, y genera:
  - marketnow/_data/stats.json   (machine-readable)
  - marketnow/STATS.md           (tabla humana)

REGLA: ningún archivo de copy debe inventar cifras. Si el catálogo cambia,
vuelve a correr:  python3 marketnow/scripts/gen_stats.py
"""
import json
import os
import sys
from datetime import datetime, timezone

MARKET = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # marketnow/
AEP = os.path.join(MARKET, 'aep-marketplace')
CATALOG = os.path.join(AEP, 'public', 'api', 'search-index.json')


def count_dir(path):
    try:
        return len([f for f in os.listdir(path) if f.endswith('.json')])
    except FileNotFoundError:
        return 0


def main():
    catalog = json.load(open(CATALOG, encoding='utf-8'))
    indexed = len(catalog)
    categories = len(set(e.get('c', '') for e in catalog))

    # scanned = entradas con sentinel_score > 0 en skills-lite.json
    lite_path = os.path.join(AEP, 'public', 'api', 'skills-lite.json')
    try:
        lite = json.load(open(lite_path, encoding='utf-8'))
        scanned = sum(1 for e in lite if e.get('sentinel_score') not in (None, 0, '0'))
    except Exception:
        scanned = 0

    stats = {
        'last_updated': datetime.now(timezone.utc).strftime('%B %d, %Y'),
        'last_updated_iso': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'source': 'aep-marketplace/public/api/search-index.json',
        'indexed_mcp_skills': indexed,
        'free_to_install': indexed,
        'paid_skills': 0,
        'pricing_model': 'free',
        'categories': categories,
        'sentinel_scanned': scanned,
        'sentinel_certificates': count_dir(os.path.join(MARKET, '_data', 'sentinel_certificates')),
        'l2_sandbox_results': count_dir(os.path.join(MARKET, '_data', 'l2_results')),
        'l3_results': count_dir(os.path.join(MARKET, '_data', 'l3_results')),
        'human_reviewed': 0,
        'maintainer_verified': 0,
        'npm_downloads': None,
        'active_installations': None,
        'paying_customers': 0,
        'note': 'Single source of truth. Regenerate with: python3 marketnow/scripts/gen_stats.py',
    }

    out_json = os.path.join(MARKET, '_data', 'stats.json')
    os.makedirs(os.path.dirname(out_json), exist_ok=True)
    json.dump(stats, open(out_json, 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2)

    def fmt(v):
        return f'{v:,}' if isinstance(v, int) else (str(v) if v is not None else 'TBD')

    md = f"""# MarketNow — Stats (Single Source of Truth)

> Last updated: {stats['last_updated']}

| Metric | Value |
|---|---|
| Indexed MCP skills | {fmt(indexed)} |
| Free to install | {fmt(indexed)} (all of them) |
| Paid skills | 0 — **everything is free, forever** |
| Categories | {fmt(categories)} |
| Sentinel scanned | {fmt(scanned)} |
| Sentinel certificates issued | {fmt(stats['sentinel_certificates'])} |
| L2 sandbox results | {fmt(stats['l2_sandbox_results'])} |
| L3 results | {fmt(stats['l3_results'])} |
| Human reviewed | {fmt(stats['human_reviewed'])} |
| Maintainer verified | {fmt(stats['maintainer_verified'])} |
| npm downloads | {stats['npm_downloads'] or 'TBD'} |
| Active installations | {stats['active_installations'] or 'TBD'} |
| Paying customers | 0 — nothing is for sale |

**Reglas:**

1. Esta tabla es la ÚNICA fuente de cifras permitida en copy, READMEs, meta tags y APIs.
2. Los certificados Sentinel (`_data/sentinel_certificates/`) son artefactos firmados:
   sus cifras son fotografías históricas y NO se editan.
3. Para regenerar tras cambios del catálogo:
   `python3 marketnow/scripts/gen_stats.py`
4. Fuente: `{stats['source']}` (generado {stats['last_updated_iso']}).
"""
    open(os.path.join(MARKET, 'STATS.md'), 'w', encoding='utf-8').write(md)
    print('OK stats.json + STATS.md generados')
    print(json.dumps(stats, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
