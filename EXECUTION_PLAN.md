# UTA — 6-Month Execution Plan

**Period:** 2026-09-01 → 2027-02-28
**Team:** Edison Flores (co-creator) + Alejandro Flores (co-creator)

## Sprint 1 (Sep 2026): Foundations — DONE
- ✅ UTS spec v1.0 published
- ✅ ATC v3 Draft 00 published
- ✅ TrustEngine core (TypeScript) implemented
- ✅ 8 adapters stubs implemented
- ✅ REST API spec published
- ✅ OWASP rename fix documented

## Sprint 2 (Oct 2026): Adapter implementation
- Implement real Ed25519 / ES256 / RS256 signature verification in each adapter
- ZTA adapter: research Anthropic's signature scheme (not published as RFC)
- A2A adapter: integrate with real A2A v1.0 protocol
- MCP adapter: integrate with MCP 2026-07-28 spec
- Test vectors: 50+ valid + 50+ invalid credentials per format

## Sprint 3 (Nov 2026): Auto-detection + Bridge
- engine.detectFormat() — confidence-scored multi-format detection
- engine.bridge() — verify in one ecosystem, re-issue as another
- W3C VC adapter: full Ed25519Signature2020 implementation
- OAuth adapter: JWKS fetching + RS256 verification
- SPIFFE adapter: X.509 chain verification + JWT-SVID

## Sprint 4 (Dec 2026): SDKs + Documentation
- Publish `@marketnow/trust-core` v0.1.0 to npm
- Publish `marketnow-trust` v0.1.0 to PyPI
- Documentation site: trust.alicelabs.site/docs
- Plugin system: `@marketnow/trust-adapter-template` for custom formats
- 10+ code examples covering all 42 translation pairs

## Sprint 5 (Jan 2027): Adoption + Interop
- Live interop tests with A2A v1.0 (real AgentCards)
- Live interop tests with MCP servers (real registry entries)
- Demo: Claude agent verifies OpenAI agent via UTA bridge
- 3 enterprise design partners identified
- 5 vertical-specific demos documented

## Sprint 6 (Feb 2027): Standards body
- Submit UTS + UTA to AAIF (Linux Foundation) as hosted project
- Publish as RFC open standard
- Open source all adapters (already MIT, but make it official)
- Announcement: HN, r/MCP, dev.to, X
- 1 runtime integration merged (Cursor or Cline)

## Metrics for success
- 7+ formats supported
- 42 translation pairs working (7×6)
- 10,000+ npm downloads/week
- 3+ enterprise design partners
- 1+ runtime with merged UTA integration
- 1+ external issuer in Trust Registry
- AAIF hosting accepted

## Premise check (every sprint)
1. Did we make UTA more open? (More MIT code, more formats, more adopters?)
2. Did we make UTA more adoptable? (Easier to integrate, better DX, more docs?)
3. Did we make UTA more neutral? (Less AliceLabs-specific, more runtime-agnostic?)
