/**
 * MarketNow — Affiliate Program
 *
 * Permite a cualquier persona generar un link de afiliado.
 * Cuando alguien compra vía ese link, el afiliado recibe 5% del revenue.
 *
 * Implementación client-side (sin backend):
 *  - El ref code se guarda en localStorage del comprador
 *  - Al completar compra, el ref code se incluye en el metadata
 *  - El equipo de MarketNow procesa los payouts mensualmente
 *
 * Para producción: migrar a backend con tracking real de cookies
 * y validación de conversions.
 */

const REF_KEY = 'mn_affiliate_ref';
const GENERATED_KEY = 'mn_affiliate_codes';

/**
 * Generate a unique affiliate code for a user.
 * Format: aff_<8chars>
 */
export function generateAffiliateCode(username) {
  const seed = (username || 'anon') + Date.now() + Math.random();
  const hash = Array.from(seed).reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffffffff, 0);
  const code = 'aff_' + Math.abs(hash).toString(36).padStart(8, '0').slice(0, 8);
  return code;
}

/**
 * Get or create an affiliate code for the current user.
 */
export function getMyAffiliateCode(username) {
  try {
    const stored = localStorage.getItem(GENERATED_KEY);
    const codes = stored ? JSON.parse(stored) : {};
    const key = username || 'anonymous';
    if (codes[key]) return codes[key];
    const newCode = generateAffiliateCode(key);
    codes[key] = newCode;
    localStorage.setItem(GENERATED_KEY, JSON.stringify(codes));
    return newCode;
  } catch {
    return generateAffiliateCode(username);
  }
}

/**
 * Build an affiliate URL for a skill.
 * Format: https://marketnow.site/skill/<id>?ref=<code>
 */
export function buildAffiliateUrl(skillId, affiliateCode) {
  const base = `https://marketnow.site/skill/${skillId}`;
  return affiliateCode ? `${base}?ref=${affiliateCode}` : base;
}

/**
 * Capture affiliate ref from URL if present.
 * Stores in localStorage so it persists across the session.
 */
export function captureAffiliateRef() {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref && ref.startsWith('aff_')) {
    localStorage.setItem(REF_KEY, ref);
    // Clean the URL
    params.delete('ref');
    const remaining = params.toString();
    const newPath = window.location.pathname + (remaining ? '?' + remaining : '');
    window.history.replaceState({}, '', newPath);
  }
}

/**
 * Get the current affiliate ref (for including in purchase metadata).
 */
export function getCurrentRef() {
  try {
    return localStorage.getItem(REF_KEY) || null;
  } catch {
    return null;
  }
}

/**
 * Calculate affiliate payout for a sale.
 * 5% of the sale price (before MarketNow's 20% commission).
 */
export function calculateAffiliatePayout(priceUsd) {
  return priceUsd * 0.05;
}

/**
 * Calculate seller earnings (after MarketNow 20% commission).
 */
export function calculateSellerEarnings(priceUsd) {
  return priceUsd * 0.80;
}

/**
 * Calculate MarketNow's commission.
 */
export function calculateCommission(priceUsd) {
  return priceUsd * 0.20;
}
