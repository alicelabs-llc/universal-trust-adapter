# Crosswalk: ERC-8004 (Trustless Agents) ↔ ATC/1.0 (Agent Trust Card)

- **Version:** 1.0 · **Status:** DRAFT · **Author:** @eddyflores100-lang (AliceLabs LLC)
- **Verified at:** 2026-10-17 · **Re-verify by:** 2027-01-15 (90-day cadence)
- **Upstream pins:** EIP-8004 (draft, `erc-8004/erc-8004-contracts@main` 2026-10) · ATC/1.0 (`alicelabs-llc/MARKETNOW/docs/atc-spec/SPEC.md`, RFC-ATC-v3-Draft-00)

**Non-endorsement.** The ERC-8004 authors and the erc-8004/erc-8004-contracts
curators have not reviewed or endorsed this crosswalk. This document maps two
independently developed specifications; every mapping below is a contributor
finding, open to dispute by either side.

---

## 1. Purpose and layering

ERC-8004 and ATC/1.0 answer two different questions about the same subject:

| | ERC-8004 | ATC/1.0 (verified via UTA) |
|---|---|---|
| Question | *Who is this agent?* (on-chain identity) | *Is this agent trustworthy right now?* (off-chain verification) |
| Where | Ethereum-family chains (registry contracts) | HTTP endpoint + signed credentials, chain-agnostic |
| Trust source | Registration ownership + on-chain feedback records | Issuer chain, Ed25519/JCS signatures, validity windows, revocation, live scoring |
| Freshness | As current as the last on-chain write | Per-verification (one-time challenge, two-sided validity window) |
| Cost model | Gas per transaction | x402 micropayment per verify (0.01 USDC) — fail-closed 402 |

They compose rather than compete: **8004 establishes *who*; ATC/1.0 verifies
*whether that who deserves a given spend*.** An on-chain registration proves an
owner wrote something to a registry; it does not prove the agent behind it is
currently live, unrevoked, or behaving. Conversely, an ATC verdict does not
carry a canonical on-chain identity — it verifies whatever subject the card
binds. The crosswalk connects the two.

## 2. Primitive mapping

| ERC-8004 primitive | ATC/1.0 / UTA counterpart | Mapping notes |
|---|---|---|
| `IdentityRegistry.register(agentURI, metadata[])` → `agentId` | ATC card issuance + distribution endpoint | `agentURI` can resolve to (or alongside) the agent's ATC card. A `MetadataEntry` under a conventional key (e.g. `atc:card`) can carry the card URI and/or a card digest so callers detect substitution. |
| `agentId` (uint256, ERC-721 style) | ATC card subject binding | The card's subject can reference the 8004 identity (chain + registry + agentId) so a verdict is attributable to the on-chain identity, not just a URL. |
| `getMetadata(agentId, key)` / `setMetadata(...)` | ATC card fields (issuer, key id, validity window, capabilities, rotation flags) | Metadata is the natural on-chain pointer shelf; the card remains the verifiable, signed payload. Store digests on-chain, full cards off-chain. |
| `ReputationRegistry.giveFeedback(agentId, int128 value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)` | UTA risk bands `B0`–`B3`/`A1` (verdict output) | Different evidence classes: 8004 feedback is self-declared on-chain history; an ATC band is a verifier's scored judgment at verification time. A consumer MAY combine both, weighting neither as a substitute for the other. |
| `ValidationRegistry.validationRequest(validatorAddress, agentId, requestURI, requestHash)` | `POST /v1/trust/verify` (UTA, x402-paid) | UTA is exactly the "external validator" role 8004 reserves: `requestURI` = the ATC card to check, `requestHash` binds the request; the one-time challenge (`verdict_id`) plays the freshness role on the reply side. |
| Validation response | Signed verdict + receipt (`verdict_id`, `band`, `policy_sha256`, Ed25519) | The verdict is third-party re-verifiable offline (pinned anchors, Sigstore Rekor anchoring); it can be recorded on-chain or kept off-chain. |

## 3. Composition flows

### Flow A — verify before pay (agent-to-agent commerce)

```
Buyer agent (8004 agentId=101)          Seller agent (8004 agentId=202, on Base)
        │                                            │
        │ 1. POST paid resource ────────────────────►│
        │◄─────────────────────────── 402 + accepts  │
        │ 2. resolve seller agentURI → ATC card      │
        │ 3. POST /v1/trust/verify (card) ──► UTA    │
        │◄── verdict { verdict_id, band, reason } ───┤
        │ 4. band >= policy threshold?               │
        │      no  → ABORT (fail-closed, spend denied)
        │      yes → 5. sign + settle x402 payment   │
        │◄─────────────────────────── 200 + receipt ─│
```

Both registries are deployed on **Base mainnet** (`IdentityRegistry`
`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, `ReputationRegistry`
`0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`) and UTA's live verify endpoint
settles on Base mainnet USDC (`eip155:8453`) — identity, verification and
settlement land on one chain. Step 4 is the fail-closed boundary: unreachable
verifier, HTTP error, non-JSON, missing band, or unresolvable revocation all
abort the spend.

### Flow B — 8004 validationRequest against an external verifier

An 8004 agent owner (or an account with grant) calls
`validationRequest(validatorAddress, agentId, requestURI, requestHash)` with
`requestURI` pointing at the agent's ATC card. The validator side runs the ATC
staged checks (issuer chain → signature over JCS canonical form → validity
window → active status → revocation) and returns a signed verdict the requester
can attach to the validation flow. The validator is paid per call via x402; no
API key, no account.

## 4. What this crosswalk does not claim

- **No endorsement either direction.** Neither the ERC-8004 authors nor the
  ATC/1.0 spec has adopted the other side; cells above are contributor findings.
- **Not a dependency.** ATC/1.0 verification works for agents with no 8004
  identity; 8004 agents operate fine without ATC verification. The crosswalk is
  optional composition.
- **Reputation ≠ verification.** An 8004 feedback record is not an ATC verdict,
  and an ATC band does not replace an on-chain feedback history. Consumers
  combining them own the weighting decision.

## 5. Re-verification policy

The upstream pins were re-read on **2026-10-17** (EIP-8004 interface text and
contract addresses from `erc-8004/erc-8004-contracts` README; ATC/1.0 from the
published spec). Re-verify by **2027-01-15**: re-read both upstreams, confirm
the addresses still resolve, confirm interface names, and refresh this table.
If a cell is stale past `reverify_by`, treat the row as unverified (same
fail-closed posture the verification layer itself uses).

## 6. References

- EIP-8004: Trustless Agents — https://eips.ethereum.org/EIPS/eip-8004
- Contracts: https://github.com/erc-8004/erc-8004-contracts
- ATC/1.0 spec: https://github.com/alicelabs-llc/MARKETNOW/blob/master/docs/atc-spec/SPEC.md
- ATC v3.0 RFC draft: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/spec/RFC-ATC-v3-Draft-00.md
- UTA repo (verifier + conformance corpus): https://github.com/alicelabs-llc/universal-trust-adapter
- Fail-closed spend-authority bridge (Pay MCP RFC): https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/pay-mcp-bridge
- Related crosswalk: Agent Governance Vocabulary ↔ ATC/1.0 (aeoess/agent-governance-vocabulary PR #203)
