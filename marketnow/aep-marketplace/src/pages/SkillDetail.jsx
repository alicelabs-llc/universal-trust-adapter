import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getSkill } from '../data/skills';
import { hasMetaMask, connectWallet, cryptoCheckout } from '../utils/crypto';
import { checkoutSkill } from '../utils/stripe';
import { getCurrentRef } from '../utils/affiliate';
import Reviews from '../components/Reviews';
import { useLang } from '../context/LanguageContext.jsx';

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT — all UI strings in 5 languages (en, es, pt, zh, fr)
// Brand / technical terms preserved untranslated per task rules:
//   MarketNow, AliceLabs, MetaMask, USDC, Base, MCP, Sentinel, Stripe,
//   sentinel_score, Open Source, npx, POST /api/agent-purchase, txHash.
// ═══════════════════════════════════════════════════════════════════════════
const CONTENT = {
  en: {
    // Loading + error states
    loadingSkill: 'Loading skill...',
    skillNotFound: 'Skill not found',
    backToRegistry: '← BACK TO REGISTRY',
    // Sidebar labels
    oneTimeLifetime: 'Free payment · Lifetime license',
    version: 'Version',
    sentinelScore: 'Sentinel Score',
    license: 'License',
    openSource: 'Open Source',
    // Section headings (uppercase labels)
    about: 'About',
    install: 'Install',
    systemPrompt: 'System Prompt',
    features: 'Features',
    tags: 'Tags',
    mcpRoutes: 'MCP Routes',
    by: 'By',
    // Install + prompt UI
    copy: '📋 COPY',
    copied: '✅ COPIED',
    copyPrompt: '📋 COPY PROMPT',
    unlocked: '✓ UNLOCKED',
    previewPurchase: '🔒 PREVIEW — PURCHASE TO UNLOCK',
    charsLocked: '🔒 +{n} characters locked',
    previewNote: '⚠️ Preview shows first 200 characters only. Full prompt ({total} chars) unlocked after purchase.',
    availableIn: '🌐 Available in {count} languages ·',
    showing: 'Showing: {lang}',
    // Purchase results + free
    purchaseVerified: 'Purchase Verified On-Chain!',
    order: 'Order:',
    tx: 'TX:',
    token: 'Token:',
    copyInstallCommand: '📋 COPY INSTALL COMMAND',
    copiedExclaim: '✅ COPIED!',
    freeOpenSourceNpx: 'Free · Open Source · Install with npx',
    // Agent payment block
    agentPayment: '🤖 AGENT PAYMENT (USDC)',
    noHumanNeeded: 'No human needed',
    agentStep1: '1. Send {price} USDC to ',
    agentStep2: ' on Base',
    agentStep3: '2. POST /api/agent-purchase with txHash',
    agentStep4: '3. Get license + system prompt instantly',
    fullAgentFlow: 'Full agent flow →',
    // Stripe
    payWithCard: '💳 PAY ${price} WITH CARD →',
    securePaymentStripe: 'Secure payment via Stripe · Instant access',
    orPayWithCrypto: 'OR PAY WITH CRYPTO',
    connectMetamask: '🦊 CONNECT METAMASK',
    payUsdc: 'PAY ${price} USDC',
    processing: 'PROCESSING...',
    usdcBaseVerified: 'USDC · Base Network · On-chain verified',
    // Purchase steps
    stepConnecting: 'Connecting MetaMask...',
    stepSending: 'Sending ${price} USDC to MarketNow...',
    stepRedirecting: 'Redirecting to Stripe...',
    // Errors
    errInstallMetamaskConnect: 'Install MetaMask first to pay with USDC on Base',
    errInstallMetamaskPay: 'Install MetaMask to pay with USDC on Base',
    errConnectMetamask: 'Error connecting MetaMask',
    errFreeNoPay: 'This skill is free — no payment required',
    errCancelled: 'Transaction cancelled by user',
    errPayment: 'Payment error',
    // Promote skill + badge
    promoteTitle: 'Promote this skill',
    badgeAlt: 'MarketNow Badge',
    copyBadgeMd: '📄 COPY BADGE MD',
    copiedMarkdown: '✅ COPIED MARKDOWN',
  },
  es: {
    loadingSkill: 'Cargando skill...',
    skillNotFound: 'Skill no encontrada',
    backToRegistry: '← VOLVER AL REGISTRO',
    oneTimeLifetime: 'Pago único · Licencia de por vida',
    version: 'Versión',
    sentinelScore: 'Sentinel Score',
    license: 'Licencia',
    openSource: 'Open Source',
    about: 'Acerca de',
    install: 'Instalar',
    systemPrompt: 'System Prompt',
    features: 'Características',
    tags: 'Etiquetas',
    mcpRoutes: 'Rutas MCP',
    by: 'Por',
    copy: '📋 COPIAR',
    copied: '✅ COPIADO',
    copyPrompt: '📋 COPIAR PROMPT',
    unlocked: '✓ DESBLOQUEADO',
    previewPurchase: '🔒 VISTA PREVIA — COMPRA PARA DESBLOQUEAR',
    charsLocked: '🔒 +{n} caracteres bloqueados',
    previewNote: '⚠️ La vista previa muestra solo los primeros 200 caracteres. El prompt completo ({total} caracteres) se desbloquea tras la compra.',
    availableIn: '🌐 Disponible en {count} idiomas ·',
    showing: 'Mostrando: {lang}',
    purchaseVerified: '¡Compra verificada on-chain!',
    order: 'Pedido:',
    tx: 'TX:',
    token: 'Token:',
    copyInstallCommand: '📋 COPIAR COMANDO DE INSTALACIÓN',
    copiedExclaim: '✅ ¡COPIADO!',
    freeOpenSourceNpx: 'Gratis · Open Source · Instalar con npx',
    agentPayment: '🤖 PAGO PARA AGENTES (USDC)',
    noHumanNeeded: 'Sin intervención humana',
    agentStep1: '1. Envía {price} USDC a ',
    agentStep2: ' en Base',
    agentStep3: '2. POST /api/agent-purchase con txHash',
    agentStep4: '3. Obtén licencia + system prompt al instante',
    fullAgentFlow: 'Flujo completo del agente →',
    payWithCard: '💳 PAGAR ${price} CON TARJETA →',
    securePaymentStripe: 'Pago seguro vía Stripe · Acceso instantáneo',
    orPayWithCrypto: 'O PAGA CON CRIPTO',
    connectMetamask: '🦊 CONECTAR METAMASK',
    payUsdc: 'PAGAR ${price} USDC',
    processing: 'PROCESANDO...',
    usdcBaseVerified: 'USDC · Red Base · Verificado on-chain',
    stepConnecting: 'Conectando MetaMask...',
    stepSending: 'Enviando ${price} USDC a MarketNow...',
    stepRedirecting: 'Redirigiendo a Stripe...',
    errInstallMetamaskConnect: 'Instala MetaMask primero para pagar con USDC en Base',
    errInstallMetamaskPay: 'Instala MetaMask para pagar con USDC en Base',
    errConnectMetamask: 'Error al conectar MetaMask',
    errFreeNoPay: 'Esta skill es gratuita — no se requiere pago',
    errCancelled: 'Transacción cancelada por el usuario',
    errPayment: 'Error de pago',
    promoteTitle: 'Promociona esta skill',
    badgeAlt: 'Insignia de MarketNow',
    copyBadgeMd: '📄 COPIAR MD DE INSIGNIA',
    copiedMarkdown: '✅ MD COPIADO',
  },
  pt: {
    loadingSkill: 'Carregando skill...',
    skillNotFound: 'Skill não encontrada',
    backToRegistry: '← VOLTAR AO REGISTRO',
    oneTimeLifetime: 'Pagamento único · Licença vitalícia',
    version: 'Versão',
    sentinelScore: 'Sentinel Score',
    license: 'Licença',
    openSource: 'Open Source',
    about: 'Sobre',
    install: 'Instalar',
    systemPrompt: 'System Prompt',
    features: 'Recursos',
    tags: 'Tags',
    mcpRoutes: 'Rotas MCP',
    by: 'Por',
    copy: '📋 COPIAR',
    copied: '✅ COPIADO',
    copyPrompt: '📋 COPIAR PROMPT',
    unlocked: '✓ DESBLOQUEADO',
    previewPurchase: '🔒 PRÉVIA — COMPRE PARA DESBLOQUEAR',
    charsLocked: '🔒 +{n} caracteres bloqueados',
    previewNote: '⚠️ A prévia mostra apenas os primeiros 200 caracteres. O prompt completo ({total} caracteres) é desbloqueado após a compra.',
    availableIn: '🌐 Disponível em {count} idiomas ·',
    showing: 'Mostrando: {lang}',
    purchaseVerified: 'Compra verificada on-chain!',
    order: 'Pedido:',
    tx: 'TX:',
    token: 'Token:',
    copyInstallCommand: '📋 COPIAR COMANDO DE INSTALAÇÃO',
    copiedExclaim: '✅ COPIADO!',
    freeOpenSourceNpx: 'Grátis · Open Source · Instalar com npx',
    agentPayment: '🤖 PAGAMENTO PARA AGENTES (USDC)',
    noHumanNeeded: 'Sem intervenção humana',
    agentStep1: '1. Envie {price} USDC para ',
    agentStep2: ' na Base',
    agentStep3: '2. POST /api/agent-purchase com txHash',
    agentStep4: '3. Receba licença + system prompt instantaneamente',
    fullAgentFlow: 'Fluxo completo do agente →',
    payWithCard: '💳 PAGAR ${price} COM CARTÃO →',
    securePaymentStripe: 'Pagamento seguro via Stripe · Acesso instantâneo',
    orPayWithCrypto: 'OU PAGUE COM CRIPTO',
    connectMetamask: '🦊 CONECTAR METAMASK',
    payUsdc: 'PAGAR ${price} USDC',
    processing: 'PROCESSANDO...',
    usdcBaseVerified: 'USDC · Rede Base · Verificado on-chain',
    stepConnecting: 'Conectando MetaMask...',
    stepSending: 'Enviando ${price} USDC para MarketNow...',
    stepRedirecting: 'Redirecionando para Stripe...',
    errInstallMetamaskConnect: 'Instale MetaMask primeiro para pagar com USDC na Base',
    errInstallMetamaskPay: 'Instale MetaMask para pagar com USDC na Base',
    errConnectMetamask: 'Erro ao conectar MetaMask',
    errFreeNoPay: 'Esta skill é gratuita — nenhum pagamento necessário',
    errCancelled: 'Transação cancelada pelo usuário',
    errPayment: 'Erro de pagamento',
    promoteTitle: 'Divulgue esta skill',
    badgeAlt: 'Selo do MarketNow',
    copyBadgeMd: '📄 COPIAR MD DO SELO',
    copiedMarkdown: '✅ MD COPIADO',
  },
  zh: {
    loadingSkill: '正在加载 skill...',
    skillNotFound: '未找到 skill',
    backToRegistry: '← 返回注册表',
    oneTimeLifetime: '一次性付款 · 终身授权',
    version: '版本',
    sentinelScore: 'Sentinel Score',
    license: '授权',
    openSource: 'Open Source',
    about: '关于',
    install: '安装',
    systemPrompt: 'System Prompt',
    features: '功能',
    tags: '标签',
    mcpRoutes: 'MCP 路由',
    by: '作者：',
    copy: '📋 复制',
    copied: '✅ 已复制',
    copyPrompt: '📋 复制 PROMPT',
    unlocked: '✓ 已解锁',
    previewPurchase: '🔒 预览 — 购买后解锁',
    charsLocked: '🔒 还有 {n} 字符已锁定',
    previewNote: '⚠️ 预览仅显示前 200 个字符。完整 prompt（{total} 字符）将在购买后解锁。',
    availableIn: '🌐 共有 {count} 种语言版本 ·',
    showing: '当前显示：{lang}',
    purchaseVerified: '购买已在链上验证！',
    order: '订单：',
    tx: 'TX：',
    token: 'Token：',
    copyInstallCommand: '📋 复制安装命令',
    copiedExclaim: '✅ 已复制！',
    freeOpenSourceNpx: '免费 · Open Source · 使用 npx 安装',
    agentPayment: '🤖 代理付款（USDC）',
    noHumanNeeded: '无需人工介入',
    agentStep1: '1. 向 ',
    agentStep2: ' 发送 {price} USDC（Base 网络）',
    agentStep3: '2. 使用 txHash 调用 POST /api/agent-purchase',
    agentStep4: '3. 立即获取 license 和 system prompt',
    fullAgentFlow: '查看完整代理流程 →',
    payWithCard: '💳 用银行卡支付 ${price} →',
    securePaymentStripe: '通过 Stripe 安全支付 · 立即访问',
    orPayWithCrypto: '或使用加密货币支付',
    connectMetamask: '🦊 连接 METAMASK',
    payUsdc: '支付 ${price} USDC',
    processing: '处理中...',
    usdcBaseVerified: 'USDC · Base 网络 · 链上验证',
    stepConnecting: '正在连接 MetaMask...',
    stepSending: '正在向 MarketNow 发送 ${price} USDC...',
    stepRedirecting: '正在跳转至 Stripe...',
    errInstallMetamaskConnect: '请先安装 MetaMask 才能使用 Base 上的 USDC 支付',
    errInstallMetamaskPay: '请安装 MetaMask 才能使用 Base 上的 USDC 支付',
    errConnectMetamask: '连接 MetaMask 时出错',
    errFreeNoPay: '此 skill 为免费 — 无需付款',
    errCancelled: '用户已取消交易',
    errPayment: '支付错误',
    promoteTitle: '推广此 skill',
    badgeAlt: 'MarketNow 徽章',
    copyBadgeMd: '📄 复制徽章 MD',
    copiedMarkdown: '✅ MD 已复制',
  },
  fr: {
    loadingSkill: 'Chargement de la skill...',
    skillNotFound: 'Skill introuvable',
    backToRegistry: '← RETOUR AU REGISTRE',
    oneTimeLifetime: 'Paiement unique · Licence à vie',
    version: 'Version',
    sentinelScore: 'Sentinel Score',
    license: 'Licence',
    openSource: 'Open Source',
    about: 'À propos',
    install: 'Installer',
    systemPrompt: 'System Prompt',
    features: 'Fonctionnalités',
    tags: 'Tags',
    mcpRoutes: 'Routes MCP',
    by: 'Par',
    copy: '📋 COPIER',
    copied: '✅ COPIÉ',
    copyPrompt: '📋 COPIER LE PROMPT',
    unlocked: '✓ DÉVERROUILLÉ',
    previewPurchase: '🔒 APERÇU — ACHETEZ POUR DÉVERROUILLER',
    charsLocked: '🔒 +{n} caractères verrouillés',
    previewNote: "⚠️ L'aperçu n'affiche que les 200 premiers caractères. Le prompt complet ({total} caractères) est déverrouillé après l'achat.",
    availableIn: '🌐 Disponible en {count} langues ·',
    showing: 'Affiché : {lang}',
    purchaseVerified: 'Achat vérifié on-chain !',
    order: 'Commande :',
    tx: 'TX :',
    token: 'Token :',
    copyInstallCommand: '📋 COPIER LA COMMANDE D\'INSTALLATION',
    copiedExclaim: '✅ COPIÉ !',
    freeOpenSourceNpx: 'Gratuit · Open Source · Installer avec npx',
    agentPayment: '🤖 PAIEMENT AGENT (USDC)',
    noHumanNeeded: 'Aucune intervention humaine',
    agentStep1: '1. Envoyez {price} USDC à ',
    agentStep2: ' sur Base',
    agentStep3: '2. POST /api/agent-purchase avec txHash',
    agentStep4: '3. Recevez la licence + system prompt instantanément',
    fullAgentFlow: 'Flux agent complet →',
    payWithCard: '💳 PAYER ${price} PAR CARTE →',
    securePaymentStripe: 'Paiement sécurisé via Stripe · Accès instantané',
    orPayWithCrypto: 'OU PAYEZ EN CRYPTO',
    connectMetamask: '🦊 CONNECTER METAMASK',
    payUsdc: 'PAYER ${price} USDC',
    processing: 'TRAITEMENT...',
    usdcBaseVerified: 'USDC · Réseau Base · Vérifié on-chain',
    stepConnecting: 'Connexion à MetaMask...',
    stepSending: 'Envoi de ${price} USDC à MarketNow...',
    stepRedirecting: 'Redirection vers Stripe...',
    errInstallMetamaskConnect: 'Installez MetaMask pour payer en USDC sur Base',
    errInstallMetamaskPay: 'Installez MetaMask pour payer en USDC sur Base',
    errConnectMetamask: 'Erreur de connexion à MetaMask',
    errFreeNoPay: 'Cette skill est gratuite — aucun paiement requis',
    errCancelled: 'Transaction annulée par l\'utilisateur',
    errPayment: 'Erreur de paiement',
    promoteTitle: 'Promouvoir cette skill',
    badgeAlt: 'Badge MarketNow',
    copyBadgeMd: '📄 COPIER LE MD DU BADGE',
    copiedMarkdown: '✅ MD COPIÉ',
  },
};

