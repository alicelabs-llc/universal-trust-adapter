# MarketNow Universal Trust Adapter — Plan Estratégico v3.0

> **Pivot estratégico**: MarketNow deja de competir como "otro estándar" y se convierte en el **adaptador universal** que traduce entre TODOS los estándares de confianza de agentes IA. Como USB-C no compite con HDMI o DisplayPort — se convierte en el conector universal que los une a todos.

---

## 1. La Visión: El USB-C de la Confianza entre Agentes

### El problema que estamos resolviendo

En agosto 2026, hay **5 estándares de identidad/confianza para agentes IA** compitiendo:

| Estándar | Quién lo controla | Formato criptográfico |
|----------|-------------------|----------------------|
| ATC v2.0 | AliceLabs (MarketNow) | Ed25519 + RFC 8785 JCS |
| EAT-AI | IETF (draft-messous-eat-ai-00) | CWT/CBOR + COSE |
| ZTA | Anthropic | JSON + firma propietaria |
| A2A Agent Card | Google + AAIF (Linux Foundation) | JSON-LD + OAuth |
| MCP Server Card | Anthropic (MCP spec) | JSON metadata (sin firma) |

**Ninguno se habla con otro.** Un agente con tarjeta ATC no puede verificar un agente con ZTA. Un agente A2A no puede confiar en un MCP Server. Cada ecosistema es una isla.

### La solución: No competir — adaptar

MarketNow no necesita ganar la guerra de estándares. Necesita ser **el traductor universal** que conecta todas las islas. Como **Zapier conecta aplicaciones**, MarketNow conecta estándares de confianza.

```
┌─────────┐     ┌─────────────────────┐     ┌─────────┐
│  ATC    │────▶│                     │◀────│ EAT-AI  │
│ v2.0    │     │   MARKETNOW UTA     │     │ (IETF)  │
└─────────┘     │   (Universal Trust │     └─────────┘
                │    Adapter)         │
┌─────────┐     │                     │     ┌─────────┐
│  ZTA    │────▶│  traduce cualquier  │◀────│  A2A    │
│(Anthropic)│  │  formato a cualquier│     │ (Google)│
└─────────┘     │  otro formato       │     └─────────┘
                │                     │
┌─────────┐     │                     │     ┌─────────┐
│  MCP    │────▶│                     │◀────│  W3C    │
│ Card    │     │                     │     │   VC    │
└─────────┘     └─────────────────────┘     └─────────┘
                         │
                         ▼
                  ┌─────────────┐
                  │  Universal  │
                  │ Trust Schema│
                  │   (UTS)     │
                  └─────────────┘
```

### Por qué esto es mejor que competir

1. **No hay lock-in**: Los usuarios pueden emitir en ATC y verificar en EAT-AI, o viceversa. MarketNow es el pegamento, no la jaula.
2. **No dependes de que un estándar gane**: Si EAT-AI gana, MarketNow traduce ATC→EAT. Si ZTA gana, MarketNow traduce ATC→ZTA. Si todos coexisten, MarketNow es el único que los conecta a todos.
3. **Adopción sin fricción**: Un equipo que ya usa ZTA no tiene que migrar a ATC — solo instala el adaptador MarketNow y automáticamente puede verificar tarjetas ATC y EAT-AI.
4. **Moat real**: El moat no es "tenemos 9,248 skills" ni "tenemos un estándar propio". El moat es "somos el único traductor universal que conecta todos los ecosistemas de agentes".

---

## 2. Bug Fixes Inmediatos

### C4: Corrección del mapeo OWASP MCP Top 10

**Bug detectado**: El RFC actual de ATC mapeó incorrectamente los claims de OWASP:

| Claim actual (incorrecto) | Claim correcto (OWASP oficial) |
|---------------------------|-------------------------------|
| `mcp01_tool_poisoning` | `mcp01_prompt_injection` |
| `mcp02_supply_chain` | `mcp02_tool_poisoning` |
| `mcp03_prompt_injection` | `mcp03_supply_chain` |

