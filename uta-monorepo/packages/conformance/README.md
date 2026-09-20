# @marketnow/uta-conformance

**Conformance suite for agent-trust runners: 14 signed test vectors + reference scorer + card generator.**

Does your agent runtime actually *verify* Agent Trust Cards, or does it just pattern-match?
This suite separates real verifiers from three kinds of fake ones:

| Runner type | Booleans | Stage scoring | This suite |
|---|---|---|---|
| **Memorizer** (hash-matching, no crypto) | 11/14 | 0/N generated cards | ❌ caught |
| **Over-rejector** (denies everything) | 12/14 | 0/N | ❌ caught |
| **Stage-liar** (right verdict, wrong reason) | 14/14 | 7/14 | ❌ caught |
| **Reference verifier** | 14/14 | 14/14 + N/N | ✅ passes |

Vector v1.3.3 fixes the two-sided validity window (`issued_at <= NOW < expires_at`),
derives generated-card ground truth from the card bytes + pinned anchors (never from
defaults), and scores **per-stage outcomes**: a runner that fires the wrong failure stage
is wrong, not "healthy with a note".

## Install & run

```bash
npx @marketnow/uta-conformance          # run the reference scorer vs the 14 vectors
npx @marketnow/uta-conformance --matrix # print the cheat-runner separation matrix
```

Or as a library:

```js
import { readFileSync } from 'node:fs';
// The vectors are plain files: JSON card + .sha256 sidecar + pinned CA keys.
// Format spec: vectors/_index.json (v1.3.3) — 14 vectors, 3 pinned anchors, scoring rules.
```

Score **your** runner (implement the same CLI contract as `score-runner.mjs`):

```bash
node your-runner.mjs          # prints one line per vector: <vectorId> <true|false> [stage:...]
                              # compare with expected_verify / expected_stages in _index.json
```

## Generate unlimited acceptance cards

```bash
node vectors/generate-accept-vectors.mjs --count 50 --out /tmp/gen
npx @marketnow/uta-conformance --generated /tmp/gen
```

Cards are signed by the published test CA (`vectors/_test-ca-keys.json`, pinned as an
additional anchor) with random content + `x_gen_*` extension fields — a memorizer that
hardcoded the 14 fixed cards scores 0/50.

## What's in `vectors/`

- 14 fixed vectors: valid ATC (2), premature, expired, revoked, self-signed,
  wrong-CA, invalid-signature, valid A2A, ATC↔UTS↔ZTA translations, unknown-field, …
- Pinned trust anchors: `ca-test-1`, `ca-test-2`, `ca-wrong-1` (raw32 + SPKI, b64 + hex)
- `.sha256` sidecars for every vector + `.bytes.base64/.hex` + canonical JCS text
- Test CA keys (private keys **published on purpose** — they only sign test cards)
- `README.md` inside `vectors/` documents every vector and the expected outcome

## Verify the suite itself (stranger test)

```bash
curl -s https://www.marketnow.site/uta/conformance/vectors/_index.json | jq .schema_version
# → "1.3.3" — same vectors, served live
```

Rekor anchors for the vector releases are verifiable at
`https://www.marketnow.site/uta/anchors/` (4 entries, log indexes included).

## Provenance

Part of the [Universal Trust Adapter](https://github.com/alicelabs-llc/universal-trust-adapter).
The v1.3.x series was hardened against a public adversarial review
([dev.to thread](https://dev.to/edison_flores_6d2cd381b13/)) — every gap found is now a
vector in this suite.

Sister packages: `marketnow-mcp` (MCP server with 15 trust tools),
`@marketnow/trust-gateway`, `@marketnow/trust-adapters`, `@marketnow/trust-core`.

## License

Dual-licensed under **MIT OR Apache-2.0, at your option** — free for any use, including
commercial use. This repo and all MarketNow npm packages (marketnow-mcp v1.14.0+,
agent-trust-card v1.4.0+, @marketnow/*) ship dual-licensed: see
[LICENSE-MIT](LICENSE-MIT) and [LICENSE-APACHE](LICENSE-APACHE).
Trademarks ("MarketNow", "UTA", "ATC") are reserved by AliceLabs LLC — see [NOTICE](NOTICE).
