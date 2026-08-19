/**
 * MarketNow — Base RPC Pool with Fallback
 * =========================================
 *
 * PROBLEMA: Usábamos solo `https://mainnet.base.org` (público, sin SLA,
 *           rate limit no documentado). 100 usuarios concurrentes podían
 *           saturarlo → 429s y timeouts.
 *
 * SOLUCIÓN:
 *   - Pool de 4 RPCs públicos de Base
 *   - Round-robin simple entre ellos
 *   - Si uno falla (429/timeout), marca como "bad" por 60s y prueba el siguiente
 *   - Si todos fallan, error claro al cliente
 *
 * RPCs públicos (todos gratis, sin API key):
 *   1. https://mainnet.base.org                     (oficial)
 *   2. https://base.gateway.tenderly.co             (Tenderly)
 *   3. https://base-rpc.publicnode.com              (PublicNode)
 *   4. https://1rpc.io/base                         (1RPC)
 *
 * Para producción seria, recomendado: Alchemy/QuickNode/Infura con API key.
 */

const RPC_ENDPOINTS = [
  { url: 'https://mainnet.base.org', label: 'base-official' },
  { url: 'https://base.gateway.tenderly.co', label: 'tenderly' },
  { url: 'https://base-rpc.publicnode.com', label: 'publicnode' },
  { url: 'https://1rpc.io/base', label: '1rpc' },
];

const BAD_TTL_MS = 60 * 1000; // 1 min en el doghouse
const RPC_TIMEOUT_MS = 5000;  // 5s timeout por RPC

// Estado del pool (module-level, sobrevive warm starts)
let _roundRobinIdx = 0;
const _badEndpoints = new Map(); // label -> badUntil timestamp

function _isBad(endpoint) {
  const badUntil = _badEndpoints.get(endpoint.label);
  if (!badUntil) return false;
  if (Date.now() > badUntil) {
    _badEndpoints.delete(endpoint.label);
    return false;
  }
  return true;
}

function _markBad(endpoint) {
  _badEndpoints.set(endpoint.label, Date.now() + BAD_TTL_MS);
  console.warn(`[base-rpc-pool] Marked ${endpoint.label} as bad for ${BAD_TTL_MS / 1000}s`);
}

function _getNextHealthy() {
  // Probar hasta N endpoints (round-robin)
  for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
    const endpoint = RPC_ENDPOINTS[_roundRobinIdx % RPC_ENDPOINTS.length];
    _roundRobinIdx++;
    if (!_isBad(endpoint)) {
      return endpoint;
    }
  }
  return null; // todos están bad
}

/**
 * Hace una llamada JSON-RPC a Base, con fallback entre endpoints.
 *
 * @param {string} method - método RPC (ej: 'eth_getTransactionReceipt')
 * @param {Array} params - params del método
 * @returns {Object} { result, label } o lanza error
 */
async function call(method, params) {
  const tried = [];
  let lastError = null;

  for (let attempt = 0; attempt < RPC_ENDPOINTS.length; attempt++) {
    const endpoint = _getNextHealthy();
    if (!endpoint) {
      throw new Error('All Base RPC endpoints are temporarily unavailable');
    }
    tried.push(endpoint.label);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);

      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.status === 429) {
        _markBad(endpoint);
        lastError = new Error(`${endpoint.label} returned 429`);
        continue;
      }
      if (!res.ok) {
        _markBad(endpoint);
        lastError = new Error(`${endpoint.label} returned HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      if (data.error) {
        // No marcar como bad — es un error de la transacción, no del RPC
        throw new Error(`RPC error: ${data.error.message || JSON.stringify(data.error)}`);
      }

      return { result: data.result, label: endpoint.label };
    } catch (e) {
      if (e.name === 'AbortError') {
        _markBad(endpoint);
        lastError = new Error(`${endpoint.label} timeout after ${RPC_TIMEOUT_MS}ms`);
      } else if (e.message?.startsWith('RPC error:')) {
        throw e; // error de la tx, no del RPC
      } else {
        _markBad(endpoint);
        lastError = e;
      }
      continue;
    }
  }

  throw new Error(`All RPC endpoints failed. Tried: ${tried.join(', ')}. Last error: ${lastError?.message}`);
}

/**
 * Stats para /health.
 */
function getStats() {
  return {
    endpoints: RPC_ENDPOINTS.map(e => ({
      label: e.label,
      url: e.url,
      bad: _isBad(e),
    })),
    round_robin_idx: _roundRobinIdx,
  };
}

module.exports = {
  call,
  getStats,
  RPC_ENDPOINTS,
};
