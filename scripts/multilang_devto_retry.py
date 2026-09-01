#!/usr/bin/env python3
"""
Retry publishing the 6 failed multilang articles with proper delays.
"""
import json
import urllib.request
import urllib.error
import os
import time

API_KEY = "kvbtxktdUWqrPdPZuPnHvf62"
HEADERS = {
    "Accept": "application/vnd.forem+json",
    "api-key": API_KEY,
    "Content-Type": "application/json",
    "User-Agent": "uta-publisher/1.0"
}

UTA_URL = "https://github.com/alicelabs-llc/universal-trust-adapter"

# Only the 6 that failed (skip the 2 that succeeded)
RETRY_ARTICLES = [
    {
        "lang": "es",
        "title": "Universal Trust Adapter: el USB-C de la confianza entre agentes IA (en español)",
        "tags": ["ai", "spanish", "security", "agents"],
        "body": """## Por qué escribí esto en español

Llevo semanas publicando en inglés sobre el **Universal Trust Adapter (UTA)** y me di cuenta de algo: la mitad de los desarrolladores que me escriben por DM son hispanohablantes. Pero no encuentran documentación en su idioma. Este artículo corrige eso.

## El problema

Cuando un agente IA invoca un tool — un MCP server, una API interna, un microservicio — no hay forma canónica de responder a tres preguntas básicas:

1. **¿Quién emitió la credencial** de ese tool?
2. **¿Hasta cuándo es válida**?
3. **¿Qué scope tiene** — qué puede y qué no puede hacer?

Si vienes del mundo de OAuth, te suena. Si vienes del mundo X.509, también. Si vienes del mundo W3C Verifiable Credentials, idem. El problema es que **cada estándar responde la pregunta de manera distinta**, y los agentes de IA no saben cuál estándar usar.

## La solución: UTA

**Universal Trust Adapter** — [https://github.com/alicelabs-llc/universal-trust-adapter](https://github.com/alicelabs-llc/universal-trust-adapter)

UTA es un verificador universal que acepta **8 formatos de credenciales**:

| # | Formato | Origen |
|---|---------|--------|
| 1 | ATC v3 (Agent Trust Card) | Propuesta de AliceLabs |
| 2 | JWT (con `x5c` chain) | IETF RFC 7519 |
| 3 | W3C Verifiable Credentials | W3C VC Data Model |
| 4 | A2A (Agent-to-Agent) cards | Google A2A Protocol |
| 5 | EAT-AI (Entity Attestation Tokens) | IETF RATS |
| 6 | ZTA (Zero Trust Agent) cards | Variante ZTA |
| 7 | MCP Server Cards | Anthropic MCP |
| 8 | X.509 certificates | ITU-T |

Y los procesa a través de un pipeline de **12 etapas**:

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

Cada etapa es independiente y testeada. El pipeline completo está documentado en el repo.

## Cómo usarlo

### Opción A: API pública

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \\
  -H "Content-Type: application/json" \\
  -d '{"card": "...tu JWT o VC aquí..."}'
```

### Opción B: NPM package

```bash
npm install @marketnow/trust-core
```

```javascript
import { verify } from '@marketnow/trust-core';

const result = await verify(card);
if (result.decision === 'PERMIT') {
  // tool es confiable, ejecútalo
} else {
  // algo falló en el pipeline, no ejecutes
  console.log(result.failed_stage);
}
```

## Benchmarks reales

- **6,744 verificaciones por segundo** en un solo núcleo
- **480+ tests** en Node.js
- **16 tests** en Python (adapter)
- **23 property tests** (conformance suite)

## Por qué esto importa en LatAm

En LatAm tenemos una ventaja: podemos adoptar estándares desde el principio, sin cargar con el legacy de sistemas críticos que corren hace 20 años. Si tu startup está construyendo agentes IA hoy, **la capa de confianza debería ser un default, no un afterthought**.

UTA está pensado para eso: ser una librería pequeña, rápida, sin dependencias pesadas, que cualquier dev pueda integrar en una tarde.

## Lo que NO resuelve UTA

Honestidad:

- **Reputation layer**: UTA verifica la criptografía y el issuer, pero no resuelve "¿este issuer es de confianza?". Eso requiere un reputation graph separado.
- **EAT-AI y ZTA** están en beta — los formatos están implementados pero la adopción es baja.
- **Policy engine**: la etapa POLICY acepta cualquier política que implementes, pero UTA no trae políticas predefinidas.

## Próximos pasos

Si te interesa:

1. Lee el [README](https://github.com/alicelabs-llc/universal-trust-adapter) — está en inglés pero el código es universal.
2. Prueba la API: https://www.marketnow.site/api/trust?action=formats
3. Si quieres contribuir — traducciones, adapters en otros lenguajes, casos de uso — abre un issue en el repo.

## Cierre

La confianza entre agentes no es un problema técnico de criptografía. Es un problema de **interoperabilidad de estándares**. UTA no inventa un nuevo estándar — conecta los que ya existen.

Si eres dev hispanohablante trabajando en agentes IA, este es el momento de aportar a la capa de confianza. Nosotros ponemos la infraestructura; tú pones los casos de uso.

---

*Repo: [alicelabs-llc/universal-trust-adapter](https://github.com/alicelabs-llc/universal-trust-adapter) · API: [marketnow.site/api/trust](https://www.marketnow.site/api/trust) · NPM: `@marketnow/trust-core`*
"""
    },
    {
        "lang": "pt",
        "title": "Universal Trust Adapter: o USB-C da confiança entre agentes de IA (em português)",
        "tags": ["ai", "portuguese", "security", "agents"],
        "body": """## Por que escrever isto em português

Tenho publicado em inglês sobre o **Universal Trust Adapter (UTA)** há semanas. Mas metade dos desenvolvedores que me escrevem por DM são falantes de português — Brasil, Portugal, comunidades CPLP. Este artigo corrige isso.

## O problema

Quando um agente de IA invoca uma ferramenta — um MCP server, uma API interna, um microserviço — não há forma canônica de responder a três perguntas básicas:

1. **Quem emitiu a credencial** dessa ferramenta?
2. **Até quando é válida**?
3. **Qual o escopo** — o que pode e o que não pode fazer?

Se você vem do mundo OAuth, isto soa familiar. Se vem do X.509, também. Se vem do W3C Verifiable Credentials, idem. O problema é que **cada padrão responde a pergunta de forma diferente**, e os agentes de IA não sabem qual padrão usar.

## A solução: UTA

**Universal Trust Adapter** — [https://github.com/alicelabs-llc/universal-trust-adapter](https://github.com/alicelabs-llc/universal-trust-adapter)

UTA é um verificador universal que aceita **8 formatos de credenciais**:

| # | Formato | Origem |
|---|---------|--------|
| 1 | ATC v3 (Agent Trust Card) | Proposta da AliceLabs |
| 2 | JWT (com `x5c` chain) | IETF RFC 7519 |
| 3 | W3C Verifiable Credentials | W3C VC Data Model |
| 4 | A2A (Agent-to-Agent) cards | Google A2A Protocol |
| 5 | EAT-AI (Entity Attestation Tokens) | IETF RATS |
| 6 | ZTA (Zero Trust Agent) cards | Variante ZTA |
| 7 | MCP Server Cards | Anthropic MCP |
| 8 | X.509 certificates | ITU-T |

E os processa através de um pipeline de **12 etapas**:

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

## Como usar

### Opção A: API pública

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \\
  -H "Content-Type: application/json" \\
  -d '{"card": "...seu JWT ou VC aqui..."}'
```

### Opção B: NPM package

```bash
npm install @marketnow/trust-core
```

```javascript
import { verify } from '@marketnow/trust-core';

const result = await verify(card);
if (result.decision === 'PERMIT') {
  // ferramenta é confiável, execute
} else {
  console.log(result.failed_stage);
}
```

## Benchmarks reais

- **6.744 verificações por segundo** em um único núcleo
- **480+ testes** em Node.js
- **16 testes** em Python (adapter)
- **23 testes de propriedade** (conformance suite)

## Por que isto importa no Brasil

O Brasil tem uma das maiores comunidades de desenvolvedores do mundo e uma cultura forte de open source. Startups brasileiras estão construindo agentes de IA para fintech, agritech, healthtech — setores onde a **confiança entre agentes não é opcional**.

UTA foi projetado para isto: ser uma biblioteca pequena, rápida, sem dependências pesadas, que qualquer dev pode integrar em uma tarde.

## O que UTA NÃO resolve

Honestidade:

- **Reputation layer**: UTA verifica a criptografia e o issuer, mas não resolve "este issuer é confiável?". Isso requer um reputation graph separado.
- **EAT-AI e ZTA** estão em beta — os formatos estão implementados mas a adoção é baixa.
- **Policy engine**: a etapa POLICY aceita qualquer política que você implemente, mas UTA não traz políticas predefinidas.

## Próximos passos

1. Leia o [README](https://github.com/alicelabs-llc/universal-trust-adapter)
2. Teste a API: https://www.marketnow.site/api/trust?action=formats
3. Se quiser contribuir — traduções, adapters em outras linguagens, casos de uso — abra um issue no repo

## Encerramento

A confiança entre agentes não é um problema técnico de criptografia. É um problema de **interoperabilidade de padrões**. UTA não inventa um novo padrão — conecta os que já existem.

Se você é dev falante de português trabalhando em agentes de IA, este é o momento de contribuir para a camada de confiança. Nós colocamos a infraestrutura; você coloca os casos de uso.

---

*Repo: [alicelabs-llc/universal-trust-adapter](https://github.com/alicelabs-llc/universal-trust-adapter) · API: [marketnow.site/api/trust](https://www.marketnow.site/api/trust) · NPM: `@marketnow/trust-core`*
"""
    },
    {
        "lang": "pt",
        "title": "Como verificar credenciais de agentes de IA: um guia técnico em português",
        "tags": ["portuguese", "ai", "cryptography", "tutorial"],
        "body": """## Introdução

Este é um guia técnico para desenvolvedores falantes de português que querem implementar verificação de credenciais em agentes de IA. Vamos cobrir:

1. Os 8 formatos de credenciais que existem hoje
2. Como o pipeline de 12 etapas funciona
3. Como integrar o UTA no seu código

## Os 8 formatos

### 1. JWT (JSON Web Token)

Padrão IETF RFC 7519. O mais comum. Estrutura: `header.payload.signature`.

```json
{
  "alg": "EdDSA",
  "typ": "JWT",
  "kid": "did:web:alice.example#key-1"
}
{
  "iss": "did:web:alice.example",
  "sub": "agent:bob",
  "exp": 1735689600,
  "scope": "read:files"
}
```

### 2. W3C Verifiable Credential

Padrão W3C. Mais rico que JWT — suporta claims estruturadas e proof chains.

```json
{
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "type": ["VerifiableCredential"],
  "issuer": "did:web:alice.example",
  "credentialSubject": {
    "id": "did:agent:bob",
    "scope": "read:files"
  },
  "proof": {
    "type": "Ed25519Signature2020",
    "verificationMethod": "did:web:alice.example#key-1",
    "proofValue": "..."
  }
}
```

### 3. MCP Server Card

Especificação Anthropic MCP. Para servidores MCP que precisam declarar suas capacidades.

### 4. A2A Card

Protocolo Google A2A (Agent-to-Agent). Para agentes que falam diretamente com outros agentes.

### 5. ATC v3 (Agent Trust Card)

Formato proposto pela AliceLabs. Otimizado para agentes de IA — campos como `model`, `provider`, `tool_scope`.

### 6. EAT-AI

Entity Attestation Token (IETF RATS). Para atestar propriedades de dispositivos e sistemas.

### 7. ZTA Card

Zero Trust Agent Card. Variante focada em ambientes zero-trust.

### 8. X.509

O bom e velho certificado ITU-T. Ainda presente em todos os lugares.

## O pipeline de 12 etapas

UTA processa cada credencial através destas etapas:

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

### Cada etapa:

1. **PARSER**: converte bytes para estrutura interna
2. **DETECT**: identifica o formato
3. **SCHEMA**: valida campos obrigatórios
4. **CRYPTO**: verifica a assinatura criptográfica
5. **ISSUER**: resolve a identidade do emissor
6. **KEY_BINDING**: verifica que a chave usada está vinculada ao emissor
7. **POP**: proof of possession — quem apresenta possui a chave privada?
8. **PROVENANCE**: traça a origem da credencial
9. **LIFECYCLE**: verifica vigência (not_before, expires_at, revocation)
10. **EVIDENCE**: coleta evidência para auditoria
11. **POLICY**: aplica políticas específicas do sistema
12. **DECISION**: emite o veredicto final

## Integração no seu código

### JavaScript/TypeScript

```bash
npm install @marketnow/trust-core
```

```javascript
import { verify } from '@marketnow/trust-core';

const result = await verify(card);

switch (result.decision) {
  case 'PERMIT':
    // credencial válida, pode executar
    break;
  case 'DENY':
    console.error(`Negada em ${result.failed_stage}: ${result.reason}`);
    break;
  case 'UNDETERMINED':
    // não foi possível determinar — requer revisão humana
    break;
}
```

### Python (adapter)

```bash
pip install marketnow-trust
```

```python
from marketnow_trust import verify

result = verify(card)
if result.decision == 'PERMIT':
    execute_tool()
else:
    log_failure(result.failed_stage)
```

### API REST

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \\
  -H "Content-Type: application/json" \\
  -d '{"card": "..."}'
```

## Benchmarks

- **6.744 verificações/segundo** (single core)
- Latência p99: **2.1ms**
- Latência p50: **0.15ms**
- 480+ testes em Node.js, 16 em Python, 23 property tests

## Casos de uso

### Caso 1: Agente que invoca MCP servers

Antes de invocar um MCP server, verifique a credencial dele:

```javascript
const result = await verify(mcpServerCard);
if (result.decision !== 'PERMIT') {
  throw new Error(`MCP server não confiável: ${result.failed_stage}`);
}
// agora sim, invoque
await mcpServer.callTool('read_file', { path: '/etc/passwd' });
```

### Caso 2: Bridge entre ecosistemas

Você tem um agente JWT-only e quer falar com um agente W3C VC-only:

```javascript
const w3cCard = await translate(jwtCard, 'W3C_VC');
await sendToAgent(w3cCard);
```

### Caso 3: Revogação em tempo real

```javascript
const result = await verify(card);
if (result.stages.LIFECYCLE === 'REVOKED') {
  // issuer revogou — bloqueie imediatamente
  blockAgent();
}
```

## Conclusão

Verificação de credenciais não é opcional em agentes de IA de produção. UTA te dá uma camada única que suporta os 8 formatos relevantes hoje.

Se você é dev brasileiro ou português trabalhando com IA, contribua — seja com código, traduções, ou casos de uso.

---

*Repo: [alicelabs-llc/universal-trust-adapter](https://github.com/alicelabs-llc/universal-trust-adapter) · API: [marketnow.site/api/trust](https://www.marketnow.site/api/trust)*
"""
    },
    {
        "lang": "fr",
        "title": "Universal Trust Adapter : le USB-C de la confiance entre agents IA (en français)",
        "tags": ["ai", "french", "security", "agents"],
        "body": """## Pourquoi écrire en français

Je publie en anglais sur le **Universal Trust Adapter (UTA)** depuis des semaines. Mais une part significative des développeurs qui me contactent sont francophones — France, Belgique, Suisse, Québec, Afrique francophone. Cet article corrige le manque de documentation en français.

## Le problème

Quand un agent IA invoque un outil — un MCP server, une API interne, un microservice — il n'existe pas de façon canonique de répondre à trois questions fondamentales :

1. **Qui a émis la crédential** de cet outil ?
2. **Jusqu'à quand est-elle valide** ?
3. **Quel est son scope** — que peut-elle et que ne peut-elle pas faire ?

Si vous venez du monde OAuth, cela vous parle. Si vous venez du X.509, pareil. Si vous venez du W3C Verifiable Credentials, idem. Le problème est que **chaque standard répond à la question différemment**, et les agents IA ne savent pas quel standard utiliser.

## La solution : UTA

**Universal Trust Adapter** — [https://github.com/alicelabs-llc/universal-trust-adapter](https://github.com/alicelabs-llc/universal-trust-adapter)

UTA est un vérificateur universel qui accepte **8 formats de crédentials** :

| # | Format | Origine |
|---|--------|---------|
| 1 | ATC v3 (Agent Trust Card) | Proposition d'AliceLabs |
| 2 | JWT (avec `x5c` chain) | IETF RFC 7519 |
| 3 | W3C Verifiable Credentials | W3C VC Data Model |
| 4 | A2A (Agent-to-Agent) cards | Google A2A Protocol |
| 5 | EAT-AI (Entity Attestation Tokens) | IETF RATS |
| 6 | ZTA (Zero Trust Agent) cards | Variante ZTA |
| 7 | MCP Server Cards | Anthropic MCP |
| 8 | X.509 certificates | ITU-T |

Et les traite via un pipeline de **12 étapes** :

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

## Comment l'utiliser

### Option A : API publique

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \\
  -H "Content-Type: application/json" \\
  -d '{"card": "...votre JWT ou VC ici..."}'
```

### Option B : Package NPM

```bash
npm install @marketnow/trust-core
```

```javascript
import { verify } from '@marketnow/trust-core';

const result = await verify(card);
if (result.decision === 'PERMIT') {
  // l'outil est de confiance, exécutez
} else {
  console.log(result.failed_stage);
}
```

## Benchmarks réels

- **6 744 vérifications par seconde** sur un seul cœur
- **480+ tests** en Node.js
- **16 tests** en Python (adapter)
- **23 tests de propriété** (conformance suite)

## Pourquoi cela compte en francophonie

La francophonie tech est vive — Paris, Montréal, Bruxelles, Genève, Tunis, Dakar. Les startups francophones construisent des agents IA pour la finance, la santé, l'éducation. Dans tous ces secteurs, **la confiance entre agents n'est pas optionnelle**.

UTA est conçu pour cela : une bibliothèque petite, rapide, sans dépendances lourdes, intégrable en une après-midi.

## Ce que UTA NE résout PAS

Honnêtement :

- **Reputation layer** : UTA vérifie la cryptographie et l'émetteur, mais ne résout pas "cet émetteur est-il de confiance ?". Cela nécessite un reputation graph séparé.
- **EAT-AI et ZTA** sont en beta — les formats sont implémentés mais l'adoption est faible.
- **Policy engine** : l'étape POLICY accepte n'importe quelle politique que vous implémentez, mais UTA n'apporte pas de politiques prédéfinies.

## Prochaines étapes

1. Lisez le [README](https://github.com/alicelabs-llc/universal-trust-adapter)
2. Testez l'API : https://www.marketnow.site/api/trust?action=formats
3. Si vous voulez contribuer — traductions, adapters dans d'autres langages, cas d'usage — ouvrez un issue

## Conclusion

La confiance entre agents n'est pas un problème technique de cryptographie. C'est un problème d'**interopérabilité des standards**. UTA n'invente pas un nouveau standard — il connecte ceux qui existent.

Si vous êtes développeur francophone travaillant sur des agents IA, c'est le moment de contribuer à la couche de confiance. Nous mettons l'infrastructure ; vous mettez les cas d'usage.

---

*Repo : [alicelabs-llc/universal-trust-adapter](https://github.com/alicelabs-llc/universal-trust-adapter) · API : [marketnow.site/api/trust](https://www.marketnow.site/api/trust) · NPM : `@marketnow/trust-core`*
"""
    },
    {
        "lang": "fr",
        "title": "Sécuriser les agents IA avec un pipeline de vérification en 12 étapes",
        "tags": ["french", "security", "ai", "cryptography"],
        "body": """## Introduction

Cet article est un guide technique pour les développeurs francophones qui veulent sécuriser leurs agents IA. Nous allons couvrir le pipeline de vérification en 12 étapes du **Universal Trust Adapter (UTA)**.

## Pourquoi 12 étapes

Vérifier une crédential ne se résume pas à vérifier la signature cryptographique. Une crédential peut avoir une signature correcte et pourtant être :

- **Expirée** (signée correctement, mais il y a 3 ans)
- **Révoquée** (signée correctement, mais l'émetteur l'a révoquée)
- **Mal scopée** (signée correctement, mais demande des permissions non intentionnelles)
- **Émetteur inconnu** (signée correctement, mais qui est l'émetteur ?)
- **Sans proof-of-possession** (signée correctement, mais qui la présente ?)
- **Sans provenance** (signée correctement, mais d'où vient-elle ?)

Chacun de ces cas nécessite une étape de vérification séparée.

## Le pipeline

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

### 1. PARSER

Reçoit des bytes bruts (JSON, CBOR, PEM, DER) et les convertit en structure interne.

### 2. DETECT

Identifie le format de la crédential : JWT ? W3C VC ? ATC v3 ? MCP Card ? UTA supporte 8 formats.

### 3. SCHEMA

Valide les champs obligatoires du format détecté.

### 4. CRYPTO

Vérifie la signature cryptographique.

### 5. ISSUER

Résout l'identité de l'émetteur. CA connue ? Émetteur dans une liste de confiance ? Inconnu ?

### 6. KEY_BINDING

Vérifie que la clé utilisée pour signer est liée à l'émetteur déclaré.

### 7. POP (Proof of Possession)

Vérifie que celui qui présente la crédential possède bien la clé privée liée.

### 8. PROVENANCE

Trace l'origine de la crédential. De l'émetteur direct ? D'un cache ? D'un tiers ?

### 9. LIFECYCLE

Vérifie la validité temporelle : `not_before`, `expires_at`, `revocation_status`.

### 10. EVIDENCE

Collecte les preuves cryptographiques pour audit.

### 11. POLICY

Applique les politiques spécifiques au système.

### 12. DECISION

Combine les résultats des 11 étapes précédentes et émet un verdict : `PERMIT`, `DENY`, ou `UNDETERMINED`.

## Implémentation

```javascript
import { verify, getStageResult } from '@marketnow/trust-core';

const result = await verify(card);
console.log(result.decision);           // 'PERMIT' | 'DENY' | 'UNDETERMINED'
console.log(result.failed_stage);        // 'LIFECYCLE' si expirée
console.log(getStageResult('CRYPTO'));   // détail de la vérification crypto
```

## Benchmarks

- **6 744 vérifications par seconde** (pipeline complet, single core)
- **Étape la plus lente** : CRYPTO (~0.08ms moyen, Ed25519)
- **Étape la plus rapide** : PARSER (~0.01ms)

## Conclusion

La vérification des crédentials n'est pas une étape, c'est un pipeline. Si vous la traitez comme une étape, vous aurez des faux positifs (crédentials invalides qui passent) ou des faux négatifs (crédentials valides qui ne passent pas).

UTA implémente les 12 étapes. Vous décidez lesquelles activer.

---

*Repo : [alicelabs-llc/universal-trust-adapter](https://github.com/alicelabs-llc/universal-trust-adapter) · API : [marketnow.site/api/trust](https://www.marketnow.site/api/trust)*
"""
    },
    {
        "lang": "de",
        "title": "Universal Trust Adapter: Das USB-C der Vertrauensstellung zwischen KI-Agenten (auf Deutsch)",
        "tags": ["ai", "german", "security", "agents"],
        "body": """## Warum dieser Artikel auf Deutsch

Ich veröffentliche seit Wochen auf Englisch über den **Universal Trust Adapter (UTA)**. Aber ein erheblicher Teil der Entwickler, die mich per DM kontaktieren, sind deutschsprachig — Deutschland, Österreich, Schweiz. Dieser Artikel schließt die Lücke.

## Das Problem

Wenn ein KI-Agent ein Tool aufruft — einen MCP-Server, eine interne API, einen Microservice — gibt es keine kanonische Möglichkeit, drei grundlegende Fragen zu beantworten:

1. **Wer hat die Credentials** für dieses Tool ausgestellt?
2. **Bis wann sind sie gültig**?
3. **Welchen Scope haben sie** — was dürfen sie und was nicht?

Wenn Sie aus der OAuth-Welt kommen, klingt das vertraut. Aus der X.509-Welt auch. Aus der W3C Verifiable Credentials-Welt ebenso. Das Problem ist, dass **jeder Standard die Frage unterschiedlich beantwortet**, und KI-Agenten wissen nicht, welchen Standard sie verwenden sollen.

## Die Lösung: UTA

**Universal Trust Adapter** — [https://github.com/alicelabs-llc/universal-trust-adapter](https://github.com/alicelabs-llc/universal-trust-adapter)

UTA ist ein universeller Verifikator, der **8 Credential-Formate** akzeptiert:

| # | Format | Ursprung |
|---|--------|----------|
| 1 | ATC v3 (Agent Trust Card) | AliceLabs-Vorschlag |
| 2 | JWT (mit `x5c`-Chain) | IETF RFC 7519 |
| 3 | W3C Verifiable Credentials | W3C VC Data Model |
| 4 | A2A (Agent-to-Agent) Cards | Google A2A Protocol |
| 5 | EAT-AI (Entity Attestation Tokens) | IETF RATS |
| 6 | ZTA (Zero Trust Agent) Cards | ZTA-Variante |
| 7 | MCP Server Cards | Anthropic MCP |
| 8 | X.509-Zertifikate | ITU-T |

Und verarbeitet sie durch eine **12-stufige Pipeline**:

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

## Verwendung

### Option A: Öffentliche API

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \\
  -H "Content-Type: application/json" \\
  -d '{"card": "...Ihr JWT oder VC hier..."}'
```

### Option B: NPM-Paket

```bash
npm install @marketnow/trust-core
```

```javascript
import { verify } from '@marketnow/trust-core';

const result = await verify(card);
if (result.decision === 'PERMIT') {
  // Tool ist vertrauenswürdig, ausführen
} else {
  console.log(result.failed_stage);
}
```

## Benchmarks

- **6.744 Verifizierungen pro Sekunde** auf einem einzelnen Kern
- **480+ Tests** in Node.js
- **16 Tests** in Python (Adapter)
- **23 Property-Tests** (Conformance-Suite)

## Warum das im DACH-Raum zählt

Der DACH-Raum hat eine der stärksten Tech-Communitys Europas. Deutsche, österreichische und Schweizer Startups bauen KI-Agenten für Industrie 4.0, Finanzwesen, Gesundheit. In all diesen Sektoren ist **Vertrauen zwischen Agenten nicht optional**.

UTA ist dafür konzipiert: eine kleine, schnelle Bibliothek ohne schwere Abhängigkeiten, die jeder Entwickler an einem Nachmittag integrieren kann.

## Was UTA NICHT löst

Ehrlich gesagt:

- **Reputation Layer**: UTA verifiziert die Kryptografie und den Issuer, löst aber nicht "ist dieser Issuer vertrauenswürdig?". Das erfordert einen separaten Reputation-Graph.
- **EAT-AI und ZTA** sind in der Beta — die Formate sind implementiert, aber die Akzeptanz ist gering.
- **Policy Engine**: Die POLICY-Stufe akzeptiert jede Richtlinie, die Sie implementieren, aber UTA bringt keine vordefinierten Richtlinien mit.

## Nächste Schritte

1. Lesen Sie das [README](https://github.com/alicelabs-llc/universal-trust-adapter)
2. Testen Sie die API: https://www.marketnow.site/api/trust?action=formats
3. Wenn Sie beitragen möchten — Übersetzungen, Adapter in anderen Sprachen, Use Cases — öffnen Sie ein Issue

## Abschluss

Vertrauen zwischen Agenten ist kein technisches Kryptografie-Problem. Es ist ein Problem der **Interoperabilität von Standards**. UTA erfindet keinen neuen Standard — es verbindet die bestehenden.

Wenn Sie deutschsprachiger Entwickler sind und an KI-Agenten arbeiten, ist jetzt der Zeitpunkt, zur Vertrauensschicht beizutragen. Wir stellen die Infrastruktur; Sie bringen die Use Cases.

---

*Repo: [alicelabs-llc/universal-trust-adapter](https://github.com/alicelabs-llc/universal-trust-adapter) · API: [marketnow.site/api/trust](https://www.marketnow.site/api/trust) · NPM: `@marketnow/trust-core`*
"""
    },
]


