#!/usr/bin/env python3
"""
Open carefully-crafted issues in NEW external repos.
Each issue is unique, references their codebase specifically,
and proposes genuine value. NO copy-paste, NO spam.

Selection criteria:
- HumanLayer: approval flows + credential verification (perfect fit)
- LangGraph: interrupt() + trust verification hook
- Aider: tool execution + trust pre-check
- OpenHands: agent platform + trust layer
- Goose (block): agent + MCP trust
- sst/opencode: coding agent + MCP trust
- Langfuse: observability + trust receipts
- E2B: sandbox + trust attestation
- Daytona: dev environments + trust
- Vercel AI: AI SDK + trust verification
- promptfoo: red-teaming + trust verification tests
- modelcontextprotocol/servers: list our MCP server
- spiffe/spiffe: SPIFFE + UTA adapter
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

ISSUES = [
    # ============================================================
    # 1. HumanLayer — approval flows + credential verification
    # ============================================================
    {
        "repo": "humanlayer/humanlayer",
        "title": "Proposal: pre-approval credential verification for tools that request human approval",
        "body": """## Context

HumanLayer provides approval flows for AI agent tool calls — when an agent wants to take a sensitive action, HumanLayer pauses and asks a human. This is the right design for the *action* layer.

I'm proposing an optional **pre-approval credential verification** step: before an agent even asks for approval to call a tool, verify the tool's credential is valid (issued by a trusted CA, not expired, not revoked, scope matches the requested action).

## What I built

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

UTA verifies credentials in 8 formats (ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Server Cards, X.509) through a 12-stage pipeline. Public API: https://www.marketnow.site/api/trust

## Why this fits HumanLayer

Currently, HumanLayer's approval flow assumes the tool is "real" and the question is just "should we run it?". But there's a prior question: "is this tool's credential valid, and does its scope match what the agent is asking to do?"

A tool with a revoked credential, or a tool whose scope is `read:files` but the agent is asking it to `write:files`, should be blocked **before** the human is bothered with an approval prompt. The human should only see approvals for tools that passed credential verification.

## Proposed integration

An optional `trust_verifier` parameter on HumanLayer's approval flow:

```typescript
import { approve } from '@humanlayer/sdk';
import { verify } from '@marketnow/trust-core';

const result = await verify(tool.credential);
if (result.decision !== 'PERMIT') {
  // Don't bother the human — the credential is invalid
  throw new Error(`Tool credential failed verification: ${result.failed_stage}`);
}

// Only ask for human approval if the credential is valid
await approve({
  tool: tool.name,
  args: tool.args,
  // ...
});
```

## Non-goals

- Not asking HumanLayer to bundle UTA
- Not asking for changes to the core approval flow
- Asking whether a `trust_verifier` hook would be accepted

## References

- UTA repo: https://github.com/alicelabs-llc/universal-trust-adapter
- UTA API: https://www.marketnow.site/api/trust
- UTA 12-stage pipeline: https://github.com/alicelabs-llc/universal-trust-adapter#pipeline

Happy to write a design doc if there's interest.
"""
    },
    # ============================================================
    # 2. LangGraph — interrupt() + trust verification
    # ============================================================
    {
        "repo": "langchain-ai/langgraph",
        "title": "RFC: trust-card verification before interrupt() approval",
        "body": """## Context

LangGraph's `interrupt()` function lets agents pause and ask for human approval before continuing. This is the right primitive for human-in-the-loop agent workflows.

I'm proposing an optional **pre-interrupt trust verification** step: before `interrupt()` is called for a tool, verify the tool's credential is valid.

## What I built

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

- 8 credential formats supported (ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509)
- 12-stage verification pipeline
- Public API: https://www.marketnow.site/api/trust

## Why this fits LangGraph

A `interrupt()` call asks a human "should I run this tool?". But if the tool's credential is revoked, expired, or scope-mismatched, the human shouldn't be asked at all — the call should fail automatically.

## Proposed integration

A wrapper around `interrupt()`:

```python
from langgraph.types import interrupt
from marketnow_trust import verify

def trusted_interrupt(tool_call, credential):
    result = verify(credential)
    if result.decision != 'PERMIT':
        return f"Blocked: credential failed at {result.failed_stage}"
    return interrupt(tool_call)
```

This could live in `langchain-community` or as a separate `langgraph-trust` package.

## Non-goals

- Not asking LangGraph to bundle UTA
- Not asking for changes to `interrupt()` itself
- Asking whether a `trusted_interrupt` helper would be accepted in langchain-community

## References

