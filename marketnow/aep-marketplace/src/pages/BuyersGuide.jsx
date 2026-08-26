import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT — Buyer's Guide in 5 languages (en, es, pt, zh, fr)
// ═══════════════════════════════════════════════════════════════════════════
const CONTENT = {
  en: {
    badge: "BUYER'S GUIDE",
    title: 'How to choose a secure MCP skill',
    subtitle: '7 steps to evaluate an MCP server before installing it. Written for developers and AI agents who need to make trust decisions.',
    labels: {
      examplePermissions: 'EXAMPLE PERMISSIONS:',
      good: 'GOOD:',
      caution: 'CAUTION:',
      tip: 'TIP:',
    },
    links: {
      createMandate: 'Create a mandate',
      browseFree: 'Browse all skills (free for buyers)',
    },
    steps: [
      {
        n: 1,
        title: 'Check the review_status',
        what: 'Every skill on MarketNow has a review_status field. Look for it on the skill detail page.',
        values: [
          { value: 'auto-scanned', desc: 'Sentinel v3.0 ran automated checks. No human reviewed. Most skills are here (8,517). Safe to install, but treat with appropriate caution.', color: '#fbbf24' },
          { value: 'human-reviewed', desc: 'A human at AliceLabs inspected the GitHub repo, code, and Sentinel report. Higher trust. 43 skills today.', color: '#00F299' },
          { value: 'maintainer-verified', desc: 'The GitHub maintainer signed a claim of authorship (GPG). Highest trust. 0 skills today — program opens Q4 2026, apply at info@alicelabs.site.', color: '#00d1ff' },
        ],
        tip: 'If a skill is auto-scanned only, read the Sentinel report carefully before installing.',
      },
      {
        n: 2,
        title: 'Read the Sentinel v3.0 report',
        what: 'Sentinel runs 6 security checks. The report shows what passed, what failed, and the score (0-10).',
        checks: [
          'AUTH — Does the server require authentication?',
          'Tool description injection — Are there prompt injection patterns?',
          'Input validation — Does it validate inputs?',
          'CORS — Is the CORS policy permissive?',
          'OAuth scopes — Are scopes minimal?',
          'Rate limiting — Does it leak rate limit info in errors?',
        ],
        tip: 'A score of 7+ is good. Below 4, read the failed checks before installing.',
      },
      {
        n: 3,
        title: 'Check declared permissions',
        what: 'Every skill declares what it needs: network, filesystem, env_vars, subprocess.',
        example: {
          network: ['DISCORD_API_KEY'],
          filesystem: [],
          env_vars: ['DISCORD_TOKEN'],
          subprocess: true,
        },
        tip: 'If a skill requests subprocess:true and you don\'t expect it, that\'s a red flag. Permissions are declarative today (not enforced at runtime) — treat them as advisory.',
      },
      {
        n: 4,
        title: 'Check the source',
        what: 'Every skill links to its upstream GitHub repo. Visit it.',
        checks: [
          'Stars (more = more eyeballs)',
          'Last commit (recent = maintained)',
          'Open issues (read them — security issues are a red flag)',
          'Maintainer account age (new accounts = higher risk)',
          'License (MIT, Apache-2.0 = safe; GPL = check compatibility)',
        ],
        tip: 'A skill with 0 stars, last commit 2 years ago, and a maintainer account created last week is high risk — regardless of Sentinel score.',
      },
      {
        n: 5,
        title: 'Check the install command',
        what: 'MarketNow install commands use npx. Verify the package name matches the GitHub repo.',
        good: 'npx -y marketnow-install-stack <slug> (MarketNow wrapper, verified)',
        caution: 'npx -y some-random-package (check the npm registry — is it the same author as GitHub?)',
        tip: 'If the install command points to a different npm package than the GitHub repo suggests, that\'s a supply chain risk.',
      },
      {
        n: 6,
        title: 'Free skills install at no cost. Premium skills have a price set by the seller',
        what: '43 skills are free — no payment, no mandate, no signup. Test MarketNow with these first.',
        tip: 'Free skills are human-reviewed. They\'re the safest place to start.',
        link: '/registry?filter=free',
      },
      {
        n: 7,
        title: 'For paid skills, use a mandate',
        what: 'If you\'re an agent buying paid skills, create a mandate first. Default mode is "notify" — you get an alert on every purchase.',
        tip: 'Start with a low limit ($5-10) and a low per-purchase cap ($1-2). Increase only after you trust the workflow.',
        link: '/mandates',
      },
    ],
    bottomLineTitle: 'The bottom line',
    bottomLineIntro: 'There\'s no such thing as "100% safe" when installing third-party code. But you can reduce risk significantly by:',
    bottomLineItems: [
      'Checking review_status (prefer human-reviewed)',
      'Reading the Sentinel report (score 7+ is good)',
      'Verifying declared permissions (subprocess:true is a yellow flag)',
      'Visiting the GitHub repo (stars, activity, license)',
      'Starting with free skills (they\'re human-reviewed)',
      'Using mandates with low limits for paid skills',
    ],
    bottomLineLinks: [
      { to: '/registry', text: '→ Browse skills' },
      { to: '/trust', text: '→ Trust roadmap' },
      { to: '/security', text: '→ Sentinel methodology' },
      { to: '/compare', text: '→ vs Smithery vs Glama' },
    ],
  },

  es: {
    badge: 'GUÍA DE COMPRA',
    title: 'Cómo elegir un skill MCP seguro',
    subtitle: '7 pasos para evaluar un servidor MCP antes de instalarlo. Escrito para desarrolladores y agentes de IA que necesitan tomar decisiones de confianza.',
    labels: {
      examplePermissions: 'PERMISOS DE EJEMPLO:',
      good: 'BUENO:',
      caution: 'PRECAUCIÓN:',
      tip: 'CONSEJO:',
    },
    links: {
      createMandate: 'Crear un mandate',
      browseFree: 'Explorar skills gratis',
    },
    steps: [
      {
        n: 1,
        title: 'Verifica el review_status',
        what: 'Cada skill en MarketNow tiene un campo review_status. Búscalo en la página de detalle del skill.',
        values: [
          { value: 'auto-scanned', desc: 'Sentinel v3.0 ejecutó verificaciones automáticas. Sin revisión humana. La mayoría de los skills están aquí (8,517). Seguros para instalar, pero trátalos con la precaución adecuada.', color: '#fbbf24' },
          { value: 'human-reviewed', desc: 'Un humano en AliceLabs inspeccionó el repo de GitHub, el código y el reporte de Sentinel. Mayor confianza. 43 skills hoy.', color: '#00F299' },
          { value: 'maintainer-verified', desc: 'El maintainer de GitHub firmó una declaración de autoría (GPG). Máxima confianza. 0 skills hoy — el programa abre en Q4 2026, postula en info@alicelabs.site.', color: '#00d1ff' },
        ],
        tip: 'Si un skill solo está auto-scanned, lee el reporte de Sentinel con cuidado antes de instalarlo.',
      },
      {
        n: 2,
        title: 'Lee el reporte Sentinel v3.0',
        what: 'Sentinel ejecuta 6 verificaciones de seguridad. El reporte muestra qué pasó, qué falló y el puntaje (0-10).',
        checks: [
          'AUTH — ¿El servidor requiere autenticación?',
          'Inyección en descripción de tools — ¿Hay patrones de prompt injection?',
          'Validación de inputs — ¿Valida las entradas?',
          'CORS — ¿La política CORS es permisiva?',
          'OAuth scopes — ¿Los scopes son mínimos?',
          'Rate limiting — ¿Filtra info de rate limit en errores?',
        ],
        tip: 'Un puntaje de 7+ es bueno. Por debajo de 4, lee las verificaciones fallidas antes de instalar.',
      },
      {
        n: 3,
        title: 'Verifica los permisos declarados',
        what: 'Cada skill declara lo que necesita: network, filesystem, env_vars, subprocess.',
        example: {
          network: ['DISCORD_API_KEY'],
          filesystem: [],
          env_vars: ['DISCORD_TOKEN'],
          subprocess: true,
        },
        tip: 'Si un skill solicita subprocess:true y no lo esperas, es una bandera roja. Los permisos hoy son declarativos (no se aplican en runtime) — trátalos como informativos.',
      },
      {
        n: 4,
        title: 'Verifica la fuente',
        what: 'Cada skill enlaza a su repo de GitHub original. Visítalo.',
        checks: [
          'Stars (más = más ojos revisando)',
          'Último commit (reciente = mantenido)',
          'Issues abiertos (léelos — issues de seguridad son bandera roja)',
          'Antigüedad de la cuenta del maintainer (cuentas nuevas = mayor riesgo)',
          'Licencia (MIT, Apache-2.0 = seguro; GPL = verifica compatibilidad)',
        ],
        tip: 'Un skill con 0 stars, último commit hace 2 años y maintainer con cuenta creada la semana pasada es de alto riesgo — sin importar el puntaje de Sentinel.',
      },
      {
        n: 5,
        title: 'Verifica el comando de instalación',
        what: 'Los comandos de instalación de MarketNow usan npx. Verifica que el nombre del paquete coincida con el repo de GitHub.',
        good: 'npx -y marketnow-install-stack <slug> (wrapper de MarketNow, verificado)',
        caution: 'npx -y some-random-package (revisa el registro npm — ¿es el mismo autor que en GitHub?)',
        tip: 'Si el comando de instalación apunta a un paquete npm distinto al que sugiere el repo de GitHub, es un riesgo de cadena de suministro.',
      },
      {
        n: 6,
        title: 'Empieza con skills gratis',
        what: '43 skills son gratis — sin pago, sin mandate, sin registro. Prueba MarketNow con estos primero.',
        tip: 'Los skills gratis son human-reviewed. Son el lugar más seguro para empezar.',
        link: '/registry?filter=free',
      },
      {
        n: 7,
        title: 'Para skills de pago, usa un mandate',
        what: 'Si eres un agente que compra skills de pago, crea un mandate primero. El modo por defecto es "notify" — recibes una alerta en cada compra.',
        tip: 'Empieza con un límite bajo ($5-10) y un tope por compra bajo ($1-2). Auméntalos solo cuando confíes en el flujo.',
        link: '/mandates',
      },
    ],
    bottomLineTitle: 'Conclusión',
    bottomLineIntro: 'No existe el "100% seguro" al instalar código de terceros. Pero puedes reducir el riesgo significativamente:',
    bottomLineItems: [
      'Verificando review_status (prefiere human-reviewed)',
      'Leyendo el reporte de Sentinel (puntaje 7+ es bueno)',
      'Verificando los permisos declarados (subprocess:true es bandera amarilla)',
      'Visitando el repo de GitHub (stars, actividad, licencia)',
      'Empezando con skills gratis (son human-reviewed)',
      'Usando mandates con límites bajos para skills de pago',
    ],
    bottomLineLinks: [
      { to: '/registry', text: '→ Explorar skills' },
      { to: '/trust', text: '→ Hoja de ruta de confianza' },
      { to: '/security', text: '→ Metodología Sentinel' },
      { to: '/compare', text: '→ vs Smithery vs Glama' },
    ],
  },

  pt: {
    badge: 'GUIA DO COMPRADOR',
    title: 'Como escolher um skill MCP seguro',
    subtitle: '7 passos para avaliar um servidor MCP antes de instalá-lo. Escrito para desenvolvedores e agentes de IA que precisam tomar decisões de confiança.',
    labels: {
      examplePermissions: 'PERMISSÕES DE EXEMPLO:',
      good: 'BOM:',
      caution: 'CUIDADO:',
      tip: 'DICA:',
    },
    links: {
      createMandate: 'Criar um mandate',
      browseFree: 'Navegar skills gratuitos',
    },
    steps: [
      {
        n: 1,
        title: 'Verifique o review_status',
        what: 'Cada skill no MarketNow tem um campo review_status. Procure-o na página de detalhes do skill.',
        values: [
          { value: 'auto-scanned', desc: 'Sentinel v3.0 executou verificações automatizadas. Sem revisão humana. A maioria dos skills está aqui (8.517). Seguro para instalar, mas trate com a cautela apropriada.', color: '#fbbf24' },
          { value: 'human-reviewed', desc: 'Um humano na AliceLabs inspecionou o repo do GitHub, o código e o relatório do Sentinel. Maior confiança. 43 skills hoje.', color: '#00F299' },
          { value: 'maintainer-verified', desc: 'O maintainer do GitHub assinou uma declaração de autoria (GPG). Maior confiança. 0 skills hoje — programa abre em Q4 2026, candidate-se em info@alicelabs.site.', color: '#00d1ff' },
        ],
        tip: 'Se um skill é apenas auto-scanned, leia o relatório do Sentinel com atenção antes de instalar.',
      },
      {
        n: 2,
        title: 'Leia o relatório Sentinel v3.0',
        what: 'Sentinel executa 6 verificações de segurança. O relatório mostra o que passou, o que falhou e a pontuação (0-10).',
        checks: [
          'AUTH — O servidor exige autenticação?',
          'Injeção na descrição de tools — Há padrões de prompt injection?',
          'Validação de inputs — Ele valida as entradas?',
          'CORS — A política CORS é permissiva?',
          'OAuth scopes — Os scopes são mínimos?',
          'Rate limiting — Vaza info de rate limit nos erros?',
        ],
        tip: 'Uma pontuação de 7+ é boa. Abaixo de 4, leia as verificações que falharam antes de instalar.',
      },
      {
        n: 3,
        title: 'Verifique as permissões declaradas',
        what: 'Cada skill declara o que precisa: network, filesystem, env_vars, subprocess.',
        example: {
          network: ['DISCORD_API_KEY'],
          filesystem: [],
          env_vars: ['DISCORD_TOKEN'],
          subprocess: true,
        },
        tip: 'Se um skill solicita subprocess:true e você não espera, isso é uma bandeira vermelha. As permissões hoje são declarativas (não aplicadas em runtime) — trate-as como informativas.',
      },
      {
        n: 4,
        title: 'Verifique a fonte',
        what: 'Cada skill linka para o repo upstream no GitHub. Visite-o.',
        checks: [
          'Stars (mais = mais olhos)',
          'Último commit (recente = mantido)',
          'Issues abertas (leia-as — issues de segurança são bandeira vermelha)',
          'Idade da conta do maintainer (contas novas = maior risco)',
          'Licença (MIT, Apache-2.0 = seguro; GPL = verifique compatibilidade)',
        ],
        tip: 'Um skill com 0 stars, último commit há 2 anos e conta do maintainer criada na semana passada é de alto risco — independentemente da pontuação do Sentinel.',
      },
      {
        n: 5,
        title: 'Verifique o comando de instalação',
        what: 'Os comandos de instalação do MarketNow usam npx. Verifique se o nome do pacote corresponde ao repo do GitHub.',
        good: 'npx -y marketnow-install-stack <slug> (wrapper do MarketNow, verificado)',
        caution: 'npx -y some-random-package (verifique o registro npm — é o mesmo autor do GitHub?)',
        tip: 'Se o comando de instalação aponta para um pacote npm diferente do que o repo do GitHub sugere, isso é um risco de cadeia de suprimentos.',
      },
      {
        n: 6,
        title: 'Comece com skills gratuitos',
        what: '43 skills são gratuitos — sem pagamento, sem mandate, sem cadastro. Teste o MarketNow com eles primeiro.',
        tip: 'Skills gratuitos são human-reviewed. São o lugar mais seguro para começar.',
        link: '/registry?filter=free',
      },
      {
        n: 7,
        title: 'Para skills pagos, use um mandate',
        what: 'Se você é um agente comprando skills pagos, crie um mandate primeiro. O modo padrão é "notify" — você recebe um alerta a cada compra.',
        tip: 'Comece com um limite baixo ($5-10) e um teto por compra baixo ($1-2). Aumente apenas depois que confiar no fluxo.',
        link: '/mandates',
      },
    ],
    bottomLineTitle: 'Conclusão',
    bottomLineIntro: 'Não existe "100% seguro" ao instalar código de terceiros. Mas você pode reduzir o risco significativamente:',
    bottomLineItems: [
      'Verificando o review_status (prefira human-reviewed)',
      'Lendo o relatório do Sentinel (pontuação 7+ é boa)',
      'Verificando as permissões declaradas (subprocess:true é bandeira amarela)',
      'Visitando o repo do GitHub (stars, atividade, licença)',
      'Começando com skills gratuitos (eles são human-reviewed)',
      'Usando mandates com limites baixos para skills pagos',
    ],
    bottomLineLinks: [
      { to: '/registry', text: '→ Navegar skills' },
      { to: '/trust', text: '→ Roteiro de confiança' },
      { to: '/security', text: '→ Metodologia Sentinel' },
      { to: '/compare', text: '→ vs Smithery vs Glama' },
    ],
  },

  zh: {
    badge: '购买指南',
    title: '如何选择安全的 MCP skill',
    subtitle: '安装 MCP 服务器之前评估它的 7 个步骤。为需要做出信任决策的开发者和 AI agent 编写。',
    labels: {
      examplePermissions: '示例权限：',
      good: '推荐：',
      caution: '注意：',
      tip: '提示：',
    },
    links: {
      createMandate: '创建一个 mandate',
      browseFree: '浏览免费 skill',
    },
    steps: [
      {
        n: 1,
        title: '查看 review_status',
        what: 'MarketNow 上的每个 skill 都有一个 review_status 字段。请在 skill 详情页中查看它。',
        values: [
          { value: 'auto-scanned', desc: 'Sentinel v3.0 执行了自动化检查。无人工审核。大多数 skill 在此类别（8,517 个）。可以安装，但请保持适当的谨慎。', color: '#fbbf24' },
          { value: 'human-reviewed', desc: 'AliceLabs 的人工审查了 GitHub 仓库、代码和 Sentinel 报告。信任度更高。目前有 43 个。', color: '#00F299' },
          { value: 'maintainer-verified', desc: 'GitHub 维护者签署了作者身份声明（GPG）。最高信任度。目前为 0 个——计划于 2026 年第四季度开放，请发送申请至 info@alicelabs.site。', color: '#00d1ff' },
        ],
        tip: '如果某个 skill 仅为 auto-scanned，请在安装前仔细阅读 Sentinel 报告。',
      },
      {
        n: 2,
        title: '阅读 Sentinel v3.0 报告',
        what: 'Sentinel 运行 6 项安全检查。报告显示通过的内容、失败的内容以及评分（0-10）。',
        checks: [
          'AUTH —— 服务器是否要求身份验证？',
          'Tool 描述注入 —— 是否存在 prompt injection 模式？',
          '输入验证 —— 是否验证输入？',
          'CORS —— CORS 策略是否宽松？',
          'OAuth scopes —— scope 是否最小化？',
          'Rate limiting —— 是否在错误中泄露 rate limit 信息？',
        ],
        tip: '评分 7+ 为良好。低于 4 时，请在安装前阅读失败的检查项。',
      },
      {
        n: 3,
        title: '查看声明的权限',
        what: '每个 skill 都声明其所需的内容：network、filesystem、env_vars、subprocess。',
        example: {
          network: ['DISCORD_API_KEY'],
          filesystem: [],
          env_vars: ['DISCORD_TOKEN'],
          subprocess: true,
        },
        tip: '如果某个 skill 请求 subprocess:true 而你并未预期，这就是一个危险信号。当前权限仅为声明性（运行时未强制执行）——请将其视为参考。',
      },
      {
        n: 4,
        title: '查看源代码',
        what: '每个 skill 都链接到其上游 GitHub 仓库。请访问它。',
        checks: [
          'Stars（越多 = 越多眼睛审查）',
          '最近提交（近期 = 仍在维护）',
          '未解决的 issue（请阅读——安全 issue 是危险信号）',
          '维护者账号年龄（新账号 = 风险更高）',
          '许可证（MIT、Apache-2.0 = 安全；GPL = 检查兼容性）',
        ],
        tip: '一个 0 stars、最近提交在 2 年前、维护者账号上周才创建的 skill 风险很高——无论 Sentinel 评分如何。',
      },
      {
        n: 5,
        title: '查看安装命令',
        what: 'MarketNow 的安装命令使用 npx。请验证包名是否与 GitHub 仓库匹配。',
        good: 'npx -y marketnow-install-stack <slug>（MarketNow 封装，已验证）',
        caution: 'npx -y some-random-package（请检查 npm registry——是否与 GitHub 上的作者是同一人？）',
        tip: '如果安装命令指向与 GitHub 仓库建议不同的 npm 包，这就是供应链风险。',
      },
      {
        n: 6,
        title: '从免费 skill 开始',
        what: '43 个 skill 是免费的——无需付款、无需 mandate、无需注册。请先用这些测试 MarketNow。',
        tip: '免费 skill 已通过人工审核。它们是最安全的起点。',
        link: '/registry?filter=free',
      },
      {
        n: 7,
        title: '对于付费 skill，请使用 mandate',
        what: '如果你是购买付费 skill 的 agent，请先创建一个 mandate。默认模式为 "notify"——每次购买你都会收到提醒。',
        tip: '从较低的限额（$5-10）和较低的单次购买上限（$1-2）开始。只有在你信任该流程后再增加。',
        link: '/mandates',
      },
    ],
    bottomLineTitle: '总结',
    bottomLineIntro: '安装第三方代码时不存在"100% 安全"。但你可以通过以下方式显著降低风险：',
    bottomLineItems: [
      '查看 review_status（优先选择 human-reviewed）',
      '阅读 Sentinel 报告（评分 7+ 为良好）',
      '验证声明的权限（subprocess:true 是黄色警示）',
      '访问 GitHub 仓库（stars、活跃度、许可证）',
      '从免费 skill 开始（它们已通过人工审核）',
      '对付费 skill 使用低限额的 mandate',
    ],
    bottomLineLinks: [
      { to: '/registry', text: '→ 浏览 skill' },
      { to: '/trust', text: '→ 信任路线图' },
      { to: '/security', text: '→ Sentinel 方法论' },
      { to: '/compare', text: '→ vs Smithery vs Glama' },
    ],
  },

  fr: {
    badge: 'GUIDE D\'ACHAT',
    title: 'Comment choisir un skill MCP sécurisé',
    subtitle: '7 étapes pour évaluer un serveur MCP avant de l\'installer. Écrit pour les développeurs et les agents IA qui doivent prendre des décisions de confiance.',
    labels: {
      examplePermissions: 'PERMISSIONS D\'EXEMPLE :',
      good: 'BIEN :',
      caution: 'ATTENTION :',
      tip: 'CONSEIL :',
    },
    links: {
      createMandate: 'Créer un mandate',
      browseFree: 'Parcourir les skills gratuits',
    },
    steps: [
      {
        n: 1,
        title: 'Vérifiez le review_status',
        what: 'Chaque skill sur MarketNow possède un champ review_status. Cherchez-le sur la page de détail du skill.',
        values: [
          { value: 'auto-scanned', desc: 'Sentinel v3.0 a exécuté des vérifications automatisées. Aucune révision humaine. La plupart des skills sont ici (8 517). Sûrs à installer, mais à traiter avec la prudence appropriée.', color: '#fbbf24' },
          { value: 'human-reviewed', desc: 'Un humain chez AliceLabs a inspecté le repo GitHub, le code et le rapport Sentinel. Confiance plus élevée. 43 skills aujourd\'hui.', color: '#00F299' },
          { value: 'maintainer-verified', desc: 'Le maintainer GitHub a signé une déclaration d\'auteur (GPG). Confiance maximale. 0 skill aujourd\'hui — programme ouvert Q4 2026, postulez à info@alicelabs.site.', color: '#00d1ff' },
        ],
        tip: 'Si un skill est uniquement auto-scanned, lisez attentivement le rapport Sentinel avant de l\'installer.',
      },
      {
        n: 2,
        title: 'Lisez le rapport Sentinel v3.0',
        what: 'Sentinel exécute 6 vérifications de sécurité. Le rapport montre ce qui a réussi, ce qui a échoué et le score (0-10).',
        checks: [
          'AUTH — Le serveur exige-t-il une authentification ?',
          'Injection dans la description des tools — Y a-t-il des motifs de prompt injection ?',
          'Validation des inputs — Valide-t-il les entrées ?',
          'CORS — La politique CORS est-elle permissive ?',
          'OAuth scopes — Les scopes sont-ils minimaux ?',
          'Rate limiting — Fuit-il des infos de rate limit dans les erreurs ?',
        ],
        tip: 'Un score de 7+ est bon. En dessous de 4, lisez les vérifications échouées avant d\'installer.',
      },
      {
        n: 3,
        title: 'Vérifiez les permissions déclarées',
        what: 'Chaque skill déclare ce dont il a besoin : network, filesystem, env_vars, subprocess.',
        example: {
          network: ['DISCORD_API_KEY'],
          filesystem: [],
          env_vars: ['DISCORD_TOKEN'],
          subprocess: true,
        },
        tip: 'Si un skill demande subprocess:true et que vous ne vous y attendiez pas, c\'est un signal d\'alarme. Les permissions sont aujourd\'hui déclaratives (non appliquées au runtime) — traitez-les comme informatives.',
      },
      {
        n: 4,
        title: 'Vérifiez la source',
        what: 'Chaque skill renvoie à son repo GitHub amont. Visitez-le.',
        checks: [
          'Stars (plus = plus d\'yeux)',
          'Dernier commit (récent = maintenu)',
          'Issues ouverts (lisez-les — les issues de sécurité sont un signal d\'alarme)',
          'Ancienneté du compte du maintainer (nouveaux comptes = risque plus élevé)',
          'Licence (MIT, Apache-2.0 = sûr ; GPL = vérifiez la compatibilité)',
        ],
        tip: 'Un skill avec 0 star, dernier commit vieux de 2 ans et un maintainer dont le compte a été créé la semaine dernière présente un risque élevé — quel que soit le score Sentinel.',
      },
      {
        n: 5,
        title: 'Vérifiez la commande d\'installation',
        what: 'Les commandes d\'installation de MarketNow utilisent npx. Vérifiez que le nom du paquet correspond au repo GitHub.',
        good: 'npx -y marketnow-install-stack <slug> (wrapper MarketNow, vérifié)',
        caution: 'npx -y some-random-package (vérifiez le registry npm — est-ce le même auteur que sur GitHub ?)',
        tip: 'Si la commande d\'installation pointe vers un paquet npm différent de ce que suggère le repo GitHub, c\'est un risque de chaîne d\'approvisionnement.',
      },
      {
        n: 6,
        title: 'Commencez par les skills gratuits',
        what: '43 skills sont gratuits — sans paiement, sans mandate, sans inscription. Testez MarketNow avec ceux-ci d\'abord.',
        tip: 'Les skills gratuits sont human-reviewed. C\'est l\'endroit le plus sûr pour commencer.',
        link: '/registry?filter=free',
      },
      {
        n: 7,
        title: 'Pour les skills payants, utilisez un mandate',
        what: 'Si vous êtes un agent qui achète des skills payants, créez d\'abord un mandate. Le mode par défaut est « notify » — vous recevez une alerte à chaque achat.',
        tip: 'Commencez avec une limite basse ($5-10) et un plafond par achat bas ($1-2). N\'augmentez qu\'après avoir confiance dans le flux.',
        link: '/mandates',
      },
    ],
    bottomLineTitle: 'En conclusion',
    bottomLineIntro: 'Il n\'y a pas de « 100 % sûr » quand on installe du code tiers. Mais vous pouvez réduire considérablement le risque en :',
    bottomLineItems: [
      'Vérifiant le review_status (préférez human-reviewed)',
      'Lisant le rapport Sentinel (score 7+ est bon)',
      'Vérifiant les permissions déclarées (subprocess:true est un signal jaune)',
      'Visitant le repo GitHub (stars, activité, licence)',
      'Commencant par les skills gratuits (ils sont human-reviewed)',
      'Utilisant des mandates à limite basse pour les skills payants',
    ],
    bottomLineLinks: [
      { to: '/registry', text: '→ Parcourir les skills' },
      { to: '/trust', text: '→ Feuille de route de confiance' },
      { to: '/security', text: '→ Méthodologie Sentinel' },
      { to: '/compare', text: '→ vs Smithery vs Glama' },
    ],
  },
};

