# MCP Security 101: Capítulo 2 — Cómo el sandbox Docker detecta exfiltración

El L2 corre tu MCP server en un Docker aislado con gVisor. Si intenta enviar datos a internet, escribir archivos, o ejecutar procesos, el sandbox lo detecta.

## gVisor + --network none + --read-only + --cap-drop ALL

```bash
docker run --runtime=runsc --network=none --read-only --cap-drop=ALL mcp-audit-target
```

- **gVisor**: kernel de userspace — el server nunca toca el kernel real
- **--network none**: sin red — no puede exfiltrar datos
- **--read-only**: filesystem inmutable — no puede escribir
- **--cap-drop ALL**: sin capacidades — no puede escalar

## Probe activo: 60+ inputs adversariales

Path traversal, SSRF, SQLi, command injection, prompt injection. El sandbox registra cada intento.

## Score L2

- 0 findings = score 10
- network_attempts × 3 + fs_write × 2 + process_spawns × 2 + credential_leakage × 5 = penalty

Audita gratis: https://marketnow.site/submit
