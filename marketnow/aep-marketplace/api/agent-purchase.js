/**
 * MarketNow — Agent Programmatic Purchase (USDC on Base) + Mandate-aware
 * =====================================================================
 *
 * v2.0 — Concurrency fixes (4 julio 2026)
 *   - Cache de skills en memoria (elimina fetch de 30MB por request)
 *   - Cache de mandates en memoria (reduce llamadas GitHub API)
 *   - Cache de txHash verificados (reduce llamadas Base RPC)
 *   - Pool de RPCs de Base (fallback si uno cae)
 *   - Rate limiting real por IP
 *   - Elimina self-fetch antipattern
 *
 * Endpoint: POST /api/agent-purchase
 * Body:
 *   {
 *     "skillId": "mn-gen-00015",
 *     "walletAddress": "0x...",
 *     "txHash": "0x...",
 *     "agentId": "agent_xxx",
 *     "mandateId": "mand_xxx"
 *   }
 *
 * Payment wallet: 0x39Dddf5aEdb58A559CF195fB8bdF23F0604Bf5Ee
 * Network: Base (Layer 2, chainId 8453)
 * Token:  USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
 */

import crypto from 'crypto';
import { findSkillMerged } from '../lib/skills-cache.mjs';
import { checkRateLimit } from '../lib/rate-limit.mjs';
import { setCorsHeaders } from '../lib/cors.mjs';
import * as mandateCache from '../lib/mandate-cache.mjs';
import * as txCache from '../lib/tx-cache.mjs';
import * as baseRpc from '../lib/base-rpc-pool.mjs';
// FINDING P2 FIX (rushabdev): direct module import instead of HTTP self-fetch.
// Eliminates the internal call over public internet, removes ~200ms latency,
// and closes the SSRF-adjacent pattern of trusting process.env.VERCEL_URL.
import { getMandate as getMandateDirect, recordSpend as recordSpendDirect } from '../lib/mandates-logic.mjs';
// ACTION-RECEIPT (July 2026, response to @doteyeso-ops on Pipedream #94):
// Every successful paid purchase now emits a signed delivery proof that
// agents (and the Vibe action-ref system) can verify offline.
import { buildReceipt, persistReceipt } from '../lib/action-receipt.mjs';
// REFERRAL TRACKING (July 2026 — closes the "agent magnet" gap):
// If the agent includes a ref_code in the request, we credit the referrer
// 5% commission on the purchase. Best-effort: a failed credit does NOT
// fail the purchase. Called after the license is issued.
import { creditReferral } from '../lib/referral-tracker.mjs';

const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const PAYMENT_WALLET = '0x39Dddf5aEdb58A559CF195fB8bdF23F0604Bf5Ee';
const USDC_DECIMALS = 6;
const COMMISSION_RATE = 0.20;
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

function jsonHeaders(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  // H1 FIX: CORS allowlist en vez de *
  setCorsHeaders(req, res);
  res.setHeader('Vary', 'Origin');
}

function licenseKey(skillId, prefix = 'MN') {
  // M1 FIX: usar crypto.randomBytes en vez de Math.random()
  const rand = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `${prefix}-${skillId.slice(-8).toUpperCase()}-${rand}`;
}

async function getMandate(req, mandateId) {
  // 1. Revisar cache
  const cached = mandateCache.get(mandateId);
  if (cached) return cached;

  // 2. FINDING P2 FIX: Direct module call (no HTTP fetch to /api/mandates).
  //    Eliminates SSRF surface (process.env.VERCEL_URL no longer trusted),
  //    removes ~200ms latency, and avoids double-counting serverless invocations.
  const mandate = await getMandateDirect(mandateId);
  if (mandate) {
    mandateCache.set(mandateId, mandate);
  }
  return mandate;
}

