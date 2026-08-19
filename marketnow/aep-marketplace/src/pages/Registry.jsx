import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { matchSkills, generateRecommendation } from '../utils/skillMatcher';
import { useLang } from '../context/LanguageContext.jsx';

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT — all UI strings in 5 languages (en, es, pt, zh, fr)
// ═══════════════════════════════════════════════════════════════════════════
const CONTENT = {
  en: {
    titlePre: 'AGENT ',
    titleHighlight: 'SKILL',
    titlePost: ' REGISTRY',
    subtitle: 'Browse, install, and deploy autonomous agent skills from the global MCP registry. Each skill is verified, versioned, and ready for production.',
    matcherTitle: 'AI SKILL MATCHER',
    matcherDesc: "Describe what you need in natural language — we'll find the best skills.",
    matcherPlaceholder: "e.g. 'I need to scrape a website and extract product prices'",
    matcherMatching: 'MATCHING...',
    matcherFind: 'FIND SKILLS',
    matcherNoMatches: 'No matches found. Try different keywords.',
    matchLabel: 'match:',
    stats: {
      total: 'Total Skills',
      avg: 'Avg Price',
      from: 'From',
      protocol: 'Protocol',
    },
    retry: 'Retry',
    searchPlaceholder: 'Search skills...',
    sortOptions: {
      'name-asc': 'Name ↑',
      'name-desc': 'Name ↓',
      'price-asc': 'Price ↑',
      'price-desc': 'Price ↓',
      'score-asc': 'Score ↑',
      'score-desc': 'Score ↓',
    },
    pageOf: 'Page {current}/{total}',
    prev: '← Prev',
    next: 'Next →',
    loadingRegistry: 'Loading registry...',
    showingOf: 'Showing {shown} of {total} skills',
    verified: '✓ VERIFIED',
    noSkillsFound: 'No skills found',
  },
  es: {
    titlePre: 'REGISTRO DE ',
    titleHighlight: 'SKILLS',
    titlePost: ' PARA AGENTES',
    subtitle: 'Explora, instala y despliega skills para agentes autónomos desde el registro global MCP. Cada skill está verificada, versionada y lista para producción.',
    matcherTitle: 'BUSCADOR DE SKILLS POR IA',
    matcherDesc: 'Describe lo que necesitas en lenguaje natural — encontraremos las mejores skills.',
    matcherPlaceholder: "p. ej. 'Necesito scrapear un sitio web y extraer precios de productos'",
    matcherMatching: 'BUSCANDO...',
    matcherFind: 'ENCONTRAR SKILLS',
    matcherNoMatches: 'No se encontraron coincidencias. Prueba con otras palabras clave.',
    matchLabel: 'coincidencia:',
    stats: {
      total: 'Skills Totales',
      avg: 'Precio Prom.',
      from: 'Desde',
      protocol: 'Protocolo',
    },
    retry: 'Reintentar',
    searchPlaceholder: 'Buscar skills...',
    sortOptions: {
      'name-asc': 'Nombre ↑',
      'name-desc': 'Nombre ↓',
      'price-asc': 'Precio ↑',
      'price-desc': 'Precio ↓',
      'score-asc': 'Puntaje ↑',
      'score-desc': 'Puntaje ↓',
    },
    pageOf: 'Página {current}/{total}',
    prev: '← Anterior',
    next: 'Siguiente →',
    loadingRegistry: 'Cargando registro...',
    showingOf: 'Mostrando {shown} de {total} skills',
    verified: '✓ VERIFICADA',
    noSkillsFound: 'No se encontraron skills',
  },
  pt: {
    titlePre: 'REGISTRO DE ',
    titleHighlight: 'SKILLS',
    titlePost: ' PARA AGENTES',
    subtitle: 'Navegue, instale e implante skills de agentes autônomos do registro global MCP. Cada skill é verificada, versionada e pronta para produção.',
    matcherTitle: 'BUSCADOR DE SKILLS POR IA',
    matcherDesc: 'Descreva o que você precisa em linguagem natural — encontraremos as melhores skills.',
    matcherPlaceholder: "ex. 'Preciso fazer scrape de um site e extrair preços de produtos'",
    matcherMatching: 'BUSCANDO...',
    matcherFind: 'ENCONTRAR SKILLS',
    matcherNoMatches: 'Nenhuma correspondência encontrada. Tente palavras-chave diferentes.',
    matchLabel: 'correspondência:',
    stats: {
      total: 'Skills Totais',
      avg: 'Preço Médio',
      from: 'A partir de',
      protocol: 'Protocolo',
    },
    retry: 'Tentar novamente',
    searchPlaceholder: 'Buscar skills...',
    sortOptions: {
      'name-asc': 'Nome ↑',
      'name-desc': 'Nome ↓',
      'price-asc': 'Preço ↑',
      'price-desc': 'Preço ↓',
      'score-asc': 'Pontuação ↑',
      'score-desc': 'Pontuação ↓',
    },
    pageOf: 'Página {current}/{total}',
    prev: '← Anterior',
    next: 'Próximo →',
    loadingRegistry: 'Carregando registro...',
    showingOf: 'Mostrando {shown} de {total} skills',
    verified: '✓ VERIFICADA',
    noSkillsFound: 'Nenhuma skill encontrada',
  },
  zh: {
    titlePre: '代理 ',
    titleHighlight: 'SKILL',
    titlePost: ' 注册表',
    subtitle: '从全球 MCP 注册表浏览、安装并部署自主代理 skill。每个 skill 均经过验证、版本化，可用于生产环境。',
    matcherTitle: 'AI SKILL 匹配器',
    matcherDesc: '用自然语言描述你的需求——我们会为你找到最合适的 skill。',
    matcherPlaceholder: "例如：「我需要爬取一个网站并提取产品价格」",
    matcherMatching: '匹配中...',
    matcherFind: '查找 SKILL',
    matcherNoMatches: '未找到匹配项。请尝试其他关键词。',
    matchLabel: '匹配度:',
    stats: {
      total: 'Skill 总数',
      avg: '平均价格',
      from: '起价',
      protocol: '协议',
    },
    retry: '重试',
    searchPlaceholder: '搜索 skill...',
    sortOptions: {
      'name-asc': '名称 ↑',
      'name-desc': '名称 ↓',
      'price-asc': '价格 ↑',
      'price-desc': '价格 ↓',
      'score-asc': '评分 ↑',
      'score-desc': '评分 ↓',
    },
    pageOf: '第 {current}/{total} 页',
    prev: '← 上一页',
    next: '下一页 →',
    loadingRegistry: '正在加载注册表...',
    showingOf: '显示 {shown} / {total} 个 skill',
    verified: '✓ 已验证',
    noSkillsFound: '未找到 skill',
  },
  fr: {
    titlePre: 'REGISTRE DE ',
    titleHighlight: 'SKILLS',
    titlePost: ' POUR AGENTS',
    subtitle: "Parcourez, installez et déployez des skills d'agents autonomes depuis le registre global MCP. Chaque skill est vérifiée, versionnée et prête pour la production.",
    matcherTitle: 'RECHERCHE DE SKILLS PAR IA',
    matcherDesc: 'Décrivez ce dont vous avez besoin en langage naturel — nous trouverons les meilleures skills.',
    matcherPlaceholder: "ex. « J'ai besoin de scraper un site web et d'extraire les prix des produits »",
    matcherMatching: 'RECHERCHE...',
    matcherFind: 'TROUVER DES SKILLS',
    matcherNoMatches: 'Aucune correspondance trouvée. Essayez d\'autres mots-clés.',
    matchLabel: 'correspondance :',
    stats: {
      total: 'Skills Totales',
      avg: 'Prix Moyen',
      from: 'À partir de',
      protocol: 'Protocole',
    },
    retry: 'Réessayer',
    searchPlaceholder: 'Rechercher des skills...',
    sortOptions: {
      'name-asc': 'Nom ↑',
      'name-desc': 'Nom ↓',
      'price-asc': 'Prix ↑',
      'price-desc': 'Prix ↓',
      'score-asc': 'Score ↑',
      'score-desc': 'Score ↓',
    },
    pageOf: 'Page {current}/{total}',
    prev: '← Précédent',
    next: 'Suivant →',
    loadingRegistry: 'Chargement du registre...',
    showingOf: 'Affichage de {shown} sur {total} skills',
    verified: '✓ VÉRIFIÉE',
    noSkillsFound: 'Aucune skill trouvée',
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

const PAGE_SIZE = 24;

export default function Registry() {
  const { lang, t } = useLang();
  const c = CONTENT[lang] || CONTENT.en;

  const [allSkills, setAllSkills] = useState([]);
  const [allCategories, setAllCategories] = useState(['All']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState('name');
  const [order, setOrder] = useState('asc');
  const [aiQuery, setAiQuery] = useState('');
  const [aiMatches, setAiMatches] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  // ─── Load all skills + categories once (from static JSON) ───────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [skillsRes, catsRes] = await Promise.all([
          fetch('/api/skills.json'),
          fetch('/api/categories.json'),
        ]);
        if (!skillsRes.ok) throw new Error('HTTP ' + skillsRes.status);
        const skills = await skillsRes.json();
        if (cancelled) return;
        setAllSkills(Array.isArray(skills) ? skills : []);

        if (catsRes.ok) {
          const cats = await catsRes.json();
          if (cancelled) return;
          setAllCategories(['All', ...cats.map(cat => cat.name)]);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Filter + sort + paginate on the client ─────────────────────────────
  const filteredSkills = useMemo(() => {
    let list = allSkills;

    // Category filter
    if (activeCategory !== 'All') {
      list = list.filter(s => s.category === activeCategory);
    }

    // Search filter
    if (search) {
      const q = search.toLowerCase().trim();
      list = list.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q) ||
        (Array.isArray(s.tags) ? s.tags.some(t => String(t).toLowerCase().includes(q)) : false)
      );
    }

    // Sort
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sort === 'name')  cmp = String(a.name || '').localeCompare(String(b.name || ''));
      if (sort === 'price') cmp = (a.price || 0) - (b.price || 0);
      if (sort === 'score') cmp = (a.sentinel_score || 0) - (b.sentinel_score || 0);
      return order === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [allSkills, activeCategory, search, sort, order]);

  const total = filteredSkills.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pageSkills = filteredSkills.slice(startIdx, startIdx + PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [activeCategory, search, sort, order]);

  const handleCategory = (cat) => setActiveCategory(cat);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const handleSort = (e) => {
    const v = e.target.value;
    if (v === 'name-asc')       { setSort('name');  setOrder('asc'); }
    else if (v === 'name-desc')  { setSort('name');  setOrder('desc'); }
    else if (v === 'price-asc')  { setSort('price'); setOrder('asc'); }
    else if (v === 'price-desc') { setSort('price'); setOrder('desc'); }
    else if (v === 'score-asc')  { setSort('score'); setOrder('asc'); }
    else if (v === 'score-desc') { setSort('score'); setOrder('desc'); }
  };

  const handleAiSearch = (e) => {
    e.preventDefault();
    if (!aiQuery.trim() || allSkills.length === 0) return;
    setAiLoading(true);
    // Simulate small delay for UX
    setTimeout(() => {
      const matches = matchSkills(allSkills, aiQuery, 5);
      setAiMatches(matches);
      setAiLoading(false);
    }, 300);
  };

  // Page numbers (windowed)
  const pageNumbers = [];
  const maxVisible = 7;
  let startP = Math.max(1, safePage - Math.floor(maxVisible / 2));
  let endP = Math.min(totalPages, startP + maxVisible - 1);
  if (endP - startP < maxVisible - 1) startP = Math.max(1, endP - maxVisible + 1);
  for (let i = startP; i <= endP; i++) pageNumbers.push(i);

  // Network stats — translated labels
  const networkStats = [
    { label: c.stats.total, value: allSkills.length.toLocaleString() },
    { label: c.stats.avg, value: '$' + (allSkills.length > 0 ? (allSkills.reduce((a,s) => a + (s.price||0), 0) / allSkills.length).toFixed(2) : '0.00') },
    { label: c.stats.from, value: 'FREE' },
    { label: c.stats.protocol, value: 'MCP v1.0' },
  ];

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-[1440px] mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {c.titlePre}<span className="text-[#00F299]">{c.titleHighlight}</span>{c.titlePost}
          </h1>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            {c.subtitle}
          </p>
        </motion.div>

        {/* AI Skill Matcher */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="premium-card p-6 mb-10"
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🤖</span>
            <div>
              <h2 className="text-white font-semibold text-sm">{c.matcherTitle}</h2>
              <p className="text-zinc-500 text-xs">{c.matcherDesc}</p>
            </div>
          </div>
          <form onSubmit={handleAiSearch} className="flex gap-2">
            <input
              type="text"
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              placeholder={c.matcherPlaceholder}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:border-[#00F299]/50 focus:outline-none text-sm"
            />
            <button
              type="submit"
              disabled={aiLoading || !aiQuery.trim()}
              className="px-6 py-3 bg-[#00F299] text-black font-bold text-sm rounded-xl hover:bg-[#00F299]/90 transition-all disabled:opacity-50"
            >
              {aiLoading ? c.matcherMatching : c.matcherFind}
            </button>
          </form>

          {aiMatches && (
            <div className="mt-6 space-y-3">
              {aiMatches.length === 0 ? (
                <div className="text-center py-6 text-zinc-500 text-sm">
                  {c.matcherNoMatches}
                </div>
              ) : (
                aiMatches.map((m, i) => (
                  <Link
                    key={m.skill.id}
                    to={`/skill/${m.skill.id}`}
                    className="block p-4 rounded-xl bg-white/5 border border-white/5 hover:border-[#00F299]/30 hover:bg-[#00F299]/5 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] text-zinc-500 font-mono">#{i + 1}</span>
                          <span className="text-white font-semibold text-sm group-hover:text-[#00F299] transition-colors">
                            {m.skill.name}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] text-zinc-500 font-mono">
                            {m.skill.category}
                          </span>
                        </div>
                        <p className="text-zinc-400 text-xs line-clamp-2">{m.skill.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[#00F299] font-mono font-bold text-sm">
                          ${m.skill.price.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {c.matchLabel} {(m.score).toFixed(1)}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}
        </motion.div>

        {/* Network Stats — solo datos reales */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10"
        >
          {networkStats.map((stat) => (
            <div key={stat.label} className="premium-card py-4 px-5">
              <div className="text-[10px] text-zinc-500 font-mono tracking-wider mb-1 uppercase">
                {stat.label}
              </div>
              <div className="text-lg font-mono font-semibold text-white">
                {stat.value}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Error state */}
        {error && (
          <div className="mb-8 px-6 py-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-center">
            {error}
            <button onClick={() => window.location.reload()} className="ml-4 underline hover:text-red-300">{c.retry}</button>
          </div>
        )}

        {/* Search + Sort */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={c.searchPlaceholder}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-[#00F299]/50"
            />
          </form>
          <select
            value={sort + '-' + order}
            onChange={handleSort}
            className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#00F299]/50 cursor-pointer"
          >
            <option value="name-asc">{c.sortOptions['name-asc']}</option>
            <option value="name-desc">{c.sortOptions['name-desc']}</option>
            <option value="price-asc">{c.sortOptions['price-asc']}</option>
            <option value="price-desc">{c.sortOptions['price-desc']}</option>
            <option value="score-asc">{c.sortOptions['score-asc']}</option>
            <option value="score-desc">{c.sortOptions['score-desc']}</option>
          </select>
          <span className="text-xs text-zinc-500 font-mono whitespace-nowrap">
            {fmt(c.pageOf, { current: safePage, total: totalPages })}
          </span>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {allCategories.slice(0, 16).map((cat) => {
            const catKey = cat === 'All' ? 'cat.all' : `cat.${cat.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            const catLabel = t(catKey) !== catKey ? t(catKey) : cat;
            return (
              <button
                key={cat}
                onClick={() => handleCategory(cat)}
                className={`px-4 py-2 rounded-lg text-xs font-mono tracking-wider transition-all duration-300 ${
                  activeCategory === cat
                    ? 'bg-[#00F299]/20 text-[#00F299] border border-[#00F299]/40'
                    : 'bg-white/5 text-zinc-400 border border-white/5 hover:bg-white/10 hover:text-white'
                }`}
              >
                {cat === 'All' ? catLabel.toUpperCase() : catLabel.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Pagination top */}
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-zinc-300 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {c.prev}
            </button>
            {startP > 1 && <span className="text-zinc-600 text-xs px-1">...</span>}
            {pageNumbers.map(n => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  n === safePage
                    ? 'bg-[#00F299]/20 text-[#00F299] border border-[#00F299]/40'
                    : 'bg-white/5 text-zinc-400 border border-white/5 hover:bg-white/10 hover:text-white'
                }`}
              >
                {n}
              </button>
            ))}
            {endP < totalPages && <span className="text-zinc-600 text-xs px-1">...</span>}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-zinc-300 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {c.next}
            </button>
          </div>
        )}

        {/* Skill Grid */}
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-2 border-[#00F299] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-zinc-500 font-mono text-sm">{c.loadingRegistry}</p>
          </div>
        ) : (
          <>
            <div className="text-xs text-zinc-600 font-mono mb-4">
              {fmt(c.showingOf, { shown: pageSkills.length, total: total.toLocaleString() })}
            </div>
            <motion.div
              layout
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              {pageSkills.map((skill, index) => (
                <motion.div
                  key={skill.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.3) }}
                  layout
                >
                  <Link to={`/skill/${skill.id}`}>
                    <div className="premium-card p-5 h-full flex flex-col group cursor-pointer hover:border-[#00F299]/30 transition-all duration-500">
                      <div className="text-4xl mb-4">{skill.icon || '🧩'}</div>

                      <div className="mb-3">
                        <span className="px-2.5 py-1 rounded-md bg-white/5 text-[10px] font-mono text-zinc-500 tracking-wider border border-white/5">
                          {(skill.category || 'General').toUpperCase()}
                        </span>
                      </div>

                      <h3 className="text-white font-semibold text-base mb-2 group-hover:text-[#00F299] transition-colors">
                        {skill.name}
                      </h3>

                      <p className="text-zinc-400 text-xs leading-relaxed mb-4 flex-1 line-clamp-3">
                        {skill.description}
                      </p>

                      {/* Meta */}
                      <div className="flex items-center justify-between pt-4 border-t border-white/5">
                        <span className="text-[#00F299] font-mono text-sm font-bold">
                          ${skill.price.toFixed(2)}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#00F299]/10 text-[#00F299] text-[10px] font-mono border border-[#00F299]/20">
                          {c.verified}
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>

            {/* Empty state */}
            {pageSkills.length === 0 && !loading && (
              <div className="text-center py-16">
                <div className="text-5xl mb-4">🔍</div>
                <p className="text-zinc-500 font-mono text-sm">{c.noSkillsFound}</p>
              </div>
            )}

            {/* Pagination bottom */}
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-10">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-zinc-300 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  {c.prev}
                </button>
                {startP > 1 && <span className="text-zinc-600 text-xs px-1">...</span>}
                {pageNumbers.map(n => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                      n === safePage
                        ? 'bg-[#00F299]/20 text-[#00F299] border border-[#00F299]/40'
                        : 'bg-white/5 text-zinc-400 border border-white/5 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                {endP < totalPages && <span className="text-zinc-600 text-xs px-1">...</span>}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-zinc-300 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  {c.next}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
