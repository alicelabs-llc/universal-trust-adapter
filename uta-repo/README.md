# Universal Trust Adapter (UTA)

> **MCP lets agents use tools. A2A lets agents talk to agents. UTA lets the ecosystem understand and exchange trust.**

UTA normalizes heterogeneous agent identity, capability, authorization and attestation signals into a common trust representation. It translates between ALL trust credential formats via a canonical Universal Trust Schema (UTS).

Like Zapier connects applications, **UTA connects trust standards**.

Built by **Edison Flores** & **Alejandro Flores** at **AliceLabs LLC** (Wyoming, USA).

---

## The problem

In August 2026, there are multiple competing trust/identity/attestation formats for AI agents:

| Format | Type | Owner | Crypto |
|--------|------|-------|--------|
| ATC v1.0 | Trust credential | AliceLabs | Ed25519 |
| EAT-AI | Attestation | IETF | CWT/CBOR |
| ZTA | Trust credential | Anthropic | JSON |
| A2A Agent Card | Capability/identity metadata | Google / AAIF | JSON-LD |
| MCP Server Card | Server metadata | Anthropic | JSON (no signature) |
| W3C VC | Credential model | W3C | Ed25519Signature2020 |
| OAuth/OIDC | Identity/authorization | IETF | JWT (RS256) |
| SPIFFE SVID | Workload identity | CNCF | X.509 / JWT |

**None of them interoperate.** An agent with ATC can't verify an agent with ZTA. An A2A agent can't trust an MCP Server.

## The solution

**Universal Trust Schema (UTS)** — a canonical internal representation. Like Unicode for text, UTS is the universal intermediate that all formats translate through.

```
ATC ──→ ┌──────────────┐ ──→ EAT-AI
        │              │
ZTA ──→ │  UTA Engine  │ ──→ A2A Card
        │  (via UTS)   │
MCP ──→ └──────────────┘ ──→ ATC v1.0
```

**O(N) adapter complexity** — add 1 adapter, get N-1 translations free. Like i18n for trust.

## Implementation status (honest)

### ✅ Implemented (5 formats, 20 translation pairs)

| Format | Schema | Detection | Translation | Crypto verification |
|--------|--------|-----------|-------------|-------------------|
| ATC v2.0 | ✅ | ✅ | ✅ | ✅ Ed25519 real |
| EAT-AI | ✅ | ✅ | ✅ | ⚠️ Schema only (CWT decode pending) |
| ZTA | ✅ | ✅ | ✅ | ⚠️ Schema only (Anthropic signature TBD) |
| A2A Card | ✅ | ✅ | ✅ | ✅ N/A (no crypto in spec) |
| MCP Card | ✅ | ✅ | ✅ | ✅ N/A (no crypto in spec) |

### ❌ Planned (3 formats)

- W3C VC (Q4 2026)
- OAuth/OIDC (Q4 2026)
- SPIFFE SVID (Q4 2026)

### Architecture features

| Feature | Status |
|---------|--------|
| Auto-detection | ✅ Live |
| Lossless translation (format.raw) | ✅ Live |
| Attestation chaining (bridge) | ✅ Live |
| Policy enforcement | ✅ Live |
| Offline <50ms | ✅ Live |
| Cryptographic issuance | ⚠️ ATC only |

## Competitive positioning

UTA does NOT compete with:

| Competitor | What they do | Our relationship |
|-----------|-------------|-----------------|
| **Arcade** ($60M Series A) | Agent authorization runtime | Complement — runtime vs protocol |
| **Obsidian** ($85M Series D) | Enterprise agent security | Complement — console vs protocol |
| **UTCP** | Tool calling protocol | Complement — HOW vs WHETHER |
| **W3C AIRP** | Agent identity standard | Complement — identity vs translation |
| **MCP** (Anthropic) | Tool protocol | Foundation — we audit MCP servers |
| **A2A** (Google/AAIF) | Agent protocol | Foundation — we translate A2A cards |

**Nobody else translates between trust formats.** That's the gap.

## 3-Layer licensing

| Layer | License | Why |
|-------|---------|-----|
| UTS Specification | CC-BY 4.0 (open) | Anyone can read and implement |
| UTA Reference SDK | Apache 2.0 (open source) | Anyone can fork and use |
| MarketNow Trust Cloud | MNNC-1.0 (proprietary) | The commercial SaaS product |

## Try it now

```bash
# Verify any credential (auto-detect)
curl -X POST https://universal-trust-adapter.vercel.app/api/trust?action=verify \
  -H "Content-Type: application/json" \
  -d '{"payload": {...any credential...}}'

# Translate ATC → ZTA (lossless)
curl -X POST https://universal-trust-adapter.vercel.app/api/trust?action=translate \
  -H "Content-Type: application/json" \
  -d '{"to":"zta","payload":{...ATC card...}}'

# Bridge: verify ZTA, issue ATC with attestation chain
curl -X POST https://universal-trust-adapter.vercel.app/api/trust?action=bridge \
  -H "Content-Type: application/json" \
  -d '{"verifyIn":"zta","issueAs":"atc-v2","policy":{"min_trust_score":7},"payload":{...ZTA...}}'
```

## Test vectors

10 official conformance test vectors at `/spec/test-vectors/`:
- Valid/invalid ATC cards
- Valid ZTA, A2A, MCP credentials
- ATC→UTS and UTS→ZTA expected outputs

Any implementation that passes all 10 vectors is UTA-conformant.

## Links

- **Live API**: https://universal-trust-adapter.vercel.app/api/trust
- **Also on MarketNow**: https://marketnow.site/api/trust
- **UTS Schema**: https://universal-trust-adapter.vercel.app/spec/UTS-v1.0.json
- **Test vectors**: https://universal-trust-adapter.vercel.app/spec/test-vectors/MANIFEST.json
- **GitHub**: https://github.com/eddyflores100-lang/universal-trust-adapter

## License

- UTS specification: CC-BY 4.0
- UTA SDK: Apache 2.0
- MarketNow Trust Cloud: MNNC-1.0 (AliceLabs proprietary)

See [LICENSE](./LICENSE) and [STRATEGIC_POSITIONING.md](./STRATEGIC_POSITIONING.md) for details.
