<!-- Target: r/IndieDev -->
<!-- Post type: text post -->

**Title:** Open-sourced a credential verification layer for AI agents — looking for feedback from indie devs

**Body:**

Hey r/IndieDev —

I'm a solo dev who just open-sourced a project: **Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

It verifies AI agent credentials in 8 formats (JWT, W3C VC, X.509, MCP Cards, ATC v3, A2A, EAT-AI, ZTA) through a 12-stage pipeline.

**Stats:**
- 6,744 verifications/sec
- 480+ tests
- 15-language snippet collection
- 7 multilingual READMEs
- Public API: https://www.marketnow.site/api/trust

**Why I'm posting here:**

I want to be honest about the indie dev experience. Building this solo took ~3 months. The hardest parts:
1. **Multi-format support** — each credential format has its own quirks. JWT's `x5c` chain is different from X.509's PEM chain is different from W3C VC's `proof.verificationMethod`.
2. **Conformance testing** — building 23 property tests that catch real bugs was harder than building the verifier itself.
3. **Documentation in 7 languages** — I'm a native Spanish speaker. Translating technical docs to JP/CN/RU was humbling.

If you're an indie dev building in the AI agent space, I'd love to hear your experience. What's harder than you expected?

Repo: https://github.com/alicelabs-llc/universal-trust-adapter
