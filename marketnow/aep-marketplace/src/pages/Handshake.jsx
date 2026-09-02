import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLang } from '../context/LanguageContext.jsx';

/**
 * MarketNow — Agent Quickstart
 *
 * Esta página está pensada para agentes y desarrolladores que quieren
 * consumir el marketplace programáticamente. Muestra los endpoints,
 * ejemplos en curl/Python/JavaScript, y el schema de respuesta.
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT — all visible UI strings in 5 languages
// ═══════════════════════════════════════════════════════════════════════════
const CONTENT = {
  en: {
    title: 'AGENT',
    titleAccent: 'QUICKSTART',
    subtitle: 'Everything an autonomous agent needs to discover, evaluate, and install skills from MarketNow. All endpoints are public, JSON-formatted, and CORS-enabled. No API key required for reads.',
    endpointsTitle: 'PUBLIC ENDPOINTS',
    endpoints: [
      { method: 'GET', path: '/api/skills.json', desc: 'List all 9,248 skills with prices, categories, install commands', size: '~7 MB' },
      { method: 'GET', path: '/api/categories.json', desc: 'List all 16 categories with skill counts', size: '~2 KB' },
      { method: 'GET', path: '/api/manifest.json', desc: 'API metadata, total skill count, version', size: '~1 KB' },
      { method: 'GET', path: '/api/agent.json', desc: 'Machine-readable agent instructions, schema, workflow', size: '~3 KB' },
    ],
    clickToCopy: '📋 Click to copy curl',
    copied: '✓ COPIED',
    examplesTitle: 'CODE EXAMPLES',
    exampleTitles: {
      curl: 'Shell (curl + jq)',
      python: 'Python (requests)',
      node: 'JavaScript (fetch)',
    },
    copy: '📋 COPY',
    workflowTitle: 'AGENT WORKFLOW',
    stepPrefix: 'STEP',
    workflowSteps: [
      { step: '1', title: 'Discover', desc: 'GET /api/skills.json' },
      { step: '2', title: 'Filter', desc: 'By category, price, tags' },
      { step: '3', title: 'Evaluate', desc: 'Read description + score' },
      { step: '4', title: 'Purchase', desc: 'Buyers install free' },
      { step: '5', title: 'Install', desc: 'npx -y marketnow-install-stack <slug>' },
    ],
    mcpServerTitle: 'MarketNow MCP Server',
    mcpSubtitle: 'MarketNow itself is now an installable MCP server.',
    mcpDesc: 'Install MarketNow as an MCP server in Claude Desktop, Cursor, or Cline. Your agent can then search the marketplace, get skill details, and retrieve install commands — all from inside the conversation.',
    installLabel: 'Install (one command)',
    claudeConfigLabel: 'Claude Desktop config (claude_desktop_config.json)',
    npmLink: '📦 npm package →',
    sourceLink: '📄 Source code →',
    pricingTitle: 'PRICING FOR AGENTS',
    pricingDescPre: 'All skills are free. No payments, no seller subscriptions. ',
    pricingDescAccent: 'Free',
    pricingDescPost: '.',
    pricingTiers: [
      { price: 'Free', label: 'Buyers', desc: 'All skills install free. No payment needed.' },
      { price: 'Free', label: 'Standard', desc: 'One API or service' },
      { price: 'Free', label: 'Multi-feature', desc: 'Common choice' },
      { price: 'Free', label: 'Sophisticated', desc: 'Multi-endpoint tools' },
      { price: 'Free', label: 'Enterprise', desc: 'Specialized / complex' },
    ],
  },
  es: {
    title: 'INICIO RÁPIDO',
    titleAccent: 'PARA AGENTES',
    subtitle: 'Todo lo que un agente autónomo necesita para descubrir, evaluar e instalar skills de MarketNow. Todos los endpoints son públicos, en formato JSON y con CORS habilitado. No se requiere API key para lecturas.',
    endpointsTitle: 'ENDPOINTS PÚBLICOS',
    endpoints: [
      { method: 'GET', path: '/api/skills.json', desc: 'Lista las 9,248 skills con precios, categorías y comandos de instalación', size: '~7 MB' },
      { method: 'GET', path: '/api/categories.json', desc: 'Lista las 25 categorías con conteo de skills', size: '~2 KB' },
      { method: 'GET', path: '/api/manifest.json', desc: 'Metadatos de la API, conteo total de skills, versión', size: '~1 KB' },
      { method: 'GET', path: '/api/agent.json', desc: 'Instrucciones para agentes legibles por máquina, schema, workflow', size: '~3 KB' },
    ],
    clickToCopy: '📋 Clic para copiar curl',
    copied: '✓ COPIADO',
    examplesTitle: 'EJEMPLOS DE CÓDIGO',
    exampleTitles: {
      curl: 'Shell (curl + jq)',
      python: 'Python (requests)',
      node: 'JavaScript (fetch)',
    },
    copy: '📋 COPIAR',
    workflowTitle: 'WORKFLOW DEL AGENTE',
    stepPrefix: 'PASO',
    workflowSteps: [
      { step: '1', title: 'Descubrir', desc: 'GET /api/skills.json' },
      { step: '2', title: 'Filtrar', desc: 'Por categoría, precio, tags' },
      { step: '3', title: 'Evaluar', desc: 'Leer descripción + score' },
      { step: '4', title: 'Comprar', desc: 'Compradores instalan gratis' },
      { step: '5', title: 'Instalar', desc: 'npx -y marketnow-install-stack <slug>' },
    ],
    mcpServerTitle: 'MarketNow MCP Server',
    mcpSubtitle: 'MarketNow mismo es ahora un MCP server instalable.',
    mcpDesc: 'Instala MarketNow como MCP server en Claude Desktop, Cursor o Cline. Tu agente podrá buscar en el marketplace, obtener detalles de skills y recuperar comandos de instalación — todo desde dentro de la conversación.',
    installLabel: 'Instalar (un comando)',
    claudeConfigLabel: 'Configuración de Claude Desktop (claude_desktop_config.json)',
    npmLink: '📦 Paquete npm →',
    sourceLink: '📄 Código fuente →',
    pricingTitle: 'PRECIOS PARA AGENTES',
    pricingDescPre: 'Cada skill es gratuita. Sin pagos, sin suscripciones, sin créditos. ',
    pricingDescAccent: 'Free',
    pricingDescPost: '.',
    pricingTiers: [
      { price: 'Free', label: 'Compradores', desc: 'Todos los skills se instalan gratis. Sin pago.' },
      { price: 'Free', label: 'Estándar', desc: 'Una API o servicio' },
      { price: 'Free', label: 'Multi-feature', desc: 'Elección común' },
      { price: 'Free', label: 'Sofisticado', desc: 'Tools multi-endpoint' },
      { price: 'Free', label: 'Enterprise', desc: 'Especializado / complejo' },
    ],
  },
  pt: {
    title: 'INÍCIO RÁPIDO',
    titleAccent: 'PARA AGENTES',
    subtitle: 'Tudo o que um agente autônomo precisa para descobrir, avaliar e instalar skills do MarketNow. Todos os endpoints são públicos, em formato JSON e com CORS habilitado. Não precisa de API key para leituras.',
    endpointsTitle: 'ENDPOINTS PÚBLICOS',
    endpoints: [
      { method: 'GET', path: '/api/skills.json', desc: 'Lista as 9.248 skills com preços, categorias e comandos de instalação', size: '~7 MB' },
      { method: 'GET', path: '/api/categories.json', desc: 'Lista as 16 categorias com contagem de skills', size: '~2 KB' },
      { method: 'GET', path: '/api/manifest.json', desc: 'Metadados da API, contagem total de skills, versão', size: '~1 KB' },
      { method: 'GET', path: '/api/agent.json', desc: 'Instruções de agente legíveis por máquina, schema, workflow', size: '~3 KB' },
    ],
    clickToCopy: '📋 Clique para copiar curl',
    copied: '✓ COPIADO',
    examplesTitle: 'EXEMPLOS DE CÓDIGO',
    exampleTitles: {
      curl: 'Shell (curl + jq)',
      python: 'Python (requests)',
      node: 'JavaScript (fetch)',
    },
    copy: '📋 COPIAR',
    workflowTitle: 'WORKFLOW DO AGENTE',
    stepPrefix: 'PASSO',
    workflowSteps: [
      { step: '1', title: 'Descobrir', desc: 'GET /api/skills.json' },
      { step: '2', title: 'Filtrar', desc: 'Por categoria, preço, tags' },
      { step: '3', title: 'Avaliar', desc: 'Ler descrição + score' },
      { step: '4', title: 'Comprar', desc: 'Compradores instalam grátis' },
      { step: '5', title: 'Instalar', desc: 'npx -y marketnow-install-stack <slug>' },
    ],
    mcpServerTitle: 'MarketNow MCP Server',
    mcpSubtitle: 'O próprio MarketNow agora é um MCP server instalável.',
    mcpDesc: 'Instale o MarketNow como MCP server no Claude Desktop, Cursor ou Cline. Seu agente poderá pesquisar o marketplace, obter detalhes das skills e recuperar comandos de instalação — tudo de dentro da conversa.',
    installLabel: 'Instalar (um comando)',
    claudeConfigLabel: 'Config do Claude Desktop (claude_desktop_config.json)',
    npmLink: '📦 Pacote npm →',
    sourceLink: '📄 Código-fonte →',
    pricingTitle: 'PREÇOS PARA AGENTES',
    pricingDescPre: 'Cada skill é gratuita. Sem pagamentos, sem assinaturas, sem créditos. ',
    pricingDescAccent: 'Free',
    pricingDescPost: '.',
    pricingTiers: [
      { price: 'Free', label: 'Compradores', desc: 'Todas as skills são gratuitas. Sem pagamento.' },
      { price: 'Free', label: 'Padrão', desc: 'Uma API ou serviço' },
      { price: 'Free', label: 'Multi-feature', desc: 'Escolha comum' },
      { price: 'Free', label: 'Sofisticado', desc: 'Tools multi-endpoint' },
      { price: 'Free', label: 'Enterprise', desc: 'Especializado / complexo' },
    ],
  },
  zh: {
    title: 'Agent',
    titleAccent: '快速开始',
    subtitle: '自主 agent 从 MarketNow 发现、评估和安装 skills 所需的一切。所有 endpoints 都是公开的、JSON 格式且启用 CORS。读取无需 API key。',
    endpointsTitle: '公开 ENDPOINTS',
    endpoints: [
      { method: 'GET', path: '/api/skills.json', desc: '列出全部 9,248 个 skills，含价格、分类和安装命令', size: '~7 MB' },
      { method: 'GET', path: '/api/categories.json', desc: '列出全部 16 个分类及其 skill 数量', size: '~2 KB' },
      { method: 'GET', path: '/api/manifest.json', desc: 'API 元数据、skill 总数、版本', size: '~1 KB' },
      { method: 'GET', path: '/api/agent.json', desc: '机器可读的 agent 指令、schema、workflow', size: '~3 KB' },
    ],
    clickToCopy: '📋 点击复制 curl',
    copied: '✓ 已复制',
    examplesTitle: '代码示例',
    exampleTitles: {
      curl: 'Shell (curl + jq)',
      python: 'Python (requests)',
      node: 'JavaScript (fetch)',
    },
    copy: '📋 复制',
    workflowTitle: 'AGENT WORKFLOW',
    stepPrefix: '步骤',
    workflowSteps: [
      { step: '1', title: '发现', desc: 'GET /api/skills.json' },
      { step: '2', title: '筛选', desc: '按分类、价格、tags' },
      { step: '3', title: '评估', desc: '阅读描述 + score' },
      { step: '4', title: '购买', desc: '全部免费' },
      { step: '5', title: '安装', desc: 'npx -y marketnow-install-stack <slug>' },
    ],
    mcpServerTitle: 'MarketNow MCP Server',
    mcpSubtitle: 'MarketNow 本身现在也是一个可安装的 MCP server。',
    mcpDesc: '在 Claude Desktop、Cursor 或 Cline 中将 MarketNow 安装为 MCP server。你的 agent 随后可以在对话内搜索 marketplace、获取 skill 详情并检索安装命令。',
    installLabel: '安装（一条命令）',
    claudeConfigLabel: 'Claude Desktop 配置 (claude_desktop_config.json)',
    npmLink: '📦 npm 包 →',
    sourceLink: '📄 源代码 →',
    pricingTitle: 'AGENT 定价',
    pricingDescPre: '每个 skill 都有透明的一次性价格。无订阅、无积分、无周期性账单。平均价格：',
    pricingDescAccent: 'Free',
    pricingDescPost: '。',
    pricingTiers: [
      { price: 'Free', label: '实用型', desc: '单功能 MCP servers' },
      { price: 'Free', label: '标准型', desc: '一个 API 或服务' },
      { price: 'Free', label: '多功能', desc: '常见选择' },
      { price: 'Free', label: '高级型', desc: '多 endpoint 工具' },
      { price: 'Free', label: '企业型', desc: '专用 / 复杂' },
    ],
  },
  fr: {
    title: 'DÉMARRAGE RAPIDE',
    titleAccent: 'AGENT',
    subtitle: 'Tout ce dont un agent autonome a besoin pour découvrir, évaluer et installer des skills de MarketNow. Tous les endpoints sont publics, au format JSON et compatibles CORS. Aucune clé API requise pour les lectures.',
    endpointsTitle: 'ENDPOINTS PUBLICS',
    endpoints: [
      { method: 'GET', path: '/api/skills.json', desc: 'Liste les 5 054 skills avec prix, catégories et commandes d\'installation', size: '~7 MB' },
      { method: 'GET', path: '/api/categories.json', desc: 'Liste les 16 catégories avec leur nombre de skills', size: '~2 KB' },
      { method: 'GET', path: '/api/manifest.json', desc: 'Métadonnées API, nombre total de skills, version', size: '~1 KB' },
      { method: 'GET', path: '/api/agent.json', desc: 'Instructions agent lisibles par machine, schema, workflow', size: '~3 KB' },
    ],
    clickToCopy: '📋 Cliquez pour copier curl',
    copied: '✓ COPIÉ',
    examplesTitle: 'EXEMPLES DE CODE',
    exampleTitles: {
      curl: 'Shell (curl + jq)',
      python: 'Python (requests)',
      node: 'JavaScript (fetch)',
    },
    copy: '📋 COPIER',
    workflowTitle: 'WORKFLOW DE L\'AGENT',
    stepPrefix: 'ÉTAPE',
    workflowSteps: [
      { step: '1', title: 'Découvrir', desc: 'GET /api/skills.json' },
      { step: '2', title: 'Filtrer', desc: 'Par catégorie, prix, tags' },
      { step: '3', title: 'Évaluer', desc: 'Lire description + score' },
      { step: '4', title: 'Acheter', desc: 'Tout est gratuit' },
      { step: '5', title: 'Installer', desc: 'npx -y marketnow-install-stack <slug>' },
    ],
    mcpServerTitle: 'MarketNow MCP Server',
    mcpSubtitle: 'MarketNow lui-même est désormais un MCP server installable.',
    mcpDesc: 'Installez MarketNow comme MCP server dans Claude Desktop, Cursor ou Cline. Votre agent pourra ensuite rechercher dans le marketplace, obtenir les détails des skills et récupérer les commandes d\'installation — le tout depuis la conversation.',
    installLabel: 'Installer (une commande)',
    claudeConfigLabel: 'Configuration Claude Desktop (claude_desktop_config.json)',
    npmLink: '📦 Paquet npm →',
    sourceLink: '📄 Code source →',
    pricingTitle: 'TARIFICATION POUR AGENTS',
    pricingDescPre: 'Chaque skill a un prix transparent, à paiement unique. Pas d\'abonnements, pas de crédits, pas de facturation récurrente. Prix moyen : ',
    pricingDescAccent: 'Free',
    pricingDescPost: '.',
    pricingTiers: [
      { price: 'Free', label: 'Utilitaire', desc: 'MCP servers à fonction unique' },
      { price: 'Free', label: 'Standard', desc: 'Une API ou un service' },
      { price: 'Free', label: 'Multi-feature', desc: 'Choix courant' },
      { price: 'Free', label: 'Sophistiqué', desc: 'Outils multi-endpoint' },
      { price: 'Free', label: 'Enterprise', desc: 'Spécialisé / complexe' },
    ],
  },
};

// MCP tool names — literal code identifiers, kept in English
const MCP_TOOLS = ['search_skills', 'get_skill', 'list_categories', 'get_manifest', 'get_install_command'];

export default function Handshake() {
  const { lang } = useLang();
  const c = CONTENT[lang] || CONTENT.en;
  const [copied, setCopied] = useState('');

  const copy = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const examples = [
    {
      label: 'curl',
      title: c.exampleTitles.curl,
      code: `# List all skills
curl https://marketnow.site/api/skills.json | jq '.[0:3]'

# Find skills under $1
curl https://marketnow.site/api/skills.json | \\
  jq '[.[] | select(.price < 1)] | .[0:5]'

# Find MCP servers in a specific category
curl https://marketnow.site/api/skills.json | \\
  jq '[.[] | select(.category == "AI/ML")]'

# Get API manifest
curl https://marketnow.site/api/manifest.json`,
    },
    {
      label: 'python',
      title: c.exampleTitles.python,
      code: [
        'import requests',
        '',
        '# Fetch all skills',
        "r = requests.get('https://marketnow.site/api/skills.json')",
        'skills = r.json()',
        "print(f'Total skills: {len(skills)}')",
        '',
        '# Find cheap AI/ML skills',
        'cheap_ai = [s for s in skills',
        "            if s['category'] == 'AI/ML' and s['price'] < 2]",
        'for s in cheap_ai[:5]:',
        "    print(f\"  ${s['price']:.2f}  {s['name']}\")",
        '',
        '# Install a skill',
        'import subprocess',
        'subprocess.run(',
        "    ['npx', '-y', 'marketnow-install-stack', skills[0]['slug']],",
        '    check=True',
        ')',
      ].join('\n'),
    },
    {
      label: 'node',
      title: c.exampleTitles.node,
      code: [
        '// Fetch all skills',
        "const res = await fetch('https://marketnow.site/api/skills.json');",
        'const skills = await res.json();',
        'console.log(`Total skills: ${skills.length}`);',
        '',
        '// Find skills by tag',
        "const mcpSkills = skills.filter(s => s.tags?.includes('mcp'));",
        'console.log(`MCP-tagged: ${mcpSkills.length}`);',
        '',
        '// Find cheapest skills',
        'const cheapest = [...skills]',
        '  .sort((a, b) => a.price - b.price)',
        '  .slice(0, 10);',
        'cheapest.forEach(s => {',
        '  console.log(`  $${s.price.toFixed(2)}  ${s.name}`);',
        '});',
      ].join('\n'),
    },
  ];

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-[1440px] mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold text-white mb-4">
            {c.title} <span className="text-[#00F299]">{c.titleAccent}</span>
          </h1>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            {c.subtitle}
          </p>
        </motion.div>

        {/* Endpoints */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <h2 className="text-xl font-bold text-white mb-4">{c.endpointsTitle}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {c.endpoints.map((ep) => (
              <button
                key={ep.path}
                onClick={() => copy(`curl https://marketnow.site${ep.path}`, `endpoint-${ep.path}`)}
                className="text-left p-4 rounded-xl bg-white/5 border border-white/5 hover:border-[#00F299]/30 hover:bg-[#00F299]/5 transition-all group"
              >
                <div className="flex items-center gap-3 mb-1">
                  <span className="px-2 py-0.5 rounded bg-[#00F299]/10 text-[#00F299] text-[10px] font-mono font-bold">
                    {ep.method}
                  </span>
                  <code className="text-white text-sm font-mono">{ep.path}</code>
                  <span className="ml-auto text-[10px] text-zinc-500 font-mono">{ep.size}</span>
                </div>
                <p className="text-zinc-500 text-xs">{ep.desc}</p>
                <p className="text-[10px] text-[#00F299] mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {copied === `endpoint-${ep.path}` ? c.copied : c.clickToCopy}
                </p>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Code examples */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-12"
        >
          <h2 className="text-xl font-bold text-white mb-4">{c.examplesTitle}</h2>
          <div className="space-y-4">
            {examples.map((ex) => (
              <div key={ex.label} className="premium-card p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-semibold text-sm">{ex.title}</h3>
                  <button
                    onClick={() => copy(ex.code, `example-${ex.label}`)}
                    className="px-3 py-1 rounded-lg bg-white/5 hover:bg-[#00F299]/10 text-xs font-mono text-zinc-400 hover:text-[#00F299] transition-all border border-white/5 hover:border-[#00F299]/30"
                  >
                    {copied === `example-${ex.label}` ? c.copied : c.copy}
                  </button>
                </div>
                <pre className="bg-black/60 border border-white/5 rounded-xl p-4 overflow-x-auto">
                  <code className="text-[#00F299] text-xs font-mono whitespace-pre">{ex.code}</code>
                </pre>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Workflow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          <h2 className="text-xl font-bold text-white mb-4">{c.workflowTitle}</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {c.workflowSteps.map((s) => (
              <div key={s.step} className="premium-card p-4">
                <div className="text-[#00F299] font-mono text-xs mb-2">{c.stepPrefix} {s.step}</div>
                <div className="text-white font-semibold mb-1 text-sm">{s.title}</div>
                <div className="text-zinc-400 text-xs font-mono">{s.desc}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* MCP Server — the meta feature */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="premium-card p-8 mb-12 border-[#00F299]/30"
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🔌</span>
            <div>
              <h2 className="text-xl font-bold text-white">{c.mcpServerTitle}</h2>
              <p className="text-zinc-400 text-sm">{c.mcpSubtitle}</p>
            </div>
          </div>

          <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
            {c.mcpDesc}
          </p>

          <div className="p-4 rounded-xl bg-black/60 border border-white/5 mb-4">
            <div className="text-[10px] text-zinc-500 font-mono mb-2 uppercase tracking-wider">
              {c.installLabel}
            </div>
            <code className="text-[#00F299] text-sm font-mono break-all">
              npx -y marketnow-mcp
            </code>
          </div>

          <div className="p-4 rounded-xl bg-black/60 border border-white/5 mb-4">
            <div className="text-[10px] text-zinc-500 font-mono mb-2 uppercase tracking-wider">
              {c.claudeConfigLabel}
            </div>
            <pre className="text-[#00F299] text-xs font-mono overflow-x-auto"><code>{`{
  "mcpServers": {
    "marketnow": {
      "command": "npx",
      "args": ["-y", "marketnow-mcp"]
    }
  }
}`}</code></pre>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="https://www.npmjs.com/package/marketnow-mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-[#00F299]/10 border border-[#00F299]/30 rounded-lg text-[#00F299] text-xs font-mono hover:bg-[#00F299]/20 transition-all"
            >
              {c.npmLink}
            </a>
            <a
              href="https://github.com/edgarfloresguerra2011-a11y/marketnow/tree/master/mcp-server"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 border border-white/10 rounded-lg text-zinc-400 text-xs font-mono hover:bg-white/5 transition-all"
            >
              {c.sourceLink}
            </a>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-2">
            {MCP_TOOLS.map(tool => (
              <div key={tool} className="p-2 rounded-lg bg-white/5 text-center">
                <code className="text-[#00F299] text-[10px] font-mono">{tool}</code>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Pricing */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="premium-card p-8"
        >
          <h2 className="text-xl font-bold text-white mb-4">{c.pricingTitle}</h2>
          <p className="text-zinc-400 text-sm mb-6">
            {c.pricingDescPre}<span className="text-[#00F299] font-mono">{c.pricingDescAccent}</span>{c.pricingDescPost}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {c.pricingTiers.map((tier) => (
              <div key={tier.price} className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                <div className="text-2xl font-bold text-[#00F299] font-mono mb-1">{tier.price}</div>
                <div className="text-white text-xs font-semibold mb-1">{tier.label}</div>
                <div className="text-zinc-500 text-[10px]">{tier.desc}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