// Tiny template helper: replaces {var} placeholders
function fmt(str, vars) {
  if (!vars) return str;
  let out = str;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return out;
}

/**
 * Inject a <script type="application/ld+json"> tag with Product schema
 * for SEO. Also updates document.title and meta description dynamically.
 */
function injectSkillSeo(skill) {
  if (!skill) return;

  // Update document title
  document.title = `${skill.name} — $${skill.price.toFixed(2)} · MarketNow`;

  // Update meta description
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.name = 'description';
    document.head.appendChild(metaDesc);
  }
  metaDesc.content = `${skill.name}: ${skill.description?.slice(0, 140) || 'MCP server'} — $${skill.price.toFixed(2)} on MarketNow`;

  // Update OG tags
  const ogUpdates = {
    'og:title': `${skill.name} — $${skill.price.toFixed(2)} · MarketNow`,
    'og:description': skill.description?.slice(0, 200) || '',
    'og:type': 'product',
    'og:url': `https://marketnow.site/skill/${skill.id}`,
    'product:price:amount': skill.price.toFixed(2),
    'product:price:currency': 'USD',
  };
  for (const [k, v] of Object.entries(ogUpdates)) {
    let tag = document.querySelector(`meta[property="${k}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('property', k);
      document.head.appendChild(tag);
    }
    tag.content = v;
  }

  // Inject JSON-LD Product schema
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    'name': skill.name,
    'description': skill.description,
    'category': skill.category,
    'brand': { '@type': 'Brand', 'name': skill.author || 'Open Source Community' },
    'offers': {
      '@type': 'Offer',
      'price': skill.price.toFixed(2),
      'priceCurrency': 'USD',
      'availability': 'https://schema.org/InStock',
      'url': `https://marketnow.site/skill/${skill.id}`,
    },
    'aggregateRating': {
      '@type': 'AggregateRating',
      'ratingValue': String(skill.sentinel_score || 6),
      'bestRating': '10',
      'ratingCount': '1',
    },
  };

  let scriptTag = document.getElementById('skill-jsonld');
  if (!scriptTag) {
    scriptTag = document.createElement('script');
    scriptTag.id = 'skill-jsonld';
    scriptTag.type = 'application/ld+json';
    document.head.appendChild(scriptTag);
  }
  scriptTag.textContent = JSON.stringify(jsonLd);

  // Cleanup when component unmounts
  return () => {
    document.title = 'MarketNow — Agent Skill Marketplace';
    const cleanupTag = document.getElementById('skill-jsonld');
    if (cleanupTag) cleanupTag.remove();
  };
}

