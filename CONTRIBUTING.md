# Contributing to Universal Trust Adapter (UTA)

First off: **thank you** for considering contributing. UTA is small (2-person team) and the project's survival depends on contributors like you.

## Code of Conduct

By participating, you agree to uphold the [Code of Conduct](./CODE_OF_CONDUCT.md). TL;DR: be respectful, be technical, no harassment.

## How can I contribute?

### Reporting bugs

Open a [GitHub Issue](https://github.com/alicelabs-llc/universal-trust-adapter/issues/new?labels=bug&template=bug-report.md). Include:
- UTA / ATC / package version
- Node / Python / Rust version
- Reproduction steps
- Expected vs actual behavior

### Suggesting enhancements

Open a [GitHub Issue](https://github.com/alicelabs-llc/universal-trust-adapter/issues/new?labels=enhancement&template=feature-request.md). Be specific: what problem does it solve, who has this problem, what's the alternative today.

### Writing code

Pick an issue labeled [`good first issue`](https://github.com/alicelabs-llc/universal-trust-adapter/labels/good%20first%20issue) or [`help wanted`](https://github.com/alicelabs-llc/universal-trust-adapter/labels/help%20wanted). Comment on the issue so we know you're working on it.

### Improving docs

Docs live in `uta-monorepo/packages/docs/` and `uta-monorepo/packages/uts/`. PRs welcome — typos, clarifications, missing examples, translations.

### Adding a new adapter

If you want to add support for a new credential format (e.g. "OpenAI Trust Token", "Custom ZTA variant"):

1. Read `uta-monorepo/specs/RFC-ATC-v3-Draft-00.md` — understand UTS (Universal Trust Schema) as the IR
2. Read `uta-monorepo/packages/adapters/atc-adapter.ts` as the reference adapter
3. Implement `fromNative(payload) → UTS` and `toNative(UTS) → payload`
4. Add tests: at minimum 1 positive + 1 negative + 1 mutation test vector
5. Add your adapter to `uta-monorepo/packages/adapters/index.ts`
6. Open a PR

## Development setup

### Prerequisites

- Node.js 20+
- Python 3.11+ (for the Python SDK tests)
- Rust 1.75+ (for the Rust SDK tests, optional)
- Go 1.22+ (for the Go SDK tests, optional)

### Clone and install

```bash
git clone https://github.com/alicelabs-llc/universal-trust-adapter
cd universal-trust-adapter/uta-monorepo
npm install
npm run build
```

### Run tests

```bash
# Node.js conformance tests
node tests/test.mjs

# Python SDK tests
cd packages/uta-python && python -m pytest

# Rust SDK tests
cd packages/uta-rust && cargo test

# Cross-language integration
npm run test:cross-lang
```

### Run the local server

```bash
npm run dev
# Visit http://localhost:8787/api/trust
```

## Coding standards

### TypeScript / JavaScript

- **Style**: 2-space indent, single quotes, semicolons required
- **Linter**: ESLint (config in `uta-monorepo/eslint.config.js`)
- **Types**: Strict mode (`strict: true` in tsconfig). No `any` unless absolutely necessary.
- **Naming**: camelCase for vars/functions, PascalCase for types/interfaces, UPPER_SNAKE for constants
- **Tests**: Every new feature must have tests. We use `node:test` for Node.js.

### Python

- **Style**: PEP 8 + Black formatting
- **Linter**: `ruff` (replaces flake8 + isort)
- **Types**: Use type hints everywhere
- **Tests**: pytest

### Rust

- **Style**: `rustfmt` default + `clippy` clean
- **Tests**: `#[test]` + `#[cfg(test)]`

### Go

- **Style**: `gofmt` + `golangci-lint`

## Commit message convention

We follow a simplified Conventional Commits:

```
<type>(<scope>): <subject>

<body>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (no functional change)
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Adding tests
- `chore`: Maintenance (deps, configs, etc.)
- `ci`: CI changes
- `security`: Security fix

**Scopes:** `atc`, `uts`, `adapters`, `gateway`, `mcp`, `python`, `rust`, `go`, `cli`, `docs`, `core`

**Examples:**
```
feat(adapters): add W3C VC adapter with Ed25519Signature2020 proof
fix(core): handle expired credentials in 12-stage pipeline
docs(uts): clarify evidence_chain semantics
security(atc): add CRL-based revocation check
```

## Pull request process

1. **Fork** the repo (or use the existing fork at `eddyflores100-lang/universal-trust-adapter-1` if you have access)
2. **Branch** from `main`: `git checkout -b feat/my-feature`
3. **Commit** with conventional commit messages
4. **Test** locally: `npm test` (or appropriate language)
5. **Push** to your fork
6. **Open a PR** to `alicelabs-llc/universal-trust-adapter:main`
7. **Describe** what the PR does, why, and link to the issue

### PR review criteria

- ✅ Tests pass (CI will run automatically once we have it set up — for now, run manually)
- ✅ Code follows style standards
- ✅ Commit messages follow convention
- ✅ No new dependencies without justification
- ✅ No secrets, tokens, or environment files committed
- ✅ Documentation updated if behavior changes
- ✅ Breaking changes called out in PR description

### What we won't accept

- **Closed-source dependencies** — keep the dependency tree open
- **Crypto inventions** — use established primitives (Ed25519, ECDSA, AES-GCM, etc.)
- **Self-promotion** — PRs that exist to add a link or marketing copy will be closed
- **Tracked files we just removed** (`.env`, `.vercel-token`, etc.) — they're in `.gitignore` for a reason

## Release process

Maintainers only:

1. Update `CHANGELOG.md` with all PRs since last release
2. Bump version in `package.json` (semver)
3. Tag: `git tag v1.x.y && git push --tags`
4. GitHub Release created from tag
5. npm publish with `--provenance` (Sigstore attestation)
6. SBOM regenerated and attached to release

## License

By contributing, you agree that your contributions will be licensed under the [AL-1.0 License](./LICENSE-AL-1.0).

## Questions?

- **GitHub Discussions:** https://github.com/alicelabs-llc/universal-trust-adapter/discussions
- **Email:** info@alicelabs.site
- **Dev.to:** [@edison_flores_6d2cd381b13](https://dev.to/edison_flores_6d2cd381b13)

---

Last updated: 2026-08-27
