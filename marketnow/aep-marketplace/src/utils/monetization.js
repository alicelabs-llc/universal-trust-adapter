/**
 * MarketNow — Monetization System
 * =================================
 *
 * Modelo de revenue completo:
 *
 * 1. COMPRADORES (agents + humans):
 *    - Pagan el precio de cada skill ($0.99 - $9.99)
 *    - MarketNow cobra 20% comisión al vendedor
 *
 * 2. VENDEDORES (sellers):
 *    - FREE TIER: hasta 3 skills gratis
 *    - PRO TIER: $9.99/mes → hasta 25 skills + featured badge + analytics
 *    - ENTERPRISE: $49.99/mes → unlimited + API + priority review
 *    - STORAGE FEE: $0.50 por skill/mes después del free tier
 *    - FEATURED LISTING: $4.99 por 30 días (boost en búsquedas)
 *    - VERIFIED SELLER: $19.99 one-time (badge + trust boost)
 *
 * 3. AFILIADOS:
 *    - 5% comisión por venta referida
 *    - Payout mensual vía Stripe Connect (min $50)
 */

export const TIERS = {
  FREE: {
    name: 'FREE',
    price: 0,
    period: 'forever',
    maxSkills: 3,
    features: [
      'Up to 3 skills listed',
      'Basic Sentinel L1 scan',
      'Standard review queue (24-48h)',
      'Community support',
    ],
    color: 'zinc',
  },
  PRO: {
    name: 'PRO',
    price: 9.99,
    period: 'month',
    maxSkills: 25,
    features: [
      'Up to 25 skills listed',
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
    price: 49.99,
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
    price: 4.99,
    period: '30 days',
    description: 'Boost your skill to the top of search results and the homepage featured section.',
  },
  VERIFIED_SELLER: {
    name: 'Verified Seller Badge',
    price: 19.99,
    period: 'one-time',
    description: 'Get a ✓ Verified badge on all your skills. Requires KYC verification.',
  },
  PRIORITY_REVIEW: {
    name: 'Priority Review',
    price: 2.99,
    period: 'per skill',
    description: 'Skip the queue. Your skill is reviewed within 6 hours instead of 24-48h.',
  },
};

export const COMMISSION = {
  seller: 0.80,    // Seller keeps 80%
  marketnow: 0.20, // MarketNow takes 20% (15% when affiliate is used)
  affiliate: 0.05, // Affiliate gets 5% (deducted from MarketNow's share, not seller's)
};

export const STORAGE_FEE = {
  freeThreshold: 3,    // First 3 skills free
  pricePerSkill: 0.50, // $0.50 per skill per month after threshold
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
 * In production, this would come from the backend (Stripe subscription status).
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
 * Feature a skill for 30 days (after payment).
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
