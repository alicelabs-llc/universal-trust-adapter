#!/usr/bin/env python3
"""Regenerate ALL promotion posts with correct naming (UTA v1.0.0, not ATC/1.0)."""
import os

PROMO_DIR = '/home/z/my-project/download/promotion/'
os.makedirs(PROMO_DIR, exist_ok=True)

# Common correct framing
NAMING_NOTE = """<!-- NAMING CORRECTION:
  - Project name: UTA v1.0.0 (Universal Trust Adapter)
  - ATC (Agent Trust Card) is ONE of 8 adapter formats UTA supports
  - Canonical schema: UTS v2.0.0 (Universal Trust Schema)
  - 8 formats UTA translates: ATC, EAT-AI, ZTA, A2A, MCP Card, W3C VC, OAuth, SPIFFE
-->

"""

# 1. Reddit r/MCP
REDDIT_MCP = """**Title:** I built UTA — an open-source Universal Trust Adapter (8 format adapters, 12-stage verification pipeline, 5 download channels)

**Body:**

I've been working on **UTA (Universal Trust Adapter) v1.0.0** — an open-source spec that translates between 8 different trust credential formats used by AI agents via a canonical Universal Trust Schema (UTS v2.0.0).

The 8 formats UTA translates between:
- ATC (Agent Trust Card — AliceLabs)
- EAT-AI (IETF RFC 9421)
- ZTA (Anthropic Zero-Trust Agent)
- A2A Agent Card (Google/AAIF)
- MCP Server Card (Anthropic)
- W3C Verifiable Credentials
- OAuth/OIDC
- SPIFFE SVID

After my GitHub account got flagged by abuse-detection (ticket open 2 weeks, still unresolved), I learned the hard way why single-platform dependency is dangerous.

So I built 5 independent download channels for the code:

1. **NPM Registry** — primary, independent of GitHub
2. **jsDelivr CDN** — free mirror of NPM, automatically syncs
3. **unpkg CDN** — alternative CDN mirror of NPM
4. **marketnow.site** — AliceLabs-owned origin server
5. **GitHub org** — publicly accessible (alicelabs-llc)

All 5 channels serve byte-identical tarballs (SHA-256 verified).

The 12-stage fail-closed verification pipeline includes:
- Identity verification
- Attestation structure validation
- Capabilities enum validation
- Evidence verification
- Risk score range check
- Ed25519 signature verification (over RFC 8785 JCS canonical bytes)
- Revocation list check
- Expiration window check
- Proof-of-Possession (PoP) challenge
- TrustRegistry key binding
- Action receipt signature
- Supply-chain SBOM verification

5 frozen test vectors with canonical JCS bytes per fixture (hex + base64 + utf8) + SHA-256 + Ed25519 signature + expected verification outcome. Test CA private key intentionally published for cross-language reproducibility (anyone can re-derive signatures in Python/Go/Rust).

Conformance suite: 23/23 tests pass.

**Repo:** https://github.com/alicelabs-llc/universal-trust-adapter
**NPM:** marketnow-mcp@1.10.0 (958 downloads/mo), agent-trust-card@1.1.1 (518 downloads/mo)
**Install:** `curl -fsSL https://marketnow.site/install.sh | bash`

Happy to answer questions about the spec, the implementation, or the multi-channel distribution setup.

---

*Self-post: I'm Edison Flores, founder of AliceLabs LLC. We build open-source security infrastructure for AI agents.*
"""

# 2. Reddit r/LocalLLaMA
REDDIT_LOCALLLAMA = """**Title:** Open-source Universal Trust Adapter (UTA v1.0.0) — translates between 8 trust credential formats for AI agents

**Body:**

I built **UTA (Universal Trust Adapter) v1.0.0** — open-source spec that translates between 8 different trust credential formats used by AI agents. Think of it like the USB-C of agent trust — one canonical schema, multiple adapters.

**What UTA translates:**

1. ATC (Agent Trust Card — AliceLabs)
2. EAT-AI (IETF RFC 9421)
3. ZTA (Anthropic Zero-Trust Agent)
4. A2A Agent Card (Google/AAIF)
5. MCP Server Card (Anthropic)
6. W3C Verifiable Credentials
7. OAuth/OIDC
8. SPIFFE SVID

**Why it matters for local LLM agents:**

If you're running local agents (Ollama, vLLM, LM Studio) and they're calling MCP servers, you need a way to verify:
- Is this MCP server actually who it claims to be?
- What capabilities did it request at install time?
- Has the tool catalog changed since approval?
- Is it signed by a trusted CA?

UTA answers all four via a 12-stage fail-closed verification pipeline. It's MIT-free, no telemetry, no signup, no auth required.

**Try it:**

```bash
# Verify any ATC adapter card
npx -y agent-trust-card verify card.json

# Or run the full MCP server with 13 trust tools
npx -y marketnow-mcp
```

**Repo:** https://github.com/alicelabs-llc/universal-trust-adapter
**Architecture:** https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/docs/ARCHITECTURE.md
**Test vectors (with canonical JCS bytes):** https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/marketnow/docs/atc-spec/test-vectors

The test CA private key is intentionally published so anyone can re-derive the signatures in Python/Go/Rust and verify the crypto works as claimed.

AL-1.0 license (source-available, commercial use requires license).
"""

