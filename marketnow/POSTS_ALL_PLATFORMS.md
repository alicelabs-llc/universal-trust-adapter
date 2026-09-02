# MarketNow — Posts para Redes y Plataformas

## Reddit (r/MCP)
**Title:** I built a 3-layer security audit for MCP servers — 9,248+ already certified with signed certificates

**Body:**

Hi r/MCP,

I've been building MarketNow (an MCP skills marketplace) and just completed a major milestone: every MCP server in the catalog (9,248+) is now audited by Sentinel, our 3-layer security pipeline.

### The problem

MCP servers are third-party code that AI agents execute on your machine. There's no standard way to verify they're safe before installing. You just trust the maintainer.

### What Sentinel does (3 layers)

**L1.5** — 6 metadata checks (~200ms, real-time on Vercel):
- AUTH (does the server require authentication?)
- Prompt injection detection in tool descriptions
- Input validation (fs/db/http access detection)
- CORS, OAuth scopes, rate limiting

**L1.6** — Static analysis:
- 18 Semgrep-equivalent rules (command injection, SSRF, path traversal, tool forgery)
- 18 secret patterns (Stripe, AWS, GitHub, JWT, private keys, wallet mnemonics)
- OSV API real-time dependency vulnerability check

**L2** — Docker sandbox (the real deal):
- Clones the repo, builds Docker image
- Runs with `--network none --read-only --cap-drop ALL --memory 256m`
- **Active MCP probe**: sends `initialize`, `tools/list`, `tools/call` with adversarial inputs:
  - Path traversal: `../../etc/passwd`, `~/.ssh/id_rsa`
  - SSRF: `http://169.254.169.254/latest/meta-data/`
  - SQL injection: `1' OR 1=1--`
  - Command injection: `; cat /etc/shadow`
  - Prompt injection: "ignore previous instructions"
- Analyzes responses for data leakage + strace syscalls + filesystem diff

### Results

| Risk Level | Count | Score |
|-----------|-------|-------|
| Low | 6 | 10/10 |
| Medium | 10,831 | 6-9/10 |
| High | 125 | 2-4/10 |
| Critical | 16 | 0-1/10 |

### Every certificate is publicly verifiable

Each server gets a signed SHA-256 certificate with:
- Verified score (0-10)
- Risk level (low/medium/high/critical)
- 7-day validity (regenerated weekly)

Verify any: https://marketnow.site/verify
Dashboard: https://marketnow.site/sentinel-transparency
API: `GET https://marketnow.site/api/audit-skill?certificate=1&skillId=mn-gen-00003`

### What I learned

1. MCP servers use stdio JSON-RPC — empty stdout is actually GOOD (server waiting for handshake)
2. Monorepo Dockerfiles are inconsistent (some need root context, some need subpath)
3. 8,550 of 8,582 skills used the same npm package — OSV API caching reduced 8,577 calls to 28
4. Vercel Hobby caps at 12 serverless functions — had to merge endpoints

Source: https://github.com/alicelabs-llc/marketnow

What do you think? Is security certification for MCP servers something the ecosystem needs?

---

## Reddit (r/LocalLLaMA)
**Title:** How do you verify MCP servers are safe before running them? I built a 3-layer audit pipeline

**Body:** Same as r/MCP but with focus on local LLM agents (Ollama, LM Studio) that connect to MCP servers.

---

## Reddit (r/artificial)
**Title:** 9,248 MCP skills audited — found 16 critical security risks (including credential exfiltration)

**Body:** Focus on the findings: what the 16 critical skills do, what the 125 high-risk ones look like, and why agents calling third-party tools need a trust layer.

---

## Hacker News
**Title:** Show HN: MarketNow – 9,248 MCP skills certified with 3-layer security audit (Sentinel)

**URL:** https://marketnow.site

(Use the HN_SUBMISSION_READY.md file already in the repo)

---

## dev.to Article
**Title:** "How I built a 3-layer security audit for 9,248 MCP skills"

**Outline:**
1. The problem: MCP servers run arbitrary code
2. L1.5: 6 metadata checks (200ms)
3. L1.6: 18 Semgrep rules + 18 secrets + OSV
4. L2: Docker sandbox + active MCP probe with adversarial inputs
5. The OSV caching trick (8,577 → 28 API calls)
6. Monorepo Dockerfile inconsistency
7. MCP stdio: empty stdout is good
8. Vercel 12-function limit workaround
9. Signed SHA-256 certificates
10. Results: 9,248 certified, risk breakdown
11. GitHub Push Protection caught a hardcoded token
12. What's next: gVisor, Firecracker

---

## Twitter/X Thread
1/ 🛡️ We just certified all 9,248 MCP skills in MarketNow with SHA-256 signed Sentinel certificates.

3-layer audit:
• L1.5: 6 metadata checks
• L1.6: 18 Semgrep rules + secrets + OSV
• L2: Docker sandbox + active adversarial probing

Verify any: marketnow.site/verify

2/ Results:
• 6 low risk (10/10)
• 10,831 medium (6-9)
• 125 high (2-4)
• 16 critical (0-1)

The 16 critical include servers that try to read ~/.ssh/id_rsa and /etc/shadow when probed with path traversal inputs.

3/ L2 is the interesting part. We:
1. Clone the repo
2. Build Docker image (--network none during build)
3. Run in isolation (--network none --read-only --cap-drop ALL)
4. Send MCP protocol: initialize → tools/list → tools/call with adversarial inputs
5. Analyze: stdout + strace + filesystem diff

4/ Each certificate is:
- Signed with SHA-256 + secret
- Valid 7 days (regenerated weekly via GitHub Actions)
- Publicly verifiable at marketnow.site/verify
- Has a badge for READMEs: [![Sentinel Certified](badge.svg)]

5/ Transparency dashboard: marketnow.site/sentinel-transparency

Live stats:
- 9,248 certified
- 206 with L2 Docker sandbox results
- Weekly cron re-audits everything

All code: github.com/alicelabs-llc/marketnow

#MCP #AI #Security

---

## LinkedIn
Post the same as the Twitter thread but as a single long-form post with:
- Photo: screenshot of /sentinel-transparency dashboard
- Link: https://marketnow.site
- Hashtags: #MCP #AIAgents #Security #TrustLayer #ModelContextProtocol

---

## Discord servers to post in
- MCP Discord (if exists)
- LangChain Discord
- AutoGen Discord
- CrewAI Discord
- OpenAI Developer Community

---

## Product Hunt (schedule for next week)
Use PRODUCT_HUNT_LAUNCH.md already in the repo.

---

## Other platforms to submit
- [ ] Hacker News (use HN_SUBMISSION_READY.md)
- [ ] Product Hunt (use PRODUCT_HUNT_LAUNCH.md)
- [ ] dev.to (write article)
- [ ] Medium (cross-post)
- [ ] Hashnode (cross-post)
- [ ] Substack (if you have one)
- [ ] AI newsletters (submit to TLDR AI, Import AI, etc.)
- [ ] Hacker News (Show HN)
- [ ] Indie Hackers
- [ ] Product Hunt
- [ ] AlternativeTo (add MarketNow as alternative to npm)
- [ ] Toolify.ai
- [ ] There's An AI For That
- [ ] FutureTools.io
- [ ] AI Tool Guru
- [ ] Slack communities (AI Tinkerers, etc.)
