# UTA Plugin Template

Copy this directory to create a new UTA adapter plugin.

## Quick Start

1. Copy this directory: `cp -r packages/plugin-template packages/my-adapter`
2. Update `package.json` with your package name and metadata
3. Edit `src/index.ts`:
   - Replace `MyFormatCredential` with your native credential structure
   - Replace `MyAdapter` class with your adapter implementation
   - (Optional) Add `'my-format'` to `NativeFormat` in `@marketnow/trust-core/types.ts`
4. Implement real cryptographic verification in `verifyMyFormatCredential()`
5. Build: `npm run build`
6. Test against real credentials

## What you get

- `MyAdapter` class implementing the `TrustAdapter` interface
- `issueMyFormatCredential()` — issues a signed credential
- `verifyMyFormatCredential()` — verifies a credential's Ed25519 signature
- Domain separation (`UTA-MY-FORMAT-CREDENTIAL`) — your signatures can't be
  replayed in other adapters' domains
- MIT license — unrestricted commercial use

## License

MIT — see [LICENSE](LICENSE). This allows you to:
- Use this template in commercial products (closed-source OK)
- Sub-license under different terms
- Distribute your plugin without open-sourcing it

(Note: `@marketnow/trust-core` itself uses AL-1.0 — commercial use requires
a separate license from AliceLabs. The MIT license here applies only to the
plugin you write using this template.)
