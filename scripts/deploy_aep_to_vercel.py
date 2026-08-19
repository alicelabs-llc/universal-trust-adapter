#!/usr/bin/env python3
"""
Deploy the fixed aep-marketplace to Vercel production.

Strategy:
1. Walk the dist/ + api/ + public/ + vercel.json
2. Upload each file to Vercel's /v2/files endpoint (gets a SHA back)
3. POST /v13/deployments with all SHAs + project name
4. Wait for READY
5. Production is live at marketnow.site (since project owns that domain)

We deploy to the existing project `aep-marketplace` (prj_Sof4OHAGytb75zBacYSrIFNXNnKy)
which already has marketnow.site assigned.

Total files: ~700-1000 (skills, ATC cards, etc.)
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
PROJ_ID = "prj_Sof4OHAGytb75zBacYSrIFNXNnKy"  # aep-marketplace, owns marketnow.site
PROJ_NAME = "aep-marketplace"

REPO = Path('/home/z/my-project/marketnow/aep-marketplace')

# Files to deploy (relative to aep-marketplace/):
# - dist/ (built static assets)
# - api/ (lambda functions)
# - public/ (static files served at root)
# - vercel.json (config)
# - package.json (project metadata)
# - _headers, _routes.json (Vercel/Cloudflare config)
# - .well-known/ etc.

# Skip these:
SKIP_PATTERNS = [
    'node_modules/',
    '.git/',
    'package-lock.json',
    '.npmrc',
    '.env',
    '.DS_Store',
    'CONCURRENCY_AUDIT.md',
    'PROMO_SUBMISSIONS.md',
    'PR_AWESOME_MCP.md',
    'README_MARKETFIX1.md',
    'SUBMIT.md',
    'auto_pages_domain.cjs',
    'eslint.config.js',
    'load_kv.bat',
    'scan_and_package.cjs',
    'scan_fast.cjs',
    'scan_medium.cjs',
    'scan_verify.cjs',
    'test_head.html',
    'test_response.html',
    'test_response2.html',
    'test_routes.mjs',
    'test_verify.html',
    'upload.bat',
    'generate_skills.cjs',
]

def should_skip(path_str):
    for pat in SKIP_PATTERNS:
        if pat in path_str:
            return True
    return False


def collect_files():
    """Collect all files to deploy."""
    files = []
    # Walk specific directories
    for root_dir in ['dist', 'api', 'public', 'lib', 'mcp-server', '.well-known',
                     'sentinel-rules', 'src']:
        root_path = REPO / root_dir
        if not root_path.exists():
            continue
        for path in root_path.rglob('*'):
            if path.is_file():
                rel = str(path.relative_to(REPO))
                if not should_skip(rel):
                    files.append(path)

    # Top-level files
    for filename in ['vercel.json', 'package.json', '_headers', '_routes.json',
                     'index.html', 'mcp.json']:
        path = REPO / filename
        if path.exists() and not should_skip(filename):
            files.append(path)

    return files


def upload_file(local_path: Path, deploy_path: str):
    """Upload a single file. Returns (sha, size, error)."""
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
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            json.loads(r.read())
        return sha, size, None
    except urllib.error.HTTPError as e:
        return None, 0, f"HTTP {e.code}: {e.read().decode('utf-8', errors='replace')[:200]}"
    except Exception as e:
        return None, 0, str(e)


def main():
    print("=== Collecting files to deploy ===")
    files = collect_files()
    print(f"Total files: {len(files)}")
    total_size = sum(f.stat().st_size for f in files)
    print(f"Total size: {total_size / 1024 / 1024:.1f} MB")
    print()

    # Upload all files in parallel
    print("=== Uploading files to Vercel (parallel) ===")
    uploaded = []
    failed = []
    start_time = time.time()

    with ThreadPoolExecutor(max_workers=20) as executor:
        futures = {}
        for path in files:
            deploy_path = str(path.relative_to(REPO))
            futures[executor.submit(upload_file, path, deploy_path)] = (path, deploy_path)

        for i, future in enumerate(as_completed(futures), 1):
            path, deploy_path = futures[future]
            sha, size, err = future.result()
            if err:
                failed.append((deploy_path, err))
                if len(failed) <= 5:
                    print(f"  ❌ FAIL {deploy_path}: {err[:100]}")
            else:
                uploaded.append({"file": deploy_path, "sha": sha, "size": size})

            if i % 50 == 0:
                elapsed = time.time() - start_time
                rate = i / elapsed if elapsed > 0 else 0
                print(f"  Progress: {i}/{len(files)} ({rate:.1f}/s, {len(failed)} failed)")

    print(f"\nUploaded: {len(uploaded)} files")
    print(f"Failed: {len(files) - len(uploaded)} files")
    if failed:
        print("First 5 failures:")
        for path, err in failed[:5]:
            print(f"  {path}: {err[:80]}")

    # Save upload state
    state_path = Path('/home/z/my-project/uploaded_aep_files.json')
    state_path.write_text(json.dumps(uploaded, indent=2))
    print(f"\nState saved to {state_path}")

    # Create deployment
    print("\n=== Creating deployment (PRODUCTION) ===")
    payload = {
        "name": PROJ_NAME,
        "files": uploaded,
        "projectSettings": {
            "framework": "vite",
            "buildCommand": "npm install && npm run build",
            "installCommand": "npm install",
            "outputDirectory": "dist",
        },
        "target": "production",
    }

    url = f"https://api.vercel.com/v13/deployments?teamId={TEAM_ID}&forceDeploy=1"
    body = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url, data=body,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            result = json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"❌ Deploy failed: HTTP {e.code}")
        print(e.read().decode('utf-8', errors='replace')[:2000])
        return 1
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1

    new_dpl_id = result.get('id')
    print(f"✅ Deployment created!")
    print(f"   id: {new_dpl_id}")
    print(f"   url: https://{result.get('url')}")
    print(f"   readyState: {result.get('readyState')}")
    print(f"   target: {result.get('target')}")

    # Wait for READY
    print("\n=== Waiting for deployment to be READY ===")
    for attempt in range(120):  # 10 minutes max
        time.sleep(5)
        status_url = f"https://api.vercel.com/v13/deployments/{new_dpl_id}?teamId={TEAM_ID}"
        sreq = urllib.request.Request(status_url, headers={"Authorization": f"Bearer {TOKEN}"})
        try:
            with urllib.request.urlopen(sreq, timeout=30) as r:
                status = json.loads(r.read())
        except Exception as e:
            print(f"  Attempt {attempt+1}: status check error: {e}")
            continue

        ready_state = status.get('readyState', '?')
        print(f"  Attempt {attempt+1}: readyState={ready_state}")

        if ready_state == 'READY':
            print(f"\n✅ Deployment READY!")
            print(f"   URL: https://{status.get('url')}")
            print(f"   Aliases: {status.get('alias', [])}")
            # Save final
            Path('/home/z/my-project/aep_final_deployment.json').write_text(
                json.dumps(status, indent=2)
            )
            return 0
        elif ready_state in ('ERROR', 'CANCELED'):
            print(f"\n❌ Deployment {ready_state}")
            if status.get('errorMessage'):
                print(f"   Error: {status.get('errorMessage')}")
            return 1

    print("\n⏰ Timeout (10 min)")
    return 1


if __name__ == '__main__':
    sys.exit(main())