// Helper to normalize a skill to always have safe default fields
function normalizeSkill(s) {
  if (!s) return null;
  return {
    ...s,
    name: s.name || s.slug || s.id || 'Unknown Skill',
    icon: s.icon || '🧩',
    category: s.category || 'Developer Tools',
    version: s.version || '1.0.0',
    author: s.author && s.author !== 'AEP Community' ? s.author : 'Open Source Community',
    price: typeof s.price === 'number' ? s.price : parseFloat(s.price) || 0,
    features: Array.isArray(s.features) && s.features.length > 0
      ? s.features
      : (s.tags || []).slice(0, 4),
    routes: Array.isArray(s.routes) && s.routes.length > 0 ? s.routes : [],
    reviews: Array.isArray(s.reviews) && s.reviews.length > 0 ? s.reviews : [],
    description: s.description || `${s.name || s.id} — MCP server available on MarketNow.`,
    longDescription: s.longDescription || s.description || `${s.name || s.id} is a verified MCP server available on MarketNow. Connect it to Claude, Cursor, or any MCP-compatible agent runtime.`,
    tagline: s.tagline || `Real MCP server · ${s.category || 'Developer Tools'} · Open Source`,
    slug: s.slug || s.id,
    sentinel_score: s.sentinel_score ?? 6,
    install: s.install || `npx -y marketnow-install-stack ${s.slug || s.id}`,
    verified: s.verified ?? true,
    translations: s.translations || null,
    language: s.language || 'en',
  };
}

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];

