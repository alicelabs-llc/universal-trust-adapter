# @marketnow/uta-verify

Command-line credential verifier for the agent-trust ecosystem: **ATC v3, JWT, W3C Verifiable Credentials, A2A Agent Cards, EAT, ZTA, and MCP registry cards — one binary, zero dependencies.**

Verifies signatures (Ed25519), expiry, and structure, with exit codes designed for CI pipelines.

## Install

```bash
npm install -g @marketnow/uta-verify
# or run it once:
npx @marketnow/uta-verify <credential.json> --ca-key <ca.pem>
```

## Usage

```
uta-verify <credential.json> --ca-key <ca.pem>
uta-verify --jwt <token> --ca-key <ca.pem>
uta-verify --atc-v3 <cred.json> --ca-key <ca.pem>
uta-verify --vc <vc.json> --ca-key <ca.pem>
uta-verify --a2a <card.json> --ca-key <ca.pem>
uta-verify --eat <token.json> --ca-key <ca.pem>
uta-verify --zta <card.json> --ca-key <ca.pem>
uta-verify --mcp <card.json> --registry-key <registry.pem>
```

Format is auto-detected from the credential's structure when no flag is given.

## Options

| Option | Meaning |
|---|---|
| `--ca-key <path>` | CA public key (PEM) |
| `--registry-key <path>` | MCP registry public key (PEM) |
| `--json` | Machine-readable output |
| `--verbose, -v` | Show all verification stages |
| `--allow-expired` | Don't fail on expiry |

## Exit codes (CI-ready)

| Code | Meaning |
|---|---|
| `0` | credential **valid** |
| `1` | credential **invalid** (signature / expiry / revocation / structure) |
| `2` | usage / I/O error |

Example — gate a deploy on a credential check:

```bash
npx @marketnow/uta-verify agent-credential.json --ca-key ca.pem || exit 1
```

UTA conformance test vectors (including the file's `input` field) are unwrapped automatically, so the CLI can verify the published vectors directly.

Zero runtime dependencies. Node >= 18.

Part of the MarketNow trust stack — see the [universal-trust-adapter repo](https://github.com/alicelabs-llc/universal-trust-adapter) and [marketnow.site](https://www.marketnow.site).

## License

Dual-licensed under **MIT OR Apache-2.0, at your option** — free for any use, including
commercial use. This repo and all MarketNow npm packages (marketnow-mcp v1.14.0+,
agent-trust-card v1.4.0+, @marketnow/*) ship dual-licensed: see
[LICENSE-MIT](LICENSE-MIT) and [LICENSE-APACHE](LICENSE-APACHE).
Trademarks ("MarketNow", "UTA", "ATC") are reserved by AliceLabs LLC — see [NOTICE](NOTICE).
