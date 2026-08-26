import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useState } from 'react';

const FORMATS = [
  { name: 'ATC', org: 'AliceLabs', desc: 'Agent Trust Card — Ed25519 + JCS', color: '#00F299' },
  { name: 'EAT-AI', org: 'IETF', desc: 'RFC 9421 — Entity Attestation Token', color: '#00d1ff' },
  { name: 'ZTA', org: 'Anthropic', desc: 'Zero-Trust Agent credentials', color: '#a78bfa' },
  { name: 'A2A', org: 'Google/AAIF', desc: 'Agent-to-Agent Card', color: '#fbbf24' },
  { name: 'MCP Card', org: 'Anthropic', desc: 'MCP Server identity', color: '#f472b6' },
  { name: 'W3C VC', org: 'W3C', desc: 'Verifiable Credentials', color: '#34d399' },
  { name: 'OAuth', org: 'IETF', desc: 'OIDC tokens', color: '#60a5fa' },
  { name: 'SPIFFE', org: 'CNCF', desc: 'SVID identity', color: '#fb923c' },
];

const PIPELINE_STAGES = [
  { n: 1, name: 'Identity', desc: 'agent_id, agent_name, agent_owner validation' },
  { n: 2, name: 'Attestation', desc: 'subject_public_key, signature structure' },
  { n: 3, name: 'Capabilities', desc: 'filesystem, network, shell, credentials, process' },
  { n: 4, name: 'Evidence', desc: 'audit_pipeline, static/dynamic/runtime checks' },
  { n: 5, name: 'Risk', desc: 'trust_score (0-10), risk_level, decision_authority' },
  { n: 6, name: 'Signature', desc: 'Ed25519 over RFC 8785 JCS canonical bytes' },
  { n: 7, name: 'Revocation', desc: 'CRL + OCSP + Bitstring Status List' },
  { n: 8, name: 'Expiration', desc: 'issued_at, expires_at, max_ttl_days (90 default)' },
  { n: 9, name: 'Proof-of-Possession', desc: 'nonce challenge anti-replay' },
  { n: 10, name: 'TrustRegistry', desc: 'key binding verification' },
  { n: 11, name: 'Action Receipt', desc: 'signed Ed25519 receipt per invocation' },
  { n: 12, name: 'Supply-chain SBOM', desc: 'SPDX 2.3 verification' },
];

const STATS = [
  { value: '8', label: 'format adapters' },
  { value: '12', label: 'verification stages' },
  { value: '41', label: 'test vectors' },
  { value: '23/23', label: 'conformance tests' },
  { value: '7', label: 'NPM packages' },
  { value: '2,339', label: 'monthly downloads' },
];

const COMPARISON = [
  { aspect: 'Agent identity', before: 'Each platform has its own format. Agents can\'t verify across ecosystems.', after: 'UTA translates any format to any other. One verifier works everywhere.' },
  { aspect: 'Trust score', before: 'Proprietary scores. No way to verify how they were computed.', after: 'ATC carries evidence (audit_pipeline, findings). Anyone can re-derive the score.' },
  { aspect: 'Capabilities', before: 'Undeclared. Agents discover what a tool can do by calling it.', after: 'Declared upfront: filesystem, network, shell, credentials, process. Verified at install.' },
  { aspect: 'Revocation', before: 'No standard. Some platforms email you. Some don\'t.', after: 'CRL + OCSP + Bitstring Status List. Agent checks before every call.' },
  { aspect: 'Expiration', before: 'Credentials never expire. Compromised keys work forever.', after: 'max_ttl_days (90 default). Old credentials automatically fail.' },
  { aspect: 'Cross-language', before: 'Each SDK has its own canonicalization. Signatures don\'t verify across languages.', after: 'RFC 8785 JCS. Same bytes in Node.js, Python, Go, Rust. Verified.' },
];

const ROADMAP = [
  { phase: 'Done', items: ['ATC/1.0 spec (public, stable)', 'ATC v3.0 RFC Draft (multi-sig)', '8 format adapters', '12-stage pipeline', '41 test vectors', '23/23 conformance tests', '7 NPM packages', '14/14 audit findings fixed'] },
  { phase: 'In Progress', items: ['Multi-sig N-of-M (ATC v3.0)', 'Runtime tool-catalog pinning', 'Post-exec filter (behavior detection)', 'Python SDK', 'Go SDK', 'Rust SDK'] },
  { phase: 'Planned', items: ['TEE attestation (SGX, SEV-SNP, Nitro)', 'Post-quantum (ML-DSA)', 'Formal verification (Coq/TLA+)', 'IETF RFC submission', 'W3C community group'] },
];

