import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT — all visible text in 5 languages (en, es, pt, zh, fr)
// Brand / technical identifiers kept untranslated: MarketNow, Sentinel, MCP,
// AliceLabs, GitHub, npm, review_status, verified: true, /api/free-skills.json,
// info@alicelabs.site, "mcp-server", "model-context-protocol", "awesome-mcp".
// ═══════════════════════════════════════════════════════════════════════════
const CONTENT = {
  en: {
    badge: 'CATALOG TRANSPARENCY',
    title: 'Where the skills come from',
    subtitle:
      'Claude noticed that some categories had exactly "30" items — a sign of bulk import rather than organic curation. This page is our honest disclosure of how the catalog was built, where each skill came from, and what "verified" actually means.',
    howBuiltTitle: 'How the catalog was built',
    breakdowns: [
      {
        colorClass: 'text-[#00F299]',
        title: '9,248 skills — Curated open-source MCP servers',
        bodyPre:
          'Sourced from public GitHub repositories tagged with "mcp-server" or "model-context-protocol". Each was scanned by Sentinel v3.0, given a category based on its README, and certified by Sentinel with a signed SHA-256 certificate.',
        bodyStrong: 'These are real, working MCP servers you can verify on GitHub.',
        bodyPost: '',
      },
      {
        colorClass: 'text-yellow-400',
        title: '3,506 skills — Bulk-imported from agent tool inventories',
        bodyPre:
          'Imported from community-maintained "awesome-mcp" lists and agent tool inventories. These have less individual curation — Sentinel scanned them, but no human has reviewed each one.',
        bodyStrong: 'This is where the "30 items per category" pattern comes from',
        bodyPost:
          ' — several of these source lists had ~30 entries per category, and that count propagated. We disclose this rather than hide it.',
      },
      {
        colorClass: 'text-[#00d1ff]',
        title: 'All skills — Free to install skills',
        bodyPre:
          'Curated by us as a "starter pack" for agents — high-signal prompts, foundational tools, etc. Available at /api/free-skills.json. No payment, no mandate required.',
        bodyStrong: '',
        bodyPost: '',
      },
      {
        colorClass: 'text-zinc-300',
        title: '0 skills — Synthetic or fake',
        bodyPre:
          'We previously had ~13,000 synthetic skills. They were removed in early 2026 in a cleanup pass. The current catalog of {total} skills is real software. You can verify each one by checking its GitHub repo (when source is known) or running its install command.',
        bodyStrong: '',
        bodyPost: '',
      },
    ],
    stats: {
      total: 'TOTAL SKILLS',
      free: 'FREE',
      paid: 'PAID',
      viaNpm: 'VIA NPM',
    },
    catDistTitle: 'Category distribution ({n} categories)',
    catDistNote:
      'Note the cluster of categories with ~30 items each — these are the bulk-imported ones mentioned above. We are not hiding this.',
    bulkLabel: 'BULK',
    verifiedTitle: 'What "verified" means',
    verifiedIntroPre: 'Each skill has a',
    verifiedIntroPost: 'field with one of three values:',
    verifiedItems: [
      {
        codeClass: 'text-[#00F299]',
        bodyPre: 'Sentinel v3.0 ran automated checks. No human has reviewed.',
        bodyStrong: 'Most catalog skills are here.',
      },
      {
        codeClass: 'text-yellow-400',
        bodyPre:
          'A human at AliceLabs manually inspected the GitHub repo, code, and Sentinel report.',
        bodyStrong: '',
      },
      {
        codeClass: 'text-[#00d1ff]',
        bodyPre:
          "The skill's GitHub maintainer signed a claim of authorship (GPG-signed commit).",
        bodyStrong: '0 today — program opens Q4 2026, apply at info@alicelabs.site.',
      },
    ],
    verifiedNotePre:
      'We never mark a skill "verified" if it has only been auto-scanned. The old universal',
    verifiedNotePost: 'field is being phased out — replaced by review_status.',
    disclosureTitle: 'Our disclosure commitment',
    disclosureList: [
      'We will never inflate skill counts by adding synthetic entries.',
      'We will mark bulk-imported categories as such, not hide them.',
      'We will not claim "verified" status we have not earned.',
      'When a third-party audit happens, the full report goes public here.',
      'Real download counts and real reviews will appear as we get them. We will not seed fakes.',
    ],
    footerLinks: [
      { label: '→ Trust roadmap', to: '/trust' },
      { label: '→ About us', to: '/about' },
      { label: '→ Browse the catalog', to: '/registry' },
    ],
  },

  es: {
    badge: 'TRANSPARENCIA DEL CATÁLOGO',
    title: 'De dónde provienen las skills',
    subtitle:
      'Claude notó que algunas categorías tenían exactamente "30" elementos — una señal de importación masiva en lugar de curación orgánica. Esta página es nuestra divulgación honesta de cómo se construyó el catálogo, de dónde proviene cada skill y qué significa realmente "verified".',
    howBuiltTitle: 'Cómo se construyó el catálogo',
    breakdowns: [
      {
        colorClass: 'text-[#00F299]',
        title: '9,248 skills — Servidores MCP open-source curados',
        bodyPre:
          'Obtenidos de repositorios públicos de GitHub etiquetados con "mcp-server" o "model-context-protocol". Cada uno fue escaneado por Sentinel v3.0, recibió una categoría basada en su README y certificada por Sentinel con un certificado SHA-256 firmado.',
        bodyStrong: 'Estos son servidores MCP reales y funcionales que puedes verificar en GitHub.',
        bodyPost: '',
      },
      {
        colorClass: 'text-yellow-400',
        title: '3,506 skills — Importados en masa desde inventarios de herramientas de agentes',
        bodyPre:
          'Importados de listas "awesome-mcp" mantenidas por la comunidad e inventarios de herramientas de agentes. Tienen menos curación individual — Sentinel los escaneó, pero ningún humano ha revisado cada uno.',
        bodyStrong: 'Aquí es de donde viene el patrón de "30 elementos por categoría"',
        bodyPost:
          ' — varias de estas listas de origen tenían ~30 entradas por categoría, y ese conteo se propagó. Lo divulgamos en lugar de ocultarlo.',
      },
      {
        colorClass: 'text-[#00d1ff]',
        title: '43 skills — Skills gratuitas seleccionadas a mano',
        bodyPre:
          'Curadas por nosotros como un "starter pack" para agentes — prompts de alta señal, herramientas fundamentales, etc. Disponibles en /api/free-skills.json. Sin pago, sin mandato requerido.',
        bodyStrong: '',
        bodyPost: '',
      },
      {
        colorClass: 'text-zinc-300',
        title: '0 skills — Sintéticas o falsas',
        bodyPre:
          'Anteriormente teníamos ~13,000 skills sintéticas. Fueron eliminadas a principios de 2026 en una limpieza. El catálogo actual de {total} skills es software real. Puedes verificar cada una revisando su repo de GitHub (cuando la fuente es conocida) o ejecutando su comando de instalación.',
        bodyStrong: '',
        bodyPost: '',
      },
    ],
    stats: {
      total: 'TOTAL SKILLS',
      free: 'GRATUITAS',
      paid: 'PAGADAS',
      viaNpm: 'VÍA NPM',
    },
    catDistTitle: 'Distribución por categoría ({n} categorías)',
    catDistNote:
      'Nota el grupo de categorías con ~30 elementos cada una — estas son las importadas en masa mencionadas arriba. No lo estamos ocultando.',
    bulkLabel: 'MASIVA',
    verifiedTitle: 'Qué significa "verified"',
    verifiedIntroPre: 'Cada skill tiene un campo',
    verifiedIntroPost: 'con uno de tres valores:',
    verifiedItems: [
      {
        codeClass: 'text-[#00F299]',
        bodyPre: 'Sentinel v3.0 ejecutó verificaciones automatizadas. Ningún humano ha revisado.',
        bodyStrong: 'La mayoría de las skills del catálogo están aquí.',
      },
      {
        codeClass: 'text-yellow-400',
        bodyPre:
          'Un humano en AliceLabs inspeccionó manualmente el repo de GitHub, el código y el informe de Sentinel.',
        bodyStrong: '',
      },
      {
        codeClass: 'text-[#00d1ff]',
        bodyPre:
          'El maintainer de GitHub de la skill firmó una declaración de autoría (commit firmado con GPG).',
        bodyStrong: '0 hoy — el programa abre en Q4 2026, aplica en info@alicelabs.site.',
      },
    ],
    verifiedNotePre:
      'Nunca marcamos una skill como "verified" si solo ha sido auto-escaneada. El antiguo campo universal',
    verifiedNotePost: 'se está eliminando gradualmente — reemplazado por review_status.',
    disclosureTitle: 'Nuestro compromiso de divulgación',
    disclosureList: [
      'Nunca inflaremos los conteos de skills añadiendo entradas sintéticas.',
      'Marcaremos las categorías importadas en masa como tales, no las ocultaremos.',
      'No reclamaremos el estado "verified" que no hayamos ganado.',
      'Cuando ocurra una auditoría de terceros, el informe completo se publicará aquí.',
      'Los conteos reales de descargas y reseñas reales aparecerán a medida que los obtengamos. No sembraremos falsos.',
    ],
    footerLinks: [
      { label: '→ Hoja de ruta de confianza', to: '/trust' },
      { label: '→ Sobre nosotros', to: '/about' },
      { label: '→ Explorar el catálogo', to: '/registry' },
    ],
  },

  pt: {
    badge: 'TRANSPARÊNCIA DO CATÁLOGO',
    title: 'De onde vêm as skills',
    subtitle:
      'Claude notou que algumas categorias tinham exatamente "30" itens — um sinal de importação em massa em vez de curadoria orgânica. Esta página é a nossa divulgação honesta de como o catálogo foi construído, de onde veio cada skill e o que "verified" realmente significa.',
    howBuiltTitle: 'Como o catálogo foi construído',
    breakdowns: [
      {
        colorClass: 'text-[#00F299]',
        title: '5.054 skills — Servidores MCP open-source curados',
        bodyPre:
          'Obtidos de repositórios públicos do GitHub marcados com "mcp-server" ou "model-context-protocol". Cada um foi escaneado pelo Sentinel v3.0, recebeu uma categoria com base no seu README e certificada pelo Sentinel com um certificado SHA-256 assinado.',
        bodyStrong: 'Estes são servidores MCP reais e funcionais que você pode verificar no GitHub.',
        bodyPost: '',
      },
      {
        colorClass: 'text-yellow-400',
        title: '3.506 skills — Importados em massa de inventários de ferramentas de agentes',
        bodyPre:
          'Importados de listas "awesome-mcp" mantidas pela comunidade e inventários de ferramentas de agentes. Têm menos curadoria individual — o Sentinel os escaneou, mas nenhum humano revisou cada um.',
        bodyStrong: 'É daqui que vem o padrão de "30 itens por categoria"',
        bodyPost:
          ' — várias dessas listas de origem tinham ~30 entradas por categoria, e essa contagem se propagou. Divulgamos isso em vez de esconder.',
      },
      {
        colorClass: 'text-[#00d1ff]',
        title: '43 skills — Skills gratuitas selecionadas a dedo',
        bodyPre:
          'Curadas por nós como um "starter pack" para agentes — prompts de alto sinal, ferramentas fundamentais, etc. Disponíveis em /api/free-skills.json. Sem pagamento, sem mandato exigido.',
        bodyStrong: '',
        bodyPost: '',
      },
      {
        colorClass: 'text-zinc-300',
        title: '0 skills — Sintéticas ou falsas',
        bodyPre:
          'Anteriormente tínhamos ~13.000 skills sintéticas. Elas foram removidas no início de 2026 em uma limpeza. O catálogo atual de {total} skills é software real. Você pode verificar cada uma checando seu repo do GitHub (quando a fonte é conhecida) ou executando seu comando de instalação.',
        bodyStrong: '',
        bodyPost: '',
      },
    ],
    stats: {
      total: 'TOTAL DE SKILLS',
      free: 'GRATUITAS',
      paid: 'PAGAS',
      viaNpm: 'VIA NPM',
    },
    catDistTitle: 'Distribuição por categoria ({n} categorias)',
    catDistNote:
      'Note o grupo de categorias com ~30 itens cada — estas são as importadas em massa mencionadas acima. Não estamos escondendo isso.',
    bulkLabel: 'EM MASSA',
    verifiedTitle: 'O que "verified" significa',
    verifiedIntroPre: 'Cada skill tem um campo',
    verifiedIntroPost: 'com um de três valores:',
    verifiedItems: [
      {
        codeClass: 'text-[#00F299]',
        bodyPre: 'O Sentinel v3.0 executou verificações automatizadas. Nenhum humano revisou.',
        bodyStrong: 'A maioria das skills do catálogo está aqui.',
      },
      {
        codeClass: 'text-yellow-400',
        bodyPre:
          'Um humano na AliceLabs inspecionou manualmente o repo do GitHub, o código e o relatório do Sentinel.',
        bodyStrong: '',
      },
      {
        codeClass: 'text-[#00d1ff]',
        bodyPre:
          'O maintainer do GitHub da skill assinou uma declaração de autoria (commit assinado com GPG).',
        bodyStrong: '0 hoje — o programa abre em Q4 2026, candidate-se em info@alicelabs.site.',
      },
    ],
    verifiedNotePre:
      'Nunca marcamos uma skill como "verified" se ela só foi auto-escaneada. O antigo campo universal',
    verifiedNotePost: 'está sendo descontinuado — substituído por review_status.',
    disclosureTitle: 'Nosso compromisso de divulgação',
    disclosureList: [
      'Nunca inflaremos contagens de skills adicionando entradas sintéticas.',
      'Marcaremos as categorias importadas em massa como tal, não as esconderemos.',
      'Não reivindicaremos o status "verified" que não ganhamos.',
      'Quando ocorrer uma auditoria de terceiros, o relatório completo será publicado aqui.',
      'Contagens reais de download e avaliações reais aparecerão conforme as obtermos. Não vamos criar falsas.',
    ],
    footerLinks: [
      { label: '→ Roteiro de confiança', to: '/trust' },
      { label: '→ Sobre nós', to: '/about' },
      { label: '→ Navegar pelo catálogo', to: '/registry' },
    ],
  },

  zh: {
    badge: '目录透明度',
    title: '这些 skill 从何而来',
    subtitle:
      'Claude 注意到有些分类恰好有 "30" 个条目 —— 这是批量导入而非精心整理的迹象。本页是我们对目录构建方式、每个 skill 的来源,以及 "verified" 实际含义的诚实披露。',
    howBuiltTitle: '目录是如何构建的',
    breakdowns: [
      {
        colorClass: 'text-[#00F299]',
        title: '9,248 个 skill —— 精选的开源 MCP 服务器',
        bodyPre:
          '来源于 GitHub 上标记为 "mcp-server" 或 "model-context-protocol" 的公开仓库。每个都由 Sentinel v3.0 扫描,根据其 README 分配分类,并由 Sentinel 认证,附带签名的 SHA-256 证书。',
        bodyStrong: '这些是真实可用的 MCP 服务器,你可以在 GitHub 上验证。',
        bodyPost: '',
      },
      {
        colorClass: 'text-yellow-400',
        title: '3,506 个 skill —— 从智能体工具清单批量导入',
        bodyPre:
          '从社区维护的 "awesome-mcp" 列表和智能体工具清单导入。这些缺少逐项整理 —— Sentinel 扫描了它们,但没有任何人工审核。',
        bodyStrong: '"每个分类 30 项" 的规律就来自这里',
        bodyPost:
          ' —— 其中几个来源列表每个分类约有 30 条,这个数量就传播开了。我们披露而不是隐瞒这一点。',
      },
      {
        colorClass: 'text-[#00d1ff]',
        title: '43 个 skill —— 人工挑选的免费 skill',
        bodyPre:
          '由我们精心整理,作为智能体的 "starter pack" —— 高信号提示词、基础工具等。可在 /api/free-skills.json 获取。无需付费,无需授权。',
        bodyStrong: '',
        bodyPost: '',
      },
      {
        colorClass: 'text-zinc-300',
        title: '0 个 skill —— 合成或虚假的',
        bodyPre:
          '我们此前有约 13,000 个合成 skill。它们已在 2026 年初的清理中被移除。当前目录共 {total} 个 skill,都是真实的软件。你可以通过查看其 GitHub 仓库(已知来源时)或运行其安装命令来逐个验证。',
        bodyStrong: '',
        bodyPost: '',
      },
    ],
    stats: {
      total: '总 SKILL 数',
      free: '免费',
      paid: '付费',
      viaNpm: '通过 NPM',
    },
    catDistTitle: '分类分布({n} 个分类)',
    catDistNote:
      '注意那些各有约 30 项的分类簇 —— 这些就是上文提到的批量导入项。我们没有隐瞒这一点。',
    bulkLabel: '批量',
    verifiedTitle: '"verified" 意味着什么',
    verifiedIntroPre: '每个 skill 都有一个',
    verifiedIntroPost: '字段,取以下三个值之一:',
    verifiedItems: [
      {
        codeClass: 'text-[#00F299]',
        bodyPre: 'Sentinel v3.0 运行了自动化检查。无人工审核。',
        bodyStrong: '目录中大多数 skill 都属于此类。',
      },
      {
        codeClass: 'text-yellow-400',
        bodyPre: 'AliceLabs 的人工已手动检查了 GitHub 仓库、代码和 Sentinel 报告。',
        bodyStrong: '',
      },
      {
        codeClass: 'text-[#00d1ff]',
        bodyPre: '该 skill 的 GitHub 维护者签署了作者声明(GPG 签名 commit)。',
        bodyStrong: '目前为 0 —— 计划于 2026 年 Q4 开放,可在 info@alicelabs.site 申请。',
      },
    ],
    verifiedNotePre:
      '如果一个 skill 仅被自动扫描,我们绝不会将其标记为 "verified"。旧的全局',
    verifiedNotePost: '字段正在逐步淘汰 —— 由 review_status 取代。',
    disclosureTitle: '我们的披露承诺',
    disclosureList: [
      '我们绝不会通过添加合成条目来夸大 skill 数量。',
      '我们会如实标注批量导入的分类,而非隐藏。',
      '我们不会宣称尚未获得的 "verified" 状态。',
      '当第三方审计发生时,完整报告将在此公开发布。',
      '真实的下载数量和真实的评价会随着我们获取而出现。我们不会植入虚假数据。',
    ],
    footerLinks: [
      { label: '→ 信任路线图', to: '/trust' },
      { label: '→ 关于我们', to: '/about' },
      { label: '→ 浏览目录', to: '/registry' },
    ],
  },

  fr: {
    badge: 'TRANSPARENCE DU CATALOGUE',
    title: "D'où viennent les skills",
    subtitle:
      'Claude a remarqué que certaines catégories avaient exactement « 30 » éléments — un signe d\'importation en masse plutôt que de curation organique. Cette page est notre divulgation honnête de la façon dont le catalogue a été construit, d\'où vient chaque skill et ce que « verified » signifie réellement.',
    howBuiltTitle: 'Comment le catalogue a été construit',
    breakdowns: [
      {
        colorClass: 'text-[#00F299]',
        title: '5 054 skills — Serveurs MCP open-source curés',
        bodyPre:
          'Issus de dépôts GitHub publics tagués « mcp-server » ou « model-context-protocol ». Chacun a été scanné par Sentinel v3.0, a reçu une catégorie basée sur son README et s\'est vu attribuer un prix selon sa complexité (tout est gratuit).',
        bodyStrong: 'Ce sont de vrais serveurs MCP fonctionnels que vous pouvez vérifier sur GitHub.',
        bodyPost: '',
      },
      {
        colorClass: 'text-yellow-400',
        title: "3 506 skills — Importés en masse depuis des inventaires d'outils d'agents",
        bodyPre:
          'Importés de listes « awesome-mcp » maintenues par la communauté et d\'inventaires d\'outils d\'agents. Ils ont moins de curation individuelle — Sentinel les a scannés, mais aucun humain n\'a revu chacun.',
        bodyStrong: "C'est ici qu'apparaît le motif « 30 éléments par catégorie »",
        bodyPost:
          " — plusieurs de ces listes sources avaient ~30 entrées par catégorie, et ce compte s'est propagé. Nous le divulgons plutôt que de le cacher.",
      },
      {
        colorClass: 'text-[#00d1ff]',
        title: '43 skills — Skills gratuites sélectionnées à la main',
        bodyPre:
          'Curées par nous comme un « starter pack » pour agents — prompts à fort signal, outils fondamentaux, etc. Disponibles sur /api/free-skills.json. Aucun paiement, aucun mandat requis.',
        bodyStrong: '',
        bodyPost: '',
      },
      {
        colorClass: 'text-zinc-300',
        title: '0 skills — Synthétiques ou factices',
        bodyPre:
          "Nous avions auparavant ~13 000 skills synthétiques. Elles ont été retirées au début de 2026 lors d'un nettoyage. Le catalogue actuel de {total} skills est un logiciel réel. Vous pouvez vérifier chacune en consultant son dépôt GitHub (quand la source est connue) ou en exécutant sa commande d'installation.",
        bodyStrong: '',
        bodyPost: '',
      },
    ],
    stats: {
      total: 'TOTAL SKILLS',
      free: 'GRATUITES',
      paid: 'PAYANTES',
      viaNpm: 'VIA NPM',
    },
    catDistTitle: 'Distribution par catégorie ({n} catégories)',
    catDistNote:
      "Notez le groupe de catégories avec ~30 éléments chacune — ce sont celles importées en masse mentionnées ci-dessus. Nous ne le cachons pas.",
    bulkLabel: 'MASSE',
    verifiedTitle: 'Ce que « verified » signifie',
    verifiedIntroPre: 'Chaque skill a un champ',
    verifiedIntroPost: "avec l'une de trois valeurs :",
    verifiedItems: [
      {
        codeClass: 'text-[#00F299]',
        bodyPre: "Sentinel v3.0 a exécuté des vérifications automatisées. Aucun humain n'a revu.",
        bodyStrong: 'La plupart des skills du catalogue sont ici.',
      },
      {
        codeClass: 'text-yellow-400',
        bodyPre:
          'Un humain chez AliceLabs a inspecté manuellement le dépôt GitHub, le code et le rapport Sentinel.',
        bodyStrong: '',
      },
      {
        codeClass: 'text-[#00d1ff]',
        bodyPre:
          "Le mainteneur GitHub de la skill a signé une déclaration d'auteur (commit signé GPG).",
        bodyStrong: "0 aujourd'hui — le programme ouvre en Q4 2026, postulez à info@alicelabs.site.",
      },
    ],
    verifiedNotePre:
      'Nous ne marquons jamais une skill « verified » si elle n\'a été qu\'auto-scannée. L\'ancien champ universel',
    verifiedNotePost: 'est en cours de suppression — remplacé par review_status.',
    disclosureTitle: 'Notre engagement de divulgation',
    disclosureList: [
      "Nous n'inflerons jamais les comptes de skills en ajoutant des entrées synthétiques.",
      'Nous marquerons les catégories importées en masse comme telles, nous ne les cacherons pas.',
      'Nous ne revendiquerons pas un statut « verified » que nous n\'avons pas gagné.',
      'Quand un audit tiers aura lieu, le rapport complet sera publié ici.',
      "De vrais comptes de téléchargements et de vrais avis apparaîtront au fur et à mesure. Nous ne planterons pas de faux.",
    ],
    footerLinks: [
      { label: '→ Feuille de route de confiance', to: '/trust' },
      { label: '→ À propos', to: '/about' },
      { label: '→ Parcourir le catalogue', to: '/registry' },
    ],
  },
};

