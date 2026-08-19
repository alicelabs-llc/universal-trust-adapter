# Contributing to MarketNow

First off, thank you for considering contributing to MarketNow. We're building the trust layer for AI agent commerce, and every contribution makes the ecosystem safer.

## Why contribute?

- **Real impact:** your code helps agents verify each other's identity and security
- **Open security:** the audit methodology is public — you can see exactly what each layer does
- **Credit:** every contributor is listed in the README and release notes
- **Mentorship:** we review PRs thoroughly and explain why changes are made

## Ways to contribute

### 🐛 Good first issues (beginner-friendly)

Look for issues labeled `good first issue` — these are small, well-defined tasks that don't require deep knowledge of the codebase:

- Write a verification example in a new language (Rust, Ruby, Java, etc.)
- Improve documentation or fix typos
- Add tests for existing functions
- Translate the /trust page to a new language

### 🔒 Security research

- Review our Sentinel audit pipeline and report gaps
- Submit MCP servers for auditing (we'll scan them for free)
- Propose new malware family signatures for L1.8
- Test our honeypot and WAF — try to bypass them (responsibly)

### 💻 Code contributions

- **Python:** write `marketnow-atc` Python package (ATC verification wrapper)
- **Go:** improve the Go verification example
- **Rust:** write a Rust ATC verification crate
- **JavaScript/TypeScript:** improve the MCP server, add new tools
- **Docker:** improve the gVisor sandbox configuration

### 📝 Content

- Write tutorials on how to use MarketNow with your favorite agent framework
- Translate articles to your language
- Create video demos

## How to submit code

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Run tests: `npm test` (or the relevant test command)
5. Commit with a clear message: `feat: add Rust ATC verification example`
6. Open a PR — describe what you changed and why

## What we look for in PRs

- **Security first:** if your code touches the audit pipeline, it must not weaken any existing check
- **Tests:** add tests for new functionality
- **Documentation:** update README/docs if your change affects the API
- **Honest:** if something is a mock/placeholder, say so in the code

## Communication

- **GitHub Issues:** for bugs, feature requests, and security findings
- **GitHub Discussions:** for questions, ideas, and community chat
- **Email:** support@alicelabs.site for private/security-sensitive matters

## Current priorities (July 2026)

| Priority | What | Skills needed |
|---|---|---|
| 🔴 High | Python `marketnow-atc` package | Python, requests library |
| 🔴 High | AutoGen integration | Python, AutoGen framework |
| 🟡 Medium | Rust ATC verification crate | Rust, crypto |
| 🟡 Medium | More malware family signatures (L1.8) | Security research, YARA |
| 🟡 Medium | L4 in-process monitoring design | eBPF, macOS Endpoint Security |
| 🟢 Low | Translations (German, Japanese, Korean) | Native speaker |
| 🟢 Low | Video demos | Any |

## Contributor hall of fame

- **@rushabdev** — pro bono peer review (11 findings, all fixed)
- **@mario-andreschak** — reported the prospector trojan (issue #9)
- **@Sravan1011** — AutoGen integration (in progress)

Want your name here? Open a PR.

## License

By contributing, you agree that your contributions will be licensed under the same terms as the repository (MIT for catalog, proprietary for Sentinel engine).

— *AliceLabs LLC*
