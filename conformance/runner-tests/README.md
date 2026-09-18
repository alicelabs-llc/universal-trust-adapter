# The runner is the tested thing (conformance suite v1.5.0)

Until v1.3.2 the reference scorer (`../score-runner.mjs`) was **our** code: a
stranger could run it, but had to *trust* it — the same asymmetry this thread
has been killing since the first vector. This suite closes that gap by turning
the runner from a trusted component into a **tested component**:

| Oracle | What it pins | Where it lives |
|---|---|---|
| **Bytes** | `sha256(score-runner.mjs)` — the exact runner bytes | `answer-key.json`, anchored in [Rekor](https://rekor.sigstore.dev) (entry #6 for v1.5.0); `--rekor` re-roots the digest chain at the live entry before any local check |
| **Behavior** | FIVE surfaces: the 8-runner separation matrix (scored over the generated challenge too), the reference-mode verdict, the seeded adversarial challenge, and two fail-closed probes | `answer-key.json` (recorded `2026-09-10`, valid through `2027-08-19`) |
| **Teeth** | 10 known-bad runner variants — each must DIVERGE on at least one surface | `mutants.json` (deterministic byte patches, digests pinned in the key) |
| **Measurement** | the GENERATED mutation sweep: 12 declared operators at every code site — 113 mutants, 92 caught, 21 survivors published and classified | `generate-mutants.mjs` + `mutant-sweep.json` |

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
for f in runner-tests.mjs answer-key.json mutants.json generate-mutants.mjs mutant-sweep.json; do
  curl -sL "https://www.marketnow.site/uta/conformance/runner-tests/$f" -o "runner-tests/$f"; done
mkdir -p ../anchors
for f in anchor-statement-v5.json anchor-record-v5.json verify-artifact.mjs; do
  curl -sL "https://www.marketnow.site/uta/conformance/anchors/$f" -o "../anchors/$f"; done
node runner-tests/runner-tests.mjs            # offline: 27 checks, 0 expected failures
node runner-tests/runner-tests.mjs --rekor    # + the digest chain re-rooted at the LIVE Rekor entry
node runner-tests/generate-mutants.mjs --check # the published sweep reproduces
```

Or verify any single artifact's bytes against the log, in-loop, from any origin:

```bash
curl -sLO https://www.marketnow.site/uta/conformance/score-runner.mjs
curl -sLO https://www.marketnow.site/uta/conformance/anchors/{anchor-statement-v5.json,anchor-record-v5.json,verify-artifact.mjs}
node verify-artifact.mjs score-runner.mjs   # digest fetched from the Rekor entry, not the hub
```

## v1.4.0 — the three things anp2network's round-3 comment asked for

> "The next gap is the lower bound… the bound is tested by a distribution
> instead of a fixture… generating the mutants instead of listing them…
> Fetch the digest from the Rekor entry directly, verify inclusion, then
> compare against the sha256 of the file just downloaded."
> — @anp2network, dev.to comment 3ehcp

1. **Adversarial distribution.** `generate-accept-vectors.mjs --mode
   adversarial` emits correctly-signed ca-test-2 cards probing **both** bounds
   of the validity window relative to the scoring clock: future-dated cards
   (`expected_verify:false`) interleaved with at/inside-boundary cards (the
   over-rejection probe). The head cards are deterministic — `issued+1s`,
   `issued−1s`, `issued==NOW`, `expires==NOW`, `expires+1s`, `expires−1s` —
   and the suite pins a seeded 24-card challenge as answer-key surface 3. The
   boundary-exact cards exist because the *first* sweep run showed their
   absence was a real blind spot (`<=` vs `<` and `>` vs `>=` were
   indistinguishable to the suite); they killed the le-narrow/gt-widen window
   survivors.
2. **Generated mutants.** `generate-mutants.mjs` applies a declared
   12-operator set (eq/neq flips, and/or, not-drop, true/false, lt/gt/le/ge
   narrowing and widening, int-bump) at **every** code site of
   `score-runner.mjs` — a lexer excludes comments, strings, templates and
   regexes, so operators only land on executable syntax. Result: 114 sites,
   113 valid mutants, **92 caught, 21 survivors** — published in
   `mutant-sweep.json` with equivalents separated out (5 equivalent, 2
   equivalent-under-oracle, 3 equivalent-by-masking, **11 real named blind
   spots**: unprobed fail-closed disjuncts, unpinned exit codes of
   never-taken FATAL paths, verdict aggregation only observable on a failing
   runner, and the parser normalizing away the failure-list ellipsis). Run
   `node generate-mutants.mjs --check` — the published results reproduce.
   Closing the cheap survivors also **grew the oracle**: the answer key pins
   five surfaces now (the matrix is scored over the generated challenge, and
   the malformed-card + poisoned-sidecar probes pin the fail-closed
   behavior).
3. **Rekor in the loop.** `node runner-tests.mjs --rekor` fetches entry #5
   live, verifies Rekor's signatures (signedEntryTimestamp, inclusion fold,
   checkpoint), authenticates the anchor statement against the entry's
   committed hash, verifies the throwaway countersignature, and only then
   compares the local `answer-key.json` / `score-runner.mjs` bytes against the
   Rekor-rooted pins. For arbitrary artifacts:
   `node ../anchors/verify-artifact.mjs <url-or-path>`. The digest never
   comes from the hub — the hub serves bytes, Rekor vouches.

**Honest admission.** Between 2026-09-10 and this release the repo's answer
key had drifted: the `2dbaa429` doc-nit changed the runner's bytes without
re-recording, so the suite's own bytes oracle flagged **fail-closed** on a
fresh checkout (behavior was intact; the byte pin was not). That is exactly
the drift class the round-3 critique targets. v1.4.0 re-records the key and
re-anchors it as entry #5; the site serves the coherent v1.3.3 build until
this deploy lands.

## The mutants

Each mutant is a deterministic byte patch of the pristine runner (occurrence
counts are fail-closed-checked, so the patch cannot silently miss):

| id | bug injected | caught at |
|---|---|---|
| stage-blind | scoring ignores stage mismatches | matrix |
| memorizer-promote | the memorizer cheat grades itself honest | matrix |
| score-inflate | every score +1 | matrix + reference + adversarial |
| anchor-narrow | pinned anchors shrink to ca-test-1 | matrix + reference + adversarial |
| expiry-blind | reference stops checking expiry | matrix + reference + adversarial |
| status-blind | reference stops checking status | matrix + reference + adversarial |
| sig-accept-all | reference accepts every signature | matrix + reference + adversarial |
| translation-flip | unsigned cards get rejected | matrix + reference + adversarial |
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
behavior across all five surfaces. It refuses to publish a key with un-caught
mutants, and by policy a new key requires a new Rekor entry (throwaway P-256
countersignature, private key discarded — same policy as ca-test-1). The
current key is anchored in Rekor entry #5; see `tests/anchors/`
(`anchor-record-v5.json`) and
`node ../anchors/verify-rekor.mjs --record ../anchors/anchor-record-v5.json --statement ../anchors/anchor-statement-v5.json`,
or put the log in the actual verification path:
`node runner-tests.mjs --rekor`.

## v1.5.0 — round 4: a separate column, and the fixture clock

> "A cheap probe: add a small family of coordinated two-site mutations around one shared invariant, score them in a separate column, and leave the existing number untouched so it stays comparable across releases."

**Two-site coordinated sweep** (`generate-mutants-twosite.mjs` → `mutant-sweep-twosite.json`): pairs of same-operator edits inside one DECLARED invariant family (two-sided window / pinned anchors / signature verify / fail-closed aborts), applied together — the fault class single-site sweeps cannot express: a corruption that moves the check AND the derived-truth oracle coherently. Result on the v1.5.0 runner: **157 coordinated pairs, 156 caught, 1 survivor** — and the survivor names a real gap: the fail-closed guard is only probed with the whole metadata block missing, never with a single field missing. The single-site number is a time series now, not a frozen count: v1.4.0 bytes → 92/113 (archived in `mutant-sweep-v140.json`); v1.5.0 bytes (adds the two-clock plumbing) → **95/126** with 31 survivors, each classified. The two columns are never summed.

**Fixture clock**: the answer key and sweeps score the fixed suite against `evaluation_clock` from `_index.json` (`2026-09-11T00:00:00Z`) — premature-atc does not decay, the suite's verdicts are time-invariant, and same-day determinism is preserved for the generated half.

**Release chain (rollback resistance)**: `../releases/` carries a persistent Ed25519 release identity (public half anchored in Rekor entry #6 — the first key in the project that is neither a throwaway nor published, precisely so counters cannot be forged) and signed monotone release statements binding the current artifact digests. `../anchors/verify-artifact.mjs --release` keeps local highest-accepted state and refuses lower counters (rollback), same-counter conflicts (fork), and below-floor anchors (history restart). See `releases/README.md`.
