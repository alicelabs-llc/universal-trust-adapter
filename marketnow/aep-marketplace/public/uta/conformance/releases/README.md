# The UTA release chain (v1.5.0 — rollback resistance)

> "What I would want is rollback resistance as a named verifier property. Bind
> `score_runner_v1_4_0` and its siblings to a monotone release counter signed
> under the same identity. Have the verifier keep the highest counter it has
> accepted, with the digest and a verified checkpoint, and refuse anything
> lower or anything that conflicts at a counter it already accepted.
> Consistency-prove the checkpoint when advancing."
> — @anp2network, round 4 (dev.to comment 3ehp6)

This directory is that property, made concrete.

## The moving parts

| File | Role |
|---|---|
| `release-identity.json` | The **persistent** Ed25519 release identity (public half). The first key in this project that is neither a throwaway (like ca-test-1) nor published-with-its-private-half (like ca-test-2): it exists precisely so that release counters **cannot be forged** by anyone else. Anchored in Rekor entry #6. |
| `release-statement-r1.json` | Release counter 1, signed under the identity. Carries: the artifact digest map (the **current authorized state**), the suite version, and `previous_release` (null for r1; every later release chains to its predecessor's sha256). |

The private half of the identity is held offline by the publisher and is
**never** committed, deployed, or published. Losing it means losing the chain
(prefix still verifiable, no future releases); leaking it means anyone can
fork counters — both failure modes are strictly worse than any throwaway-key
tradeoff, which is why the project used throwaways everywhere else.

## How a stranger verifies (and resists rollback)

```bash
# the release chain: current release is the highest counter this verifier
# has EVER accepted (state kept in ./.uta-verify-state.json)
node ../anchors/verify-artifact.mjs --release

# ...and an artifact is current only if it matches the release's pins:
node ../anchors/verify-artifact.mjs --release --artifact https://www.marketnow.site/uta/conformance/score-runner.mjs
```

The verifier:

1. Fetches the anchor entry **live** from rekor.sigstore.dev (the record file
   is an untrusted locator — a wrong one fails closed) and verifies Rekor's
   own signatures: signedEntryTimestamp, the inclusion fold, the checkpoint.
2. Authenticates the anchor statement against the **entry's committed hash**
   (the statement can come from anywhere — only the log vouches for it).
3. Extracts the release identity from the authenticated statement and checks
   the release statement's Ed25519 signature under it.
4. Applies the **local-state rules**: refuses a LOWER counter (rollback: a
   previously-valid release served as current), refuses a SAME counter with a
   different hash (fork), and when ADVANCING requires the chain linkage
   (previous_release.sha256), log monotonicity (the new anchor sits at a
   higher logIndex than the accepted checkpoint) and a grown tree.
5. Optionally compares any artifact's sha256 against the release's pins.

## The honest residual: first contact

A fresh verifier has no local memory. It is bounded two ways: the anchor must
sit **above the bootstrap floor** (entry #5, logIndex 2787622029 — the last
pre-chain anchor), so history cannot be restarted below known ground; and the
release identity only exists in statements anchored at or after entry #6, so
older entries cannot impersonate a release. What first contact still cannot
know is whether a NEWER release than the one it found exists. That is
irreducible without local memory or an out-of-band hint; the state file buys
monotonicity from the first accepted release onward, and every future release
MUST advance the counter and re-anchor to stay verifiable as current.

## Releasing v(N+1) — the publisher's procedure

1. Finalize the artifacts; re-record the answer key; re-run both sweeps.
2. `release-statement-rN.json`: counter N, artifact digests,
   `previous_release: { counter: N-1, sha256: <r(N-1) canonical sha> }`.
3. Sign it with the release identity (Ed25519 over canonical JSON minus the
   `signature` key). **Never** reuse a counter, never re-sign an old one.
4. Submit a new Rekor entry anchoring the new statement (throwaway P-256
   countersignature, key discarded — the anchor policy stays throwaway; only
   the RELEASE identity is persistent).
5. Publish the statement + updated record locator on the hub.

## r1 → r2: the advance, exercised for real (2026-09-11)

Minutes after r1 was anchored (entry #6, logIndex 2795106183), the
stranger-flow test caught a bug in `verify-artifact.mjs` itself: the
release-mode `--artifact` comparison compared a pin OBJECT against the
artifact's sha STRING and could never match. r1 was already log-committed —
re-signing a counter is exactly what the policy forbids — so the fix shipped
as **r2**: same authorized artifact set (the runner and every conformance
artifact unchanged), one fixed verifier, chained via
`previous_release: { counter: 1, sha256: <r1> }`, anchored at a HIGHER log
index (entry #7). A verifier holding r1 accepts r2 only through the advance
rules (chain linkage + log monotonicity + grown tree); a fresh verifier
takes r2 directly. The append-only log keeps both: r1 as history, r2 as
current. This is the designed procedure working — including its
inconvenience, which is the point.
