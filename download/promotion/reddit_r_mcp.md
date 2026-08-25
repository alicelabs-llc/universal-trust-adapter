<!-- NAMING: UTA v1.0.0 = Universal Trust Adapter. ATC is one of 8 adapters. -->

**Title:** I built UTA — Universal Trust Adapter (8 format adapters, 12-stage verification pipeline, 2,339 NPM downloads/mo)

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

**What shipped:**
- 7 NPM packages (2,339 monthly downloads)
- 41 test vectors with canonical JCS bytes + SHA-256
- Test CA private key published for cross-language reproducibility
- Conformance suite: 23/23 tests pass
- Independent security audit: 14/14 findings fixed

**Install:**
```bash
npm install agent-trust-card@1.1.2
npx -y marketnow-mcp@1.10.1
curl -fsSL https://marketnow.site/install.sh | bash
```

**Repo:** https://github.com/alicelabs-llc/universal-trust-adapter
**Spec:** https://marketnow.site/uta/docs/atc-spec/SPEC.md
**Test vectors:** https://marketnow.site/uta/docs/atc-spec/test-vectors/_index.json

Happy to answer questions about the spec, the implementation, or the audit.

---

*Self-post: I'm Edison Flores, founder of AliceLabs LLC. We build open-source security infrastructure for AI agents.*
