<!-- Target: r/ClaudeAI -->
<!-- Post type: text post -->

**Title:** Built a verification layer for MCP servers (the protocol Anthropic launched) — looking for feedback

**Body:**

Hey r/ClaudeAI —

Anthropic launched MCP (Model Context Protocol) last year. It's a great protocol, but I noticed a gap: when an agent loads an MCP server, there's no canonical way to verify *who issued the credential* for that server before the agent executes its tools.

I built **Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

UTA verifies credentials in 8 formats (MCP Server Cards natively, plus 7 others: ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, X.509) through a 12-stage pipeline.

**Stats:**
- 6,744 verifications/sec
- 480+ tests
- Public API: https://www.marketnow.site/api/trust

The MCP Server Card format is one of the 8 native formats. If you're building Claude agents that invoke MCP servers, UTA can verify the server's card before Claude executes.

Would love feedback from the community. Is this a gap you've hit?
