#!/usr/bin/env python3
"""Re-trigger pending L2 audits + submit 5 more MCP servers."""
import json
import urllib.request
import time
import os
import sys

GH_TOKEN = os.environ.get("MANDATES_GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
if not GH_TOKEN:
    print("ERROR: Set MANDATES_GITHUB_TOKEN or GH_TOKEN env var")
    sys.exit(1)
REPO = "edgarfloresguerra2011-a11y/marketnow"

# Step 1: Re-trigger 3 pending L2 audits
print("═══ STEP 1: RE-TRIGGER 3 PENDING L2 AUDITS ═══\n")
pending = [
    ("mn-sub-72903", "https://github.com/DeusData/codebase-memory-mcp"),
    ("mn-sub-22629", "https://github.com/koala73/worldmonitor"),
    ("mn-sub-95231", "https://github.com/google-gemini/gemini-cli"),
]
url = f"https://api.github.com/repos/{REPO}/dispatches"
for skill_id, repo_url in pending:
    payload = {
        "event_type": "sentinel-l2-audit",
        "client_payload": {"skill_id": skill_id, "repo_url": repo_url},
    }
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={"Authorization": f"Bearer {GH_TOKEN}", "Accept": "application/vnd.github+json",
                 "Content-Type": "application/json", "User-Agent": "marketnow"},
        method="POST",
    )
    try:
        r = urllib.request.urlopen(req, timeout=10)
        print(f"OK L2 re-triggered for {skill_id}")
    except Exception as e:
        print(f"FAIL {skill_id}: {e}")
    time.sleep(3)

# Step 2: Submit 5 more MCP servers
print("\n═══ STEP 2: SUBMIT 5 MORE MCP SERVERS ═══\n")
new_servers = [
    "https://github.com/langchain-ai/langchain-mcp-adapters",
    "https://github.com/jlowin/fastmcp",
    "https://github.com/wong2/awesome-mcp-servers",
    "https://github.com/apappascs/mcp-servers-hub",
    "https://github.com/ravitemer/mcp-hub",
]
new_skills = []
for repo_url in new_servers:
    payload = {"repo_url": repo_url, "submitter_agent_id": "agent_marketnow_outreach_v4",
               "submitter_email": "edison@alicelabs.site"}
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        "https://marketnow.site/api/submit-skill", data=data,
        headers={"Content-Type": "application/json"}, method="POST",
    )
    try:
        r = urllib.request.urlopen(req, timeout=30)
        result = json.loads(r.read())
        skill_id = result.get("skill_id", "n/a")
        stars = result.get("repo", {}).get("stars", "n/a")
        l15 = result.get("audit", {}).get("l15_score", "n/a")
        status = result.get("status", result.get("error", "n/a"))
        icon = "OK" if status == "submitted" else "FAIL"
        print(f"{icon} {repo_url}")
        print(f"  skill_id={skill_id} stars={stars} L1.5={l15} status={status}")
        if skill_id != "n/a":
            new_skills.append((skill_id, repo_url))
    except Exception as e:
        print(f"FAIL {repo_url}: {e}")
    time.sleep(1)

# Step 3: Trigger L2 for new submissions
print(f"\n═══ STEP 3: TRIGGER L2 for {len(new_skills)} new skills ═══\n")
for skill_id, repo_url in new_skills:
    payload = {"event_type": "sentinel-l2-audit",
               "client_payload": {"skill_id": skill_id, "repo_url": repo_url}}
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={"Authorization": f"Bearer {GH_TOKEN}", "Accept": "application/vnd.github+json",
                 "Content-Type": "application/json", "User-Agent": "marketnow"},
        method="POST",
    )
    try:
        r = urllib.request.urlopen(req, timeout=10)
        print(f"OK L2 triggered for {skill_id}")
    except Exception as e:
        print(f"FAIL {skill_id}: {e}")
    time.sleep(3)

print(f"\n═══ DONE: {3 + len(new_skills)} L2 audits triggered ═══")
