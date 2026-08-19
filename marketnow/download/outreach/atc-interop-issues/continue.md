# Interop issue: Continue — Agent Trust Cards (ATC)

> **Repo**: https://github.com/continuedev/continue
> **Reference**: issue #12996 (indexed-only — "Proposal: Agent Trust Cards (ATC) — SSL certificates for AI agents")
> **Tone**: neutral, collaborative, no accusations of derivation

---

## Title

ATC/1.0 formal spec published — interop with the ATC proposal in #12996

## Body

Hi Continue team,

Issue #12996 proposes "Agent Trust Cards (ATC) — SSL certificates for AI agents" — the same problem we've been working on. We've now published a formal specification for ATC with conformance tests, JSON Schema, reference implementation, and a standalone SDK. I'm opening this issue to discuss interop.

### What we shipped

**ATC/1.0 — Agent Trust Card Protocol Specification** (2026-08-10)

- **Spec**: https://github.com/edgarfloresguerra2011-a11y/marketnow/blob/master/docs/atc-spec/SPEC.md
- **JSON Schema**: https://github.com/edgarfloresguerra2011-a11y/marketnow/blob/master/docs/atc-spec/schemas/atc-1.0.json
- **Reference implementation** (Node.js, ~200 lines): https://github.com/edgarfloresguerra2011-a11y/marketnow/blob/master/docs/atc-spec/reference-impl/atc-1.0.mjs
- **Standalone SDK** (npm: `agent-trust-card`): https://www.npmjs.com/package/agent-trust-card
- **Conformance suite** (8 tests, 23 assertions, all passing): https://github.com/edgarfloresguerra2011-a11y/marketnow/blob/master/atc-sdk/CONFORMANCE.md
- **Browser playground** (zero-install, uses WebCrypto): https://marketnow.site/atc/playground
- **Prior art timeline** (honest chronology of ATC and adjacent work): https://github.com/edgarfloresguerra2011-a11y/marketnow/blob/master/docs/atc-spec/PRIOR-ART-TIMELINE.md

### The 8 required controls

ATC/1.0 covers:
1. ATC-001 Identity (agent_id, agent_name, agent_owner)
2. ATC-002 Attestation (Ed25519 + CA binding)
3. ATC-003 Capabilities (filesystem, network, shell, credentials, process — 5 categories × 2-3 sub-fields each with strict enums)
4. ATC-004 Evidence (audit pipeline output, findings array with severity)
5. ATC-005 Risk (trust_score 0-10, risk_level, decision_authority=consumer)
6. ATC-006 Signature (Ed25519 over RFC 8785 JCS canonical JSON, SHA-256 hash match)
7. ATC-007 Revocation (ocsp / crl / simple_json)
8. ATC-008 Expiration (issued_at, expires_at, max_ttl_days, ±5min clock skew tolerance)

Plus 2 optional controls: ATC-009 Delegation, ATC-010 Runtime Trust.

### Why I'm opening this issue

Continue is in a unique position — you have both an IDE extension and agent runtime, so ATC verification could happen either at the IDE layer (before Continue lets an agent execute a tool) or at the agent layer (before the agent calls another agent). Either way, we'd love Continue's feedback on:

1. **Capability enum coverage**: ATC/1.0's 5 categories (filesystem, network, shell, credentials, process). Does this cover Continue's tool-use cases, or do you need additional capability categories (e.g. `clipboard`, `editor.write`, `terminal.exec`)?
2. **Verification point**: Where does Continue want to verify ATCs? Pre-tool-call? Post-tool-call? At agent-load time?
3. **CA trust**: Continue already has a config-driven MCP server trust model. Does ATC/1.0's "any CA, decision_authority=consumer" model fit, or do you need a Continue-specific CA?
4. **Field naming**: Does `agent_id` / `trust_score` / `risk_level` work for Continue's data model?

### What I'm NOT asking for

- Not asking Continue to endorse or adopt ATC/1.0.
- Not claiming priority — multiple parties converged on the ATC concept in July 2026.
- Not asking for attribution.

### What I AM asking for

A pointer to the current state of #12996 (it's currently 404 from outside) so we can do a field-by-field comparison and figure out the interop path.

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
  identity: { agent_id: 'continue-agent', agent_name: 'Continue Agent', agent_owner: 'My Org' },
  capabilities: { /* ... */ },
  evidence: { /* ... */ },
  risk: { trust_score: 9, risk_level: 'low', score_explanation: 'clean', scored_at: new Date().toISOString() },
});
console.log(verifyATC(atc).valid); // → true
```

Or try the zero-install playground: https://marketnow.site/atc/playground

Happy to do a video call, async discussion, or just trade markdown docs.

Best,
Edgar Flores
AliceLabs LLC
support@alicelabs.site
