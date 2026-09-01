<!-- Target: r/cursor -->
<!-- Post type: text post -->

**Title:** Built a credential verification layer for MCP servers Cursor loads — looking for feedback from Cursor users

**Body:**

Hey r/cursor —

I've been using Cursor's MCP integration heavily, and one thing kept bugging me: when I wire up a third-party MCP server in `.cursor/mcp.json`, there's no canonical way to verify *who issued the credential* for that server before Cursor lets it touch my codebase.

So I built **Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

It verifies credentials in 8 formats:
- ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Server Cards, X.509

Through a 12-stage pipeline: `PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION`

**Benchmarks:**
- 6,744 verifications/sec (single core)
- 480+ tests, 23 property tests
- Public API: https://www.marketnow.site/api/trust

**For Cursor users specifically:**
You could write a tiny script that verifies each MCP server's card before Cursor loads it. I wrote a 15-language snippet collection here: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/snippets

Not asking Cursor to bundle this — just wondering if other Cursor users see the same gap.

Thoughts?
