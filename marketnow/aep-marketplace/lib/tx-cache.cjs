/**
 * MarketNow — USDC txHash Verification Cache
 * ===========================================
 *
 * PROBLEMA: Cada /api/agent-purchase con txHash hace 1 RPC call a Base.
 *           Si un agente reintenta 5 veces (network issues), hacemos 5 RPC calls
 *           para el mismo txHash. Base RPC público tiene rate limit no documentado.
 *
 * SOLUCIÓN:
 *   - Cache en memoria de txHash verificados (positivos Y negativos)
 *   - TTL de 5 minutos (suficiente para reintentos de agentes)
 *   - No persistente: en cold start se pierde, pero es acceptable
 *
 * NOTA: Esto NO reemplaza el anti-replay de _data/used_txs/ (que es persistente
 *       vía GitHub). Este cache es solo para reducir RPC calls durante reintentos.
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
const _txCache = new Map(); // txHash -> { result, expiresAt }

/**
 * Obtiene el resultado cacheado de verificar un txHash.
 * @returns {Object|null} { ok, code, ... } o null si no está en cache
 */
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

/**
 * Guarda el resultado de verificar un txHash.
 */
function set(txHash, result) {
  if (!txHash || !result) return;
  _txCache.set(txHash.toLowerCase(), {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Stats para /health.
 */
function getStats() {
  return {
    cached_txs: _txCache.size,
    ttl_ms: CACHE_TTL_MS,
  };
}

function invalidateAll() {
  _txCache.clear();
}

module.exports = {
  get,
  set,
  getStats,
  invalidateAll,
};
