# MarketNow — Strategic Positioning v4.0

> Applied 2026-08-20 based on competitive landscape analysis (18 points)

## The One-Line Thesis

> **MCP lets agents use tools. A2A lets agents talk to agents. UTA lets the ecosystem understand and exchange trust.**

That's it. Clean. Defensible. Complementary.

## Competitive Positioning

### What we DON'T compete with

| Competitor | What they do | Funding | Our relationship |
|-----------|-------------|---------|-----------------|
| **Arcade** | Agent authorization runtime | $60M Series A | Complement — they're the runtime, we're the trust layer |
| **Obsidian** | Enterprise agent security platform | $85M Series D | Complement — they're the enterprise console, we're the protocol |
| **UTCP** | Universal tool calling protocol | Community | Complement — they solve HOW to call, we solve WHETHER to trust |
| **W3C AIRP** | Agent identity registry standard | Standards body | Complement — they define identity, we translate between identities |
| **MCP** | Model Context Protocol | Anthropic | Foundation — we audit MCP servers via Sentinel |
| **A2A** | Agent-to-agent protocol | Google/AAIF | Foundation — we translate A2A cards to other trust formats |

### What makes UTA different from ALL competitors

**Arcade** is a runtime — it controls execution.
**Obsidian** is a platform — it monitors enterprise.
**UTA** is a protocol — it translates trust.

Nobody else translates between trust formats. Arcade doesn't translate ZTA→ATC. Obsidian doesn't bridge A2A→MCP. That's the gap.

## The Real Moat (not what we thought)

| What we thought was the moat | What the moat actually is |
|-----------------------------|--------------------------|
| 9,248 skills in catalog | Trust graph (artifact→SHA→provenance→Sentinel→ATC→history) |
| ATC as a standard | Credential lifecycle history (millions of issued/verified/revoked cards) |
| Sentinel scanner | Runtime reputation (observed behavior over time) |
| MCP marketplace | Policy decisions (millions of ALLOW/BLOCK records with evidence) |

**The marketplace is the lab. The trust graph is the product.**

## The 5-Layer Architecture (clarified)

```
Layer 1: UTS Specification          → OPEN (CC-BY 4.0) — anyone can implement
Layer 2: UTA Reference SDK         → OPEN (Apache 2.0) — anyone can fork
Layer 3: ATC Credential            → OPEN (spec published, implementations free)
Layer 4: Sentinel + Interceptor    → PROPRIETARY (MNNC-1.0) — AliceLabs only
Layer 5: MarketNow Trust Cloud     → COMMERCIAL (SaaS) — the product
```

Layers 1-3 are the protocol (open, adoptable).
Layers 4-5 are the business (proprietary, commercial).

## Investor Pitch (revised)

### Problem
```
AI agents are becoming autonomous principals.
Existing identity systems were built for humans, services and workloads — not agents.

Fragmentation:
  MCP (Anthropic) → tools
  A2A (Google) → agents
  OAuth (IETF) → authorization
  SPIFFE (CNCF) → workload identity
  W3C VC → credentials
  EAT (IETF) → attestation

None of them interoperate.
```

### Solution
```
UTA — Universal Trust Adapter
Translates between ALL trust formats via Universal Trust Schema (UTS).

Like Zapier connects applications, UTA connects trust standards.
```

### Evidence of Market
```
Arcade: $60M Series A (agent authorization)
Obsidian: $85M Series D (agent security, unicorn)
W3C: Agent Identity Registry Community Group launched
IETF: EAT-AI draft published
AAIF: A2A moved to Linux Foundation
arXiv: 4+ papers on agent trust/attestation (Aug 2026)
```

### Product
```
Trust → Decision → Enforcement → Evidence → Receipt
```

### Why Now
```
MCP + A2A + OAuth + SPIFFE are all maturing simultaneously.
Interoperability increases → trust problem increases.
The window is open NOW. In 12 months, someone else fills this gap.
```

## The Next Single Goal

> **Get one third party — NOT AliceLabs/MarketNow — to implement UTS/UTA and verify a real trust credential.**

That single event is worth more than 10,000 additional skills in the catalog.

## What we're NOT doing anymore

- ❌ Adding more skills to the catalog
- ❌ Creating new ATC versions (1.0 is frozen)
- ❌ Competing with Arcade/Obsidian on runtime security
- ❌ Trying to make ATC "the standard"
- ❌ Adding features without external validation

## What we ARE doing

- ✅ Publishing UTS v1.0 (frozen — done)
- ✅ Publishing test vectors (done — 10 vectors)
- ✅ Publishing UTA SDK on npm (pending 2FA token)
- ✅ Getting 1 external implementation
- ✅ Submitting to AAIF (Q1 2027)
- ✅ Building trust graph (the real moat)
