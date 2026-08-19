# MCP Security 101: Capítulo 1 — Por qué tu MCP server necesita auditoría

## Curso gratuito de seguridad para servidores MCP (Model Context Protocol)

### Capítulo 1 de 5

Si construyes servidores MCP, tu código va a ser ejecutado por agents que toman decisiones autónomas. Un MCP server con acceso a tu filesystem, tu red, o tus credenciales puede ser un vector de ataque. Este curso te enseña cómo auditarlo.

## ¿Por qué importa la seguridad MCP?

Los MCP servers son diferentes a las APIs tradicionales:

1. **Los agents los llaman automáticamente** — no hay un humano revisando cada llamada
2. **Tienen acceso a herramientas** — filesystem, red, código, credenciales
3. **Reciben prompts de LLMs** — que pueden contener inyecciones
4. **Se instalan globalmente** — un server comprometido compromete todo el sistema

Un MCP server malicioso puede:
- Exfiltrar tus credenciales (`.env`, API keys)
- Ejecutar código en tu máquina
- Modificar archivos sin que te des cuenta
- Inyectar prompts en el agent que lo usa

## Las 10 capas de auditoría de MarketNow

MarketNow audita MCP servers con un pipeline de 10 capas, todo gratis:

### L1.5 — Metadatos (síncrono, 5 segundos)
- ¿Tiene README? Un repo sin README es sospechoso
- ¿Tiene licencia? Un repo sin licencia es una responsabilidad legal
- ¿Está archivado? Un repo archivado no recibe updates de seguridad
- ¿Está actualizado? Un repo sin commits en 2 años puede tener vulnerabilidades conocidas

**Score**: 0-10. Si score < 4, se rechaza automáticamente.

### L1.6 — Análisis de patrones (síncrono)
- **36 reglas Semgrep**: detectan code smells, bugs de seguridad, y patrones peligrosos
- **18 patrones de secretos**: buscan API keys, tokens, y credenciales en el código
- **OSV dependency scan**: verifica si las dependencias tienen vulnerabilidades conocidas

### L1.7 — Detección de malware (síncrono)
- **8 patrones de malware**: badges de "Download Latest Release" que apuntan a zips externos, ejecutables ofuscados, etc.
- **Detección de binarios**: busca archivos .exe, .dll, .so dentro del repo
- **Detección de launchers**: scripts que ejecutan binarios descargados

### L1.8 — Firmas de familias de malware (síncrono)
- **28 firmas**: Emotet, LockBit, Cobalt Strike, Mimikatz, RedLine, Atomic Stealer, DarkGate, IcedID, BumbleBee, Pikabot, y más
- Cada firma es un patrón de comportamiento conocido (como YARA pero para metadatos)

### L1.9 — Defensa contra inyección de prompts (síncrono)
- **32 reglas** en 10 categorías:
  1. Inyección directa ("ignore previous instructions")
  2. Secuestro de rol ("you are now a different agent")
  3. Override de instrucciones
  4. Exfiltración de datos
  5. Escalada de privilegios
  6. Envenenamiento de contexto
  7. Evasión de encoding
  8. Ingeniería social
  9. Impersonación de herramientas
  10. Manipulación de memoria

### L2 — Sandbox Docker (asíncrono, ~2 minutos)
- **gVisor**: kernel de userspace — el server nunca toca el kernel real
- `--network none`: sin red — no puede exfiltrar datos
- `--read-only`: filesystem inmutable — no puede escribir
- `--cap-drop ALL`: sin capacidades — no puede escalar privilegios
- **Probe activo**: 60+ inputs adversariales (path traversal, SSRF, SQLi, command injection, prompt injection)

### L3 — Monitoreo continuo (semanal)
- Re-audita cada skill semanalmente
- Detecta drift: si el comportamiento del server cambia desde la auditoría original
- 6 tipos de drift: tool catalog, supply chain, network, config, credential, process

### WAF — Web Application Firewall
- 38 firmas de ataque: SQLi, XSS, SSRF, path traversal, command injection
- Auto-ban después de 5 hits

### Honeypot
- 50+ rutas falsas: `/.env`, `/admin`, `/wp-admin`, `/.git/config`
- Auto-ban de 24h si las tocan

### Threat Intel
- abuse.ch feeds: URLhaus (malware URLs), MalwareBazaar (malware samples), ThreatFox (IOCs)

## Cómo auditar tu servidor (gratis)

```bash
curl -X POST https://marketnow.site/api/submit-skill \
  -H "Content-Type: application/json" \
  -d '{"repo_url": "https://github.com/tu-usuario/tu-servidor-mcp"}'
```

Recibes:
- `submission_id` y `skill_id` inmediatamente
- L1.5 score (síncrono, ~5 segundos)
- L1.7 blocked/not-blocked (síncrono)
- L2 sandbox audit queued (~2 minutos via GitHub Actions)
- Si L2 pasa (score >= 7): promoted al catálogo + ATC firmada

## Próximo capítulo

**Capítulo 2**: Cómo el sandbox Docker detecta exfiltración de red con gVisor y --network none

---

*MarketNow es construido por AliceLabs LLC (Wyoming, USA). Todo es gratis. Submit tu servidor: https://marketnow.site/submit*
