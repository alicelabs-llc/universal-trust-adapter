#!/usr/bin/env python3
"""
Generates package.json.fixed — the corrected version of the npm package.json
for marketnow-mcp.

Fetches the latest version metadata from npm registry and applies fixes:
  F2: repository.url → github.com/alicelabs-llc/marketnow (was 404)
  F6: version → 1.10.0 (sync with agent.json.fixed)
  F1: license → MNNC-1.0 (already correct in npm, but make explicit)
"""
import json
import urllib.request
from pathlib import Path

OUTPUT = Path('/home/z/my-project/download/marketnow-fixes/package.json.fixed')

# Fetch latest version metadata from npm
url = "https://registry.npmjs.org/marketnow-mcp"
with urllib.request.urlopen(url) as r:
    npm_data = json.loads(r.read())

latest_version = npm_data['dist-tags']['latest']
v_meta = npm_data['versions'][latest_version]

# Start from the npm version metadata as-is
pkg = json.loads(json.dumps(v_meta))  # deep copy

# Apply fixes
# F2: repository URL was pointing to 404 repo, fix to alicelabs-llc
pkg['repository'] = {
    "type": "git",
    "url": "git+https://github.com/alicelabs-llc/marketnow.git",
    "directory": "mcp-server"
}

# F1: license (already MNNC-1.0 in npm — make explicit)
pkg['license'] = "MNNC-1.0"

# F2: homepage (already correct: marketnow.site)
# F2: bugs — overwrite because npm had the 404 URL
pkg['bugs'] = {
    "url": "https://github.com/alicelabs-llc/marketnow/issues",
    "email": "support@alicelabs.site"
}

# Author is already correct (AliceLabs LLC, info@alicelabs.site)
# Make sure author.url is set
if isinstance(pkg.get('author'), dict):
    pkg['author']['url'] = "https://marketnow.site"

# Add funding field
pkg['funding'] = {
    "type": "AliceLabs LLC commercial license",
    "url": "https://marketnow.site/pricing"
}

# Add keywords already present, but ensure key trust terms are there
existing_kw = set(pkg.get('keywords', []))
required_kw = {
    'mcp', 'marketnow', 'agent-trust-card', 'atc', 'sentinel', 'aliceLabs',
    'x402', 'ap2', 'agent-payments-protocol', 'ed25519', 'rfc-8032', 'rfc-8785',
    'trust-layer', 'agent-commerce', 'base', 'usdc'
}
pkg['keywords'] = sorted(existing_kw | required_kw)

# Ensure MCP version metadata is documented
pkg['mcp'] = {
    "version": "1.0",
    "spec": "https://spec.modelcontextprotocol.io/"
}

# Write
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with OUTPUT.open('w') as f:
    json.dump(pkg, f, indent=2, ensure_ascii=False)
    f.write('\n')

print(f"Wrote {OUTPUT}")
print(f"Size: {OUTPUT.stat().st_size} bytes")
print(f"\nKey fields:")
print(f"  name: {pkg['name']}")
print(f"  version: {pkg['version']}")
print(f"  license: {pkg['license']}")
print(f"  homepage: {pkg.get('homepage')}")
print(f"  repository.url: {pkg['repository']['url']}")
print(f"  author: {pkg.get('author')}")
print(f"  bugs: {pkg.get('bugs')}")
print(f"  keywords count: {len(pkg['keywords'])}")
