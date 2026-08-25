<!-- NAMING CORRECTION:
  - Project name: UTA v1.0.0 (Universal Trust Adapter)
  - ATC (Agent Trust Card) is ONE of 8 adapter formats UTA supports
  - Canonical schema: UTS v2.0.0 (Universal Trust Schema)
  - 8 formats UTA translates: ATC, EAT-AI, ZTA, A2A, MCP Card, W3C VC, OAuth, SPIFFE
-->

**Title:** Open-source Universal Trust Adapter (UTA v1.0.0) — translates between 8 trust credential formats for AI agents

**Body:**

I built **UTA (Universal Trust Adapter) v1.0.0** — open-source spec that translates between 8 different trust credential formats used by AI agents. Think of it like the USB-C of agent trust — one canonical schema, multiple adapters.

**What UTA translates:**

1. ATC (Agent Trust Card — AliceLabs)
2. EAT-AI (IETF RFC 9421)
3. ZTA (Anthropic Zero-Trust Agent)
4. A2A Agent Card (Google/AAIF)
5. MCP Server Card (Anthropic)
6. W3C Verifiable Credentials
7. OAuth/OIDC
8. SPIFFE SVID

**Why it matters for local LLM agents:**

If you're running local agents (Ollama, vLLM, LM Studio) and they're calling MCP servers, you need a way to verify:
- Is this MCP server actually who it claims to be?
- What capabilities did it request at install time?
- Has the tool catalog changed since approval?
- Is it signed by a trusted CA?

UTA answers all four via a 12-stage fail-closed verification pipeline. It's MIT-free, no telemetry, no signup, no auth required.

**Try it:**

```bash
# Verify any ATC adapter card
npx -y agent-trust-card verify card.json

# Or run the full MCP server with 13 trust tools
npx -y marketnow-mcp
```

**Repo:** https://github.com/alicelabs-llc/universal-trust-adapter
**Architecture:** https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/docs/ARCHITECTURE.md
**Test vectors (with canonical JCS bytes):** https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/marketnow/docs/atc-spec/test-vectors

The test CA private key is intentionally published so anyone can re-derive the signatures in Python/Go/Rust and verify the crypto works as claimed.

AL-1.0 license (source-available, commercial use requires license).
