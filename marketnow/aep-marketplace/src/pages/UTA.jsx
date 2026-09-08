import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { useLang } from '../context/LanguageContext.jsx';

// ═══════════════════════════════════════════════════════════════
// DATA (labels are translation keys — resolved via t())
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
  { n: 1, key: 'uta.stage.1' }, { n: 2, key: 'uta.stage.2' }, { n: 3, key: 'uta.stage.3' },
  { n: 4, key: 'uta.stage.4' }, { n: 5, key: 'uta.stage.5' }, { n: 6, key: 'uta.stage.6' },
  { n: 7, key: 'uta.stage.7' }, { n: 8, key: 'uta.stage.8' }, { n: 9, key: 'uta.stage.9' },
  { n: 10, key: 'uta.stage.10' }, { n: 11, key: 'uta.stage.11' }, { n: 12, key: 'uta.stage.12' },
];

const STATS = [
  { value: '8', label: 'uta.stat.adapters' }, { value: '12', label: 'uta.stat.stages' },
  { value: '41', label: 'uta.stat.vectors' }, { value: '23/23', label: 'uta.stat.conformance' },
  { value: '7', label: 'uta.stat.packages' }, { value: '2,339', label: 'uta.stat.downloads' },
];

const COMPARISON = [
  { a: 'uta.cmp1.aspect', b: 'uta.cmp1.before', c: 'uta.cmp1.after' },
  { a: 'uta.cmp2.aspect', b: 'uta.cmp2.before', c: 'uta.cmp2.after' },
  { a: 'uta.cmp3.aspect', b: 'uta.cmp3.before', c: 'uta.cmp3.after' },
  { a: 'uta.cmp4.aspect', b: 'uta.cmp4.before', c: 'uta.cmp4.after' },
  { a: 'uta.cmp5.aspect', b: 'uta.cmp5.before', c: 'uta.cmp5.after' },
  { a: 'uta.cmp6.aspect', b: 'uta.cmp6.before', c: 'uta.cmp6.after' },
];

const ROADMAP = [
  { phaseKey: 'uta.rm.done', color: '#00F299', icon: '✅', items: ['uta.rm.d1', 'uta.rm.d2', 'uta.rm.d3', 'uta.rm.d4', 'uta.rm.d5', 'uta.rm.d6'] },
  { phaseKey: 'uta.rm.progress', color: '#00d1ff', icon: '🔧', items: ['uta.rm.p1', 'uta.rm.p2', 'uta.rm.p3', 'uta.rm.p4', 'uta.rm.p5'] },
  { phaseKey: 'uta.rm.planned', color: '#a78bfa', icon: '📋', items: ['uta.rm.f1', 'uta.rm.f2', 'uta.rm.f3', 'uta.rm.f4', 'uta.rm.f5'] },
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

// ── Demo 1: Scam Checker (GET /api/scam-check) ──
function ScamCheckerDemo() {
  const { t } = useLang();
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
        <button onClick={run} disabled={state === 'loading'}
          className="px-3 py-1.5 rounded-lg bg-[#00d1ff]/15 border border-[#00d1ff]/40 text-[#00d1ff] text-xs font-bold hover:bg-[#00d1ff]/25 transition-all disabled:opacity-50 cursor-pointer">
          {state === 'loading' ? '…' : t('uta.live.demo.check')}
        </button>
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
      {state === 'error' && <div className="text-red-400 text-[10px] font-mono">{t('uta.live.demo.unreachable')}</div>}
    </div>
  );
}