export default function SkillDetail() {
  const { lang } = useLang();
  const c = CONTENT[lang] || CONTENT.en;

  const { id } = useParams();
  const navigate = useNavigate();
  const [skill, setSkill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState(null);
  const [purchased, setPurchased] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [walletAddr, setWalletAddr] = useState(null);
  const [purchaseStep, setPurchaseStep] = useState('');
  const [selectedLang, setSelectedLang] = useState('en');
  // Sentinel certificate state — fetched from /api/audit-skill?certificate=1
  const [certificate, setCertificate] = useState(null);
  const [certLoading, setCertLoading] = useState(false);

  const handleCopyBadge = () => {
    const md = `[![Available on MarketNow](https://marketnow.site/badges/available-on.svg)](https://marketnow.site/skill/${skill?.slug || id})`;
    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyInstall = () => {
    navigator.clipboard.writeText(skill.install);
    setCopiedInstall(true);
    setTimeout(() => setCopiedInstall(false), 2000);
  };

  useEffect(() => {
    loadSkill();
  }, [id]);

  // Fetch Sentinel certificate when skill loads
  useEffect(() => {
    if (skill?.id) {
      loadCertificate(skill.id);
    }
  }, [skill?.id]);

  // Inject SEO + JSON-LD when skill loads
  useEffect(() => {
    if (skill) {
      const cleanup = injectSkillSeo(skill);
      return cleanup;
    }
  }, [skill]);

  const loadCertificate = async (skillId) => {
    setCertLoading(true);
    try {
      const res = await fetch(`/api/audit-skill?certificate=1&skillId=${encodeURIComponent(skillId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'certified' && data.certificate) {
          setCertificate(data.certificate);
        } else {
          setCertificate(null);
        }
      } else {
        setCertificate(null);
      }
    } catch {
      setCertificate(null);
    } finally {
      setCertLoading(false);
    }
  };

  const loadSkill = async () => {
    try {
      setLoading(true);
      const found = await getSkill(id);
      if (found) {
        setSkill(normalizeSkill(found));
      } else {
        setError(c.skillNotFound);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectWallet = async () => {
    try {
      if (!hasMetaMask()) {
        window.open('https://metamask.io/download/', '_blank');
        setError(c.errInstallMetamaskConnect);
        return;
      }
      const addr = await connectWallet();
      setWalletAddr(addr);
      setError('');
    } catch (err) {
      setError(err.message || c.errConnectMetamask);
    }
  };

  const handlePurchase = async () => {
    if (!hasMetaMask()) {
      window.open('https://metamask.io/download/', '_blank');
      setError(c.errInstallMetamaskPay);
      return;
    }

    const price = parseFloat(skill.price);
    if (!price || price <= 0) {
      setError(c.errFreeNoPay);
      return;
    }

    setPurchasing(true);
    setError('');
    try {
      setPurchaseStep(c.stepConnecting);
      const addr = await connectWallet();
      setWalletAddr(addr);

      setPurchaseStep(fmt(c.stepSending, { price: price.toFixed(2) }));
      const result = await cryptoCheckout(skill.slug || skill.id, price);

      setPurchaseResult({
        ...result,
        purchase: { license: result.access_token || result.order_id },
      });
      setPurchased(true); // Unlock the full system prompt
      setPurchaseStep('');
    } catch (err) {
      if (err.code === 4001) {
        setError(c.errCancelled);
      } else {
        setError(err.message || c.errPayment);
      }
      setPurchaseStep('');
    } finally {
      setPurchasing(false);
    }
  };

  // ─── Stripe checkout (credit card) ───────────────────────────────────────
  const handleStripeCheckout = async () => {
    setPurchasing(true);
    setError('');
    setPurchaseStep(c.stepRedirecting);
    try {
      const affiliateCode = getCurrentRef();
      await checkoutSkill(skill.id, affiliateCode);
      // The browser will redirect to Stripe Checkout
    } catch (err) {
      setError(err.message || c.errPayment);
      setPurchaseStep('');
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-[#00F299] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-zinc-500 font-mono text-sm">{c.loadingSkill}</p>
        </div>
      </div>
    );
  }

  if (error && !skill) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center premium-card p-8">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={() => navigate('/registry')} className="px-6 py-3 bg-[#00F299]/10 border border-[#00F299]/30 rounded-xl text-[#00F299] text-sm">
            {c.backToRegistry}
          </button>
        </div>
      </div>
    );
  }

  if (!skill) return null;

  const isFree = !skill.price || skill.price === 0;
  // Free skills: prompt is unlocked by default
  const promptUnlocked = purchased || isFree;

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-[1440px] mx-auto px-6">
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => navigate('/registry')}
          className="mb-8 text-zinc-400 hover:text-white text-sm transition-colors flex items-center gap-2"
        >
          {c.backToRegistry}
        </motion.button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2"
          >
            <div className="premium-card p-8">
              <div className="flex items-start gap-6 mb-6">
                <div className="text-6xl shrink-0">{skill.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="px-3 py-1 rounded-lg bg-white/5 text-[11px] font-mono text-zinc-400 border border-white/5">
                      {skill.category.toUpperCase()}
                    </span>
                    <span className="text-zinc-600 text-xs font-mono">v{skill.version}</span>
                    {skill.verified && (
                      <span className="px-2 py-0.5 rounded bg-[#00F299]/10 text-[#00F299] text-[10px] font-mono border border-[#00F299]/20">
                        ✓ VERIFIED
                      </span>
                    )}
                    {skill.sentinel_score >= 8 && (
                      <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[10px] font-mono border border-purple-500/20">
                        🛡️ SENTINEL {skill.sentinel_score}/10
                      </span>
                    )}
                    {/* Sentinel Certificate badge — shows verified score from weekly batch audit */}
                    {certLoading ? (
                      <span className="px-2 py-0.5 rounded bg-zinc-500/10 text-zinc-400 text-[10px] font-mono border border-zinc-500/20 animate-pulse">
                        🛡️ VERIFYING...
                      </span>
                    ) : certificate ? (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono border cursor-help ${
                          certificate.risk_level === 'low'
                            ? 'bg-[#00F299]/10 text-[#00F299] border-[#00F299]/20'
                            : certificate.risk_level === 'medium'
                            ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                            : certificate.risk_level === 'high'
                            ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}
                        title={`Sentinel Certificate ${certificate.certificate_id}
Issued: ${new Date(certificate.issued_at).toLocaleDateString()}
Expires: ${new Date(certificate.expires_at).toLocaleDateString()}
Score: ${certificate.overall_score}/10
Risk: ${certificate.risk_level}
Layers: v3.0 ✓  L1.6 ✓  L2 ${certificate.layers_run.l2 ? '✓' : '—'}`}
                      >
                        🛡️ CERTIFIED {certificate.overall_score}/10
                      </span>
                    ) : null}
                  </div>
                  <h1 className="text-3xl font-bold text-white mb-2 break-words">{skill.name}</h1>
                  <p className="text-zinc-400 text-sm">{skill.tagline}</p>
                </div>
              </div>

              {/* Description */}
              <div className="mb-8">
                <h3 className="text-sm text-zinc-500 font-mono tracking-wider mb-3 uppercase">{c.about}</h3>
                <p className="text-zinc-300 text-sm leading-relaxed">{skill.longDescription}</p>
              </div>

              {/* Install command */}
              <div className="mb-8">
                <h3 className="text-sm text-zinc-500 font-mono tracking-wider mb-3 uppercase">{c.install}</h3>
                <div
                  onClick={handleCopyInstall}
                  className="flex items-center justify-between gap-4 p-4 rounded-xl bg-black/60 border border-white/5 cursor-pointer hover:border-[#00F299]/30 transition-all group"
                >
                  <code className="text-[#00F299] text-sm font-mono break-all">{skill.install}</code>
                  <span className="text-zinc-600 text-xs font-mono shrink-0 group-hover:text-[#00F299] transition-colors">
                    {copiedInstall ? c.copied : c.copy}
                  </span>
                </div>
              </div>

              {/* System Prompt — PREVIEW ONLY (locked until purchase) */}
              {skill.doc?.system_prompt && (
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm text-zinc-500 font-mono tracking-wider uppercase">{c.systemPrompt}</h3>
                    <div className="flex items-center gap-2">
                      {promptUnlocked ? (
                        <span className="px-2 py-1 rounded bg-[#00F299]/10 text-[#00F299] text-[10px] font-mono font-bold">{c.unlocked}</span>
                      ) : (
                        <span className="px-2 py-1 rounded bg-yellow-500/10 text-yellow-400 text-[10px] font-mono font-bold">{c.previewPurchase}</span>
                      )}
                      {promptUnlocked && skill.translations && (
                        <div className="flex items-center gap-1">
                          {SUPPORTED_LANGUAGES.filter(l => skill.translations[l.code]).map(lang => (
                            <button
                              key={lang.code}
                              onClick={() => setSelectedLang(lang.code)}
                              className={`px-2 py-1 rounded text-xs font-mono transition-all ${
                                selectedLang === lang.code
                                  ? 'bg-[#00F299]/20 text-[#00F299] border border-[#00F299]/40'
                                  : 'bg-white/5 text-zinc-500 border border-white/5 hover:bg-white/10'
                              }`}
                              title={lang.label}
                            >
                              {lang.flag} {lang.code.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={`relative rounded-xl bg-black/60 border border-white/5 overflow-hidden ${promptUnlocked ? '' : 'cursor-pointer'}`}
                    onClick={() => { if (!promptUnlocked) { document.getElementById('purchase-section')?.scrollIntoView({behavior:'smooth'}); } }}
                  >
                    {promptUnlocked ? (
                      /* FULL PROMPT — only visible after purchase */
                      <div className="p-4">
                        <pre className="text-[#00F299] text-xs font-mono whitespace-pre-wrap break-words max-h-96 overflow-y-auto select-all">
                          {skill.translations?.[selectedLang]?.system_prompt || skill.doc.system_prompt}
                        </pre>
                        <div className="mt-2 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const promptText = skill.translations?.[selectedLang]?.system_prompt || skill.doc.system_prompt;
                              navigator.clipboard.writeText(promptText);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            }}
                            className="text-zinc-600 text-xs font-mono hover:text-[#00F299] transition-colors"
                          >
                            {copied ? c.copied : c.copyPrompt}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* PREVIEW ONLY — truncated + blurred */
                      <div className="p-4">
                        <pre className="text-[#00F299]/60 text-xs font-mono whitespace-pre-wrap break-words overflow-hidden" style={{maxHeight: '120px'}}>
                          {(skill.translations?.[selectedLang]?.system_prompt || skill.doc.system_prompt).slice(0, 200)}
                        </pre>
                        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black via-black/90 to-transparent flex items-end justify-center pb-3">
                          <span className="text-yellow-400 text-xs font-mono">
                            {fmt(c.charsLocked, { n: (skill.translations?.[selectedLang]?.system_prompt || skill.doc.system_prompt).length - 200 })}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  {!promptUnlocked && (
                    <p className="text-zinc-600 text-[10px] mt-2 font-mono">
                      {fmt(c.previewNote, { total: (skill.translations?.[selectedLang]?.system_prompt || skill.doc.system_prompt).length })}
                    </p>
                  )}
                  {promptUnlocked && skill.translations && (
                    <p className="text-zinc-600 text-[10px] mt-2 font-mono">
                      {fmt(c.availableIn, { count: Object.keys(skill.translations).length })}&nbsp;
                      {fmt(c.showing, { lang: SUPPORTED_LANGUAGES.find(l => l.code === selectedLang)?.label || selectedLang })}
                    </p>
                  )}
                </div>
              )}

              {/* Features */}
              {skill.features.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-sm text-zinc-500 font-mono tracking-wider mb-3 uppercase">{c.features}</h3>
                  <div className="flex flex-wrap gap-2">
                    {skill.features.map((f, i) => (
                      <span key={i} className="px-3 py-1.5 rounded-lg bg-[#00F299]/5 border border-[#00F299]/20 text-[11px] text-[#00F299] font-mono">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {Array.isArray(skill.tags) && skill.tags.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-sm text-zinc-500 font-mono tracking-wider mb-3 uppercase">{c.tags}</h3>
                  <div className="flex flex-wrap gap-2">
                    {skill.tags.map((t, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-[10px] text-zinc-500 font-mono">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* MCP Routes (only if present) */}
              {skill.routes.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-sm text-zinc-500 font-mono tracking-wider mb-3 uppercase">{c.mcpRoutes}</h3>
                  <div className="flex flex-wrap gap-2">
                    {skill.routes.map((r, i) => (
                      <code key={i} className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/5 text-[11px] text-zinc-400 font-mono">
                        /{r}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="pt-6 border-t border-white/5">
                <div className="text-sm text-zinc-500">
                  {c.by} <span className="text-zinc-300">{skill.author}</span>
                </div>
              </div>
            </div>

            {/* Reviews — client-side review system */}
            <Reviews skillId={skill.id} />
          </motion.div>

          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-1"
          >
            <div className="premium-card p-6 sticky top-28" id="purchase-section">
              <div className="text-center mb-6">
                <div className="text-4xl font-bold text-white mb-1">${skill.price.toFixed(2)}</div>
                <div className="text-zinc-500 text-sm">{c.oneTimeLifetime}</div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">{c.version}</span>
                  <span className="text-white font-mono">{skill.version}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">{c.sentinelScore}</span>
                  <span className="text-purple-400 font-mono">{skill.sentinel_score}/10</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">{c.license}</span>
                  <span className="text-white font-mono">{c.openSource}</span>
                </div>
              </div>

              {purchaseResult ? (
                <div className="text-center p-4 rounded-xl bg-[#00F299]/10 border border-[#00F299]/20">
                  <div className="text-2xl mb-2">✅</div>
                  <p className="text-[#00F299] text-sm font-semibold mb-1">{c.purchaseVerified}</p>
                  <p className="text-zinc-400 text-xs font-mono mb-1">{c.order} {purchaseResult.order_id}</p>
                  {purchaseResult.txHash && (
                    <a
                      href={purchaseResult.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#00d1ff] text-[10px] font-mono hover:underline block mb-2"
                    >
                      {c.tx} {purchaseResult.txHash.slice(0, 10)}...{purchaseResult.txHash.slice(-8)} ↗
                    </a>
                  )}
                  <p className="text-zinc-500 text-[10px] font-mono">{c.token} {purchaseResult.access_token}</p>
                </div>
              ) : isFree ? (
                <div className="space-y-3">
                  <button
                    onClick={handleCopyInstall}
                    className="w-full py-4 rounded-xl font-semibold text-sm transition-all duration-300 bg-[#00F299] text-black hover:bg-[#00F299]/90 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {copiedInstall ? c.copiedExclaim : c.copyInstallCommand}
                  </button>
                  <p className="text-center text-zinc-700 text-[9px] font-mono">
                    {c.freeOpenSourceNpx}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* USDC payment — PRIMARY for agents */}
                  <div className="p-4 rounded-xl bg-[#00d1ff]/5 border border-[#00d1ff]/20 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[#00d1ff] text-xs font-mono font-bold">{c.agentPayment}</span>
                      <span className="text-zinc-600 text-[10px] font-mono">{c.noHumanNeeded}</span>
                    </div>
                    <div className="text-zinc-400 text-[10px] mb-2">
                      {fmt(c.agentStep1, { price: skill.price })}<code className="text-white">0x39Dd...f5Ee</code>{c.agentStep2}<br/>
                      {c.agentStep3}<br/>
                      {c.agentStep4}
                    </div>
                    <a href="/handshake" className="text-[#00d1ff] text-[10px] hover:underline">{c.fullAgentFlow}</a>
                  </div>

                  {/* Stripe checkout — secondary (credit card) */}
                  <button
                    onClick={handleStripeCheckout}
                    disabled={purchasing}
                    className={`w-full py-4 rounded-xl font-semibold text-sm transition-all duration-300 ${
                      purchasing
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        : 'bg-[#00F299] text-black hover:bg-[#00F299]/90 hover:scale-[1.02] active:scale-[0.98]'
                    }`}
                  >
                    {purchasing && purchaseStep
                      ? purchaseStep
                      : fmt(c.payWithCard, { price: skill.price.toFixed(2) })
                    }
                  </button>

                  <p className="text-center text-zinc-700 text-[9px] font-mono">
                    {c.securePaymentStripe}
                  </p>

                  {/* Divider */}
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-[10px] text-zinc-600 font-mono">{c.orPayWithCrypto}</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>

                  {/* Crypto checkout — secondary (MetaMask / USDC) */}
                  {!walletAddr ? (
                    <button
                      onClick={handleConnectWallet}
                      className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300 bg-white/5 border border-white/10 text-white hover:border-[#00F299]/50 hover:bg-[#00F299]/5"
                    >
                      {c.connectMetamask}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#00F299]/5 border border-[#00F299]/20">
                      <span className="w-2 h-2 rounded-full bg-[#00F299] animate-pulse" />
                      <span className="text-[10px] font-mono text-zinc-400 truncate">{walletAddr}</span>
                    </div>
                  )}

                  <button
                    onClick={handlePurchase}
                    disabled={purchasing || !walletAddr}
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300 ${
                      purchasing || !walletAddr
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        : 'bg-white/5 border border-[#00F299]/30 text-[#00F299] hover:bg-[#00F299]/10'
                    }`}
                  >
                    {purchasing
                      ? (purchaseStep || c.processing)
                      : fmt(c.payUsdc, { price: skill.price.toFixed(2) })
                    }
                  </button>

                  <p className="text-center text-zinc-700 text-[9px] font-mono">
                    {c.usdcBaseVerified}
                  </p>
                </div>
              )}

              {error && (
                <div className="mt-4 text-center text-red-400 text-xs">{error}</div>
              )}

              {/* Badge Copier */}
              <div className="mt-6 pt-6 border-t border-white/5">
                <h4 className="text-[10px] text-zinc-500 font-mono tracking-wider mb-3 uppercase text-center">{c.promoteTitle}</h4>
                <div className="p-4 rounded-xl bg-black/40 border border-white/5 text-center transition-all hover:border-[#00F299]/30 hover:shadow-[0_0_15px_rgba(0,242,153,0.1)]">
                  <img src="https://marketnow.site/badges/available-on.svg" alt={c.badgeAlt} className="mx-auto mb-4 h-6" />
                  <button
                    onClick={handleCopyBadge}
                    className={`w-full py-2 text-xs font-mono rounded-lg transition-all border ${
                      copied
                        ? 'bg-[#00F299]/20 text-[#00F299] border-[#00F299]/50'
                        : 'bg-white/5 hover:bg-white/10 text-zinc-300 border-white/10'
                    }`}
                  >
                    {copied ? c.copiedMarkdown : c.copyBadgeMd}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
