# Third-party digest anchoring (Rekor)

> "What gets you there is a countersignature from a party with no stake in the rewrite, carrying a timestamp, published somewhere a third party can check inclusion afterwards."
> — [@anp2network](https://dev.to/anp2network), 2026-09-07 (issue #13)

This closes [issue #13](https://github.com/alicelabs-llc/universal-trust-adapter/issues/13): the digests are countersigned and timestamped by **rekor.sigstore.dev** — Sigstore's public, append-only, inclusion-checkable transparency log. The publisher cannot rewrite an entry once it is in the log.

**Entry #2 (2026-09-09)** anchors the *runner-under-test* artifacts of conformance suite v1.3.2 — see the second half of this README.

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
| `anchor-statement-v2.json` | Entry #2's statement — the runner-under-test digests. |
| `anchor-record-v2.json` | Entry #2's coordinates, key, proof snapshot. |

---

# Entry #2 — the runner is the tested thing (v1.3.2)

The follow-up gap named in the thread was *"making the runner the tested thing, not just the cards"*: the reference scorer is our code, and until v1.3.2 a stranger had to trust it. Entry #2 anchors the artifacts that remove that trust:

| Subject | sha256 |
|---|---|
| `score-runner.mjs` (the tested thing, 12258 bytes) | `ef5fd5fbc003e27caef523f8b0395953190e9fc6ac88009c2131ea6cc33a23b8` |
| `runner-tests/answer-key.json` (the behavioral oracle) | `9ccd874428e6db85…` (full value in the statement) |
| `runner-tests/runner-tests.mjs` (golden + mutation suite) | `6960d4070c2ac2c4…` (full value in the statement) |
| `runner-tests/mutants.json` (10 known-bad runner variants) | `a23b19fbef01d866…` (full value in the statement) |
| `runner-tests/README.md` | `c1880604aa932202…` (full value in the statement) |
| conformance `_index.json` v1.3.1 (pre-release state) | `ee9de8535b9498624b60e578496c5970291ff20ad1e9bae20f9f3496c6303da1` |

The statement's canonical sha256 (what lives inside the Rekor entry):
`dfda2410a2f9a8283730b31c1d5201f3fb1baae3f346a15ce1c149e28380f750` (3015 bytes).

## The Rekor entry #2

- **Log:** https://rekor.sigstore.dev
- **Entry UUID:** `108e9186e8c5677ae6e6afcebd3785524b9b2702b100b3b38b1e2a2f10a7c7d4056023cd4dd1e53a`
- **Log index:** `2764017355` (tree-local index `2642113093`)
- **Integrated time:** `2026-09-09T01:14:24Z`
- **Countersignature:** ECDSA P-256 over sha256(statement v2); fresh throwaway key, private key discarded after signing.

## Verify it yourself

```bash
node verify-rekor.mjs --record anchor-record-v2.json --statement anchor-statement-v2.json
```

Same six independent checks as entry #1 (existence, content hash, countersignature, timestamp, Merkle inclusion fold, checkpoint signature) — all local cryptography against live third-party data.

Then verify the runner itself is the tested thing:

```bash
cd ../conformance/runner-tests && node runner-tests.mjs
```

24 checks: runner bytes match the anchored key, the separation matrix and reference verdict reproduce it row by row, and all 10 mutants are caught. The behavioral oracle is the answer key; the bytes oracle is this entry. Between them, the runner is neither trusted nor untested.


---

# Entry #4 — the revocation registry is anchored (MNR-CRL-1.0)

Roadmap v5.1 item 5 shipped: the MarketNow Revocation Registry — a signed,
append-only CRL for Agent Trust Cards and CA keys. Entry #4 anchors it in Rekor,
so the revocation history itself is third-party-checkable ("Certificate
Transparency for agents").

| Subject | value |
|---|---|
| `crl.json` full file (sha256) | `205f72695f74ff43abcb15f1d6dec8de79506ce40f83ab2802051c10412afb34` |
| CRL signed payload (MNR-CRL-1.0 domain, RFC 8785 JCS) | `978dd807c6d2c95b…` (full value in the statement) |
| registry key | `mn-revoc-001` (Ed25519, delegated — the CA key never signs revocations) |

Seeded with REAL events:

| Subject | Status | Since |
|---|---|---|
| ATC-2026-5837752 | REVOKED (SUPERSEDED) | 2026-07-18 |
| ATC-2026-5936297 | REVOKED (SUPERSEDED) | 2026-07-22 |
| ATC-2026-9880252 | REVOKED (SUPERSEDED) | 2026-07-23 |
| mn-ca-002 | REVOKED (KEY_COMPROMISE) | 2026-09-08 |

## The Rekor entry #4

- **Log:** https://rekor.sigstore.dev
- **Entry UUID:** `108e9186e8c5677a90923bac85a524d43989b8475f02ef7cabac69594c884e1caf18bc7e8a559368`
- **Log index:** `2771735480` (tree-local index `2649831218`)
- **Integrated time:** `2026-09-09T17:24:25Z`
- **Countersignature:** ECDSA P-256 over sha256(statement v4); fresh throwaway key, private key discarded after signing.

## Verify it yourself

```bash
node verify-rekor.mjs --record anchor-record-v4.json --statement anchor-statement-v4.json
```

Same nine independent checks (existence, logID, content hash, countersignature,
key match, signedEntryTimestamp, Merkle inclusion fold, checkpoint signature,
tree coverage) — all local cryptography against live third-party data.

Then verify the CRL's own Ed25519 signature (registry key in `registry-key.json`):

```bash
node -e "…see /uta/revocations/README.md — sha256 + Ed25519 over MNR-CRL-1.0 domain…"
```

The signed CRL lives at `/uta/revocations/crl.json`; live status resolution at
`/api/ocsp?card_id=…` and `/api/ocsp?kid=…` (fail-closed); the MCP tool is
`marketnow_check_revocation`. The npm package `marketnow-mcp@1.10.2` exposes
both `marketnow_check_revocation` and `marketnow_fingerprint_tool` (TFP-1.0).

# Entry #5 — the round-3 anchor: adversarial distribution, generated mutants, Rekor-in-the-loop (v1.4.0)

anp2network's round-3 comment (3ehcp) named three gaps; entry #5 anchors the
artifacts that close them. The digests below are what the log committed to at
`2026-09-10T21:52:48Z` — the publisher cannot rewrite them.

| Subject | sha256 |
|---|---|
| `score-runner.mjs` v1.4.0 (the tested thing) | `5802cc35c076c3e45dbca9200b483b1606302fe0a8cf93afb9d4775ffa28565b` |
| `generate-accept-vectors.mjs` v1.4.0 (adversarial mode) | `60d064943057b5b3…` (full value in the statement) |
| `vectors/_index.json` v1.4.0 | `edfa37d3ca380d4b…` |
| `runner-tests/answer-key.json` (5-surface oracle) | `79a5c5936be9ba9f…` |
| `runner-tests/runner-tests.mjs` (27 checks, `--rekor`) | `e5f60fb66a8dfb6e…` |
| `runner-tests/mutants.json` (10 curated) | `9f082e251920b477…` |
| `runner-tests/generate-mutants.mjs` (the sweep) | `e22907d3338e1463…` |
| `runner-tests/mutant-sweep.json` (113 mutants, 92 caught, 21 survivors classified) | `e3fa9a4fc808c76f…` |
| `verify-artifact.mjs` (Rekor-in-the-loop) | `eb2262924772304f…` |
| runner-tests + vectors READMEs | `762b39e8c335b9f2…` / `c0a41953ef39c075…` |

## The Rekor entry #5

- **Log:** https://rekor.sigstore.dev
- **Entry UUID:** `108e9186e8c5677a8f6b0956695beefc19bcd6790a6285469c39a0b2096bcedcec8b44753c8025bf`
- **Log index:** `2787622029`
- **Integrated time:** `2026-09-10T21:52:48Z`
- **Countersignature:** ECDSA P-256 over sha256(statement v5); fresh throwaway
  key, private key discarded after signing — it can never sign again.

## Verify it yourself — the log in the actual verification path

```bash
# the anchor itself (9 checks)
node verify-rekor.mjs --record anchor-record-v5.json --statement anchor-statement-v5.json

# ANY artifact, from ANY origin — the digest comes from Rekor, not the hub:
node verify-artifact.mjs https://www.marketnow.site/uta/conformance/score-runner.mjs

# or the whole suite, digest chain re-rooted at the live entry first:
node ../runner-tests/runner-tests.mjs --rekor
```

`verify-artifact.mjs` is the "one line" from the round-3 comment, made
executable: download the artifact, fetch the entry live, authenticate the
statement against the entry's committed hash, verify Rekor's signatures
(signedEntryTimestamp, inclusion fold, checkpoint) and the throwaway
countersignature, then compare the sha256 of the downloaded bytes against the
Rekor-rooted pins. The comparison never stays inside the hub's origin.

**Honest note.** The repo's answer key had drifted between 2026-09-10 and this
anchor (the `2dbaa429` doc-nit changed runner bytes without re-recording; the
suite's bytes oracle flagged it fail-closed). v1.4.0 re-records and re-anchors.
That drift — and its catching — is exactly what entry #5 exists to make
non-repeatable silently.

# Entry #6 — the round-4 anchor: the release chain (v1.5.0, rollback resistance)

anp2network's round-4 comment (3ehp6): "inclusion proves a record exists in
the log. It says nothing about that record being the current authorized state
for score-runner... Serve an older, legitimately anchored runner together
with the artifact that matched it at the time, and every step you listed
passes... Rollback, fully signed." Entry #6 anchors the answer: a
**persistent release identity** (Ed25519) and the monotone **release
statement r1** (counter 1, suite v1.5.0, 17 artifact digests).

| | |
|---|---|
| Log | https://rekor.sigstore.dev |
| Entry UUID | `108e9186e8c5677a6eb2af77b82ec2bdff4ccef2170bc7f482a0bf7cec5b2e9752f22f9b8cac002b` |
| Log index | `2795106183` |
| Integrated | `2026-09-11T15:38:34Z` |
| Countersignature | ECDSA P-256 over sha256(statement v6); fresh throwaway, private key discarded — it can never sign again |
| Bootstrap floor | `2787622029` (entry #5) — release anchors at or below this are refused at first contact |

## Verify it yourself — now with rollback resistance

```bash
# the round-3 flow still works (any artifact, any origin):
node verify-artifact.mjs https://www.marketnow.site/uta/conformance/score-runner.mjs

# the round-4 flow — the release chain with local state:
node verify-artifact.mjs --release
node verify-artifact.mjs --release --artifact https://www.marketnow.site/uta/conformance/score-runner.mjs
```

The release identity is the first key in the project that is neither a
throwaway nor published: its private half is held offline by the publisher,
because a monotone counter is only meaningful if nobody else can sign one.
The verifier keeps local state (highest accepted counter + checkpoint),
refuses lower counters (rollback), same-counter conflicts (fork), and
below-floor anchors (history restart). The residual — what a FRESH verifier
cannot know — is bounded by the floor and by the identity only existing in
entry #6+ statements; from the first accepted release onward, monotonicity
is total. See `../releases/README.md` for the full contract and the
publisher's release procedure.

## Files (entry #6)

| File | Role |
|---|---|
| `anchor-statement-v6.json` | The signed statement: release identity + release statement r1 digest + the v1.5.0 digest set. |
| `anchor-record-v6.json` | Untrusted locator (UUID, logIndex, integrated time, countersignature key). Everything that matters is re-verified live. |
| `verify-artifact.mjs` | v1.5.0: round-3 single-artifact flow + `--release` rollback-resistant chain verification. |
