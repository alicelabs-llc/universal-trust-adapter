**Title:** Show HN: UTA — Universal Trust Adapter, 8 format adapters for AI agent trust

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
- Ed25519 signatures (RFC 8032) — fast, compact
- RFC 8785 JCS canonicalization — same bytes in every language (Node, Python, Go, Rust)
- 12-stage fail-closed verification pipeline
- Test CA private key intentionally published for cross-language reproducibility
- Conformance suite (23/23 tests pass)

The reference implementation is ~200 lines of Node.js using only `node:crypto`.

A security researcher recently verified the implementation independently and found a real bug — my canonicalization was using a replacer function instead of a proper sort, which dropped nested keys out of the signature preimage. That's fixed now and the test vectors include a `tampered-payload.json` specifically designed to catch that class of bug.

Happy to answer questions about the spec, the implementation, or the audit (14/14 findings fixed).
