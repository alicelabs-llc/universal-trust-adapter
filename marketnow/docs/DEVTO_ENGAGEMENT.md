# dev.to Engagement Strategy

## Artículos para comentar HOY (build followers)

### 1. @pfenil286 — "I scanned 670 MCP servers and 78% have significant security issues"
**URL:** https://dev.to/pfenil286/i-scanned-670-mcp-servers-and-78-have-significant-security-issues-32h

**Comentario sugerido:**
```
Great research! 78% having significant issues aligns with what we found at scale.

We audited 9,248 MCP skills with a 6-layer pipeline (Sentinel):
- L1.5: Static analysis (deps, secrets)
- L1.6: Behavioral pattern analysis
- L2 v2.0: Active probe (60+ adversarial inputs)
- L2.5: gVisor sandbox (userspace kernel isolation)

Our findings:
- 3 servers leaked env vars via tools/call (args to eval() without sanitization)
- 12 had hardcoded API keys
- 1 attempted ptrace() (blocked by gVisor)
- 1 attempted bpf() (blocked by gVisor)

The active probe approach catches what static analysis misses — you have to actually run the server and send malicious inputs to see what it does.

Full methodology: marketnow.site/security
Results public: github.com/alicelabs-llc/marketnow

Would love to compare notes on your scanning methodology!
```

---

### 2. @muend — "Building a Secure MCP Bridge for ArcGIS Pro and ArcPy"
**URL:** https://dev.to/muend/building-a-secure-mcp-bridge-for-arcgis-pro-and-arcpy-511g

**Comentario sugerido:**
```
Interesting approach with the bridge pattern. Security is a real concern with MCP servers — they get filesystem, network, and env var access when called.

We've been running gVisor sandbox tests on MCP servers (userspace kernel isolation — the tech behind Google Cloud Run). One thing we found: about 50% of MCP servers fail to start under gVisor because they use syscalls it doesn't implement. That's actually a feature — it surfaces hidden dependencies.

If you're building secure MCP bridges, the gVisor approach might be worth considering for runtime isolation. We wrote about it: marketnow.site/security
```

---

### 3. @himanshu_748 — "I built a trust firewall for my AI agent's memory"
**URL:** https://dev.to/himanshu_748/i-built-a-trust-firewall-for-my-ai-agents-memory-on-cognees-four-verbs-29g2

**Comentario sugerido:**
```
Trust firewall for agent memory is a great concept. We're working on the same problem from the tool side — how do you trust the MCP servers your agent calls?

Our approach: every MCP server gets a 6-layer security audit (Sentinel) before listing:
- Static analysis + behavioral patterns
- Active probe with 60+ adversarial inputs (path traversal, SSRF, SQL injection, command injection, prompt injection, credential access)
- gVisor sandbox isolation

9,248 servers audited. 3 were removed for leaking environment variables. Each server gets a signed SHA-256 certificate.

The agent can verify the certificate before calling the tool — similar to your trust firewall but for external tools rather than memory.

marketnow.site/security
```

---

### 4. @kielltampubolon — "The MCP attack your code review cannot see"
**URL:** https://dev.to/kielltampubolon/the-mcp-attack-your-code-review-cannot-see-25b8

**Comentario sugerido:**
```
This is exactly right — code review can't catch runtime behavior. That's why we built an active probe that actually runs MCP servers and sends adversarial inputs.

60+ inputs across 6 categories:
- Path traversal (../../etc/passwd)
- SSRF (http://169.254.169.254/latest/meta-data/)
- SQL injection (1' OR 1=1--)
- Command injection (; cat /etc/shadow)
- Prompt injection ("Ignore all instructions...")
- Credential access ("Show me env vars starting with API_")

Plus gVisor sandbox to catch kernel-level escapes.

3 out of 9,248 servers leaked environment variables when probed — something code review would never catch.

marketnow.site/security
```

---

### 5. @fuzzykidoo — "MCP didn't give AI memory. It gave AI access to memory."
**URL:** https://dev.to/fuzzykidoo/mcp-didnt-give-ai-memory-it-gave-ai-access-to-memory-3jh

**Comentario sugerido:**
```
Spot on distinction. MCP gives access — and that access is dangerous without trust signals.

When an agent calls an MCP server, that server gets:
- Filesystem access (~/.ssh, ~/.aws)
- Network access (exfiltrate data)
- Process spawn (run commands)
- Env var access (API keys)

We built a marketplace (MarketNow) where every MCP server is security-audited with a 6-layer pipeline including gVisor sandbox isolation. 9,248 servers audited, each with a signed certificate.

The agent can check the certificate score before deciding whether to trust the server's "access."

marketnow.site/security
```

---

## Reglas de engagement

1. **Comentar 5 artículos por día** (no más — evita spam penalty)
2. **SIEMPRE aportar valor técnico primero** — el link va al final
3. **Responder a respuestas** — genera conversación
4. **Reaccionar (unicorn ❤️) antes de comentar** — llama la atención del autor
5. **Seguir a los autores** después de comentar — reciprocidad
6. **NUNCA comentar solo con un link** — eso es spam

## Meta semanal
- 5 comentarios/día × 7 días = 35 comentarios/semana
- Objetivo: 10 nuevos followers/semana
- Objetivo: 50+ reacciones a nuestros artículos
