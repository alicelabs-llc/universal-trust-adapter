import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';
import { isAuthenticated, getUser } from '../api/client';
import {
  getMyAffiliateCode,
  buildAffiliateUrl,
  calculateAffiliatePayout,
  calculateSellerEarnings,
  calculateCommission,
} from '../utils/affiliate';

/**
 * MarketNow — Seller & Affiliate Dashboard
 *
 * Permite a vendedores y afiliados:
 *  - Ver su código de afiliado
 *  - Generar links de afiliado para cualquier skill
 *  - Calcular comisiones y payouts
 *  - Ver sus skills enviadas (trackeadas via GitHub Issues)
 *
 * NOTA: En GitHub Pages no hay backend, así que las "stats de ventas"
 * se simulan. Para datos reales, integrar con Stripe Connect y
 * una base de datos de orders.
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT — all visible UI strings in 5 languages
// ═══════════════════════════════════════════════════════════════════════════
const CONTENT = {
  en: {
    signInRequired: 'SIGN IN REQUIRED',
    signInDesc: 'Sign in to access your seller and affiliate dashboard.',
    signInBtn: 'SIGN IN',
    sellerTitle: 'SELLER',
    sellerTitleAccent: 'DASHBOARD',
    sellerSubtitle: 'Manage your skills, track earnings, and generate affiliate links.',
    affiliateCodeTitle: 'YOUR AFFILIATE CODE',
    affiliateCodeDescPre: 'Share this code. When someone buys a skill via your affiliate link, you earn ',
    affiliateCodeDescAccent: '5% of the sale price',
    affiliateCodeDescPost: '.',
    generateLabel: 'Generate affiliate link for a skill:',
    generateBtn: 'GENERATE',
    affiliateLinkLabel: 'AFFILIATE LINK',
    copy: '📋 COPY',
    copied: '✓',
    calcTitle: 'EARNINGS CALCULATOR',
    calcDesc: 'See how much everyone earns per sale. MarketNow takes 20% commission, sellers keep 80%, affiliates earn 5% of the sale price.',
    skillPriceLabel: 'Skill price (USD)',
    rowSeller: 'Seller receives (80%)',
    rowCommission: 'MarketNow commission (20%)',
    rowAffiliate: 'Affiliate earns (5%)',
    tipLabel: 'Tip:',
    tipBody: ' Payouts are procNo payments are processed — everything is free. There are no payouts.',
    quickLinks: [
      { to: '/submit', icon: '➕', title: 'Submit a Skill', desc: 'Sell your MCP server to 5,000+ agents' },
      { to: '/vault', icon: '📦', title: 'My Vault', desc: 'Manage your purchased skills' },
      { to: '/registry', icon: '🛒', title: 'Browse Registry', desc: 'Find skills to buy or affiliate' },
    ],
  },
  es: {
    signInRequired: 'INICIA SESIÓN',
    signInDesc: 'Inicia sesión para acceder a tu panel de vendedor y afiliado.',
    signInBtn: 'INICIAR SESIÓN',
    sellerTitle: 'PANEL',
    sellerTitleAccent: 'DE VENDEDOR',
    sellerSubtitle: 'Administra tus skills, sigue tus ingresos y genera links de afiliado.',
    affiliateCodeTitle: 'TU CÓDIGO DE AFILIADO',
    affiliateCodeDescPre: 'Comparte este código. Cuando alguien compre una skill por tu link de afiliado, ganas ',
    affiliateCodeDescAccent: 'el 5% del precio de venta',
    affiliateCodeDescPost: '.',
    generateLabel: 'Generar link de afiliado para una skill:',
    generateBtn: 'GENERAR',
    affiliateLinkLabel: 'LINK DE AFILIADO',
    copy: '📋 COPIAR',
    copied: '✓',
    calcTitle: 'CALCULADORA DE INGRESOS',
    calcDesc: 'Mira cuánto gana cada uno por venta. MarketNow se lleva 20% de comisión, los vendedores quedan con 80%, los afiliados ganan 5% del precio de venta.',
    skillPriceLabel: 'Precio de la skill (USD)',
    rowSeller: 'Vendedor recibe (80%)',
    rowCommission: 'Comisión de MarketNow (20%)',
    rowAffiliate: 'Afiliado gana (5%)',
    tipLabel: 'Consejo:',
    tipBody: ' Los pagos se procesanNo hay pagos — todo es gratis. No existen pagos mínimos.',
    quickLinks: [
      { to: '/submit', icon: '➕', title: 'Enviar una Skill', desc: 'Vende tu MCP server a más de 5,000 agentes' },
      { to: '/vault', icon: '📦', title: 'Mi Vault', desc: 'Administra tus skills compradas' },
      { to: '/registry', icon: '🛒', title: 'Explorar Registro', desc: 'Encuentra skills para comprar o afiliarte' },
    ],
  },
  pt: {
    signInRequired: 'ENTRE NA CONTA',
    signInDesc: 'Entre na conta para acessar seu painel de vendedor e afiliado.',
    signInBtn: 'ENTRAR',
    sellerTitle: 'PAINEL',
    sellerTitleAccent: 'DE VENDEDOR',
    sellerSubtitle: 'Gerencie suas skills, acompanhe ganhos e gere links de afiliado.',
    affiliateCodeTitle: 'SEU CÓDIGO DE AFILIADO',
    affiliateCodeDescPre: 'Compartilhe este código. Quando alguém compra uma skill pelo seu link de afiliado, você ganha ',
    affiliateCodeDescAccent: '5% do preço da venda',
    affiliateCodeDescPost: '.',
    generateLabel: 'Gerar link de afiliado para uma skill:',
    generateBtn: 'GERAR',
    affiliateLinkLabel: 'LINK DE AFILIADO',
    copy: '📋 COPIAR',
    copied: '✓',
    calcTitle: 'CALCULADORA DE GANHOS',
    calcDesc: 'Veja quanto cada um ganha por venda. O MarketNow fica com 20% de comissão, vendedores ficam com 80%, afiliados ganham 5% do preço da venda.',
    skillPriceLabel: 'Preço da skill (USD)',
    rowSeller: 'Vendedor recebe (80%)',
    rowCommission: 'Comissão do MarketNow (20%)',
    rowAffiliate: 'Afiliado ganha (5%)',
    tipLabel: 'Dica:',
    tipBody: ' Pagamentos são processaNão há pagamentos — tudo é grátis. Não existem saques.',
    quickLinks: [
      { to: '/submit', icon: '➕', title: 'Enviar uma Skill', desc: 'Venda seu MCP server para mais de 5.000 agentes' },
      { to: '/vault', icon: '📦', title: 'Meu Vault', desc: 'Gerencie suas skills compradas' },
      { to: '/registry', icon: '🛒', title: 'Explorar Registro', desc: 'Encontre skills para comprar ou afiliar' },
    ],
  },
  zh: {
    signInRequired: '需要登录',
    signInDesc: '登录以访问你的卖家和分销商面板。',
    signInBtn: '登录',
    sellerTitle: '卖家',
    sellerTitleAccent: '面板',
    sellerSubtitle: '管理你的 skills、追踪收入并生成分销链接。',
    affiliateCodeTitle: '你的分销码',
    affiliateCodeDescPre: '分享此码。当有人通过你的分销链接购买 skill 时，你将赚取 ',
    affiliateCodeDescAccent: '售价的 5%',
    affiliateCodeDescPost: '。',
    generateLabel: '为 skill 生成分销链接：',
    generateBtn: '生成',
    affiliateLinkLabel: '分销链接',
    copy: '📋 复制',
    copied: '✓',
    calcTitle: '收入计算器',
    calcDesc: '查看每笔销售中每个人赚多少。MarketNow 收取 20% 佣金，卖家保留 80%，分销商赚取售价的 5%。',
    skillPriceLabel: 'Skill 价格 (USD)',
    rowSeller: '卖家收入 (80%)',
    rowCommission: 'MarketNow 佣金 (20%)',
    rowAffiliate: '分销商赚 (5%)',
    tipLabel: '提示：',
    tipBody: ' 没有付款处理 —— 一切免费。不存在提现。',
    quickLinks: [
      { to: '/submit', icon: '➕', title: '提交 Skill', desc: '把你的 MCP server 卖给 5,000+ agents' },
      { to: '/vault', icon: '📦', title: '我的 Vault', desc: '管理你购买的 skills' },
      { to: '/registry', icon: '🛒', title: '浏览 Registry', desc: '寻找可购买或分销的 skills' },
    ],
  },
  fr: {
    signInRequired: 'CONNEXION REQUISE',
    signInDesc: 'Connectez-vous pour accéder à votre tableau de bord vendeur et affilié.',
    signInBtn: 'SE CONNECTER',
    sellerTitle: 'TABLEAU DE BORD',
    sellerTitleAccent: 'VENDEUR',
    sellerSubtitle: 'Gérez vos skills, suivez vos gains et générez des liens d\'affiliation.',
    affiliateCodeTitle: 'VOTRE CODE D\'AFFILIATION',
    affiliateCodeDescPre: 'Partagez ce code. Quand quelqu\'un achète une skill via votre lien d\'affiliation, vous gagnez ',
    affiliateCodeDescAccent: '5 % du prix de vente',
    affiliateCodeDescPost: '.',
    generateLabel: 'Générer un lien d\'affiliation pour une skill :',
    generateBtn: 'GÉNÉRER',
    affiliateLinkLabel: 'LIEN D\'AFFILIATION',
    copy: '📋 COPIER',
    copied: '✓',
    calcTitle: 'CALCULATEUR DE GAINS',
    calcDesc: 'Voyez combien chacun gagne par vente. MarketNow prend 20 % de commission, les vendeurs gardent 80 %, les affiliés gagnent 5 % du prix de vente.',
    skillPriceLabel: 'Prix de la skill (USD)',
    rowSeller: 'Vendeur reçoit (80 %)',
    rowCommission: 'Commission MarketNow (20 %)',
    rowAffiliate: 'Affilié gagne (5 %)',
    tipLabel: 'Astuce :',
    tipBody: ' Les paiements sont traités mensuellement via Stripe Connect. Seuil minimum de paiement : 50 $.',
    quickLinks: [
      { to: '/submit', icon: '➕', title: 'Soumettre une Skill', desc: 'Vendez votre MCP server à plus de 5 000 agents' },
      { to: '/vault', icon: '📦', title: 'Mon Vault', desc: 'Gérez vos skills achetées' },
      { to: '/registry', icon: '🛒', title: 'Parcourir le Registry', desc: 'Trouvez des skills à acheter ou à affilier' },
    ],
  },
};

export default function Dashboard() {
  const { lang } = useLang();
  const c = CONTENT[lang] || CONTENT.en;

  const [user, setUser] = useState(null);
  const [affiliateCode, setAffiliateCode] = useState('');
  const [skillId, setSkillId] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      const u = getUser();
      setUser(u);
      setAffiliateCode(getMyAffiliateCode(u?.username));
    }
  }, []);

  const handleGenerate = (e) => {
    e.preventDefault();
    if (!skillId.trim()) return;
    setGeneratedUrl(buildAffiliateUrl(skillId.trim(), affiliateCode));
  };

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isAuthenticated()) {
    return (
      <div className="min-h-screen pt-24 pb-16">
        <div className="max-w-[1440px] mx-auto px-6">
          <div className="premium-card p-12 text-center">
            <div className="text-6xl mb-4">🔐</div>
            <h2 className="text-2xl font-bold text-white mb-2">{c.signInRequired}</h2>
            <p className="text-zinc-400 mb-6">{c.signInDesc}</p>
            <Link to="/?login=true" className="inline-block px-8 py-3 bg-[#00F299] text-black font-semibold rounded-xl hover:bg-[#00F299]/90 transition-all">
              {c.signInBtn}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Earnings calculator state
  const [calcPrice, setCalcPrice] = useState(2.99);

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-[1440px] mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="text-4xl font-bold text-white mb-2">
            {c.sellerTitle} <span className="text-[#00F299]">{c.sellerTitleAccent}</span>
          </h1>
          <p className="text-zinc-400">{c.sellerSubtitle}</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Affiliate Code */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="premium-card p-8"
          >
            <h2 className="text-xl font-bold text-white mb-4">{c.affiliateCodeTitle}</h2>
            <p className="text-zinc-400 text-sm mb-6">
              {c.affiliateCodeDescPre}<span className="text-[#00F299]">{c.affiliateCodeDescAccent}</span>{c.affiliateCodeDescPost}
            </p>

            <div className="p-4 rounded-xl bg-black/40 border border-white/5 mb-6">
              <code className="text-[#00F299] text-lg font-mono">{affiliateCode}</code>
            </div>

            <form onSubmit={handleGenerate} className="space-y-3">
              <label className="text-zinc-400 text-sm block">{c.generateLabel}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="mn-ai-00001"
                  value={skillId}
                  onChange={(e) => setSkillId(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:border-[#00F299]/50 focus:outline-none font-mono text-sm"
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-[#00F299] text-black font-bold rounded-xl hover:bg-[#00F299]/90 transition-all"
                >
                  {c.generateBtn}
                </button>
              </div>
            </form>

            {generatedUrl && (
              <div className="mt-4 p-4 rounded-xl bg-[#00F299]/5 border border-[#00F299]/20">
                <div className="text-[10px] text-zinc-500 font-mono mb-2">{c.affiliateLinkLabel}</div>
                <div className="flex items-center gap-2">
                  <code className="text-white text-xs font-mono break-all flex-1">{generatedUrl}</code>
                  <button
                    onClick={() => copy(generatedUrl)}
                    className="px-3 py-1 rounded-lg bg-[#00F299]/10 text-[#00F299] text-xs font-mono hover:bg-[#00F299]/20 transition-all shrink-0"
                  >
                    {copied ? c.copied : c.copy}
                  </button>
                </div>
              </div>
            )}
          </motion.div>

          {/* Earnings Calculator */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="premium-card p-8"
          >
            <h2 className="text-xl font-bold text-white mb-4">{c.calcTitle}</h2>
            <p className="text-zinc-400 text-sm mb-6">
              {c.calcDesc}
            </p>

            <div className="mb-6">
              <label className="text-zinc-400 text-sm block mb-2">{c.skillPriceLabel}</label>
              <input
                type="range"
                min="0"
                max="9.99"
                step="0.01"
                value={calcPrice}
                onChange={(e) => setCalcPrice(parseFloat(e.target.value))}
                className="w-full accent-[#00F299]"
              />
              <div className="text-3xl font-bold text-white font-mono mt-2">${calcPrice.toFixed(2)}</div>
            </div>

            <div className="space-y-3">
              {[
                { label: c.rowSeller, value: calculateSellerEarnings(calcPrice), color: 'text-[#00F299]', icon: '💰' },
                { label: c.rowCommission, value: calculateCommission(calcPrice), color: 'text-white', icon: '🏢' },
                { label: c.rowAffiliate, value: calculateAffiliatePayout(calcPrice), color: 'text-[#00d1ff]', icon: '🤝' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{row.icon}</span>
                    <span className="text-zinc-400 text-sm">{row.label}</span>
                  </div>
                  <span className={`text-lg font-bold font-mono ${row.color}`}>
                    ${row.value.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 p-3 rounded-lg bg-[#00F299]/5 border border-[#00F299]/20 text-xs text-zinc-400 leading-relaxed">
              💡 <strong className="text-[#00F299]">{c.tipLabel}</strong>{c.tipBody}
            </div>
          </motion.div>
        </div>

        {/* Quick links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {c.quickLinks.map((card) => (
            <Link
              key={card.to}
              to={card.to}
              className="premium-card p-5 hover:border-[#00F299]/30 transition-all group"
            >
              <div className="text-3xl mb-3">{card.icon}</div>
              <h3 className="text-white font-semibold text-sm mb-1 group-hover:text-[#00F299] transition-colors">{card.title}</h3>
              <p className="text-zinc-400 text-xs">{card.desc}</p>
            </Link>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
