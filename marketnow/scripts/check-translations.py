#!/usr/bin/env python3
import re, sys
f = 'aep-marketplace/src/utils/translations.js'
try:
    with open(f, 'r') as fh:
        content = fh.read()
except FileNotFoundError:
    print(f'File not found: {f}'); sys.exit(1)
all_keys = re.findall(r"'([a-z_]+\.[a-z_]+)':", content)
unique_keys = set(all_keys)
languages = re.findall(r'const\s+(\w+)\s*=\s*\{', content)
print(f'Languages: {languages}')
print(f'Unique keys: {len(unique_keys)}')
sections = re.split(r'const\s+(\w+)\s*=\s*\{', content)
issues = []
if len(sections) > 1:
    for i in range(1, len(sections), 2):
        lang = sections[i]
        body = sections[i + 1] if i + 1 < len(sections) else ''
        lang_keys = set(re.findall(r"'([a-z_]+\.[a-z_]+)':", body))
        missing = unique_keys - lang_keys
        if missing:
            issues.append(f'{lang}: {len(missing)} missing')
        else:
            print(f'  ✅ {lang}: {len(lang_keys)} keys synced')
if issues:
    print('ISSUES:'); [print(f'  ❌ {i}') for i in issues]; sys.exit(1)
else:
    print('✅ All synced!'); sys.exit(0)
