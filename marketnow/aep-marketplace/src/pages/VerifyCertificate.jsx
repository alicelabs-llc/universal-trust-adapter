import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';

/**
 * MarketNow — Sentinel Certificate Verification Page
 * ====================================================
 *
 * Public page where anyone can verify a Sentinel certificate by:
 *   1. Entering a certificate ID (MN-SC-2026-XXXXXXX)
 *   2. Entering a skill ID
 *   3. Pasting a full verification URL
 *
 * The page calls GET /api/audit-skill?certificate=1&skillId=X and displays:
 *   - Certificate validity (signed + not expired)
 *   - Skill name, score, risk level
 *   - Issue/expiry dates
 *   - Layers run (v3.0, L1.6, L2)
 *   - Layer details (findings per layer)
 *   - Direct link to the skill's page
 */

const RISK_COLORS = {
  low: { bg: 'bg-[#00F299]/10', text: 'text-[#00F299]', border: 'border-[#00F299]/20', label: 'LOW RISK' },
  medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20', label: 'MEDIUM RISK' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', label: 'HIGH RISK' },
  critical: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', label: 'CRITICAL' },
  unknown: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/20', label: 'UNKNOWN' },
};

export default function VerifyCertificate() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-fill from URL params: ?cert=MN-SC-... or ?skillId=mn-gen-...
  useEffect(() => {
    const cert = searchParams.get('cert');
    const skillId = searchParams.get('skillId');
    if (cert) {
      setInput(cert);
      handleVerify(cert);
    } else if (skillId) {
      setInput(skillId);
      handleVerify(skillId);
    }
  }, []);

  const handleVerify = async (value) => {
    const query = value || input;
    if (!query.trim()) {
      setError('Enter a certificate ID or skill ID');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      // Parse input: could be a cert ID (MN-SC-...), a skill ID (mn-...), or a full URL
      let skillId = query.trim();

      // If it's a full URL, extract skillId from query params
      if (skillId.includes('://')) {
        try {
          const url = new URL(skillId);
          skillId = url.searchParams.get('skillId') || skillId;
        } catch {}
      }

      // If it starts with MN-SC-, we need to search — but our API only supports
      // lookup by skillId. For now, show a hint that they should use the skillId.
      if (skillId.startsWith('MN-SC-')) {
        setError('Certificate IDs (MN-SC-...) are verified by skill ID. Please enter the skill ID (e.g., mn-gen-00003) or paste the verification URL from the certificate.');
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/audit-skill?certificate=1&skillId=${encodeURIComponent(skillId)}`);
      const data = await res.json();

      if (data.status === 'certified') {
        setResult(data);
      } else if (data.status === 'not_audited') {
        setError(data.message || 'No certificate found for this skill.');
      } else {
        setError(data.error || data.message || 'Verification failed');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const riskInfo = result?.certificate ? RISK_COLORS[result.certificate.risk_level] || RISK_COLORS.unknown : null;
  const isExpired = result?.certificate ? new Date(result.certificate.expires_at) < new Date() : false;

  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="inline-block px-3 py-1 rounded-full bg-[#00d1ff]/10 text-[#00d1ff] text-xs font-mono mb-4 border border-[#00d1ff]/20">
            SENTINEL CERTIFICATE VERIFICATION
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Verify a Sentinel Certificate</h1>
          <p className="text-zinc-400 text-sm max-w-xl mx-auto">
            Every skill in MarketNow has a signed Sentinel certificate with a verified security score.
            Enter a skill ID below to verify its certificate in real-time.
          </p>
        </motion.div>

        {/* Input form */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="premium-card p-6 mb-6">
          <label className="block text-zinc-300 text-sm font-mono mb-2">Skill ID or Verification URL</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              placeholder="e.g., mn-gen-00003 or mn-mcp-filesystem"
              className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm font-mono placeholder-zinc-600 focus:border-[#00d1ff]/40 focus:outline-none"
            />
            <button
              onClick={() => handleVerify()}
              disabled={loading}
              className="px-6 py-2.5 bg-[#00d1ff] text-black font-bold text-sm rounded-lg hover:bg-[#00d1ff]/80 transition-colors disabled:opacity-50"
            >
              {loading ? 'VERIFYING...' : 'VERIFY'}
            </button>
          </div>
          {error && (
            <div className="mt-3 p-3 rounded-lg bg-red-500/5 border border-red-500/10 text-red-400 text-xs">
              {error}
            </div>
          )}
          <div className="mt-3 text-zinc-500 text-xs">
            Try: <button onClick={() => { setInput('mn-mcp-filesystem'); handleVerify('mn-mcp-filesystem'); }} className="text-[#00d1ff] hover:underline font-mono">mn-mcp-filesystem</button>
            {' · '}
            <button onClick={() => { setInput('mn-gen-00003'); handleVerify('mn-gen-00003'); }} className="text-[#00d1ff] hover:underline font-mono">mn-gen-00003</button>
            {' · '}
            <button onClick={() => { setInput('mn-amcp-anythingmcp'); handleVerify('mn-amcp-anythingmcp'); }} className="text-[#00d1ff] hover:underline font-mono">mn-amcp-anythingmcp</button>
          </div>
        </motion.div>

        {/* Result */}
        {result && result.certificate && riskInfo && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className={`premium-card p-6 border-2 ${riskInfo.border}`}>
              {/* Status bar */}
              <div className={`flex items-center justify-between mb-6 pb-4 border-b border-white/10`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{isExpired ? '⚠️' : '🛡️'}</span>
                  <div>
                    <div className={`text-lg font-bold ${isExpired ? 'text-red-400' : 'text-[#00F299]'}`}>
                      {isExpired ? 'CERTIFICATE EXPIRED' : 'CERTIFICATE VALID'}
                    </div>
                    <div className="text-zinc-500 text-xs font-mono">{result.certificate.certificate_id}</div>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded ${riskInfo.bg} ${riskInfo.text} ${riskInfo.border} border text-xs font-mono`}>
                  {riskInfo.label}
                </span>
              </div>

              {/* Score */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Sentinel Score</div>
                  <div className={`text-4xl font-bold ${riskInfo.text}`}>{result.certificate.overall_score}<span className="text-zinc-600 text-2xl">/10</span></div>
                </div>
                <div>
                  <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Skill</div>
                  <div className="text-white text-lg font-semibold">{result.certificate.skill_name}</div>
                  <Link to={`/skill/${result.certificate.skill_id}`} className="text-[#00d1ff] text-xs hover:underline">→ View skill page</Link>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-black/30 rounded-lg p-3">
                  <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Issued</div>
                  <div className="text-zinc-300 text-sm font-mono">{new Date(result.certificate.issued_at).toLocaleString()}</div>
                </div>
                <div className="bg-black/30 rounded-lg p-3">
                  <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Expires</div>
                  <div className={`text-sm font-mono ${isExpired ? 'text-red-400' : 'text-zinc-300'}`}>{new Date(result.certificate.expires_at).toLocaleString()}</div>
                </div>
              </div>

              {/* Layers */}
              <div className="mb-6">
                <div className="text-zinc-500 text-xs uppercase tracking-wider mb-3">Audit Layers Run</div>
                <div className="grid grid-cols-3 gap-3">
                  <div className={`bg-black/30 rounded-lg p-3 border ${result.certificate.layers_run.l15 ? 'border-[#00F299]/20' : 'border-zinc-700'}`}>
                    <div className={`text-sm font-bold ${result.certificate.layers_run.l15 ? 'text-[#00F299]' : 'text-zinc-600'}`}>
                      {result.certificate.layers_run.l15 ? '✓' : '—'} v3.0
                    </div>
                    <div className="text-zinc-500 text-[10px]">6 metadata checks</div>
                  </div>
                  <div className={`bg-black/30 rounded-lg p-3 border ${result.certificate.layers_run.l16 ? 'border-[#00F299]/20' : 'border-zinc-700'}`}>
                    <div className={`text-sm font-bold ${result.certificate.layers_run.l16 ? 'text-[#00F299]' : 'text-zinc-600'}`}>
                      {result.certificate.layers_run.l16 ? '✓' : '—'} L1.6
                    </div>
                    <div className="text-zinc-500 text-[10px]">Semgrep + secrets + OSV</div>
                  </div>
                  <div className={`bg-black/30 rounded-lg p-3 border ${result.certificate.layers_run.l2 ? 'border-[#00d1ff]/20' : 'border-zinc-700'}`}>
                    <div className={`text-sm font-bold ${result.certificate.layers_run.l2 ? 'text-[#00d1ff]' : 'text-zinc-600'}`}>
                      {result.certificate.layers_run.l2 ? '✓' : '—'} L2
                    </div>
                    <div className="text-zinc-500 text-[10px]">Docker sandbox</div>
                  </div>
                </div>
              </div>

              {/* Layer details */}
              {result.certificate.layer_details && (
                <div className="mb-6">
                  <div className="text-zinc-500 text-xs uppercase tracking-wider mb-3">Layer Details</div>
                  <div className="bg-black/30 rounded-lg p-4 space-y-2 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">v3.0 findings:</span>
                      <span className="text-zinc-300">{result.certificate.layer_details.l15_findings}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">L1.6 Semgrep findings:</span>
                      <span className="text-zinc-300">{result.certificate.layer_details.l16_semgrep_findings}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">L1.6 secret findings:</span>
                      <span className={result.certificate.layer_details.l16_secret_findings > 0 ? 'text-red-400' : 'text-zinc-300'}>
                        {result.certificate.layer_details.l16_secret_findings}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">L1.6 OSV vulnerabilities:</span>
                      <span className={result.certificate.layer_details.l16_osv_findings > 0 ? 'text-orange-400' : 'text-zinc-300'}>
                        {result.certificate.layer_details.l16_osv_findings}
                      </span>
                    </div>
                    {result.certificate.layer_details.l2_execution_status && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">L2 execution:</span>
                        <span className="text-[#00d1ff]">{result.certificate.layer_details.l2_execution_status}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Risk breakdown */}
              {result.certificate.risk_breakdown && (
                <div className="mb-6">
                  <div className="text-zinc-500 text-xs uppercase tracking-wider mb-3">Risk Breakdown</div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-black/30 rounded-lg p-3">
                      <div className="text-zinc-500 text-[10px] uppercase">v3.0+L1.6</div>
                      <div className="text-zinc-300 text-sm font-mono">{result.certificate.risk_breakdown.l15_l16}</div>
                    </div>
                    <div className="bg-black/30 rounded-lg p-3">
                      <div className="text-zinc-500 text-[10px] uppercase">L2 Sandbox</div>
                      <div className="text-zinc-300 text-sm font-mono">{result.certificate.risk_breakdown.l2}</div>
                    </div>
                    <div className="bg-black/30 rounded-lg p-3 border border-white/10">
                      <div className="text-zinc-500 text-[10px] uppercase">Final</div>
                      <div className={`text-sm font-mono ${riskInfo.text}`}>{result.certificate.risk_breakdown.final}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Signature */}
              <div className="bg-black/30 rounded-lg p-3">
                <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Signature ({result.certificate.signature_algorithm})</div>
                <div className="text-zinc-400 text-[10px] font-mono break-all">{result.certificate.signature}</div>
                <div className="text-[#00F299] text-xs mt-2">{result.verification.message}</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Info section */}
        {!result && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="premium-card p-6">
            <h2 className="text-white font-semibold mb-3">How Sentinel Certification Works</h2>
            <div className="space-y-3 text-sm text-zinc-400">
              <p>Every skill in the MarketNow catalog is audited by Sentinel, our 3-layer security pipeline:</p>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex gap-3 p-3 rounded-lg bg-black/30">
                  <span className="text-[#00F299] font-bold text-lg">v3.0</span>
                  <div>
                    <div className="text-white text-xs font-semibold">6 Metadata Checks</div>
                    <div className="text-zinc-500 text-xs">AUTH, prompt injection, input validation, CORS, OAuth scopes, rate limiting</div>
                  </div>
                </div>
                <div className="flex gap-3 p-3 rounded-lg bg-black/30">
                  <span className="text-[#00F299] font-bold text-lg">L1.6</span>
                  <div>
                    <div className="text-white text-xs font-semibold">Static Analysis</div>
                    <div className="text-zinc-500 text-xs">18 Semgrep rules + 18 secret patterns + OSV dependency vulnerability check</div>
                  </div>
                </div>
                <div className="flex gap-3 p-3 rounded-lg bg-black/30">
                  <span className="text-[#00d1ff] font-bold text-lg">L2</span>
                  <div>
                    <div className="text-white text-xs font-semibold">Docker Sandbox (async)</div>
                    <div className="text-zinc-500 text-xs">Runs the MCP server in an isolated container (--network none, --read-only, --cap-drop ALL) to detect runtime behavior</div>
                  </div>
                </div>
              </div>
              <p className="text-zinc-500 text-xs mt-4">
                Certificates are signed with SHA-256 and regenerated weekly. The weekly batch audit runs every Sunday at 01:00 UTC via GitHub Actions.
              </p>
              <div className="flex gap-3 mt-4">
                <Link to="/security" className="text-[#00d1ff] hover:underline text-xs">→ Sentinel dashboard</Link>
                <Link to="/sentinel-roadmap" className="text-zinc-400 hover:underline text-xs">→ Roadmap</Link>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
