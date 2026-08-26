import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useState } from 'react';

// ═══════════════════════════════════════════════════════════════
// FORMAT ADAPTERS — cada formato con su estructura técnica
// ═══════════════════════════════════════════════════════════════
const FORMATS = [
  {
    name: 'ATC',
    full: 'Agent Trust Card',
    org: 'AliceLabs LLC',
    spec: 'ATC/1.0 + ATC v3.0 (multi-sig)',
    desc: 'Ed25519-signed JSON credential with 8 verification controls. Canonical JCS bytes. Test CA private key published for cross-language reproducibility.',
    color: '#00F299',
    fields: ['identity.agent_id', 'attestation.signature', 'capabilities.filesystem', 'evidence.audit_pipeline', 'risk.trust_score', 'revocation.url', 'validity.expires_at'],
    language: 'JSON + Ed25519',
    rfc: 'ATC/1.0 spec (AliceLabs)',
    status: 'stable',
  },
  {
    name: 'EAT-AI',
    full: 'Entity Attestation Token for AI',
    org: 'IETF',
    spec: 'RFC 9421 (draft)',
    desc: 'CWT/CBOR-based attestation token using COSE signatures. Aligns with TEE attestation (SGX, SEV-SNP, Nitro). UTA translates EAT-CWT to ATC JSON.',
    color: '#00d1ff',
    fields: ['eat_profile', 'ueid', 'oemid', 'hwmodel', 'secboot', 'debug_state', 'swname'],
    language: 'CWT/CBOR + COSE',
    rfc: 'RFC 9421 (IETF)',
    status: 'stable',
  },
  {
    name: 'ZTA',
    full: 'Zero-Trust Agent Credential',
    org: 'Anthropic',
    spec: 'ZTA v1.0',
    desc: 'Ed25519Signature2020 proof format for agent identity. Used in Anthropic agent framework. UTA translates ZTA proofs to ATC attestations.',
    color: '#a78bfa',
    fields: ['proof.type', 'proof.created', 'proof.verificationMethod', 'proof.proofValue', 'credentialSubject'],
    language: 'JSON-LD + Ed25519Signature2020',
    rfc: 'ZTA v1.0 (Anthropic)',
    status: 'stable',
  },
  {
    name: 'A2A',
    full: 'Agent-to-Agent Card',
    org: 'Google / AAIF',
    spec: 'A2A v1.0 (Linux Foundation)',
    desc: 'Agent card format for inter-agent communication. Defines capabilities, endpoints, and authentication. UTA translates A2A cards to UTS.',
    color: '#fbbf24',
    fields: ['agent_card.version', 'agent_card.capabilities', 'agent_card.endpoints', 'agent_card.authentication'],
    language: 'JSON + OAuth2',
    rfc: 'A2A v1.0 (AAIF/Linux Foundation)',
    status: 'stable',
  },
  {
    name: 'MCP Card',
    full: 'MCP Server Card',
    org: 'Anthropic',
    spec: 'MCP Server Card v1.0',
    desc: 'Identity card for MCP (Model Context Protocol) servers. Defines tools, resources, and server identity. UTA translates MCP cards to ATC.',
    color: '#f472b6',
    fields: ['server.name', 'server.version', 'server.tools', 'server.resources', 'server.identity'],
    language: 'JSON + MCP protocol',
    rfc: 'MCP Server Card v1.0 (Anthropic)',
    status: 'stable',
  },
  {
    name: 'W3C VC',
    full: 'W3C Verifiable Credential',
    org: 'W3C',
    spec: 'VC Data Model 2.0',
    desc: 'Standard verifiable credential format with linked data proofs. UTA translates W3C VCs to ATC by extracting subject claims and re-signing.',
    color: '#34d399',
    fields: ['@context', 'type', 'issuer', 'credentialSubject', 'proof.type', 'proof.verificationMethod'],
    language: 'JSON-LD + LD-Proofs',
    rfc: 'W3C VC Data Model 2.0',
    status: 'stable',
  },
  {
    name: 'OAuth/OIDC',
    full: 'OAuth 2.0 / OpenID Connect',
    org: 'IETF',
    spec: 'RFC 6749 + OpenID Connect Core',
    desc: 'OAuth tokens (access, ID, refresh) and OIDC identity claims. UTA extracts identity claims from OIDC tokens and translates to ATC identity fields.',
    color: '#60a5fa',
    fields: ['access_token', 'id_token', 'refresh_token', 'sub', 'iss', 'aud', 'exp', 'scope'],
    language: 'JWT (RS256/ES256/EdDSA)',
    rfc: 'RFC 6749 + OIDC Core',
    status: 'stable',
  },
  {
    name: 'SPIFFE',
    full: 'SPIFFE SVID',
    org: 'CNCF',
    spec: 'SPIFFE v1.0',
    desc: 'Secure Production Identity Framework for Everyone. X.509 SVID and JWT-SVID formats. UTA translates SPIFFE IDs to ATC identity fields.',
    color: '#fb923c',
    fields: ['spiffe_id', 'trust_domain', 'x509_svid', 'jwt_svid', 'ttl'],
    language: 'X.509 + JWT',
    rfc: 'SPIFFE v1.0 (CNCF)',
    status: 'stable',
  },
];

