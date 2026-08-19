/**
 * MarketNow — USDC txHash Verification Cache
 * ===========================================
 *
 * PROBLEMA: Cada /api/agent-purchase con txHash hace 1 RPC call a Base.
 *           Si un agente reintenta 5 veces, hacemos 5 RPC calls.
 *
 * SOLUCIÓN:
 *   - Cache en memoria de txHash verificados (positivos Y negativos)
 *   - TTL de 5 minutos
 */

const CACHE_TTL_MS = 5 * 60 * 1000;
const _txCache = new Map();

function get(txHash) {
  if (!txHash) return null;
  const entry = _txCache.get(txHash.toLowerCase());
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _txCache.delete(txHash.toLowerCase());
    return null;
  }
  return entry.result;
}

function set(txHash, result) {
  if (!txHash || !result) return;
  _txCache.set(txHash.toLowerCase(), {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function getStats() {
  return {
    cached_txs: _txCache.size,
    ttl_ms: CACHE_TTL_MS,
  };
}

function invalidateAll() {
  _txCache.clear();
}

export {
  get,
  set,
  getStats,
  invalidateAll,
};
