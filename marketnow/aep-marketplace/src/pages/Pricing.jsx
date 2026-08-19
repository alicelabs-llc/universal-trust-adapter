import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import BackgroundOrbs from '../components/BackgroundOrbs';
import { TIERS, ADDONS, COMMISSION, STORAGE_FEE } from '../utils/monetization';
import { useLang } from '../context/LanguageContext.jsx';

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT — all UI text in 5 languages (en, es, pt, zh, fr)
// ═══════════════════════════════════════════════════════════════════════════
const CONTENT = {
  en: {
    headerExtra:
      "Start free with the Community plan. Upgrade to Team ($99/mo) when you need monitoring and analytics. Enterprise available for custom deployments.",
    billingMonthly: 'MONTHLY',
    billingYearly: 'YEARLY',
    billingYearlyDiscount: '-20%',
    mostPopular: 'MOST POPULAR',
    periodForever: 'forever',
    periodMonth: 'mo',
    saveWithYearly: 'Save ${amount}/mo with yearly billing',
    skillsIncluded: 'Skills Included',
    skillsWord: 'skills',
    startFree: 'START FREE',
    upgradeTo: 'UPGRADE TO {name}',

    storageFeeTitle: 'Storage Fee (FREE tier only)',
    storageFeeBody:
      'FREE tier includes your first {threshold} skills at no cost. After that, a storage fee of ${price} per skill per {period} applies. This covers hosting, Sentinel scanning, and continuous monitoring of your skills. PRO and ENTERPRISE tiers include unlimited storage — no per-skill fees.',

    addonsTitle: 'ADD-ONS',
    addonsSubtitle: 'Boost your skills with one-time purchases',

    commissionTitle: 'COMMISSION BREAKDOWN',
    commissionSubtitle: "For every skill sold, here's how the revenue is split",
    commissionSellerLabel: 'Seller',
    commissionSellerDesc: 'Receives the majority of each sale',
    commissionMarketnowLabel: 'MarketNow',
    commissionMarketnowDesc: 'Hosting, scanning, marketplace ops',
    commissionAffiliateLabel: 'Affiliate',
    commissionAffiliateDesc: 'Earned by referrers (optional)',
    standardSale: 'Standard sale (no affiliate): Seller 80% · MarketNow 20% = 100%',
    affiliateSale:
      "Affiliate sale (5% comes from MarketNow's share): Seller 80% · MarketNow 15% · Affiliate 5% = 100%",
    exampleLine:
      'Example: A skill sold at $2.99 → Seller gets $2.39 (80%) · MarketNow gets $0.45 (15%) · Affiliate gets $0.15 (5%)',

    affiliateTitle: 'BECOME AN AFFILIATE',
    affiliateBody:
      'Earn 5% commission on every sale you refer. Share your affiliate link, and when someone buys via your link, you get paid. Monthly payouts via Stripe Connect (minimum $50 threshold).',
    affiliateButton: 'GET YOUR AFFILIATE LINK →',

    faqTitle: 'FREQUENTLY ASKED QUESTIONS',
    faq: [
      {
        q: 'Do buyers need a subscription?',
        a: 'No. MarketNow uses B2B pricing: Community (Free), Team ($99/mo), Enterprise (Custom). All 8,845 skills are Sentinel-certified and browsable for free.',
      },
      {
        q: 'What happens if I exceed my free tier limit?',
        a: 'Community plan is free. For team monitoring, upgrade to Team ($99/mo). Enterprise available for custom deployments.',
      },
      {
        q: 'How do I get paid as a seller?',
        a: "Payouts are processed monthly via Stripe Connect. You'll receive 80% of each sale price. Minimum payout threshold is $50. Sign up for Stripe Connect from your dashboard after your first sale.",
      },
      {
        q: 'Can I list my skill for free?',
        a: 'Yes — your first 3 skills are completely free to list. You only pay if you want to list more, or if you want add-ons like Featured Listing or Verified Seller badge.',
      },
      {
        q: 'What is the Verified Seller badge?',
        a: 'A one-time $19.99 purchase that adds a ✓ Verified badge to all your skills. Requires KYC verification (government ID). Boosts buyer trust and conversion rates significantly.',
      },
      {
        q: 'How does the affiliate program work?',
        a: 'Generate your unique affiliate code from /dashboard. Share links with your code (?ref=aff_xxxxx). When someone buys via your link, you earn 5% of the sale price. Payouts are monthly via Stripe Connect (min $50).',
      },
      {
        q: 'Can agents buy skills programmatically?',
        a: 'Yes! Agents can use our public API at /api/skills.json to discover skills, then complete the purchase via /api/checkout/create-session. The MarketNow MCP server (npx -y marketnow-mcp) lets agents search directly from their runtime.',
      },
      {
        q: 'Do you offer custom enterprise plans?',
        a: 'Yes. For teams listing 100+ skills or with custom requirements (on-prem deployment, custom commission rates, SSO), contact us at info@alicelabs.site for a custom quote.',
      },
    ],

    finalCtaTitle: 'READY TO START SELLING?',
    finalCtaBody: 'List your first 3 skills free. No credit card required.',
    finalCtaButton: 'SUBMIT YOUR FIRST SKILL →',

    tiers: {
      FREE: {
        features: [
          'Up to 3 skills listed',
          'Basic Sentinel L1 scan',
          'Standard review queue (24-48h)',
          'Community support',
        ],
      },
      PRO: {
        features: [
          'Up to 25 skills listed',
          'Priority Sentinel scan (< 6h)',
          'Featured badge on listings',
          'Analytics dashboard',
          'Custom slug URLs',
          'Email support',
        ],
      },
      ENTERPRISE: {
        features: [
          'Unlimited skills',
          'Instant Sentinel scan (< 1h)',
          'Premium featured placement',
          'Advanced analytics + revenue reports',
          'API access for bulk operations',
          'Dedicated account manager',
          'Custom commission rates (negotiable)',
          'Priority support (Slack channel)',
        ],
      },
    },

    addons: {
      FEATURED_LISTING: {
        name: 'Featured Listing',
        period: '30 days',
        description:
          'Boost your skill to the top of search results and the homepage featured section.',
      },
      VERIFIED_SELLER: {
        name: 'Verified Seller Badge',
        period: 'one-time',
        description: 'Get a ✓ Verified badge on all your skills. Requires KYC verification.',
      },
      PRIORITY_REVIEW: {
        name: 'Priority Review',
        period: 'per skill',
        description: 'Skip the queue. Your skill is reviewed within 6 hours instead of 24-48h.',
      },
    },
  },

  es: {
    headerExtra:
      'Empieza gratis con el plan Community. Sube a Team ($99/mes) cuando necesites monitoreo y analíticas. Enterprise disponible para despliegues personalizados.',
    billingMonthly: 'MENSUAL',
    billingYearly: 'ANUAL',
    billingYearlyDiscount: '-20%',
    mostPopular: 'MÁS POPULAR',
    periodForever: 'para siempre',
    periodMonth: 'mes',
    saveWithYearly: 'Ahorra ${amount}/mes con facturación anual',
    skillsIncluded: 'Skills incluidas',
    skillsWord: 'skills',
    startFree: 'EMPEZAR GRATIS',
    upgradeTo: 'SUBIR A {name}',

    storageFeeTitle: 'Tarifa de almacenamiento (solo plan FREE)',
    storageFeeBody:
      'El plan FREE incluye tus primeras {threshold} skills sin costo. Después, aplica una tarifa de ${price} por skill por {period}. Esto cubre hosting, escaneo Sentinel y monitoreo continuo de tus skills. Los planes PRO y ENTERPRISE incluyen almacenamiento ilimitado — sin tarifas por skill.',

    addonsTitle: 'ADD-ONS',
    addonsSubtitle: 'Potencia tus skills con compras únicas',

    commissionTitle: 'DESGLOSE DE COMISIÓN',
    commissionSubtitle: 'Por cada skill vendida, así se reparten los ingresos',
    commissionSellerLabel: 'Vendedor',
    commissionSellerDesc: 'Recibe la mayor parte de cada venta',
    commissionMarketnowLabel: 'MarketNow',
    commissionMarketnowDesc: 'Hosting, escaneo, operación del marketplace',
    commissionAffiliateLabel: 'Afiliado',
    commissionAffiliateDesc: 'Ganado por referidores (opcional)',
    standardSale: 'Venta estándar (sin afiliado): Vendedor 80% · MarketNow 20% = 100%',
    affiliateSale:
      'Venta con afiliado (el 5% sale de la parte de MarketNow): Vendedor 80% · MarketNow 15% · Afiliado 5% = 100%',
    exampleLine:
      'Ejemplo: Una skill vendida a $2.99 → Vendedor recibe $2.39 (80%) · MarketNow recibe $0.45 (15%) · Afiliado recibe $0.15 (5%)',

    affiliateTitle: 'CONVIÉRTETE EN AFILIADO',
    affiliateBody:
      'Gana 5% de comisión por cada venta que refieras. Comparte tu link de afiliado y cuando alguien compra vía tu link, te pagan. Pagos mensuales vía Stripe Connect (umbral mínimo $50).',
    affiliateButton: 'OBTENER TU LINK DE AFILIADO →',

    faqTitle: 'PREGUNTAS FRECUENTES',
    faq: [
      {
        q: '¿Los compradores necesitan suscripción?',
        a: 'No. MarketNow usa precios B2B: Community (Gratis), Team ($99/mes), Enterprise (Custom). Las 8,845 skills están certificadas por Sentinel y son navegables gratis.',
      },
      {
        q: '¿Qué pasa si excedo el límite del plan free?',
        a: 'El plan Community es gratis. Para monitoreo de equipo, sube a Team ($99/mes). Enterprise disponible para despliegues personalizados.',
      },
      {
        q: '¿Cómo recibo mis pagos como vendedor?',
        a: 'Los pagos se procesan mensualmente vía Stripe Connect. Recibirás 80% del precio de cada venta. El umbral mínimo de pago es $50. Regístrate en Stripe Connect desde tu dashboard después de tu primera venta.',
      },
      {
        q: '¿Puedo publicar mi skill gratis?',
        a: 'Sí — tus primeras 3 skills son completamente gratis de publicar. Solo pagas si quieres publicar más, o si quieres add-ons como Featured Listing o el badge Verified Seller.',
      },
      {
        q: '¿Qué es el badge Verified Seller?',
        a: 'Una compra única de $19.99 que añade un badge ✓ Verified a todas tus skills. Requiere verificación KYC (identificación oficial). Aumenta la confianza del comprador y las tasas de conversión significativamente.',
      },
      {
        q: '¿Cómo funciona el programa de afiliados?',
        a: 'Genera tu código de afiliado único desde /dashboard. Comparte links con tu código (?ref=aff_xxxxx). Cuando alguien compra vía tu link, ganas 5% del precio de venta. Los pagos son mensuales vía Stripe Connect (mín $50).',
      },
      {
        q: '¿Los agentes pueden comprar skills programáticamente?',
        a: '¡Sí! Los agentes pueden usar nuestra API pública en /api/skills.json para descubrir skills, luego completar la compra vía /api/checkout/create-session. El servidor MCP de MarketNow (npx -y marketnow-mcp) deja a los agentes buscar directamente desde su runtime.',
      },
      {
        q: '¿Ofrecen planes enterprise personalizados?',
        a: 'Sí. Para equipos que publican 100+ skills o con requisitos personalizados (despliegue on-prem, comisiones custom, SSO), contáctanos en info@alicelabs.site para una cotización personalizada.',
      },
    ],

    finalCtaTitle: '¿LISTO PARA EMPEZAR A VENDER?',
    finalCtaBody: 'Publica tus primeras 3 skills gratis. No se requiere tarjeta de crédito.',
    finalCtaButton: 'PUBLICA TU PRIMERA SKILL →',

    tiers: {
      FREE: {
        features: [
          'Hasta 3 skills publicadas',
          'Escaneo básico Sentinel L1',
          'Cola de revisión estándar (24-48h)',
          'Soporte comunitario',
        ],
      },
      PRO: {
        features: [
          'Hasta 25 skills publicadas',
          'Escaneo prioritario Sentinel (< 6h)',
          'Badge featured en tus listings',
          'Dashboard de analytics',
          'URLs con slug personalizado',
          'Soporte por email',
        ],
      },
      ENTERPRISE: {
        features: [
          'Skills ilimitadas',
          'Escaneo instantáneo Sentinel (< 1h)',
          'Ubicación featured premium',
          'Analytics avanzados + reportes de revenue',
          'Acceso API para operaciones en lote',
          'Account manager dedicado',
          'Comisiones personalizadas (negociables)',
          'Soporte prioritario (canal Slack)',
        ],
      },
    },

    addons: {
      FEATURED_LISTING: {
        name: 'Featured Listing',
        period: '30 días',
        description:
          'Impulsa tu skill al top de los resultados de búsqueda y la sección featured del homepage.',
      },
      VERIFIED_SELLER: {
        name: 'Badge Verified Seller',
        period: 'pago único',
        description:
          'Obtén un badge ✓ Verified en todas tus skills. Requiere verificación KYC.',
      },
      PRIORITY_REVIEW: {
        name: 'Priority Review',
        period: 'por skill',
        description:
          'Salta la cola. Tu skill se revisa en 6 horas en lugar de 24-48h.',
      },
    },
  },

  pt: {
    headerExtra:
      'Comece grátis com o plano Community. Faça upgrade para Team ($99/mês) quando precisar de monitoramento e análises. Enterprise disponível para implantações personalizadas.',
    billingMonthly: 'MENSAL',
    billingYearly: 'ANUAL',
    billingYearlyDiscount: '-20%',
    mostPopular: 'MAIS POPULAR',
    periodForever: 'para sempre',
    periodMonth: 'mês',
    saveWithYearly: 'Economize ${amount}/mês com cobrança anual',
    skillsIncluded: 'Skills incluídas',
    skillsWord: 'skills',
    startFree: 'COMEÇAR GRÁTIS',
    upgradeTo: 'FAZER UPGRADE PARA {name}',

    storageFeeTitle: 'Taxa de armazenamento (apenas plano FREE)',
    storageFeeBody:
      'O plano FREE inclui suas primeiras {threshold} skills sem custo. Depois disso, aplica-se uma taxa de ${price} por skill por {period}. Isso cobre hospedagem, escaneamento Sentinel e monitoramento contínuo das suas skills. Os planos PRO e ENTERPRISE incluem armazenamento ilimitado — sem taxas por skill.',

    addonsTitle: 'ADD-ONS',
    addonsSubtitle: 'Potencialize suas skills com compras únicas',

    commissionTitle: 'DETALHAMENTO DA COMISSÃO',
    commissionSubtitle: 'Para cada skill vendida, veja como a receita é dividida',
    commissionSellerLabel: 'Vendedor',
    commissionSellerDesc: 'Recebe a maior parte de cada venda',
    commissionMarketnowLabel: 'MarketNow',
    commissionMarketnowDesc: 'Hospedagem, escaneamento, operação do marketplace',
    commissionAffiliateLabel: 'Afiliado',
    commissionAffiliateDesc: 'Ganho por indicadores (opcional)',
    standardSale: 'Venda padrão (sem afiliado): Vendedor 80% · MarketNow 20% = 100%',
    affiliateSale:
      'Venda com afiliado (os 5% vêm da parte do MarketNow): Vendedor 80% · MarketNow 15% · Afiliado 5% = 100%',
    exampleLine:
      'Exemplo: Uma skill vendida por $2.99 → Vendedor recebe $2.39 (80%) · MarketNow recebe $0.45 (15%) · Afiliado recebe $0.15 (5%)',

    affiliateTitle: 'TORNE-SE UM AFILIADO',
    affiliateBody:
      'Ganhe 5% de comissão em cada venda que você indicar. Compartilhe seu link de afiliado e quando alguém compra via seu link, você recebe. Pagamentos mensais via Stripe Connect (limite mínimo $50).',
    affiliateButton: 'OBTER SEU LINK DE AFILIADO →',

    faqTitle: 'PERGUNTAS FREQUENTES',
    faq: [
      {
        q: 'Compradores precisam de assinatura?',
        a: 'Não. O MarketNow usa preços B2B: Community (Grátis), Team ($99/mês), Enterprise (Custom). Todas as 8,845 skills são certificadas pelo Sentinel e navegáveis gratuitamente.',
      },
      {
        q: 'O que acontece se eu exceder o limite do plano free?',
        a: 'O plano Community é gratuito. Para monitoramento de equipe, faça upgrade para Team ($99/mês). Enterprise disponível para implantações personalizadas.',
      },
      {
        q: 'Como recebo meus pagamentos como vendedor?',
        a: 'Pagamentos são processados mensalmente via Stripe Connect. Você recebe 80% do preço de cada venda. Limite mínimo de pagamento é $50. Cadastre-se no Stripe Connect pelo seu dashboard após a primeira venda.',
      },
      {
        q: 'Posso listar minha skill gratuitamente?',
        a: 'Sim — suas primeiras 3 skills são totalmente gratuitas para listar. Você só paga se quiser listar mais, ou se quiser add-ons como Featured Listing ou badge Verified Seller.',
      },
      {
        q: 'O que é o badge Verified Seller?',
        a: 'Uma compra única de $19.99 que adiciona um badge ✓ Verified a todas as suas skills. Requer verificação KYC (documento de identidade). Aumenta significativamente a confiança do comprador e as taxas de conversão.',
      },
      {
        q: 'Como funciona o programa de afiliados?',
        a: 'Gere seu código de afiliado único em /dashboard. Compartilhe links com seu código (?ref=aff_xxxxx). Quando alguém compra via seu link, você ganha 5% do preço da venda. Pagamentos mensais via Stripe Connect (mín $50).',
      },
      {
        q: 'Agentes podem comprar skills programaticamente?',
        a: 'Sim! Agentes podem usar nossa API pública em /api/skills.json para descobrir skills, depois concluir a compra via /api/checkout/create-session. O servidor MCP do MarketNow (npx -y marketnow-mcp) permite que agentes busquem diretamente do runtime.',
      },
      {
        q: 'Vocês oferecem planos enterprise personalizados?',
        a: 'Sim. Para equipes que listam 100+ skills ou com requisitos personalizados (deploy on-prem, comissões customizadas, SSO), entre em contato em info@alicelabs.site para um orçamento personalizado.',
      },
    ],

    finalCtaTitle: 'PRONTO PARA COMEÇAR A VENDER?',
    finalCtaBody: 'Liste suas primeiras 3 skills gratuitamente. Sem cartão de crédito.',
    finalCtaButton: 'ENVIE SUA PRIMEIRA SKILL →',

    tiers: {
      FREE: {
        features: [
          'Até 3 skills listadas',
          'Escaneamento básico Sentinel L1',
          'Fila de revisão padrão (24-48h)',
          'Suporte da comunidade',
        ],
      },
      PRO: {
        features: [
          'Até 25 skills listadas',
          'Escaneamento prioritário Sentinel (< 6h)',
          'Badge featured nos listings',
          'Dashboard de analytics',
          'URLs com slug personalizado',
          'Suporte por email',
        ],
      },
      ENTERPRISE: {
        features: [
          'Skills ilimitadas',
          'Escaneamento instantâneo Sentinel (< 1h)',
          'Posicionamento featured premium',
          'Analytics avançados + relatórios de receita',
          'Acesso à API para operações em lote',
          'Gerente de conta dedicado',
          'Comissões personalizadas (negociáveis)',
          'Suporte prioritário (canal Slack)',
        ],
      },
    },

    addons: {
      FEATURED_LISTING: {
        name: 'Featured Listing',
        period: '30 dias',
        description:
          'Impulsione sua skill para o topo dos resultados de busca e da seção featured do homepage.',
      },
      VERIFIED_SELLER: {
        name: 'Badge Verified Seller',
        period: 'pagamento único',
        description:
          'Obtenha um badge ✓ Verified em todas as suas skills. Requer verificação KYC.',
      },
      PRIORITY_REVIEW: {
        name: 'Priority Review',
        period: 'por skill',
        description:
          'Pule a fila. Sua skill é revisada em 6 horas em vez de 24-48h.',
      },
    },
  },

  zh: {
    headerExtra:
      '从 Community 免费计划开始。需要团队监控和分析时升级到 Team（$99/月）。Enterprise 可用于定制部署。',
    billingMonthly: '月付',
    billingYearly: '年付',
    billingYearlyDiscount: '-20%',
    mostPopular: '最受欢迎',
    periodForever: '永久',
    periodMonth: '月',
    saveWithYearly: '年付每月省 ${amount}',
    skillsIncluded: '包含 skill 数',
    skillsWord: '个 skill',
    startFree: '免费开始',
    upgradeTo: '升级到 {name}',

    storageFeeTitle: '存储费（仅 FREE 套餐）',
    storageFeeBody:
      'FREE 套餐包含前 {threshold} 个 skill，免费。之后每个 skill 每 {period} 收取 ${price} 存储费。这覆盖托管、Sentinel 扫描以及对你的 skill 的持续监控。PRO 和 ENTERPRISE 套餐包含无限存储 —— 无按 skill 计费。',

    addonsTitle: '附加服务',
    addonsSubtitle: '通过一次性购买提升你的 skill',

    commissionTitle: '佣金分配',
    commissionSubtitle: '每售出一个 skill，收入这样分配',
    commissionSellerLabel: '卖家',
    commissionSellerDesc: '获得每笔销售的大部分',
    commissionMarketnowLabel: 'MarketNow',
    commissionMarketnowDesc: '托管、扫描、市场运营',
    commissionAffiliateLabel: '推广者',
    commissionAffiliateDesc: '由推荐人获得（可选）',
    standardSale: '标准销售（无推广者）：卖家 80% · MarketNow 20% = 100%',
    affiliateSale: '推广销售（5% 来自 MarketNow 的份额）：卖家 80% · MarketNow 15% · 推广者 5% = 100%',
    exampleLine:
      '示例：一个 skill 以 $2.99 售出 → 卖家获得 $2.39（80%）· MarketNow 获得 $0.45（15%）· 推广者获得 $0.15（5%）',

    affiliateTitle: '成为推广者',
    affiliateBody:
      '每笔你推荐的销售可获得 5% 佣金。分享你的推广链接，当有人通过你的链接购买时，你就能获得报酬。每月通过 Stripe Connect 付款（最低起付 $50）。',
    affiliateButton: '获取你的推广链接 →',

    faqTitle: '常见问题',
    faq: [
      {
        q: '买家需要订阅吗？',
        a: '不需要。MarketNow 使用 B2B 定价：Community（免费）、Team（$99/月）、Enterprise（定制）。所有 8,845 个技能都通过 Sentinel 认证，可免费浏览。',
      },
      {
        q: '如果超出免费套餐限额会怎样？',
        a: 'Community 计划免费。如需团队监控，请升级到 Team（$99/月）。Enterprise 可用于定制部署。',
      },
      {
        q: '作为卖家如何收款？',
        a: '通过 Stripe Connect 按月处理付款。你将获得每笔售价的 80%。最低起付金额为 $50。首次销售后可在 dashboard 注册 Stripe Connect。',
      },
      {
        q: '可以免费上架 skill 吗？',
        a: '可以 —— 你的前 3 个 skill 完全免费上架。仅当你想上架更多，或购买 Featured Listing、Verified Seller 徽章等附加服务时才需付费。',
      },
      {
        q: 'Verified Seller 徽章是什么？',
        a: '一次性支付 $19.99，为你的所有 skill 添加 ✓ Verified 徽章。需通过 KYC 验证（政府签发 ID）。可显著提升买家信任和转化率。',
      },
      {
        q: '推广者计划如何运作？',
        a: '在 /dashboard 生成你专属的推广码。分享带推广码的链接（?ref=aff_xxxxx）。有人通过你的链接购买时，你获得售价的 5%。每月通过 Stripe Connect 付款（最低 $50）。',
      },
      {
        q: 'agent 可以通过 API 程序化购买 skill 吗？',
        a: '可以！agent 可使用我们的公开 API /api/skills.json 发现 skill，然后通过 /api/checkout/create-session 完成购买。MarketNow MCP 服务器（npx -y marketnow-mcp）让 agent 可直接在其运行时内搜索。',
      },
      {
        q: '提供定制企业套餐吗？',
        a: '提供。对于上架 100+ skill 的团队或有定制需求（私有化部署、定制佣金率、SSO）的团队，请通过 info@alicelabs.site 联系我们获取定制报价。',
      },
    ],

    finalCtaTitle: '准备好开始销售了吗？',
    finalCtaBody: '免费上架你的前 3 个 skill。无需信用卡。',
    finalCtaButton: '提交你的第一个 skill →',

    tiers: {
      FREE: {
        features: [
          '最多上架 3 个 skill',
          '基础 Sentinel L1 扫描',
          '标准审核队列（24-48 小时）',
          '社区支持',
        ],
      },
      PRO: {
        features: [
          '最多上架 25 个 skill',
          '优先 Sentinel 扫描（< 6 小时）',
          '商品页 featured 徽章',
          '数据分析面板',
          '自定义 slug URL',
          '邮件支持',
        ],
      },
      ENTERPRISE: {
        features: [
          '无限 skill',
          '即时 Sentinel 扫描（< 1 小时）',
          '高级 featured 展位',
          '高级分析 + 营收报表',
          '批量操作 API 访问',
          '专属客户经理',
          '定制佣金率（可议）',
          '优先支持（Slack 频道）',
        ],
      },
    },

    addons: {
      FEATURED_LISTING: {
        name: 'Featured Listing',
        period: '30 天',
        description: '将你的 skill 推到搜索结果顶部和首页 featured 区。',
      },
      VERIFIED_SELLER: {
        name: 'Verified Seller 徽章',
        period: '一次性',
        description: '为你的所有 skill 添加 ✓ Verified 徽章。需通过 KYC 验证。',
      },
      PRIORITY_REVIEW: {
        name: 'Priority Review',
        period: '按 skill',
        description: '跳过队列。你的 skill 在 6 小时内审核，而非 24-48 小时。',
      },
    },
  },

  fr: {
    headerExtra:
      "Commencez gratuitement avec le plan Community. Passez à Team ($99/mois) quand vous avez besoin de surveillance et d'analyses. Enterprise disponible pour les déploiements personnalisés.",
    billingMonthly: 'MENSUEL',
    billingYearly: 'ANNUEL',
    billingYearlyDiscount: '-20%',
    mostPopular: 'LE PLUS POPULAIRE',
    periodForever: 'à vie',
    periodMonth: 'mois',
    saveWithYearly: 'Économisez ${amount}/mois avec la facturation annuelle',
    skillsIncluded: 'Skills incluses',
    skillsWord: 'skills',
    startFree: 'COMMENCER GRATUITEMENT',
    upgradeTo: 'PASSER À {name}',

    storageFeeTitle: 'Frais de stockage (plan FREE uniquement)',
    storageFeeBody:
      "Le plan FREE inclut vos {threshold} premières skills gratuitement. Ensuite, des frais de stockage de ${price} par skill par {period} s'appliquent. Cela couvre l'hébergement, le scan Sentinel et la surveillance continue de vos skills. Les plans PRO et ENTERPRISE incluent un stockage illimité — pas de frais par skill.",

    addonsTitle: 'ADD-ONS',
    addonsSubtitle: 'Boostez vos skills avec des achats uniques',

    commissionTitle: 'DÉTAIL DES COMMISSIONS',
    commissionSubtitle: 'Pour chaque skill vendue, voici comment les revenus sont répartis',
    commissionSellerLabel: 'Vendeur',
    commissionSellerDesc: 'Reçoit la majorité de chaque vente',
    commissionMarketnowLabel: 'MarketNow',
    commissionMarketnowDesc: 'Hébergement, scan, opérations du marketplace',
    commissionAffiliateLabel: 'Affilié',
    commissionAffiliateDesc: 'Gagné par les auteurs de recommandations (facultatif)',
    standardSale: 'Vente standard (sans affilié) : Vendeur 80% · MarketNow 20% = 100%',
    affiliateSale:
      "Vente avec affilié (les 5% viennent de la part de MarketNow) : Vendeur 80% · MarketNow 15% · Affilié 5% = 100%",
    exampleLine:
      'Exemple : Une skill vendue $2.99 → Vendeur reçoit $2.39 (80%) · MarketNow reçoit $0.45 (15%) · Affilié reçoit $0.15 (5%)',

    affiliateTitle: 'DEVENEZ AFFILIÉ',
    affiliateBody:
      "Gagnez 5% de commission sur chaque vente que vous référez. Partagez votre lien d'affiliation, et quand quelqu'un achète via votre lien, vous êtes payé. Paiements mensuels via Stripe Connect (seuil minimum $50).",
    affiliateButton: 'OBTENIR VOTRE LIEN AFFILIÉ →',

    faqTitle: 'QUESTIONS FRÉQUENTES',
    faq: [
      {
        q: 'Les acheteurs ont-ils besoin d\'un abonnement ?',
        a: "Non. MarketNow utilise une tarification B2B : Community (Gratuit), Team ($99/mois), Enterprise (Sur mesure). Les 8 582 skills sont certifiées par Sentinel et naviguables gratuitement.",
      },
      {
        q: 'Que se passe-t-il si je dépasse la limite du plan gratuit ?',
        a: 'Le plan Community est gratuit. Pour la surveillance d`équipe, passez à Team ($99/mois). Enterprise disponible pour les déploiements personnalisés.',
      },
      {
        q: 'Comment suis-je payé en tant que vendeur ?',
        a: "Les paiements sont traités mensuellement via Stripe Connect. Vous recevez 80% du prix de chaque vente. Le seuil minimum de paiement est $50. Inscrivez-vous à Stripe Connect depuis votre dashboard après votre première vente.",
      },
      {
        q: 'Puis-je lister ma skill gratuitement ?',
        a: 'Oui — vos 3 premières skills sont entièrement gratuites à lister. Vous ne payez que si vous voulez en lister plus, ou si vous voulez des add-ons comme Featured Listing ou le badge Verified Seller.',
      },
      {
        q: "Qu'est-ce que le badge Verified Seller ?",
        a: 'Un achat unique de $19.99 qui ajoute un badge ✓ Verified à toutes vos skills. Nécessite une vérification KYC (pièce d\'identité officielle). Augmente significativement la confiance des acheteurs et les taux de conversion.',
      },
      {
        q: 'Comment fonctionne le programme d\'affiliation ?',
        a: "Générez votre code d'affiliation unique depuis /dashboard. Partagez des liens avec votre code (?ref=aff_xxxxx). Quand quelqu'un achète via votre lien, vous gagnez 5% du prix de vente. Les paiements sont mensuels via Stripe Connect (min $50).",
      },
      {
        q: 'Les agents peuvent-ils acheter des skills programmatiquement ?',
        a: 'Oui ! Les agents peuvent utiliser notre API publique sur /api/skills.json pour découvrir des skills, puis finaliser l\'achat via /api/checkout/create-session. Le serveur MCP de MarketNow (npx -y marketnow-mcp) permet aux agents de chercher directement depuis leur runtime.',
      },
      {
        q: 'Proposez-vous des plans enterprise personnalisés ?',
        a: 'Oui. Pour les équipes listant 100+ skills ou avec des exigences personnalisées (déploiement on-prem, taux de commission personnalisés, SSO), contactez-nous à info@alicelabs.site pour un devis personnalisé.',
      },
    ],

    finalCtaTitle: 'PRÊT À COMMENCER À VENDRE ?',
    finalCtaBody: 'Listez vos 3 premières skills gratuitement. Aucune carte de crédit requise.',
    finalCtaButton: 'SOUMETTEZ VOTRE PREMIÈRE SKILL →',

    tiers: {
      FREE: {
        features: [
          'Jusqu\'à 3 skills listées',
          'Scan Sentinel L1 basique',
          'File de revue standard (24-48h)',
          'Support communautaire',
        ],
      },
      PRO: {
        features: [
          'Jusqu\'à 25 skills listées',
          'Scan Sentinel prioritaire (< 6h)',
          'Badge featured sur les annonces',
          'Dashboard d\'analytics',
          'URLs avec slug personnalisé',
          'Support par email',
        ],
      },
      ENTERPRISE: {
        features: [
          'Skills illimitées',
          'Scan Sentinel instantané (< 1h)',
          'Placement featured premium',
          'Analytics avancés + rapports de revenus',
          'Accès API pour opérations en lot',
          'Gestionnaire de compte dédié',
          'Taux de commission personnalisés (négociables)',
          'Support prioritaire (canal Slack)',
        ],
      },
    },

    addons: {
      FEATURED_LISTING: {
        name: 'Featured Listing',
        period: '30 jours',
        description:
          'Boostez votre skill en haut des résultats de recherche et de la section featured du homepage.',
      },
      VERIFIED_SELLER: {
        name: 'Badge Verified Seller',
        period: 'paiement unique',
        description:
          'Obtenez un badge ✓ Verified sur toutes vos skills. Nécessite une vérification KYC.',
      },
      PRIORITY_REVIEW: {
        name: 'Priority Review',
        period: 'par skill',
        description:
          'Évitez la file. Votre skill est revue en 6 heures au lieu de 24-48h.',
      },
    },
  },
};

