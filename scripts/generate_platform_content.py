#!/usr/bin/env python3
"""
Generate ready-to-post content for 15+ external platforms:
- Reddit (15 subreddits, each tailored)
- Medium (5 languages)
- Menéame (Spanish HN)
- Qiita (Japanese)
- Habr (Russian)
- V2EX (Chinese)
- Juejin (Chinese)
- iMasters (Brazilian)
- LinuxFr (French)
- Heise (German)
- AlternativeTo (listing)
- SaaSHub (listing)
- Indie Hackers
- Lobste.rs
- Hashnode
- Substack
- Mastodon / Bluesky / Twitter / LinkedIn
"""
import os
import json

OUT = "/home/z/my-project/download/promotion/platforms"
os.makedirs(OUT, exist_ok=True)

UTA = "https://github.com/alicelabs-llc/universal-trust-adapter"
API = "https://www.marketnow.site/api/trust"

# ============================================================
# REDDIT — 15 subreddit posts, each tailored to its community
# ============================================================
REDDIT_SUBS = [
    ("r_cursor", "r/cursor", """**Title:** Built a credential verification layer for MCP servers Cursor loads — looking for feedback from Cursor users

**Body:**

Hey r/cursor —

I've been using Cursor's MCP integration heavily, and one thing kept bugging me: when I wire up a third-party MCP server in `.cursor/mcp.json`, there's no canonical way to verify *who issued the credential* for that server before Cursor lets it touch my codebase.

So I built **Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

It verifies credentials in 8 formats:
- ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Server Cards, X.509

Through a 12-stage pipeline: `PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION`

**Benchmarks:**
- 6,744 verifications/sec (single core)
- 480+ tests, 23 property tests
- Public API: https://www.marketnow.site/api/trust

**For Cursor users specifically:**
You could write a tiny script that verifies each MCP server's card before Cursor loads it. I wrote a 15-language snippet collection here: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/snippets

Not asking Cursor to bundle this — just wondering if other Cursor users see the same gap.

Thoughts?
"""),
    ("r_ClaudeAI", "r/ClaudeAI", """**Title:** Built a verification layer for MCP servers (the protocol Anthropic launched) — looking for feedback

**Body:**

Hey r/ClaudeAI —

Anthropic launched MCP (Model Context Protocol) last year. It's a great protocol, but I noticed a gap: when an agent loads an MCP server, there's no canonical way to verify *who issued the credential* for that server before the agent executes its tools.

I built **Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

UTA verifies credentials in 8 formats (MCP Server Cards natively, plus 7 others: ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, X.509) through a 12-stage pipeline.

**Stats:**
- 6,744 verifications/sec
- 480+ tests
- Public API: https://www.marketnow.site/api/trust

The MCP Server Card format is one of the 8 native formats. If you're building Claude agents that invoke MCP servers, UTA can verify the server's card before Claude executes.

Would love feedback from the community. Is this a gap you've hit?
"""),
    ("r_OpenAI", "r/OpenAI", """**Title:** Built a verification layer for tool credentials in OpenAI Agents SDK — RFC open

**Body:**

Hey r/OpenAI —

When OpenAI Agents SDK agents invoke tools (including MCP-backed ones), there's no canonical way to verify *who issued the credential* for a tool before the agent dispatches.

I built **Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

- 8 credential formats: ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509
- 12-stage pipeline
- 6,744 verifications/sec
- Public API: https://www.marketnow.site/api/trust

I opened an RFC issue in the OpenAI Agents SDK repo proposing an optional `trust_verifier` hook: https://github.com/openai/openai-agents-python/issues/4806

Not asking them to bundle UTA — just proposing a hook so any verifier can plug in.

Would love feedback from this community before the SDK team responds.
"""),
    ("r_MachineLearning", "r/MachineLearning", """**Title:** [D] Universal Trust Adapter — credential verification for AI agent tool calls (8 formats, 12-stage pipeline)

**Body:**

I've been working on a verification layer for AI agent tool calls. The gap: when an agent invokes a tool (MCP server, API, microservice), there's no canonical way to verify *who issued the credential* for that tool before the agent dispatches.

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

UTA supports 8 credential formats:
- ATC v3 (Agent Trust Card)
- JWT (with `x5c` chain)
- W3C Verifiable Credentials
- A2A (Agent-to-Agent) cards
- EAT-AI (Entity Attestation Tokens)
- ZTA (Zero Trust Agent) cards
- MCP Server Cards
- X.509 certificates

Through a 12-stage pipeline: `PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION`

**Benchmarks:**
- 6,744 verifications/sec (single core)
- 480+ tests, 23 property tests
- Public API: https://www.marketnow.site/api/trust

**Discussion questions:**
1. Has anyone here hit the "unverified tool credential" problem in production?
2. Is a 12-stage pipeline overkill, or about right?
3. Are there credential formats I'm missing that you'd want supported?

I've opened RFC issues in LangChain, LlamaIndex, AutoGen, Pydantic AI, Semantic Kernel, Google ADK, OpenAI Agents SDK, Anthropic SDK, Haystack, LiteLLM, Continue, and Ant Design X. Links in the repo.
"""),
    ("r_programming", "r/programming", """**Title:** Built a 12-stage credential verification pipeline for AI agents — supports 8 formats (JWT, W3C VC, X.509, MCP, ATC, A2A, EAT-AI, ZTA)

**Body:**

Hey r/programming —

I open-sourced a credential verification layer for AI agents: **Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

The problem: when an agent invokes a tool, there's no canonical way to verify *who issued the credential* for that tool. Each standard (OAuth/JWT, X.509, W3C VC, MCP Cards, etc.) answers the question differently, and agents don't know which standard to use.

UTA unifies them:
- 8 credential formats supported
- 12-stage pipeline (parser → detect → schema → crypto → issuer → key_binding → pop → provenance → lifecycle → evidence → policy → decision)
- 6,744 verifications/sec on a single core
- 480+ tests, 23 property tests
- 15-language snippet collection (Node.js, Python, Rust, Go, Ruby, PHP, Java, C#, Elixir, Swift, Kotlin, Lua, Deno, Bash)
- 7 multilingual READMEs (EN, ES, PT, FR, DE, JA, ZH, RU)

Public API: https://www.marketnow.site/api/trust

I'm not claiming UTA is the right design — I'm asking the community whether the 12-stage decomposition makes sense, and whether 8 formats is the right scope.

Repo: https://github.com/alicelabs-llc/universal-trust-adapter

Curious what HN/Reddit thinks.
"""),
    ("r_typescript", "r/typescript", """**Title:** Built a TypeScript credential verification library — 8 formats, 12-stage pipeline, 6.7k verifications/sec

**Body:**

Hey r/typescript —

Open-sourced a TypeScript library: **@marketnow/trust-core** — https://github.com/alicelabs-llc/universal-trust-adapter

It verifies AI agent credentials in 8 formats (ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509) through a 12-stage pipeline.

```typescript
import { verify } from '@marketnow/trust-core';

const result = await verify(card);
// result.decision: 'PERMIT' | 'DENY' | 'UNDETERMINED'
// result.detected_format: 'JWT' | 'W3C_VC' | 'MCP_CARD' | ...
// result.stages: { PARSER: 'OK', DETECT: 'JWT', CRYPTO: 'OK', ... }
```

**Stats:**
- 6,744 verifications/sec (single core)
- 480+ tests
- 23 property tests
- Zero runtime dependencies (only crypto primitives)
- TypeScript-first, ESM/CJS dual build
- Public API also available: https://www.marketnow.site/api/trust

Curious what TypeScript devs think of the API shape. Repo: https://github.com/alicelabs-llc/universal-trust-adapter
"""),
    ("r_node", "r/node", """**Title:** @marketnow/trust-core — Node.js library to verify AI agent credentials (8 formats, 6.7k/sec)

**Body:**

Hey r/node —

Published a Node.js library: **@marketnow/trust-core** — verifies AI agent credentials in 8 formats.

```bash
npm install @marketnow/trust-core
```

```javascript
import { verify } from '@marketnow/trust-core';

const result = await verify(jwtCard);
console.log(result.decision); // 'PERMIT' | 'DENY' | 'UNDETERMINED'
```

**8 formats:** ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509

**12-stage pipeline:** PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION

**Benchmarks:**
- 6,744 verifications/sec (single core)
- 480+ tests
- ESM + CJS dual build
- Zero runtime dependencies (Node.js crypto only)

Repo: https://github.com/alicelabs-llc/universal-trust-adapter
API: https://www.marketnow.site/api/trust

Curious what Node devs think.
"""),
    ("r_python", "r/python", """**Title:** Python adapter for Universal Trust Adapter — verify AI agent credentials in 8 formats

**Body:**

Hey r/python —

I built a credential verification layer for AI agents and wrote a Python adapter: **marketnow-trust** on PyPI.

```python
from marketnow_trust import verify

result = verify(card)
if result.decision == 'PERMIT':
    execute_tool()
else:
    log_failure(result.failed_stage)
```

**8 formats supported:** ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509

**12-stage pipeline:** parser → detect → schema → crypto → issuer → key_binding → pop → provenance → lifecycle → evidence → policy → decision

**Benchmarks:**
- 6,744 verifications/sec (single core, Node.js core; Python adapter calls the API)
- 16 tests in Python adapter
- 23 property tests in conformance suite

The Python adapter calls the public API (https://www.marketnow.site/api/trust) so no native crypto deps needed.

Repo: https://github.com/alicelabs-llc/universal-trust-adapter
Snippets: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/snippets/python

I opened RFC issues in LangChain, LlamaIndex, AutoGen, Pydantic AI, Google ADK, and Haystack proposing optional `trust_verifier` hooks. Links in the repo.

Curious what r/python thinks of the API shape.
"""),
    ("r_SaaS", "r/SaaS", """**Title:** Built an open-source credential verification layer for AI agents — looking for feedback from SaaS founders

**Body:**

Hey r/SaaS —

I'm building an open-source project called **Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

The pitch: when AI agents invoke tools (MCP servers, APIs), there's no canonical way to verify *who issued the credential* for that tool. UTA verifies credentials in 8 formats through a 12-stage pipeline.

**Why I'm posting here:**

If you're building a SaaS that uses AI agents (and most of you are), you'll hit this problem eventually: an agent invokes a tool, and you have no idea if the credential for that tool is valid, who issued it, or whether it's been revoked.

UTA solves this. It's open-source (Apache 2.0), has a public API (https://www.marketnow.site/api/trust), and NPM packages.

**Stats:**
- 6,744 verifications/sec
- 480+ tests
- 15-language snippet collection
- 7 multilingual READMEs

**Business model:** open-source core + hosted API with rate limits + enterprise self-hosted.

Looking for:
1. Feedback from SaaS founders who have AI agents in production
2. Beta testers for the hosted API
3. Anyone who wants to integrate UTA into their agent stack

Repo: https://github.com/alicelabs-llc/universal-trust-adapter
"""),
    ("r_Entrepreneur", "r/Entrepreneur", """**Title:** Open-sourced a credential verification layer for AI agents — would love feedback from fellow founders

**Body:**

Hey r/Entrepreneur —

I just open-sourced **Universal Trust Adapter (UTA)** — a credential verification layer for AI agents.

**The problem I saw:** AI agents invoke tools (MCP servers, APIs, microservices), but there's no canonical way to verify *who issued the credential* for a tool before the agent executes. Each standard (OAuth, X.509, W3C VC, MCP Cards) answers the question differently.

**What I built:** UTA verifies credentials in 8 formats through a 12-stage pipeline. 6,744 verifications/sec, 480+ tests, public API.

**Repo:** https://github.com/alicelabs-llc/universal-trust-adapter

**Why I'm posting here:**

I'd love feedback from fellow entrepreneurs on the open-source-as-distribution-strategy angle. The thesis:
- Open-source the core verifier (Apache 2.0)
- Hosted API with rate limits (free tier)
- Enterprise self-hosted (paid)
- Conformance suite and certification (paid, future)

If you've built a SaaS with an open-source core, I'd love to hear your experience. Did the open-source distribution actually drive adoption? What would you do differently?

Not linking to a landing page — the repo is the landing page.
"""),
    ("r_devops", "r/devops", """**Title:** Built a credential verification layer for AI agents — useful for DevOps teams running agent fleets

**Body:**

Hey r/devops —

If you're running fleets of AI agents in production (and increasingly, you are), you've probably hit this: an agent invokes a tool (MCP server, internal API), and you have no idea if the credential for that tool is valid, who issued it, or whether it's been revoked.

I built **Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

- Verifies credentials in 8 formats (ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509)
- 12-stage pipeline (parser → detect → schema → crypto → issuer → key_binding → pop → provenance → lifecycle → evidence → policy → decision)
- 6,744 verifications/sec (single core)
- Public API: https://www.marketnow.site/api/trust
- Bash CLI: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/snippets/bash
- Docker-friendly, zero external deps in core

For DevOps: UTA can run as a sidecar that verifies every credential an agent presents before the agent's tool call is dispatched. Failed verification → structured log + metric + optional block.

Curious what r/devops thinks of the sidecar approach vs. in-process verification.
"""),
    ("r_cybersecurity", "r/cybersecurity", """**Title:** Open-sourced a 12-stage credential verification pipeline for AI agents — feedback wanted from security folks

**Body:**

Hey r/cybersecurity —

I open-sourced a credential verification layer for AI agents: **Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

The problem: when an AI agent invokes a tool (MCP server, API), there's no canonical way to verify the credential for that tool. Each standard (OAuth, X.509, W3C VC, MCP Cards) handles verification differently, and agents don't know which standard to use.

UTA's 12-stage pipeline:
```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

**8 formats:** ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509

**What I'd love feedback on from security folks:**
1. Is the 12-stage decomposition sound, or am I missing stages?
2. The `POP` (proof-of-possession) stage — is it adequately specified?
3. The `EVIDENCE` stage — what should it log for auditability?
4. The `POLICY` stage — should UTA ship default policies, or stay policy-neutral?

**Threat model:** https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/THREAT_MODEL.md
**Conformance suite:** 23/23 tests pass. Test vectors public.

Repo: https://github.com/alicelabs-llc/universal-trust-adapter
"""),
    ("r_netsec", "r/netsec", """**Title:** Universal Trust Adapter — 12-stage credential verification pipeline for AI agents (open source)

**Body:**

Cross-posting from r/cybersecurity — looking for feedback from this community specifically on the cryptographic design.

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

**12-stage pipeline:**
```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

**8 credential formats supported:**
- ATC v3 (Agent Trust Card)
- JWT (with `x5c` chain)
- W3C Verifiable Credentials
- A2A (Agent-to-Agent) cards
- EAT-AI (Entity Attestation Tokens)
- ZTA (Zero Trust Agent) cards
- MCP Server Cards
- X.509 certificates

**Key design questions I'd love input on:**
1. The KEY_BINDING stage checks that the signing key is bound to the declared issuer. Should this be done via DID resolution, X.509 chain validation, or both?
2. The POP stage requires the presenter to prove possession of the private key. Currently using challenge-response. Any pitfalls?
3. The LIFECYCLE stage checks revocation via CRL, OCSP, and Bitstring Status List. Any other revocation mechanisms worth supporting?

**Public test vectors:** https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/tests/conformance
**Test CA private key published** for reproducibility (test-only, not for production).

**Conformance suite: 23/23 tests pass.**

Repo: https://github.com/alicelabs-llc/universal-trust-adapter
"""),
    ("r_AIAgents", "r/AIAgents", """**Title:** Built a credential verification layer for AI agents — 8 formats, 12-stage pipeline, open source

**Body:**

Hey r/AIAgents —

When AI agents invoke tools (MCP servers, APIs, microservices), there's no canonical way to verify *who issued the credential* for that tool. I built UTA to fix this.

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

**8 formats:** ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509

**12-stage pipeline:** parser → detect → schema → crypto → issuer → key_binding → pop → provenance → lifecycle → evidence → policy → decision

**Stats:**
- 6,744 verifications/sec (single core)
- 480+ tests, 23 property tests
- Public API: https://www.marketnow.site/api/trust
- 15-language snippet collection
- 7 multilingual READMEs (EN, ES, PT, FR, DE, JA, ZH, RU)

**Why this matters for agent builders:**
If you're building agents that touch production systems, you need a way to verify the credentials those agents present. UTA gives you a single API that works across 8 formats.

I opened RFC issues in 12+ agent framework repos (LangChain, LlamaIndex, AutoGen, Pydantic AI, Semantic Kernel, Google ADK, OpenAI Agents SDK, Anthropic SDK, Haystack, LiteLLM, Continue, Ant Design X) proposing optional trust verification hooks.

Repo: https://github.com/alicelabs-llc/universal-trust-adapter

Curious what r/AIAgents thinks.
"""),
    ("r_IndieDev", "r/IndieDev", """**Title:** Open-sourced a credential verification layer for AI agents — looking for feedback from indie devs

**Body:**

Hey r/IndieDev —

I'm a solo dev who just open-sourced a project: **Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

It verifies AI agent credentials in 8 formats (JWT, W3C VC, X.509, MCP Cards, ATC v3, A2A, EAT-AI, ZTA) through a 12-stage pipeline.

**Stats:**
- 6,744 verifications/sec
- 480+ tests
- 15-language snippet collection
- 7 multilingual READMEs
- Public API: https://www.marketnow.site/api/trust

**Why I'm posting here:**

I want to be honest about the indie dev experience. Building this solo took ~3 months. The hardest parts:
1. **Multi-format support** — each credential format has its own quirks. JWT's `x5c` chain is different from X.509's PEM chain is different from W3C VC's `proof.verificationMethod`.
2. **Conformance testing** — building 23 property tests that catch real bugs was harder than building the verifier itself.
3. **Documentation in 7 languages** — I'm a native Spanish speaker. Translating technical docs to JP/CN/RU was humbling.

If you're an indie dev building in the AI agent space, I'd love to hear your experience. What's harder than you expected?

Repo: https://github.com/alicelabs-llc/universal-trust-adapter
"""),
]

