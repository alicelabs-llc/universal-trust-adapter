# MarketNow v2.5 — LinkedIn Post

## Image to attach

**File:** `aep-marketplace/public/linkedin-v25.png`
**URL (once deployed):** https://marketnow.site/linkedin-v25.png

Download the image from the repo and attach it to your LinkedIn post:
https://github.com/alicelabs-llc/marketnow/blob/master/aep-marketplace/public/linkedin-v25.png

---

## Post text (copy-paste to LinkedIn)

I audited 8,760 MCP servers with gVisor sandboxes.

Here's what I built → MarketNow (marketnow.site), an open marketplace for MCP (Model Context Protocol) servers where every server goes through a 6-layer security audit before listing.

The newest layer, L2.5, uses gVisor — Google's userspace kernel (the same tech behind Cloud Run). The MCP server never touches the host kernel.

What the audit does:

🔹 L1.5 — Static analysis (dependency scan, license check, hardcoded secret detection)
🔹 L1.6 — Pattern-based behavioral analysis
🔹 L2 v2.0 — Active probe: sends real MCP protocol messages with 60+ adversarial inputs (path traversal, SSRF, SQL injection, command injection, prompt injection, credential access)
🔹 L2.5 — gVisor sandbox: userspace kernel isolation [NEW]
🔸 L3 — Firecracker microVM (Q1 2027)
🔸 L4 — Supply chain attestation (Q4 2026)
🔸 L5 — Third-party audit by Trail of Bits / Cure53 (Q3 2027)

Test case: I ran Anthropic's official @modelcontextprotocol/server-filesystem in the sandbox and hit it with 60+ adversarial inputs.

Result: 10/10 (low risk). Anthropic's server is clean.

Why this matters: every time you install an MCP server and add it to Claude Desktop, Cursor, or Cline, that server gets:
→ Read access to your filesystem (~/.ssh/id_rsa, ~/.aws/credentials)
→ Network access (exfiltrate data, SSRF to cloud metadata)
→ Process spawn access (run arbitrary commands)
→ Environment variable access (API keys, tokens)

There's no sandboxing built into MCP. You're trusting the author.

MarketNow adds the security signal. Every server has a Sentinel score (0-10) and a signed SHA-256 certificate verifiable at /verify.

Try it:
→ 8,760+ MCP servers: marketnow.site/registry
→ 43 free skills (no signup): marketnow.site/api/free-skills.json
→ Install the MCP server: npx -y marketnow-mcp
→ Full audit result: github.com/alicelabs-llc/marketnow

Built by 1 person. No investors. No marketing budget. Open source.

#MCP #AI #Security #LLM #Claude #Anthropic #gVisor #DevOps #Cybersecurity #OpenSource

---

## Tips for posting on LinkedIn

1. **Best time to post:** Tuesday-Thursday, 8-10am (your timezone)
2. **Tag these companies/people** (type @ then the name):
   - @Anthropic
   - @Google Cloud (they make gVisor)
   - @Cursor
3. **Engage with comments** in the first 60 minutes — LinkedIn's algorithm boosts posts with early engagement
4. **Don't edit the post** after publishing — LinkedIn resets the algorithm on edits
5. **Add the image first**, then paste the text

---

## Alternative shorter version (if LinkedIn character limit is an issue)

I audited 8,760 MCP servers with gVisor sandboxes. Here's what I built.

MarketNow (marketnow.site) is an open marketplace for MCP servers where every server goes through a 6-layer security audit. The newest layer, L2.5, uses gVisor — Google's userspace kernel (the tech behind Cloud Run). The MCP server never touches the host kernel.

Test case: Anthropic's official filesystem MCP scored 10/10 (low risk) after being hit with 60+ adversarial inputs (path traversal, SSRF, SQL injection, command injection, prompt injection, credential access).

Why this matters: every MCP server you install gets read access to your filesystem, network access, process spawn access, and env var access. There's no sandboxing in MCP. MarketNow adds the security signal.

→ 8,760+ servers: marketnow.site/registry
→ Install: npx -y marketnow-mcp
→ GitHub: github.com/alicelabs-llc/marketnow

#MCP #AI #Security #gVisor #Claude #Cybersecurity #OpenSource
