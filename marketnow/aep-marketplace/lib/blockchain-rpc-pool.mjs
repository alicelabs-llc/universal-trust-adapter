/**
 * MarketNow — Blockchain RPC Pool (Alchemy primary + public fallback)
 * ====================================================================
 *
 * REPLACES the legacy lib/base-rpc-pool.mjs (4 public RPCs only, no SLA,
 * 429s on traffic spikes). The new module:
 *
 *   1. Uses Alchemy (dedicated, API-key'd) as the PRIMARY RPC.
 *      Free tier: 300M compute units/month, 99.9% SLA.
 *      Env var: ALCHEMY_API_KEY
 *      Endpoint: https://base-mainnet.g.alchemy.com/v2/{API_KEY}
 *
 *   2. Falls back to the existing public RPC pool (lib/base-rpc-pool.mjs)
 *      if Alchemy is unconfigured OR if Alchemy is open-circuited.
 *
 *   3. Circuit breaker: if Alchemy fails N times in a row (default 3),
 *      we OPEN the circuit for 30s — skip Alchemy entirely and go straight
 *      to public RPCs. After 30s, we HALF-OPEN (try Alchemy once; if it
 *      succeeds, CLOSE the circuit; if it fails, re-OPEN for another 30s).
 *
 *   4. Caches transaction receipts (idempotent operation). Two requests
 *      for the same txHash in 5 minutes → 1 RPC call, not 2. The cache
 *      is shared with the existing tx-cache.mjs (we read from it first;
 *      we write to it after a successful fetch).
 *
 *   5. Round-robin + retry across the public fallback RPCs (delegated to
 *      the existing base-rpc-pool.mjs — we don't reinvent that wheel).
 *
 * Architecture
 * ------------
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │  blockchain-rpc-pool.mjs (this file)                            │
 *   │  ─────────────────────────────────────────────────────────────  │
 *   │  - public getTransactionReceipt(txHash)                         │
 *   │  - public verifyUSDCPayment(txHash, expectedAmount, recipient)  │
 *   │  - public getBlockNumber()                                      │
 *   │  ─────────────────────────────────────────────────────────────  │
 *   │  Layer 1: Alchemy (primary)  ──┐                                │
 *   │   ─ Circuit breaker (3 strikes → 30s cooldown)                  │
 *   │   ─ API key from env var                                        │
 *   │   ─ Dedicated capacity (300M CU/month, 99.9% SLA)               │
 *   │                                 │                                │
 *   │  Layer 2: base-rpc-pool.mjs (fallback)  ◀── on Alchemy failure  │
 *   │   ─ Round-robin over 4 public RPCs                              │
 *   │   ─ Bad-endpoint marking (60s cooldown)                         │
 *   │   ─ No API key, no SLA, but free                                │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * Caching
 * -------
 *   - eth_getTransactionReceipt: idempotent. Cache for 5 min.
 *     Cache key: txHash.lowercased().
 *     Cache value: { receipt, fetched_at, source } — `source` is
 *     'alchemy' or 'fallback-{label}' for observability.
 *   - eth_blockNumber: NOT cached (always fresh — agents polling for
 *     block height expect the latest value).
 *
 * Retry policy
 * ------------
 *   - Per-endpoint timeout: 5s (configurable via RPC_TIMEOUT_MS env).
 *   - On 429: mark endpoint as bad for 60s, try next.
 *   - On timeout: mark bad, try next.
 *   - On 5xx: retry once on same endpoint, then try next.
 *   - On 4xx (other than 429): don't retry — RPC error, propagate.
 *
 * Env vars
 * --------
 *   ALCHEMY_API_KEY        — required for Alchemy (omit to use public only)
 *   ALCHEMY_NETWORK        — default: 'base-mainnet' (Base L2)
 *   ALCHEMY_APP_NAME       — optional, used in the URL path (default: marketnow)
 *   RPC_TIMEOUT_MS         — default: 5000
 *   CIRCUIT_FAILURE_THRESHOLD — default: 3
 *   CIRCUIT_OPEN_MS        — default: 30000
 *
 * Metrics
 * -------
 *   getStats() returns:
 *     {
 *       alchemy: { configured, circuit_state, failure_count, last_failure_at },
 *       fallback: { ...same as base-rpc-pool.getStats() },
 *       receipt_cache: { size, ttl_ms }
 *     }
 */

import * as txCache from './tx-cache.mjs';

