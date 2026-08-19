# Interop issue: Microsoft AutoGen — Agent Trust Cards (ATC)

> **Repo**: https://github.com/microsoft/autogen
> **Reference**: issue #7965 (currently 404 — indexed-only)
> **Tone**: neutral, collaborative, no accusations of derivation
> **Audience**: Microsoft AutoGen maintainers + community

---

## Title

Interop proposal: align AutoGen's "Agent Trust Cards" with the open ATC/1.0 specification

## Body

Hi AutoGen team,

I noticed issue #7965 ("Agent Trust Cards (ATC) — cryptographic trust for multi-agent systems") in this repo. We've been working on the same problem from a different angle, and recently published a formal spec + SDK + conformance tests that I'd love to get your feedback on.

### What we shipped

**ATC/1.0 — Agent Trust Card Protocol Specification** (published 2026-08-10)

A formal, versioned, testable spec for Agent Trust Cards — the same SSL-certificate-for-agents pattern that #7965 describes. We published it as a vendor-neutral specification so any CA (Microsoft, OpenAI, MarketNow, or a self-signed test CA) can issue ATCs and any runtime can verify them.

- **Spec**: https://github.com/alicelabs-llc/marketnow/blob/master/docs/atc-spec/SPEC.md
- **JSON Schema**: https://github.com/alicelabs-llc/marketnow/blob/master/docs/atc-spec/schemas/atc-1.0.json
- **Reference implementation** (Node.js, ~200 lines): https://github.com/alicelabs-llc/marketnow/blob/master/docs/atc-spec/reference-impl/atc-1.0.mjs
- **Test vectors**: https://github.com/alicelabs-llc/marketnow/tree/master/docs/atc-spec/test-vectors
- **Standalone SDK** (npm: `agent-trust-card`): https://www.npmjs.com/package/agent-trust-card
- **Conformance suite** (8 tests, 23 assertions, all passing): https://github.com/alicelabs-llc/marketnow/blob/master/atc-sdk/CONFORMANCE.md
- **Browser playground** (zero-install, uses WebCrypto): https://github.com/alicelabs-llc/marketnow/blob/master/atc-sdk/playground.html

### The 8 required controls (ATC/1.0)

| # | ID | What it covers |
|---|----|----------------|
| 1 | ATC-001 | Identity (`agent_id`, `agent_name`, `agent_owner`) |
| 2 | ATC-002 | Attestation (Ed25519 + CA binding) |
| 3 | ATC-003 | Capabilities (5 categories: filesystem, network, shell, credentials, process) |
| 4 | ATC-004 | Evidence (audit pipeline output, findings) |
| 5 | ATC-005 | Risk (trust_score 0-10, risk_level, decision_authority) |
| 6 | ATC-006 | Signature (Ed25519 over RFC 8785 JCS canonical JSON, SHA-256 hash) |
| 7 | ATC-007 | Revocation (ocsp / crl / simple_json) |
| 8 | ATC-008 | Expiration (issued_at, expires_at, max_ttl_days, ±5min clock skew) |

Plus 2 optional controls (ATC-009 Delegation, ATC-010 Runtime Trust) parsed but not validated by v1.0.

### Why I'm opening this issue

I'd like to discuss whether AutoGen's ATC proposal and ATC/1.0 can interop. Specifically:

1. **Field naming**: ATC/1.0 uses `agent_id` / `trust_score` / `risk_level` / `signed_payload_hash`. Does AutoGen's proposal use the same field names, or do we need a mapping layer?
2. **Capability enum**: ATC/1.0 declares 5 categories × 2-3 sub-fields each, with strict enums. Is this enough coverage for AutoGen's use cases, or are there capability types (e.g. tool-level permissions) that the spec should add?
3. **Signature algorithm**: ATC/1.0 mandates Ed25519 (RFC 8032) + RFC 8785 JCS. Does AutoGen's proposal use the same algorithm + canonicalization, or a different one?
4. **CA model**: ATC/1.0 supports any CA (MarketNow Sentinel CA, a self-signed test CA, a third-party commercial CA). Does AutoGen assume a specific CA, or is it CA-agnostic?

### What I'm NOT asking for

- I'm not asking you to adopt ATC/1.0 wholesale. If AutoGen already has a different design that works, that's fine — we can still interop at the field-mapping layer.
- I'm not claiming priority on the ATC concept. Multiple groups have converged on this problem from different directions; that's market validation, not a contest.
- I'm not asking you to credit or attribute anything. The spec is published openly; anyone can implement it.

### What I AM asking for

A pointer to the current state of #7965 (the issue is 404 from outside) so we can compare field-by-field and decide whether to:
- (a) Align AutoGen's ATC with ATC/1.0 (rename fields, swap algorithm)
- (b) Keep both as separate designs and write a translation layer
- (c) Merge ATC/1.0 into AutoGen's design if yours is more complete

Happy to do a video call, async GitHub discussion, or just trade markdown docs — whatever works for you.

### How to verify our implementation in 5 minutes

```bash
# Issue an ATC in 4 lines of code
npm install agent-trust-card
node -e "
import { generateKeyPair, issueATC, verifyATC } from 'agent-trust-card';
const ca = generateKeyPair(); const agent = generateKeyPair();
const atc = issueATC(ca, agent, { /* payload */ });
console.log(verifyATC(atc).valid); // → true
"
```

Or try the zero-install playground: https://marketnow.site/atc/playground (opens in any browser, uses WebCrypto, no backend).

Looking forward to your thoughts.

Best,
Edgar Flores
AliceLabs LLC
support@alicelabs.site