# 3. Hacker News
HN_SUBMISSION = """**Title:** Show HN: UTA v1.0.0 — Universal Trust Adapter (translates 8 trust credential formats for AI agents)

**URL to submit:** https://github.com/alicelabs-llc/universal-trust-adapter

**Text (if needed for Show HN):**

I've been working on **UTA (Universal Trust Adapter) v1.0.0** — an open-source spec that translates between 8 different trust credential formats used by AI agents via a canonical Universal Trust Schema (UTS v2.0.0).

The 8 formats:
- ATC (Agent Trust Card — AliceLabs)
- EAT-AI (IETF RFC 9421)
- ZTA (Anthropic Zero-Trust Agent)
- A2A Agent Card (Google/AAIF)
- MCP Server Card (Anthropic)
- W3C Verifiable Credentials
- OAuth/OIDC
- SPIFFE SVID

Key design choices:
- Ed25519 signatures (RFC 8032) — fast, compact, no JWT bloat
- RFC 8785 JCS canonicalization — same bytes in every language (Node, Python, Go, Rust)
- 12-stage fail-closed verification pipeline
- Test CA private key intentionally published for cross-language reproducibility
- Conformance suite (23/23 tests pass)

What motivated this: I've been building an MCP marketplace and a trojan slipped through my static scanner in July. The post-mortem made it clear that "download count + README trust" isn't enough — agents need cryptographic proof of who issued them, what capabilities they have, and when they expire.

The architecture is at https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/docs/ARCHITECTURE.md and the reference implementation uses only `node:crypto`.

A security researcher (anp2network on dev.to) recently found a real bug — my canonicalization was using a replacer function instead of a proper sort, which dropped nested keys out of the signature preimage. That's fixed now and the test vectors at https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/marketnow/docs/atc-spec/test-vectors include a `tampered-payload.json` specifically designed to catch that class of bug.

After GitHub flagged my personal account, I built 5 independent download channels (NPM, jsDelivr, unpkg, marketnow.site, GitHub org) — all serve byte-identical tarballs, SHA-256 verified.

Happy to answer questions about the spec, the implementation, or the threat model.
"""

# 4. LinkedIn
LINKEDIN = """**Post:**

After 2 months building open-source security infrastructure for AI agents, here's what I learned about distribution:

**The problem:** Single-platform dependency is a strategic risk.

My GitHub account got flagged by abuse-detection 2 weeks ago. All 55 public repos instantly returned HTTP 404 to anonymous visitors. Security researchers trying to audit my cryptographic implementation publicly commented that they couldn't access the source code.

**The fix:** Build 5 independent download channels.

1. NPM Registry (primary, independent of GitHub)
2. jsDelivr CDN (free global CDN that mirrors NPM automatically)
3. unpkg CDN (alternative CDN, also mirrors NPM)
4. marketnow.site (AliceLabs-owned origin server)
5. GitHub org (alicelabs-llc — moved from personal account to org)

All 5 channels serve byte-identical tarballs. SHA-256 verified. If any one is blocked, the other 4 continue working.

**The lesson:** Don't wait until your account is banned to build distribution redundancy. By the time you need it, it's too late.

The work: **UTA v1.0.0 (Universal Trust Adapter)** — translates between 8 trust credential formats (ATC, EAT-AI, ZTA, A2A, MCP Card, W3C VC, OAuth, SPIFFE) via a canonical Universal Trust Schema (UTS v2.0.0). Ed25519 signatures, RFC 8785 JCS canonicalization, 12-stage verification pipeline, 5 frozen test vectors with canonical bytes published for independent verification.

Repo: https://github.com/alicelabs-llc/universal-trust-adapter
NPM: marketnow-mcp (958 downloads/mo), agent-trust-card (518 downloads/mo)

If you're building AI agent infrastructure, message me — I'm looking for collaborators, integrators, and reviewers.

#AIAgents #OpenSource #Security #Cryptography #MCP #TrustProtocol #Ed25519 #UTA
"""

