# MCP Security 101: Capítulo 5 — Monitoreo continuo y drift detection

La certificación es point-in-time. Los ataques son runtime. L3 cierra ese gap.

## El problema

Un MCP server puede pasar la auditoría L1.5 → L2 con score 10/10 el lunes. El martes, el maintainer hace un commit que añade una dependencia maliciosa. Sin L3, nadie lo detecta hasta la próxima auditoría manual.

## Qué hace L3

L3 re-audita cada skill **semanalmente** vía GitHub Actions y compara el comportamiento runtime contra el baseline capturado en la auditoría original.

## 6 tipos de drift detectados

### 1. Tool catalog drift
El server añade o elimina herramientas. Si originalmente exponía 5 tools y ahora expone 50, algo cambió.

### 2. Supply chain drift
Las dependencias cambiaron. Un `npm install` que antes traía 50 paquetes ahora trae 200 — posiblemente con un paquete malicioso nuevo.

### 3. Network drift
El server intenta conectarse a dominios nuevos. Si originalmente no hacía network calls y ahora llama a `evil.com`, drift detectado.

### 4. Config drift
La configuración del server cambió. Permisos, paths, o capacidades nuevas.

### 5. Credential drift
El server ahora accede a credenciales que antes no tocaba.

### 6. Process drift
El server ahora ejecuta procesos que antes no ejecutaba.

## Cómo se compara el baseline

En la auditoría L2, se captura un fingerprint:
```json
{
  "tools": ["search", "get", "list"],
  "dependencies": ["express@4.18", "zod@3.22"],
  "network": [],
  "fs_access": ["/tmp"],
  "processes": [],
  "credential_access": []
}
```

En cada re-auditoria L3, se compara contra el baseline. Si hay drift:
- **Drift level 1** (low): nueva tool añadida → notificación
- **Drift level 2** (medium): nueva dependencia → revisión requerida
- **Drift level 3** (high): nueva network call → cuarentena automática
- **Drift level 4** (critical): credential access nuevo → revocación del ATC

## Revocación de ATC

Si L3 detecta drift critical, el ATC del skill se revoca automáticamente:
```
POST /api/atc {action: "revoke", card_id: "ATC-2026-XXXX", reason: "L3 drift: credential_access detected"}
```

Future verify calls retornan `valid: false, reason: "revoked"`.

## Cron semanal

```yaml
# .github/workflows/sentinel-l3-monitor.yml
on:
  schedule:
    - cron: '0 2 * * 1'  # Lunes 02:00 UTC
```

Cada lunes a las 02:00 UTC, L3 re-audita todos los skills y compara contra el baseline.

## Auditoría gratis

Todo esto es gratis. El pipeline completo:
- L1.5 → L1.9 (síncrono, 5 segundos)
- L2 Docker sandbox (~2 minutos)
- L3 monitoreo continuo (semanal, automático)
- ATC firmada (Ed25519)
- Catálogo público
- Revocación automática si hay drift

```bash
curl -X POST https://marketnow.site/api/submit-skill \
  -H "Content-Type: application/json" \
  -d '{"repo_url": "https://github.com/your-username/your-mcp-server"}'
```

---

## Curso completo

1. ✅ Capítulo 1: Por qué tu MCP server necesita auditoría
2. ✅ Capítulo 2: Cómo el sandbox Docker detecta exfiltración
3. ✅ Capítulo 3: Las 32 reglas contra inyección de prompts
4. ✅ Capítulo 4: 28 firmas de familias de malware
5. ✅ Capítulo 5: Monitoreo continuo y drift detection

**Todo gratis. Sin pago. Sin suscripción. Sin trampa.**

- Submit: https://marketnow.site/submit
- Spec: https://marketnow.site/api/atc?action=spec
- GitHub: https://github.com/edgarfloresguerra2011-a11y/marketnow
- npm: `npx -y marketnow-mcp@1.7.0`

---

*MarketNow es construido por AliceLabs LLC (Wyoming, USA). Todo es gratis.*
