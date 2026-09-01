<!-- Target: r/AIAgents -->
<!-- Post type: text post -->

**Title:** Built a credential verification layer for AI agents — 8 formats, 12-stage pipeline, open source

**Body:**

Hey r/AIAgents —

When AI agents invoke tools (MCP servers, APIs, microservices), there's no canonical way to verify *who issued the credential* for that tool. I built UTA to fix this.

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

**8 formats:** ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509

**12-stage pipeline:** parser → detect → schema → crypto → issuer → key_binding → pop → provenance → lifecycle → evidence → policy → decision

**Stats:**
- 6,744 verifications/sec (single core)
- 480+ tests, 23 property tests
- Public API: https://www.marketnow.site/api/trust
- 15-language snippet collection
- 7 multilingual READMEs (EN, ES, PT, FR, DE, JA, ZH, RU)

**Why this matters for agent builders:**
If you're building agents that touch production systems, you need a way to verify the credentials those agents present. UTA gives you a single API that works across 8 formats.

I opened RFC issues in 12+ agent framework repos (LangChain, LlamaIndex, AutoGen, Pydantic AI, Semantic Kernel, Google ADK, OpenAI Agents SDK, Anthropic SDK, Haystack, LiteLLM, Continue, Ant Design X) proposing optional trust verification hooks.

Repo: https://github.com/alicelabs-llc/universal-trust-adapter

Curious what r/AIAgents thinks.
