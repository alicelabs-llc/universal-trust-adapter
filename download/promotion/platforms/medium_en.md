<!-- Platform: Medium.com -->
<!-- Language: English -->
<!-- Status: ready to paste into Medium editor -->

# Universal Trust Adapter: The USB-C of Trust Between AI Agents

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
curl -X POST https://www.marketnow.site/api/trust?action=verify \
  -H "Content-Type: application/json" \
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
