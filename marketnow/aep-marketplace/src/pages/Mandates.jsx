import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';

const CATEGORIES = [
  'ai', 'automation', 'data', 'devtools', 'scraping', 'search',
  'browser', 'database', 'cloud', 'productivity', 'analytics',
  'security', 'marketing', 'ecommerce', 'finance', 'media',
];

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT — all UI text in 5 languages (en, es, pt, zh, fr)
// ═══════════════════════════════════════════════════════════════════════════
const CONTENT = {
  en: {
    badge: 'ACP / AP2 · DELEGATED MANDATES',
    yourWalletLabel: 'YOUR WALLET (PRINCIPAL)',
    walletPlaceholder: '0x... (your MetaMask / wallet address)',
    loadButton: 'LOAD MANDATES',
    walletHint:
      'We use your wallet address to filter mandates you own. No signature required to view. Signing (EIP-191) is recommended when creating mandates to bind the agent\'s identity.',
    loading: 'Loading mandates…',
    activeMandates: 'ACTIVE MANDATES ({count})',
    agentLine: 'Agent: {name} · {id}',
    limitLabel: 'Limit',
    spentLabel: 'Spent',
    spentValue: '${spent} ({count} txs)',
    autonomousRemaining: 'Autonomous remaining',
    autonomousValue: '{count}/3',
    reApproveNeeded: '🔒 RE-APPROVE NEEDED',
    remainingLabel: 'Remaining',
    perPurchaseCapLabel: 'Per-purchase cap',
    categoriesLabel: 'Categories',
    expiresLabel: 'Expires',
    copyIdButton: 'COPY ID',
    revokeButton: 'REVOKE',
    revokeConfirm:
      'Revoke this mandate? The agent will lose autonomous purchase ability immediately.',
    createNewMandate: 'CREATE NEW MANDATE',
    principalWalletLabel: 'Principal wallet *',
    agentIdLabel: 'Agent ID *',
    agentNameLabel: 'Agent name',
    expiresOptionalLabel: 'Expires (optional)',
    totalSpendingLimitLabel: 'Total spending limit (USD) *',
    maxTotalHint: 'Max $500.00',
    perPurchaseCapFormField: 'Per-purchase cap (USD)',
    maxPerPurchaseHint: 'Max $50.00 per single purchase',
    allowedCategoriesLabel: 'ALLOWED CATEGORIES',
    allCategories: 'ALL (*)',
    creatingButton: 'CREATING…',
    createMandateButton: 'CREATE MANDATE →',
    mandateCreated: '✓ MANDATE CREATED',
    mandateId: 'ID: {id}',
    mandateCreatedDescBefore: 'Share this ID with your agent. The agent should include it as ',
    mandateCreatedDescMid: ' in POST ',
    mandateCreatedDescAfter: ' requests.',
    howItWorks: 'HOW IT WORKS',
    step1Title: 'You create a mandate',
    step1Desc:
      'Set total limit, per-purchase cap, allowed categories, expiry. Sign with your wallet (recommended).',
    step2Title: 'Agent buys autonomously',
    step2Desc:
      'Agent calls /api/agent-purchase with mandateId + USDC txHash. We verify on Base, deduct from mandate, return license.',
    step3Title: 'Beyond limit, you approve',
    step3Desc:
      'When mandate is exhausted or expired, agent gets mode=requires_human_approval. You approve via Stripe, or renew the mandate.',
    backToMarketplace: '← Back to marketplace',
    statuses: {
      active: 'ACTIVE',
      revoked: 'REVOKED',
      requires_reapproval: 'RE-APPROVAL NEEDED',
      exhausted: 'EXHAUSTED',
      expired: 'EXPIRED',
    },
  },

  es: {
    badge: 'ACP / AP2 · MANDATOS DELEGADOS',
    yourWalletLabel: 'TU WALLET (PRINCIPAL)',
    walletPlaceholder: '0x... (tu dirección de MetaMask / wallet)',
    loadButton: 'CARGAR MANDATOS',
    walletHint:
      'Usamos tu dirección de wallet para filtrar los mandatos que te pertenecen. No se requiere firma para ver. Firmar (EIP-191) es recomendado al crear mandatos para vincular la identidad del agente.',
    loading: 'Cargando mandatos…',
    activeMandates: 'MANDATOS ACTIVOS ({count})',
    agentLine: 'Agente: {name} · {id}',
    limitLabel: 'Límite',
    spentLabel: 'Gastado',
    spentValue: '${spent} ({count} txs)',
    autonomousRemaining: 'Restante autónomo',
    autonomousValue: '{count}/3',
    reApproveNeeded: '🔒 RE-APROBACIÓN REQUERIDA',
    remainingLabel: 'Restante',
    perPurchaseCapLabel: 'Tope por compra',
    categoriesLabel: 'Categorías',
    expiresLabel: 'Expira',
    copyIdButton: 'COPIAR ID',
    revokeButton: 'REVOCAR',
    revokeConfirm:
      '¿Revocar este mandato? El agente perderá la capacidad de compra autónoma inmediatamente.',
    createNewMandate: 'CREAR NUEVO MANDATO',
    principalWalletLabel: 'Wallet principal *',
    agentIdLabel: 'ID del agente *',
    agentNameLabel: 'Nombre del agente',
    expiresOptionalLabel: 'Expira (opcional)',
    totalSpendingLimitLabel: 'Límite total de gasto (USD) *',
    maxTotalHint: 'Máx $500.00',
    perPurchaseCapFormField: 'Tope por compra (USD)',
    maxPerPurchaseHint: 'Máx $50.00 por compra individual',
    allowedCategoriesLabel: 'CATEGORÍAS PERMITIDAS',
    allCategories: 'TODAS (*)',
    creatingButton: 'CREANDO…',
    createMandateButton: 'CREAR MANDATO →',
    mandateCreated: '✓ MANDATO CREADO',
    mandateId: 'ID: {id}',
    mandateCreatedDescBefore: 'Comparte este ID con tu agente. El agente debe incluirlo como ',
    mandateCreatedDescMid: ' en peticiones POST ',
    mandateCreatedDescAfter: '.',
    howItWorks: 'CÓMO FUNCIONA',
    step1Title: 'Tú creas un mandato',
    step1Desc:
      'Definir límite total, tope por compra, categorías permitidas, expiración. Firmar con tu wallet (recomendado).',
    step2Title: 'El agente compra autónomamente',
    step2Desc:
      'El agente llama a /api/agent-purchase con mandateId + USDC txHash. Verificamos en Base, descontamos del mandato, devolvemos licencia.',
    step3Title: 'Más allá del límite, tú apruebas',
    step3Desc:
      'Cuando el mandato se agota o expira, el agente recibe mode=requires_human_approval. Apruebas vía Stripe, o renuevas el mandato.',
    backToMarketplace: '← Volver al marketplace',
    statuses: {
      active: 'ACTIVO',
      revoked: 'REVOCADO',
      requires_reapproval: 'RE-APROBACIÓN REQUERIDA',
      exhausted: 'AGOTADO',
      expired: 'EXPIRADO',
    },
  },

  pt: {
    badge: 'ACP / AP2 · MANDATOS DELEGADOS',
    yourWalletLabel: 'SUA WALLET (PRINCIPAL)',
    walletPlaceholder: '0x... (seu endereço MetaMask / wallet)',
    loadButton: 'CARREGAR MANDATOS',
    walletHint:
      'Usamos seu endereço de wallet para filtrar os mandatos que pertencem a você. Não é necessária assinatura para visualizar. Assinar (EIP-191) é recomendado ao criar mandatos para vincular a identidade do agente.',
    loading: 'Carregando mandatos…',
    activeMandates: 'MANDATOS ATIVOS ({count})',
    agentLine: 'Agente: {name} · {id}',
    limitLabel: 'Limite',
    spentLabel: 'Gasto',
    spentValue: '${spent} ({count} txs)',
    autonomousRemaining: 'Restante autônomo',
    autonomousValue: '{count}/3',
    reApproveNeeded: '🔒 RE-APROVAÇÃO NECESSÁRIA',
    remainingLabel: 'Restante',
    perPurchaseCapLabel: 'Teto por compra',
    categoriesLabel: 'Categorias',
    expiresLabel: 'Expira',
    copyIdButton: 'COPIAR ID',
    revokeButton: 'REVOGAR',
    revokeConfirm:
      'Revogar este mandato? O agente perderá a capacidade de compra autônoma imediatamente.',
    createNewMandate: 'CRIAR NOVO MANDATO',
    principalWalletLabel: 'Wallet principal *',
    agentIdLabel: 'ID do agente *',
    agentNameLabel: 'Nome do agente',
    expiresOptionalLabel: 'Expira (opcional)',
    totalSpendingLimitLabel: 'Limite total de gasto (USD) *',
    maxTotalHint: 'Máx $500.00',
    perPurchaseCapFormField: 'Teto por compra (USD)',
    maxPerPurchaseHint: 'Máx $50.00 por compra individual',
    allowedCategoriesLabel: 'CATEGORIAS PERMITIDAS',
    allCategories: 'TODAS (*)',
    creatingButton: 'CRIANDO…',
    createMandateButton: 'CRIAR MANDATO →',
    mandateCreated: '✓ MANDATO CRIADO',
    mandateId: 'ID: {id}',
    mandateCreatedDescBefore: 'Compartilhe este ID com seu agente. O agente deve incluí-lo como ',
    mandateCreatedDescMid: ' em requisições POST ',
    mandateCreatedDescAfter: '.',
    howItWorks: 'COMO FUNCIONA',
    step1Title: 'Você cria um mandato',
    step1Desc:
      'Definir limite total, teto por compra, categorias permitidas, expiração. Assinar com sua wallet (recomendado).',
    step2Title: 'O agente compra autonomamente',
    step2Desc:
      'O agente chama /api/agent-purchase com mandateId + USDC txHash. Verificamos na Base, descontamos do mandato, devolvemos licença.',
    step3Title: 'Além do limite, você aprova',
    step3Desc:
      'Quando o mandato se esgota ou expira, o agente recebe mode=requires_human_approval. Você aprova via Stripe, ou renova o mandato.',
    backToMarketplace: '← Voltar ao marketplace',
    statuses: {
      active: 'ATIVO',
      revoked: 'REVOGADO',
      requires_reapproval: 'RE-APROVAÇÃO NECESSÁRIA',
      exhausted: 'ESGOTADO',
      expired: 'EXPIRADO',
    },
  },

  zh: {
    badge: 'ACP / AP2 · 委托授权',
    yourWalletLabel: '你的钱包（委托人）',
    walletPlaceholder: '0x...（你的 MetaMask / 钱包地址）',
    loadButton: '加载授权',
    walletHint:
      '我们使用你的钱包地址筛选你拥有的授权。查看时无需签名。创建授权时建议签名（EIP-191）以绑定 agent 身份。',
    loading: '正在加载授权…',
    activeMandates: '有效授权（{count}）',
    agentLine: 'Agent：{name} · {id}',
    limitLabel: '额度',
    spentLabel: '已花费',
    spentValue: '${spent}（{count} 笔交易）',
    autonomousRemaining: '剩余自主次数',
    autonomousValue: '{count}/3',
    reApproveNeeded: '🔒 需重新批准',
    remainingLabel: '剩余金额',
    perPurchaseCapLabel: '单次购买上限',
    categoriesLabel: '类别',
    expiresLabel: '到期',
    copyIdButton: '复制 ID',
    revokeButton: '撤销',
    revokeConfirm: '撤销此授权？agent 将立即失去自主购买能力。',
    createNewMandate: '创建新授权',
    principalWalletLabel: '委托人钱包 *',
    agentIdLabel: 'Agent ID *',
    agentNameLabel: 'Agent 名称',
    expiresOptionalLabel: '到期（可选）',
    totalSpendingLimitLabel: '总花费额度（USD）*',
    maxTotalHint: '上限 $500.00',
    perPurchaseCapFormField: '单次购买上限（USD）',
    maxPerPurchaseHint: '单次购买上限 $50.00',
    allowedCategoriesLabel: '允许的类别',
    allCategories: '全部（*）',
    creatingButton: '创建中…',
    createMandateButton: '创建授权 →',
    mandateCreated: '✓ 授权已创建',
    mandateId: 'ID：{id}',
    mandateCreatedDescBefore: '将此 ID 分享给你的 agent。agent 应在 POST ',
    mandateCreatedDescMid: ' 请求中将其作为 ',
    mandateCreatedDescAfter: ' 传入。',
    howItWorks: '运作方式',
    step1Title: '你创建授权',
    step1Desc: '设置总额度、单次上限、允许的类别、到期时间。建议用钱包签名。',
    step2Title: 'Agent 自主购买',
    step2Desc:
      'Agent 调用 /api/agent-purchase，传入 mandateId + USDC txHash。我们在 Base 上验证，从授权中扣减，返回 license。',
    step3Title: '超额后，由你批准',
    step3Desc:
      '当授权用尽或到期时，agent 会收到 mode=requires_human_approval。你通过 Stripe 批准，或续签授权。',
    backToMarketplace: '← 返回市场',
    statuses: {
      active: '有效',
      revoked: '已撤销',
      requires_reapproval: '需重新批准',
      exhausted: '已用尽',
      expired: '已到期',
    },
  },

  fr: {
    badge: 'ACP / AP2 · MANDATS DÉLÉGUÉS',
    yourWalletLabel: 'VOTRE WALLET (PRINCIPAL)',
    walletPlaceholder: '0x... (votre adresse MetaMask / wallet)',
    loadButton: 'CHARGER LES MANDATS',
    walletHint:
      'Nous utilisons votre adresse de wallet pour filtrer les mandats qui vous appartiennent. Aucune signature requise pour consulter. Signer (EIP-191) est recommandé lors de la création de mandats pour lier l\'identité de l\'agent.',
    loading: 'Chargement des mandats…',
    activeMandates: 'MANDATS ACTIFS ({count})',
    agentLine: 'Agent : {name} · {id}',
    limitLabel: 'Limite',
    spentLabel: 'Dépensé',
    spentValue: '${spent} ({count} txs)',
    autonomousRemaining: 'Restant autonome',
    autonomousValue: '{count}/3',
    reApproveNeeded: '🔒 RÉ-APPROBATION REQUISE',
    remainingLabel: 'Restant',
    perPurchaseCapLabel: 'Plafond par achat',
    categoriesLabel: 'Catégories',
    expiresLabel: 'Expire',
    copyIdButton: 'COPIER ID',
    revokeButton: 'RÉVOQUER',
    revokeConfirm:
      'Révoquer ce mandat ? L\'agent perdra immédiatement sa capacité d\'achat autonome.',
    createNewMandate: 'CRÉER UN NOUVEAU MANDAT',
    principalWalletLabel: 'Wallet principal *',
    agentIdLabel: 'ID de l\'agent *',
    agentNameLabel: 'Nom de l\'agent',
    expiresOptionalLabel: 'Expire (facultatif)',
    totalSpendingLimitLabel: 'Limite de dépense totale (USD) *',
    maxTotalHint: 'Max $500.00',
    perPurchaseCapFormField: 'Plafond par achat (USD)',
    maxPerPurchaseHint: 'Max $50.00 par achat unique',
    allowedCategoriesLabel: 'CATÉGORIES AUTORISÉES',
    allCategories: 'TOUTES (*)',
    creatingButton: 'CRÉATION…',
    createMandateButton: 'CRÉER LE MANDAT →',
    mandateCreated: '✓ MANDAT CRÉÉ',
    mandateId: 'ID : {id}',
    mandateCreatedDescBefore: 'Partagez cet ID avec votre agent. L\'agent doit l\'inclure comme ',
    mandateCreatedDescMid: ' dans les requêtes POST ',
    mandateCreatedDescAfter: '.',
    howItWorks: 'COMMENT ÇA MARCHE',
    step1Title: 'Vous créez un mandat',
    step1Desc:
      'Définir la limite totale, le plafond par achat, les catégories autorisées, l\'expiration. Signer avec votre wallet (recommandé).',
    step2Title: 'L\'agent achète autonomement',
    step2Desc:
      'L\'agent appelle /api/agent-purchase avec mandateId + USDC txHash. Nous vérifions sur Base, déduisons du mandat, renvoyons la licence.',
    step3Title: 'Au-delà de la limite, vous approuvez',
    step3Desc:
      'Quand le mandat est épuisé ou expiré, l\'agent reçoit mode=requires_human_approval. Vous approuvez via Stripe, ou renouvelez le mandat.',
    backToMarketplace: '← Retour au marketplace',
    statuses: {
      active: 'ACTIF',
      revoked: 'RÉVOQUÉ',
      requires_reapproval: 'RÉ-APPROBATION REQUISE',
      exhausted: 'ÉPUISÉ',
      expired: 'EXPIRÉ',
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

export default function Mandates() {
  const { t, lang } = useLang();
  const c = CONTENT[lang] || CONTENT.en;
  const [wallet, setWallet] = useState('');
  const [mandates, setMandates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // New mandate form
  const [form, setForm] = useState({
    owner: '',
    agentId: '',
    agentName: 'Claude',
    spendingLimitUsd: 25,
    perPurchaseCapUsd: 5,
    categories: ['*'],
    expiresAt: '',
  });
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null);

  async function loadMandates(w) {
    if (!w) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/mandates?owner=${encodeURIComponent(w.toLowerCase())}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'load failed');
      setMandates(j.mandates || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem('mn_wallet');
    if (saved) {
      setWallet(saved);
      loadMandates(saved);
    }
  }, []);

  function saveWallet(w) {
    setWallet(w);
    localStorage.setItem('mn_wallet', w);
    loadMandates(w);
  }

  async function createMandate(e) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setCreated(null);
    try {
      const payload = {
        ...form,
        owner: form.owner.toLowerCase(),
        spendingLimitUsd: Number(form.spendingLimitUsd),
        perPurchaseCapUsd: Number(form.perPurchaseCapUsd),
      };
      if (!payload.expiresAt) delete payload.expiresAt;
      const r = await fetch('/api/mandates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'create failed');
      setCreated(j.mandate);
      if (wallet) loadMandates(wallet);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id) {
    if (!confirm(c.revokeConfirm)) return;
    const r = await fetch('/api/mandates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revoke', id }),
    });
    if (r.ok && wallet) loadMandates(wallet);
  }

  function toggleCat(cat) {
    setForm(f => {
      let cats = f.categories.includes('*') ? [] : [...f.categories];
      if (cats.includes(cat)) cats = cats.filter(x => x !== cat);
      else cats.push(cat);
      if (cats.length === 0) cats = ['*'];
      return { ...f, categories: cats };
    });
  }

  return (
    <div className="min-h-screen pt-20 pb-20 px-4 md:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00F299]/10 border border-[#00F299]/20 mb-4">
            <span className="text-[#00F299] text-[10px] font-mono tracking-wider">{c.badge}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">{t('mandates.title')}</h1>
          <p className="text-zinc-400 text-lg max-w-2xl">
            {t('mandates.subtitle')}
          </p>
        </motion.div>

        {/* Wallet input */}
        <div className="premium-card p-5 mb-8">
          <label className="text-zinc-400 text-xs font-mono mb-2 block">{c.yourWalletLabel}</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={c.walletPlaceholder}
              value={wallet}
              onChange={e => setWallet(e.target.value)}
              className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-[#00F299] outline-none"
            />
            <button
              onClick={() => saveWallet(wallet)}
              className="px-4 py-2 bg-[#00F299] text-black font-bold rounded-lg hover:bg-[#00F299]/90 transition-all text-sm"
            >
              {c.loadButton}
            </button>
          </div>
          <p className="text-zinc-600 text-[10px] mt-2">
            {c.walletHint}
          </p>
        </div>

        {/* Existing mandates */}
        {loading && <div className="text-zinc-500 text-sm mb-8">{c.loading}</div>}
        {error && <div className="text-red-400 text-sm mb-8 font-mono">{error}</div>}
        {mandates.length > 0 && (
          <div className="mb-12">
            <h2 className="text-white text-sm font-mono tracking-wider mb-4">
              {fmt(c.activeMandates, { count: mandates.length })}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mandates.map(m => {
                const remaining = m.spendingLimitUsd - m.spentUsd;
                const pct = Math.min(100, Math.max(0, (m.spentUsd / m.spendingLimitUsd) * 100));
                const statusLabel = c.statuses[m.status] || (m.status ? m.status.toUpperCase() : '');
                return (
                  <div key={m.id} className="premium-card p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-white font-mono text-sm">{m.id}</div>
                        <div className="text-zinc-500 text-[10px]">
                          {fmt(c.agentLine, { name: m.agentName, id: m.agentId })}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                        m.status === 'active' ? 'bg-[#00F299]/10 text-[#00F299]'
                        : m.status === 'revoked' ? 'bg-red-500/10 text-red-400' : m.status === 'requires_reapproval' ? 'bg-yellow-500/10 text-yellow-400'
                        : 'bg-yellow-500/10 text-yellow-400'
                      }`}>{statusLabel}</span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">{c.limitLabel}</span>
                        <span className="text-white font-mono">${m.spendingLimitUsd.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">{c.spentLabel}</span>
                        <span className="text-white font-mono">
                          {fmt(c.spentValue, { spent: m.spentUsd.toFixed(2), count: m.txCount || 0 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">{c.autonomousRemaining}</span>
                        <span className={`font-mono ${Math.max(0, 3 - (m.txCount || 0)) > 0 ? 'text-[#00F299]' : 'text-yellow-400'}`}>
                          {fmt(c.autonomousValue, { count: Math.max(0, 3 - (m.txCount || 0)) })} {m.status === 'requires_reapproval' ? c.reApproveNeeded : ''}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">{c.remainingLabel}</span>
                        <span className="text-[#00F299] font-mono">${remaining.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">{c.perPurchaseCapLabel}</span>
                        <span className="text-white font-mono">${m.perPurchaseCapUsd.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">{c.categoriesLabel}</span>
                        <span className="text-white font-mono">{(m.categories || ['*']).join(', ')}</span>
                      </div>
                      {m.expiresAt && (
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-500">{c.expiresLabel}</span>
                          <span className="text-white font-mono">{new Date(m.expiresAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    <div className="h-1.5 bg-black/40 rounded-full overflow-hidden mb-4">
                      <div
                        className="h-full bg-gradient-to-r from-[#00F299] to-[#00d1ff]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => navigator.clipboard.writeText(m.id)}
                        className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded text-white text-xs hover:bg-black/60 font-mono"
                      >
                        {c.copyIdButton}
                      </button>
                      {m.status === 'active' && (
                        <button
                          onClick={() => revoke(m.id)}
                          className="px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded text-xs hover:bg-red-500/20 font-mono"
                        >
                          {c.revokeButton}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Create form */}
        <motion.form
          onSubmit={createMandate}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="premium-card p-6"
        >
          <h2 className="text-white text-sm font-mono tracking-wider mb-4">{c.createNewMandate}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">{c.principalWalletLabel}</label>
              <input
                required
                type="text"
                placeholder="0x..."
                value={form.owner}
                onChange={e => setForm({ ...form, owner: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-[#00F299] outline-none"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">{c.agentIdLabel}</label>
              <input
                required
                type="text"
                placeholder="agent_claude_001"
                value={form.agentId}
                onChange={e => setForm({ ...form, agentId: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-[#00F299] outline-none"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">{c.agentNameLabel}</label>
              <select
                value={form.agentName}
                onChange={e => setForm({ ...form, agentName: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#00F299] outline-none"
              >
                <option>Claude</option>
                <option>Cursor</option>
                <option>Cline</option>
                <option>ChatGPT</option>
                <option>Gemini</option>
                <option>Custom</option>
              </select>
            </div>
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">{c.expiresOptionalLabel}</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={e => setForm({ ...form, expiresAt: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#00F299] outline-none"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">{c.totalSpendingLimitLabel}</label>
              <input
                required
                type="number"
                min="0.01"
                max="500"
                step="0.01"
                value={form.spendingLimitUsd}
                onChange={e => setForm({ ...form, spendingLimitUsd: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-[#00F299] outline-none"
              />
              <p className="text-zinc-600 text-[10px] mt-1">{c.maxTotalHint}</p>
            </div>
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">{c.perPurchaseCapFormField}</label>
              <input
                type="number"
                min="0.01"
                max="50"
                step="0.01"
                value={form.perPurchaseCapUsd}
                onChange={e => setForm({ ...form, perPurchaseCapUsd: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-[#00F299] outline-none"
              />
              <p className="text-zinc-600 text-[10px] mt-1">{c.maxPerPurchaseHint}</p>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-zinc-400 text-xs mb-2 block">{c.allowedCategoriesLabel}</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, categories: ['*'] })}
                className={`px-3 py-1 rounded-full text-xs font-mono ${
                  form.categories.includes('*')
                    ? 'bg-[#00F299] text-black'
                    : 'bg-black/40 border border-white/10 text-zinc-400'
                }`}
              >
                {c.allCategories}
              </button>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCat(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-mono ${
                    form.categories.includes(cat) && !form.categories.includes('*')
                      ? 'bg-[#00d1ff]/20 text-[#00d1ff] border border-[#00d1ff]/30'
                      : 'bg-black/40 border border-white/10 text-zinc-500'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full px-6 py-3 bg-[#00F299] text-black font-bold rounded-lg hover:bg-[#00F299]/90 disabled:opacity-50 transition-all"
          >
            {creating ? c.creatingButton : c.createMandateButton}
          </button>

          {created && (
            <div className="mt-4 p-4 rounded-lg bg-[#00F299]/5 border border-[#00F299]/20">
              <div className="text-[#00F299] text-xs font-mono mb-2">{c.mandateCreated}</div>
              <div className="text-white text-xs font-mono break-all mb-2">
                {fmt(c.mandateId, { id: created.id })}
              </div>
              <p className="text-zinc-400 text-xs">
                {c.mandateCreatedDescBefore}
                <code className="text-[#00F299]">mandateId</code>
                {c.mandateCreatedDescMid}
                <code className="text-[#00F299]">/api/agent-purchase</code>
                {c.mandateCreatedDescAfter}
              </p>
            </div>
          )}
        </motion.form>

        {/* How it works */}
        <div className="mt-12 premium-card p-6">
          <h3 className="text-[#00F299] text-xs font-mono tracking-wider mb-4 uppercase">{c.howItWorks}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { n: '01', t: c.step1Title, d: c.step1Desc },
              { n: '02', t: c.step2Title, d: c.step2Desc },
              { n: '03', t: c.step3Title, d: c.step3Desc },
            ].map(s => (
              <div key={s.n} className="p-4 rounded-lg bg-black/40">
                <div className="text-[#00F299] text-xs font-mono mb-2">{s.n}</div>
                <div className="text-white text-sm font-bold mb-1">{s.t}</div>
                <div className="text-zinc-500 text-xs leading-relaxed">{s.d}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link to="/" className="text-[#00F299] text-sm hover:underline">{c.backToMarketplace}</Link>
        </div>
      </div>
    </div>
  );
}
