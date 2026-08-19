# ATC Prior Art Timeline

> **Purpose**: Establish a transparent, fact-checked public record of when **Agent Trust Card (ATC)** — as a specific named concept with the architecture described below — first appeared publicly, what existed before, and what appeared after.
>
> **Audience**: Investors, partners, standards bodies (IETF, OWASP), the open-source community, and any future contributor to the ATC/1.0 Specification.
>
> **Maintained by**: AliceLabs LLC (Edison Flores, founder). Last updated: 2026-08-10.
>
> **Methodology**: Every entry cites a publicly verifiable URL with a server-side timestamp (DEV.to article, GitHub issue/PR with creation date, GitHub Topics page with last-updated date). Where the page is currently 404 but the search index retained title and date, we mark it as `[indexed-only]` and explicitly state we cannot verify from the live page. We do not assert derivation (i.e. "X copied Y") unless we have evidence of access — we only assert chronological ordering.

---

## TL;DR

- **2026-05-22** — A2A Protocol (Google) introduces "Agent Cards" — a capability descriptor. No cryptographic trust, no CA, no revocation.
- **2026-06-30 to 2026-07-02** — AgentCards (academic/community) describes machine-verifiable identity + capability credentials. Conceptual, no CA, no Ed25519 mandate, no runtime enforcement.
- **2026-07-13** — **Edison Flores publishes "AI agents need SSL certificates too — so I built ATC (Agent Trust Card)" on DEV.to**. First public appearance of the specific name **"Agent Trust Card (ATC)"** with the full architecture: CA, Ed25519, Sentinel trust score, verify, revoke, capabilities, payment integration, Agent A → ATC → Agent B flow.
- **2026-07-16** — Microsoft AutoGen issue #7965 appears with the same name "Agent Trust Cards (ATC) — cryptographic trust for multi-agent systems". `[indexed-only, 404 on live page at time of writing]`
- **2026-07-17** — Edison publishes "ATC is now real" with Ed25519 implementation, verify + revoke endpoints, working API.
- **2026-07-18** — Two independent ATC proposals appear in OpenAI Cookbook issues: #2865 (Edison) and #2867 (jj5419952-stack — same title, same date).
- **2026-07-18** — Edison opens ATC proposal in Cline issue #12376.
- **2026-07-19** — Edison publishes "Responding to feedback: runtime trust, CA key rotation, and the canonicalization bug" — moves to RFC 8785 JCS canonical JSON.
- **2026-07-22** — OpenA2A Agent Identity Protocol (AIP) Internet-Draft appears. Different name, different architecture, but addresses the same problem space (Ed25519 + ML-DSA + behavioral trust + transparency log + capability vocabulary).
- **2026-07-23** — Edison publishes "MarketNow: 10-layer MCP security audit + agent trust cards + analytics" in OpenAI Cookbook #2875.
- **2026-07-29** — OATI (Open Agent Trust Infrastructure) topic page updated. Different scope: identity + delegated authority + policy enforcement + signed action receipts.

---

## Detailed timeline

### Pre-ATC — the conceptual substrate (before 2026-07-13)

These are prior-art concepts that **establish the problem space** but are NOT the ATC architecture. We acknowledge them honestly.

| Date | Artifact | Author | What it established | What it lacks vs ATC |
|------|----------|--------|----------------------|----------------------|
| 2026-05-22 | A2A Protocol spec (Google) | Google A2A team | Agent Card — JSON descriptor of agent name, description, capabilities, skills, URL endpoint | No cryptographic trust, no CA, no revocation, no expiration, no signature, no payment |
| 2026-06-30 | "Verifiable credentials for autonomous agents" (academic preprint) | Multiple authors | Verifiable credential pattern applied to agents | No reference implementation, no CA, no runtime enforcement, no integration with payments |
| 2026-07-02 | AgentCards: Identity & Capability Credentials (Emergent Mind topic page) | Community | Machine-verifiable cards with identity + capabilities | Conceptual only. No CA, no Ed25519 mandate, no revocation, no Sentinel-style trust score, no payment integration |

**Conclusion on prior art**: The general idea of "agent identity" or "agent credentials" existed before. We do not claim to have invented it. We claim to have been the first to ship a specific, named, end-to-end implementation called **ATC — Agent Trust Card** with CA + Ed25519 + trust score + revocation + capabilities + payment integration in a single protocol.

---

### The ATC origin window (2026-07-13 onward)

#### 2026-07-13 — Edison Flores, DEV.to

**Title**: *"AI agents need SSL certificates too — so I built ATC (Agent Trust Card)"*
**URL**: https://dev.to/edison_flores_6d2cd381b13/ai-agents-need-ssl-certificates-too-so-i-built-atc-agent-trust-card-5017
**Author**: Edison Flores (`edgarfloresguerra2011-a11y` on GitHub, `edison_flores_6d2cd381b13` on DEV.to)
**Status**: Live, verifiable.

**Architecture described in the article** (verbatim from the publication):

