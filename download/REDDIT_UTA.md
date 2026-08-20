# Reddit Post — r/AI_Agents or r/MCP

**Title**: I built a universal translator for AI agent trust credentials — 5 formats, 1 API, zero lock-in

**Body**:

In August 2026, there are 5 competing trust credential formats for AI agents:
- ATC (AliceLabs) — Ed25519
- EAT-AI (IETF) — CWT/CBOR
- ZTA (Anthropic) — JSON
- A2A Agent Card (Google/AAIF) — JSON-LD
- MCP Server Card (Anthropic) — JSON (no signature)

None of them speak to each other. I built the Universal Trust Adapter (UTA) — the USB-C of agent trust.

It translates between ALL formats via a canonical Universal Trust Schema (UTS). Like Unicode for text — every format translates to UTS, and UTS translates to any format.

**Live now**: https://universal-trust-adapter.vercel.app/api/trust

**What it does**:
- Auto-detect any credential format
- Translate losslessly between any pair (ATC↔ZTA, EAT-AI↔A2A, etc.)
- Bridge: verify in one ecosystem, issue in another with attestation chaining
- Offline, <50ms, pure JavaScript

**Architecture**: O(N) adapter complexity — add 1 adapter, get N-1 translations free. Like i18n for trust.

**GitHub**: https://github.com/eddyflores100-lang/universal-trust-adapter

Built by AliceLabs LLC (Wyoming, USA). MNNC-1.0 licensed (core engine proprietary, plugin template MIT).
