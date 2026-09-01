#!/usr/bin/env python3
"""Audit all repos where we opened issues — check risk of ban."""
import json
import urllib.request
import subprocess
import time

GH_TOKEN = subprocess.check_output(
    "cd /home/z/my-project && git config --get remote.origin.url | sed -n 's|https://[^:]*:\\([^@]*\\)@.*|\\1|p'",
    shell=True
).decode().strip()

HEADERS = {
    "Authorization": f"token {GH_TOKEN}",
    "Accept": "application/vnd.github+json",
    "User-Agent": "uta-audit"
}

REPOS = [
    "continuedev/continue",
    "run-llama/llama_index",
    "microsoft/autogen",
    "pydantic/pydantic-ai",
    "microsoft/semantic-kernel",
    "google/adk-python",
    "openai/openai-agents-python",
    "anthropics/anthropic-sdk-python",
    "deepset-ai/haystack",
    "BerriAI/litellm",
    "ant-design/x",
    "e2b-dev/awesome-ai-agents",
    "humanlayer/humanlayer",
    "langchain-ai/langgraph",
    "Aider-AI/aider",
    "OpenHands/OpenHands",
    "langfuse/langfuse",
    "vercel/ai",
    "promptfoo/promptfoo",
    "spiffe/spiffe",
    "modelcontextprotocol/servers",
]

ISSUE_NUMS = {
    "continuedev/continue": 13212,
    "run-llama/llama_index": 22920,
    "microsoft/autogen": 8139,
    "pydantic/pydantic-ai": 7981,
    "microsoft/semantic-kernel": 14356,
    "google/adk-python": 6974,
    "openai/openai-agents-python": 4806,
    "anthropics/anthropic-sdk-python": 1904,
    "deepset-ai/haystack": 12565,
    "BerriAI/litellm": 39123,
    "ant-design/x": 2043,
    "e2b-dev/awesome-ai-agents": 1481,
    "humanlayer/humanlayer": 1101,
    "langchain-ai/langgraph": 8791,
    "Aider-AI/aider": 5665,
    "OpenHands/OpenHands": 17084,
    "langfuse/langfuse": 16920,
    "vercel/ai": 20147,
    "promptfoo/promptfoo": 10599,
    "spiffe/spiffe": 425,
    "modelcontextprotocol/servers": 4736,
}

print("=" * 80)
print("AUDITORÍA DE RIESGO — Todos los issues que abrimos")
print("=" * 80)
print()

high_risk = []
medium_risk = []
low_risk = []

for repo in REPOS:
    num = ISSUE_NUMS.get(repo)
    if not num:
        continue
    
    try:
        # Get repo info
        req = urllib.request.Request(f"https://api.github.com/repos/{repo}", headers=HEADERS)
        with urllib.request.urlopen(req, timeout=10) as r:
            repo_info = json.loads(r.read())
        
        # Get issue info
        req = urllib.request.Request(f"https://api.github.com/repos/{repo}/issues/{num}", headers=HEADERS)
        with urllib.request.urlopen(req, timeout=10) as r:
            issue_info = json.loads(r.read())
        
        desc = (repo_info.get("description") or "")[:55]
        has_discussions = repo_info.get("has_discussions", False)
        has_issues = repo_info.get("has_issues", False)
        state = issue_info.get("state", "?")
        comments = issue_info.get("comments", 0)
        reactions = issue_info.get("reactions", {}).get("total_count", 0)
        title = issue_info.get("title", "?")[:45]
        
        # Get comments to check if maintainer responded
        req = urllib.request.Request(
            f"https://api.github.com/repos/{repo}/issues/{num}/comments?per_page=5",
            headers=HEADERS
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            comments_data = json.loads(r.read())
        
        maintainer_response = False
        for c in comments_data:
            author = c.get("user", {}).get("login", "")
            if not author.endswith("[bot]") and author not in ["alicelabsllc", "eddyflores100-lang", "eddyflores"]:
                maintainer_response = True
                break
        
        # Risk assessment
        risk = "LOW"
        reason = ""
        
        if state == "closed":
            risk = "HIGH"
            reason = "ISSUE CLOSED — maintainer rejected it"
        elif maintainer_response:
            risk = "MEDIUM"
            reason = "Maintainer responded — review their tone"
        elif has_discussions and not maintainer_response:
            risk = "LOW-MEDIUM"
            reason = "Repo has Discussions — could have posted there instead"
        else:
            risk = "LOW"
            reason = "Open, no response, no discussions alt"
        
        print(f"  [{risk:11}] {repo:42} {state:6} {comments}c {reactions}r")
        print(f"               Issue: {title}")
        print(f"               Desc: {desc}")
        if has_discussions:
            print(f"               ⚠️  Has Discussions enabled")
        print(f"               Risk: {reason}")
        print()
        
        if risk == "HIGH":
            high_risk.append((repo, num, reason))
        elif risk == "MEDIUM":
            medium_risk.append((repo, num, reason))
        else:
            low_risk.append((repo, num, reason))
        
        time.sleep(0.5)
    except Exception as e:
        print(f"  ERROR checking {repo}: {e}")
        print()

print("=" * 80)
print("RESUMEN DE RIESGO")
print("=" * 80)
print()
print(f"🚨 HIGH RISK ({len(high_risk)}):")
for repo, num, reason in high_risk:
    print(f"  {repo}#{num} — {reason}")
print()
print(f"⚠️  MEDIUM RISK ({len(medium_risk)}):")
for repo, num, reason in medium_risk:
    print(f"  {repo}#{num} — {reason}")
print()
print(f"✅ LOW RISK ({len(low_risk)}):")
for repo, num, reason in low_risk:
    print(f"  {repo}#{num}")
print()

print("=" * 80)
print("RECOMENDACIONES")
print("=" * 80)
print()
if high_risk:
    print("HIGH RISK — NO abrir más issues en estos repos:")
    for repo, num, reason in high_risk:
        print(f"  - {repo}")
    print()
if medium_risk:
    print("MEDIUM RISK — Monitorear, no insistir si cierran:")
    for repo, num, reason in medium_risk:
        print(f"  - {repo}")
    print()
print("LECCIÓN APRENDIDA de E2B:")
print("  - E2B es un monorepo de SDK/infrastructure (no un framework)")
print("  - No tiene Discussions habilitadas")
print("  - Tiene ISSUE_TEMPLATE específico")
print("  - Maintainer cerró diciendo 'not a discussion board'")
print("  - Antes de abrir issues: verificar si el repo tiene Discussions,")
print("    leer CONTRIBUTING.md, y mirar issue templates")
