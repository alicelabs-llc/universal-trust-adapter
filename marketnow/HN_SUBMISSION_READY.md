# MarketNow — Hacker News Submission Ready

## How to submit

1. Go to https://news.ycombinator.com/submit
2. Login with your HN account (or create one at https://news.ycombinator.com/login?goto=submit)
3. Copy-paste the content below
4. Submit

---

## Title (80 chars max)

```
Show HN: MarketNow – 8,582 MCP servers certified with 3-layer security audit
```

## URL

```
https://marketnow.site
```

OR if you prefer text post (Show HN usually uses text posts):

## Text (if submitting as text post)

```
Hi HN, I built a security certification system for MCP (Model Context Protocol) servers. Every server in the catalog is audited by a 3-layer pipeline and gets a signed SHA-256 certificate.

Live demo: https://marketnow.site/verify
Transparency dashboard: https://marketnow.site/sentinel-transparency
Source: https://github.com/edgarfloresguerra2011-a11y/marketnow

The 3 layers:

L1.5 — 6 metadata checks (real-time, ~200ms on Vercel): AUTH, prompt injection detection, input validation, CORS, OAuth scopes, rate limiting

L1.6 — Static analysis (real-time + weekly batch): 18 Semgrep-equivalent regex rules + 18 secret patterns (Stripe/AWS/GitHub/JWT/private keys) + OSV API for dependency vulnerabilities

L2 — Docker sandbox (async via GitHub Actions): Clones the repo, builds a Docker image, runs it with `--network none --read-only --cap-drop ALL --memory 256m`, analyzes stdout for network attempts / fs writes / credential leakage / crashes. Results committed to the repo.

Interesting technical challenges:

1. The OSV API was killing our batch audit (8,577 of 8,582 skills use the same npm package). Solution: in-memory cache reduced it to 28 unique API calls.

2. Monorepo Dockerfiles are inconsistent — modelcontextprotocol/servers has 7 servers, each with its own Dockerfile. Some assume build context is the repo root (COPY src/everything /app), others assume it's the subpath (COPY uv.lock /uv.lock). Had to try both contexts.

3. MCP servers use stdio JSON-RPC — a correct server starts, waits for the initialize message on stdin, and produces NO output. So "empty stdout" is actually a good sign. Added a ran_idle execution_status to distinguish from failed_to_start.

4. Vercel Hobby plan caps at 12 serverless functions per deploy. Merged the status endpoint into the audit endpoint as a sub-endpoint.

Results: 8,582 certified, 6 low risk, 8,474 medium, 91 high, 11 critical.

Everything is verifiable:
- Transparency dashboard: https://marketnow.site/sentinel-transparency
- Verify any certificate: https://marketnow.site/verify
- API: GET /api/audit-skill?certificate=1&skillId=mn-gen-00003
- Source: https://github.com/edgarfloresguerra2011-a11y/marketnow

The weekly cron re-audits everything every Sunday at 01:00 UTC. Certificates are signed with SHA-256 + a secret, valid for 7 days.

What would you improve? I'm especially interested in feedback on the L2 sandbox approach — is --network none --read-only --cap-drop ALL enough isolation, or should I add seccomp profiles / gVisor?
```

---

## Best practices for HN

### Timing
- **Best time**: Tuesday-Thursday, 8-9 AM EST (when HN traffic peaks)
- **Avoid**: Friday afternoon, weekends, Monday morning

### After submitting
1. **First 30 minutes are critical** — refresh the "new" page to make sure it appears
2. **Respond to every comment** within 15 minutes for the first 2 hours
3. **Don't ask for upvotes** — HN will flag this
4. **Be humble** — acknowledge limitations when commenters point them out
5. **Share technical details** — HN loves depth

### Comments to prepare answers for

**"Why not just use existing tools like Snyk?"**
> Snyk is great for dependency scanning (similar to our L1.6 OSV check). But MCP servers need runtime analysis too — you can't tell from static analysis if a server will try to exfiltrate data at runtime. That's what L2 (Docker sandbox) is for. We also added MCP-specific checks like prompt injection detection in tool descriptions, which Snyk doesn't do.

**"How is this different from npm audit?"**
> npm audit only checks dependencies. Sentinel also checks: (1) the server's own code for prompt injection patterns, (2) hardcoded secrets, (3) runtime behavior in a Docker sandbox. npm audit is a subset of L1.6.

**"Why --network none? Some MCP servers legitimately need network access."**
> Good point. --network none is for the AUDIT run, not for production use. We're testing what happens when the server CAN'T reach the network — if it tries to (and we detect ECONNREFUSED in stdout), that's a signal. In production, the server would have network access. We're auditing intent, not blocking functionality.

**"SHA-256 with a shared secret isn't real cryptography."**
> Correct — it's a signature scheme, not encryption. The goal is to prove that a certificate was issued by MarketNow (holder of the secret), not to encrypt anything. For a trust layer, this is sufficient. If we needed non-repudiation, we'd use asymmetric signing (e.g., Ed25519). Happy to add that if there's demand.

**"8,582 skills but only 17 have L2 results?"**
> L2 requires a GitHub repo URL in the skill metadata. Most skills in our catalog are imported from community lists without repo URLs. The 17 that have L2 are the ones with source.url populated (7 official Anthropic servers + 10 from awesome-mcp-servers). We're working on adding more repo URLs to expand L2 coverage.

### If it hits the front page
- Don't edit the post (HN flags edits)
- Keep responding to comments
- Share the HN thread on Twitter: "We're on the front page of HN! 🧡"

---

## Alternative: Submit as URL post

If you prefer a URL post (simpler, drives traffic directly):

- **Title**: `Show HN: MarketNow – 8,582 MCP servers certified with 3-layer security audit`
- **URL**: `https://marketnow.site`
- **First comment**: Paste the full text from above starting with "Hi HN, I built a security certification system..."