for fname, sub, content in REDDIT_SUBS:
    path = os.path.join(OUT, f"reddit_{fname}.md")
    with open(path, "w") as f:
        f.write(f"<!-- Target: {sub} -->\n<!-- Post type: text post -->\n\n{content}")
    print(f"  ✅ reddit_{fname}.md → {sub}")

# ============================================================
# MEDIUM (multi-language) — 5 articles
# ============================================================
MEDIUM_ARTICLES = [
    ("medium_en.md", "English", """# Universal Trust Adapter: The USB-C of Trust Between AI Agents

*How a 12-stage pipeline verifies credentials in 8 formats — and why it matters for the next decade of AI agent security.*

## The problem

When an AI agent invokes a tool — an MCP server, an internal API, a microservice — there's no canonical way to answer three basic questions:

1. **Who issued the credential** for that tool?
2. **Until when is it valid**?
3. **What scope does it have** — what can and can't it do?

If you come from the OAuth world, this sounds familiar. From X.509, too. From W3C Verifiable Credentials, likewise. The problem is that **each standard answers the question differently**, and AI agents don't know which standard to use.

## The solution: UTA

**Universal Trust Adapter** — https://github.com/alicelabs-llc/universal-trust-adapter

UTA is a universal verifier that accepts **8 credential formats**:

| # | Format | Origin |
|---|--------|--------|
| 1 | ATC v3 (Agent Trust Card) | AliceLabs proposal |
| 2 | JWT (with `x5c` chain) | IETF RFC 7519 |
| 3 | W3C Verifiable Credentials | W3C VC Data Model |
| 4 | A2A (Agent-to-Agent) cards | Google A2A Protocol |
| 5 | EAT-AI (Entity Attestation Tokens) | IETF RATS |
| 6 | ZTA (Zero Trust Agent) cards | ZTA variant |
| 7 | MCP Server Cards | Anthropic MCP |
| 8 | X.509 certificates | ITU-T |

And processes them through a **12-stage pipeline**:

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

## How to use it

### Option A: Public API

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \\
  -H "Content-Type: application/json" \\
  -d '{"card": "...your JWT or VC here..."}'
```

### Option B: NPM package

```bash
npm install @marketnow/trust-core
```

```javascript
import { verify } from '@marketnow/trust-core';

const result = await verify(card);
if (result.decision === 'PERMIT') {
  // tool is trusted, execute it
} else {
  console.log(result.failed_stage);
}
```

## Benchmarks

- **6,744 verifications per second** on a single core
- **480+ tests** in Node.js
- **16 tests** in Python (adapter)
- **23 property tests** (conformance suite)

## Why this matters now

AI agents are moving from demos to production. In production, the question "who issued this credential?" goes from theoretical to critical. A misconfigured MCP server, a leaked JWT, a revoked X.509 — any of these can compromise an agent's tool chain.

UTA gives you a single verification layer that works across 8 formats. You don't have to pick a standard; UTA accepts all of them.

## What UTA does NOT solve

Honesty:

- **Reputation layer**: UTA verifies the cryptography and the issuer, but doesn't solve "is this issuer trustworthy?". That requires a separate reputation graph.
- **EAT-AI and ZTA** are in beta — the formats are implemented but adoption is low.
- **Policy engine**: the POLICY stage accepts any policy you implement, but UTA doesn't ship predefined policies.

## Conclusion

Trust between agents is not a cryptography problem. It's an **interoperability problem**. UTA doesn't invent a new standard — it connects the ones that exist.

If you're building AI agents, this is the moment to contribute to the trust layer. We provide the infrastructure; you provide the use cases.

---

*Repo: [alicelabs-llc/universal-trust-adapter](https://github.com/alicelabs-llc/universal-trust-adapter) · API: [marketnow.site/api/trust](https://www.marketnow.site/api/trust) · NPM: `@marketnow/trust-core`*

*This article is also available in: [Español](#) · [Português](#) · [Français](#) · [Deutsch](#)*
"""),
    ("medium_es.md", "Español", """# Universal Trust Adapter: el USB-C de la confianza entre agentes IA

*Cómo un pipeline de 12 etapas verifica credenciales en 8 formatos — y por qué importa para la próxima década de seguridad en agentes IA.*

[Artículo completo en Dev.to — versión en español](https://dev.to/edison_flores_6d2cd381b13/universal-trust-adapter-el-usb-c-de-la-confianza-entre-agentes-ia-en-espanol-1glk)

## Resumen

UTA verifica credenciales en 8 formatos (ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509) a través de un pipeline de 12 etapas.

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
- Benchmarks: 6,744 verificaciones/segundo

Lee el artículo completo en Dev.to (link arriba).
"""),
    ("medium_pt.md", "Português", """# Universal Trust Adapter: o USB-C da confiança entre agentes de IA

*Como um pipeline de 12 etapas verifica credenciais em 8 formatos — e por que isso importa para a próxima década de segurança em agentes de IA.*

[Artigo completo em Dev.to — versão em português](https://dev.to/edison_flores_6d2cd381b13/universal-trust-adapter-o-usb-c-da-confianca-entre-agentes-de-ia-em-portugues-1hcl)

## Resumo

UTA verifica credenciais em 8 formatos (ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509) através de um pipeline de 12 etapas.

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
- Benchmarks: 6.744 verificações/segundo

Leia o artigo completo em Dev.to (link acima).
"""),
    ("medium_fr.md", "Français", """# Universal Trust Adapter : le USB-C de la confiance entre agents IA

*Comment un pipeline de 12 étapes vérifie les crédentials en 8 formats — et pourquoi cela compte pour la prochaine décennie de sécurité des agents IA.*

[Article complet sur Dev.to — version française](https://dev.to/edison_flores_6d2cd381b13/universal-trust-adapter-le-usb-c-de-la-confiance-entre-agents-ia-en-francais-3ojk)

## Résumé

UTA vérifie les crédentials en 8 formats (ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509) via un pipeline de 12 étapes.

- Repo : https://github.com/alicelabs-llc/universal-trust-adapter
- API : https://www.marketnow.site/api/trust
- Benchmarks : 6 744 vérifications/seconde

Lire l'article complet sur Dev.to (lien ci-dessus).
"""),
    ("medium_de.md", "Deutsch", """# Universal Trust Adapter: Das USB-C der Vertrauensstellung zwischen KI-Agenten

*Wie eine 12-stufige Pipeline Credentials in 8 Formaten verifiziert — und warum das für das nächste Jahrzehnt der KI-Agenten-Sicherheit wichtig ist.*

[Vollständiger Artikel auf Dev.to — deutsche Version](https://dev.to/edison_flores_6d2cd381b13/universal-trust-adapter-das-usb-c-der-vertrauensstellung-zwischen-ki-agenten-auf-deutsch-52k5)

## Zusammenfassung

UTA verifiziert Credentials in 8 Formaten (ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509) durch eine 12-stufige Pipeline.

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
- Benchmarks: 6.744 Verifizierungen/Sekunde

Vollständigen Artikel auf Dev.to lesen (Link oben).
"""),
]

