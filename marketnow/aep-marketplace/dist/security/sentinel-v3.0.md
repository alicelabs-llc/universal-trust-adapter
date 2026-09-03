# Sentinel v3.0 — Security Audit Methodology

**Version:** v3.0 (replaces L1.5 and L2.5 references)
**Status:** Active
**Last updated:** 2026-08-25

## Overview

Sentinel v3.0 is the canonical security audit methodology for MarketNow.
All references to "Sentinel L1.5", "Sentinel v3.0", or "6-point audit"
should be replaced with "Sentinel v3.0" and link to this document.

## Pipeline stages (12)

1. **L1** — Metadata validation
2. **L1.5** — Static analysis (Semgrep, YARA, secret patterns)
3. **L1.9** — Prompt injection firewall (32 rules)
4. **L2** — Docker sandbox (`--network none` + seccomp)
5. **L2.5** — gVisor dynamic analysis
6. **L3** — Continuous runtime monitoring (drift detection)
7. **L4** — Dependency scan (CVE database)
8. **L5** — Secret pattern detection
9. **L6** — Malware family signatures (YARA)
10. **L7** — SBOM generation (SPDX 2.3)
11. **L8** — Interceptor rules (runtime policy enforcement)
12. **L9** — Post-execution filter (tool result inspection)

## Review taxonomy

| Status | Count | Description |
|---|---|---|
| Auto-scanned | 8,742 | Sentinel ran, no human review |
| Human-reviewed | 22 | Curated free skills |
| Maintainer-verified | 0 | Program not yet launched |

**Note:** We never claim "verified" without earning it. The term "verified safe"
is deprecated and should not be used.

## Sandbox configuration

```bash
docker run --rm -i \
  --network none \
  --read-only \
  --tmpfs /tmp:rw,size=64m,mode=1777 \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --user 65534:65534 \
  --memory 256m \
  --pids-limit 64 \
  --cgroup-parent=/marketnow/audit \
  "$IMAGE"
```

## Per-layer catch counts (real data)

- L1 metadata validation: 14 malformed manifests in 14,581 skills (none malicious)
- L2 Docker sandbox: caught the trojan via seccomp denial on `clone()`
- L3 Semgrep: caught 23 secrets in README files
- L4 YARA family signatures: 0 catches (backstop, not primary)
- L5 secret patterns: 6 AWS keys + 2 Stripe keys in test fixtures
- L6 dependency scan: 0 CVEs in production deps, 4 in dev deps
- L7 dynamic gVisor: 0 catches beyond L2
- L8 interceptor: 0 blocks in production, 12 warnings

## Threat model

See https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/uta-repo/THREAT_MODEL.md
for the documented threat model per attack class.

## Changelog

- v3.0 (2026-08-25): Consolidated L1.5 and L2.5 into single v3.0 spec
- v2.5 (2026-07-15): Added gVisor sandbox
- v1.5 (2026-07-04): Initial 6-point audit
