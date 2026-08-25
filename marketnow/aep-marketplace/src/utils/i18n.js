/**
 * MarketNow — i18n Setup (Internationalization)
 * =============================================
 *
 * Basic i18n utility supporting English, Spanish, and Chinese.
 * Uses localStorage to persist language preference.
 *
 * For a full i18n solution, consider using react-i18next or react-intl.
 * This is a lightweight alternative that works on static sites.
 */

export const SUPPORTED_LANGUAGES = ['en', 'es', 'zh'];
export const DEFAULT_LANGUAGE = 'en';

export const LANGUAGE_LABELS = {
  en: 'English',
  es: 'Español',
  zh: '中文',
};

export const LANGUAGE_FLAGS = {
  en: '🇺🇸',
  es: '🇪🇸',
  zh: '🇨🇳',
};

// ─── Translation strings ────────────────────────────────────────────────────
const translations = {
  en: {
    // Navigation
    'nav.registry': 'REGISTRY',
    'nav.submit': 'SUBMIT SKILL',
    'nav.pricing': 'PRICING',
    'nav.dashboard': 'DASHBOARD',
    'nav.vault': 'MY VAULT',
    'nav.security': 'SECURITY',
    'nav.api': 'API',
    'nav.policies': 'POLICIES',
    'nav.signIn': 'SIGN IN',
    'nav.logout': 'LOGOUT',

    // Hero
    'hero.badge': 'MCP-COMPATIBLE · BUILT FOR AUTONOMOUS AGENTS',
    'hero.title': 'The Agent Skill Marketplace',
    'hero.subtitle': 'Discover, evaluate, and install {count} MCP skills through a public JSON API. Free to install for all agents. No payment required. Built for autonomous discovery and deployment..',
    'hero.cta.browse': 'BROWSE {count} SKILLS →',
    'hero.cta.sell': '+ SELL YOUR SKILLS (3 FREE)',
    'hero.cta.pricing': 'SEE PRICING',
    'hero.urgency': 'JOIN 5,000+ SKILLS ALREADY LISTED · LIST YOUR FIRST 3 FREE',
    'hero.stat.skills': 'VERIFIED SKILLS',
    'hero.stat.avgPrice': 'AVG PRICE (USD)',
    'hero.stat.minPrice': 'MINIMUM PRICE',
    'hero.stat.protocol': 'PROTOCOL',

    // Registry
    'registry.title': 'AGENT SKILL REGISTRY',
    'registry.subtitle': 'Browse, install, and deploy autonomous agent skills from the global MCP registry. Each skill is verified, versioned, and ready for production.',
    'registry.stat.total': 'Total Skills',
    'registry.stat.avg': 'Avg Price',
    'registry.stat.from': 'From',
    'registry.stat.protocol': 'Protocol',
    'registry.search': 'Search skills...',
    'registry.empty': 'No skills found',
    'registry.showing': 'Showing {count} of {total} skills',
    'registry.ai.title': 'AI SKILL MATCHER',
    'registry.ai.subtitle': 'Describe what you need in natural language — we\'ll find the best skills.',
    'registry.ai.placeholder': "e.g. 'I need to scrape a website and extract product prices'",
    'registry.ai.button': 'FIND SKILLS',

    // Skill Detail
    'skill.about': 'About',
    'skill.install': 'Install',
    'skill.features': 'Features',
    'skill.tags': 'Tags',
    'skill.routes': 'MCP Routes',
    'skill.by': 'By',
    'skill.version': 'Version',
    'skill.sentinel': 'Sentinel Score',
    'skill.license': 'License',
    'skill.oneTime': 'Free payment · Lifetime license',
    'skill.payCard': 'PAY ${price} WITH CARD →',
    'skill.payCrypto': 'PAY ${price} USDC',
    'skill.secureStripe': 'Secure payment via Stripe · Instant access',
    'skill.orCrypto': 'OR PAY WITH CRYPTO',
    'skill.reviews': 'REVIEWS',

    // Pricing
    'pricing.title': 'PRICING FOR SELLERS',
    'pricing.subtitle': 'List your MCP skills on the world\'s largest agent marketplace. Start free with 3 skills — upgrade when you\'re ready to scale.',
    'pricing.monthly': 'MONTHLY',
    'pricing.yearly': 'YEARLY',
    'pricing.free': 'START FREE',
    'pricing.upgrade': 'UPGRADE TO {tier}',
    'pricing.popular': 'MOST POPULAR',
    'pricing.commission': 'COMMISSION BREAKDOWN',
    'pricing.faq': 'FREQUENTLY ASKED QUESTIONS',

    // Submit
    'submit.title': 'SUBMIT A SKILL',
    'submit.subtitle': 'Sell your MCP server to 5,000+ agents and developers. Every submission is scanned by Sentinel L1 for security. MarketNow charges a 20% commission per sale.',
    'submit.step.scan': 'Scan',
    'submit.step.metadata': 'Metadata',
    'submit.step.submit': 'Submit',
    'submit.repoUrl': 'REPOSITORY URL',
    'submit.scanButton': 'RUN SENTINEL L1 SCAN',
    'submit.metadata': 'SKILL METADATA',
    'submit.review': 'REVIEW & SUBMIT',
    'submit.finalButton': 'SUBMIT SKILL FOR REVIEW',
  },

  es: {
    'nav.registry': 'REGISTRO',
    'nav.submit': 'SUBIR SKILL',
    'nav.pricing': 'PRECIOS',
    'nav.dashboard': 'PANEL',
    'nav.vault': 'MI BAÚL',
    'nav.security': 'SEGURIDAD',
    'nav.api': 'API',
    'nav.policies': 'POLÍTICAS',
    'nav.signIn': 'INICIAR SESIÓN',
    'nav.logout': 'CERRAR SESIÓN',

    'hero.badge': 'COMPATIBLE CON MCP · DISEÑADO PARA AGENTES AUTÓNOMOS',
    'hero.title': 'El Marketplace de Skills para Agentes',
    'hero.subtitle': 'Descubre, evalúa e instala {count} skills MCP a través de una API JSON pública. Gratis para instalar por todos los agentes. No se requiere pago. Diseñado para descubrimiento y despliegue autónomo..',
    'hero.cta.browse': 'EXPLORAR {count} SKILLS →',
    'hero.cta.sell': '+ VENDE TUS SKILLS (3 GRATIS)',
    'hero.cta.pricing': 'VER PRECIOS',
    'hero.urgency': 'ÚNETE A 5,000+ SKILLS YA LISTADAS · LISTA TUS PRIMERAS 3 GRATIS',
    'hero.stat.skills': 'SKILLS VERIFICADAS',
    'hero.stat.avgPrice': 'PRECIO PROMEDIO (USD)',
    'hero.stat.minPrice': 'PRECIO MÍNIMO',
    'hero.stat.protocol': 'PROTOCOLO',

    'registry.title': 'REGISTRO DE SKILLS PARA AGENTES',
    'registry.subtitle': 'Explora, instala y despliega skills para agentes autónomos del registro global MCP. Cada skill está verificada, versionada y lista para producción.',
    'registry.stat.total': 'Skills Totales',
    'registry.stat.avg': 'Precio Promedio',
    'registry.stat.from': 'Desde',
    'registry.stat.protocol': 'Protocolo',
    'registry.search': 'Buscar skills...',
    'registry.empty': 'No se encontraron skills',
    'registry.showing': 'Mostrando {count} de {total} skills',
    'registry.ai.title': 'BUSCADOR INTELIGENTE DE SKILLS',
    'registry.ai.subtitle': 'Describe lo que necesitas en lenguaje natural — encontraremos las mejores skills.',
    'registry.ai.placeholder': "ej. 'Necesito scrapear un sitio web y extraer precios de productos'",
    'registry.ai.button': 'BUSCAR SKILLS',

    'skill.about': 'Acerca de',
    'skill.install': 'Instalar',
    'skill.features': 'Características',
    'skill.tags': 'Etiquetas',
    'skill.routes': 'Rutas MCP',
    'skill.by': 'Por',
    'skill.version': 'Versión',
    'skill.sentinel': 'Puntuación Sentinel',
    'skill.license': 'Licencia',
    'skill.oneTime': 'Pago único · Licencia de por vida',
    'skill.payCard': 'PAGAR ${price} CON TARJETA →',
    'skill.payCrypto': 'PAGAR ${price} USDC',
    'skill.secureStripe': 'Pago seguro vía Stripe · Acceso instantáneo',
    'skill.orCrypto': 'O PAGA CON CRIPTO',
    'skill.reviews': 'RESEÑAS',

    'pricing.title': 'PRECIOS PARA VENDEDORES',
    'pricing.subtitle': 'Lista tus skills MCP en el marketplace de agentes más grande del mundo. Empieza gratis con 3 skills — actualiza cuando estés listo para escalar.',
    'pricing.monthly': 'MENSUAL',
    'pricing.yearly': 'ANUAL',
    'pricing.free': 'EMPEZAR GRATIS',
    'pricing.upgrade': 'MEJORAR A {tier}',
    'pricing.popular': 'MÁS POPULAR',
    'pricing.commission': 'DESGLOSE DE COMISIÓN',
    'pricing.faq': 'PREGUNTAS FRECUENTES',

    'submit.title': 'SUBIR UNA SKILL',
    'submit.subtitle': 'Vende tu servidor MCP a 5,000+ agentes y desarrolladores. Cada envío es escaneado por Sentinel L1 para seguridad. MarketNow cobra una comisión del 20% por venta.',
    'submit.step.scan': 'Escanear',
    'submit.step.metadata': 'Metadatos',
    'submit.step.submit': 'Enviar',
    'submit.repoUrl': 'URL DEL REPOSITORIO',
    'submit.scanButton': 'EJECUTAR ESCANEO SENTINEL L1',
    'submit.metadata': 'METADATOS DE LA SKILL',
    'submit.review': 'REVISAR Y ENVIAR',
    'submit.finalButton': 'ENVIAR SKILL PARA REVISIÓN',
  },

  zh: {
    'nav.registry': '技能库',
    'nav.submit': '提交技能',
    'nav.pricing': '价格',
    'nav.dashboard': '面板',
    'nav.vault': '我的库',
    'nav.security': '安全',
    'nav.api': 'API',
    'nav.policies': '政策',
    'nav.signIn': '登录',
    'nav.logout': '退出',

    'hero.badge': 'MCP 兼容 · 为自主代理而建',
    'hero.title': '代理技能市场',
    'hero.subtitle': '通过公共 JSON API 发现, 评估和安装 {count} MCP 技能. 所有代理均可免费安装。无需付款。专为自主发现和部署而设计..',
    'hero.cta.browse': '浏览 {count} 个技能 →',
    'hero.cta.sell': '+ 出售你的技能 (3 个免费)',
    'hero.cta.pricing': '查看价格',
    'hero.urgency': '加入已列出的 5,000+ 技能 · 免费列出你的前 3 个',
    'hero.stat.skills': '已验证技能',
    'hero.stat.avgPrice': '平均价格 (USD)',
    'hero.stat.minPrice': '最低价格',
    'hero.stat.protocol': '协议',

    'registry.title': '代理技能注册表',
    'registry.subtitle': '从全球 MCP 注册表浏览, 安装和部署自主代理技能. 每个技能都经过验证, 版本化, 并准备好用于生产.',
    'registry.stat.total': '技能总数',
    'registry.stat.avg': '平均价格',
    'registry.stat.from': '起价',
    'registry.stat.protocol': '协议',
    'registry.search': '搜索技能...',
    'registry.empty': '未找到技能',
    'registry.showing': '显示 {count} / {total} 个技能',
    'registry.ai.title': 'AI 技能匹配器',
    'registry.ai.subtitle': '用自然语言描述你的需求 — 我们会找到最合适的技能.',
    'registry.ai.placeholder': "例如 '我需要抓取一个网站并提取产品价格'",
    'registry.ai.button': '查找技能',

    'skill.about': '关于',
    'skill.install': '安装',
    'skill.features': '功能',
    'skill.tags': '标签',
    'skill.routes': 'MCP 路由',
    'skill.by': '作者',
    'skill.version': '版本',
    'skill.sentinel': 'Sentinel 评分',
    'skill.license': '许可证',
    'skill.oneTime': '一次性付款 · 终身许可',
    'skill.payCard': '用卡支付 ${price} →',
    'skill.payCrypto': '支付 ${price} USDC',
    'skill.secureStripe': '通过 Stripe 安全支付 · 即时访问',
    'skill.orCrypto': '或用加密货币支付',
    'skill.reviews': '评论',

    'pricing.title': '卖家价格',
    'pricing.subtitle': '在全球最大的代理市场上列出你的 MCP 技能. 免费 3 个技能开始 — 准备好扩展时升级.',
    'pricing.monthly': '每月',
    'pricing.yearly': '每年',
    'pricing.free': '免费开始',
    'pricing.upgrade': '升级到 {tier}',
    'pricing.popular': '最受欢迎',
    'pricing.commission': '佣金明细',
    'pricing.faq': '常见问题',

    'submit.title': '提交技能',
    'submit.subtitle': '向 5,000+ 代理和开发者出售你的 MCP 服务器. 每个提交都由 Sentinel L1 进行安全扫描. MarketNow 每笔销售收取 20% 佣金.',
    'submit.step.scan': '扫描',
    'submit.step.metadata': '元数据',
    'submit.step.submit': '提交',
    'submit.repoUrl': '仓库 URL',
    'submit.scanButton': '运行 SENTINEL L1 扫描',
    'submit.metadata': '技能元数据',
    'submit.review': '审查并提交',
    'submit.finalButton': '提交技能以供审查',
  },
};

/**
 * Get the current language from localStorage or browser default.
 */
export function getCurrentLanguage() {
  try {
    const stored = localStorage.getItem('mn_lang');
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored;
  } catch {}
  // Check browser language
  const browserLang = (navigator.language || 'en').slice(0, 2);
  if (SUPPORTED_LANGUAGES.includes(browserLang)) return browserLang;
  return DEFAULT_LANGUAGE;
}

/**
 * Set the current language.
 */
export function setLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) return;
  try {
    localStorage.setItem('mn_lang', lang);
  } catch {}
  // Reload to apply translations
  window.location.reload();
}

/**
 * Translate a key with optional interpolation.
 * @param {string} key - Translation key (e.g. 'hero.title')
 * @param {object} params - Interpolation params (e.g. {count: 5054})
 * @returns {string} - Translated string
 */
export function t(key, params = {}) {
  const lang = getCurrentLanguage();
  const dict = translations[lang] || translations[DEFAULT_LANGUAGE];
  let str = dict[key] || translations[DEFAULT_LANGUAGE][key] || key;

  // Interpolate params: {count} → params.count
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return str;
}
