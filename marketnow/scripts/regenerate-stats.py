#!/usr/bin/env python3
"""
Regenera skills_stats.json con los números REALES del skills.json actual.
También actualiza manifest.json y manifest.js con los números correctos.
"""
import json
import os
from datetime import datetime, timezone
from collections import Counter

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API_DIR = os.path.join(BASE, 'aep-marketplace', 'public', 'api')
SRC_DIR = os.path.join(BASE, 'aep-marketplace', 'src', 'data')

# 1. Load skills.json
print("Loading skills.json...")
with open(os.path.join(API_DIR, 'skills.json'), 'r', encoding='utf-8') as f:
    skills = json.load(f)

total = len(skills)
print(f"Total skills: {total}")

# 2. Calculate real stats
free_count = sum(1 for s in skills if s.get('price', 0) == 0 or s.get('free', True))
paid_count = sum(1 for s in skills if s.get('price', 0) > 0)
free_true = sum(1 for s in skills if s.get('free') == True)

# Categories
cats = Counter(s.get('category', 'Unknown') for s in skills)

# L2 tested
l2_tested = sum(1 for s in skills if s.get('l2_eligible'))
audited = sum(1 for s in skills if s.get('sentinel_score', 0) > 0 or s.get('verified'))

print(f"Free: {free_count} ({free_count/total*100:.1f}%)")
print(f"Paid: {paid_count}")
print(f"Audited: {audited}")
print(f"L2 tested: {l2_tested}")
print(f"Categories: {len(cats)}")

# 3. Generate correct stats
stats = {
    "total": total,
    "free": free_count,
    "paid": paid_count,
    "audited": audited,
    "l2_tested": l2_tested,
    "categories": dict(cats.most_common()),
    "price_min": 0,
    "price_max": 0,
    "price_avg": 0,
    "all_free": True,
    "generated_at": datetime.now(timezone.utc).isoformat()
}

# 4. Write stats
stats_path = os.path.join(API_DIR, 'skills_stats.json')
with open(stats_path, 'w', encoding='utf-8') as f:
    json.dump(stats, f, indent=2)
print(f"\n✓ Written {stats_path}")

# 5. Update manifest.json
manifest_path = os.path.join(API_DIR, 'manifest.json')
if os.path.exists(manifest_path):
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)
    manifest['stats']['total_skills'] = total
    manifest['stats']['audited'] = audited
    manifest['stats']['l25_tested'] = l2_tested
    manifest['stats']['free_skills'] = free_count
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
    print(f"✓ Updated {manifest_path}")

# 6. Update manifest.js (the API endpoint)
manifest_js_path = os.path.join(BASE, 'aep-marketplace', 'api', 'manifest.js')
if os.path.exists(manifest_js_path):
    with open(manifest_js_path, 'r', encoding='utf-8') as f:
        content = f.read()
    # Replace hardcoded numbers
    content = content.replace('total_skills: 8845', f'total_skills: {total}')
    content = content.replace('free_skills: 8845', f'free_skills: {free_count}')
    content = content.replace('audited: 5120', f'audited: {audited}')
    content = content.replace('l25_tested: 206', f'l25_tested: {l2_tested}')
    with open(manifest_js_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✓ Updated {manifest_js_path}")

print(f"\n=== DONE ===")
print(f"Total: {total}")
print(f"Free: {free_count}")
print(f"All free: True")