for fname, lang, content in MEDIUM_ARTICLES:
    path = os.path.join(OUT, fname)
    with open(path, "w") as f:
        f.write(f"<!-- Platform: Medium.com -->\n<!-- Language: {lang} -->\n<!-- Status: ready to paste into Medium editor -->\n\n{content}")
    print(f"  ✅ {fname} → Medium ({lang})")

# ============================================================
# NON-ENGLISH PLATFORMS
# ============================================================

# Menéame (Spanish HN equivalent)
with open(os.path.join(OUT, "meneame_es.md"), "w") as f:
    f.write("""<!-- Platform: meneame.net (Spanish Hacker News equivalent) -->
<!-- Submission type: story -->
<!-- Category: tecnología -->
<!-- Title max: ~80 chars -->

**Título:** Universal Trust Adapter: el USB-C de la confianza entre agentes IA

**URL a enviar:** https://github.com/alicelabs-llc/universal-trust-adapter

**Descripción (máx 500 chars):**

UTA es un verificador universal de credenciales para agentes IA. Soporta 8 formatos (ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509) a través de un pipeline de 12 etapas. 6.744 verificaciones/segundo, 480+ tests, API pública. Open source (Apache 2.0). Pensado para dev hispanohablantes — README en español disponible.

**Tags sugeridos:** IA, seguridad, open source, criptografía

**Notas:**
- Menéame requiere cuenta con karma. Si no tienes, pide a un amigo con karma que la envíe.
- La comunidad valora títulos descriptivos, no clickbait.
- Si llega a portada, tráfico masivo (10k-100k visitas en 24h).
""")