// ═══════════════════════════════════════════════════════════════
// CROSS-LANGUAGE TRANSLATION EXAMPLES
// ═══════════════════════════════════════════════════════════════
const TRANSLATIONS = [
  {
    from: 'ATC (JSON)',
    to: 'EAT-AI (CWT/CBOR)',
    desc: 'UTA extracts ATC identity + capabilities, wraps them in a CWT/CBOR structure with COSE Ed25519 signature. Verifier in IETF EAT ecosystem checks the EAT-CWT signature.',
    fields: ['identity.agent_id → eat.ueid', 'capabilities → eat_profile', 'attestation.signature → COSE Sig_structure'],
  },
  {
    from: 'EAT-AI (CWT/CBOR)',
    to: 'ATC (JSON)',
    desc: 'UTA decodes CWT, extracts UEID and EAT profile, maps to ATC identity and capabilities. Re-signs with ATC CA Ed25519 key over JCS canonical bytes.',
    fields: ['eat.ueid → identity.agent_id', 'eat_profile → capabilities', 'COSE signature → attestation.signature'],
  },
  {
    from: 'ZTA (JSON-LD)',
    to: 'W3C VC (JSON-LD)',
    desc: 'UTA extracts ZTA proof, maps to W3C VC credentialSubject, re-signs with W3C LD-Proof format. Both use JSON-LD so the translation is mostly structural.',
    fields: ['proof.proofValue → proof.jws', 'credentialSubject → credentialSubject', 'proof.verificationMethod → proof.verificationMethod'],
  },
  {
    from: 'A2A (JSON)',
    to: 'ATC (JSON)',
    desc: 'UTA extracts A2A agent card capabilities, maps to ATC capability fields. A2A authentication becomes ATC attestation.subject_public_key.',
    fields: ['agent_card.capabilities → capabilities', 'agent_card.authentication → attestation', 'agent_card.endpoints → identity'],
  },
  {
    from: 'MCP Card (JSON)',
    to: 'ATC (JSON)',
    desc: 'UTA extracts MCP server identity and tools, maps to ATC identity and evidence. MCP server becomes the ATC subject.',
    fields: ['server.identity → identity.agent_id', 'server.tools → evidence', 'server.version → attestation'],
  },
  {
    from: 'OAuth/OIDC (JWT)',
    to: 'ATC (JSON)',
    desc: 'UTA decodes JWT, extracts sub/iss/aud claims, maps to ATC identity fields. Token scope becomes ATC capabilities.',
    fields: ['sub → identity.agent_id', 'iss → issuer.ca_id', 'scope → capabilities', 'exp → validity.expires_at'],
  },
  {
    from: 'SPIFFE SVID (X.509)',
    to: 'ATC (JSON)',
    desc: 'UTA extracts SPIFFE ID from X.509 SAN, maps trust_domain to ATC issuer, maps SVID TTL to ATC validity.',
    fields: ['spiffe_id → identity.agent_id', 'trust_domain → issuer.ca_id', 'ttl → validity.max_ttl_days'],
  },
  {
    from: 'W3C VC (JSON-LD)',
    to: 'ATC (JSON)',
    desc: 'UTA extracts VC credentialSubject claims, maps to ATC fields. VC proof is verified, then ATC is signed with ATC CA key.',
    fields: ['credentialSubject → identity + capabilities', 'issuer → issuer.ca_id', 'proof → attestation'],
  },
];

