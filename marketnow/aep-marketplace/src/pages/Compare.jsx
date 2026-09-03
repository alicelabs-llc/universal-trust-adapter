import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT — Competitive comparison in 5 languages (en, es, pt, zh, fr)
// ═══════════════════════════════════════════════════════════════════════════
const CONTENT = {
  en: {
    badge: 'COMPETITIVE COMPARISON',
    title: 'MarketNow vs Smithery vs Glama vs MCP Registry',
    subtitle: 'Honest comparison. We\'re not the biggest — we\'re the trust layer. Each platform serves a different purpose. Here\'s exactly what each does.',
    summaryTitle: 'The four platforms, summarized',
    summary: [
      {
        key: 'MARKETNOW',
        tagline: 'Trust layer for agent commerce',
        desc: 'Security audits + payments + mandates. For agents that need to spend real money safely.',
      },
      {
        key: 'SMITHERY',
        tagline: 'Hosted MCP servers',
        desc: 'No-install MCP servers. Free. Good for trying without setup.',
      },
      {
        key: 'GLAMA',
        tagline: 'Discovery directory',
        desc: 'Browse MCP servers. Free. Good for finding what exists.',
      },
      {
        key: 'MCP REGISTRY',
        tagline: 'Canonical namespace registry',
        desc: 'Linux Foundation. Namespace verification. The source of truth.',
      },
    ],
    insightPre: 'Key insight: ',
    insightBody: 'MarketNow doesn\'t compete with the others — it\'s a layer on top. Use the MCP Registry for identity, Smithery for hosted access, Glama for discovery, and MarketNow for trust (security, payments, mandates).',
    tableTitle: 'Feature-by-feature comparison',
    tableHeaders: { feature: 'Feature', marketnow: 'MarketNow', smithery: 'Smithery', glama: 'Glama', mcpRegistry: 'MCP Registry' },
    rows: [
      {
        feature: 'Catalog size',
        marketnow: '9,248 skills',
        smithery: '~3,000 servers',
        glama: '~5,000 servers',
        mcpRegistry: '~64.7M entries (1,691 unique)',
      },
      {
        feature: 'Security audit',
        marketnow: 'Sentinel v3.0 (6-point scan on every skill)',
        smithery: 'Quality score (proprietary)',
        glama: 'Safety score (proprietary)',
        mcpRegistry: 'None (raw registry)',
      },
      {
        feature: 'Review status transparency',
        marketnow: 'auto-scanned | human-reviewed | maintainer-verified (per skill)',
        smithery: 'Quality score only',
        glama: 'Safety score only',
        mcpRegistry: 'None',
      },
      {
        feature: 'Payment protocol',
        marketnow: 'x402 (HTTP 402) + Stripe',
        smithery: 'None (free)',
        glama: 'None (free)',
        mcpRegistry: 'None',
      },
      {
        feature: 'Agent spending authorization',
        marketnow: 'AP2-compatible mandates (human-in-loop default)',
        smithery: 'None',
        glama: 'None',
        mcpRegistry: 'None',
      },
      {
        feature: 'Human-in-the-loop',
        marketnow: 'DEFAULT (notify mode). Silent requires explicit opt-in.',
        smithery: 'N/A',
        glama: 'N/A',
        mcpRegistry: 'N/A',
      },
      {
        feature: 'Public audit log',
        marketnow: 'Every mandate transaction = git commit',
        smithery: 'No',
        glama: 'No',
        mcpRegistry: 'No',
      },
      {
        feature: 'Open source',
        marketnow: 'MIT (full code, public repo)',
        smithery: 'No (proprietary)',
        glama: 'No (proprietary)',
        mcpRegistry: 'Open source (registry only)',
      },
      {
        feature: 'Identity verification',
        marketnow: 'Planning (MCP Registry namespace verification)',
        smithery: 'No',
        glama: 'No',
        mcpRegistry: 'GitHub OAuth / DNS verification',
      },
      {
        feature: 'Price model',
        marketnow: 'B2B: Everything free — no tiers, no enterprise fees',
        smithery: 'Free (hosted MCP servers)',
        glama: 'Free (directory)',
        mcpRegistry: 'Free (registry)',
      },
      {
        feature: 'Languages',
        marketnow: 'EN, ES, ZH, PT, FR (system prompts)',
        smithery: 'EN only',
        glama: 'EN only',
        mcpRegistry: 'N/A',
      },
      {
        feature: 'Use case',
        marketnow: 'Trust layer for agent commerce',
        smithery: 'Hosted MCP servers (no install)',
        glama: 'Discovery directory',
        mcpRegistry: 'Canonical namespace registry',
      },
    ],
    whenTitle: 'When to use which',
    whenUse: [
      {
        key: 'USE MARKETNOW IF:',
        desc: 'You\'re building an agent that needs to buy skills with real money (USDC or credit card). You need security audits. You need spending controls (mandates). You want a public audit log.',
        highlight: true,
      },
      {
        key: 'USE SMITHERY IF:',
        desc: 'You want to try MCP servers without installing anything. Free hosted access. Good for experimentation.',
      },
      {
        key: 'USE GLAMA IF:',
        desc: 'You want to browse and discover MCP servers. Free directory. Good for research.',
      },
      {
        key: 'USE MCP REGISTRY IF:',
        desc: 'You\'re a tool publisher and want canonical namespace verification (GitHub OAuth / DNS). The source of truth for "is this really from anthropics/mcp-server-foo?"',
      },
    ],
    disclosureTitle: 'Honest disclosure',
    disclosure: [
      'Smithery and Glama have more traffic than us today. We\'re new (launched 2026).',
      'The MCP Registry is the canonical source. We\'re not competing with it — we\'re integrating with it for namespace verification.',
      'Our Sentinel v3.0 audit is self-declared (we wrote the scanner). Independent audit pending until revenue.',
      'We have 0 maintainer-verified skills today. The program is designed but not launched.',
      'x402 and AP2 are "implementing" — not fully compliant yet. See /standards.',
    ],
    links: [
      { to: '/trust', text: '→ Trust roadmap' },
      { to: '/standards', text: '→ Standards' },
      { to: '/catalog', text: '→ Catalog transparency' },
      { to: '/', text: '→ Back to home' },
    ],
  },

  es: {
    badge: 'COMPARACIÓN COMPETITIVA',
    title: 'MarketNow vs Smithery vs Glama vs MCP Registry',
    subtitle: 'Comparación honesta. No somos los más grandes — somos la capa de confianza. Cada plataforma tiene un propósito distinto. Esto es exactamente lo que hace cada una.',
    summaryTitle: 'Las cuatro plataformas, resumidas',
    summary: [
      {
        key: 'MARKETNOW',
        tagline: 'Capa de confianza para el comercio de agentes',
        desc: 'Auditorías de seguridad + pagos + mandates. Para agentes que necesitan gastar dinero real de forma segura.',
      },
      {
        key: 'SMITHERY',
        tagline: 'Servidores MCP alojados',
        desc: 'Servidores MCP sin instalación. Gratis. Bueno para probar sin configuración.',
      },
      {
        key: 'GLAMA',
        tagline: 'Directorio de descubrimiento',
        desc: 'Explora servidores MCP. Gratis. Bueno para encontrar lo que existe.',
      },
      {
        key: 'MCP REGISTRY',
        tagline: 'Registro canónico de namespaces',
        desc: 'Linux Foundation. Verificación de namespaces. La fuente de verdad.',
      },
    ],
    insightPre: 'Idea clave: ',
    insightBody: 'MarketNow no compite con los demás — es una capa por encima. Usa el MCP Registry para identidad, Smithery para acceso alojado, Glama para descubrimiento y MarketNow para confianza (seguridad, pagos, mandates).',
    tableTitle: 'Comparación característica por característica',
    tableHeaders: { feature: 'Característica', marketnow: 'MarketNow', smithery: 'Smithery', glama: 'Glama', mcpRegistry: 'MCP Registry' },
    rows: [
      {
        feature: 'Tamaño del catálogo',
        marketnow: '9,248 skills',
        smithery: '~3,000 servers',
        glama: '~5,000 servers',
        mcpRegistry: '~64.7M entradas (1,691 únicos)',
      },
      {
        feature: 'Auditoría de seguridad',
        marketnow: 'Sentinel v3.0 (escaneo de 6 puntos en cada skill)',
        smithery: 'Quality score (propietario)',
        glama: 'Safety score (propietario)',
        mcpRegistry: 'Ninguna (registro bruto)',
      },
      {
        feature: 'Transparencia del review status',
        marketnow: 'auto-scanned | human-reviewed | maintainer-verified (por skill)',
        smithery: 'Solo quality score',
        glama: 'Solo safety score',
        mcpRegistry: 'Ninguna',
      },
      {
        feature: 'Protocolo de pago',
        marketnow: 'x402 (HTTP 402) + Stripe',
        smithery: 'Ninguno (gratis)',
        glama: 'Ninguno (gratis)',
        mcpRegistry: 'Ninguno',
      },
      {
        feature: 'Autorización de gasto del agente',
        marketnow: 'Mandates compatibles con AP2 (human-in-loop por defecto)',
        smithery: 'Ninguna',
        glama: 'Ninguna',
        mcpRegistry: 'Ninguna',
      },
      {
        feature: 'Human-in-the-loop',
        marketnow: 'POR DEFECTO (modo notify). El modo silencioso requiere opt-in explícito.',
        smithery: 'N/A',
        glama: 'N/A',
        mcpRegistry: 'N/A',
      },
      {
        feature: 'Log de auditoría público',
        marketnow: 'Cada transacción de mandate = git commit',
        smithery: 'No',
        glama: 'No',
        mcpRegistry: 'No',
      },
      {
        feature: 'Código abierto',
        marketnow: 'MIT (código completo, repo público)',
        smithery: 'No (propietario)',
        glama: 'No (propietario)',
        mcpRegistry: 'Código abierto (solo registry)',
      },
      {
        feature: 'Verificación de identidad',
        marketnow: 'En planeación (verificación de namespaces del MCP Registry)',
        smithery: 'No',
        glama: 'No',
        mcpRegistry: 'Verificación GitHub OAuth / DNS',
      },
      {
        feature: 'Modelo de precio',
        marketnow: 'B2B: Todo gratis — sin niveles ni tarifas',
        smithery: 'Gratis (servidores MCP alojados)',
        glama: 'Gratis (directorio)',
        mcpRegistry: 'Gratis (registry)',
      },
      {
        feature: 'Idiomas',
        marketnow: 'EN, ES, ZH, PT, FR (system prompts)',
        smithery: 'Solo EN',
        glama: 'Solo EN',
        mcpRegistry: 'N/A',
      },
      {
        feature: 'Caso de uso',
        marketnow: 'Capa de confianza para el comercio de agentes',
        smithery: 'Servidores MCP alojados (sin instalación)',
        glama: 'Directorio de descubrimiento',
        mcpRegistry: 'Registro canónico de namespaces',
      },
    ],
    whenTitle: 'Cuándo usar cuál',
    whenUse: [
      {
        key: 'USA MARKETNOW SI:',
        desc: 'Estás construyendo un agente que necesita comprar skills con dinero real (USDC o tarjeta de crédito). Necesitas auditorías de seguridad. Necesitas controles de gasto (mandates). Quieres un log de auditoría público.',
        highlight: true,
      },
      {
        key: 'USA SMITHERY SI:',
        desc: 'Quieres probar servidores MCP sin instalar nada. Acceso alojado gratis. Bueno para experimentación.',
      },
      {
        key: 'USA GLAMA SI:',
        desc: 'Quieres explorar y descubrir servidores MCP. Directorio gratis. Bueno para investigación.',
      },
      {
        key: 'USA MCP REGISTRY SI:',
        desc: 'Eres un publicador de tools y quieres verificación canónica de namespace (GitHub OAuth / DNS). La fuente de verdad para "¿esto realmente viene de anthropics/mcp-server-foo?"',
      },
    ],
    disclosureTitle: 'Divulgación honesta',
    disclosure: [
      'Smithery y Glama tienen más tráfico que nosotros hoy. Somos nuevos (lanzado en 2026).',
      'El MCP Registry es la fuente canónica. No competimos con él — nos estamos integrando para verificación de namespaces.',
      'Nuestra auditoría Sentinel v3.0 es autodeclarada (escribimos el scanner). Auditoría independiente pendiente hasta tener ingresos.',
      'Tenemos 0 skills maintainer-verified hoy. El programa está diseñado pero no lanzado.',
      'x402 y AP2 están "implementándose" — aún no son totalmente compliant. Ver /standards.',
    ],
    links: [
      { to: '/trust', text: '→ Hoja de ruta de confianza' },
      { to: '/standards', text: '→ Estándares' },
      { to: '/catalog', text: '→ Transparencia del catálogo' },
      { to: '/', text: '→ Volver al inicio' },
    ],
  },

  pt: {
    badge: 'COMPARAÇÃO COMPETITIVA',
    title: 'MarketNow vs Smithery vs Glama vs MCP Registry',
    subtitle: 'Comparação honesta. Não somos os maiores — somos a camada de confiança. Cada plataforma tem um propósito diferente. Veja exatamente o que cada uma faz.',
    summaryTitle: 'As quatro plataformas, resumidas',
    summary: [
      {
        key: 'MARKETNOW',
        tagline: 'Camada de confiança para comércio de agentes',
        desc: 'Auditorias de segurança + pagamentos + mandates. Para agentes que precisam gastar dinheiro real com segurança.',
      },
      {
        key: 'SMITHERY',
        tagline: 'Servidores MCP hospedados',
        desc: 'Servidores MCP sem instalação. Grátis. Bom para testar sem setup.',
      },
      {
        key: 'GLAMA',
        tagline: 'Diretório de descoberta',
        desc: 'Navegue em servidores MCP. Grátis. Bom para descobrir o que existe.',
      },
      {
        key: 'MCP REGISTRY',
        tagline: 'Registro canônico de namespaces',
        desc: 'Linux Foundation. Verificação de namespaces. A fonte da verdade.',
      },
    ],
    insightPre: 'Insight-chave: ',
    insightBody: 'O MarketNow não compete com os outros — é uma camada por cima. Use o MCP Registry para identidade, Smithery para acesso hospedado, Glama para descoberta e MarketNow para confiança (segurança, pagamentos, mandates).',
    tableTitle: 'Comparação recurso por recurso',
    tableHeaders: { feature: 'Recurso', marketnow: 'MarketNow', smithery: 'Smithery', glama: 'Glama', mcpRegistry: 'MCP Registry' },
    rows: [
      {
        feature: 'Tamanho do catálogo',
        marketnow: '9,248 skills',
        smithery: '~3,000 servers',
        glama: '~5,000 servers',
        mcpRegistry: '~64.7M entradas (1.691 únicos)',
      },
      {
        feature: 'Auditoria de segurança',
        marketnow: 'Sentinel v3.0 (scan de 6 pontos em cada skill)',
        smithery: 'Quality score (proprietário)',
        glama: 'Safety score (proprietário)',
        mcpRegistry: 'Nenhuma (registry bruto)',
      },
      {
        feature: 'Transparência do review status',
        marketnow: 'auto-scanned | human-reviewed | maintainer-verified (por skill)',
        smithery: 'Apenas quality score',
        glama: 'Apenas safety score',
        mcpRegistry: 'Nenhuma',
      },
      {
        feature: 'Protocolo de pagamento',
        marketnow: 'x402 (HTTP 402) + Stripe',
        smithery: 'Nenhum (grátis)',
        glama: 'Nenhum (grátis)',
        mcpRegistry: 'Nenhum',
      },
      {
        feature: 'Autorização de gasto do agente',
        marketnow: 'Mandates compatíveis com AP2 (human-in-loop por padrão)',
        smithery: 'Nenhuma',
        glama: 'Nenhuma',
        mcpRegistry: 'Nenhuma',
      },
      {
        feature: 'Human-in-the-loop',
        marketnow: 'PADRÃO (modo notify). O modo silencioso exige opt-in explícito.',
        smithery: 'N/A',
        glama: 'N/A',
        mcpRegistry: 'N/A',
      },
      {
        feature: 'Log de auditoria público',
        marketnow: 'Cada transação de mandate = git commit',
        smithery: 'Não',
        glama: 'Não',
        mcpRegistry: 'Não',
      },
      {
        feature: 'Código aberto',
        marketnow: 'MIT (código completo, repo público)',
        smithery: 'Não (proprietário)',
        glama: 'Não (proprietário)',
        mcpRegistry: 'Código aberto (somente registry)',
      },
      {
        feature: 'Verificação de identidade',
        marketnow: 'Em planejamento (verificação de namespaces do MCP Registry)',
        smithery: 'Não',
        glama: 'Não',
        mcpRegistry: 'Verificação GitHub OAuth / DNS',
      },
      {
        feature: 'Modelo de preço',
        marketnow: 'B2B: Tudo grátis — sem níveis nem tarifas',
        smithery: 'Grátis (servidores MCP hospedados)',
        glama: 'Grátis (diretório)',
        mcpRegistry: 'Grátis (registry)',
      },
      {
        feature: 'Idiomas',
        marketnow: 'EN, ES, ZH, PT, FR (system prompts)',
        smithery: 'Somente EN',
        glama: 'Somente EN',
        mcpRegistry: 'N/A',
      },
      {
        feature: 'Caso de uso',
        marketnow: 'Camada de confiança para comércio de agentes',
        smithery: 'Servidores MCP hospedados (sem instalação)',
        glama: 'Diretório de descoberta',
        mcpRegistry: 'Registro canônico de namespaces',
      },
    ],
    whenTitle: 'Quando usar qual',
    whenUse: [
      {
        key: 'USE MARKETNOW SE:',
        desc: 'Você está construindo um agente que precisa comprar skills com dinheiro real (USDC ou cartão de crédito). Você precisa de auditorias de segurança. Você precisa de controles de gasto (mandates). Você quer um log de auditoria público.',
        highlight: true,
      },
      {
        key: 'USE SMITHERY SE:',
        desc: 'Você quer testar servidores MCP sem instalar nada. Acesso hospedado grátis. Bom para experimentação.',
      },
      {
        key: 'USE GLAMA SE:',
        desc: 'Você quer navegar e descobrir servidores MCP. Diretório grátis. Bom para pesquisa.',
      },
      {
        key: 'USE MCP REGISTRY SE:',
        desc: 'Você é um publicador de tools e quer verificação canônica de namespace (GitHub OAuth / DNS). A fonte da verdade para "isso é realmente do anthropics/mcp-server-foo?"',
      },
    ],
    disclosureTitle: 'Divulgação honesta',
    disclosure: [
      'Smithery e Glama têm mais tráfego que nós hoje. Somos novos (lançados em 2026).',
      'O MCP Registry é a fonte canônica. Não estamos competindo com ele — estamos nos integrando para verificação de namespaces.',
      'Nossa auditoria Sentinel v3.0 é autodeclarada (nós escrevemos o scanner). Auditoria independente pendente até receita.',
      'Temos 0 skills maintainer-verified hoje. O programa foi desenhado mas não lançado.',
      'x402 e AP2 estão "em implementação" — ainda não totalmente compliant. Veja /standards.',
    ],
    links: [
      { to: '/trust', text: '→ Roteiro de confiança' },
      { to: '/standards', text: '→ Padrões' },
      { to: '/catalog', text: '→ Transparência do catálogo' },
      { to: '/', text: '→ Voltar ao início' },
    ],
  },

  zh: {
    badge: '竞品对比',
    title: 'MarketNow vs Smithery vs Glama vs MCP Registry',
    subtitle: '诚实的对比。我们不是最大的——我们是信任层。每个平台都有不同的用途。以下是它们各自的确切功能。',
    summaryTitle: '四个平台，总结如下',
    summary: [
      {
        key: 'MARKETNOW',
        tagline: 'agent 商务的信任层',
        desc: '安全审计 + 支付 + mandates。适用于需要安全花费真实货币的 agent。',
      },
      {
        key: 'SMITHERY',
        tagline: '托管的 MCP 服务器',
        desc: '免安装的 MCP 服务器。免费。适合无需配置即可试用。',
      },
      {
        key: 'GLAMA',
        tagline: '发现型目录',
        desc: '浏览 MCP 服务器。免费。适合发现现有内容。',
      },
      {
        key: 'MCP REGISTRY',
        tagline: '规范的命名空间注册表',
        desc: 'Linux Foundation。命名空间验证。真相之源。',
      },
    ],
    insightPre: '关键洞察：',
    insightBody: 'MarketNow 不与其他平台竞争——它是建立在它们之上的一个层。用 MCP Registry 做身份验证，用 Smithery 做托管访问，用 Glama 做发现，用 MarketNow 做信任（安全、支付、mandates）。',
    tableTitle: '逐项功能对比',
    tableHeaders: { feature: '功能', marketnow: 'MarketNow', smithery: 'Smithery', glama: 'Glama', mcpRegistry: 'MCP Registry' },
    rows: [
      {
        feature: '目录大小',
        marketnow: '9,248 skills',
        smithery: '~3,000 servers',
        glama: '~5,000 servers',
        mcpRegistry: '~64.7M 条目（1,691 个唯一）',
      },
      {
        feature: '安全审计',
        marketnow: 'Sentinel v3.0（每个 skill 6 项扫描）',
        smithery: 'Quality score（专有）',
        glama: 'Safety score（专有）',
        mcpRegistry: '无（原始 registry）',
      },
      {
        feature: '审查状态透明度',
        marketnow: 'auto-scanned | human-reviewed | maintainer-verified（每个 skill）',
        smithery: '仅 quality score',
        glama: '仅 safety score',
        mcpRegistry: '无',
      },
      {
        feature: '支付协议',
        marketnow: 'x402 (HTTP 402) + Stripe',
        smithery: '无（免费）',
        glama: '无（免费）',
        mcpRegistry: '无',
      },
      {
        feature: 'agent 支出授权',
        marketnow: '兼容 AP2 的 mandates（默认 human-in-loop）',
        smithery: '无',
        glama: '无',
        mcpRegistry: '无',
      },
      {
        feature: 'Human-in-the-loop',
        marketnow: '默认（notify 模式）。静默模式需要明确 opt-in。',
        smithery: 'N/A',
        glama: 'N/A',
        mcpRegistry: 'N/A',
      },
      {
        feature: '公开审计日志',
        marketnow: '每次 mandate 交易 = git commit',
        smithery: '否',
        glama: '否',
        mcpRegistry: '否',
      },
      {
        feature: '开源',
        marketnow: 'MIT（完整代码，公开仓库）',
        smithery: '否（专有）',
        glama: '否（专有）',
        mcpRegistry: '开源（仅 registry）',
      },
      {
        feature: '身份验证',
        marketnow: '计划中（MCP Registry 命名空间验证）',
        smithery: '否',
        glama: '否',
        mcpRegistry: 'GitHub OAuth / DNS 验证',
      },
      {
        feature: '价格模型',
        marketnow: 'B2B: 全部免费 — 无分级、无费用',
        smithery: '免费（托管的 MCP 服务器）',
        glama: '免费（目录）',
        mcpRegistry: '免费（registry）',
      },
      {
        feature: '语言',
        marketnow: 'EN, ES, ZH, PT, FR（system prompts）',
        smithery: '仅 EN',
        glama: '仅 EN',
        mcpRegistry: 'N/A',
      },
      {
        feature: '用途',
        marketnow: 'agent 商务的信任层',
        smithery: '托管的 MCP 服务器（免安装）',
        glama: '发现型目录',
        mcpRegistry: '规范的命名空间注册表',
      },
    ],
    whenTitle: '何时使用哪个',
    whenUse: [
      {
        key: '使用 MARKETNOW：',
        desc: '你正在构建一个需要用真实货币（USDC 或信用卡）购买 skill 的 agent。你需要安全审计。你需要支出控制（mandates）。你想要公开的审计日志。',
        highlight: true,
      },
      {
        key: '使用 SMITHERY：',
        desc: '你想无需安装任何东西即可试用 MCP 服务器。免费托管访问。适合实验。',
      },
      {
        key: '使用 GLAMA：',
        desc: '你想浏览并发现 MCP 服务器。免费目录。适合研究。',
      },
      {
        key: '使用 MCP REGISTRY：',
        desc: '你是 tool 发布者，希望获得规范的命名空间验证（GitHub OAuth / DNS）。用于判断"这个是否真的来自 anthropics/mcp-server-foo？"的真相之源。',
      },
    ],
    disclosureTitle: '诚实披露',
    disclosure: [
      '今天 Smithery 和 Glama 的流量比我们多。我们是新平台（2026 年上线）。',
      'MCP Registry 是规范来源。我们不与它竞争——我们正在与之集成以进行命名空间验证。',
      '我们的 Sentinel v3.0 审计是自我声明的（我们编写了扫描器）。独立审计在获得收入之前仍待进行。',
      '我们今天有 0 个 maintainer-verified 的 skill。该计划已设计但尚未启动。',
      'x402 和 AP2 处于"实现中"状态——尚未完全合规。参见 /standards。',
    ],
    links: [
      { to: '/trust', text: '→ 信任路线图' },
      { to: '/standards', text: '→ 标准' },
      { to: '/catalog', text: '→ 目录透明度' },
      { to: '/', text: '→ 返回首页' },
    ],
  },

  fr: {
    badge: 'COMPARAISON CONCURRENTIELLE',
    title: 'MarketNow vs Smithery vs Glama vs MCP Registry',
    subtitle: 'Comparaison honnête. Nous ne sommes pas les plus grands — nous sommes la couche de confiance. Chaque plateforme a un but différent. Voici exactement ce que fait chacune.',
    summaryTitle: 'Les quatre plateformes, en résumé',
    summary: [
      {
        key: 'MARKETNOW',
        tagline: 'Couche de confiance pour le commerce des agents',
        desc: 'Audits de sécurité + paiements + mandates. Pour les agents qui doivent dépenser de l\'argent réel en toute sécurité.',
      },
      {
        key: 'SMITHERY',
        tagline: 'Serveurs MCP hébergés',
        desc: 'Serveurs MCP sans installation. Gratuit. Pratique pour essayer sans configuration.',
      },
      {
        key: 'GLAMA',
        tagline: 'Annuaire de découverte',
        desc: 'Parcourez les serveurs MCP. Gratuit. Pratique pour découvrir ce qui existe.',
      },
      {
        key: 'MCP REGISTRY',
        tagline: 'Registre canonique des namespaces',
        desc: 'Linux Foundation. Vérification de namespaces. La source de vérité.',
      },
    ],
    insightPre: 'Idée clé : ',
    insightBody: 'MarketNow ne concurrence pas les autres — c\'est une couche par-dessus. Utilisez le MCP Registry pour l\'identité, Smithery pour l\'accès hébergé, Glama pour la découverte, et MarketNow pour la confiance (sécurité, paiements, mandates).',
    tableTitle: 'Comparaison fonctionnalité par fonctionnalité',
    tableHeaders: { feature: 'Fonctionnalité', marketnow: 'MarketNow', smithery: 'Smithery', glama: 'Glama', mcpRegistry: 'MCP Registry' },
    rows: [
      {
        feature: 'Taille du catalogue',
        marketnow: '8 560 skills',
        smithery: '~3 000 servers',
        glama: '~5 000 servers',
        mcpRegistry: '~64,7M entrées (1 691 uniques)',
      },
      {
        feature: 'Audit de sécurité',
        marketnow: 'Sentinel v3.0 (scan 6 points sur chaque skill)',
        smithery: 'Quality score (propriétaire)',
        glama: 'Safety score (propriétaire)',
        mcpRegistry: 'Aucun (registry brut)',
      },
      {
        feature: 'Transparence du review status',
        marketnow: 'auto-scanned | human-reviewed | maintainer-verified (par skill)',
        smithery: 'Seulement quality score',
        glama: 'Seulement safety score',
        mcpRegistry: 'Aucune',
      },
      {
        feature: 'Protocole de paiement',
        marketnow: 'x402 (HTTP 402) + Stripe',
        smithery: 'Aucun (gratuit)',
        glama: 'Aucun (gratuit)',
        mcpRegistry: 'Aucun',
      },
      {
        feature: 'Autorisation de dépense de l\'agent',
        marketnow: 'Mandates compatibles AP2 (human-in-loop par défaut)',
        smithery: 'Aucune',
        glama: 'Aucune',
        mcpRegistry: 'Aucune',
      },
      {
        feature: 'Human-in-the-loop',
        marketnow: 'PAR DÉFAUT (mode notify). Le mode silencieux requiert opt-in explicite.',
        smithery: 'N/A',
        glama: 'N/A',
        mcpRegistry: 'N/A',
      },
      {
        feature: 'Journal d\'audit public',
        marketnow: 'Chaque transaction de mandate = git commit',
        smithery: 'Non',
        glama: 'Non',
        mcpRegistry: 'Non',
      },
      {
        feature: 'Open source',
        marketnow: 'MIT (code complet, repo public)',
        smithery: 'Non (propriétaire)',
        glama: 'Non (propriétaire)',
        mcpRegistry: 'Open source (registry uniquement)',
      },
      {
        feature: 'Vérification d\'identité',
        marketnow: 'En planification (vérification de namespaces du MCP Registry)',
        smithery: 'Non',
        glama: 'Non',
        mcpRegistry: 'Vérification GitHub OAuth / DNS',
      },
      {
        feature: 'Modèle de prix',
        marketnow: 'B2B : Tout gratuit — sans paliers ni frais',
        smithery: 'Gratuit (serveurs MCP hébergés)',
        glama: 'Gratuit (annuaire)',
        mcpRegistry: 'Gratuit (registry)',
      },
      {
        feature: 'Langues',
        marketnow: 'EN, ES, ZH, PT, FR (system prompts)',
        smithery: 'EN uniquement',
        glama: 'EN uniquement',
        mcpRegistry: 'N/A',
      },
      {
        feature: 'Cas d\'usage',
        marketnow: 'Couche de confiance pour le commerce des agents',
        smithery: 'Serveurs MCP hébergés (sans installation)',
        glama: 'Annuaire de découverte',
        mcpRegistry: 'Registre canonique des namespaces',
      },
    ],
    whenTitle: 'Quand utiliser lequel',
    whenUse: [
      {
        key: 'UTILISEZ MARKETNOW SI :',
        desc: 'Vous construisez un agent qui doit acheter des skills avec de l\'argent réel (USDC ou carte de crédit). Vous avez besoin d\'audits de sécurité. Vous avez besoin de contrôles de dépense (mandates). Vous voulez un journal d\'audit public.',
        highlight: true,
      },
      {
        key: 'UTILISEZ SMITHERY SI :',
        desc: 'Vous voulez essayer des serveurs MCP sans rien installer. Accès hébergé gratuit. Bon pour l\'expérimentation.',
      },
      {
        key: 'UTILISEZ GLAMA SI :',
        desc: 'Vous voulez parcourir et découvrir des serveurs MCP. Annuaire gratuit. Bon pour la recherche.',
      },
      {
        key: 'UTILISEZ MCP REGISTRY SI :',
        desc: 'Vous êtes un éditeur de tools et voulez une vérification canonique de namespace (GitHub OAuth / DNS). La source de vérité pour « cela vient-il vraiment de anthropics/mcp-server-foo ? »',
      },
    ],
    disclosureTitle: 'Divulgation honnête',
    disclosure: [
      'Smithery et Glama ont plus de trafic que nous aujourd\'hui. Nous sommes nouveaux (lancés en 2026).',
      'Le MCP Registry est la source canonique. Nous ne concourons pas avec lui — nous nous y intégrons pour la vérification des namespaces.',
      'Notre audit Sentinel v3.0 est autodéclaré (nous avons écrit le scanner). Audit indépendant en attente jusqu\'à ce que nous ayons des revenus.',
      'Nous avons 0 skill maintainer-verified aujourd\'hui. Le programme est conçu mais pas lancé.',
      'x402 et AP2 sont « en cours d\'implémentation » — pas encore totalement compliant. Voir /standards.',
    ],
    links: [
      { to: '/trust', text: '→ Feuille de route de confiance' },
      { to: '/standards', text: '→ Standards' },
      { to: '/catalog', text: '→ Transparence du catalogue' },
      { to: '/', text: '→ Retour à l\'accueil' },
    ],
  },
};

