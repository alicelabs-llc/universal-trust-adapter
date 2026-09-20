# marketnow-audit

Free **security intelligence CLI** for the agent economy — zero dependencies, powered by the live [MarketNow](https://marketnow.site) endpoints.

```bash
npx -y marketnow-audit bit.ly
npx -y marketnow-audit --atc ATC-2026-1509360
npx -y marketnow-audit --kid mn-ca-002
npx -y marketnow-audit --catalog Security
```

## What it does

| Command | Live endpoint | Result |
|---|---|---|
| `marketnow-audit <domain>` | `/api/scam-check` | Decision (ALLOW/CAUTION/DENY), risk score 0–100, triggered checks, honest disclaimers |
| `marketnow-audit --atc <card_id>` | `/api/atc?action=verify` + `/api/ocsp` | Full cryptographic ATC verification (Ed25519 signature, RFC 8785 JCS canonical hash, expiry) + revocation status |
| `marketnow-audit --kid <kid>` | `/api/ocsp?kid=` | MNR-OCSP-1.0 status for CA keys (e.g. `mn-ca-002` → KEY_COMPROMISE/DENY) |
| `marketnow-audit --catalog [cat]` | `/api/skills` | Catalog skills with Sentinel scores and risk levels (9,000+ skills) |

## Exit codes (CI / agent pipelines)

- `0` — PERMIT / verified / ALLOW
- `2` — CAUTION / UNKNOWN (fail-closed: needs review)
- `1` — DENY / revoked / failed verification

```bash
npx -y marketnow-audit suspicious-site.xyz || echo "blocked!"
```

## Example

```
$ npx -y marketnow-audit --atc ATC-2026-1509360

Verified:      true (over served_bytes)
Signature:     valid (Ed25519)
Hash:          valid
CA key:        mn-ca-003
Canonicalization: RFC 8785 JCS
Expires:       2026-10-26T23:31:49.360Z

OCSP status:   VALID (MNR-OCSP-1.0)
Recommendation: PERMIT
```

## Trust model

The scam-check engine states its limits honestly: heuristics + live RDAP registry age and TLS certificate checks — no commercial threat feeds, so a brand-new scam returns UNKNOWN (fail-closed), never TRUSTED. First-party domains (marketnow.site, alicelabs.site) are vouched by the operator and labeled as such.

## License

Dual-licensed under **MIT OR Apache-2.0, at your option** — free for any use, including
commercial use. This repo and all MarketNow npm packages (marketnow-mcp v1.14.0+,
agent-trust-card v1.4.0+, @marketnow/*) ship dual-licensed: see
[LICENSE-MIT](LICENSE-MIT) and [LICENSE-APACHE](LICENSE-APACHE).
Trademarks ("MarketNow", "UTA", "ATC") are reserved by AliceLabs LLC — see [NOTICE](NOTICE).
