import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT — all onboarding text in 5 languages
// ═══════════════════════════════════════════════════════════════════════════
const CONTENT = {
  en: {
    badge: 'SELLER ONBOARDING',
    title: 'How to publish your first MCP skill',
    subtitle:
      '5 steps to get your MCP server listed on MarketNow. From GitHub repo to earning money.',
    runLabel: 'RUN:',
    securityChecksLabel: '6 SECURITY CHECKS:',
    fieldsLabel: 'FIELDS TO FILL:',
    payoutExampleLabel: 'PAYOUT EXAMPLE (all skills free):',
    tipLabel: 'TIP:',
    readyTitle: 'Ready to publish?',
    readyBody:
      "Start with a free skill — it's the fastest way to get listed and build reputation. Once you have a track record, add paid skills.",
    submitBtn: 'SUBMIT YOUR SKILL →',
    seePricingBtn: 'See pricing',
    buyersGuideBtn: "Buyer's guide",
    steps: [
      {
        n: 1,
        title: 'Prepare your MCP server',
        what: 'Make sure your MCP server is in a public GitHub repo with a clear README.',
        checklist: [
          'GitHub repo is public',
          'README.md with install instructions',
          'License file (MIT recommended)',
          'package.json with name, version, description',
          'At least one release tag (v1.0.0+)',
        ],
      },
      {
        n: 2,
        title: 'Run Sentinel v3.0 on your server',
        what: 'Before submitting, run our open source security scanner. Fix any issues found.',
        command:
          'curl -X POST https://marketnow.site/api/audit-skill \\\n  -H "Content-Type: application/json" \\\n  -d \'{"repo_url": "https://github.com/yourname/your-mcp-server"}\'',
        checks: [
          'AUTH — Add authentication if missing',
          'Tool description injection — Remove prompt injection patterns',
          'Input validation — Validate all inputs',
          'CORS — Restrict to known origins',
          'OAuth scopes — Use minimal scopes',
          "Rate limiting — Don't leak rate limit info in errors",
        ],
        tip: 'A Sentinel score of 7+ is good. Below 4, fix the issues before submitting.',
      },
      {
        n: 3,
        title: 'Submit to MarketNow',
        what: 'Use our submission portal. We require the GitHub repo URL — we pull stars, last commit, and maintainer info automatically.',
        link: '/submit',
        linkText: 'Submit your skill',
        fields: [
          'GitHub repo URL (required)',
          'Skill name and description',
          'Category (58 to choose from)',
          'Price: Free (always)',
          'System prompt (for agents to use your skill)',
          'Setup requirements (env vars, API keys needed)',
        ],
        tip: 'Free skills get listed faster. Paid skills require a Stripe Connect account for payouts.',
      },
      {
        n: 4,
        title: 'Wait for review',
        what: 'Sentinel v3.0 runs automatically. Human review takes 24-48h for paid skills, faster for free.',
        statuses: [
          {
            status: 'auto-scanned',
            desc: 'Sentinel ran. Your skill is listed but marked as auto-scanned. This is the default.',
          },
          {
            status: 'human-reviewed',
            desc: 'A human at AliceLabs inspected your repo. Higher trust badge.',
          },
          {
            status: 'maintainer-verified',
            desc: 'You signed a claim of authorship with GPG. Highest trust. Program launching soon.',
          },
        ],
      },
      {
        n: 5,
        title: 'Earn from sales',
        what: 'When someone buys your skill, you keep 80%. We take 20% commission. Payouts monthly via Stripe Connect.',
        math: [
          'Skill price: Free',
          'Your earnings: 100% (free forever)',
          'MarketNow commission: none',
          'Affiliate commission: none (nothing to buy)',
        ],
        link: '/pricing',
        linkText: 'See pricing tiers',
      },
    ],
  },

  es: {
    badge: 'INCORPORACIÓN DE VENDEDORES',
    title: 'Cómo publicar tu primera skill MCP',
    subtitle:
      '5 pasos para listar tu servidor MCP en MarketNow. Desde el repo de GitHub hasta generar ingresos.',
    runLabel: 'EJECUTAR:',
    securityChecksLabel: '6 VERIFICACIONES DE SEGURIDAD:',
    fieldsLabel: 'CAMPOS A COMPLETAR:',
    payoutExampleLabel: 'EJEMPLO (todas las skills gratis):',
    tipLabel: 'CONSEJO:',
    readyTitle: '¿Listo para publicar?',
    readyBody:
      'Empieza con una skill gratuita — es la forma más rápida de ser listado y construir reputación. Una vez que tengas un historial, añade skills de pago.',
    submitBtn: 'ENVÍA TU SKILL →',
    seePricingBtn: 'Ver precios',
    buyersGuideBtn: 'Guía del comprador',
    steps: [
      {
        n: 1,
        title: 'Prepara tu servidor MCP',
        what: 'Asegúrate de que tu servidor MCP esté en un repo público de GitHub con un README claro.',
        checklist: [
          'El repo de GitHub es público',
          'README.md con instrucciones de instalación',
          'Archivo de licencia (se recomienda MIT)',
          'package.json con name, version, description',
          'Al menos un tag de release (v1.0.0+)',
        ],
      },
      {
        n: 2,
        title: 'Ejecuta Sentinel v3.0 en tu servidor',
        what: 'Antes de enviar, ejecuta nuestro escáner de seguridad de código abierto. Corrige cualquier problema detectado.',
        command:
          'curl -X POST https://marketnow.site/api/audit-skill \\\n  -H "Content-Type: application/json" \\\n  -d \'{"repo_url": "https://github.com/yourname/your-mcp-server"}\'',
        checks: [
          'AUTH — Añade autenticación si falta',
          'Inyección en descripción de tools — Elimina patrones de prompt injection',
          'Validación de entradas — Valida todas las entradas',
          'CORS — Restringe a orígenes conocidos',
          'OAuth scopes — Usa scopes mínimos',
          'Rate limiting — No filtres info de rate limit en errores',
        ],
        tip: 'Un puntaje Sentinel de 7+ es bueno. Por debajo de 4, corrige los problemas antes de enviar.',
      },
      {
        n: 3,
        title: 'Envía a MarketNow',
        what: 'Usa nuestro portal de envíos. Requerimos la URL del repo de GitHub — obtenemos stars, último commit e info del maintainer automáticamente.',
        link: '/submit',
        linkText: 'Envía tu skill',
        fields: [
          'URL del repo de GitHub (obligatorio)',
          'Nombre y descripción de la skill',
          'Categoría (58 para elegir)',
          'Precio: Gratis (siempre)',
          'System prompt (para que los agentes usen tu skill)',
          'Requisitos de configuración (env vars, API keys necesarias)',
        ],
        tip: 'Las skills gratuitas se listan más rápido. Las de pago requieren una cuenta Stripe Connect para recibir pagos.',
      },
      {
        n: 4,
        title: 'Espera la revisión',
        what: 'Sentinel v3.0 se ejecuta automáticamente. La revisión humana tarda 24-48h para skills de pago, menos para las gratuitas.',
        statuses: [
          {
            status: 'auto-scanned',
            desc: 'Sentinel se ejecutó. Tu skill está listada pero marcada como auto-scanned. Es el comportamiento por defecto.',
          },
          {
            status: 'human-reviewed',
            desc: 'Una persona en AliceLabs inspeccionó tu repo. Insignia de mayor confianza.',
          },
          {
            status: 'maintainer-verified',
            desc: 'Firmaste una declaración de autoría con GPG. Máxima confianza. El programa arranca pronto.',
          },
        ],
      },
      {
        n: 5,
        title: 'Gana con tus ventas',
        what: 'Cuando alguien compra tu skill, tú te quedas con el 80%. Nosotros cobramos un 20% de comisión. Pagos mensuales vía Stripe Connect.',
        math: [
          'Precio de la skill: Gratis',
          'Tus ganancias: 100% (gratis para siempre)',
          'Comisión MarketNow: ninguna',
          'Comisión de afiliado: ninguna (no hay nada que comprar)',
        ],
        link: '/pricing',
        linkText: 'Ver niveles de precios',
      },
    ],
  },

  pt: {
    badge: 'ONBOARDING DE VENDEDOR',
    title: 'Como publicar sua primeira skill MCP',
    subtitle:
      '5 passos para listar seu servidor MCP no MarketNow. Do repo do GitHub até gerar receita.',
    runLabel: 'EXECUTAR:',
    securityChecksLabel: '6 VERIFICAÇÕES DE SEGURANÇA:',
    fieldsLabel: 'CAMPOS A PREENCHER:',
    payoutExampleLabel: 'EXEMPLO (todas as skills grátis):',
    tipLabel: 'DICA:',
    readyTitle: 'Pronto para publicar?',
    readyBody:
      'Comece com uma skill gratuita — é a forma mais rápida de ser listado e construir reputação. Assim que tiver um histórico, adicione skills pagas.',
    submitBtn: 'ENVIE SUA SKILL →',
    seePricingBtn: 'Ver preços',
    buyersGuideBtn: 'Guia do comprador',
    steps: [
      {
        n: 1,
        title: 'Prepare seu servidor MCP',
        what: 'Certifique-se de que seu servidor MCP está em um repo público do GitHub com um README claro.',
        checklist: [
          'Repo do GitHub é público',
          'README.md com instruções de instalação',
          'Arquivo de licença (MIT recomendado)',
          'package.json com name, version, description',
          'Pelo menos uma tag de release (v1.0.0+)',
        ],
      },
      {
        n: 2,
        title: 'Rode o Sentinel v3.0 no seu servidor',
        what: 'Antes de enviar, rode nosso scanner de segurança open source. Corrija quaisquer problemas encontrados.',
        command:
          'curl -X POST https://marketnow.site/api/audit-skill \\\n  -H "Content-Type: application/json" \\\n  -d \'{"repo_url": "https://github.com/yourname/your-mcp-server"}\'',
        checks: [
          'AUTH — Adicione autenticação se estiver faltando',
          'Injeção na descrição de tools — Remova padrões de prompt injection',
          'Validação de entradas — Valide todas as entradas',
          'CORS — Restrinja a origens conhecidas',
          'OAuth scopes — Use scopes mínimos',
          'Rate limiting — Não vaze info de rate limit em erros',
        ],
        tip: 'Uma pontuação Sentinel de 7+ é boa. Abaixo de 4, corrija os problemas antes de enviar.',
      },
      {
        n: 3,
        title: 'Envie para o MarketNow',
        what: 'Use nosso portal de envio. Exigimos a URL do repo do GitHub — puxamos stars, último commit e informações do maintainer automaticamente.',
        link: '/submit',
        linkText: 'Envie sua skill',
        fields: [
          'URL do repo do GitHub (obrigatório)',
          'Nome e descrição da skill',
          'Categoria (58 para escolher)',
          'Preço: Grátis (sempre)',
          'System prompt (para agentes usarem sua skill)',
          'Requisitos de setup (env vars, API keys necessárias)',
        ],
        tip: 'Skills gratuitas são listadas mais rápido. Skills pagas exigem uma conta Stripe Connect para recebimentos.',
      },
      {
        n: 4,
        title: 'Aguarde a revisão',
        what: 'O Sentinel v3.0 roda automaticamente. A revisão humana leva 24-48h para skills pagas, menos para gratuitas.',
        statuses: [
          {
            status: 'auto-scanned',
            desc: 'Sentinel rodou. Sua skill está listada, mas marcada como auto-scanned. Este é o padrão.',
          },
          {
            status: 'human-reviewed',
            desc: 'Uma pessoa da AliceLabs inspecionou seu repo. Selo de maior confiança.',
          },
          {
            status: 'maintainer-verified',
            desc: 'Você assinou uma declaração de autoria com GPG. Confiança máxima. Programa em breve.',
          },
        ],
      },
      {
        n: 5,
        title: 'Ganhe com as vendas',
        what: 'Quando alguém compra sua skill, você fica com 80%. Nós cobramos 20% de comissão. Pagamentos mensais via Stripe Connect.',
        math: [
          'Preço da skill: Grátis',
          'Seus ganhos: 100% (grátis para sempre)',
          'Comissão MarketNow: nenhuma',
          'Comissão de afiliado: nenhuma (não há nada para comprar)',
        ],
        link: '/pricing',
        linkText: 'Ver faixas de preços',
      },
    ],
  },

  zh: {
    badge: '卖家入驻',
    title: '如何发布你的第一个 MCP skill',
    subtitle: '5 步将你的 MCP server 上架到 MarketNow。从 GitHub 仓库到开始赚钱。',
    runLabel: '运行：',
    securityChecksLabel: '6 项安全检查：',
    fieldsLabel: '需填写字段：',
    payoutExampleLabel: '收益示例（所有技能免费）：',
    tipLabel: '提示：',
    readyTitle: '准备好发布了吗？',
    readyBody:
      '从一个免费的 skill 开始 —— 这是最快上架并积累声誉的方式。等你有了交易记录，再添加付费 skill。',
    submitBtn: '提交你的 SKILL →',
    seePricingBtn: '查看定价',
    buyersGuideBtn: '买家指南',
    steps: [
      {
        n: 1,
        title: '准备好你的 MCP server',
        what: '确保你的 MCP server 位于公开的 GitHub 仓库中，并带有清晰的 README。',
        checklist: [
          'GitHub 仓库为公开',
          'README.md 含安装说明',
          'License 文件（推荐 MIT）',
          'package.json 含 name、version、description',
          '至少一个 release tag（v1.0.0+）',
        ],
      },
      {
        n: 2,
        title: '在你的 server 上运行 Sentinel v3.0',
        what: '提交前，运行我们的开源安全扫描器。修复发现的所有问题。',
        command:
          'curl -X POST https://marketnow.site/api/audit-skill \\\n  -H "Content-Type: application/json" \\\n  -d \'{"repo_url": "https://github.com/yourname/your-mcp-server"}\'',
        checks: [
          'AUTH —— 缺失则添加身份认证',
          '工具描述注入 —— 移除提示注入模式',
          '输入校验 —— 校验所有输入',
          'CORS —— 限制为已知来源',
          'OAuth scopes —— 使用最小权限 scopes',
          '限流 —— 不要在错误信息中泄露限流细节',
        ],
        tip: 'Sentinel 分数 7+ 为良好。低于 4，请先修复问题再提交。',
      },
      {
        n: 3,
        title: '提交到 MarketNow',
        what: '使用我们的提交入口。我们要求提供 GitHub 仓库 URL —— 会自动拉取 stars、最近 commit 及 maintainer 信息。',
        link: '/submit',
        linkText: '提交你的 skill',
        fields: [
          'GitHub 仓库 URL（必填）',
          'Skill 名称与描述',
          '分类（58 个可选）',
          '价格：免费（永远）',
          'System prompt（供 agents 使用你的 skill）',
          '配置要求（所需 env vars、API keys）',
        ],
        tip: '免费 skill 上架更快。付费 skill 需要一个 Stripe Connect 账户用于收款。',
      },
      {
        n: 4,
        title: '等待审核',
        what: 'Sentinel v3.0 自动运行。付费 skill 人工审核约 24-48 小时，免费 skill 更快。',
        statuses: [
          {
            status: 'auto-scanned',
            desc: 'Sentinel 已运行。你的 skill 已上架但被标记为 auto-scanned。这是默认状态。',
          },
          {
            status: 'human-reviewed',
            desc: 'AliceLabs 的人工审核员检查了你的仓库。更高的信任徽章。',
          },
          {
            status: 'maintainer-verified',
            desc: '你已用 GPG 签署作者声明。最高信任等级。该计划即将上线。',
          },
        ],
      },
      {
        n: 5,
        title: '从销售中赚取收益',
        what: '有人购买你的 skill 时，你保留 80%。我们收取 20% 佣金。每月通过 Stripe Connect 付款。',
        math: [
          'Skill 价格：免费',
          '你的收益：100%（永久免费）',
          'MarketNow 佣金：无',
          '联盟佣金：无（没有可购买的东西）',
        ],
        link: '/pricing',
        linkText: '查看定价档位',
      },
    ],
  },

  fr: {
    badge: 'INTÉGRATION VENDEUR',
    title: 'Comment publier votre première skill MCP',
    subtitle:
      '5 étapes pour lister votre serveur MCP sur MarketNow. Du repo GitHub à la monétisation.',
    runLabel: 'EXÉCUTER :',
    securityChecksLabel: '6 VÉRIFICATIONS DE SÉCURITÉ :',
    fieldsLabel: 'CHAMPS À REMPLIR :',
    payoutExampleLabel: 'EXEMPLE (toutes les skills gratuites) :',
    tipLabel: 'CONSEIL :',
    readyTitle: 'Prêt à publier ?',
    readyBody:
      'Commencez par une skill gratuite — c\'est le moyen le plus rapide d\'être listé et de bâtir votre réputation. Une fois un historique établi, ajoutez des skills payantes.',
    submitBtn: 'SOUMETTRE VOTRE SKILL →',
    seePricingBtn: 'Voir les tarifs',
    buyersGuideBtn: 'Guide de l\'acheteur',
    steps: [
      {
        n: 1,
        title: 'Préparez votre serveur MCP',
        what: 'Assurez-vous que votre serveur MCP est dans un repo GitHub public avec un README clair.',
        checklist: [
          'Le repo GitHub est public',
          'README.md avec instructions d\'installation',
          'Fichier de licence (MIT recommandé)',
          'package.json avec name, version, description',
          'Au moins un tag de release (v1.0.0+)',
        ],
      },
      {
        n: 2,
        title: 'Exécutez Sentinel v3.0 sur votre serveur',
        what: 'Avant de soumettre, lancez notre scanner de sécurité open source. Corrigez tout problème détecté.',
        command:
          'curl -X POST https://marketnow.site/api/audit-skill \\\n  -H "Content-Type: application/json" \\\n  -d \'{"repo_url": "https://github.com/yourname/your-mcp-server"}\'',
        checks: [
          'AUTH — Ajoutez l\'authentification si manquante',
          'Injection dans la description des tools — Supprimez les motifs de prompt injection',
          'Validation des entrées — Validez toutes les entrées',
          'CORS — Restreignez aux origines connues',
          'OAuth scopes — Utilisez des scopes minimaux',
          'Rate limiting — Ne fuyez pas d\'info de rate limit dans les erreurs',
        ],
        tip: 'Un score Sentinel de 7+ est bon. En dessous de 4, corrigez les problèmes avant de soumettre.',
      },
      {
        n: 3,
        title: 'Soumettez à MarketNow',
        what: 'Utilisez notre portail de soumission. Nous exigeons l\'URL du repo GitHub — nous récupérons automatiquement stars, dernier commit et infos du maintainer.',
        link: '/submit',
        linkText: 'Soumettez votre skill',
        fields: [
          'URL du repo GitHub (obligatoire)',
          'Nom et description de la skill',
          'Catégorie (58 au choix)',
          'Prix : Gratuit (toujours)',
          'System prompt (pour que les agents utilisent votre skill)',
          'Prérequis de configuration (env vars, API keys nécessaires)',
        ],
        tip: 'Les skills gratuites sont listées plus rapidement. Les skills payantes nécessitent un compte Stripe Connect pour les paiements.',
      },
      {
        n: 4,
        title: 'Attendez la revue',
        what: 'Sentinel v3.0 s\'exécute automatiquement. La revue humaine prend 24-48h pour les skills payantes, moins pour les gratuites.',
        statuses: [
          {
            status: 'auto-scanned',
            desc: 'Sentinel a été exécuté. Votre skill est listée mais marquée comme auto-scanned. C\'est le comportement par défaut.',
          },
          {
            status: 'human-reviewed',
            desc: 'Une personne chez AliceLabs a inspecté votre repo. Badge de confiance supérieur.',
          },
          {
            status: 'maintainer-verified',
            desc: 'Vous avez signé une déclaration d\'auteur avec GPG. Confiance maximale. Programme bientôt lancé.',
          },
        ],
      },
      {
        n: 5,
        title: 'Gagnez avec vos ventes',
        what: 'Quand quelqu\'un achète votre skill, vous gardez 80%. Nous prenons 20% de commission. Paiements mensuels via Stripe Connect.',
        math: [
          'Prix de la skill : Gratuit',
          'Vos gains : 100% (gratuit pour toujours)',
          'Commission MarketNow : aucune',
          'Commission d\'affiliation : aucune (rien à acheter)',
        ],
        link: '/pricing',
        linkText: 'Voir les paliers de prix',
      },
    ],
  },
};

