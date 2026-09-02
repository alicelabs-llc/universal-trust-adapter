# 🔍 Google Search Console — Guía COMPLETA de acciones

## ═══ Sitemaps: Qué agregar y qué NO ═══

### ✅ Sitemaps CORRECTOS para enviar

Solo hay UN sitemap principal. Pero puedes enviar sitemaps especializados:

| Sitemap | URL | Contenido | Estado |
|---------|-----|-----------|--------|
| **Principal** | `sitemap.xml` | 42 URLs (todas las páginas) | ✅ Ya enviado, Correcto |
| **Agentes** | `sitemap-agents.xml` | 12 URLs (endpoints para AI agents) | 🆕 NUEVO — enviar hoy |
| **Skills** | `sitemap-skills.xml` | Top 100 skills (próximamente) | ⏳ Pendiente |

### ❌ NO enviar estos como sitemaps (son páginas, no XML)

Estos te dieron error en Search Console:
- `/trust` ← ELIMINAR de Search Console
- `/security` ← ELIMINAR
- `/registry` ← ELIMINAR

**Solo se envían archivos `.xml` como sitemaps, nunca páginas HTML.**

---

## ═══ Acción 1: Eliminar sitemaps con error ═══

1. Ve a: https://search.google.com/search-console/sitemaps?resource_id=https%3A%2F%2Fmarketnow.site%2F
2. Click en `/trust` → botón "Eliminar sitemap"
3. Click en `/security` → botón "Eliminar sitemap"
4. Click en `/registry` → botón "Eliminar sitemap"

---

## ═══ Acción 2: Enviar el nuevo sitemap de agentes ═══

1. En la misma página de Sitemaps
2. En "Añadir un sitemap", ingresa: `sitemap-agents.xml`
3. Click "ENVIAR"
4. Esto le dice a Google: "estas son las páginas para AI agents"

---

## ═══ Acción 3: Solicitar indexación de páginas ═══

Para cada URL importante, usa "Inspección de URLs":

1. Ve a: https://search.google.com/search-console
2. Barra de búsqueda arriba: pega la URL
3. Click "Inspeccionar"
4. Si dice "La URL no está en Google" → click "Solicitar indexación"

### URLs prioritarias (una por una):

```
https://marketnow.site/
https://marketnow.site/for-agents          ← NUEVA página para agentes
https://marketnow.site/registry
https://marketnow.site/security
https://marketnow.site/trust
https://marketnow.site/pricing
https://marketnow.site/about
https://marketnow.site/handshake
https://marketnow.site/verify
https://marketnow.site/landing-pages/mcp-security-audit.html
https://marketnow.site/landing-pages/mcp-server-sandbox.html
```

**Importante:** Google permite ~10 requests de indexación por día.

---

## ═══ Acción 4: Verificar "Cobertura" (Coverage) ═══

1. Menú izquierdo → "Indexación" → "Páginas"
2. Esto muestra:
   - Páginas indexadas (objetivo: 40+)
   - Páginas no indexadas (revisa por qué)
   - Errores (arreglar)
   - Excluidas (revisar)

### Estados comunes:
- ✅ "Indexada" → bien
- ⚠️ "Detectada, no indexada" → necesita tiempo o más backlinks
- ❌ "Rastreada, no indexada" → Google no la considera útil
- ❌ "Redirigida" → hay una redirección incorrecta
- ❌ "Error de rastreo" → la página no carga

---

## ═══ Acción 5: Core Web Vitals ═══

1. Menú izquierdo → "Experiencia" → "Core Web Vitals"
2. Esto mide:
   - **LCP** (Largest Contentful Paint) → < 2.5s ideal
   - **FID** (First Input Delay) → < 100ms ideal
   - **CLS** (Cumulative Layout Shift) → < 0.1 ideal

**Nuestro sitio:** 0.03s TTFB (excelente, gracias a Vercel CDN)

---

## ═══ Acción 6: Verificar "Rendimiento" en búsquedas ═══

1. Menú izquierdo → "Rendimiento"
2. Esto muestra:
   - Clicks en resultados de Google
   - Impresiones (cuántas veces aparecemos)
   - CTR (Click-Through Rate)
   - Posición promedio

**Después de 1-2 semanas empezarás a ver datos aquí.**

---

## ═══ Acción 7: Google Rich Results Test ═══

Verifica que Google entienda nuestro structured data:

