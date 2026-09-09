# MarketNow Roadmap — Security Infrastructure for AI Agents

## Vision

MarketNow is **the verification and enforcement layer for agentic systems**.

Sentinel is the engine. Trust Card is the identity. Interceptor is the enforcement. Trust API is the consumption layer.

The marketplace (9,248 skills) is distribution and dataset — not the product.

## How we build

MarketNow is developed in capability phases, and each phase has a hard gate before it
is listed here as available:

1. **Verified in production** — the feature answers on the live deployment
   (`marketnow.site`), exercised over HTTP the same way a stranger would.
2. **Verified from the registry** — published npm packages are installed from the
   public registry into a clean directory and exercised there (smoke suites, clean
   `require`/`import`, `npm audit` clean, CLI bins runnable).
3. **Honest status labels** — `Production` (live endpoint), `Library` (published npm
   module, runtime integration in progress), `Planned` (design work, nothing shipped).

Anything that does not pass its gate is not listed as available — regardless of how
far along the code is. Fail-closed applies to documentation too.

## Current state — verified capabilities

| Capability | Status | Evidence (reproducible) |
|---|---|---|
| Trust API | Production | `GET /api/trust` (formats / pipeline / revocation actions) |
| Agent Trust Card verification | Production | `GET /api/atc?action=verify&card_id=…` — verifies served bytes, JCS + Ed25519 |
| CA key disclosure | Production | `GET /api/atc?action=ca-key` |
| Revocation status (OCSP-style) | Production | `GET /api/ocsp?card_id=…` / `?kid=…` — KEY_COMPROMISE returns DENY |
| Signed revocation registry (CRL) | Production | `GET /api/crl` — MNR-CRL-1.0, Ed25519-signed, append-only |
| Scam / reputation checks | Production | `GET /api/scam-check?domain=…` — decision, risk score, reasons |
| Skills catalog | Production | `GET /api/skills?category=…` — 9,248 skills, category counts live |
| MCP server (streamable HTTP) | Production | `GET /api/mcp` — 8 tools, incl. check_revocation + fingerprint_tool |
| Public audit report | Production | `GET /api/audit-report.json` |
| npm packages | Production | 11 packages on the public registry, clean install, 0 vulnerabilities |
| Sentinel static rules | Production | 29 MCP security rules (npm `@marketnow/sentinel-rules`, `npx sentinel-scan`) |
| Rekor transparency anchors | Production | sigstore.dev logIndex 2762061972, 2764017355, 2764479676 |
| Agent Trust Cards issued | Production | Ed25519-signed cards; revocations seeded with real events (superseded ATCs, CA key compromise) |
| Reproducible build | Production | tar-layer sha256 519d406a… (agent-trust-card@1.1.2) |

**Retired / not in the current deployment** (listed for honesty, not advertised):
`/api/stacks` (replaced by the `marketnow-install-stack` CLI over the live catalog),
`/api/health`, `/api/trust-score`. Payment streaming (x402) and remote execution (A2A)
explorations are not part of the production deployment and are treated as future work
until they pass the gate.

## Capability phases

### Phase 1 — Foundation (complete)

The trust primitives the rest of the system is built on:

- Ed25519 signing / verification (RFC 8032) over JCS-canonicalized payloads (RFC 8785)
- Agent Trust Card (ATC) format, CA keys, ledger
- 12-stage verification pipeline (`verifyCredential` in `@marketnow/trust-core`)
- 9 credential formats via adapters (ATC, EAT, A2A card, W3C-VC, OAuth, SPIFFE, X.509, MCP, ZTA)

### Phase 2 — Verification (production)

Move from "scanner" to "verification engine":

- **Tool Fingerprinting (TFP-1.0)** — Production: `marketnow_fingerprint_tool` MCP tool;
  JCS+sha256 per tool, manifest fingerprint, drift reports (added/removed/changed).
  The Cline interceptor pins and verifies tool surfaces per server.
- **Revocation + transparency log (MNR-CRL-1.0)** — Production: signed append-only
  registry, live status resolution (`/api/ocsp`), CRL endpoint, `marketnow_check_revocation`.
  Fail-closed semantics throughout; unknown state never counts as valid.
