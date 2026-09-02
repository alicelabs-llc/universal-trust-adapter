> **STATUS: RETIRED (2026-09-03).** MarketNow is 100% free — every skill, no payments, no subscriptions. Stripe is not active and will not be. This document is kept only for historical reference.

# MarketNow — Stripe Setup Guide

This guide explains how to activate real payment processing on MarketNow.

## Overview

MarketNow uses **Stripe Checkout** (hosted payment page) for credit card payments. The architecture is:

```
User clicks "Pay $X.XX"
       ↓
Frontend calls /api/create-checkout-session (Vercel serverless)
       ↓
Backend creates Stripe Checkout Session (using STRIPE_SECRET_KEY)
       ↓
Frontend redirects to Stripe Checkout (hosted page)
       ↓
User pays (card, Apple Pay, Google Pay)
       ↓
Stripe redirects back to /vault?success=true
       ↓
Stripe sends webhook to /api/stripe-webhook (Vercel serverless)
       ↓
Backend marks purchase as complete, grants license
```

## What's Already Done

✅ Frontend Stripe integration (`src/utils/stripe.js`)
✅ Checkout button on every skill detail page (`/skill/:id`)
✅ Serverless function for creating checkout sessions (`api/create-checkout-session.js`)
✅ Serverless function for receiving webhooks (`api/stripe-webhook.js`)
✅ Affiliate code passed to checkout (for 5% commission tracking)
✅ Success/cancel redirect URLs

## What You Need To Do

### Step 1: Deploy to Vercel (5 minutes)

The serverless functions need a Node.js backend. Vercel is free for small projects.

1. Go to https://vercel.com → Sign up / Log in
2. Click "Add New Project" → Import your GitHub repo `alicelabs-llc/marketnow`
3. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `aep-marketplace`
   - **Build Command:** `npm install && npm run build`
   - **Output Directory:** `dist`
4. Click "Deploy"

Vercel will auto-deploy on every push to `master`.

### Step 2: Set Environment Variables (2 minutes)

In your Vercel project dashboard:

1. Go to **Settings → Environment Variables**
2. Add these variables:

| Name | Value | Environment |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` (from your Stripe dashboard) | Production |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (get this in Step 4) | Production |
| `CLIENT_URL` | `https://marketnow.site` | Production |

⚠️ **NEVER put `sk_live_...` in your code or GitHub.** Only in Vercel env vars.

To get your Stripe Secret Key:
1. Go to https://dashboard.stripe.com/apikeys
2. Copy the "Secret key" (starts with `sk_live_` or `sk_test_`)

### Step 3: Point marketnow.site API to Vercel (3 minutes)

Your site is on GitHub Pages (static). The API calls go to `/api/*` which doesn't exist there. You need to either:

**Option A: Use Vercel for everything (recommended)**
1. In Cloudflare DNS, change `marketnow.site` CNAME from `edgarfloresguerra2011-a11y.github.io` to `cname.vercel-dns.com`
2. In Vercel, add the custom domain: Settings → Domains → Add `marketnow.site`
3. Vercel serves both the static site AND the API

**Option B: Keep GitHub Pages for site, use Vercel only for API**
1. In `src/utils/stripe.js`, change `API_BASE` to your Vercel URL:
   ```js
   const API_BASE = 'https://marketnow-api.vercel.app'; // your Vercel URL
   ```
2. Set `CLIENT_URL` in Vercel to `https://marketnow.site`

Option A is simpler — Vercel handles everything.

### Step 4: Set up Stripe Webhook (3 minutes)

1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. **Endpoint URL:** `https://marketnow.site/api/stripe-webhook` (or your Vercel URL)
4. **Events to send:**
   - `checkout.session.completed`
   - `payment_intent.payment_failed`
   - `charge.refunded`
5. Click "Add endpoint"
6. Copy the **Signing secret** (starts with `whsec_`)
7. Go back to Vercel → Settings → Environment Variables
8. Add `STRIPE_WEBHOOK_SECRET` = `whsec_...`
9. Redeploy (push any commit to trigger)

