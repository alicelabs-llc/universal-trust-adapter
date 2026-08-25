<!-- NAMING: UTA v1.0.0 = Universal Trust Adapter. ATC is one of 8 adapters. -->

**Title:** Open-source Universal Trust Adapter (UTA v1.0.0) — translates between 8 trust credential formats for AI agents

**Body:**

I built **UTA (Universal Trust Adapter) v1.0.0** — open-source spec that translates between 8 different trust credential formats used by AI agents. Think of it as the USB-C of agent trust — one canonical schema, 8 adapters.

**The 8 formats:**
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

UTA answers all four via a 12-stage fail-closed verification pipeline. MIT-free, no telemetry, no signup, no auth required.

**Try it:**
```bash
npx -y agent-trust-card verify card.json
npx -y marketnow-mcp
```

**Repo:** https://github.com/alicelabs-llc/universal-trust-adapter
**Spec:** https://marketnow.site/uta/docs/atc-spec/SPEC.md
**Test vectors:** https://marketnow.site/uta/docs/atc-spec/test-vectors/_index.json

The test CA private key is intentionally published so anyone can re-derive the signatures in Python/Go/Rust and verify the crypto works as claimed.