**Corrección**: Ejecutar script que renombre los claims en:
- Esquemas Zod (TypeScript)
- Base de datos Supabase ( tabla `sentinel_certificates`)
- Certificados ATC existentes (campo `payload.trust.audit_layers_passed`)
- Respuestas de `/api/owasp`

### C1: Conflicto criptográfico con IETF

**Problema**: ATC v2.0 usa exclusivamente Ed25519 + RFC 8785 JCS. Esto crea fricción con:
- IETF EAT-AI (que usa CWT/CBOR + COSE)
- Enterprise/military (que requiere TEE attestation)
- W3C VC (que usa JSON-LD + LD-Signatures)

**Solución**: ATC v3.0 adopta **multi-formato criptográfico**. Una tarjeta ATC puede estar firmada en múltiples formatos simultáneamente:

```json
{
  "card_id": "ATC-2026-XXXXX",
  "payload": { ... },
  "signatures": [
    {
      "format": "atc-ed25519",
      "algorithm": "Ed25519 (RFC 8032)",
      "canonicalization": "RFC_8785_JCS",
      "value": "..."
    },
    {
      "format": "eat-cwt",
      "algorithm": "ES256",
      "encoding": "CBOR",
      "value": "..."
    },
    {
      "format": "w3c-vc",
      "algorithm": "Ed25519Signature2020",
      "proof": { ... }
    }
  ]
}
```

Un verificador puede usar el formato que tenga disponible. No necesita soportar todos — solo el que su ecosistema use.

---

## 3. Universal Trust Schema (UTS)

### El schema canónico interno

UTS es la representación universal a la que TODOS los formatos se traducen. No es un estándar de salida — es un estándar de traducción interna. Como cómo Unicode es el formato interno de todos los sistemas operativos, pero cada uno muestra UTF-8, UTF-16, o Latin-1 al usuario.

```typescript
interface UniversalTrustSchema {
  // ── WHO is this entity? ──
  subject: {
    id: string;                    // "agent-123" | "mcp-server-456"
    name: string;                  // "My Agent" | "Weather API MCP"
    type: 'agent' | 'tool' | 'service' | 'human' | 'organization';
    description?: string;
  };

  // ── HOW do we verify identity? ──
  identity: {
    public_key?: string;           // PEM or base64
    key_algorithm?: 'Ed25519' | 'ECDSA-P256' | 'RSA-2048' | 'secp256k1';
    key_id?: string;               // identifier for key rotation
    attestation?: {                // for TEE-based verification
      type: 'SGX' | 'TrustZone' | 'SEV-SNP' | 'None';
      quote?: string;
    };
    oauth_subject?: string;        // if OAuth-based identity
    did?: string;                  // W3C DID
  };

  // ── HOW MUCH do we trust? ──
  trust: {
    score: number;                 // 0-10
    confidence: 'low' | 'medium' | 'high';
    evidence: TrustEvidence[];      // list of evidence pieces
    assessor: string;               // "MarketNow" | "Anthropic" | "self"
    assessed_at: string;            // ISO timestamp
    expires_at?: string;
  };

  // ── WHAT can it do? ──
  capabilities: {
    provides: string[];             // ["search", "read", "write"]
    requires: string[];             // ["auth", "payment"]
    protocols: string[];            // ["mcp", "a2a", "jsonrpc", "rest"]
    rate_limits?: { requests: number; window: string };
  };

  // ── WHAT is allowed? ──
  policy?: {
    max_spend_usd?: number;
    allowed_actions?: string[];
    denied_actions?: string[];
    allowed_networks?: string[];
    filesystem_access?: 'none' | 'read' | 'read-write';
    shell_access?: 'none' | 'sandboxed' | 'unrestricted';
  };

  // ── WHERE did it come from? ──
  provenance: {
    source: 'marketnow' | 'claude' | 'mcp-registry' | 'a2a-network' | 'self-signed';
    source_url?: string;
    artifact_hash?: string;         // sha256 of the source code/binary
    commit_sha?: string;
    registry_id?: string;
  };

  // ── WHEN is it valid? ──
  lifecycle: {
    issued_at: string;
    expires_at?: string;
    revoked: boolean;
    revocation_url?: string;
    version: string;
  };

  // ── WHAT format is this in? (metadata, not content) ──
  format: {
    type: 'atc-v2' | 'atc-v3' | 'eat-ai' | 'zta' | 'a2a-card' | 'mcp-card' | 'w3c-vc' | 'oauth-token';
    version: string;
    raw: any;                        // original payload in its native format
  };
}

interface TrustEvidence {
  type: 'sentinel-audit' | 'static-analysis' | 'sandbox-test' | 'human-review' | 'on-chain-verification' | 'tee-attestation';
  source: string;
  result: 'pass' | 'fail' | 'warn' | 'info';
  details?: string;
  timestamp: string;
  evidence_hash?: string;
}
```

