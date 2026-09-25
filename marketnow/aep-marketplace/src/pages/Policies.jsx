import { motion } from 'framer-motion';
import BackgroundOrbs from '../components/BackgroundOrbs';
import { useLang } from '../context/LanguageContext.jsx';

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT — all policy sections in 5 languages (en, es, pt, zh, fr)
// ═══════════════════════════════════════════════════════════════════════════
const CONTENT = {
  en: {
    sections: [
      {
        title: 'Terms of Service — For Agents and Humans',
        content: `By accessing or using MarketNow, you agree to be bound by these terms. MarketNow is a marketplace for MCP-compatible agent skills, designed for consumption by both autonomous agents (via the public JSON API) and human developers (via the web UI). Installing skills is free for buyers — MarketNow charges buyers no platform fee. Listing is free and unlimited for sellers. Sellers may set a price on premium skills (MarketNow adds a 20% commission), and optional Sentinel subscriptions (PRO $9.99/mo, ENTERPRISE $49.99/mo) provide priority auditing. Vendor-priced usage (x402) is billed by the vendor directly. Agents and users must comply with each skill's upstream open-source license (MIT, Apache-2.0, etc.) when using the installed skill.`,
      },
      {
        title: 'Pricing — Trust Economics',
        content: `MarketNow's pricing model (canonical source: /api/agent.json — pricing_source_of_truth):

• Buyers: no platform fee. 68,387 of 68,388 catalog skills install free; the rare premium skill carries a seller-set price.
• Sellers: free unlimited listing; keep 80% of every premium sale (MarketNow takes 20%).
• Sentinel subscriptions (optional, sellers): PRO $9.99/mo — priority scan <6h; ENTERPRISE $49.99/mo — gVisor sandbox + priority listing + API access.
• Vendor-priced usage (x402, USDC on Base) is billed 100% vendor-side — MarketNow verifies security, not prices.
• Affiliates: 5% of MarketNow's commission share on referred premium sales.

Agents can discover, evaluate and install skills programmatically via the public API at /api/skills.json.`,
      },
      {
        title: 'Refund Policy',
        content: `68,387 of 68,388 skills install free — there is nothing to refund for free installs. For premium skill purchases (seller-priced), refunds follow the seller's published terms; MarketNow facilitates dispute resolution via support@alicelabs.site. Vendor-priced usage (x402, USDC on Base) is billed directly by the vendor and follows the vendor's refund policy. Sentinel subscriptions (PRO/ENTERPRISE) can be canceled at any time — no long-term lock-in.`,
      },
      {
        title: 'Privacy Policy',
        content: `MarketNow collects minimal data required to operate the marketplace: email address (for account login), payment records (processed by Stripe), and the list of skills you have purchased. We do not sell personal data. All data in transit is encrypted with TLS 1.3. We do not store credit card numbers — Stripe handles all payment data on their PCI-compliant infrastructure. Agent API consumption is logged by IP and User-Agent for rate limiting and abuse prevention, but not linked to personal identity unless you sign in.`,
      },
      {
        title: 'Skill Licensing',
        content: `Each skill on MarketNow is sourced from a real, public open-source repository. When you install a skill, you get: (1) the install command (typically \`npx -y marketnow-install-stack\`), (2) its Sentinel report, and (3) access to the skill's documentation. The underlying open-source license (MIT, Apache-2.0, etc.) of each skill still applies to your usage of the code itself. MarketNow's value-add is curation, verification (Sentinel L1), and packaging — not the underlying code, which remains free under its original license.`,
      },
      {
        title: 'Agent API Usage',
        content: `Autonomous agents are welcome to consume the MarketNow API at /api/*. Read endpoints (skills.json, categories.json, manifest.json, agent.json) are public and require no authentication. Rate limits: 60 requests/minute for anonymous, 600/minute for authenticated. For bulk consumption, cache /api/skills.json locally and refresh at most every 24 hours — the catalog changes infrequently. The /api/agent.json endpoint provides machine-readable instructions, schema, and workflow examples specifically designed for agent consumption.`,
      },
      {
        title: 'Acceptable Use',
        content: `You agree not to use MarketNow skills for illegal activities, to violate the rights of others, or to build malicious software. Skills must not be redistributed or resold without explicit permission. MarketNow reserves the right to revoke licenses in cases of abuse, fraud, or violations of these terms. Scraping the website HTML is prohibited — use the public JSON API instead, which is designed for programmatic access.`,
      },
    ],
  },

  es: {
    sections: [
      {
        title: 'Términos de Servicio — Para Agentes y Humanos',
        content: `Al acceder o usar MarketNow, aceptas quedar vinculado por estos términos. MarketNow es un marketplace de skills de agentes compatibles con MCP, diseñado para consumo tanto de agentes autónomos (vía la API JSON pública) como de desarrolladores humanos (vía la UI web). Instalar skills es gratis para los compradores — MarketNow no cobra platform fee a los compradores. Publicar es gratis e ilimitado para los vendedores. Los vendedores pueden fijar precio en skills premium (MarketNow añade una comisión del 20%), y las suscripciones opcionales de Sentinel (PRO $9.99/mes, ENTERPRISE $49.99/mes) ofrecen auditoría prioritaria. El uso con precio de vendor (x402) lo factura el vendor directamente. Los agentes y usuarios deben cumplir con la licencia open-source upstream de cada skill (MIT, Apache-2.0, etc.) al usar la skill instalada.`,
      },
      {
        title: 'Precios — Economía de Confianza',
        content: `Modelo de precios de MarketNow (fuente canónica: /api/agent.json — pricing_source_of_truth):

• Compradores: sin platform fee. 68,387 de 68,388 skills del catálogo se instalan gratis; la skill premium (1) tiene precio fijado por su vendedor.
• Vendedores: publicación gratis e ilimitada; conservan el 80% de cada venta premium (MarketNow retiene el 20%).
• Suscripciones Sentinel (opcionales, vendedores): PRO $9.99/mes — escaneo prioritario <6h; ENTERPRISE $49.99/mes — sandbox gVisor + listing prioritario + acceso API.
• El uso con precio de vendor (x402, USDC en Base) se factura 100% vendor-side — MarketNow verifica seguridad, no precios.
• Afiliados: 5% de la parte de la comisión de MarketNow en ventas premium referidas.

Los agentes pueden descubrir, evaluar e instalar skills programáticamente vía la API pública en /api/skills.json.`,
      },
      {
        title: 'Política de Reembolso',
        content: `68,387 de 68,388 skills se instalan gratis — no hay nada que reembolsar en instalaciones gratuitas. Para compras de skills premium (precio del vendedor), los reembolsos siguen los términos publicados del vendedor; MarketNow facilita la resolución de disputas vía support@alicelabs.site. El uso con precio de vendor (x402, USDC en Base) lo factura directamente el vendor y sigue su política de reembolso. Las suscripciones de Sentinel (PRO/ENTERPRISE) se pueden cancelar en cualquier momento — sin lock-in a largo plazo.`,
      },
      {
        title: 'Política de Privacidad',
        content: `MarketNow recolecta datos mínimos necesarios para operar el marketplace: dirección de email (para login de cuenta), registros de pago (procesados por Stripe), y la lista de skills que has comprado. No vendemos datos personales. Todos los datos en tránsito se cifran con TLS 1.3. No almacenamos números de tarjeta de crédito — Stripe maneja todos los datos de pago en su infraestructura compliance con PCI. El consumo de la API por agentes se loguea por IP y User-Agent para rate limiting y prevención de abuso, pero no se vincula a identidad personal a menos que inicies sesión.`,
      },
      {
        title: 'Licenciamiento de Skills',
        content: `Cada skill en MarketNow proviene de un repositorio open-source real y público. Al instalar una skill, obtienes: (1) el comando de instalación (típicamente \`npx -y marketnow-install-stack\`), (2) su reporte Sentinel, y (3) acceso a la documentación de la skill. La licencia open-source subyacente (MIT, Apache-2.0, etc.) de cada skill sigue aplicando a tu uso del código en sí. El value-add de MarketNow es curaduría, verificación (Sentinel L1) y empaquetado — no el código subyacente, que permanece gratis bajo su licencia original.`,
      },
      {
        title: 'Uso de la API por Agentes',
        content: `Los agentes autónomos son bienvenidos a consumir la API de MarketNow en /api/*. Los endpoints de lectura (skills.json, categories.json, manifest.json, agent.json) son públicos y no requieren autenticación. Rate limits: 60 requests/minuto para anónimos, 600/minuto para autenticados. Para consumo masivo, cachea /api/skills.json localmente y refresca como máximo cada 24 horas — el catálogo cambia con poca frecuencia. El endpoint /api/agent.json provee instrucciones machine-readable, schema y ejemplos de workflow diseñados específicamente para consumo de agentes.`,
      },
      {
        title: 'Uso Aceptable',
        content: `Aceptas no usar las skills de MarketNow para actividades ilegales, para violar los derechos de otros, o para construir software malicioso. Las skills no deben ser redistribuidas ni revendidas sin permiso explícito. MarketNow se reserva el derecho de revocar licenses en casos de abuso, fraude o violaciones de estos términos. Hacer scraping del HTML del website está prohibido — usa la API JSON pública en su lugar, que está diseñada para acceso programático.`,
      },
    ],
  },

  pt: {
    sections: [
      {
        title: 'Termos de Serviço — Para Agentes e Humanos',
        content: `Ao acessar ou usar o MarketNow, você concorda em ser regido por estes termos. O MarketNow é um marketplace de skills de agentes compatíveis com MCP, projetado para consumo tanto por agentes autônomos (via a API JSON pública) quanto por desenvolvedores humanos (via a UI web). Instalar skills é grátis para os compradores — o MarketNow não cobra taxa de plataforma dos compradores. Publicar é grátis e ilimitado para os vendedores. Os vendedores podem definir preço em skills premium (o MarketNow adiciona comissão de 20%), e as assinaturas opcionais de Sentinel (PRO $9.99/mês, ENTERPRISE $49.99/mês) oferecem auditoria prioritária. O uso com preço de vendor (x402) é faturado pelo vendor diretamente. Agentes e usuários devem cumprir a licença open-source upstream de cada skill (MIT, Apache-2.0, etc.) ao usar a skill instalada.`,
      },
      {
        title: 'Preços — Economia de Confiança',
        content: `Modelo de preços do MarketNow (fonte canônica: /api/agent.json — pricing_source_of_truth):

• Compradores: sem taxa de plataforma. 68,387 de 68,388 skills do catálogo instalam grátis; a skill premium (1) tem preço definido pelo vendedor.
• Vendedores: publicação grátis e ilimitada; ficam com 80% de cada venda premium (o MarketNow retém 20%).
• Assinaturas Sentinel (opcionais, vendedores): PRO $9.99/mês — escaneamento prioritário <6h; ENTERPRISE $49.99/mês — sandbox gVisor + listing prioritário + acesso API.
• O uso com preço de vendor (x402, USDC na Base) é faturado 100% vendor-side — o MarketNow verifica segurança, não preços.
• Afiliados: 5% da parte da comissão do MarketNow em vendas premium referenciadas.

Agentes podem descobrir, avaliar e instalar skills programaticamente via API pública em /api/skills.json.`,
      },
      {
        title: 'Política de Reembolso',
        content: `68,387 de 68,388 skills instalam grátis — não há nada a reembolsar em instalações gratuitas. Para compras de skills premium (preço do vendedor), reembolsos seguem os termos publicados do vendedor; o MarketNow facilita a resolução de disputas via support@alicelabs.site. O uso com preço de vendor (x402, USDC na Base) é faturado diretamente pelo vendor e segue a política de reembolso dele. As assinaturas do Sentinel (PRO/ENTERPRISE) podem ser canceladas a qualquer momento — sem lock-in de longo prazo.`,
      },
      {
        title: 'Política de Privacidade',
        content: `O MarketNow coleta dados mínimos necessários para operar o marketplace: endereço de email (para login da conta), registros de pagamento (processados pela Stripe) e a lista de skills que você comprou. Não vendemos dados pessoais. Todos os dados em trânsito são criptografados com TLS 1.3. Não armazenamos números de cartão de crédito — a Stripe cuida de todos os dados de pagamento em sua infraestrutura compliance com PCI. O consumo da API por agentes é logado por IP e User-Agent para rate limiting e prevenção de abuso, mas não é vinculado à identidade pessoal a menos que você faça login.`,
      },
      {
        title: 'Licenciamento de Skills',
        content: `Cada skill no MarketNow é originada de um repositório open-source real e público. Ao instalar uma skill, você obtém: (1) o comando de instalação (tipicamente \`npx -y marketnow-install-stack\`), (2) seu relatório Sentinel, e (3) acesso à documentação da skill. A licença open-source subjacente (MIT, Apache-2.0, etc.) de cada skill ainda se aplica ao seu uso do código em si. O value-add do MarketNow é curadoria, verificação (Sentinel L1) e empacotamento — não o código subjacente, que permanece grátis sob sua licença original.`,
      },
      {
        title: 'Uso da API por Agentes',
        content: `Agentes autônomos são bem-vindos a consumir a API do MarketNow em /api/*. Endpoints de leitura (skills.json, categories.json, manifest.json, agent.json) são públicos e não exigem autenticação. Rate limits: 60 requests/minuto para anônimos, 600/minuto para autenticados. Para consumo em massa, faça cache de /api/skills.json localmente e atualize no máximo a cada 24 horas — o catálogo muda com pouca frequência. O endpoint /api/agent.json fornece instruções machine-readable, schema e exemplos de workflow projetados especificamente para consumo por agentes.`,
      },
      {
        title: 'Uso Aceitável',
        content: `Você concorda em não usar as skills do MarketNow para atividades ilegais, para violar os direitos de outros, ou para construir software malicioso. Skills não devem ser redistribuídas ou revendidas sem permissão explícita. O MarketNow se reserva o direito de revogar licenses em casos de abuso, fraude ou violações destes termos. Scraping do HTML do website é proibido — use a API JSON pública em vez disso, que é projetada para acesso programático.`,
      },
    ],
  },

  zh: {
    sections: [
      {
        title: '服务条款 —— 面向 Agent 与人类用户',
        content: `访问或使用 MarketNow 即表示您同意受这些条款约束。MarketNow 是一个销售 MCP 兼容 agent skill 的市场，既面向自主 agent（通过公开的 JSON API）也面向人类开发者（通过 Web UI）使用。安装技能对买家免费 —— MarketNow 不向买家收取任何平台费。卖家可免费无限量上架。卖家可为高级技能定价（MarketNow 收取 20% 佣金），可选的 Sentinel 订阅（PRO $9.99/月、ENTERPRISE $49.99/月）提供优先审计。供应商定价的使用（x402）由供应商直接结算。Agent 和用户在使用已安装的 skill 时，必须遵守该 skill 上游的开源许可（MIT、Apache-2.0 等）。`,
      },
      {
        title: '定价 —— 信任经济',
        content: `MarketNow 的定价模型（权威来源：/api/agent.json — pricing_source_of_truth）：

• 买家：无平台费。目录中 68,388 个技能里 68,387 个免费安装；唯一的高级技能由卖家定价。
• 卖家：免费无限量上架；每笔高级技能销售保留 80%（MarketNow 收取 20%）。
• Sentinel 订阅（可选，面向卖家）：PRO $9.99/月 —— 优先扫描 <6h；ENTERPRISE $49.99/月 —— gVisor 沙箱 + 优先展示 + API 访问。
• 供应商定价的使用（x402、Base 上的 USDC）100% 由供应商侧结算 —— MarketNow 验证的是安全，不是价格。
• 推广者：从 MarketNow 的佣金份额中获得 5%。

Agent 可通过公开 API /api/skills.json 以编程方式发现、评估并安装技能。`,
      },
      {
        title: '退款政策',
        content: `68,388 个技能中 68,387 个免费安装 —— 免费安装无需退款。高级技能购买（卖家定价）的退款遵循卖家公布的服务条款；MarketNow 通过 support@alicelabs.site 协助争议解决。供应商定价的使用（x402、Base 上的 USDC）由供应商直接结算，并遵循供应商的退款政策。Sentinel 订阅（PRO/ENTERPRISE）可随时取消 —— 没有长期锁定。`,
      },
      {
        title: '隐私政策',
        content: `MarketNow 仅收集运营市场所需的最少数据：电子邮箱（账户登录）、支付记录（高级技能购买与 Sentinel 订阅）以及您的已安装技能列表。我们不出售个人数据。所有传输中的数据均使用 TLS 1.3 加密。我们不存储信用卡号。Agent 的 API 调用会按 IP 和 User-Agent 记录日志，用于限流与防滥用；除非您登录，否则不会与个人身份关联。`,
      },
      {
        title: '技能许可',
        content: `MarketNow 上的每个技能都来自真实、公开的仓库。安装技能后你将获得：(1) 安装命令（通常是 \`npx -y marketnow-install-stack\`），(2) 其 Sentinel 报告，以及 (3) 该技能的文档。每个技能自身的开源许可（MIT、Apache-2.0 等）仍然适用于你对代码的使用。MarketNow 的增值在于策展、验证（Sentinel L1）与打包 —— 底层代码在其原始许可下保持免费。`,
      },
      {
        title: 'Agent API 使用',
        content: `欢迎自主 agent 调用 MarketNow 的 /api/* 接口。读取端点（skills.json、categories.json、manifest.json、agent.json）公开且无需认证。速率限制：匿名 60 次/分钟，认证后 600 次/分钟。批量消费请本地缓存 /api/skills.json 并最多每 24 小时刷新一次 —— 目录变化不频繁。/api/agent.json 提供专为 agent 消费设计的机器可读说明、schema 与工作流示例。`,
      },
      {
        title: '可接受使用',
        content: `您同意不将 MarketNow 技能用于非法活动、侵犯他人权利或构建恶意软件。未经明确许可，技能不得被重新分发或转售。在滥用、欺诈或违反本条款的情况下，MarketNow 保留撤销许可的权利。禁止抓取网站 HTML —— 请使用为程序化访问设计的公开 JSON API。`,
      },
    ],
  },
};

export default function Policies() {
  const { t, lang } = useLang();
  const c = CONTENT[lang] || CONTENT.en;
  return (
    <div className="relative min-h-screen">
      <BackgroundOrbs />
      <div className="relative z-10 max-w-[1440px] mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="text-4xl font-bold text-white mb-2">{t('policies.title')}</h1>
          <p className="text-zinc-400">{t('policies.subtitle')}</p>
        </motion.div>

        <div className="space-y-8">
          {c.sections.map((section, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="premium-card"
            >
              <h2 className="text-2xl font-bold text-white mb-4">{section.title}</h2>
              <p className="text-zinc-400 leading-relaxed whitespace-pre-line">{section.content}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
