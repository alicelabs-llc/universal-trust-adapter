import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT — Listings consistency page text in 5 languages
// Quoted strings / URLs / version numbers kept as-is for factual accuracy.
// ═══════════════════════════════════════════════════════════════════════════
const CONTENT = {
  en: {
    badge: 'EXTERNAL LISTING CONSISTENCY',
    title: 'External Directory Listings',
    subtitle:
      'Claude flagged that our mcp.so listing contradicts our actual site — wrong skill count, wrong payment chains, "no manual approval" messaging. This page tracks the consistency of every external directory that lists MarketNow, so agents and humans can verify which sources are current.',
    problemTitle: 'The problem Claude found',
    problemIntro:
      'An agent that discovers MarketNow via mcp.so (more likely than via our own domain) sees a stale, less honest version:',
    saysLabel: 'mcp.so says:',
    realityLabel: 'reality:',
    problems: [
      { claim: '"9,248 verified MCP-compatible skills"', reality: '9,248' },
      {
        claim: '"agent-to-agent crypto payments (ETH/BSC/SOL/BTC)"',
        reality: 'USDC on Base only',
      },
      {
        claim: '"open registry with no manual approval needed"',
        reality:
          'human-in-loop is the default; "no humans needed" was removed from our site',
      },
      {
        claim: '"largest open MCP skill marketplace"',
        reality:
          'we no longer claim to be the largest; we position as the trust layer',
      },
    ],
    problemFooter:
      'Consistency between surfaces matters as much as the content of our own site. A honest marketnow.site is worthless if the directory listing that agents actually use to discover us is dishonest.',
    lastCheckedLabel: 'Last checked:',
    whatWeDidLabel: 'WHAT WE DID',
    knownDiscLabel: 'KNOWN DISCREPANCIES',
    commitmentTitle: 'Our commitment',
    commitment: [
      'We will maintain this page as the canonical source of truth for which external listings are current vs stale.',
      'When we cannot update an external listing directly, we will disclose the discrepancy here rather than pretend it does not exist.',
      'If you find a listing that contradicts our actual capabilities, email info@alicelabs.site and we will investigate and document it here.',
      'The official MCP registry (registry.modelcontextprotocol.io) will be our canonical listing once we complete namespace verification.',
    ],
    standardsLink: "→ Standards we're adopting",
    trustLink: '→ Trust roadmap',
    aboutLink: '→ About us',
    statusMeta: {
      updated: { color: '#00F299', label: 'UPDATED' },
      'partially-correct': { color: '#00d1ff', label: 'PARTIALLY CORRECT' },
      stale: { color: '#ef4444', label: 'STALE — NEEDS UPDATE' },
      listed: { color: '#00F299', label: 'LISTED' },
      'not-listed': { color: '#a78bfa', label: 'NOT LISTED' },
      unknown: { color: '#fbbf24', label: 'UNKNOWN' },
      'not-registered': { color: '#fbbf24', label: 'NOT REGISTERED' },
    },
    listings: [
      {
        name: 'npm (marketnow-mcp)',
        url: 'https://www.npmjs.com/package/marketnow-mcp',
        status: 'updated',
        version: '1.4.0',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'v1.2.0: description said "9,248+ verified skills" → "9,248 MCP-compatible skills"',
          'v1.3.0: added "trust layer for agent commerce" positioning',
          'v1.4.0: description now includes "UTA v1.0.0, x402 (USDC on Base), AP2 mandates, AliceLabs LLC"',
          'v1.4.0: removed "open-source" and "mit" keywords (license is MNNC-1.0, not MIT)',
          'v1.4.0: added "trust-layer" and "aliceLabs" keywords',
          'License field: MIT → MNNC-1.0 (corrected in v1.4.0 source)',
        ],
        notes:
          'npm package v1.4.0 published 2026-07-04. Old versions (1.1.0–1.3.0) are immutable in the registry — they cannot be changed. v1.4.0 is the canonical version with correct data. Mirrors propagate within 24h.',
      },
      {
        name: 'Smithery',
        url: 'https://smithery.ai/servers/alicelabs/marketnow',
        status: 'partially-correct',
        version: 'N/A',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'Smithery pulls from our server-card.json at /.well-known/mcp/server-card.json',
          'Our server-card.json is up to date with current numbers (9,248 skills, USDC on Base, MNNC-1.0)',
        ],
        knownDiscrepancies: [
          'Smithery HTML still shows "9,248" in some cached views (their crawler may not have re-indexed yet)',
        ],
        notes:
          'Smithery quality score: 84/100. Listing should reflect current data once Smithery re-crawls our server-card.json. Their cache TTL is typically 24-48h.',
      },
      {
        name: 'mcp.so',
        url: 'https://mcp.so/server/marketnow-mcp---aep-agent-exchange-protocol/edgarfloresguerra2011-a11y',
        status: 'stale',
        version: 'N/A',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'Opened GitHub issue #2977 on chatmcp/mcpso repo requesting listing update',
          'Created /.well-known/mcp-marketplace.json with canonical metadata any scraper can pull',
          'Updated GitHub repo README with canonical metadata table for crawlers',
          'mcp.so is behind Cloudflare anti-bot protection — cannot be updated programmatically',
          'Listing owner must update manually via mcp.so dashboard (requires login as @edgarfloresguerra2011-a11y)',
        ],
        knownDiscrepancies: [
          'Listing says "9,248 verified MCP-compatible skills" — should be 9,248',
          'Listing says "agent-to-agent crypto payments (ETH/BSC/SOL/BTC)" — we only support USDC on Base, NOT ETH/BSC/SOL/BTC directly',
          'Listing says "open registry with no manual approval needed" — we removed this framing; human-in-loop is now the default for mandates',
          'Listing says "largest open MCP skill marketplace" — we no longer claim to be the largest; we position as the trust layer',
          'Listing says "MIT license" — actual license is MNNC-1.0 (source-available, non-commercial)',
        ],
        notes:
          'mcp.so is operated by chatmcp (GitHub: chatmcp/mcpso). The listing owner (Edison Flores) has not yet logged in to mcp.so to edit the listing directly. The listing can be edited via the mcp.so dashboard.',
      },
      {
        name: 'Glama.ai',
        url: 'https://glama.ai/mcp/connectors?query=MarketNow+MCP',
        status: 'listed',
        version: 'N/A',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'Glama.ai now returns results for "MarketNow MCP" search',
          'Glama crawls our server-card.json and GitHub repo for metadata',
        ],
        notes:
          'Glama.ai appears to have indexed MarketNow. Verify the listing shows current numbers (9,248 skills, USDC on Base, MNNC-1.0). If stale, Glama\'s crawler should refresh within 7-14 days.',
      },
      {
        name: 'PulseMCP',
        url: 'https://www.pulsemcp.com',
        status: 'unknown',
        version: 'N/A',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'PulseMCP returned 403 (anti-bot protection). Cannot verify if we are listed.',
        ],
        notes:
          'If listed on PulseMCP, the listing should match our current positioning. We will verify when we can.',
      },
      {
        name: 'Official MCP Registry',
        url: 'https://registry.modelcontextprotocol.io',
        status: 'not-registered',
        version: 'N/A',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'We are not yet registered in the official MCP registry (registry.modelcontextprotocol.io).',
          'Registration requires namespace verification via GitHub OAuth or DNS — see /standards.',
        ],
        notes:
          'Registration in the official registry is on our roadmap. Once registered, our listing there will be the canonical source of truth that other directories can pull from.',
      },
    ],
  },

  es: {
    badge: 'CONSISTENCIA DE LISTADOS EXTERNOS',
    title: 'Listados en directorios externos',
    subtitle:
      'Claude detectó que nuestro listado en mcp.so contradice nuestro sitio real — conteo de skills incorrecto, cadenas de pago incorrectas, mensaje de "no manual approval". Esta página rastrea la consistencia de cada directorio externo que lista MarketNow, para que agentes y humanos puedan verificar qué fuentes están actualizadas.',
    problemTitle: 'El problema que Claude encontró',
    problemIntro:
      'Un agente que descubre MarketNow vía mcp.so (más probable que vía nuestro propio dominio) ve una versión desactualizada y menos honesta:',
    saysLabel: 'mcp.so dice:',
    realityLabel: 'realidad:',
    problems: [
      { claim: '"9,248 verified MCP-compatible skills"', reality: '9,248' },
      {
        claim: '"agent-to-agent crypto payments (ETH/BSC/SOL/BTC)"',
        reality: 'solo USDC on Base',
      },
      {
        claim: '"open registry with no manual approval needed"',
        reality:
          'human-in-loop es el comportamiento por defecto; eliminamos "no humans needed" de nuestro sitio',
      },
      {
        claim: '"largest open MCP skill marketplace"',
        reality:
          'ya no afirmamos ser los más grandes; nos posicionamos como la capa de confianza',
      },
    ],
    problemFooter:
      'La consistencia entre superficies importa tanto como el contenido de nuestro propio sitio. Un marketnow.site honesto no vale nada si el listado del directorio que los agentes realmente usan para descubrirnos es deshonesto.',
    lastCheckedLabel: 'Última verificación:',
    whatWeDidLabel: 'LO QUE HICIMOS',
    knownDiscLabel: 'DISCREPANCIAS CONOCIDAS',
    commitmentTitle: 'Nuestro compromiso',
    commitment: [
      'Mantendremos esta página como la fuente canónica de verdad sobre qué listados externos están actualizados vs desactualizados.',
      'Cuando no podamos actualizar un listado externo directamente, divulgaremos la discrepancia aquí en lugar de fingir que no existe.',
      'Si encuentras un listado que contradice nuestras capacidades reales, escribe a info@alicelabs.site y lo investigaremos y documentaremos aquí.',
      'El registro oficial de MCP (registry.modelcontextprotocol.io) será nuestro listado canónico una vez que completemos la verificación de namespace.',
    ],
    standardsLink: '→ Estándares que adoptamos',
    trustLink: '→ Roadmap de confianza',
    aboutLink: '→ Sobre nosotros',
    statusMeta: {
      updated: { color: '#00F299', label: 'ACTUALIZADO' },
      'partially-correct': { color: '#00d1ff', label: 'PARCIALMENTE CORRECTO' },
      stale: { color: '#ef4444', label: 'DESACTUALIZADO — REQUIERE UPDATE' },
      listed: { color: '#00F299', label: 'LISTADO' },
      'not-listed': { color: '#a78bfa', label: 'NO LISTADO' },
      unknown: { color: '#fbbf24', label: 'DESCONOCIDO' },
      'not-registered': { color: '#fbbf24', label: 'NO REGISTRADO' },
    },
    listings: [
      {
        name: 'npm (marketnow-mcp)',
        url: 'https://www.npmjs.com/package/marketnow-mcp',
        status: 'updated',
        version: '1.4.0',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'v1.2.0: la descripción decía "9,248+ verified skills" → "9,248 MCP-compatible skills"',
          'v1.3.0: se añadió el posicionamiento de "trust layer for agent commerce"',
          'v1.4.0: la descripción ahora incluye "UTA v1.0.0, x402 (USDC on Base), AP2 mandates, AliceLabs LLC"',
          'v1.4.0: se eliminaron las keywords "open-source" y "mit" (la licencia es MNNC-1.0, no MIT)',
          'v1.4.0: se añadieron las keywords "trust-layer" y "aliceLabs"',
          'Campo de licencia: MIT → MNNC-1.0 (corregido en el código fuente v1.4.0)',
        ],
        notes:
          'Paquete npm v1.4.0 publicado el 2026-07-04. Las versiones antiguas (1.1.0–1.3.0) son inmutables en el registro — no pueden cambiarse. v1.4.0 es la versión canónica con datos correctos. Los mirrors se propagan en 24h.',
      },
      {
        name: 'Smithery',
        url: 'https://smithery.ai/servers/alicelabs/marketnow',
        status: 'partially-correct',
        version: 'N/A',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'Smithery toma datos de nuestro server-card.json en /.well-known/mcp/server-card.json',
          'Nuestro server-card.json está actualizado con los números actuales (9,248 skills, USDC on Base, MNNC-1.0)',
        ],
        knownDiscrepancies: [
          'El HTML de Smithery todavía muestra "9,248" en algunas vistas cacheadas (su crawler puede no haber re-indexado aún)',
        ],
        notes:
          'Puntaje de calidad de Smithery: 84/100. El listado debería reflejar los datos actuales una vez que Smithery vuelva a crawlear nuestro server-card.json. Su TTL de caché suele ser 24-48h.',
      },
      {
        name: 'mcp.so',
        url: 'https://mcp.so/server/marketnow-mcp---aep-agent-exchange-protocol/edgarfloresguerra2011-a11y',
        status: 'stale',
        version: 'N/A',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'Abrimos el GitHub issue #2977 en el repo chatmcp/mcpso solicitando la actualización del listado',
          'Creamos /.well-known/mcp-marketplace.json con metadatos canónicos que cualquier scraper puede tomar',
          'Actualizamos el README del repo de GitHub con una tabla de metadatos canónicos para crawlers',
          'mcp.so está detrás de protección anti-bot de Cloudflare — no se puede actualizar programáticamente',
          'El dueño del listado debe actualizar manualmente vía el dashboard de mcp.so (requiere login como @edgarfloresguerra2011-a11y)',
        ],
        knownDiscrepancies: [
          'El listado dice "9,248 verified MCP-compatible skills" — debería ser 9,248',
          'El listado dice "agent-to-agent crypto payments (ETH/BSC/SOL/BTC)" — solo soportamos USDC on Base, NO ETH/BSC/SOL/BTC directamente',
          'El listado dice "open registry with no manual approval needed" — eliminamos este framing; human-in-loop es ahora el comportamiento por defecto para mandates',
          'El listado dice "largest open MCP skill marketplace" — ya no afirmamos ser los más grandes; nos posicionamos como la capa de confianza',
          'El listado dice "MIT license" — la licencia real es MNNC-1.0 (source-available, non-commercial)',
        ],
        notes:
          'mcp.so es operado por chatmcp (GitHub: chatmcp/mcpso). El dueño del listado (Edison Flores) aún no ha iniciado sesión en mcp.so para editar el listado directamente. El listado se puede editar vía el dashboard de mcp.so.',
      },
      {
        name: 'Glama.ai',
        url: 'https://glama.ai/mcp/connectors?query=MarketNow+MCP',
        status: 'listed',
        version: 'N/A',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'Glama.ai ya devuelve resultados para la búsqueda "MarketNow MCP"',
          'Glama hace crawl de nuestro server-card.json y repo de GitHub para metadatos',
        ],
        notes:
          'Glama.ai parece haber indexado MarketNow. Verifica que el listado muestre los números actuales (9,248 skills, USDC on Base, MNNC-1.0). Si está desactualizado, el crawler de Glama debería refrescar en 7-14 días.',
      },
      {
        name: 'PulseMCP',
        url: 'https://www.pulsemcp.com',
        status: 'unknown',
        version: 'N/A',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'PulseMCP devolvió 403 (protección anti-bot). No se puede verificar si estamos listados.',
        ],
        notes:
          'Si estamos listados en PulseMCP, el listado debería coincidir con nuestro posicionamiento actual. Verificaremos cuando podamos.',
      },
      {
        name: 'Registro oficial de MCP',
        url: 'https://registry.modelcontextprotocol.io',
        status: 'not-registered',
        version: 'N/A',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'Todavía no estamos registrados en el registro oficial de MCP (registry.modelcontextprotocol.io).',
          'El registro requiere verificación de namespace vía GitHub OAuth o DNS — ver /standards.',
        ],
        notes:
          'El registro en el registro oficial está en nuestro roadmap. Una vez registrados, nuestro listado allí será la fuente canónica de verdad de la que otros directorios puedan tomar datos.',
      },
    ],
  },

  pt: {
    badge: 'CONSISTÊNCIA DE LISTAGENS EXTERNAS',
    title: 'Listagens em diretórios externos',
    subtitle:
      'Claude sinalizou que nossa listagem no mcp.so contradiz nosso site real — contagem de skills errada, cadeias de pagamento erradas, mensagem de "no manual approval". Esta página rastreia a consistência de cada diretório externo que lista o MarketNow, para que agentes e humanos possam verificar quais fontes estão atualizadas.',
    problemTitle: 'O problema que o Claude encontrou',
    problemIntro:
      'Um agente que descobre o MarketNow via mcp.so (mais provável do que via nosso próprio domínio) vê uma versão desatualizada e menos honesta:',
    saysLabel: 'mcp.so diz:',
    realityLabel: 'realidade:',
    problems: [
      { claim: '"9,248 verified MCP-compatible skills"', reality: '9,248' },
      {
        claim: '"agent-to-agent crypto payments (ETH/BSC/SOL/BTC)"',
        reality: 'apenas USDC on Base',
      },
      {
        claim: '"open registry with no manual approval needed"',
        reality:
          'human-in-loop é o padrão; removemos "no humans needed" do nosso site',
      },
      {
        claim: '"largest open MCP skill marketplace"',
        reality:
          'não afirmamos mais ser os maiores; nos posicionamos como a camada de confiança',
      },
    ],
    problemFooter:
      'A consistência entre superfícies importa tanto quanto o conteúdo do nosso próprio site. Um marketnow.site honesto não vale nada se a listagem do diretório que os agentes realmente usam para nos descobrir for desonesta.',
    lastCheckedLabel: 'Última verificação:',
    whatWeDidLabel: 'O QUE FAZEMOS',
    knownDiscLabel: 'DISCREPÂNCIAS CONHECIDAS',
    commitmentTitle: 'Nosso compromisso',
    commitment: [
      'Manteremos esta página como a fonte canônica de verdade sobre quais listagens externas estão atuais vs desatualizadas.',
      'Quando não pudermos atualizar uma listagem externa diretamente, divulgaremos a discrepância aqui em vez de fingir que ela não existe.',
      'Se você encontrar uma listagem que contradiz nossas capacidades reais, escreva para info@alicelabs.site e investigaremos e documentaremos aqui.',
      'O registro oficial de MCP (registry.modelcontextprotocol.io) será nossa listagem canônica assim que completarmos a verificação de namespace.',
    ],
    standardsLink: '→ Padrões que adotamos',
    trustLink: '→ Roadmap de confiança',
    aboutLink: '→ Sobre nós',
    statusMeta: {
      updated: { color: '#00F299', label: 'ATUALIZADO' },
      'partially-correct': { color: '#00d1ff', label: 'PARCIALMENTE CORRETO' },
      stale: { color: '#ef4444', label: 'DESATUALIZADO — PRECISA UPDATE' },
      listed: { color: '#00F299', label: 'LISTADO' },
      'not-listed': { color: '#a78bfa', label: 'NÃO LISTADO' },
      unknown: { color: '#fbbf24', label: 'DESCONHECIDO' },
      'not-registered': { color: '#fbbf24', label: 'NÃO REGISTRADO' },
    },
    listings: [
      {
        name: 'npm (marketnow-mcp)',
        url: 'https://www.npmjs.com/package/marketnow-mcp',
        status: 'updated',
        version: '1.4.0',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'v1.2.0: a descrição dizia "9,248+ verified skills" → "9,248 MCP-compatible skills"',
          'v1.3.0: adicionado o posicionamento de "trust layer for agent commerce"',
          'v1.4.0: a descrição agora inclui "UTA v1.0.0, x402 (USDC on Base), AP2 mandates, AliceLabs LLC"',
          'v1.4.0: removidas as keywords "open-source" e "mit" (a licença é MNNC-1.0, não MIT)',
          'v1.4.0: adicionadas as keywords "trust-layer" e "aliceLabs"',
          'Campo de licença: MIT → MNNC-1.0 (corrigido no código-fonte v1.4.0)',
        ],
        notes:
          'Pacote npm v1.4.0 publicado em 2026-07-04. Versões antigas (1.1.0–1.3.0) são imutáveis no registro — não podem ser alteradas. v1.4.0 é a versão canônica com dados corretos. Mirrors propagam em 24h.',
      },
      {
        name: 'Smithery',
        url: 'https://smithery.ai/servers/alicelabs/marketnow',
        status: 'partially-correct',
        version: 'N/A',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'Smithery puxa do nosso server-card.json em /.well-known/mcp/server-card.json',
          'Nosso server-card.json está atualizado com os números atuais (9,248 skills, USDC on Base, MNNC-1.0)',
        ],
        knownDiscrepancies: [
          'O HTML do Smithery ainda mostra "9,248" em algumas views em cache (o crawler pode não ter re-indexado ainda)',
        ],
        notes:
          'Pontuação de qualidade do Smithery: 84/100. A listagem deve refletir os dados atuais assim que o Smithery re-crawlear nosso server-card.json. O TTL de cache deles costuma ser 24-48h.',
      },
      {
        name: 'mcp.so',
        url: 'https://mcp.so/server/marketnow-mcp---aep-agent-exchange-protocol/edgarfloresguerra2011-a11y',
        status: 'stale',
        version: 'N/A',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'Abrimos a GitHub issue #2977 no repo chatmcp/mcpso solicitando atualização da listagem',
          'Criamos /.well-known/mcp-marketplace.json com metadados canônicos que qualquer scraper pode puxar',
          'Atualizamos o README do repo no GitHub com tabela de metadados canônicos para crawlers',
          'mcp.so está atrás de proteção anti-bot da Cloudflare — não pode ser atualizado programaticamente',
          'O dono da listagem precisa atualizar manualmente via o dashboard do mcp.so (requer login como @edgarfloresguerra2011-a11y)',
        ],
        knownDiscrepancies: [
          'A listagem diz "9,248 verified MCP-compatible skills" — deveria ser 9,248',
          'A listagem diz "agent-to-agent crypto payments (ETH/BSC/SOL/BTC)" — só suportamos USDC on Base, NÃO ETH/BSC/SOL/BTC diretamente',
          'A listagem diz "open registry with no manual approval needed" — removemos esse framing; human-in-loop agora é o padrão para mandates',
          'A listagem diz "largest open MCP skill marketplace" — não afirmamos mais ser os maiores; nos posicionamos como a camada de confiança',
          'A listagem diz "MIT license" — a licença real é MNNC-1.0 (source-available, non-commercial)',
        ],
        notes:
          'mcp.so é operado pela chatmcp (GitHub: chatmcp/mcpso). O dono da listagem (Edison Flores) ainda não fez login no mcp.so para editar a listagem diretamente. A listagem pode ser editada via o dashboard do mcp.so.',
      },
      {
        name: 'Glama.ai',
        url: 'https://glama.ai/mcp/connectors?query=MarketNow+MCP',
        status: 'listed',
        version: 'N/A',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'Glama.ai agora retorna resultados para a busca "MarketNow MCP"',
          'Glama faz crawl do nosso server-card.json e do repo no GitHub para metadados',
        ],
        notes:
          'Glama.ai parece ter indexado o MarketNow. Verifique se a listagem mostra os números atuais (9,248 skills, USDC on Base, MNNC-1.0). Se desatualizada, o crawler da Glama deve atualizar em 7-14 dias.',
      },
      {
        name: 'PulseMCP',
        url: 'https://www.pulsemcp.com',
        status: 'unknown',
        version: 'N/A',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'PulseMCP retornou 403 (proteção anti-bot). Não é possível verificar se estamos listados.',
        ],
        notes:
          'Se listados no PulseMCP, a listagem deve corresponder ao nosso posicionamento atual. Verificaremos quando pudermos.',
      },
      {
        name: 'Registro oficial de MCP',
        url: 'https://registry.modelcontextprotocol.io',
        status: 'not-registered',
        version: 'N/A',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'Ainda não estamos registrados no registro oficial de MCP (registry.modelcontextprotocol.io).',
          'O registro exige verificação de namespace via GitHub OAuth ou DNS — veja /standards.',
        ],
        notes:
          'O registro no registro oficial está no nosso roadmap. Assim que registrados, nossa listagem lá será a fonte canônica de verdade da qual outros diretórios podem puxar.',
      },
    ],
  },

  zh: {
    badge: '外部列表一致性',
    title: '外部目录列表',
    subtitle:
      'Claude 指出我们在 mcp.so 上的列表与本站实际不符 —— skill 数量错误、支付链错误、出现 "no manual approval" 的措辞。本页追踪所有列出 MarketNow 的外部目录一致性，让 agents 与人类可以核实哪些来源是当前的。',
    problemTitle: 'Claude 发现的问题',
    problemIntro:
      '通过 mcp.so（比通过我们自己的域名更常见）发现 MarketNow 的 agent，看到的是一个过时且不够诚实的版本：',
    saysLabel: 'mcp.so 写的是：',
    realityLabel: '实际情况：',
    problems: [
      { claim: '"9,248 verified MCP-compatible skills"', reality: '9,248' },
      {
        claim: '"agent-to-agent crypto payments (ETH/BSC/SOL/BTC)"',
        reality: '仅支持 USDC on Base',
      },
      {
        claim: '"open registry with no manual approval needed"',
        reality: 'human-in-loop 为默认；"no humans needed" 已从本站移除',
      },
      {
        claim: '"largest open MCP skill marketplace"',
        reality: '我们不再声称是最大的；我们定位为信任层',
      },
    ],
    problemFooter:
      '各呈现渠道之间的一致性，与本站内容同样重要。如果 agents 实际用来发现我们的目录列表是不诚实的，那么一个诚实的 marketnow.site 也毫无价值。',
    lastCheckedLabel: '最后核查：',
    whatWeDidLabel: '我们所做的',
    knownDiscLabel: '已知差异',
    commitmentTitle: '我们的承诺',
    commitment: [
      '我们会把本页作为权威来源，记录哪些外部列表是当前的、哪些是过时的。',
      '当我们无法直接更新某个外部列表时，我们会在此披露差异，而不是假装它不存在。',
      '如果你发现某个列表与我们实际能力不符，请发邮件至 info@alicelabs.site，我们会调查并在本页记录。',
      '完成 namespace 验证后，官方 MCP registry（registry.modelcontextprotocol.io）将成为我们的权威列表。',
    ],
    standardsLink: '→ 我们采纳的标准',
    trustLink: '→ 信任路线图',
    aboutLink: '→ 关于我们',
    statusMeta: {
      updated: { color: '#00F299', label: '已更新' },
      'partially-correct': { color: '#00d1ff', label: '部分正确' },
      stale: { color: '#ef4444', label: '过时 — 需更新' },
      listed: { color: '#00F299', label: '已收录' },
      'not-listed': { color: '#a78bfa', label: '未收录' },
      unknown: { color: '#fbbf24', label: '未知' },
      'not-registered': { color: '#fbbf24', label: '未注册' },
    },
    listings: [
      {
        name: 'npm (marketnow-mcp)',
        url: 'https://www.npmjs.com/package/marketnow-mcp',
        status: 'updated',
        version: '1.4.0',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'v1.2.0：描述中曾写为 "9,248+ verified skills" → "9,248 MCP-compatible skills"',
          'v1.3.0：添加了 "trust layer for agent commerce" 的定位',
          'v1.4.0：描述现已包含 "UTA v1.0.0, x402 (USDC on Base), AP2 mandates, AliceLabs LLC"',
          'v1.4.0：移除了 "open-source" 与 "mit" 关键词（license 为 MNNC-1.0，不是 MIT）',
          'v1.4.0：添加了 "trust-layer" 与 "aliceLabs" 关键词',
          'License 字段：MIT → MNNC-1.0（已在 v1.4.0 源码中更正）',
        ],
        notes:
          'npm 包 v1.4.0 发布于 2026-07-04。旧版本（1.1.0–1.3.0）在 registry 中不可变 —— 无法更改。v1.4.0 是数据正确的权威版本。镜像在 24 小时内传播完成。',
      },
      {
        name: 'Smithery',
        url: 'https://smithery.ai/servers/alicelabs/marketnow',
        status: 'partially-correct',
        version: 'N/A',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'Smithery 从我们的 /.well-known/mcp/server-card.json 拉取数据',
          '我们的 server-card.json 已更新为当前数据（9,248 skills，USDC on Base，MNNC-1.0）',
        ],
        knownDiscrepancies: [
          'Smithery 的 HTML 在某些缓存视图中仍显示 "9,248"（其爬虫可能尚未重新索引）',
        ],
        notes:
          'Smithery 质量分：84/100。一旦 Smithery 重新爬取我们的 server-card.json，列表应反映当前数据。其缓存 TTL 通常为 24-48 小时。',
      },
      {
        name: 'mcp.so',
        url: 'https://mcp.so/server/marketnow-mcp---aep-agent-exchange-protocol/edgarfloresguerra2011-a11y',
        status: 'stale',
        version: 'N/A',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          '在 chatmcp/mcpso 仓库提了 GitHub issue #2977，请求更新列表',
          '创建了 /.well-known/mcp-marketplace.json，包含任何爬虫都可拉取的权威元数据',
          '更新了 GitHub 仓库 README，附上权威元数据表供爬虫使用',
          'mcp.so 受 Cloudflare anti-bot 保护 —— 无法通过程序化方式更新',
          '列表所有者必须通过 mcp.so dashboard 手动更新（需以 @edgarfloresguerra2011-a11y 身份登录）',
        ],
        knownDiscrepancies: [
          '列表写的是 "9,248 verified MCP-compatible skills" —— 应为 9,248',
          '列表写的是 "agent-to-agent crypto payments (ETH/BSC/SOL/BTC)" —— 我们只支持 USDC on Base，不直接支持 ETH/BSC/SOL/BTC',
          '列表写的是 "open registry with no manual approval needed" —— 我们已移除该表述；human-in-loop 现为 mandates 的默认行为',
          '列表写的是 "largest open MCP skill marketplace" —— 我们不再声称是最大的；我们定位为信任层',
          '列表写的是 "MIT license" —— 实际 license 是 MNNC-1.0（source-available, non-commercial）',
        ],
        notes:
          'mcp.so 由 chatmcp 运营（GitHub：chatmcp/mcpso）。列表所有者（Edison Flores）尚未登录 mcp.so 直接编辑该列表。该列表可通过 mcp.so dashboard 编辑。',
      },
      {
        name: 'Glama.ai',
        url: 'https://glama.ai/mcp/connectors?query=MarketNow+MCP',
        status: 'listed',
        version: 'N/A',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'Glama.ai 现已对 "MarketNow MCP" 搜索返回结果',
          'Glama 会爬取我们的 server-card.json 与 GitHub 仓库获取元数据',
        ],
        notes:
          'Glama.ai 似乎已索引 MarketNow。请核实列表显示的是当前数据（9,248 skills，USDC on Base，MNNC-1.0）。如已过时，Glama 的爬虫应在 7-14 天内刷新。',
      },
      {
        name: 'PulseMCP',
        url: 'https://www.pulsemcp.com',
        status: 'unknown',
        version: 'N/A',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'PulseMCP 返回 403（anti-bot 保护）。无法核实我们是否被收录。',
        ],
        notes:
          '如果 PulseMCP 收录了我们，列表应与我们当前定位一致。条件允许时我们会核实。',
      },
      {
        name: '官方 MCP Registry',
        url: 'https://registry.modelcontextprotocol.io',
        status: 'not-registered',
        version: 'N/A',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          '我们尚未在官方 MCP registry（registry.modelcontextprotocol.io）中注册。',
          '注册需要通过 GitHub OAuth 或 DNS 完成 namespace 验证 —— 见 /standards。',
        ],
        notes:
          '官方 registry 注册在我们的路线图上。一旦注册完成，我们在那里的列表将成为其他目录可拉取的权威来源。',
      },
    ],
  },

  fr: {
    badge: 'COHÉRENCE DES ANNUAIRES EXTERNES',
    title: 'Listings dans les annuaires externes',
    subtitle:
      'Claude a signalé que notre listing sur mcp.so contredit notre site réel — mauvais nombre de skills, mauvaises chaînes de paiement, message « no manual approval ». Cette page suit la cohérence de chaque annuaire externe qui liste MarketNow, pour que les agents et les humains puissent vérifier quelles sources sont à jour.',
    problemTitle: 'Le problème identifié par Claude',
    problemIntro:
      'Un agent qui découvre MarketNow via mcp.so (plus probable que via notre propre domaine) voit une version obsolète et moins honnête :',
    saysLabel: 'mcp.so dit :',
    realityLabel: 'réalité :',
    problems: [
      { claim: '"9,248 verified MCP-compatible skills"', reality: '9,248' },
      {
        claim: '"agent-to-agent crypto payments (ETH/BSC/SOL/BTC)"',
        reality: 'USDC on Base uniquement',
      },
      {
        claim: '"open registry with no manual approval needed"',
        reality:
          'human-in-loop est le défaut ; « no humans needed » a été retiré de notre site',
      },
      {
        claim: '"largest open MCP skill marketplace"',
        reality:
          'nous ne prétendons plus être les plus grands ; nous nous positionnons comme la couche de confiance',
      },
    ],
    problemFooter:
      "La cohérence entre surfaces importe autant que le contenu de notre propre site. Un marketnow.site honnête ne vaut rien si le listing de l'annuaire que les agents utilisent réellement pour nous découvrir est malhonnête.",
    lastCheckedLabel: 'Dernière vérification :',
    whatWeDidLabel: 'CE QUE NOUS AVONS FAIT',
    knownDiscLabel: 'DISCREPANCES CONNUES',
    commitmentTitle: 'Notre engagement',
    commitment: [
      'Nous maintiendrons cette page comme la source canonique de vérité sur quels listings externes sont à jour vs obsolètes.',
      "Lorsque nous ne pouvons pas mettre à jour un listing externe directement, nous divulguerons la discrepancy ici plutôt que de prétendre qu'elle n'existe pas.",
      "Si vous trouvez un listing qui contredit nos capacités réelles, écrivez à info@alicelabs.site et nous l'examinerons et le documenterons ici.",
      "Le registre officiel MCP (registry.modelcontextprotocol.io) sera notre listing canonique une fois la vérification de namespace terminée.",
    ],
    standardsLink: '→ Standards que nous adoptons',
    trustLink: '→ Roadmap de confiance',
    aboutLink: '→ À propos de nous',
    statusMeta: {
      updated: { color: '#00F299', label: 'À JOUR' },
      'partially-correct': { color: '#00d1ff', label: 'PARTIELLEMENT CORRECT' },
      stale: { color: '#ef4444', label: 'OBSOLÈTE — MISE À JOUR REQUISE' },
      listed: { color: '#00F299', label: 'LISTÉ' },
      'not-listed': { color: '#a78bfa', label: 'NON LISTÉ' },
      unknown: { color: '#fbbf24', label: 'INCONNU' },
      'not-registered': { color: '#fbbf24', label: 'NON ENREGISTRÉ' },
    },
    listings: [
      {
        name: 'npm (marketnow-mcp)',
        url: 'https://www.npmjs.com/package/marketnow-mcp',
        status: 'updated',
        version: '1.4.0',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'v1.2.0 : la description disait "9,248+ verified skills" → "9,248 MCP-compatible skills"',
          'v1.3.0 : ajout du positionnement « trust layer for agent commerce »',
          'v1.4.0 : la description inclut désormais "UTA v1.0.0, x402 (USDC on Base), AP2 mandates, AliceLabs LLC"',
          'v1.4.0 : suppression des mots-clés "open-source" et "mit" (la licence est MNNC-1.0, pas MIT)',
          'v1.4.0 : ajout des mots-clés "trust-layer" et "aliceLabs"',
          'Champ de licence : MIT → MNNC-1.0 (corrigé dans le code source v1.4.0)',
        ],
        notes:
          "Paquet npm v1.4.0 publié le 2026-07-04. Les anciennes versions (1.1.0–1.3.0) sont immuables dans le registre — elles ne peuvent pas être modifiées. v1.4.0 est la version canonique avec les données correctes. Les miroirs se propagent en 24h.",
      },
      {
        name: 'Smithery',
        url: 'https://smithery.ai/servers/alicelabs/marketnow',
        status: 'partially-correct',
        version: 'N/A',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'Smithery récupère depuis notre server-card.json à /.well-known/mcp/server-card.json',
          'Notre server-card.json est à jour avec les chiffres actuels (9,248 skills, USDC on Base, MNNC-1.0)',
        ],
        knownDiscrepancies: [
          'Le HTML de Smithery affiche encore "9,248" dans certaines vues en cache (leur crawler n\'a peut-être pas encore ré-indexé)',
        ],
        notes:
          "Score de qualité Smithery : 84/100. Le listing devrait refléter les données actuelles une fois que Smithery recrawl notre server-card.json. Leur TTL de cache est généralement de 24-48h.",
      },
      {
        name: 'mcp.so',
        url: 'https://mcp.so/server/marketnow-mcp---aep-agent-exchange-protocol/edgarfloresguerra2011-a11y',
        status: 'stale',
        version: 'N/A',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'Ouvert le GitHub issue #2977 sur le repo chatmcp/mcpso demandant la mise à jour du listing',
          'Créé /.well-known/mcp-marketplace.json avec des métadonnées canoniques que tout scraper peut récupérer',
          'Mis à jour le README du repo GitHub avec un tableau de métadonnées canoniques pour les crawlers',
          'mcp.so est derrière la protection anti-bot de Cloudflare — ne peut pas être mis à jour programmatiquement',
          "Le propriétaire du listing doit le mettre à jour manuellement via le dashboard mcp.so (connexion requise en tant que @edgarfloresguerra2011-a11y)",
        ],
        knownDiscrepancies: [
          'Le listing dit "9,248 verified MCP-compatible skills" — devrait être 9,248',
          'Le listing dit "agent-to-agent crypto payments (ETH/BSC/SOL/BTC)" — nous ne supportons que USDC on Base, PAS ETH/BSC/SOL/BTC directement',
          'Le listing dit "open registry with no manual approval needed" — nous avons retiré ce framing ; human-in-loop est désormais le défaut pour les mandates',
          'Le listing dit "largest open MCP skill marketplace" — nous ne prétendons plus être les plus grands ; nous nous positionnons comme la couche de confiance',
          'Le listing dit "MIT license" — la licence réelle est MNNC-1.0 (source-available, non-commercial)',
        ],
        notes:
          "mcp.so est opéré par chatmcp (GitHub : chatmcp/mcpso). Le propriétaire du listing (Edison Flores) ne s'est pas encore connecté à mcp.so pour éditer le listing directement. Le listing peut être édité via le dashboard mcp.so.",
      },
      {
        name: 'Glama.ai',
        url: 'https://glama.ai/mcp/connectors?query=MarketNow+MCP',
        status: 'listed',
        version: 'N/A',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'Glama.ai retourne désormais des résultats pour la recherche "MarketNow MCP"',
          'Glama crawle notre server-card.json et notre repo GitHub pour les métadonnées',
        ],
        notes:
          'Glama.ai semble avoir indexé MarketNow. Vérifiez que le listing affiche les chiffres actuels (9,248 skills, USDC on Base, MNNC-1.0). Si obsolète, le crawler de Glama devrait se rafraîchir en 7-14 jours.',
      },
      {
        name: 'PulseMCP',
        url: 'https://www.pulsemcp.com',
        status: 'unknown',
        version: 'N/A',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          'PulseMCP a renvoyé 403 (protection anti-bot). Impossible de vérifier si nous sommes listés.',
        ],
        notes:
          'Si listés sur PulseMCP, le listing devrait correspondre à notre positionnement actuel. Nous vérifierons quand nous le pourrons.',
      },
      {
        name: 'Registre officiel MCP',
        url: 'https://registry.modelcontextprotocol.io',
        status: 'not-registered',
        version: 'N/A',
        lastChecked: '2026-07-04',
        whatWeFixed: [
          "Nous ne sommes pas encore enregistrés dans le registre officiel MCP (registry.modelcontextprotocol.io).",
          "L'enregistrement nécessite la vérification de namespace via GitHub OAuth ou DNS — voir /standards.",
        ],
        notes:
          "L'enregistrement dans le registre officiel est dans notre roadmap. Une fois enregistrés, notre listing là-bas sera la source canonique de vérité dont les autres annuaires pourront récupérer les données.",
      },
    ],
  },
};

