# Alchemy RPC Setup Guide

This guide walks you through configuring **Alchemy** as the dedicated Base RPC
provider for MarketNow. This replaces our reliance on public Base RPCs
(`mainnet.base.org`, `base.gateway.tenderly.co`, etc.) which have no SLA and
rate-limit aggressively (~100 req/5min per IP, undocumented).

## Why Alchemy?

| | Public RPCs (legacy) | Alchemy (new) |
|---|---|---|
| **Rate limit** | ~100 req/5min per IP (undocumented, shared) | 300M compute units/month (per app) |
| **SLA** | None | 99.9% uptime SLA |
| **Latency p50** | 80–250ms (varies wildly) | 30–60ms (geo-distributed edge) |
| **Latency p99** | frequently >5s (timeout) | <200ms |
| **429s on traffic spikes** | Yes — saturated by 100 concurrent users | No — 300M CU is enough for ~10M+ verify calls/month |
| **Cost** | Free | Free tier covers MarketNow fully |
| **Webhook / Notify** | No | Yes (Alchemy Notify — pending tx, address activity) |
| **Archive data** | No | Yes (full history for receipt verification) |

**TL;DR:** Switching to Alchemy eliminates the 429 errors we see during traffic
spikes (when an agent retries a `/api/agent-purchase` 5 times in a row, we
currently do 5 RPC calls per attempt, exhausting the per-IP rate limit for the
next 5 minutes). With Alchemy, that's 5 calls out of 300M/month.

## Setup steps

### 1. Create an Alchemy account (free)

Go to **https://www.alchemy.com/** and sign up. No credit card required for
the free tier.

### 2. Create a new app on Base mainnet

1. From the Alchemy dashboard, click **Create App**.
2. Name it `marketnow` (or any name — this is just for your own bookkeeping).
3. **Chain**: Ethereum → **Network**: Base Mainnet (chain ID 8453).
4. Click **Create App**.

The dashboard will show you an API key like `ab12cd34ef56...`. This is your
`ALCHEMY_API_KEY`.

> **Note:** Make sure you select **Base Mainnet**, not Ethereum Mainnet. The
> chain ID for Base is `8453`. If you accidentally pick Ethereum Mainnet
> (chain ID 1), your `eth_getTransactionReceipt` calls will return `null`
> for all Base transactions.

### 3. Add the API key to your environment

#### Local development

Create or update `.env.local` in the `aep-marketplace/` directory:

```bash
# .env.local
ALCHEMY_API_KEY=ab12cd34ef56...
# Optional overrides (defaults shown):
# ALCHEMY_NETWORK=base-mainnet
# ALCHEMY_APP_NAME=marketnow
# RPC_TIMEOUT_MS=5000
# CIRCUIT_FAILURE_THRESHOLD=3
# CIRCUIT_OPEN_MS=30000
```

#### Vercel (production)

1. Go to **https://vercel.com/alicelabs-llc/marketnow/settings/environment-variables**
2. Click **Add New**.
3. **Key**: `ALCHEMY_API_KEY`
4. **Value**: paste your API key.
5. **Environment**: select **Production** (and **Preview** if you want Alchemy
   to work on preview deployments too).
6. Click **Save**.
7. **Redeploy** — environment variable changes only take effect on the next
   deployment.

#### Cloudflare Pages (mirror)

Add the same variable to your Cloudflare Pages project:

```bash
wrangler pages secret put ALCHEMY_API_KEY --project-name marketnow
```

### 4. Verify it works

After deploying, hit the health endpoint:

```bash
curl https://marketnow.site/api/health | jq .
```

You should see the `blockchain_rpc` section show `configured: true` and
`circuit_state: "CLOSED"`.

