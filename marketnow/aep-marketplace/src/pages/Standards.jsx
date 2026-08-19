import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT — full Standards page in 5 languages
// Brand/standard names + governance text stay untranslated across all langs
// ═══════════════════════════════════════════════════════════════════════════
const CONTENT = {
  en: {
    badge: 'STANDARDS COMMITMENT',
    whyTitle: 'Why this matters',
    whyP1Pre: 'In December 2025, Anthropic donated MCP to the Linux Foundation. The official registry (',
    whyP1Link: 'registry.modelcontextprotocol.io',
    whyP1Mid: ') now solves',
    whyP1Strong: 'discovery',
    whyP1Post: ' — anyone can find MCP servers there. Smithery, Glama, PulseMCP compete on curation and search.',
    whyP2Pre: 'What is',
    whyP2Em: 'not',
    whyP2Mid: 'solved is',
    whyP2Strong: 'trust',
    whyP2Post: ': an independent analysis found ~64.7 million server entries from just 1,691 unique packages — massive duplication, zero signal, active supply-chain attacks (npm packages stealing wallets, PyPI packages exfiltrating agent conversations, hundreds of malicious PRs per day).',
    whyP2Strong2: 'That is our wedge.',
    whyP2End: 'We are not the biggest catalog. We are the trust layer.',
    whatLabel: 'WHAT IT IS',
    whyLabel: "WHY WE'RE ADOPTING",
    planLabel: 'OUR PLAN',
    govLabel: 'Governance:',
    learnMore: '→ Learn more about',
    calibTitle: 'Calibration note',
    calibP1Pre: 'ACP, AP2, x402, and MPP all compete and combine simultaneously. No one would bet today on a single winner. Our strategy is',
    calibP1Strong: 'design for interoperability',
    calibP1Post: ', not "pick one and hope." The real risk in 2026 is being left out of whatever standard wins — not picking the wrong product detail.',
    calibP2: 'We will support multiple payment rails (x402 today, AP2 mandates, MPP when it stabilizes) and multiple discovery formats (our agent.json superset, MCP Server Cards when standard, Smithery format). Compliance over purity.',
    disclosureTitle: 'Honest disclosure',
    disclosure: [
      'We have not yet completed full x402 or AP2 compliance. We are implementing, not done.',
      'Our current mandate JSON is conceptually identical to AP2 but not wire-compatible yet. Migration in progress.',
      'Our current USDC flow is functionally similar to x402 (server returns payment challenge, client pays, server verifies) but does not use the HTTP 402 status code yet. Wrapping in progress.',
      'Every status on this page is a git commit. When something moves from "implementing" to "done," you will see it here first.',
    ],
    links: [
      { text: "→ Trust roadmap (Claude's 7 points)", to: '/trust' },
      { text: '→ About us', to: '/about' },
      { text: '→ Catalog transparency', to: '/catalog' },
      { text: '→ Manage mandates', to: '/mandates' },
    ],
    statusMeta: {
      implementing: { color: '#00F299', label: 'IMPLEMENTING', desc: 'Active engineering work in progress' },
      monitoring: { color: '#00d1ff', label: 'MONITORING', desc: 'Tracking spec, will adopt when stable' },
      planning: { color: '#fbbf24', label: 'PLANNING', desc: 'Design phase, not yet started' },
      roadmap: { color: '#a78bfa', label: 'ROADMAP', desc: 'Future, after implementing items land' },
    },
    planMeta: {
      done: { prefix: '✓', color: '#00F299' },
      in_progress: { prefix: '⟳', color: '#00d1ff' },
      monitoring: { prefix: '👁', color: '#00d1ff' },
      planning: { prefix: '✎', color: '#fbbf24' },
      roadmap: { prefix: '○', color: '#a78bfa' },
    },
    standards: [
      {
        id: 'x402',
        name: 'x402 — HTTP 402 Payment Required',
        status: 'implementing',
        gov: 'Linux Foundation (Coinbase, Cloudflare, Stripe, Google, Visa)',
        what: 'Revives HTTP status code 402 for native HTTP-level payments. Instead of custom USDC verification flows, the server returns 402 with payment instructions; the client (agent) pays and retries with the payment proof. Built on USDC on Base.',
        why: 'Removes us from "looks like home-rolled crypto" territory. x402 is a recognized standard with major backers. Any agent that speaks x402 can pay us without custom integration.',
        our_plan: [
          { status: 'done', text: 'USDC on Base with on-chain verification (our current flow)' },
          { status: 'in_progress', text: 'Wrap the flow in x402 semantics — return HTTP 402 with payment challenge, accept retry with x402 Payment header' },
          { status: 'roadmap', text: 'Full x402 protocol compliance, including the facilitates protocol for intermediaries' },
        ],
        link: 'https://x402.org',
      },
      {
        id: 'ap2',
        name: 'AP2 — Agent Payments Protocol',
        status: 'implementing',
        gov: 'Google (+ Visa, Mastercard, PayPal, Coinbase, 60+ partners)',
        what: 'Signed declarations that define what an agent can do: spend limits, scope, expiry. Portable across platforms, cryptographically verifiable, instantly revocable. Our "mandates" are conceptually identical to AP2 mandates — we are migrating to be wire-compatible.',
        why: 'AP2 has 60+ partners including the major payment networks. An agent with an AP2 mandate from another platform should be able to spend on MarketNow without re-authorization. Custom mandate JSON locks us into our own ecosystem.',
        our_plan: [
          { status: 'done', text: 'Mandate concept (limit, per-purchase cap, categories, expiry, revocation)' },
          { status: 'done', text: 'Human-in-loop by default (notify mode); silent requires explicit opt-in' },
          { status: 'in_progress', text: 'Make mandates AP2-wire-compatible — signed declarations, portable format' },
          { status: 'roadmap', text: 'Cross-platform mandate verification (accept AP2 mandates issued elsewhere)' },
        ],
        link: 'https://github.com/google/agent-payments-protocol',
      },
      {
        id: 'server-cards',
        name: 'MCP Server Cards',
        status: 'monitoring',
        gov: 'MCP / Linux Foundation (roadmap 2026)',
        what: 'Standardized metadata exposed via .well-known URLs so any crawler or registry can discover MCP server capabilities without connecting. Similar to our agent.json, but as a shared standard rather than proprietary.',
        why: 'Server Cards will let registries (registry.modelcontextprotocol.io, Smithery, Glama, PulseMCP) pull consistent metadata from any MCP server. Our agent.json is a superset today, but we should align to the standard when it stabilizes.',
        our_plan: [
          { status: 'done', text: 'agent.json with capabilities, schema, trust model, all API endpoints' },
          { status: 'done', text: '.well-known/mcp/server-card.json for Smithery compatibility' },
          { status: 'monitoring', text: 'Track MCP working group for Server Cards spec finalization' },
          { status: 'roadmap', text: 'Migrate agent.json to be a strict superset of Server Cards once spec stabilizes' },
        ],
        link: 'https://modelcontextprotocol.io',
      },
      {
        id: 'namespace',
        name: 'Official Registry Namespace Verification',
        status: 'planning',
        gov: 'Linux Foundation / MCP Registry',
        what: 'The official MCP registry (registry.modelcontextprotocol.io) verifies namespaces via GitHub OAuth or DNS. This gives real identity to skill publishers — not just "Open Source Community" as author.',
        why: 'Today any skill can claim any author. With namespace verification, a skill claiming to be from "anthropics/mcp-server-foo" must actually come from the anthropics GitHub org. This is the foundation of real trust.',
        our_plan: [
          { status: 'planning', text: 'Integrate registry API to verify publisher identity at submission time' },
          { status: 'roadmap', text: 'Display verified publisher badge on skill detail pages' },
          { status: 'roadmap', text: 'Require namespace verification for "maintainer-verified" review_status' },
        ],
        link: 'https://registry.modelcontextprotocol.io',
      },
      {
        id: 'task-scoped',
        name: 'Task-Scoped Mandates',
        status: 'roadmap',
        gov: 'Industry direction (ACP, AP2, MPP all converging)',
        what: 'Today mandates are scoped by $ limit and time. The industry direction is task-scoped: "this mandate is only valid for completing task X" — the agent cannot use it for anything else, and the human must re-approve for each new task. More restrictive than $500/90 days.',
        why: 'Claude flagged this as where the industry is moving. Being more restrictive than big players on autonomy is a feature, not a bug — it earns trust.',
        our_plan: [
          { status: 'roadmap', text: 'Add task_description field to mandates (free text, agent-declared)' },
          { status: 'roadmap', text: 'Add task_hash field (deterministic hash of task description + agent ID)' },
          { status: 'roadmap', text: 'Surface task scope in notifications so principal knows what the spend was FOR, not just how much' },
        ],
        link: 'https://agentcommunicationprotocol.org',
      },
    ],
  },

  es: {
    badge: 'COMPROMISO CON ESTÁNDARES',
    whyTitle: 'Por qué importa',
    whyP1Pre: 'En diciembre de 2025, Anthropic donó MCP a la Linux Foundation. El registro oficial (',
    whyP1Link: 'registry.modelcontextprotocol.io',
    whyP1Mid: ') ahora resuelve',
    whyP1Strong: 'descubrimiento',
    whyP1Post: ' — cualquiera puede encontrar servidores MCP ahí. Smithery, Glama, PulseMCP compiten en curación y búsqueda.',
    whyP2Pre: 'Lo que',
    whyP2Em: 'no',
    whyP2Mid: 'está resuelto es',
    whyP2Strong: 'confianza',
    whyP2Post: ': un análisis independiente encontró ~64,7 millones de entradas de servidores de apenas 1.691 paquetes únicos — duplicación masiva, cero señal, ataques activos a la cadena de suministro (paquetes npm robando wallets, paquetes PyPI exfiltrando conversaciones de agentes, cientos de PRs maliciosos por día).',
    whyP2Strong2: 'Esa es nuestra cuña.',
    whyP2End: 'No somos el catálogo más grande. Somos la capa de confianza.',
    whatLabel: 'QUÉ ES',
    whyLabel: 'POR QUÉ LO ADOPTAMOS',
    planLabel: 'NUESTRO PLAN',
    govLabel: 'Gobernanza:',
    learnMore: '→ Más información sobre',
    calibTitle: 'Nota de calibración',
    calibP1Pre: 'ACP, AP2, x402 y MPP compiten y se combinan simultáneamente. Nadie apostaría hoy por un único ganador. Nuestra estrategia es',
    calibP1Strong: 'diseñar para interoperabilidad',
    calibP1Post: ', no "elegir uno y rezar". El riesgo real en 2026 es quedarse fuera del estándar que gane — no elegir mal un detalle de producto.',
    calibP2: 'Soportaremos múltiples rieles de pago (x402 hoy, mandatos AP2, MPP cuando se estabilice) y múltiples formatos de descubrimiento (nuestro superset agent.json, MCP Server Cards cuando sea estándar, formato Smithery). Cumplimiento sobre pureza.',
    disclosureTitle: 'Divulgación honesta',
    disclosure: [
      'Todavía no hemos completado el cumplimiento total de x402 ni de AP2. Estamos implementando, no terminados.',
      'Nuestro JSON de mandato actual es conceptualmente idéntico a AP2 pero todavía no es wire-compatible. Migración en progreso.',
      'Nuestro flujo USDC actual es funcionalmente similar a x402 (el servidor devuelve el desafío de pago, el cliente paga, el servidor verifica) pero todavía no usa el código de estado HTTP 402. Wrap en progreso.',
      'Cada estado en esta página es un git commit. Cuando algo pase de "implementando" a "hecho", lo verás aquí primero.',
    ],
    links: [
      { text: '→ Hoja de confianza (los 7 puntos de Claude)', to: '/trust' },
      { text: '→ Sobre nosotros', to: '/about' },
      { text: '→ Transparencia del catálogo', to: '/catalog' },
      { text: '→ Gestionar mandatos', to: '/mandates' },
    ],
    statusMeta: {
      implementing: { color: '#00F299', label: 'IMPLEMENTANDO', desc: 'Trabajo de ingeniería activo en progreso' },
      monitoring: { color: '#00d1ff', label: 'MONITOREANDO', desc: 'Siguiendo el spec, adoptaremos cuando sea estable' },
      planning: { color: '#fbbf24', label: 'PLANEANDO', desc: 'Fase de diseño, no comenzado aún' },
      roadmap: { color: '#a78bfa', label: 'ROADMAP', desc: 'Futuro, después de que aterricen los items en implementación' },
    },
    planMeta: {
      done: { prefix: '✓', color: '#00F299' },
      in_progress: { prefix: '⟳', color: '#00d1ff' },
      monitoring: { prefix: '👁', color: '#00d1ff' },
      planning: { prefix: '✎', color: '#fbbf24' },
      roadmap: { prefix: '○', color: '#a78bfa' },
    },
    standards: [
      {
        id: 'x402',
        name: 'x402 — HTTP 402 Payment Required',
        status: 'implementing',
        gov: 'Linux Foundation (Coinbase, Cloudflare, Stripe, Google, Visa)',
        what: 'Recupera el código de estado HTTP 402 para pagos nativos a nivel HTTP. En vez de flujos custom de verificación USDC, el servidor devuelve 402 con instrucciones de pago; el cliente (agente) paga y reintenta con la prueba de pago. Construido sobre USDC en Base.',
        why: 'Nos saca del territorio de "parece crypto casero". x402 es un estándar reconocido con backers importantes. Cualquier agente que hable x402 puede pagarnos sin integración custom.',
        our_plan: [
          { status: 'done', text: 'USDC en Base con verificación on-chain (nuestro flujo actual)' },
          { status: 'in_progress', text: 'Envolver el flujo en semántica x402 — devolver HTTP 402 con desafío de pago, aceptar retry con header x402 Payment' },
          { status: 'roadmap', text: 'Cumplimiento total del protocolo x402, incluyendo el protocolo facilitates para intermediarios' },
        ],
        link: 'https://x402.org',
      },
      {
        id: 'ap2',
        name: 'AP2 — Agent Payments Protocol',
        status: 'implementing',
        gov: 'Google (+ Visa, Mastercard, PayPal, Coinbase, 60+ partners)',
        what: 'Declaraciones firmadas que definen qué puede hacer un agente: límites de gasto, scope, expiración. Portables entre plataformas, verificables criptográficamente, revocables al instante. Nuestros "mandatos" son conceptualmente idénticos a los mandatos AP2 — estamos migrando para ser wire-compatible.',
        why: 'AP2 tiene 60+ partners incluyendo las principales redes de pago. Un agente con un mandato AP2 de otra plataforma debería poder gastar en MarketNow sin re-autorización. El JSON de mandato custom nos encierra en nuestro propio ecosistema.',
        our_plan: [
          { status: 'done', text: 'Concepto de mandato (límite, tope por compra, categorías, expiración, revocación)' },
          { status: 'done', text: 'Humano-en-el-loop por defecto (modo notify); silent requiere opt-in explícito' },
          { status: 'in_progress', text: 'Hacer mandatos wire-compatible con AP2 — declaraciones firmadas, formato portable' },
          { status: 'roadmap', text: 'Verificación de mandatos cross-platform (aceptar mandatos AP2 emitidos en otro lado)' },
        ],
        link: 'https://github.com/google/agent-payments-protocol',
      },
      {
        id: 'server-cards',
        name: 'MCP Server Cards',
        status: 'monitoring',
        gov: 'MCP / Linux Foundation (roadmap 2026)',
        what: 'Metadata estandarizada expuesta vía URLs .well-known para que cualquier crawler o registro pueda descubrir capacidades del servidor MCP sin conectarse. Similar a nuestro agent.json, pero como estándar compartido en vez de propietario.',
        why: 'Server Cards permitirá a los registros (registry.modelcontextprotocol.io, Smithery, Glama, PulseMCP) sacar metadata consistente de cualquier servidor MCP. Nuestro agent.json es un superset hoy, pero deberíamos alinearnos al estándar cuando se estabilice.',
        our_plan: [
          { status: 'done', text: 'agent.json con capabilities, schema, trust model, todos los endpoints' },
          { status: 'done', text: '.well-known/mcp/server-card.json para compatibilidad con Smithery' },
          { status: 'monitoring', text: 'Seguir al MCP working group para la finalización del spec de Server Cards' },
          { status: 'roadmap', text: 'Migrar agent.json para ser un superset estricto de Server Cards cuando el spec se estabilice' },
        ],
        link: 'https://modelcontextprotocol.io',
      },
      {
        id: 'namespace',
        name: 'Official Registry Namespace Verification',
        status: 'planning',
        gov: 'Linux Foundation / MCP Registry',
        what: 'El registro oficial de MCP (registry.modelcontextprotocol.io) verifica namespaces vía GitHub OAuth o DNS. Esto da identidad real a los publicadores de skills — no solo "Open Source Community" como autor.',
        why: 'Hoy cualquier skill puede reclamar cualquier autor. Con verificación de namespace, una skill que afirme ser de "anthropics/mcp-server-foo" debe venir realmente del GitHub org de anthropics. Esta es la base de la confianza real.',
        our_plan: [
          { status: 'planning', text: 'Integrar la API del registro para verificar identidad del publicador al momento del submission' },
          { status: 'roadmap', text: 'Mostrar badge de publicador verificado en las páginas de detalle de skill' },
          { status: 'roadmap', text: 'Requerir verificación de namespace para el review_status "maintainer-verified"' },
        ],
        link: 'https://registry.modelcontextprotocol.io',
      },
      {
        id: 'task-scoped',
        name: 'Task-Scoped Mandates',
        status: 'roadmap',
        gov: 'Industry direction (ACP, AP2, MPP all converging)',
        what: 'Hoy los mandatos se scopean por límite en $ y tiempo. La dirección de la industria es task-scoped: "este mandato solo es válido para completar la tarea X" — el agente no puede usarlo para otra cosa, y el humano debe re-aprobar para cada nueva tarea. Más restrictivo que $500/90 días.',
        why: 'Claude marcó esto como hacia dónde va la industria. Ser más restrictivo que los grandes jugadores en autonomía es una feature, no un bug — genera confianza.',
        our_plan: [
          { status: 'roadmap', text: 'Agregar campo task_description a los mandatos (texto libre, declarado por el agente)' },
          { status: 'roadmap', text: 'Agregar campo task_hash (hash determinístico de descripción de tarea + ID del agente)' },
          { status: 'roadmap', text: 'Mostrar el scope de tarea en notificaciones para que el principal sepa PARA QUÉ fue el gasto, no solo cuánto' },
        ],
        link: 'https://agentcommunicationprotocol.org',
      },
    ],
  },

  pt: {
    badge: 'COMPROMISSO COM PADRÕES',
    whyTitle: 'Por que isso importa',
    whyP1Pre: 'Em dezembro de 2025, a Anthropic doou o MCP para a Linux Foundation. O registry oficial (',
    whyP1Link: 'registry.modelcontextprotocol.io',
    whyP1Mid: ') agora resolve',
    whyP1Strong: 'descoberta',
    whyP1Post: ' — qualquer um pode encontrar servidores MCP lá. Smithery, Glama, PulseMCP competem em curadoria e busca.',
    whyP2Pre: 'O que',
    whyP2Em: 'não',
    whyP2Mid: 'está resolvido é',
    whyP2Strong: 'confiança',
    whyP2Post: ': uma análise independente encontrou ~64,7 milhões de entradas de servidores a partir de apenas 1.691 pacotes únicos — duplicação massiva, zero sinal, ataques ativos à cadeia de suprimentos (pacotes npm roubando wallets, pacotes PyPI exfiltrando conversas de agentes, centenas de PRs maliciosos por dia).',
    whyP2Strong2: 'Esse é o nosso diferencial.',
    whyP2End: 'Não somos o maior catálogo. Somos a camada de confiança.',
    whatLabel: 'O QUE É',
    whyLabel: 'POR QUE ADOTAMOS',
    planLabel: 'NOSSO PLANO',
    govLabel: 'Governança:',
    learnMore: '→ Saiba mais sobre',
    calibTitle: 'Nota de calibração',
    calibP1Pre: 'ACP, AP2, x402 e MPP competem e se combinam simultaneamente. Ninguém apostaria hoje em um único vencedor. Nossa estratégia é',
    calibP1Strong: 'designar para interoperabilidade',
    calibP1Post: ', não "escolher um e torcer". O risco real em 2026 é ficar de fora de qualquer padrão que vença — não escolher o detalhe errado de produto.',
    calibP2: 'Suportaremos múltiplos rails de pagamento (x402 hoje, mandatos AP2, MPP quando estabilizar) e múltiplos formatos de descoberta (nosso superset agent.json, MCP Server Cards quando for padrão, formato Smithery). Conformidade sobre pureza.',
    disclosureTitle: 'Divulgação honesta',
    disclosure: [
      'Ainda não concluímos conformidade total com x402 ou AP2. Estamos implementando, não terminamos.',
      'Nosso JSON de mandato atual é conceitualmente idêntico ao AP2 mas ainda não é wire-compatible. Migração em andamento.',
      'Nosso fluxo USDC atual é funcionalmente similar ao x402 (servidor retorna o desafio de pagamento, cliente paga, servidor verifica) mas ainda não usa o código de status HTTP 402. Wrap em andamento.',
      'Cada status nesta página é um git commit. Quando algo mudar de "implementando" para "feito", você verá aqui primeiro.',
    ],
    links: [
      { text: '→ Roadmap de confiança (os 7 pontos do Claude)', to: '/trust' },
      { text: '→ Sobre nós', to: '/about' },
      { text: '→ Transparência do catálogo', to: '/catalog' },
      { text: '→ Gerenciar mandatos', to: '/mandates' },
    ],
    statusMeta: {
      implementing: { color: '#00F299', label: 'IMPLEMENTANDO', desc: 'Trabalho de engenharia ativo em andamento' },
      monitoring: { color: '#00d1ff', label: 'MONITORANDO', desc: 'Acompanhando spec, adotaremos quando estável' },
      planning: { color: '#fbbf24', label: 'PLANEJANDO', desc: 'Fase de design, ainda não começado' },
      roadmap: { color: '#a78bfa', label: 'ROADMAP', desc: 'Futuro, depois que os itens em implementação pousarem' },
    },
    planMeta: {
      done: { prefix: '✓', color: '#00F299' },
      in_progress: { prefix: '⟳', color: '#00d1ff' },
      monitoring: { prefix: '👁', color: '#00d1ff' },
      planning: { prefix: '✎', color: '#fbbf24' },
      roadmap: { prefix: '○', color: '#a78bfa' },
    },
    standards: [
      {
        id: 'x402',
        name: 'x402 — HTTP 402 Payment Required',
        status: 'implementing',
        gov: 'Linux Foundation (Coinbase, Cloudflare, Stripe, Google, Visa)',
        what: 'Recupera o código de status HTTP 402 para pagamentos nativos em nível HTTP. Em vez de fluxos custom de verificação USDC, o servidor retorna 402 com instruções de pagamento; o cliente (agente) paga e retenta com a prova de pagamento. Construído sobre USDC na Base.',
        why: 'Nos tira do território de "parece crypto caseiro". x402 é um padrão reconhecido com backers importantes. Qualquer agente que fale x402 pode nos pagar sem integração custom.',
        our_plan: [
          { status: 'done', text: 'USDC na Base com verificação on-chain (nosso fluxo atual)' },
          { status: 'in_progress', text: 'Envolver o fluxo em semântica x402 — retornar HTTP 402 com desafio de pagamento, aceitar retry com header x402 Payment' },
          { status: 'roadmap', text: 'Conformidade total com o protocolo x402, incluindo o protocolo facilitates para intermediários' },
        ],
        link: 'https://x402.org',
      },
      {
        id: 'ap2',
        name: 'AP2 — Agent Payments Protocol',
        status: 'implementing',
        gov: 'Google (+ Visa, Mastercard, PayPal, Coinbase, 60+ partners)',
        what: 'Declarações assinadas que definem o que um agente pode fazer: limites de gasto, escopo, expiração. Portáveis entre plataformas, verificáveis criptograficamente, revogáveis instantaneamente. Nossos "mandatos" são conceitualmente idênticos aos mandatos AP2 — estamos migrando para ser wire-compatible.',
        why: 'AP2 tem 60+ partners incluindo as principais redes de pagamento. Um agente com um mandato AP2 de outra plataforma deveria poder gastar no MarketNow sem re-autorização. O JSON de mandato custom nos tranca no nosso próprio ecossistema.',
        our_plan: [
          { status: 'done', text: 'Conceito de mandato (limite, teto por compra, categorias, expiração, revogação)' },
          { status: 'done', text: 'Humano-no-loop por padrão (modo notify); silent exige opt-in explícito' },
          { status: 'in_progress', text: 'Tornar mandatos wire-compatible com AP2 — declarações assinadas, formato portável' },
          { status: 'roadmap', text: 'Verificação de mandatos cross-platform (aceitar mandatos AP2 emitidos em outro lugar)' },
        ],
        link: 'https://github.com/google/agent-payments-protocol',
      },
      {
        id: 'server-cards',
        name: 'MCP Server Cards',
        status: 'monitoring',
        gov: 'MCP / Linux Foundation (roadmap 2026)',
        what: 'Metadata padronizada exposta via URLs .well-known para que qualquer crawler ou registry possa descobrir capacidades do servidor MCP sem se conectar. Similar ao nosso agent.json, mas como padrão compartilhado em vez de proprietário.',
        why: 'Server Cards permitirá que registries (registry.modelcontextprotocol.io, Smithery, Glama, PulseMCP) puxem metadata consistente de qualquer servidor MCP. Nosso agent.json é um superset hoje, mas deveríamos nos alinhar ao padrão quando estabilizar.',
        our_plan: [
          { status: 'done', text: 'agent.json com capabilities, schema, trust model, todos os endpoints' },
          { status: 'done', text: '.well-known/mcp/server-card.json para compatibilidade com Smithery' },
          { status: 'monitoring', text: 'Acompanhar o MCP working group para a finalização do spec de Server Cards' },
          { status: 'roadmap', text: 'Migrar agent.json para ser um superset estrito de Server Cards quando o spec estabilizar' },
        ],
        link: 'https://modelcontextprotocol.io',
      },
      {
        id: 'namespace',
        name: 'Official Registry Namespace Verification',
        status: 'planning',
        gov: 'Linux Foundation / MCP Registry',
        what: 'O registry oficial de MCP (registry.modelcontextprotocol.io) verifica namespaces via GitHub OAuth ou DNS. Isso dá identidade real a publicadores de skills — não apenas "Open Source Community" como autor.',
        why: 'Hoje qualquer skill pode alegar qualquer autor. Com verificação de namespace, uma skill que afirme ser de "anthropics/mcp-server-foo" deve vir realmente do GitHub org da anthropics. Essa é a fundação de confiança real.',
        our_plan: [
          { status: 'planning', text: 'Integrar a API do registry para verificar identidade do publicador no momento do submission' },
          { status: 'roadmap', text: 'Exibir badge de publicador verificado nas páginas de detalhe da skill' },
          { status: 'roadmap', text: 'Exigir verificação de namespace para o review_status "maintainer-verified"' },
        ],
        link: 'https://registry.modelcontextprotocol.io',
      },
      {
        id: 'task-scoped',
        name: 'Task-Scoped Mandates',
        status: 'roadmap',
        gov: 'Industry direction (ACP, AP2, MPP all converging)',
        what: 'Hoje mandatos são escopados por limite em $ e tempo. A direção da indústria é task-scoped: "este mandato só é válido para completar a tarefa X" — o agente não pode usá-lo para outra coisa, e o humano deve re-aprovar para cada nova tarefa. Mais restritivo que $500/90 dias.',
        why: 'Claude sinalizou isso como para onde a indústria está indo. Ser mais restritivo que os grandes players em autonomia é uma feature, não um bug — ganha confiança.',
        our_plan: [
          { status: 'roadmap', text: 'Adicionar campo task_description aos mandatos (texto livre, declarado pelo agente)' },
          { status: 'roadmap', text: 'Adicionar campo task_hash (hash determinístico de descrição da tarefa + ID do agente)' },
          { status: 'roadmap', text: 'Mostrar o escopo de tarefa em notificações para que o principal saiba PARA QUÊ foi o gasto, não só quanto' },
        ],
        link: 'https://agentcommunicationprotocol.org',
      },
    ],
  },

  zh: {
    badge: '标准承诺',
    whyTitle: '为何重要',
    whyP1Pre: '2025 年 12 月,Anthropic 将 MCP 捐赠给 Linux Foundation。官方注册表(',
    whyP1Link: 'registry.modelcontextprotocol.io',
    whyP1Mid: ')现在解决了',
    whyP1Strong: '发现',
    whyP1Post: ' —— 任何人都可以在那里找到 MCP 服务器。Smithery、Glama、PulseMCP 在策展和搜索上竞争。',
    whyP2Pre: '',
    whyP2Em: '未',
    whyP2Mid: '被解决的是',
    whyP2Strong: '信任',
    whyP2Post: ':一项独立分析发现,仅 1,691 个独立包就对应约 6470 万条服务器记录 —— 大量重复、零信号、活跃的供应链攻击(npm 包窃取钱包、PyPI 包外泄代理对话、每天数百个恶意 PR)。',
    whyP2Strong2: '这就是我们的切入点。',
    whyP2End: '我们不是最大的目录。我们是信任层。',
    whatLabel: '它是什么',
    whyLabel: '为何采用',
    planLabel: '我们的计划',
    govLabel: '治理:',
    learnMore: '→ 了解更多关于',
    calibTitle: '校准说明',
    calibP1Pre: 'ACP、AP2、x402 和 MPP 都在同时竞争与融合。今天没人会赌单一赢家。我们的策略是',
    calibP1Strong: '为互操作性而设计',
    calibP1Post: ',而非"选一个然后祈祷"。2026 年真正的风险是被排斥在最终胜出的标准之外 —— 而不是选错某个产品细节。',
    calibP2: '我们将支持多条支付轨道(今天的 x402、AP2 授权、稳定后的 MPP),以及多种发现格式(我们的 agent.json 超集、标准化后的 MCP Server Cards、Smithery 格式)。合规优先于纯粹。',
    disclosureTitle: '诚实披露',
    disclosure: [
      '我们尚未完成完整的 x402 或 AP2 合规。我们正在实现,而非已完成。',
      '我们当前的授权 JSON 在概念上与 AP2 相同,但尚未实现线缆兼容。迁移进行中。',
      '我们当前的 USDC 流程在功能上类似 x402(服务器返回支付挑战,客户端支付,服务器验证),但尚未使用 HTTP 402 状态码。封装进行中。',
      '本页上的每个状态都是一次 git commit。当某项从"实现中"变为"完成"时,你会首先在这里看到。',
    ],
    links: [
      { text: '→ 信任路线图(Claude 的 7 点)', to: '/trust' },
      { text: '→ 关于我们', to: '/about' },
      { text: '→ 目录透明度', to: '/catalog' },
      { text: '→ 管理授权', to: '/mandates' },
    ],
    statusMeta: {
      implementing: { color: '#00F299', label: '实现中', desc: '工程工作正在进行' },
      monitoring: { color: '#00d1ff', label: '关注中', desc: '跟踪规范,稳定后采用' },
      planning: { color: '#fbbf24', label: '规划中', desc: '设计阶段,尚未开始' },
      roadmap: { color: '#a78bfa', label: '路线图', desc: '未来,在实现项落地之后' },
    },
    planMeta: {
      done: { prefix: '✓', color: '#00F299' },
      in_progress: { prefix: '⟳', color: '#00d1ff' },
      monitoring: { prefix: '👁', color: '#00d1ff' },
      planning: { prefix: '✎', color: '#fbbf24' },
      roadmap: { prefix: '○', color: '#a78bfa' },
    },
    standards: [
      {
        id: 'x402',
        name: 'x402 — HTTP 402 Payment Required',
        status: 'implementing',
        gov: 'Linux Foundation (Coinbase, Cloudflare, Stripe, Google, Visa)',
        what: '恢复 HTTP 402 状态码,用于原生 HTTP 级支付。服务器返回 402 并附带支付指令,而非定制的 USDC 验证流程;客户端(代理)支付后携带支付证明重试。基于 Base 上的 USDC 构建。',
        why: '让我们摆脱"看起来像自制加密"的境地。x402 是一个有主要支持者的公认标准。任何支持 x402 的代理都可以无需定制集成地为我们付款。',
        our_plan: [
          { status: 'done', text: '基于 Base 的 USDC,带链上验证(我们当前的流程)' },
          { status: 'in_progress', text: '将流程封装为 x402 语义 —— 返回 HTTP 402 及支付挑战,接受带 x402 Payment 头的重试' },
          { status: 'roadmap', text: '完全符合 x402 协议,包括面向中介的 facilitates 协议' },
        ],
        link: 'https://x402.org',
      },
      {
        id: 'ap2',
        name: 'AP2 — Agent Payments Protocol',
        status: 'implementing',
        gov: 'Google (+ Visa, Mastercard, PayPal, Coinbase, 60+ partners)',
        what: '签名声明,定义代理可做什么:支出限额、范围、过期。跨平台可移植,加密可验证,即时可撤销。我们的"授权"在概念上与 AP2 授权相同 —— 我们正在迁移到线缆兼容。',
        why: 'AP2 有 60+ 合作伙伴,包括主要支付网络。来自其他平台、持有 AP2 授权的代理应能无需重新授权地在 MarketNow 上消费。定制的授权 JSON 会把我们锁定在自己的生态里。',
        our_plan: [
          { status: 'done', text: '授权概念(限额、单次购买上限、类别、过期、撤销)' },
          { status: 'done', text: '默认人机协作(notify 模式);silent 模式需明确 opt-in' },
          { status: 'in_progress', text: '使授权与 AP2 线缆兼容 —— 签名声明、可移植格式' },
          { status: 'roadmap', text: '跨平台授权验证(接受在其他地方签发的 AP2 授权)' },
        ],
        link: 'https://github.com/google/agent-payments-protocol',
      },
      {
        id: 'server-cards',
        name: 'MCP Server Cards',
        status: 'monitoring',
        gov: 'MCP / Linux Foundation (roadmap 2026)',
        what: '通过 .well-known URL 暴露的标准化元数据,任何爬虫或注册表都无需连接即可发现 MCP 服务器能力。类似我们的 agent.json,但作为共享标准而非专有方案。',
        why: 'Server Cards 将让注册表(registry.modelcontextprotocol.io、Smithery、Glama、PulseMCP)从任何 MCP 服务器拉取一致的元数据。我们的 agent.json 目前是超集,但应在标准稳定时与之对齐。',
        our_plan: [
          { status: 'done', text: 'agent.json —— 包含能力、schema、信任模型、所有 API 端点' },
          { status: 'done', text: '.well-known/mcp/server-card.json —— 用于兼容 Smithery' },
          { status: 'monitoring', text: '跟踪 MCP 工作组以了解 Server Cards 规范的最终化' },
          { status: 'roadmap', text: '当规范稳定时,将 agent.json 迁移为 Server Cards 的严格超集' },
        ],
        link: 'https://modelcontextprotocol.io',
      },
      {
        id: 'namespace',
        name: 'Official Registry Namespace Verification',
        status: 'planning',
        gov: 'Linux Foundation / MCP Registry',
        what: '官方 MCP 注册表(registry.modelcontextprotocol.io)通过 GitHub OAuth 或 DNS 验证命名空间。这给技能发布者以真实身份 —— 不再只是"开源社区"作为作者。',
        why: '今天任何技能都可以声称任何作者。有了命名空间验证,声称来自"anthropics/mcp-server-foo"的技能必须真正来自 anthropics GitHub 组织。这是真实信任的基础。',
        our_plan: [
          { status: 'planning', text: '在提交时集成注册表 API 以验证发布者身份' },
          { status: 'roadmap', text: '在技能详情页显示已验证发布者徽章' },
          { status: 'roadmap', text: '要求"maintainer-verified"review_status 必须通过命名空间验证' },
        ],
        link: 'https://registry.modelcontextprotocol.io',
      },
      {
        id: 'task-scoped',
        name: 'Task-Scoped Mandates',
        status: 'roadmap',
        gov: 'Industry direction (ACP, AP2, MPP all converging)',
        what: '今天授权以美元限额和时间界定范围。行业方向是任务范围:"此授权仅对完成任务 X 有效" —— 代理不能将其用于其他用途,人类必须为每个新任务重新批准。比 $500/90 天更严格。',
        why: 'Claude 将此标记为行业的方向。在自主性上比大玩家更严格是一个特性,而非缺陷 —— 它赢得信任。',
        our_plan: [
          { status: 'roadmap', text: '为授权添加 task_description 字段(自由文本,由代理声明)' },
          { status: 'roadmap', text: '添加 task_hash 字段(任务描述 + 代理 ID 的确定性哈希)' },
          { status: 'roadmap', text: '在通知中展示任务范围,让委托人知道支出用于何处,而不仅仅是金额' },
        ],
        link: 'https://agentcommunicationprotocol.org',
      },
    ],
  },

  fr: {
    badge: 'ENGAGEMENT STANDARDS',
    whyTitle: 'Pourquoi ça compte',
    whyP1Pre: 'En décembre 2025, Anthropic a fait don de MCP à la Linux Foundation. Le registry officiel (',
    whyP1Link: 'registry.modelcontextprotocol.io',
    whyP1Mid: ') résout désormais',
    whyP1Strong: 'la découverte',
    whyP1Post: ' — n\'importe qui peut y trouver des serveurs MCP. Smithery, Glama, PulseMCP se concurrencent sur la curation et la recherche.',
    whyP2Pre: 'Ce qui n\'est',
    whyP2Em: 'pas',
    whyP2Mid: 'résolu, c\'est',
    whyP2Strong: 'la confiance',
    whyP2Post: ' : une analyse indépendante a trouvé ~64,7 millions d\'entrées de serveurs issus de seulement 1 691 paquets uniques — duplication massive, zéro signal, attaques actives sur la chaîne d\'approvisionnement (paquets npm volant des wallets, paquets PyPI exfiltrant des conversations d\'agents, des centaines de PRs malveillants par jour).',
    whyP2Strong2: 'C\'est notre wedge.',
    whyP2End: 'Nous ne sommes pas le plus grand catalogue. Nous sommes la couche de confiance.',
    whatLabel: 'CE QUE C\'EST',
    whyLabel: 'POURQUOI NOUS L\'ADOPTONS',
    planLabel: 'NOTRE PLAN',
    govLabel: 'Gouvernance :',
    learnMore: '→ En savoir plus sur',
    calibTitle: 'Note de calibrage',
    calibP1Pre: 'ACP, AP2, x402 et MPP se concurrencent et se combinent simultanément. Personne ne parierait aujourd\'hui sur un seul gagnant. Notre stratégie est de',
    calibP1Strong: 'concevoir pour l\'interopérabilité',
    calibP1Post: ', pas « choisir un et espérer ». Le vrai risque en 2026, c\'est d\'être exclu du standard qui gagne — pas de se tromper sur un détail produit.',
    calibP2: 'Nous supporterons plusieurs rails de paiement (x402 aujourd\'hui, mandats AP2, MPP quand il se stabilisera) et plusieurs formats de découverte (notre superset agent.json, MCP Server Cards quand standardisé, format Smithery). Conformité plutôt que pureté.',
    disclosureTitle: 'Divulgation honnête',
    disclosure: [
      'Nous n\'avons pas encore achevé la pleine conformité x402 ou AP2. Nous sommes en cours d\'implémentation, pas terminés.',
      'Notre JSON de mandat actuel est conceptuellement identique à AP2 mais pas encore wire-compatible. Migration en cours.',
      'Notre flux USDC actuel est fonctionnellement similaire à x402 (le serveur renvoie un défi de paiement, le client paie, le serveur vérifie) mais n\'utilise pas encore le code de statut HTTP 402. Wrapping en cours.',
      'Chaque statut sur cette page est un git commit. Quand quelque chose passe d\'« implementing » à « done », vous le verrez ici en premier.',
    ],
    links: [
      { text: '→ Roadmap de confiance (les 7 points de Claude)', to: '/trust' },
      { text: '→ À propos de nous', to: '/about' },
      { text: '→ Transparence du catalogue', to: '/catalog' },
      { text: '→ Gérer les mandats', to: '/mandates' },
    ],
    statusMeta: {
      implementing: { color: '#00F299', label: 'EN COURS', desc: 'Travail d\'ingénierie actif en cours' },
      monitoring: { color: '#00d1ff', label: 'SURVEILLANCE', desc: 'Suit le spec, adoptera quand stable' },
      planning: { color: '#fbbf24', label: 'PLANIFICATION', desc: 'Phase de design, pas encore commencé' },
      roadmap: { color: '#a78bfa', label: 'ROADMAP', desc: 'Futur, après que les items en implémentation atterrissent' },
    },
    planMeta: {
      done: { prefix: '✓', color: '#00F299' },
      in_progress: { prefix: '⟳', color: '#00d1ff' },
      monitoring: { prefix: '👁', color: '#00d1ff' },
      planning: { prefix: '✎', color: '#fbbf24' },
      roadmap: { prefix: '○', color: '#a78bfa' },
    },
    standards: [
      {
        id: 'x402',
        name: 'x402 — HTTP 402 Payment Required',
        status: 'implementing',
        gov: 'Linux Foundation (Coinbase, Cloudflare, Stripe, Google, Visa)',
        what: 'Ressuscite le code de statut HTTP 402 pour des paiements natifs au niveau HTTP. Au lieu de flux custom de vérification USDC, le serveur renvoie 402 avec des instructions de paiement ; le client (agent) paie et réessaie avec la preuve de paiement. Construit sur USDC sur Base.',
        why: 'Nous sort du territoire du « crypto maison qui se trouve ». x402 est un standard reconnu avec des backers majeurs. N\'importe quel agent qui parle x402 peut nous payer sans intégration custom.',
        our_plan: [
          { status: 'done', text: 'USDC sur Base avec vérification on-chain (notre flux actuel)' },
          { status: 'in_progress', text: 'Envelopper le flux dans la sémantique x402 — renvoyer HTTP 402 avec défi de paiement, accepter retry avec header x402 Payment' },
          { status: 'roadmap', text: 'Pleine conformité au protocole x402, y compris le protocole facilitates pour les intermédiaires' },
        ],
        link: 'https://x402.org',
      },
      {
        id: 'ap2',
        name: 'AP2 — Agent Payments Protocol',
        status: 'implementing',
        gov: 'Google (+ Visa, Mastercard, PayPal, Coinbase, 60+ partners)',
        what: 'Déclarations signées qui définissent ce qu\'un agent peut faire : limites de dépense, périmètre, expiration. Portables entre plateformes, vérifiables cryptographiquement, révocables instantanément. Nos « mandats » sont conceptuellement identiques aux mandats AP2 — nous migrons pour être wire-compatible.',
        why: 'AP2 a 60+ partenaires dont les principaux réseaux de paiement. Un agent avec un mandat AP2 d\'une autre plateforme devrait pouvoir dépenser sur MarketNow sans ré-autorisation. Le JSON de mandat custom nous enferme dans notre propre écosystème.',
        our_plan: [
          { status: 'done', text: 'Concept de mandat (limite, plafond par achat, catégories, expiration, révocation)' },
          { status: 'done', text: 'Humain-dans-la-boucle par défaut (mode notify) ; silent exige opt-in explicite' },
          { status: 'in_progress', text: 'Rendre les mandats wire-compatible avec AP2 — déclarations signées, format portable' },
          { status: 'roadmap', text: 'Vérification de mandats cross-platform (accepter les mandats AP2 émis ailleurs)' },
        ],
        link: 'https://github.com/google/agent-payments-protocol',
      },
      {
        id: 'server-cards',
        name: 'MCP Server Cards',
        status: 'monitoring',
        gov: 'MCP / Linux Foundation (roadmap 2026)',
        what: 'Metadata standardisée exposée via URLs .well-known pour que n\'importe quel crawler ou registry puisse découvrir les capacités d\'un serveur MCP sans s\'y connecter. Similaire à notre agent.json, mais en tant que standard partagé plutôt que propriétaire.',
        why: 'Server Cards permettra aux registries (registry.modelcontextprotocol.io, Smithery, Glama, PulseMCP) de tirer une metadata cohérente de n\'importe quel serveur MCP. Notre agent.json est un superset aujourd\'hui, mais nous devrions nous aligner au standard quand il se stabilisera.',
        our_plan: [
          { status: 'done', text: 'agent.json avec capabilities, schema, trust model, tous les endpoints' },
          { status: 'done', text: '.well-known/mcp/server-card.json pour compatibilité Smithery' },
          { status: 'monitoring', text: 'Suivre le MCP working group pour la finalisation du spec Server Cards' },
          { status: 'roadmap', text: 'Migrer agent.json pour être un superset strict de Server Cards quand le spec se stabilise' },
        ],
        link: 'https://modelcontextprotocol.io',
      },
      {
        id: 'namespace',
        name: 'Official Registry Namespace Verification',
        status: 'planning',
        gov: 'Linux Foundation / MCP Registry',
        what: 'Le registry officiel MCP (registry.modelcontextprotocol.io) vérifie les namespaces via GitHub OAuth ou DNS. Cela donne une vraie identité aux éditeurs de skills — pas seulement « Open Source Community » comme auteur.',
        why: 'Aujourd\'hui n\'importe quelle skill peut revendiquer n\'importe quel auteur. Avec la vérification de namespace, une skill qui prétend venir de « anthropics/mcp-server-foo » doit réellement venir du GitHub org anthropics. C\'est la fondation de la vraie confiance.',
        our_plan: [
          { status: 'planning', text: 'Intégrer l\'API du registry pour vérifier l\'identité de l\'éditeur au moment de la soumission' },
          { status: 'roadmap', text: 'Afficher un badge d\'éditeur vérifié sur les pages de détail des skills' },
          { status: 'roadmap', text: 'Exiger la vérification de namespace pour le review_status « maintainer-verified »' },
        ],
        link: 'https://registry.modelcontextprotocol.io',
      },
      {
        id: 'task-scoped',
        name: 'Task-Scoped Mandates',
        status: 'roadmap',
        gov: 'Industry direction (ACP, AP2, MPP all converging)',
        what: 'Aujourd\'hui les mandats sont scopés par limite en $ et par durée. La direction de l\'industrie est task-scoped : « ce mandat n\'est valable que pour accomplir la tâche X » — l\'agent ne peut pas l\'utiliser pour autre chose, et l\'humain doit ré-approuver pour chaque nouvelle tâche. Plus restrictif que 500 $/90 jours.',
        why: 'Claude a signalé ça comme la direction de l\'industrie. Être plus restrictif que les grands acteurs sur l\'autonomie est une fonctionnalité, pas un bug — ça gagne la confiance.',
        our_plan: [
          { status: 'roadmap', text: 'Ajouter un champ task_description aux mandats (texte libre, déclaré par l\'agent)' },
          { status: 'roadmap', text: 'Ajouter un champ task_hash (hash déterministe de la description de tâche + ID de l\'agent)' },
          { status: 'roadmap', text: 'Surfacer le scope de tâche dans les notifications pour que le principal sache POUR QUOI était la dépense, pas juste combien' },
        ],
        link: 'https://agentcommunicationprotocol.org',
      },
    ],
  },
};

