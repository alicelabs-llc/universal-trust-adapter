# Interop issue: Cline — Agent Trust Cards (ATC)

> **Repo**: https://github.com/cline/cline
> **Reference**: issue #12376 (originally opened by `edgarfloresguerra2011-a11y` — Edison's own proposal, 2026-07-18)
> **Tone**: neutral, follow-up to the original proposal — now we have a spec + SDK + conformance tests

---

## Title

Update on #12376: ATC/1.0 spec + SDK + conformance tests now published

## Body

Hi Cline team,

Following up on issue #12376 (which I opened on 2026-07-18 proposing "Agent Trust Cards (ATC) — SSL certificates for AI agents"). Since then, I've published the formal specification, a standalone SDK, and a conformance test suite. Opening this follow-up to share what's now available and invite Cline's feedback.

### What changed since #12376

The original proposal described the architecture conceptually. Since then, we've shipped:

- **ATC/1.0 Specification** — formal spec with 10 controls (8 required, 2 optional):
  https://github.com/alicelabs-llc/marketnow/blob/master/docs/atc-spec/SPEC.md
- **JSON Schema** (draft 2020-12):
  https://github.com/alicelabs-llc/marketnow/blob/master/docs/atc-spec/schemas/atc-1.0.json
- **Reference implementation** (Node.js, ~200 lines, uses `node:crypto` + `canonicalize` for RFC 8785 JCS):
  https://github.com/alicelabs-llc/marketnow/blob/master/docs/atc-spec/reference-impl/atc-1.0.mjs
- **5 test vectors** (CC0, public domain):
  https://github.com/alicelabs-llc/marketnow/tree/master/docs/atc-spec/test-vectors
- **Standalone SDK** (npm: `agent-trust-card`):
  https://www.npmjs.com/package/agent-trust-card
- **CLI** (`atc init` / `atc issue` / `atc verify` / `atc inspect`):
  ```bash
  npx agent-trust-card verify card.json  # exits 0 if valid, 1 if invalid
  ```
- **Conformance suite** (8 tests, 23 assertions, all passing):
  https://github.com/alicelabs-llc/marketnow/blob/master/atc-sdk/CONFORMANCE.md
- **Browser playground** (zero-install, uses WebCrypto, no backend):
  https://marketnow.site/atc/playground
- **MCP server tool** (`marketnow_verify_atc_spec` in `marketnow-mcp@1.10.0`):
  Any agent that loads `npx marketnow-mcp` can now verify ANY ATC against the spec.
  https://www.npmjs.com/package/marketnow-mcp
- **Prior art timeline** (honest chronology of ATC and adjacent work):
  https://github.com/alicelabs-llc/marketnow/blob/master/docs/atc-spec/PRIOR-ART-TIMELINE.md

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

### Why this follow-up

In #12376, I described the concept. Now I'd like to invite Cline to:

1. **Review the spec** — does ATC/1.0 cover what Cline needs from an agent trust credential?
2. **Try the SDK** — `npm install agent-trust-card` — verify that the verifier produces deterministic results that match the reference implementation.
3. **Run the conformance tests** — `npm test` in the `atc-sdk/` directory — verify that the 23 assertions all pass.
4. **Identify gaps** — what's missing from ATC/1.0 that Cline would need before adopting it?

### Cline-specific considerations

Cline is a VS Code extension that runs AI agents in a developer's editor. For ATC adoption, this means:

- **Where to verify**: Cline could verify an ATC before letting an agent execute a tool. The `verifyATC()` function is synchronous and takes ~5ms — fast enough to call inline.
- **CA trust**: Cline already has a config-driven MCP server trust model. ATC/1.0's "any CA, decision_authority=consumer" model means Cline can keep its own trust policy and just use ATC as the credential format.
- **Capability enforcement**: ATC/1.0 declares capabilities but doesn't enforce them — that's the runtime's job. Cline could enforce ATC-003 capabilities at the tool-call layer (e.g. block an agent with `shell.exec: 'none'` from running shell commands).

### What I'm NOT asking for

- Not asking Cline to adopt ATC/1.0 wholesale.
- Not asking for any specific timeline.
- Not asking for attribution.

### What I AM asking for

Feedback on whether ATC/1.0 fits Cline's use case. If yes, I'm happy to help with the integration. If no, I'd love to know what's missing so I can add it to v1.1 (planned: Q4 2026, adds ML-DSA post-quantum signatures + CA key rotation + delegation chains).

### Try it in 5 minutes

```bash
# Quick smoke test — issue + verify
npx agent-trust-card init > keys.json
# ... (split keys.json into ca.json + agent.json)
npx agent-trust-card issue --ca ca.json --agent agent.json --payload payload.json --out card.json
npx agent-trust-card verify card.json
# Expected: ✓ ATC VALID (8/8 controls passed)
```

Or try the zero-install playground: https://marketnow.site/atc/playground

Looking forward to your thoughts.

Best,
Edgar Flores
AliceLabs LLC
support@alicelabs.site
