/**
 * MarketNow — Mandates Read Cache
 * =================================
 *
 * PROBLEMA: Cada llamada a /api/mandates?id=xxx hace fetch a GitHub raw URL.
 *           GitHub API autenticado: 5000 req/hour. Con 100 usuarios activos
 *           hacíamos ~2000 req/hour solo en mandates → colapso.
 *
 * SOLUCIÓN:
 *   - Cache en memoria del módulo con TTL de 30s
 *   - Invalidación write-through: cuando escribimos, actualizamos cache
 *   - Para >500 usuarios, migrar a Upstash Redis
 *
 * NOTA: raw.githubusercontent.com NO cuenta contra el rate limit autenticado,
 *       pero SÍ tiene un límite anónimo (60/hora) por IP. El cache nos protege
 *       de ambos.
 */

const CACHE_TTL_MS = 30 * 1000; // 30 segundos
const _mandateCache = new Map(); // id -> { data, expiresAt }

/**
 * Obtiene un mandate del cache, o null si no está / expiró.
 */
function get(id) {
  const entry = _mandateCache.get(id);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _mandateCache.delete(id);
    return null;
  }
  return entry.data;
}

/**
 * Guarda un mandate en cache.
 */
function set(id, mandate) {
  if (!mandate) return;
  _mandateCache.set(id, {
    data: mandate,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Invalida un mandate del cache (después de write).
 */
function invalidate(id) {
  _mandateCache.delete(id);
}

/**
 * Invalida todo el cache (para tests).
 */
function invalidateAll() {
  _mandateCache.clear();
}

/**
 * Stats para /health.
 */
function getStats() {
  return {
    cached_mandates: _mandateCache.size,
    ttl_ms: CACHE_TTL_MS,
  };
}

module.exports = {
  get,
  set,
  invalidate,
  invalidateAll,
  getStats,
};