### Reglas de traducción

Cada adaptador implementa 2 funciones:

```typescript
// Convierte DE un formato específico AL schema universal
function fromNative(payload: any): UniversalTrustSchema

// Convierte DEL schema universal A un formato específico
function toNative(uts: UniversalTrustSchema): any
```

**Ejemplo — Adaptador EAT-AI**:

```typescript
// EAT-AI (CBOR/CWT) → UTS
function fromEAT(eatToken: Uint8Array): UniversalTrustSchema {
  const claims = decodeCWT(eatToken);  // CBOR Web Token
  return {
    subject: {
      id: claims.sub,
      name: claims.name || claims.sub,
      type: 'agent',
    },
    identity: {
      public_key: claims.cnf?.jwk,
      key_algorithm: 'ES256',
      attestation: claims.ueid ? { type: 'SGX', quote: claims.ueid } : undefined,
    },
    trust: {
      score: claims.trust_score || 0,
      confidence: claims.trust_level || 'low',
      evidence: claims.evidence || [],
      assessor: claims.iss,
      assessed_at: claims.iat,
      expires_at: claims.exp,
    },
    // ...
    format: { type: 'eat-ai', version: 'draft-00', raw: claims },
  };
}
```

**Ejemplo — Adaptador ZTA (Anthropic)**:

```typescript
// ZTA → UTS
function fromZTA(ztaPayload: any): UniversalTrustSchema {
  return {
    subject: {
      id: ztaPayload.agent_id,
      name: ztaPayload.agent_name,
      type: 'agent',
    },
    identity: {
      public_key: ztaPayload.identity?.public_key,
      key_algorithm: ztaPayload.identity?.key_algorithm || 'Ed25519',
    },
    trust: {
      score: ztaPayload.trust?.score || 0,
      evidence: ztaPayload.trust?.evidence || [],
      assessor: 'Anthropic',
      assessed_at: ztaPayload.metadata?.issued_at,
    },
    capabilities: {
      provides: ztaPayload.capabilities?.provides || [],
      protocols: ['anthropic'],
    },
    // ...
    format: { type: 'zta', version: '1.0', raw: ztaPayload },
  };
}
```

---

## 4. Arquitectura de Bloques Lego

### Cada adaptador es un bloque independiente

```
@marketnow/trust-core              ← UTS schema + translation engine
├── @marketnow/trust-adapter-atc   ← ATC v2.0/v3.0 format
├── @marketnow/trust-adapter-eat   ← IETF EAT-AI (CWT/CBOR)
├── @marketnow/trust-adapter-zta   ← Anthropic ZTA
├── @marketnow/trust-adapter-a2a   ← Google A2A Agent Card
├── @marketnow/trust-adapter-mcp   ← MCP Server Card
├── @marketnow/trust-adapter-vc    ← W3C Verifiable Credentials
├── @marketnow/trust-adapter-oauth ← OAuth 2.0 / OIDC tokens
└── @marketnow/trust-adapter-custom ← Plugin system for proprietary formats
```

### Instalación selectiva (como Legos)

```bash
# Solo necesitas ATC + EAT-AI
npm install @marketnow/trust-core @marketnow/trust-adapter-atc @marketnow/trust-adapter-eat

# O todo
npm install @marketnow/trust-core @marketnow/trust-adapter-all

# O crear tu propio adaptador
npm install @marketnow/trust-adapter-template
```

