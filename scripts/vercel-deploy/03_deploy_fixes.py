#!/usr/bin/env python3
"""
Create a new Vercel deployment based on the latest existing deployment,
overriding specific files with the fixed versions.

Strategy:
1. Read the existing deployment's metadata to know the build config
2. Upload each fix file to Vercel (gets a file SHA back)
3. POST /v13/deployments with:
   - name: project name
   - deploymentId: existing deployment ID (to clone the build)
   - files: list of (path, sha) pairs to override
   - target: production
4. Wait for READY state
5. Promote to production alias (marketnow.site)

Files to override (must match the EXACT path the deployment uses):
  - src/public/.well-known/agent.json  ← FIX F1, F2, F3, F4, F5, F6, F8
  - src/dist/.well-known/agent.json    ← (duplicate, must update both)
  - src/package.json                   ← FIX F1, F2
  - src/README.md                      ← FIX F1, F2, F5, F6
  - src/LICENSE                        ← NEW FILE (FIX F1)
  - src/.github/SECURITY.md            ← NEW FILE

Vercel API for file uploads:
  POST /v2/files  with multipart/form-data
  Returns: [{ sha: "...", size: ... }]
"""
import json
import hashlib
import os
import sys
import time
import urllib.request
import urllib.parse
from pathlib import Path

TOKEN = open('/home/z/my-project/.vercel-token').read().strip()
TEAM_ID = "team_DmoZusxMIKcqJhgRBmQ8B3dK"
PROJ_ID = "prj_Sof4OHAGytb75zBacYSrIFNXNnKy"  # aep-marketplace, owns marketnow.site
BASE_DPL_ID = "dpl_3ssHM1uxcwC5pM1YjWxbrgcjqida"
PROJ_NAME = "aep-marketplace"

FIX_DIR = Path('/home/z/my-project/download/marketnow-fixes')

# Map: deploy_path → local_file_path
# These are the EXACT paths used in the deployment (we confirmed by inspecting the file tree)
OVERRIDES = [
    # === CRITICAL: agent.json served at /api/agent.json ===
    # Located at dist/.well-known/agent.json (Vite copies from public/.well-known/ during build)
    ('dist/.well-known/agent.json',   FIX_DIR / 'agent.json.fixed'),
    # Also override the source so a future rebuild preserves the fix
    ('public/.well-known/agent.json', FIX_DIR / 'agent.json.fixed'),
    # package.json (npm metadata)
    ('package.json',                  FIX_DIR / 'package.json.fixed'),
    # README at root of project
    ('README.md',                     FIX_DIR / 'README.md'),
    # LICENSE — new file
    ('LICENSE',                       FIX_DIR / 'LICENSE'),
    # .github/SECURITY.md — new file
    ('.github/SECURITY.md',           FIX_DIR / '.github' / 'SECURITY.md'),
    # NOTICE — new file
    ('NOTICE',                        FIX_DIR / 'NOTICE'),
]


def upload_file(local_path: Path, deploy_path: str):
    """Upload a single file to Vercel. Returns (sha, size).

    Pattern: POST /v2/files with raw binary body + x-vercel-digest header = sha1(content)
    The digest is computed over the RAW HTTP body, which equals the file content
    when we use Content-Type: application/octet-stream (no multipart wrapping).
    """
    content = local_path.read_bytes()
    size = len(content)
    sha = hashlib.sha1(content).hexdigest()

    url = f"https://api.vercel.com/v2/files?teamId={TEAM_ID}"
    req = urllib.request.Request(
        url,
        data=content,  # raw bytes — body sent as-is
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
            resp = json.loads(r.read())
        return sha, size, None
    except urllib.error.HTTPError as e:
        body_err = e.read().decode('utf-8', errors='replace')[:500]
        return None, 0, f"HTTP {e.code}: {body_err}"
    except Exception as e:
        return None, 0, str(e)


def create_deployment(files_for_deploy, target='production'):
    """POST /v13/deployments with files and base deploymentId."""
    
    payload = {
        "name": PROJ_NAME,
        "deploymentId": BASE_DPL_ID,  # clone the existing deployment
        "files": files_for_deploy,    # list of {file: path, sha: hash, size: bytes}
        "projectSettings": {
            "framework": None,  # disable framework detection — treat as raw static
            "buildCommand": None,  # no build step
            "installCommand": None,
            "outputDirectory": "dist",  # serve from existing dist/
        },
        "target": target,
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
        with urllib.request.urlopen(req, timeout=60) as r:
            resp = json.loads(r.read())
        return resp, None
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code}: {e.read().decode('utf-8', errors='replace')[:1000]}"
    except Exception as e:
        return None, str(e)


def check_deployment_status(dpl_id):
    """Check the status of a deployment."""
    url = f"https://api.vercel.com/v13/deployments/{dpl_id}?teamId={TEAM_ID}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOKEN}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read()), None
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code}"
    except Exception as e:
        return None, str(e)


