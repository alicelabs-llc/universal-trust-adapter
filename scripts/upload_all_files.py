#!/usr/bin/env python3
"""
Upload ALL files in src/ directory that haven't been uploaded yet.
Also retry any failed files from previous runs.
"""
import json
import hashlib
import time
import urllib.request
import urllib.error
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

TOKEN = open('/home/z/my-project/.vercel-token').read().strip()
TEAM_ID = "team_DmoZusxMIKcqJhgRBmQ8B3dK"
REPO = Path('/home/z/my-project/marketnow/aep-marketplace')

STATE_FILE = Path('/home/z/my-project/uploaded_aep_files.json')


def upload(local_path: Path, deploy_path: str):
    content = local_path.read_bytes()
    size = len(content)
    sha = hashlib.sha1(content).hexdigest()

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
            with urllib.request.urlopen(req, timeout=120) as r:
                json.loads(r.read())
            return deploy_path, sha, size, None
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(2 ** attempt)
                continue
            err = e.read().decode('utf-8', errors='replace')[:200]
            return deploy_path, None, 0, f"HTTP {e.code}: {err}"
        except Exception as e:
            if attempt < 4:
                time.sleep(2)
                continue
            return deploy_path, None, 0, str(e)
    return deploy_path, None, 0, "max retries"


# Load state
uploaded = json.loads(STATE_FILE.read_text())
uploaded_shas = {f["sha"] for f in uploaded}
print(f"Already uploaded: {len(uploaded)}")

# Collect ALL files from aep-marketplace/ (everything)
all_local_files = []
for root_dir in ['api', 'lib', 'public', 'src', 'sentinel-rules', 'mcp-server',
                 '.well-known', 'scripts', 'tools']:
    rp = REPO / root_dir
    if not rp.exists():
        continue
    for p in rp.rglob('*'):
        if p.is_file():
            all_local_files.append(p)

# Top-level config and scripts
for fn in ['vercel.json', 'package.json', 'package-lock.json', '_headers', '_routes.json',
           'index.html', 'mcp.json', 'eslint.config.js', 'generate_skills.cjs',
           'auto_pages_domain.cjs', 'scan_and_package.cjs', 'scan_fast.cjs',
           'scan_medium.cjs', 'scan_verify.cjs', 'sentinel_bulk_scan.cjs',
           'sentinel_chunked.cjs', 'sentinel_results.json', 'server.json']:
    p = REPO / fn
    if p.exists():
        all_local_files.append(p)

print(f"Total local files: {len(all_local_files)}")

# Filter pending (not uploaded by SHA)
pending = []
for f in all_local_files:
    content = f.read_bytes()
    sha = hashlib.sha1(content).hexdigest()
    if sha not in uploaded_shas:
        pending.append((f, sha))

print(f"Pending: {len(pending)}")

if not pending:
    print("\n✅ All files uploaded!")
    exit(0)

# Upload in parallel with low concurrency (to avoid rate limit)
print(f"\n=== Uploading {len(pending)} files (parallel, 10 workers) ===")
start = time.time()
failed = []

with ThreadPoolExecutor(max_workers=10) as ex:
    futures = {}
    for f, sha in pending:
        deploy_path = str(f.relative_to(REPO))
        futures[ex.submit(upload, f, deploy_path)] = (f, sha, deploy_path)

    for i, fut in enumerate(as_completed(futures), 1):
        f, sha, deploy_path = futures[fut]
        result_path, up_sha, size, err = fut.result()
        if err:
            failed.append((deploy_path, err))
        else:
            uploaded.append({"file": deploy_path, "sha": sha, "size": size})
            uploaded_shas.add(sha)

        if i % 20 == 0:
            elapsed = time.time() - start
            STATE_FILE.write_text(json.dumps(uploaded, indent=2))
            print(f"  {i}/{len(pending)} ({len(failed)} failed)", flush=True)

# Save state
STATE_FILE.write_text(json.dumps(uploaded, indent=2))
elapsed = time.time() - start
print(f"\n=== Done in {elapsed:.1f}s ===")
print(f"Total uploaded: {len(uploaded)}")
print(f"Failed: {len(failed)}")
if failed:
    print("First 5 failures:")
    for p, e in failed[:5]:
        print(f"  {p}: {e[:80]}")
