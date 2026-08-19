#!/usr/bin/env python3
"""
Create a Vercel deployment with whatever files we have uploaded so far.
"""
import json
import urllib.request
import urllib.error
import time
from pathlib import Path

TOKEN = open('/home/z/my-project/.vercel-token').read().strip()
TEAM_ID = "team_DmoZusxMIKcqJhgRBmQ8B3dK"
PROJ_NAME = "aep-marketplace"

STATE_FILE = Path('/home/z/my-project/uploaded_aep_files.json')

uploaded = json.loads(STATE_FILE.read_text())
print(f"Files uploaded: {len(uploaded)}")
print(f"Total size: {sum(f['size'] for f in uploaded)/1024/1024:.1f} MB")

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
    with urllib.request.urlopen(req, timeout=180) as r:
        result = json.loads(r.read())
except urllib.error.HTTPError as e:
    err_body = e.read().decode('utf-8', errors='replace')
    print(f"❌ HTTP {e.code}")
    print(err_body[:3000])
    exit(1)

new_dpl_id = result.get('id')
print(f"\n✅ Deployment created!")
print(f"   id: {new_dpl_id}")
print(f"   url: https://{result.get('url')}")
print(f"   readyState: {result.get('readyState')}")
print(f"   target: {result.get('target')}")

print(f"\n=== Waiting for READY ===")
for attempt in range(180):  # 15 min
    time.sleep(5)
    surl = f"https://api.vercel.com/v13/deployments/{new_dpl_id}?teamId={TEAM_ID}"
    sreq = urllib.request.Request(surl, headers={"Authorization": f"Bearer {TOKEN}"})
    try:
        with urllib.request.urlopen(sreq, timeout=30) as r:
            status = json.loads(r.read())
    except Exception as e:
        print(f"  Attempt {attempt+1}: error {e}")
        continue

    rs = status.get('readyState', '?')
    print(f"  Attempt {attempt+1}: {rs}")

    if rs == 'READY':
        print(f"\n🎉 Deployment READY!")
        print(f"   Production URL: https://{status.get('url')}")
        print(f"   Aliases: {status.get('alias', [])}")
        Path('/home/z/my-project/aep_final_deployment.json').write_text(
            json.dumps(status, indent=2))
        break
    elif rs in ('ERROR', 'CANCELED'):
        print(f"\n❌ {rs}")
        if status.get('errorMessage'):
            print(f"   Error: {status.get('errorMessage')}")
        Path('/home/z/my-project/aep_failed_deployment.json').write_text(
            json.dumps(status, indent=2))
        break
