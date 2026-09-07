# Multichannel Evidence Harness — response to CodePass.dev

Article: https://code-pass.dev/blog/mcp-interceptor-block-dangerous-commands
(Demands: JSONL deny logs — not screenshots — and multichannel tests across
`read_file(".env.local")`, shell `cat .env*`, MCP filesystem tool, symlink case.)

## Run it (Node >= 18, no build step)

```bash
mkdir codepass-check && cd codepass-check
npm init -y
npm i @marketnow/trust-core @marketnow/trust-adapters @marketnow/trust-gateway
curl -O https://raw.githubusercontent.com/alicelabs-llc/universal-trust-adapter/main/evidence/codepass-multichannel/marketnow_multichannel_test.mjs
node marketnow_multichannel_test.mjs --out deny_logs.jsonl
node marketnow_multichannel_test.mjs --verify deny_logs.jsonl
```

- Channel A: stdio (Claude Desktop / Cursor local-MCP transport shape)
- Channel B: Streamable-HTTP (localhost /mcp)
- Channel C: production https://www.marketnow.site/api/mcp (live; reproducible with curl)

Note: published tarballs @marketnow/trust-gateway@<=1.0.1 and
@marketnow/trust-adapters@1.0.0 contain broken monorepo-internal requires
(`../core/*` → require() crashes). The harness patches those paths at boot
(idempotent, printed to stderr) until v1.0.2/1.0.1 are on npm.

## Result (2026-09-08)

25 PASS / 0 FAIL / 2 KNOWN-GAP — the known gap is the symlink bypass the
CodePass article predicted: `read_file("config/link")` where `config/link`
points to `.env` is ALLOWed by the literal v1.0.x matcher. The harness proves
the leak (leak_proof field) instead of hiding it. Fix roadmap: v1.1 matcher
resolves real paths (fs.realpathSync + workspace symlink policy).

Every decision line is a signed Ed25519 action receipt (args_hash JCS/RFC 8785,
evidence_hash, domain-separated signature). `--verify` re-checks every
signature and hash chain. Reference run: deny_logs_2026-09-08.jsonl.

## Bugs this harness found in our own production (fixed same day)

1. `marketnow_check_domain` MCP tool called `/api/trust?action=scam-check`
   (returns service info) instead of `/api/scam-check` — commit daadd518.
2. `/api/trust` verifyATCv3 verified structure only (no Ed25519 signature
   check): a tampered ATC from an unknown CA returned valid=true, violating
   UNKNOWN = DENY. Real verification + trust-anchor semantics deployed in
   commit ddbac8ff.

License: product code AliceLabs AL-1.0; harness dedicated to the public domain
of reproducible security claims.