// ── Demo 2: Credential Translator (POST /api/trust?action=translate) ──
const TRANSLATE_SAMPLE = { iss: 'did:web:alice.example', sub: 'agent:bob', iat: 1735686000, exp: 1893456000, scope: 'read:files', trust_score: 7 };
function TranslatorDemo() {
  const { t } = useLang();
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
          {state === 'loading' ? t('uta.live.demo.translating') : t('uta.live.demo.run')}
        </button>
      </div>
      {state === 'done' && data?.success && (
        <div className="p-2.5 rounded-lg bg-black/50 border border-[#00F299]/30 space-y-1">
          <div className="flex items-center gap-2 flex-wrap text-[10px]">
            <span className="text-[#00F299] font-bold">
              {data.lossless
                ? t('uta.live.demo.translated')
                : t('uta.live.demo.translatedWarn', { n: data.warnings.length })}
            </span>
            <span className="text-zinc-500 font-mono truncate">{t('uta.live.demo.issuer')} {String(data.uts?.trust?.assessor || '')}</span>
          </div>
          <pre className="text-[9px] font-mono text-zinc-500 bg-black/60 rounded p-2 overflow-x-auto max-h-16">
{JSON.stringify(data.payload?.credentialSubject || data.payload, null, 0).slice(0, 180)}</pre>
        </div>
      )}
      {state === 'error' && <div className="text-red-400 text-[10px] font-mono">{t('uta.live.demo.unreachable')}</div>}
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
  const { t } = useLang();
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
        <span className="text-zinc-500 text-[10px] font-mono">{t('uta.live.demo.tampered')}</span>
        <button onClick={run} disabled={state === 'loading'}
          className="ml-auto px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/40 text-red-400 text-[10px] font-bold hover:bg-red-500/25 transition-all disabled:opacity-50 cursor-pointer">
          {state === 'loading' ? t('uta.live.demo.verifying') : t('uta.live.demo.run12')}
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
          <span className="text-zinc-500 text-[10px] font-mono">{t('uta.live.demo.failedAt', { stage: verdict.failed })}</span>
        </div>
      )}
      {state === 'error' && <div className="text-red-400 text-[10px] font-mono">{t('uta.live.demo.unreachable')}</div>}
      {state === 'idle' && <div className="text-zinc-600 text-[10px]">{t('uta.live.demo.forged')}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAGE — 8 sections, fully internationalized (13 languages)
// ═══════════════════════════════════════════════════════════════
export default function UTA() {
  const { t } = useLang();
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
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 leading-tight">{t('uta.hero.title')}</h1>
            <p className="text-2xl text-[#00d1ff] font-bold mb-6">{t('uta.hero.tagline')}</p>
            <p className="text-zinc-300 text-lg max-w-2xl mx-auto leading-relaxed mb-8">
              {t('uta.hero.desc')}
            </p>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 max-w-3xl mx-auto mb-8">
              {STATS.map(s => (
                <div key={s.label} className="p-3 rounded-xl bg-black/40 border border-white/5">
                  <div className="text-[#00F299] text-xl font-bold font-mono">{s.value}</div>
                  <div className="text-zinc-500 text-[10px] mt-1">{t(s.label)}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
              <a href="https://github.com/alicelabs-llc/universal-trust-adapter" target="_blank" rel="noopener" className="px-6 py-3 bg-[#00F299] text-black font-bold rounded-xl hover:bg-[#00F299]/90 transition-all text-sm">{t('uta.hero.ctaGithub')}</a>
              <a href="/uta/docs/atc-spec/SPEC.md" target="_blank" rel="noopener" className="px-6 py-3 border border-[#00d1ff]/30 bg-[#00d1ff]/10 text-[#00d1ff] font-bold rounded-xl hover:bg-[#00d1ff]/20 transition-all text-sm">{t('uta.hero.ctaSpec')}</a>
              <a href="/playground.html" className="px-6 py-3 border border-white/10 text-white font-medium rounded-xl hover:bg-white/5 transition-all text-sm">{t('uta.hero.ctaLive')}</a>
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
            <h2 className="text-white text-2xl font-bold mb-4">{t('uta.problem.title')}</h2>
            <p className="text-zinc-400 text-sm mb-4">
              {t('uta.problem.body')} <strong className="text-white">{t('uta.problem.strong')}</strong> {t('uta.problem.bodyEnd')}
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
                <div className="text-zinc-500 text-xs mt-1">{t('uta.problem.stat1')}</div>
              </div>
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-center">
                <div className="text-red-400 text-2xl font-bold font-mono">92%</div>
                <div className="text-zinc-500 text-xs mt-1">{t('uta.problem.stat2')}</div>
              </div>
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-center">
                <div className="text-red-400 text-2xl font-bold font-mono">30+</div>
                <div className="text-zinc-500 text-xs mt-1">{t('uta.problem.stat3')}</div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ═══ 3 · THE SOLUTION ═══ */}
        <section className="max-w-5xl mx-auto px-6 pb-14">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-4">{t('uta.solution.title')}</h2>
            <p className="text-zinc-400 text-sm mb-6">{t('uta.solution.body')}</p>
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
                <div className="text-[#00d1ff] font-bold text-lg">{t('uta.solution.uts')}</div>
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
            <h2 className="text-white text-2xl font-bold mb-2">{t('uta.live.title')}</h2>
            <p className="text-zinc-400 text-sm mb-6">{t('uta.live.descA')} <span className="text-[#00d1ff]">/api</span> {t('uta.live.descB')}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl bg-black/40 border border-[#00d1ff]/20 hover:border-[#00d1ff]/50 transition-all group">
                <div className="text-[#00d1ff] text-2xl mb-1">🛡️</div>
                <div className="text-white font-bold text-sm mb-1 group-hover:text-[#00d1ff] transition-colors">{t('uta.live.checker.title')}</div>
                <div className="text-zinc-500 text-xs leading-relaxed mb-3">{t('uta.live.checker.desc')}</div>
                <ScamCheckerDemo />
                <a href="/scam-checker.html" className="text-[#00F299] text-xs mt-3 inline-block font-medium group-hover:underline">{t('uta.live.open')}</a>
              </div>
              <div className="p-5 rounded-xl bg-black/40 border border-[#00d1ff]/20 hover:border-[#00d1ff]/50 transition-all group">
                <div className="text-[#00d1ff] text-2xl mb-1">🔄</div>
                <div className="text-white font-bold text-sm mb-1 group-hover:text-[#00d1ff] transition-colors">{t('uta.live.translator.title')}</div>
                <div className="text-zinc-500 text-xs leading-relaxed mb-3">{t('uta.live.translator.desc')}</div>
                <TranslatorDemo />
                <a href="/translate.html" className="text-[#00F299] text-xs mt-3 inline-block font-medium group-hover:underline">{t('uta.live.open')}</a>
              </div>
              <div className="p-5 rounded-xl bg-black/40 border border-[#00d1ff]/20 hover:border-[#00d1ff]/50 transition-all group">
                <div className="text-[#00d1ff] text-2xl mb-1">🧪</div>
                <div className="text-white font-bold text-sm mb-1 group-hover:text-[#00d1ff] transition-colors">{t('uta.live.playground.title')}</div>
                <div className="text-zinc-500 text-xs leading-relaxed mb-3">{t('uta.live.playground.desc')}</div>
                <PlaygroundDemo />
                <a href="/playground.html" className="text-[#00F299] text-xs mt-3 inline-block font-medium group-hover:underline">{t('uta.live.open')}</a>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ═══ 5 · FORMAT ADAPTERS (compact) ═══ */}
        <section className="max-w-5xl mx-auto px-6 pb-14">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-4">{t('uta.adapters.title')}</h2>
            <p className="text-zinc-400 text-sm mb-5">{t('uta.adapters.bodyA')} <a href="/translate.html" className="text-[#00d1ff] hover:underline">{t('uta.adapters.link')}</a>{t('uta.adapters.bodyB')}</p>
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
            <h2 className="text-white text-2xl font-bold mb-2">{t('uta.pipeline.title')}</h2>
            <p className="text-zinc-400 text-sm mb-5">{t('uta.pipeline.bodyA')} <a href="/playground.html" className="text-[#00d1ff] hover:underline">{t('uta.pipeline.runLink')}</a></p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
              {STAGES.map(s => (
                <div key={s.n} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-black/40 border border-white/5">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#00F299]/10 border border-[#00F299]/30 flex items-center justify-center text-[#00F299] text-[10px] font-bold">{s.n}</div>
                  <div className="text-white text-xs font-bold">{t(s.key)}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              {[
                ['Ed25519', 'uta.crypto.ed'], ['RFC 8785 JCS', 'uta.crypto.jcs'],
                ['SHA-256', 'uta.crypto.sha'], ['7 domains', 'uta.crypto.domains'],
                ['PoP', 'uta.crypto.pop'], ['SPDX 2.3', 'uta.crypto.sbom'],
              ].map(([k, key]) => (
                <div key={k} className="p-2.5 rounded-lg bg-black/40 border border-white/5 text-center">
                  <div className="text-[#00F299] text-xs font-bold font-mono">{k}</div>
                  <div className="text-zinc-500 text-[9px] mt-1">{t(key)}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ═══ 7 · WHY IT'S DIFFERENT + VERIFY IT YOURSELF ═══ */}
        <section className="max-w-5xl mx-auto px-6 pb-14">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-4">{t('uta.compare.title')}</h2>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2.5 px-2 text-zinc-400 text-xs">{t('uta.compare.colAspect')}</th>
                    <th className="text-left py-2.5 px-2 text-red-400 text-xs">{t('uta.compare.colBefore')}</th>
                    <th className="text-left py-2.5 px-2 text-[#00F299] text-xs">{t('uta.compare.colAfter')}</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map(c => (
                    <tr key={c.a} className="border-b border-white/5">
                      <td className="py-2.5 px-2 text-white font-bold text-xs">{t(c.a)}</td>
                      <td className="py-2.5 px-2 text-zinc-500 text-xs">{t(c.b)}</td>
                      <td className="py-2.5 px-2 text-[#00F299] text-xs">{t(c.c)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 rounded-xl bg-black/40 border border-[#00F299]/20">
              <div className="text-white text-sm font-bold mb-2">{t('uta.verify.title')}</div>
              <p className="text-zinc-400 text-xs mb-3">{t('uta.verify.bodyA')} <strong className="text-[#00F299]">{t('uta.verify.strong')}</strong>{t('uta.verify.bodyB')}</p>
              <div className="flex flex-wrap gap-2 mb-3">
                <a href="/uta/docs/atc-spec/test-vectors/_index.json" target="_blank" rel="noopener" className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-xs text-[#00F299] font-medium hover:border-[#00F299]/40 transition-all">{t('uta.verify.vectors')}</a>
                <a href="/uta/docs/atc-spec/test-vectors/_test-ca-keys.json" target="_blank" rel="noopener" className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-xs text-[#00d1ff] font-medium hover:border-[#00d1ff]/40 transition-all">{t('uta.verify.keys')}</a>
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
            <h2 className="text-white text-2xl font-bold mb-5">{t('uta.roadmap.title')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {ROADMAP.map(phase => (
                <div key={phase.phaseKey} className="p-4 rounded-lg bg-black/40 border" style={{ borderColor: phase.color + '20' }}>
                  <div className="text-sm font-bold mb-3" style={{ color: phase.color }}>
                    {phase.icon} {t(phase.phaseKey)}
                  </div>
                  <ul className="space-y-1">
                    {phase.items.map(item => (
                      <li key={item} className="text-zinc-400 text-xs flex items-start gap-2">
                        <span className="text-zinc-600">•</span><span>{t(item)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="text-center p-5 rounded-xl bg-gradient-to-b from-[#00F299]/5 to-transparent border border-[#00F299]/15">
              <h3 className="text-white text-xl font-bold mb-2">{t('uta.adopt.title')}</h3>
              <p className="text-zinc-400 text-sm mb-5">{t('uta.adopt.body')}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center mb-5">
                <a href="https://github.com/alicelabs-llc/universal-trust-adapter" target="_blank" rel="noopener" className="px-6 py-3 bg-[#00F299] text-black font-bold rounded-xl hover:bg-[#00F299]/90 transition-all text-sm">{t('uta.adopt.github')}</a>
                <a href="/uta/docs/atc-spec/SPEC.md" target="_blank" rel="noopener" className="px-6 py-3 border border-[#00d1ff]/30 bg-[#00d1ff]/10 text-[#00d1ff] font-bold rounded-xl hover:bg-[#00d1ff]/20 transition-all text-sm">{t('uta.adopt.spec')}</a>
                <a href="/uta/CONTRIBUTING.md" target="_blank" rel="noopener" className="px-6 py-3 border border-white/10 text-white font-medium rounded-xl hover:bg-white/5 transition-all text-sm">{t('uta.adopt.contribute')}</a>
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