// Simple {var} placeholder formatter
const fmt = (str, vars) => {
  if (!vars) return str;
  let out = str;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return out;
};

export default function Catalog() {
  const { lang } = useLang();
  const c = CONTENT[lang] || CONTENT.en;
  const [stats, setStats] = useState({ total: 0, withGithub: 0, withNpm: 0, free: 0, paid: 0 });
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/skills.json');
        const skills = await r.json();
        const total = skills.length;
        const withGithub = skills.filter(s => s.repo || s.github_url || (s.author && s.author !== 'Open Source Community')).length;
        const withNpm = skills.filter(s => s.install && s.install.includes('npx -y')).length;
        const free = skills.filter(s => s.price === 0 || s.free).length;
        const paid = total - free;
        setStats({ total, withGithub, withNpm, free, paid });

        // Group by category to show the "30 per category" pattern
        const byCat = {};
        for (const s of skills) {
          const cat = s.category || 'Unknown';
          byCat[cat] = (byCat[cat] || 0) + 1;
        }
        const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
        setSources(sorted);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const maxCount = sources.length ? Math.max(...sources.map(s => s[1])) : 1;

  return (
    <div className="min-h-screen pt-20 pb-20 px-4 md:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00F299]/10 border border-[#00F299]/20 mb-4">
            <span className="text-[#00F299] text-[10px] font-mono tracking-wider">{c.badge}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">{c.title}</h1>
          <p className="text-zinc-400 text-lg max-w-2xl">{c.subtitle}</p>
        </motion.div>

        {/* Honest breakdown */}
        <div className="premium-card p-6 mb-8">
          <h2 className="text-white text-sm font-mono tracking-wider mb-4 uppercase">{c.howBuiltTitle}</h2>
          <div className="space-y-4 text-sm">
            {c.breakdowns.map((b, i) => (
              <div key={i} className="p-4 rounded-lg bg-black/40">
                <div className={`${b.colorClass} font-bold mb-1`}>{b.title}</div>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  {fmt(b.bodyPre, { total: stats.total.toLocaleString() })}
                  {b.bodyStrong && <strong className="text-zinc-300"> {b.bodyStrong}</strong>}
                  {b.bodyPost && <span>{b.bodyPost}</span>}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <div className="premium-card p-4 text-center">
              <div className="text-2xl font-bold text-white font-mono">{stats.total.toLocaleString()}</div>
              <div className="text-[10px] text-zinc-500 font-mono tracking-wider mt-1">{c.stats.total}</div>
            </div>
            <div className="premium-card p-4 text-center">
              <div className="text-2xl font-bold text-[#00F299] font-mono">{stats.free}</div>
              <div className="text-[10px] text-zinc-500 font-mono tracking-wider mt-1">{c.stats.free}</div>
            </div>
            <div className="premium-card p-4 text-center">
              <div className="text-2xl font-bold text-[#00d1ff] font-mono">{stats.paid.toLocaleString()}</div>
              <div className="text-[10px] text-zinc-500 font-mono tracking-wider mt-1">{c.stats.paid}</div>
            </div>
            <div className="premium-card p-4 text-center">
              <div className="text-2xl font-bold text-white font-mono">{stats.withNpm.toLocaleString()}</div>
              <div className="text-[10px] text-zinc-500 font-mono tracking-wider mt-1">{c.stats.viaNpm}</div>
            </div>
          </div>
        )}

        {/* Category distribution */}
        <div className="premium-card p-6 mb-8">
          <h2 className="text-white text-sm font-mono tracking-wider mb-4 uppercase">
            {fmt(c.catDistTitle, { n: sources.length })}
          </h2>
          <p className="text-zinc-500 text-xs mb-4">{c.catDistNote}</p>
          <div className="space-y-1 max-h-96 overflow-y-auto pr-2">
            {sources.map(([cat, count]) => {
              const isBulk = count === 30 || (count >= 28 && count <= 32);
              return (
                <div key={cat} className="flex items-center gap-3 text-xs">
                  <div className="w-32 text-zinc-400 truncate">{cat}</div>
                  <div className="flex-1 bg-black/40 rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-full ${isBulk ? 'bg-yellow-500/40' : 'bg-[#00F299]/40'}`}
                      style={{ width: `${Math.min(100, (count / maxCount) * 100)}%` }}
                    />
                  </div>
                  <div className={`w-12 text-right font-mono ${isBulk ? 'text-yellow-400' : 'text-white'}`}>
                    {count}
                  </div>
                  {isBulk && (
                    <span className="text-yellow-500 text-[9px] font-mono px-1.5 py-0.5 rounded bg-yellow-500/10">
                      {c.bulkLabel}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* What "verified" means */}
        <div className="premium-card p-6 mb-8">
          <h2 className="text-white text-sm font-mono tracking-wider mb-3 uppercase">{c.verifiedTitle}</h2>
          <p className="text-zinc-400 text-sm mb-3 leading-relaxed">
            {c.verifiedIntroPre} <code className="text-[#00F299] font-mono">review_status</code> {c.verifiedIntroPost}
          </p>
          <ul className="space-y-2 text-sm">
            {c.verifiedItems.map((v, i) => (
              <li key={i} className="flex gap-2">
                <code className={`${v.codeClass} font-mono text-xs flex-shrink-0`}>
                  {i === 0 ? 'auto-scanned' : i === 1 ? 'human-reviewed' : 'maintainer-verified'}
                </code>
                <span className="text-zinc-400">
                  {v.bodyPre}
                  {v.bodyStrong && <strong className="text-zinc-300"> {v.bodyStrong}</strong>}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-zinc-500 text-xs mt-4">
            {c.verifiedNotePre}
            <code className="text-zinc-400 font-mono mx-1">verified: true</code>
            {c.verifiedNotePost}
          </p>
        </div>

        {/* Disclosure */}
        <div className="premium-card p-6">
          <h2 className="text-white text-sm font-mono tracking-wider mb-3 uppercase">{c.disclosureTitle}</h2>
          <ul className="space-y-2 text-sm text-zinc-400">
            {c.disclosureList.map((item, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[#00F299]">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            {c.footerLinks.map((l) => (
              <Link key={l.to} to={l.to} className={l.to === '/trust' ? 'text-[#00F299] hover:underline' : 'text-zinc-400 hover:underline'}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