### El motor de traducción

```typescript
// Uso simple
import { TrustEngine } from '@marketnow/trust-core';
import { ATCAdapter } from '@marketnow/trust-adapter-atc';
import { EATAdapter } from '@marketnow/trust-adapter-eat';

const engine = new TrustEngine({
  adapters: [new ATCAdapter(), new EATAdapter()],
});

// Traducir de ATC a EAT-AI
const atcCard = loadATC('ATC-2026-0325620');
const eatToken = engine.translate(atcCard, {
  from: 'atc-v2',
  to: 'eat-ai',
});

// Verificar cualquier formato (auto-detección)
const result = engine.verify(unknownPayload);
// → { format: 'zta', valid: true, uts: {...} }

// Emitir en múltiples formatos simultáneamente
const credentials = engine.issue({
  subject: { id: 'my-agent', name: 'My Agent', type: 'agent' },
  identity: { public_key: '...', key_algorithm: 'Ed25519' },
  trust: { score: 8, assessor: 'MarketNow' },
  formats: ['atc-v2', 'eat-ai', 'zta', 'a2a-card'],
});
// → { atc: {...}, eat: Uint8Array, zta: {...}, a2a: {...} }
```

### Auto-detección de formato

```typescript
// El motor detecta automáticamente el formato
const payload = /* cualquier cosa: JSON, CBOR, base64 */;
const detected = engine.detectFormat(payload);
// → { format: 'eat-ai', confidence: 0.95 }

// Luego verifica usando el adaptador correcto
const result = engine.verify(payload);
// → { valid: true, format: 'eat-ai', uts: {...}, warnings: [] }
```

---

## 5. Universal Trust API

### Endpoints

#### `POST /api/trust/translate`
Traduce un payload de un formato a otro.

```json
{
  "from": "atc-v2",
  "to": "eat-ai",
  "payload": { ... ATC card ... }
}
→ { "format": "eat-ai", "payload": Uint8Array, "uts": {...} }
```

#### `POST /api/trust/verify`
Verifica cualquier formato (auto-detección).

```json
{
  "payload": { ... cualquier formato ... }
}
→ {
  "valid": true,
  "detected_format": "zta",
  "uts": { ... schema universal ... },
  "warnings": ["trust score below threshold"]
}
```

#### `POST /api/trust/issue`
Emite credenciales en múltiples formatos simultáneamente.

```json
{
  "subject": { "id": "my-agent", "type": "agent" },
  "identity": { "public_key": "...", "algorithm": "Ed25519" },
  "trust": { "score": 8, "evidence": [...] },
  "formats": ["atc-v3", "eat-ai", "zta", "a2a-card"]
}
→ {
  "credentials": {
    "atc": { ... ATC v3 card ... },
    "eat": "base64:CWT-encoded-token",
    "zta": { ... ZTA payload ... },
    "a2a": { ... A2A Agent Card ... }
  }
}
```

#### `GET /api/trust/formats`
Lista todos los adaptadores disponibles.

```json
→ {
  "formats": [
    { "id": "atc-v2", "name": "ATC v2.0", "status": "stable" },
    { "id": "atc-v3", "name": "ATC v3.0 (multi-sig)", "status": "beta" },
    { "id": "eat-ai", "name": "IETF EAT-AI", "status": "experimental" },
    { "id": "zta", "name": "Anthropic ZTA", "status": "experimental" },
    { "id": "a2a-card", "name": "Google A2A Agent Card", "status": "planned" },
    { "id": "mcp-card", "name": "MCP Server Card", "status": "planned" },
    { "id": "w3c-vc", "name": "W3C Verifiable Credentials", "status": "planned" }
  ]
}
```

#### `POST /api/trust/bridge`
Conecta dos ecosistemas: verifica en uno y emite en otro.

