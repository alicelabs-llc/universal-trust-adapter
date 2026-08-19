# ATC/1.0 Verification Log

> **Purpose**: Internal record-keeping for AliceLabs LLC. Tracks aggregate counts of ATC/1.0 verifications performed via `marketnow-mcp@1.10.0`'s `marketnow_verify_atc_spec` tool. **No personally identifying information is collected** — only aggregate counts by date, issuer, and result.
>
> **License**: MNNC-1.0 (AliceLabs LLC Proprietary). Internal use only.
>
> **Public-facing summary**: This log is mirrored as a JSON aggregate at `/api/atc-verification-stats` (planned for v1.11.0).

---

## Methodology

This log is **NOT** populated automatically by the MCP server (the server is stateless — it does not log tool calls). Instead, it is updated manually by AliceLabs LLC when we observe verifications through:

1. **Public GitHub issues / PRs** where someone mentions running `marketnow_verify_atc_spec`
2. **Direct outreach** (emails, dev.to comments, Twitter) from developers testing the verifier
3. **MarketNow-hosted ATC verifications** via `marketnow_verify_trust` (separate tool, MarketNow CA only)
4. **Conformance test runs** in our own CI

We do **not** track:
- The ATC payloads themselves (those are the issuer's data)
- The CA public keys used
- The agent identities (`agent_id`, `agent_name`)
- IP addresses, user agents, or any client-side identifiers

---

## Aggregate stats

| Date       | Total verifications | Passed | Failed | Unique issuers observed | Notes |
|------------|---------------------|--------|--------|-------------------------|-------|
| 2026-08-10 | 5                   | 1      | 4      | 1 (alicelabs-sentinel-ca) | Initial smoke test: minimal-valid + tampered + expired + wrong-CA + missing-arg. Reference impl passes all conformance tests. |
| 2026-08-11 | 0                   | 0      | 0      | 0                       | (awaiting first external verifier) |

---

## Issuers observed

A list of CA `ca_id` values that have appeared in ATCs verified by `marketnow_verify_atc_spec`. This list helps us understand ATC adoption across the ecosystem.

| ca_id                       | First observed | Last observed | Total ATCs verified | Source |
|-----------------------------|-----------------|---------------|---------------------|--------|
| alicelabs-sentinel-ca       | 2026-08-10      | 2026-08-10    | 5                   | internal smoke test |

If you implemented ATC/1.0 with a different CA and want to be listed here, open a PR with:
- `ca_id` (the value you put in `issuer.ca_id`)
- `ca_url` (the value you put in `issuer.ca_url`)
- Date of first ATC issuance
- Optional: link to your CA's public key endpoint

---

## Public artifacts we've seen

This section records verifiable public artifacts where ATC/1.0 has been mentioned, implemented, or referenced. Updated as we discover them. **No accusations of derivation** — just a public record.

| Date       | Artifact                                                         | Author                    | Notes |
|------------|------------------------------------------------------------------|---------------------------|-------|
| 2026-07-13 | dev.to: "AI agents need SSL certificates too — so I built ATC"  | Edison Flores             | First public use of "ATC" name with full architecture |
| 2026-07-16 | Microsoft AutoGen issue #7965 (page 404)                         | (not verified)            | Indexed-only — title matches ATC concept |
| 2026-07-17 | dev.to: "ATC is now real"                                       | Edison Flores             | Working Ed25519 implementation |
| 2026-07-18 | OpenAI Cookbook #2865                                            | Edison Flores             | ATC proposal |
| 2026-07-18 | OpenAI Cookbook #2867                                            | jj5419952-stack           | Same title, same day |
| 2026-07-18 | Cline #12376                                                     | Edison Flores             | Brought ATC to Cline |
| 2026-07-19 | dev.to: "Responding to feedback: runtime trust, CA rotation"   | Edison Flores             | RFC 8785 JCS migration |
| 2026-07-22 | OpenA2A AIP Internet-Draft                                       | FANE                      | Different name (AIP), different architecture (DID), same problem space |
| 2026-07-23 | OpenAI Cookbook #2875                                            | Edison Flores             | MarketNow + ATC + Sentinel overview |
| 2026-07-29 | OATI (Open Agent Trust Infrastructure) GitHub topic             | Community                 | Broader scope: identity + authority + policy + receipts |
| 2026-08-10 | ATC/1.0 Specification published                                  | AliceLabs LLC             | First formal, versioned, testable ATC spec — 10 controls, JSON Schema, reference impl, test vectors |
| 2026-08-10 | dev.to: "ATC/1.0 — shipping a formal spec for Agent Trust Cards" | AliceLabs LLC             | Spec announcement article |
| 2026-08-10 | marketnow-mcp@1.10.0 published                                   | AliceLabs LLC             | Live reference implementation: `marketnow_verify_atc_spec` tool |

For the full prior-art chronology, see [`docs/atc-spec/PRIOR-ART-TIMELINE.md`](../docs/atc-spec/PRIOR-ART-TIMELINE.md).

---

## Update protocol

This log is updated by AliceLabs LLC on the following schedule:

- **Daily** during the first 30 days post-launch (August 10 → September 10, 2026)
- **Weekly** thereafter (every Monday)
- **Immediately** when a new issuer is observed

If you have public evidence of an ATC/1.0 implementation we missed, open a PR or email support@alicelabs.site.

---

## Why this log exists

Two reasons:

1. **Future standards-body submission**: When we submit ATC/1.0 to a W3C Community Group (planned Q1 2027) or as an IETF Individual Draft (Q2 2027), the question "how many implementations exist?" matters. This log is the evidence.

2. **Future funding conversations**: Investors will ask "who's using this?". This log is the answer.

The log does not exist to make accusations of copying or to assert priority claims. The PRIOR-ART-TIMELINE.md is the chronology document — this log is the adoption tracker.
