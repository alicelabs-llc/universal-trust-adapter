import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';

// Badge data — SVG content, markdown, and HTML are literal code snippets
// served to all users (brand names like MarketNow / Sentinel / MNNC-1.0
// stay English inside the SVG). The friendly `label` is translated per
// language via CONTENT[lang].badgeLabels[id].
const BADGES = [
  {
    id: 'powered-by',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="28" viewBox="0 0 180 28"><rect width="180" height="28" rx="4" fill="#050505" stroke="#00F299"/><rect width="90" height="28" rx="4" fill="#00F299"/><text x="45" y="19" font-family="monospace" font-size="11" font-weight="bold" fill="#050505" text-anchor="middle">MarketNow</text><text x="135" y="19" font-family="monospace" font-size="11" fill="#00F299" text-anchor="middle">Powered by</text></svg>`,
    markdown: '![Powered by MarketNow](https://marketnow.site/badges/powered-by.svg)](https://marketnow.site)',
    html: '<a href="https://marketnow.site"><img src="https://marketnow.site/badges/powered-by.svg" alt="Powered by MarketNow" /></a>',
  },
  {
    id: 'verified-skill',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="28" viewBox="0 0 160 28"><rect width="160" height="28" rx="4" fill="#050505" stroke="#00F299"/><text x="80" y="19" font-family="monospace" font-size="11" font-weight="bold" fill="#00F299" text-anchor="middle">🛡️ Sentinel v3.0</text></svg>`,
    markdown: '![Sentinel v3.0](https://marketnow.site/badges/verified-skill.svg)](https://marketnow.site/security)',
    html: '<a href="https://marketnow.site/security"><img src="https://marketnow.site/badges/verified-skill.svg" alt="Sentinel v3.0 Verified" /></a>',
  },
  {
    id: 'open-source',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="28" viewBox="0 0 140 28"><rect width="140" height="28" rx="4" fill="#050505" stroke="#00d1ff"/><text x="70" y="19" font-family="monospace" font-size="11" font-weight="bold" fill="#00d1ff" text-anchor="middle">🔓 MNNC-1.0 License</text></svg>`,
    markdown: '![MNNC-1.0 License](https://marketnow.site/badges/open-source.svg)](https://github.com/edgarfloresguerra2011-a11y/marketnow)',
    html: '<a href="https://github.com/edgarfloresguerra2011-a11y/marketnow"><img src="https://marketnow.site/badges/open-source.svg" alt="Source-Available MNNC-1.0" /></a>',
  },
  {
    id: 'available-on',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="28" viewBox="0 0 180 28"><rect width="180" height="28" rx="4" fill="#050505" stroke="#00F299"/><rect width="100" height="28" rx="4" fill="#00F299"/><text x="50" y="19" font-family="monospace" font-size="11" font-weight="bold" fill="#050505" text-anchor="middle">Available on</text><text x="140" y="19" font-family="monospace" font-size="11" fill="#00F299" text-anchor="middle">MarketNow</text></svg>`,
    markdown: '![Available on MarketNow](https://marketnow.site/badges/available-on.svg)](https://marketnow.site)',
    html: '<a href="https://marketnow.site"><img src="https://marketnow.site/badges/available-on.svg" alt="Available on MarketNow" /></a>',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT — all visible UI strings in 5 languages
// ═══════════════════════════════════════════════════════════════════════════
const CONTENT = {
  en: {
    badge: 'SHAREABLE BADGES',
    title: 'Embed MarketNow',
    subtitle: 'Add a badge to your README, docs, or landing page. Show that your MCP server is on MarketNow, that it passed Sentinel v3.0, or just that you support open source agent tooling.',
    badgeLabels: {
      'powered-by': 'Powered by MarketNow',
      'verified-skill': 'Sentinel v3.0 Verified',
      'open-source': 'Source-Available MNNC-1.0',
      'available-on': 'Available on MarketNow',
    },
    markdownLabel: 'MARKDOWN',
    htmlLabel: 'HTML',
    copy: 'COPY',
    copied: '✓ COPIED',
    howToTitle: 'How to use',
    howToSteps: [
      'Pick the badge that fits your project.',
      'Copy the Markdown (for GitHub README) or HTML (for docs/sites).',
      'Paste it. The SVG is served from marketnow.site/badges/.',
      'When someone clicks, they land on MarketNow.',
    ],
    customBadgePre: 'Want a custom badge for your specific skill? Use ',
    customBadgeCode: 'https://marketnow.site/badges/skill/<slug>.svg',
    customBadgePost: ' — it\'ll show the skill name, price, and sentinel score.',
    backLink: '← Back to marketplace',
  },
  es: {
    badge: 'BADGES COMPARTIBLES',
    title: 'Incrustar MarketNow',
    subtitle: 'Agrega un badge a tu README, docs o landing page. Muestra que tu MCP server está en MarketNow, que pasó Sentinel v3.0, o simplemente que apoyas el open source para agentes.',
    badgeLabels: {
      'powered-by': 'Powered by MarketNow',
      'verified-skill': 'Verificado por Sentinel v3.0',
      'open-source': 'Source-Available MNNC-1.0',
      'available-on': 'Disponible en MarketNow',
    },
    markdownLabel: 'MARKDOWN',
    htmlLabel: 'HTML',
    copy: 'COPIAR',
    copied: '✓ COPIADO',
    howToTitle: 'Cómo usar',
    howToSteps: [
      'Elige el badge que se ajuste a tu proyecto.',
      'Copia el Markdown (para README de GitHub) o HTML (para docs/sites).',
      'Pégalo. El SVG se sirve desde marketnow.site/badges/.',
      'Cuando alguien hace clic, llega a MarketNow.',
    ],
    customBadgePre: '¿Quieres un badge personalizado para tu skill específica? Usa ',
    customBadgeCode: 'https://marketnow.site/badges/skill/<slug>.svg',
    customBadgePost: ' — mostrará el nombre de la skill, el precio y el puntaje Sentinel.',
    backLink: '← Volver al marketplace',
  },
  pt: {
    badge: 'BADGES COMPARTILHÁVEIS',
    title: 'Incorporar MarketNow',
    subtitle: 'Adicione um badge ao seu README, docs ou landing page. Mostre que seu MCP server está no MarketNow, que passou no Sentinel v3.0, ou apenas que você apoia tooling open source para agentes.',
    badgeLabels: {
      'powered-by': 'Powered by MarketNow',
      'verified-skill': 'Verificado por Sentinel v3.0',
      'open-source': 'Source-Available MNNC-1.0',
      'available-on': 'Disponível no MarketNow',
    },
    markdownLabel: 'MARKDOWN',
    htmlLabel: 'HTML',
    copy: 'COPIAR',
    copied: '✓ COPIADO',
    howToTitle: 'Como usar',
    howToSteps: [
      'Escolha o badge que se encaixa no seu projeto.',
      'Copie o Markdown (para README do GitHub) ou HTML (para docs/sites).',
      'Cole. O SVG é servido de marketnow.site/badges/.',
      'Quando alguém clica, vai parar no MarketNow.',
    ],
    customBadgePre: 'Quer um badge personalizado para uma skill específica? Use ',
    customBadgeCode: 'https://marketnow.site/badges/skill/<slug>.svg',
    customBadgePost: ' — vai mostrar o nome da skill, o preço e o score Sentinel.',
    backLink: '← Voltar ao marketplace',
  },
  zh: {
    badge: '可分享徽章',
    title: '嵌入 MarketNow',
    subtitle: '在你的 README、文档或落地页添加徽章。展示你的 MCP server 在 MarketNow 上、通过了 Sentinel v3.0、或只是表明你支持开源 agent 工具。',
    badgeLabels: {
      'powered-by': 'Powered by MarketNow',
      'verified-skill': 'Sentinel v3.0 已验证',
      'open-source': 'Source-Available MNNC-1.0',
      'available-on': '在 MarketNow 上可用',
    },
    markdownLabel: 'MARKDOWN',
    htmlLabel: 'HTML',
    copy: '复制',
    copied: '✓ 已复制',
    howToTitle: '使用方法',
    howToSteps: [
      '选择适合你项目的徽章。',
      '复制 Markdown（用于 GitHub README）或 HTML（用于文档/网站）。',
      '粘贴即可。SVG 由 marketnow.site/badges/ 提供。',
      '当有人点击时，会跳转到 MarketNow。',
    ],
    customBadgePre: '想要为你特定的 skill 定制徽章？使用 ',
    customBadgeCode: 'https://marketnow.site/badges/skill/<slug>.svg',
    customBadgePost: ' —— 它会显示 skill 名称、价格和 sentinel 分数。',
    backLink: '← 返回 marketplace',
  },
  fr: {
    badge: 'BADGES PARTAGEABLES',
    title: 'Intégrer MarketNow',
    subtitle: 'Ajoutez un badge à votre README, vos docs ou votre landing page. Montrez que votre MCP server est sur MarketNow, qu\'il a passé Sentinel v3.0, ou simplement que vous soutenez l\'open source pour agents.',
    badgeLabels: {
      'powered-by': 'Powered by MarketNow',
      'verified-skill': 'Vérifié par Sentinel v3.0',
      'open-source': 'Source-Available MNNC-1.0',
      'available-on': 'Disponible sur MarketNow',
    },
    markdownLabel: 'MARKDOWN',
    htmlLabel: 'HTML',
    copy: 'COPIER',
    copied: '✓ COPIÉ',
    howToTitle: 'Mode d\'emploi',
    howToSteps: [
      'Choisissez le badge qui convient à votre projet.',
      'Copiez le Markdown (pour README GitHub) ou le HTML (pour docs/sites).',
      'Collez-le. Le SVG est servi depuis marketnow.site/badges/.',
      'Quand quelqu\'un clique, il arrive sur MarketNow.',
    ],
    customBadgePre: 'Vous voulez un badge personnalisé pour une skill précise ? Utilisez ',
    customBadgeCode: 'https://marketnow.site/badges/skill/<slug>.svg',
    customBadgePost: ' — il affichera le nom de la skill, le prix et le score Sentinel.',
    backLink: '← Retour au marketplace',
  },
};

export default function Embed() {
  const { lang } = useLang();
  const c = CONTENT[lang] || CONTENT.en;
  const [copied, setCopied] = useState(null);

  function copy(text, id) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="min-h-screen pt-20 pb-20 px-4 md:px-8">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00F299]/10 border border-[#00F299]/20 mb-4">
            <span className="text-[#00F299] text-[10px] font-mono tracking-wider">{c.badge}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">{c.title}</h1>
          <p className="text-zinc-400 text-lg">
            {c.subtitle}
          </p>
        </motion.div>

        <div className="space-y-6">
          {BADGES.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="premium-card p-6"
            >
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="text-white text-sm font-bold">{c.badgeLabels[b.id] || b.id}</h2>
                <div dangerouslySetInnerHTML={{ __html: b.svg }} />
              </div>

              <div className="space-y-2">
                <div>
                  <div className="text-zinc-500 text-[10px] mb-1 font-mono">{c.markdownLabel}</div>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-black/40 border border-white/5 rounded p-2 text-[#00F299] text-xs font-mono break-all">{b.markdown}</code>
                    <button
                      onClick={() => copy(b.markdown, b.id + '-md')}
                      className="px-3 py-2 bg-black/40 border border-white/10 rounded text-white text-xs hover:bg-black/60 font-mono"
                    >
                      {copied === b.id + '-md' ? c.copied : c.copy}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-zinc-500 text-[10px] mb-1 font-mono">{c.htmlLabel}</div>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-black/40 border border-white/5 rounded p-2 text-[#00d1ff] text-xs font-mono break-all">{b.html}</code>
                    <button
                      onClick={() => copy(b.html, b.id + '-html')}
                      className="px-3 py-2 bg-black/40 border border-white/10 rounded text-white text-xs hover:bg-black/60 font-mono"
                    >
                      {copied === b.id + '-html' ? c.copied : c.copy}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* How to use */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-8 premium-card p-6">
          <h3 className="text-white text-sm font-mono tracking-wider mb-3 uppercase">{c.howToTitle}</h3>
          <ol className="space-y-2 text-sm text-zinc-400">
            {c.howToSteps.map((step, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="text-[#00F299] font-mono">{idx + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="text-zinc-600 text-xs mt-4">
            {c.customBadgePre}<code className="text-zinc-400 font-mono">{c.customBadgeCode}</code>{c.customBadgePost}
          </p>
        </motion.div>

        <div className="mt-8 text-center">
          <Link to="/" className="text-[#00F299] text-sm hover:underline">{c.backLink}</Link>
        </div>
      </div>
    </div>
  );
}