// ─── Config (from env) ────────────────────────────────────────────────────

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || '';
const ALCHEMY_NETWORK = process.env.ALCHEMY_NETWORK || 'base-mainnet';
const ALCHEMY_APP_NAME = process.env.ALCHEMY_APP_NAME || 'marketnow';
const RPC_TIMEOUT_MS = parseInt(process.env.RPC_TIMEOUT_MS || '5000', 10);
const CIRCUIT_FAILURE_THRESHOLD = parseInt(process.env.CIRCUIT_FAILURE_THRESHOLD || '3', 10);
const CIRCUIT_OPEN_MS = parseInt(process.env.CIRCUIT_OPEN_MS || '30000', 10);

// Lazy import — avoids a circular-dep issue if base-rpc-pool ever imports
// us back (it doesn't today, but be safe).
let _fallbackPool = null;
async function getFallbackPool() {
  if (!_fallbackPool) {
    _fallbackPool = await import('./base-rpc-pool.mjs');
  }
  return _fallbackPool;
}

// ─── Circuit breaker state (module-level, survives warm starts) ──────────

/**
 * Circuit states (same as Netflix Hystrix):
 *   - CLOSED: Alchemy is healthy. All calls go to Alchemy.
 *   - OPEN:   Alchemy is failing. Skip Alchemy, go straight to fallback.
 *   - HALF_OPEN: Cooldown elapsed. Try Alchemy ONCE; if success, CLOSE;
 *                if failure, re-OPEN.
 */
let _circuitState = ALCHEMY_API_KEY ? 'CLOSED' : 'DISABLED';
let _failureCount = 0;
let _lastFailureAt = 0; // timestamp
let _circuitOpenedAt = 0; // timestamp when we went OPEN

// ─── Helpers ──────────────────────────────────────────────────────────────

function isAlchemyConfigured() {
  return !!ALCHEMY_API_KEY;
}

function alchemyUrl() {
  // Format: https://{network}.g.alchemy.com/v2/{apiKey}
  // The "network" subdomain encodes both the chain and the app name:
  //   base-mainnet.g.alchemy.com  → Base mainnet
  //   eth-mainnet.g.alchemy.com   → Ethereum mainnet
  //   polygon-mainnet.g.alchemy.com → Polygon mainnet
  // The app name (set at Alchemy dashboard) is tracked server-side by Alchemy
  // for analytics — it doesn't go in the URL.
  return `https://${ALCHEMY_NETWORK}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
}

/**
 * Should we try Alchemy for this call?
 * Returns true if Alchemy is configured AND the circuit is not OPEN.
 */
function _shouldTryAlchemy() {
  if (!isAlchemyConfigured()) return false;
  if (_circuitState === 'CLOSED') return true;
  if (_circuitState === 'DISABLED') return false;
  if (_circuitState === 'OPEN') {
    // Has the cooldown elapsed?
    if (Date.now() - _circuitOpenedAt >= CIRCUIT_OPEN_MS) {
      // HALF_OPEN: let one call through
      _circuitState = 'HALF_OPEN';
      return true;
    }
    return false;
  }
  if (_circuitState === 'HALF_OPEN') {
    return true; // only one call at a time gets here (no concurrency control,
    // but a successful call CLOSEs the circuit, a failed one re-OPENs it)
  }
  return false;
}

/**
 * Record a successful Alchemy call — CLOSE the circuit, reset failure count.
 */
function _recordAlchemySuccess() {
  if (_circuitState === 'HALF_OPEN' || _circuitState === 'OPEN') {
    _circuitState = 'CLOSED';
  }
  _failureCount = 0;
}

/**
 * Record a failed Alchemy call. If we're HALF_OPEN, immediately re-OPEN.
 * Otherwise, increment failure count and OPEN if threshold reached.
 */
function _recordAlchemyFailure(reason) {
  _lastFailureAt = Date.now();
  _failureCount++;
  if (_circuitState === 'HALF_OPEN') {
    _circuitState = 'OPEN';
    _circuitOpenedAt = Date.now();
    console.warn(`[blockchain-rpc-pool] Alchemy circuit re-opened (HALF_OPEN probe failed: ${reason})`);
  } else if (_failureCount >= CIRCUIT_FAILURE_THRESHOLD) {
    _circuitState = 'OPEN';
    _circuitOpenedAt = Date.now();
    console.warn(
      `[blockchain-rpc-pool] Alchemy circuit OPENED after ${_failureCount} failures (cooldown ${CIRCUIT_OPEN_MS / 1000}s). ` +
      `Falling back to public RPCs. Last failure: ${reason}`
    );
  } else {
    console.warn(
      `[blockchain-rpc-pool] Alchemy failure ${_failureCount}/${CIRCUIT_FAILURE_THRESHOLD}: ${reason}`
    );
  }
}

// ─── Alchemy RPC call ────────────────────────────────────────────────────

/**
 * Make a single JSON-RPC call to Alchemy with timeout.
 * Throws on any error (network, 429, 5xx, RPC error).
 * Returns the JSON-RPC `result` field.
 */
async function _callAlchemy(method, params) {
  if (!isAlchemyConfigured()) {
    throw new Error('Alchemy not configured (ALCHEMY_API_KEY env var unset)');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    const res = await fetch(alchemyUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });
    if (res.status === 429) {
      throw new Error('Alchemy returned 429 (rate limited)');
    }
    if (!res.ok) {
      throw new Error(`Alchemy returned HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data.error) {
      const msg = data.error.message || JSON.stringify(data.error);
      const err = new Error(`Alchemy RPC error: ${msg}`);
      err.rpcError = data.error;
      throw err;
    }
    if (data.result === undefined) {
      throw new Error('Alchemy response missing `result` field');
    }
    return data.result;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Fallback RPC call (delegated to base-rpc-pool.mjs) ───────────────────

