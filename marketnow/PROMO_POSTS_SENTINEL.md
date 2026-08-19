# MarketNow — Promotion Posts

## Twitter/X (280 chars max)

🛡️ We just certified all 8,582 MCP servers in MarketNow with SHA-256 signed Sentinel certificates.

3-layer audit:
• L1.5: 6 metadata checks
• L1.6: 18 Semgrep rules + secrets + OSV
• L2: Docker sandbox (--network none)

Verify any cert: marketnow.site/verify
Live dashboard: marketnow.site/sentinel-transparency

#MCP #AI #AgentSecurity

---

## LinkedIn (longer form)

**Every MCP server in MarketNow is now Sentinel-certified.**

Today we completed a milestone: all 8,582 MCP servers in our catalog have been audited by Sentinel, our 3-layer security pipeline, and each one has a signed SHA-256 certificate with a verified score (0-10) and risk level.

**How Sentinel works:**
🔹 L1.5 — 6 metadata checks (AUTH, prompt injection, input validation, CORS, OAuth scopes, rate limiting)
🔹 L1.6 — 18 Semgrep rules + 18 secret patterns + OSV API dependency check
🔹 L2 — Docker sandbox with --network none, --read-only, --cap-drop ALL (runs the actual MCP server in isolation)

**Results:**
✅ 8,582 skills certified (100% of catalog)
✅ 6 low risk (score 10/10)
✅ 8,474 medium risk (score 6-9)
✅ 91 high risk (score 2-4)
✅ 11 critical (score 0-1)

**Transparency:**
Every certificate is publicly verifiable at marketnow.site/verify
Live dashboard: marketnow.site/sentinel-transparency
All code is open: github.com/edgarfloresguerra2011-a11y/marketnow

This is the first MCP marketplace to offer security certification. We believe trust layers like this will be essential as AI agents increasingly call third-party tools.

#MCP #AIAgents #Security #TrustLayer #ModelContextProtocol

---

## Reddit (r/MCP, r/LocalLLaMA, r/artificial)

**Title:** MarketNow: 8,582 MCP servers now Sentinel-certified with signed SHA-256 certificates (3-layer security audit)

**Body:**

I've been building MarketNow, an MCP skills marketplace, and just completed a major milestone: **every MCP server in the catalog (8,582) is now Sentinel-certified** with a signed SHA-256 certificate.

## What is Sentinel?

It's a 3-layer security audit pipeline:

**L1.5** — 6 metadata checks that run in real-time on Vercel:
- AUTH (does the server require authentication?)
- Tool description injection (prompt injection patterns)
- Input validation (fs/db/http access detection)
- CORS policy
- OAuth scopes
- Rate limiting + error leakage

**L1.6** — Static analysis:
- 18 Semgrep-equivalent regex rules (prompt injection, command injection, SSRF, path traversal, tool forgery)
- 18 secret detection patterns (Stripe, AWS, GitHub, JWT, private keys, wallet mnemonics)
- OSV API real-time dependency vulnerability check

**L2** — Docker sandbox (the interesting one):
- Clones the MCP server repo
- Builds a Docker image
- Runs it in complete isolation: `--network none --read-only --cap-drop ALL --memory 256m --cpus 0.5`
- Analyzes stdout for: network attempts, fs writes, process spawns, credential leakage, crashes, dynamic imports
- Commits results to the repo as versioned JSON

## Results

| Risk Level | Count | Score |
|-----------|-------|-------|
| Low | 6 | 10/10 |
| Medium | 8,474 | 6-9/10 |
| High | 91 | 2-4/10 |
| Critical | 11 | 0-1/10 |

## Every certificate is publicly verifiable

Each skill gets a JSON certificate with:
- certificate_id (MN-SC-2026-XXXXXXX)
- overall_score (0-10)
- risk_level (low/medium/high/critical)
- SHA-256 signature
- 7-day validity (regenerated weekly by GitHub Actions cron)

You can verify any certificate at: https://marketnow.site/verify

Or via API: `GET https://marketnow.site/api/audit-skill?certificate=1&skillId=mn-gen-00003`

## Transparency dashboard

Live stats at: https://marketnow.site/sentinel-transparency
- Total certified count
- Score distribution histogram
- Risk level breakdown
- L2 sandbox coverage
- Latest batch audit results

## What I learned building this

1. **OSV API caching is critical** — 8,550 of 8,582 skills use the same npm package (@marketnow/install). Without caching, the batch audit would make 8,577 identical API calls. With caching: 28.

