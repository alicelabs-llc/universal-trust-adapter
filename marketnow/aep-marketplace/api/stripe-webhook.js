/**
 * MarketNow — Stripe Webhook Handler
 * ===================================
 *
 * Serverless function (Vercel) — receives Stripe webhooks.
 * Needs STRIPE_WEBHOOK_SECRET environment variable.
 *
 * Endpoint: POST /api/stripe-webhook
 *
 * Setup:
 *  1. Deploy this function to Vercel
 *  2. Go to Stripe Dashboard → Developers → Webhooks → Add endpoint
 *  3. URL: https://your-vercel-app.vercel.app/api/stripe-webhook
 *  4. Events to send: checkout.session.completed, payment_intent.payment_failed
 *  5. Copy the signing secret (whsec_xxx)
 *  6. Set env var: STRIPE_WEBHOOK_SECRET=whsec_xxx (in Vercel)
 *
 * What this does:
 *  - On successful payment: marks the skill as purchased for the buyer
 *  - Records the commission (20% MarketNow, 80% seller, 5% affiliate if applicable)
 *  - Triggers an email receipt (future: via SendGrid/Resend)
 *  - Updates the buyer's vault
 */

import Stripe from 'stripe';
import crypto from 'crypto';

// H4 FIX: fail fast si STRIPE_SECRET_KEY no está configurada
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_KEY) {
  console.error('CRITICAL: STRIPE_SECRET_KEY is not set. Webhook verification will fail.');
}
const stripe = STRIPE_KEY ? new Stripe(STRIPE_KEY) : null;
const CLIENT_URL = process.env.CLIENT_URL || 'https://marketnow.site';

/**
 * Verify the webhook signature (security critical).
 */
function verifySignature(payload, signature, secret) {
  if (!stripe) return null;
  try {
    const event = stripe.webhooks.constructEvent(payload, signature, secret);
    return event;
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return null;
  }
}

/**
 * Process a successful checkout.
 * In production, this would:
 *  1. Save the purchase to a database
 *  2. Generate a license key
 *  3. Send an email receipt
 *  4. Update the seller's balance
 *  5. Update the affiliate's balance (if affiliate_code in metadata)
 */
async function handleCheckoutComplete(session) {
  const metadata = session.metadata || {};
  const skillId = metadata.skill_id;
  const skillName = metadata.skill_name;
  const skillPrice = parseFloat(metadata.skill_price || '0');
  const commissionRate = parseFloat(metadata.commission_rate || '0.20');
  const affiliateCode = metadata.affiliate_code || '';

  const sellerEarnings = skillPrice * (1 - commissionRate);
  const marketnowRevenue = skillPrice * commissionRate;
  const affiliatePayout = affiliateCode ? skillPrice * 0.05 : 0;

  // L2 FIX: license key determinístico (SHA-256 de sessionId:skillId)
  const licenseKey = `MN-STRIPE-${skillId?.slice(-8).toUpperCase() || 'XXXX'}-${crypto.createHash('sha256').update(`${session.id}:${skillId}`).digest('hex').slice(0, 12).toUpperCase()}`;

  // H5 FIX: idempotencia — verificar si ya existe el archivo antes de escribir
  try {
    const cfg = {
      token: process.env.MANDATES_GITHUB_TOKEN,
      repo: process.env.MANDATES_REPO || 'alicelabs-llc/marketnow',
      branch: process.env.MANDATES_BRANCH || 'master',
    };
    if (cfg.token) {
      const filename = `stripe_${session.id}.json`;
      const checkUrl = `https://api.github.com/repos/${cfg.repo}/contents/_data/purchases/${filename}?ref=${encodeURIComponent(cfg.branch)}`;
      const existsResp = await fetch(checkUrl, {
        headers: {
          'User-Agent': 'marketnow-stripe-webhook',
          Authorization: `Bearer ${cfg.token}`,
        },
      });
      if (existsResp.status === 200) {
        // Ya procesado — idempotency hit
        console.log(`[stripe-webhook] Duplicate event for ${session.id}, skipping (idempotent)`);
        return { success: true, already_processed: true, licenseKey };
      }

      console.log('✅ Payment successful:', {
        sessionId: session.id,
        skillId,
        skillName,
        price: skillPrice,
        sellerEarnings,
        marketnowRevenue,
        affiliatePayout,
        affiliateCode,
        licenseKey,
        customerEmail: session.customer_email || session.customer_details?.email,
      });

      const record = {
        purchaseId: session.id,
        source: 'stripe',
        skillId,
        skillName,
        price: skillPrice,
        sellerEarnings,
        marketnowRevenue,
        affiliatePayout: affiliateCode ? affiliatePayout : 0,
        affiliateCode: affiliateCode || null,
        licenseKey,
        buyerEmail: session.customer_email || session.customer_details?.email || null,
        purchasedAt: new Date().toISOString(),
        status: 'completed',
      };
      const fileUrl = `https://api.github.com/repos/${cfg.repo}/contents/_data/purchases/${filename}?ref=${encodeURIComponent(cfg.branch)}`;
      const body = {
        message: `purchase: Stripe ${session.id} — ${skillName} ($${skillPrice})`,
        content: Buffer.from(JSON.stringify(record, null, 2)).toString('base64'),
        branch: cfg.branch,
      };
      await fetch(fileUrl, {
        method: 'PUT',
        headers: {
          'User-Agent': 'marketnow-stripe-webhook',
          Authorization: `Bearer ${cfg.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    }
  } catch (e) {
    console.error('Failed to persist purchase record (non-fatal):', e);
  }

  return { success: true, licenseKey };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // SECURITY FIX 3.1: Use raw body for Stripe signature verification
  // Stripe signs the exact bytes it sends. If Vercel's body parser
  // already parsed req.body into an object, JSON.stringify won't
  // reproduce the exact original bytes (key order, whitespace).
  // Solution: disable body parser (in config below) and read raw buffer.
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks).toString('utf-8');
  
  const signature = req.headers['stripe-signature'];

  if (!signature) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  // Verify the webhook signature with the RAW body
  const event = verifySignature(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );

  if (!event) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await handleCheckoutComplete(session);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        console.log('❌ Payment failed:', paymentIntent.id);
        // TODO: Log the failure, notify the buyer
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        console.log('💸 Refund processed:', charge.id);
        // TODO: Revoke the license, update seller balance (deduct)
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}

// SECURITY FIX 3.1: Disable body parser so we get the raw body
// This is required for Stripe signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};