async function _callFallback(method, params) {
  const pool = await getFallbackPool();
  const { result, label } = await pool.call(method, params);
  return { result, label };
}

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Make a JSON-RPC call to Base, with Alchemy primary + public fallback.
 *
 * @param {string} method - JSON-RPC method (e.g. 'eth_getTransactionReceipt')
 * @param {Array} params - JSON-RPC params
 * @returns {Promise<{result: any, source: string, label?: string}>}
 * @throws {Error} if both Alchemy and all fallback RPCs fail.
 */
async function call(method, params) {
  // 1. Try Alchemy first (if circuit is closed / half-open)
  if (_shouldTryAlchemy()) {
    try {
      const result = await _callAlchemy(method, params);
      _recordAlchemySuccess();
      return { result, source: 'alchemy' };
    } catch (e) {
      _recordAlchemyFailure(e.message);
      // Fall through to fallback
    }
  }

  // 2. Fallback to public RPC pool
  const { result, label } = await _callFallback(method, params);
  return { result, source: `fallback-${label}`, label };
}

/**
 * Fetch a transaction receipt, with caching (idempotent operation).
 *
 * Cache strategy:
 *   - Check tx-cache.mjs first (per-warm-instance memory cache, 5min TTL)
 *   - If miss, call RPC (Alchemy primary, public fallback)
 *   - Store result in tx-cache.mjs (negative results: 5min; positive: 5min
 *     — but callers should re-check via isTxHashUsed before issuing a
 *     license, so we don't need to cache positive results longer)
 *
 * @param {string} txHash
 * @returns {Promise<{receipt: Object|null, source: string, from_cache: boolean}>}
 */
export async function getTransactionReceipt(txHash) {
  if (!txHash) throw new Error('getTransactionReceipt: txHash required');

  // 1. Check cache
  const cached = txCache.get(txHash);
  if (cached && cached.receipt !== undefined) {
    return {
      receipt: cached.receipt,
      source: 'cache',
      from_cache: true,
    };
  }

  // 2. Fetch from RPC
  const { result: receipt, source } = await call('eth_getTransactionReceipt', [txHash]);

  // 3. Cache the result (both positive and negative — null means "tx not found yet")
  txCache.set(txHash, { receipt, ok: true });

  return { receipt, source, from_cache: false };
}

/**
 * Verify a USDC payment on Base. High-level wrapper around
 * getTransactionReceipt that checks:
 *   - tx exists
 *   - tx succeeded (status === '0x1')
 *   - tx has a Transfer event log from the USDC contract
 *   - the transfer is TO the expected recipient
 *   - the transfer amount equals the expected amount (in raw units, 6 decimals)
 *   - (optional) the transfer is FROM the expected sender
 *
 * @param {string} txHash
 * @param {bigint} expectedAmountRaw - expected amount in raw USDC units (6 decimals)
 * @param {string} expectedRecipient - expected `to` address (lowercase)
 * @param {Object} [opts]
 * @param {string} [opts.expectedFromWallet] - if set, validate `from` matches
 * @param {string} [opts.usdcContract] - default: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (Base USDC)
 * @returns {Promise<{ok: boolean, code?: string, receipt?: Object, from?: string, to?: string, amount?: number, source: string, from_cache: boolean}>}
 */
