#!/usr/bin/env python3
"""
Force-upload the critical files we need: package.json, package-lock.json, _headers,
index.html, mcp.json. Also retry any other failed files.
"""
import json
import hashlib
import time
import urllib.request
import urllib.error
from pathlib import Path

TOKEN = open('/home/z/my-project/.vercel-token').read().strip()
TEAM_ID = "team_DmoZusxMIKcqJhgRBmQ8B3dK"
REPO = Path('/home/z/my-project/marketnow/aep-marketplace')

STATE_FILE = Path('/home/z/my-project/uploaded_aep_files.json')

# Critical files that MUST be uploaded
CRITICAL_FILES = [
    'package.json',
    'package-lock.json',
    'vercel.json',
    '_headers',
    '_routes.json',
    'index.html',
    'mcp.json',
    'eslint.config.js',
    'generate_skills.cjs',  # Required by prebuild script!
    'public/.well-known/agent.json',
    'public/api/agent.json',
    'public/robots.txt',
    'public/sitemap.xml',
]

def upload(local_path: Path):
    content = local_path.read_bytes()
    size = len(content)
    sha = hashlib.sha1(content).hexdigest()
    deploy_path = str(local_path.relative_to(REPO))

    url = f"https://api.vercel.com/v2/files?teamId={TEAM_ID}"
    req = urllib.request.Request(
        url, data=content,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/octet-stream",
            "x-vercel-digest": sha,
            "Content-Length": str(size),
        },
        method="POST",
    )
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                json.loads(r.read())
            return deploy_path, sha, size, None
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 2 ** attempt
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            err = e.read().decode('utf-8', errors='replace')[:200]
            return deploy_path, None, 0, f"HTTP {e.code}: {err}"
        except Exception as e:
            if attempt < 4:
                time.sleep(2)
                continue
            return deploy_path, None, 0, str(e)
    return deploy_path, None, 0, "max retries"

# Load existing state
uploaded = json.loads(STATE_FILE.read_text())
uploaded_shas = {f["sha"] for f in uploaded}
print(f"Already uploaded: {len(uploaded)}")

# Upload critical files one by one (not in parallel — to avoid rate limit)
print(f"\n=== Uploading {len(CRITICAL_FILES)} critical files (sequential) ===")
new_uploads = 0
for fname in CRITICAL_FILES:
    path = REPO / fname
    if not path.exists():
        print(f"  SKIP {fname} (not found locally)")
        continue
    content = path.read_bytes()
    sha = hashlib.sha1(content).hexdigest()
    if sha in uploaded_shas:
        print(f"  ✓ {fname} already uploaded")
        continue
    print(f"  Uploading {fname} ({len(content)} bytes)...")
    deploy_path, up_sha, size, err = upload(path)
    if err:
        print(f"    ❌ FAIL: {err}")
    else:
        uploaded.append({"file": fname, "sha": sha, "size": size})
        uploaded_shas.add(sha)
        new_uploads += 1
        print(f"    ✅ OK")
    time.sleep(0.5)  # avoid rate limit

# Save state
STATE_FILE.write_text(json.dumps(uploaded, indent=2))
print(f"\n=== Done. New uploads: {new_uploads}. Total: {len(uploaded)} ===")
