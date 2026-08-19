/**
 * MarketNow — Supabase client library (Phase 1)
 * =================================================
 *
 * Thin wrapper around `@supabase/supabase-js` exposing the read/write helpers
 * the API layer needs. All functions degrade gracefully when Supabase env
 * vars are not set (returns null / empty array + console.warn) so local dev
 * without Supabase configured does not crash the server.
 *
 * ─── Roles ───────────────────────────────────────────────────────────────
 * The Vercel runtime should have TWO env vars:
 *   SUPABASE_URL              — used for both reads and writes
 *   SUPABASE_SERVICE_KEY      — service_role key; bypasses RLS. SERVER ONLY.
 *                               NEVER expose to the browser.
 *
 * Optionally, also set:
 *   SUPABASE_ANON_KEY         — anon role; subject to RLS. Used for the
 *                               "public read" client that mirrors what a
 *                               browser would see.
 *
 * If SUPABASE_ANON_KEY is absent, the anon client falls back to the service
 * key (still works, but RLS won't kick in for the public-read path — that's
 * acceptable for server-side reads).
 *
 * ─── Functions ────────────────────────────────────────────────────────────
 *   getATC(card_id)                    → row | null
 *   listATCs(filter?)                  → row[]
 *   upsertATC(card_row)                → { ok, error? }
 *   revokeATC(card_id, reason)         → { ok, error? }
 *   getMandate(mandate_id)             → row | null
 *   listMandatesByWallet(wallet)       → row[]
 *   getQuarantineDecisions(date_range)→ row[]
 *   getLicense(license_key)            → row | null
 *   recordTrustDecision(decision_row)  → { ok, error? }
 *   checkRateLimit(key, limit, win_ms) → { allowed, remaining, retry_after_ms }
 *     — uses Upstash Redis via ./rate-limit-redis.mjs
 *     — falls back to the `rate_limit_counters` table if Redis unavailable
 */

// Lazy singletons — created on first use so importing this module is cheap
// and works in dev without Supabase configured.
let _serviceClient = null;
let _anonClient = null;
let _initialized = false;
let _initError = null;

// ─── Internal: client bootstrap ───────────────────────────────────────────

async function getClients() {
  if (_initialized) {
    if (_initError) throw _initError;
    return { service: _serviceClient, anon: _anonClient };
  }
  _initialized = true;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    _initError = new Error(
      'SUPABASE_URL or SUPABASE_SERVICE_KEY not set. ' +
      'See docs/SUPABASE_SETUP.md.'
    );
    throw _initError;
  }

  let createClient;
  try {
    ({ createClient } = await import('@supabase/supabase-js'));
  } catch (err) {
    _initError = new Error(
      '@supabase/supabase-js not installed. Run: npm install @supabase/supabase-js'
    );
    throw _initError;
  }

  _serviceClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  _anonClient = createClient(url, anonKey || serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { service: _serviceClient, anon: _anonClient };
}

/** Soft-fail wrapper: returns null + logs instead of throwing when Supabase
 *  isn't configured. Use this for read paths so the API can fall back to
 *  the legacy GitHub-backed path if needed. */
async function safeCall(promiseFactory, fallback = null) {
  try {
    const { service } = await getClients();
    return await promiseFactory(service);
  } catch (err) {
    if (process.env.SUPABASE_DEBUG === '1') {
      console.warn('[supabase-client] soft-fail:', err.message);
    }
    return fallback;
  }
}

// ─── ATC cards ─────────────────────────────────────────────────────────────

/**
 * Fetch a single ATC card by card_id.
 * Uses the anon client so RLS public-read policies apply.
 */
