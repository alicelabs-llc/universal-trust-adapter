# UTA Code Snippets

Self-contained examples showing how to verify AI agent credentials via the
[Universal Trust Adapter (UTA)](https://github.com/alicelabs-llc/universal-trust-adapter)
in 15+ programming languages.

## Languages

| Language | File | Run command |
|----------|------|-------------|
| Node.js | `nodejs/verify-credential.mjs` | `node verify-credential.mjs` |
| Python | `python/verify_mcp_card.py` | `python3 verify_mcp_card.py` |
| Bash | `bash/verify.sh` | `./verify.sh <card>` |
| Rust | `rust/main.rs` | `cargo run -- <card>` |
| Go | `go/main.go` | `go run main.go <card>` |
| Ruby | `ruby/verify.rb` | `ruby verify.rb <card>` |
| PHP | `php/verify.php` | `php verify.php <card>` |
| Java | `java/Verify.java` | `java Verify <card>` |
| C# | `csharp/Program.cs` | `dotnet run -- <card>` |
| Elixir | `elixir/verify.exs` | `elixir verify.exs <card>` |
| Swift | `swift/verify.swift` | `swift verify.swift <card>` |
| Kotlin | `kotlin/Verify.kt` | `kotlinc Verify.kt -include-runtime -d verify.jar && java -jar verify.jar <card>` |
| Lua | `lua/verify.lua` | `lua verify.lua <card>` |
| Deno | `deno/verify.ts` | `deno run --allow-net verify.ts <card>` |

## All examples use the public API

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \
  -H "Content-Type: application/json" \
  -d '{"card": "<your-credential>"}'
```

## What UTA verifies

UTA supports **8 credential formats**:

1. ATC v3 (Agent Trust Card)
2. JWT (with `x5c` chain)
3. W3C Verifiable Credentials
4. A2A (Agent-to-Agent) cards
5. EAT-AI (Entity Attestation Tokens)
6. ZTA (Zero Trust Agent) cards
7. MCP Server Cards
8. X.509 certificates

Each credential goes through a **12-stage pipeline**:
`PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION`

## Links

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
- NPM: `@marketnow/trust-core`
