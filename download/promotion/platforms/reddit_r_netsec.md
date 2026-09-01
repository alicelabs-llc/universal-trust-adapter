<!-- Target: r/netsec -->
<!-- Post type: text post -->

**Title:** Universal Trust Adapter — 12-stage credential verification pipeline for AI agents (open source)

**Body:**

Cross-posting from r/cybersecurity — looking for feedback from this community specifically on the cryptographic design.

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

**12-stage pipeline:**
```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

**8 credential formats supported:**
- ATC v3 (Agent Trust Card)
- JWT (with `x5c` chain)
- W3C Verifiable Credentials
- A2A (Agent-to-Agent) cards
- EAT-AI (Entity Attestation Tokens)
- ZTA (Zero Trust Agent) cards
- MCP Server Cards
- X.509 certificates

**Key design questions I'd love input on:**
1. The KEY_BINDING stage checks that the signing key is bound to the declared issuer. Should this be done via DID resolution, X.509 chain validation, or both?
2. The POP stage requires the presenter to prove possession of the private key. Currently using challenge-response. Any pitfalls?
3. The LIFECYCLE stage checks revocation via CRL, OCSP, and Bitstring Status List. Any other revocation mechanisms worth supporting?

**Public test vectors:** https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/tests/conformance
**Test CA private key published** for reproducibility (test-only, not for production).

**Conformance suite: 23/23 tests pass.**

Repo: https://github.com/alicelabs-llc/universal-trust-adapter