# Qiita (Japanese dev platform)
with open(os.path.join(OUT, "qiita_ja.md"), "w") as f:
    f.write("""<!-- Platform: qiita.com (Japanese dev platform, ~10M monthly users) -->
<!-- Submission type: article -->
<!-- Language: Japanese -->
<!-- Tags: AI, セキュリティ, 認証, MCP -->

# AIエージェントのクレデンシャル検証：8つの形式を統一する12段階パイプライン

## はじめに

AIエージェントがツール（MCPサーバー、内部API、マイクロサービス）を呼び出す際、そのツールのクレデンシャルが「誰が発行したか」「いつまで有効か」「スコープは何か」を検証する標準的な方法がありません。

各標準（OAuth、X.509、W3C VC、MCP Cardsなど）は異なる方法でこれに答えます。UTAはこれらを統一します。

## UTAとは

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

8つのクレデンシャル形式をサポート：

1. ATC v3 (Agent Trust Card)
2. JWT (`x5c` chain付き)
3. W3C Verifiable Credentials
4. A2A (Agent-to-Agent) cards
5. EAT-AI (Entity Attestation Tokens)
6. ZTA (Zero Trust Agent) cards
7. MCP Server Cards
8. X.509 certificates

12段階のパイプラインで処理：

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

## 使い方

### 公開API

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \\
  -H "Content-Type: application/json" \\
  -d '{{"card": "...クレデンシャル..."}}'
```

### NPM

```bash
npm install @marketnow/trust-core
```

```javascript
import {{ verify }} from '@marketnow/trust-core';
const result = await verify(card);
// result.decision: 'PERMIT' | 'DENY' | 'UNDETERMINED'
```

## ベンチマーク

- **6,744検証/秒**（シングルコア）
- **480+テスト**（Node.js）
- **23プロパティテスト**（適合スイート）

## 日本語ドキュメント

README日本語版: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/README.ja.md

## リンク

- リポジトリ: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
- スニペット（14言語）: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/snippets

## ライセンス

Apache 2.0
""")

# Habr (Russian dev platform)
with open(os.path.join(OUT, "habr_ru.md"), "w") as f:
    f.write("""<!-- Platform: habr.com (Russian dev platform, ~20M monthly users) -->
<!-- Submission type: article -->
<!-- Language: Russian -->
<!-- Hub: Information Security, AI, Programming -->

# Universal Trust Adapter: USB-C для доверия между ИИ-агентами

## Проблема

Когда ИИ-агент вызывает инструмент — MCP-сервер, внутренний API, микросервис — нет канонического способа ответить на три основных вопроса:

1. **Кто выпустил** учётные данные этого инструмента?
2. **До какого срока они действительны**?
3. **Какова область действия**?

Каждый стандарт (OAuth, X.509, W3C VC, MCP Cards и т.д.) отвечает по-разному. UTA унифицирует их.

## Что такое UTA

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

Поддерживает **8 форматов** учётных данных:

| # | Формат | Источник |
|---|--------|----------|
| 1 | ATC v3 (Agent Trust Card) | Предложение AliceLabs |
| 2 | JWT (с цепочкой `x5c`) | IETF RFC 7519 |
| 3 | W3C Verifiable Credentials | W3C VC Data Model |
| 4 | A2A (Agent-to-Agent) cards | Google A2A Protocol |
| 5 | EAT-AI (Entity Attestation Tokens) | IETF RATS |
| 6 | ZTA (Zero Trust Agent) cards | Вариант ZTA |
| 7 | MCP Server Cards | Anthropic MCP |
| 8 | X.509 certificates | ITU-T |

И обрабатывает их через **12-этапный конвейер**:

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

## Использование

### Публичный API

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \\
  -H "Content-Type: application/json" \\
  -d '{{"card": "...ваши учётные данные..."}}'
```

### NPM

```bash
npm install @marketnow/trust-core
```

```javascript
import {{ verify }} from '@marketnow/trust-core';
const result = await verify(card);
// result.decision: 'PERMIT' | 'DENY' | 'UNDETERMINED'
```

## Бенчмарки

- **6 744 проверки/сек** (одно ядро)
- **480+ тестов** в Node.js
- **23 теста свойств** (конформационный набор)

## Документация на русском

README русская версия: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/README.ru.md

## Ссылки

- Репозиторий: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
- Сниппеты на 14 языках: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/snippets

## Лицензия

Apache 2.0
""")

# V2EX (Chinese dev forum)
with open(os.path.join(OUT, "v2ex_zh.md"), "w") as f:
    f.write("""<!-- Platform: v2ex.com (Chinese dev forum, ~5M monthly users) -->
<!-- Submission type: topic -->
<!-- Node: /go/programmer, /go/ai -->
<!-- Language: Chinese (Simplified) -->

# Universal Trust Adapter：AI 代理信任的 USB-C

## 问题

当 AI 代理调用工具（MCP 服务器、内部 API、微服务）时，没有标准方式回答三个基本问题：

1. **谁颁发**了这个工具的凭证？
2. **有效期到何时**？
3. **范围是什么**？

每个标准（OAuth、X.509、W3C VC、MCP Cards 等）回答方式不同。UTA 统一它们。

## UTA 是什么

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

支持 **8 种凭证格式**：

| # | 格式 | 来源 |
|---|------|------|
| 1 | ATC v3 (Agent Trust Card) | AliceLabs 提议 |
| 2 | JWT (带 `x5c` 链) | IETF RFC 7519 |
| 3 | W3C Verifiable Credentials | W3C VC Data Model |
| 4 | A2A (Agent-to-Agent) cards | Google A2A Protocol |
| 5 | EAT-AI (Entity Attestation Tokens) | IETF RATS |
| 6 | ZTA (Zero Trust Agent) cards | ZTA 变体 |
| 7 | MCP Server Cards | Anthropic MCP |
| 8 | X.509 certificates | ITU-T |

通过 **12 阶段管道**处理：

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

## 使用方法

### 公共 API

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \\
  -H "Content-Type: application/json" \\
  -d '{{"card": "...你的凭证..."}}'
```

### NPM

```bash
npm install @marketnow/trust-core
```

```javascript
import {{ verify }} from '@marketnow/trust-core';
const result = await verify(card);
// result.decision: 'PERMIT' | 'DENY' | 'UNDETERMINED'
```

## 基准测试

- **每秒 6,744 次验证**（单核）
- **480+ 测试**（Node.js）
- **23 属性测试**（一致性套件）

## 中文文档

README 中文版: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/README.zh.md

## 链接

- 仓库: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
- 14 种语言的代码片段: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/snippets

## 许可证

Apache 2.0
""")

