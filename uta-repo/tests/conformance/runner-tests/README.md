# The runner is the tested thing (conformance suite v1.3.3)

Until v1.3.2 the reference scorer (`../score-runner.mjs`) was **our** code: a
stranger could run it, but had to *trust* it — the same asymmetry this thread
has been killing since the first vector. This suite closes that gap by turning
the runner from a trusted component into a **tested component**:

| Oracle | What it pins | Where it lives |
|---|---|---|
| **Bytes** | `sha256(score-runner.mjs)` — the exact runner bytes | `answer-key.json`, anchored in [Rekor](https://rekor.sigstore.dev) (entry #2 for v1.3.2, entry #3 for the v1.3.3 key) |
| **Behavior** | the 8-runner separation matrix + the reference-mode verdict, row by row, failure lists included | `answer-key.json` (recorded `2026-09-09`, valid through `2027-08-19`) |
| **Teeth** | 10 known-bad runner variants — each must DIVERGE from the key | `mutants.json` (deterministic byte patches, digests pinned in the key) |

A key that nothing can fail is not a test. Every mutant here is caught — if you
rebuild any of them from `mutants.json` and run the suite, it flags it.

## v1.3.3 — the two fixes anp2network's second bug report forced

The v1.3.2 runner enforced only **one side** of the validity window
(`expires_at > NOW`) and took generated-card expectations from a sidecar with a
`true` default. anp2network (dev.to comment 3ec7d) demonstrated both failures
and asked for exactly three things; all three landed:

1. **`premature-atc` (fixed vector #14).** A properly-signed, anchored, active
   card whose only defect is a FUTURE `issued_at` (`2030-01-01`). The exact
   mirror of `expired-atc`. Runners that check only the upper bound accept it.
2. **Two-sided reference policy.** `issued_at <= NOW < expires_at` — the
   generator now derives issue dates from the wall clock (1..729 days back,
   never the PRNG) and fail-closes at generation; the reference runner enforces
   both bounds. Rerun of anp2's exact command (`--count 60 --seed 7`):
   **0/60 future-dated** (was 32/60).
3. **Derived ground truth, no defaults.** Generated-card expectations are
   computed from the card bytes + pinned anchors. The `_generated-index.json`
   sidecar is demoted to a cross-check: present-and-disagreeing is a hard FATAL
   (refuses to score); absent changes nothing. Rerun of anp2's self-signed
   4-card set with the sidecar deleted: always-true **0/4** (was 4/4),
   reference **4/4** — the inversion is gone.

The answer key was re-recorded after the fixes (14 fixed vectors, mutant
occurrence counts updated for the new code paths) and re-anchored as Rekor
entry #3. The suite still runs **24 checks, 10/10 mutants caught**.

## Run it

```bash
git clone https://github.com/alicelabs-llc/universal-trust-adapter
cd universal-trust-adapter/uta-repo/tests/conformance/runner-tests
node runner-tests.mjs
```

Or from the live URLs alone (no repo needed):

```bash
mkdir uta && cd uta
curl -sLO https://www.marketnow.site/uta/conformance/score-runner.mjs
mkdir -p vectors runner-tests
for f in _index.json valid-atc.sha256; do
  curl -sL "https://www.marketnow.site/uta/conformance/vectors/$f" -o "vectors/$f"; done
for v in $(curl -s https://www.marketnow.site/uta/conformance/vectors/_index.json |
           python3 -c "import json,sys; [print(x['original_vector_file'], x['canonical_text_file']) for x in json.load(sys.stdin)['vectors']]"); do
  curl -sL "https://www.marketnow.site/uta/conformance/vectors/$v" -o "vectors/$v"; done
for f in runner-tests.mjs answer-key.json mutants.json; do
  curl -sL "https://www.marketnow.site/uta/conformance/runner-tests/$f" -o "runner-tests/$f"; done
node runner-tests/runner-tests.mjs
```

## The mutants

Each mutant is a deterministic byte patch of the pristine runner (occurrence
counts are fail-closed-checked, so the patch cannot silently miss):

| id | bug injected | caught at |
|---|---|---|
| stage-blind | scoring ignores stage mismatches | matrix |
| memorizer-promote | the memorizer cheat grades itself honest | matrix |
| score-inflate | every score +1 | matrix + reference |
| anchor-narrow | pinned anchors shrink to ca-test-1 | matrix + reference |
| expiry-blind | reference stops checking expiry | matrix + reference |
| status-blind | reference stops checking status | matrix + reference |
| sig-accept-all | reference accepts every signature | matrix + reference |
| translation-flip | unsigned cards get rejected | matrix + reference |
| stage-liar-cured | the built-in liar starts telling the truth | matrix |
| over-rejector-cured | the built-in over-rejector gets cured | matrix |

The last two mutate the *demonstrator* rows: the published separation matrix is
the runner's observable contract, and the key pins all of it — not just the
reference row. Since v1.3.3 four mutants carry updated occurrence counts
(anchor-narrow 4, expiry-blind 5, status-blind 5, sig-accept-all 5) because the
derived-expectation code paths in `loadGenerated` added live targets — the
mutants now also corrupt the oracle's own derivation, and are still caught.

## Fail-closed by design

The key carries `as_of` / `valid_until` (`2027-08-19`). The window scan now
tracks **both** verdict-flip dates: the earliest future `expires_at` (a true
verdict flips to false) and the earliest future `issued_at` (a premature
verdict flips to true — `premature-atc` becomes valid `2030-01-01`, which is
why the key expires with the earlier event). After `valid_until` the suite
**fails closed** with an explanation: vectors must be re-issued, the key
re-recorded, and the successor key re-anchored as a new Rekor entry. It never
silently passes on stale expectations.

## Record mode

`node runner-tests.mjs --record` regenerates the key from the runner's live
behavior. It refuses to publish a key with un-caught mutants, and by policy a
new key requires a new Rekor entry (throwaway P-256 countersignature, private
key discarded — same policy as ca-test-1). The current key is anchored in Rekor
entry #3; see `tests/anchors/` (`anchor-record-v3.json`) and
`node ../anchors/verify-rekor.mjs --record ../anchors/anchor-record-v3.json --statement ../anchors/anchor-statement-v3.json`.
