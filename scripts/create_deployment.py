#!/usr/bin/env python3
"""Create the production deployment for aep-marketplace using the uploaded files."""
import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

TOKEN = open('/home/z/my-project/.vercel-token').read().strip()
TEAM_ID = "team_DmoZusxMIKcqJhgRBmQ8B3dK"
PROJ_ID = "prj_Sof4OHAGytb75zBacYSrIFNXNnKy"
PROJ_NAME = "aep-marketplace"

STATE_FILE = Path('/home/z/my-project/uploaded_aep_files.json')

# Load uploaded files
uploaded = json.loads(STATE_FILE.read_text())
print(f"Loaded {len(uploaded)} uploaded files")

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
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)

new_dpl_id = result.get('id')
print(f"✅ Deployment created!")
print(f"   id: {new_dpl_id}")
print(f"   url: https://{result.get('url')}")
print(f"   readyState: {result.get('readyState')}")
print(f"   target: {result.get('target')}")

# Wait for READY
print("\n=== Waiting for deployment to be READY ===")
for attempt in range(120):
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
        Path('/home/z/my-project/aep_final_deployment.json').write_text(
            json.dumps(status, indent=2)
        )
        break
    elif ready_state in ('ERROR', 'CANCELED'):
        print(f"\n❌ Deployment {ready_state}")
        if status.get('errorMessage'):
            print(f"   Error: {status.get('errorMessage')}")
        # Save status for inspection
        Path(f'/home/z/my-project/deploy_failed_{ready_state}.json').write_text(
            json.dumps(status, indent=2)
        )
        sys.exit(1)

print("\n=== Deployment complete ===")
