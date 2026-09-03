import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';

export default function AgentLanding() {
  const { t, lang } = useLang();
  const [stats, setStats] = useState({ total: 9248, audited: 5662, checks: 1211488, quarantined: 80 });
  const [topPaid, setTopPaid] = useState([]);

  useEffect(() => {
    fetch('/api/agent-ping.json')
      .then(r => r.json())
      .then(d => setStats(s => ({
        ...s,
        total: d.stats?.total_skills || 9248,
        audited: d.stats?.audited || 5662,
        checks: d.stats?.security_checks_performed || 1211488,
        quarantined: d.stats?.critical_blocked || 80,
      })))
      .catch(() => {});

    fetch('/api/skills.json')
      .then(r => r.json())
      .then(d => {
        const trending = d
          .filter(s => s.sentinel_score >= 7 && s.price >= 1.99 && s.price <= 4.99)
          .slice(0, 3);
        setTopPaid(trending);
      })
      .catch(() => {});
  }, []);

  const apiEndpoints = [
    { m: 'GET', p: '/api/skills.json', d: t('home.apiFullCatalog') },
    { m: 'GET', p: '/api/search?q=', d: t('home.apiSearch') },
    { m: 'GET', p: '/api/agent.json', d: t('home.apiAgentDocs') },
    { m: 'GET', p: '/api/policies.json', d: t('home.apiPolicies') },
    { m: 'POST', p: '/api/agent-purchase', d: t('home.apiPurchase') },
    { m: 'GET', p: '/api/mandates', d: t('home.apiMandates') },
    { m: 'GET', p: '/api/audit-report.json', d: 'Transparency report (safe / risky / quarantined)' },
    { m: 'GET', p: '/api/owasp', d: 'OWASP MCP Cheat Sheet compliance matrix' },
    { m: 'GET', p: '/api/bundles.json', d: t('home.apiBundles') },
  ];

  const features = [
    { icon: '🛡️', title: 'UTA 12-stage trust pipeline', desc: '1.2M checks, 80 quarantined, 8,742 auto-scanned, 22 human-reviewed' },
    { icon: '🔑', title: 'Agent Trust Card (ATC)', desc: 'Ed25519 (RFC 8032) + RFC 8785 JCS. 8 format adapters, 5 test vectors, 23/23 conformance' },
    { icon: '🚦', title: 'Runtime Interceptor', desc: '5 policy rules: blocks .env, rm -rf, process spawns, system writes' },
    { icon: '📋', title: 'OWASP MCP Cheat Sheet', desc: '12 controls mapped (4 live, 8 planned v5.1-v6.0)' },
    { icon: '🤝', title: t('home.feat.humanLoopTitle'), desc: t('home.feat.humanLoopDesc') },
    { icon: '📜', title: t('home.feat.auditLogTitle'), desc: t('home.feat.auditLogDesc') },
    { icon: '🌍', title: t('home.feat.langsTitle'), desc: t('home.feat.langsDesc') },
    { icon: '📑', title: t('home.feat.roadmapTitle'), desc: t('home.feat.roadmapDesc') },
  ];

  const statItems = [
    { v: stats.total.toLocaleString()+'+', l: 'MCP skills analyzed' },
    { v: (stats.checks/1_000_000).toFixed(2)+'M', l: 'Security checks performed' },
    { v: stats.quarantined.toString(), l: 'Quarantined (critical)' },
    { v: '12', l: 'MCP tools (marketnow_*)' },
  ];

  const tweetText = {
    en: "MarketNow — security infrastructure for AI agents. Sentinel: 12-stage verification pipeline, 1.2M checks, 1,030 threats detected, 80 quarantined. 12 MCP tools (marketnow_* namespace). v1.9.0.",
    es: "MarketNow — infraestructura de seguridad para agentes IA. Sentinel: pipeline de auditoría de 10 capas, 1.2M chequeos, 1,030 amenazas detectadas, 80 en cuarentena. 12 herramientas MCP (namespace marketnow_*). v1.9.0.",
    pt: "MarketNow — infraestrutura de segurança para agentes IA. Sentinel: pipeline de auditoria de 10 camadas, 1.2M verificações, 1.030 ameaças detectadas, 80 em quarentena. 12 ferramentas MCP (namespace marketnow_*). v1.9.0.",
    zh: "MarketNow — AI 代理安全基础设施。Sentinel: 10 层审计管道, 120 万次检查, 1,030 个威胁已检测, 80 个已隔离。12 个 MCP 工具 (marketnow_* 命名空间)。v1.9.0。",
    fr: "MarketNow — infrastructure de sécurité pour agents IA. Sentinel: pipeline d'audit 10 couches, 1.2M vérifications, 1.030 menaces détectées, 80 en quarantaine. 12 outils MCP (namespace marketnow_*). v1.9.0.",
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative z-10">
        {/* ============ HERO ============ */}
        <section className="text-center max-w-5xl mx-auto px-6 pt-24 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00F299]/10 border border-[#00F299]/20 mb-8">
              <span className="w-2 h-2 rounded-full bg-[#00F299] animate-pulse" />
              <span className="text-[#00F299] text-xs font-mono tracking-wider">
                {t('hero.badge')}
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              {t('hero.title1')}<br />
              <span className="bg-gradient-to-r from-[#00F299] to-[#00d1ff] bg-clip-text text-transparent">
                {t('hero.title2')}
              </span>
            </h1>

            <p className="text-zinc-300 text-lg md:text-xl mb-3 max-w-2xl mx-auto leading-relaxed">
              {t('hero.body')}
            </p>
            <p className="text-zinc-500 text-sm mb-10 max-w-xl mx-auto">
              {stats.total.toLocaleString()}+ {t('hero.meta')}
            </p>

            {/* Search bar */}
            <div className="max-w-2xl mx-auto mb-8">
              <Link to="/registry" className="flex items-center gap-3 px-5 py-4 bg-black/40 border border-white/10 rounded-xl hover:border-[#00F299]/40 transition-all group">
                <span className="text-zinc-500 text-lg">🔍</span>
                <span className="text-zinc-500 text-sm md:text-base flex-1 text-left group-hover:text-zinc-400">
                  {t('hero.searchPlaceholder')}
                </span>
                <span className="text-[#00F299] text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity">→</span>
              </Link>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
              <Link to="/registry" className="px-7 py-3.5 bg-[#00F299] text-black font-bold rounded-xl hover:bg-[#00F299]/90 hover:scale-[1.02] transition-all shadow-lg shadow-[#00F299]/20 text-sm">
                {t('hero.ctaBrowse')}
              </Link>
              <Link to="/registry" className="px-7 py-3.5 border border-[#00d1ff]/30 bg-[#00d1ff]/10 text-[#00d1ff] font-bold rounded-xl hover:bg-[#00d1ff]/20 transition-all text-sm">
                🛡️ Sentinel Audit Report
              </Link>
              <Link to="/submit" className="px-7 py-3.5 border border-white/10 text-white font-medium rounded-xl hover:bg-white/5 transition-all text-sm">
                {t('hero.ctaPublish')}
              </Link>
            </div>

            {/* Install command */}
            <div className="inline-block px-4 py-2 rounded-lg bg-black/40 border border-white/5 mb-2">
              <code className="text-[#00F299] text-xs font-mono">npx -y marketnow-install-stack</code>
              <span className="text-zinc-600 text-xs ml-2">{t('home.or')}</span>
              <code className="text-[#00d1ff] text-xs font-mono ml-2">npx -y marketnow-mcp</code>
            </div>
            <p className="text-zinc-600 text-[10px]">{t('home.compatibleWith')}</p>
          </motion.div>
        </section>

        {/* ============ SENTINEL TRANSPARENCY ============ */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="premium-card p-6 md:p-8">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div>
                <h2 className="text-white text-2xl font-bold mb-1">Sentinel Transparency Report</h2>
                <p className="text-zinc-400 text-sm">1,211,488 checks · 1,030 threats detected · 80 quarantined · 8,742 auto-scanned · 22 human-reviewed · 0 maintainer-verified</p>
              </div>
              <a href="/api/audit-report.json" target="_blank" rel="noopener" className="text-[#00F299] text-sm hover:underline">View full report →</a>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-black/40 border border-white/5">
                <div className="text-[#00F299] text-2xl font-bold font-mono">1.2M</div>
                <div className="text-zinc-500 text-xs mt-1">checks performed</div>
              </div>
              <div className="p-4 rounded-xl bg-black/40 border border-white/5">
                <div className="text-[#00d1ff] text-2xl font-bold font-mono">1,030</div>
                <div className="text-zinc-500 text-xs mt-1">threats detected</div>
              </div>
              <div className="p-4 rounded-xl bg-black/40 border border-red-500/20">
                <div className="text-red-400 text-2xl font-bold font-mono">80</div>
                <div className="text-zinc-500 text-xs mt-1">quarantined</div>
              </div>
              <div className="p-4 rounded-xl bg-black/40 border border-[#00F299]/20">
                <div className="text-[#00F299] text-2xl font-bold font-mono">8,742</div>
                <div className="text-zinc-500 text-xs mt-1">auto-scanned</div>
              </div>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-black/40 border border-white/5">
              <div className="text-zinc-500 text-[10px] mb-1">Public audit report</div>
              <code className="text-[#00F299] text-xs font-mono">GET /api/audit-report.json</code>
              <span className="text-zinc-700 text-[10px] mx-2">·</span>
              <code className="text-[#00d1ff] text-xs font-mono">GET /api/owasp</code>
              <span className="text-zinc-700 text-[10px] mx-2">·</span>
              <code className="text-[#00d1ff] text-xs font-mono">POST /api/interceptor</code>
            </div>
          </motion.div>
        </section>

        {/* ============ TRENDING PAID SKILLS ============ */}
        {topPaid.length > 0 && (
          <section className="max-w-5xl mx-auto px-6 pb-16">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <h2 className="text-white text-2xl font-bold text-center mb-2">{t('home.trendingTitle')}</h2>
              <p className="text-zinc-500 text-sm text-center mb-8">{t('home.trendingDesc')}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {topPaid.map(s => (
                  <Link key={s.id} to={`/skill/${s.id}`} className="block p-4 rounded-xl bg-black/40 border border-white/5 hover:border-[#00d1ff]/30 transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <span className="px-2 py-0.5 rounded bg-[#00d1ff]/10 text-[#00d1ff] text-[10px] font-mono font-bold">${s.price}</span>
                      <span className="px-2 py-0.5 rounded bg-[#00F299]/10 text-[#00F299] text-[10px] font-mono font-bold">🛡️ {s.sentinel_score}/10</span>
                    </div>
                    <div className="text-white text-sm font-bold mb-1 truncate">{s.name}</div>
                    <p className="text-zinc-500 text-xs line-clamp-2">{s.description}</p>
                    <div className="text-zinc-600 text-[10px] mt-2">{s.category}</div>
                  </Link>
                ))}
              </div>
            </motion.div>
          </section>
        )}

        {/* ============ UTA — UNIVERSAL TRUST ADAPTER ============ */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="premium-card p-6 md:p-8">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00d1ff]/10 border border-[#00d1ff]/20 mb-3">
                  <span className="text-[#00d1ff] text-[10px] font-mono tracking-wider">UTA v1.1.0</span>
                </div>
                <h2 className="text-white text-2xl font-bold mb-1">Universal Trust Adapter (UTA)</h2>
                <p className="text-zinc-400 text-sm">The USB-C of agent trust. Translates between 8 trust credential formats via canonical Universal Trust Schema (UTS v2.0.0).</p>
              </div>
              <Link to="/uta" className="px-4 py-2 bg-[#00F299] text-black font-bold rounded-lg hover:bg-[#00F299]/90 transition-all text-sm whitespace-nowrap">
                Explore UTA →
              </Link>
            </div>

            {/* 8 format adapters */}
            <div className="mb-4">
              <div className="text-zinc-500 text-[10px] mb-2">8 FORMAT ADAPTERS</div>
              <div className="flex flex-wrap gap-2">
                {['ATC', 'EAT-AI', 'ZTA', 'A2A', 'MCP Card', 'W3C VC', 'OAuth', 'SPIFFE'].map(fmt => (
                  <span key={fmt} className="px-2 py-1 rounded bg-[#00d1ff]/10 text-[#00d1ff] text-[10px] font-mono font-bold border border-[#00d1ff]/20">{fmt}</span>
                ))}
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                <div className="text-[#00F299] text-xl font-bold font-mono">12</div>
                <div className="text-zinc-500 text-[10px] mt-1">verification stages</div>
              </div>
              <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                <div className="text-[#00d1ff] text-xl font-bold font-mono">Ed25519</div>
                <div className="text-zinc-500 text-[10px] mt-1">RFC 8032 signatures</div>
              </div>
              <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                <div className="text-[#00F299] text-xl font-bold font-mono">RFC 8785</div>
                <div className="text-zinc-500 text-[10px] mt-1">JCS canonical JSON</div>
              </div>
              <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                <div className="text-[#00d1ff] text-xl font-bold font-mono">23/23</div>
                <div className="text-zinc-500 text-[10px] mt-1">conformance tests</div>
              </div>
            </div>

            {/* ATC versions */}
            <div className="mb-4 p-3 rounded-lg bg-black/40 border border-white/5">
              <div className="text-zinc-500 text-[10px] mb-2">ATC SPECIFICATIONS</div>
              <div className="flex flex-wrap gap-3 text-xs">
                <a href="/uta/docs/atc-spec/SPEC.md" target="_blank" rel="noopener" className="text-[#00F299] hover:underline">ATC/1.0 spec (public, stable) →</a>
                <a href="/uta/docs/atc-spec/RFC-ATC-v3-Draft-00.md" target="_blank" rel="noopener" className="text-[#00d1ff] hover:underline">ATC v3.0 RFC Draft (multi-sig) →</a>
                <a href="/uta/docs/atc-spec/test-vectors/_index.json" target="_blank" rel="noopener" className="text-[#00F299] hover:underline">Test vectors (5 frozen) →</a>
                <a href="/uta/docs/atc-spec/test-vectors/_test-ca-keys.json" target="_blank" rel="noopener" className="text-[#00d1ff] hover:underline">Test CA keys →</a>
              </div>
            </div>

            {/* NPM packages */}
            <div className="mb-4 p-3 rounded-lg bg-black/40 border border-white/5">
              <div className="text-zinc-500 text-[10px] mb-2">NPM PACKAGES (2,339 downloads/mo)</div>
              <div className="flex flex-wrap gap-2">
                <code className="text-[#00F299] text-[10px] font-mono px-2 py-1 rounded bg-[#00F299]/5">marketnow-mcp@1.10.1</code>
                <code className="text-[#00d1ff] text-[10px] font-mono px-2 py-1 rounded bg-[#00d1ff]/5">agent-trust-card@1.1.2</code>
                <code className="text-[#00F299] text-[10px] font-mono px-2 py-1 rounded bg-[#00F299]/5">@marketnow/trust-core@1.0.1</code>
                <code className="text-[#00d1ff] text-[10px] font-mono px-2 py-1 rounded bg-[#00d1ff]/5">@marketnow/uts@2.0.1</code>
                <code className="text-[#00F299] text-[10px] font-mono px-2 py-1 rounded bg-[#00F299]/5">@marketnow/trust-adapters@1.0.1</code>
                <code className="text-[#00d1ff] text-[10px] font-mono px-2 py-1 rounded bg-[#00d1ff]/5">@marketnow/trust-gateway@1.0.1</code>
              </div>
            </div>

            {/* Links + install */}
            <div className="p-3 rounded-lg bg-black/40 border border-white/5 flex items-center gap-3 flex-wrap">
              <span className="text-zinc-500 text-[10px]">Install:</span>
              <code className="text-[#00F299] text-xs font-mono">npm install agent-trust-card@1.1.2</code>
              <span className="text-zinc-700">·</span>
              <code className="text-[#00d1ff] text-xs font-mono">npx -y marketnow-mcp@1.10.1</code>
              <a href="/uta/README.md" target="_blank" rel="noopener" className="text-[#00F299] text-xs hover:underline ml-auto">README →</a>
              <a href="/uta/CONTRIBUTING.md" target="_blank" rel="noopener" className="text-[#00d1ff] text-xs hover:underline">CONTRIBUTING →</a>
              <a href="/uta/SECURITY.md" target="_blank" rel="noopener" className="text-[#00F299] text-xs hover:underline">SECURITY →</a>
              <a href="/trust/audit-status.json" target="_blank" rel="noopener" className="text-[#00d1ff] text-xs hover:underline">AUDIT (14/14 fixed) →</a>
            </div>
          </motion.div>
        </section>


        {/* ============ WHY MARKETNOW ============ */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <h2 className="text-white text-2xl font-bold text-center mb-2">Why MarketNow?</h2>
            <p className="text-zinc-500 text-sm text-center mb-8">The trust layer for AI agent commerce. Here's the value for everyone.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="premium-card p-6">
                <div className="text-3xl mb-3">🤖</div>
                <h3 className="text-white font-bold text-sm mb-2">For Buyers (Agents)</h3>
                <ul className="text-zinc-400 text-xs space-y-1">
                  <li>✓ Browse 9,248 skills — free and premium</li>
                  <li>✓ Free skills need no payment. Premium skills pay the seller's price</li>
                  <li>✓ Sentinel v3.0 security audit on every skill</li>
                  <li>✓ Trust scores (0-10) for every skill</li>
                  <li>✓ 8,742 auto-scanned, 22 human-reviewed</li>
                  <li>✓ Works with Claude, Cursor, Cline, Continue, Aider</li>
                </ul>
              </div>
              <div className="premium-card p-6">
                <div className="text-3xl mb-3">🛠️</div>
                <h3 className="text-white font-bold text-sm mb-2">For Sellers (Developers)</h3>
                <ul className="text-zinc-400 text-xs space-y-1">
                  <li>✓ List skills FREE — set your own price</li>
                  <li>✓ Free skills: no cost, no commission</li>
                  <li>✓ Premium skills: keep 80% of every sale</li>
                  <li>✓ Sentinel v3.0 audit (free)</li>
                  <li>✓ gVisor sandbox (free)</li>
                  <li>✓ Sell to 9,248+ users and growing</li>
                </ul>
              </div>
              <div className="premium-card p-6">
                <div className="text-3xl mb-3">💰</div>
                <h3 className="text-white font-bold text-sm mb-2">How We Earn</h3>
                <ul className="text-zinc-400 text-xs space-y-1">
                  <li>✓ Buyers: free skills cost nothing, premium skills pay the seller's price</li>
                  <li>✓ Sellers: free listing + free Sentinel v3.0 audits</li>
                  <li>✓ 20% commission on seller sales</li>
                  <li>✓ Affiliate program: 5% referral commission</li>
                  <li>✓ No ads, no data selling</li>
                  <li>✓ Open-source (AL-1.0 license)</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ============ FOR DEVS ============ */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            <h2 className="text-white text-2xl font-bold text-center mb-2">{t('home.forDevsTitle')}</h2>
            <p className="text-zinc-500 text-sm text-center mb-8">{t('home.forDevsDesc')}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="premium-card p-6">
                <div className="text-3xl mb-3">🔍</div>
                <h3 className="text-white font-bold text-sm mb-2">{t('home.step1Title')}</h3>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  {t('home.step1Desc')}
                </p>
              </div>
              <div className="premium-card p-6">
                <div className="text-3xl mb-3">💳</div>
                <h3 className="text-white font-bold text-sm mb-2">{t('home.step2Title')}</h3>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  {t('home.step2Desc')}
                </p>
              </div>
              <div className="premium-card p-6">
                <div className="text-3xl mb-3">⚡</div>
                <h3 className="text-white font-bold text-sm mb-2">{t('home.step3Title')}</h3>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  <code className="text-[#00F299]">npx -y marketnow-install-stack</code>
                  <br />{t('home.step3Desc')}
                </p>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ============ FOR AGENTS ============ */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            <h2 className="text-white text-2xl font-bold text-center mb-2">{t('home.forAgentsTitle')}</h2>
            <p className="text-zinc-500 text-sm text-center mb-8">{t('home.forAgentsDesc')}</p>

            <div className="premium-card p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                {apiEndpoints.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-black/40">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${e.m === 'POST' ? 'bg-[#00d1ff]/10 text-[#00d1ff]' : 'bg-[#00F299]/10 text-[#00F299]'}`}>{e.m}</span>
                    <code className="text-white text-xs font-mono">{e.p}</code>
                    <span className="text-zinc-600 text-[10px] ml-auto">{e.d}</span>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-lg bg-black/40">
                <div className="text-zinc-500 text-[10px] mb-1">{t('home.mcpServerLabel')}</div>
                <code className="text-[#00F299] text-xs font-mono">npx -y marketnow-mcp</code>
                <span className="text-zinc-700 text-[10px] ml-2">·</span>
                <a href="https://www.npmjs.com/package/marketnow-mcp" target="_blank" rel="noopener" className="text-zinc-500 text-[10px] ml-2 hover:text-[#00F299]">npm</a>
                <span className="text-zinc-700 text-[10px]">·</span>
                <a href="https://smithery.ai/servers/alicelabs/marketnow" target="_blank" rel="noopener" className="text-zinc-500 text-[10px] hover:text-[#00F299]">Smithery</a>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ============ WHY RECOMMEND US ============ */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
            <h2 className="text-white text-2xl font-bold text-center mb-2">{t('home.whyTitle')}</h2>
            <p className="text-zinc-500 text-sm text-center mb-8">{t('home.whyDesc')}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {features.map((f, i) => (
                <div key={i} className="p-4 rounded-xl bg-black/40 border border-white/5">
                  <div className="text-2xl mb-2">{f.icon}</div>
                  <div className="text-white text-xs font-bold mb-1">{f.title}</div>
                  <div className="text-zinc-500 text-[11px]">{f.desc}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ============ SHARE / RECOMMEND ============ */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-xl font-bold mb-2">{t('home.shareTitle')}</h2>
            <p className="text-zinc-400 text-sm mb-4">{t('home.shareDesc')}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText[lang] || tweetText.en)}&url=${encodeURIComponent("https://marketnow.site")}`}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-3 p-3 rounded-lg bg-black/40 border border-white/5 hover:border-[#00F299]/30 transition-all"
              >
                <span className="text-xl">🐦</span>
                <div className="flex-1 text-left">
                  <div className="text-white text-sm font-bold">{t('home.shareTwitter')}</div>
                  <div className="text-zinc-500 text-xs">{t('home.shareTwitterDesc')}</div>
                </div>
                <span className="text-[#00F299] text-xs">→</span>
              </a>

              <a
                href={`https://news.ycombinator.com/submitlink?u=${encodeURIComponent("https://marketnow.site")}&t=${encodeURIComponent("MarketNow — Security infrastructure for AI agents. UTA 12-stage trust pipeline (1.2M checks, 80 quarantined)")}`}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-3 p-3 rounded-lg bg-black/40 border border-white/5 hover:border-[#00F299]/30 transition-all"
              >
                <span className="text-xl">🟧</span>
                <div className="flex-1 text-left">
                  <div className="text-white text-sm font-bold">{t('home.shareHn')}</div>
                  <div className="text-zinc-500 text-xs">{t('home.shareHnDesc')}</div>
                </div>
                <span className="text-[#00F299] text-xs">→</span>
              </a>

              <a
                href="https://www.reddit.com/r/mcp/submit"
                target="_blank"
                rel="noopener"
                className="flex items-center gap-3 p-3 rounded-lg bg-black/40 border border-white/5 hover:border-[#00F299]/30 transition-all"
              >
                <span className="text-xl">👽</span>
                <div className="flex-1 text-left">
                  <div className="text-white text-sm font-bold">{t('home.shareReddit')}</div>
                  <div className="text-zinc-500 text-xs">{t('home.shareRedditDesc')}</div>
                </div>
                <span className="text-[#00F299] text-xs">→</span>
              </a>

              <Link
                to="/embed"
                className="flex items-center gap-3 p-3 rounded-lg bg-black/40 border border-white/5 hover:border-[#00F299]/30 transition-all"
              >
                <span className="text-xl">🏷️</span>
                <div className="flex-1 text-left">
                  <div className="text-white text-sm font-bold">{t('home.shareBadge')}</div>
                  <div className="text-zinc-500 text-xs">{t('home.shareBadgeDesc')}</div>
                </div>
                <span className="text-[#00F299] text-xs">→</span>
              </Link>
            </div>
          </motion.div>
        </section>

        {/* ============ STATS STRIP ============ */}
        <section className="max-w-3xl mx-auto px-6 pb-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {statItems.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.05 }} className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white font-mono">{s.v}</div>
                <div className="text-[10px] text-zinc-500 font-mono tracking-wider mt-1">{s.l}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ============ FOOTER LINKS ============ */}
        <section className="max-w-3xl mx-auto px-6 pb-16 text-center">
          <div className="flex items-center justify-center gap-4 flex-wrap text-xs">
            <Link to="/trust" className="text-[#00F299] hover:underline">{t('nav.trustRoadmap')}</Link>
            <span className="text-zinc-700">·</span>
            <Link to="/standards" className="text-[#00F299] hover:underline">{t('nav.standards')}</Link>
            <span className="text-zinc-700">·</span>
            <Link to="/about" className="text-zinc-400 hover:underline">{t('nav.about')}</Link>
            <span className="text-zinc-700">·</span>
            <Link to="/catalog" className="text-zinc-400 hover:underline">{t('nav.catalog')}</Link>
            <span className="text-zinc-700">·</span>
            <Link to="/mandates" className="text-zinc-400 hover:underline">{t('nav.mandates')}</Link>
            <span className="text-zinc-700">·</span>
            <Link to="/pricing" className="text-zinc-400 hover:underline">{t('nav.pricing')}</Link>
            <span className="text-zinc-700">·</span>
            <Link to="/security" className="text-zinc-400 hover:underline">{t('nav.sentinel')}</Link>
            <span className="text-zinc-700">·</span>
            <Link to="/listings" className="text-zinc-400 hover:underline">{t('nav.listings')}</Link>
            <span className="text-zinc-700">·</span>
            <Link to="/handshake" className="text-zinc-400 hover:underline">{t('nav.apiDocs')}</Link>
            <span className="text-zinc-700">·</span>
            <Link to="/policies" className="text-zinc-400 hover:underline">{t('nav.terms')}</Link>
          </div>
          <p className="text-zinc-700 text-[10px] mt-4">
            {t('home.copyright')}
          </p>
        </section>
      </div>
    </div>
  );
}
