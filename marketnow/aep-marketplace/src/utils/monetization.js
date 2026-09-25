/**
 * MarketNow — Monetization System
 * =================================
 *
 * MODELO CANÓNICO (agent.json → pricing_source_of_truth; audit-6th-round):
 *
 * 1. COMPRADORES (agents + humans):
 *    - Sin platform fee. 68,387 de 68,388 skills se instalan gratis.
 *    - Skills premium: precio fijado por el vendedor (comisión 20% MarketNow).
 *    - Vendor-priced usage (x402, USDC on Base) se factura 100% vendor-side.
 *
 * 2. VENDEDORES (sellers):
 *    - Listing gratis e ilimitado. Los vendedores conservan el 80% de cada
 *      venta premium (MarketNow 20%).
 *    - Suscripciones opcionales: Sentinel PRO $9.99/mo, ENTERPRISE $49.99/mo.
 *
 * 3. AFILIADOS:
 *    - 5% de la parte de MarketNow en ventas premium referidas.
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
    price: 9.99,
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
    price: 0,
    period: 'included in PRO',
    description: 'Included with Sentinel PRO ($9.99/mo): boost your skill to the top of search results and the homepage featured section.',
  },
  VERIFIED_SELLER: {
    name: 'Verified Seller Badge',
    price: 0,
    period: 'included in ENTERPRISE',
    description: 'Included with Sentinel ENTERPRISE ($49.99/mo): ✓ Verified badge on all your skills. Requires KYC verification.',
  },
  PRIORITY_REVIEW: {
    name: 'Priority Review',
    price: 0,
    period: 'included in PRO',
    description: 'Included with Sentinel PRO ($9.99/mo): your skill is reviewed within 6 hours instead of 24-48h.',
  },
};

export const COMMISSION = {
  seller: 0.80,     // Seller keeps 80% of premium sales
  marketnow: 0.20,  // MarketNow takes 20% commission
  affiliate: 0.05,  // Affiliates earn 5% (from MarketNow's share)
};

export const STORAGE_FEE = {
  freeThreshold: Infinity, // unlimited free listings — no storage fees, ever
  pricePerSkill: 0, // moot: listing is free
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
