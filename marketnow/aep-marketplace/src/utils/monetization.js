/**
 * MarketNow — Monetization System
 * =================================
 *
 * MODELO ACTUAL (2026-09-03): TODO ES FREE.
 *
 * 1. COMPRADORES (agents + humans):
 *    - Todas las skills son gratuitas. Sin pagos, sin suscripciones.
 *
 * 2. VENDEDORES (sellers):
 *    - Publicación ilimitada y gratuita.
 *    - Sentinel audits gratuitos.
 *    - Sin comisiones, sin storage fees, sin addons pagos.
 *
 * 3. AFILIADOS:
 *    - No hay programa de afiliados: no hay nada que comprar.
 *
 * Las constantes de precio se mantienen en 0 por compatibilidad de la UI.
 */

export const TIERS = {
  FREE: {
    name: 'FREE',
    price: 0,
    period: 'forever',
    maxSkills: Infinity,
    features: [
      'Unlimited free listings',
      'Basic Sentinel L1 scan',
      'Standard review queue (24-48h)',
      'Community support',
    ],
    color: 'zinc',
  },
  PRO: {
    name: 'PRO',
    price: 0,
    period: 'month',
    maxSkills: Infinity,
    features: [
      'Unlimited free listings',
      'Priority Sentinel scan (< 6h)',
      'Featured badge on listings',
      'Analytics dashboard',
      'Custom slug URLs',
      'Email support',
    ],
    color: '#00F299',
  },
  ENTERPRISE: {
    name: 'ENTERPRISE',
    price: 0,
    period: 'month',
    maxSkills: Infinity,
    features: [
      'Unlimited skills',
      'Instant Sentinel scan (< 1h)',
      'Premium featured placement',
      'Advanced analytics + revenue reports',
      'API access for bulk operations',
      'Dedicated account manager',
      'Custom commission rates (negotiable)',
      'Priority support (Slack channel)',
    ],
    color: '#a892ff',
  },
};

export const ADDONS = {
  FEATURED_LISTING: {
    name: 'Featured Listing',
    price: 0,
    period: '30 days',
    description: 'Boost your skill to the top of search results and the homepage featured section.',
  },
  VERIFIED_SELLER: {
    name: 'Verified Seller Badge',
    price: 0,
    period: 'free',
    description: 'Get a ✓ Verified badge on all your skills. Requires KYC verification.',
  },
  PRIORITY_REVIEW: {
    name: 'Priority Review',
    price: 0,
    period: 'per skill',
    description: 'Skip the queue. Your skill is reviewed within 6 hours instead of 24-48h.',
  },
};

export const COMMISSION = {
  seller: 1.00,    // Seller keeps 100% (nothing is charged)
  marketnow: 0.00, // MarketNow charges nothing
  affiliate: 0.00, // No affiliate program (nothing to buy)
};

export const STORAGE_FEE = {
  freeThreshold: Infinity, // unlimited free listings
  pricePerSkill: 0, // moot: nothing is charged
  period: 'month',
};

/**
 * Calculate monthly cost for a seller based on number of skills and tier.
 */
export function calculateMonthlyCost(tier, skillCount) {
  const t = TIERS[tier] || TIERS.FREE;

  // Base subscription
  let cost = t.price;

  // Storage fee (only for FREE tier — PRO/ENTERPRISE include storage)
  if (tier === 'FREE' && skillCount > STORAGE_FEE.freeThreshold) {
    const extraSkills = skillCount - STORAGE_FEE.freeThreshold;
    cost += extraSkills * STORAGE_FEE.pricePerSkill;
  }

  return cost;
}

/**
 * Check if a user can submit another skill based on their tier and current count.
 */
export function canSubmitSkill(currentSkillCount, tier) {
  const t = TIERS[tier] || TIERS.FREE;
  return currentSkillCount < t.maxSkills;
}

/**
 * Calculate the cost to submit additional skills beyond the free tier.
 */
export function calculateSubmissionCost(currentCount, newSubmissions, tier) {
  if (tier !== 'FREE') return 0; // PRO/ENTERPRISE include submissions

  const freeRemaining = Math.max(0, STORAGE_FEE.freeThreshold - currentCount);
  const paidSubmissions = Math.max(0, newSubmissions - freeRemaining);
  return paidSubmissions * STORAGE_FEE.pricePerSkill;
}

/**
 * Calculate earnings for a seller per sale.
 */
export function calculateSellerEarnings(priceUsd) {
  return priceUsd * COMMISSION.seller;
}

/**
 * Calculate MarketNow commission per sale.
 */
export function calculateMarketnowRevenue(priceUsd) {
  return priceUsd * COMMISSION.marketnow;
}

/**
 * Calculate affiliate payout per sale.
 */
export function calculateAffiliatePayout(priceUsd) {
  return priceUsd * COMMISSION.affiliate;
}

/**
 * Get the user's current tier from localStorage.
 * In production, this would come from the backend. Everything is free — no Stripe.
 */
export function getUserTier() {
  try {
    return localStorage.getItem('mn_tier') || 'FREE';
  } catch {
    return 'FREE';
  }
}

/**
 * Get the user's submitted skill count.
 * In production, this would query the backend.
 * For now, count submissions in localStorage.
 */
export function getUserSkillCount() {
  try {
    const raw = localStorage.getItem('mn_submissions');
    return raw ? JSON.parse(raw).length : 0;
  } catch {
    return 0;
  }
}

/**
 * Record a new submission in localStorage.
 */
export function recordSubmission(skillSlug) {
  try {
    const raw = localStorage.getItem('mn_submissions');
    const subs = raw ? JSON.parse(raw) : [];
    subs.push({ slug: skillSlug, submittedAt: new Date().toISOString() });
    localStorage.setItem('mn_submissions', JSON.stringify(subs));
    return subs.length;
  } catch {
    return 0;
  }
}

/**
 * Check if user has the Verified Seller badge.
 */
export function hasVerifiedBadge() {
  try {
    return localStorage.getItem('mn_verified_seller') === 'true';
  } catch {
    return false;
  }
}

/**
 * Check if a skill is currently featured.
 */
export function isSkillFeatured(skillId) {
  try {
    const raw = localStorage.getItem('mn_featured_skills');
    const featured = raw ? JSON.parse(raw) : {};
    const entry = featured[skillId];
    if (!entry) return false;
    return new Date(entry.expiresAt) > new Date();
  } catch {
    return false;
  }
}

/**
 * Feature a skill for 30 days (free).
 */
export function featureSkill(skillId) {
  try {
    const raw = localStorage.getItem('mn_featured_skills');
    const featured = raw ? JSON.parse(raw) : {};
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    featured[skillId] = { expiresAt: expiresAt.toISOString() };
    localStorage.setItem('mn_featured_skills', JSON.stringify(featured));
    return true;
  } catch {
    return false;
  }
}