1. Ve a: https://search.google.com/test/rich-results
2. Pega: `https://marketnow.site/`
3. Click "Probar URL"
4. Debería mostrar:
   - ✅ Organization
   - ✅ WebSite
   - ✅ ItemList
   - ✅ SoftwareApplication

Si hay errores, te dirá exactamente qué arreglar.

---

## ═══ Acción 8: Google PageSpeed Insights ═══

1. Ve a: https://pagespeed.web.dev/
2. Pega: `https://marketnow.site/`
3. Click "Analizar"
4. Revisa Mobile y Desktop scores
5. Arregla cualquier sugerencia (imágenes, CSS, JS)

---

## ═══ Acción 9: Google Mobile-Friendly Test ═══

1. Ve a: https://search.google.com/test/mobile-friendly
2. Pega: `https://marketnow.site/`
3. Verifica que sea "Compatible con dispositivos móviles"

---

## ═══ Acción 10: Bing Webmaster Tools ═══

Bing tiene su propia herramienta (también usa IndexNow):

1. Ve a: https://www.bing.com/webmasters
2. Añade tu sitio: `marketnow.site`
3. Verifica propiedad (puedes usar el mismo archivo HTML de Google)
4. Submit sitemap: `sitemap.xml`
5. Usa "URL Submission" para indexar páginas rápido

**Bing ya nos indexa gracias a IndexNow, pero Webmaster Tools da datos adicionales.**

---

## ═══ Cómo hacer el sitio atractivo para AI agents ═══

### Lo que YA tenemos (verificado funcionando):

| Feature | URL | Estado |
|---------|-----|--------|
| MCP HTTP endpoint | `/api/mcp` | ✅ SSE + JSON-RPC |
| MCP stdio server | `npx -y marketnow-mcp` | ✅ npm |
| Agent Card (A2A) | `/.well-known/agent.json` | ✅ |
| OpenAI Plugin | `/.well-known/ai-plugin.json` | ✅ |
| MCP Discovery | `/.well-known/mcp.json` | ✅ |
| llms.txt | `/llms.txt` | ✅ |
| llms-full.txt | `/llms-full.txt` | ✅ |
| ai.txt | `/ai.txt` | ✅ |
| Agent discover | `/agent-discover.txt` | ✅ |
| Agent API | `/api/agent.json` | ✅ |
| Agent ping | `/api/agent-ping.json` | ✅ |
| Free skills API | `/api/free-skills.json` | ✅ |
| Security certs | `/api/audit-skill?certificate=1` | ✅ |
| **NUEVO: For Agents page** | `/for-agents` | 🆕 |

### Lo que hace un sitio atractivo para agentes:

1. **Machine-readable everything** → Cada endpoint devuelve JSON, no HTML
2. **Protocol-native** → MCP, A2A, JSON-RPC, x402 (no solo REST)
3. **Security certificates** → Los agentes pueden verificar antes de instalar
4. **Self-describing** → `/.well-known/` tiene todo lo que un agente necesita
5. **llms.txt** → Los LLMs (ChatGPT, Claude, Gemini) pueden entendernos
6. **Free tier** → 65 skills gratis, sin signup (los agentes pueden probar)
7. **Stable IDs** → `mn-xxx-00001` no cambia, los agentes pueden cachear
8. **Clear pricing** → free one-time, sin suscripciones complejas
9. **OpenAPI spec** → `/api/openapi.yaml` para que los agentes sepan todos los endpoints
10. **Agent-first page** → `/for-agents` con toda la info en un lugar

### Cómo los agentes nos descubren:

```
1. Agente busca "MCP server" en npm → encuentra marketnow-mcp
2. Agente lee package.json → ve .well-known/mcp.json URL
3. Agente fetch /.well-known/mcp.json → descubre herramientas
4. Agente se conecta via MCP (stdio o HTTP)
5. Agente llama search_skills("filesystem")
6. Agente recibe resultados con sentinel_score
7. Agente verifica certificado antes de instalar
8. Agente instala: npx -y marketnow-mcp
```

### Cómo los LLMs (ChatGPT, Claude) nos descubren:

```
1. LLM lab hace crawl de la web
2. Encuentra /llms.txt en nuestro robots.txt
3. Lee /llms.txt → entiende qué es MarketNow
4. Lee /llms-full.txt → documentación completa
5. Próxima vez que un usuario pregunta "MCP marketplace",
   el LLM puede recomendar MarketNow
```
