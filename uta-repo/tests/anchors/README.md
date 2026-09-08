# Third-party digest anchoring (Rekor)

> "What gets you there is a countersignature from a party with no stake in the rewrite, carrying a timestamp, published somewhere a third party can check inclusion afterwards."
> — [@anp2network](https://dev.to/anp2network), 2026-09-07 (issue #13)

This closes [issue #13](https://github.com/alicelabs-llc/universal-trust-adapter/issues/13): the digests are countersigned and timestamped by **rekor.sigstore.dev** — Sigstore's public, append-only, inclusion-checkable transparency log. The publisher cannot rewrite an entry once it is in the log.

## What was anchored

The anchor statement (`anchor-statement.json`) carries four digests:

| Subject | sha256 |
|---|---|
| `agent-trust-card-1.1.2.tgz` (npm registry, 26782 bytes) | `f1b44ed29eea0ca9eee65c1e0974c5d2b4b512378c6d21edb6344daf9184641a` |
| its tar layer — the rebuild target (122880 bytes) | `519d406adba1e8199ca0c91a8f47195a81e42745aac05e599c9b3de87359b990` |
| the source manifest (12 files) | `5665c19bbfef0212c99ad1a5e156e8b265f3c5a9df05317f21775c34188e20e0` |
| conformance vectors `_index.json` v1.3.0 | `358a18d58aaef16c3c64a2622404d88d8af67e1cb6c31ea76dac12626eab7597` |

The statement is serialized deterministically (recursive sorted keys, no whitespace, ASCII content), and its sha256 is what lives inside the Rekor entry.

## The Rekor entry

- **Log:** https://rekor.sigstore.dev (Sigstore public instance)
- **Entry UUID:** `108e9186e8c5677a91a6963aa1e9125a7350c84e5018e60e6d374db7117011c1f67e8b4c5bf420e0`
- **Log index:** `2762061972` (tree-local index `2640157710` in the active tree)
- **Integrated time:** `2026-09-08T21:03:33Z`
- **Countersignature:** ECDSA P-256 over sha256(statement); the key was a fresh throwaway, private key discarded after signing — it can never sign again (same policy as `ca-test-1`).

## Verify it yourself

```bash
node verify-rekor.mjs
```

The script performs six independent checks, all local cryptography against data fetched from the third party:

1. **Entry exists** — fetched live from `rekor.sigstore.dev` by log index.
2. **Content** — the entry's data hash equals sha256 of the anchor statement's canonical bytes.
3. **Countersignature** — the ECDSA signature inside the entry verifies with the published public key.
4. **Timestamp** — Rekor's `signedEntryTimestamp` verifies with Rekor's public key (`/api/v1/log/publicKey`).
5. **Inclusion** — the Merkle proof (RFC 6962-style fold) recomputes the root locally and it matches.
6. **Checkpoint** — the signed tree head is signed by Rekor's key (C2SP note format, 4-byte key hint stripped).

A stranger re-derives the same answer months later without asking the publisher — the log is append-only, the checkpoint is signed by the third party, and the proof hashes are served by the third party.

## What this replaces

The retracted "signed Git tag" wording. A tag is rewritable and authenticates the publisher, not the pointer's history; a Rekor entry cannot be rewritten by the publisher — the append-only log and the signed tree heads are the property being bought. Storage was never the property; inclusion-checkability by a stranger is.

## Files

| File | Role |
|---|---|
| `anchor-statement.json` | The signed statement (what the digests are). |
| `anchor-record.json` | Entry coordinates (UUID, indexes, time), the published countersignature key, the inclusion proof snapshot, and verification pointers. |
| `verify-rekor.mjs` | The stranger flow: 6 local checks against live third-party data. |
