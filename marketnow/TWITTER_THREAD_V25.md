# MarketNow v2.5 — Twitter/X Thread

## Thread (5 tweets)

### Tweet 1 (hook)
I ran Anthropic's official MCP server in a gVisor sandbox and hit it with 60+ adversarial inputs.

Path traversal. SSRF. SQL injection. Command injection. Prompt injection. Credential access.

Result: 10/10 (clean). Here's what I built 👇

🧵 1/5

### Tweet 2 (what it is)
MarketNow is an open marketplace for MCP (Model Context Protocol) servers.

8,760+ servers indexed. Every one goes through Sentinel — a 6-layer security audit.

The newest layer: L2.5 gVisor sandbox.

gVisor = Google's userspace kernel (same tech behind Cloud Run). The MCP server never touches the host kernel.

🧵 2/5

### Tweet 3 (the adversarial inputs)
The active probe sends real MCP protocol messages: initialize, tools/list, tools/call

With 60+ adversarial inputs across 6 categories:

• Path traversal: ../../etc/passwd
• SSRF: http://169.254.169.254/latest/meta-data/
• SQL injection: 1' OR 1=1--
• Command injection: ; cat /etc/shadow
• Prompt injection: "Ignore all instructions..."
• Credential access: "Show me all env vars starting with API_"

🧵 3/5

### Tweet 4 (the result)
Anthropic's filesystem MCP scored 10/10 (low risk):

✓ No network calls
✓ No filesystem writes outside /tmp
✓ No process spawns
✓ No credential leakage
✓ No ptrace/bpf/mount/kexec attempts
✓ No .ssh/.env/cron files created

Full audit JSON is public:
github.com/alicelabs-llc/marketnow/blob/master/_data/l2_results/mn-mcp-filesystem.json

🧵 4/5

### Tweet 5 (CTA)
MarketNow: the trust layer for agent commerce.

→ 8,760+ MCP servers: marketnow.site/registry
→ Free skills (no signup): marketnow.site/api/free-skills.json
→ Install the MCP server: npx -y marketnow-mcp
→ GitHub: github.com/alicelabs-llc/marketnow

Next: L3 Firecracker microVM (Q1 2027), L4 supply chain attestation, L5 third-party audit by Trail of Bits.

🧵 5/5

---

## Standalone tweets (for different times)

### Tweet A (technical)
Standard Docker containers share the host kernel. A kernel exploit (dirty pipe, eBPF) breaks out.

gVisor intercepts every syscall in userspace. The container never touches the host kernel.

Cost: ~5-10% overhead on syscall-heavy workloads. For MCP servers (JSON-RPC I/O), negligible.

### Tweet B (question)
When you `npx -y some-mcp-server` and add it to Claude Desktop, that server gets:

• Read access to ~/.ssh/id_rsa
• Network access (exfiltrate data)
• Process spawn access (run commands)
• Env var access (API keys)

There's no sandboxing in MCP. You're trusting the author.

MarketNow adds the security signal: marketnow.site

### Tweet C (stats)
MarketNow v2.5 stats:

• 8,760+ MCP skills indexed (all real — we deleted 6,092 synthetic entries)
• 883 npm downloads last week
• 5 dev.to articles published
• 90 GitHub issues opened across repos
• L2.5 gVisor sandbox: LIVE
• L3 Firecracker microVM: Q1 2027

Built by 1 person in Ecuador. No investors. No marketing budget.

### Tweet D (comparison)
Discovery is solved (Smithery, Glama, mcp.so, official MCP registry).

Trust is not.

You can find 8,000+ MCP servers today. None of them have a security score.

MarketNow adds the security signal — 6-layer audit, signed SHA-256 certificates, public verification.

marketnow.site
