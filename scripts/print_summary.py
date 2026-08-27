#!/usr/bin/env python3
"""Print service status summary for GitHub Actions step summary."""
import json
from pathlib import Path

ICONS = {'operational': '✅', 'degraded': '⚠️', 'down': '❌'}

path = Path('download/status/status.json')
if not path.exists():
    print('(status.json not found)')
    raise SystemExit(0)

with path.open() as f:
    d = json.load(f)

for s in d.get('services', []):
    icon = ICONS.get(s['status'], '?')
    name = s['name']
    status = s['status']
    latency = s.get('latency_ms', '?')
    uptime = s.get('uptime_90d', '?')
    print(f'{icon} **{name}** — {status} ({latency}ms, {uptime}% uptime)')
