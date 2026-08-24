<!-- NAMING CORRECTION:
  - Project name: UTA v1.0.0 (Universal Trust Adapter)
  - ATC (Agent Trust Card) is ONE of 8 adapter formats UTA supports
  - Canonical schema: UTS v2.0.0 (Universal Trust Schema)
  - 8 formats UTA translates: ATC, EAT-AI, ZTA, A2A, MCP Card, W3C VC, OAuth, SPIFFE
-->

**Title:** I built UTA — an open-source Universal Trust Adapter (8 format adapters, 12-stage verification pipeline, 5 download channels)

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
