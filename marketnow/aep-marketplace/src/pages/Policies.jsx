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
        content: `By accessing or using MarketNow, you agree to be bound by these terms. MarketNow is a marketplace for MCP-compatible agent skills, designed for consumption by both autonomous agents (via the public JSON API) and human developers (via the web UI). Everything on MarketNow is free — buyers install free and sellers list free. MarketNow does not charge anyone. Agents and users must comply with each skill's upstream open-source license (MIT, Apache-2.0, etc.) when using the installed skill.`,
      },
      {
        title: 'Pricing — Micro-Transactions for Autonomous Agents',
        content: `MarketNow uses a micro-transaction pricing model optimized for autonomous agent consumption. Every skill has a single, transparent free for buyers in USD displayed on its detail page and in the /api/skills.json response:

• Free — 1,321 skills (26%) — utility, single-function MCP servers

All 9,248 skills are FREE to install and use. MarketNow does not sell skills and does not charge anyone — no subscriptions, no commissions, no fees.`,
      },
      {
        title: 'Refund Policy',
        content: `All skill purchases are eligible for a full refund within 14 days if less than 100 API calls have been made using the license key. To request a refund, email support@alicelabs.site with your order ID. Refunds are processed back to the original payment method within 5-10 business days. Skills priced at Free are still eligible for refund, but the transaction fee may exceed the refund amount in some cases.`,
      },
      {
        title: 'Privacy Policy',
        content: `MarketNow collects minimal data required to operate the marketplace: email address (for account login), payment records (processed by Stripe), and the list of skills you have purchased. We do not sell personal data. All data in transit is encrypted with TLS 1.3. We do not store credit card numbers — Stripe handles all payment data on their PCI-compliant infrastructure. Agent API consumption is logged by IP and User-Agent for rate limiting and abuse prevention, but not linked to personal identity unless you sign in.`,
      },
      {
        title: 'Skill Licensing',
        content: `Each skill on MarketNow is sourced from a real, public open-source repository. When you purchase a skill, you receive: (1) a MarketNow license key for verification, (2) the install command (typically \`npx -y marketnow-install-stack\`), and (3) access to the skill's documentation. The underlying open-source license (MIT, Apache-2.0, etc.) of each skill still applies to your usage of the code itself. MarketNow's value-add is curation, verification (Sentinel L1), and packaging — not the underlying code, which remains free under its original license.`,
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
        content: `Al acceder o usar MarketNow, aceptas quedar vinculado por estos términos. MarketNow es un marketplace de skills de agentes compatibles con MCP, diseñado para consumo tanto de agentes autónomos (vía la API JSON pública) como de desarrolladores humanos (vía la UI web). Cada skill se vende individualmente con un pago único — no hay suscripciones, no hay créditos y no hay facturación recurrente. Los agentes y usuarios deben cumplir con la licencia open-source upstream de cada skill (MIT, Apache-2.0, etc.) al usar la skill instalada.`,
      },
      {
        title: 'Precios — Microtransacciones para Agentes Autónomos',
        content: `MarketNow usa un modelo de precios de microtransacciones optimizado para consumo de agentes autónomos. Cada skill tiene un único precio único transparente en USD mostrado en su página de detalle y en la respuesta de /api/skills.json:

• Free — 1,321 skills (26%) — utilidad, servidores MCP de función única

Todas las 9,248 skills son gratuitas: no hay precio mínimo ni máximo, no hay pagos. Los agentes pueden descubrir, evaluar e instalar skills programáticamente vía la API pública en /api/skills.json.`,
      },
      {
        title: 'Política de Reembolso',
        content: `Todas las compras de skills son elegibles para reembolso completo dentro de 14 días si se han hecho menos de 100 llamadas a la API usando la license key. Para solicitar un reembolso, escribe a support@alicelabs.site con tu order ID. Los reembolsos se procesan de vuelta al método de pago original dentro de 5-10 días hábiles. Las skills con precio de Free siguen siendo elegibles para reembolso, pero la tarifa de transacción puede exceder el monto del reembolso en algunos casos.`,
      },
      {
        title: 'Política de Privacidad',
        content: `MarketNow recolecta datos mínimos necesarios para operar el marketplace: dirección de email (para login de cuenta), registros de pago (procesados por Stripe), y la lista de skills que has comprado. No vendemos datos personales. Todos los datos en tránsito se cifran con TLS 1.3. No almacenamos números de tarjeta de crédito — Stripe maneja todos los datos de pago en su infraestructura compliance con PCI. El consumo de la API por agentes se loguea por IP y User-Agent para rate limiting y prevención de abuso, pero no se vincula a identidad personal a menos que inicies sesión.`,
      },
      {
        title: 'Licenciamiento de Skills',
        content: `Cada skill en MarketNow proviene de un repositorio open-source real y público. Al comprar una skill, recibes: (1) una license key de MarketNow para verificación, (2) el comando de instalación (típicamente \`npx -y marketnow-install-stack\`), y (3) acceso a la documentación de la skill. La licencia open-source subyacente (MIT, Apache-2.0, etc.) de cada skill sigue aplicando a tu uso del código en sí. El value-add de MarketNow es curaduría, verificación (Sentinel L1) y empaquetado — no el código subyacente, que permanece gratis bajo su licencia original.`,
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
        content: `Ao acessar ou usar o MarketNow, você concorda em ser regido por estes termos. O MarketNow é um marketplace de skills de agentes compatíveis com MCP, projetado para consumo tanto por agentes autônomos (via a API JSON pública) quanto por desenvolvedores humanos (via a UI web). Cada skill é vendida individualmente com um pagamento único — não há assinaturas, não há créditos e não há cobrança recorrente. Agentes e usuários devem cumprir a licença open-source upstream de cada skill (MIT, Apache-2.0, etc.) ao usar a skill instalada.`,
      },
      {
        title: 'Preços — Microtransações para Agentes Autônomos',
        content: `O MarketNow usa um modelo de preços de microtransações otimizado para consumo por agentes autônomos. Cada skill tem um único preço único transparente em USD exibido em sua página de detalhe e na resposta de /api/skills.json:

• Free — 1.321 skills (26%) — utilidade, servidores MCP de função única

As 9,248 skills são gratuitas: não há preço mínimo nem máximo, não há pagamentos. Agentes podem descobrir, avaliar e instalar skills programaticamente via a API pública em /api/skills.json.`,
      },
      {
        title: 'Política de Reembolso',
        content: `Todas as compras de skills são elegíveis para reembolso integral dentro de 14 dias se foram feitas menos de 100 chamadas de API usando a license key. Para solicitar um reembolso, envie um email para support@alicelabs.site com seu order ID. Reembolsos são processados de volta ao método de pagamento original dentro de 5-10 dias úteis. Skills com preço de Free ainda são elegíveis para reembolso, mas a taxa de transação pode exceder o valor do reembolso em alguns casos.`,
      },
      {
        title: 'Política de Privacidade',
        content: `O MarketNow coleta dados mínimos necessários para operar o marketplace: endereço de email (para login da conta), registros de pagamento (processados pela Stripe) e a lista de skills que você comprou. Não vendemos dados pessoais. Todos os dados em trânsito são criptografados com TLS 1.3. Não armazenamos números de cartão de crédito — a Stripe cuida de todos os dados de pagamento em sua infraestrutura compliance com PCI. O consumo da API por agentes é logado por IP e User-Agent para rate limiting e prevenção de abuso, mas não é vinculado à identidade pessoal a menos que você faça login.`,
      },
      {
        title: 'Licenciamento de Skills',
        content: `Cada skill no MarketNow é originada de um repositório open-source real e público. Ao comprar uma skill, você recebe: (1) uma license key do MarketNow para verificação, (2) o comando de instalação (tipicamente \`npx -y marketnow-install-stack\`), e (3) acesso à documentação da skill. A licença open-source subjacente (MIT, Apache-2.0, etc.) de cada skill ainda se aplica ao seu uso do código em si. O value-add do MarketNow é curadoria, verificação (Sentinel L1) e empacotamento — não o código subjacente, que permanece grátis sob sua licença original.`,
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
        content: `访问或使用 MarketNow 即表示您同意受这些条款约束。MarketNow 是一个销售 MCP 兼容 agent skill 的市场，既面向自主 agent（通过公开的 JSON API）也面向人类开发者（通过 Web UI）使用。每一个 skill 均单独以一次性付款销售——不设订阅、不设积分、不设周期性扣费。Agent 和用户在使用已安装的 skill 时，必须遵守该 skill 上游的开源许可（MIT、Apache-2.0 等）。`,
      },
      {
        title: '定价 —— 面向自主 Agent 的微交易',
        content: `MarketNow 采用为自主 agent 消费优化的微交易定价模型。每一个 skill 都有一个透明的一次性 USD 价格，显示在其详情页以及 /api/skills.json 响应中：

• Free —— 1,321 个 skill（26%）—— 实用型、单功能 MCP server

所有 9,248 个技能都免费：没有最低或最高价格，不存在付款。Agent 可通过公开 API /api/skills.json 以编程方式发现、评估并安装 skill。`,
      },
      {
        title: 'Politique de Remboursement',
        content: `Tous les achats de skills sont éligibles à un remboursement intégral sous 14 jours si moins de 100 appels d'API ont été effectués avec la license key. Pour demander un remboursement, écrivez à support@alicelabs.site avec votre order ID. Les remboursements sont traités vers le moyen de paiement d'origine sous 5 à 10 jours ouvrés. Les skills au prix de Free restent éligibles au remboursement, mais les frais de transaction peuvent dépasser le montant du remboursement dans certains cas.`,
      },
      {
        title: 'Politique de Confidentialité',
        content: `MarketNow collecte le minimum de données nécessaires pour faire fonctionner le marketplace : adresse email (pour la connexion au compte), enregistrements de paiement (traités par Stripe) et la liste des skills que vous avez achetées. Nous ne vendons pas de données personnelles. Toutes les données en transit sont chiffrées avec TLS 1.3. Nous ne stockons pas les numéros de carte de crédit — Stripe traite toutes les données de paiement sur son infrastructure conforme PCI. La consommation de l'API par les agents est journalisée par IP et User-Agent pour le rate limiting et la prévention des abus, mais n'est pas liée à l'identité personnelle sauf si vous vous connectez.`,
      },
      {
        title: 'Licences des Skills',
        content: `Chaque skill sur MarketNow provient d'un dépôt open-source réel et public. Lorsque vous achetez une skill, vous recevez : (1) une license key MarketNow pour vérification, (2) la commande d'installation (généralement \`npx -y marketnow-install-stack\`), et (3) l'accès à la documentation de la skill. La licence open-source sous-jacente (MIT, Apache-2.0, etc.) de chaque skill s'applique toujours à votre usage du code lui-même. La valeur ajoutée de MarketNow est la curation, la vérification (Sentinel L1) et l'empaquetage — pas le code sous-jacent, qui reste gratuit sous sa licence originale.`,
      },
      {
        title: 'Utilisation de l\'API par les Agents',
        content: `Les agents autonomes sont invités à consommer l'API MarketNow sur /api/*. Les endpoints de lecture (skills.json, categories.json, manifest.json, agent.json) sont publics et ne nécessitent pas d'authentification. Limites de débit : 60 requêtes/minute pour anonymes, 600/minute pour authentifiés. Pour une consommation en masse, mettez en cache /api/skills.json localement et rafraîchissez au maximum toutes les 24 heures — le catalogue change rarement. L'endpoint /api/agent.json fournit des instructions machine-readable, un schema et des exemples de workflow conçus spécifiquement pour la consommation par agents.`,
      },
      {
        title: 'Usage Acceptable',
        content: `Vous acceptez de ne pas utiliser les skills de MarketNow pour des activités illégales, pour violer les droits d'autrui, ou pour construire des logiciels malveillants. Les skills ne doivent pas être redistribuées ni revendues sans permission explicite. MarketNow se réserve le droit de révoquer les licenses en cas d'abus, de fraude ou de violation de ces conditions. Le scraping du HTML du site est interdit — utilisez plutôt l'API JSON publique, qui est conçue pour l'accès programmatique.`,
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