Or hit the stats endpoint directly (you may need to add one — see "Next
steps" below):

```bash
curl https://marketnow.site/api/health | jq '.blockchain'
```

### 5. Test with a real txHash

```bash
# Verify a USDC payment on Base (replace with a real txHash)
curl 'https://marketnow.site/api/agent-purchase' \
  -H 'Content-Type: application/json' \
  -d '{"skillId":"mn-gen-00001","txHash":"0x<your_txhash>","walletAddress":"0x<your_wallet>"}'
```

The response should include `"source": "alchemy"` (visible in server logs)
rather than `"source": "fallback-..."`.

## How MarketNow uses Alchemy

The `lib/blockchain-rpc-pool.mjs` module is the single entry point for all
on-chain reads. It:

1. **Tries Alchemy first** (if `ALCHEMY_API_KEY` is set and the circuit is
   `CLOSED` or `HALF_OPEN`).
2. **Falls back to the public RPC pool** (`lib/base-rpc-pool.mjs`,
   unchanged) if Alchemy fails.
3. **Circuit breaker**: if Alchemy fails `CIRCUIT_FAILURE_THRESHOLD` (3) times
   in a row, it opens the circuit for `CIRCUIT_OPEN_MS` (30s) — during that
   window, we skip Alchemy entirely and go straight to public RPCs. After 30s,
   we try Alchemy once (`HALF_OPEN`); if it succeeds, the circuit closes; if it
   fails, the circuit re-opens.

### Endpoints that use Alchemy

| Endpoint | Method | Purpose |
|---|---|---|
| `POST /api/agent-purchase` | `eth_getTransactionReceipt` | Verify USDC payment (mandatory + direct purchase modes) |
| (planned) `GET /api/mandates?action=verify-spend` | `eth_getTransactionReceipt` | Verify mandate spending on-chain |

### Endpoints that do NOT use Alchemy

- `GET /api/health` — uses internal in-memory stats only
- `GET /api/license?action=verify` — fully offline (Ed25519 signature check, no RPC)
- `POST /api/atc` — fully offline after CA key load
- `GET /api/search` — reads from skills cache, no RPC

## What happens if Alchemy is down?

1. **Single-call failure**: The request falls through to the public RPC pool
   and succeeds (the user sees no error, just slightly higher latency).
2. **Repeated failures (3 in a row)**: The circuit opens. For the next 30s,
   every request goes straight to public RPCs (skipping the failed Alchemy
   call entirely — saves 5s of timeout per request).
3. **After 30s**: One request is sent to Alchemy (`HALF_OPEN`). If it
   succeeds, the circuit closes and we resume normal operation. If it fails,
   the circuit re-opens for another 30s.
4. **Both Alchemy AND public RPCs fail**: The user sees a `rpc_error` response
   with a clear error message and a `Retry-After` header. The license is NOT
   issued — fail-closed for security.

## Free tier limits

Alchemy's free tier includes:

- **300M compute units (CU) per month** — MarketNow uses ~0.5 CU per
  `eth_getTransactionReceipt` call, so this is enough for ~600M verifications
  per month. We currently do ~5000 verifications/month.
- **10M compute units per day** — peak rate of ~115 calls/sec sustained, way
  above our peak of 5 calls/sec.
- **WebSocket connections**: 1 (we don't use WebSockets today).
- **Archive data**: full history (free tier includes archive access for Base).
- **Webhooks (Alchemy Notify)**: 1M webhook events/month.

If you exceed these limits, Alchemy will return 429s and our circuit breaker
will open — the system degrades gracefully to public RPCs, same as today.

## Cost projection

- **Current**: 5000 verifications/month × 1 RPC call = 5000 calls. Free.
- **At 10x growth**: 50,000 calls. Free.
- **At 100x growth**: 500,000 calls. Free.
- **At 1000x growth (1M+ users)**: 5M calls × 0.5 CU = 2.5M CU. Still free.

We'd need to outgrow our current traffic by ~1000x before paying for Alchemy.
At that point, the $199/month Growth tier is more than sufficient.

## Comparison: what we'd pay if we stayed on public RPCs

If we stayed on `mainnet.base.org` and grew 10x:

- Public RPC limit: ~100 req/5min per IP = 1200 req/hour per IP
- Vercel serverless IPs: many (each function invocation can be from a
  different IP), but Vercel may share egress IPs within a region
- At 10x growth: 50,000 req/month = ~70 req/hour — well within limits
- BUT: a traffic spike (e.g. a popular agent retries 5x = 5 calls in 5s)
  would burn through the per-IP rate limit instantly → 429s for the next 5
  minutes for any other request from the same IP.

Alchemy's per-app rate limit (not per-IP) eliminates this entirely.

## Migration: how to roll out

1. **Add the env var to Vercel** (Production environment only — Preview can
   keep using public RPCs to avoid burning Alchemy quota during tests).
2. **Redeploy**. The new `blockchain-rpc-pool.mjs` module is already
   imported by `/api/agent-purchase` (after the refactor in this PR).
3. **Watch the server logs** for the first hour:
   - Look for `[blockchain-rpc-pool] Alchemy failure` warnings (transient
     network issues — fine).
   - Look for `Alchemy circuit OPENED` (sustained failure — investigate).
4. **After 24h of clean operation**, also enable Alchemy for Preview:
   - Vercel → environment variables → also check "Preview".

## Troubleshooting

### "Alchemy returned 429"

Your app is rate-limited. Check the Alchemy dashboard → your app → **Usage**
to see if you've hit the daily CU limit. If so:

- **Short-term**: the circuit breaker will route to public RPCs for 30s.
- **Long-term**: upgrade to the Growth tier, OR cache more aggressively
  (the receipt cache already helps — multiple calls for the same txHash
  in 5 minutes = 1 RPC call).

### "Alchemy returned HTTP 401"

Your API key is invalid or revoked. Re-check the env var:

```bash
echo $ALCHEMY_API_KEY
```

### "circuit_state: OPEN" in /api/health

Alchemy has been failing for 30+ seconds. Check:

1. The Alchemy status page: https://status.alchemy.com/
2. Your API key (still valid?).
3. The Base network status (rare, but possible).

If Alchemy is genuinely down, the public RPC fallback is keeping the
service alive — no user-visible impact.

### "All RPC endpoints failed" error to user

Both Alchemy AND all 4 public RPCs failed. This is rare and indicates a
broader network issue. Check:

1. Vercel status: https://www.vercel-status.com/
2. Base network status: https://base.org/

## Next steps

After Alchemy is configured:

1. **Enable Alchemy Notify (webhooks)** for the payment wallet
   (`0x39Dddf5aEdb58A559CF195fB8bdF23F0604Bf5Ee`). When a USDC transfer
   lands, Alchemy calls our webhook → we can pre-warm the receipt cache →
   the subsequent `/api/agent-purchase` call is instant (no RPC needed).
2. **Migrate to Alchemy's `eth_getTransactionReceipt` with `includeCalls:
   true`** to also return decoded call data (currently we decode the logs
   manually, which works but is more code).
3. **Use Alchemy's `eth_subscribe` (WebSocket)** for real-time block
   updates — currently we poll `eth_blockNumber` from the agent side.
