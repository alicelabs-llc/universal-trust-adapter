import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════
const FORMATS = [
  { name: 'ATC', full: 'Agent Trust Card', org: 'AliceLabs LLC', color: '#00F299', language: 'JSON + Ed25519', rfc: 'ATC/1.0 + v3.0 (multi-sig)', fields: ['identity.agent_id', 'attestation.signature', 'capabilities.filesystem', 'risk.trust_score'] },
  { name: 'EAT-AI', full: 'Entity Attestation Token', org: 'IETF', color: '#00d1ff', language: 'CWT/CBOR + COSE', rfc: 'RFC 9421 (draft)', fields: ['eat_profile', 'ueid', 'hwmodel', 'secboot'] },
  { name: 'ZTA', full: 'Zero-Trust Agent Cred.', org: 'Anthropic', color: '#a78bfa', language: 'JSON-LD + Ed25519Sig2020', rfc: 'ZTA v1.0', fields: ['proof.proofValue', 'credentialSubject'] },
  { name: 'A2A', full: 'Agent-to-Agent Card', org: 'Google / AAIF', color: '#fbbf24', language: 'JSON + OAuth2', rfc: 'A2A v1.0 (Linux Fnd.)', fields: ['agent_card.capabilities', 'agent_card.endpoints'] },
  { name: 'MCP Card', full: 'MCP Server Card', org: 'Anthropic', color: '#f472b6', language: 'JSON + MCP protocol', rfc: 'MCP Server Card v1.0', fields: ['server.tools', 'server.identity'] },
  { name: 'W3C VC', full: 'Verifiable Credential', org: 'W3C', color: '#34d399', language: 'JSON-LD + LD-Proofs', rfc: 'VC Data Model 2.0', fields: ['issuer', 'credentialSubject', 'proof.type'] },
  { name: 'OAuth/OIDC', full: 'OAuth 2.0 / OIDC', org: 'IETF', color: '#60a5fa', language: 'JWT (RS256/ES256/EdDSA)', rfc: 'RFC 6749 + OIDC Core', fields: ['sub', 'iss', 'scope', 'exp'] },
  { name: 'SPIFFE', full: 'SPIFFE SVID', org: 'CNCF', color: '#fb923c', language: 'X.509 + JWT', rfc: 'SPIFFE v1.0', fields: ['spiffe_id', 'trust_domain', 'ttl'] },
];

const STAGES = [
  { n: 1, name: 'Identity' }, { n: 2, name: 'Attestation' }, { n: 3, name: 'Capabilities' },
  { n: 4, name: 'Evidence' }, { n: 5, name: 'Risk' }, { n: 6, name: 'Signature' },
  { n: 7, name: 'Revocation' }, { n: 8, name: 'Expiration' }, { n: 9, name: 'Proof-of-Possession' },
  { n: 10, name: 'TrustRegistry' }, { n: 11, name: 'Action Receipt' }, { n: 12, name: 'Supply-chain SBOM' },
];

const STATS = [
  { value: '8', label: 'format adapters' }, { value: '12', label: 'verification stages' },
  { value: '41', label: 'test vectors' }, { value: '23/23', label: 'conformance tests' },
  { value: '7', label: 'NPM packages' }, { value: '2,339', label: 'monthly downloads' },
];

const COMPARISON = [
  { aspect: 'Agent identity', before: 'Each platform its own format — agents can\'t verify across ecosystems.', after: 'Any format to any other. One verifier everywhere.' },
  { aspect: 'Trust score', before: 'Proprietary. No way to verify the evidence behind it.', after: 'ATC carries evidence — anyone can re-derive the score.' },
  { aspect: 'Capabilities', before: 'Undeclared. Agents discover by calling — dangerous.', after: 'Declared upfront and verified at install time.' },
  { aspect: 'Revocation', before: 'No standard. Compromised credentials work indefinitely.', after: 'CRL + OCSP + Bitstring. Checked before every call.' },
  { aspect: 'Expiration', before: 'Credentials never expire.', after: 'max_ttl_days 90. Old credentials fail stage 8.' },
  { aspect: 'Cross-language', before: 'Each SDK canonicalizes differently — signatures don\'t verify.', after: 'RFC 8785 JCS. Same bytes in Node, Python, Go, Rust.' },
];

