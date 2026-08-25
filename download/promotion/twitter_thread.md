<!-- NAMING CORRECTION:
  - Project name: UTA v1.0.0 (Universal Trust Adapter)
  - ATC (Agent Trust Card) is ONE of 8 adapter formats UTA supports
  - Canonical schema: UTS v2.0.0 (Universal Trust Schema)
  - 8 formats UTA translates: ATC, EAT-AI, ZTA, A2A, MCP Card, W3C VC, OAuth, SPIFFE
-->

**Thread (10 tweets):**

1/ I built **UTA v1.0.0 (Universal Trust Adapter)** — an open-source spec that translates between 8 trust credential formats used by AI agents.

USB-C for agent trust. One canonical schema (UTS v2.0.0), 8 adapters.

After 2 months and 96 technical articles, here's what shipped:

2/ The 8 formats UTA translates between:

- ATC (Agent Trust Card)
- EAT-AI (IETF)
- ZTA (Anthropic)
- A2A (Google/AAIF)
- MCP Card (Anthropic)
- W3C Verifiable Credentials
- OAuth/OIDC
- SPIFFE SVID

3/ The 12-stage fail-closed verification pipeline:

1. Identity
2. Attestation
3. Capabilities
4. Evidence
5. Risk
6. Ed25519 signature (over RFC 8785 JCS)
7. Revocation
8. Expiration
9. Proof-of-Possession (nonce challenge)
10. TrustRegistry key binding
11. Action receipt signature
12. Supply-chain SBOM

4/ The test CA private key is intentionally published.

Why? So any Python/Go/Rust verifier can re-derive the signatures from scratch and confirm the crypto works as claimed. No "trust me" — verify it yourself.

5/ Distribution is the hard part.

After GitHub flagged my account (still unresolved after 2 weeks), all 55 of my repos returned HTTP 404 to anonymous visitors.

Built 5 independent download channels:
- NPM Registry
- jsDelivr CDN
- unpkg CDN
- marketnow.site (owned origin)
- GitHub org

6/ All 5 channels serve byte-identical tarballs. SHA-256 verified.

If any one is blocked, the other 4 continue working.

```bash
curl -fsSL https://marketnow.site/install.sh | bash
```

7/ The most useful technical critique came from @anp2network on dev.to.

They wrote an independent Python verifier, found that my canonicalization function was actually a replacer allowlist — not a sorter. Nested keys like `trust.sentinel_score` were getting dropped from the signature preimage entirely.

8/ That bug is now fixed and there's a test vector (`tampered-payload.json`) specifically designed to catch that class of issue. The nested-object bug → SHA-256 mismatch → verification failure.

Public bytes: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/marketnow/docs/atc-spec/test-vectors

9/ What's next:
- Multi-sig for high-value agents (N-of-M CA signatures)
- Runtime tool-catalog pinning (catch tool-description-poisoning)
- Behavior-based detection layer (post-exec filter)
- Cross-language SDKs (Python, Go, Rust)
- More test vectors covering edge cases

10/ Repo: https://github.com/alicelabs-llc/universal-trust-adapter
NPM: marketnow-mcp (958/mo), agent-trust-card (518/mo)

If you're building AI agent infrastructure, message me. Looking for collaborators, integrators, and reviewers.

#AIAgents #OpenSource #Security #Cryptography #MCP #UTA
