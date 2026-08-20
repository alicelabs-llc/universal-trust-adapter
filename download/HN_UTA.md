# Hacker News — Show HN

**Title**: Show HN: Universal Trust Adapter – One API that translates between all AI agent trust formats

**Body**:

I built a universal translator for AI agent trust credentials.

The problem: there are 5 competing trust standards (ATC, EAT-AI, ZTA, A2A, MCP) and none of them interoperate. Companies have to implement 5 separate integrations.

The solution: Universal Trust Schema (UTS) — a canonical internal representation. Every format translates to UTS, and UTS translates to any format. O(N) adapter complexity, not O(N²).

Live demo: https://universal-trust-adapter.vercel.app/api/trust

Try it:
```
curl -X POST https://universal-trust-adapter.vercel.app/api/trust?action=translate \
  -H "Content-Type: application/json" \
  -d '{"to":"zta","payload":{...any ATC card...}}'
```

5 adapters implemented (ATC stable, EAT-AI/ZTA/A2A/MCP beta). 3 more planned (W3C VC, OAuth, SPIFFE).

Design decisions:
1. Lossless — original payload preserved in format.raw
2. Attestation chaining — bridge operations record original signature hash
3. Offline <50ms — pure JS, no dependencies

GitHub: https://github.com/eddyflores100-lang/universal-trust-adapter

Built by AliceLabs LLC. Core engine is proprietary (MNNC-1.0), plugin template is MIT.
