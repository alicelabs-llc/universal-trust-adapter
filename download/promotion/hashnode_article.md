<!-- NAMING CORRECTION:
  - Project name: UTA v1.0.0 (Universal Trust Adapter)
  - ATC (Agent Trust Card) is ONE of 8 adapter formats UTA supports
  - Canonical schema: UTS v2.0.0 (Universal Trust Schema)
  - 8 formats UTA translates: ATC, EAT-AI, ZTA, A2A, MCP Card, W3C VC, OAuth, SPIFFE
-->

---
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

Two weeks ago, 

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
