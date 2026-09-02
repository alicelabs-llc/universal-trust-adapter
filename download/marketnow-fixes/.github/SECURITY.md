# Security Policy

## Supported Versions

We actively audit and patch the latest version of `marketnow-mcp` on npm.
Older versions receive security backports on a best-effort basis.

| Version | Supported | Status |
|---------|-----------|--------|
| 1.10.x  | ✅ Yes     | Active — current |
| 1.9.x   | ✅ Yes     | Patch backports |
| 1.8.x   | ⚠️ Best-effort | Critical fixes only |
| < 1.8.0 | ❌ No      | Upgrade required |

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

### Preferred: encrypted disclosure

1. Encrypt your report with our PGP public key (fingerprint below).
2. Send the encrypted report to **security@alicelabs.site**.
3. You will receive an acknowledgment within **48 hours**.
4. We will issue a fix or mitigation within **7 days** for Critical/High,
   **30 days** for Medium, **90 days** for Low.

### PGP key

```
Fingerprint:  [TBD — to be published at /security after audit F-SEC-1]
Algorithm:   Ed25519 (Curve25519)
Created:     2026-08-19
Expires:     2027-08-19
```

> The PGP key is scheduled to be published at https://marketnow.site/security
> as part of audit finding F-SEC-1. Until then, send plaintext reports to
> security@alicelabs.site over an encrypted transport (TLS).

### What to include in your report

- Affected version (e.g. `marketnow-mcp@1.10.0`)
- Affected component (MCP server, Sentinel pipeline, ATC verifier, runtime
  interceptor, mandate ledger, public API, web app)
- Step-by-step reproduction
- Proof of concept (if available)
- Impact assessment (who can be affected, how)
- Suggested mitigation (if you have one)

## Scope

### In scope

- The `marketnow-mcp` npm package and its 13 tools
- The Sentinel audit pipeline (L1.5–L2.5 active layers)
- The ATC/1.0 (Agent Trust Card) schema and verifier
- The runtime interceptor with 8 enforcement rules
- The mandate ledger and on-chain USDC verification flow on Base (chainId 8453)
- The public API at https://marketnow.site/api/*
- The web application at https://marketnow.site

### Out of scope

- Third-party MCP skills indexed in the catalog (report to their respective
  maintainers)
- Vulnerabilities in dependencies (report upstream; we'll upgrade once a fix
  is released)
- Self-hosted forks of MarketNow (we don't control them)
- Issues in the official MCP registry (modelcontextprotocol.io) — that's
  Anthropic's domain
- Social engineering attacks against AliceLabs LLC staff

## Threat Model

### Primary threats (per OWASP MCP Top 10)

1. **Prompt injection** — third-party skill descriptions attempting to
   override agent instructions. Mitigation: Sentinel L1.5 scans for known
   injection patterns; ATC verifier rejects cards with injected payloads.

2. **Tool poisoning** — skills that exfiltrate secrets or perform unintended
   actions. Mitigation: Sentinel L2 static analysis + L2.5 gVisor sandbox;
   runtime interceptor enforces 8 policy rules including `.env` read blocking.

3. **Credential exfiltration** — skills reading `~/.aws/credentials`,
   `~/.ssh/id_*`, `.env`, etc. Mitigation: runtime interceptor blocks these
   reads by default; opt-in only via explicit user consent.

4. **Supply-chain attacks** — malicious updates to dependencies. Mitigation:
   `npm audit` runs on every Sentinel scan; package-lock.json pinned.

5. **Stolen mandate** — attacker who steals a mandate ID and tries to use it.
   Mitigation: mandate IDs are bound to the wallet address that created them;
   on-chain verification rejects mismatches.

6. **Replay attacks** — replaying a valid txHash for a different purchase.
   Mitigation: each txHash is recorded in the public git-backed mandate ledger
   and rejected on second use.

### Roadmap items (not yet implemented)

- `notify_and_veto` mode (5-minute veto window) — documented but not yet
  implemented in the purchase flow
- Third-party Sentinel audit (L3–L10) — currently self-declared, third-party
  audit pending, target 2027
- Public bug bounty program — not yet launched

## Disclosure Timeline

We follow a **coordinated disclosure** model:

1. **Day 0** — you report the vulnerability.
2. **Day 2** — we acknowledge receipt and assign a CVE ID (if applicable).
3. **Day 7 (Critical/High) / Day 30 (Medium) / Day 90 (Low)** — we ship the
   fix and publish a security advisory on GitHub.
4. **Day 14 (Critical/High) / Day 37 (Medium) / Day 97 (Low)** — you may
   publicly disclose the vulnerability if we have not yet patched.

## Hall of Fame

We thank the following researchers for responsibly disclosing vulnerabilities
(listed with their permission, in chronological order):

- _(no reports yet — be the first)_

## Contact

| Role | Email | PGP |
|------|------|-----|
| Security team | security@alicelabs.site | [TBD at /security] |
| Legal (for legal threats) | legal@alicelabs.site | N/A |
| General | info@alicelabs.site | N/A |

## Audit History

| Date | Auditor | Findings | Report |
|------|---------|----------|--------|
| 2026-08-19 | Independent (Z.ai) | 8 findings (3 P0, 3 P1, 2 P2) | `REPORT.pdf` (in this repo) |

---

© 2025–2026 AliceLabs LLC. Security policy version 1.0.
