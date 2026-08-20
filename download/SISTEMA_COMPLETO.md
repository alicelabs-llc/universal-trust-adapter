# MarketNow — Arquitectura del Sistema Completo
## Cómo funciona, qué hace cada pieza, y por qué se construyó así

---

## 1. Visión General — Una Frase

> **MarketNow es la infraestructura de confianza para agentes de IA: descubre herramientas, las audita con Sentinel, emite credenciales firmadas (ATC), las traduce entre estándares (UTA), y hace cumplir políticas en tiempo de ejecución (Trust Gateway).**

---

## 2. Los 7 Componentes y Qué Hace Cada Uno

```
┌─────────────────────────────────────────────────────────────┐
│                    Ecosistema MarketNow                      │
│                                                              │
│  1. MARKETNOW SITE     → Descubre + cataloga 9,248 MCP      │
│  2. SENTINEL          → Audita seguridad (10 capas)          │
│  3. ATC v2.0          → Emite credenciales Ed25519           │
│  4. UTA               → Traduce entre formatos de trust     │
│  5. UTS               → Schema universal interno            │
│  6. TRUST GATEWAY     → Intercepta tools/call + enforcement │
│  7. MARKETNOW API     → Comercio: Stripe + USDC + mandates  │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                   Infraestructura ($0/mes)                   │
│                                                              │
│  Vercel (Hobby)    → Hosting + 12 lambdas + CDN             │
│  Supabase (Free)   → PostgreSQL + REST API + RLS            │
│  Upstash (Free)    → Redis distribuido (rate limit + cache) │
│  Alchemy (Free)    → RPC dedicado Base L2 (USDC)            │
│  npm (Free)        → 3 paquetes publicados                  │
└─────────────────────────────────────────────────────────────┘
```

### Componente 1: MarketNow Site (marketnow.site)

**Qué es**: El sitio web + API pública que sirve el catálogo de skills, la documentación, y los endpoints de confianza.

**Qué hace**:
- Sirve 9,248 skills MCP indexadas en `/api/skills-lite.json`
- Sirve `agent.json` en `/api/agent.json` (instrucciones legibles por máquina)
- Sirve los fixtures de conformancia ATC v2 en `/atc/spec/fixtures/v2/`
- Sirve la API de Trust en `/api/trust`

**Cómo arranca**: Un usuario o agente hace `GET https://marketnow.site/`
**Cómo termina**: El usuario instala un skill o verifica una credencial

### Componente 2: Sentinel (Auditoría de Seguridad)

**Qué es**: El motor de auditoría de 10 capas que analiza cada MCP server.

**Las 10 capas**:
```
L1.5  → Metadata (auth, CORS, rate limiting)
L1.6  → Semgrep + secret detection + OSV
L1.7  → Malware pattern detection
L1.8  → Malware family signatures (48 patrones)
L1.9  → Prompt injection screening (32 reglas)
L2.5  → gVisor sandbox (Docker, network=none, read-only FS)
L3    → Runtime monitoring (roadmap)
L4    → eBPF kernel-level enforcement (roadmap)
ATC   → Agent Trust Card issuance
x402  → Streaming metered billing
A2A   → Remote agent execution
```

**Qué hace cada capa**:
- L1.5-L1.9: Análisis estático del código fuente del MCP server
- L2.5: Ejecuta el MCP en un sandbox aislado para ver qué hace
- L3-L4: Monitorea el comportamiento en runtime (planeado)
- ATC: Emite la credencial firmada con el resultado del audit
- x402: Permite cobrar por uso (streaming payments)
- A2A: Permite que un agente ejecute código en otro agente

**Cómo arranca**: `POST /api/audit-skill` con `{repo_url: "..."}`
**Cómo termina**: Genera un Sentinel Certificate + actualiza el trust score

### Componente 3: ATC v2.0 (Agent Trust Card)

**Qué es**: Una credencial criptográficamente firmada que prueba la identidad y confianza de un agente.