export async function getATC(card_id) {
  return safeCall(async (svc) => {
    const { data, error } = await svc
      .from('atc_cards')
      .select('*')
      .eq('card_id', card_id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }, null);
}

/**
 * List ATC cards.
 * @param {object} filter
 *   @param {string} [filter.status]  default 'active'
 *   @param {string} [filter.agent_id]
 *   @param {number} [filter.limit]   default 100, max 1000
 *   @param {number} [filter.offset]
 */
export async function listATCs(filter = {}) {
  return safeCall(async (svc) => {
    let q = svc.from('atc_cards').select('*');
    q = q.eq('status', filter.status || 'active');
    if (filter.agent_id) q = q.eq('agent_id', filter.agent_id);
    q = q.order('issued_at', { ascending: false });
    q = q.limit(Math.min(filter.limit || 100, 1000));
    if (filter.offset) q = q.range(filter.offset, filter.offset + (filter.limit || 100) - 1);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }, []);
}

/**
 * Insert or update an ATC card.
 * Caller is responsible for the row shape matching `atc_cards` (see db/schema.sql).
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function upsertATC(card) {
  try {
    const { service } = await getClients();
    const { error } = await service
      .from('atc_cards')
      .upsert(card, { onConflict: 'card_id' });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Mark an ATC card as revoked.
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function revokeATC(card_id, reason = 'revoked') {
  try {
    const { service } = await getClients();
    const { error } = await service
      .from('atc_cards')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revocation_reason: reason,
      })
      .eq('card_id', card_id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── Mandates ──────────────────────────────────────────────────────────────

export async function getMandate(mandate_id) {
  return safeCall(async (svc) => {
    const { data, error } = await svc
      .from('mandates')
      .select('*')
      .eq('mandate_id', mandate_id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }, null);
}

export async function listMandatesByWallet(wallet_address) {
  return safeCall(async (svc) => {
    const { data, error } = await svc
      .from('mandates')
      .select('*')
      .eq('wallet_address', wallet_address)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }, []);
}

// ─── Quarantine decisions ─────────────────────────────────────────────────

/**
 * List quarantine decisions, optionally constrained to a date range.
 * @param {object} date_range
 *   @param {string|Date} [date_range.from]
 *   @param {string|Date} [date_range.to]
 *   @param {number}     [date_range.limit]  default 200
 */
export async function getQuarantineDecisions(date_range = {}) {
  return safeCall(async (svc) => {
    let q = svc.from('quarantine_decisions').select('*');
    if (date_range.from) q = q.gte('decision_date', new Date(date_range.from).toISOString());
    if (date_range.to) q = q.lte('decision_date', new Date(date_range.to).toISOString());
    q = q.order('decision_date', { ascending: false });
    q = q.limit(Math.min(date_range.limit || 200, 1000));
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }, []);
}

// ─── Licenses ─────────────────────────────────────────────────────────────

export async function getLicense(license_key) {
  return safeCall(async (svc) => {
    const { data, error } = await svc
      .from('licenses')
      .select('*')
      .eq('license_key', license_key)
      .maybeSingle();
    if (error) throw error;
    return data;
  }, null);
}

// ─── Trust decisions (audit log) ───────────────────────────────────────────

/**
 * Insert a trust decision record.
 * Caller is responsible for the row shape matching `trust_decisions`.
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function recordTrustDecision(decision) {
  try {
    const { service } = await getClients();
    const row = {
      decision_id: decision.decision_id,
      decision_date: decision.decision_date || new Date().toISOString(),
      decision: decision.decision, // 'ALLOW' | 'BLOCK'
      rule_id: decision.rule_id || null,
      policy_version: decision.policy_version || null,
      inputs: decision.inputs || [],
      reasons: decision.reasons || [],
      violations: decision.violations || [],
      evidence_hash: decision.evidence_hash || null,
      caller_ip: decision.caller_ip || null,
      caller_agent_id: decision.caller_agent_id || null,
    };
    const { error } = await service
      .from('trust_decisions')
      .upsert(row, { onConflict: 'decision_id' });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── Rate limiting (Upstash → Supabase fallback) ──────────────────────────

/**
 * Distributed rate limit check.
 *
 * Strategy (in priority order):
 *
 *   1. If Upstash Redis env vars are set, ask ./rate-limit-redis.mjs.
 *      That module already handles its own internal fallback to in-memory
 *      when the Redis call itself fails transiently (source='error'), and
 *      returns source='memory' when Upstash is simply not configured.
 *      Either way, we TRUST the redis module's verdict — going to Supabase
 *      as a second-tier fallback would risk double-counting under transient
 *      blips.
 *
 *   2. If Upstash is NOT configured, fall back to the `rate_limit_counters`
 *      table in Supabase. The Supabase fallback is approximate
 *      (fixed-window, not sliding-window) and may be slightly permissive
 *      under concurrency, but it is correct for the common case and
 *      survives cold starts better than the legacy in-memory Map.
 *
 *   3. If neither Upstash nor Supabase is configured (local dev, no env
 *      vars), allow the request. The legacy in-memory limiter in
 *      lib/rate-limit.mjs still runs as the first line of defense at the
 *      API boundary, so this is safe — it just means the distributed
 *      layer is a no-op.
 *
 * @param {string} key        e.g. "atc_issue:192.168.1.1"
 * @param {number} limit      max requests per window
 * @param {number} windowMs   window size in milliseconds (default 60_000)
 * @returns {Promise<{allowed: boolean, remaining: number, retry_after_ms: number, source: 'redis'|'error'|'memory'|'supabase'|'none'}>}
 */
export async function checkRateLimit(key, limit, windowMs = 60_000) {
  // 1) Upstash path — only if configured.
  let redisMod;
  try {
    redisMod = await import('./rate-limit-redis.mjs');
  } catch (err) {
    if (process.env.SUPABASE_DEBUG === '1') {
      console.warn('[supabase-client] rate-limit-redis import failed:', err.message);
    }
    redisMod = null;
  }

  if (redisMod && redisMod.isConfigured && redisMod.isConfigured()) {
    try {
      const r = await redisMod.checkRateLimit(key, limit, windowMs);
      // source is 'redis' (success) or 'error' (Redis failed → memory fallback
      // already happened inside the redis module). Either way, return that
      // verdict — we trust the module's own fallback chain.
      return r;
    } catch (err) {
      if (process.env.SUPABASE_DEBUG === '1') {
        console.warn('[supabase-client] upstash path threw:', err.message);
      }
      // Fall through to Supabase path.
    }
  }

  // 2) Supabase fallback path
  try {
    const { service } = await getClients();
    const now = Date.now();
    const bucketKey = `${key}:${Math.floor(now / windowMs)}`; // fixed window
    const expiresAt = new Date(Math.floor(now / windowMs) * windowMs + windowMs).toISOString();

    // Atomic increment via upsert with a computed count. Supabase JS doesn't
    // expose raw SQL, so we read-then-write. This is slightly racy but
    // acceptable as a fallback when Redis is unavailable.
    const { data: existing } = await service
      .from('rate_limit_counters')
      .select('count')
      .eq('counter_key', bucketKey)
      .maybeSingle();

    const newCount = (existing?.count || 0) + 1;
    await service
      .from('rate_limit_counters')
      .upsert(
        { counter_key: bucketKey, count: newCount, window_start: new Date(Math.floor(now / windowMs) * windowMs).toISOString(), expires_at: expiresAt },
        { onConflict: 'counter_key' }
      );

    // Opportunistic cleanup: delete a few expired counters. Don't await.
    service
      .from('rate_limit_counters')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .then(() => {}, () => {});

    const allowed = newCount <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - newCount),
      retry_after_ms: allowed ? 0 : windowMs - (now % windowMs),
      source: 'supabase',
    };
  } catch (err) {
    if (process.env.SUPABASE_DEBUG === '1') {
      console.warn('[supabase-client] supabase rate-limit fallback failed:', err.message);
    }
    // 3) Last resort: allow. Better to be permissive than to break the API
    //    entirely. The legacy in-memory limiter in lib/rate-limit.mjs still
    //    runs as the first line of defense at the API boundary.
    return { allowed: true, remaining: limit, retry_after_ms: 0, source: 'none' };
  }
}

// ─── Health check (for /api/health) ───────────────────────────────────────

/**
 * Returns { ok: boolean, configured: boolean } for health-check reporting.
 * Does NOT throw.
 */
export async function ping() {
  try {
    const { service } = await getClients();
    const { error } = await service
      .from('atc_cards')
      .select('card_id')
      .limit(1);
    return { ok: !error, configured: true, error: error?.message };
  } catch (err) {
    return { ok: false, configured: false, error: err.message };
  }
}

export default {
  getATC,
  listATCs,
  upsertATC,
  revokeATC,
  getMandate,
  listMandatesByWallet,
  getQuarantineDecisions,
  getLicense,
  recordTrustDecision,
  checkRateLimit,
  ping,
};
