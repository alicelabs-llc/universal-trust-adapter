# Runbook de deploy — MarketNow (marketnow.site)

Operación de producción de `marketnow/aep-marketplace/` — repositorio canónico
`alicelabs-llc/universal-trust-adapter` (espejo verificable: `eddyflores100-lang/universal-trust-adapter`).

> Regla de oro: **producción = git**. Si un cambio existe en producción y no en
> `main` del canónico, eso es un incidente (fue el bug de agosto de 2026).

---

## 1. Prerequisitos (al INICIAR cada sesión)

```bash
git fetch canonical main && git status -sb
# Si estás detrás: git pull --ff-only canonical main
# Verifica que apuntas a main y estás sincronizado ANTES de tocar nada
```

- Tokens vigentes: GitHub (canónico con write / espejo con write) y Vercel.
- `node scripts/audit-gate.mjs` en verde local antes de cualquier push.

## 2. Flujo de deploy (el orden importa)

1. **Commit** todo cambio (ni un fix sin commit — el sandbox puede resetearse).
2. **Push** al canónico. Si tu push no dispara workflows, dispara manualmente:
   `POST /repos/alicelabs-llc/universal-trust-adapter/actions/workflows/audit-gate.yml/dispatches {"ref":"main"}`
3. **CI + Audit gate en GitHub deben quedar verdes** (Actions → "CI" y "Audit gate").
   El branch-protection de `main` exige: `UTA adapter tests`, `MarketNow asset gate + build`, `14-point consistency gate`.
4. **Deploy Vercel**: `vercel deploy --prod` (o deploys automáticos si hay Git-integration).
5. **Verificación post-deploy** (§4). Sin verificación, el deploy no está terminado.

## 3. Protocolo anti-divergencia

| Invariante | Cómo se mantiene | Qué lo vigila |
|---|---|---|
| repo = producción | deploy siempre desde `main` del canónico, nunca desde árboles locales sueltos | audit-gate `--live` (cron mensual + manual) |
| `api/mcp.js` version = `marketnow-mcp` npm = stats stamp | bump de versión en los 3 sitios en el mismo commit | gates `VERSIONS` + `NPM-SYNC` |
| cifras de catálogo (68,388 / 132,737 / tiers / free / paid / categorías) = bundle real | regenerar stats-base/catalog-meta al tocar `skills-lite.json` | gate `CATALOG` (14 checks) |
| AUDIT_REPORT.pdf íntegro | sha256/bytes publicados en `audit-status.json` | gate `PDF-SHA` |
| dumps gigantes (F-06) no vuelven | generador offline; prebuild es un gate, no un generador | `check-asset-sizes.mjs` (prebuild) + gate `NO-DUMPS` |
| hallazgos de auditoría cerrados con commit real | sin `fix_commit: "pending"` | gate `AUDIT-STATUS` |

**Reglas duras:**
- Ningún fix queda sin commit+push **el mismo día**.
- Al iniciar sesión: sincronizar el clon (§1) — el estado de producción vive en GitHub, no en tu máquina.
- Si npm va adelante del repo (`NPM-SYNC` FAIL): subir la versión del repo ANTES de cualquier merge.
- Cambiar datos de skills ⇒ regenerar `lib/stats-base.json` y `public/api/catalog-meta.json` desde el bundle y pasar el gate local.

## 4. Verificación post-deploy (checklist)

```bash
# 1. Gate completo contra producción (incluye MCP initialize + stats vivos)
node scripts/audit-gate.mjs --live
# 2. Spot-checks manuales mínimos
curl -s https://www.marketnow.site/api/agent.json | head -c 200   # 200
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" https://www.marketnow.site/robots.txt
curl -s -X POST https://www.marketnow.site/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"runbook","version":"1.0"}}}'
#   → serverInfo.version debe ser la del repo
curl -s -o /dev/null -w "%{http_code}\n" https://www.marketnow.site/some.sh   # 404 text/plain (fix anp2network)
```

## 5. Reauditoría programada

- **Automática**: workflow `Audit gate` corre en modo `--live` el día 1 de cada mes (cron). Un fallo abre el reporte de incidencias.
- **Trimestral**: emitir auditoría formal nueva (`AUD-YYYYMMDD`) con evidencia fresca: score OpenSSF actual, SHA-256 del PDF, commits de fix, y actualizar `public/trust/audit-status.json` (campo `next_reaudit_date`).

## 6. Espejos y respaldo

- Canónico: `alicelabs-llc/universal-trust-adapter` — fuente de verdad.
- Espejo: `eddyflores100-lang/universal-trust-adapter` — copia 1:1 de main (auto-mantenible: la cuenta del espejo es miembro admin de la org). Sincronizar con `git push mirror main` en cada cambio del canónico.
- El espejo NO recibe trabajo directo: todo cambio nace en el canónico y se replica.

## 7. Incidencias conocidas y resolución

| Síntoma | Causa | Acción |
|---|---|---|
| Push no dispara workflows | el actor tiene Actions deshabilitadas (pasa con la cuenta `alicelabsllc`) | push/dispatch con la cuenta `eddyflores100-lang`, o reactivar Actions en las settings de la cuenta |
| Deploy falla en prebuild | `check-asset-sizes.mjs` detectó un dump/archivo > límite | NO quitar el gate: regenerar datos con el generador offline y subir solo artefactos permitidos |
| `/api/stats.json` no coincide con el bundle | template stats-base desactualizado | sincronizar template con catalog-meta/bundle y pasar `audit-gate.mjs` |
| Dependabot abre decenas de PRs | normal tras activar la config | mergear los que pasen CI+gate, cerrar el resto; límite ya configurado |