const ROADMAP = [
  { phase: 'Done', color: '#00F299', items: ['ATC/1.0 + v3.0 specs (public)', '8 adapters · 41 test vectors', '23/23 conformance tests', '7 NPM packages', 'Independent audit (14/14 fixed)', 'Test CA key published'] },
  { phase: 'In Progress', color: '#00d1ff', items: ['Multi-sig N-of-M CAs', 'Tool-catalog pinning', 'Python / Go / Rust SDKs', 'ATC v3.0 formal submission', 'Cross-language runner'] },
  { phase: 'Planned', color: '#a78bfa', items: ['TEE attestation (SGX/SEV/Nitro)', 'Post-quantum (ML-DSA)', 'Formal verification (Coq/TLA+)', 'IETF RFC + W3C CG', 'Linux Foundation project'] },
];

// ═══════════════════════════════════════════════════════════════
// LIVE DEMO WIDGETS — real calls against the production API
// ═══════════════════════════════════════════════════════════════
function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#00F299]/10 border border-[#00F299]/25 mb-3">
      <span className="w-1.5 h-1.5 rounded-full bg-[#00F299] animate-pulse" />
      <span className="text-[#00F299] text-[9px] font-mono tracking-widest">LIVE</span>
    </span>
  );
}

function DemoButton({ onClick, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="px-3 py-1.5 rounded-lg bg-[#00d1ff]/15 border border-[#00d1ff]/40 text-[#00d1ff] text-xs font-bold hover:bg-[#00d1ff]/25 transition-all disabled:opacity-50 cursor-pointer">
      {children}
    </button>
  );
}