export default function BuyersGuide() {
  const { lang } = useLang();
  const c = CONTENT[lang] || CONTENT.en;

  return (
    <div className="min-h-screen pt-20 pb-20 px-4 md:px-8">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00F299]/10 border border-[#00F299]/20 mb-4">
            <span className="text-[#00F299] text-[10px] font-mono tracking-wider">{c.badge}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">{c.title}</h1>
          <p className="text-zinc-400 text-lg">{c.subtitle}</p>
        </motion.div>

        <div className="space-y-6">
          {c.steps.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="premium-card p-6"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#00F299]/20 border border-[#00F299]/40 flex items-center justify-center font-bold text-[#00F299] font-mono">
                  {step.n}
                </div>
                <div className="flex-1">
                  <h2 className="text-white text-lg font-bold mb-1">{step.title}</h2>
                  <p className="text-zinc-400 text-sm">{step.what}</p>
                </div>
              </div>

              {step.values && (
                <div className="space-y-2 mb-4 ml-14">
                  {step.values.map(v => (
                    <div key={v.value} className="p-3 rounded-lg bg-black/40 border-l-2" style={{ borderColor: v.color }}>
                      <code className="text-xs font-mono font-bold" style={{ color: v.color }}>{v.value}</code>
                      <p className="text-zinc-400 text-xs mt-1">{v.desc}</p>
                    </div>
                  ))}
                </div>
              )}

              {step.checks && (
                <ul className="space-y-1 mb-4 ml-14">
                  {step.checks.map((chk, j) => (
                    <li key={j} className="text-zinc-300 text-xs flex gap-2">
                      <span className="text-[#00F299]">✓</span>
                      <span>{chk}</span>
                    </li>
                  ))}
                </ul>
              )}

              {step.example && (
                <div className="ml-14 mb-4 p-3 rounded-lg bg-black/40">
                  <div className="text-zinc-500 text-[10px] mb-1 font-mono">{c.labels.examplePermissions}</div>
                  <pre className="text-[#00F299] text-xs font-mono overflow-x-auto">{JSON.stringify(step.example, null, 2)}</pre>
                </div>
              )}

              {step.good && (
                <div className="ml-14 mb-2 p-3 rounded-lg bg-[#00F299]/5 border border-[#00F299]/10">
                  <div className="text-[#00F299] text-[10px] mb-1 font-mono">{c.labels.good}</div>
                  <code className="text-zinc-300 text-xs">{step.good}</code>
                </div>
              )}

              {step.caution && (
                <div className="ml-14 mb-4 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                  <div className="text-yellow-400 text-[10px] mb-1 font-mono">{c.labels.caution}</div>
                  <code className="text-zinc-300 text-xs">{step.caution}</code>
                </div>
              )}

              {step.tip && (
                <div className="ml-14 p-3 rounded-lg bg-[#00d1ff]/5 border border-[#00d1ff]/10">
                  <div className="text-[#00d1ff] text-[10px] mb-1 font-mono">{c.labels.tip}</div>
                  <p className="text-zinc-300 text-xs">{step.tip}</p>
                </div>
              )}

              {step.link && (
                <div className="ml-14 mt-3">
                  <Link to={step.link} className="text-[#00F299] text-xs hover:underline">
                    → {step.link === '/mandates' ? c.links.createMandate : c.links.browseFree}
                  </Link>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-8 premium-card p-6">
          <h3 className="text-white text-sm font-mono tracking-wider mb-3 uppercase">{c.bottomLineTitle}</h3>
          <p className="text-zinc-400 text-sm leading-relaxed mb-3">{c.bottomLineIntro}</p>
          <ol className="space-y-1 text-sm text-zinc-400 list-decimal list-inside">
            {c.bottomLineItems.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            {c.bottomLineLinks.map((lnk, idx) => (
              <Link key={idx} to={lnk.to} className={idx === 0 ? 'text-[#00F299] hover:underline' : 'text-zinc-400 hover:underline'}>
                {lnk.text}
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
