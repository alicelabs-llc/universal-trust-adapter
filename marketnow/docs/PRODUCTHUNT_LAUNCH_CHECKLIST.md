# 🚀 Product Hunt Launch — Checklist completo

## Por qué Product Hunt

Product Hunt puede traer **1,000-5,000 visitors en 24 horas** si el launch va bien. Es la forma más rápida de conseguir tráfico inicial y backlinks.

---

## Pre-launch (1 semana antes)

### ✅ Assets necesarios
- [ ] **GIF/Video demo** (60 segundos máximo)
  - Mostrar: búsqueda de MCP server → click → ver certificado → install
  - Herramienta: https://www.loom.com (gratis, fácil)
- [ ] **Galería de imágenes** (6 imágenes mínimo)
  - 1. Screenshot del registry con 9,248 skills
  - 2. Screenshot del certificado de seguridad (verify page)
  - 3. Diagrama del pipeline Sentinel (L1.5 → L2.5)
  - 4. Screenshot del gVisor sandbox result
  - 5. Logo de MarketNow
  - 6. Screenshot del API response
- [ ] **Tagline** (60 caracteres): "MCP marketplace with 6-layer security audits"
- [ ] **Descripción** (260 caracteres): "9,248 MCP skills, each security-audited by Sentinel (L1.5 static → L2.5 gVisor sandbox). 60+ adversarial inputs tested per server. Signed SHA-256 certificates. For Claude Desktop, Cursor, Cline."
- [ ] **First comment** (del founder): historia honesta de por qué lo construiste

### ✅ Hunter y Makers
- [ ] Encontrar un "Hunter" con 1000+ followers en Product Hunt
  - Buscar en: https://www.producthunt.com/hunters
  - Enviar DM: "Hi [name], I'm launching MarketNow next week — a security-audited MCP marketplace. Would you be interested in hunting it?"
- [ ] Reclutar "Makers" (3-5 personas que darán upvote y comentarán)
  - Amigos, seguidores, usuarios existentes

### ✅ Timing
- [ ] Lanzar a **00:01 AM Pacific Time** (medianoche PST)
  - Esto da 24 horas completas en la homepage
  - Martes o miércoles son los mejores días (menos competencia que lunes/jueves)

---

## Launch day

### 00:01 AM PST — Lanzar
- [ ] Submit en: https://www.producthunt.com/posts/new
- [ ] Verificar que todo se vea bien
- [ ] Publicar el "first comment" del founder:

```
Hey Product Hunt! 👋

I'm Edison, solo founder of MarketNow. I built this because the MCP ecosystem has a trust problem — anyone can publish an MCP server, and when you install one, it gets full access to your filesystem, network, and environment variables. No sandboxing. No audit. No security signal.

MarketNow fixes this. Every one of our 9,248 MCP skills goes through a 6-layer security audit (Sentinel):

🔹 L1.5 — Static analysis (deps, secrets, licenses)
🔹 L1.6 — Pattern-based behavioral analysis
🔹 L2 v2.0 — Active probe (60+ adversarial inputs: path traversal, SSRF, SQL injection, command injection, prompt injection, credential access)
🔹 L2.5 — gVisor sandbox (userspace kernel isolation — the tech behind Google Cloud Run)
🔸 L3 (Q1 2027) — Firecracker microVM
🔸 L4 (Q4 2026) — Supply chain attestation (SLSA Level 3)

What I found auditing 9,248 servers:
- 3 servers leaked environment variables when sent credential-access prompts (args passed to eval() without sanitization)
- 12 had hardcoded API keys in source code
- 1 attempted ptrace() (blocked by gVisor)
- 1 attempted bpf() (blocked by gVisor)

Every server gets a signed SHA-256 certificate with a score 0-10, verifiable at marketnow.site/verify.

I'd love feedback on the audit methodology — especially from people who have built sandboxing or security tools.

Built solo, no investors, no marketing budget. Just me and GitHub Actions. 🙏

Try it: marketnow.site/registry
GitHub: github.com/alicelabs-llc/marketnow
```

### 00:15 AM PST — Notificar
- [ ] **Email a tu lista** (si tienes una)
- [ ] **Tweet**: "We're live on Product Hunt! 🚀 MarketNow — the only MCP marketplace that security-audits every server with gVisor sandboxes. Check it out: [PH link]"
- [ ] **LinkedIn post**: usar docs/LINKEDIN_POST_V25.md
- [ ] **dev.to**: NO publicar artículo (penalización). En su lugar, actualizar un artículo existente con el link al PH launch en los comments
- [ ] **Slack/Discord communities**: compartir en canales de AI/ML/devtools
- [ ] **Reddit**: post en r/SideProject, r/IMadeThis (NO en r/mcp — está en la lista)

### Durante el día (cada 2-3 horas)
- [ ] **Responder TODOS los comentarios** en Product Hunt dentro de 1 hora
- [ ] **Agradecer upvotes** en Twitter
- [ ] **Monitorear tráfico** en Vercel Analytics

---

## Post-launch

### Día siguiente
- [ ] **Blog post**: "What I learned launching on Product Hunt" (dev.to, 3 días después)
- [ ] **Aprovechar backlinks**: los sites que mencionaron tu launch son backlinks gratis
- [ ] **Actualizar README**: añadir "Featured on Product Hunt" badge

### Métricas esperadas
| Métrica | Mínimo | Bueno | Excelente |
|---------|--------|-------|-----------|
| Upvotes | 50 | 200 | 500+ |
| Comentarios | 10 | 30 | 50+ |
| Visitas al sitio | 500 | 2,000 | 5,000+ |
| npm downloads | 50 | 200 | 500+ |
| GitHub stars | 5 | 20 | 50+ |
| Backlinks | 3 | 10 | 20+ |

---

## Errores comunes a evitar

1. **NO pedir upvotes directamente** — Product Hunt penaliza esto
2. **NO lanzar un viernes o fin de semana** — menos tráfico
3. **NO tener un producto roto** — prueba todo antes del launch
4. **NO desaparecer después del launch** — responde comentarios toda la semana
5. **NO publicar en Reddit el mismo día** — parece desesperado

---

## Lista de communities para compartir el launch

| Plataforma | Cuándo | Cómo |
|-----------|-------|------|
| Product Hunt | 00:01 PST | Submit |
| Twitter/X | 00:15 PST | Tweet |
| LinkedIn | 00:30 PST | Post |
| Hacker News | 08:00 PST | Show HN |
| Reddit r/SideProject | 09:00 PST | Post |
| Reddit r/IMadeThis | 10:00 PST | Post |
| dev.to | NO | Esperar 3 días |
| Slack communities | 10:00 PST | Compartir |
| Discord servers | 11:00 PST | Compartir |
| Email list | 12:00 PST | Newsletter |