### Step 5: Test (2 minutes)

1. Go to https://marketnow.site/registry
2. Click any skill
3. Click "💳 PAY $X.XX WITH CARD →"
4. You should be redirected to Stripe Checkout
5. Use Stripe's test card: `4242 4242 4242 4242` (any future date, any CVC)
6. After payment, you should be redirected back to `/vault?success=true`

### Step 6: Go Live (1 minute)

1. In Stripe Dashboard, make sure you're in "Live mode" (not "Test mode")
2. Use your live keys (`pk_live_...` and `sk_live_...`)
3. The publishable key is already in `src/utils/stripe.js`
4. Set the live secret key in Vercel env vars

## Stripe Dashboard Configuration

### Create Products (optional — currently dynamic)

The current code creates products dynamically via the API. But if you want to pre-create them:

1. Go to https://dashboard.stripe.com/products
2. Create a product for each price tier:
   - "MarketNow Skill — $0.99" (Utility tier)
   - "MarketNow Skill — $1.99" (Standard tier)
   - "MarketNow Skill — $2.99" (Multi-feature tier)
   - "MarketNow Skill — $4.99" (Sophisticated tier)
   - "MarketNow Skill — $9.99" (Enterprise tier)
3. For subscriptions (PRO/ENTERPRISE seller tiers):
   - "MarketNow PRO — $9.99/month"
   - "MarketNow ENTERPRISE — $49.99/month"

### Enable Payment Methods

1. Go to https://dashboard.stripe.com/settings/payment_methods
2. Enable: Cards, Apple Pay, Google Pay, Link
3. (Optional) Enable: ACH, iDEAL, SEPA, etc. for international buyers

### Set Up Stripe Connect (for seller payouts)

To pay sellers their 80% share:

1. Go to https://dashboard.stripe.com/connect
2. Sign up for Stripe Connect (Standard accounts)
3. Each seller needs to create a Stripe Connect account (KYC)
4. When a sale happens, use `transfer_data` in the Checkout Session to split payment

This is more advanced — for the MVP, you can manually process seller payouts monthly.

## File Reference

| File | Purpose |
|---|---|
| `src/utils/stripe.js` | Frontend Stripe.js loader + checkout redirect |
| `api/create-checkout-session.js` | Serverless function: creates Stripe Checkout Session |
| `api/stripe-webhook.js` | Serverless function: receives Stripe webhooks |
| `src/pages/SkillDetail.jsx` | UI with "Pay with Card" button |
| `src/pages/Vault.jsx` | Shows purchased skills after redirect |

## Security Notes

- ✅ `pk_live_...` (publishable key) is safe in frontend code
- ❌ `sk_live_...` (secret key) must NEVER be in frontend code or git
- ✅ Webhook signature verification prevents spoofed requests
- ✅ HTTPS enforced by Vercel
- ✅ CORS restricted to `marketnow.site`

## Troubleshooting

### "Stripe not configured" error
→ `STRIPE_SECRET_KEY` env var is not set in Vercel

### Webhook signature verification fails
→ `STRIPE_WEBHOOK_SECRET` doesn't match the one in Stripe Dashboard

### Redirect to Stripe doesn't work
→ Check that the serverless function is deployed and accessible

### Payment succeeds but skill doesn't appear in Vault
→ Webhook isn't being received. Check Stripe Dashboard → Webhooks → see if events are being sent

## Revenue Tracking

All payments are tracked in your Stripe Dashboard:
- https://dashboard.stripe.com/payments
- https://dashboard.stripe.com/balance
- https://dashboard.stripe.com/reports

The webhook metadata includes `skill_id`, `affiliate_code`, and `commission_rate` for each sale, so you can reconcile with your own database.

## Next Steps

After Stripe is live:
1. Set up Stripe Connect for automatic seller payouts
2. Add email receipts (via Resend, SendGrid, or Stripe's built-in emails)
3. Add subscription handling for PRO/ENTERPRISE seller tiers
4. Implement the affiliate payout system (monthly batch via Stripe Connect)