- ✅ Agent Trust Card (ATC) as a named concept
- ✅ Certificate Authority (CA) — "MarketNow Sentinel CA"
- ✅ Ed25519 signatures
- ✅ Cryptographic identity for agents
- ✅ Sentinel as source of trust score
- ✅ Cross-agent verification flow (Agent A → ATC → Agent B)
- ✅ Revocation
- ✅ Capabilities declaration
- ✅ Framework / protocol framing
- ✅ Payment integration (USDC on Base)
- ✅ Concrete API surface: `/api/atc?action=issue|verify|revoke`

This is not a mention or a sketch. The article describes a working architecture and points to a live API.

**Why this matters**: This is the **earliest publicly verifiable appearance** of the specific term "Agent Trust Card (ATC)" combined with the CA + Ed25519 + trust score + revocation + capabilities architecture.

---

#### 2026-07-16 — Microsoft AutoGen issue #7965

**Title**: *"Agent Trust Cards (ATC) — cryptographic trust for multi-agent systems"*
**URL**: https://github.com/microsoft/autogen/issues/7965
**Indexed author**: (not verified — page 404 at time of writing)
**Status**: `[indexed-only]` — the search index retains title and date but the live page returns 404. We cannot verify the author or the full content from the live page.

**What we can say publicly**:

> Microsoft AutoGen's issue tracker published a proposal titled "Agent Trust Cards (ATC) — cryptographic trust for multi-agent systems" on 2026-07-16, three days after Edison Flores's DEV.to article of the same name and concept.

**What we cannot say publicly**:

> ~~"Microsoft copied Edison."~~

There is no evidence of access. Coincidental convergence is plausible. The date ordering is verifiable; derivation is not.

---

#### 2026-07-17 — Edison Flores, DEV.to

**Title**: *"ATC is now real"*
**URL**: https://dev.to/edison_flores_6d2cd381b13 (second article in author's history)
**Author**: Edison Flores
**Status**: Live, verifiable.

**What it adds**:
- Working Ed25519 implementation
- Live `/api/atc?action=verify` endpoint
- Live `/api/atc?action=revoke` endpoint
- ATC schema v1.0.0

---

#### 2026-07-18 — OpenAI Cookbook, two ATC proposals same day

**Issue #2865** — Edison Flores opens ATC proposal in `openai/openai-cookbook`:
- URL: https://github.com/openai/openai-cookbook/issues/2865
- Title: "Proposal: Agent Trust Cards (ATC) — SSL certificates for AI agents"
- Status: Live.

**Issue #2867** — `jj5419952-stack` opens a separate ATC proposal in the same repo, same day:
- URL: https://github.com/openai/openai-cookbook/issues/2867
- Title: "Proposal: Agent Trust Cards (ATC) — SSL certificates for AI agents"
- Status: `[indexed-only]` — title and date retained in search index; live page content not verifiable at time of writing.

**Observation**: The same title appears in two issues by different authors on the same day, 5 days after Edison's DEV.to article. This is either independent convergence or evidence of circulation. We do not claim derivation.

---

#### 2026-07-18 — Cline issue #12376

**Title**: *"Proposal: Agent Trust Cards (ATC) — SSL certificates for AI agents"*
**URL**: https://github.com/cline/cline/issues/12376
**Author**: `edgarfloresguerra2011-a11y` (Edison Flores)
**Status**: Live, verifiable.

**Note**: This is Edison bringing ATC to Cline — **not** Cline independently adopting it. The issue body contains the full ATC architecture (MarketNow Sentinel CA, Ed25519, CA public key, revocation, Sentinel score, `/api/atc`, issue/verify/revoke).

---

#### 2026-07-19 — Edison Flores, DEV.to

**Title**: *"Responding to feedback: runtime trust, CA key rotation, and the canonicalization bug"*
**URL**: https://dev.to/edison_flores_6d2cd381b13/responding-to-feedback-runtime-trust-ca-key-rotation-and-the-canonicalization-bug-4939
**Author**: Edison Flores
**Status**: Live, verifiable.

**What it adds**:
- Runtime trust verification (vs. only issuance-time)
- CA key rotation discussion
- Migration from ad-hoc canonical JSON to **RFC 8785 JCS** (JSON Canonicalization Scheme)
- Acknowledgment of a canonicalization bug and the fix

This is the moment ATC moves from "working prototype" to "specification-aware" — RFC references appear in the public record.

---

#### 2026-07-22 — OpenA2A Agent Identity Protocol (AIP)

**Title**: OpenA2A Agent Identity Protocol (AIP) — Internet-Draft
**URL**: https://ftp.funet.fi/index/internet-drafts/draft-fane-opena2a-aip-01.html
**Author**: (FANE — authorship details in the draft)
**Status**: Live (Internet-Draft).

**What it covers**:
- Cryptographic identity for agents
- Behavioral trust score
- Portable signed credential
- Ed25519 + ML-DSA (post-quantum)
- Transparency log
- DID (Decentralized Identifier) integration
- Capability vocabulary