// ═══════════════════════════════════════════════════════════════
// PIPELINE STAGES
// ═══════════════════════════════════════════════════════════════
const PIPELINE_STAGES = [
  { n: 1, name: 'Identity', desc: 'agent_id (3-128 chars, alphanumeric), agent_name, agent_owner, owner_contact (mailto/https)' },
  { n: 2, name: 'Attestation', desc: 'subject_public_key (SPKI base64), subject_algorithm (Ed25519), signature (64+ bytes), signed_payload_hash (SHA-256 hex)' },
  { n: 3, name: 'Capabilities', desc: 'filesystem.read/write (none|own_dir|temp_dir|home_dir|system|all), network.egress (none|allowlist|all), shell.exec (none|sandboxed|unrestricted), credentials, process' },
  { n: 4, name: 'Evidence', desc: 'audit_pipeline name, audit_completed_at, static_checks (semgrep_rules_count, secret_patterns_count, dependency_scan), dynamic_checks (sandbox_runtime_ms, sandbox_exit_code), runtime_checks, findings[]' },
  { n: 5, name: 'Risk', desc: 'trust_score (0-10), risk_level (low|medium|high|critical), decision_authority (always "consumer"), score_explanation, scored_at' },
  { n: 6, name: 'Signature', desc: 'Ed25519 (RFC 8032) over RFC 8785 JCS canonical bytes. signature and signed_payload_hash are blanked during canonicalization, then computed.' },
  { n: 7, name: 'Revocation', desc: 'revocation_check_url, revocation_check_method (simple_json|crl|ocsp|bitstring), revocation_check_required (boolean)' },
  { n: 8, name: 'Expiration', desc: 'issued_at, expires_at, max_ttl_days (default 90). Credential fails if expires_at is in the past.' },
  { n: 9, name: 'Proof-of-Possession', desc: 'Nonce challenge anti-replay. Verifier sends random nonce, agent signs it with private key, proving key ownership.' },
  { n: 10, name: 'TrustRegistry', desc: 'Key binding verification. Subject public key must be registered in the trust registry — prevents key substitution.' },
  { n: 11, name: 'Action Receipt', desc: 'Every tool invocation generates a signed Ed25519 receipt: args_hash, evidence_hash, named stages, chained log. Tamper-evident.' },
  { n: 12, name: 'Supply-chain SBOM', desc: 'SPDX 2.3 Software Bill of Materials. Verifies all dependencies against known vulnerabilities (OSV/CVE database).' },
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
  { aspect: 'Agent identity', before: 'Each platform has its own format (JWT, CWT, JSON-LD, X.509). Agents can\'t verify across ecosystems.', after: 'UTA translates any format to any other. One verifier works everywhere.' },
  { aspect: 'Trust score', before: 'Proprietary scores. No way to verify how they were computed or what evidence backs them.', after: 'ATC carries evidence (audit_pipeline, findings, static/dynamic checks). Anyone can re-derive the score.' },
  { aspect: 'Capabilities', before: 'Undeclared. Agents discover what a tool can do by calling it — potentially dangerous.', after: 'Declared upfront: filesystem, network, shell, credentials, process. Verified at install time.' },
  { aspect: 'Revocation', before: 'No standard. Some platforms email you. Some don\'t. Compromised credentials work indefinitely.', after: 'CRL + OCSP + Bitstring Status List. Agent checks revocation list before every call.' },
  { aspect: 'Expiration', before: 'Credentials never expire. Compromised keys work forever until manually revoked.', after: 'max_ttl_days (90 default). Old credentials automatically fail stage 8.' },
  { aspect: 'Cross-language', before: 'Each SDK has its own canonicalization (JSON.stringify, cbor.dumps, etc.). Signatures don\'t verify across languages.', after: 'RFC 8785 JCS. Same bytes in Node.js, Python, Go, Rust. Test CA private key published for verification.' },
];

