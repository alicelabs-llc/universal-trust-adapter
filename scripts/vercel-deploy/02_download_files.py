#!/usr/bin/env python3
"""
Download key files from the latest Vercel deployment to /home/z/my-project/marketnow-source/.

Files to download:
  - src/public/.well-known/agent.json → /home/z/my-project/marketnow-source/agent.json
  - src/public/api/manifest.json       → /home/z/my-project/marketnow-source/manifest.json
  - src/dist/api/manifest.json         → (same content, sanity check)
  - src/public/robots.txt              → /home/z/my-project/marketnow-source/robots.txt
  - src/public/sitemap.xml             → /home/z/my-project/marketnow-source/sitemap.xml
  - src/package.json                   → /home/z/my-project/marketnow-source/package.json
  - src/README.md                      → /home/z/my-project/marketnow-source/README.md
  - src/index.html                     → /home/z/my-project/marketnow-source/index.html
  - src/dist/index.html                → /home/z/my-project/marketnow-source/dist-index.html
  - src/dist/.well-known/agent.json    → (same as src/public/.well-known/agent.json)
"""
import json
import urllib.request
import urllib.parse
from pathlib import Path

TOKEN = open('/home/z/my-project/.vercel-token').read().strip()
TEAM_ID = "team_DmoZusxMIKcqJhgRBmQ8B3dK"
DPL_ID = "dpl_3kSiPrHQLknitfY9gxkNz9sPcGLs"

OUT_DIR = Path('/home/z/my-project/marketnow-source')
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Map: deployment_path → local_filename
FILES_TO_DOWNLOAD = {
    # Primary agent.json (live in production at /api/agent.json, served from public/.well-known)
    "src/public/.well-known/agent.json":   "agent.json",
    # Also grab dist/.well-known/agent.json to check if it's a duplicate
    "src/dist/.well-known/agent.json":     "dist-agent.json",
    # manifest.json (was returning 404 in production — finding F7 root cause)
    "src/public/api/manifest.json":         "manifest.json",
    "src/dist/api/manifest.json":           "dist-manifest.json",
    # package.json (npm metadata)
    "src/package.json":                    "package.json",
    # README
    "src/README.md":                       "README.md",
    # robots.txt
    "src/public/robots.txt":               "robots.txt",
    "src/dist/robots.txt":                 "dist-robots.txt",
    # sitemap
    "src/public/sitemap.xml":              "sitemap.xml",
    # Index HTML (landing)
    "src/index.html":                      "index.html",
    "src/dist/index.html":                 "dist-index.html",
    # README variants
    "src/README_MARKETFIX1.md":            "README_MARKETFIX1.md",
    "src/PROMO_SUBMISSIONS.md":           "PROMO_SUBMISSIONS.md",
    "src/SUBMIT.md":                      "SUBMIT.md",
    "src/PR_AWESOME_MCP.md":              "PR_AWESOME_MCP.md",
    # Verce config
    "src/vercel.json":                    "vercel.json",
    # Worker source
    "src/marketnow-worker/index.js":      "marketnow-worker-index.js",
    "src/marketnow-worker/wrangler.toml": "marketnow-worker-wrangler.toml",
    # dist assets (landing compiled)
    "src/dist/assets/index-CmfY9RkO.css": "dist-assets-index.css",
    "src/dist/assets/index-sh8tupor.js":  "dist-assets-index.js",
}

# Load the file tree to get the uids
tree = json.loads((OUT_DIR / '_filetree.json').read_text())

# Build a path → uid map
path_to_uid = {}

def walk(node, prefix=""):
    if isinstance(node, list):
        for item in node:
            walk(item, prefix)
        return
    if not isinstance(node, dict):
        return
    name = node.get('name', '')
    full = prefix + '/' + name if prefix else name
    # Normalize: deployment paths start with 'src/' from the tree root
    if node.get('type') == 'file':
        path_to_uid[full] = node.get('uid')
    elif node.get('type') == 'directory':
        walk(node.get('children', []), full)

walk(tree, "")

print(f"Indexed {len(path_to_uid)} files in the deployment tree")

# Download each requested file
def download_file(uid, local_path):
    """Download a file by its UID."""
    url = f"https://api.vercel.com/v6/files/{uid}?teamId={TEAM_ID}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOKEN}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            content = r.read()
        Path(local_path).write_bytes(content)
        return len(content)
    except Exception as e:
        print(f"  FAIL: {e}")
        return 0

print(f"\n=== Downloading {len(FILES_TO_DOWNLOAD)} files ===")
for deploy_path, local_name in FILES_TO_DOWNLOAD.items():
    uid = path_to_uid.get(deploy_path)
    if not uid:
        print(f"  SKIP  {deploy_path} (not found in tree)")
        continue
    local_path = OUT_DIR / local_name
    size = download_file(uid, local_path)
    print(f"  OK    {deploy_path:55s} → {local_name:35s} ({size:8d} bytes)")

print("\n=== Downloads complete ===")
print(f"Files saved in: {OUT_DIR}")
print("\nContents:")
for f in sorted(OUT_DIR.iterdir()):
    if not f.name.startswith('_'):
        print(f"  {f.stat().st_size:10d}  {f.name}")