def main():
    # If we already uploaded in a previous run, reuse the saved SHA list
    state_file = Path('/home/z/my-project/marketnow-source/uploaded_files.json')
    if state_file.exists():
        print("Loading previously uploaded file SHAs...")
        uploaded = json.loads(state_file.read_text())
        print(f"  Reusing {len(uploaded)} uploaded files")
    else:
        print(f"=== Uploading {len(OVERRIDES)} fix files to Vercel ===\n")

        uploaded = []
        for deploy_path, local_path in OVERRIDES:
            if not local_path.exists():
                print(f"  SKIP {deploy_path} (local file missing: {local_path})")
                continue
            print(f"  Uploading {deploy_path}  ← {local_path.name}  ({local_path.stat().st_size} bytes)")
            sha, size, err = upload_file(local_path, deploy_path)
            if err:
                print(f"    FAIL: {err}")
                continue
            uploaded.append({
                "file": deploy_path,
                "sha": sha,
                "size": size,
            })
            print(f"    OK sha={sha[:12]}...")

        print(f"\n=== Uploaded {len(uploaded)} of {len(OVERRIDES)} files ===")
        if len(uploaded) < len(OVERRIDES):
            print("Some uploads failed. Aborting deploy.")
            return 1

        # Save state so we don't re-upload on retry
        state_file.write_text(json.dumps(uploaded, indent=2))
    
    print(f"\n=== Creating deployment (PRODUCTION) ===")
    files_for_deploy = [{"file": f["file"], "sha": f["sha"], "size": f["size"]} for f in uploaded]
    # Deploy directly to production (target='production')
    # Per Vercel docs, valid targets are: production, staging, or custom env ID
    # 'preview' is implicit when target is omitted, but we want prod now

    result, err = create_deployment(files_for_deploy, target='production')
    if err:
        print(f"FAIL: {err}")
        return 1
    
    print(f"Deployment created!")
    print(f"  id: {result.get('id')}")
    print(f"  url: {result.get('url')}")
    print(f"  readyState: {result.get('readyState')}")
    print(f"  target: {result.get('target')}")
    
    # Wait for READY
    new_dpl_id = result.get('id')
    print(f"\n=== Waiting for deployment to be READY ===")
    for attempt in range(60):  # up to 5 minutes
        time.sleep(5)
        status, err = check_deployment_status(new_dpl_id)
        if err:
            print(f"  Attempt {attempt+1}: error checking status: {err}")
            continue
        ready_state = status.get('readyState', '?')
        print(f"  Attempt {attempt+1}: readyState={ready_state}")
        if ready_state == 'READY':
            print(f"\n✓ Deployment READY!")
            print(f"  URL: https://{status.get('url')}")
            # Save deployment info
            Path('/home/z/my-project/marketnow-source/new_deployment.json').write_text(
                json.dumps(status, indent=2)
            )
            return 0
        elif ready_state in ('ERROR', 'CANCELED'):
            print(f"\n✗ Deployment {ready_state}")
            print(json.dumps(status, indent=2)[:2000])
            return 1
    
    print("\nTimeout waiting for deployment")
    return 1


if __name__ == '__main__':
    sys.exit(main())
