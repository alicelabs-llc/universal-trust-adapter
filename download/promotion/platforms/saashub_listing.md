<!-- Platform: saashub.com -->
<!-- Submission type: service listing -->

**Service name:** Universal Trust Adapter (UTA)

**URL:** https://github.com/alicelabs-llc/universal-trust-adapter

**Category:** API / Security / Developer Tools

**Short description:**
Credential verification layer for AI agents. 8 formats, 12-stage pipeline, 6.7k verifications/sec.

**Long description:**
Universal Trust Adapter (UTA) is an open-source credential verification layer for AI agents. It verifies credentials issued in 8 formats (ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Server Cards, X.509) through a 12-stage pipeline: PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION.

Use cases:
- Verify MCP server credentials before agent invokes
- Bridge credentials between ecosystems (e.g., JWT → W3C VC)
- Audit agent tool calls with cryptographic evidence

**Pricing:** Free / Open Source (Apache 2.0)
**API:** https://www.marketnow.site/api/trust
**NPM:** @marketnow/trust-core

**Alternatives:**
- OAuth 2.0
- SPIFFE
- Vault
