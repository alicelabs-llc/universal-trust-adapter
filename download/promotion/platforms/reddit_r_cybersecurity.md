<!-- Target: r/cybersecurity -->
<!-- Post type: text post -->

**Title:** Open-sourced a 12-stage credential verification pipeline for AI agents — feedback wanted from security folks

**Body:**

Hey r/cybersecurity —

I open-sourced a credential verification layer for AI agents: **Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

The problem: when an AI agent invokes a tool (MCP server, API), there's no canonical way to verify the credential for that tool. Each standard (OAuth, X.509, W3C VC, MCP Cards) handles verification differently, and agents don't know which standard to use.

UTA's 12-stage pipeline:
```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

**8 formats:** ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509

**What I'd love feedback on from security folks:**
1. Is the 12-stage decomposition sound, or am I missing stages?
2. The `POP` (proof-of-possession) stage — is it adequately specified?
3. The `EVIDENCE` stage — what should it log for auditability?
4. The `POLICY` stage — should UTA ship default policies, or stay policy-neutral?

**Threat model:** https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/THREAT_MODEL.md
**Conformance suite:** 23/23 tests pass. Test vectors public.

Repo: https://github.com/alicelabs-llc/universal-trust-adapter