function fmt(str, vars) {
  if (!vars) return str;
  let out = str;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, String(v));
  }
  return out;
}

/**
 * MarketNow — Pricing Page
 *
 * Modelo de monetización completo:
 * - Compradores: B2B pricing (Community/Team/Enterprise)
 * - Planes: Community (Free) / Team ($99/mo) / Enterprise (Custom)
 * - Add-ons: Featured listing, Verified Seller badge, Priority Review
 * - Afiliados: 5% comisión por venta referida
 */
export default function Pricing() {
  const { t, lang } = useLang();
  const c = CONTENT[lang] || CONTENT.en;
  const [billing, setBilling] = useState('monthly'); // monthly | yearly
  const yearlyDiscount = 0.20; // 20% off yearly

  return (
    <div className="relative min-h-screen">
      <BackgroundOrbs />
      <div className="relative z-10 max-w-[1440px] mx-auto px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {t('pricing.title')}
          </h1>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            {t('pricing.subtitle')}
            <br />
            {c.headerExtra}
          </p>
        </motion.div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-5 py-2 rounded-lg text-sm font-mono transition-all ${
              billing === 'monthly'
                ? 'bg-[#00F299]/20 text-[#00F299] border border-[#00F299]/40'
                : 'bg-white/5 text-zinc-400 border border-white/10'
            }`}
          >
            {c.billingMonthly}
          </button>
          <button
            onClick={() => setBilling('yearly')}
            className={`px-5 py-2 rounded-lg text-sm font-mono transition-all ${
              billing === 'yearly'
                ? 'bg-[#00F299]/20 text-[#00F299] border border-[#00F299]/40'
                : 'bg-white/5 text-zinc-400 border border-white/10'
            }`}
          >
            {c.billingYearly} <span className="text-[#00F299] text-[10px]">{c.billingYearlyDiscount}</span>
          </button>
        </div>

        {/* Seller Tiers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {Object.values(TIERS).map((tier, i) => {
            const monthlyPrice = tier.price;
            const yearlyPrice = monthlyPrice * 12 * (1 - yearlyDiscount);
            const displayPrice = billing === 'yearly' ? yearlyPrice / 12 : monthlyPrice;
            const translatedFeatures = c.tiers[tier.name]?.features || tier.features;
            const periodLabel = tier.period === 'forever' ? c.periodForever : c.periodMonth;

            return (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`premium-card p-8 relative ${
                  tier.name === 'PRO' ? 'border-[#00F299]/40 shadow-lg shadow-[#00F299]/10' : ''
                }`}
              >
                {tier.name === 'PRO' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#00F299] text-black text-[10px] font-bold tracking-wider">
                    {c.mostPopular}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">{tier.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white font-mono">
                      ${displayPrice.toFixed(2)}
                    </span>
                    <span className="text-zinc-500 text-sm">
                      /{periodLabel}
                    </span>
                  </div>
                  {billing === 'yearly' && tier.price > 0 && (
                    <div className="text-[#00F299] text-xs mt-1 font-mono">
                      {fmt(c.saveWithYearly, { amount: (monthlyPrice - displayPrice).toFixed(2) })}
                    </div>
                  )}
                </div>

                <div className="mb-6 p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[10px] text-zinc-500 font-mono tracking-wider uppercase mb-1">
                    {c.skillsIncluded}
                  </div>
                  <div className="text-white font-bold text-lg">
                    {tier.maxSkills === Infinity ? '∞' : tier.maxSkills}
                    <span className="text-zinc-500 text-sm font-normal ml-1">{c.skillsWord}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {translatedFeatures.map((f, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-zinc-300">
                      <span className="text-[#00F299] mt-0.5 shrink-0">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to="/submit"
                  className={`block w-full py-3 text-center font-bold rounded-xl transition-all ${
                    tier.name === 'FREE'
                      ? 'border border-white/10 text-white hover:bg-white/5'
                      : tier.name === 'PRO'
                      ? 'bg-[#00F299] text-black hover:bg-[#00F299]/90'
                      : 'bg-[#a892ff] text-black hover:bg-[#a892ff]/90'
                  }`}
                >
                  {tier.name === 'FREE' ? c.startFree : fmt(c.upgradeTo, { name: tier.name })}
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* Storage fee notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="premium-card p-6 mb-12"
        >
          <div className="flex items-start gap-4">
            <span className="text-3xl">💾</span>
            <div>
              <h3 className="text-white font-semibold mb-1">{c.storageFeeTitle}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                {fmt(c.storageFeeBody, {
                  threshold: STORAGE_FEE.freeThreshold,
                  price: STORAGE_FEE.pricePerSkill.toFixed(2),
                  period: STORAGE_FEE.period === 'month' ? c.periodMonth : STORAGE_FEE.period,
                })}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Add-ons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-16"
        >
          <h2 className="text-2xl font-bold text-white mb-2 text-center">{c.addonsTitle}</h2>
          <p className="text-zinc-400 text-sm mb-8 text-center">{c.addonsSubtitle}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(ADDONS).map(([addonKey, addon], i) => {
              const translated = c.addons[addonKey] || {};
              return (
                <motion.div
                  key={addonKey}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="premium-card p-6"
                >
                  <h3 className="text-white font-semibold mb-2">{translated.name || addon.name}</h3>
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-2xl font-bold text-[#00F299] font-mono">${addon.price.toFixed(2)}</span>
                    <span className="text-zinc-500 text-xs">/ {translated.period || addon.period}</span>
                  </div>
                  <p className="text-zinc-400 text-xs leading-relaxed">{translated.description || addon.description}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Commission breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="premium-card p-8 mb-16"
        >
          <h2 className="text-2xl font-bold text-white mb-2 text-center">{c.commissionTitle}</h2>
          <p className="text-zinc-400 text-sm mb-8 text-center">
            {c.commissionSubtitle}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-6 rounded-xl bg-white/5 border border-white/5 text-center">
              <div className="text-4xl mb-2">💰</div>
              <div className="text-3xl font-bold text-[#00F299] font-mono">
                {(COMMISSION.seller * 100).toFixed(0)}%
              </div>
              <div className="text-white font-semibold text-sm mt-1">{c.commissionSellerLabel}</div>
              <div className="text-zinc-500 text-xs mt-1">{c.commissionSellerDesc}</div>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/5 text-center">
              <div className="text-4xl mb-2">🏢</div>
              <div className="text-3xl font-bold text-white font-mono">
                {(COMMISSION.marketnow * 100).toFixed(0)}%
              </div>
              <div className="text-white font-semibold text-sm mt-1">{c.commissionMarketnowLabel}</div>
              <div className="text-zinc-500 text-xs mt-1">{c.commissionMarketnowDesc}</div>
            </div>
            <div className="p-6 rounded-xl bg-white/5 border border-white/5 text-center">
              <div className="text-4xl mb-2">🤝</div>
              <div className="text-3xl font-bold text-[#00d1ff] font-mono">
                {(COMMISSION.affiliate * 100).toFixed(0)}%
              </div>
              <div className="text-white font-semibold text-sm mt-1">{c.commissionAffiliateLabel}</div>
              <div className="text-zinc-500 text-xs mt-1">{c.commissionAffiliateDesc}</div>
            </div>
          </div>
          <div className="mt-6 text-center text-zinc-500 text-xs">
            <p className="mb-2"><strong className="text-zinc-300">{c.standardSale}</strong></p>
            <p className="mb-2"><strong className="text-zinc-300">{c.affiliateSale}</strong></p>
            <p className="text-zinc-600 mt-3">{c.exampleLine}</p>
          </div>
        </motion.div>

        {/* Affiliate CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="premium-card p-8 mb-16 text-center"
        >
          <h2 className="text-2xl font-bold text-white mb-2">{c.affiliateTitle}</h2>
          <p className="text-zinc-400 text-sm mb-6 max-w-xl mx-auto">
            {c.affiliateBody}
          </p>
          <Link
            to="/dashboard"
            className="inline-block px-8 py-3 bg-[#00d1ff] text-black font-bold rounded-xl hover:bg-[#00d1ff]/90 transition-all"
          >
            {c.affiliateButton}
          </Link>
        </motion.div>

        {/* FAQ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto"
        >
          <h2 className="text-2xl font-bold text-white mb-6 text-center">{c.faqTitle}</h2>
          <div className="space-y-4">
            {(c.faq || []).map((item, i) => {
              const q = item.q;
              const a = fmt(item.a, { price: STORAGE_FEE.pricePerSkill.toFixed(2) });
              return (
                <details key={i} className="premium-card p-5 group">
                  <summary className="text-white font-semibold text-sm cursor-pointer flex items-center justify-between">
                    {q}
                    <span className="text-zinc-500 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <p className="text-zinc-400 text-sm mt-3 leading-relaxed">{a}</p>
                </details>
              );
            })}
          </div>
        </motion.div>

        {/* Final CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mt-16"
        >
          <h2 className="text-3xl font-bold text-white mb-4">{c.finalCtaTitle}</h2>
          <p className="text-zinc-400 mb-8">{c.finalCtaBody}</p>
          <Link
            to="/submit"
            className="inline-block px-10 py-4 bg-[#00F299] text-black font-bold rounded-xl hover:bg-[#00F299]/90 hover:scale-[1.02] transition-all shadow-lg shadow-[#00F299]/20"
          >
            {c.finalCtaButton}
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