const ROADMAP = [
  { phase: 'Done', color: '#00F299', items: ['ATC/1.0 spec (public, stable)', 'ATC v3.0 RFC Draft 00 (multi-sig)', '8 format adapters (ATC, EAT-AI, ZTA, A2A, MCP, W3C VC, OAuth, SPIFFE)', '12-stage verification pipeline', '41 test vectors (5 ATC/1.0 + 9 ATC v3.0 + 27 internal)', '23/23 conformance tests pass', '7 NPM packages (2,339 downloads/mo)', 'Independent security audit (14/14 findings fixed)', 'Test CA private key published', 'Conformance runner public', '5 download channels (NPM, jsDelivr, unpkg, marketnow.site, GitHub)'] },
  { phase: 'In Progress', color: '#00d1ff', items: ['Multi-sig N-of-M CA signatures (ATC v3.0)', 'Runtime tool-catalog pinning (catch tool-description-poisoning)', 'Post-exec filter (behavior-based detection)', 'Python SDK (pip install agent-trust-card)', 'Go SDK (go get agent-trust-card)', 'Rust SDK (cargo add agent-trust-card)', 'ATC v3.0 formal spec submission', 'Cross-language conformance runner (Python, Go, Rust)'] },
  { phase: 'Planned', color: '#a78bfa', items: ['TEE attestation (Intel SGX, AMD SEV-SNP, AWS Nitro)', 'Post-quantum signatures (ML-DSA / Dilithium)', 'Formal verification (Coq/TLA+ proofs)', 'IETF RFC submission (ATC/1.0 → RFC)', 'W3C Community Group formation', 'Linux Foundation project acceptance', 'MCP marketplace standard adoption', 'Industry consortium formation'] },
];