# 5. Twitter/X thread
TWITTER = """**Thread (10 tweets):**

1/ I built **UTA v1.0.0 (Universal Trust Adapter)** — an open-source spec that translates between 8 trust credential formats used by AI agents.

USB-C for agent trust. One canonical schema (UTS v2.0.0), 8 adapters.

After 2 months and 96 technical articles, here's what shipped:

2/ The 8 formats UTA translates between:

- ATC (Agent Trust Card)
- EAT-AI (IETF)
- ZTA (Anthropic)
- A2A (Google/AAIF)
- MCP Card (Anthropic)
- W3C Verifiable Credentials
- OAuth/OIDC
- SPIFFE SVID

3/ The 12-stage fail-closed verification pipeline:

1. Identity
2. Attestation
3. Capabilities
4. Evidence
5. Risk
6. Ed25519 signature (over RFC 8785 JCS)
7. Revocation
8. Expiration
9. Proof-of-Possession (nonce challenge)
10. TrustRegistry key binding
11. Action receipt signature
12. Supply-chain SBOM

4/ The test CA private key is intentionally published.

Why? So any Python/Go/Rust verifier can re-derive the signatures from scratch and confirm the crypto works as claimed. No "trust me" — verify it yourself.

5/ Distribution is the hard part.

After GitHub flagged my account (still unresolved after 2 weeks), all 55 of my repos returned HTTP 404 to anonymous visitors.

Built 5 independent download channels:
- NPM Registry
- jsDelivr CDN
- unpkg CDN
- marketnow.site (owned origin)
- GitHub org

6/ All 5 channels serve byte-identical tarballs. SHA-256 verified.

If any one is blocked, the other 4 continue working.

```bash
curl -fsSL https://marketnow.site/install.sh | bash
```

7/ The most useful technical critique came from @anp2network on dev.to.

They wrote an independent Python verifier, found that my canonicalization function was actually a replacer allowlist — not a sorter. Nested keys like `trust.sentinel_score` were getting dropped from the signature preimage entirely.

8/ That bug is now fixed and there's a test vector (`tampered-payload.json`) specifically designed to catch that class of issue. The nested-object bug → SHA-256 mismatch → verification failure.

Public bytes: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/marketnow/docs/atc-spec/test-vectors

9/ What's next:
- Multi-sig for high-value agents (N-of-M CA signatures)
- Runtime tool-catalog pinning (catch tool-description-poisoning)
- Behavior-based detection layer (post-exec filter)
- Cross-language SDKs (Python, Go, Rust)
- More test vectors covering edge cases

10/ Repo: https://github.com/alicelabs-llc/universal-trust-adapter
NPM: marketnow-mcp (958/mo), agent-trust-card (518/mo)

If you're building AI agent infrastructure, message me. Looking for collaborators, integrators, and reviewers.

#AIAgents #OpenSource #Security #Cryptography #MCP #UTA
"""