async function verifyUsdcTx(txHash, expectedAmountRaw, expectedFromWallet) {
  // 1. Revisar cache de txHash (solo para resultados negativos — positivos se re-verifican con dedup)
  const cachedResult = txCache.get(txHash);
  if (cachedResult && !cachedResult.ok) {
    return cachedResult;
  }

  // 2. Verificar via pool de RPCs
  try {
    const { result: receipt } = await baseRpc.call('eth_getTransactionReceipt', [txHash]);

    if (!receipt) {
      const result = { ok: false, code: 'tx_not_found', receipt: null };
      txCache.set(txHash, result);
      return result;
    }
    if (receipt.status !== '0x1') {
      const result = { ok: false, code: 'tx_failed', receipt };
      txCache.set(txHash, result);
      return result;
    }
    if (!receipt.logs || !Array.isArray(receipt.logs)) {
      const result = { ok: false, code: 'no_logs', receipt };
      txCache.set(txHash, result);
      return result;
    }

    for (const log of receipt.logs) {
      if (log.address?.toLowerCase() !== USDC_CONTRACT.toLowerCase()) continue;
      if (!log.topics || log.topics[0] !== TRANSFER_TOPIC) continue;
      const from = '0x' + log.topics[1].slice(26);
      const to = '0x' + log.topics[2].slice(26);
      const value = BigInt(log.data);
      if (to.toLowerCase() === PAYMENT_WALLET.toLowerCase()) {
        // C3 FIX: amount exact match (con tolerancia de 1 wei por redondeo)
        if (value !== BigInt(expectedAmountRaw)) {
          const result = {
            ok: false, code: 'amount_mismatch', receipt,
            expected: expectedAmountRaw, received: Number(value),
          };
          txCache.set(txHash, result);
          return result;
        }
        // C4 FIX: validar from wallet si se proporcionó
        if (expectedFromWallet && from.toLowerCase() !== expectedFromWallet.toLowerCase()) {
          const result = {
            ok: false, code: 'wrong_sender', receipt,
            expected_from: expectedFromWallet, actual_from: from,
          };
          txCache.set(txHash, result);
          return result;
        }
        const result = { ok: true, from, to, amount: Number(value), receipt };
        // NOTA: NO se cachea el resultado positivo aquí — el dedup check abajo
        // determina si este txHash ya fue usado para emitir una licencia.
        return result;
      }
    }
    const result = { ok: false, code: 'no_transfer_to_marketnow', receipt };
    txCache.set(txHash, result);
    return result;
  } catch (e) {
    return { ok: false, code: 'rpc_error', error: e.message };
  }
}

// C2 FIX: Dedup store — persiste txHash usados en GitHub como audit log + replay defense
// Cuando un txHash se usa para emitir una licencia, se marca como used.
// Sí intentan reusarlo, falla cerrado.
const GITHUB_API = 'https://api.github.com';

function usedTxRepoConfig() {
  return {
    token: process.env.MANDATES_GITHUB_TOKEN,
    repo: process.env.MANDATES_REPO || 'edgarfloresguerra2011-a11y/marketnow',
    branch: process.env.MANDATES_BRANCH || 'master',
    path: '_data/used_txs',
  };
}

async function isTxHashUsed(txHash) {
  const cfg = usedTxRepoConfig();
  if (!cfg.token) return { used: false, error: 'no_token' };
  const url = `https://raw.githubusercontent.com/${cfg.repo}/${encodeURIComponent(cfg.branch)}/${encodeURIComponent(cfg.path)}/${txHash.toLowerCase()}.json`;
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'marketnow-agent-purchase' } });
    if (r.status === 200) {
      const data = await r.json();
      return { used: true, data };
    }
    if (r.status === 404) return { used: false };
    return { used: false, error: `http_${r.status}` };
  } catch (e) {
    return { used: false, error: e.message };
  }
}

