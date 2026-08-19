#!/usr/bin/env python3
"""Fetch env vars from Vercel and save to /tmp/e2e-env.sh (mode 600).

Usage:
    VERCEL_TOKEN=xxx PROJECT_ID=prj_xxx python3 scripts/fetch-vercel-env.py

The script reads VERCEL_TOKEN and PROJECT_ID from env vars (never hardcoded).
It looks up two env IDs in the Vercel project and writes their decrypted
values to /tmp/e2e-env.sh with mode 600.

To find env IDs for your project:
    curl -H "Authorization: Bearer $VERCEL_TOKEN" \\
         "https://api.vercel.com/v9/projects/$PROJECT_ID/env" | jq '.envs[]'
"""
import json
import os
import stat
import sys
import urllib.request

VERCEL_TOKEN = os.environ.get("VERCEL_TOKEN")
PROJECT_ID = os.environ.get("PROJECT_ID")

if not VERCEL_TOKEN or not PROJECT_ID:
    print("✗ VERCEL_TOKEN and PROJECT_ID env vars required", file=sys.stderr)
    sys.exit(1)

# These env IDs are specific to the project. To make this script portable,
# we look up the IDs by key name at runtime instead of hardcoding them.
ENV_KEYS = ["MARKETNOW_ATC_CA_PRIVATE_KEY", "MANDATES_GITHUB_TOKEN"]

# Fetch all envs for the project to get their IDs
list_url = f"https://api.vercel.com/v9/projects/{PROJECT_ID}/env"
list_req = urllib.request.Request(
    list_url, headers={"Authorization": f"Bearer {VERCEL_TOKEN}"}
)
all_envs = json.loads(urllib.request.urlopen(list_req).read())["envs"]
env_id_by_key = {e["key"]: e["id"] for e in all_envs}

values = {}
for key in ENV_KEYS:
    if key not in env_id_by_key:
        print(f"✗ {key} not found in project envs", file=sys.stderr)
        sys.exit(1)
    env_id = env_id_by_key[key]
    url = f"https://api.vercel.com/v9/projects/{PROJECT_ID}/env/{env_id}"
    req = urllib.request.Request(
        url, headers={"Authorization": f"Bearer {VERCEL_TOKEN}"}
    )
    data = json.loads(urllib.request.urlopen(req).read())
    values[key] = data["value"]
    print(f"Fetched {key} ({len(values[key])} chars)")

# Write to a shell-sourceable env file with mode 600
env_path = "/tmp/e2e-env.sh"
with open(env_path, "w") as f:
    for key, value in values.items():
        if "'" in value:
            escaped = value.replace("\\", "\\\\").replace("'", "\\'")
            f.write(f"export {key}=$'{escaped}'\n")
        else:
            f.write(f"export {key}='{value}'\n")
os.chmod(env_path, stat.S_IRUSR | stat.S_IWUSR)
print(f"\nEnv file written to {env_path} (mode 600)")

# Sanity check
with open(env_path) as f:
    content = f.read()
if "BEGIN PRIVATE KEY" in content:
    print("✓ CA key contains valid PEM header")
else:
    print("✗ CA key missing BEGIN PRIVATE KEY header")
