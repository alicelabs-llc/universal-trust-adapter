# MarketNow Architecture Migration Plan

> Per the technical audit feedback received 2026-08-19.
> Goal: eliminate single points of failure, break free from GitHub dependency,
> make everything free to maintain, with backups and versioning.

## Current Architecture (as of 2026-08-19)

```
                    ┌─────────────────┐
                    │  marketnow.site  │
                    │  (Vercel apex)  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Vercel Hobby   │
                    │  12 lambdas     │
                    │  (MAXED OUT)    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
      ┌───────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
      │ GitHub API   │ │ npm      │ │ Public RPC  │
      │ (_data/)     │ │ registry │ │ (Base L2)   │
      │ 5k req/hr    │ │          │ │ No SLA      │
      │ Race cond.   │ │          │ │ 429 errors  │
      └──────────────┘ └──────────┘ └─────────────┘
```

### Problems identified

1. **GitHub as database** (_data/): 5,000 req/hour limit, race conditions on concurrent commits (HTTP 409), single point of failure
2. **Vercel 12-function limit**: Already maxed out — can't add new endpoints
3. **Rate limiting is in-memory**: Each Lambda has its own state → bypassable by parallel requests
4. **License keys are not cryptographic**: Random strings, can't verify offline
5. **Public RPC dependency**: No SLA, 429 errors on high traffic
6. **GitHub shadowban**: Repo returns 404 for public visitors

## Target Architecture

```
                    ┌──────────────────────────────┐
                    │       marketnow.site         │
                    │   (Cloudflare DNS + CDN)     │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │  Vercel (1 Edge Function)    │
                    │  Hono.js unified router      │
                    │  - /api/* (all endpoints)    │
                    │  - Static assets from CDN    │
                    └──────┬───────────┬──────────┘
                           │           │
              ┌────────────┼───────────┼────────────┐
              │            │           │            │
      ┌───────▼──────┐ ┌───▼────┐ ┌───▼────┐ ┌─────▼──────┐
      │ Supabase     │ │ Upstash│ │Alchemy │ │ Cloudflare│
      │ PostgreSQL    │ │ Redis  │ │ RPC    │ │ R2 + KV  │
      │ (free 500MB) │ │ (free) │ │(free)  │ │ (free)   │
      │ - ATC cards  │ │ - Rate │ │ - Base │ │ - Backups │
      │ - Mandates   │ │   limit│ │   L2   │ │ - Static  │
      │ - Quarantine │ │ - Cache│ │ - ETH  │ │   assets  │
      └──────────────┘ └────────┘ └────────┘ └──────────┘
```

## Phase 1: Database Migration (Week 1) — FREE

### Replace GitHub _data/ with Supabase PostgreSQL

**Why Supabase (free tier)**:
- 500MB PostgreSQL database (more than enough for ATC cards + mandates)
- Real-time subscriptions (for live mandate updates)
- Row Level Security (RLS) built-in
- REST API auto-generated (no need for custom CRUD)
- Free forever, no credit card required

**Schema**:
```sql
-- ATC cards table (replaces _data/atc/*.json)
CREATE TABLE atc_cards (
  card_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  agent_name TEXT,
  status TEXT DEFAULT 'active', -- active, revoked, expired
  payload JSONB NOT NULL,
  signature JSONB NOT NULL,
  sentinel_review_score INT DEFAULT 0,
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT
);

-- Mandates table (replaces _data/mandates/*.json)
CREATE TABLE mandates (
  mandate_id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  spending_limit_usd INT NOT NULL,
  per_purchase_cap_usd INT NOT NULL,
  spent_usd INT DEFAULT 0,
  notification_mode TEXT DEFAULT 'notify',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

-- Quarantine decisions (replaces _data/quarantine_decisions/)
CREATE TABLE quarantine_decisions (
  decision_id TEXT PRIMARY KEY,
  decision_date TIMESTAMPTZ NOT NULL,
  skill_id TEXT NOT NULL,
  sentinel_score INT,
  layers_run JSONB,
  layer_findings JSONB,
  decision TEXT NOT NULL, -- quarantine, allow, warn
  decision_reason TEXT,
  record_sha256 TEXT,
  appeal_status TEXT,
  appeal_decision TEXT,
  appeal_decision_date TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_atc_cards_agent_id ON atc_cards(agent_id);
CREATE INDEX idx_atc_cards_status ON atc_cards(status);
CREATE INDEX idx_mandates_wallet ON mandates(wallet_address);
CREATE INDEX idx_quarantine_date ON quarantine_decisions(decision_date DESC);
```

