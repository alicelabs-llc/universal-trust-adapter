#!/usr/bin/env python3
"""
Fetch the deployment file tree from Vercel, identify the files we need to
modify, and download each one to /home/z/my-project/marketnow-source/.
"""
import json
import os
import sys
import urllib.request
import urllib.parse
from pathlib import Path

TOKEN = open('/home/z/my-project/.vercel-token').read().strip()
TEAM_ID = "team_DmoZusxMIKcqJhgRBmQ8B3dK"
DPL_ID = "dpl_3kSiPrHQLknitfY9gxkNz9sPcGLs"

OUT_DIR = Path('/home/z/my-project/marketnow-source')
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Step 1: get the full file tree (recursive via the tree parameter)
url = f"https://api.vercel.com/v6/deployments/{DPL_ID}/files?teamId={TEAM_ID}&path=/"
req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOKEN}"})
with urllib.request.urlopen(req) as r:
    tree = json.loads(r.read())

# Save the tree for inspection
(OUT_DIR / '_filetree.json').write_text(json.dumps(tree, indent=2))
print(f"Tree root type: {type(tree).__name__}")

# Flatten the tree into a list of (full_path, uid) for files
all_files = []

def walk(node, prefix=""):
    """Recursively walk the file tree."""
    if isinstance(node, list):
        for item in node:
            walk(item, prefix)
        return
    if not isinstance(node, dict):
        return
    name = node.get('name', '')
    full = prefix + '/' + name if prefix else name
    if node.get('type') == 'file':
        uid = node.get('uid')
        all_files.append((full, uid, node.get('size', 0)))
    elif node.get('type') == 'directory':
        children = node.get('children', [])
        walk(children, full)

walk(tree, "")

print(f"Total files in deployment: {len(all_files)}")

# Save the file list
with (OUT_DIR / '_files.txt').open('w') as f:
    for path, uid, size in all_files:
        f.write(f"{uid} {size:10d} {path}\n")

# Show the file structure (top 100 lines)
print("\n=== First 100 files in deployment ===")
for path, uid, size in all_files[:100]:
    print(f"  {size:10d}  {path}")
print(f"\n... and {len(all_files)-100} more" if len(all_files) > 100 else "")