# 6. Hashnode article
HASHNODE = """---
title: "UTA v1.0.0: Universal Trust Adapter — an open-source spec that translates between 8 trust credential formats for AI agents"
subtitle: 12-stage verification pipeline, Ed25519 + RFC 8785 JCS, 5 independent download channels
published: true
tags: security, cryptography, ai-agents, mcp
---

**Correction note:** Earlier drafts of this material misnamed the project as "ATC/1.0." That was wrong. ATC is one of 8 adapter formats UTA supports — not the project name. This version corrects that throughout.

I've been building open-source security infrastructure for AI agents for the past two months. This is a writeup of what shipped, what broke, and what I learned.

## The problem

After my MCP marketplace got a trojan through in July (caught by seccomp denial on `clone()` syscall, not by the static scanner), it became clear that "download count + README trust" isn't enough. AI agents need cryptographic proof of who issued them, what capabilities they have, and when they expire.

The web has X.509 certificates. AI agents need an equivalent — and it needs to be open-source, cross-language, and verifiable without trusting the issuer.

## UTA: Universal Trust Adapter

**UTA** translates between 8 different trust credential formats via a canonical Universal Trust Schema (UTS v2.0.0). Think of it as the USB-C of agent trust — one canonical schema, multiple adapters.

The 8 formats:

1. ATC (Agent Trust Card — AliceLabs)
2. EAT-AI (IETF RFC 9421)
3. ZTA (Anthropic Zero-Trust Agent)
4. A2A Agent Card (Google/AAIF)
5. MCP Server Card (Anthropic)
6. W3C Verifiable Credentials
7. OAuth/OIDC
8. SPIFFE SVID

## The 12-stage verification pipeline

Each adapter's credential goes through a 12-stage fail-closed verification pipeline:

1. **Identity** — agent_id, agent_name, agent_owner, owner_contact
2. **Attestation** — subject_public_key, signature, signed_payload_hash
3. **Capabilities** — filesystem, network, shell, credentials, process (all enum-validated)
4. **Evidence** — audit_pipeline, static/dynamic/runtime checks, findings
5. **Risk** — trust_score (0-10), risk_level, decision_authority=consumer
6. **Signature** — Ed25519 over RFC 8785 JCS canonicalization, SHA-256
7. **Revocation** — revocation_check_url, method, required
8. **Expiration** — issued_at, expires_at, max_ttl_days
9. **Proof-of-Possession** — nonce challenge (anti-replay)
10. **TrustRegistry** — key binding verification
11. **Action receipt** — signed Ed25519 receipt for each invocation
12. **Supply-chain SBOM** — SPDX 2.3 SBOM verification

## The crypto

- **Signature algorithm:** Ed25519 (RFC 8032) — fast, compact, quantum-resistant enough for now
- **Canonicalization:** RFC 8785 JCS (JSON Canonicalization Scheme) — same bytes in every language
- **Hash:** SHA-256 over canonical bytes
- **Domain separation:** 7 distinct signature domains to prevent cross-context signature reuse
- **Proof-of-Possession:** nonce challenge anti-replay

The reference implementation uses only `node:crypto`. No external crypto deps.

## The test vectors

5 frozen test vectors published with:

- Canonical JCS bytes (hex + base64 + utf8) per vector
- SHA-256 of canonical bytes
- Ed25519 signature
- Expected verification outcome
- Stored signed_payload_hash (should match computed, except for `tampered-payload.json` where the mismatch is intentional)

The test CA keypair is intentionally published (including private key) so any Python/Go/Rust verifier can re-derive the signatures from scratch.

## The distribution problem

Two weeks ago, GitHub flagged my personal account (`@edgarfloresguerra2011-a11y`). All 55 public repos instantly returned HTTP 404 to anonymous visitors. The ticket is still open with GitHub Support.

The fix was to build 5 independent download channels:

1. **NPM Registry** — primary, independent of GitHub
2. **jsDelivr CDN** — free global CDN that mirrors NPM automatically
3. **unpkg CDN** — alternative CDN that mirrors NPM
4. **marketnow.site** — AliceLabs-owned origin server
5. **GitHub org (alicelabs-llc)** — publicly accessible

All 5 channels serve byte-identical tarballs. SHA-256 verified. If any one is blocked, the other 4 continue working.

```bash
curl -fsSL https://marketnow.site/install.sh | bash
```

## What I learned

1. **Single-platform dependency is a strategic risk.** Don't wait until your account is banned to build distribution redundancy.

2. **The most useful critique came from a third-party reviewer.** @anp2network on dev.to found that my "canonicalization" was actually a replacer allowlist, not a sorter. Nested keys were getting dropped from the signature preimage entirely. They were right, and the bug is now fixed.

3. **The test CA private key should be published.** This sounds counterintuitive but it's the only way to make the spec truly cross-language verifiable. Anyone can re-derive the signatures in any language and confirm.

4. **Conformance tests are not enough.** You need must-fail fixtures (expired, tampered-payload, wrong-ca-key) — not just must-pass tests. The nested-object bug passed every must-pass test by construction.

5. **The honest version of "8 layers of security" is "8 layers, 2 of which actually caught things, here's what the other 6 are for."** Per-layer catch counts matter more than layer count.

## Try it

```bash
# Install the ATC adapter SDK (one of 8 adapters UTA supports)
npm install agent-trust-card

# Verify any ATC card
atc verify card.json

# Install the MCP server with 13 trust tools
npx -y marketnow-mcp
```

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- Architecture: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/docs/ARCHITECTURE.md
- Test vectors: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/marketnow/docs/atc-spec/test-vectors

If you're building AI agent infrastructure, message me. I'm looking for collaborators, integrators, and reviewers.
"""