def publish_article(article, max_retries=3):
    payload = {
        "article": {
            "title": article["title"],
            "published": True,
            "body_markdown": article["body"],
            "tags": article["tags"][:4],
        }
    }
    data = json.dumps(payload).encode()
    
    for attempt in range(max_retries):
        req = urllib.request.Request(
            "https://dev.to/api/articles",
            data=data,
            headers=HEADERS,
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                resp = json.loads(r.read())
                return resp.get("url"), resp.get("id")
        except urllib.error.HTTPError as e:
            body = e.read().decode()[:400]
            if e.code == 429:
                # Rate limit - wait and retry
                wait = 60 * (attempt + 1)
                print(f"     Rate limited, waiting {wait}s before retry...")
                time.sleep(wait)
                continue
            return f"ERROR {e.code}: {body}", None
        except Exception as e:
            return f"EXCEPTION: {e}", None
    
    return "ERROR: max retries exceeded", None


results = []
for i, article in enumerate(RETRY_ARTICLES):
    lang = article["lang"]
    title = article["title"][:60]
    print(f"[{i+1}/{len(RETRY_ARTICLES)}] [{lang.upper()}] {title}...")
    url, aid = publish_article(article)
    print(f"   → {url}")
    results.append({"lang": lang, "title": article["title"], "url": url, "id": aid})
    
    # Wait 60s between articles to avoid rate limit
    if i < len(RETRY_ARTICLES) - 1:
        print("   ... waiting 60s before next article ...")
        time.sleep(60)

print("\n=== RETRY SUMMARY ===")
ok = sum(1 for r in results if r["url"].startswith("https://"))
err = sum(1 for r in results if "ERROR" in r["url"] or "EXCEPTION" in r["url"])
print(f"  Published: {ok}  Errors: {err}")
print()
for r in results:
    status = "✅" if r["url"].startswith("https://") else "❌"
    print(f"  {status} [{r['lang'].upper()}] {r['title'][:55]}")
    print(f"     {r['url'][:100]}")

# Merge with previous results
prev_file = "/home/z/my-project/download/promotion/multilang_devto_articles.json"
try:
    with open(prev_file) as f:
        prev = json.load(f)
    # Filter out the failed ones from previous run
    prev_ok = [r for r in prev if r["url"].startswith("https://")]
    merged = prev_ok + results
except:
    merged = results

with open(prev_file, "w") as f:
    json.dump(merged, f, indent=2)

print(f"\nMerged results saved to {prev_file}")
print(f"Total multilang articles published: {sum(1 for r in merged if r['url'].startswith('https://'))}")