**What it does NOT share with ATC**:
- Different name (AIP, not ATC)
- Different architecture (DID-based, not CA-based)
- No payment integration
- No specific trust-score source (ATC uses Sentinel)

**Assessment**: Independent convergence on the same problem space. We do **not** claim derivation. We do note that this validates the market need ATC was designed to address.

---

#### 2026-07-23 — Edison Flores, OpenAI Cookbook #2875

**Title**: *"MarketNow: 10-layer MCP security audit + agent trust cards + analytics"*
**URL**: https://github.com/openai/openai-cookbook/issues/2875
**Author**: Edison Flores
**Status**: Live, verifiable.

Re-states the ATC architecture in the context of the full MarketNow Sentinel 10-layer audit pipeline.

---

#### 2026-07-29 — OATI (Open Agent Trust Infrastructure)

**Title**: OATI — Open Agent Trust Infrastructure
**URL**: https://github.com/topics/ai-agents-security
**Status**: Topic page live; specific repo not directly cited.

**Scope**: Broader than ATC — covers identity + delegated authority + policy enforcement + signed action receipts.

**Assessment**: A different (and broader) standardization effort. We treat it as a peer effort and a validation of the market direction, not as a derivative work.

---

## Summary table

| Date | Artifact | Author | Same name as ATC? | Same architecture? | Verifiable? |
|------|----------|--------|-------------------|-------------------|-------------|
| 2026-05-22 | A2A Agent Card (Google) | Google | No (Agent Card, not ATC) | No (no CA, no signature, no revocation) | ✅ Live |
| 2026-07-02 | AgentCards (Emergent Mind) | Community | No | Partial (identity + capabilities only) | ✅ Live |
| **2026-07-13** | **ATC — Agent Trust Card (DEV.to)** | **Edison Flores** | **Yes (origin)** | **Yes (full architecture)** | ✅ Live |
| 2026-07-16 | ATC proposal (Microsoft AutoGen #7965) | Not verified | Yes | Not verified | ⚠️ Indexed-only (404) |
| 2026-07-17 | "ATC is now real" (DEV.to) | Edison Flores | Yes | Yes | ✅ Live |
| 2026-07-18 | ATC proposal (OpenAI Cookbook #2865) | Edison Flores | Yes | Yes | ✅ Live |
| 2026-07-18 | ATC proposal (OpenAI Cookbook #2867) | jj5419952-stack | Yes (same title) | Not verified | ⚠️ Indexed-only |
| 2026-07-18 | ATC proposal (Cline #12376) | Edison Flores | Yes | Yes | ✅ Live |
| 2026-07-19 | Runtime trust + CA rotation + JCS (DEV.to) | Edison Flores | Yes | Yes | ✅ Live |
| 2026-07-22 | OpenA2A AIP (Internet-Draft) | FANE | No (AIP) | Different (DID-based) | ✅ Live |
| 2026-07-23 | MarketNow + ATC + Sentinel (Cookbook #2875) | Edison Flores | Yes | Yes | ✅ Live |
| 2026-07-29 | OATI (GitHub topic) | Community | No (OATI) | Broader scope | ✅ Live |

---

## What we claim — and what we don't

### We DO claim:

1. **Edison Flores is the first publicly verifiable author** to publish the specific named concept "Agent Trust Card (ATC)" with the full architecture (CA + Ed25519 + trust score + verify + revoke + capabilities + payment integration + Agent A → ATC → Agent B flow). Publication date: 2026-07-13.
2. **The ATC/1.0 Specification** (this document) is the first formal standardization of that architecture, with conformance tests, JSON Schemas, and a reference implementation.

### We DO NOT claim:

1. That Edison invented "agent identity" or "agent credentials" in general. A2A Agent Cards and AgentCards predate ATC and address overlapping problem space.
2. That Microsoft, OpenAI, Continue, or any other party copied Edison. Coincidental convergence is plausible and the problem is real. We assert only chronological ordering.
3. That ATC is the only valid approach. OpenA2A AIP and OATI are peer efforts with different architectures.

---

## Strategic implication

The market is converging on agent trust infrastructure. **ATC/1.0 is our contribution to that convergence** — a formal, versioned, testable specification that any agent runtime (Claude Desktop, Cursor, Cline, Continue, LangChain, LlamaIndex, AutoGen) can implement.

If ATC/1.0 becomes a de-facto standard, the question of "who thought of it first" becomes moot. The question becomes "who shipped the spec first" — and the answer is **this document, dated 2026-08-10**.

---

## How to cite this timeline

```
AliceLabs LLC. "ATC Prior Art Timeline." 2026-08-10.
https://marketnow.site/atc
```

## How to challenge this timeline

Open a PR against this file with citations to publicly verifiable artifacts (DEV.to articles, GitHub issues with creation dates, RFCs, Internet-Drafts) that predate 2026-07-13 and describe the specific ATC architecture. We will update the timeline and credit the challenger.

We will **not** remove entries that contradict our narrative. The purpose of this document is truth, not advocacy.