export default function UTA() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative z-10">
        {/* HERO */}
        <section className="text-center max-w-5xl mx-auto px-6 pt-24 pb-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00d1ff]/10 border border-[#00d1ff]/20 mb-6">
              <span className="w-2 h-2 rounded-full bg-[#00d1ff] animate-pulse" />
              <span className="text-[#00d1ff] text-xs font-mono tracking-wider">UTA v1.1.0 · OPEN SOURCE · AL-1.0</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 leading-tight">
              Universal Trust Adapter
            </h1>
            <p className="text-2xl text-[#00d1ff] font-bold mb-6">The USB-C of Agent Trust</p>
            <p className="text-zinc-300 text-lg max-w-2xl mx-auto leading-relaxed mb-8">
              UTA translates between 8 trust credential formats used by AI agents via a canonical Universal Trust Schema (UTS v2.0.0). Like Zapier connects applications, UTA connects trust standards.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 max-w-3xl mx-auto mb-8">
              {STATS.map(s => (
                <div key={s.label} className="p-3 rounded-xl bg-black/40 border border-white/5">
                  <div className="text-[#00F299] text-xl font-bold font-mono">{s.value}</div>
                  <div className="text-zinc-500 text-[10px] mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a href="https://github.com/alicelabs-llc/universal-trust-adapter" target="_blank" rel="noopener" className="px-6 py-3 bg-[#00F299] text-black font-bold rounded-xl hover:bg-[#00F299]/90 transition-all text-sm">
                View on GitHub →
              </a>
              <a href="/uta/docs/atc-spec/SPEC.md" target="_blank" rel="noopener" className="px-6 py-3 border border-[#00d1ff]/30 bg-[#00d1ff]/10 text-[#00d1ff] font-bold rounded-xl hover:bg-[#00d1ff]/20 transition-all text-sm">
                Read the Spec →
              </a>
              <a href="/uta/docs/atc-spec/test-vectors/_index.json" target="_blank" rel="noopener" className="px-6 py-3 border border-white/10 text-white font-medium rounded-xl hover:bg-white/5 transition-all text-sm">
                Test Vectors →
              </a>
            </div>

            <div className="inline-block px-4 py-2 rounded-lg bg-black/40 border border-white/5 mt-6">
              <code className="text-[#00F299] text-xs font-mono">npm install agent-trust-card@1.1.2</code>
              <span className="text-zinc-600 text-xs mx-2">·</span>
              <code className="text-[#00d1ff] text-xs font-mono">npx -y marketnow-mcp@1.10.1</code>
            </div>
          </motion.div>
        </section>

        {/* THE PROBLEM */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-4">The Problem</h2>
            <p className="text-zinc-400 text-sm mb-4">
              AI agents are autonomous actors — they call APIs, write to filesystems, spawn processes, and pay for resources. Unlike human users, agents cannot type passwords or approve 2FA. They need machine-verifiable credentials that prove who they are and what they can do.
            </p>
            <p className="text-zinc-400 text-sm mb-4">
              The problem: <strong className="text-white">8 competing trust credential formats</strong> exist. None speak to each other. Each ecosystem is an island:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              {FORMATS.map(f => (
                <div key={f.name} className="p-3 rounded-lg bg-black/40 border border-white/5 text-center">
                  <div className="font-bold text-sm" style={{ color: f.color }}>{f.name}</div>
                  <div className="text-zinc-600 text-[10px] mt-1">{f.org}</div>
                </div>
              ))}
            </div>
            <p className="text-zinc-400 text-sm">
              <strong className="text-red-400">88%</strong> of orgs had AI agent security incidents in 2026. <strong className="text-red-400">92%</strong> of CISOs lack visibility. <strong className="text-red-400">30+ CVEs</strong> filed against MCP servers in 60 days. The market is fragmented and hurting.
            </p>
          </motion.div>
        </section>

        {/* THE SOLUTION */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-4">The Solution: UTA</h2>
            <p className="text-zinc-400 text-sm mb-6">
              UTA translates any format to any other via a canonical Universal Trust Schema. One verifier. Every ecosystem. No vendor lock-in.
            </p>

            {/* Visual diagram */}
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="grid grid-cols-4 gap-2 w-full max-w-2xl">
                {FORMATS.slice(0, 4).map(f => (
                  <div key={f.name} className="p-2 rounded-lg border text-center" style={{ borderColor: f.color + '40' }}>
                    <div className="font-bold text-xs" style={{ color: f.color }}>{f.name}</div>
                  </div>
                ))}
              </div>
              <div className="text-[#00d1ff] text-2xl">↕</div>
              <div className="px-6 py-4 rounded-xl bg-[#00d1ff]/10 border border-[#00d1ff]/30 text-center">
                <div className="text-[#00d1ff] font-bold text-lg">UTA</div>
                <div className="text-zinc-400 text-xs">Universal Trust Schema (UTS v2.0.0)</div>
                <div className="text-zinc-600 text-[10px] mt-1">Ed25519 · RFC 8785 JCS · 12-stage pipeline</div>
              </div>
              <div className="text-[#00d1ff] text-2xl">↕</div>
              <div className="grid grid-cols-4 gap-2 w-full max-w-2xl">
                {FORMATS.slice(4).map(f => (
                  <div key={f.name} className="p-2 rounded-lg border text-center" style={{ borderColor: f.color + '40' }}>
                    <div className="font-bold text-xs" style={{ color: f.color }}>{f.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        {/* 12-STAGE PIPELINE */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-4">12-Stage Verification Pipeline</h2>
            <p className="text-zinc-400 text-sm mb-6">Every credential goes through 12 fail-closed stages. If any stage fails, the pipeline stops immediately.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {PIPELINE_STAGES.map(s => (
                <div key={s.n} className="flex items-start gap-3 p-3 rounded-lg bg-black/40 border border-white/5">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#00F299]/10 border border-[#00F299]/30 flex items-center justify-center text-[#00F299] text-xs font-bold">
                    {s.n}
                  </div>
                  <div>
                    <div className="text-white text-sm font-bold">{s.name}</div>
                    <div className="text-zinc-500 text-xs">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* BEFORE vs AFTER */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-4">Before vs After UTA</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-2 text-zinc-400 text-xs">Aspect</th>
                    <th className="text-left py-3 px-2 text-red-400 text-xs">Before UTA</th>
                    <th className="text-left py-3 px-2 text-[#00F299] text-xs">After UTA</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map(c => (
                    <tr key={c.aspect} className="border-b border-white/5">
                      <td className="py-3 px-2 text-white font-bold text-xs">{c.aspect}</td>
                      <td className="py-3 px-2 text-zinc-500 text-xs">{c.before}</td>
                      <td className="py-3 px-2 text-[#00F299] text-xs">{c.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </section>

        {/* CRYPTO */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-4">Cryptography</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                <div className="text-[#00F299] text-sm font-bold font-mono">Ed25519</div>
                <div className="text-zinc-500 text-xs mt-1">RFC 8032 signatures</div>
              </div>
              <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                <div className="text-[#00d1ff] text-sm font-bold font-mono">RFC 8785 JCS</div>
                <div className="text-zinc-500 text-xs mt-1">Canonical JSON — same bytes every language</div>
              </div>
              <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                <div className="text-[#00F299] text-sm font-bold font-mono">SHA-256</div>
                <div className="text-zinc-500 text-xs mt-1">Over canonical bytes</div>
              </div>
              <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                <div className="text-[#00d1ff] text-sm font-bold font-mono">7 domains</div>
                <div className="text-zinc-500 text-xs mt-1">Signature domain separation</div>
              </div>
              <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                <div className="text-[#00F299] text-sm font-bold font-mono">PoP</div>
                <div className="text-zinc-500 text-xs mt-1">Proof-of-Possession anti-replay</div>
              </div>
              <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                <div className="text-[#00d1ff] text-sm font-bold font-mono">SPDX 2.3</div>
                <div className="text-zinc-500 text-xs mt-1">Supply-chain SBOM</div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* INDEPENDENT VERIFICATION */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-4">Independent Verification</h2>
            <p className="text-zinc-400 text-sm mb-4">
              The test CA private key is <strong className="text-[#00F299]">intentionally published</strong>. Anyone can re-derive every signature in any language.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <a href="/uta/docs/atc-spec/test-vectors/_index.json" target="_blank" rel="noopener" className="block p-4 rounded-lg bg-black/40 border border-[#00F299]/20 hover:border-[#00F299]/40 transition-all">
                <div className="text-[#00F299] text-sm font-bold">📋 Test Vectors Index →</div>
                <div className="text-zinc-500 text-xs mt-1">5 frozen vectors + canonical JCS bytes + SHA-256</div>
              </a>
              <a href="/uta/docs/atc-spec/test-vectors/_test-ca-keys.json" target="_blank" rel="noopener" className="block p-4 rounded-lg bg-black/40 border border-[#00d1ff]/20 hover:border-[#00d1ff]/40 transition-all">
                <div className="text-[#00d1ff] text-sm font-bold">🔑 Test CA Keys →</div>
                <div className="text-zinc-500 text-xs mt-1">Ed25519 keypair (private key published for reproducibility)</div>
              </a>
            </div>
            <div className="p-3 rounded-lg bg-black/40 border border-white/5">
              <div className="text-zinc-500 text-[10px] mb-2">VERIFY YOURSELF:</div>
              <code className="text-[#00F299] text-xs font-mono block mb-1">git clone https://github.com/alicelabs-llc/universal-trust-adapter</code>
              <code className="text-[#00d1ff] text-xs font-mono block mb-1">cd marketnow/atc-sdk && npm install</code>
              <code className="text-[#00F299] text-xs font-mono">node test/conformance.mjs  # 23/23 pass</code>
            </div>
          </motion.div>
        </section>

        {/* WHY UTA CAN BECOME A STANDARD */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-4">Why UTA Can Become an Industry Standard</h2>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="text-[#00F299] text-xl">①</div>
                <div>
                  <h3 className="text-white text-sm font-bold">Solves a real problem</h3>
                  <p className="text-zinc-400 text-xs">8 fragmented trust formats. 88% of orgs had AI agent incidents. No one can verify cross-ecosystem. UTA fixes this.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="text-[#00d1ff] text-xl">②</div>
                <div>
                  <h3 className="text-white text-sm font-bold">Open and verifiable</h3>
                  <p className="text-zinc-400 text-xs">Spec is public. Test CA private key published. Conformance suite open. Anyone can implement in any language.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="text-[#00F299] text-xl">③</div>
                <div>
                  <h3 className="text-white text-sm font-bold">Uses proven standards</h3>
                  <p className="text-zinc-400 text-xs">Ed25519 (RFC 8032), RFC 8785 JCS, SHA-256. Not inventing new crypto — composing existing ones.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="text-[#00d1ff] text-xl">④</div>
                <div>
                  <h3 className="text-white text-sm font-bold">Backward compatible</h3>
                  <p className="text-zinc-400 text-xs">ATC v3.0 accepts v2.0 credentials. UTA doesn't break existing ecosystems — it connects them.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="text-[#00F299] text-xl">⑤</div>
                <div>
                  <h3 className="text-white text-sm font-bold">Adopted by the community</h3>
                  <p className="text-zinc-400 text-xs">7 NPM packages, 2,339 monthly downloads, 96 Dev.to articles, independent security audit (14/14 findings fixed).</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="text-[#00d1ff] text-xl">⑥</div>
                <div>
                  <h3 className="text-white text-sm font-bold">Aligned with industry direction</h3>
                  <p className="text-zinc-400 text-xs">IETF EAT-AI, Anthropic ZTA, Google A2A, AAIF — all moving toward multi-format trust. UTA is the adapter that connects them.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ROADMAP */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-4">Roadmap</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {ROADMAP.map(phase => (
                <div key={phase.phase} className="p-4 rounded-lg bg-black/40 border border-white/5">
                  <div className={`text-sm font-bold mb-3 ${phase.phase === 'Done' ? 'text-[#00F299]' : phase.phase === 'In Progress' ? 'text-[#00d1ff]' : 'text-zinc-500'}`}>
                    {phase.phase === 'Done' ? '✅ ' : phase.phase === 'In Progress' ? '🔧 ' : '📋 '}{phase.phase}
                  </div>
                  <ul className="space-y-1">
                    {phase.items.map(item => (
                      <li key={item} className="text-zinc-400 text-xs flex items-start gap-2">
                        <span className="text-zinc-600">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ADOPT */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }} className="premium-card p-6 md:p-8 text-center">
            <h2 className="text-white text-2xl font-bold mb-4">Adopt UTA</h2>
            <p className="text-zinc-400 text-sm mb-6">Start in 30 seconds. No signup, no backend, no dependency.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
              <a href="https://github.com/alicelabs-llc/universal-trust-adapter" target="_blank" rel="noopener" className="px-6 py-3 bg-[#00F299] text-black font-bold rounded-xl hover:bg-[#00F299]/90 transition-all text-sm">
                GitHub Repo →
              </a>
              <a href="/uta/docs/atc-spec/SPEC.md" target="_blank" rel="noopener" className="px-6 py-3 border border-[#00d1ff]/30 bg-[#00d1ff]/10 text-[#00d1ff] font-bold rounded-xl hover:bg-[#00d1ff]/20 transition-all text-sm">
                Read Spec →
              </a>
              <a href="/uta/CONTRIBUTING.md" target="_blank" rel="noopener" className="px-6 py-3 border border-white/10 text-white font-medium rounded-xl hover:bg-white/5 transition-all text-sm">
                Contribute →
              </a>
            </div>
            <div className="inline-block px-4 py-2 rounded-lg bg-black/40 border border-white/5">
              <code className="text-[#00F299] text-xs font-mono">npm install agent-trust-card@1.1.2</code>
              <span className="text-zinc-600 text-xs mx-2">·</span>
              <code className="text-[#00d1ff] text-xs font-mono">npx -y marketnow-mcp@1.10.1</code>
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
