import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

/**
 * MarketNow — Sentinel Transparency Dashboard
 * =============================================
 *
 * Real-time public dashboard showing:
 *   - Total certified skills count
 *   - Score distribution (0-10)
 *   - Risk level breakdown (low/medium/high/critical)
 *   - L2 Docker sandbox coverage
 *   - Latest batch audit results
 *   - Recent certificates issued (live feed)
 *   - Weekly cron status
 *
 * Data source: GET /api/audit-skill?sentinel-status=1
 * Auto-refreshes every 60 seconds.
 */

const RISK_COLORS = {
  low: { bg: 'bg-[#00F299]/10', text: 'text-[#00F299]', border: 'border-[#00F299]/20', bar: 'bg-[#00F299]', label: 'LOW' },
  medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20', bar: 'bg-yellow-500', label: 'MEDIUM' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', bar: 'bg-orange-500', label: 'HIGH' },
  critical: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', bar: 'bg-red-500', label: 'CRITICAL' },
  unknown: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/20', bar: 'bg-zinc-500', label: 'UNKNOWN' },
};

export default function SentinelTransparency() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  const loadData = async () => {
    try {
      const res = await fetch('/api/audit-skill?sentinel-status=1');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setData(d);
      setLastRefresh(new Date());
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto-refresh every 60 seconds
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="min-h-screen pt-20 pb-12 px-4 flex items-center justify-center">
        <div className="text-zinc-400 text-sm animate-pulse">Loading transparency data…</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen pt-20 pb-12 px-4 flex items-center justify-center">
        <div className="text-red-400 text-sm">Error: {error}</div>
      </div>
    );
  }

  const certs = data?.certificates || {};
  const l2 = data?.l2_sandbox || {};
  const batch = data?.l16_batch || {};
  const certCount = certs.count || 0;
  const byRisk = certs.by_risk || {};
  const byScore = certs.by_score || {};
  const l2Summaries = l2.summaries || [];
  const totalRisk = Object.values(byRisk).reduce((a, b) => a + b, 0) || 1;

  // Score distribution (10 down to 0)
  const scoreBuckets = [];
  for (let s = 10; s >= 0; s--) {
    scoreBuckets.push({ score: s, count: byScore[String(s)] || 0 });
  }
  const maxScoreCount = Math.max(...scoreBuckets.map(b => b.count), 1);

  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="inline-block px-3 py-1 rounded-full bg-[#00d1ff]/10 text-[#00d1ff] text-xs font-mono mb-3 border border-[#00d1ff]/20">
                SENTINEL TRANSPARENCY DASHBOARD
              </div>
              <h1 className="text-4xl font-bold text-white mb-2">Sentinel Transparency</h1>
              <p className="text-zinc-400 text-sm max-w-2xl">
                Real-time public dashboard for the Sentinel certification system. Every metric here is verifiable via the public API.
              </p>
            </div>
            <button
              onClick={loadData}
              className="text-xs text-zinc-400 hover:text-[#00d1ff] border border-white/10 hover:border-[#00d1ff]/40 rounded px-3 py-2 transition-colors"
            >
              ↻ Refresh
            </button>
          </div>
          {lastRefresh && (
            <div className="text-zinc-600 text-xs font-mono">
              Last updated: {lastRefresh.toLocaleTimeString()} · Auto-refresh every 60s
            </div>
          )}
        </motion.div>

        {/* Top stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="premium-card p-5">
            <div className="text-zinc-500 text-xs uppercase tracking-wider mb-2">Certified Skills</div>
            <div className="text-[#00F299] text-3xl font-bold font-mono">{certCount.toLocaleString()}</div>
            <div className="text-zinc-600 text-xs mt-1">100% of catalog</div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="premium-card p-5">
            <div className="text-zinc-500 text-xs uppercase tracking-wider mb-2">L2 Sandbox Runs</div>
            <div className="text-[#00d1ff] text-3xl font-bold font-mono">{l2.completed_runs || 0}</div>
            <div className="text-zinc-600 text-xs mt-1">Docker-isolated audits</div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="premium-card p-5">
            <div className="text-zinc-500 text-xs uppercase tracking-wider mb-2">Critical Risk</div>
            <div className="text-red-400 text-3xl font-bold font-mono">{byRisk.critical || 0}</div>
            <div className="text-zinc-600 text-xs mt-1">Score 0-1 skills</div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="premium-card p-5">
            <div className="text-zinc-500 text-xs uppercase tracking-wider mb-2">Last Batch Audit</div>
            <div className="text-zinc-300 text-sm font-mono mt-1">
              {batch.timestamp ? new Date(batch.timestamp).toLocaleDateString() : '—'}
            </div>
            <div className="text-zinc-600 text-xs mt-1">Weekly cron: Sun 01:00 UTC</div>
          </motion.div>
        </div>

        {/* Risk breakdown */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="premium-card p-6 mb-6">
          <h2 className="text-white font-semibold mb-4">Risk Level Breakdown</h2>
          <div className="space-y-3">
            {['low', 'medium', 'high', 'critical'].map(risk => {
              const count = byRisk[risk] || 0;
              const pct = (count / totalRisk * 100).toFixed(1);
              const info = RISK_COLORS[risk];
              return (
                <div key={risk} className="flex items-center gap-4">
                  <div className={`w-20 text-xs font-mono ${info.text}`}>{info.label}</div>
                  <div className="flex-1 bg-black/30 rounded-full h-6 overflow-hidden">
                    <div
                      className={`h-full ${info.bar} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-20 text-right">
                    <span className={`text-sm font-mono ${info.text}`}>{count.toLocaleString()}</span>
                    <span className="text-zinc-600 text-xs ml-1">({pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Score distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="premium-card p-6 mb-6">
          <h2 className="text-white font-semibold mb-4">Score Distribution</h2>
          <div className="flex items-end gap-2 h-40">
            {scoreBuckets.map(b => {
              const heightPct = (b.count / maxScoreCount * 100).toFixed(1);
              const color = b.score >= 8 ? 'bg-[#00F299]' : b.score >= 6 ? 'bg-yellow-500' : b.score >= 4 ? 'bg-orange-500' : 'bg-red-500';
              return (
                <div key={b.score} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-zinc-400 text-[10px] font-mono">{b.count > 0 ? b.count : ''}</div>
                  <div className="w-full bg-black/30 rounded-t flex items-end" style={{ height: '120px' }}>
                    <div
                      className={`w-full ${color} rounded-t transition-all duration-500`}
                      style={{ height: `${heightPct}%`, minHeight: b.count > 0 ? '4px' : '0' }}
                    />
                  </div>
                  <div className="text-zinc-500 text-[10px] font-mono">{b.score}</div>
                </div>
              );
            })}
          </div>
          <div className="text-zinc-600 text-xs text-center mt-2">Score (0-10, higher is safer)</div>
        </motion.div>

        {/* Two columns: L2 sandbox + batch audit */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* L2 Sandbox */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="premium-card p-6">
            <h2 className="text-white font-semibold mb-4">L2 Docker Sandbox Coverage</h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {['ran', 'ran_idle', 'failed_to_start'].map(status => {
                const count = (l2.breakdown_by_status || {})[status] || 0;
                const info = status === 'ran' ? RISK_COLORS.low : status === 'ran_idle' ? { text: 'text-[#00d1ff]', bg: 'bg-[#00d1ff]/10', border: 'border-[#00d1ff]/20' } : RISK_COLORS.high;
                return (
                  <div key={status} className={`text-center p-3 rounded-lg ${info.bg} border ${info.border}`}>
                    <div className={`text-xl font-mono ${info.text}`}>{count}</div>
                    <div className="text-zinc-500 text-[10px] mt-1">{status.replace(/_/g, ' ')}</div>
                  </div>
                );
              })}
            </div>

            {/* Honest L2 rollout disclosure — don't oversell */}
            <div className="p-3 rounded bg-orange-500/5 border border-orange-500/10 text-orange-400/80 text-xs leading-relaxed mb-4">
              <strong className="text-orange-400">⚠️ L2 rollout in progress:</strong>{' '}
              {l2.completed_runs || 0} of {certCount.toLocaleString()} skills ({certCount > 0 ? ((l2.completed_runs || 0) / certCount * 100).toFixed(2) : 0}%) have L2 results.
              The remaining {certCount - (l2.completed_runs || 0)} are certified with v3.0+L1.6 (static analysis only).
              L2 coverage grows as more skills get source.url populated.
            </div>
            {l2Summaries.length > 0 && (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                <div className="text-zinc-500 text-xs uppercase tracking-wider mb-2">Recently Audited Skills</div>
                {l2Summaries.slice(0, 8).map(s => {
                  const info = RISK_COLORS[s.l2_risk_level] || RISK_COLORS.unknown;
                  return (
                    <div key={s.skill_id} className="flex items-center justify-between text-xs py-1 border-b border-white/5">
                      <span className="font-mono text-zinc-300 truncate">{s.skill_id}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={info.text}>{s.l2_score ?? '?'}/10</span>
                        <span className={`px-1.5 py-0.5 rounded font-mono text-[9px] ${info.bg} ${info.text} ${info.border} border`}>
                          {s.execution_status?.replace(/_/g, ' ').slice(0, 8)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Batch audit */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="premium-card p-6">
            <h2 className="text-white font-semibold mb-4">Latest L1.6 Batch Audit</h2>
            {batch.status === 'available' ? (
              <>
                <div className="text-zinc-500 text-xs mb-3">
                  {new Date(batch.timestamp).toLocaleString()}
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">Semgrep (18 rules)</span>
                      <span className={batch.tools?.semgrep?.findings > 0 ? 'text-orange-400' : 'text-[#00F299]'}>
                        {batch.tools?.semgrep?.findings || 0} findings
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">Gitleaks (secrets)</span>
                      <span className={batch.tools?.gitleaks?.findings > 0 ? 'text-red-400' : 'text-[#00F299]'}>
                        {batch.tools?.gitleaks?.findings || 0} findings
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">OSV-Scanner (deps)</span>
                      <span className={batch.tools?.osv?.vulnerabilities > 0 ? 'text-orange-400' : 'text-[#00F299]'}>
                        {batch.tools?.osv?.vulnerabilities || 0} vulns
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/5 flex gap-4 text-xs">
                  <span className="text-red-400">Critical: {batch.totals?.critical || 0}</span>
                  <span className="text-orange-400">High: {batch.totals?.high || 0}</span>
                  <span className="text-yellow-400">Medium: {batch.totals?.medium || 0}</span>
                </div>
              </>
            ) : (
              <div className="text-zinc-500 text-xs">{batch.message || 'No batch audit has run yet.'}</div>
            )}
          </motion.div>
        </div>

        {/* Verification links */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="premium-card p-6 mb-6">
          <h2 className="text-white font-semibold mb-4">Verify Everything</h2>
          <p className="text-zinc-400 text-xs mb-4">
            All data on this page comes from the public API. You can verify any certificate or metric yourself:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Link to="/verify" className="block p-3 rounded-lg bg-black/30 hover:bg-black/50 border border-white/5 hover:border-[#00d1ff]/20 transition-all">
              <div className="text-[#00d1ff] text-sm font-semibold">→ Verify a Certificate</div>
              <div className="text-zinc-500 text-xs mt-1">Check any skill's signed certificate by ID</div>
            </Link>
            <a href="https://github.com/edgarfloresguerra2011-a11y/marketnow/tree/master/_data/sentinel_certificates" target="_blank" rel="noopener" className="block p-3 rounded-lg bg-black/30 hover:bg-black/50 border border-white/5 hover:border-[#00d1ff]/20 transition-all">
              <div className="text-[#00d1ff] text-sm font-semibold">→ All Certificates (GitHub)</div>
              <div className="text-zinc-500 text-xs mt-1">Browse 9,248 signed certificate JSON files</div>
            </a>
            <a href="https://github.com/edgarfloresguerra2011-a11y/marketnow/actions/workflows/sentinel-certify-all.yml" target="_blank" rel="noopener" className="block p-3 rounded-lg bg-black/30 hover:bg-black/50 border border-white/5 hover:border-[#00d1ff]/20 transition-all">
              <div className="text-[#00d1ff] text-sm font-semibold">→ Weekly Audit Workflow</div>
              <div className="text-zinc-500 text-xs mt-1">GitHub Actions cron history (every Sunday 01:00 UTC)</div>
            </a>
            <a href="/api/audit-skill?sentinel-status=1" target="_blank" rel="noopener" className="block p-3 rounded-lg bg-black/30 hover:bg-black/50 border border-white/5 hover:border-[#00d1ff]/20 transition-all">
              <div className="text-[#00d1ff] text-sm font-semibold">→ Raw API Response</div>
              <div className="text-zinc-500 text-xs mt-1">JSON endpoint powering this dashboard</div>
            </a>
          </div>
        </motion.div>

        {/* Architecture summary */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="premium-card p-6">
          <h2 className="text-white font-semibold mb-4">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-lg bg-black/30">
              <div className="text-[#00F299] font-bold text-lg mb-2">v3.0</div>
              <div className="text-white text-xs font-semibold mb-1">6 Metadata Checks</div>
              <div className="text-zinc-500 text-xs">AUTH, prompt injection, input validation, CORS, OAuth scopes, rate limiting — runs in Vercel real-time (~200ms)</div>
            </div>
            <div className="p-4 rounded-lg bg-black/30">
              <div className="text-[#00F299] font-bold text-lg mb-2">L1.6</div>
              <div className="text-white text-xs font-semibold mb-1">Static Analysis</div>
              <div className="text-zinc-500 text-xs">18 Semgrep rules + 18 secret patterns + OSV API dependency check — runs in Vercel real-time + weekly batch</div>
            </div>
            <div className="p-4 rounded-lg bg-black/30">
              <div className="text-[#00d1ff] font-bold text-lg mb-2">L2</div>
              <div className="text-white text-xs font-semibold mb-1">Docker Sandbox</div>
              <div className="text-zinc-500 text-xs">Runs the MCP server in isolated container (--network none, --read-only, --cap-drop ALL) — via GitHub Actions, async</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/5 text-zinc-500 text-xs">
            Certificates are signed with SHA-256 + <code className="text-zinc-400">SENTINEL_CERT_SECRET</code>, regenerated weekly, and verifiable via the public API.
          </div>
        </motion.div>
      </div>
    </div>
  );
}