export default function UTA() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative z-10">
        {/* ═══ HERO ═══ */}
        <section className="text-center max-w-5xl mx-auto px-6 pt-24 pb-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00d1ff]/10 border border-[#00d1ff]/20 mb-6">
              <span className="w-2 h-2 rounded-full bg-[#00d1ff] animate-pulse" />
              <span className="text-[#00d1ff] text-xs font-mono tracking-wider">UTA v1.1.0 · OPEN SOURCE · AL-1.0 LICENSE</span>
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
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
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

            <div className="inline-block px-4 py-2 rounded-lg bg-black/40 border border-white/5">
              <code className="text-[#00F299] text-xs font-mono">npm install agent-trust-card@1.1.2</code>
              <span className="text-zinc-600 text-xs mx-2">·</span>
              <code className="text-[#00d1ff] text-xs font-mono">npx -y marketnow-mcp@1.10.1</code>
            </div>
          </motion.div>
        </section>

        {/* ═══ THE PROBLEM ═══ */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-4">The Problem: 8 Fragmented Trust Formats</h2>
            <p className="text-zinc-400 text-sm mb-4">
              AI agents are autonomous actors — they call APIs, write to filesystems, spawn processes, and pay for resources. Unlike human users, agents cannot type passwords or approve 2FA. They need machine-verifiable credentials that prove who they are and what they can do.
            </p>
            <p className="text-zinc-400 text-sm mb-4">
              The problem: <strong className="text-white">8 competing trust credential formats</strong> exist. None speak to each other. Each ecosystem is an island:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {FORMATS.map(f => (
                <div key={f.name} className="p-3 rounded-lg bg-black/40 border border-white/5" style={{ borderColor: f.color + '20' }}>
                  <div className="font-bold text-sm" style={{ color: f.color }}>{f.name}</div>
                  <div className="text-zinc-600 text-[10px] mt-1">{f.org}</div>
                  <div className="text-zinc-500 text-[10px] mt-1">{f.language}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
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

        {/* ═══ THE SOLUTION ═══ */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-4">The Solution: UTA Translates Everything</h2>
            <p className="text-zinc-400 text-sm mb-6">
              UTA translates any format to any other via a canonical Universal Trust Schema. One verifier. Every ecosystem. No vendor lock-in.
            </p>

            {/* Visual diagram */}
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="grid grid-cols-4 gap-2 w-full max-w-2xl">
                {FORMATS.slice(0, 4).map(f => (
                  <div key={f.name} className="p-2 rounded-lg border text-center" style={{ borderColor: f.color + '40' }}>
                    <div className="font-bold text-xs" style={{ color: f.color }}>{f.name}</div>
                    <div className="text-zinc-600 text-[8px] mt-1">{f.language.split(' ')[0]}</div>
                  </div>
                ))}
              </div>
              <div className="text-[#00d1ff] text-2xl">↕</div>
              <div className="px-8 py-4 rounded-xl bg-[#00d1ff]/10 border border-[#00d1ff]/30 text-center">
                <div className="text-[#00d1ff] font-bold text-lg">UTA — Universal Trust Schema (UTS v2.0.0)</div>
                <div className="text-zinc-400 text-xs mt-1">Ed25519 (RFC 8032) · RFC 8785 JCS · SHA-256 · 12-stage pipeline</div>
                <div className="text-zinc-600 text-[10px] mt-2">JSON canonical bytes — same in Node.js, Python, Go, Rust, C</div>
              </div>
              <div className="text-[#00d1ff] text-2xl">↕</div>
              <div className="grid grid-cols-4 gap-2 w-full max-w-2xl">
                {FORMATS.slice(4).map(f => (
                  <div key={f.name} className="p-2 rounded-lg border text-center" style={{ borderColor: f.color + '40' }}>
                    <div className="font-bold text-xs" style={{ color: f.color }}>{f.name}</div>
                    <div className="text-zinc-600 text-[8px] mt-1">{f.language.split(' ')[0]}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        {/* ═══ FORMAT ADAPTERS DETAIL ═══ */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-4">8 Format Adapters — Technical Details</h2>
            <p className="text-zinc-400 text-sm mb-6">Each adapter translates its native format to/from the Universal Trust Schema. Click a format to see its fields and how they map.</p>
            <div className="space-y-3">
              {FORMATS.map(f => (
                <div key={f.name} className="p-4 rounded-xl bg-black/40 border" style={{ borderColor: f.color + '20' }}>
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div>
                      <span className="font-bold text-sm" style={{ color: f.color }}>{f.name}</span>
                      <span className="text-zinc-500 text-xs ml-2">— {f.full}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-white/5 text-zinc-400 text-[10px] font-mono">{f.language}</span>
                      <span className="px-2 py-0.5 rounded bg-[#00F299]/10 text-[#00F299] text-[10px] font-mono">{f.status}</span>
                    </div>
                  </div>
                  <p className="text-zinc-400 text-xs mb-2">{f.desc}</p>
                  <div className="flex flex-wrap gap-1">
                    {f.fields.map(field => (
                      <code key={field} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/60 text-zinc-500 border border-white/5">{field}</code>
                    ))}
                  </div>
                  <div className="text-zinc-600 text-[10px] mt-2">Org: {f.org} · Spec: {f.rfc}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ═══ CROSS-LANGUAGE TRANSLATIONS ═══ */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-4">Cross-Format Translations</h2>
            <p className="text-zinc-400 text-sm mb-6">UTA doesn't just translate formats — it translates the underlying cryptographic structures. Each translation preserves the security properties of the original credential.</p>
            <div className="space-y-3">
              {TRANSLATIONS.map((t, i) => (
                <div key={i} className="p-4 rounded-xl bg-black/40 border border-white/5">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 rounded bg-[#00F299]/10 text-[#00F299] text-[10px] font-mono font-bold">{t.from}</span>
                    <span className="text-[#00d1ff]">→</span>
                    <span className="px-2 py-1 rounded bg-[#00d1ff]/10 text-[#00d1ff] text-[10px] font-mono font-bold">{t.to}</span>
                  </div>
                  <p className="text-zinc-400 text-xs mb-2">{t.desc}</p>
                  <div className="flex flex-wrap gap-1">
                    {t.fields.map(field => (
                      <code key={field} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/60 text-zinc-500 border border-white/5">{field}</code>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ═══ 12-STAGE PIPELINE ═══ */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-4">12-Stage Fail-Closed Verification Pipeline</h2>
            <p className="text-zinc-400 text-sm mb-6">Every credential goes through 12 stages. If any stage fails, the pipeline stops immediately. No partial verification.</p>
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

        {/* ═══ BEFORE vs AFTER ═══ */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="premium-card p-6 md:p-8">
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

        {/* ═══ CRYPTO ═══ */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-4">Cryptography</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                <div className="text-[#00F299] text-sm font-bold font-mono">Ed25519</div>
                <div className="text-zinc-500 text-xs mt-1">RFC 8032 — fast, compact, well-studied</div>
              </div>
              <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                <div className="text-[#00d1ff] text-sm font-bold font-mono">RFC 8785 JCS</div>
                <div className="text-zinc-500 text-xs mt-1">Canonical JSON — same bytes in every language</div>
              </div>
              <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                <div className="text-[#00F299] text-sm font-bold font-mono">SHA-256</div>
                <div className="text-zinc-500 text-xs mt-1">Over canonical bytes</div>
              </div>
              <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                <div className="text-[#00d1ff] text-sm font-bold font-mono">7 domains</div>
                <div className="text-zinc-500 text-xs mt-1">Signature domain separation (prevent cross-context reuse)</div>
              </div>
              <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                <div className="text-[#00F299] text-sm font-bold font-mono">PoP</div>
                <div className="text-zinc-500 text-xs mt-1">Proof-of-Possession nonce challenge (anti-replay)</div>
              </div>
              <div className="p-3 rounded-lg bg-black/40 border border-white/5">
                <div className="text-[#00d1ff] text-sm font-bold font-mono">SPDX 2.3</div>
                <div className="text-zinc-500 text-xs mt-1">Supply-chain SBOM verification</div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ═══ INDEPENDENT VERIFICATION ═══ */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-4">Independent Verification</h2>
            <p className="text-zinc-400 text-sm mb-4">
              The test CA private key is <strong className="text-[#00F299]">intentionally published</strong>. Anyone can re-derive every signature in any language (Python, Go, Rust, C).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <a href="/uta/docs/atc-spec/test-vectors/_index.json" target="_blank" rel="noopener" className="block p-4 rounded-lg bg-black/40 border border-[#00F299]/20 hover:border-[#00F299]/40 transition-all">
                <div className="text-[#00F299] text-sm font-bold">📋 Test Vectors Index →</div>
                <div className="text-zinc-500 text-xs mt-1">5 frozen vectors + canonical JCS bytes (hex + base64 + utf8) + SHA-256 + Ed25519 signature</div>
              </a>
              <a href="/uta/docs/atc-spec/test-vectors/_test-ca-keys.json" target="_blank" rel="noopener" className="block p-4 rounded-lg bg-black/40 border border-[#00d1ff]/20 hover:border-[#00d1ff]/40 transition-all">
                <div className="text-[#00d1ff] text-sm font-bold">🔑 Test CA Keys →</div>
                <div className="text-zinc-500 text-xs mt-1">Ed25519 keypair (private key published for cross-language reproducibility)</div>
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

        {/* ═══ WHY UTA CAN BECOME A STANDARD ═══ */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }} className="premium-card p-6 md:p-8">
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
                  <p className="text-zinc-400 text-xs">Ed25519 (RFC 8032), RFC 8785 JCS, SHA-256. Not inventing new crypto — composing existing RFCs.</p>
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
                  <p className="text-zinc-400 text-xs">7 NPM packages, 2,339 monthly downloads, 97 Dev.to articles, independent security audit (14/14 findings fixed).</p>
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

        {/* ═══ ROADMAP ═══ */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }} className="premium-card p-6 md:p-8">
            <h2 className="text-white text-2xl font-bold mb-4">Roadmap</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {ROADMAP.map(phase => (
                <div key={phase.phase} className="p-4 rounded-lg bg-black/40 border" style={{ borderColor: phase.color + '20' }}>
                  <div className="text-sm font-bold mb-3" style={{ color: phase.color }}>
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

        {/* ═══ ADOPT ═══ */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }} className="premium-card p-6 md:p-8 text-center">
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
