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
 */

const CACHE_TTL_MS = 30 * 1000;
const _mandateCache = new Map();

function get(id) {
  const entry = _mandateCache.get(id);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _mandateCache.delete(id);
    return null;
  }
  return entry.data;
}

function set(id, mandate) {
  if (!mandate) return;
  _mandateCache.set(id, {
    data: mandate,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function invalidate(id) {
  _mandateCache.delete(id);
}

function invalidateAll() {
  _mandateCache.clear();
}

function getStats() {
  return {
    cached_mandates: _mandateCache.size,
    ttl_ms: CACHE_TTL_MS,
  };
}

export {
  get,
  set,
  invalidate,
  invalidateAll,
  getStats,
};
