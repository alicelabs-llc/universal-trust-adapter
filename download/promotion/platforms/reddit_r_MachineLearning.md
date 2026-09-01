<!-- Target: r/MachineLearning -->
<!-- Post type: text post -->

**Title:** [D] Universal Trust Adapter — credential verification for AI agent tool calls (8 formats, 12-stage pipeline)

**Body:**

I've been working on a verification layer for AI agent tool calls. The gap: when an agent invokes a tool (MCP server, API, microservice), there's no canonical way to verify *who issued the credential* for that tool before the agent dispatches.

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

UTA supports 8 credential formats:
- ATC v3 (Agent Trust Card)
- JWT (with `x5c` chain)
- W3C Verifiable Credentials
- A2A (Agent-to-Agent) cards
- EAT-AI (Entity Attestation Tokens)
- ZTA (Zero Trust Agent) cards
- MCP Server Cards
- X.509 certificates

Through a 12-stage pipeline: `PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION`

**Benchmarks:**
- 6,744 verifications/sec (single core)
- 480+ tests, 23 property tests
- Public API: https://www.marketnow.site/api/trust

**Discussion questions:**
1. Has anyone here hit the "unverified tool credential" problem in production?
2. Is a 12-stage pipeline overkill, or about right?
3. Are there credential formats I'm missing that you'd want supported?

I've opened RFC issues in LangChain, LlamaIndex, AutoGen, Pydantic AI, Semantic Kernel, Google ADK, OpenAI Agents SDK, Anthropic SDK, Haystack, LiteLLM, Continue, and Ant Design X. Links in the repo.
