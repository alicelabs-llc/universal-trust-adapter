# MarketNow ↔ Vibe Mutual Hop Demo Proposal

## Overview

This document proposes a public, end-to-end demonstration of the first cross-agent citation-join between MarketNow and Vibe (doteyeso-ops). The goal is to prove that two independently-developed agent trust + payment systems can interoperate via public ledgers, without either side needing to merge code into the other's repo.

## Background

Over the past week (July 19-25, 2026), MarketNow and Vibe have been collaborating on PipedreamHQ/awesome-mcp-servers#94 to align on:

1. **Agent Trust Cards (ATC)** — MarketNow's identity layer (Ed25519 + RFC 8785 JCS)
2. **Action-receipts** — MarketNow's delivery proof layer (Ed25519 + RFC 8785 JCS, same crypto)
3. **Mandate ↔ decision_ref** — spending authority mapping
4. **settle_txhash ↔ settle coordinate** — payment settlement mapping
5. **ref_code provenance** — who referred the purchase (shipped by Vibe on July 25)

All five are now technically real on both sides. No PRs were merged either way — the integration is via public ledger citations only.

## Proposed Demo Flow

### Step 1: MarketNow mints a ref_code for the Vibe agent

```bash
curl -X POST https://marketnow.site/api/referrals \
  -H "Content-Type: application/json" \
  -d '{"action": "mint", "agent_id": "agent_vibe_demo"}'
# → {"ref_code": "ref_xxxxxxxx", "share_url": "..."}
```

### Step 2: Vibe mints a ref_code for the MarketNow agent

(Vibe-side equivalent — @doteyeso-ops's API)

### Step 3: MarketNow agent makes a purchase using a Vibe ref_code

```bash
curl -X POST https://marketnow.site/api/agent-purchase \
  -H "Content-Type: application/json" \
  -d '{
    "skillId": "mn-sub-46018",
    "refCode": "<vibe_ref_code>"
  }'
# → MarketNow issues receipt, credits Vibe ref_code with 5% commission
```

### Step 4: Vibe agent makes a purchase using a MarketNow ref_code

(Vibe-side equivalent — Vibe action-receipt with `ref_code: "ref_f92d4211"`)

### Step 5: Both receipts verify on both ledgers

```bash
# MarketNow receipt verifies
curl https://marketnow.site/api/atc?action=verify-receipt&receipt_id=<mn_receipt_id>

# Vibe receipt verifies (with ref_bound: true)
curl https://vibes-coded.com/api/v1/outcomes/action-receipt/<vibe_receipt_id>?ref_code=ref_f92d4211
```

### Step 6: Public documentation

Both sides publish a blog post / GitHub issue documenting:
- The ref_codes used
- The receipt IDs
- The ledger URLs
- The verification commands
- The timestamps

Anyone can reproduce the verification by running the curl commands.

## Why this matters

This would be the **first public, cryptographically verifiable, cross-agent citation-join** in the MCP ecosystem. It proves:

- Two independent agent trust systems can interop without code merging
- Public ledgers (GitHub) are sufficient audit infrastructure
- Ed25519 + RFC 8785 JCS is a viable canonical format for cross-system receipts
- The "Tier-1 mutual" pattern (cite + verify, no PRs) scales

## What's needed from Vibe

1. Confirmation that the action-receipt endpoint accepts arbitrary MarketNow ref_codes (not just `ref_f92d4211`)
2. A Vibe ref_code minted for `agent_marketnow_demo` (so we can use it in step 3)
3. Public documentation of the Vibe-side verification command (for step 5)

## What MarketNow will provide

1. The MarketNow ref_code minted in step 1
2. A real receipt from step 3 (or a test receipt if no paid skill is available)
3. A blog post on dev.to with the full transcript
4. A GitHub issue in `edgarfloresguerra2011-a11y/marketnow` documenting the demo

## Status

- **MarketNow side**: ready (all infrastructure shipped and live)
- **Vibe side**: ready (per @doteyeso-ops on Pipedream #94, 2026-07-25T16:15:44Z)
- **Blocker**: vibes-coded.com is currently returning 502 (as of 2026-07-26T03:40Z). Need the API back up to run the demo.

Once Vibe is back up, this can be executed in under an hour.

## References

- Original thread: https://github.com/PipedreamHQ/awesome-mcp-servers/issues/94
- MarketNow ATC spec: https://marketnow.site/api/atc?action=spec
- MarketNow CA public key: https://marketnow.site/api/atc?action=ca-key
- MarketNow real receipt: https://marketnow.site/api/atc?action=verify-receipt&receipt_id=rcpt_c8b9dc67f88e4da5bd3a
- MarketNow referral ledger: https://github.com/edgarfloresguerra2011-a11y/marketnow/tree/master/_data/referrals
- Vibe docs (when up): https://vibes-coded.com/docs/AGENT_INSTALL.md
- Vibe citation-join pattern: https://vibes-coded.com/patterns/CITATION_JOIN.md
