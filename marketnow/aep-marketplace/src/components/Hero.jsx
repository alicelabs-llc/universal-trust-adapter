import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function Hero({ onSignIn }) {
  const [stats, setStats] = useState({ total: 5054, categories: 25, avgPrice: 2.50 });

  useEffect(() => {
    fetch('/api/manifest.json')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && typeof d.total_skills === 'number') {
          setStats(s => ({
            ...s,
            total: d.total_skills,
            categories: d.categories_count || 25,
          }));
        }
      })
      .catch(() => {});
    fetch('/api/agent.json')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && d.pricing && typeof d.pricing.average === 'number') {
          setStats(s => ({ ...s, avgPrice: d.pricing.average }));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Decorative grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00F299]/10 border border-[#00F299]/20 mb-8">
            <span className="w-2 h-2 rounded-full bg-[#00F299] animate-pulse" />
            <span className="text-[#00F299] text-xs font-mono tracking-wider">
              MCP-COMPATIBLE · BUILT FOR AUTONOMOUS AGENTS
            </span>
          </div>

          {/* Title */}
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            The{' '}
            <span className="bg-gradient-to-r from-[#00F299] to-[#00d1ff] bg-clip-text text-transparent">
              Agent Skill
            </span>{' '}
            <br />
            Marketplace
          </h1>

          {/* Subtitle — for agents */}
          <p className="text-zinc-400 text-lg md:text-xl mb-8 max-w-2xl mx-auto leading-relaxed">
            Discover, evaluate, and install {stats.total.toLocaleString()}+ verified MCP skills
            through a public JSON API. Free to install — designed for autonomous
            agents to buy and deploy without human intervention.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              to="/registry"
              className="px-8 py-4 bg-[#00F299] text-black font-bold rounded-xl hover:bg-[#00F299]/90 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 shadow-lg shadow-[#00F299]/20"
            >
              BROWSE 9,248 SKILLS →
            </Link>
            <Link
              to="/submit"
              className="px-8 py-4 border border-[#00F299]/30 bg-[#00F299]/10 text-[#00F299] font-bold rounded-xl hover:bg-[#00F299]/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
            >
              + SELL YOUR SKILLS (3 FREE)
            </Link>
            <Link
              to="/pricing"
              className="px-8 py-4 border border-white/10 text-white font-medium rounded-xl hover:bg-white/5 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
            >
              SEE PRICING
            </Link>
          </div>

          {/* Urgency / social proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mb-12 text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00F299]/5 border border-[#00F299]/20">
              <span className="w-2 h-2 rounded-full bg-[#00F299] animate-pulse" />
              <span className="text-[#00F299] text-xs font-mono tracking-wider">
                JOIN 5,000+ SKILLS ALREADY LISTED · LIST YOUR FIRST 3 FREE
              </span>
            </div>
          </motion.div>

          {/* Stats — agent-relevant */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {[
              { value: stats.total.toLocaleString() + '+', label: 'VERIFIED SKILLS' },
              { value: '$' + stats.avgPrice.toFixed(2), label: 'AVG PRICE (USD)' },
              { value: '0', label: 'COST FOR BUYERS' },
              { value: 'MCP v1.0', label: 'PROTOCOL' },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center"
              >
                <div className="text-2xl md:text-3xl font-bold text-white font-mono">
                  {stat.value}
                </div>
                <div className="text-[10px] text-zinc-500 font-mono tracking-wider mt-1">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Agent curl example */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-12 max-w-2xl mx-auto"
          >
            <div className="text-left p-4 rounded-xl bg-black/60 border border-white/5">
              <div className="text-[10px] text-zinc-500 font-mono mb-2 uppercase tracking-wider">
                Try the API
              </div>
              <code className="text-[#00F299] text-sm font-mono break-all">
                curl https://marketnow.site/api/skills.json | jq '.[0:3] | .[] | {"{{name, price}}"}'
              </code>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