# Juejin (Chinese dev platform)
with open(os.path.join(OUT, "juejin_zh.md"), "w") as f:
    f.write("""<!-- Platform: juejin.cn (Chinese dev platform, ~10M monthly users) -->
<!-- Submission type: article -->
<!-- Category: 后端, AI, 安全 -->
<!-- Language: Chinese (Simplified) -->

# AI 代理的凭证验证：8 种格式统一处理的 12 阶段管道

## 前言

随着 AI 代理越来越多地调用工具（MCP 服务器、内部 API、微服务），一个关键问题浮出水面：如何验证工具的凭证？

每个标准（OAuth/JWT、X.509、W3C VC、MCP Cards 等）回答方式不同，代理不知道用哪个标准。

## UTA 解决方案

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

支持 **8 种凭证格式**：

1. ATC v3 (Agent Trust Card) - AliceLabs 提议
2. JWT (带 `x5c` 链) - IETF RFC 7519
3. W3C Verifiable Credentials - W3C VC Data Model
4. A2A (Agent-to-Agent) cards - Google A2A Protocol
5. EAT-AI (Entity Attestation Tokens) - IETF RATS
6. ZTA (Zero Trust Agent) cards - ZTA 变体
7. MCP Server Cards - Anthropic MCP
8. X.509 certificates - ITU-T

## 12 阶段管道

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

每个阶段：

1. **PARSER**: 解析原始字节
2. **DETECT**: 识别格式
3. **SCHEMA**: 验证必填字段
4. **CRYPTO**: 验证签名
5. **ISSUER**: 解析颁发者身份
6. **KEY_BINDING**: 验证签名密钥绑定
7. **POP**: 证明持有
8. **PROVENANCE**: 追溯来源
9. **LIFECYCLE**: 验证有效期
10. **EVIDENCE**: 收集审计证据
11. **POLICY**: 应用策略
12. **DECISION**: 做出决定

## 使用方法

### 公共 API

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \\
  -H "Content-Type: application/json" \\
  -d '{{"card": "...你的凭证..."}}'
```

### NPM 安装

```bash
npm install @marketnow/trust-core
```

```javascript
import {{ verify }} from '@marketnow/trust-core';

const result = await verify(card);
if (result.decision === 'PERMIT') {
  // 凭证有效，执行工具
} else {
  console.log(result.failed_stage);
}
```

## 基准测试

- **每秒 6,744 次验证**（单核）
- **480+ 测试**（Node.js）
- **23 属性测试**（一致性套件）

## 中文文档

完整中文 README: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/README.zh.md

## 链接

- 仓库: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
- 14 种语言的代码片段: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/snippets

## 许可证

Apache 2.0
""")

# iMasters (Brazilian dev platform)
with open(os.path.join(OUT, "imasters_pt.md"), "w") as f:
    f.write("""<!-- Platform: imasters.com.br (Brazilian dev platform) -->
<!-- Submission type: article -->
<!-- Language: Portuguese (Brazilian) -->
<!-- Category: Desenvolvimento, IA, Segurança -->

# Universal Trust Adapter: verificando credenciais de agentes de IA em 8 formatos

## Introdução

Quando um agente de IA invoca uma ferramenta — um MCP server, uma API interna, um microserviço — não há forma canônica de responder a três perguntas básicas:

1. **Quem emitiu a credencial** dessa ferramenta?
2. **Até quando é válida**?
3. **Qual o escopo**?

Cada padrão (OAuth, X.509, W3C VC, MCP Cards, etc.) responde de forma diferente. UTA unifica.

## O que é UTA

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

Aceita **8 formatos de credenciais**:

| # | Formato | Origem |
|---|---------|--------|
| 1 | ATC v3 (Agent Trust Card) | Proposta da AliceLabs |
| 2 | JWT (com `x5c` chain) | IETF RFC 7519 |
| 3 | W3C Verifiable Credentials | W3C VC Data Model |
| 4 | A2A (Agent-to-Agent) cards | Google A2A Protocol |
| 5 | EAT-AI (Entity Attestation Tokens) | IETF RATS |
| 6 | ZTA (Zero Trust Agent) cards | Variante ZTA |
| 7 | MCP Server Cards | Anthropic MCP |
| 8 | X.509 certificates | ITU-T |

E processa através de um pipeline de **12 etapas**:

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

## Como usar

### API pública

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \\
  -H "Content-Type: application/json" \\
  -d '{{"card": "...sua credencial..."}}'
```

### NPM

```bash
npm install @marketnow/trust-core
```

```javascript
import {{ verify }} from '@marketnow/trust-core';
const result = await verify(card);
// result.decision: 'PERMIT' | 'DENY' | 'UNDETERMINED'
```

## Benchmarks

- **6.744 verificações/segundo** (single core)
- **480+ testes** em Node.js
- **23 testes de propriedade**

## Documentação em português

README em português: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/README.pt.md

## Por que isto importa no Brasil

O Brasil tem uma das maiores comunidades de desenvolvedores do mundo. Startups brasileiras estão construindo agentes de IA para fintech, agritech, healthtech — setores onde a **confiança entre agentes não é opcional**.

UTA foi projetado para isto: ser uma biblioteca pequena, rápida, sem dependências pesadas, que qualquer dev pode integrar em uma tarde.

## Links

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
- Snippets em 14 linguagens: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/snippets

## Licença

Apache 2.0
""")

# LinuxFr (French dev platform)
with open(os.path.join(OUT, "linuxfr_fr.md"), "w") as f:
    f.write("""<!-- Platform: linuxfr.org (French dev platform, equivalent of HN for FR) -->
<!-- Submission type: journal/article -->
<!-- Language: French -->
<!-- Tags: sécurité, IA, chiffrement -->

# Universal Trust Adapter : le USB-C de la confiance entre agents IA

## Le problème

Quand un agent IA invoque un outil — un MCP server, une API interne, un microservice — il n'existe pas de façon canonique de répondre à trois questions fondamentales :

1. **Qui a émis la crédential** de cet outil ?
2. **Jusqu'à quand est-elle valide** ?
3. **Quel est son scope** ?

Chaque standard (OAuth, X.509, W3C VC, MCP Cards, etc.) répond différemment. UTA unifie.

## La solution : UTA

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

UTA accepte **8 formats de crédentials** :

| # | Format | Origine |
|---|--------|---------|
| 1 | ATC v3 (Agent Trust Card) | Proposition d'AliceLabs |
| 2 | JWT (avec `x5c` chain) | IETF RFC 7519 |
| 3 | W3C Verifiable Credentials | W3C VC Data Model |
| 4 | A2A (Agent-to-Agent) cards | Google A2A Protocol |
| 5 | EAT-AI (Entity Attestation Tokens) | IETF RATS |
| 6 | ZTA (Zero Trust Agent) cards | Variante ZTA |
| 7 | MCP Server Cards | Anthropic MCP |
| 8 | X.509 certificates | ITU-T |

Et les traite via un pipeline de **12 étapes** :

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

## Utilisation

### API publique

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \\
  -H "Content-Type: application/json" \\
  -d '{{"card": "...votre crédential..."}}'
```

### NPM

```bash
npm install @marketnow/trust-core
```

```javascript
import {{ verify }} from '@marketnow/trust-core';
const result = await verify(card);
// result.decision: 'PERMIT' | 'DENY' | 'UNDETERMINED'
```

## Benchmarks

- **6 744 vérifications/seconde** (single core)
- **480+ tests** en Node.js
- **23 tests de propriété**

## Documentation en français

README français : https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/README.fr.md

## Pourquoi cela compte en francophonie

La francophonie tech est vive — Paris, Montréal, Bruxelles, Genève, Tunis, Dakar. Les startups francophones construisent des agents IA pour la finance, la santé, l'éducation. Dans tous ces secteurs, **la confiance entre agents n'est pas optionnelle**.

## Liens

- Repo : https://github.com/alicelabs-llc/universal-trust-adapter
- API : https://www.marketnow.site/api/trust
- Snippets en 14 langages : https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/snippets

## Licence

Apache 2.0
""")

