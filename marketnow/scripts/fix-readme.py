#!/usr/bin/env python3
# Fix ALL outdated info in README.md
import re

with open('/home/z/my-project/marketnow/README.md', 'r') as f:
    content = f.read()

replacements = [
    # Canonical metadata table
    ('Every one of 7,156 MCP servers is audited by Sentinel (3-layer pipeline: L1.5 metadata + L1.6 Semgrep/secrets/OSV + L2 Docker sandbox)',
     'Every one of 8,764 MCP servers is audited by Sentinel (6-layer pipeline: L1.5 metadata + L1.6 Semgrep/secrets/OSV + L2 active probe + L2.5 gVisor sandbox)'),
    # Total skills
    ('| **Total skills** | 7,156 |', '| **Total skills** | 8,764 |'),
    ('| **Certified skills** | 7,156 (100%) |', '| **Certified skills** | 8,764 (100%) |'),
    ('| **Categories** | 61 |', '| **Categories** | 23 |'),
    # Sentinel layers row
    ('| **Sentinel layers** | L1.5 (6 metadata checks) + L1.6 (18 Semgrep rules + 18 secret patterns + OSV API) + L2 (Docker sandbox: --network none, --read-only, --cap-drop ALL) |',
     '| **Sentinel layers** | L1.5 (6 metadata checks) + L1.6 (18 Semgrep rules + 18 secret patterns + OSV API) + L2 v2.0 (active MCP probe, 60+ adversarial inputs) + L2.5 (gVisor sandbox: --runtime=runsc, userspace kernel) + L3 (Firecracker microVM, Q1 2027) + L4 (supply chain attestation, Q4 2026) + L5 (third-party audit, Q3 2027) |'),
    # 3-layer → 6-layer
    ('Every skill in MarketNow is audited by Sentinel, a 3-layer security pipeline:',
     'Every skill in MarketNow is audited by Sentinel, a 6-layer security pipeline:'),
    # L2 section heading and description
    ('### L2 — Docker Sandbox (async via GitHub Actions)',
     '### L2 v2.0 — Active MCP Probe + Docker Sandbox (async via GitHub Actions)\n\nL2.5 adds gVisor (runsc) userspace kernel isolation on top of Docker. The MCP server never touches the host kernel.'),
    # L2 coverage line
    ('**L2 coverage**: 17 of 7,156 skills (0.2%) have L2 Docker sandbox results. The remaining 8,565 are certified with L1.5+L1.6 (static analysis). L2 coverage grows as more skills get `source.url` populated — L2 requires a GitHub repo to clone and run in the sandbox.',
     '**L2 coverage**: 206 of 8,764 skills have L2.5 gVisor sandbox results. The remaining 8,558 are certified with L1.5+L1.6 (static analysis). L2 coverage grows weekly via automated GitHub Actions.'),
    # Stats table
    ('| Total skills | 7,156 |', '| Total skills | 8,764 |'),
    ('| Certified skills | 7,156 (100%) |', '| Certified skills | 8,764 (100%) |'),
    ('| L2 sandbox runs | 17 |', '| L2.5 sandbox runs | 206 |'),
    # Search line
    ('Search 7,156 certified skills by query, category, or language',
     'Search 8,764 certified skills by query, category, or language'),
    # Community tier
    ('Browse all 7,156 skills, install free skills, basic search',
     'Browse all 8,764 skills, install free skills, basic search'),
    # API table
    ('All 7,156 skills (bulk download)', 'All 8,764 skills (bulk download)'),
    # Sentinel audit endpoint
    ('Run Sentinel L1.5+L1.6+L2 real-time audit', 'Run Sentinel L1.5+L1.6+L2+L2.5 real-time audit'),
    # Patent pending line
    ('**Patent pending** on the 3-layer audit pipeline design (L1.5 → L1.6 → L2).',
     '**Patent pending** on the 6-layer audit pipeline design (L1.5 → L1.6 → L2 → L2.5 → L3 → L4 → L5).'),
]

count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
        count += 1
    else:
        print(f'WARNING: not found: {old[:60]}...')

with open('/home/z/my-project/marketnow/README.md', 'w') as f:
    f.write(content)

print(f'\\n✓ Applied {count}/{len(replacements)} replacements to README.md')
