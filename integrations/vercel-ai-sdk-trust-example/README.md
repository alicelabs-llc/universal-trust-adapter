# vercel-ai-sdk-uta-trust-example

Vercel AI SDK example implementing the pattern discussed in
[vercel/ai#20147](https://github.com/vercel/ai/issues/20147):
**tool call → `trustVerifier()` → UTA → ALLOW/DENY.**

No Vercel AI SDK core is modified. We only wrap the tool's `execute` with a
fail-closed trust check against the UTA endpoint.

## Flow

```
model picks tool
      │
      ▼
verifyWithUTA(trust-card + tool + params)   ── POST {UTA_VERIFY_URL}
      │                                     ── any error ⇒ DENY (fail-closed)
   ALLOW? ── no ──► return { blocked, reason }   (controlled refusal)
      │
     yes
      ▼
real tool action runs
```

## Files

| File | Purpose |
|---|---|
| `src/trustVerifier.ts` | UTA client — POSTs the credential, fail-closed on ANY error |
| `src/example.ts` | Vercel AI SDK `tool()` whose `execute` is trust-gated |

## Run

```bash
npm install ai zod tsx typescript
npx tsx src/example.ts
```

Environment:

| Var | Default | Meaning |
|---|---|---|
| `UTA_VERIFY_URL` | `https://www.marketnow.site/api/trust?action=verify` | UTA instance to verify against |
| `UTA_VERIFY_TIMEOUT` | `5000` | ms before the check aborts (=> DENY) |

## Why fail-closed

An agent that calls tools while UTA is unreachable should do NOTHING,
not everything. The verifier returns `DENY` on timeout, HTTP error, malformed
JSON, or missing verdict — the tool's real action never executes.

Status: **POC** (v0.1.0). APIs may change. Issues go in THIS repository.
