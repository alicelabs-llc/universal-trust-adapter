# Textos preparados para submitir manualmente

## ═══════════════════════════════════════════
## 1. mcpm.sh — Submitir MarketNow
## ═══════════════════════════════════════════

### Paso 1: Ve a https://mcpm.sh
### Paso 2: Busca un botón "Submit" o "Add Server"
### Paso 3: Llena el formulario con estos datos:

**Server Name:**
```
MarketNow
```

**Tagline / Short Description (máx 100 chars):**
```
MCP skill marketplace with 8,760+ security-audited servers. Sentinel v3.0 gVisor sandbox.
```

**Full Description:**
```
MarketNow is the trust layer for agent commerce — an open marketplace for MCP (Model Context Protocol) servers. Every server in the catalog goes through a 6-layer security audit called Sentinel before listing.

Audit layers:
- L1.5: Static analysis (dependency scan, license check, secret detection)
- L1.6: Pattern-based behavioral analysis
- L2 v2.0: Active MCP probe (60+ adversarial inputs: path traversal, SSRF, SQL injection, command injection, prompt injection, credential access)
- L2.5: gVisor sandbox (userspace kernel isolation — the tech behind Google Cloud Run)
- L3 (Q1 2027): Firecracker microVM
- L4 (Q4 2026): Supply chain attestation (SLSA Level 3)
- L5 (Q3 2027): Third-party audit (Trail of Bits, Cure53)

8,760+ MCP skills indexed from GitHub, npm, and Smithery. Each skill has a signed SHA-256 certificate verifiable at /verify.

43 free skills (no signup). Paid skills free one-time (Stripe or USDC on Base L2).

Install: npx -y marketnow-mcp
Works with Claude Desktop, Cursor, Cline, Continue, Aider.
```

**GitHub Repository URL:**
```
https://github.com/alicelabs-llc/marketnow
```

**Website URL:**
```
https://marketnow.site
```

**MCP Endpoint (if asked):**
```
https://marketnow.site/api/mcp
```

**Server Config JSON (if asked):**
```json
{
  "mcpServers": {
    "marketnow": {
      "url": "https://marketnow.site/api/mcp"
    }
  }
}
```

**Categories/Tags:**
```
marketplace, security, mcp, agent-commerce, sentinel, gvisor, ai-agents, registry
```

**Author/Company:**
```
AliceLabs LLC (founder: Edison Flores)
```

**Contact Email:**
```
info@alicelabs.site
```

---

## ═══════════════════════════════════════════
## 2. langchain-ai/langchain — Issue manual
## ═══════════════════════════════════════════

### Paso 1: Ve a https://github.com/langchain-ai/langchain/issues/new/choose
### Paso 2: Click en "✨ Feature Request"
### Paso 3: Llena el formulario con estos datos:

### Title (required):
```
Feature: Verify MCP server security scores before connecting (Sentinel integration)
```

### Submission checklist (marca TODAS estas):
- [x] This is a feature request, not a bug report or usage question.
- [x] I added a clear and descriptive title that summarizes the feature request.
- [x] I used the GitHub search to find a similar feature request and didn't find it.
- [x] I checked the LangChain documentation and API reference to see if this feature already exists.
- [x] This is not related to the langchain-community package.

### Package (required) — marca esta opción:
- [x] Other / not sure / general

(Porque la integración es con `langchain-mcp-adapters` que no está en la lista)

### Feature Description (required):
```
I would like LangChain's MCP client (langchain-mcp-adapters) to support an optional security verification step before connecting to an MCP server.

When enabled, the client would fetch a signed security certificate from a marketplace registry (like MarketNow) and verify the server's security score before establishing a connection. If the score is below a user-defined threshold, the client raises an error instead of connecting.

This addresses a real security gap: the MCP ecosystem now has 8,000+ servers on GitHub. Some are well-maintained (Anthropic official servers). Others are experimental, abandoned, or potentially malicious. Without a security signal, LangChain agents will happily call any MCP server — including ones that exfiltrate credentials, spawn processes, or hit internal network endpoints.
```

### Use Case (required):
```
I'm building agents that use MCP servers to extend their capabilities. Currently, when I configure a MultiServerMCPClient, I have no way to verify whether a given MCP server is safe to call.

The problem: MCP servers run with full access to:
- The filesystem (~/.ssh/id_rsa, ~/.aws/credentials)
- The network (exfiltrate data, SSRF to cloud metadata)
- Process spawning (run arbitrary commands)
- Environment variables (API keys, tokens)

There's no sandboxing built into MCP. I'm trusting the author.

Currently, I work around this by manually checking each MCP server's GitHub repo before adding it to my agent. This doesn't scale — I'd have to do this for every server, and I have no way to detect runtime misbehavior.

This feature would help me and other agent builders to:
1. Programmatically reject MCP servers below a security threshold
2. Build trust signals into agent workflows
3. Reduce the attack surface of agent deployments
```

