# 🟢 AliceLabs Public Status — All Channels Verified

**Last verified:** 2026-08-25  
**Status:** All public download channels are operational.

## The 5 Anti-Ban Download Channels

We built 5 independent download channels so no single platform outage
or account flag can block access to the code.

### For each package, the following 5 channels are tested daily:

| # | Channel | Why it exists | URL pattern |
|---|---------|---------------|-------------|
| 1 | **NPM Registry** | Primary, independent of GitHub | `registry.npmjs.org/{pkg}/-/{name}-{ver}.tgz` |
| 2 | **jsDelivr CDN** | Free global CDN, mirrors NPM automatically | `cdn.jsdelivr.net/npm/{pkg}@{ver}/` |
| 3 | **unpkg CDN** | Alternative CDN, also mirrors NPM | `unpkg.com/{pkg}@{ver}/` |
| 4 | **marketnow.site direct** | AliceLabs-owned server, fully independent | `marketnow.site/uta-packages/{file}.tgz` |
| 5 | **GitHub raw** | Public GitHub repo (alicelabs-llc org) | `raw.githubusercontent.com/alicelabs-llc/...` |

If any one channel is blocked, the other 4 continue working.
If GitHub bans the org, NPM + jsDelivr + unpkg + marketnow.site continue.
If NPM is down, GitHub + marketnow.site continue.

## Canonical Repository

**URL:** https://github.com/alicelabs-llc/universal-trust-adapter

This repo is in the AliceLabs LLC GitHub organization, which is publicly
accessible to anonymous visitors. The old personal-account repos
(`edgarfloresguerra2011-a11y` and `eddyflores100-lang`) are either flagged
(limited visibility) or archived with a redirect notice.

## Package Verification Matrix

All packages verified working as of 2026-08-25:

| Package | Version | NPM | jsDelivr | unpkg | marketnow | GitHub |
|---------|---------|-----|----------|-------|-----------|--------|
| `marketnow-mcp` | 1.10.0 | ✅ | ✅ | ✅ | — | — |
| `agent-trust-card` | 1.1.1 | ✅ | ✅ | ✅ | — | — |
| `marketnow-install-stack` | 1.1.0 | ✅ | ✅ | ✅ | — | — |
| `@marketnow/uts` | 2.0.0 | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@marketnow/trust-core` | 1.0.0 | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@marketnow/trust-adapters` | 1.0.0 | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@marketnow/trust-gateway` | 1.0.0 | ✅ | ✅ | ✅ | ✅ | ✅ |

All tarballs on NPM and on `marketnow.site/uta-packages/` have **identical SHA-256**
hashes — they are byte-for-byte the same files.

## Critical Files (Test Vectors, Source, Conformance Runner)

All files below return HTTP 200 to anonymous visitors:

- [README.md](https://raw.githubusercontent.com/alicelabs-llc/universal-trust-adapter/main/README.md)
- [LICENSE-AL-1.0](https://raw.githubusercontent.com/alicelabs-llc/universal-trust-adapter/main/LICENSE-AL-1.0)
- [tests/test.mjs (conformance runner)](https://raw.githubusercontent.com/alicelabs-llc/universal-trust-adapter/main/tests/test.mjs)
- [packages/core/index.js](https://raw.githubusercontent.com/alicelabs-llc/universal-trust-adapter/main/uta-monorepo/dist/packages/core/index.js)
- [packages/core/crypto.js (JCS impl)](https://raw.githubusercontent.com/alicelabs-llc/universal-trust-adapter/main/uta-monorepo/dist/packages/core/crypto.js)
- [packages/core/verification-pipeline.js](https://raw.githubusercontent.com/alicelabs-llc/universal-trust-adapter/main/uta-monorepo/dist/packages/core/verification-pipeline.js)
- [test-vectors/_index.json (manifest)](https://raw.githubusercontent.com/alicelabs-llc/universal-trust-adapter/main/marketnow/docs/atc-spec/test-vectors/_index.json)
- [test-vectors/_test-ca-keys.json](https://raw.githubusercontent.com/alicelabs-llc/universal-trust-adapter/main/marketnow/docs/atc-spec/test-vectors/_test-ca-keys.json)
- [test-vectors/minimal-valid.json](https://raw.githubusercontent.com/alicelabs-llc/universal-trust-adapter/main/marketnow/docs/atc-spec/test-vectors/minimal-valid.json)
- [test-vectors/expired.json](https://raw.githubusercontent.com/alicelabs-llc/universal-trust-adapter/main/marketnow/docs/atc-spec/test-vectors/expired.json)
- [test-vectors/tampered-payload.json](https://raw.githubusercontent.com/alicelabs-llc/universal-trust-adapter/main/marketnow/docs/atc-spec/test-vectors/tampered-payload.json)
- [test-vectors/wrong-ca-key.json](https://raw.githubusercontent.com/alicelabs-llc/universal-trust-adapter/main/marketnow/docs/atc-spec/test-vectors/wrong-ca-key.json)
- [atc-sdk/src/issue.mjs](https://raw.githubusercontent.com/alicelabs-llc/universal-trust-adapter/main/marketnow/atc-sdk/src/issue.mjs)
- [atc-sdk/src/verify.mjs](https://raw.githubusercontent.com/alicelabs-llc/universal-trust-adapter/main/marketnow/atc-sdk/src/verify.mjs)
- [atc-sdk/test/conformance.mjs](https://raw.githubusercontent.com/alicelabs-llc/universal-trust-adapter/main/marketnow/atc-sdk/test/conformance.mjs)

## One-Line Multi-Source Installer

```bash
curl -fsSL https://marketnow.site/install.sh | bash
```

This installer tries all 5 channels in order and uses the first one that
works. If GitHub is down, it falls back to NPM. If NPM is down, it falls
back to jsDelivr. And so on.

## Resilience Manifest (machine-readable)

```bash
curl -s https://marketnow.site/resilience.json | jq .
```

Returns a JSON manifest with every package's download URLs across all 5 channels.

## What's Broken (and being addressed)

The personal GitHub account `@edgarfloresguerra2011-a11y` is currently flagged
by GitHub abuse-detection (ticket #4658791 open with GitHub Support). This
flag does NOT affect any of the 5 download channels above — it only affects
the personal-account repos. The canonical repo has been moved to the
`alicelabs-llc` org to work around this.

— AliceLabs LLC, 2026-08-25
