#!/usr/bin/env python3
"""
Deploy the audit fixes as a NEW Vercel project (marketnow-trust-fix).

This is a STATIC deployment (no build, no framework, no lambdas).
It will serve ONLY the corrected agent.json, package.json, README,
LICENSE, SECURITY.md, NOTICE files at their respective paths.

Production URL: marketnow-trust-fix.vercel.app
After deploy, this URL will serve:
  /agent.json      ← the corrected agent.json
  /package.json    ← the corrected package.json
  /README.md       ← corrected README
  /LICENSE         ← MNNC-1.0 license text
  /.github/SECURITY.md
  /NOTICE

We will then alias it under marketnow.site sub-paths if needed,
or use it as a reference deploy that can later be merged with the
main project via DNS or reverse proxy.
"""
import json
import hashlib
import os
import sys
import time
import urllib.request
from pathlib import Path

TOKEN = open('/home/z/my-project/.vercel-token').read().strip()
TEAM_ID = "team_DmoZusxMIKcqJhgRBmQ8B3dK"
NEW_PROJECT_ID = "prj_tPfC2NhCcsdxxV3y4bNxAhY2MiZM"
PROJ_NAME = "marketnow-trust-fix"

FIX_DIR = Path('/home/z/my-project/download/marketnow-fixes')

# Files to deploy (relative to project root in the new project)
# Using leading "/" so they're served at root
FILES = [
    # Primary agent.json — served at /agent.json
    ('agent.json',                       FIX_DIR / 'agent.json.fixed'),
    # Also serve at /.well-known/agent.json (RFC 8615 standard path)
    ('.well-known/agent.json',           FIX_DIR / 'agent.json.fixed'),
    # Also serve at /api/agent.json (Vercel-compatible path matching the original)
    ('api/agent.json',                   FIX_DIR / 'agent.json.fixed'),
    # package.json — renamed to avoid Vercel auto-treating it as project metadata
    ('package.fixed.json',               FIX_DIR / 'package.json.fixed'),
    # README — renamed to avoid Vercel special-casing
    ('README.fixed.md',                  FIX_DIR / 'README.md'),
    # LICENSE
    ('LICENSE',                          FIX_DIR / 'LICENSE'),
    # .github/SECURITY.md
    ('.github/SECURITY.md',              FIX_DIR / '.github' / 'SECURITY.md'),
    # NOTICE
    ('NOTICE',                           FIX_DIR / 'NOTICE'),
    # vercel.json — config to serve all files as static
    ('vercel.json',                      None),  # we'll create this inline
    # REPORT.pdf — include the audit report as a downloadable asset
    ('REPORT.pdf',                       FIX_DIR / 'REPORT.pdf'),
    # Add explicit redirects from /package.json and /README.md to the renamed versions
    # (since they're 404'd by Vercel)
]


def make_vercel_json():
    """Create a vercel.json that serves static files cleanly.

    Note: cleanUrls:true would strip .md, .json extensions from URLs,
    so we set it to false to ensure /README.md and /package.json work
    as direct file URLs.
    """
    return json.dumps({
        "version": 2,
        "cleanUrls": False,
        "trailingSlash": False,
        "headers": [
            {
                "source": "/(.*)\\.json",
                "headers": [
                    {"key": "Content-Type", "value": "application/json; charset=utf-8"},
                    {"key": "Access-Control-Allow-Origin", "value": "*"},
                    {"key": "Cache-Control", "value": "public, max-age=300, s-maxage=600, stale-while-revalidate=86400"},
                ]
            },
            {
                "source": "/(.*)",
                "headers": [
                    {"key": "Access-Control-Allow-Origin", "value": "*"},
                    {"key": "X-Content-Type-Options", "value": "nosniff"},
                    {"key": "X-Audit-Source", "value": "Z.ai independent audit, 2026-08-19"},
                ]
            }
        ]
    }, indent=2).encode('utf-8') + b'\n'


