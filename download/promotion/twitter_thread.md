<!-- NAMING: UTA v1.0.0 = Universal Trust Adapter. ATC is one of 8 adapters. -->

**Thread (10 tweets):**

1/ Built UTA v1.0.0 — Universal Trust Adapter for AI agents.

USB-C for agent trust. One canonical schema (UTS v2.0.0), 8 format adapters. 12-stage verification pipeline. Ed25519 + RFC 8785 JCS.

Published: 7 NPM packages, 2,339 monthly downloads. 41 test vectors. 23/23 conformance tests pass.

2/ The 8 formats UTA translates between:

- ATC (Agent Trust Card)
- EAT-AI (IETF RFC 9421)
- ZTA (Anthropic)
- A2A (Google/AAIF)
- MCP Card (Anthropic)
- W3C Verifiable Credentials
- OAuth/OIDC
- SPIFFE SVID

3/ The 12-stage fail-closed verification pipeline:

1. Identity 2. Attestation 3. Capabilities 4. Evidence 5. Risk
6. Ed25519 signature (RFC 8785 JCS) 7. Revocation 8. Expiration
9. Proof-of-Possession 10. TrustRegistry 11. Action receipt 12. SBOM

4/ Independent security audit: 14 findings identified. 14/14 fixed.

Critical: SEO cloaking eliminated, pricing contradictions resolved.
High: Test vectors published, NPM packages verified.
Medium: Wallet governance documented, Sentinel version consolidated.

Full audit at: marketnow.site/trust/audit-status.json

5/ 5 independent download channels:

- NPM Registry
- jsDelivr CDN
- unpkg CDN
- marketnow.site (owned origin)
- GitHub org (alicelabs-llc)

All serve byte-identical tarballs. SHA-256 verified.

curl -fsSL https://marketnow.site/install.sh | bash

6/ Test CA private key intentionally published.

Why? Any Python/Go/Rust verifier can re-derive the signatures from scratch and confirm the crypto works as claimed. No "trust me" — verify it yourself.

marketnow.site/uta/docs/atc-spec/test-vectors/_test-ca-keys.json

7/ Conformance suite: 23/23 tests pass.

git clone https://github.com/alicelabs-llc/universal-trust-adapter
cd marketnow/atc-sdk && npm install
node test/conformance.mjs

8/ What's next:
- Multi-sig for high-value agents (N-of-M CA signatures)
- Runtime tool-catalog pinning (catch tool-description-poisoning)
- Behavior-based detection layer (post-exec filter)
- Cross-language SDKs (Python, Go, Rust)

9/ Install:

npm install agent-trust-card@1.1.2
npx -y marketnow-mcp@1.10.1
curl -fsSL https://marketnow.site/install.sh | bash

Works with Claude Desktop, Cursor, Cline, Continue, Aider.

10/ Repo: https://github.com/alicelabs-llc/universal-trust-adapter
Spec: marketnow.site/uta/docs/atc-spec/SPEC.md
Test vectors: marketnow.site/uta/docs/atc-spec/test-vectors/
Audit: marketnow.site/trust/audit-status.json

If you're building AI agent infrastructure, run your independent verifier against the test vectors.

#AIAgents #OpenSource #Security #Cryptography #MCP #UTA
