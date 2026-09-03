# 🔧 FIX SEO — Guía de reparación completa

## ═══ PROBLEMA #1: Google no indexa (6 de 40 páginas) ═══

### Solución: Google Search Console

1. **Ve a**: https://search.google.com/search-console
2. **Añade propiedad**: `marketnow.site`
3. **Verifica**: El archivo `googlecfd72b7c796e2ead.html` ya existe en el sitio (HTTP 200)
4. **Submit sitemap**:
   - Ve a "Sitemaps" en el menú izquierdo
   - Ingresa: `sitemap.xml`
   - Click "Submit"
5. **Request indexing** para cada página importante:
   - Ve a "URL Inspection"
   - Pega cada URL una por una:
     ```
     https://marketnow.site/
     https://marketnow.site/registry
     https://marketnow.site/security
     https://marketnow.site/trust
     https://marketnow.site/pricing
     https://marketnow.site/about
     https://marketnow.site/handshake
     https://marketnow.site/verify
     ```
   - Click "Request Indexing" en cada una

### Tiempo estimado: 5 minutos
### Resultado esperado: Google indexará 40+ páginas en 3-7 días

---

## ═══ PROBLEMA #2: Canonical duplicado (todas las páginas → /) ═══

### Solución: Ya arreglado con JS dinámico

Añadí un script en `index.html` que actualiza el canonical y el title según la ruta:
- `/registry` → canonical: `https://marketnow.site/registry`, title: "Browse 9,248 MCP Skills — MarketNow Registry"
- `/trust` → canonical: `https://marketnow.site/trust`, title: "Trust Roadmap — Sentinel v3.0"
- `/security` → canonical: `https://marketnow.site/security`, title: "Sentinel v3.0 Security Audit"
- (y 17 rutas más)

**Esto era el problema #1 de SEO técnico** — Google veía todas las páginas como duplicadas del homepage.

---

## ═══ PROBLEMA #3: dev.to suprimió artículos (spam penalty) ═══

### Solución: PARAR de publicar por 7 días

**Datos:**
```
Jul 2: 5 artículos → 24.8 views/artículo (normal)
Jul 4: 6 artículos → 8.3 views/artículo (penalización empezando)
Jul 7: 10 artículos → 6.1 views/artículo (SUPRIMIDO)
```

### Plan de publicación (1 artículo cada 3 días):

| Fecha | Artículo |
|-------|----------|
| Jul 10 | "How I built a 6-layer security audit for 9,248 MCP skills" |
| Jul 13 | "The MCP security checklist: 10 things to check before installing any MCP server" |
| Jul 16 | "gVisor vs Docker vs Firecracker: which sandbox for MCP servers?" |
| Jul 19 | "I found 3 MCP servers leaking environment variables — here's how" |
| Jul 22 | "How to build an MCP server with HTTP transport (Vercel serverless)" |
| Jul 25 | "MCP marketplace comparison: Smithery vs Glama vs MarketNow" |

**Regla de oro: NUNCA publicar más de 1 artículo por día.**

---

## ═══ PROBLEMA #4: 0 backlinks de calidad ═══

### Solución: Outreach a blogs y YouTubers

#### Email template para bloggers:
```
Subject: Security-audited MCP marketplace — would this interest your readers?

Hi [Name],

I read your article "[article title]" — great breakdown of MCP security risks.

I've been building MarketNow (marketnow.site), a marketplace where every MCP server gets security-audited with a 6-layer pipeline:
- L1.5: Static analysis (deps, secrets, licenses)
- L1.6: Pattern-based behavioral analysis
- L2 v2.0: Active probe (60+ adversarial inputs)
- L2.5: gVisor sandbox (userspace kernel isolation)

9,248 servers audited. 3 were removed for leaking environment variables.

Would you be interested in mentioning it in a future article? Happy to provide:
- An exclusive angle (e.g., "I audited Anthropic's official MCP server")
- Data from our audit (what vulnerabilities we found)
- A quote or interview

No pressure — just thought it might be relevant given your coverage of MCP security.

Best,
Edison Flores
AliceLabs LLC
marketnow.site
```

