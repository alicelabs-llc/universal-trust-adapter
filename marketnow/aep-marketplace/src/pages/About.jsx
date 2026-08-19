import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT — full page in 5 languages (en, es, pt, zh, fr)
// ═══════════════════════════════════════════════════════════════════════════
const CONTENT = {
  en: {
    badge: 'ABOUT · ALICELABS LLC',
    companyHeading: 'Company',
    legalNameLabel: 'Legal name',
    founderLabel: 'Founder',
    countryLabel: 'Country',
    countryValue: 'Wyoming, USA 🇪🇨 (founder origin)',
    foundedLabel: 'Founded',
    foundedValue: 'AliceLabs LLC 2025 · MarketNow launched 2026',
    emailLabel: 'Email',
    domainLabel: 'Domain',
    accountsHeading: 'Public accounts',
    githubTitle: 'GitHub Org — alicelabs-llc (15 repos)',
    githubDesc: '15 public repos. Real org with 3 members. Wyoming LLC.',
    npmTitle: 'npm — marketnow-mcp',
    npmDesc: 'Our MCP server package. Download counts are public.',
    smitheryTitle: 'Smithery — alicelabs/marketnow',
    smitheryDescPre: 'Smithery registry listing with quality score (',
    smitheryLink: '84/100 — verify ↗',
    smitheryDescPost: ').',
    walletTitle: 'Payment wallet (Base L2)',
    walletDesc: 'All USDC payments go here. Auditable on Basescan.',
    whatNotHeading: 'What we are not',
    whatNot: [
      'We are a Wyoming-registered LLC (AliceLabs LLC) with a public GitHub organization (github.com/alicelabs-llc) — not a side project or hobby. We have no VC backing, but we are a real company with real infrastructure.',
      { pre: 'We are not a security firm. Our Sentinel audit is automated and self-declared — see ', linkText: '/trust', linkTo: '/trust', post: ' for the disclosure.' },
      'We do not have a sustained track record yet. We launched in 2026. Trust is earned over time, not claimed.',
      'We do not have third-party press coverage yet. We are working on it.',
      'We do not have a bug bounty program yet (private one running; public launch when 1,000 active mandates exist).',
    ],
    whatWeHeading: 'What we are',
    whatWe: [
      'Open source — MNNC-1.0 licensed, full code on GitHub, every change is a public commit',
      'Transparent — every mandate spend is a git commit visible at _data/mandates/',
      { pre: 'Honest — our ', linkText: 'trust roadmap', linkTo: '/trust', post: ' admits what is done, partial, and pending.' },
      'Agent-native — our API and MCP server are designed for AI consumption, not just humans',
      'Human-first defaults — mandates notify the principal by default; "silent" mode requires explicit opt-in',
    ],
    contactHeading: 'Contact',
    contactBody: 'For disputes, security disclosures, or business inquiries:',
    contactBtn: 'info@alicelabs.site →',
    contactFootnote: 'PGP key available on request. Security disclosures accepted via encrypted email; we will acknowledge within 48h.',
    backToTrust: '← Back to trust roadmap',
  },

  es: {
    badge: 'ACERCA DE · ALICELABS LLC',
    companyHeading: 'Empresa',
    legalNameLabel: 'Razón social',
    founderLabel: 'Fundador',
    countryLabel: 'País',
    countryValue: 'Wyoming, USA 🇪🇨 (origen del fundador)',
    foundedLabel: 'Fundada',
    foundedValue: 'AliceLabs LLC 2025 · MarketNow lanzado en 2026',
    emailLabel: 'Email',
    domainLabel: 'Dominio',
    accountsHeading: 'Cuentas públicas',
    githubTitle: 'GitHub Org — alicelabs-llc (15 repos)',
    githubDesc: '15 repos públicos. Org real con 3 miembros. Wyoming LLC.',
    npmTitle: 'npm — marketnow-mcp',
    npmDesc: 'Nuestro paquete de MCP server. Los conteos de descarga son públicos.',
    smitheryTitle: 'Smithery — alicelabs/marketnow',
    smitheryDescPre: 'Listado del registro de Smithery con quality score (',
    smitheryLink: '84/100 — verificar ↗',
    smitheryDescPost: ').',
    walletTitle: 'Wallet de pago (Base L2)',
    walletDesc: 'Todos los pagos USDC van aquí. Auditable en Basescan.',
    whatNotHeading: 'Lo que no somos',
    whatNot: [
      'Somos una LLC registrada en Wyoming (AliceLabs LLC) con una organización pública de GitHub (github.com/alicelabs-llc) — no un side project o hobby. No tenemos VC backing, pero somos una empresa real con infraestructura real.',
      { pre: 'No somos una firma de seguridad. Nuestra auditoría Sentinel es automatizada y auto-declarada — ver ', linkText: '/trust', linkTo: '/trust', post: ' para la divulgación.' },
      'Aún no tenemos un track record sostenido. Lanzamos en 2026. La confianza se gana con el tiempo, no se reclama.',
      'Aún no tenemos cobertura de prensa de terceros. Estamos trabajando en ello.',
      'Aún no tenemos programa de bug bounty (uno privado corriendo; lanzamiento público cuando existan 1,000 mandatos activos).',
    ],
    whatWeHeading: 'Lo que somos',
    whatWe: [
      'Open source — licencia MNNC-1.0, código completo en GitHub, cada cambio es un commit público',
      'Transparente — cada gasto de mandato es un git commit visible en _data/mandates/',
      { pre: 'Honestos — nuestra ', linkText: 'hoja de confianza', linkTo: '/trust', post: ' admite qué está hecho, parcial y pendiente.' },
      'Agent-native — nuestra API y MCP server están diseñados para consumo de IA, no solo humanos',
      'Defaults human-first — los mandatos notifican al principal por defecto; el modo "silent" requiere opt-in explícito',
    ],
    contactHeading: 'Contacto',
    contactBody: 'Para disputas, divulgaciones de seguridad o consultas comerciales:',
    contactBtn: 'info@alicelabs.site →',
    contactFootnote: 'Clave PGP disponible bajo solicitud. Divulgaciones de seguridad aceptadas vía email encriptado; acusamos recibo dentro de 48h.',
    backToTrust: '← Volver a la hoja de confianza',
  },

  pt: {
    badge: 'SOBRE · ALICELABS LLC',
    companyHeading: 'Empresa',
    legalNameLabel: 'Razão social',
    founderLabel: 'Fundador',
    countryLabel: 'País',
    countryValue: 'Wyoming, USA 🇪🇨 (origem do fundador)',
    foundedLabel: 'Fundada',
    foundedValue: 'AliceLabs LLC 2025 · MarketNow lançado em 2026',
    emailLabel: 'Email',
    domainLabel: 'Domínio',
    accountsHeading: 'Contas públicas',
    githubTitle: 'GitHub Org — alicelabs-llc (15 repos)',
    githubDesc: '15 repos públicos. Org real com 3 membros. Wyoming LLC.',
    npmTitle: 'npm — marketnow-mcp',
    npmDesc: 'Nosso pacote de MCP server. Contagens de download são públicas.',
    smitheryTitle: 'Smithery — alicelabs/marketnow',
    smitheryDescPre: 'Listagem do registro Smithery com quality score (',
    smitheryLink: '84/100 — verificar ↗',
    smitheryDescPost: ').',
    walletTitle: 'Wallet de pagamento (Base L2)',
    walletDesc: 'Todos os pagamentos USDC vão para aqui. Auditável no Basescan.',
    whatNotHeading: 'O que não somos',
    whatNot: [
      'Somos uma LLC registrada no Wyoming (AliceLabs LLC) com uma organização pública no GitHub (github.com/alicelabs-llc) — não um side project ou hobby. Não temos VC backing, mas somos uma empresa real com infraestrutura real.',
      { pre: 'Não somos uma firma de segurança. Nossa auditoria Sentinel é automatizada e auto-declarada — ver ', linkText: '/trust', linkTo: '/trust', post: ' para a divulgação.' },
      'Ainda não temos um track record sustentado. Lançamos em 2026. Confiança se ganha com o tempo, não se reivindica.',
      'Ainda não temos cobertura de imprensa de terceiros. Estamos trabalhando nisso.',
      'Ainda não temos programa de bug bounty (um privado rodando; lançamento público quando existirem 1.000 mandatos ativos).',
    ],
    whatWeHeading: 'O que somos',
    whatWe: [
      'Open source — licenciado MNNC-1.0, código completo no GitHub, cada mudança é um commit público',
      'Transparente — cada gasto de mandato é um git commit visível em _data/mandates/',
      { pre: 'Honestos — nossa ', linkText: 'trilha de confiança', linkTo: '/trust', post: ' admite o que está feito, parcial e pendente.' },
      'Agent-native — nossa API e MCP server são projetados para consumo de IA, não apenas humanos',
      'Defaults human-first — mandatos notificam o principal por padrão; o modo "silent" exige opt-in explícito',
    ],
    contactHeading: 'Contato',
    contactBody: 'Para disputas, divulgações de segurança ou consultas comerciais:',
    contactBtn: 'info@alicelabs.site →',
    contactFootnote: 'Chave PGP disponível mediante solicitação. Divulgações de segurança aceitas via email criptografado; confirmamos recebimento em até 48h.',
    backToTrust: '← Voltar à trilha de confiança',
  },

  zh: {
    badge: '关于 · ALICELABS LLC',
    companyHeading: '公司',
    legalNameLabel: '法定名称',
    founderLabel: '创始人',
    countryLabel: '国家',
    countryValue: '美国怀俄明州 🇪🇨（创始人籍贯）',
    foundedLabel: '成立时间',
    foundedValue: 'AliceLabs LLC 2025 · MarketNow 于 2026 年上线',
    emailLabel: '邮箱',
    domainLabel: '域名',
    accountsHeading: '公开账户',
    githubTitle: 'GitHub 组织 — alicelabs-llc（15 个仓库）',
    githubDesc: '15 个公开仓库。真实组织，3 名成员。怀俄明州 LLC。',
    npmTitle: 'npm — marketnow-mcp',
    npmDesc: '我们的 MCP server 包。下载数据公开可查。',
    smitheryTitle: 'Smithery — alicelabs/marketnow',
    smitheryDescPre: 'Smithery 注册列表及质量评分（',
    smitheryLink: '84/100 — 核验 ↗',
    smitheryDescPost: '）。',
    walletTitle: '支付钱包（Base L2）',
    walletDesc: '所有 USDC 支付均汇入此地址。可在 Basescan 上审计。',
    whatNotHeading: '我们不是什么',
    whatNot: [
      '我们是怀俄明州注册的 LLC（AliceLabs LLC），拥有公开的 GitHub 组织（github.com/alicelabs-llc）——不是副业或爱好。我们没有 VC 投资，但我们是一家拥有真实基础设施的真实公司。',
      { pre: '我们不是安全公司。我们的 Sentinel 审计是自动化且自我声明的——参见 ', linkText: '/trust', linkTo: '/trust', post: ' 的披露说明。' },
      '我们目前还没有持续的运营记录。我们于 2026 年上线。信任是随时间积累的，而非自封的。',
      '我们目前还没有第三方媒体报道。我们正在努力。',
      '我们目前还没有 Bug 赏金计划（已运行私有计划；当达到 1,000 个活跃 mandate 时将公开发布）。',
    ],
    whatWeHeading: '我们是什么',
    whatWe: [
      '开源 —— 采用 MNNC-1.0 许可，全部代码在 GitHub 上，每一次改动都是公开的 commit',
      '透明 —— 每一笔 mandate 支出都是一个 git commit，可在 _data/mandates/ 查看',
      { pre: '诚实 —— 我们的 ', linkText: '信任路线图', linkTo: '/trust', post: ' 坦诚承认哪些已完成、部分完成、尚未开始。' },
      'Agent 原生 —— 我们的 API 和 MCP server 是为 AI 消费而设计的，不仅服务于人类',
      '以人为本的默认设置 —— mandate 默认通知 principal；"silent" 模式需显式 opt-in',
    ],
    contactHeading: '联系方式',
    contactBody: '如有争议、安全披露或商务咨询：',
    contactBtn: 'info@alicelabs.site →',
    contactFootnote: '可按需提供 PGP 密钥。安全披露请通过加密邮件提交；我们将在 48 小时内确认收到。',
    backToTrust: '← 返回信任路线图',
  },

  fr: {
    badge: 'À PROPOS · ALICELABS LLC',
    companyHeading: 'Entreprise',
    legalNameLabel: 'Raison sociale',
    founderLabel: 'Fondateur',
    countryLabel: 'Pays',
    countryValue: 'Wyoming, USA 🇪🇨 (origine du fondateur)',
    foundedLabel: 'Fondée',
    foundedValue: 'AliceLabs LLC 2025 · MarketNow lancé en 2026',
    emailLabel: 'Email',
    domainLabel: 'Domaine',
    accountsHeading: 'Comptes publics',
    githubTitle: 'GitHub Org — alicelabs-llc (15 dépôts)',
    githubDesc: '15 dépôts publics. Organisation réelle avec 3 membres. Wyoming LLC.',
    npmTitle: 'npm — marketnow-mcp',
    npmDesc: 'Notre paquet MCP server. Les compteurs de téléchargement sont publics.',
    smitheryTitle: 'Smithery — alicelabs/marketnow',
    smitheryDescPre: 'Liste du registre Smithery avec score de qualité (',
    smitheryLink: '84/100 — vérifier ↗',
    smitheryDescPost: ').',
    walletTitle: 'Wallet de paiement (Base L2)',
    walletDesc: 'Tous les paiements USDC arrivent ici. Auditable sur Basescan.',
    whatNotHeading: 'Ce que nous ne sommes pas',
    whatNot: [
      'Nous sommes une LLC enregistrée au Wyoming (AliceLabs LLC) avec une organisation GitHub publique (github.com/alicelabs-llc) — pas un projet parallèle ou un hobby. Nous n\'avons pas de VC, mais nous sommes une vraie entreprise avec une vraie infrastructure.',
      { pre: 'Nous ne sommes pas une firme de sécurité. Notre audit Sentinel est automatisé et auto-déclaré — voir ', linkText: '/trust', linkTo: '/trust', post: ' pour la divulgation.' },
      'Nous n\'avons pas encore d\'historique soutenu. Nous avons lancé en 2026. La confiance se gagne avec le temps, elle ne se revendique pas.',
      'Nous n\'avons pas encore de couverture presse tierce. Nous y travaillons.',
      'Nous n\'avons pas encore de programme de bug bounty (un privé tourne ; lancement public à 1 000 mandats actifs).',
    ],
    whatWeHeading: 'Ce que nous sommes',
    whatWe: [
      'Open source — licence MNNC-1.0, code complet sur GitHub, chaque changement est un commit public',
      'Transparent — chaque dépense de mandat est un git commit visible sur _data/mandates/',
      { pre: 'Honnêtes — notre ', linkText: 'feuille de confiance', linkTo: '/trust', post: ' admet ce qui est fait, partiel et en attente.' },
      'Agent-native — notre API et MCP server sont conçus pour la consommation IA, pas seulement humaine',
      'Defaults human-first — les mandats notifient le principal par défaut ; le mode "silent" exige un opt-in explicite',
    ],
    contactHeading: 'Contact',
    contactBody: 'Pour litiges, divulgations de sécurité ou demandes commerciales :',
    contactBtn: 'info@alicelabs.site →',
    contactFootnote: 'Clé PGP disponible sur demande. Divulgations de sécurité acceptées par email chiffré ; nous accusons réception sous 48h.',
    backToTrust: '← Retour à la feuille de confiance',
  },
};