# Heise (German tech news)
with open(os.path.join(OUT, "heise_de.md"), "w") as f:
    f.write("""<!-- Platform: heise.de (German tech news, ~20M monthly users) -->
<!-- Submission type: forum post / news tip -->
<!-- Language: German -->
<!-- Section: Security, Developer -->

# Universal Trust Adapter: Das USB-C der Vertrauensstellung zwischen KI-Agenten

## Das Problem

Wenn ein KI-Agent ein Tool aufruft — einen MCP-Server, eine interne API, einen Microservice — gibt es keine kanonische Möglichkeit, drei grundlegende Fragen zu beantworten:

1. **Wer hat die Credentials** für dieses Tool ausgestellt?
2. **Bis wann sind sie gültig**?
3. **Welchen Scope haben sie**?

Jeder Standard (OAuth, X.509, W3C VC, MCP Cards, etc.) beantwortet die Frage unterschiedlich. UTA vereinheitlicht.

## Die Lösung: UTA

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

UTA akzeptiert **8 Credential-Formate**:

| # | Format | Ursprung |
|---|--------|----------|
| 1 | ATC v3 (Agent Trust Card) | AliceLabs-Vorschlag |
| 2 | JWT (mit `x5c`-Chain) | IETF RFC 7519 |
| 3 | W3C Verifiable Credentials | W3C VC Data Model |
| 4 | A2A (Agent-to-Agent) Cards | Google A2A Protocol |
| 5 | EAT-AI (Entity Attestation Tokens) | IETF RATS |
| 6 | ZTA (Zero Trust Agent) Cards | ZTA-Variante |
| 7 | MCP Server Cards | Anthropic MCP |
| 8 | X.509-Zertifikate | ITU-T |

Und verarbeitet sie durch eine **12-stufige Pipeline**:

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

## Verwendung

### Öffentliche API

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \\
  -H "Content-Type: application/json" \\
  -d '{{"card": "...Ihre Credential..."}}'
```

### NPM

```bash
npm install @marketnow/trust-core
```

```javascript
import {{ verify }} from '@marketnow/trust-core';
const result = await verify(card);
// result.decision: 'PERMIT' | 'DENY' | 'UNDETERMINED'
```

## Benchmarks

- **6.744 Verifizierungen/Sekunde** (single core)
- **480+ Tests** in Node.js
- **23 Property-Tests**

## Deutsche Dokumentation

README deutsch: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/README.de.md

## Warum das im DACH-Raum zählt

Der DACH-Raum hat eine der stärksten Tech-Communitys Europas. Deutsche, österreichische und Schweizer Startups bauen KI-Agenten für Industrie 4.0, Finanzwesen, Gesundheit. In all diesen Sektoren ist **Vertrauen zwischen Agenten nicht optional**.

## Links

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
- Snippets in 14 Sprachen: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/snippets

## Lizenz

Apache 2.0
""")

# ============================================================
# SHORT-FORM SOCIAL
# ============================================================

# Mastodon / Bluesky / Twitter (multi-language short posts)
with open(os.path.join(OUT, "social_short_posts.md"), "w") as f:
    f.write("""<!-- Platforms: Mastodon, Bluesky, Twitter/X, Threads -->
<!-- Each post is self-contained, <500 chars -->
<!-- Post 1 per platform per day to avoid spam -->

# English posts

## Post 1 (launch)
Built Universal Trust Adapter (UTA) — the USB-C of trust between AI agents.

Verifies credentials in 8 formats (ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509) through a 12-stage pipeline.

6,744 verifications/sec. 480+ tests. Open source.

🔗 https://github.com/alicelabs-llc/universal-trust-adapter

#AI #Security #MCP #Agents

## Post 2 (technical)
The 12-stage pipeline of UTA:

PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION

Each stage is independently testable. 23/23 conformance tests pass.

🔗 https://github.com/alicelabs-llc/universal-trust-adapter

#Crypto #Security #AI

## Post 3 (multi-language)
UTA now has READMEs in 7 languages:
- English
- Español
- Português
- Français
- Deutsch
- 日本語
- 中文
- Русский

Plus code snippets in 14 languages.

Global trust layer for global AI agents.

🔗 https://github.com/alicelabs-llc/universal-trust-adapter

#i18n #OpenSource

# Spanish posts

## Post 1 (ES)
Construí Universal Trust Adapter (UTA) — el USB-C de la confianza entre agentes IA.

Verifica credenciales en 8 formatos (ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509) con un pipeline de 12 etapas.

6.744 verificaciones/segundo. 480+ tests. Open source.

🔗 https://github.com/alicelabs-llc/universal-trust-adapter

#IA #Seguridad #MCP #Agents

## Post 2 (ES)
UTA ahora tiene READMEs en 7 idiomas: EN, ES, PT, FR, DE, JA, ZH, RU.

Más snippets de código en 14 lenguajes.

Capa de confianza global para agentes IA globales.

🔗 https://github.com/alicelabs-llc/universal-trust-adapter

#i18n #OpenSource

# Portuguese posts

## Post 1 (PT)
Construí o Universal Trust Adapter (UTA) — o USB-C da confiança entre agentes de IA.

Verifica credenciais em 8 formatos (ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509) com pipeline de 12 etapas.

6.744 verificações/segundo. 480+ testes. Open source.

🔗 https://github.com/alicelabs-llc/universal-trust-adapter

#IA #Segurança #MCP #Agents

# French posts

## Post 1 (FR)
J'ai construit Universal Trust Adapter (UTA) — le USB-C de la confiance entre agents IA.

Vérifie les crédentials en 8 formats (ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509) via un pipeline de 12 étapes.

6 744 vérifications/seconde. 480+ tests. Open source.

🔗 https://github.com/alicelabs-llc/universal-trust-adapter

#IA #Sécurité #MCP #Agents

# German posts

## Post 1 (DE)
Universal Trust Adapter (UTA) gebaut — das USB-C der Vertrauensstellung zwischen KI-Agenten.

Verifiziert Credentials in 8 Formaten (ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509) durch 12-stufige Pipeline.

6.744 Verifizierungen/Sek. 480+ Tests. Open Source.

🔗 https://github.com/alicelabs-llc/universal-trust-adapter

#KI #Security #MCP #Agents

# Japanese posts

## Post 1 (JA)
Universal Trust Adapter (UTA) を構築しました — AIエージェント間の信頼のためのUSB-C。

8つの形式（ATC v3、JWT、W3C VC、A2A、EAT-AI、ZTA、MCP Cards、X.509）のクレデンシャルを12段階のパイプラインで検証。

6,744検証/秒。480+テスト。オープンソース。

🔗 https://github.com/alicelabs-llc/universal-trust-adapter

#AI #セキュリティ #MCP

# Chinese posts

## Post 1 (ZH)
构建了 Universal Trust Adapter (UTA) — AI 代理信任的 USB-C。

通过 12 阶段管道验证 8 种格式的凭证（ATC v3、JWT、W3C VC、A2A、EAT-AI、ZTA、MCP Cards、X.509）。

每秒 6,744 次验证。480+ 测试。开源。

🔗 https://github.com/alicelabs-llc/universal-trust-adapter

#AI #安全 #MCP

# Russian posts

## Post 1 (RU)
Построил Universal Trust Adapter (UTA) — USB-C для доверия между ИИ-агентами.

Проверяет учётные данные в 8 форматах (ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509) через 12-этапный конвейер.

6 744 проверки/сек. 480+ тестов. Open source.

🔗 https://github.com/alicelabs-llc/universal-trust-adapter

#ИИ #Безопасность #MCP
""")