# 7. Discord messages
DISCORD = """# Discord Messages — for posting in MCP, Anthropic, Cursor, Cline, Continue, Aider servers

## MCP Discord (#showcase channel)

I built **UTA v1.0.0 (Universal Trust Adapter)** — an open-source spec that translates between 8 trust credential formats used by AI agents via a canonical Universal Trust Schema (UTS v2.0.0).

The 8 formats UTA translates between:
- ATC, EAT-AI (IETF), ZTA (Anthropic), A2A (Google), MCP Server Card, W3C VC, OAuth, SPIFFE

12-stage fail-closed verification pipeline:
- Identity → Attestation → Capabilities → Evidence → Risk → Ed25519 signature → Revocation → Expiration → PoP → TrustRegistry → Action receipt → SBOM

5 frozen test vectors with canonical JCS bytes published. Test CA private key intentionally published for cross-language reproducibility. Conformance suite: 23/23 tests pass.

Repo: https://github.com/alicelabs-llc/universal-trust-adapter
Install: `npm install agent-trust-card`

After GitHub flagged my personal account (still unresolved), I built 5 independent download channels — NPM, jsDelivr, unpkg, marketnow.site, GitHub org. All serve byte-identical tarballs.

Looking for collaborators and reviewers.

## Anthropic Discord (#tools channel)

Built an MCP server (`marketnow-mcp`) with 13 trust tools — including `marketnow_verify_atc_spec`, `marketnow_verify_trust`, `marketnow_get_owasp_compliance`. 958 monthly downloads on NPM.

Part of **UTA v1.0.0 (Universal Trust Adapter)** — translates between 8 trust credential formats (ATC, EAT-AI, ZTA, A2A, MCP Card, W3C VC, OAuth, SPIFFE) via canonical Universal Trust Schema (UTS v2.0.0).

For AI agents that need to verify trust of MCP servers before calling them. Uses Ed25519 signatures + RFC 8785 JCS canonicalization.

```bash
npx -y marketnow-mcp
```

Works with Claude Desktop, Cursor, Cline, Continue, Aider.

Repo: https://github.com/alicelabs-llc/universal-trust-adapter

## Cursor Discord

MarketNow MCP server (`marketnow-mcp`) now works with Cursor. 13 trust tools including:
- `marketnow_verify_atc_spec` — verify any ATC adapter card against spec
- `marketnow_verify_trust` — check trust score of any MCP server
- `marketnow_get_owasp_compliance` — get OWASP MCP Top 10 compliance

```bash
# In Cursor MCP settings:
{
  "mcpServers": {
    "marketnow": {
      "command": "npx",
      "args": ["-y", "marketnow-mcp"]
    }
  }
}
```

958 downloads/month. Open-source, AL-1.0 license. Part of UTA v1.0.0.

## Cline Discord

Free MCP server for AI agents: `marketnow-mcp` (958 downloads/mo, 13 trust tools).

Verifies trust of any MCP server in 1 command using **UTA v1.0.0 (Universal Trust Adapter)** — translates between 8 trust credential formats via canonical Universal Trust Schema (UTS v2.0.0). Ed25519 signatures, RFC 8785 JCS, 12-stage verification pipeline.

```bash
npx -y marketnow-mcp
```

Works with Cline out of the box.

## Continue Discord

MarketNow MCP server — 13 trust tools for AI agents. Verify any MCP server's trust in 1 command.

```bash
npx -y marketnow-mcp
```

Open-source. AL-1.0 license. 958 downloads/month. Part of UTA v1.0.0.

Repo: https://github.com/alicelabs-llc/universal-trust-adapter
Architecture: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/docs/ARCHITECTURE.md

## Aider Discord

For AI coding assistants that need to verify trust of MCP servers before calling them:

`marketnow-mcp` — 13 trust tools (verify_atc_spec, verify_trust, get_owasp_compliance, etc.)
`agent-trust-card` — SDK to issue/verify Agent Trust Cards (one of 8 adapters in UTA)

```bash
npx -y marketnow-mcp
npm install agent-trust-card
```

Both work with Aider. Open-source, AL-1.0 license. Part of UTA v1.0.0.
"""

# Write all files
files = {
    'reddit_r_mcp.md': REDDIT_MCP,
    'reddit_r_localllama.md': REDDIT_LOCALLLAMA,
    'hackernews_submission.md': HN_SUBMISSION,
    'linkedin_post.md': LINKEDIN,
    'twitter_thread.md': TWITTER,
    'hashnode_article.md': HASHNODE,
    'discord_messages.md': DISCORD,
}

for filename, content in files.items():
    filepath = os.path.join(PROMO_DIR, filename)
    # Prepend the naming note
    with open(filepath, 'w') as f:
        f.write(NAMING_NOTE + content)
    print(f"  ✓ Regenerated {filename}")

print()
print(f"All {len(files)} promotion posts regenerated with correct UTA v1.0.0 naming.")
