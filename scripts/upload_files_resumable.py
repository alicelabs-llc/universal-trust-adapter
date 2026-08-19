#!/usr/bin/env python3
"""
Upload files in chunks with state persistence.
Resumable: if interrupted, re-run and it skips already-uploaded files.
"""
import json
import hashlib
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

TOKEN = open('/home/z/my-project/.vercel-token').read().strip()
TEAM_ID = "team_DmoZusxMIKcqJhgRBmQ8B3dK"
REPO = Path('/home/z/my-project/marketnow/aep-marketplace')

STATE_FILE = Path('/home/z/my-project/uploaded_aep_files.json')

# Files we want to deploy
SKIP = ['node_modules/', '.git/', 'package-lock.json', '.npmrc', '.env',
        '.DS_Store', 'CONCURRENCY_AUDIT.md', 'PROMO_SUBMISSIONS.md',
        'PR_AWESOME_MCP.md', 'README_MARKETFIX1.md', 'SUBMIT.md',
        'auto_pages_domain.cjs', 'eslint.config.js', 'load_kv.bat',
        'scan_and_package.cjs', 'scan_fast.cjs', 'scan_medium.cjs', 'scan_verify.cjs',
        'test_head.html', 'test_response.html', 'test_response2.html',
        'test_routes.mjs', 'test_verify.html', 'upload.bat', 'generate_skills.cjs']

def should_skip(p):
    return any(s in p for s in SKIP)


def collect_files():
    """Collect ONLY the files needed for Vercel build:
    - vercel.json (config)
    - package.json + package-lock.json
    - api/ (lambdas)
    - lib/ (shared modules for lambdas)
    - public/ (static files served at root, BEFORE build)
    - src/ (source files for vite build)
    - sentinel-rules/ (used by lambdas)
    - mcp-server/ (publishable package)
    - .well-known/ (RFC 8615)
    - _headers, _routes.json, index.html, mcp.json

    SKIP dist/ — Vercel will build it itself from src/ + public/.
    """
    files = []
    for root_dir in ['api', 'lib', 'public', 'src', 'sentinel-rules',
                     'mcp-server', '.well-known']:
        rp = REPO / root_dir
        if not rp.exists():
            continue
        for p in rp.rglob('*'):
            if p.is_file():
                rel = str(p.relative_to(REPO))
                if not should_skip(rel):
                    files.append(p)

    # Top-level config files
    for fn in ['vercel.json', 'package.json', 'package-lock.json',
               '_headers', '_routes.json', 'index.html', 'mcp.json',
               'eslint.config.js']:
        p = REPO / fn
        if p.exists() and not should_skip(fn):
            files.append(p)

    # Filter out files larger than 50MB (Vercel limit per file)
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
    files = [f for f in files if f.stat().st_size <= MAX_FILE_SIZE]

    return files


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
    # 3 retries with exponential backoff
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                json.loads(r.read())
            return deploy_path, sha, size, None
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8', errors='replace')[:200]
            if e.code == 429:  # rate limit
                time.sleep(2 ** attempt)
                continue
            return deploy_path, None, 0, f"HTTP {e.code}: {err_body}"
        except Exception as e:
            if attempt < 2:
                time.sleep(2 ** attempt)
                continue
            return deploy_path, None, 0, str(e)
    return deploy_path, None, 0, "max retries exceeded"


def main():
    # Load existing state (resume)
    uploaded = []
    uploaded_set = set()
    if STATE_FILE.exists():
        uploaded = json.loads(STATE_FILE.read_text())
        uploaded_set = {f["sha"] for f in uploaded}
        print(f"Resuming: {len(uploaded)} files already uploaded")

    # Collect
    print("Collecting files...")
    files = collect_files()
    total_size = sum(f.stat().st_size for f in files)
    print(f"Total: {len(files)} files, {total_size/1024/1024:.1f} MB")

    # Filter out already uploaded (by SHA)
    pending = []
    for f in files:
        content = f.read_bytes()
        sha = hashlib.sha1(content).hexdigest()
        if sha not in uploaded_set:
            pending.append(f)
    print(f"Already uploaded: {len(files) - len(pending)}")
    print(f"Pending: {len(pending)} files")

    if not pending:
        print("\n✅ All files already uploaded!")
        return 0

    # Upload in parallel
    print(f"\n=== Uploading {len(pending)} files (parallel, 20 workers) ===")
    start = time.time()
    failed = []
    new_uploads = 0

    with ThreadPoolExecutor(max_workers=20) as ex:
        futures = {ex.submit(upload, f): f for f in pending}
        for i, fut in enumerate(as_completed(futures), 1):
            deploy_path, sha, size, err = fut.result()
            if err:
                failed.append((deploy_path, err))
            else:
                uploaded.append({"file": deploy_path, "sha": sha, "size": size})
                uploaded_set.add(sha)
                new_uploads += 1

            if i % 50 == 0:
                elapsed = time.time() - start
                rate = i / elapsed if elapsed > 0 else 0
                print(f"  {i}/{len(pending)} ({rate:.1f}/s, {len(failed)} failed, {new_uploads} new)", flush=True)
                # Save state periodically
                STATE_FILE.write_text(json.dumps(uploaded, indent=2))

    # Final state save
    STATE_FILE.write_text(json.dumps(uploaded, indent=2))
    elapsed = time.time() - start
    print(f"\n=== Upload complete in {elapsed:.1f}s ===")
    print(f"Total uploaded: {len(uploaded)}")
    print(f"Failed: {len(failed)}")
    if failed:
        print("First 5 failures:")
        for path, err in failed[:5]:
            print(f"  {path}: {err[:80]}")

    return 0 if not failed else 1


if __name__ == '__main__':
    sys.exit(main())
