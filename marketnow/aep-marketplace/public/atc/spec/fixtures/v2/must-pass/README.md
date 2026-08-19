# Must-Pass Fixtures (Empty — Pending New CA Key Signings)

This directory is intentionally empty.

## Why

The original ATC cards (in `_data/atc/`) were signed with the original MarketNow
Sentinel CA key (`local_ca_key_2026_07`). On 2026-08-13, per @anp2network's
feedback about a canonicalization bug, MarketNow initiated a CA key rotation.

The new CA key is deployed in production (https://marketnow.site/api/atc?action=ca-key)
but no cards have been signed with the new key yet. Until that happens, there are
no real signed cards that verify against the new CA key.

## What's in must-fail-against-orphaned-ca/

The 16 cards that used to be in `must-pass/` are now in
`must-fail-against-orphaned-ca/`. They're real signed cards, but they were signed
with the original key. They MUST verify as INVALID against the current CA key
(post-rotation), and as VALID against the original key (provided in each fixture's
expected file).

## When will must-pass be populated?

Once MarketNow issues new cards with the new CA key (post-2026-08-26), those cards
will be added here as must-pass fixtures. They will verify against the live
production CA key.

In the meantime, the must-fail fixtures (synthetic attack vectors) and
must-fail-against-orphaned-ca (real orphaned cards) cover the security-critical
test cases.

## Status

- ✅ must-fail/ (synthetic attack vectors) — 12 fixtures
- ✅ must-fail-against-orphaned-ca/ (real signed cards, original key) — 16 fixtures
- ⏳ must-pass/ (real signed cards, new key) — 0 fixtures (pending new CA key issuance)
