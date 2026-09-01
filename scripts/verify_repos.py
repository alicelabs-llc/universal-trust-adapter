#!/usr/bin/env python3
"""
Verify which NEW external repos accept issues (not disabled),
then open targeted, non-spam issues where there's genuine fit.

Strategy: each issue references a SPECIFIC feature of theirs and a SPECIFIC
feature of ours. No copy-paste. No cross-posting. Respect each repo's contribution guidelines.
"""
import json
import urllib.request
import urllib.error
import subprocess
import time
import os

GH_TOKEN = subprocess.check_output(
    "cd /home/z/my-project && git config --get remote.origin.url | sed -n 's|https://[^:]*:\\([^@]*\\)@.*|\\1|p'",
    shell=True
).decode().strip()

HEADERS = {
    "Authorization": f"token {GH_TOKEN}",
    "Accept": "application/vnd.github+json",
    "User-Agent": "uta-integrations"
}

# Repos to verify: each maps a feature we have to a repo where it fits
CANDIDATE_REPOS = [
    # Approval flows / human-in-the-loop
    "humanlayer/humanlayer",          # approval flows for agents
    "langchain-ai/langgraph",         # interrupt() function
    # Agent frameworks we haven't hit yet
    "Aider-AI/aider",                 # coding agent
    "OpenHands/OpenHands",            # agent platform
    "block/goose",                    # AI agent
    "sst/opencode",                   # coding agent
    # Observability
    "langfuse/langfuse",              # LLM observability
    "helicone/helicone",              # LLM observability
    "arize-ai/phoenix",               # AI observability
    # Sandboxes / runtime
    "e2b-dev/E2B",                    # sandbox runtime
    "daytonaio/daytona",              # dev environments
    # AI SDKs
    "vercel/ai",                      # AI SDK
    "instructor-ai/instructor",       # structured outputs
    # Security
    "protectai/modelaudit",           # ML model security
    "promptfoo/promptfoo",            # red-teaming
    "garak-llm/garak",                # LLM vulnerability scanner
    # MCP ecosystem
    "modelcontextprotocol/servers",   # official MCP servers
    "glips/claude-code-hooks",        # claude code hooks
    # Identity
    "spiffe/spiffe",                  # SPIFFE identity
    "decentralized-identity/did-methods",  # DIDs
]


def check_repo(repo):
    """Check if repo exists and accepts issues."""
    try:
        req = urllib.request.Request(
            f"https://api.github.com/repos/{repo}",
            headers=HEADERS
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            d = json.loads(r.read())
        
        has_issues = d.get("has_issues", False)
        archived = d.get("archived", False)
        stars = d.get("stargazers_count", 0)
        lang = d.get("language") or "?"
        desc = (d.get("description") or "")[:80]
        
        return {
            "repo": repo,
            "exists": True,
            "has_issues": has_issues,
            "archived": archived,
            "stars": stars,
            "lang": lang,
            "desc": desc
        }
    except urllib.error.HTTPError as e:
        return {"repo": repo, "exists": False, "error": e.code}
    except Exception as e:
        return {"repo": repo, "exists": False, "error": str(e)[:100]}


print("=== STEP 2: Verify candidate repos ===\n")
results = []
for repo in CANDIDATE_REPOS:
    info = check_repo(repo)
    if info.get("exists"):
        status = "✅" if info["has_issues"] and not info["archived"] else "❌"
        print(f"  {status} {repo:45} ★{info['stars']:>7} issues={info['has_issues']} {info['lang'][:10]:10} {info['desc'][:50]}")
    else:
        print(f"  ❓ {repo:45} NOT FOUND (error {info.get('error')})")
    results.append(info)
    time.sleep(0.5)

# Filter to repos that accept issues
print("\n=== REPOS THAT ACCEPT ISSUES ===\n")
good_repos = [r for r in results if r.get("has_issues") and not r.get("archived")]
for r in good_repos:
    print(f"  ✅ {r['repo']:45} ★{r['stars']:>7} — {r['desc'][:60]}")

print(f"\n  Total candidate repos: {len(CANDIDATE_REPOS)}")
print(f"  Repos accepting issues: {len(good_repos)}")

# Save
os.makedirs("/home/z/my-project/download/promotion", exist_ok=True)
with open("/home/z/my-project/download/promotion/repos_verified.json", "w") as f:
    json.dump(results, f, indent=2)
