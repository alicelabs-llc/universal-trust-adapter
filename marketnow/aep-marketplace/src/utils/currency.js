/**
 * MarketNow — Multi-currency display utility
 *
 * Convierte precios USD a otras monedas para mostrar en UI.
 * Para agentes: las conversiones son aproximadas (rates fijos).
 * El pago real siempre se procesa en USD via Stripe o USDC on-chain.
 *
 * Soportado: USD, USDC (1:1 con USD), ETH, EUR, JPY, CNY
 */

const RATES = {
  USD: 1,
  USDC: 1, // 1:1 peg
  ETH: 1 / 3500, // ~$3500 per ETH (approximate, refresh periodically)
  EUR: 0.92,
  JPY: 150,
  CNY: 7.25,
  GBP: 0.79,
};

const SYMBOLS = {
  USD: '$',
  USDC: '◈', // diamond for crypto
  ETH: 'Ξ',
  EUR: '€',
  JPY: '¥',
  CNY: '¥',
  GBP: '£',
};

export const SUPPORTED_CURRENCIES = Object.keys(RATES);

/**
 * Convert USD to target currency.
 */
export function convert(usdAmount, currency = 'USD') {
  const rate = RATES[currency];
  if (!rate) return usdAmount;
  return usdAmount * rate;
}

/**
 * Format a price in the target currency.
 */
export function formatPrice(usdAmount, currency = 'USD') {
  const converted = convert(usdAmount, currency);
  const symbol = SYMBOLS[currency] || '';

  if (currency === 'USDC') {
    return `${converted.toFixed(2)} USDC`;
  }
  if (currency === 'ETH') {
    return `${symbol}${converted.toFixed(4)} ETH`;
  }
  if (currency === 'JPY' || currency === 'CNY') {
    return `${symbol}${Math.round(converted)}`;
  }
  return `${symbol}${converted.toFixed(2)}`;
}

/**
 * Get all currency representations for a price (for tooltips / dropdowns).
 */
export function getAllPrices(usdAmount) {
  return SUPPORTED_CURRENCY.map(c => ({
    currency: c,
    formatted: formatPrice(usdAmount, c),
    raw: convert(usdAmount, c),
  }));
}
const SUPPORTED_CURRENCY = SUPPORTED_CURRENCIES;
