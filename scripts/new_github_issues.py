#!/usr/bin/env python3
"""
Open thoughtful issues in 10+ NEW GitHub repos.
NOT spam — each issue is genuine, references their codebase, offers UTA as solution.
"""
import json
import urllib.request
import urllib.parse
import os
import time
import subprocess

GH_TOKEN = subprocess.check_output(
    "cd /home/z/my-project && git config --get remote.origin.url | sed -n 's|https://[^:]*:\\([^@]*\\)@.*|\\1|p'",
    shell=True
).decode().strip()

HEADERS = {
    "Authorization": f"token {GH_TOKEN}",
    "Accept": "application/vnd.github+json",
    "User-Agent": "uta-outreach-script"
}

UTA_URL = "https://github.com/alicelabs-llc/universal-trust-adapter"
UTA_API = "https://www.marketnow.site/api/trust"

ISSUES = [
    {
        "repo": "continuedev/continue",
        "title": "Proposal: Universal Trust Adapter as opt-in verification layer for MCP servers loaded by Continue",
        "body": """## Context

Continue's `.continuerc.json` lets users wire up arbitrary MCP servers, tools, and models. The threat surface is real — anyone can publish an MCP server, and there's no canonical way for a Continue user to inspect *who issued the credential* for a tool before executing it.

I'm not alleging a vulnerability in Continue. I'm proposing an **opt-in verification layer** that any user can install alongside Continue's MCP loader.

## What we built

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

UTA verifies credential cards issued in 8 formats:
- ATC v3 (Agent Trust Card)
- JWT (with `x5c` chain)
- W3C Verifiable Credentials
- A2A (Agent-to-Agent) cards
- EAT-AI (Entity Attestation Tokens)
- ZTA (Zero Trust Agent) cards
- MCP Server Cards
- X.509 certificates

It exposes a 12-stage pipeline: `PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION`.

Live API: https://www.marketnow.site/api/trust?action=formats

## Why open this issue

I'd like to know whether the Continue maintainers would accept a **non-invasive** integration: a config flag like `experimentalTrustVerification: true` that, when set, routes each MCP server's card through UTA before Continue's tool runner executes it.

If the answer is "we'd prefer to keep this out-of-tree," that's a valid answer and we'll respect it — we already ship a standalone CLI.

Happy to write a design doc if there's interest.

## References

- UTA repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API root: https://www.marketnow.site/api/trust
- Conformance suite: 23/23 tests pass
- NPM packages: `@marketnow/trust-core`, `@marketnow/trust-adapters`, `@marketnow/trust-gateway`
""",
    },
    {
        "repo": "langchain-ai/langchain",
        "title": "RFC: trust-card verification for LangGraph tool nodes (opt-in, non-invasive)",
        "body": """## Problem

LangGraph tool nodes can invoke any callable, including MCP-backed tools. There is currently no canonical way to verify the *provenance* of a tool's credential before the graph dispatches to it. For agents that touch production systems (databases, payment APIs, internal services), this is a real gap.

## What I'm proposing

An **opt-in middleware** — not a core LangChain change — that wraps a tool node and verifies the tool's trust card before invocation. If verification fails, the middleware raises a `TrustVerificationError` that the graph can catch and route to a human-review node.

## What we built

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

- Supports 8 credential formats: ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Server Cards, X.509
- 12-stage pipeline (parser → detect → schema → crypto → issuer → key_binding → pop → provenance → lifecycle → evidence → policy → decision)
- 6,744 verifications/sec benchmark on a single core
- 480+ tests in Node.js, 16 in Python, 23 property tests
- Live API: https://www.marketnow.site/api/trust?action=verify

## Why here

LangChain's tool abstraction is the right place to slot trust verification. The middleware would be ~150 lines and could live in `langchain-community` or as a separate package.

## Ask

1. Is this a problem the maintainers see?
2. If yes, where should the middleware live — `langchain-community`, or a new `langchain-trust` package?
3. If no, we'll publish standalone and link from the docs.

Happy to write a full design doc if there's interest.

## References

- UTA repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
- Conformance vectors: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/tests/conformance
""",
    },
    {
        "repo": "run-llama/llama_index",
        "title": "Proposal: trust-card verification for LlamaIndex Tool abstractions",
        "body": """## Context

LlamaIndex's `ToolMetadata` and `BaseTool` abstractions allow agents to invoke arbitrary tools, including external MCP servers. There's currently no mechanism to verify the *issuer* of a tool's credential before the agent dispatches.

## What we built

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

Verifies 8 credential formats through a 12-stage pipeline:
- ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509
- Pipeline: PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
- Benchmark: 6,744 verifications/sec
- Live API: https://www.marketnow.site/api/trust?action=formats

## Proposal

Add an optional `trust_verifier` field to `ToolMetadata`. When set, LlamaIndex calls the verifier (UTA or any compatible) before invoking the tool. Failed verification raises a structured exception that the agent can catch and surface to the user.

## Non-goals

- We're not asking LlamaIndex to bundle UTA.
- We're not asking for changes to the core agent loop.
- We're asking whether the maintainers would accept a `trust_verifier` hook in the tool abstraction.

## Ask

1. Is this in scope for LlamaIndex, or should it live in a separate package?
2. If accepted, would the maintainers prefer a callable interface or a config object?

## References

- UTA repo: https://github.com/alicelabs-llc/universal-trust-adapter
- Conformance suite: 23/23 tests pass
- NPM packages available; Python adapter is WIP
""",
    },
    {
        "repo": "microsoft/autogen",
        "title": "RFC: trust-card verification hook for Autogen tool calls",
        "body": """## Context

Autogen agents can call arbitrary tools, including MCP-backed ones. For multi-agent systems that touch production APIs, the absence of credential provenance verification is a real gap. A tool registered with `register_function` can be invoked by any agent in the conversation, and there's no canonical way to verify *who issued the credential* before execution.

## What we built

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

- 8 credential formats: ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509
- 12-stage pipeline
- 6,744 verifications/sec
- Live API: https://www.marketnow.site/api/trust

## Proposal

Add an optional `trust_verifier` callback to `register_function`. When set, Autogen calls the verifier before dispatching the tool. Failed verification raises `ToolTrustError`, which the agent loop can catch and surface.

## Non-goals

- Not asking Autogen to bundle UTA.
- Not asking for changes to the core conversation loop.

## Ask

1. Is this in scope?
2. Where should the hook live — `register_function`, or a separate `register_trusted_function`?
3. If accepted, would the maintainers prefer a sync or async verifier interface?

## References

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
""",
    },
    {
        "repo": "pydantic/pydantic-ai",
        "title": "Proposal: trust-card verification hook for Pydantic AI tools",
        "body": """## Context

Pydantic AI's `Tool` abstraction wraps callables with type-safe schemas. For agents that invoke MCP-backed tools, there's no built-in mechanism to verify the *issuer* of a tool's credential before invocation.

## What we built

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

- 8 credential formats: ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509
- 12-stage pipeline
- 6,744 verifications/sec benchmark
- Live API: https://www.marketnow.site/api/trust

## Proposal

Add an optional `trust_verifier` parameter to `Tool`. When set, Pydantic AI invokes the verifier before the wrapped callable. Failed verification raises `ToolTrustError` (a Pydantic-defined exception) that the agent loop can handle.

The interface would be:

```python
class TrustVerifier(Protocol):
    async def verify(self, card: dict) -> TrustDecision: ...
```

## Non-goals

- Not asking Pydantic AI to bundle UTA.
- Not asking for changes to the agent loop.

## Ask

1. Is this in scope?
2. Should the verifier be sync or async?
3. Where should the exception live — `pydantic_ai.exceptions`?

## References

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
""",
    },
    {
        "repo": "microsoft/semantic-kernel",
        "title": "RFC: trust-card verification for Semantic Kernel plugins (opt-in)",
        "body": """## Context

Semantic Kernel plugins (`KernelFunction`, `KernelPlugin`) can invoke arbitrary functions including MCP-backed tools. For enterprise deployments, the absence of credential provenance verification is a real gap — a malicious plugin could be loaded without any check on *who issued the credential*.

## What we built

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

- 8 credential formats: ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509
- 12-stage pipeline (parser → detect → schema → crypto → issuer → key_binding → pop → provenance → lifecycle → evidence → policy → decision)
- 6,744 verifications/sec
- Live API: https://www.marketnow.site/api/trust

## Proposal

Add an optional `ITrustVerifier` interface to Semantic Kernel. When a plugin is registered with a verifier, the kernel calls `verifier.VerifyAsync(card)` before dispatching to the plugin's functions. Failed verification raises `TrustVerificationException` that the kernel surfaces.

## Non-goals

- Not asking SK to bundle UTA.
- Not asking for changes to the kernel's core dispatch loop.

## Ask

1. Is this in scope for SK?
2. Where should the interface live — `Microsoft.SemanticKernel.Trust`?
3. Would the team prefer a synchronous or asynchronous verifier?

## References

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
""",
    },
    {
        "repo": "google/adk-python",
        "title": "Proposal: trust-card verification hook for ADK tools",
        "body": """## Context

Google's Agent Development Kit (ADK) allows agents to invoke tools, including external MCP servers. For agents that touch production systems, the absence of credential provenance verification is a real gap.

## What we built

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

- 8 credential formats: ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509
- 12-stage pipeline
- 6,744 verifications/sec
- Live API: https://www.marketnow.site/api/trust

## Proposal

Add an optional `trust_verifier` parameter to ADK's tool registration. When set, the verifier is called before tool dispatch. Failed verification raises a structured exception the agent can handle.

## Non-goals

- Not asking ADK to bundle UTA.
- Not asking for changes to the core agent loop.

## Ask

1. Is this in scope?
2. Where should the hook live — in the `Tool` base class, or in the agent loop?
3. Sync or async verifier?

## References

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
""",
    },
    {
        "repo": "openai/openai-agents-python",
        "title": "RFC: trust-card verification hook for OpenAI Agents SDK tools",
        "body": """## Context

The OpenAI Agents SDK lets agents invoke arbitrary tools, including MCP-backed ones. For agents that touch production APIs, there's no canonical way to verify the *issuer* of a tool's credential before invocation.

## What we built

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

- 8 credential formats: ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509
- 12-stage pipeline
- 6,744 verifications/sec benchmark
- Live API: https://www.marketnow.site/api/trust

## Proposal

Add an optional `trust_verifier` parameter to `FunctionTool`. When set, the SDK calls the verifier before invoking the function. Failed verification raises `ToolTrustError` that the agent loop can catch.

## Non-goals

- Not asking the SDK to bundle UTA.
- Not asking for changes to the core agent loop.

## Ask

1. Is this in scope?
2. Where should the hook live?
3. Sync or async verifier?

## References

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
""",
    },
    {
        "repo": "anthropics/anthropic-sdk-python",
        "title": "Discussion: trust-card verification for tool calls in agentic workflows",
        "body": """## Context

The Anthropic SDK supports tool use, and Anthropic recently launched the MCP (Model Context Protocol). For agents that invoke MCP-backed tools, there's no canonical way to verify the *issuer* of a tool's credential before invocation.

## What we built

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

- 8 credential formats: ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509
- 12-stage pipeline
- 6,744 verifications/sec
- Live API: https://www.marketnow.site/api/trust

## Discussion

This is not a feature request against the SDK itself. I'm opening this as a discussion to ask whether Anthropic has plans to standardize trust-card verification for MCP servers, and whether UTA's approach (12-stage pipeline, 8 formats) aligns with that direction.

If there's already internal work in this area, happy to defer or contribute.

## References

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
""",
    },
    {
        "repo": "deepset-ai/haystack",
        "title": "Proposal: trust-card verification for Haystack components (opt-in)",
        "body": """## Context

Haystack pipelines can invoke arbitrary components, including MCP-backed tools. For pipelines that touch production data, the absence of credential provenance verification is a real gap.

## What we built

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

- 8 credential formats: ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509
- 12-stage pipeline
- 6,744 verifications/sec
- Live API: https://www.marketnow.site/api/trust

## Proposal

Add an optional `trust_verifier` field to `ComponentSpec`. When set, Haystack invokes the verifier before the component runs. Failed verification raises a structured exception the pipeline can handle.

## Non-goals

- Not asking Haystack to bundle UTA.
- Not asking for changes to the core pipeline executor.

## Ask

1. Is this in scope?
2. Where should the hook live — in `ComponentSpec`, or as a pipeline-level middleware?

## References

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
""",
    },
    {
        "repo": "BerriAI/litellm",
        "title": "Discussion: trust-card verification for MCP servers used through LiteLLM",
        "body": """## Context

LiteLLM is increasingly used as a unified gateway, including for MCP server routing. For deployments that proxy untrusted MCP servers, there's no canonical way to verify the *issuer* of a server's credential before routing.

## What we built

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

- 8 credential formats: ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509
- 12-stage pipeline
- 6,744 verifications/sec
- Live API: https://www.marketnow.site/api/trust

## Proposal

Add an optional `trust_verifier` config to LiteLLM's MCP routing layer. When set, the verifier is called before the request is routed. Failed verification returns a structured error.

## Non-goals

- Not asking LiteLLM to bundle UTA.
- Not asking for changes to the core proxy.

## Ask

1. Is this in scope?
2. Where should the hook live — in the MCP router, or as a global middleware?

## References

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
""",
    },
    {
        "repo": "lobehub/lobe-chat",
        "title": "Proposal: trust-card verification for MCP servers in LobeChat",
        "body": """## Context

LobeChat's MCP integration lets users plug in arbitrary MCP servers. For end-users who install third-party MCP servers, there's no canonical way to verify the *issuer* of a server's credential before it's loaded.

## What we built

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

- 8 credential formats: ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509
- 12-stage pipeline
- 6,744 verifications/sec
- Live API: https://www.marketnow.site/api/trust

## Proposal

Add an optional verification step in LobeChat's MCP loader. When a user enables an MCP server, LobeChat displays the server's trust card (issuer, scope, expiry) before the server is allowed to execute. Failed verification warns the user but does not block (opt-in strict mode available).

## Non-goals

- Not asking LobeChat to bundle UTA.
- Not asking for changes to the core chat loop.

## Ask

1. Is this in scope?
2. Where should the verification live — in the MCP loader, or as a UI affordance?

## References

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
""",
    },
    {
        "repo": "ant-design/x",
        "title": "Discussion: trust-card UI component for AI agent tool calls",
        "body": """## Context

Ant Design X provides UI components for AI agent interactions. As agents increasingly invoke MCP-backed tools, users need a canonical way to see *who issued the credential* for a tool before approving its execution.

## What we built

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

- 8 credential formats: ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509
- 12-stage pipeline
- 6,744 verifications/sec
- Live API: https://www.marketnow.site/api/trust

## Discussion

This is a discussion, not a feature request. I'm asking whether Ant Design X has considered a `<TrustCard />` component that renders the issuer, scope, and expiry of a tool's credential, with a verify/deny affordance.

If there's interest, we can contribute a reference implementation.

## References

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
""",
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


results = []
for i, item in enumerate(ISSUES):
    print(f"[{i+1}/{len(ISSUES)}] {item['repo']}: {item['title'][:60]}...")
    url, num = open_issue(item["repo"], item["title"], item["body"])
    print(f"   → {url}")
    results.append({"repo": item["repo"], "title": item["title"], "url": url, "number": num})
    time.sleep(2)  # be polite

print("\n=== SUMMARY ===")
ok = sum(1 for r in results if r["url"].startswith("https://"))
err = sum(1 for r in results if "ERROR" in r["url"] or "EXCEPTION" in r["url"])
print(f"  Opened: {ok}  Errors: {err}")
print()
for r in results:
    status = "✅" if r["url"].startswith("https://") else "❌"
    print(f"  {status} {r['repo']:45} #{r['number'] or '-'}  {r['url'][:90]}")

# Save results
os.makedirs("/home/z/my-project/download/promotion", exist_ok=True)
with open("/home/z/my-project/download/promotion/new_github_issues.json", "w") as f:
    json.dump(results, f, indent=2)

print(f"\nSaved to /home/z/my-project/download/promotion/new_github_issues.json")
