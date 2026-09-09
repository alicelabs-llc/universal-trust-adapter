# The runner is the tested thing (conformance suite v1.3.2)

Until v1.3.2 the reference scorer (`../score-runner.mjs`) was **our** code: a
stranger could run it, but had to *trust* it — the same asymmetry this thread
has been killing since the first vector. This suite closes that gap by turning
the runner from a trusted component into a **tested component**:

| Oracle | What it pins | Where it lives |
|---|---|---|
| **Bytes** | `sha256(score-runner.mjs)` — the exact runner bytes | `answer-key.json`, anchored in [Rekor entry #2](https://rekor.sigstore.dev) |
| **Behavior** | the 8-runner separation matrix + the reference-mode verdict, row by row, failure lists included | `answer-key.json` (recorded `2026-09-09`, valid through `2027-08-19`) |
| **Teeth** | 10 known-bad runner variants — each must DIVERGE from the key | `mutants.json` (deterministic byte patches, digests pinned in the key) |

A key that nothing can fail is not a test. Every mutant here is caught — if you
rebuild any of them from `mutants.json` and run the suite, it flags it.

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
reference row.

## Fail-closed by design

The key carries `as_of` / `valid_until` (`2027-08-19`, the day before the
earliest future vector expiry). After that date the suite **fails closed** with
an explanation: vectors must be re-issued, the key re-recorded, and the
successor key re-anchored as a new Rekor entry. It never silently passes on
stale expectations.

## Record mode

`node runner-tests.mjs --record` regenerates the key from the runner's live
behavior. It refuses to publish a key with un-caught mutants, and by policy a
new key requires a new Rekor entry (throwaway P-256 countersignature, private
key discarded — same policy as ca-test-1). The current key is anchored in Rekor
entry #2; see `tests/anchors/` (`anchor-record-v2.json`) and
`node ../anchors/verify-rekor.mjs --record ../anchors/anchor-record-v2.json --statement ../anchors/anchor-statement-v2.json`.
