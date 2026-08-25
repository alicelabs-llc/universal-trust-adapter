import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT — Sentinel roadmap text in 5 languages
// ═══════════════════════════════════════════════════════════════════════════
const CONTENT = {
  en: {
    badge: 'SENTINEL ROADMAP — v3.0 TO NEXT-GEN',
    title: 'From v3.0 to Next-Gen Security',
    subtitle:
      'The path from static analysis (today) to sandboxed dynamic execution, supply chain auditing, adversarial red teaming, and cryptographic code signing.',
    checksLabel: 'CHECKS',
    limitationLabel: 'LIMITATION:',
    problemLabel: 'PROBLEM:',
    solutionLabel: 'SOLUTION:',
    technologiesLabel: 'TECHNOLOGIES:',
    timelineLabel: 'Timeline:',
    platformImprovements: 'Platform Improvements',
    applyAtLabel: 'Apply at:',
    honestTitle: 'Honest disclosure',
    honestBody:
      'All L2+ features are in design/planning/research phase. None are implemented today. We will not claim they are done until they are.',
    honestFooter:
      'Every status change will be a git commit visible in our public repo. See the machine-readable version at',
    trustLink: '→ Trust roadmap',
    standardsLink: '→ Standards',
    securityLink: '→ Sentinel v3.0',
    buyersGuideLink: "→ Buyer's guide",
    statusLabels: {
      live: 'LIVE',
      design_phase: 'DESIGN PHASE',
      planning: 'PLANNING',
      research: 'RESEARCH',
      implemented: 'IMPLEMENTED',
    },
    riskLabels: {
      green: 'GREEN',
      yellow: 'YELLOW',
      red: 'RED',
    },
    levels: [
      {
        level: 'v3.0',
        name: 'Static Analysis (SAST) — CURRENT',
        status: 'live',
        color: '#00F299',
        checks: [
          'AUTH',
          'Tool description injection (8 patterns)',
          'Input validation',
          'CORS',
          'OAuth scopes',
          'Rate limiting error leakage',
        ],
        limitation:
          'Static analysis can be evaded via code obfuscation, dynamic module loading, or malicious third-party dependencies.',
      },
      {
        level: 'L2',
        name: 'Dynamic Analysis in Sandbox (DAST)',
        status: 'design_phase',
        color: '#00d1ff',
        problem:
          'Static analysis can be evaded via code obfuscation, dynamic module loading, or malicious third-party dependencies.',
        solution:
          'Execute each MCP server in an ephemeral sandbox (gVisor, Firecracker, or WebAssembly). Monitor syscalls to detect suspicious behavior.',
        technologies: ['gVisor', 'Firecracker', 'WebAssembly', 'eBPF'],
        timeline: 'Q4 2026 - Q1 2027',
      },
      {
        level: 'v3.0',
        name: 'Continuous Supply Chain Audit',
        status: 'planning',
        color: '#fbbf24',
        problem:
          'A server secure today can become vulnerable tomorrow if a dependency suffers a supply chain attack.',
        solution:
          'Automated periodic re-scanning of dependency trees against vulnerability databases. Compromised skills auto-quarantine.',
        technologies: ['Snyk API', 'OSV.dev', 'Socket.dev', 'npm audit', 'pip-audit'],
        timeline: 'Q1 2027',
      },
      {
        level: 'L3',
        name: 'Automated Red Teaming vs Prompt Injection',
        status: 'research',
        color: '#a78bfa',
        problem: 'Detecting Tool Description Injection is extremely difficult with static rules.',
        solution:
          'Adversarial evaluation sub-module with specialized LLMs that systematically attack tool descriptions using jailbreaking techniques.',
        technologies: [
          'Open source LLMs',
          'Prompt injection benchmarks',
          'Adversarial testing frameworks',
        ],
        timeline: 'Q2 2027',
      },
      {
        level: 'L3.5',
        name: 'Cryptographic Code Signing',
        status: 'design_phase',
        color: '#a78bfa',
        problem: 'Source code in external GitHub repos could be modified after Sentinel analysis.',
        solution:
          'Sentinel generates a signed hash after analysis. MCP clients verify the signature before execution.',
        technologies: ['ECDSA signatures', 'Sigstore', 'GitHub artifact attestations'],
        timeline: 'Q2 2027',
      },
    ],
    features: [
      {
        name: 'Risk Level Classification (Green/Yellow/Red)',
        status: 'implemented',
        description: 'Skills categorized by system resource access. Allows granular security policies.',
        levels: {
          green: 'Pure prompts, no install, no network',
          yellow: 'Network access, external APIs, env vars — no arbitrary code exec',
          red: 'Subprocess execution (npx/npm/bash/curl runs arbitrary code)',
        },
      },
      {
        name: 'Community Feedback Loop',
        status: 'implemented',
        description:
          'Anonymous endpoint for reporting unexpected behavior, failures, or suspected malicious activity.',
        endpoint: 'POST /api/report-skill',
      },
      {
        name: 'Advanced Search Filters',
        status: 'implemented',
        description: 'Filter by license, audit status, risk level, architecture.',
        available_at: '/registry',
      },
      {
        name: 'Maintainer-Verified Program',
        status: 'planning',
        description:
          'Simplified verification via PGP commit signatures or verified GitHub accounts + lightweight KYC.',
        timeline: 'Q4 2026',
        apply_at: 'info@alicelabs.site',
      },
    ],
  },

  es: {
    badge: 'ROADMAP DE SENTINEL — v3.0 A NEXT-GEN',
    title: 'De v3.0 a seguridad de próxima generación',
    subtitle:
      'El camino desde el análisis estático (hoy) hacia la ejecución dinámica en sandbox, auditoría de cadena de suministro, red teaming adversarial y firma criptográfica de código.',
    checksLabel: 'VERIFICACIONES',
    limitationLabel: 'LIMITACIÓN:',
    problemLabel: 'PROBLEMA:',
    solutionLabel: 'SOLUCIÓN:',
    technologiesLabel: 'TECNOLOGÍAS:',
    timelineLabel: 'Cronograma:',
    platformImprovements: 'Mejoras de plataforma',
    applyAtLabel: 'Aplica en:',
    honestTitle: 'Divulgación honesta',
    honestBody:
      'Todas las funciones L2+ están en fase de diseño/planificación/investigación. Ninguna está implementada hoy. No diremos que están listas hasta que lo estén.',
    honestFooter:
      'Cada cambio de estado será un git commit visible en nuestro repo público. Consulta la versión legible por máquinas en',
    trustLink: '→ Roadmap de confianza',
    standardsLink: '→ Estándares',
    securityLink: '→ Sentinel v3.0',
    buyersGuideLink: '→ Guía del comprador',
    statusLabels: {
      live: 'EN VIVO',
      design_phase: 'FASE DE DISEÑO',
      planning: 'PLANIFICANDO',
      research: 'INVESTIGACIÓN',
      implemented: 'IMPLEMENTADO',
    },
    riskLabels: {
      green: 'VERDE',
      yellow: 'AMARILLO',
      red: 'ROJO',
    },
    levels: [
      {
        level: 'v3.0',
        name: 'Análisis Estático (SAST) — ACTUAL',
        status: 'live',
        color: '#00F299',
        checks: [
          'AUTH',
          'Inyección en descripción de tools (8 patrones)',
          'Validación de entradas',
          'CORS',
          'OAuth scopes',
          'Fuga de info de rate limiting en errores',
        ],
        limitation:
          'El análisis estático puede evadirse mediante ofuscación de código, carga dinámica de módulos o dependencias de terceros maliciosas.',
      },
      {
        level: 'L2',
        name: 'Análisis Dinámico en Sandbox (DAST)',
        status: 'design_phase',
        color: '#00d1ff',
        problem:
          'El análisis estático puede evadirse mediante ofuscación de código, carga dinámica de módulos o dependencias de terceros maliciosas.',
        solution:
          'Ejecutar cada servidor MCP en un sandbox efímero (gVisor, Firecracker o WebAssembly). Monitorear syscalls para detectar comportamiento sospechoso.',
        technologies: ['gVisor', 'Firecracker', 'WebAssembly', 'eBPF'],
        timeline: 'Q4 2026 - Q1 2027',
      },
      {
        level: 'v3.0',
        name: 'Auditoría continua de cadena de suministro',
        status: 'planning',
        color: '#fbbf24',
        problem:
          'Un servidor seguro hoy puede volverse vulnerable mañana si una dependencia sufre un ataque a la cadena de suministro.',
        solution:
          'Re-escaneo periódico automatizado de árboles de dependencias contra bases de datos de vulnerabilidades. Las skills comprometidas se ponen en cuarentena automática.',
        technologies: ['Snyk API', 'OSV.dev', 'Socket.dev', 'npm audit', 'pip-audit'],
        timeline: 'Q1 2027',
      },
      {
        level: 'L3',
        name: 'Red Teaming automatizado vs Prompt Injection',
        status: 'research',
        color: '#a78bfa',
        problem:
          'Detectar inyección en la descripción de tools es extremadamente difícil con reglas estáticas.',
        solution:
          'Submódulo de evaluación adversarial con LLMs especializados que atacan sistemáticamente las descripciones de tools usando técnicas de jailbreaking.',
        technologies: [
          'LLMs de código abierto',
          'Benchmarks de prompt injection',
          'Frameworks de pruebas adversariales',
        ],
        timeline: 'Q2 2027',
      },
      {
        level: 'L3.5',
        name: 'Firma criptográfica de código',
        status: 'design_phase',
        color: '#a78bfa',
        problem:
          'El código fuente en repos externos de GitHub podría modificarse tras el análisis de Sentinel.',
        solution:
          'Sentinel genera un hash firmado tras el análisis. Los clientes MCP verifican la firma antes de la ejecución.',
        technologies: ['Firmas ECDSA', 'Sigstore', 'Atestaciones de artefactos de GitHub'],
        timeline: 'Q2 2027',
      },
    ],
    features: [
      {
        name: 'Clasificación de nivel de riesgo (Verde/Amarillo/Rojo)',
        status: 'implemented',
        description:
          'Skills categorizadas por acceso a recursos del sistema. Permite políticas de seguridad granulares.',
        levels: {
          green: 'Solo prompts, sin instalación, sin red',
          yellow: 'Acceso a red, APIs externas, env vars — sin ejecución arbitraria de código',
          red: 'Ejecución de subprocesos (npx/npm/bash/curl ejecuta código arbitrario)',
        },
      },
      {
        name: 'Bucle de retroalimentación comunitaria',
        status: 'implemented',
        description:
          'Endpoint anónimo para reportar comportamiento inesperado, fallos o actividad maliciosa sospechada.',
        endpoint: 'POST /api/report-skill',
      },
      {
        name: 'Filtros de búsqueda avanzados',
        status: 'implemented',
        description: 'Filtrar por licencia, estado de auditoría, nivel de riesgo, arquitectura.',
        available_at: '/registry',
      },
      {
        name: 'Programa Maintainer-Verified',
        status: 'planning',
        description:
          'Verificación simplificada vía firmas de commit PGP o cuentas verificadas de GitHub + KYC ligero.',
        timeline: 'Q4 2026',
        apply_at: 'info@alicelabs.site',
      },
    ],
  },

  pt: {
    badge: 'ROADMAP DO SENTINEL — v3.0 A NEXT-GEN',
    title: 'Do v3.0 à segurança de próxima geração',
    subtitle:
      'O caminho da análise estática (hoje) à execução dinâmica em sandbox, auditoria de cadeia de suprimentos, red teaming adversarial e assinatura criptográfica de código.',
    checksLabel: 'VERIFICAÇÕES',
    limitationLabel: 'LIMITAÇÃO:',
    problemLabel: 'PROBLEMA:',
    solutionLabel: 'SOLUÇÃO:',
    technologiesLabel: 'TECNOLOGIAS:',
    timelineLabel: 'Cronograma:',
    platformImprovements: 'Melhorias da plataforma',
    applyAtLabel: 'Candidate-se em:',
    honestTitle: 'Divulgação honesta',
    honestBody:
      'Todos os recursos L2+ estão em fase de design/planejamento/pesquisa. Nenhum está implementado hoje. Não afirmaremos que estão prontos até que estejam.',
    honestFooter:
      'Cada mudança de status será um git commit visível no nosso repo público. Veja a versão legível por máquina em',
    trustLink: '→ Roadmap de confiança',
    standardsLink: '→ Padrões',
    securityLink: '→ Sentinel v3.0',
    buyersGuideLink: '→ Guia do comprador',
    statusLabels: {
      live: 'EM PRODUÇÃO',
      design_phase: 'FASE DE DESIGN',
      planning: 'PLANEJAMENTO',
      research: 'PESQUISA',
      implemented: 'IMPLEMENTADO',
    },
    riskLabels: {
      green: 'VERDE',
      yellow: 'AMARELO',
      red: 'VERMELHO',
    },
    levels: [
      {
        level: 'v3.0',
        name: 'Análise Estática (SAST) — ATUAL',
        status: 'live',
        color: '#00F299',
        checks: [
          'AUTH',
          'Injeção na descrição de tools (8 padrões)',
          'Validação de entradas',
          'CORS',
          'OAuth scopes',
          'Vazamento de info de rate limiting em erros',
        ],
        limitation:
          'A análise estática pode ser evadida via ofuscação de código, carregamento dinâmico de módulos ou dependências de terceiros maliciosas.',
      },
      {
        level: 'L2',
        name: 'Análise Dinâmica em Sandbox (DAST)',
        status: 'design_phase',
        color: '#00d1ff',
        problem:
          'A análise estática pode ser evadida via ofuscação de código, carregamento dinâmico de módulos ou dependências de terceiros maliciosas.',
        solution:
          'Executar cada servidor MCP em um sandbox efêmero (gVisor, Firecracker ou WebAssembly). Monitorar syscalls para detectar comportamento suspeito.',
        technologies: ['gVisor', 'Firecracker', 'WebAssembly', 'eBPF'],
        timeline: 'Q4 2026 - Q1 2027',
      },
      {
        level: 'v3.0',
        name: 'Auditoria contínua de cadeia de suprimentos',
        status: 'planning',
        color: '#fbbf24',
        problem:
          'Um servidor seguro hoje pode se tornar vulnerável amanhã se uma dependência sofrer um ataque de cadeia de suprimentos.',
        solution:
          'Re-escaneamento periódico automatizado de árvores de dependências contra bancos de dados de vulnerabilidades. Skills comprometidas vão para quarentena automática.',
        technologies: ['Snyk API', 'OSV.dev', 'Socket.dev', 'npm audit', 'pip-audit'],
        timeline: 'Q1 2027',
      },
      {
        level: 'L3',
        name: 'Red Teaming automatizado vs Prompt Injection',
        status: 'research',
        color: '#a78bfa',
        problem:
          'Detectar injeção na descrição de tools é extremamente difícil com regras estáticas.',
        solution:
          'Submódulo de avaliação adversarial com LLMs especializados que atacam sistematicamente as descrições de tools usando técnicas de jailbreaking.',
        technologies: [
          'LLMs de código aberto',
          'Benchmarks de prompt injection',
          'Frameworks de testes adversariais',
        ],
        timeline: 'Q2 2027',
      },
      {
        level: 'L3.5',
        name: 'Assinatura criptográfica de código',
        status: 'design_phase',
        color: '#a78bfa',
        problem:
          'Código-fonte em repos externos do GitHub pode ser modificado após a análise do Sentinel.',
        solution:
          'Sentinel gera um hash assinado após a análise. Clientes MCP verificam a assinatura antes da execução.',
        technologies: ['Assinaturas ECDSA', 'Sigstore', 'Attestations de artefatos do GitHub'],
        timeline: 'Q2 2027',
      },
    ],
    features: [
      {
        name: 'Classificação de nível de risco (Verde/Amarelo/Vermelho)',
        status: 'implemented',
        description:
          'Skills categorizadas por acesso a recursos do sistema. Permite políticas de segurança granulares.',
        levels: {
          green: 'Apenas prompts, sem instalação, sem rede',
          yellow: 'Acesso à rede, APIs externas, env vars — sem execução arbitrária de código',
          red: 'Execução de subprocessos (npx/npm/bash/curl executa código arbitrário)',
        },
      },
      {
        name: 'Loop de feedback da comunidade',
        status: 'implemented',
        description:
          'Endpoint anônimo para reportar comportamento inesperado, falhas ou atividade maliciosa suspeita.',
        endpoint: 'POST /api/report-skill',
      },
      {
        name: 'Filtros de busca avançados',
        status: 'implemented',
        description: 'Filtrar por licença, status de auditoria, nível de risco, arquitetura.',
        available_at: '/registry',
      },
      {
        name: 'Programa Maintainer-Verified',
        status: 'planning',
        description:
          'Verificação simplificada via assinaturas de commit PGP ou contas verificadas do GitHub + KYC leve.',
        timeline: 'Q4 2026',
        apply_at: 'info@alicelabs.site',
      },
    ],
  },

  zh: {
    badge: 'SENTINEL 路线图 —— 从 v3.0 到下一代',
    title: '从 v3.0 到下一代安全',
    subtitle:
      '从静态分析（今日）到沙箱化动态执行、供应链审计、对抗式红队演练与代码加密签名的演进路径。',
    checksLabel: '检查项',
    limitationLabel: '局限：',
    problemLabel: '问题：',
    solutionLabel: '解决方案：',
    technologiesLabel: '技术栈：',
    timelineLabel: '时间线：',
    platformImprovements: '平台改进',
    applyAtLabel: '申请地址：',
    honestTitle: '诚实披露',
    honestBody:
      '所有 L2+ 功能均处于设计/规划/研究阶段。今日尚未实现任何一项。在真正完成之前，我们不会宣称它们已就绪。',
    honestFooter:
      '每次状态变更都会是公开仓库中可见的一次 git commit。机器可读版本见',
    trustLink: '→ 信任路线图',
    standardsLink: '→ 标准',
    securityLink: '→ Sentinel v3.0',
    buyersGuideLink: '→ 买家指南',
    statusLabels: {
      live: '已上线',
      design_phase: '设计阶段',
      planning: '规划中',
      research: '研究中',
      implemented: '已实现',
    },
    riskLabels: {
      green: '绿色',
      yellow: '黄色',
      red: '红色',
    },
    levels: [
      {
        level: 'v3.0',
        name: '静态分析（SAST）—— 当前',
        status: 'live',
        color: '#00F299',
        checks: [
          'AUTH',
          '工具描述注入（8 种模式）',
          '输入校验',
          'CORS',
          'OAuth scopes',
          '限流错误信息泄露',
        ],
        limitation:
          '静态分析可通过代码混淆、动态模块加载或恶意第三方依赖被绕过。',
      },
      {
        level: 'L2',
        name: '沙箱内动态分析（DAST）',
        status: 'design_phase',
        color: '#00d1ff',
        problem: '静态分析可通过代码混淆、动态模块加载或恶意第三方依赖被绕过。',
        solution:
          '在临时沙箱（gVisor、Firecracker 或 WebAssembly）中执行每个 MCP server。监控系统调用以检测可疑行为。',
        technologies: ['gVisor', 'Firecracker', 'WebAssembly', 'eBPF'],
        timeline: 'Q4 2026 - Q1 2027',
      },
      {
        level: 'v3.0',
        name: '持续供应链审计',
        status: 'planning',
        color: '#fbbf24',
        problem: '今日安全的服务器，明日若某项依赖遭遇供应链攻击就可能变得脆弱。',
        solution:
          '对照漏洞数据库自动周期性重新扫描依赖树。被入侵的 skill 自动隔离。',
        technologies: ['Snyk API', 'OSV.dev', 'Socket.dev', 'npm audit', 'pip-audit'],
        timeline: 'Q1 2027',
      },
      {
        level: 'L3',
        name: '针对 Prompt Injection 的自动化红队演练',
        status: 'research',
        color: '#a78bfa',
        problem: '仅靠静态规则检测工具描述注入极其困难。',
        solution:
          '对抗式评估子模块，由专门的 LLM 使用越狱技术系统性攻击工具描述。',
        technologies: ['开源 LLM', 'Prompt injection 基准测试', '对抗式测试框架'],
        timeline: 'Q2 2027',
      },
      {
        level: 'L3.5',
        name: '代码加密签名',
        status: 'design_phase',
        color: '#a78bfa',
        problem: '外部 GitHub 仓库中的源码可能在 Sentinel 分析之后被篡改。',
        solution: 'Sentinel 在分析后生成一个已签名哈希。MCP 客户端在执行前验证签名。',
        technologies: ['ECDSA 签名', 'Sigstore', 'GitHub 制品证明'],
        timeline: 'Q2 2027',
      },
    ],
    features: [
      {
        name: '风险等级分类（绿/黄/红）',
        status: 'implemented',
        description: '按系统资源访问权限对 skill 分类。允许细粒度安全策略。',
        levels: {
          green: '仅 prompt，无需安装，无网络',
          yellow: '有网络访问、外部 API、env vars —— 无任意代码执行',
          red: '子进程执行（npx/npm/bash/curl 会执行任意代码）',
        },
      },
      {
        name: '社区反馈闭环',
        status: 'implemented',
        description: '匿名端点，用于上报异常行为、故障或疑似恶意活动。',
        endpoint: 'POST /api/report-skill',
      },
      {
        name: '高级搜索过滤器',
        status: 'implemented',
        description: '按 license、审计状态、风险等级、架构过滤。',
        available_at: '/registry',
      },
      {
        name: 'Maintainer-Verified 计划',
        status: 'planning',
        description: '通过 PGP commit 签名或已验证 GitHub 账户 + 轻量 KYC 简化认证。',
        timeline: 'Q4 2026',
        apply_at: 'info@alicelabs.site',
      },
    ],
  },

  fr: {
    badge: 'ROADMAP SENTINEL — v3.0 À NEXT-GEN',
    title: 'De v3.0 à la sécurité de nouvelle génération',
    subtitle:
      'Le chemin de l\'analyse statique (aujourd\'hui) vers l\'exécution dynamique en sandbox, l\'audit de chaîne d\'approvisionnement, le red teaming adversarial et la signature cryptographique du code.',
    checksLabel: 'VÉRIFICATIONS',
    limitationLabel: 'LIMITATION :',
    problemLabel: 'PROBLÈME :',
    solutionLabel: 'SOLUTION :',
    technologiesLabel: 'TECHNOLOGIES :',
    timelineLabel: 'Calendrier :',
    platformImprovements: 'Améliorations de la plateforme',
    applyAtLabel: 'Postuler à :',
    honestTitle: 'Divulgation honnête',
    honestBody:
      'Toutes les fonctionnalités L2+ sont en phase de conception/planification/recherche. Aucune n\'est implémentée aujourd\'hui. Nous ne prétendrons pas qu\'elles sont prêtes tant qu\'elles ne le sont pas.',
    honestFooter:
      'Chaque changement de statut sera un git commit visible dans notre repo public. Voir la version lisible par machine à',
    trustLink: '→ Roadmap de confiance',
    standardsLink: '→ Standards',
    securityLink: '→ Sentinel v3.0',
    buyersGuideLink: '→ Guide de l\'acheteur',
    statusLabels: {
      live: 'EN LIGNE',
      design_phase: 'PHASE DE CONCEPTION',
      planning: 'PLANIFICATION',
      research: 'RECHERCHE',
      implemented: 'IMPLÉMENTÉ',
    },
    riskLabels: {
      green: 'VERT',
      yellow: 'JAUNE',
      red: 'ROUGE',
    },
    levels: [
      {
        level: 'v3.0',
        name: 'Analyse statique (SAST) — ACTUEL',
        status: 'live',
        color: '#00F299',
        checks: [
          'AUTH',
          'Injection dans la description des tools (8 motifs)',
          'Validation des entrées',
          'CORS',
          'OAuth scopes',
          'Fuite d\'info de rate limiting dans les erreurs',
        ],
        limitation:
          'L\'analyse statique peut être contournée via obfuscation de code, chargement dynamique de modules ou dépendances tierces malveillantes.',
      },
      {
        level: 'L2',
        name: 'Analyse dynamique en sandbox (DAST)',
        status: 'design_phase',
        color: '#00d1ff',
        problem:
          'L\'analyse statique peut être contournée via obfuscation de code, chargement dynamique de modules ou dépendances tierces malveillantes.',
        solution:
          'Exécuter chaque serveur MCP dans un sandbox éphémère (gVisor, Firecracker ou WebAssembly). Surveiller les syscalls pour détecter un comportement suspect.',
        technologies: ['gVisor', 'Firecracker', 'WebAssembly', 'eBPF'],
        timeline: 'Q4 2026 - Q1 2027',
      },
      {
        level: 'v3.0',
        name: 'Audit continu de chaîne d\'approvisionnement',
        status: 'planning',
        color: '#fbbf24',
        problem:
          'Un serveur sécurisé aujourd\'hui peut devenir vulnérable demain si une dépendance subit une attaque sur la chaîne d\'approvisionnement.',
        solution:
          'Re-scannage périodique automatisé des arbres de dépendances contre les bases de vulnérabilités. Les skills compromises sont mises en quarantaine automatiquement.',
        technologies: ['Snyk API', 'OSV.dev', 'Socket.dev', 'npm audit', 'pip-audit'],
        timeline: 'Q1 2027',
      },
      {
        level: 'L3',
        name: 'Red teaming automatisé vs Prompt Injection',
        status: 'research',
        color: '#a78bfa',
        problem:
          'Détecter l\'injection dans la description des tools est extrêmement difficile avec des règles statiques.',
        solution:
          'Sous-module d\'évaluation adversarial avec des LLM spécialisés qui attaquent systématiquement les descriptions de tools à l\'aide de techniques de jailbreaking.',
        technologies: [
          'LLM open source',
          'Benchmarks d\'injection de prompts',
          'Frameworks de tests adversariaux',
        ],
        timeline: 'Q2 2027',
      },
      {
        level: 'L3.5',
        name: 'Signature cryptographique du code',
        status: 'design_phase',
        color: '#a78bfa',
        problem:
          'Le code source dans des repos GitHub externes pourrait être modifié après l\'analyse Sentinel.',
        solution:
          'Sentinel génère un hash signé après l\'analyse. Les clients MCP vérifient la signature avant l\'exécution.',
        technologies: ['Signatures ECDSA', 'Sigstore', 'Attestations d\'artefacts GitHub'],
        timeline: 'Q2 2027',
      },
    ],
    features: [
      {
        name: 'Classification du niveau de risque (Vert/Jaune/Rouge)',
        status: 'implemented',
        description:
          'Skills catégorisées par accès aux ressources système. Permet des politiques de sécurité granulaires.',
        levels: {
          green: 'Prompts purs, sans installation, sans réseau',
          yellow: 'Accès réseau, APIs externes, env vars — sans exécution de code arbitraire',
          red: 'Exécution de sous-processus (npx/npm/bash/curl exécute du code arbitraire)',
        },
      },
      {
        name: 'Boucle de retours communautaires',
        status: 'implemented',
        description:
          'Endpoint anonyme pour signaler un comportement inattendu, des échecs ou une activité malveillante suspectée.',
        endpoint: 'POST /api/report-skill',
      },
      {
        name: 'Filtres de recherche avancés',
        status: 'implemented',
        description: 'Filtrer par licence, statut d\'audit, niveau de risque, architecture.',
        available_at: '/registry',
      },
      {
        name: 'Programme Maintainer-Verified',
        status: 'planning',
        description:
          'Vérification simplifiée via signatures de commit PGP ou comptes GitHub vérifiés + KYC léger.',
        timeline: 'Q4 2026',
        apply_at: 'info@alicelabs.site',
      },
    ],
  },
};