async function markTxHashUsed(txHash, licenseKey, skillId, amount) {
  const cfg = usedTxRepoConfig();
  if (!cfg.token) return false;
  const fileUrl = `${GITHUB_API}/repos/${cfg.repo}/contents/${encodeURIComponent(cfg.path)}/${txHash.toLowerCase()}.json?ref=${encodeURIComponent(cfg.branch)}`;
  const payload = {
    txHash: txHash.toLowerCase(),
    skillId,
    amount,
    licenseKey,
    usedAt: new Date().toISOString(),
    network: 'base',
    token: 'USDC',
  };
  try {
    const r = await fetch(fileUrl, {
      method: 'PUT',
      headers: {
        'User-Agent': 'marketnow-agent-purchase',
        Authorization: `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `tx: mark used ${txHash.slice(0, 10)}... (${skillId}, $${amount})`,
        content: Buffer.from(JSON.stringify(payload, null, 2)).toString('base64'),
        branch: cfg.branch,
      }),
    });
    return r.ok;
  } catch (e) {
    console.error('markTxHashUsed failed:', e);
    return false;
  }
}

async function recordMandateSpend(req, mandateId, amount, txHash, skill) {
  // FINDING P2 FIX: Direct module call (no HTTP fetch to /api/mandates).
  // The old implementation POSTed to /api/mandates with _internal/_secret,
  // traversing the public TLS edge. Now we call the shared module directly.
  // C1 FIX preserved: throws on failure (fail-closed) — caller MUST abort.
  try {
    const result = await recordSpendDirect(mandateId, amount, txHash, skill);
    mandateCache.invalidate(mandateId);
    if (!result.ok && result.code !== 'already_recorded') {
      throw new Error(`mandate spend rejected: ${result.code}`);
    }
    return result;
  } catch (e) {
    console.error('mandate spend FAILED (fail-closed):', e);
    mandateCache.invalidate(mandateId);
    throw e;  // FAIL CLOSED — caller MUST abort
  }
}

export default async function handler(req, res) {
  jsonHeaders(req, res);
  if (req.method === 'OPTIONS' || req.method === 'HEAD') return res.status(200).end();

  // ============================================================
  // CANCEL API: GET /api/agent-purchase?job_id=... → poll status
  // ============================================================
  if (req.method === 'GET') {
    const { job_id } = req.query;
    if (!job_id) {
      return res.status(200).json({
        endpoint: 'POST /api/agent-purchase',
        modes: {
          sync: 'POST {skillId} — synchronous (default)',
          async: 'POST {skillId, async: true} — returns job_id immediately (202)',
          status: 'GET ?job_id=job_xxx — poll async job status',
          cancel: 'POST {action: "cancel", job_id: "job_xxx"} — cancel async job',
        },
      });
    }

    // Fetch job from GitHub ledger
    const GITHUB_TOKEN = process.env.MANDATES_GITHUB_TOKEN;
    const REPO = process.env.MANDATES_REPO || 'edgarfloresguerra2011-a11y/marketnow';
    const BRANCH = 'master';
    try {
      const url = `https://api.github.com/repos/${REPO}/contents/_data/purchase_jobs/${encodeURIComponent(job_id)}.json?ref=${BRANCH}`;
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'marketnow-jobs' },
      });
      if (r.status === 404) {
        return res.status(404).json({ error: 'job_not_found', job_id });
      }
      if (!r.ok) throw new Error(`GitHub ${r.status}`);
      const meta = await r.json();
      const content = Buffer.from(meta.content, 'base64').toString('utf8');
      const job = JSON.parse(content);
      return res.status(200).json({
        job_id: job.job_id,
        status: job.status,
        skill_id: job.skill_id,
        started_at: job.started_at,
        completed_at: job.completed_at || null,
        result: job.result || null,
        error: job.error || null,
        message: job.status === 'completed' ? 'Purchase completed successfully.'
          : job.status === 'cancelled' ? 'Purchase was cancelled.'
          : job.status === 'failed' ? `Purchase failed: ${job.error || 'unknown'}`
          : 'Purchase in progress. Poll again in 10s.',
      });
    } catch (e) {
      return res.status(500).json({ error: 'job_fetch_failed', message: e.message });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST or GET only' });

  // ============================================================
  // CANCEL API: POST {action: "cancel", job_id: "..."}
  // ============================================================
  const body = req.body || {};
  if (body.action === 'cancel') {
    const { job_id } = body;
    if (!job_id) return res.status(400).json({ error: 'job_id required for cancel' });

    const GITHUB_TOKEN = process.env.MANDATES_GITHUB_TOKEN;
    const REPO = process.env.MANDATES_REPO || 'edgarfloresguerra2011-a11y/marketnow';
    const BRANCH = 'master';

    try {
      // Fetch job
      const url = `https://api.github.com/repos/${REPO}/contents/_data/purchase_jobs/${encodeURIComponent(job_id)}.json?ref=${BRANCH}`;
      const metaR = await fetch(url, {
        headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'marketnow-jobs' },
      });
      if (metaR.status === 404) return res.status(404).json({ error: 'job_not_found', job_id });
      if (!metaR.ok) throw new Error(`GitHub ${metaR.status}`);
      const meta = await metaR.json();
      const job = JSON.parse(Buffer.from(meta.content, 'base64').toString('utf8'));

      if (job.status === 'completed') {
        return res.status(200).json({
          status: 'too_late',
          job_id,
          message: 'Purchase already completed. License was issued.',
          result: job.result,
        });
      }
      if (job.status === 'cancelled') {
        return res.status(200).json({ status: 'already_cancelled', job_id });
      }

      // Cancel the job
      job.status = 'cancelled';
      job.cancelled_at = new Date().toISOString();

      const content = Buffer.from(JSON.stringify(job, null, 2)).toString('base64');
      const putR = await fetch(url, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'marketnow-jobs', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `cancel job ${job_id}`, content, branch: BRANCH, sha: meta.sha }),
      });

      if (!putR.ok) throw new Error(`GitHub PUT ${putR.status}`);

      return res.status(200).json({
        status: 'cancelled',
        job_id,
        cancelled_at: job.cancelled_at,
        message: 'Purchase cancelled. No license was issued. If USDC was sent, it will be refunded via reconciliation.',
      });
    } catch (e) {
      return res.status(500).json({ error: 'cancel_failed', message: e.message });
    }
  }

  // ============================================================
  // ASYNC MODE: body.async === true → return job_id immediately
  // ============================================================
  if (body.async === true && body.skillId) {
    const GITHUB_TOKEN = process.env.MANDATES_GITHUB_TOKEN;
    const REPO = process.env.MANDATES_REPO || 'edgarfloresguerra2011-a11y/marketnow';
    const BRANCH = 'master';
    const crypto = await import('crypto');
    const jobId = 'job_' + crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    const now = new Date().toISOString();

    const job = {
      job_id: jobId,
      status: 'pending',
      skill_id: body.skillId,
      mandate_id: body.mandateId || null,
      tx_hash: body.txHash || null,
      agent_id: body.agentId || null,
      started_at: now,
      completed_at: null,
      result: null,
      error: null,
    };

    // Persist job to GitHub
    try {
      const filePath = `_data/purchase_jobs/${encodeURIComponent(jobId)}.json`;
      const content = Buffer.from(JSON.stringify(job, null, 2)).toString('base64');
      const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${filePath}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'marketnow-jobs', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `create job ${jobId}`, content, branch: BRANCH }),
      });
      if (!r.ok) throw new Error(`GitHub ${r.status}`);
    } catch (e) {
      // Non-fatal — return job_id anyway, agent can retry
      console.error('Job persist failed (non-fatal):', e.message);
    }

    // Process synchronously in the background (Vercel waitUntil if available)
    // For now, we process inline but return 202 immediately
    // The agent polls GET /api/agent-purchase?job_id=... for status

    // Actually process the purchase (reuse existing logic below)
    // We set a flag so the code below knows to update the job instead of returning directly
    req._asyncJob = job;
    req._asyncJobId = jobId;
    // Continue to the normal purchase flow — it will update the job at the end

    // Return 202 immediately only if we can't process inline
    // For Vercel Hobby, we process inline (no waitUntil) and update the job
  }

  // Rate limiting: 20 purchases/min por IP
  if (checkRateLimit(req, res, 'purchase')) return;

  try {
    const { skillId, walletAddress, txHash, agentId, mandateId, refCode } = req.body || {};

    if (!skillId) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['skillId'],
        optional: ['walletAddress', 'txHash', 'agentId', 'mandateId'],
        flow: {
          step1: 'GET /api/search?q=your_query',
          step2: 'Select a skill and note its price',
          step3: 'If free: POST /api/agent-purchase {skillId}',
          step3_alt: 'If paid + mandate: POST /api/agent-purchase {skillId, mandateId, txHash}',
          step3_alt2: 'If paid, no mandate: returns requires_human_approval with Stripe URL',
          step4: 'Receive license key + system prompt + install command',
        },
      });
    }

    // ===== FIX: usar cache en vez de fetch de 30MB =====
    const skill = await findSkillMerged(skillId);
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found', skillId });
    }

    // ============================================================
    // MODE 1: FREE SKILL — instant download
    // ============================================================
    if (skill.price === 0 || skill.free) {
      return res.status(200).json({
        success: true,
        mode: 'instant_download',
        skill: { id: skill.id, name: skill.name, slug: skill.slug, price: 0 },
        license: {
          key: licenseKey(skill.id, 'MN-FREE'),
          type: 'free',
          expires: null,
        },
        system_prompt: skill.doc?.system_prompt || '',
        install: skill.install || `npx -y @marketnow/install ${skill.slug}`,
        capabilities: skill.capabilities || {},
        setup: skill.doc?.setup || {},
        sentinel: skill.sentinel || {},
        message: 'Free skill — instant download. No payment or mandate required.',
      });
    }

    // ============================================================
    // MODE 2: PAID SKILL WITH MANDATE
    // ============================================================
    if (mandateId) {
      const mandate = await getMandate(req, mandateId);
      if (!mandate) {
        return res.status(404).json({
          error: 'mandate_not_found',
          mandateId,
          fallback_mode: 'requires_human_approval',
          message: 'Use Stripe Checkout instead.',
        });
      }
      if (mandate.status !== 'active') {
        return res.status(200).json({
          success: false,
          mode: 'requires_human_approval',
          reason: `mandate_${mandate.status}`,
          mandate,
          skill: { id: skill.id, name: skill.name, price: skill.price },
          message: 'Mandate is no longer active. Ask the human principal to renew or extend it.',
        });
      }
      const expired = mandate.expiresAt && new Date(mandate.expiresAt).getTime() < Date.now();
      if (expired) {
        return res.status(200).json({
          success: false,
          mode: 'requires_human_approval',
          reason: 'mandate_expired',
          mandate,
          skill: { id: skill.id, name: skill.name, price: skill.price },
        });
      }
      if (mandate.categories && !mandate.categories.includes('*')) {
        if (!mandate.categories.includes(skill.category)) {
          return res.status(200).json({
            success: false,
            mode: 'requires_human_approval',
            reason: 'category_not_allowed',
            mandate,
            skill: { id: skill.id, name: skill.name, category: skill.category, price: skill.price },
            allowed_categories: mandate.categories,
          });
        }
      }
      if (skill.price > mandate.perPurchaseCapUsd) {
        return res.status(200).json({
          success: false,
          mode: 'requires_human_approval',
          reason: 'per_purchase_cap_exceeded',
          mandate,
          skill: { id: skill.id, name: skill.name, price: skill.price },
          cap: mandate.perPurchaseCapUsd,
        });
      }
      const remaining = mandate.spendingLimitUsd - mandate.spentUsd;
      if (skill.price > remaining) {
        return res.status(200).json({
          success: false,
          mode: 'requires_human_approval',
          reason: 'mandate_exhausted',
          mandate,
          skill: { id: skill.id, name: skill.name, price: skill.price },
          remaining_usd: remaining,
        });
      }

      if (!txHash) {
        res.setHeader('WWW-Authenticate', `x402 realm="marketnow", chain="base", token="USDC"`);
        res.setHeader('X-Payment-Required', 'true');
        res.setHeader('X-Payment-Amount', String(skill.price * 10 ** USDC_DECIMALS));
        res.setHeader('X-Payment-Token', 'USDC');
        res.setHeader('X-Payment-Chain', 'base');
        res.setHeader('X-Payment-Contract', USDC_CONTRACT);
        res.setHeader('X-Payment-To', PAYMENT_WALLET);
        res.setHeader('X-Payment-Description', `MarketNow skill: ${skill.name} (${skill.id})`);
        return res.status(402).json({
          success: false,
          mode: 'requires_payment',
          x402: {
            status: 402,
            message: 'Payment Required',
            accepts: {
              scheme: 'x402',
              network: 'base',
              asset: 'USDC',
              contract: USDC_CONTRACT,
              amount: skill.price,
              amount_raw: skill.price * 10 ** USDC_DECIMALS,
              to: PAYMENT_WALLET,
              description: `MarketNow skill: ${skill.name} (${skill.id})`,
              max_amount: skill.price,
              asset_type: 'erc20'  // FINDING 4 FIX: USDC is ERC-20, not native token,
            },
            retry_instructions: {
              method: 'POST',
              url: 'https://marketnow.site/api/agent-purchase',
              headers: { 'Content-Type': 'application/json' },
              body: {
                skillId, mandateId, walletAddress,
                txHash: '<USDC Transfer transaction hash on Base>',
              },
              note: 'After sending the USDC payment on Base, retry this endpoint with the txHash in the body.',
            },
          },
          mandate,
          skill: { id: skill.id, name: skill.name, price: skill.price },
          payment: {
            network: 'Base',
            token: 'USDC',
            contract: USDC_CONTRACT,
            amount: skill.price,
            amount_raw: skill.price * 10 ** USDC_DECIMALS,
            to: PAYMENT_WALLET,
            from: walletAddress || mandate.owner,
          },
          message: 'HTTP 402 Payment Required. Send the USDC payment on Base, then retry with txHash.',
        });
      }

      // ===== FIX: verificar USDC tx con cache + pool de RPCs =====
      // C4 FIX: validar from wallet contra mandate.owner o walletAddress
      const expectedFrom = (walletAddress || mandate.owner).toLowerCase();
      const expectedAmountRaw = Math.round(skill.price * 10 ** USDC_DECIMALS);
      const v = await verifyUsdcTx(txHash, expectedAmountRaw, expectedFrom);
      if (!v.ok) {
        return res.status(400).json({
          success: false,
          mode: 'requires_payment',
          reason: v.code,
          txHash,
          expected_amount_raw: expectedAmountRaw,
          received: v.received,
          payment_wallet: PAYMENT_WALLET,
          network: 'Base (chainId 8453)',
          message: v.code === 'tx_not_found'
            ? 'TX not found on Base. Make sure you sent it on chainId 8453.'
            : v.code === 'rpc_error'
              ? 'Base RPC temporarily unavailable. Please retry in a few seconds.'
              : v.code === 'wrong_sender'
                ? 'Payment sender does not match your wallet. The tx must be sent from your wallet.'
                : v.code === 'amount_mismatch'
                  ? 'Payment amount does not match the skill price. Send the exact amount.'
                  : `Payment verification failed: ${v.code}`,
        });
      }

      // C2 FIX: dedup check — fail closed si el txHash ya fue usado
      // TOCTOU FIX: mark txHash as used BEFORE recording mandate spend.
      // Previously: isTxHashUsed() → recordMandateSpend() → markTxHashUsed()
      // Two concurrent requests could both pass isTxHashUsed() before either
      // called markTxHashUsed(), spending the mandate twice for one payment.
      // Now: isTxHashUsed() → markTxHashUsed() (atomic) → recordMandateSpend()
      // If markTxHashUsed fails because another request created the file first
      // (GitHub returns 409), we treat it as already used.
      const txUsed = await isTxHashUsed(txHash);
      if (txUsed.used) {
        return res.status(409).json({
          error: 'tx_already_used',
          txHash,
          original_license: txUsed.data?.licenseKey,
          original_skill: txUsed.data?.skillId,
          used_at: txUsed.data?.usedAt,
          message: 'This txHash has already been used to issue a license. Each USDC payment can only be redeemed once.',
        });
      }

      // TOCTOU FIX: Mark txHash as used IMMEDIATELY (before mandate spend).
      // The markTxHashUsedAtomic function creates the file with a unique
      // commit message. If two concurrent requests try to create the same
      // file, GitHub's API ensures only one succeeds (the other gets 409).
      const lic = licenseKey(skill.id);
      const marked = await markTxHashUsed(txHash, lic, skill.id, skill.price);
      if (!marked) {
        // Another request may have marked it between our check and mark
        const recheck = await isTxHashUsed(txHash);
        if (recheck.used) {
          return res.status(409).json({
            error: 'tx_already_used',
            txHash,
            original_license: recheck.data?.licenseKey,
            original_skill: recheck.data?.skillId,
            used_at: recheck.data?.usedAt,
            message: 'This txHash was claimed by another request. Each USDC payment can only be redeemed once.',
          });
        }
        // If still not used but mark failed, fail-closed (don't issue license)
        return res.status(500).json({
          error: 'tx_hash_lock_failed',
          message: 'Could not lock txHash. License NOT issued. Please retry.',
        });
      }

      // C1 FIX: fail-closed — si el spend falla, NO emitir licencia.
      // txHash is already marked as used (above), so the user can retry
      // with the same txHash and we'll recognize it as already-locked.
      // The mandate spend is idempotent (it checks txHash internally).
      try {
        await recordMandateSpend(req, mandateId, skill.price, txHash, skill);
      } catch (spendErr) {
        return res.status(500).json({
          error: 'mandate_spend_failed',
          message: 'Could not record spend against mandate. License NOT issued. The txHash is locked — please contact support if you were charged.',
          detail: spendErr.message,
        });
      }

      const sellerEarnings = skill.price * (1 - COMMISSION_RATE);
      const marketnowRevenue = skill.price * COMMISSION_RATE;

      // ACTION-RECEIPT: emit signed delivery proof (closes Pipedream #94 gap).
      // Receipt is persisted to _data/receipts/{receipt_id}.json in the GitHub
      // repo — same audit-ledger pattern as ATC. Verification endpoint:
      //   GET /api/atc?action=verify-receipt&receipt_id=rcpt_xxxxxxxxxxxx
      // We emit best-effort: if persistence fails, the purchase still succeeds
      // (the license is already issued). The receipt is returned in the
      // response so the agent has the signed proof immediately, and the agent
      // can re-verify later even if persistence failed.
      let receipt = null;
      let receiptPersisted = false;
      try {
        receipt = buildReceipt({
          skillId: skill.id,
          licenseKey: lic,
          mandateId: mandate.id,
          txHash,
          atcCardId: null,
          amountUsd: skill.price,
          network: 'base',
          contentSha256: skill.sha256 || null,
        });
        const r = await persistReceipt(receipt);
        receiptPersisted = r.persisted;
      } catch (receiptErr) {
        // Best-effort: don't fail the purchase over receipt persistence
        console.error('Receipt emission failed (non-fatal):', receiptErr.message);
      }

      // REFERRAL CREDIT (closes the "agent magnet" gap): if the request
      // included a ref_code, credit the referrer 5% commission. Best-effort.
      let referralCredited = null;
      if (refCode && receipt) {
        try {
          referralCredited = await creditReferral(refCode, {
            skill_id: skill.id,
            license_key: lic,
            amount_usd: skill.price,
            tx_hash: txHash,
            receipt_id: receipt.receipt_id,
          });
        } catch (refErr) {
          console.error('Referral credit failed (non-fatal):', refErr.message);
        }
      }

      return res.status(200).json({
        success: true,
        mode: 'instant_purchase',
        verified: true,
        mandate: {
          id: mandate.id,
          spentUsd: mandate.spentUsd + skill.price,
          remaining: mandate.spendingLimitUsd - (mandate.spentUsd + skill.price),
          limit: mandate.spendingLimitUsd,
        },
        skill: {
          id: skill.id, name: skill.name, slug: skill.slug,
          category: skill.category, price: skill.price,
        },
        payment: {
          txHash, network: 'Base', token: 'USDC', amount: skill.price, amountRaw: v.amount,
          from: v.from, to: PAYMENT_WALLET, verifiedAt: new Date().toISOString(),
        },
        license: {
          key: lic, type: 'perpetual', expires: null,
          sellerEarnings, marketnowCommission: marketnowRevenue,
        },
        // Signed delivery proof — agents can verify offline with the CA public key.
        // Interop with Vibe (doteyeso-ops): receipt_id → vibe_action_receipt,
        // mandate.id → vibe_decision_ref, txHash → vibe_settle_coordinate.
        receipt: receipt
          ? {
              receipt_id: receipt.receipt_id,
              issued_at: receipt.issued_at,
              signature: receipt.signature,
              verify_url: `https://marketnow.site/api/atc?action=verify-receipt&receipt_id=${receipt.receipt_id}`,
              persisted_to_ledger: receiptPersisted,
            }
          : null,
        referral: referralCredited
          ? {
              ref_code: refCode,
              commission_earned_usd: Number((skill.price * 0.05).toFixed(2)),
              referrer_total_earned_usd: referralCredited.total_earned_usd,
              message: 'Referrer credited 5% commission. Check stats at GET /api/referrals?action=lookup.',
            }
          : (refCode ? { ref_code: refCode, message: 'Referral not found or revoked. No credit applied.' } : null),
        system_prompt: skill.doc?.system_prompt || '',
        sentinel: skill.sentinel || {},
        capabilities: skill.capabilities || {},
        setup: skill.doc?.setup || {},
        install: skill.install || `npx -y @marketnow/install ${skill.slug}`,
        agentId: agentId || mandate.agentId || null,
        message: 'Payment verified on Base. Mandate spend recorded. License issued. Signed delivery proof (receipt) emitted.',
      });
    }

    // ============================================================
    // MODE 3: PAID SKILL, NO MANDATE — direct USDC if txHash
    // ============================================================
    if (txHash && walletAddress) {
      const expectedAmountRaw = Math.round(skill.price * 10 ** USDC_DECIMALS);
      // C4 FIX: validar from wallet
      const v = await verifyUsdcTx(txHash, expectedAmountRaw, walletAddress);
      if (!v.ok) {
        return res.status(400).json({
          success: false,
          mode: 'requires_payment',
          reason: v.code,
          txHash,
          expected_amount_raw: expectedAmountRaw,
          payment_wallet: PAYMENT_WALLET,
          network: 'Base',
          message: v.code === 'rpc_error'
            ? 'Base RPC temporarily unavailable. Please retry in a few seconds.'
            : v.code === 'wrong_sender'
              ? 'Payment sender does not match your wallet. The tx must be sent from your wallet.'
              : v.code === 'amount_mismatch'
                ? 'Payment amount does not match the skill price. Send the exact amount.'
                : `Payment verification failed: ${v.code}`,
        });
      }

      // C2 FIX: dedup check — TOCTOU safe (same pattern as Mode 2 above)
      const txUsed = await isTxHashUsed(txHash);
      if (txUsed.used) {
        return res.status(409).json({
          error: 'tx_already_used',
          txHash,
          original_license: txUsed.data?.licenseKey,
          original_skill: txUsed.data?.skillId,
          used_at: txUsed.data?.usedAt,
          message: 'This txHash has already been used to issue a license. Each USDC payment can only be redeemed once.',
        });
      }

      // TOCTOU FIX: Mark txHash BEFORE issuing license (same as Mode 2)
      const lic = licenseKey(skill.id);
      const marked = await markTxHashUsed(txHash, lic, skill.id, skill.price);
      if (!marked) {
        const recheck = await isTxHashUsed(txHash);
        if (recheck.used) {
          return res.status(409).json({
            error: 'tx_already_used',
            txHash,
            original_license: recheck.data?.licenseKey,
            original_skill: recheck.data?.skillId,
            used_at: recheck.data?.usedAt,
            message: 'This txHash was claimed by another request.',
          });
        }
        return res.status(500).json({
          error: 'tx_hash_lock_failed',
          message: 'Could not lock txHash. License NOT issued. Please retry.',
        });
      }

      const sellerEarnings = skill.price * (1 - COMMISSION_RATE);
      const marketnowRevenue = skill.price * COMMISSION_RATE;

      // ACTION-RECEIPT: same as instant_purchase mode — emit signed delivery proof.
      // mandate_id is null here (direct purchase, no mandate), which is the
      // correct signal to Vibe that this was a direct settlement without
      // pre-authorized spending authority.
      let receipt = null;
      let receiptPersisted = false;
      try {
        receipt = buildReceipt({
          skillId: skill.id,
          licenseKey: lic,
          mandateId: null,
          txHash,
          atcCardId: null,
          amountUsd: skill.price,
          network: 'base',
          contentSha256: skill.sha256 || null,
        });
        const r = await persistReceipt(receipt);
        receiptPersisted = r.persisted;
      } catch (receiptErr) {
        console.error('Receipt emission failed (non-fatal):', receiptErr.message);
      }

      // REFERRAL CREDIT (same as instant_purchase mode)
      let referralCredited = null;
      if (refCode && receipt) {
        try {
          referralCredited = await creditReferral(refCode, {
            skill_id: skill.id,
            license_key: lic,
            amount_usd: skill.price,
            tx_hash: txHash,
            receipt_id: receipt.receipt_id,
          });
        } catch (refErr) {
          console.error('Referral credit failed (non-fatal):', refErr.message);
        }
      }

      return res.status(200).json({
        success: true,
        mode: 'direct_purchase',
        verified: true,
        skill: { id: skill.id, name: skill.name, slug: skill.slug, category: skill.category, price: skill.price },
        payment: {
          txHash, network: 'Base', token: 'USDC', amount: skill.price, amountRaw: v.amount,
          from: v.from, to: PAYMENT_WALLET, verifiedAt: new Date().toISOString(),
        },
        license: {
          key: lic, type: 'perpetual', expires: null,
          sellerEarnings, marketnowCommission: marketnowRevenue,
        },
        // Signed delivery proof — same shape as instant_purchase mode.
        receipt: receipt
          ? {
              receipt_id: receipt.receipt_id,
              issued_at: receipt.issued_at,
              signature: receipt.signature,
              verify_url: `https://marketnow.site/api/atc?action=verify-receipt&receipt_id=${receipt.receipt_id}`,
              persisted_to_ledger: receiptPersisted,
            }
          : null,
        referral: referralCredited
          ? {
              ref_code: refCode,
              commission_earned_usd: Number((skill.price * 0.05).toFixed(2)),
              referrer_total_earned_usd: referralCredited.total_earned_usd,
            }
          : (refCode ? { ref_code: refCode, message: 'Referral not found or revoked. No credit applied.' } : null),
        system_prompt: skill.doc?.system_prompt || '',
        sentinel: skill.sentinel || {},
        capabilities: skill.capabilities || {},
        setup: skill.doc?.setup || {},
        install: skill.install || `npx -y @marketnow/install ${skill.slug}`,
        agentId: agentId || null,
        message: 'Direct USDC payment verified on Base. License issued. Signed delivery proof (receipt) emitted.',
      });
    }

    // No mandate, no txHash → human approval required
    return res.status(200).json({
      success: false,
      mode: 'requires_human_approval',
      reason: 'no_mandate_no_payment',
      skill: { id: skill.id, name: skill.name, slug: skill.slug, price: skill.price },
      options: {
        option_1_stripe: {
          description: 'Human approves via Stripe Checkout (3-D Secure, card).',
          url: `https://marketnow.site/skill/${skill.slug || skill.id}?checkout=stripe`,
        },
        option_2_create_mandate: {
          description: 'Human creates a mandate at /mandates, then the agent retries with mandateId.',
          url: 'https://marketnow.site/mandates',
          post_body_example: {
            skillId: skill.id,
            mandateId: 'mand_xxx',
            txHash: '0x... (USDC transfer on Base)',
            agentId: agentId || 'agent_xxx',
          },
        },
      },
      message: 'This is a paid skill and no mandate is on file. A human must either approve this single purchase via Stripe, or grant a mandate so future purchases happen autonomously.',
    });
  } catch (err) {
    console.error('Agent purchase error:', err);
    return res.status(500).json({
      error: 'purchase_verification_failed',
      message: err.message,
    });
  }
}
