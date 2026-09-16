# ATC/1.4 — WITHDRAWN (re-versioned as ATC/3.0-core)

**Status**: Superseded same day (2026-09-17)

ATC/1.4 was an interim label for the unified verification profile of the production
envelope. It is **the same envelope and the same crypto** — but numbering a unified
profile *below* the already-published ATC v3.0 RFC draft (multi-format cryptographic
profile, 2026-08-20, implemented in `atc-sdk/src/v3` and served by `/api/trust` as
stable) added a version label instead of removing one.

It has been re-versioned as **ATC/3.0-core**:

- **Current spec**: [SPEC-3.0-UVP.md](./SPEC-3.0-UVP.md)
- **Current schema**: [atc-3.0.json](./atc-3.0.json)
- **Live endpoint**: `GET /api/atc?action=spec`

Nothing about the wire format, the verification algorithm, or the security properties
changed between the 1.4 label and ATC/3.0-core. The 57 production ledger cards conform
as-is. npm packages that reported `spec_version: "ATC/1.4"` (marketnow-mcp 1.12.0,
agent-trust-card 1.2.0) verify identically; from marketnow-mcp 1.13.0 and
agent-trust-card 1.3.0 the reported spec version is `ATC/3.0`.