export async function verifyUSDCPayment(txHash, expectedAmountRaw, expectedRecipient, opts = {}) {
  const USDC_CONTRACT = (opts.usdcContract || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913').toLowerCase();
  const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  const expectedFrom = opts.expectedFromWallet ? opts.expectedFromWallet.toLowerCase() : null;

  let receiptInfo;
  try {
    receiptInfo = await getTransactionReceipt(txHash);
  } catch (e) {
    return { ok: false, code: 'rpc_error', error: e.message, source: 'unknown', from_cache: false };
  }

  const { receipt, source, from_cache } = receiptInfo;

  if (!receipt) {
    return { ok: false, code: 'tx_not_found', receipt: null, source, from_cache };
  }
  if (receipt.status !== '0x1') {
    return { ok: false, code: 'tx_failed', receipt, source, from_cache };
  }
  if (!receipt.logs || !Array.isArray(receipt.logs)) {
    return { ok: false, code: 'no_logs', receipt, source, from_cache };
  }

  for (const log of receipt.logs) {
    if (!log.address || log.address.toLowerCase() !== USDC_CONTRACT) continue;
    if (!log.topics || log.topics[0] !== TRANSFER_TOPIC) continue;
    const from = '0x' + log.topics[1].slice(26).toLowerCase();
    const to = '0x' + log.topics[2].slice(26).toLowerCase();
    const value = BigInt(log.data);
    if (to === expectedRecipient.toLowerCase()) {
      if (value !== BigInt(expectedAmountRaw)) {
        return {
          ok: false,
          code: 'amount_mismatch',
          receipt,
          expected: String(expectedAmountRaw),
          received: String(value),
          from, to, amount: Number(value),
          source, from_cache,
        };
      }
      if (expectedFrom && from !== expectedFrom) {
        return {
          ok: false,
          code: 'wrong_sender',
          receipt,
          expected_from: expectedFrom,
          actual_from: from,
          from, to, amount: Number(value),
          source, from_cache,
        };
      }
      return {
        ok: true,
        receipt,
        from, to, amount: Number(value),
        source, from_cache,
      };
    }
  }

  return {
    ok: false,
    code: 'no_transfer_to_recipient',
    receipt,
    expected_recipient: expectedRecipient,
    source, from_cache,
  };
}

/**
 * Get the current Base block number.
 * NOT cached — always fresh.
 *
 * @returns {Promise<{blockNumber: number, source: string}>}
 */
export async function getBlockNumber() {
  const { result, source } = await call('eth_blockNumber', []);
  // eth_blockNumber returns a hex string like "0x..."
  return {
    blockNumber: parseInt(result, 16),
    source,
  };
}

// ─── Stats (for /api/health) ──────────────────────────────────────────────

async function getStats() {
  const fallback = await getFallbackPool().then(p => p.getStats()).catch(() => null);
  return {
    alchemy: {
      configured: isAlchemyConfigured(),
      endpoint: isAlchemyConfigured() ? alchemyUrl().replace(/\/v2\/.+/, '/v2/<key>') : null,
      network: ALCHEMY_NETWORK,
      circuit_state: _circuitState,
      failure_count: _failureCount,
      last_failure_at: _lastFailureAt || null,
      circuit_opened_at: _circuitOpenedAt || null,
      cooldown_ms: CIRCUIT_OPEN_MS,
      failure_threshold: CIRCUIT_FAILURE_THRESHOLD,
    },
    fallback: fallback,
    receipt_cache: txCache.getStats(),
  };
}

// ─── Test helpers (only used in tests; safe to call from anywhere) ─────────

function _resetCircuit() {
  _circuitState = ALCHEMY_API_KEY ? 'CLOSED' : 'DISABLED';
  _failureCount = 0;
  _lastFailureAt = 0;
  _circuitOpenedAt = 0;
}

// ─── Exports ──────────────────────────────────────────────────────────────

export {
  call,
  isAlchemyConfigured,
  alchemyUrl,
  getStats,
  _resetCircuit,
  // Re-export circuit-breaker state for tests
  CIRCUIT_FAILURE_THRESHOLD,
  CIRCUIT_OPEN_MS,
  RPC_TIMEOUT_MS,
};
