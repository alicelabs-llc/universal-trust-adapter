/**
 * MarketNow — Stripe Integration (Frontend)
 * =========================================
 *
 * Publishable key es seguro para el frontend (va en el bundle JS).
 * El secret key (sk_live_) NUNCA va aquí — solo en el backend (Vercel env var).
 *
 * Flujo de pago:
 *  1. Usuario hace click en "PAY $X.XX" en /skill/:id
 *  2. Frontend llama a POST /api/create-checkout-session con { skillId }
 *  3. Backend (serverless function en Vercel) crea una Stripe Checkout Session
 *  4. Backend devuelve { url } (la URL de Stripe Checkout)
 *  5. Frontend redirige a esa URL
 *  6. Usuario paga en Stripe (hosted page)
 *  7. Stripe redirige de vuelta a /vault?success=true&skillId=X
 *  8. Stripe envía webhook a /api/stripe-webhook (serverless function)
 *  9. Backend marca la compra como completada y otorga la licencia
 */

import { loadStripe } from '@stripe/stripe-js';

// Publishable key — safe to expose in frontend
// To rotate: change in Stripe Dashboard → Developers → API Keys
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51T6g98H8EvMHxDjnzDW7pe1WwHqCHpE4vQ71TztyBDG0XKImIj45n4D8oc7sVtqoP4kw1a9mg4ZlumE3rLaDyD9W00cxd8LWuD';

// Backend URL — the serverless function that creates checkout sessions
// When deployed to Vercel, this is the same domain. For local dev, it's localhost:3001.
const API_BASE = import.meta.env.VITE_API_URL || '';

let stripePromise = null;

/**
 * Get the Stripe.js instance (lazy-loaded, singleton).
 */
export function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
}

/**
 * Create a checkout session for a skill and redirect to Stripe Checkout.
 *
 * @param {string} skillId - The skill ID (e.g. mn-ai-00001)
 * @param {string} affiliateCode - Optional affiliate code (for 5% commission)
 * @returns {Promise<void>} - Redirects to Stripe Checkout
 */
export async function checkoutSkill(skillId, affiliateCode = null) {
  try {
    // Call the backend to create a Checkout Session
    const response = await fetch(`${API_BASE}/api/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skillId,
        affiliateCode,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Failed to create checkout session (${response.status})`);
    }

    const { url, sessionId } = await response.json();

    // Redirect to Stripe Checkout (hosted page)
    if (url) {
      window.location.href = url;
    } else {
      // Fallback: use Stripe.js to redirect to the session
      const stripe = await getStripe();
      const result = await stripe.redirectToCheckout({ sessionId });
      if (result.error) {
        throw new Error(result.error.message);
      }
    }
  } catch (err) {
    console.error('Checkout error:', err);
    throw err;
  }
}

/**
 * Check if the current URL indicates a successful checkout.
 * Stripe redirects back with ?success=true&skillId=X
 */
export function isCheckoutSuccess() {
  const params = new URLSearchParams(window.location.search);
  return params.get('success') === 'true';
}

/**
 * Get the skill ID from a successful checkout redirect.
 */
export function getCheckoutSkillId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('skillId');
}

/**
 * Clean the checkout params from the URL (after processing).
 */
export function cleanCheckoutParams() {
  const params = new URLSearchParams(window.location.search);
  params.delete('success');
  params.delete('skillId');
  params.delete('session_id');
  const remaining = params.toString();
  const newUrl = window.location.pathname + (remaining ? '?' + remaining : '');
  window.history.replaceState({}, '', newUrl);
}

export { STRIPE_PUBLISHABLE_KEY };
