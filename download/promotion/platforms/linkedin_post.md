<!-- Platform: LinkedIn -->
<!-- Post type: long-form article -->
<!-- Audience: professional, technical founders/CTOs -->
<!-- Tone: professional but personal -->

# I open-sourced a credential verification layer for AI agents. Here's what I learned.

Over the past 3 months, I've been building **Universal Trust Adapter (UTA)** — a verification layer that solves a problem I kept hitting in production AI agent deployments.

## The problem

When an AI agent invokes a tool (an MCP server, an internal API, a microservice), there's no canonical way to verify:
- Who issued the credential for that tool
- Whether it's still valid
- What scope it actually has

Each standard (OAuth/JWT, X.509, W3C Verifiable Credentials, MCP Server Cards) handles verification differently. Agents don't know which standard to use.

## What I built

UTA verifies credentials in **8 formats**:
- ATC v3 (Agent Trust Card)
- JWT (with x5c chain)
- W3C Verifiable Credentials
- A2A (Agent-to-Agent) cards
- EAT-AI (Entity Attestation Tokens)
- ZTA (Zero Trust Agent) cards
- MCP Server Cards
- X.509 certificates

Through a **12-stage pipeline**: parser → detect → schema → crypto → issuer → key_binding → pop → provenance → lifecycle → evidence → policy → decision

## The numbers

- 6,744 verifications per second (single core)
- 480+ tests
- 23 property tests
- 15-language code snippet collection
- 7 multilingual READMEs (English, Spanish, Portuguese, French, German, Japanese, Chinese, Russian)

## What I learned building this solo

1. **Multi-format support is harder than it looks.** Each credential format has quirks. JWT's x5c chain is different from X.509's PEM chain is different from W3C VC's proof.verificationMethod.

2. **Conformance testing is harder than building the verifier.** Building 23 property tests that catch real bugs took longer than building the verifier itself.

3. **Documentation in 7 languages is humbling.** I'm a native Spanish speaker. Translating technical docs to Japanese, Chinese, and Russian required help from native speakers. If you're building for a global audience, budget for translation from day one.

## Why I'm sharing this

If you're building AI agents that touch production systems, you'll hit this problem. UTA is open-source (Apache 2.0) with a public API. Use it, fork it, contribute to it.

Repo: https://github.com/alicelabs-llc/universal-trust-adapter
API: https://www.marketnow.site/api/trust

I'd genuinely value feedback from this community — especially from founders and CTOs who have AI agents in production.

#AI #AIAgents #Security #OpenSource #Trust #MCP #LLM #Agents
