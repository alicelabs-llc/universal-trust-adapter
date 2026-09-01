<!-- Target: r/devops -->
<!-- Post type: text post -->

**Title:** Built a credential verification layer for AI agents — useful for DevOps teams running agent fleets

**Body:**

Hey r/devops —

If you're running fleets of AI agents in production (and increasingly, you are), you've probably hit this: an agent invokes a tool (MCP server, internal API), and you have no idea if the credential for that tool is valid, who issued it, or whether it's been revoked.

I built **Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

- Verifies credentials in 8 formats (ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509)
- 12-stage pipeline (parser → detect → schema → crypto → issuer → key_binding → pop → provenance → lifecycle → evidence → policy → decision)
- 6,744 verifications/sec (single core)
- Public API: https://www.marketnow.site/api/trust
- Bash CLI: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/snippets/bash
- Docker-friendly, zero external deps in core

For DevOps: UTA can run as a sidecar that verifies every credential an agent presents before the agent's tool call is dispatched. Failed verification → structured log + metric + optional block.

Curious what r/devops thinks of the sidecar approach vs. in-process verification.
