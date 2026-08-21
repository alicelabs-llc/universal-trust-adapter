# Contributing to UTA

## Development Setup

```bash
git clone https://github.com/eddyflores100-lang/universal-trust-adapter.git
cd universal-trust-adapter
npm install
npm test
```

## Running Tests

```bash
# All Node.js tests
npm test

# Individual suites
npm run test:structural
npm run test:vectors
npm run test:integration
npm run test:gateway
npm run test:multisig
npm run test:a2a-eat
npm run test:ocsp-zta-mcp
npm run test:cli
npm run test:server
npm run test:pq
npm run test:mcp-mw
npm run test:webhooks

# Python SDK tests
cd packages/uta-python && python -m pytest tests/ -v

# Fuzzing (400 iterations)
node packages/conformance/run-fuzz.js

# Property-based tests
node packages/conformance/run-property-tests.js

# Benchmarks
npm run bench

# TypeDoc
npm run docs
```

## Code Style

- TypeScript strict mode (no implicit any)
- Use `const` and `let` — never `var`
- Prefer `interface` over `type` for object shapes
- All public functions must have JSDoc comments
- No stubs or TODOs in production code

## Adding a New Adapter

1. Copy `packages/plugin-template/` to `packages/my-adapter/`
2. Implement the `TrustAdapter` interface
3. Use a unique domain for signature separation (e.g., `UTA-MY-FORMAT-CREDENTIAL`)
4. Add test vectors to `vectors/`
5. Write integration tests in `packages/conformance/run-my-adapter-integration.js`
6. Update README status table

## License

- Core packages: AL-1.0 (source-available, commercial requires license)
- Plugin template: MIT
- Specs (UTS, ATC RFC): CC-BY-NC-ND 4.0
- Vectors, threat model: CC-BY-4.0