export default function Standards() {
  const { t, lang } = useLang();
  const c = CONTENT[lang] || CONTENT.en;
  return (
    <div className="min-h-screen pt-20 pb-20 px-4 md:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00F299]/10 border border-[#00F299]/20 mb-4">
            <span className="text-[#00F299] text-[10px] font-mono tracking-wider">{c.badge}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">{t('standards.title')}</h1>
          <p className="text-zinc-400 text-lg max-w-2xl">
            {t('standards.subtitle')}
          </p>
        </motion.div>

        {/* Strategic positioning */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="premium-card p-6 mb-8">
          <h2 className="text-white text-sm font-mono tracking-wider mb-3 uppercase">{c.whyTitle}</h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-3">
            {c.whyP1Pre}
            <a href="https://registry.modelcontextprotocol.io" target="_blank" rel="noopener" className="text-[#00F299] hover:underline">{c.whyP1Link}</a>
            {c.whyP1Mid} <strong className="text-white">{c.whyP1Strong}</strong>{c.whyP1Post}
          </p>
          <p className="text-zinc-400 text-sm leading-relaxed">
            {c.whyP2Pre} <em>{c.whyP2Em}</em> {c.whyP2Mid} <strong className="text-white">{c.whyP2Strong}</strong>{c.whyP2Post} <strong className="text-white">{c.whyP2Strong2}</strong> {c.whyP2End}
          </p>
        </motion.div>

        {/* Standards list */}
        <div className="space-y-6">
          {c.standards.map((s, i) => {
            const meta = c.statusMeta[s.status];
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="premium-card p-6"
              >
                <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <h2 className="text-white text-lg font-bold">{s.name}</h2>
                    <div className="text-zinc-500 text-xs mt-1">{c.govLabel} {s.gov}</div>
                  </div>
                  <span
                    className="px-3 py-1 rounded-full text-[10px] font-mono font-bold"
                    style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}30` }}
                  >
                    {meta.label}
                  </span>
                </div>

                <div className="mb-4">
                  <div className="text-zinc-500 text-[10px] mb-1 font-mono">{c.whatLabel}</div>
                  <p className="text-zinc-300 text-sm leading-relaxed">{s.what}</p>
                </div>

                <div className="mb-4">
                  <div className="text-zinc-500 text-[10px] mb-1 font-mono">{c.whyLabel}</div>
                  <p className="text-zinc-300 text-sm leading-relaxed">{s.why}</p>
                </div>

                <div className="mb-4">
                  <div className="text-zinc-500 text-[10px] mb-2 font-mono">{c.planLabel}</div>
                  <ul className="space-y-1">
                    {s.our_plan.map((p, j) => {
                      const m = c.planMeta[p.status] || c.planMeta.roadmap;
                      return (
                        <li key={j} className="text-zinc-400 text-xs flex gap-2">
                          <span style={{ color: m.color }} className="flex-shrink-0">{m.prefix}</span>
                          <span>{p.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <a
                  href={s.link}
                  target="_blank"
                  rel="noopener"
                  className="text-[#00F299] text-xs hover:underline"
                >
                  {c.learnMore} {s.name.split('—')[0].trim()}
                </a>
              </motion.div>
            );
          })}
        </div>

        {/* Calibration note */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-8 premium-card p-6">
          <h3 className="text-white text-sm font-mono tracking-wider mb-3 uppercase">{c.calibTitle}</h3>
          <p className="text-zinc-400 text-sm leading-relaxed mb-3">
            {c.calibP1Pre} <strong className="text-white">{c.calibP1Strong}</strong>{c.calibP1Post}
          </p>
          <p className="text-zinc-500 text-xs leading-relaxed">
            {c.calibP2}
          </p>
        </motion.div>

        {/* Honest disclosure */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-8 premium-card p-6">
          <h3 className="text-white text-sm font-mono tracking-wider mb-3 uppercase">{c.disclosureTitle}</h3>
          <ul className="space-y-2 text-sm text-zinc-400">
            {c.disclosure.map((d, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[#00F299]">✓</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            {c.links.map((link, i) => (
              <Link key={link.to} to={link.to} className={i === 0 ? 'text-[#00F299] hover:underline' : 'text-zinc-400 hover:underline'}>
                {link.text}
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
