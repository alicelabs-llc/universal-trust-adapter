# cloudflare-agents-x402-trust

UTA trust verification for **Cloudflare Agents SDK + x402** payment flows.
**Fail-closed.**

The pattern: a buyer agent that *verifies before it pays*. On a `402` from a
paid resource, the agent resolves the seller's ATC/1.0 card, verifies it
against a UTA verifier — the verify call itself is x402-paid — and only
settles if the seller's trust band meets policy. Any verification failure
aborts before money moves.

```
Agent (buyer)                    Seller                       UTA verifier
     │ 1. GET paid ───────────────►│
     │◄────────────── 402 + accepts
     │ 2. GET agent-card.json ────►│
     │◄────────────── ATC card
     │ 3. POST /v1/trust/verify ─────────────────────────────►│
     │◄─ verdict { verified, band, verdict_id } (x402-paid) ──│
     │ 4. band >= MIN_TRUST_BAND ?                            │
     │      no  → ABORT (fail-closed, no payment built)       │
     │      yes → 5. settle x402 payment ─►│
     │◄────────────── 200 + receipt
```

## Full runnable example

The complete, convention-compliant example (full-stack: React UI + `TrustAgent
extends Agent` with `@callable`, Cloudflare Vite plugin, `wrangler.jsonc`) is
maintained as a drop-in `examples/x402-agent-trust/` directory for the
[cloudflare/agents](https://github.com/cloudflare/agents) repository:

> **https://github.com/eddyflores100-lang/agents/tree/x402-agent-trust-example/examples/x402-agent-trust**

Status: submitted upstream; the PR is kept on the fork because
cloudflare/agents currently restricts new-contributor interactions (API
returns 404/FORBIDDEN on issue/PR creation from this account — reads and
forking are unaffected). The branch rebases cleanly on upstream/main.

## Core function (drop-in, ~40 lines)

```typescript
const BAND_RANK: Record<string, number> = { B0: 0, B1: 1, B2: 2, B3: 3, A1: 4 };

async function verifySellerTrust(
  payingFetch: ReturnType<typeof wrapFetchWithPayment>,
  card: unknown,
  minBand: string
) {
  let res: Response;
  try {
    res = await payingFetch(UTA_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ card })
    } as RequestInit);
  } catch (e) {
    return { allow: false, reason: `verifier unreachable (${(e as Error).message})` };
  }
  let verdict: Record<string, unknown>;
  try {
    verdict = (await res.json()) as Record<string, unknown>;
  } catch {
    return { allow: false, reason: `verifier returned non-JSON (HTTP ${res.status})` };
  }
  if (!res.ok) return { allow: false, reason: `verifier HTTP ${res.status}` };

  const verified = (verdict.verified ?? verdict.valid) as boolean | undefined;
  const band = (verdict.band ?? (verdict.risk as any)?.band ?? null) as string | null;
  const verdictId = (verdict.verdict_id ?? null) as string | null;

  if (verified === false) return { allow: false, reason: "card did not verify", verdict_id: verdictId ?? undefined };
  if (band === null) return { allow: false, reason: "missing trust band in verdict" };
  if ((BAND_RANK[band] ?? -1) < (BAND_RANK[minBand] ?? 99))
    return { allow: false, reason: `band ${band} below policy minimum ${minBand}` };
  return { allow: true, band, verdict_id: verdictId ?? undefined };
}
```

Buyer flow wiring (same x402 primitives as the official `x402/` example):

```typescript
const client = new x402Client();
registerClientEvmScheme(client, { signer: toClientEvmSigner(account) });
const fetchWithPay = wrapFetchWithPayment(fetch, client);

// 1. probe — expect 402
const probe = await fetch(paidUrl);
// 2. resolve seller card
const card = await (await fetch(new URL("/agent-card.json", paidUrl))).json();
// 3. VERIFY before spend (x402-paid, fail-closed)
const verdict = await verifySellerTrust(fetchWithPay, card, "B1");
if (!verdict.allow) return abort(verdict.reason);          // no payment built
// 4. settle
const paid = await fetchWithPay(paidUrl, {});
```

## What is fail-closed here

- Verifier unreachable / throws → **deny**
- Verifier HTTP error → **deny**
- Verifier non-JSON → **deny**
- Verdict without a trust band while policy requires one → **deny** (never guess)
- Band below `MIN_TRUST_BAND` → **deny** with reason + `verdict_id` recorded

**No spend is ever honored because verification was unavailable.**

## Config

| Env | Default | Meaning |
|---|---|---|
| `UTA_VERIFY_URL` | `https://uta-trust-api.eddyflores100.workers.dev/v1/trust/verify` | verifier endpoint (x402-native, quotes Base mainnet + base-sepolia) |
| `MIN_TRUST_BAND` | `B1` | minimum accepted band (`B0` < `B1` < `B2` < `B3` < `A1`) |
| `CLIENT_TEST_PK` | — | buyer's test wallet (faucet: faucet.circle.com) |
| `SERVER_ADDRESS` | — | payTo for the demo paid route |

Status: **POC**. APIs may change. Issues go in THIS repository.
