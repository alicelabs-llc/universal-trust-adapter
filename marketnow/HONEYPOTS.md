# MarketNow — Honeypot Documentation

This document lists all **intentionally fake credentials** placed in the codebase
as honeypots for the Sentinel WAF/Honeypot security layer. These are NOT real
secrets — they are decoys designed to attract and detect attackers.

## Why honeypots exist

The Sentinel security layer includes a honeypot system that:
1. Logs access attempts to fake sensitive paths (/.env, /.git/config, /admin, etc.)
2. Auto-bans IPs that touch these paths for 24 hours
3. Tracks attack patterns for threat intelligence

## Files containing honeypots

### `aep-marketplace/api/security.js`
- Contains fake AWS access keys (`AKIA...2026`) — used by the honeypot
  response handler to simulate a "vulnerable" endpoint
- Contains fake GitHub PATs (`ghp_...XXXX`) — used to test if attackers
  try to use them
- These are NEVER loaded as env vars — they are string literals in the
  honeypot response body only

### `aep-marketplace/lib/honeypot.mjs`
- Contains the same fake credentials as security.js
- Used by the honeypot middleware to return fake sensitive data
- The "leaked" credentials are 100% non-functional

### `aep-marketplace/public/api/skills-lite.json`
- Some skill descriptions contain fake API keys in their text (from the
  original repos being catalogued)
- These are part of the skill metadata, not MarketNow credentials

## .gitleaksignore

The `.gitleaksignore` file should list the SHA-256 hashes of all known
honeypot findings so that Gitleaks does not report them as real secrets.
This reduces noise from 670 findings to ~0 real findings.

## Real secrets (NOT in the repo)

All real secrets are stored as Vercel environment variables:
- `MARKETNOW_ATC_CA_PRIVATE_KEY` — Ed25519 CA private key
- `MANDATES_GITHUB_TOKEN` — GitHub PAT for repo access
- `SENTINEL_CERT_SECRET` — Legacy HMAC secret (being deprecated)
- `STRIPE_SECRET_KEY` — Stripe API key
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- `MANDATES_INTERNAL_SECRET` — Internal API auth

These are NEVER committed to the repo.
