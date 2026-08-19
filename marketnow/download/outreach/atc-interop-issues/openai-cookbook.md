# Interop issue: OpenAI Cookbook — Agent Trust Cards (ATC)

> **Repo**: https://github.com/openai/openai-cookbook
> **Reference**: issue #2865 (Edison's proposal) + #2867 (jj5419952-stack's proposal, same title, same day)
> **Tone**: neutral, collaborative, framing as "let's converge on a shared spec"

---

## Title

ATC/1.0 — formal spec for Agent Trust Cards now published (interop with proposals #2865 / #2867)

## Body

Hi OpenAI Cookbook maintainers,

Issues #2865 and #2867 both proposed "Agent Trust Cards (ATC) — SSL certificates for AI agents" on 2026-07-18. Since then, we've published a formal specification for ATC with conformance tests and a reference implementation. I'm opening this issue to invite the OpenAI Cookbook community to review the spec and consider whether it covers the use cases described in #2865 and #2867.

### What we published

**ATC/1.0 — Agent Trust Card Protocol Specification** (2026-08-10)

- **Spec**: https://github.com/alicelabs-llc/marketnow/blob/master/docs/atc-spec/SPEC.md
- **JSON Schema**: https://github.com/alicelabs-llc/marketnow/blob/master/docs/atc-spec/schemas/atc-1.0.json
- **Reference implementation** (Node.js): https://github.com/alicelabs-llc/marketnow/blob/master/docs/atc-spec/reference-impl/atc-1.0.mjs
- **Test vectors** (5 vectors, CC0): https://github.com/alicelabs-llc/marketnow/tree/master/docs/atc-spec/test-vectors
- **Standalone SDK** (npm: `agent-trust-card`): https://www.npmjs.com/package/agent-trust-card
- **Conformance suite** (8 tests, 23 assertions): https://github.com/alicelabs-llc/marketnow/blob/master/atc-sdk/CONFORMANCE.md
- **Browser playground** (zero-install, uses WebCrypto): https://marketnow.site/atc/playground

### The 8 required controls

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

Plus 2 optional controls (ATC-009 Delegation, ATC-010 Runtime Trust).

### Why I'm opening this issue

Issue #2865 (mine) and #2867 (jj5419952-stack's) both proposed ATC on the same day. The market has converged on this problem — Microsoft AutoGen has a similar proposal, OpenA2A published an AIP Internet-Draft, OATI covers the broader scope. Rather than fragment, I'd love to consolidate around a shared spec.

Specifically:

1. **Coverage check**: Does ATC/1.0's 10-control structure cover what #2865 and #2867 proposed? If not, what's missing?
2. **Field naming**: Are `agent_id` / `trust_score` / `risk_level` / `signed_payload_hash` acceptable, or do we need different names?
3. **Capability enum**: ATC/1.0 has 5 categories × 2-3 sub-fields. Are there capability types (e.g. tool-level permissions, model-level restrictions) the spec should add?
4. **Algorithm**: Ed25519 (RFC 8032) + RFC 8785 JCS. Is this acceptable, or does the OpenAI community need ML-DSA (post-quantum) for v1.0?

### What I'm NOT asking for

- Not asking OpenAI to endorse or adopt ATC/1.0.
- Not claiming priority — multiple parties converged on this concept.
- Not asking for attribution.

### What I AM asking for

A pointer to the canonical state of #2865 and #2867 so we can do a field-by-field comparison and decide whether to:
- (a) Adopt ATC/1.0 as-is
- (b) Fork it with field renames
- (c) Submit a v1.1 patch covering whatever's missing

### Try it in 5 minutes

```bash
npm install agent-trust-card
```

```javascript
import { generateKeyPair, issueATC, verifyATC } from 'agent-trust-card';
const ca = generateKeyPair();
const agent = generateKeyPair();
const atc = issueATC(ca, agent, {
  card_id: 'ATC-2026-0000001',
  identity: { agent_id: 'my-bot', agent_name: 'My Bot', agent_owner: 'My Org' },
  capabilities: { /* ... */ },
  evidence: { /* ... */ },
  risk: { trust_score: 9, risk_level: 'low', score_explanation: 'clean', scored_at: new Date().toISOString() },
});
console.log(verifyATC(atc).valid); // → true
```

Or try the zero-install playground: https://marketnow.site/atc/playground

Looking forward to your feedback.

Best,
Edgar Flores
AliceLabs LLC
support@alicelabs.site
