<!-- Platform: indiehackers.com -->
<!-- Post type: community post -->
<!-- Audience: indie founders, solo devs -->

# I open-sourced a credential verification layer for AI agents. AMA.

Hey IH —

Solo dev here. Just open-sourced a project I've been working on for 3 months: **Universal Trust Adapter (UTA)**.

## The pitch

When AI agents invoke tools (MCP servers, APIs), there's no canonical way to verify *who issued the credential* for that tool. UTA fixes this by verifying credentials in 8 formats through a 12-stage pipeline.

## The numbers

- 6,744 verifications/sec (single core)
- 480+ tests, 23 property tests
- 15-language snippet collection
- 7 multilingual READMEs
- Public API: https://www.marketnow.site/api/trust
- Repo: https://github.com/alicelabs-llc/universal-trust-adapter

## Business model

- Open-source core (Apache 2.0) — free forever
- Hosted API with rate limits — free tier
- Enterprise self-hosted — paid
- Conformance certification — paid (future)

## What I'd love feedback on

1. Does the open-source-as-distribution thesis hold for developer tools?
2. Should I pursue a YC application, or stay indie?
3. Anyone here built AI agent fleets in production? What's your credential verification story?

Repo: https://github.com/alicelabs-llc/universal-trust-adapter