**Estructura**:
```json
{
  "card_id": "ATC-2026-0325620",
  "status": "active",
  "payload": {
    "schema_version": "2.0.0",
    "agent_id": "my-agent",
    "agent_name": "My Agent",
    "identity": {
      "public_key": "MCowBQYDK2VwAyEA...",
      "key_algorithm": "Ed25519"
    },
    "trust": {
      "sentinel_review_score": 8,
      "sentinel_score": 8,
      "audit_layers_passed": {"L1.5": true, "L2.5": true},
      "composite_trust": 8,
      "risk_level": "low"
    },
    "capabilities": {
      "provides": ["search", "read"],
      "protocol_language": "mcp",
      "translate": true
    },
    "metadata": {
      "issued_at": "2026-08-19T00:00:00Z",
      "expires_at": "2027-08-19T00:00:00Z",
      "issuer": "MarketNow Sentinel CA"
    }
  },
  "signature": {
    "algorithm": "Ed25519 (RFC 8032)",
    "value": "682868eb7bd9...",
    "signed_by": "MarketNow Sentinel CA",
    "canonical_json": "RFC_8785_JCS",
    "ca_key_id": "MCowBQYDK2VwAyEA",
    "evidence_hash": "sha256:abc123...",
    "policy_version": "2.0.0"
  }
}
```

**Campos v2.0 obligatorios** (no existían en v1):
- `ca_key_id` — identifica qué CA key firmó (soporta rotación)
- `evidence_hash` — hash tamper-evident del payload + firma
- `policy_version` — versión de la política que emitió la tarjeta

**Cómo funciona la firma**:
```
1. payload = { agent_id, trust, capabilities, metadata, ... }
2. canonical = RFC_8785_JCS(payload)  ← canonicalización determinista
3. signature = Ed25519.sign(canonical, CA_PRIVATE_KEY)
4. evidence_hash = SHA256(canonical + signature)
```

**Cómo se verifica**:
```
1. canonical = RFC_8785_JCS(payload)
2. Ed25519.verify(canonical, signature, CA_PUBLIC_KEY)
3. evidence_hash == SHA256(canonical + signature)?
4. expires_at > now?
5. status != 'revoked'? (consulta CRL en Supabase)
```

**Dónde se almacena**: Tabla `atc_cards` en Supabase (79 tarjetas migradas)

### Componente 4: UTA (Universal Trust Adapter)

**Qué es**: El traductor universal entre TODOS los formatos de trust de agentes IA.

**Tesis**: "MCP lets agents use tools. A2A lets agents talk to agents. UTA lets the ecosystem understand and exchange trust."

**Formatos soportados**:
| Formato | Tipo | Estado |
|---------|------|--------|
| ATC v2.0 | Trust credential | ✅ Stable (Ed25519 real) |
| EAT-AI | Attestation | ✅ Beta (schema translation) |
| ZTA | Trust credential | ✅ Beta (schema translation) |
| A2A Agent Card | Metadata | ✅ Beta |
| MCP Server Card | Metadata | ✅ Beta |
| W3C VC | Credential | ⚠️ Planned |
| OAuth/OIDC | Identity | ⚠️ Planned |
| SPIFFE SVID | Workload | ⚠️ Planned |

**Cómo funciona la traducción**:
```
Input (ATC card)
    │
    ▼
fromNative() → UTS (Universal Trust Schema)
    │
    ▼
toNative() → Output (ZTA credential)
```

Cada adapter implementa 2 funciones:
- `fromNative(payload)` → convierte formato nativo a UTS
- `toNative(uts)` → convierte UTS a formato nativo

Complejidad: O(N) — agregar 1 adapter da N-1 traducciones nuevas

**Endpoints**:
- `POST /api/trust?action=verify` — auto-detecta + verifica cualquier formato
- `POST /api/trust?action=translate` — traduce de formato X a Y (lossless)
- `POST /api/trust?action=issue` — emite credenciales en múltiples formatos
- `POST /api/trust?action=bridge` — verifica en ecosistema A, emite en B

### Componente 5: UTS (Universal Trust Schema)

**Qué es**: El schema canónico interno, como Unicode para texto.