// Helper: render a list item that may contain an inline Link
function ListItem({ item, markerClass, marker }) {
  if (typeof item === 'string') {
    return (
      <li className="flex gap-2">
        <span className={markerClass}>{marker}</span>
        <span>{item}</span>
      </li>
    );
  }
  return (
    <li className="flex gap-2">
      <span className={markerClass}>{marker}</span>
      <span>
        {item.pre}
        <Link to={item.linkTo} className="text-[#00F299] hover:underline">{item.linkText}</Link>
        {item.post}
      </span>
    </li>
  );
}

export default function About() {
  const { t, lang } = useLang();
  const c = CONTENT[lang] || CONTENT.en;
  return (
    <div className="min-h-screen pt-20 pb-20 px-4 md:px-8">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00F299]/10 border border-[#00F299]/20 mb-4">
            <span className="text-[#00F299] text-[10px] font-mono tracking-wider">{c.badge}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">{t('about.title')}</h1>
          <p className="text-zinc-400 text-lg">
            {t('about.companyDesc')}
          </p>
        </motion.div>

        {/* Identity card */}
        <div className="premium-card p-6 mb-8">
          <h2 className="text-white text-sm font-mono tracking-wider mb-4 uppercase">{c.companyHeading}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-zinc-500 text-xs mb-1">{c.legalNameLabel}</div>
              <div className="text-white">AliceLabs LLC</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs mb-1">{c.founderLabel}</div>
              <div className="text-white">Edison Flores</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs mb-1">{c.countryLabel}</div>
              <div className="text-white">{c.countryValue}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs mb-1">{c.foundedLabel}</div>
              <div className="text-white">{c.foundedValue}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs mb-1">{c.emailLabel}</div>
              <a href="mailto:info@alicelabs.site" className="text-[#00F299] hover:underline">info@alicelabs.site</a>
            </div>
            <div>
              <div className="text-zinc-500 text-xs mb-1">{c.domainLabel}</div>
              <a href="https://marketnow.site" className="text-[#00F299] hover:underline">marketnow.site</a>
            </div>
          </div>
        </div>

        {/* Public accounts */}
        <div className="premium-card p-6 mb-8">
          <h2 className="text-white text-sm font-mono tracking-wider mb-4 uppercase">{c.accountsHeading}</h2>
          <div className="space-y-3">
            <a
              href="https://github.com/edgarfloresguerra2011-a11y/marketnow"
              target="_blank"
              rel="noopener"
              className="block p-4 rounded-lg bg-black/40 hover:bg-black/60 transition-colors"
            >
              <div className="text-white text-sm font-bold">{c.githubTitle}</div>
              <div className="text-zinc-500 text-xs">{c.githubDesc}</div>
            </a>
            <a
              href="https://www.npmjs.com/package/marketnow-mcp"
              target="_blank"
              rel="noopener"
              className="block p-4 rounded-lg bg-black/40 hover:bg-black/60 transition-colors"
            >
              <div className="text-white text-sm font-bold">{c.npmTitle}</div>
              <div className="text-zinc-500 text-xs">{c.npmDesc}</div>
            </a>
            <a
              href="https://smithery.ai/servers/alicelabs/marketnow"
              target="_blank"
              rel="noopener"
              className="block p-4 rounded-lg bg-black/40 hover:bg-black/60 transition-colors"
            >
              <div className="text-white text-sm font-bold">{c.smitheryTitle}</div>
              <div className="text-zinc-500 text-xs">
                {c.smitheryDescPre}
                <a href="https://smithery.ai/servers/alicelabs/marketnow" target="_blank" rel="noopener" className="text-[#00F299] hover:underline">{c.smitheryLink}</a>
                {c.smitheryDescPost}
              </div>
            </a>
            <div className="p-4 rounded-lg bg-black/40">
              <div className="text-white text-sm font-bold">{c.walletTitle}</div>
              <div className="text-zinc-500 text-xs font-mono break-all mt-1">0x39Dddf5aEdb58A559CF195fB8bdF23F0604Bf5Ee</div>
              <div className="text-zinc-600 text-[10px] mt-1">{c.walletDesc}</div>
            </div>
          </div>
        </div>

        {/* What we are not */}
        <div className="premium-card p-6 mb-8">
          <h2 className="text-white text-sm font-mono tracking-wider mb-4 uppercase">{c.whatNotHeading}</h2>
          <ul className="space-y-2 text-sm text-zinc-400">
            {c.whatNot.map((item, i) => (
              <ListItem key={i} item={item} markerClass="text-red-400" marker="✗" />
            ))}
          </ul>
        </div>

        {/* What we are */}
        <div className="premium-card p-6 mb-8">
          <h2 className="text-white text-sm font-mono tracking-wider mb-4 uppercase">{c.whatWeHeading}</h2>
          <ul className="space-y-2 text-sm text-zinc-400">
            {c.whatWe.map((item, i) => (
              <ListItem key={i} item={item} markerClass="text-[#00F299]" marker="✓" />
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div className="premium-card p-6">
          <h2 className="text-white text-sm font-mono tracking-wider mb-3 uppercase">{c.contactHeading}</h2>
          <p className="text-zinc-400 text-sm mb-3">
            {c.contactBody}
          </p>
          <a
            href="mailto:info@alicelabs.site?subject=MarketNow%20inquiry"
            className="inline-block px-5 py-3 bg-[#00F299] text-black font-bold rounded-lg hover:bg-[#00F299]/90 transition-all text-sm"
          >
            {c.contactBtn}
          </a>
          <p className="text-zinc-600 text-[10px] mt-3">
            {c.contactFootnote}
          </p>
        </div>

        <div className="mt-8 text-center">
          <Link to="/trust" className="text-[#00F299] text-sm hover:underline">{c.backToTrust}</Link>
        </div>
      </div>
    </div>
  );
}
