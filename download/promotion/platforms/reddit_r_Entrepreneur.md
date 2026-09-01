<!-- Target: r/Entrepreneur -->
<!-- Post type: text post -->

**Title:** Open-sourced a credential verification layer for AI agents — would love feedback from fellow founders

**Body:**

Hey r/Entrepreneur —

I just open-sourced **Universal Trust Adapter (UTA)** — a credential verification layer for AI agents.

**The problem I saw:** AI agents invoke tools (MCP servers, APIs, microservices), but there's no canonical way to verify *who issued the credential* for a tool before the agent executes. Each standard (OAuth, X.509, W3C VC, MCP Cards) answers the question differently.

**What I built:** UTA verifies credentials in 8 formats through a 12-stage pipeline. 6,744 verifications/sec, 480+ tests, public API.

**Repo:** https://github.com/alicelabs-llc/universal-trust-adapter

**Why I'm posting here:**

I'd love feedback from fellow entrepreneurs on the open-source-as-distribution-strategy angle. The thesis:
- Open-source the core verifier (Apache 2.0)
- Hosted API with rate limits (free tier)
- Enterprise self-hosted (paid)
- Conformance suite and certification (paid, future)

If you've built a SaaS with an open-source core, I'd love to hear your experience. Did the open-source distribution actually drive adoption? What would you do differently?

Not linking to a landing page — the repo is the landing page.
