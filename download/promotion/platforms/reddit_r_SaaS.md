<!-- Target: r/SaaS -->
<!-- Post type: text post -->

**Title:** Built an open-source credential verification layer for AI agents — looking for feedback from SaaS founders

**Body:**

Hey r/SaaS —

I'm building an open-source project called **Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

The pitch: when AI agents invoke tools (MCP servers, APIs), there's no canonical way to verify *who issued the credential* for that tool. UTA verifies credentials in 8 formats through a 12-stage pipeline.

**Why I'm posting here:**

If you're building a SaaS that uses AI agents (and most of you are), you'll hit this problem eventually: an agent invokes a tool, and you have no idea if the credential for that tool is valid, who issued it, or whether it's been revoked.

UTA solves this. It's open-source (Apache 2.0), has a public API (https://www.marketnow.site/api/trust), and NPM packages.

**Stats:**
- 6,744 verifications/sec
- 480+ tests
- 15-language snippet collection
- 7 multilingual READMEs

**Business model:** open-source core + hosted API with rate limits + enterprise self-hosted.

Looking for:
1. Feedback from SaaS founders who have AI agents in production
2. Beta testers for the hosted API
3. Anyone who wants to integrate UTA into their agent stack

Repo: https://github.com/alicelabs-llc/universal-trust-adapter