export default function Listings() {
  const { lang } = useLang();
  const c = CONTENT[lang] || CONTENT.en;

  return (
    <div className="min-h-screen pt-20 pb-20 px-4 md:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00F299]/10 border border-[#00F299]/20 mb-4">
            <span className="text-[#00F299] text-[10px] font-mono tracking-wider">{c.badge}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">{c.title}</h1>
          <p className="text-zinc-400 text-lg max-w-2xl">{c.subtitle}</p>
        </motion.div>

        {/* The problem */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="premium-card p-6 mb-8 border-l-4 border-red-500/50"
        >
          <h2 className="text-white text-sm font-mono tracking-wider mb-3 uppercase">
            {c.problemTitle}
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-3">{c.problemIntro}</p>
          <ul className="space-y-2 text-sm">
            {c.problems.map((p, idx) => (
              <li key={idx} className="flex gap-2 text-red-300">
                <span>✗</span>
                <span>
                  <strong>{c.saysLabel}</strong> {p.claim} — <strong>{c.realityLabel}</strong>{' '}
                  {p.reality}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-zinc-500 text-xs mt-4">{c.problemFooter}</p>
        </motion.div>

        {/* Listings table */}
        <div className="space-y-4">
          {c.listings.map((l, i) => {
            const meta = c.statusMeta[l.status];
            return (
              <motion.div
                key={l.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="premium-card p-6"
              >
                <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <h2 className="text-white text-lg font-bold">
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noopener"
                        className="hover:text-[#00F299]"
                      >
                        {l.name} →
                      </a>
                    </h2>
                    <div className="text-zinc-500 text-xs mt-1">
                      {c.lastCheckedLabel} {l.lastChecked}
                    </div>
                  </div>
                  <span
                    className="px-3 py-1 rounded-full text-[10px] font-mono font-bold"
                    style={{
                      background: `${meta.color}15`,
                      color: meta.color,
                      border: `1px solid ${meta.color}30`,
                    }}
                  >
                    {meta.label}
                  </span>
                </div>

                {l.whatWeFixed && (
                  <div className="mb-3">
                    <div className="text-[#00F299] text-[10px] mb-1 font-mono">
                      {c.whatWeDidLabel}
                    </div>
                    <ul className="space-y-1">
                      {l.whatWeFixed.map((w, j) => (
                        <li key={j} className="text-zinc-300 text-xs flex gap-2">
                          <span className="text-[#00F299]">✓</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {l.knownDiscrepancies && (
                  <div className="mb-3">
                    <div className="text-red-400 text-[10px] mb-1 font-mono">
                      {c.knownDiscLabel}
                    </div>
                    <ul className="space-y-1">
                      {l.knownDiscrepancies.map((w, j) => (
                        <li key={j} className="text-red-300 text-xs flex gap-2">
                          <span className="text-red-400">✗</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {l.notes && (
                  <div className="text-zinc-500 text-xs leading-relaxed mt-2 pt-2 border-t border-white/5">
                    {l.notes}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Commitment */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 premium-card p-6"
        >
          <h3 className="text-white text-sm font-mono tracking-wider mb-3 uppercase">
            {c.commitmentTitle}
          </h3>
          <ul className="space-y-2 text-sm text-zinc-400">
            {c.commitment.map((item, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="text-[#00F299]">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <Link to="/standards" className="text-[#00F299] hover:underline">
              {c.standardsLink}
            </Link>
            <Link to="/trust" className="text-zinc-400 hover:underline">
              {c.trustLink}
            </Link>
            <Link to="/about" className="text-zinc-400 hover:underline">
              {c.aboutLink}
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
