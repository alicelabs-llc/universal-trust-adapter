---
title: "Re: @anp2network — forward-slash bug FIXED, your verifier now passes"
published: true
description: "You found the bug, I fixed it. Your Python verifier now produces hash match: True, sig verifies: True. Here's the proof + what changed + what's next."
tags: atc, security, mcp, ai
date: 2026-08-14T03:30:00Z
---

This is a public reply to [@anp2network's comment](https://dev.to/edison_flores_6d2cd381b13/re-atc-verification-failure-report-youre-right-heres-the-fix-170n) on Aug 13, 2026.

You were right. **The bug was in my canonical JSON implementation.** Here's the fix.

---

## The bug

My `lib/canonical-json.mjs` had this line in the string serializer:

```javascript
else if (ch === 0x2f) result += '\\/';  // escape forward slash
```

This escaped forward slashes (`/` → `\/`) in string values. **RFC 8785 §3.2.2.2 explicitly says: "the U+002F (solidus) character MUST NOT be escaped."**

Every string with a URL in it (like `"revocation_url": "https:\/\/marketnow.site\/..."`) was 1 byte longer per slash than the correct RFC 8785 JCS output. Since 7 of the payload fields contain URLs with forward slashes, this was enough to make every hash mismatch.

Your canonical string was 754 bytes. Mine was 760+ bytes. Different bytes → different SHA-256 → different signature verification result.

## The fix

Removed the offending line. The serializer now passes forward slashes through unchanged. Also fixed 2 more issues you identified:

1. **sentinel_score alias removed from signed payload** — the signed bytes now contain only `sentinel_review_score` (the canonical field). The alias is still added in the `/api/atc?action=verify` response for backward compat, but NOT in the signed payload.

2. **ca_key_id added to each card** — the signature block now includes `ca_key_id` (first 16 chars of the CA public key base64). Exposed in the envelope endpoint as `attestation.ca_key_id`. Lets external verifiers know which CA key was used without guessing.

## Proof: your verifier now passes

I ran your exact Python verifier against the updated envelope:

```
card ATC-2026-1509360
RFC 8785 JCS: 735 bytes
  sha256      : d643921ff4ec4fbafa12f3d6283e0546...
  hash match  : True ✅
  sig verifies: True ✅
```

**Hash match: True. Sig verifies: True.** Under RFC 8785 JCS, your from-scratch Python verifier now confirms the signature.

## What you asked for next

> When Part 3 ships we will run this same file, unchanged, against all 57 cards and post the result either way.

**Part 3 has shipped.** All 57 cards are re-signed under RFC 8785 JCS with the forward-slash fix. Please run your verifier against all 57 and post the result.

```
GET https://marketnow.site/api/atc?action=envelope&card_id=ATC-2026-XXXXXXX
GET https://marketnow.site/api/atc?action=revocation-list  (for card IDs)
```

If any of the 57 fails, post the card_id + your computed hash vs stored hash. I'll diff and fix.

## Summary

| Bug | Status |
|-----|--------|
| Forward-slash escaping (RFC 8785 §3.2.2.2) | ✅ Fixed |
| sentinel_score alias in signed payload | ✅ Fixed |
| ca_key_id missing | ✅ Fixed |
| revocation-list regression (404) | ✅ Fixed |
| Unknown action returning 200 | ✅ Fixed (Aug 12) |

**Your verifier passes. Thank you for doing the work.**

---

*Edgar Flores, AliceLabs LLC. Envelope: [marketnow.site/api/atc?action=envelope&card_id=ATC-2026-1509360](https://marketnow.site/api/atc?action=envelope&card_id=ATC-2026-1509360).*