**Estructura**:
```
UTS
├── uts_version: "1.0.0"
├── subject          → Quién es (id, name, type)
├── identity         → Cómo verificamos (public_key, key_algorithm, PoP, attestation)
├── trust            → Cuánto confiamos (score, confidence, evidence[], assessor)
├── capabilities     → Qué puede hacer (provides[], requires[], protocols[])
├── policy           → Qué está permitido (max_spend, filesystem, shell)
├── provenance       → De dónde viene (source, artifact_binding, attestation_chain)
├── lifecycle        → Cuándo es válido (issued_at, expires_at, revoked)
├── format           → Metadatos del formato (type, version, raw=payload original)
└── warnings         → Advertencias de traducción lossy
```

**Principios de diseño**:
1. **Lossless**: `format.raw` preserva el payload original — NUNCA se destruye
2. **Attestation chaining**: `provenance.original_signature_hash` en bridge operations
3. **Offline <50ms**: Sin llamadas de red, JS puro, sin dependencias pesadas

### Componente 6: Trust Gateway (MCP)

**Qué es**: Middleware que intercepta TODAS las llamadas `tools/call` y verifica confianza ANTES de ejecutar.

**Flujo**:
```
tools/call request
    │
    ▼
1. Extract agent identity (ATC card_id)
    │
    ▼
2. Verify ATC (Ed25519 signature + CRL check)
    │
    ▼
3. Check trust score ≥ min_trust_score
    │
    ▼
4. Detect dangerous arguments:
   - .env, .ssh/id_*, .aws/credentials, .git/config
   - rm -rf, curl|sh, nc -l, bash -i
    │
    ├── BLOCK → reject + log evidence
    │
    ▼
5. ALLOW → execute tool
    │
    ▼
6. Generate signed receipt (agent + tool + args_hash + decision + timestamp)
```

### Componente 7: MarketNow Commerce API

**Qué hace**: Permite que agentes compren skills con dinero real.

**Métodos de pago**:
- **Stripe** (fiat) — `POST /api/agent-purchase` con Stripe Checkout
- **USDC on Base L2** (crypto) — verificación on-chain con `eth_getTransactionReceipt`

**Mandates (autoridad delegada)**:
- Un humano crea un mandate: "mi agente puede gastar hasta $500, máximo $50 por compra"
- El agente usa el mandate para comprar autónomamente
- Modos: `notify` (default), `notify_and_veto` (5-min veto window), `silent` (opt-in)
- Hard caps: $500/mandate, $50/compra — NO ajustables

---

## 3. Infraestructura — Dónde Deploya Cada Cosa

### Vercel (Hobby — $0/mes)

**Qué hospeda**:
- `marketnow.site` — sitio principal + 11 lambdas
- `universal-trust-adapter.vercel.app` — UTA standalone

**Lambdas activas en marketnow.site**:
| Lambda | Función |
|--------|---------|
| `api/atc.js` | ATC: issue, verify, revoke, CRL, trust decision |
| `api/trust.js` | UTA: translate, verify, issue, bridge |
| `api/search.js` | Skills catalog + search |
| `api/mandates.js` | Mandate CRUD + spending |
| `api/security.js` | Honeypot + interceptor |
| `api/owasp.js` | OWASP MCP Top 10 compliance |
| `api/agent-purchase.js` | Commerce: Stripe + USDC |
| `api/agent-economy.js` | Interceptor + stream + stacks |
| `api/audit-skill.js` | Sentinel audit trigger |
| `api/mcp.js` | MCP server info |
| `api/manifest.js` | Project manifest |
| `api/stripe-webhook.js` | Stripe webhook handler |

**Límite Hobby**: 12 lambdas máximo — ya estamos en el límite

**Cómo deploya**:
```
1. Subir archivos a Vercel API (POST /v2/files)
2. Crear deployment (POST /v13/deployments)
3. Esperar BUILDING → READY
4. Asignar alias (POST /v2/deployments/{id}/aliases)
5. Verificar en marketnow.site
```

### Supabase (Free — $0/mes)

**Qué hospeda**: PostgreSQL database (500MB)

