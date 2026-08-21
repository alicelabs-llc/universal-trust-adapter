# UTA v1.0.0 Release Checklist

## Pre-release

- [x] All 462+ tests passing (npm test)
- [x] All 16 Python SDK tests passing (pytest)
- [x] TypeScript compiles with zero errors (tsc --noEmit)
- [x] No stubs, TODOs, or FIXMEs in production code
- [x] SBOMs generated for all packages (npm run build)
- [x] TypeDoc documentation generated (npm run docs)
- [x] Benchmarks up to date (npm run bench)
- [x] CHANGELOG.md updated with all P0-P10 changes
- [x] CONTRIBUTING.md complete
- [x] SECURITY.md complete
- [x] COMPLIANCE.md complete (SOC2 + ISO 27001 + NIST CSF)
- [x] THREAT_MODEL.md updated with all mitigations

## Package release

- [ ] npm publish --provenance for each package:
  - [ ] @marketnow/trust-core
  - [ ] @marketnow/trust-adapters
  - [ ] @marketnow/trust-gateway
  - [ ] @marketnow/trust-persistence
  - [ ] @marketnow/trust-server
  - [ ] @marketnow/trust-mcp-middleware
  - [ ] @marketnow/trust-rpc
  - [ ] @marketnow/trust-realtime
  - [ ] @marketnow/trust-webhooks
  - [ ] @marketnow/trust-audit
  - [ ] @marketnow/trust-pq
  - [ ] @marketnow/trust-rate-limit
  - [ ] @marketnow/trust-observability
  - [ ] @marketnow/trust-multi-tenant
  - [ ] @marketnow/trust-key-rotation
  - [ ] @marketnow/trust-cache
  - [ ] @marketnow/trust-browser
  - [ ] @marketnow/trust-dashboard
  - [ ] @marketnow/uta-verify (CLI)

## PyPI

- [ ] pip install uta-python (from packages/uta-python/)

## Docker

- [ ] docker build -t uta-trust-server:1.0.0 .
- [ ] docker-compose up (verify 3 services start)
- [ ] docker push to registry

## Kubernetes

- [ ] helm lint deploy/helm/uta-trust-server
- [ ] helm install uta deploy/helm/uta-trust-server (verify deployment)

## CI/CD

- [ ] GitHub Actions: release.yml triggers on tag v1.0.0
- [ ] SLSA provenance generated
- [ ] Sigstore signature generated
- [ ] GitHub Release created with artifacts

## Documentation

- [ ] GitHub Pages (TypeDoc) deployed
- [ ] README.md finalized
- [ ] Integration guides (INTEGRATION.md) reviewed
- [ ] Example apps tested

## Post-release

- [ ] Tag git: git tag v1.0.0
- [ ] Push tag: git push origin v1.0.0
- [ ] Announce on social media
- [ ] Submit to awesome-mcp list
- [ ] Create GitHub Discussion for Q&A
