# Show HN: MarketNow — I audited 8,760 MCP servers with gVisor sandboxes

## Title (for HN submission)

**Show HN: MarketNow — I audited 8,760 MCP servers with gVisor sandboxes**

## URL

https://marketnow.site

## Text (for the HN post — max 2000 chars, no markdown)

I built MarketNow, an open marketplace for MCP (Model Context Protocol) servers. Every server in the catalog goes through a 6-layer security audit before listing.

The audit pipeline (called Sentinel):
- L1.5: Static analysis (dependency scan, license check, hardcoded secret detection)
- L1.6: Pattern-based behavioral analysis (network/fs/process patterns)
- L2 v2.0: Active probe — sends real MCP protocol messages (initialize, tools/list, tools/call) with 60+ adversarial inputs across 6 categories: path traversal, SSRF, SQL injection, command injection, prompt injection, credential access
- L2.5: gVisor sandbox — runs the server in a userspace kernel (what Google uses for Cloud Run). The server never touches the host kernel. Catches container escapes that standard Docker misses.

I tested it on Anthropic's official filesystem MCP server. It scored 10/10 (low risk). The full audit result is public: https://github.com/alicelabs-llc/marketnow/blob/master/_data/l2_results/mn-mcp-filesystem.json

8,760+ servers indexed (all real — we deleted 6,092 synthetic entries in June). Source: GitHub (40+ search queries weekly), npm, Smithery.

Tech: React frontend, Vercel API, GitHub Actions for the weekly audit runs. gVisor runs on the GitHub Actions runner — install runsc, register as Docker runtime, run with --runtime=runsc.

What's next:
- L3: Firecracker microVM (Q1 2027) — replace Docker+gVisor with KVM-level isolation
- L4: Supply chain attestation — SLSA Level 3, signed build provenance
- L5: Third-party audit by Trail of Bits / Cure53

The audit engine is proprietary (AliceLabs LLC) but every audit result is public. Each skill has a signed SHA-256 certificate verifiable at /verify.

I'd love feedback on the audit methodology — especially from people who have built sandboxing or security analysis tools. What would you add?

---

## Comments to make on the HN post (first 30 minutes)

### Comment 1 (self-reply, immediately after posting):

Source code for the audit runner (not the analyzer — that's proprietary): https://github.com/alicelabs-llc/marketnow/tree/master/scripts

The key files:
- l2-gvisor-sandbox.sh — installs gVisor, runs the container with --runtime=runsc
- l2-mcp-probe.py — sends the 60+ adversarial inputs
- l2-analyze.py — combines 6 layers into a score 0-10
- l2-build-docker.sh — builds the MCP server image (handles monorepo subpaths)

### Comment 2 (if someone asks "why not just use seccomp?")

We do use seccomp — it's the fallback when gVisor isn't available. But seccomp is a blocklist (you have to enumerate every dangerous syscall). gVisor is an allowlist by default (every syscall goes through the userspace kernel, which only implements what's needed).

The difference matters for 0-days. If a new syscall vulnerability appears (like io_uring bugs), seccomp doesn't know to block it. gVisor just doesn't implement it.

### Comment 3 (if someone asks "how is this different from Smithery?")

Smithery is a discovery directory — they list MCP servers. MarketNow is a trust layer — we audit them.

Discovery is solved (Smithery, Glama, mcp.so, the official MCP registry). Trust is not. You can find 8,000+ MCP servers on Smithery today, but none of them have a security score. When you `npx -y some-mcp-server`, you're trusting the author with your filesystem, your env vars, your network.

MarketNow adds the security signal.

### Comment 4 (if someone asks about pricing/business model)

Free for browsing, free for the 43 hand-curated free skills. Paid skills are free one-time (Stripe or USDC on Base L2). No subscriptions.

The audit engine is proprietary. The marketplace takes 10% on paid skills.

Bootstrapped, no investors, 1 person (me, in Ecuador).

---

## Tags to add

`Show HN`

## Best time to submit

Tuesday-Thursday, 8-10am PT (when HN traffic is highest and the audience is technical)