export default function Onboarding() {
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

              {step.checklist && (
                <ul className="space-y-1 mb-4 ml-14">
                  {step.checklist.map((item, j) => (
                    <li key={j} className="text-zinc-300 text-xs flex gap-2">
                      <span className="text-[#00F299]">☐</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}

              {step.command && (
                <div className="ml-14 mb-4 p-3 rounded-lg bg-black/40">
                  <div className="text-zinc-500 text-[10px] mb-1 font-mono">{c.runLabel}</div>
                  <pre className="text-[#00F299] text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                    {step.command}
                  </pre>
                </div>
              )}

              {step.checks && (
                <div className="ml-14 mb-4">
                  <div className="text-zinc-500 text-[10px] mb-2 font-mono">
                    {c.securityChecksLabel}
                  </div>
                  <ul className="space-y-1">
                    {step.checks.map((item, j) => (
                      <li key={j} className="text-zinc-300 text-xs flex gap-2">
                        <span className="text-[#00F299]">🛡️</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {step.fields && (
                <div className="ml-14 mb-4">
                  <div className="text-zinc-500 text-[10px] mb-2 font-mono">{c.fieldsLabel}</div>
                  <ul className="space-y-1">
                    {step.fields.map((f, j) => (
                      <li key={j} className="text-zinc-300 text-xs flex gap-2">
                        <span className="text-[#00d1ff]">→</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {step.statuses && (
                <div className="ml-14 mb-4 space-y-2">
                  {step.statuses.map((s) => (
                    <div key={s.status} className="p-3 rounded-lg bg-black/40">
                      <code className="text-[#00F299] text-xs font-mono">{s.status}</code>
                      <p className="text-zinc-400 text-xs mt-1">{s.desc}</p>
                    </div>
                  ))}
                </div>
              )}

              {step.math && (
                <div className="ml-14 mb-4 p-3 rounded-lg bg-black/40">
                  <div className="text-zinc-500 text-[10px] mb-2 font-mono">
                    {c.payoutExampleLabel}
                  </div>
                  {step.math.map((m, j) => (
                    <div key={j} className="text-zinc-300 text-xs font-mono">
                      {m}
                    </div>
                  ))}
                </div>
              )}

              {step.tip && (
                <div className="ml-14 p-3 rounded-lg bg-[#00d1ff]/5 border border-[#00d1ff]/10">
                  <div className="text-[#00d1ff] text-[10px] mb-1 font-mono">{c.tipLabel}</div>
                  <p className="text-zinc-300 text-xs">{step.tip}</p>
                </div>
              )}

              {step.link && (
                <div className="ml-14 mt-3">
                  <Link to={step.link} className="text-[#00F299] text-xs hover:underline">
                    → {step.linkText}
                  </Link>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 premium-card p-6"
        >
          <h3 className="text-white text-sm font-mono tracking-wider mb-3 uppercase">
            {c.readyTitle}
          </h3>
          <p className="text-zinc-400 text-sm mb-4">{c.readyBody}</p>
          <div className="flex gap-3 flex-wrap">
            <Link
              to="/submit"
              className="px-5 py-2.5 bg-[#00F299] text-black font-bold rounded-lg hover:bg-[#00F299]/90 text-sm"
            >
              {c.submitBtn}
            </Link>
            <Link
              to="/pricing"
              className="px-5 py-2.5 border border-white/10 text-white font-medium rounded-lg hover:bg-white/5 text-sm"
            >
              {c.seePricingBtn}
            </Link>
            <Link
              to="/buyers-guide"
              className="px-5 py-2.5 border border-white/10 text-white font-medium rounded-lg hover:bg-white/5 text-sm"
            >
              {c.buyersGuideBtn}
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