**Migration script** (Node.js):
```javascript
// scripts/migrate-to-supabase.mjs
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Migrate ATC cards
const atcDir = '_data/atc';
const files = fs.readdirSync(atcDir).filter(f => f.endsWith('.json'));

for (const file of files) {
  const card = JSON.parse(fs.readFileSync(path.join(atcDir, file)));
  const { error } = await supabase.from('atc_cards').upsert({
    card_id: card.card_id,
    agent_id: card.payload?.agent_id,
    agent_name: card.payload?.agent_name,
    status: card.status || 'active',
    payload: card.payload,
    signature: card.signature,
    sentinel_review_score: card.payload?.trust?.sentinel_review_score || 0,
    issued_at: card.payload?.metadata?.issued_at,
    expires_at: card.payload?.metadata?.expires_at,
  });
  if (error) console.error(`Failed: ${file}`, error);
}

console.log(`Migrated ${files.length} ATC cards to Supabase`);
```

### Add Upstash Redis for distributed rate limiting

**Why Upstash (free tier)**:
- 10,000 requests/day free
- Global edge (low latency)
- Serverless Redis compatible
- No connection pooling needed

**Replace lib/rate-limit.mjs**:
```javascript
// lib/rate-limit-redis.mjs
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export async function checkRateLimit(key, limit, windowMs) {
  const now = Date.now();
  const windowKey = `ratelimit:${key}:${Math.floor(now / windowMs)}`;
  
  const count = await redis.incr(windowKey);
  if (count === 1) {
    await redis.expire(windowKey, Math.ceil(windowMs / 1000));
  }
  
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    limit,
  };
}
```

## Phase 2: Lambda Consolidation (Week 2) — FREE

### Unify all 12 lambdas into 1 Hono.js Edge Function

**Why Hono.js**:
- Ultra-fast web framework for Edge runtimes
- Supports Vercel Edge Functions (not counted in the 12 Lambda limit!)
- Middleware-based (CORS, rate limiting, auth)
- TypeScript-first

**New single entry point** (`api/[[...path]].js`):
```javascript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { handleATC } from './handlers/atc.js';
import { handleTrust } from './handlers/trust.js';
import { handleSearch } from './handlers/search.js';
import { handleMandates } from './handlers/mandates.js';
import { handleSecurity } from './handlers/security.js';
import { handleHealth } from './handlers/health.js';
import { handleOWASP } from './handlers/owasp.js';
import { handleAgentPurchase } from './handlers/agent-purchase.js';
import { handleAgentEconomy } from './handlers/agent-economy.js';
import { handleAuditSkill } from './handlers/audit-skill.js';
import { handleStripeWebhook } from './handlers/stripe-webhook.js';
import { handleMCP } from './handlers/mcp.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', version: '5.0.0' }));

// ATC endpoints
app.get('/api/atc', handleATC);
app.post('/api/atc', handleATC);

// Trust API (enriched)
app.get('/api/trust', handleTrust);
app.post('/api/trust', handleTrust);

// Skills / search
app.get('/api/skills.json', handleSearch);
app.get('/api/skills-lite.json', handleSearch);
app.get('/api/search', handleSearch);

// Mandates
app.get('/api/mandates', handleMandates);
app.post('/api/mandates', handleMandates);

// Security
app.get('/api/security', handleSecurity);
app.get('/api/owasp', handleOWASP);
app.post('/api/interceptor', handleSecurity);

// Commerce
app.post('/api/agent-purchase', handleAgentPurchase);
app.post('/api/stripe-webhook', handleStripeWebhook);

// MCP
app.get('/api/mcp', handleMCP);
app.post('/api/mcp', handleMCP);

// Agent economy
app.get('/api/agent-economy', handleAgentEconomy);
app.post('/api/agent-economy', handleAgentEconomy);

// Audit
app.get('/api/audit-skill', handleAuditSkill);

export default app;
```

**Benefits**:
- 1 Edge Function instead of 12 Lambdas (breaks the Vercel Hobby limit)
- Global edge deployment (sub-30ms latency worldwide)
- Shared middleware (rate limiting, CORS, auth — applied once)
- Easy to add new endpoints (just add a route)

## Phase 3: Code Mirroring (Week 3) — FREE

### Mirror code to multiple platforms (no GitHub dependency)

**Strategy**: Use npm as the primary distribution channel, with jsDelivr CDN for direct file access.

**1. npm packages (already deployed)**:
- `marketnow-mcp` — MCP server
- `agent-trust-card` — ATC SDK (Node.js + Python)
- `marketnow-install-stack` — Install CLI

**2. jsDelivr CDN** (free, unlimited):
```
https://cdn.jsdelivr.net/npm/marketnow-mcp@latest/index.js
https://cdn.jsdelivr.net/npm/agent-trust-card@latest/index.js
```

**3. Cloudflare Pages** (free, unlimited):
- Mirror the static site (index.html, assets, API JSON files)
- Set up as a fallback domain: `marketnow.pages.dev`
- Auto-deploy from npm package updates

**4. Deno Deploy** (free, 1M requests/month):
- Deploy the Hono.js Edge Function
- Acts as a fallback API: `marketnow.deno.dev`

**5. Render** (free tier):
- Deploy the full Node.js app as a fallback
- `marketnow.onrender.com`