```json
{
  "verify_in": "zta",
  "issue_as": "atc-v3",
  "payload": { ... ZTA from Anthropic ... },
  "policy": { "min_trust_score": 7 }
}
→ {
  "verified": true,
  "original": { "format": "zta", "uts": {...} },
  "issued": { "format": "atc-v3", "card": {...} },
  "bridge_log": "ZTA score 8 → ATC score 8 (1:1 mapping)"
}
```

---

## 6. Plan de Ejecución — 6 Meses

### Mes 1 (Septiembre 2026): Fundaciones

| Semana | Tarea | Entregable |
|--------|-------|------------|
| 1 | Bug fix C4 (OWASP mapping) | Script de renombrado + deploy |
| 1 | Bug fix C1 (multi-formato) | ATC v3.0 spec draft con `signatures[]` array |
| 2 | UTS spec completa | `universal-trust-schema.json` publicado |
| 2 | Trust engine core (TypeScript) | `@marketnow/trust-core` npm package |
| 3 | ATC adapter (from/to UTS) | `@marketnow/trust-adapter-atc` |
| 4 | EAT-AI adapter (CBOR/CWT) | `@marketnow/trust-adapter-eat` |
| 4 | Tests: ATC↔EAT traducción bidireccional | 20+ test vectors |

**Costo**: $0 (todo desarrollo propio, infra ya pagada)

### Mes 2 (Octubre 2026): Adaptadores de Ecosistema

| Semana | Tarea | Entregable |
|--------|-------|------------|
| 1 | ZTA adapter (Anthropic) | `@marketnow/trust-adapter-zta` |
| 2 | A2A Agent Card adapter | `@marketnow/trust-adapter-a2a` |
| 3 | MCP Server Card adapter | `@marketnow/trust-adapter-mcp` |
| 4 | Universal Trust API (REST) | Endpoints: translate, verify, issue, bridge |

**Costo**: $0

### Mes 3 (Noviembre 2026): Auto-detección + Bridge

| Semana | Tarea | Entregable |
|--------|-------|------------|
| 1 | Auto-detección de formato | `engine.detectFormat()` |
| 2 | Bridge API (ecosystem↔ecosystem) | `POST /api/trust/bridge` |
| 3 | W3C VC adapter | `@marketnow/trust-adapter-vc` |
| 4 | OAuth/OIDC adapter | `@marketnow/trust-adapter-oauth` |

**Costo**: $0

### Mes 4 (Diciembre 2026): SDKs + Documentación

| Semana | Tarea | Entregable |
|--------|-------|------------|
| 1 | SDK npm (TypeScript) | `npm install @marketnow/trust-core` |
| 2 | SDK PyPI (Python) | `pip install marketnow-trust` |
| 3 | Documentación completa | trust.marketnow.site/docs |
| 4 | Plugin system para formatos custom | `@marketnow/trust-adapter-template` |

**Costo**: $0

### Mes 5 (Enero 2027): Adopción + Interoperabilidad

| Semana | Tarea | Entregable |
|--------|-------|------------|
| 1 | Tests de interoperabilidad con A2A real | Bridge A2A↔ATC funcionando |
| 2 | Tests con MCP Server Cards reales | Bridge MCP↔ATC funcionando |
| 3 | Demo: agente Claude verifica agente OpenAI | Video + blog post |
| 4 | Casos de uso enterprise documentados | 5 vertical-specific demos |

**Costo**: $0

### Mes 6 (Febrero 2027): Estándar Abierto

| Semana | Tarea | Entregable |
|--------|-------|------------|
| 1 | Postular UTS a AAIF (Linux Foundation) | Propuesta formal |
| 2 | Publicar spec como RFC abierto | trust.marketnow.site/spec |
| 3 | Open source todos los adaptadores | GitHub + MIT license |
| 4 | Anuncio público + dev.to + HN | "Universal Trust Adapter — one API, all agent trust standards" |

**Costo**: $0

---

## 7. Pitch para Inversionistas y Compradores

### Narrativa anterior (obsoleta)

> "MarketNow es el marketplace de MCP con 9,248 skills y un estándar propio de tarjetas de confianza (ATC)."

