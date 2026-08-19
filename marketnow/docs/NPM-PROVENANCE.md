# npm Package Provenance (Sigstore)

## Status: Pending (Q3 2026)

## What

Sign the `marketnow-mcp` npm package with Sigstore/cosign so users can verify the package was built from our GitHub source code.

## How

Add to `.github/workflows/npm-publish.yml`:

```yaml
permissions:
  id-token: write  # Required for npm provenance

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

The `--provenance` flag tells npm to generate a Sigstore-signed attestation
that links the published package to the specific GitHub commit that built it.

## Verification

Users can verify provenance with:
```bash
npm audit signatures
npm view marketnow-mcp dist.attestations
```

## Why

Without provenance, a compromised npm token could publish a malicious
version of `marketnow-mcp`. With provenance, users can verify that the
package was built from our GitHub source — not injected by an attacker.

## Blockers

- Need to add `id-token: write` permission to the npm-publish workflow
- Need to update the workflow to use `--provenance` flag
- Need npm CLI v9.5+ (already available in Node 20)