# LinkedIn (long-form)
with open(os.path.join(OUT, "linkedin_post.md"), "w") as f:
    f.write("""<!-- Platform: LinkedIn -->
<!-- Post type: long-form article -->
<!-- Audience: professional, technical founders/CTOs -->
<!-- Tone: professional but personal -->

# I open-sourced a credential verification layer for AI agents. Here's what I learned.

Over the past 3 months, I've been building **Universal Trust Adapter (UTA)** — a verification layer that solves a problem I kept hitting in production AI agent deployments.

## The problem

When an AI agent invokes a tool (an MCP server, an internal API, a microservice), there's no canonical way to verify:
- Who issued the credential for that tool
- Whether it's still valid
- What scope it actually has

Each standard (OAuth/JWT, X.509, W3C Verifiable Credentials, MCP Server Cards) handles verification differently. Agents don't know which standard to use.

## What I built

UTA verifies credentials in **8 formats**:
- ATC v3 (Agent Trust Card)
- JWT (with x5c chain)
- W3C Verifiable Credentials
- A2A (Agent-to-Agent) cards
- EAT-AI (Entity Attestation Tokens)
- ZTA (Zero Trust Agent) cards
- MCP Server Cards
- X.509 certificates

Through a **12-stage pipeline**: parser → detect → schema → crypto → issuer → key_binding → pop → provenance → lifecycle → evidence → policy → decision

## The numbers

- 6,744 verifications per second (single core)
- 480+ tests
- 23 property tests
- 15-language code snippet collection
- 7 multilingual READMEs (English, Spanish, Portuguese, French, German, Japanese, Chinese, Russian)

## What I learned building this solo

1. **Multi-format support is harder than it looks.** Each credential format has quirks. JWT's x5c chain is different from X.509's PEM chain is different from W3C VC's proof.verificationMethod.

2. **Conformance testing is harder than building the verifier.** Building 23 property tests that catch real bugs took longer than building the verifier itself.

3. **Documentation in 7 languages is humbling.** I'm a native Spanish speaker. Translating technical docs to Japanese, Chinese, and Russian required help from native speakers. If you're building for a global audience, budget for translation from day one.

## Why I'm sharing this

If you're building AI agents that touch production systems, you'll hit this problem. UTA is open-source (Apache 2.0) with a public API. Use it, fork it, contribute to it.

Repo: https://github.com/alicelabs-llc/universal-trust-adapter
API: https://www.marketnow.site/api/trust

I'd genuinely value feedback from this community — especially from founders and CTOs who have AI agents in production.

#AI #AIAgents #Security #OpenSource #Trust #MCP #LLM #Agents
""")

# Indie Hackers
with open(os.path.join(OUT, "indiehackers_post.md"), "w") as f:
    f.write("""<!-- Platform: indiehackers.com -->
<!-- Post type: community post -->
<!-- Audience: indie founders, solo devs -->

# I open-sourced a credential verification layer for AI agents. AMA.

Hey IH —

Solo dev here. Just open-sourced a project I've been working on for 3 months: **Universal Trust Adapter (UTA)**.

## The pitch

When AI agents invoke tools (MCP servers, APIs), there's no canonical way to verify *who issued the credential* for that tool. UTA fixes this by verifying credentials in 8 formats through a 12-stage pipeline.

## The numbers

- 6,744 verifications/sec (single core)
- 480+ tests, 23 property tests
- 15-language snippet collection
- 7 multilingual READMEs
- Public API: https://www.marketnow.site/api/trust
- Repo: https://github.com/alicelabs-llc/universal-trust-adapter

## Business model

- Open-source core (Apache 2.0) — free forever
- Hosted API with rate limits — free tier
- Enterprise self-hosted — paid
- Conformance certification — paid (future)

## What I'd love feedback on

1. Does the open-source-as-distribution thesis hold for developer tools?
2. Should I pursue a YC application, or stay indie?
3. Anyone here built AI agent fleets in production? What's your credential verification story?

Repo: https://github.com/alicelabs-llc/universal-trust-adapter
""")

# Lobste.rs (invite-only, high quality)
with open(os.path.join(OUT, "lobsters_post.md"), "w") as f:
    f.write("""<!-- Platform: lobste.rs (invite-only, high-signal dev community) -->
<!-- Submission type: story -->
<!-- Tags: security, ai, cryptography -->

**Title:** Universal Trust Adapter: 12-stage pipeline for verifying AI agent credentials in 8 formats

**URL:** https://github.com/alicelabs-llc/universal-trust-adapter

**Description (optional, ~200 chars):**

Open-source credential verification layer for AI agents. Supports ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509. 12-stage pipeline (parser → detect → schema → crypto → issuer → key_binding → pop → provenance → lifecycle → evidence → policy → decision). 6,744 verifications/sec, 480+ tests, 23 property tests. Public API available.

**Notes for submitter:**
- Lobste.rs requires an invitation. If you don't have an account, ask in IH or r/programming for a referral.
- The community values technical depth. The 12-stage pipeline decomposition should resonate.
- Expect critique on the EAT-AI/ZTA beta status — be ready to defend or acknowledge.
""")

# Hashnode (cross-post from Medium)
with open(os.path.join(OUT, "hashnode_post.md"), "w") as f:
    f.write("""<!-- Platform: hashnode.com -->
<!-- Post type: blog article (cross-post from Medium) -->
<!-- Use the medium_en.md content but with Hashnode's blog format -->

Use the content from `medium_en.md` and paste into Hashnode's editor.

Tags to use: AI, Security, Agents, MCP, Cryptography, Open Source, JavaScript, TypeScript

Hashnode-specific tips:
- Add a cover image (UTA logo or a diagram of the 12-stage pipeline)
- Enable comments
- Cross-link to your Dev.to articles for SEO
- Hashnode allows custom domain — point your blog to a subdomain of marketnow.site if you have one
""")

# Substack (newsletter)
with open(os.path.join(OUT, "substack_newsletter.md"), "w") as f:
    f.write("""<!-- Platform: substack.com -->
<!-- Post type: newsletter issue -->
<!-- Subject line options below -->

**Subject line options:**
- "I built the USB-C of AI agent trust"
- "Universal Trust Adapter: 12 stages, 8 formats, 1 API"
- "How I'm solving credential verification for AI agents"

**Body:**

# Universal Trust Adapter: the USB-C of AI agent trust

Hey friends —

Quick update. I've been quiet for 3 months because I was building something. Today I'm open-sourcing it.

## What

**Universal Trust Adapter (UTA)** verifies credentials for AI agent tool calls. 8 formats, 12-stage pipeline, 6,744 verifications per second.

Repo: https://github.com/alicelabs-llc/universal-trust-adapter
API: https://www.marketnow.site/api/trust

## Why

When an AI agent invokes a tool — an MCP server, an API, a microservice — there's no canonical way to verify *who issued the credential* for that tool. I kept hitting this in production. So I built the thing I wished existed.

## What's next

- More language adapters (Go, Rust, Java native implementations)
- Reputation layer (the question "is this issuer trustworthy?" is separate from "is this credential valid?")
- Conformance certification program

If you're building AI agents, I'd love your feedback.

— Edison
""")

# AlternativeTo listing
with open(os.path.join(OUT, "alternativeto_listing.md"), "w") as f:
    f.write("""<!-- Platform: alternativeto.net -->
<!-- Submission type: software listing -->
<!-- Category: Security, Developer Tools -->

**Software name:** Universal Trust Adapter (UTA)

**URL:** https://github.com/alicelabs-llc/universal-trust-adapter

**Category:** Developer Tools / Security / AI

**Description (max 500 chars):**

Open-source credential verification layer for AI agents. Verifies credentials in 8 formats (ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509) through a 12-stage pipeline. 6,744 verifications/sec. Public API available. Apache 2.0 licensed.

**Tags:** ai-agents, credentials, security, mcp, jwt, x509, w3c-vc, verification

**Alternatives to list (for cross-linking):**
- OAuth 2.0
- OpenID Connect
- SPIFFE/SPIRE
- HashiCorp Vault
- AWS Secrets Manager

**Pricing model:** Free / Open Source

**Platforms:** Web (API), Node.js, Python, 14+ languages via snippets
""")