2. **Monorepo Dockerfiles are inconsistent** — modelcontextprotocol/servers has 7 MCP servers, each with its own Dockerfile. Some use `COPY src/everything /app` (relative to repo root), others use `COPY uv.lock /uv.lock` (relative to subpath). Had to try both build contexts.

3. **MCP servers communicate via stdio JSON-RPC** — a correctly behaving server starts up, waits for the `initialize` handshake message on stdin, and produces NO output. So "empty stdout" is actually a GOOD sign (server is alive and well-behaved). Had to add a `ran_idle` execution_status to distinguish this from `failed_to_start`.

4. **Vercel Hobby plan limits you to 12 serverless functions** — had to merge the sentinel-status endpoint into audit-skill.js as a sub-endpoint (`?sentinel-status=1`).

5. **GitHub Push Protection caught a hardcoded token** — I accidentally committed a PAT in a script. GitHub refused the push. Good security feature.

All code is open source: https://github.com/edgarfloresguerra2011-a11y/marketnow

What do you think? Is security certification for MCP servers something the ecosystem needs?

---

## Hacker News (Show HN)

**Title:** Show HN: MarketNow — 8,582 MCP servers certified with 3-layer security audit (Sentinel)

**Body:**

Hi HN, I built a security certification system for MCP (Model Context Protocol) servers. Every server in the catalog is audited by a 3-layer pipeline and gets a signed SHA-256 certificate.

**The 3 layers:**

L1.5 — 6 metadata checks (real-time, ~200ms on Vercel):
AUTH, prompt injection detection, input validation, CORS, OAuth scopes, rate limiting

L1.6 — Static analysis (real-time + weekly batch):
18 Semgrep-equivalent regex rules + 18 secret patterns (Stripe/AWS/GitHub/JWT/private keys) + OSV API for dependency vulnerabilities

L2 — Docker sandbox (async via GitHub Actions):
Clones the repo, builds a Docker image, runs it with `--network none --read-only --cap-drop ALL --memory 256m`, analyzes stdout for network attempts / fs writes / credential leakage / crashes. Results committed to the repo.

**Interesting technical challenges:**

1. The OSV API was killing our batch audit (8,577 of 8,582 skills use the same npm package). Solution: in-memory cache reduced it to 28 unique API calls.

2. Monorepo Dockerfiles are inconsistent — modelcontextprotocol/servers has 7 servers, each with its own Dockerfile. Some assume build context is the repo root (`COPY src/everything /app`), others assume it's the subpath (`COPY uv.lock /uv.lock`). Had to try both contexts.

3. MCP servers use stdio JSON-RPC — a correct server starts, waits for the `initialize` message on stdin, and produces NO output. So "empty stdout" is actually a good sign. Added a `ran_idle` execution_status to distinguish from `failed_to_start`.

4. Vercel Hobby plan caps at 12 serverless functions per deploy. Merged the status endpoint into the audit endpoint as a sub-endpoint.

**Results:** 8,582 certified, 6 low risk, 8,474 medium, 91 high, 11 critical.

**Everything is verifiable:**
- Transparency dashboard: https://marketnow.site/sentinel-transparency
- Verify any certificate: https://marketnow.site/verify
- API: `GET /api/audit-skill?certificate=1&skillId=mn-gen-00003`
- Source: https://github.com/edgarfloresguerra2011-a11y/marketnow

The weekly cron re-audits everything every Sunday at 01:00 UTC. Certificates are signed with SHA-256 + a secret, valid for 7 days.

What would you improve? I'm especially interested in feedback on the L2 sandbox approach — is `--network none --read-only --cap-drop ALL` enough isolation, or should I add seccomp profiles / gVisor?

---

## dev.to article outline

Title: "How I certified 8,582 MCP servers with a 3-layer security audit"

Sections:
1. The problem: MCP servers are third-party code that AI agents execute. How do you trust them?
2. The 3-layer approach: L1.5 (metadata) → L1.6 (static) → L2 (runtime)
3. L2 Docker sandbox: --network none, --read-only, --cap-drop ALL
4. Signed certificates: SHA-256 + weekly cron
5. The OSV API caching trick (8,577 → 28 calls)
6. Monorepo Dockerfile inconsistency (dual build context)
7. MCP stdio JSON-RPC: empty stdout is actually good
8. Vercel 12-function limit workaround
9. GitHub Push Protection caught a hardcoded token
10. Transparency: public verification + dashboard
11. Results: 8,582 certified, risk breakdown
12. What's next: gVisor, Firecracker, third-party audit
