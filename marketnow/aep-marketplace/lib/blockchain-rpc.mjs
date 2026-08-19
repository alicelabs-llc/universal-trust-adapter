// ============================================================================
// MarketNow — Blockchain RPC with Alchemy (dedicated) + fallback
// ============================================================================
// Replaces public RPCs (which have no SLA and 429 on high traffic).
//
// Setup:
//   1. Get free API key at https://www.alchemy.com/ (300 req/sec, 1M req/month)
//   2. Set Vercel env var: ALCHEMY_API_KEY=your_key
// ============================================================================

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

// Alchemy URLs (with API key)
const ALCHEMY_URLS = {
  base_mainnet: ALCHEMY_API_KEY
    ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
    : null,
  ethereum_mainnet: ALCHEMY_API_KEY
    ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
    : null,
};

// Fallback public RPCs (round-robin)
const FALLBACK_RPCS = {
  base: [
    'https://base-rpc.publicnode.com',
    'https://1rpc.io/base',
    'https://mainnet.base.org',
  ],
  ethereum: [
    'https://ethereum.publicnode.com',
    'https://1rpc.io/eth',
    'https://cloudflare-eth.com',
  ],
};

// Track RPC health (in-memory — Vercel Edge)
const rpcHealth = {
  alchemy: { ok: true, lastError: null, lastSuccess: Date.now() },
  fallback: { base: { ok: true, lastErrorIdx: -1 }, ethereum: { ok: true, lastErrorIdx: -1 } },
};

// ============================================================================
// JSON-RPC call with fallback
// ============================================================================

/**
 * Make a JSON-RPC call to a blockchain RPC.
 * Tries Alchemy first (dedicated, has SLA), falls back to public RPCs.
 *
 * @param {string} method - JSON-RPC method (e.g., 'eth_getTransactionReceipt')
 * @param {Array} params - Method parameters
 * @param {string} network - 'base' or 'ethereum'
 * @returns {Promise<Object>} - The result field of the JSON-RPC response
 */
export async function rpcCall(method, params, network = 'base') {
  // Try Alchemy first
  const alchemyUrl = network === 'base' ? ALCHEMY_URLS.base_mainnet : ALCHEMY_URLS.ethereum_mainnet;
  if (alchemyUrl) {
    try {
      const result = await makeRpcCall(alchemyUrl, method, params);
      rpcHealth.alchemy.ok = true;
      rpcHealth.alchemy.lastSuccess = Date.now();
      return result;
    } catch (e) {
      rpcHealth.alchemy.ok = false;
      rpcHealth.alchemy.lastError = e.message;
      console.warn(`Alchemy RPC failed (${network}): ${e.message}, falling back to public RPCs`);
    }
  }

  // Fall back to public RPCs (round-robin)
  const fallbackList = FALLBACK_RPCS[network] || FALLBACK_RPCS.base;
  const lastErrorIdx = rpcHealth.fallback[network].lastErrorIdx;
  const startIdx = (lastErrorIdx + 1) % fallbackList.length;

  for (let i = 0; i < fallbackList.length; i++) {
    const idx = (startIdx + i) % fallbackList.length;
    const rpc = fallbackList[idx];
    try {
      const result = await makeRpcCall(rpc, method, params);
      rpcHealth.fallback[network].ok = true;
      rpcHealth.fallback[network].lastErrorIdx = -1;
      return result;
    } catch (e) {
      rpcHealth.fallback[network].lastErrorIdx = idx;
      console.warn(`Public RPC ${rpc} failed (${network}): ${e.message}`);
      continue;
    }
  }

  throw new Error(`All RPCs failed for ${network} (method: ${method})`);
}

async function makeRpcCall(url, method, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'MarketNow/5.0 (https://marketnow.site)',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: 1,
    }),
    signal: AbortSignal.timeout(5000), // 5s timeout per RPC
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`RPC error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  return data.result;
}

// ============================================================================
// Convenience methods
// ============================================================================

/**
 * Verify a USDC payment transaction on Base L2.
 *
 * @param {string} txHash - The transaction hash
 * @param {string} expectedTo - Expected recipient address
 * @param {string} expectedAmount - Expected amount in atomic units (6 decimals for USDC)
 * @returns {Promise<{valid: boolean, receipt: Object, error?: string}>}
 */
export async function verifyUsdcPayment(txHash, expectedTo, expectedAmount) {
  try {
    const receipt = await rpcCall('eth_getTransactionReceipt', [txHash], 'base');
    if (!receipt) {
      return { valid: false, error: 'transaction not found' };
    }

    // Check status
    if (receipt.status !== '0x1') {
      return { valid: false, receipt, error: 'transaction failed (reverted)' };
    }

    // Get transaction details for value + to
    const tx = await rpcCall('eth_getTransactionByHash', [txHash], 'base');
    if (!tx) {
      return { valid: false, error: 'transaction details not found' };
    }

    // Check recipient
    if (tx.to?.toLowerCase() !== expectedTo.toLowerCase()) {
      return { valid: false, receipt, error: `wrong recipient: expected ${expectedTo}, got ${tx.to}` };
    }

    // For ERC-20 transfers, parse the logs
    // USDC contract on Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    // Transfer event signature: 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df588b3ee
    const transferEvent = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df588b3ee';

    const transferLog = receipt.logs?.find(log =>
      log.topics?.[0]?.toLowerCase() === transferEvent
    );

    if (transferLog) {
      // Parse amount from data (last 32 bytes)
      const amountHex = '0x' + transferLog.data.slice(-64);
      const actualAmount = BigInt(amountHex).toString();
      if (actualAmount !== expectedAmount) {
        return { valid: false, receipt, error: `wrong amount: expected ${expectedAmount}, got ${actualAmount}` };
      }
    } else if (tx.value && tx.value !== '0x0') {
      // Native ETH transfer
      const actualAmount = BigInt(tx.value).toString();
      if (actualAmount !== expectedAmount) {
        return { valid: false, receipt, error: `wrong amount: expected ${expectedAmount}, got ${actualAmount}` };
      }
    }

    return { valid: true, receipt };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

/**
 * Get the current block number.
 */
export async function getCurrentBlockNumber(network = 'base') {
  return parseInt(await rpcCall('eth_blockNumber', [], network), 16);
}

/**
 * Check RPC health (for monitoring).
 */
export function getRpcHealth() {
  return {
    alchemy: rpcHealth.alchemy,
    fallback: rpcHealth.fallback,
    alchemy_configured: !!ALCHEMY_API_KEY,
  };
}
