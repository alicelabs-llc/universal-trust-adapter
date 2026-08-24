# @marketnow/trust-adapter-template

**MIT-licensed template for building custom trust adapters that plug into the Universal Trust Adapter (UTA).**

## What this is

This is the **plugin template** that lets anyone write a custom trust adapter for UTA. The template is MIT-licensed, so you can:

- Copy it
- Modify it
- Publish your adapter as your own npm package
- Sell it commercially
- Use it in your product

The UTA engine itself is proprietary (AliceLabs Source-Available License v1.0). This template is MIT so the plugin ecosystem can grow without legal friction. See [docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md) for the full Open-Core model.

## Quick start

### 1. Copy the template

```bash
mkdir my-trust-adapter
cd my-trust-adapter
cp /path/to/trust-adapter-template.ts ./index.ts
cp /path/to/package.json ./
```

### 2. Customize

Edit `index.ts`:

- Rename `MyFormatAdapter` to your format name (e.g., `AcmeTrustAdapter`)
- Update `formatId` (e.g., `'acme-trust-v1'`)
- Implement the 5 methods:
  - `detect(payload)` — return true if payload matches your format
  - `fromNative(payload)` — parse your format into UTS
  - `toNative(uts)` — convert UTS back to your format
  - `verify(payload)` — validate the signature
  - `issue(input, keys)` — create a new signed credential

### 3. Test against UTS spec

```bash
npm install @marketnow/trust-core
# Write tests that verify round-trip: fromNative → toNative preserves data
```

### 4. Publish

```bash
npm version 1.0.0
npm publish --access public
```

Your adapter is now installable as `@your-org/trust-adapter-myformat`.

### 5. (Optional) Submit to UTA's built-in adapters

If your adapter is for a widely-used format (e.g., a new RFC), you can submit a PR to include it in UTA's built-in adapter set. Open an issue at https://github.com/eddyflores100-lang/universal-trust-adapter to discuss.

## Why this template is MIT (and the engine isn't)

UTA follows the **Open-Core** model used by Zapier, Stripe, and Docker:

- **Plugin template (MIT):** anyone can write adapters → grows the ecosystem → increases engine value
- **UTS spec (CC-BY-NC-ND):** anyone can read and implement against → spec is open → interoperability is real
- **Engine (proprietary AL-1.0):** the moat → commercial use requires license → AliceLabs monetizes

This template being MIT means every new adapter written makes UTA more valuable, but no one can fork the engine and compete.

## License

MIT — see [LICENSE-MIT](./LICENSE-MIT).

The scope of this MIT license is limited to this `template/` directory. Other parts of UTA use different licenses. See [docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md) for the full licensing model.

## Contact

- Plugin ecosystem: `plugins@alicelabs.site`
- Commercial licensing: `legal@alicelabs.site`
