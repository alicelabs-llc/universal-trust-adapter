# Bug Fix C4: Renombrado OWASP MCP Top 10

## Estado
**CRÍTICO** — Bug detectado en ATC v2.0 RFC Draft 01

## Problema

El RFC actual mapeó incorrectamente los claims de OWASP MCP Top 10. OWASP publicó el orden oficial en 2025 (final release oct 2026):

| Claim actual (INCORRECTO) | Claim correcto (OWASP oficial) |
|---|---|
| `mcp01_tool_poisoning` | `mcp01_prompt_injection` (MCP01 = Token Mismanagement) |
| `mcp02_supply_chain` | `mcp02_tool_poisoning` (MCP02 = Privilege Escalation) |
| `mcp03_prompt_injection` | `mcp03_supply_chain` (MCP03 = Tool Poisoning) |
| `mcp04_command_injection` | `mcp04_command_injection` ✓ correcto |
| ... | ... (ver tabla completa abajo) |

## Mapeo OFICIAL OWASP MCP Top 10 (post-oct 2026)

| OWASP ID | Categoría oficial | Claim ATC correcto |
|---|---|---|
| MCP01 | Token Mismanagement & Secret Exposure | `mcp01_token_mismanagement` |
| MCP02 | Privilege Escalation via Scope Creep | `mcp02_privilege_escalation` |
| MCP03 | Tool Poisoning | `mcp03_tool_poisoning` |
| MCP04 | Software Supply Chain Attacks & Dependency Tampering | `mcp04_supply_chain` |
| MCP05 | Command Injection & Execution | `mcp05_command_injection` |
| MCP06 | Intent Flow Subversion | `mcp06_intent_flow_subversion` |
| MCP07 | Insufficient Authentication & Authorization | `mcp07_insufficient_authz` |
| MCP08 | Lack of Audit and Telemetry | `mcp08_audit_telemetry` |
| MCP09 | Shadow MCP Servers | `mcp09_shadow_servers` |
| MCP10 | Context Injection & Over-Sharing | `mcp10_context_injection` |

## Script de migración

### Archivos a renombrar

```typescript
// migration: rename OWASP claims to align with official OWASP MCP Top 10

const RENAMES: Record<string, string> = {
  // ANTIGUO (incorrecto) → NUEVO (oficial OWASP)
  'mcp01_tool_poisoning':       'mcp03_tool_poisoning',
  'mcp02_excessive_permissions': 'mcp02_privilege_escalation',
  'mcp03_data_exfiltration':     'mcp08_audit_telemetry',  // data exfil → audit
  'mcp04_prompt_injection':      'mcp01_token_mismanagement',
  'mcp05_ssrf':                  'mcp05_command_injection', // ssrf → command inj
  'mcp06_command_injection':    'mcp06_intent_flow_subversion',
  'mcp07_credential_leak':      'mcp07_insufficient_authz',
  'mcp08_supply_chain':         'mcp04_supply_chain',
  'mcp09_runtime_sandbox':      'mcp09_shadow_servers',
  'mcp10_audit_logging':        'mcp10_context_injection',
};

// Aplicar en:
// 1. Esquemas Zod (TypeScript)
// 2. Base de datos Supabase (tabla sentinel_certificates)
// 3. Certificados ATC existentes (campo payload.trust.audit_layers_passed)
// 4. Respuestas de /api/owasp
// 5. RFC ATC v2.0 Draft 01 → Draft 02
// 6. JSON Schema atc-v2.json
// 7. Ejemplos atc-skill.json, atc-agent.json, atc-runtime.json
```

## Impacto

- **Schema**: requiere update atc-v2.json (Draft 02)
- **Data**: certificados ATC ya emitidos necesitan re-emisión con claims renombrados
- **APIs**: `/api/owasp` devuelve los nombres oficiales
- **SDKs**: Python y TypeScript deben actualizarse
- **Tests**: todos los test vectors que mencionen OWASP claims deben actualizarse

## Aprobación

Este fix se aplica en ATC v2.0 Draft 02 y se propaga a UTS (Universal Trust Schema) cuando se publique.

## Estado de ejecución

- [x] Mapeo oficial identificado
- [x] Script de renombrado escrito (este archivo)
- [ ] Aplicado en schema JSON
- [ ] Aplicado en ejemplos
- [ ] Aplicado en RFC Draft 02
- [ ] Tests actualizados