**Problema**: Compites contra Anthropic (ZTA), Google (A2A), IETF (EAT-AI). No puedes ganar una guerra de estándares contra corporaciones de miles de millones.

### Narrativa nueva (Universal Trust Adapter)

> "MarketNow es el adaptador universal de confianza para agentes IA. No competimos con ningún estándar — los conectamos a todos. Como Zapier conecta aplicaciones, MarketNow conecta estándares de trust."
>
> "Un agente con tarjeta ATC puede verificar un agente con ZTA de Anthropic. Un agente A2A de Google puede confiar en un MCP Server. Un token EAT-AI del IETF se traduce a un W3C Verifiable Credential en 1 llamada API."
>
> "No hay lock-in. No hay estándar propietario. Solo hay un traductor universal que ya funciona en producción y cuesta $0/mes mantener."

### Para acqui-hire / tech transfer

> "Lo que compran no es un estándar. Compran el único código que traduce entre ATC, EAT-AI, ZTA, A2A y MCP — los 5 estándares que van a definir el ecosistema de agentes IA en 2027. Sin este adaptador, cada empresa tendría que implementar 5 integraciones separadas. Con MarketNow, implementan 1."

### Métricas que importan

| Métrica | Valor actual | Target Q1 2027 |
|---------|---------------|-----------------|
| Formatos soportados | 1 (ATC) | 7 (ATC, EAT, ZTA, A2A, MCP, VC, OAuth) |
| Traducciones bidireccionales | 0 | 42 pares (7×6) |
| npm downloads/semana | 1,369 | 10,000+ |
| Costo mensual | $0 | $0 |
| Ecosistemas conectados | 1 (MarketNow) | 5+ (Claude, OpenAI, Google, IETF, W3C) |

---

## 8. Por qué esto es robusto y no hackeable

### No depende de ningún estándar ganando

Si mañana Anthropic abandona ZTA → el adaptador ZTA se desactiva, los demás siguen funcionando.
Si el IETF cambia EAT-AI → actualizamos el adaptador EAT, los demás siguen intactos.
Si sale un estándar nuevo (ej. "OpenAI Trust Tokens") → creamos un nuevo adaptador, no tocamos los existentes.

### Bloques Lego = modularidad real

- Cada adaptador es un paquete npm independiente (~2-5 KB cada uno)
- El core UTS es un JSON schema estándar (~1 KB)
- No hay dependencias circulares
- Un adaptador puede actualizarse sin tocar los demás
- Nuevos adaptadores se añaden sin modificar el core

### Auto-traducción de lenguajes

El motor traduce automáticamente:
- **Protocolos**: MCP ↔ A2A ↔ JSON-RPC ↔ REST
- **Formatos**: JSON ↔ CBOR ↔ JSON-LD ↔ Protobuf
- **Criptografía**: Ed25519 ↔ ECDSA ↔ RSA ↔ secp256k1
- **Identidad**: public key ↔ DID ↔ OAuth subject ↔ UEID

El usuario no necesita saber qué formato usa el otro agente — el motor lo detecta y traduce.

---

## 9. Resumen Ejecutivo

| Aspecto | Estado actual | Después del pivot |
|---------|--------------|-------------------|
| **Posicionamiento** | "Otro estándar" | "Adaptador universal" |
| **Competencia** | vs Anthropic, Google, IETF | Conecta con todos ellos |
| **Lock-in** | ATC-only | Ninguno (multi-formato) |
| **Moat** | 9,248 skills | Único traductor universal |
| **Costo** | $0/mes | $0/mes |
| **Riesgo de obsolescencia** | Alto (si ATC no gana) | Bajo (traduce lo que sea que gane) |
| **Tiempo a mercado** | 6 meses para ATC adoption | 2 meses para primeros 3 adaptadores |

**El mensaje es simple**: No compitas. Conecta. Ese es el moat.

---

*Plan creado el 2026-08-19. Basado en el documento "ATC v2.0 Research Deep-Dive Agosto 2026" y la visión del founder de crear un sistema universal, modular y robusto.*
