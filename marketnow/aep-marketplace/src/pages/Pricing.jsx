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
      "Buyers pay no platform fee: 68,387 of 68,388 skills install free. Sellers list free and keep 80% of premium sales. Optional Sentinel subscriptions (PRO $9.99/mo · ENTERPRISE $49.99/mo) power priority audits.",
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
      'Listing is free and unlimited — MarketNow charges no storage fees, ever. PRO and ENTERPRISE subscriptions exist for priority auditing and visibility, not for storage.',

    addonsTitle: 'ADD-ONS',
    addonsSubtitle: 'Included with Sentinel subscriptions',

    commissionTitle: 'COMMISSION BREAKDOWN',
    commissionSubtitle: "When a seller sells a skill, here's how the revenue is split",
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
      'Example: a $10 premium sale → Seller $8.00 (80%) · MarketNow $2.00 (20%); with an affiliate referral, $0.10 of MarketNow\'s share goes to the referrer.',

    affiliateTitle: 'BECOME AN AFFILIATE',
    affiliateBody:
      'Referrers earn 5% of MarketNow\'s share on every premium sale. Buyers never pay extra — the 5% comes out of MarketNow\'s 20% commission. Get your link from the dashboard.',
    affiliateButton: 'GET YOUR AFFILIATE LINK →',

    faqTitle: 'FREQUENTLY ASKED QUESTIONS',
    faq: [
      {
        q: 'Do buyers need a subscription?',
        a: 'Buyers install free skills at no cost. Premium skills have a price set by the seller. MarketNow takes 20% commission on each sale. Sellers pay Sentinel subscription for security auditing.',
      },
      {
        q: 'What happens if I exceed my free tier limit?',
        a: 'You will not hit one: listing is free and unlimited for every seller. Optional PRO/ENTERPRISE subscriptions add priority scans and visibility — they never gate publishing.',
      },
      {
        q: 'How do I get paid as a seller?',
        a: "Sellers receive 80% of each sale. MarketNow takes 20% commission. Payouts are monthly. Sign up from your dashboard after your first sale.",
      },
      {
        q: 'Can I list my skill for free?',
        a: 'Yes — listing is free and unlimited for every seller, forever. Optional add-ons (featured placement, verified badge) come bundled with PRO/ENTERPRISE subscriptions; publishing itself never costs anything.',
      },
      {
        q: 'What is the Verified Seller badge?',
        a: 'Included with the ENTERPRISE subscription ($49.99/mo): adds a ✓ Verified badge to all your skills. Requires KYC verification (government ID). Boosts buyer trust and conversion rates significantly.',
      },
      {
        q: 'How does the affiliate program work?',
        a: 'Referrers earn 5% of MarketNow\'s share on every premium sale. Buyers never pay extra — the 5% comes out of MarketNow\'s 20% commission. Get your link from the dashboard.',
      },
      {
        q: 'Can agents buy skills programmatically?',
        a: 'Agents discover skills via the public API (/api/skills.json) and install them with npx -y marketnow-install-stack <slug>. On-platform checkout is planned (commerce Gate C1); vendor-priced usage uses x402 (USDC on Base), billed 100% vendor-side.',
      },
      {
        q: 'Do you offer custom enterprise plans?',
        a: 'Yes. For teams listing 100+ skills or with custom requirements (on-prem deployment, custom commission rates, SSO), contact us at info@alicelabs.site for a custom quote.',
      },
    ],

    finalCtaTitle: 'READY TO START SELLING?',
    finalCtaBody: 'List your first skill free — no credit card required. Listing is always free.',
    finalCtaButton: 'SUBMIT YOUR FIRST SKILL →',

    tiers: {
      FREE: {
        features: [
          'Unlimited free listings',
          'Basic Sentinel L1 scan',
          'Standard review queue (24-48h)',
          'Community support',
        ],
      },
      PRO: {
        features: [
          'Unlimited listings + priority queue',
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
        period: 'free',
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
      'Los compradores no pagan fee de plataforma: 68,387 de 68,388 skills se instalan gratis. Los vendedores publican gratis y conservan el 80% de las ventas premium. Suscripciones opcionales de Sentinel (PRO $9.99/mes · ENTERPRISE $49.99/mes).',
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
      'Publicar es gratis e ilimitado — MarketNow nunca cobra tarifas de almacenamiento. Las suscripciones PRO y ENTERPRISE existen para auditoría prioritaria y visibilidad, no para almacenamiento.',

    addonsTitle: 'ADD-ONS',
    addonsSubtitle: 'Incluidos con las suscripciones Sentinel',

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
      'Ejemplo: una venta premium de $10 → Vendedor $8.00 (80%) · MarketNow $2.00 (20%); con referidor, $0.10 de la parte de MarketNow va al referidor.',

    affiliateTitle: 'CONVIÉRTETE EN AFILIADO',
    affiliateBody:
      'Los referidores ganan el 5% de la parte de MarketNow en cada venta premium. Los compradores nunca pagan extra — el 5% sale de la comisión del 20% de MarketNow. Consigue tu enlace desde el dashboard.',
    affiliateButton: 'OBTENER TU LINK DE AFILIADO →',

    faqTitle: 'PREGUNTAS FRECUENTES',
    faq: [
      {
        q: '¿Los compradores necesitan suscripción?',
        a: 'Correcto: todo es gratis. Las 68,388 skills están certificadas por Sentinel y son navegables e instalables gratis.',
      },
      {
        q: '¿Qué pasa si excedo el límite del plan free?',
        a: 'No lo alcanzarás: publicar es gratis e ilimitado para cada vendedor. Las suscripciones opcionales PRO/ENTERPRISE añaden escaneos prioritarios y visibilidad — nunca bloquean la publicación.',
      },
      {
        q: '¿Cómo recibo mis pagos como vendedor?',
        a: 'Los vendedores reciben el 80% de cada venta premium. MarketNow retiene el 20%. Los payouts se procesan mensualmente tras tu primera venta (dashboard del vendedor).',
      },
      {
        q: '¿Puedo publicar mi skill gratis?',
        a: 'Sí — publicar es gratis e ilimitado para cada vendedor, siempre. Los add-ons opcionales (posición destacada, badge verificado) vienen con las suscripciones PRO/ENTERPRISE; publicar nunca cuesta nada.',
      },
      {
        q: '¿Qué es el badge Verified Seller?',
        a: 'El badge ✓ Verified viene con la suscripción ENTERPRISE ($49.99/mo). Requiere verificación KYC (identificación oficial). Aumenta la confianza del comprador y las tasas de conversión significativamente.',
      },
      {
        q: '¿Cómo funciona el programa de afiliados?',
        a: 'Los referidores ganan el 5% de la parte de MarketNow en cada venta premium. Los compradores nunca pagan extra — el 5% sale de la comisión del 20% de MarketNow. Consigue tu enlace desde el dashboard.',
      },
      {
        q: '¿Los agentes pueden comprar skills programáticamente?',
        a: 'Los agentes descubren skills vía la API pública (/api/skills.json) y las instalan con npx -y marketnow-install-stack <slug>. El checkout en plataforma está planificado (commerce Gate C1); el uso con precio de vendor usa x402 (USDC en Base), facturado 100% al vendor.',
      },
      {
        q: '¿Ofrecen planes enterprise personalizados?',
        a: 'Sí. Para equipos que publican 100+ skills o con requisitos personalizados (despliegue on-prem, comisiones custom, SSO), contáctanos en info@alicelabs.site para una cotización personalizada.',
      },
    ],

    finalCtaTitle: '¿LISTO PARA EMPEZAR A VENDER?',
    finalCtaBody: 'Publica tu primera skill gratis — sin tarjeta de crédito. Publicar siempre es gratis.',
    finalCtaButton: 'PUBLICA TU PRIMERA SKILL →',

    tiers: {
      FREE: {
        features: [
          'Publicación ilimitada y gratuita',
          'Escaneo básico Sentinel L1',
          'Cola de revisión estándar (24-48h)',
          'Soporte comunitario',
        ],
      },
      PRO: {
        features: [
          'Publicación ilimitada + cola prioritaria',
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
      'Compradores não pagam taxa de plataforma: 68,387 de 68,388 skills instalam grátis. Vendedores publicam grátis e ficam com 80% das vendas premium. Assinaturas opcionais de Sentinel (PRO $9.99/mês · ENTERPRISE $49.99/mês).',
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
      'Publicar é grátis e ilimitado — o MarketNow nunca cobra taxas de armazenamento. As assinaturas PRO e ENTERPRISE existem para auditoria prioritária e visibilidade, não para armazenamento.',

    addonsTitle: 'ADD-ONS',
    addonsSubtitle: 'Incluídos com as assinaturas Sentinel',

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
      'Exemplo: uma venda premium de $10 → Vendedor $8.00 (80%) · MarketNow $2.00 (20%); com referenciador, $0.10 da parte do MarketNow vai para ele.',

    affiliateTitle: 'TORNE-SE UM AFILIADO',
    affiliateBody:
      'Referenciadores ganham 5% da parte do MarketNow em cada venda premium. Compradores nunca pagam extra — os 5% saem da comissão de 20% do MarketNow. Pegue seu link no dashboard.',
    affiliateButton: 'OBTER SEU LINK DE AFILIADO →',

    faqTitle: 'PERGUNTAS FREQUENTES',
    faq: [
      {
        q: 'Compradores precisam de assinatura?',
        a: 'Correto: tudo é grátis. As 68,388 skills são certificadas pelo Sentinel e navegáveis/instaláveis gratuitamente.',
      },
      {
        q: 'O que acontece se eu exceder o limite do plano free?',
        a: 'Você não o atingirá: publicar é grátis e ilimitado para cada vendedor. As assinaturas opcionais PRO/ENTERPRISE adicionam escaneamentos prioritários e visibilidade — nunca bloqueiam a publicação.',
      },
      {
        q: 'Como recebo meus pagamentos como vendedor?',
        a: 'Não há pagamentos: o MarketNow não cobra ninguém. Não existem payouts nem Stripe Connect.',
      },
      {
        q: 'Posso listar minha skill gratuitamente?',
        a: 'Sim — publicar é grátis e ilimitado para cada vendedor, para sempre. Os add-ons opcionais (posição destacada, badge verificado) vêm com as assinaturas PRO/ENTERPRISE; publicar nunca custa nada.',
      },
      {
        q: 'O que é o badge Verified Seller?',
        a: 'O badge ✓ Verified vem com a assinatura ENTERPRISE ($49.99/mo). Requer verificação KYC (documento de identidade). Aumenta significativamente a confiança do comprador e as taxas de conversão.',
      },
      {
        q: 'Como funciona o programa de afiliados?',
        a: 'Os referenciadores ganham 5% da parte do MarketNow em cada venda premium. Compradores nunca pagam extra — os 5% saem da comissão de 20% do MarketNow. Pegue seu link no dashboard.',
      },
      {
        q: 'Agentes podem comprar skills programaticamente?',
        a: 'Agentes descobrem skills via API pública (/api/skills.json) e as instalam com npx -y marketnow-install-stack <slug>. Checkout na plataforma está planejado (commerce Gate C1); uso com preço de vendor usa x402 (USDC na Base), faturado 100% ao vendor.',
      },
      {
        q: 'Vocês oferecem planos enterprise personalizados?',
        a: 'Sim. Para equipes que listam 100+ skills ou com requisitos personalizados (deploy on-prem, comissões customizadas, SSO), entre em contato em info@alicelabs.site para um orçamento personalizado.',
      },
    ],

    finalCtaTitle: 'PRONTO PARA COMEÇAR A VENDER?',
    finalCtaBody: 'Liste sua primeira skill grátis — sem cartão de crédito. Publicar é sempre grátis.',
    finalCtaButton: 'ENVIE SUA PRIMEIRA SKILL →',

    tiers: {
      FREE: {
        features: [
          'Publicação ilimitada e gratuita',
          'Escaneamento básico Sentinel L1',
          'Fila de revisão padrão (24-48h)',
          'Suporte da comunidade',
        ],
      },
      PRO: {
        features: [
          'Publicação ilimitada + fila prioritária',
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
      '买家无需支付平台费：68,388 个技能中 68,387 个免费安装。卖家免费上架并保留高级销售收入的 80%。可选 Sentinel 订阅（PRO $9.99/月 · ENTERPRISE $49.99/月）。',
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
      '上架免费且无上限 —— MarketNow 永不收取存储费。PRO 与 ENTERPRISE 订阅旨在提供优先审计与曝光，而非存储。',

    addonsTitle: '附加服务',
    addonsSubtitle: '随 Sentinel 订阅附带',

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
      '示例：一笔 $10 的高级技能销售 → 卖家 $8.00（80%）· MarketNow $2.00（20%）；若有推广者参与，MarketNow 份额中的 $0.10 归推广者。',

    affiliateTitle: '成为推广者',
    affiliateBody:
      '推广者可获得 MarketNow 在每笔高级技能销售中分成的一部分（5%）。买家无需多付 —— 5% 来自 MarketNow 的 20% 佣金。在控制台获取你的推广链接。',
    affiliateButton: '获取你的推广链接 →',

    faqTitle: '常见问题',
    faq: [
      {
        q: '买家需要订阅吗？',
        a: '正确：一切免费。所有 68,388 个技能都通过 Sentinel 认证，可免费浏览和安装。',
      },
      {
        q: '如果超出免费套餐限额会怎样？',
        a: '不会碰到上限：所有卖家均可免费无限量上架。可选的 PRO/ENTERPRISE 订阅提供优先扫描与曝光 —— 绝不会限制发布。',
      },
      {
        q: '作为卖家如何收款？',
        a: '卖家获得每笔高级技能销售的 80%，MarketNow 抽取 20%。首笔销售后可在卖家控制台按月结算。',
      },
      {
        q: '可以免费上架 skill 吗？',
        a: '可以 —— 所有卖家永远免费无限量上架。可选附加服务（精选展示、认证徽章）随 PRO/ENTERPRISE 订阅提供；发布本身永不收费。',
      },
      {
        q: 'Verified Seller 徽章是什么？',
        a: '✓ Verified 徽章随 ENTERPRISE 订阅（$49.99/月）提供。需通过 KYC 验证（政府签发 ID）。可显著提升买家信任和转化率。',
      },
      {
        q: '推广者计划如何运作？',
        a: '推广者获得 MarketNow 在每笔高级技能销售中 5% 的份额。买家无需多付 —— 5% 来自 MarketNow 的 20% 佣金。在控制台获取推广链接。',
      },
      {
        q: 'agent 可以通过 API 程序化购买 skill 吗？',
        a: '代理通过公开 API（/api/skills.json）发现技能，并用 npx -y marketnow-install-stack <slug> 安装。平台内结算正在规划中（commerce Gate C1）；供应商定价的使用走 x402（Base 上的 USDC），100% 由供应商侧结算。',
      },
      {
        q: '提供定制企业套餐吗？',
        a: '提供。对于上架 100+ skill 的团队或有定制需求（私有化部署、定制佣金率、SSO）的团队，请通过 info@alicelabs.site 联系我们获取定制报价。',
      },
    ],

    finalCtaTitle: '准备好开始销售了吗？',
    finalCtaBody: '免费上架你的第一个技能 —— 无需信用卡。上架永远免费。',
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
      "Les acheteurs ne paient aucun frais de plateforme : 68,387 skills sur 68,388 s\'installent gratuitement. Les vendeurs publient gratuitement et gardent 80% des ventes premium. Abonnements Sentinel optionnels (PRO $9.99/mois · ENTERPRISE $49.99/mois).",
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
      "La publication est gratuite et illimitée — MarketNow ne facture jamais de frais de stockage. Les abonnements PRO et ENTERPRISE existent pour l\'audit prioritaire et la visibilité, pas pour le stockage.",

    addonsTitle: 'ADD-ONS',
    addonsSubtitle: 'Inclus avec les abonnements Sentinel',

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
      'Exemple : une vente premium de $10 → Vendeur $8.00 (80%) · MarketNow $2.00 (20%) ; avec un parrain, $0.10 de la part de MarketNow lui revient.',

    affiliateTitle: 'DEVENEZ AFFILIÉ',
    affiliateBody:
      "Les parrains gagnent 5% de la part de MarketNow sur chaque vente premium. Les acheteurs ne paient jamais plus — les 5% sortent de la commission de 20% de MarketNow. Obtenez votre lien depuis le dashboard.",
    affiliateButton: 'OBTENIR VOTRE LIEN AFFILIÉ →',

    faqTitle: 'QUESTIONS FRÉQUENTES',
    faq: [
      {
        q: 'Les acheteurs ont-ils besoin d\'un abonnement ?',
        a: "Exact : tout est gratuit. Les 66 496 skills sont certifiées par Sentinel et navigables/installables gratuitement.",
      },
      {
        q: 'Que se passe-t-il si je dépasse la limite du plan gratuit ?',
        a: 'Vous ne l\'atteindrez pas : la publication est gratuite et illimitée pour chaque vendeur. Les abonnements optionnels PRO/ENTERPRISE ajoutent scans prioritaires et visibilité — ils ne bloquent jamais la publication.',
      },
      {
        q: 'Comment suis-je payé en tant que vendeur ?',
        a: 'Les vendeurs reçoivent 80% de chaque vente premium ; MarketNow retient 20%. Les paiements sont mensuels, depuis le dashboard vendeur après votre première vente.',
      },
      {
        q: 'Puis-je lister ma skill gratuitement ?',
        a: 'Oui — la publication est gratuite et illimitée pour chaque vendeur, pour toujours. Les add-ons optionnels (mise en avant, badge vérifié) sont inclus dans les abonnements PRO/ENTERPRISE ; publier ne coûte jamais rien.',
      },
      {
        q: "Qu'est-ce que le badge Verified Seller ?",
        a: 'Le badge ✓ Verified est inclus avec l\'abonnement ENTERPRISE ($49.99/mo). Nécessite une vérification KYC (pièce d\'identité officielle). Augmente significativement la confiance des acheteurs et les taux de conversion.',
      },
      {
        q: 'Comment fonctionne le programme d\'affiliation ?',
        a: 'Les parrains gagnent 5% de la part de MarketNow sur chaque vente premium. Les acheteurs ne paient jamais plus — les 5% sortent de la commission de 20% de MarketNow. Obtenez votre lien depuis le dashboard.',
      },
      {
        q: 'Les agents peuvent-ils acheter des skills programmatiquement ?',
        a: 'Les agents découvrent les skills via l\'API publique (/api/skills.json) et les installent avec npx -y marketnow-install-stack <slug>. Le checkout sur la plateforme est prévu (commerce Gate C1) ; l\'usage au prix du vendeur utilise x402 (USDC sur Base), facturé 100% côté vendeur.',
      },
      {
        q: 'Proposez-vous des plans enterprise personnalisés ?',
        a: 'Oui. Pour les équipes listant 100+ skills ou avec des exigences personnalisées (déploiement on-prem, taux de commission personnalisés, SSO), contactez-nous à info@alicelabs.site pour un devis personnalisé.',
      },
    ],

    finalCtaTitle: 'PRÊT À COMMENCER À VENDRE ?',
    finalCtaBody: 'Listez votre première skill gratuitement — sans carte bancaire. La publication est toujours gratuite.',
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
 * - Planes: todo es gratis (no hay planes pagos)
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
