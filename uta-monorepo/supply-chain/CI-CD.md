# BLOQUE L: CI/CD — SLSA + Sigstore + SBOM

## GitHub Actions Workflow

This file should be placed at `.github/workflows/slsa.yml` in the repo.

```yaml
name: Build + SLSA Provenance + Sigstore

on:
  push:
    tags: ['v*']
  workflow_dispatch:

permissions:
  contents: read
  id-token: write
  packages: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - name: Install
        run: npm ci

      - name: Build
        run: npm run build

      - name: Test
        run: npm test

      - name: Generate SBOM
        uses: anchore/sbom-action@v0
        with:
          format: spdx-json
          output-file: sbom.spdx.json

      - name: SLSA Provenance
        uses: slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@v2.0.0

      - name: Sigstore Sign
        run: |
          cosign sign-blob --yes packages/core/dist/index.js \
            --bundle sigstore-bundle.json \
            --output-certificate sigstore-cert.pem \
            --output-signature sigstore.sig

      - name: Compute Artifact Binding
        run: |
          GIT_SHA=${{ github.sha }}
          NPM_SHA256=$(sha256sum packages/core/dist/index.js | cut -d' ' -f1)
          BINDING_HASH="sha256:$(echo -n "{\"git\":\"$GIT_SHA\",\"npm\":\"$NPM_SHA256\"}" | sha256sum | cut -d' ' -f1)"
          echo "GIT_SHA=$GIT_SHA" >> $GITHUB_ENV
          echo "NPM_SHA256=$NPM_SHA256" >> $GITHUB_ENV
          echo "BINDING_HASH=$BINDING_HASH" >> $GITHUB_ENV

      - name: Publish to npm
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: release-artifacts
          path: |
            sbom.spdx.json
            sigstore-bundle.json
            sigstore-cert.pem
            sigstore.sig
```

## SBOM (Software Bill of Materials)

Generated automatically by `anchore/sbom-action` in SPDX format.
Output: `sbom.spdx.json`

## SLSA Provenance

Generated automatically by `slsa-framework/slsa-github-generator`.
Build level: SLSA 3 (provenance of the build process).
Output: `*.slsa.json` artifact.

## Sigstore

Signs the built artifacts with a ephemeral keyless certificate.
The certificate is issued by Sigstore's Fulcio CA and the transparency log is recorded in Rekor.
Output: `sigstore-bundle.json` + `sigstore-cert.pem` + `sigstore.sig`

## Artifact Binding Chain

```
Git commit SHA (from GitHub Actions)
    ↓
npm package tarball SHA-256
    ↓
SLSA provenance (build attestation)
    ↓
Sigstore signature (signing attestation)
    ↓
ATC v3 credential (references all of the above)
    ↓
UTS provenance.artifact_binding.binding_hash
```

This chain ensures that the ATC credential is cryptographically bound to the exact source code, build, and package.