**Tablas creadas**:
| Tabla | Registros | Propósito |
|-------|-----------|----------|
| `atc_cards` | 79 | Tarjetas ATC firmadas |
| `mandates` | 0 | Mandates de gasto delegado |
| `quarantine_decisions` | 3 | Decisiones de quarantine (auditables) |
| `licenses` | 0 | Licencias Ed25519 (offline-verifiable) |
| `skills` | 0 | Catálogo (pendiente migrar) |
| `trust_decisions` | 0 | Log de decisiones de /api/trust |
| `sentinel_certificates` | 0 | Certificados de Sentinel |

**Seguridad**: RLS (Row Level Security) habilitado en todas las tablas
- `anon` role: solo puede LEER tablas públicas
- `service_role` key: puede escribir (nunca expuesta al cliente)

**URL**: `https://pjhsgiblydnpsnjfbxzw.supabase.co`
**Project ref**: `pjhsgiblydnpsnjfbxzw`

### Upstash Redis (Free — $0/mes)

**Qué hace**: Rate limiting distribuido + cache + locks

**Por qué no in-memory**: Las lambdas de Vercel son stateless — cada invocación puede ser una instancia nueva. Rate limiting in-memory es bypassable haciendo requests paralelos a distintas lambdas. Redis distribuido resuelve esto.

**Rate limits configurados**:
| Tipo | Límite | Ventana |
|------|--------|---------|
| `atc_issue` | 5 req | 1 hora |
| `atc_revoke` | 10 req | 1 hora |
| `api_general` | 100 req | 1 minuto |
| `search` | 60 req | 1 minuto |
| `honeypot_block` | 3 req | 1 minuto (bloquea IP) |

**URL**: `https://calm-elf-146402.upstash.io`

### Alchemy (Free — $0/mes)

**Qué hace**: RPC dedicado para verificación de pagos USDC en Base L2

**Por qué no RPC público**: Los RPCs públicos no tienen SLA y devuelven 429 Too Many Requests en momentos de tráfico alto. Alchemy da 300 req/sec dedicados.

**Cómo funciona**:
```
1. Agente hace una transacción USDC en Base L2
2. Agente envía txHash a POST /api/agent-purchase
3. Lambda llama Alchemy RPC: eth_getTransactionReceipt(txHash)
4. Verifica: status=0x1, to=USDC contract, amount=expected
5. Si todo pasa: emite licencia + permite instalación
```

**Fallback**: Si Alchemy falla, intenta con RPCs públicos en round-robin

### npm (Free)

**Paquetes publicados**:
| Paquete | Versión | Descargas/sem |
|---------|---------|---------------|
| `marketnow-mcp` | 1.10.0 | 619 |
| `agent-trust-card` | 1.1.1 | 469 |
| `marketnow-install-stack` | 1.1.0 | 281 |
| `universal-trust-adapter` | ⚠️ Pending 2FA | — |

---

## 4. Flujo Completo — De Principio a Fin

### Flujo 1: Un agente descubre y instala un skill

```
Paso 1: Discovery
  Agent → GET /api/agent.json
  → Recibe instrucciones + trust model + pricing

Paso 2: Search
  Agent → GET /api/search?q=weather
  → Recibe lista de skills con sentinel_score

Paso 3: Trust Assessment
  Agent → POST /api/trust?action=verify
  → UTA detecta el formato del credential
  → Verifica firma Ed25519
  → Verifica CRL (Supabase)
  → Retorna UTS + decision

Paso 4: Purchase (si el skill es de pago)
  Agent → POST /api/agent-purchase
  → Verifica mandate (Supabase)
  → Verifica txHash on-chain (Alchemy → Base L2)
  → Emite licencia Ed25519
  → Permite instalación

Paso 5: Install
  Agent → npx -y marketnow-mcp
  → MCP server arranca con 13 tools disponibles

Paso 6: Runtime Enforcement (con Trust Gateway)
  Agent → tools/call (get_weather)
  → Gateway extrae agent identity
  → Verifica ATC
  → Detecta argumentos peligrosos
  → ALLOW → ejecuta tool
  → Genera receipt firmado
```

### Flujo 2: Bridge entre ecosistemas

