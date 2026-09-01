<!-- Target: r/OpenAI -->
<!-- Post type: text post -->

**Title:** Built a verification layer for tool credentials in OpenAI Agents SDK — RFC open

**Body:**

Hey r/OpenAI —

When OpenAI Agents SDK agents invoke tools (including MCP-backed ones), there's no canonical way to verify *who issued the credential* for a tool before the agent dispatches.

I built **Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

- 8 credential formats: ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509
- 12-stage pipeline
- 6,744 verifications/sec
- Public API: https://www.marketnow.site/api/trust

I opened an RFC issue in the OpenAI Agents SDK repo proposing an optional `trust_verifier` hook: https://github.com/openai/openai-agents-python/issues/4806

Not asking them to bundle UTA — just proposing a hook so any verifier can plug in.

Would love feedback from this community before the SDK team responds.
