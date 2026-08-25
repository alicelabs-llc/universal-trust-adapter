<!-- NAMING CORRECTION:
  - Project name: UTA v1.0.0 (Universal Trust Adapter)
  - ATC (Agent Trust Card) is ONE of 8 adapter formats UTA supports
  - Canonical schema: UTS v2.0.0 (Universal Trust Schema)
  - 8 formats UTA translates: ATC, EAT-AI, ZTA, A2A, MCP Card, W3C VC, OAuth, SPIFFE
-->

# Discord Messages — for posting in MCP, Anthropic, Cursor, Cline, Continue, Aider servers

## MCP Discord (#showcase channel)

I built **UTA v1.0.0 (Universal Trust Adapter)** — an open-source spec that translates between 8 trust credential formats used by AI agents via a canonical Universal Trust Schema (UTS v2.0.0).

The 8 formats UTA translates between:
- ATC, EAT-AI (IETF), ZTA (Anthropic), A2A (Google), MCP Server Card, W3C VC, OAuth, SPIFFE

12-stage fail-closed verification pipeline:
- Identity → Attestation → Capabilities → Evidence → Risk → Ed25519 signature → Revocation → Expiration → PoP → TrustRegistry → Action receipt → SBOM

5 frozen test vectors with canonical JCS bytes published. Test CA private key intentionally published for cross-language reproducibility. Conformance suite: 23/23 tests pass.

Repo: https://github.com/alicelabs-llc/universal-trust-adapter
Install: `npm install agent-trust-card`

After 

Looking for collaborators and reviewers.

## Anthropic Discord (#tools channel)

Built an MCP server (`marketnow-mcp`) with 13 trust tools — including `marketnow_verify_atc_spec`, `marketnow_verify_trust`, `marketnow_get_owasp_compliance`. 958 monthly downloads on NPM.

Part of **UTA v1.0.0 (Universal Trust Adapter)** — translates between 8 trust credential formats (ATC, EAT-AI, ZTA, A2A, MCP Card, W3C VC, OAuth, SPIFFE) via canonical Universal Trust Schema (UTS v2.0.0).

For AI agents that need to verify trust of MCP servers before calling them. Uses Ed25519 signatures + RFC 8785 JCS canonicalization.

```bash
npx -y marketnow-mcp
```

Works with Claude Desktop, Cursor, Cline, Continue, Aider.

Repo: https://github.com/alicelabs-llc/universal-trust-adapter

## Cursor Discord

MarketNow MCP server (`marketnow-mcp`) now works with Cursor. 13 trust tools including:
- `marketnow_verify_atc_spec` — verify any ATC adapter card against spec
- `marketnow_verify_trust` — check trust score of any MCP server
- `marketnow_get_owasp_compliance` — get OWASP MCP Top 10 compliance

```bash
# In Cursor MCP settings:
{
  "mcpServers": {
    "marketnow": {
      "command": "npx",
      "args": ["-y", "marketnow-mcp"]
    }
  }
}
```

958 downloads/month. Open-source, AL-1.0 license. Part of UTA v1.0.0.

## Cline Discord

Free MCP server for AI agents: `marketnow-mcp` (958 downloads/mo, 13 trust tools).

Verifies trust of any MCP server in 1 command using **UTA v1.0.0 (Universal Trust Adapter)** — translates between 8 trust credential formats via canonical Universal Trust Schema (UTS v2.0.0). Ed25519 signatures, RFC 8785 JCS, 12-stage verification pipeline.

```bash
npx -y marketnow-mcp
```

Works with Cline out of the box.

## Continue Discord

MarketNow MCP server — 13 trust tools for AI agents. Verify any MCP server's trust in 1 command.

```bash
npx -y marketnow-mcp
```

Open-source. AL-1.0 license. 958 downloads/month. Part of UTA v1.0.0.

Repo: https://github.com/alicelabs-llc/universal-trust-adapter
Architecture: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/docs/ARCHITECTURE.md

## Aider Discord

For AI coding assistants that need to verify trust of MCP servers before calling them:

`marketnow-mcp` — 13 trust tools (verify_atc_spec, verify_trust, get_owasp_compliance, etc.)
`agent-trust-card` — SDK to issue/verify Agent Trust Cards (one of 8 adapters in UTA)

```bash
npx -y marketnow-mcp
npm install agent-trust-card
```

Both work with Aider. Open-source, AL-1.0 license. Part of UTA v1.0.0.