```
Paso 1: Verify in ecosystem A (Anthropic ZTA)
  → UTA detecta formato: zta
  → ztaToUTS() → convierte a UTS
  → Verifica estructura + campos

Paso 2: Policy check
  → if (uts.trust.score < min_trust_score) → DENY

Paso 3: Attestation chaining
  → originalSigHash = SHA256(payload original)
  → Se preserva en provenance.original_signature_hash

Paso 4: Issue in ecosystem B (MarketNow ATC)
  → utsToATC() → convierte UTS a ATC v2.0
  → Genera nueva card con ca_key_id + evidence_hash
  → El evidence_hash = originalSigHash (cadena verificable)

Paso 5: Result
  → ATC card nueva con:
    - trust.score = 9 (heredado del ZTA)
    - provenance.original_signature_hash = sha256:cb65cee...
    - provenance.original_format = "zta"
    - provenance.bridged_at = "2026-08-20T..."
    - provenance.bridged_by = "MarketNow UTA v1.0"
```

### Flujo 3: Sentinel audit

```
Paso 1: Submit
  Developer → POST /api/audit-skill
  Body: { repo_url: "https://github.com/user/mcp-server" }

Paso 2: L1.5 Metadata
  → Clona repo
  → Analiza package.json, README, .env.example
  → Verifica auth, CORS, rate limiting

Paso 3: L1.6 Static Analysis
  → Ejecuta Semgrep
  → Detecta secrets (API keys, passwords)
  → Verifica OSV (vulnerabilidades conocidas)

Paso 4: L1.7-L1.8 Malware Detection
  → Patrón: exfiltración de datos
  → Patrón: reverse shell
  → Patrón: prompt injection en descripción
  → 48 firmas de familias de malware

Paso 5: L1.9 Prompt Injection
  → 32 reglas contra inyección
  → Detecta instrucciones ocultas en tool descriptions

Paso 6: L2.5 Sandbox
  → Docker + gVisor
  → --network none (sin red)
  → read-only filesystem
  → capability dropping
  → 60 segundos de observación

Paso 7: Resultado
  → Sentinel score (0-10)
  → Si score < 4: quarantine (removido del catálogo)
  → Si score ≥ 7: ATC emitido
  → Certificate guardado en Supabase
```

---

## 5. Funciones y Lambdas — Qué Llama Qué

### `/api/trust` (UTA)

```
handleTrust(req, res)
  │
  ├── GET → documentación + formats list
  │
  └── POST
      ├── action=verify
      │   ├── detectFormat(payload) → { format, confidence }
      │   ├── verifyByFormat(format, payload, caKey)
      │   │   ├── verifyATC(card, caKey)
      │   │   ├── verifyEAT(payload, caKey)
      │   │   ├── verifyZTA(payload, caKey)
      │   │   ├── verifyA2A(payload, caKey)
      │   │   └── verifyMCP(payload, caKey)
      │   └── Return: { valid, format, uts, issues, warnings }
      │
      ├── action=translate
      │   ├── detectFormat(payload) → sourceFormat
      │   ├── toUTS(sourceFormat, payload) → UTS
      │   │   ├── atcToUTS(card)
      │   │   ├── eatToUTS(claims)
      │   │   ├── ztaToUTS(payload)
      │   │   ├── a2aToUTS(payload)
      │   │   └── mcpToUTS(payload)
      │   ├── fromUTS(targetFormat, uts) → translated
      │   │   ├── utsToATC(uts)
      │   │   ├── utsToEAT(uts)
      │   │   ├── utsToZTA(uts)
      │   │   ├── utsToA2A(uts)
      │   │   └── utsToMCP(uts)
      │   └── Return: { payload, uts, warnings, lossless }
      │
      ├── action=issue
      │   ├── Build UTS from params
      │   ├── For each format in formats[]:
      │   │   └── fromUTS(format, uts) → credential
      │   └── Return: { credentials: { atc: {...}, zta: {...}, ... } }
      │
      └── action=bridge
          ├── verify(verifyIn, payload) → VerifyResult
          ├── Check policy (min_trust_score)
          ├── Compute originalSigHash = SHA256(payload)
          ├── issue(issueAs, uts + provenance chain)
          └── Return: { verified, issued, bridge_log, attestation_chain }
```