**Versioning**: Each platform serves versioned content:
- npm: `@1.10.0`, `@1.10.1`, `@latest`, `@next`
- jsDelivr: `@1.10.0`, `@latest`
- Cloudflare Pages: git tags → immutable deployments
- Deno Deploy: `v1.10.0` branches

**Rollback**: Pin any platform to a specific version:
```bash
# Rollback npm to 1.10.0
npm install marketnow-mcp@1.10.0

# Rollback Cloudflare Pages to previous deployment
wrangler pages deployment rollback --project-name=marketnow

# Rollback Deno Deploy
deno deploy --branch=v1.10.0
```

## Phase 4: Security Hardening (Week 4) — FREE

### Ed25519-signed licenses (offline-verifiable)

**Current**: License keys are random strings (`MN-GEN-08561-...`)
**Target**: Ed25519-signed JWT-like tokens

```javascript
// License format: base64(header).base64(payload).base64(signature)
import crypto from 'crypto';

const LICENSE_PRIVATE_KEY = process.env.LICENSE_PRIVATE_KEY; // Ed25519 PEM

function issueLicense(skillId, buyerWallet, expiresAt) {
  const header = { alg: 'Ed25519', typ: 'MN-LICENSE' };
  const payload = {
    skill_id: skillId,
    buyer_wallet: buyerWallet,
    issued_at: new Date().toISOString(),
    expires_at: expiresAt,
    issuer: 'MarketNow',
  };
  
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const message = `${headerB64}.${payloadB64}`;
  
  const signature = crypto.sign(null, Buffer.from(message), LICENSE_PRIVATE_KEY);
  const sigB64 = signature.toString('base64url');
  
  return `${message}.${sigB64}`;
}

// Client-side verification (offline):
function verifyLicenseOffline(license, caPublicKeyPem) {
  const [headerB64, payloadB64, sigB64] = license.split('.');
  const message = `${headerB64}.${payloadB64}`;
  const signature = Buffer.from(sigB64, 'base64url');
  
  return crypto.verify(null, Buffer.from(message), caPublicKeyPem, signature);
}
```

**Benefits**:
- Clients verify licenses WITHOUT calling the server
- Works offline
- Tamper-evident (signature covers the entire payload)
- Uses the SAME Ed25519 CA key as ATC cards (no new key management)

### Dedicated blockchain RPC (Alchemy free tier)

**Current**: Public RPCs (no SLA, 429 errors)
**Target**: Alchemy free tier (300 req/sec, 1M req/month)

```javascript
// lib/blockchain-rpc.mjs
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const FALLBACK_RPCS = [
  'https://base-rpc.publicnode.com',
  'https://1rpc.io/base',
  'https://mainnet.base.org',
];

export async function getTransactionReceipt(txHash) {
  // Try Alchemy first (dedicated, has SLA)
  try {
    const alchemyUrl = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
    const res = await fetch(alchemyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [txHash],
        id: 1,
      }),
    });
    const data = await res.json();
    if (data.result) return data.result;
  } catch (e) {
    console.warn('Alchemy RPC failed, falling back to public');
  }
  
  // Fallback to public RPCs (round-robin)
  for (const rpc of FALLBACK_RPCS) {
    try {
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getTransactionReceipt',
          params: [txHash],
          id: 1,
        }),
      });
      const data = await res.json();
      if (data.result) return data.result;
    } catch (e) {
      continue;
    }
  }
  
  throw new Error('All RPCs failed');
}
```

## Implementation Timeline

| Week | Phase | Tasks | Cost |
|------|-------|-------|------|
| 1 | Database | Supabase setup + migration + Upstash Redis | $0 |
| 2 | Lambda | Hono.js unification + Edge migration | $0 |
| 3 | Mirroring | Cloudflare Pages + Deno Deploy + jsDelivr | $0 |
| 4 | Security | Ed25519 licenses + Alchemy RPC | $0 |
| Ongoing | CI/CD | GitHub Actions → multi-platform deploy | $0 |

**Total monthly cost: $0** (all free tiers)

## Rollback Strategy

Every change is versioned and reversible:

1. **Database**: Supabase has point-in-time recovery (7 days free)
2. **Lambda**: Each Vercel deployment is immutable — rollback via API
3. **npm**: Version-pinned, old versions always available
4. **Cloudflare Pages**: Every deployment is immutable, rollback is 1 command
5. **Deno Deploy**: Branch-based, rollback = switch branch
6. **Static assets**: Cloudflare R2 has versioning enabled

## Next Steps

1. **Today**: Create Supabase account + project (5 min)
2. **This week**: Migrate _data/ to Supabase + add Upstash Redis
3. **Next week**: Unify lambdas with Hono.js
4. **Week 3**: Set up Cloudflare Pages mirror
5. **Week 4**: Implement Ed25519 licenses + Alchemy RPC

Each phase is independent — if one fails, the others still work.
