# MarketNow — Infraestructura de Seguridad para Agentes IA

> MarketNow **no es un mercado**. Es infraestructura de seguridad para agentes IA. El mercado (9,248 skills MCP, todas gratuitas para instalar) es distribución. El producto es **Sentinel** — un pipeline de auditoría de 10 capas que determina si los agentes IA deberían confiar y ejecutar herramientas.

---

## Posicionamiento

| Concepto | Aclaración |
|----------|-----------|
| ¿Qué es MarketNow? | **Infraestructura de seguridad** para agentes IA |
| ¿Las 9,248 skills son gratis? | **Sí, para instalar** — son distribución |
| ¿Sentinel (auditoría) es gratis? | **No** — solo el tier Free básico. Tiers pagos desde $49 |
| ¿La ATC es gratis? | **No** — requiere tier Professional ($199-499) |
| ¿El servidor MCP es gratis? | **Sí** — `npx -y marketnow-mcp` es gratis de instalar y usar |

---

## Pricing (coherente con README.md principal)

| Tier | Precio | Qué incluye |
|------|--------|------------|
| **Free** | $0 | Sentinel scan básico, trust score, reporte público, listing público |
| **Developer** | $49–99 | Análisis estático profundo, análisis de dependencias, malware scan, prompt injection, sandbox, reporte firmado |
| **Professional** | $199–499 | Auditoría profunda, testing en runtime, remediación, **Trust Card (ATC)**, re-auditoría |
| **Continuous** | $99–499/mes | Monitoreo continuo, CVE tracking, dependencia drift, re-auditoría automática |
| **Enterprise** | $5k–50k+/año | Auditorías privadas, políticas custom, evidencia de compliance, API, dashboards, SLA |

---

## Servidor MCP v1.9.0 — 12 herramientas (namespace `marketnow_*`)

```bash
npx -y marketnow-mcp@1.9.0
```

Las 12 herramientas siguen el contrato estricto para agentes autónomos:

1. `marketnow_search_skills` — búsqueda por query / categoría / precio / sort
2. `marketnow_get_skill` — metadata completa de una skill
3. `marketnow_list_categories` — taxonomía con conteos
4. `marketnow_get_manifest` — metadata + métricas de seguridad
5. `marketnow_get_install_command` — comando npx para instalar
6. `marketnow_verify_trust` — verificar Agent Trust Card (Ed25519)
7. `marketnow_verify_receipt` — verificar recibo firmado (`rcpt_*`)
8. `marketnow_submit_skill` — subir repo de GitHub (L1.5+L1.7 sync)
9. `marketnow_mint_referral` — mint `ref_xxxxxxxx` (5% comisión)
10. `marketnow_lookup_referral` — stats de referidos
11. `marketnow_recommend_skills` — recomendaciones AI para una tarea
12. `marketnow_get_owasp_compliance` — OWASP MCP Cheat Sheet + fingerprints + capability manifest

**Reglas del contrato (ver AUDIT.md):**
- A. Nombres deterministas con prefijo `marketnow_`
- B. Descripciones orientadas a intención (WHEN/WHY, no WHAT)
- C. JSON-Schema estricto (type + enum + pattern + bounds)
- D. Respuestas estructuradas `{ content, isError }` con taxonomía de errores

---

## Stats (todos reales y públicos)

| Métrica | Valor |
|---------|-------|
| Chequeos de seguridad realizados | **1,211,488** |
| Skills MCP analizadas | 9,248 |
| Amenazas detectadas | **1,030** |
| Skills en cuarentena (críticas) | **80** |
| Skills marcadas como riesgosas | 71 |
| Skills marcadas con precaución | 879 |
| Verificadas seguras (score ≥ 8) | **8,288** |
| Corridas de sandbox gVisor | 257 |
| Agent Trust Cards emitidas | 57 |
| Algoritmo de CA | Ed25519 (RFC 8032) |
| Paquetes npm | `marketnow-mcp@1.9.0`, `marketnow-install-stack@1.1.0` |

Reporte de transparencia público: `GET https://marketnow.site/api/audit-report.json`

---

## Auditoría de 10 capas (Sentinel)

| Capa | Qué revisa | Tipo |
|------|------------|------|
| L1.5 | Metadatos (auth, CORS, OAuth, rate limiting) | Estático |
| L1.6 | 36 reglas Semgrep + 18 patrones de secretos + OSV | Estático |
| L1.7 | Patrones de malware (binarios, install scripts) | Estático |
| L1.8 | 48 firmas de familias de malware | Estático |
| L1.9 | 32 reglas de defensa contra prompt injection | Estático |
| L2.5 | Sandbox gVisor (network=none, read-only, cap-drop ALL) | Dinámico |
| L3 | Interceptor MCP en runtime (5 reglas de política) | Runtime |
| ATC | Agent Trust Card (Ed25519, RFC 8032, RFC 8785 JCS) | Identidad |
| x402 | Streaming metered billing ($0.01 USDC por call en Base) | Pago |
| A2A | Ejecución remota de agentes | Ejecución |

---

## Cómo subir tu servidor MCP

```bash
curl -X POST https://marketnow.site/api/submit-skill \
  -H "Content-Type: application/json" \
  -d '{"repo_url": "https://github.com/tu-usuario/tu-servidor-mcp"}'
```

El servidor corre L1.5 + L1.7 sincrónico, persiste a GitHub, y encola auditoría L2 (~1h).

---

## OWASP MCP Cheat Sheet Compliance

MarketNow cumple con la OWASP MCP Cheat Sheet (12 controles):

- ✅ **4 controles LIVE**: tool fingerprinting (SHA-256), capability declarations, least-privilege policy, structured error responses
- 📋 **8 controles PLANNED** para v5.1–v6.0 (ver ROADMAP.md)

Matriz pública: `GET https://marketnow.site/api/owasp`

---

## Links

- Web: https://marketnow.site
- Subir skill: https://marketnow.site/submit
- Reporte de auditoría: https://marketnow.site/api/audit-report.json
- OWASP compliance: https://marketnow.site/api/owasp
- Spec ATC: https://marketnow.site/api/atc?action=spec
- GitHub: https://github.com/alicelabs-llc/marketnow
- npm: `npx -y marketnow-mcp@1.9.0`

---

## Licencia

AliceLabs LLC Proprietary (MNNC-1.0). Para licenciar: legal@alicelabs.site

Construido por AliceLabs LLC (Wyoming, USA) — fundador Edison Flores.

## Timeline

- **2025**: AliceLabs LLC legally founded in Wyoming, USA (founder Edison Flores, Ecuadorian)
- **2026-03-30**: GitHub organization `github.com/alicelabs-llc` created
- **2026-06-29**: MarketNow launched publicly (first npm release: `marketnow-mcp@1.5.1`)
- **2026-08-09**: Current npm latest: `marketnow-mcp@1.10.0` (15 versions total)
- **2026-08-19**: Independent audit by Z.ai (8 findings F1-F8 applied, see REPORT.pdf)

