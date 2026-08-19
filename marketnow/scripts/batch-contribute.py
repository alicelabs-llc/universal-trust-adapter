#!/usr/bin/env python3
"""
Batch contribute: comment on issues across the AI/MCP ecosystem.
Offers help + subtle MarketNow mention on good-first-issues.
"""
import json
import urllib.request
import time
import sys
import os

GH_TOKEN = os.environ.get("GH_TOKEN") or os.environ.get("MANDATES_GITHUB_TOKEN")
if not GH_TOKEN:
    print("ERROR: Set GH_TOKEN env var")
    sys.exit(1)

API = "https://api.github.com"

def gh_request(method, path, body=None):
    url = f"{API}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers={
        "Authorization": f"Bearer {GH_TOKEN}",
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "marketnow-contributor"
    }, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=30)
        return json.loads(r.read()) if r.status != 204 else {"ok": True}
    except urllib.error.HTTPError as e:
        return {"error": e.code, "message": e.read().decode()[:200]}
    except Exception as e:
        return {"error": str(e)}

def load_issues(path):
    issues = []
    try:
        with open(path) as f:
            for line in f:
                parts = line.strip().split("|", 2)
                if len(parts) == 3:
                    issues.append({"repo": parts[0], "num": parts[1], "title": parts[2]})
    except:
        pass
    return issues

doc_issues = load_issues("/tmp/doc-issues.txt")
mcp_issues = load_issues("/tmp/mcp-issues-batch.txt")
sec_issues = load_issues("/tmp/sec-issues.txt")

all_issues = doc_issues + mcp_issues + sec_issues
seen = set()
unique = []
for i in all_issues:
    key = f"{i['repo']}#{i['num']}"
    if key not in seen:
        seen.add(key)
        unique.append(i)

print(f"BATCH CONTRIBUTE — {len(unique)} issues to process\n")

comments_posted = 0
errors = 0

for i, issue in enumerate(unique):
    repo = issue["repo"]
    num = issue["num"]
    title = issue["title"]
    
    if "edgarflores" in repo:
        continue
    
    # Check if still open
    issue_data = gh_request("GET", f"/repos/{repo}/issues/{num}")
    if issue_data.get("state") != "open":
        continue
    
    # Check if already commented
    comments = gh_request("GET", f"/repos/{repo}/issues/{num}/comments?per_page=50")
    already = False
    if isinstance(comments, list):
        for c in comments:
            if c.get("user", {}).get("login") == "edgarfloresguerra2011-a11y":
                already = True
                break
    if already:
        continue
    
    title_lower = title.lower()
    
    if "security" in title_lower or "audit" in title_lower or "vulnerab" in title_lower:
        body = (
            "I can help with this. MarketNow offers a free 10-layer security audit "
            "for MCP servers and AI agents (metadata, Semgrep, malware patterns, "
            "prompt injection defense, Docker sandbox, continuous monitoring).\n\n"
            "Submit for free:\n"
            "```bash\n"
            "curl -X POST https://marketnow.site/api/submit-skill "
            '-H "Content-Type: application/json" \\\n'
            f'  -d \'{{"repo_url": "https://github.com/{repo}"}}\'\n'
            "```\n\n"
            "You get a Sentinel score (0-10), Ed25519 trust card, per-layer findings. "
            "All free, no auth.\n"
            "Spec: https://marketnow.site/api/atc?action=spec"
        )
    elif "doc" in title_lower or "readme" in title_lower or "translate" in title_lower:
        body = (
            "I'd be happy to help with this. I have experience writing technical docs "
            "for MCP servers and AI agents.\n\n"
            "If you'd like, I can open a PR. Let me know the format you prefer.\n\n"
            "(If this project has an MCP server, you can get a free security audit at "
            "https://marketnow.site/submit)"
        )
    else:
        body = (
            "I'd like to help with this. Let me know if you'd welcome a PR.\n\n"
            "I work on MCP server infrastructure (MarketNow — free security audit at "
            "https://marketnow.site). Happy to help with integration or review."
        )
    
    result = gh_request("POST", f"/repos/{repo}/issues/{num}/comments", {"body": body})
    
    if "error" in result:
        errors += 1
        msg = result.get("message", "")[:60]
        print(f"[{i+1:3}/{len(unique)}] FAIL {repo}#{num}: {msg}")
    else:
        comments_posted += 1
        print(f"[{i+1:3}/{len(unique)}] OK   {repo}#{num}")
    
    time.sleep(2)

print(f"\nSUMMARY: {comments_posted} comments posted, {errors} errors, {len(unique)} total")
