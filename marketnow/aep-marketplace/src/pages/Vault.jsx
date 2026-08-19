import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLang } from '../context/LanguageContext.jsx';
import { isAuthenticated, getUser } from '../api/client';
import { Link } from 'react-router-dom';

/**
 * MarketNow — Vault (static version with Stripe redirect handling)
 *
 * Detects Stripe checkout success redirect (?success=true&skillId=X&sessionId=Y)
 * and saves the purchase to localStorage so it appears in the vault.
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT — all visible UI strings in 5 languages
// ═══════════════════════════════════════════════════════════════════════════
const CONTENT = {
  en: {
    lockedTitle: 'VAULT LOCKED',
    lockedDesc: 'Sign in to access your purchased skills',
    signInBtn: 'SIGN IN',
    paymentTitle: 'PAYMENT SUCCESSFUL!',
    paymentDescPre: 'Your purchase of skill ',
    paymentDescPost: ' has been confirmed.',
    sessionLabel: 'Session',
    savePrompt: 'Sign in to permanently save this purchase to your vault and get your license key.',
    signInSaveBtn: 'SIGN IN TO SAVE',
    title: 'MY',
    titleAccent: 'VAULT',
    subtitle: 'Manage your purchased skills and licenses',
    skillCountSingular: '{n} skill purchased',
    skillCountPlural: '{n} skills purchased',
    bannerPaymentTitle: 'PAYMENT SUCCESSFUL!',
    bannerPaymentPre: 'Your purchase of skill ',
    bannerPaymentMid: ' has been confirmed. Session ID: ',
    bannerPaymentPost: '...',
    emptyTitle: 'Your Vault is Empty',
    emptyDesc: 'Purchase skills from the registry to see them here',
    browseBtn: 'BROWSE REGISTRY',
    unknownSkill: 'Unknown skill',
    statusActive: 'Active',
    purchasedLabel: 'PURCHASED',
  },
  es: {
    lockedTitle: 'VAULT BLOQUEADO',
    lockedDesc: 'Inicia sesión para acceder a tus skills compradas',
    signInBtn: 'INICIAR SESIÓN',
    paymentTitle: '¡PAGO EXITOSO!',
    paymentDescPre: 'Tu compra de la skill ',
    paymentDescPost: ' ha sido confirmada.',
    sessionLabel: 'Sesión',
    savePrompt: 'Inicia sesión para guardar permanentemente esta compra en tu vault y obtener tu license key.',
    signInSaveBtn: 'INICIAR SESIÓN PARA GUARDAR',
    title: 'MI',
    titleAccent: 'VAULT',
    subtitle: 'Administra tus skills compradas y licencias',
    skillCountSingular: '{n} skill comprada',
    skillCountPlural: '{n} skills compradas',
    bannerPaymentTitle: '¡PAGO EXITOSO!',
    bannerPaymentPre: 'Tu compra de la skill ',
    bannerPaymentMid: ' ha sido confirmada. Session ID: ',
    bannerPaymentPost: '...',
    emptyTitle: 'Tu Vault Está Vacío',
    emptyDesc: 'Compra skills del registro para verlas aquí',
    browseBtn: 'EXPLORAR REGISTRO',
    unknownSkill: 'Skill desconocida',
    statusActive: 'Activa',
    purchasedLabel: 'COMPRADA',
  },
  pt: {
    lockedTitle: 'VAULT BLOQUEADO',
    lockedDesc: 'Entre na conta para acessar suas skills compradas',
    signInBtn: 'ENTRAR',
    paymentTitle: 'PAGAMENTO BEM-SUCEDIDO!',
    paymentDescPre: 'Sua compra da skill ',
    paymentDescPost: ' foi confirmada.',
    sessionLabel: 'Sessão',
    savePrompt: 'Entre na conta para salvar permanentemente esta compra no seu vault e obter sua license key.',
    signInSaveBtn: 'ENTRAR PARA SALVAR',
    title: 'MEU',
    titleAccent: 'VAULT',
    subtitle: 'Gerencie suas skills compradas e licenças',
    skillCountSingular: '{n} skill comprada',
    skillCountPlural: '{n} skills compradas',
    bannerPaymentTitle: 'PAGAMENTO BEM-SUCEDIDO!',
    bannerPaymentPre: 'Sua compra da skill ',
    bannerPaymentMid: ' foi confirmada. Session ID: ',
    bannerPaymentPost: '...',
    emptyTitle: 'Seu Vault Está Vazio',
    emptyDesc: 'Compre skills do registro para vê-las aqui',
    browseBtn: 'EXPLORAR REGISTRO',
    unknownSkill: 'Skill desconhecida',
    statusActive: 'Ativa',
    purchasedLabel: 'COMPRADA',
  },
  zh: {
    lockedTitle: 'VAULT 已锁定',
    lockedDesc: '登录以访问你购买的 skills',
    signInBtn: '登录',
    paymentTitle: '付款成功！',
    paymentDescPre: '你对 skill ',
    paymentDescPost: ' 的购买已确认。',
    sessionLabel: '会话',
    savePrompt: '登录以永久保存此次购买到你的 vault 并获取你的 license key。',
    signInSaveBtn: '登录以保存',
    title: '我的',
    titleAccent: 'VAULT',
    subtitle: '管理你购买的 skills 和许可证',
    skillCountSingular: '已购买 {n} 个 skill',
    skillCountPlural: '已购买 {n} 个 skills',
    bannerPaymentTitle: '付款成功！',
    bannerPaymentPre: '你对 skill ',
    bannerPaymentMid: ' 的购买已确认。Session ID: ',
    bannerPaymentPost: '...',
    emptyTitle: '你的 Vault 是空的',
    emptyDesc: '从 registry 购买 skills 即可在此处查看',
    browseBtn: '浏览 REGISTRY',
    unknownSkill: '未知 skill',
    statusActive: '有效',
    purchasedLabel: '购买于',
  },
  fr: {
    lockedTitle: 'VAULT VERROUILLÉ',
    lockedDesc: 'Connectez-vous pour accéder à vos skills achetées',
    signInBtn: 'SE CONNECTER',
    paymentTitle: 'PAIEMENT RÉUSSI !',
    paymentDescPre: 'Votre achat de la skill ',
    paymentDescPost: ' a été confirmé.',
    sessionLabel: 'Session',
    savePrompt: 'Connectez-vous pour sauvegarder définitivement cet achat dans votre vault et obtenir votre license key.',
    signInSaveBtn: 'SE CONNECTER POUR SAUVEGARDER',
    title: 'MON',
    titleAccent: 'VAULT',
    subtitle: 'Gérez vos skills achetées et vos licences',
    skillCountSingular: '{n} skill achetée',
    skillCountPlural: '{n} skills achetées',
    bannerPaymentTitle: 'PAIEMENT RÉUSSI !',
    bannerPaymentPre: 'Votre achat de la skill ',
    bannerPaymentMid: ' a été confirmé. Session ID : ',
    bannerPaymentPost: '...',
    emptyTitle: 'Votre Vault Est Vide',
    emptyDesc: 'Achetez des skills depuis le registre pour les voir ici',
    browseBtn: 'PARCOURIR LE REGISTRE',
    unknownSkill: 'Skill inconnue',
    statusActive: 'Active',
    purchasedLabel: 'ACHETÉ',
  },
};

// Template helper — {var} substitution
function fmt(str, vars) {
  let out = str;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return out;
}

export default function Vault() {
  const { lang } = useLang();
  const c = CONTENT[lang] || CONTENT.en;

  const [purchases, setPurchases] = useState([]);
  const [user, setUser] = useState(null);
  const [justPurchased, setJustPurchased] = useState(null);

  useEffect(() => {
    if (isAuthenticated()) {
      setUser(getUser());
    }

    // Check if we're returning from a successful Stripe checkout
    // (works even without login — Stripe redirects everyone here)
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success') === 'true';
    const skillId = params.get('skillId');
    const sessionId = params.get('sessionId');

    if (success && skillId) {
      // SECURITY FIX: Verify the purchase with the server before trusting it.
      // Previously, this just read ?success=true from the URL and saved it to
      // localStorage — anyone could fake the URL params and get free access.
      // Now we call /api/verify-purchase which checks the real Stripe session
      // and only saves to localStorage if the server confirms payment.
      (async () => {
        try {
          const verifyRes = await fetch(`/api/verify-purchase?sessionId=${encodeURIComponent(sessionId || '')}`);
          if (!verifyRes.ok) {
            console.warn('Purchase verification failed:', verifyRes.status);
            setJustPurchased({ skillId, status: 'Verification Failed', error: 'Server rejected purchase' });
            return;
          }
          const verifyData = await verifyRes.json();
          if (!verifyData.verified) {
            console.warn('Purchase not verified by server:', verifyData);
            setJustPurchased({ skillId, status: 'Verification Failed', error: verifyData.error || 'Not verified' });
            return;
          }

          // Server confirmed the purchase — save to localStorage
          const raw = localStorage.getItem('mn_purchases');
          const existing = raw ? JSON.parse(raw) : [];

          if (!existing.find(p => p.sessionId === sessionId)) {
            const newPurchase = {
              id: sessionId || `pur_${Date.now()}`,
              skillId,
              sessionId,
              purchasedAt: new Date().toISOString(),
              status: 'Active',
              licenseKey: verifyData.licenseKey || null,
              verified: true,
            };
            existing.push(newPurchase);
            localStorage.setItem('mn_purchases', JSON.stringify(existing));
            setJustPurchased(newPurchase);
          }
        } catch (e) {
          console.error('Error verifying purchase:', e);
          setJustPurchased({ skillId, status: 'Verification Error', error: e.message });
        }
      })();

      // Clean the URL (remove ?success=true&skillId=X&sessionId=Y)
      params.delete('success');
      params.delete('skillId');
      params.delete('sessionId');
      const remaining = params.toString();
      const newUrl = window.location.pathname + (remaining ? '?' + remaining : '');
      window.history.replaceState({}, '', newUrl);
    }

    // Load all purchases (even if not authenticated — for Stripe redirect flow)
    try {
      const raw = localStorage.getItem('mn_purchases');
      setPurchases(raw ? JSON.parse(raw) : []);
    } catch {
      setPurchases([]);
    }
  }, []);

  if (!isAuthenticated() && !justPurchased) {
    return (
      <div className="min-h-screen pt-24 pb-16">
        <div className="max-w-[1440px] mx-auto px-6">
          <div className="premium-card p-12 text-center">
            <div className="text-6xl mb-4">🔐</div>
            <h2 className="text-2xl font-bold text-white mb-2">{c.lockedTitle}</h2>
            <p className="text-zinc-400 mb-6">{c.lockedDesc}</p>
            <Link to="/?login=true" className="inline-block px-8 py-3 bg-[#00F299] text-black font-semibold rounded-xl hover:bg-[#00F299]/90 transition-all">
              {c.signInBtn}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // If just purchased but not authenticated, show success + ask to sign in to save
  if (!isAuthenticated() && justPurchased) {
    return (
      <div className="min-h-screen pt-24 pb-16">
        <div className="max-w-[1440px] mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="premium-card p-12 text-center"
          >
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-[#00F299] mb-2">{c.paymentTitle}</h2>
            <p className="text-zinc-400 mb-2">
              {c.paymentDescPre}<code className="text-white font-mono">{justPurchased.skillId}</code>{c.paymentDescPost}
            </p>
            <p className="text-zinc-500 text-xs mb-6 font-mono">
              {c.sessionLabel}: {justPurchased.sessionId?.slice(0, 40)}...
            </p>
            <p className="text-zinc-400 text-sm mb-6">
              {c.savePrompt}
            </p>
            <Link to="/?login=true" className="inline-block px-8 py-3 bg-[#00F299] text-black font-semibold rounded-xl hover:bg-[#00F299]/90 transition-all">
              {c.signInSaveBtn}
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-[1440px] mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {c.title} <span className="text-[#00F299]">{c.titleAccent}</span>
            </h1>
            <p className="text-zinc-400 text-sm">
              {c.subtitle}
            </p>
          </div>
          {user && (
            <div className="text-right">
              <div className="text-[#00F299] text-sm font-semibold">{user.username}</div>
              <div className="text-zinc-500 text-xs font-mono">
                {fmt(purchases.length === 1 ? c.skillCountSingular : c.skillCountPlural, { n: purchases.length })}
              </div>
            </div>
          )}
        </motion.div>

        {/* Success banner after Stripe checkout */}
        {justPurchased && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-5 rounded-xl bg-[#00F299]/10 border border-[#00F299]/30 flex items-center gap-4"
          >
            <span className="text-3xl">✅</span>
            <div>
              <h3 className="text-[#00F299] font-bold text-sm">{c.bannerPaymentTitle}</h3>
              <p className="text-zinc-400 text-xs mt-1">
                {c.bannerPaymentPre}<code className="text-white">{justPurchased.skillId}</code>{c.bannerPaymentMid}<code className="text-zinc-500">{justPurchased.sessionId?.slice(0, 30)}</code>{c.bannerPaymentPost}
              </p>
            </div>
          </motion.div>
        )}

        {purchases.length === 0 ? (
          <div className="premium-card p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-xl font-semibold text-white mb-2">{c.emptyTitle}</h2>
            <p className="text-zinc-400 mb-6">{c.emptyDesc}</p>
            <Link to="/registry" className="inline-block px-8 py-3 bg-[#00F299] text-black font-semibold rounded-xl hover:bg-[#00F299]/90 transition-all">
              {c.browseBtn}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {purchases.map((p, i) => (
              <motion.div
                key={p.id || i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="premium-card p-5 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="text-3xl">{p.skill?.icon || '🧩'}</div>
                  <div>
                    <h3 className="text-white font-semibold">{p.skillName || p.skillId || c.unknownSkill}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[#00F299] text-xs font-mono">{p.license || 'N/A'}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                        p.status === 'Active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-zinc-500/10 text-zinc-400'
                      }`}>
                        {p.status === 'Active' ? c.statusActive : (p.status || c.statusActive)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-zinc-500 text-[10px] font-mono">{c.purchasedLabel}</div>
                  <div className="text-zinc-400 text-xs">{p.purchasedAt ? new Date(p.purchasedAt).toLocaleDateString() : '—'}</div>
                  {typeof p.price === 'number' && (
                    <div className="text-[#00F299] text-xs font-mono mt-1">${p.price.toFixed(2)}</div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