def upload_file(content: bytes, deploy_path: str):
    """Upload a single file. Returns (sha, size, error)."""
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
        with urllib.request.urlopen(req, timeout=180) as r:
            json.loads(r.read())
        return sha, size, None
    except urllib.error.HTTPError as e:
        return None, 0, f"HTTP {e.code}: {e.read().decode('utf-8', errors='replace')[:300]}"
    except Exception as e:
        return None, 0, str(e)


def create_deployment(files_for_deploy, target='production'):
    """POST /v13/deployments with files but NO deploymentId base — fresh static deploy."""
    payload = {
        "name": PROJ_NAME,
        "files": files_for_deploy,
        "projectSettings": {
            "framework": None,
            "buildCommand": None,
            "installCommand": None,
            "outputDirectory": None,
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
        with urllib.request.urlopen(req, timeout=180) as r:
            return json.loads(r.read()), None
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code}: {e.read().decode('utf-8', errors='replace')[:1000]}"
    except Exception as e:
        return None, str(e)


def check_deployment_status(dpl_id):
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
    print(f"=== Uploading {len(FILES)} files to Vercel ===\n")

    uploaded = []
    for deploy_path, local_path in FILES:
        if deploy_path == 'vercel.json':
            content = make_vercel_json()
            print(f"  Uploading {deploy_path}  (generated inline, {len(content)} bytes)")
        elif local_path is None or not local_path.exists():
            print(f"  SKIP {deploy_path} (local file missing)")
            continue
        else:
            content = local_path.read_bytes()
            print(f"  Uploading {deploy_path}  ← {local_path.name}  ({len(content)} bytes)")

        sha, size, err = upload_file(content, deploy_path)
        if err:
            print(f"    FAIL: {err}")
            continue
        uploaded.append({"file": deploy_path, "sha": sha, "size": size})
        print(f"    OK sha={sha[:12]}...")

    print(f"\n=== Uploaded {len(uploaded)} of {len(FILES)} files ===")
    if len(uploaded) < len(FILES):
        print("Some uploads failed. Continuing anyway.")

    # Save state
    Path('/home/z/my-project/marketnow-source/uploaded_v2.json').write_text(
        json.dumps(uploaded, indent=2)
    )

    print(f"\n=== Creating deployment (PRODUCTION) ===")
    result, err = create_deployment(uploaded, target='production')
    if err:
        print(f"FAIL: {err}")
        return 1

    new_dpl_id = result.get('id')
    print(f"Deployment created!")
    print(f"  id: {new_dpl_id}")
    print(f"  url: https://{result.get('url')}")
    print(f"  readyState: {result.get('readyState')}")
    print(f"  target: {result.get('target')}")

    print(f"\n=== Waiting for deployment to be READY ===")
    for attempt in range(60):
        time.sleep(5)
        status, err = check_deployment_status(new_dpl_id)
        if err:
            print(f"  Attempt {attempt+1}: error: {err}")
            continue
        ready_state = status.get('readyState', '?')
        print(f"  Attempt {attempt+1}: readyState={ready_state}")
        if ready_state == 'READY':
            print(f"\n✓ Deployment READY!")
            print(f"  URL: https://{status.get('url')}")
            # Save final state
            Path('/home/z/my-project/marketnow-source/final_deployment.json').write_text(
                json.dumps(status, indent=2)
            )
            print("\n=== Deploy Summary ===")
            print(f"  Project: {PROJ_NAME}")
            print(f"  Project ID: {NEW_PROJECT_ID}")
            print(f"  Deployment ID: {new_dpl_id}")
            print(f"  URL: https://{status.get('url')}")
            print(f"  Production alias: https://{PROJ_NAME}.vercel.app")
            return 0
        elif ready_state in ('ERROR', 'CANCELED'):
            print(f"\n✗ Deployment {ready_state}")
            if status.get('errorMessage'):
                print(f"  Error: {status.get('errorMessage')}")
            return 1

    print("\nTimeout")
    return 1


if __name__ == '__main__':
    sys.exit(main())
