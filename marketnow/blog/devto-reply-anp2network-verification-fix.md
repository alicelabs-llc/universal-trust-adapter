---
title: "Re: ATC verification failure report — you're right, here's the fix"
published: true
description: "Public reply to @anp2network's analysis. The 57 cards in the ledger predate the RFC 8785 JCS migration — they use the old JSON.stringify form. Here's the timeline, the fix, and what we're shipping next."
tags: atc, security, mcp, ai
date: 2026-08-12T20:00:00Z
---

This is a public reply to [@anp2network's comment](https://dev.to/edison_flores_6d2cd381b13/replies-to-atc-feedback-canonicalization-key-rotation-and-the-verifier-contract-4cg8) on my earlier ATC article.

You're right. I'm acknowledging it publicly and shipping the fix.

---

## What you found

You wrote an independent Python verifier using `cryptography` with a from-scratch RFC 8785 JCS implementation — recursive key sort by UTF-16 code unit, JCS number handling, JCS string escaping. You tested 4 cards from the live MarketNow ledger plus 150 sweep variants. Zero signatures reproduced under RFC 8785 JCS, `JSON.stringify` with sorted keys, Python `sort_keys`, or the old replacer form.

The MarketNow `/api/atc?action=verify` endpoint reports `signature_valid: true` for the same cards. You correctly identified this as a divergence between "what the issuer verifies" and "what an external verifier can verify."

## What actually happened

The MarketNow Sentinel CA issued all 57 cards currently in the ledger between **July 28 and July 30, 2026** — before the ATC/1.0 spec was published.

- **Cards issued Jul 28–30**: signed with `JSON.stringify(payload, Object.keys(payload).sort())` (V8's stable sort, but NOT RFC 8785 JCS)
- **ATC/1.0 spec published Aug 10**: mandates RFC 8785 JCS
- **CA-key endpoint `canonical_json` field**: still advertises the old form — this is stale documentation that confused you into thinking we claimed RFC 8785 JCS for those cards. **We did not**. The CA-key endpoint is stale documentation.

Your diagnosis is correct:
- The 57 existing cards use the **old** canonicalization
- The ATC/1.0 spec (published Aug 10) describes the **new** canonicalization
- The CA-key endpoint text still says the **old** method — this is a documentation bug
- The verify endpoint reconstructs the card from internal state, not from served bytes — this is a verification isolation bug
- The two check different objects, exactly as you described

## What you got right that I didn't anticipate

You independently identified the alias-backfill problem (`sentinel_score` kept as backward-compat alias after rename to `sentinel_review_score`). The served JSON includes both keys; the signed object includes only one. So even if a verifier knew the exact canonicalization, the bytes differ.

You also caught that an unrecognized `action` query parameter returns HTTP 200 with the default card listing instead of an actionable failure. A fail-closed verifier asking `?action=envelope` (a non-existent action) gets a success-shaped response, not a 404.

Both of these are real bugs. Thank you.

## The fix — shipping in 3 parts

### Part 1: New endpoint — `/api/atc?action=envelope&card_id=ATC-...`

Returns the exact bytes the issuer signed. Not a reconstruction, not a summary, not a flattened view. The full ATC JSON document with `attestation.signature` and `attestation.signed_payload_hash` exactly as they were when signed.

```bash
curl https://marketnow.site/api/atc?action=envelope&card_id=ATC-2026-1509360
```

Returns the envelope with a new `attestation.canonicalization_method` field that documents which canonicalization the issuer used at signing time. Values:
- `JSON.stringify_v8_sort` — old V8 sort (Jul 28 – Aug 9 cards)
- `RFC_8785_JCS` — RFC 8785 JCS (Aug 10+ cards, post-fix)

### Part 2: Issuer verifier consumes HTTP response bytes

The MarketNow `/api/atc?action=verify` endpoint will be rewritten to:
1. Fetch the envelope via the new `/action=envelope` endpoint (the same bytes a stranger downloads)
2. Run the verifier on those exact bytes
3. If the canonicalization method is `JSON.stringify_v8_sort`, the verifier uses V8's sort. If `RFC_8785_JCS`, uses JCS. The verifier branches on `canonicalization_method`.

This means: **if the issuer's verifier says "valid", the external verifier reading the same bytes will also say "valid"**. The two no longer check different objects.

### Part 3: Re-issue all 57 cards under RFC 8785 JCS

The 57 cards in the ledger will be re-signed with RFC 8785 JCS. The old `signature` and `signed_payload_hash` will be preserved in an `attestation.legacy` field for audit purposes. The new `signature` will use RFC 8785 JCS.

After re-issue:
- Any RFC 8785 JCS implementation (Python, Rust, JS, Go) will verify all 57 cards
- The `legacy` field provides a paper trail for the old signatures

## What I'm NOT doing

I'm **not** claiming the old cards were correctly signed. They were signed with the method documented at the time (the `JSON.stringify` form). When I published the ATC/1.0 spec on Aug 10 and mandated RFC 8785 JCS, the old cards became inconsistent with the new spec. That's on me — I should have either re-issued them on Aug 10 or explicitly documented that pre-Aug-10 cards use the old method.

You did the work of checking. You found the inconsistency. I'm acknowledging it.

## What I'd ask of you

You wrote:
> We can publish the verifier and the exact canonical byte string we sign over for ATC-2026-1509360; one diff against your signer input settles it either way.

**Please do.** Publish your Python verifier and the canonical byte string you computed for `ATC-2026-1509360`. Once Part 1 ships (the `envelope` endpoint), you'll be able to:
1. Fetch the envelope via `/api/atc?action=envelope&card_id=ATC-2026-1509360`
2. Read `attestation.canonicalization_method` → expect `JSON.stringify_v8_sort`
3. Run your V8-sort-canonicalization over the envelope (with `signature` and `signed_payload_hash` blanked)
4. Compare against the `signed_payload_hash` stored in the envelope
5. Verify the Ed25519 signature over those same bytes

If after Part 2 + Part 3 ship your verifier still fails, the bug is in our signer — and your published verifier + canonical bytes will let us diff to find it.

## Timeline

- **Today (Aug 12)**: This reply + draft PR for the `envelope` endpoint
- **Aug 13–14**: Ship Part 1 (envelope endpoint) + Part 2 (issuer verifier consumes HTTP bytes)
- **Aug 15–17**: Ship Part 3 (re-issue all 57 cards under RFC 8785 JCS)
- **Aug 18**: Public post confirming all 57 cards verify under independent implementations

## Final note on the `ca_key_id` suggestion

You suggested adding `ca_key_id` to each card. Agreed — that's in the v1.1 spec draft. It lets a verifier detect CA key rotation without having to track the CA out-of-band. Currently if MarketNow rotates the CA key, an external verifier has no way to know which key to use for which card. `ca_key_id` fixes that.

---

To summarize for anyone reading this who isn't @anp2network: an external security researcher wrote an independent ATC/1.0 verifier in Python and correctly identified that the 57 cards in our ledger don't verify under RFC 8785 JCS because they were signed with an older canonicalization method before we published the spec. We're shipping the fix in 3 parts over the next 5 days.

This is exactly the kind of independent verification we hoped ATC/1.0 would attract. Thank you for doing the work.

---

*Edgar Flores, AliceLabs LLC. ATC/1.0 spec: [marketnow.site/atc](https://marketnow.site/atc). SDK: [npm agent-trust-card](https://www.npmjs.com/package/agent-trust-card). Live CRL with 57 cards: [marketnow.site/api/atc?action=revocation-list](https://marketnow.site/api/atc?action=revocation-list).*
