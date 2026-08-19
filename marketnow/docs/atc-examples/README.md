# ATC Verification Examples

Independent verification of Agent Trust Cards (ATC) in 3 languages.

No MarketNow SDK needed — each example uses only the standard library
(+ `requests` in Python, built-in `crypto` in Node.js, `crypto/ed25519`
in Go).

## Quick start

### Python
```bash
pip install requests cryptography
python verify-python.py
```

### JavaScript / Node.js
```bash
node verify-javascript.js ATC-2026-XXXXXXX
```

### Go
```bash
go run verify-go.go ATC-2026-XXXXXXX
```

## How it works

1. Fetch the CA public key from `GET /api/atc?action=ca-key`
2. Fetch the ATC record from GitHub (`_data/atc/{card_id}.json`)
3. Build canonical JSON: `JSON.stringify(payload, sorted_keys)`
4. Verify the Ed25519 signature with `crypto.verify()`
5. Check expiry + revocation status

The CA public key is committed to the repo at `_data/atc/ca-public-key.json`.
Pin it in your agent runtime. If it changes, the CA has been rotated.

## API

- Issue: `POST /api/atc {"action":"issue", "agent_id": "...", "public_key": "..."}`
- Verify: `GET /api/atc?action=verify&card_id=ATC-2026-XXXXXXX`
- Revoke: `POST /api/atc {"action":"revoke", "card_id": "...", "reason": "..."}`
- CA key: `GET /api/atc?action=ca-key`
- List all: `GET /api/atc`

## Links

- Live: https://marketnow.site/atc
- Spec: https://marketnow.site/atc-spec.json
- GitHub: https://github.com/alicelabs-llc/marketnow

## Timeline

- **2025**: AliceLabs LLC legally founded in Wyoming, USA (founder Edison Flores, Ecuadorian)
- **2026-03-30**: GitHub organization `github.com/alicelabs-llc` created
- **2026-06-29**: MarketNow launched publicly (first npm release: `marketnow-mcp@1.5.1`)
- **2026-08-09**: Current npm latest: `marketnow-mcp@1.10.0` (15 versions total)
- **2026-08-19**: Independent audit by Z.ai (8 findings F1-F8 applied, see REPORT.pdf)

