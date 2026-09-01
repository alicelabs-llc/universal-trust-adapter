#!/usr/bin/env python3
"""
Open issues in 3 NEW awesome lists to request inclusion of UTA.
"""
import json
import urllib.request
import urllib.error
import subprocess
import time

GH_TOKEN = subprocess.check_output(
    "cd /home/z/my-project && git config --get remote.origin.url | sed -n 's|https://[^:]*:\\([^@]*\\)@.*|\\1|p'",
    shell=True
).decode().strip()

HEADERS = {
    "Authorization": f"token {GH_TOKEN}",
    "Accept": "application/vnd.github+json",
    "User-Agent": "uta-outreach"
}

ISSUES = [
    {
        "repo": "e2b-dev/awesome-ai-agents",
        "title": "Add: Universal Trust Adapter (UTA) — credential verification for AI agents (8 formats, 12-stage pipeline)",
        "body": """## What

**Universal Trust Adapter (UTA)** — a credential verification layer for AI agents.

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
- NPM: `@marketnow/trust-core`

## Why it belongs in awesome-ai-agents

UTA solves a real gap in the agent ecosystem: there's no canonical way to verify *who issued the credential* for a tool an agent is about to invoke. UTA supports **8 credential formats**:

1. ATC v3 (Agent Trust Card)
2. JWT (with `x5c` chain)
3. W3C Verifiable Credentials
4. A2A (Agent-to-Agent) cards
5. EAT-AI (Entity Attestation Tokens)
6. ZTA (Zero Trust Agent) cards
7. MCP Server Cards
8. X.509 certificates

Through a **12-stage pipeline**: `PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION`.

## Stats

- 6,744 verifications/sec (single core)
- 480+ tests in Node.js, 16 in Python, 23 property tests
- Public API: https://www.marketnow.site/api/trust
- 15-language snippet collection: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/snippets

## Suggested entry

```
- [Universal Trust Adapter (UTA)](https://github.com/alicelabs-llc/universal-trust-adapter) - Verifies credentials from AI agents in 8 formats (ATC, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP, X.509) through a 12-stage pipeline. Public API + NPM package.
```

Happy to open a PR if maintainers prefer that format.
"""
    },
    {
        "repo": "kyrolabs/awesome-agents",
        "title": "Add: Universal Trust Adapter (UTA) — credential verification for AI agents",
        "body": """## What

**Universal Trust Adapter (UTA)** — credential verification for AI agents.

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust

## Why

Agents invoke tools — MCP servers, APIs, microservices. Before invocation, UTA verifies the *credential* of the tool:

- Who issued it?
- Is it expired?
- Is it revoked?
- Does the presenter actually possess the private key?

UTA supports **8 formats**: ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509.

12-stage pipeline: `PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION`.

## Stats

- 6,744 verifications/sec
- 480+ tests
- Public API: https://www.marketnow.site/api/trust
- 15-language snippet collection

## Suggested entry

```
- [Universal Trust Adapter (UTA)](https://github.com/alicelabs-llc/universal-trust-adapter) - Credential verification layer for AI agents. 8 formats, 12-stage pipeline, public API.
```

Happy to open a PR.
"""
    },
    {
        "repo": "wong2/awesome-mcp-servers",
        "title": "Add: Universal Trust Adapter (UTA) — credential verification for MCP servers",
        "body": """## What

**Universal Trust Adapter (UTA)** — verifies credentials for MCP servers (and other agent tools).

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust

## Why it belongs here

This list curates MCP servers. UTA is the missing piece — it verifies the *credential* of an MCP server before an agent invokes it. UTA supports MCP Server Cards natively, plus 7 other formats (ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, X.509).

12-stage pipeline: `PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION`.

## Stats

- 6,744 verifications/sec
- 480+ tests
- Public API
- 15-language snippet collection

## Suggested entry

```
- [Universal Trust Adapter (UTA)](https://github.com/alicelabs-llc/universal-trust-adapter) - Verifies MCP Server Cards (and 7 other credential formats) through a 12-stage pipeline. Public API + NPM package.
```

Happy to open a PR.
"""
    },
]


def open_issue(repo, title, body):
    url = f"https://api.github.com/repos/{repo}/issues"
    payload = json.dumps({"title": title, "body": body}).encode()
    req = urllib.request.Request(url, data=payload, headers=HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read())
            return data.get("html_url"), data.get("number")
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:300]
        return f"ERROR {e.code}: {body}", None


results = []
for i, item in enumerate(ISSUES):
    print(f"[{i+1}/{len(ISSUES)}] {item['repo']}: {item['title'][:60]}...")
    url, num = open_issue(item["repo"], item["title"], item["body"])
    print(f"   → {url}")
    results.append({"repo": item["repo"], "title": item["title"], "url": url, "number": num})
    time.sleep(2)

print("\n=== AWESOME LIST SUMMARY ===")
for r in results:
    status = "✅" if r["url"].startswith("https://") else "❌"
    print(f"  {status} {r['repo']:40} #{r['number']}  {r['url'][:90]}")

import os
os.makedirs("/home/z/my-project/download/promotion", exist_ok=True)
with open("/home/z/my-project/download/promotion/awesome_list_issues.json", "w") as f:
    json.dump(results, f, indent=2)