#### Targets (blogs que escriben sobre MCP):
1. **Ox Security** — https://www.ox.security/blog
2. **Aembit** — https://aembit.io/blog
3. **Snyk** — https://snyk.io/blog
4. **Semgrep** — https://semgrep.dev/blog
5. **Praetorian** — https://praetorian.com/blog
6. **Trail of Bits** — https://blog.trailofbits.com
7. **Cure53** — https://cure53.de

---

## ═══ PROBLEMA #5: 0 followers en todo ═══

### Solución: Crear presencia social

#### Twitter/X (CRÍTICO):
1. Crear cuenta: @MarketNowSite (o @MarketNow_MCP)
2. Bio: "Trust layer for agent commerce. 9,248 MCP skills, each security-audited by Sentinel v3.0 gVisor sandbox. 🛡️"
3. Empezar a responder tweets sobre MCP:
   - Buscar: "MCP server" en Twitter
   - Responder con valor real (no solo "check out marketnow.site")
   - Ejemplo: "We audited 9,248 MCP skills with gVisor sandboxes — 3 were leaking env vars. Full results: [link]"

#### LinkedIn Company Page:
1. Crear: https://www.linkedin.com/company/marketnow
2. Post inicial: usar docs/LINKEDIN_POST_V25.md
3. Conectar con: Anthropic, Cursor, Continue.dev, Cline devs

#### dev.to (build followers):
1. Comentar en 5 artículos de otros cada día
2. Reaccionar (unicorn/heart) a artículos relevantes
3. Seguir a: @ecap0, @chunxiaoxx, @ricco020, @instatunnel (escriben sobre MCP security)

---

## ═══ PROBLEMA #6: No ranking para ningún keyword ═══

### Solución: Long-tail keyword strategy

No podemos competir por "MCP marketplace" (mcpmarket.com, smithery.ai tienen más autoridad).

Pero SÍ podemos competir por long-tail keywords:

| Keyword | Volumen mensual | Competencia | Nuestra ventaja |
|---------|----------------|-------------|-----------------|
| "MCP server security audit" | ~500 | Media | Único con gVisor |
| "gVisor MCP server" | ~100 | Baja | Único |
| "MCP server vulnerability scanner" | ~300 | Media | 9,248 audited |
| "Sentinel MCP audit" | ~50 | Muy baja | Marca propia |
| "MCP server sandbox" | ~200 | Baja | gVisor L2.5 |
| "audit MCP server before install" | ~100 | Baja | Único |

### Acción:
- Optimizar cada artículo de dev.to para 1 long-tail keyword
- Usar la keyword en: título, URL, first paragraph, H2 headings
- Crear páginas landing optimizadas:
  - `/mcp-security-audit` (para "MCP server security audit")
  - `/mcp-server-sandbox` (para "MCP server sandbox")
  - `/gvisor-mcp` (para "gVisor MCP server")

---

## ═══ PROBLEMA #7: Sin engagement en dev.to ═══

### Solución: Engagement strategy

#### Comentar en artículos de otros (5 por día):
Buscar en dev.to tags: #mcp, #ai, #security, #claude, #cursor

#### Ejemplos de comentarios útiles (NO spam):
```
"Great article! We've been doing something similar with gVisor sandboxes for MCP servers. One thing we found: gVisor doesn't implement bpf(), so any server trying to load eBPF gets ENOSYS. That's a nice security property. Full writeup: [link]"
```

```
"Interesting approach. Have you considered using --read-only rootfs + tmpfs /tmp? That prevents writes to the container filesystem while still allowing temp files. We use this in our MCP audit pipeline."
```

#### Reglas:
- NUNCA comentar solo con un link
- SIEMPRE aportar valor técnico primero
- El link va al final, como "más info"
- Responder a respuestas (genera conversación)