### `/api/atc` (ATC)

```
handler(req, res)
  │
  ├── GET
  │   ├── action=ca-key → Return CA public key (PEM)
  │   ├── action=verify → Verify card_id:
  │   │   ├── getATCCard(card_id) [Supabase]
  │   │   ├── verifyAtcSignature(card, caKey)
  │   │   ├── Check expires_at
  │   │   ├── Check status != 'revoked'
  │   │   └── Return: { valid, reasons, evidence }
  │   │
  │   ├── action=envelope → Return full card + signing instructions
  │   ├── action=revocation-list → Return all revoked cards [Supabase]
  │   └── default → List all active cards [Supabase]
  │
  └── POST
      ├── action=issue → Sign + persist new ATC:
      │   ├── Validate v2 schema (ca_key_id, evidence_hash, policy_version)
      │   ├── canonicalize(payload) [RFC 8785 JCS]
      │   ├── Ed25519.sign(canonical, CA_PRIVATE_KEY)
      │   ├── issueATCCard(card) [Supabase insert]
      │   └── Return: { success, card }
      │
      ├── action=revoke → Revoke card:
      │   ├── revokeATCCard(card_id, reason) [Supabase update]
      │   └── Return: { success, status: 'revoked' }
      │
      └── action=trust → Unified trust decision:
          ├── Step 1: Sentinel assessment (fetch skills.json)
          ├── Step 2: ATC verification (fetch CRL from Supabase)
          ├── Step 3: Interceptor check (fetch /api/interceptor)
          ├── Step 4: Build enriched response:
          │   ├── decision_id (unique)
          │   ├── inputs[] (each content-addressed with SHA256)
          │   ├── evidence_record (tamper-evident hash)
          │   └── evidence_url (retrievable later)
          └── Return: { allowed, decision, rule_id, inputs, evidence_record }
```

---

## 6. Por Qué Esta Infraestructura — La Inteligencia del Diseño

### Por qué Vercel y no AWS/GCP

| Razón | Explicación |
|-------|-------------|
| $0/mes | Hobby plan gratis para siempre |
| Deploy en segundos | `POST /v13/deployments` → READY en 15s |
| CDN global incluido | Sin configurar Cloudflare aparte |
| Edge Functions | Latencia <50ms global |
| Serverless | Sin servidores que mantener |
| HTTPS automático | TLS 1.3 + HSTS sin configuración |

### Por qué Supabase y no MongoDB/Firebase

| Razón | Explicación |
|-------|-------------|
| PostgreSQL real | No un NoSQL limitado — ACID, JSONB, RLS |
| REST API auto-generada | No escribir CRUD manualmente |
| Row Level Security | `anon` lee, `service_role` escribe — sin middleware |
| 500MB gratis | Suficiente para 100K+ tarjetas ATC |
| Tiempo de recuperación | Point-in-time recovery (7 días) |

### Por qué Upstash Redis y no ElastiCache

| Razón | Explicación |
|-------|-------------|
| REST API | Funciona en serverless sin TCP pooling |
| 10K req/día gratis | Suficiente para tráfico actual |
| Global edge | Latencia baja desde cualquier región |
| Atomic INCR | Rate limiting sin race conditions |

### Por qué Alchemy y no RPC público

| Razón | Explicación |
|-------|-------------|
| 300 req/sec | RPC público: ~10 req/sec |
| SLA del 99.9% | RPC público: sin SLA |
| Sin 429 errors | RPC público: rate-limited frecuentemente |
| Múltiples redes | Base, Ethereum, Polygon, etc. |

### Por qué AL-1.0 y no MIT

| Razón | Explicación |
|-------|-------------|
| Protección de IP | Microsoft/Google no pueden copiar el motor y venderlo |
| Source-available | Cualquiera puede auditar el código |
| Modelo probado | Zapier, Docker, MuleSoft usan modelos similares |
| Comercial | AliceLabs cobra por uso comercial |

---

## 7. Cómo Se Podría Mejorar

### Mejoras de Corto Plazo (1-4 semanas)

