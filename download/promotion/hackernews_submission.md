<!-- NAMING CORRECTION:
  - Project name: UTA v1.0.0 (Universal Trust Adapter)
  - ATC (Agent Trust Card) is ONE of 8 adapter formats UTA supports
  - Canonical schema: UTS v2.0.0 (Universal Trust Schema)
  - 8 formats UTA translates: ATC, EAT-AI, ZTA, A2A, MCP Card, W3C VC, OAuth, SPIFFE
-->

**Title:** Show HN: UTA v1.0.0 — Universal Trust Adapter (translates 8 trust credential formats for AI agents)

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