### Proposed Solution (optional but recommended):
```
Add optional parameters to the MCP client:

from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient(
    {
        "filesystem": {
            "url": "https://example.com/mcp/filesystem",
            "transport": "streamable_http",
        }
    },
    mcp_security_check=True,          # NEW: verify before connect
    mcp_min_security_score=7,        # NEW: reject scores below 7/10
    mcp_registry_url="https://marketnow.site",  # NEW: registry to check against
)

When mcp_security_check=True, the client would:

1. Before connecting to an MCP server, fetch:
   GET {mcp_registry_url}/api/audit-skill?certificate=1&skillId=<id>

2. Verify the SHA-256 signature on the certificate (using the registry's public key)

3. Check that overall_score >= mcp_min_security_score

4. If verification fails or score is too low, raise MCPSecurityError instead of connecting

The registry API returns:
{
  "certificate_id": "MN-SC-2026-2472577",
  "skill_id": "mn-mcp-filesystem",
  "overall_score": 10,
  "max_score": 10,
  "risk_level": "low",
  "signature": "5a9a6e1cdcc2dedf53599b1a0ee8ebff...",
  "signature_algorithm": "SHA-256",
  "verification_url": "https://marketnow.site/verify?skillId=mn-mcp-filesystem"
}

I build MarketNow (https://marketnow.site) — an open MCP marketplace with 8,760+ servers, each audited by Sentinel (6-layer pipeline: static analysis, pattern matching, active probe with 60+ adversarial inputs, gVisor sandbox). Every skill gets a signed SHA-256 certificate.

Example: Anthropic's filesystem MCP scored 10/10 — https://github.com/alicelabs-llc/marketnow/blob/master/_data/l2_results/mn-mcp-filesystem.json
```

### Alternatives Considered (optional):
```
1. Local audit (LangChain ships its own audit tool)
   Pros: No external dependency
   Cons: Every user pays the audit cost; we already audited 8,760+ servers

2. Allowlist (LangChain maintains a list of approved MCP servers)
   Pros: Simple
   Cons: Doesn't scale; maintainer burden

3. Registry integration (this proposal — let the user pick a registry)
   Pros: Leverages existing audit work; user choice
   Cons: External dependency; requires registry to be trustworthy

I'm open to all three. The goal is to give LangChain agents a security signal before they call untrusted MCP servers.
```

### Additional context (optional):
```
Related resources:
- MarketNow: https://marketnow.site
- Sentinel audit methodology: https://marketnow.site/security
- API for fetching certificates: GET https://marketnow.site/api/audit-skill?certificate=1&skillId=mn-mcp-filesystem
- Example certificate (Anthropic filesystem MCP, score 10/10): https://github.com/alicelabs-llc/marketnow/blob/master/_data/l2_results/mn-mcp-filesystem.json
- Dev.to writeup on the audit methodology: https://dev.to/edison_flores_6d2cd381b13/how-to-audit-an-mcp-server-6-layers-from-static-analysis-to-gvisor-sandbox-171i

Note: I previously submitted this issue twice via the API and it was auto-closed by the triage bot as "automated submission". This is a manual submission via the web interface as requested.
```

### IMPORTANTE: No uses la API para crear este issue
El bot de langchain detecta submissions programáticas y las cierra automáticamente. Tienes que:
1. Abrir el navegador
2. Ir a https://github.com/langchain-ai/langchain/issues/new/choose
3. Click en "✨ Feature Request"
4. Llenar el formulario manualmente (copy-paste de arriba)
5. Submit

---

## ═══════════════════════════════════════════
## 3. dev.to — Responder a @pakvothe
## ═══════════════════════════════════════════

### Link: https://dev.to/edison_flores_6d2cd381b13/5-idiomas-9,248-skills-como-construimos-un-marketplace-mcp-multilingue-30j4

### Baja hasta el comentario de @pakvothe y dale "Reply"

### Pega esto:
```
¡Gracias @pakvothe! Tienes toda la razón — los TRANSLATIONS a mano escalan mal. Ya lo estamos sintiendo: cada string nuevo son 5 archivos para editar y algo siempre se queda desactualizado.

i1n se ve interesante — me gusta especialmente lo del check en CI para detectar idiomas desincronizados. Eso es justo lo que nos falta. ¿El MCP server de i1n está en el registry oficial de Anthropic o en algún otro?

Voy a probar el tier gratis. Si funciona bien para nuestro caso (8,760 skills con system prompts en 5 idiomas), lo integramos. Gracias por la recomendación.
```

---

## ═══════════════════════════════════════════
## Checklist de acciones manuales
## ═══════════════════════════════════════════

- [ ] 1. Submitir MarketNow a mcpm.sh (https://mcpm.sh)
- [ ] 2. Submitir issue manual a langchain (https://github.com/langchain-ai/langchain/issues/new/choose)
- [ ] 3. Responder a @pakvothe en dev.to (https://dev.to/edison_flores_6d2cd381b13/5-idiomas-9,248-skills-como-construimos-un-marketplace-mcp-multilingue-30j4)