# SaaSHub listing
with open(os.path.join(OUT, "saashub_listing.md"), "w") as f:
    f.write("""<!-- Platform: saashub.com -->
<!-- Submission type: service listing -->

**Service name:** Universal Trust Adapter (UTA)

**URL:** https://github.com/alicelabs-llc/universal-trust-adapter

**Category:** API / Security / Developer Tools

**Short description:**
Credential verification layer for AI agents. 8 formats, 12-stage pipeline, 6.7k verifications/sec.

**Long description:**
Universal Trust Adapter (UTA) is an open-source credential verification layer for AI agents. It verifies credentials issued in 8 formats (ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Server Cards, X.509) through a 12-stage pipeline: PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION.

Use cases:
- Verify MCP server credentials before agent invokes
- Bridge credentials between ecosystems (e.g., JWT → W3C VC)
- Audit agent tool calls with cryptographic evidence

**Pricing:** Free / Open Source (Apache 2.0)
**API:** https://www.marketnow.site/api/trust
**NPM:** @marketnow/trust-core

**Alternatives:**
- OAuth 2.0
- SPIFFE
- Vault
""")

# libraries.io submission
with open(os.path.join(OUT, "librariesio_submission.md"), "w") as f:
    f.write("""<!-- Platform: libraries.io -->
<!-- Submission type: package discovery -->
<!-- Note: libraries.io auto-indexes NPM packages, so @marketnow/trust-core should already be there. -->
<!-- What you can do: add tags, description, and a "libraries.io source" if you have access. -->

**Packages to verify are indexed:**

1. https://libraries.io/npm/@marketnow/trust-core
2. https://libraries.io/npm/@marketnow/trust-adapters
3. https://libraries.io/npm/@marketnow/trust-gateway
4. https://libraries.io/npm/marketnow-mcp
5. https://libraries.io/npm/agent-trust-card
6. https://libraries.io/npm/marketnow-install-stack
7. https://libraries.io/npm/@marketnow/uts

**If any are missing, submit via:**
https://libraries.io/npm/new

**Add tags to each package:**
- ai-agents
- credentials
- security
- mcp
- jwt
- x509
- w3c-vc
- verification
- trust
- attestation

**Add a description:**
"Universal Trust Adapter — verifies AI agent credentials in 8 formats through a 12-stage pipeline. https://github.com/alicelabs-llc/universal-trust-adapter"
""")

# OSS Directory
with open(os.path.join(OUT, "ossdirectory_listing.md"), "w") as f:
    f.write("""<!-- Platform: oss.directory -->
<!-- Submission type: open-source project listing -->

**Project name:** Universal Trust Adapter (UTA)

**Repo:** https://github.com/alicelabs-llc/universal-trust-adapter

**Description:**
Open-source credential verification layer for AI agents. Verifies credentials in 8 formats (ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509) through a 12-stage pipeline.

**License:** Apache 2.0

**Languages:** TypeScript (core), Python (adapter)

**Stars:** (check current count at https://github.com/alicelabs-llc/universal-trust-adapter/stargazers)

**Categories:** Security, AI/ML, Developer Tools

**Submit at:** https://oss.directory/submit
""")

# Product Hunt (we already launched Aug 26, but cross-link)
with open(os.path.join(OUT, "producthunt_followup.md"), "w") as f:
    f.write("""<!-- Platform: producthunt.com -->
<!-- Status: already launched Aug 26, 2026 -->
<!-- Action: post-launch follow-up -->

**Action 1: Comment on existing PH launch**

URL: https://www.producthunt.com/products/uta-universal-trust-adapter?launch=uta-universal-trust-adapter

Comment to post:
"Update: since launch, UTA has been featured in 12+ GitHub repos as RFC issues (LangChain, LlamaIndex, AutoGen, Pydantic AI, Semantic Kernel, Google ADK, OpenAI Agents SDK, Anthropic SDK, Haystack, LiteLLM, Continue, Ant Design X). 15-language snippet collection added. 7 multilingual READMEs. Public API live at https://www.marketnow.site/api/trust. Thanks for the early support!"

**Action 2: Submit to PH alternatives lists**
- alternativeTo (see alternativeto_listing.md)
- SaaSHub (see saashub_listing.md)

**Action 3: Cross-link from new articles**
When you publish on Medium/Hashnode/Substack, link back to the PH launch page in the author bio.
""")

# Summary index
with open(os.path.join(OUT, "README.md"), "w") as f:
    f.write("""# Platform Content — Ready to Post

This folder contains ready-to-publish content for 20+ external platforms.
Each file has platform-specific formatting and language.

## Files

### Reddit (15 subreddits)
- `reddit_r_cursor.md` → r/cursor
- `reddit_r_ClaudeAI.md` → r/ClaudeAI
- `reddit_r_OpenAI.md` → r/OpenAI
- `reddit_r_MachineLearning.md` → r/MachineLearning
- `reddit_r_programming.md` → r/programming
- `reddit_r_typescript.md` → r/typescript
- `reddit_r_node.md` → r/node
- `reddit_r_python.md` → r/python
- `reddit_r_SaaS.md` → r/SaaS
- `reddit_r_Entrepreneur.md` → r/Entrepreneur
- `reddit_r_devops.md` → r/devops
- `reddit_r_cybersecurity.md` → r/cybersecurity
- `reddit_r_netsec.md` → r/netsec
- `reddit_r_AIAgents.md` → r/AIAgents
- `reddit_r_IndieDev.md` → r/IndieDev

### Medium (5 languages)
- `medium_en.md` → English
- `medium_es.md` → Spanish
- `medium_pt.md` → Portuguese
- `medium_fr.md` → French
- `medium_de.md` → German

### Non-English Platforms
- `meneame_es.md` → meneame.net (Spanish HN)
- `qiita_ja.md` → qiita.com (Japanese)
- `habr_ru.md` → habr.com (Russian)
- `v2ex_zh.md` → v2ex.com (Chinese)
- `juejin_zh.md` → juejin.cn (Chinese)
- `imasters_pt.md` → imasters.com.br (Brazilian)
- `linuxfr_fr.md` → linuxfr.org (French)
- `heise_de.md` → heise.de (German)

### Short-form Social
- `social_short_posts.md` → Mastodon, Bluesky, Twitter/X, Threads (multi-language)

### Long-form Social
- `linkedin_post.md` → LinkedIn article
- `indiehackers_post.md` → Indie Hackers
- `lobsters_post.md` → lobste.rs
- `hashnode_post.md` → Hashnode
- `substack_newsletter.md` → Substack

### Directory Listings
- `alternativeto_listing.md` → alternativeto.net
- `saashub_listing.md` → saashub.com
- `librariesio_submission.md` → libraries.io
- `ossdirectory_listing.md` → oss.directory
- `producthunt_followup.md` → Product Hunt (follow-up)

## How to use

1. For each platform, create an account if you don't have one.
2. Open the corresponding .md file.
3. Copy the content.
4. Paste into the platform's editor.
5. Adjust formatting if needed (some platforms don't support Markdown tables, etc.).
6. Submit.

## Posting schedule suggestion

**Day 1:** Reddit (r/programming, r/MachineLearning, r/cursor, r/ClaudeAI)
**Day 2:** Reddit (r/OpenAI, r/typescript, r/node, r/python)
**Day 3:** Reddit (r/SaaS, r/Entrepreneur, r/IndieDev)
**Day 4:** Reddit (r/devops, r/cybersecurity, r/netsec, r/AIAgents)
**Day 5:** Medium (English), Hashnode, Substack
**Day 6:** Medium (ES, PT, FR, DE), LinkedIn
**Day 7:** Menéame, Qiita, Habr, V2EX, Juejin, iMasters, LinuxFr, Heise
**Day 8:** AlternativeTo, SaaSHub, libraries.io, OSS Directory, Indie Hackers
**Day 9:** Mastodon, Bluesky, Twitter/X (multi-language short posts)
**Day 10:** Lobste.rs (if you have an invite)

## Notes

- Reddit requires account karma. New accounts may be rate-limited or filtered.
- Menéame requires karma. Consider asking a friend with karma to submit.
- Lobste.rs is invite-only. Ask in Indie Hackers or r/programming for a referral.
- Qiita, Habr, V2EX, Juejin require accounts in the respective language.
- Some platforms strip Markdown tables — convert to lists if needed.
""")

print(f"\n=== PLATFORM CONTENT SUMMARY ===")
files = os.listdir(OUT)
print(f"  Total files: {len(files)}")
print(f"  Location: {OUT}")
print()
for f in sorted(files):
    print(f"  - {f}")