// ── Demo 1: Scam Checker (GET /api/scam-check) ──
function ScamCheckerDemo() {
  const [domain, setDomain] = useState('amaz0n-login.xyz');
  const [state, setState] = useState('idle'); // idle|loading|done|error
  const [data, setData] = useState(null);
  const run = async () => {
    setState('loading');
    try {
      const r = await fetch(`/api/scam-check?domain=${encodeURIComponent(domain)}`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      setData(await r.json()); setState('done');
    } catch (e) { setState('error'); }
  };
  const color = { TRUSTED: '#00F299', CAUTION: '#fbbf24', SUSPICIOUS: '#f87171', UNKNOWN: '#94a3b8' }[data?.decision] || '#94a3b8';
  return (
    <div className="space-y-2">
      <LiveDot />
      <div className="flex gap-1.5">
        <input value={domain} onChange={e => setDomain(e.target.value)} spellCheck={false}
          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/10 text-zinc-200 text-xs font-mono outline-none focus:border-[#00d1ff]/50" />
        <DemoButton onClick={run} disabled={state === 'loading'}>{state === 'loading' ? '…' : 'Check'}</DemoButton>
      </div>
      {state === 'done' && data && (
        <div className="p-2.5 rounded-lg bg-black/50 border" style={{ borderColor: color + '55' }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: color + '22', color }}>
              {data.decision}
            </span>
            <span className="text-zinc-500 text-[10px] font-mono">risk {data.risk_score}/100</span>
            <span className="text-zinc-600 text-[10px] ml-auto truncate max-w-[140px]">{(data.reasons || [])[0]}</span>
          </div>
          <div className="h-1 rounded-full bg-black/70 mt-2 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${data.risk_score}%`, background: `linear-gradient(90deg,#00F299,#fbbf24,#f87171)` }} />
          </div>
        </div>
      )}
      {state === 'error' && <div className="text-red-400 text-[10px] font-mono">API unreachable — open the full tool to retry</div>}
    </div>
  );
}

// ── Demo 2: Credential Translator (POST /api/trust?action=translate) ──
const TRANSLATE_SAMPLE = { iss: 'did:web:alice.example', sub: 'agent:bob', iat: 1735686000, exp: 1893456000, scope: 'read:files', trust_score: 7 };
function TranslatorDemo() {
  const [state, setState] = useState('idle');
  const [data, setData] = useState(null);
  const run = async () => {
    setState('loading');
    try {
      const r = await fetch('/api/trust?action=translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'jwt', to: 'w3c-vc', payload: TRANSLATE_SAMPLE }),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      setData(await r.json()); setState('done');
    } catch { setState('error'); }
  };
  return (
    <div className="space-y-2">
      <LiveDot />
      <div className="flex items-center gap-1.5 flex-wrap font-mono text-[10px]">
        <span className="px-1.5 py-0.5 rounded bg-[#00F299]/10 text-[#00F299] font-bold">JWT</span>
        <span className="text-zinc-600">→</span>
        <span className="text-zinc-500">UTS v2</span>
        <span className="text-zinc-600">→</span>
        <span className="px-1.5 py-0.5 rounded bg-[#00d1ff]/10 text-[#00d1ff] font-bold">W3C VC</span>
        <button onClick={run} disabled={state === 'loading'}
          className="ml-auto px-2.5 py-1 rounded-lg bg-[#00d1ff]/15 border border-[#00d1ff]/40 text-[#00d1ff] text-[10px] font-bold hover:bg-[#00d1ff]/25 transition-all disabled:opacity-50 cursor-pointer">
          {state === 'loading' ? 'translating…' : '▶ run'}
        </button>
      </div>
      {state === 'done' && data?.success && (
        <div className="p-2.5 rounded-lg bg-black/50 border border-[#00F299]/30 space-y-1">
          <div className="flex items-center gap-2 flex-wrap text-[10px]">
            <span className="text-[#00F299] font-bold">✅ translated · {data.lossless ? 'lossless' : data.warnings.length + ' warnings'}</span>
            <span className="text-zinc-500 font-mono truncate">issuer: {String(data.uts?.trust?.assessor || '')}</span>
          </div>
          <pre className="text-[9px] font-mono text-zinc-500 bg-black/60 rounded p-2 overflow-x-auto max-h-16">
{JSON.stringify(data.payload?.credentialSubject || data.payload, null, 0).slice(0, 180)}</pre>
        </div>
      )}
      {state === 'error' && <div className="text-red-400 text-[10px] font-mono">API unreachable — open the full tool to retry</div>}
    </div>
  );
}

// ── Demo 3: Verify Playground (POST /api/trust?action=verify) ──
const TAMPERED_ATC = {
  atc_version: '3.0.0', credential_id: 'ATC-DEMO-TAMPERED',
  issuer: { did: 'did:web:attacker.example', name: 'Totally Legit CA', ca_key_id: 'evil-ca-666' },
  subject: { agent_id: 'agent:innocent', public_key: 'MCowBQYDK2VwAyEAFakeAttackerKeyExampleOnlyAAAAAAAA=', key_algorithm: 'Ed25519' },
  capabilities: { provides: ['read:files', 'shell:exec'], requires: [], protocols: ['mcp'] },
  lifecycle: { issued_at: '2026-09-08T00:00:00Z', expires_at: '2030-01-01T00:00:00Z', revoked: false },
  signatures: [{ algorithm: 'Ed25519 (RFC 8032)', value: 'ab'.repeat(64), domain: 'UTA-ATC-V3-CREDENTIAL', key_id: 'evil-ca-666', canonicalization: 'RFC_8785_JCS' }],
};
function PlaygroundDemo() {
  const [state, setState] = useState('idle');
  const [stages, setStages] = useState([]);
  const [lit, setLit] = useState(0);
  const [verdict, setVerdict] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const run = async () => {
    setState('loading'); setLit(0); setVerdict(null); setStages([]);
    try {
      const r = await fetch('/api/trust?action=verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: TAMPERED_ATC }),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      setStages(d.stages || []); setState('done');
      let i = 0;
      timer.current = setInterval(() => {
        i += 1; setLit(i);
        if (i >= (d.stages || []).length) {
          clearInterval(timer.current);
          setVerdict({ decision: d.decision, failed: d.failed_stage });
        }
      }, 130);
    } catch { setState('error'); }
  };
  const statusColor = s => s === 'PASS' ? '#00F299' : s === 'FAIL' ? '#f87171' : s === 'WARN' ? '#fbbf24' : '#3f3f46';
  return (
    <div className="space-y-2">
      <LiveDot />
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-zinc-500 text-[10px] font-mono">tampered ATC · unknown CA</span>
        <button onClick={run} disabled={state === 'loading'}
          className="ml-auto px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/40 text-red-400 text-[10px] font-bold hover:bg-red-500/25 transition-all disabled:opacity-50 cursor-pointer">
          {state === 'loading' ? 'verifying…' : '▶ run 12 stages'}
        </button>
      </div>
      <div className="grid grid-cols-12 gap-1">
        {Array.from({ length: 12 }).map((_, i) => {
          const st = stages[i];
          const on = i < lit && st;
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="w-full h-1.5 rounded-full transition-all duration-200"
                style={{ background: on ? statusColor(st.status) : '#22222a', boxShadow: on && st.status === 'FAIL' ? '0 0 8px #f87171' : 'none' }} />
              <span className="text-[7px] font-mono" style={{ color: on ? statusColor(st.status) : '#3f3f46' }}>{i + 1}</span>
            </div>
          );
        })}
      </div>
      {verdict && (
        <div className="flex items-center gap-2 flex-wrap p-2 rounded-lg bg-red-500/5 border border-red-500/30">
          <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-400 text-[10px] font-bold">⛔ {verdict.decision}</span>
          <span className="text-zinc-500 text-[10px] font-mono">failed at {verdict.failed} — Ed25519 check caught the fake CA</span>
        </div>
      )}
      {state === 'error' && <div className="text-red-400 text-[10px] font-mono">API unreachable — open the full tool to retry</div>}
      {state === 'idle' && <div className="text-zinc-600 text-[10px]">Runs a forged credential through the real fail-closed pipeline.</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAGE — 8 sections (was 13)
// ═══════════════════════════════════════════════════════════════
export default function UTA() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative z-10">

        {/* ═══ 1 · HERO ═══ */}
        <section className="text-center max-w-5xl mx-auto px-6 pt-24 pb-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00d1ff]/10 border border-[#00d1ff]/20 mb-6">
              <span className="w-2 h-2 rounded-full bg-[#00d1ff] animate-pulse" />
              <span className="text-[#00d1ff] text-xs font-mono tracking-wider">UTA v1.1.0 · OPEN SOURCE · AL-1.0 LICENSE</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 leading-tight">Universal Trust Adapter</h1>
            <p className="text-2xl text-[#00d1ff] font-bold mb-6">The USB-C of Agent Trust</p>
            <p className="text-zinc-300 text-lg max-w-2xl mx-auto leading-relaxed mb-8">
              UTA translates between 8 trust credential formats used by AI agents via a canonical Universal Trust Schema (UTS v2.0.0). Like Zapier connects applications, UTA connects trust standards.
            </p>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 max-w-3xl mx-auto mb-8">
              {STATS.map(s => (
                <div key={s.label} className="p-3 rounded-xl bg-black/40 border border-white/5">
                  <div className="text-[#00F299] text-xl font-bold font-mono">{s.value}</div>
                  <div className="text-zinc-500 text-[10px] mt-1">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
              <a href="https://github.com/alicelabs-llc/universal-trust-adapter" target="_blank" rel="noopener" className="px-6 py-3 bg-[#00F299] text-black font-bold rounded-xl hover:bg-[#00F299]/90 transition-all text-sm">View on GitHub →</a>
              <a href="/uta/docs/atc-spec/SPEC.md" target="_blank" rel="noopener" className="px-6 py-3 border border-[#00d1ff]/30 bg-[#00d1ff]/10 text-[#00d1ff] font-bold rounded-xl hover:bg-[#00d1ff]/20 transition-all text-sm">Read the Spec →</a>
              <a href="/playground.html" className="px-6 py-3 border border-white/10 text-white font-medium rounded-xl hover:bg-white/5 transition-all text-sm">Try it live →</a>
            </div>
            <div className="inline-block px-4 py-2 rounded-lg bg-black/40 border border-white/5">
              <code className="text-[#00F299] text-xs font-mono">npm install agent-trust-card@1.1.2</code>
              <span className="text-zinc-600 text-xs mx-2">·</span>
              <code className="text-[#00d1ff] text-xs font-mono">npx -y marketnow-mcp@1.10.1</code>
            </div>
          </motion.div>
        </section>

        {/* ═══ 2 · THE PROBLEM ═══ */}
        <section className="max-w-5xl mx-auto px-6 pb-14">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-4">The Problem: 8 Fragmented Trust Formats</h2>
            <p className="text-zinc-400 text-sm mb-4">
              AI agents are autonomous actors — they call APIs, write to filesystems, spawn processes, and pay for resources. They can't type passwords or approve 2FA; they need machine-verifiable credentials. But <strong className="text-white">8 competing formats</strong> exist, and none speak to each other — every ecosystem is an island:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
              {FORMATS.map(f => (
                <div key={f.name} className="p-2.5 rounded-lg bg-black/40 border" style={{ borderColor: f.color + '25' }}>
                  <div className="font-bold text-sm" style={{ color: f.color }}>{f.name}</div>
                  <div className="text-zinc-600 text-[10px]">{f.org}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-center">
                <div className="text-red-400 text-2xl font-bold font-mono">88%</div>
                <div className="text-zinc-500 text-xs mt-1">orgs had AI agent security incidents (2026)</div>
              </div>
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-center">
                <div className="text-red-400 text-2xl font-bold font-mono">92%</div>
                <div className="text-zinc-500 text-xs mt-1">CISOs lack visibility into agent identities</div>
              </div>
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-center">
                <div className="text-red-400 text-2xl font-bold font-mono">30+</div>
                <div className="text-zinc-500 text-xs mt-1">CVEs against MCP servers in 60 days</div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ═══ 3 · THE SOLUTION ═══ */}
        <section className="max-w-5xl mx-auto px-6 pb-14">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-4">The Solution: UTA Translates Everything</h2>
            <p className="text-zinc-400 text-sm mb-6">Any format to any other via a canonical Universal Trust Schema. One verifier. Every ecosystem. No vendor lock-in.</p>
            <div className="flex flex-col items-center gap-3">
              <div className="grid grid-cols-4 gap-2 w-full max-w-2xl">
                {FORMATS.slice(0, 4).map(f => (
                  <div key={f.name} className="p-2 rounded-lg border text-center" style={{ borderColor: f.color + '40' }}>
                    <div className="font-bold text-xs" style={{ color: f.color }}>{f.name}</div>
                  </div>
                ))}
              </div>
              <div className="text-[#00d1ff] text-xl">↕</div>
              <div className="px-8 py-3.5 rounded-xl bg-[#00d1ff]/10 border border-[#00d1ff]/30 text-center">
                <div className="text-[#00d1ff] font-bold text-lg">UTA — Universal Trust Schema (UTS v2.0.0)</div>
                <div className="text-zinc-400 text-xs mt-1">Ed25519 (RFC 8032) · RFC 8785 JCS · SHA-256 · 12-stage pipeline</div>
              </div>
              <div className="text-[#00d1ff] text-xl">↕</div>
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

        {/* ═══ 4 · TRY UTA LIVE — interactive cards ═══ */}
        <section className="max-w-5xl mx-auto px-6 pb-14">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-2">Try UTA Live — Right Here</h2>
            <p className="text-zinc-400 text-sm mb-6">These aren't screenshots. Each card runs a real call against the production <span className="text-[#00d1ff]">/api</span> endpoints — press a button and watch it work. No key, no signup.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl bg-black/40 border border-[#00d1ff]/20 hover:border-[#00d1ff]/50 transition-all group">
                <div className="text-[#00d1ff] text-2xl mb-1">🛡️</div>
                <div className="text-white font-bold text-sm mb-1 group-hover:text-[#00d1ff] transition-colors">Scam Checker</div>
                <div className="text-zinc-500 text-xs leading-relaxed mb-3">Your AI recommended a store — is it a scam? 8 transparent heuristics, honest verdicts.</div>
                <ScamCheckerDemo />
                <a href="/scam-checker.html" className="text-[#00F299] text-xs mt-3 inline-block font-medium group-hover:underline">Open full tool →</a>
              </div>
              <div className="p-5 rounded-xl bg-black/40 border border-[#00d1ff]/20 hover:border-[#00d1ff]/50 transition-all group">
                <div className="text-[#00d1ff] text-2xl mb-1">🔄</div>
                <div className="text-white font-bold text-sm mb-1 group-hover:text-[#00d1ff] transition-colors">Credential Translator</div>
                <div className="text-zinc-500 text-xs leading-relaxed mb-3">Translate credentials between the 8 trust formats — live round-trip through UTS v2.</div>
                <TranslatorDemo />
                <a href="/translate.html" className="text-[#00F299] text-xs mt-3 inline-block font-medium group-hover:underline">Open full tool →</a>
              </div>
              <div className="p-5 rounded-xl bg-black/40 border border-[#00d1ff]/20 hover:border-[#00d1ff]/50 transition-all group">
                <div className="text-[#00d1ff] text-2xl mb-1">🧪</div>
                <div className="text-white font-bold text-sm mb-1 group-hover:text-[#00d1ff] transition-colors">Verify Playground</div>
                <div className="text-zinc-500 text-xs leading-relaxed mb-3">12-stage fail-closed pipeline. Watch a forged credential get caught at the crypto stage.</div>
                <PlaygroundDemo />
                <a href="/playground.html" className="text-[#00F299] text-xs mt-3 inline-block font-medium group-hover:underline">Open full tool →</a>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ═══ 5 · FORMAT ADAPTERS (compact) ═══ */}
        <section className="max-w-5xl mx-auto px-6 pb-14">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-4">8 Format Adapters</h2>
            <p className="text-zinc-400 text-sm mb-5">Each adapter translates its native format to/from the Universal Trust Schema — preserving the security properties of the original credential. Watch all 56 pairs live in the <a href="/translate.html" className="text-[#00d1ff] hover:underline">Credential Translator</a>.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {FORMATS.map(f => (
                <div key={f.name} className="p-3.5 rounded-xl bg-black/40 border" style={{ borderColor: f.color + '20' }}>
                  <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                    <div>
                      <span className="font-bold text-sm" style={{ color: f.color }}>{f.name}</span>
                      <span className="text-zinc-500 text-xs ml-2">— {f.full}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-white/5 text-zinc-400 text-[10px] font-mono">{f.language}</span>
                  </div>
                  <div className="text-zinc-500 text-[10px]">{f.org} · {f.rfc}</div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {f.fields.map(field => (
                      <code key={field} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/60 text-zinc-500 border border-white/5">{field}</code>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ═══ 6 · PIPELINE + CRYPTO ═══ */}
        <section className="max-w-5xl mx-auto px-6 pb-14">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-2">12-Stage Fail-Closed Pipeline</h2>
            <p className="text-zinc-400 text-sm mb-5">Any stage fails → the pipeline stops. No partial verification. <a href="/playground.html" className="text-[#00d1ff] hover:underline">Run a credential through it →</a></p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
              {STAGES.map(s => (
                <div key={s.n} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-black/40 border border-white/5">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#00F299]/10 border border-[#00F299]/30 flex items-center justify-center text-[#00F299] text-[10px] font-bold">{s.n}</div>
                  <div className="text-white text-xs font-bold">{s.name}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              {[
                ['Ed25519', 'RFC 8032 — fast, compact'], ['RFC 8785 JCS', 'canonical JSON, every language'],
                ['SHA-256', 'over canonical bytes'], ['7 domains', 'signature separation'],
                ['PoP', 'nonce anti-replay'], ['SPDX 2.3', 'supply-chain SBOM'],
              ].map(([k, v]) => (
                <div key={k} className="p-2.5 rounded-lg bg-black/40 border border-white/5 text-center">
                  <div className="text-[#00F299] text-xs font-bold font-mono">{k}</div>
                  <div className="text-zinc-500 text-[9px] mt-1">{v}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ═══ 7 · WHY IT'S DIFFERENT + VERIFY IT YOURSELF ═══ */}
        <section className="max-w-5xl mx-auto px-6 pb-14">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-4">Before vs After UTA</h2>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2.5 px-2 text-zinc-400 text-xs">Aspect</th>
                    <th className="text-left py-2.5 px-2 text-red-400 text-xs">Before</th>
                    <th className="text-left py-2.5 px-2 text-[#00F299] text-xs">After</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map(c => (
                    <tr key={c.aspect} className="border-b border-white/5">
                      <td className="py-2.5 px-2 text-white font-bold text-xs">{c.aspect}</td>
                      <td className="py-2.5 px-2 text-zinc-500 text-xs">{c.before}</td>
                      <td className="py-2.5 px-2 text-[#00F299] text-xs">{c.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 rounded-xl bg-black/40 border border-[#00F299]/20">
              <div className="text-white text-sm font-bold mb-2">🔑 Verify it yourself — no trust required</div>
              <p className="text-zinc-400 text-xs mb-3">The test CA private key is <strong className="text-[#00F299]">intentionally published</strong>. Re-derive every signature in any language:</p>
              <div className="flex flex-wrap gap-2 mb-3">
                <a href="/uta/docs/atc-spec/test-vectors/_index.json" target="_blank" rel="noopener" className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-xs text-[#00F299] font-medium hover:border-[#00F299]/40 transition-all">📋 Test Vectors →</a>
                <a href="/uta/docs/atc-spec/test-vectors/_test-ca-keys.json" target="_blank" rel="noopener" className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-xs text-[#00d1ff] font-medium hover:border-[#00d1ff]/40 transition-all">🔑 Test CA Keys →</a>
              </div>
              <div className="text-zinc-500 text-[10px] font-mono space-y-1">
                <div>git clone https://github.com/alicelabs-llc/universal-trust-adapter</div>
                <div>cd marketnow/atc-sdk && npm install</div>
                <div className="text-[#00F299]">node test/conformance.mjs  # 23/23 pass</div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ═══ 8 · ROADMAP + ADOPT ═══ */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-5">Roadmap</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {ROADMAP.map(phase => (
                <div key={phase.phase} className="p-4 rounded-lg bg-black/40 border" style={{ borderColor: phase.color + '20' }}>
                  <div className="text-sm font-bold mb-3" style={{ color: phase.color }}>
                    {phase.phase === 'Done' ? '✅ ' : phase.phase === 'In Progress' ? '🔧 ' : '📋 '}{phase.phase}
                  </div>
                  <ul className="space-y-1">
                    {phase.items.map(item => (
                      <li key={item} className="text-zinc-400 text-xs flex items-start gap-2">
                        <span className="text-zinc-600">•</span><span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="text-center p-5 rounded-xl bg-gradient-to-b from-[#00F299]/5 to-transparent border border-[#00F299]/15">
              <h3 className="text-white text-xl font-bold mb-2">Adopt UTA</h3>
              <p className="text-zinc-400 text-sm mb-5">Start in 30 seconds. No signup, no backend, no dependency.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center mb-5">
                <a href="https://github.com/alicelabs-llc/universal-trust-adapter" target="_blank" rel="noopener" className="px-6 py-3 bg-[#00F299] text-black font-bold rounded-xl hover:bg-[#00F299]/90 transition-all text-sm">GitHub Repo →</a>
                <a href="/uta/docs/atc-spec/SPEC.md" target="_blank" rel="noopener" className="px-6 py-3 border border-[#00d1ff]/30 bg-[#00d1ff]/10 text-[#00d1ff] font-bold rounded-xl hover:bg-[#00d1ff]/20 transition-all text-sm">Read Spec →</a>
                <a href="/uta/CONTRIBUTING.md" target="_blank" rel="noopener" className="px-6 py-3 border border-white/10 text-white font-medium rounded-xl hover:bg-white/5 transition-all text-sm">Contribute →</a>
              </div>
              <div className="inline-block px-4 py-2 rounded-lg bg-black/40 border border-white/5">
                <code className="text-[#00F299] text-xs font-mono">npm install agent-trust-card@1.1.2</code>
                <span className="text-zinc-600 text-xs mx-2">·</span>
                <code className="text-[#00d1ff] text-xs font-mono">npx -y marketnow-mcp@1.10.1</code>
              </div>
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