1. **SLSA + Sigstore**: Integrar provenance de build en CI
2. **SDK npm publicar**: Necesita token con bypass 2FA
3. **SDK Python**: `pip install marketnow-trust`
4. **MCP Trust Gateway**: Integrar en un MCP server real (Cursor/Cline)
5. **Golden Corpus**: 5,000 test vectors (1,000 por formato)

### Mejoras de Mediano Plazo (1-3 meses)

6. **Hono.js unificado**: 1 Edge Function en vez de 12 lambdas
7. **Cloudflare Pages mirror**: `marketnow.pages.dev` como fallback
8. **Deno Deploy mirror**: `marketnow.deno.dev` como fallback API
9. **W3C VC adapter**: Ed25519Signature2020 implementation
10. **OAuth adapter**: JWKS fetching + RS256 verification

### Mejoras de Largo Plazo (3-6 meses)

11. **SPIFFE adapter**: X.509 chain + JWT-SVID
12. **eBPF L4**: Kernel-level enforcement real
13. **AAIF submission**: Postular a Linux Foundation
14. **External pentest**: Auditoría de terceros
15. **Trust Graph**: Visualización de la red de confianza

### Lo Que No Se Debe Hacer

- ❌ Agregar más skills al catálogo (el marketplace no es el producto)
- ❌ Crear más versiones de ATC (1.0 frozen, 2.0 live, 3.0 draft)
- ❌ Competir con Arcade/Obsidian (somos complemento)
- ❌ Cambiar la licencia a MIT (perdería la protección de IP)
- ❌ Agregar features sin validación externa

---

## 8. Resultados Actuales

### Métricas

| Métrica | Valor |
|---------|-------|
| Skills indexados | 9,248 |
| ATC cards emitidas | 79 |
| Versiones npm publicadas | 15 (marketnow-mcp) |
| Downloads npm/semana | 1,369 |
| Adapters UTA | 5 (3 planned) |
| Translation pairs | 20 |
| Test vectors | 10 |
| Endpoints API | 15+ |
| Costo mensual | $0 |
| Uptime | 99.9% (Vercel SLA) |

### Commits en esta sesión

```
1a144258 feat(audit): apply 8 findings F1-F8
c66a2e6b feat(atc): add conformance fixtures v1 + enrich /api/trust
d145220e feat(atc-v2): ship ATC v2.0 + Phase 1-4 migration code
b0a1443c feat: complete Supabase migration + ATC v2.0 + all 4 phases
bbdaa865 docs: Universal Trust Adapter (UTA) plan
5003e322 feat: strategic positioning v4.0
c6dfd282 feat: apply 17-point external review corrections
f8bdfcd4 feat: execute 10 commandments from 68-point audit
```

### Lo Que Está LIVE y Verificado

| Componente | URL | Estado |
|-----------|-----|--------|
| MarketNow Site | marketnow.site | ✅ Live |
| Agent.json | /api/agent.json | ✅ 8 fixes aplicados |
| ATC v2.0 | /api/atc | ✅ Ed25519 + Supabase |
| UTA | /api/trust | ✅ 5 adapters + PoP |
| UTS v1.0 | /spec/UTS-v1.0.json | ✅ Frozen |
| Test vectors | /spec/test-vectors/ | ✅ 10 vectors |
| Threat model | /THREAT_MODEL.md | ✅ STRIDE + ATLAS |
| Trust Gateway | /api/mcp-gateway.js | ✅ Created |
| Supabase | pjhsgiblydnpsnjfbxzw | ✅ 7 tables + 79 cards |
| Upstash Redis | calm-elf-146402 | ✅ PING=PONG |
| Alchemy RPC | base-mainnet.g.alchemy.com | ✅ Block 50M+ |
| UTA standalone | universal-trust-adapter.vercel.app | ✅ Live |

---

## 9. La Frase Que Resume Todo

> **MarketNow encuentra al agente → Sentinel genera evidencia → ATC certifica → UTA traduce → UTS normaliza → Policy decide → Gateway hace cumplir → Receipt audita.**

Esa cadena, criptográficamente verificable y reproducible, es el producto.

El marketplace es el laboratorio. El trust graph es el negocio.