export default function SentinelRoadmap() {
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
          <p className="text-zinc-400 text-lg">{c.subtitle}</p>
        </motion.div>

        {/* Sentinel levels */}
        <div className="space-y-6 mb-12">
          {c.levels.map((level, i) => (
            <motion.div
              key={level.level}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="premium-card p-6"
            >
              <div className="flex items-start gap-4 mb-4">
                <div
                  className="flex-shrink-0 w-16 h-16 rounded-xl flex items-center justify-center font-bold font-mono text-lg"
                  style={{
                    background: `${level.color}20`,
                    color: level.color,
                    border: `1px solid ${level.color}40`,
                  }}
                >
                  {level.level}
                </div>
                <div className="flex-1">
                  <h2 className="text-white text-lg font-bold mb-1">{level.name}</h2>
                  <span
                    className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                    style={{ background: `${level.color}15`, color: level.color }}
                  >
                    {c.statusLabels[level.status] || level.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {level.checks && (
                <div className="mb-4">
                  <div className="text-zinc-500 text-[10px] mb-2 font-mono">
                    {c.checksLabel} ({level.checks.length}):
                  </div>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-1">
                    {level.checks.map((chk, j) => (
                      <li key={j} className="text-zinc-300 text-xs flex gap-2">
                        <span style={{ color: level.color }}>✓</span>
                        <span>{chk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {level.limitation && (
                <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                  <div className="text-yellow-400 text-[10px] mb-1 font-mono">
                    {c.limitationLabel}
                  </div>
                  <p className="text-zinc-400 text-xs">{level.limitation}</p>
                </div>
              )}

              {level.problem && (
                <div className="mb-3 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                  <div className="text-red-400 text-[10px] mb-1 font-mono">{c.problemLabel}</div>
                  <p className="text-zinc-400 text-xs">{level.problem}</p>
                </div>
              )}

              {level.solution && (
                <div className="mb-3 p-3 rounded-lg bg-[#00F299]/5 border border-[#00F299]/10">
                  <div className="text-[#00F299] text-[10px] mb-1 font-mono">
                    {c.solutionLabel}
                  </div>
                  <p className="text-zinc-300 text-xs">{level.solution}</p>
                </div>
              )}

              {level.technologies && (
                <div className="mb-3">
                  <div className="text-zinc-500 text-[10px] mb-1 font-mono">
                    {c.technologiesLabel}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {level.technologies.map((tech) => (
                      <span
                        key={tech}
                        className="px-2 py-1 rounded bg-black/40 text-zinc-400 text-[10px] font-mono"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {level.timeline && (
                <div className="text-zinc-500 text-xs">
                  <span className="font-mono">{c.timelineLabel}</span> {level.timeline}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Platform improvements */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <h2 className="text-white text-2xl font-bold mb-6">{c.platformImprovements}</h2>
          <div className="space-y-4">
            {c.features.map((f, i) => (
              <div key={i} className="premium-card p-6">
                <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
                  <h3 className="text-white text-sm font-bold">{f.name}</h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      f.status === 'implemented'
                        ? 'bg-[#00F299]/10 text-[#00F299]'
                        : 'bg-yellow-500/10 text-yellow-400'
                    }`}
                  >
                    {c.statusLabels[f.status] || f.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-zinc-400 text-xs mb-2">{f.description}</p>
                {f.levels && (
                  <div className="space-y-1 mt-2">
                    {Object.entries(f.levels).map(([risk, desc]) => (
                      <div key={risk} className="flex gap-2 text-xs">
                        <span
                          className={`px-2 py-0.5 rounded font-mono font-bold ${
                            risk === 'green'
                              ? 'bg-green-500/10 text-green-400'
                              : risk === 'yellow'
                              ? 'bg-yellow-500/10 text-yellow-400'
                              : 'bg-red-500/10 text-red-400'
                          }`}
                        >
                          {c.riskLabels[risk] || risk.toUpperCase()}
                        </span>
                        <span className="text-zinc-400">{desc}</span>
                      </div>
                    ))}
                  </div>
                )}
                {f.endpoint && (
                  <code className="text-[#00F299] text-xs font-mono block mt-2">{f.endpoint}</code>
                )}
                {f.apply_at && (
                  <p className="text-zinc-500 text-xs mt-2">
                    {c.applyAtLabel}{' '}
                    <a href={`mailto:${f.apply_at}`} className="text-[#00F299] hover:underline">
                      {f.apply_at}
                    </a>
                  </p>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="premium-card p-6"
        >
          <h3 className="text-white text-sm font-mono tracking-wider mb-3 uppercase">
            {c.honestTitle}
          </h3>
          <p className="text-zinc-400 text-sm leading-relaxed mb-3">{c.honestBody}</p>
          <p className="text-zinc-500 text-xs">
            {c.honestFooter}{' '}
            <code className="text-[#00F299]">/api/sentinel-roadmap.json</code>.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <Link to="/trust" className="text-[#00F299] hover:underline">
              {c.trustLink}
            </Link>
            <Link to="/standards" className="text-zinc-400 hover:underline">
              {c.standardsLink}
            </Link>
            <Link to="/security" className="text-zinc-400 hover:underline">
              {c.securityLink}
            </Link>
            <Link to="/buyers-guide" className="text-zinc-400 hover:underline">
              {c.buyersGuideLink}
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
