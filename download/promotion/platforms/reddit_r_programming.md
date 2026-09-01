<!-- Target: r/programming -->
<!-- Post type: text post -->

**Title:** Built a 12-stage credential verification pipeline for AI agents — supports 8 formats (JWT, W3C VC, X.509, MCP, ATC, A2A, EAT-AI, ZTA)

**Body:**

Hey r/programming —

I open-sourced a credential verification layer for AI agents: **Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

The problem: when an agent invokes a tool, there's no canonical way to verify *who issued the credential* for that tool. Each standard (OAuth/JWT, X.509, W3C VC, MCP Cards, etc.) answers the question differently, and agents don't know which standard to use.

UTA unifies them:
- 8 credential formats supported
- 12-stage pipeline (parser → detect → schema → crypto → issuer → key_binding → pop → provenance → lifecycle → evidence → policy → decision)
- 6,744 verifications/sec on a single core
- 480+ tests, 23 property tests
- 15-language snippet collection (Node.js, Python, Rust, Go, Ruby, PHP, Java, C#, Elixir, Swift, Kotlin, Lua, Deno, Bash)
- 7 multilingual READMEs (EN, ES, PT, FR, DE, JA, ZH, RU)

Public API: https://www.marketnow.site/api/trust

I'm not claiming UTA is the right design — I'm asking the community whether the 12-stage decomposition makes sense, and whether 8 formats is the right scope.

Repo: https://github.com/alicelabs-llc/universal-trust-adapter

Curious what HN/Reddit thinks.
