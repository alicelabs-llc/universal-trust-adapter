#!/usr/bin/env python3
"""
Task 47a: elimina TODOS los conteos stale '9,248' del sitio (el usuario lo vio
en la homepage). Reemplaza por 66,496 en todos los formatos locales, corrige el
overclaim del JSON-LD y actualiza las 2 entradas auto-referenciales del índice.
Idempotente: si no quedan 9,248, no cambia nada.
"""
import re, json, os

BASE = '/home/z/my-project/uta-repo/marketnow/aep-marketplace'
NEW = '66,496'

# ── 1. Reemplazo global de strings en código fuente ──────────────────────
targets = []
for root, dirs, files in os.walk(os.path.join(BASE, 'src')):
    dirs[:] = [d for d in dirs if d != 'node_modules']
    for f in files:
        if f.endswith(('.js', '.jsx')):
            targets.append(os.path.join(root, f))
targets.append(os.path.join(BASE, 'index.html'))

# variantes por locale: coma (en/es/pt/zh/fr/hi/ja/ko/ar), punto (de/it/tr), espacio (ru)
PATTERNS = [('9,248', '66,496'), ('9.248', '66.496'), ('9 248', '66 496')]

changed = {}
for path in targets:
    try:
        with open(path, encoding='utf-8') as fh:
            src = fh.read()
    except Exception as e:
        print(f'  SKIP {path}: {e}')
        continue
    orig = src
    for old, new in PATTERNS:
        # evita falsos positivos tipo '19.248' o '1,9,248': exige no-dígito antes
        src = re.sub(r'(?<![\d.])' + re.escape(old), new, src)
    if src != orig:
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(src)
        rel = os.path.relpath(path, BASE)
        changed[rel] = src.count('66,496') + src.count('66.496') + src.count('66 496')

print(f'archivos modificados: {len(changed)}')
for k, v in sorted(changed.items()):
    print(f'  {k} ({v} ocurrencias nuevas)')

# ── 2. JSON-LD del index.html: overclaim 'each security-audited' ─────────
idx = os.path.join(BASE, 'index.html')
with open(idx, encoding='utf-8') as fh:
    html = fh.read()
OLD_DESC = ('Security infrastructure for AI agents. 66,496 MCP skills, each security-audited '
            'by Sentinel v3.0 (12-stage audit incl. gVisor sandbox). AliceLabs LLC.')
NEW_DESC = ('Security infrastructure for AI agents. 66,496 indexed MCP servers with documented '
            'install-risk and evidence-based trust scores; top packages deep-scanned with the 29 '
            'Sentinel rules; 130,845 tracked across the ecosystem. AliceLabs LLC.')
if OLD_DESC in html:
    html = html.replace(OLD_DESC, NEW_DESC)
    with open(idx, 'w', encoding='utf-8') as fh:
        fh.write(html)
    print('JSON-LD index.html: overclaim corregido')
else:
    print('JSON-LD: ya correcto o formato distinto (revisar manualmente)')

# ── 3. Entradas auto-referenciales del índice certificado ────────────────
IDX = os.path.join(BASE, 'public', 'api', 'skills_index.json')
with open(IDX, encoding='utf-8') as fh:
    data = json.load(fh)
fixed_entries = 0
for s in data:
    d = s.get('description') or ''
    if '9,248' in d:
        s['description'] = d.replace('9,248', '66,496')
        fixed_entries += 1
    # overclaim de las self-entries
    d2 = s.get('description') or ''
    if 'Sentinel v3.0 security audits' in d2 and 'real-marketnow' == s.get('slug'):
        s['description'] = d2.replace(
            '66,496 MCP skills, all free to install. Sentinel v3.0 security audits, AP2 mandates.',
            '66,496 indexed MCP servers, all free to install. Install-risk model, evidence-based '
            'trust scores and 29-rule Sentinel deep-scans on top packages. AP2 mandates.')
if fixed_entries:
    with open(IDX, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False)
    print(f'skills_index.json: {fixed_entries} entradas auto-referenciales actualizadas')
else:
    print('skills_index.json: sin entradas con 9,248')

# ── 4. Verificación final ────────────────────────────────────────────────
resid = []
for path in targets:
    with open(path, encoding='utf-8') as fh:
        c = fh.read()
    for old, _ in PATTERNS:
        if re.search(r'(?<![\d.])' + re.escape(old), c):
            resid.append(os.path.relpath(path, BASE))
print('residuos 9,248:', resid if resid else 'NINGUNO ✓')
