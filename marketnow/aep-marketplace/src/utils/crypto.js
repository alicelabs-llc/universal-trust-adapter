// ─── Crypto Payment Utility ─────────────────────────────────
// Connects MetaMask → sends USDC on Base → returns tx hash

// Base Mainnet config
const BASE_CHAIN_ID = '0x2105'; // 8453
const BASE_CHAIN_CONFIG = {
  chainId: BASE_CHAIN_ID,
  chainName: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://mainnet.base.org'],
  blockExplorerUrls: ['https://basescan.org'],
};

// USDC on Base (official Circle deployment)
const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_DECIMALS = 6;

// Your payment wallet (from wrangler.worker.toml)
const PAYMENT_WALLET = '0x39Dddf5aEdb58A559CF195fB8bdF23F0604Bf5Ee';

// ERC-20 transfer function selector: transfer(address,uint256)
const TRANSFER_SELECTOR = '0xa9059cbb';

/**
 * Check if MetaMask is available
 */
export function hasMetaMask() {
  return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
}

/**
 * Connect to MetaMask and return the connected wallet address
 */
export async function connectWallet() {
  if (!hasMetaMask()) {
    throw new Error('MetaMask no está instalado. Instálalo desde metamask.io');
  }

  const accounts = await window.ethereum.request({
    method: 'eth_requestAccounts',
  });

  if (!accounts || accounts.length === 0) {
    throw new Error('No se pudo conectar a MetaMask');
  }

  return accounts[0];
}

/**
 * Switch MetaMask to Base network
 */
export async function switchToBase() {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_CHAIN_ID }],
    });
  } catch (switchError) {
    // Chain not added yet — add it
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [BASE_CHAIN_CONFIG],
      });
    } else {
      throw switchError;
    }
  }
}

/**
 * Encode ERC-20 transfer call data
 * transfer(address to, uint256 amount)
 */
function encodeTransfer(toAddress, amountUSDC) {
  // Convert USD amount to USDC smallest unit (6 decimals)
  const amountWei = BigInt(Math.round(amountUSDC * 10 ** USDC_DECIMALS));
  
  // Pad address to 32 bytes (remove 0x, left-pad to 64 hex chars)
  const paddedAddress = toAddress.slice(2).toLowerCase().padStart(64, '0');
  
  // Pad amount to 32 bytes
  const paddedAmount = amountWei.toString(16).padStart(64, '0');
  
  return TRANSFER_SELECTOR + paddedAddress + paddedAmount;
}

/**
 * Send USDC payment on Base network
 * @param {number} amountUSD - Amount in USD (= USDC, 1:1 peg)
 * @returns {{ txHash: string, walletAddress: string }}
 */
export async function sendUSDCPayment(amountUSD) {
  if (amountUSD <= 0) {
    throw new Error('El monto debe ser mayor a 0');
  }

  // 1. Connect wallet
  const walletAddress = await connectWallet();

  // 2. Switch to Base network
  await switchToBase();

  // 3. Encode the USDC transfer
  const data = encodeTransfer(PAYMENT_WALLET, amountUSD);

  // 4. Send the transaction via MetaMask
  const txHash = await window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [{
      from: walletAddress,
      to: USDC_CONTRACT,
      data: data,
      // Gas will be estimated by MetaMask
    }],
  });

  return { txHash, walletAddress };
}

import { API_BASE } from '../api/client';

/**
 * Full checkout flow:
 * 1. MetaMask payment
 * 2. Backend verification via /api/m2m-checkout
 * @returns {object} Backend response with order details
 */
export async function cryptoCheckout(skillId, amountUSD) {
  // Send the USDC payment
  const { txHash, walletAddress } = await sendUSDCPayment(amountUSD);

  // Wait a moment for the tx to propagate
  await new Promise(r => setTimeout(r, 2000));

  // Verify with backend
  const res = await fetch(`${API_BASE}/api/m2m-checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      skill_id: skillId,
      wallet_address: walletAddress,
      payment_network: 'base',
      tx_hash: txHash,
      amount: amountUSD,
    }),
  });

  const result = await res.json();

  if (!res.ok) {
    throw new Error(result.message || result.error || 'Error en la verificación');
  }

  return {
    ...result,
    txHash,
    walletAddress,
    explorerUrl: `https://basescan.org/tx/${txHash}`,
  };
}

export { PAYMENT_WALLET, USDC_CONTRACT, BASE_CHAIN_ID };