- UTA repo: https://github.com/alicelabs-llc/universal-trust-adapter
- UTA Python adapter: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/snippets/python

Note: I opened a broader RFC (#40102) about trust-card verification for tool nodes. This issue is specifically about the `interrupt()` integration, which is a narrower proposal.
"""
    },
    # ============================================================
    # 3. Aider — tool execution + trust pre-check
    # ============================================================
    {
        "repo": "Aider-AI/aider",
        "title": "Discussion: optional trust verification for MCP servers loaded by Aider",
        "body": """## Context

Aider supports MCP servers via its configuration. When Aider loads a third-party MCP server, there's no canonical way to verify *who issued the credential* for that server before Aider executes its tools.

## What I built

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

- Verifies credentials in 8 formats (ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Server Cards, X.509)
- 12-stage pipeline: parser → detect → schema → crypto → issuer → key_binding → pop → provenance → lifecycle → evidence → policy → decision
- Public API: https://www.marketnow.site/api/trust

## Discussion

This is a discussion, not a feature request. I'm asking:

1. Is credential verification for MCP servers a concern Aider users have raised?
2. If yes, would an opt-in `trust_verification: true` config flag be accepted?
3. If no, we'll publish a standalone wrapper script that Aider users can run alongside.

## References

- UTA repo: https://github.com/alicelabs-llc/universal-trust-adapter
- UTA API: https://www.marketnow.site/api/trust
- Bash snippet for CLI verification: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/snippets/bash/verify.sh
"""
    },
    # ============================================================
    # 4. OpenHands — agent platform + trust layer
    # ============================================================
    {
        "repo": "OpenHands/OpenHands",
        "title": "Proposal: trust-card verification for MCP servers used by OpenHands agents",
        "body": """## Context

OpenHands agents can invoke arbitrary tools, including MCP-backed ones. For agents that touch production systems, there's no canonical way to verify the *issuer* of a tool's credential before the agent dispatches.

## What I built

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

- 8 credential formats: ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509
- 12-stage verification pipeline
- 6,744 verifications/sec benchmark
- Public API: https://www.marketnow.site/api/trust

## Proposal

An optional `trust_verifier` in OpenHands' tool registration. When set, OpenHands calls the verifier before tool dispatch. Failed verification raises a structured exception the agent can handle.

## Non-goals

- Not asking OpenHands to bundle UTA
- Not asking for changes to the core agent loop

## Ask

1. Is this in scope?
2. Where should the hook live — in the action execution layer, or as a middleware?

## References

- UTA repo: https://github.com/alicelabs-llc/universal-trust-adapter
- UTA API: https://www.marketnow.site/api/trust
"""
    },
    # ============================================================
    # 5. Langfuse — observability + trust receipts
    # ============================================================
    {
        "repo": "langfuse/langfuse",
        "title": "Discussion: log trust verification receipts alongside LLM traces",
        "body": """## Context

Langfuse traces LLM calls — inputs, outputs, tokens, latency. For agents that verify credentials before calling tools, there's value in logging the **trust verification receipt** alongside the tool call trace.

## What I built

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

UTA's `verify()` returns a structured receipt:
```json
{
  "decision": "PERMIT",
  "detected_format": "JWT",
  "issuer": "did:web:alice.example",
  "stages": { "PARSER": "OK", "CRYPTO": "OK", ... },
  "evidence": { "log_id": "...", "timestamp": "..." }
}
```

## Why this fits Langfuse

If an agent calls a tool, Langfuse traces the tool call. But if the tool's credential was verified before the call, that verification receipt is currently lost. Logging it alongside the trace would let developers:

1. Filter traces by credential issuer
2. Audit which credentials were used in a session
3. Detect anomalies (same tool, different issuers across sessions)

## Proposed integration

A Langfuse integration that accepts a `trust_receipt` field on trace events:

```typescript
langfuse.trace({
  name: 'tool_call',
  input: toolArgs,
  output: toolResult,
  metadata: {
    trust_receipt: utaReceipt  // UTA verify() result
  }
});
```

This could be a wrapper library: `langfuse-trust` or similar.

## Non-goals

- Not asking Langfuse to bundle UTA
- Not asking for schema changes to core trace events
- Asking whether a `metadata.trust_receipt` convention would be useful

## References

- UTA repo: https://github.com/alicelabs-llc/universal-trust-adapter
- UTA receipt format: https://github.com/alicelabs-llc/universal-trust-adapter#receipt-format
"""
    },
    # ============================================================
    # 6. E2B — sandbox + trust attestation
    # ============================================================
    {
        "repo": "e2b-dev/E2B",
        "title": "Discussion: trust attestation for code running in E2B sandboxes",
        "body": """## Context

E2B provides secure sandboxes for AI agent code execution. When an agent runs code in an E2B sandbox, the sandbox is ephemeral — but the *code* that ran, and the *result* it produced, may need to be attested for downstream verification.

## What I built

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

UTA can issue Agent Trust Cards (ATC v3) that attest:
- What code ran
- In what environment (E2B sandbox ID)
- What result it produced
- When it ran
- Who issued the attestation

## Why this fits E2B

If an agent runs code in E2B and the result is used in a downstream decision (e.g., "the agent analyzed the data and decided X"), the downstream consumer may want to verify:
- Did the code actually run in an E2B sandbox?
- Was the sandbox fresh (no prior state)?
- Is the result cryptographically attested?

UTA can issue an ATC v3 card that captures this, and the downstream consumer can verify it independently.

## Discussion

This is exploratory. I'm asking:

1. Is sandbox attestation a use case E2B users have asked for?
2. If yes, would E2B expose sandbox metadata (sandbox ID, creation time, image hash) that UTA could attest?
3. If no, we'll publish a standalone wrapper that captures E2B metadata and issues ATC cards.

## References

- UTA repo: https://github.com/alicelabs-llc/universal-trust-adapter
- UTA issue endpoint: https://www.marketnow.site/api/trust?action=issue
- ATC v3 spec: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/spec/atc-v3.md
"""
    },
    # ============================================================
    # 7. Vercel AI SDK — trust verification for tool calls
    # ============================================================
    {
        "repo": "vercel/ai",
        "title": "RFC: trust-card verification hook for tool calls in AI SDK",
        "body": """## Context

The Vercel AI SDK's `tool()` function lets agents invoke arbitrary tools. For agents that touch production APIs, there's no canonical way to verify the *credential* for a tool before invocation.

## What I built

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

- 8 credential formats: ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509
- 12-stage verification pipeline
- 6,744 verifications/sec
- Public API: https://www.marketnow.site/api/trust
- TypeScript-first, zero runtime deps

## Proposal

An optional `trustVerifier` parameter on `tool()`:

```typescript
import { tool } from 'ai';
import { verify } from '@marketnow/trust-core';

export const myTool = tool({
  description: '...',
  parameters: z.object({ ... }),
  trustVerifier: async (credential) => {
    const result = await verify(credential);
    return result.decision === 'PERMIT';
  },
  execute: async (args) => {
    // ...
  },
});
```

When `trustVerifier` is set, the SDK calls it before `execute`. If it returns `false`, the SDK raises `ToolTrustError`.

## Non-goals

- Not asking the SDK to bundle UTA
- Not asking for changes to the core tool loop

## Ask

1. Is this in scope?
2. Would the verifier be sync or async?
3. Where should the exception live?

## References

- UTA repo: https://github.com/alicelabs-llc/universal-trust-adapter
- UTA NPM: `@marketnow/trust-core`
- UTA API: https://www.marketnow.site/api/trust
"""
    },
    # ============================================================
    # 8. promptfoo — red-teaming + trust verification tests
    # ============================================================
    {
        "repo": "promptfoo/promptfoo",
        "title": "Discussion: trust verification as a promptfoo test assertion",
        "body": """## Context

promptfoo tests prompts and agents with red-teaming assertions. For agents that verify credentials before calling tools, there's value in a `trust_verification` assertion: "did the agent correctly reject a tool with an invalid credential?"

## What I built

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

- 8 credential formats supported
- 12-stage verification pipeline
- Public test vectors: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/tests/conformance
- Includes **must-fail vectors** (expired, revoked, wrong-CA-key, tampered-payload)

## Why this fits promptfoo

promptfoo could add a `trust-verification` assertion type:

```yaml
tests:
  - description: 'Agent rejects expired credential'
    assert:
      - type: trust-verification
        value:
          credential: expired-jwt
          expected_decision: DENY
          expected_failed_stage: LIFECYCLE
```

The assertion would call UTA's verify endpoint and check the result matches expectations.

## Discussion

1. Is this a useful assertion type for promptfoo users?
2. If yes, would it live in promptfoo core, or as a plugin?
3. We can contribute the test vectors — 23 conformance vectors covering 8 formats.

## References

- UTA repo: https://github.com/alicelabs-llc/universal-trust-adapter
- UTA test vectors: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/tests/conformance
- UTA API: https://www.marketnow.site/api/trust
"""
    },
    # ============================================================
    # 9. SPIFFE — SPIFFE identity + UTA adapter
    # ============================================================
    {
        "repo": "spiffe/spiffe",
        "title": "Discussion: UTA adapter for SPIFFE/SPIRE workload identities",
        "body": """## Context

SPIFFE provides workload identity via SVIDs (SPIFFE Verifiable Identity Documents). UTA (Universal Trust Adapter) is a credential verification layer that supports 8 formats, and we have a SPIFFE adapter in development.

## What we built

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

- 8 credential formats: ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509
- 12-stage verification pipeline
- SPIFFE SVID adapter (work in progress)

## Why this fits SPIFFE

SPIFFE is the standard for workload identity in cloud-native environments. UTA's 12-stage pipeline could verify SPIFFE SVIDs alongside other credential formats, giving agents a unified verification layer:

- JWT-SVID (already supported via JWT adapter)
- X.509-SVID (already supported via X.509 adapter)
- SPIFFE trust domain verification (would need SPIFFE-specific logic)

## Discussion

1. Is there interest in a UTA adapter that treats SPIFFE SVIDs as first-class credentials alongside JWTs, W3C VCs, etc.?
2. If yes, what SPIFFE-specific verification should the adapter perform beyond standard JWT/X.509 verification?
3. We're happy to contribute the adapter to the SPIFFE ecosystem.

## References

- UTA repo: https://github.com/alicelabs-llc/universal-trust-adapter
- UTA adapters: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/adapters
- UTA SPIFFE adapter (WIP): see `adapters/spiffe.mjs`
"""
    },
    # ============================================================
    # 10. modelcontextprotocol/servers — list our MCP server
    # ============================================================
    {
        "repo": "modelcontextprotocol/servers",
        "title": "Add: MarketNow MCP Server — trust verification for MCP ecosystems",
        "body": """## What

**MarketNow MCP Server** — an MCP server that provides trust verification capabilities to AI agents.

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- NPM: `marketnow-mcp` (v1.10.1, 1,154 monthly downloads)
- API: https://www.marketnow.site/api/trust

## What it does

The MarketNow MCP server exposes UTA (Universal Trust Adapter) as an MCP tool. Agents can call it to verify credentials in 8 formats:

1. ATC v3 (Agent Trust Card)
2. JWT (with `x5c` chain)
3. W3C Verifiable Credentials
4. A2A (Agent-to-Agent) cards
5. EAT-AI (Entity Attestation Tokens)
6. ZTA (Zero Trust Agent) cards
7. MCP Server Cards
8. X.509 certificates

Through a 12-stage pipeline: `PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION`

## MCP tools exposed

- `verify_credential` — verify any credential, auto-detect format
- `translate_credential` — translate between formats (e.g., JWT → W3C VC)
- `issue_credential` — issue an ATC v3 card
- `bridge_credential` — verify in ecosystem A, issue in B
- `list_formats` — list supported formats

## Stats

- 6,744 verifications/sec (single core)
- 480+ tests
- 23 conformance vectors
- Public API: https://www.marketnow.site/api/trust

## Suggested entry

```
- [MarketNow MCP Server](https://github.com/alicelabs-llc/universal-trust-adapter) - Trust verification for AI agents. Verifies credentials in 8 formats (ATC, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP, X.509) through a 12-stage pipeline.
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
    except Exception as e:
        return f"EXCEPTION: {e}", None


print("=== STEP 3: Open issues in NEW external repos ===\n")
results = []
for i, issue in enumerate(ISSUES):
    print(f"[{i+1}/{len(ISSUES)}] {issue['repo']}: {issue['title'][:60]}...")
    url, num = open_issue(issue["repo"], issue["title"], issue["body"])
    print(f"   → {url}")
    results.append({"repo": issue["repo"], "title": issue["title"], "url": url, "number": num})
    time.sleep(3)  # be polite, avoid rate limit

print("\n=== EXTERNAL ISSUES SUMMARY ===")
ok = sum(1 for r in results if r["url"].startswith("https://"))
err = sum(1 for r in results if "ERROR" in r["url"] or "EXCEPTION" in r["url"])
print(f"  Opened: {ok}  Errors: {err}")
print()
for r in results:
    status = "✅" if r["url"].startswith("https://") else "❌"
    print(f"  {status} {r['repo']:40} #{r['number'] or '-'}  {r['url'][:90]}")

# Save
os.makedirs("/home/z/my-project/download/promotion", exist_ok=True)
with open("/home/z/my-project/download/promotion/new_external_issues_round2.json", "w") as f:
    json.dump(results, f, indent=2)