- **Evidence-first findings** — Library: every finding carries severity, confidence %,
  evidence, location; risk score and confidence score are computed separately
  (`computeConfidence`, `summarizeFindings`).
- **Provenance (SLSA-style)** — Partial: Trust Card binds source repo, commit SHA,
  build hash, package hash. Full chain-of-custody automation is future work.

### Phase 3 — Behavior (library; runtime integration in progress)

Don't just scan code — verify runtime behavior.

- Behavioral baselines per tool version (`computeBaseline`, `hasEnoughObservations`)
- Drift detection: 7 signal classes, auto-escalation to critical
  (new egress hosts, credential env reads, process spawns, volume/latency anomalies)
- Network / filesystem / process behavior classification (read-only, write-capable,
  credential-accessing; flags cloud metadata, `.env`, `.aws`, `.ssh`)

Published and verified from the registry in `@marketnow/trust-core` (smoke 21/21).
**Next:** wire baselines and drift into the runtime interceptor and the sandbox so
live sessions are scored, not just library calls.

### Phase 4 — Policy (library; runtime integration in progress)

Move from score to decision engine.

- Capability graph: machine-readable manifests per tool
  (`filesystem.read`, `network.<host>`, `shell.execute`), MINIMAL_SAFE / FULL_ACCESS presets
- Organization policies: evaluate → ALLOW / REQUIRE_APPROVAL / BLOCK, three presets,
  per-org risk context
- Approval workflow with TTL (`createApprovalRequest`, `approveRequest`, `denyRequest`)

Published and verified from the registry. **Next:** agent identity + task identity on
every execution (agent_id, task_id, session_id) so policy decisions become a full
audit trail.

### Phase 5 — Trajectory (library; runtime integration in progress)

Detect multi-step attack chains — each action individually allowed, the chain blocked.

- Attack-chain patterns AC-001…AC-007 (`detectAttackChains`; verified on a
  search→read→exfiltrate→execute sequence)
- Data-flow graphs with exfiltration paths (`buildDataFlowGraph`)
- Trajectory risk scoring with blocking recommendation (`scoreTrajectory`)

Published and verified from the registry. **Next:** session-level enforcement in the
interceptor (block call #N because calls 1..N-1 were suspicious).

### Phase 6 — Platform (partial)

Cross-agent and ecosystem-scale trust:

- **Cross-agent delegation** — Library: `evaluateDelegation` with trust gates, chain
  depth, revocation checks.
- **Memory poisoning detection** — Library: `scanMemoryForPoisoning` (instruction
  injection, taint, sensitivity anomalies).
- **AgentBOM** — Planned: identity + software + capabilities + AI + security + trust
  in one bill of materials.
- **Typosquatting detection** — Planned: Levenshtein distance, package age, publisher.
- **Supply-chain graph** — Planned: MCP → npm → GitHub → dependencies → CVEs.
- **Continuous verification** — Planned: every commit / CVE / dependency change
  triggers re-audit.
- **External adversarial red-team** — Planned.

## OWASP MCP cheat-sheet alignment

| OWASP recommendation | MarketNow implementation | Status |
|---|---|---|
| Verify tool descriptions haven't changed | TFP-1.0 fingerprinting + drift reports | Production |
| Validate input/output schemas | Schema hash in Trust Card | Production |
| Monitor for tool poisoning | Sentinel rules MCP-TP-001..004 + TFP drift | Production |
| Implement least privilege | Capability graph + org policies | Library |
| Log all tool invocations | Agent identity + audit trail | Runtime wiring next |
| Isolate tool execution | Sandbox isolation (Sentinel pipeline) | Production |
| Scan for prompt injection | L1.9 rules (32) + memory poisoning scan | Production / library |
| Monitor runtime behavior | Behavioral baseline + drift | Library |
| Verify supply-chain integrity | Provenance + SLSA + Rekor anchors | Partial |
| Implement revocation | MNR-CRL-1.0 registry + /api/ocsp + /api/crl | Production |

## North Star

> **MarketNow is the verification and enforcement layer for all agentic systems.**

*Built by AliceLabs LLC — founder Edison Flores*
