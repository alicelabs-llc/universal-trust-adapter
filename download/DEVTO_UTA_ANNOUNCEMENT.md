---
title: I built the USB-C of agent trust — Universal Trust Adapter (UTA) v1.0
published: true
description: "One API that translates between ALL agent trust credential formats (ATC, EAT-AI, ZTA, A2A, MCP). Like Zapier for trust standards. Live in production."
tags: ai-agents, trust, mcp, interoperability
date: 2026-08-20
---

# I built the USB-C of agent trust — Universal Trust Adapter (UTA) v1.0

In August 2026, there are **5 competing trust credential formats** for AI agents. None of them speak to each other. An agent with an ATC credential can't verify an agent with a ZTA. An A2A agent can't trust an MCP Server.

**UTA solves this.** It's not another standard — it's the universal translator.

## The problem

```
ATC (AliceLabs)    ──✗──  EAT-AI (IETF)
    │                         │
    ✗                         ✗
    │                         │
ZTA (Anthropic)   ──✗──  A2A (Google)
    │                         │
    ✗                         ✗
    │                         │
MCP Card (Anthropic) ──✗──  W3C VC
```

Each ecosystem is an island. Companies have to implement 5 separate integrations.

## The solution

**Universal Trust Schema (UTS)** — a canonical internal representation, like Unicode for text. Every format translates to UTS, and UTS translates to any format.

```
ATC ──→ ┌──────────────┐ ──→ EAT-AI
        │              │
ZTA ──→ │  UTA Engine  │ ──→ A2A Card
        │  (via UTS)   │
MCP ──→ └──────────────┘ ──→ ATC v2
```

**8 formats = 8 adapters, not 56 pairwise translators.** This is the i18n pattern applied to trust.

## What's live now

**5 adapters implemented and tested in production:**

| Format | Owner | Status |
|--------|-------|--------|
| ATC v2.0 | AliceLabs | stable |
| EAT-AI | IETF | beta |
| ZTA | Anthropic | beta |
| A2A Agent Card | Google / AAIF | beta |
| MCP Server Card | Anthropic | beta |

**3 more planned:** W3C VC, OAuth/OIDC, SPIFFE SVID

## Try it now

### Verify any credential (auto-detect)

```bash
curl -X POST https://universal-trust-adapter.vercel.app/api/trust?action=verify \
  -H "Content-Type: application/json" \
  -d '{"payload": {...any credential...}}'
```

### Translate ATC → ZTA

```bash
curl -X POST https://universal-trust-adapter.vercel.app/api/trust?action=translate \
  -H "Content-Type: application/json" \
  -d '{"to":"zta","payload":{...ATC card...}}'
```

Result: A valid ZTA credential with the same trust score, capabilities, and identity — translated losslessly.

### Bridge: verify in one ecosystem, issue in another

```bash
curl -X POST https://universal-trust-adapter.vercel.app/api/trust?action=bridge \
  -H "Content-Type: application/json" \
  -d '{
    "verifyIn": "zta",
    "issueAs": "atc-v2",
    "policy": {"min_trust_score": 7},
    "payload": {...ZTA credential...}
  }'
```

Result: Verifies the ZTA credential (score 9), issues an ATC card with the same score, and records the **attestation chain hash** so you can trace the trust back to the original ZTA credential.

## 3 design decisions that matter

### 1. Lossless translation

Every translation preserves the original payload in `format.raw`. No data is lost. When a field can't be expressed in the target format (e.g., TEE attestation in ZTA → MCP Card), a warning is reported — not silently dropped.

### 2. Attestation chaining

When you bridge from ZTA to ATC, the new ATC card records `provenance.original_signature_hash` — the SHA-256 of the original ZTA credential. This means the trust chain is auditable end-to-end. You can always trace back to the original credential.

### 3. Offline, <50ms, no dependencies

The engine is pure JavaScript. No network calls. No native modules. No heavy dependencies. It runs in Vercel Edge Functions, Cloudflare Workers, or any Node.js runtime. Verification completes in <50ms.

## The architecture (Lego blocks)

```
@marketnow/trust-core              ← TrustEngine + UTS
├── @marketnow/trust-adapter-atc   ← ATC v2.0 (stable)
├── @marketnow/trust-adapter-eat   ← EAT-AI (beta)
├── @marketnow/trust-adapter-zta   ← ZTA (beta)
├── @marketnow/trust-adapter-a2a   ← A2A Card (beta)
├── @marketnow/trust-adapter-mcp   ← MCP Card (beta)
├── @marketnow/trust-adapter-vc    ← W3C VC (planned)
├── @marketnow/trust-adapter-oauth ← OAuth (planned)
└── @marketnow/trust-adapter-spiffe ← SPIFFE (planned)
```

Each adapter implements 2 functions:

```typescript
fromNative(payload): UTS    // native → universal
toNative(uts): payload       // universal → native
```

To add a new format, you write 1 adapter. You automatically get N-1 new translation pairs. **O(N) complexity, not O(N²).**

## Licensing model (3 layers)

Inspired by Zapier, Stripe, and Docker:

| Layer | License | Why |
|-------|---------|-----|
| **Plugin template** | MIT / Apache 2.0 | Anyone can build a connector |
| **UTS spec** | AliceLabs (open for consultation) | The spec is ours, but open for review |
| **TrustEngine + Sentinel** | Proprietary (MNNC-1.0) | The core engine is 100% AliceLabs |

This means:
- **Community can build adapters** (MIT plugin template)
- **Companies can read the spec** (open UTS documentation)
- **Nobody can copy the engine** (proprietary core)

## What's next

1. **npm package**: `npm install universal-trust-adapter` (publishing today)
2. **PyPI package**: `pip install marketnow-trust` (Q4 2026)
3. **W3C VC + OAuth + SPIFFE adapters** (Q4 2026)
4. **Submit to AAIF** (Linux Foundation) as hosted project (Q1 2027)
5. **Runtime integrations**: Cursor, Cline, Claude Desktop (Q1 2027)

## Links

- **Live API**: https://universal-trust-adapter.vercel.app/api/trust
- **Also on MarketNow**: https://marketnow.site/api/trust
- **GitHub**: https://github.com/eddyflores100-lang/universal-trust-adapter
- **npm**: `universal-trust-adapter` (pending 2FA)
- **Built by**: Edison Flores & Alejandro Flores at AliceLabs LLC (Wyoming, USA)

## The pitch

> MarketNow doesn't compete with trust standards. It connects them.
>
> Like Zapier connects applications, UTA connects trust standards.
>
> One API, all formats, zero lock-in.

---

*MarketNow is the trust infrastructure for AI agents. Sentinel security audits, ATC/1.0 trust cards with Ed25519 signatures, Universal Trust Adapter for cross-standard interoperability, and human-in-the-loop agent spending. [marketnow.site](https://marketnow.site)*