export default function Compare() {
  const { lang } = useLang();
  const c = CONTENT[lang] || CONTENT.en;

  return (
    <div className="min-h-screen pt-20 pb-20 px-4 md:px-8">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00F299]/10 border border-[#00F299]/20 mb-4">
            <span className="text-[#00F299] text-[10px] font-mono tracking-wider">{c.badge}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">{c.title}</h1>
          <p className="text-zinc-400 text-lg max-w-2xl">{c.subtitle}</p>
        </motion.div>

        {/* The big picture */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="premium-card p-6 mb-8">
          <h2 className="text-white text-sm font-mono tracking-wider mb-4 uppercase">{c.summaryTitle}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {c.summary.map((p, i) => (
              <div
                key={p.key}
                className={
                  p.key === 'MARKETNOW'
                    ? 'p-4 rounded-xl bg-[#00F299]/5 border border-[#00F299]/20'
                    : 'p-4 rounded-xl bg-black/40 border border-white/5'
                }
              >
                <div
                  className={
                    p.key === 'MARKETNOW'
                      ? 'text-[#00F299] text-xs font-mono mb-2'
                      : 'text-zinc-400 text-xs font-mono mb-2'
                  }
                >
                  {p.key}
                </div>
                <div className="text-white text-sm font-bold mb-1">{p.tagline}</div>
                <div className="text-zinc-400 text-xs">{p.desc}</div>
              </div>
            ))}
          </div>
          <p className="text-zinc-500 text-xs mt-4">
            <strong className="text-zinc-300">{c.insightPre}</strong>
            {c.insightBody}
          </p>
        </motion.div>

        {/* Feature comparison table */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="premium-card p-6 mb-8 overflow-x-auto">
          <h2 className="text-white text-sm font-mono tracking-wider mb-4 uppercase">{c.tableTitle}</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-2 text-zinc-400 font-mono">{c.tableHeaders.feature}</th>
                <th className="text-left py-3 px-2 text-[#00F299] font-mono">{c.tableHeaders.marketnow}</th>
                <th className="text-left py-3 px-2 text-zinc-400 font-mono">{c.tableHeaders.smithery}</th>
                <th className="text-left py-3 px-2 text-zinc-400 font-mono">{c.tableHeaders.glama}</th>
                <th className="text-left py-3 px-2 text-zinc-400 font-mono">{c.tableHeaders.mcpRegistry}</th>
              </tr>
            </thead>
            <tbody>
              {c.rows.map((row, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="py-3 px-2 text-zinc-300 font-bold">{row.feature}</td>
                  <td className="py-3 px-2 text-[#00F299]">{row.marketnow}</td>
                  <td className="py-3 px-2 text-zinc-400">{row.smithery}</td>
                  <td className="py-3 px-2 text-zinc-400">{row.glama}</td>
                  <td className="py-3 px-2 text-zinc-400">{row.mcpRegistry}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {/* When to use what */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="premium-card p-6 mb-8">
          <h2 className="text-white text-sm font-mono tracking-wider mb-4 uppercase">{c.whenTitle}</h2>
          <div className="space-y-3">
            {c.whenUse.map((u, i) => (
              <div key={i} className="p-3 rounded-lg bg-black/40">
                <div
                  className={
                    u.highlight
                      ? 'text-[#00F299] text-xs font-mono mb-1'
                      : 'text-zinc-400 text-xs font-mono mb-1'
                  }
                >
                  {u.key}
                </div>
                <div className="text-zinc-300 text-sm">{u.desc}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Honest disclosure */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="premium-card p-6">
          <h2 className="text-white text-sm font-mono tracking-wider mb-3 uppercase">{c.disclosureTitle}</h2>
          <ul className="space-y-2 text-sm text-zinc-400">
            {c.disclosure.map((item, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[#00F299]">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            {c.links.map((lnk, idx) => (
              <Link
                key={idx}
                to={lnk.to}
                className={idx === 0 ? 'text-[#00F299] hover:underline' : 'text-zinc-400 hover:underline'}
              >
                {lnk.text}
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
