---
title: "ATC/1.0 update — 57 cards live, 1 critical bug found, fix timeline"
published: true
description: "Public status update: 57 ATCs in the live ledger, 1 critical cross-implementation bug found by external researcher @anp2network, fix timeline (3 parts over 5 days). Audit transparency report."
tags: atc, mcp, security, ai
date: 2026-08-12T21:00:00Z
---

This is a public status update on ATC/1.0 (Agent Trust Card) for anyone tracking the spec. Three things to share.

---

## 1. Current state — what's live

### Spec & SDK

| Artifact | Version | Status |
|---|---|---|
| ATC/1.0 specification | 1.0.0 (draft) | Published at [marketnow.site/atc](https://marketnow.site/atc/spec/SPEC.md) |
| JSON Schema | draft 2020-12 | Published at [marketnow.site/atc/spec/atc-1.0.json](https://marketnow.site/atc/spec/atc-1.0.json) |
| Node.js SDK | `agent-trust-card@1.1.1` | Live on [npm](https://www.npmjs.com/package/agent-trust-card) |
| Python SDK | `agent-trust-card@1.0.1` | Built, pending PyPI upload |
| Rust crate | `agent-trust-card@1.0.0` | Source only, pending crates.io upload |
| MCP server | `marketnow-mcp@1.10.0` (13 tools) | Live on [npm](https://www.npmjs.com/package/marketnow-mcp) |
| Browser playground | live | [marketnow.site/atc/playground](https://marketnow.site/atc/playground) — uses WebCrypto |

### Live MarketNow CA

- **Cards issued**: 57 (3 revoked, 54 active)
- **Security checks performed**: 1,211,488
- **Skills analyzed**: 9,248
- **Skills quarantined**: 80 (critical — blocked from listing)
- **Skills verified safe**: 8,288 (score ≥ 8)
- **CA algorithm**: Ed25519 (RFC 8032)
- **CA public key**: live at [/api/atc?action=ca-key](https://marketnow.site/api/atc?action=ca-key)

### Live endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/atc?action=spec` | Protocol spec |
| `GET /api/atc?action=ca-key` | CA public key |
| `GET /api/atc?action=verify&card_id=X` | Verify a card |
| `GET /api/atc?action=revocation-list` | Live CRL (57 cards, 3 revoked) |
| `POST /api/interceptor` | Runtime MCP tool call guardrail (5 rules) |
| `GET /api/audit-report.json` | Transparency report |
| `GET /api/owasp` | OWASP MCP Cheat Sheet compliance matrix |

---

## 2. Critical bug found by external researcher — acknowledged publicly

[@anp2network](https://dev.to/anp2network) wrote an independent Python ATC/1.0 verifier from scratch and reported that **none of the 57 cards in the live ledger verify under RFC 8785 JCS**. They tested 4 cards + 150 sweep variants. Zero signatures reproduced.

### What actually happened

The 57 cards were issued **July 28–30, 2026** — **before** the ATC/1.0 spec was published (Aug 10). They were signed with `JSON.stringify(payload, Object.keys(payload).sort())` (V8's stable sort, NOT RFC 8785 JCS).

When I published the ATC/1.0 spec on Aug 10 mandating RFC 8785 JCS, the old cards became inconsistent with the new spec. **This is on me** — I should have either re-issued them on Aug 10 or explicitly documented that pre-Aug-10 cards use the old method.

@anp2network did the work of checking. They found the inconsistency. I'm acknowledging it publicly in [this reply article](https://dev.to/edison_flores_6d2cd381b13/re-atc-verification-failure-report-youre-right-heres-the-fix-170n).

### The fix — 3 parts, 5 days

1. **Part 1** (Aug 13–14): New endpoint `/api/atc?action=envelope&card_id=X` returns the exact bytes the issuer signed. The envelope includes a new field `attestation.canonicalization_method` documenting whether the card uses `JSON.stringify_v8_sort` (old) or `RFC_8785_JCS` (new).

2. **Part 2** (Aug 13–14): The MarketNow `/api/atc?action=verify` endpoint will be rewritten to consume the same HTTP response bytes an external verifier would download — closing the "issuer verifies a different object than what's served" gap.

3. **Part 3** (Aug 15–17): Re-issue all 57 cards under RFC 8785 JCS. Old signatures preserved in `attestation.legacy` for audit trail.

### What I'm asking from @anp2network

They wrote:
> We can publish the verifier and the exact canonical byte string we sign over for ATC-2026-1509360; one diff against your signer input settles it either way.

**Please do.** Once Part 1 ships, they can fetch the envelope, run their canonicalization over the same bytes the issuer used, and confirm signature verification end-to-end. If it still fails after Part 3, the bug is in our signer — and their published verifier + canonical bytes will let us diff to find it.

---

## 3. What I'm asking from anyone reading this

Three concrete things:

### A. Run the conformance suite against your ATC implementation

If you've implemented ATC/1.0 in any language (Python, Rust, Go, Java, etc.), the conformance test suite is at [marketnow.site/atc/conformance](https://marketnow.site/atc/conformance). It has 8 test cases / 23 assertions, all passing on Node.js + Python.

Run it against your implementation. If your signatures don't byte-match the reference impl, **tell me** — that's exactly the kind of bug @anp2network just found.

### B. Implement ATC/1.0 verification in your agent runtime

If you build:
- An MCP client (Claude Desktop, Cursor, Cline, Continue, etc.)
- An A2A client
- A LangChain / LlamaIndex tool
- An agent framework

Add ATC/1.0 verification. It's ~5 lines:

```javascript
import { verifyATC } from 'agent-trust-card';
const result = await verifyATC(atc, { fetch_revocation: true });
if (!result.valid) throw new Error(`Untrusted agent: ${result.errors.join(', ')}`);
```

The verifier is self-contained, uses `node:crypto` + RFC 8785 JCS, ~5ms per call. No external API dependencies except the optional revocation list fetch.

### C. Find bugs in ATC/1.0 — publicly

The spec is open. The SDK is open. The conformance tests are open. **Find bugs and publish them.**

@anp2network just did this. They found a real bug. The right response is "thank you, here's the fix" — not defensiveness. If you find another bug, publish it the same way: write a dev.to article, post in r/mcp, tweet at me. I'll acknowledge publicly and ship the fix.

This is the only way ATC/1.0 becomes a real standard instead of a vendor spec.

---

## Timeline for the next 7 days

- **Aug 12** (today): This status update + 3 reply articles published
- **Aug 13–14**: Ship Part 1 (envelope endpoint) + Part 2 (issuer verifier isolation)
- **Aug 15–17**: Ship Part 3 (re-issue all 57 cards under RFC 8785 JCS)
- **Aug 18**: Public confirmation post — "all 57 cards now verify under independent implementations"
- **Aug 19+**: Continue accepting bug reports + shipping fixes

If you want to be notified when Part 1 ships, follow me on dev.to ([@edison_flores_6d2cd381b13](https://dev.to/edison_flores_6d2cd381b13)) or watch the [ATC spec repo mirror](https://marketnow.site/atc).

---

*Edgar Flores, AliceLabs LLC (Wyoming, USA). ATC/1.0 spec: [marketnow.site/atc](https://marketnow.site/atc). SDK: [npm agent-trust-card](https://www.npmjs.com/package/agent-trust-card). Live CRL: [marketnow.site/api/atc?action=revocation-list](https://marketnow.site/api/atc?action=revocation-list). Contact: support@alicelabs.site.*
