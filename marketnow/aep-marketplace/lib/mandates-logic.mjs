/**
 * MarketNow — Mandates business logic (shared module)
 * ================================================
 *
 * FINDING P2 FIX (rushabdev, July 2026):
 * Previously, /api/agent-purchase.js called /api/mandates via HTTP fetch
 * over the public internet (https://marketnow.site/api/mandates). This:
 *   1. Counted against Vercel's serverless function invocation quota
 *      (two function calls per agent purchase instead of one).
 *   2. Traversed the public TLS edge, adding ~150-400ms latency.
 *   3. Created an SSRF-adjacent pattern: a future attacker who could
 *      poison process.env.VERCEL_URL could redirect the internal call.
 *
 * Fix: extract getMandate + recordSpend into this shared module. Both
 * /api/mandates.js (HTTP entry point) and /api/agent-purchase.js
 * (internal caller) import these functions directly. No HTTP hop.
 *
 * The HTTP endpoint at /api/mandates still exists for external callers
 * (mandates UI at /mandates, agents querying their own mandates, etc.).
 * The internal spend path is now function-scoped — only the HTTP entry
 * validates _internal/_secret, because that check exists to prevent
 * EXTERNAL callers from bypassing /api/agent-purchase. Internal module
 * imports are by definition trusted.
 */

import * as mandateCache from './mandate-cache.mjs';
import { verifyMessage } from 'ethers';

// Re-exported from mandates.js — kept in sync via the same env vars.
// We re-declare here to avoid a circular import (mandates.js imports from
// this module for its handler logic). All constants mirror mandates.js.

const MAX_TOTAL_LIMIT = 500;
const MAX_PER_PURCHASE_CAP = 50;
const MANDATE_TTL_DAYS = 90;
const AUTONOMOUS_PURCHASE_LIMIT = 3;
const VETO_WINDOW_SECONDS = 300;
const DEFAULT_NOTIFICATION_MODE = 'notify';
const NOTIFICATION_MODES = ['silent', 'notify', 'notify_and_veto'];

// ─── GitHub persistence (mirrors mandates.js) ───────────────────────────
function repoConfig() {
  return {
    token: process.env.MANDATES_GITHUB_TOKEN,
    repo: process.env.MANDATES_REPO || 'edgarfloresguerra2011-a11y/marketnow',
    branch: process.env.MANDATES_BRANCH || 'master',
    path: process.env.MANDATES_PATH || '_data/mandates',
  };
}

function hasGitHub() {
  const cfg = repoConfig();
  return !!(cfg.token && cfg.repo);
}

function nowIso() { return new Date().toISOString(); }

function isExpired(m) {
  return !!(m.expiresAt && new Date(m.expiresAt).getTime() < Date.now());
}

function fileUrl(cfg, id) {
  return `https://api.github.com/repos/${cfg.repo}/contents/${encodeURIComponent(cfg.path)}/${id}.json?ref=${encodeURIComponent(cfg.branch)}`;
}

function rawUrl(cfg, id) {
  return `https://raw.githubusercontent.com/${cfg.repo}/${encodeURIComponent(cfg.branch)}/${encodeURIComponent(cfg.path)}/${id}.json`;
}

async function ghGet(id) {
  const cfg = repoConfig();
  if (!cfg.token) return null;
  try {
    const r = await fetch(rawUrl(cfg, id), {
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'User-Agent': 'marketnow-mandates',
        Accept: 'application/vnd.github.raw',
      },
    });
    if (r.status === 404) return null;
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function ghWrite(id, mandate, isCreate) {
  const cfg = repoConfig();
  if (!cfg.token) return false;
  const url = fileUrl(cfg, id);
  const method = isCreate ? 'PUT' : 'PUT';
  const body = {
    message: `${isCreate ? 'create' : 'update'} mandate ${id}`,
    content: Buffer.from(JSON.stringify(mandate, null, 2)).toString('base64'),
    branch: cfg.branch,
  };
  if (!isCreate) {
    const existing = await ghGet(id);
    if (existing && existing._ghSha) body.sha = existing._ghSha;
  }
  try {
    const r = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'User-Agent': 'marketnow-mandates',
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function ghWriteWithRetry(id, mutator, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const current = await ghGet(id);
    if (!current) return null;
    const updated = mutator(current);
    if (updated === null) return null;
    const ok = await ghWrite(id, updated, false);
    if (ok) {
      mandateCache.invalidate(id);
      return updated;
    }
    // On failure, retry (GitHub returns 409 if sha mismatch)
    await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
  }
  return null;
}

// ─── In-memory fallback (when no GitHub token) ──────────────────────────
const _mem = new Map();

// ─── Public API ─────────────────────────────────────────────────────────

export async function getMandate(id) {
  const cached = mandateCache.get(id);
  if (cached) return cached;

  let mandate;
  if (hasGitHub()) {
    mandate = await ghGet(id);
  } else {
    mandate = _mem.get(id) || null;
  }

  if (mandate) {
    mandateCache.set(id, mandate);
  }
  return mandate;
}

export async function listMandates(filter) {
  if (hasGitHub()) {
    const cfg = repoConfig();
    const url = `https://api.github.com/repos/${cfg.repo}/contents/${encodeURIComponent(cfg.path)}?ref=${encodeURIComponent(cfg.branch)}`;
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'User-Agent': 'marketnow-mandates',
        Accept: 'application/vnd.github+json',
      },
    });
    if (!r.ok) return [];
    const files = await r.json();
    if (!Array.isArray(files)) return [];
    const out = [];
    for (const f of files) {
      if (f.type !== 'file' || !f.name.endsWith('.json')) continue;
      const m = await ghGet(f.name.replace(/\.json$/, ''));
      if (!m) continue;
      if (filter?.owner && m.owner !== String(filter.owner).toLowerCase()) continue;
      if (filter?.agent && m.agentId !== filter.agent) continue;
      out.push(m);
    }
    out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return out;
  }
  let out = Array.from(_mem.values());
  if (filter?.owner) out = out.filter(m => m.owner === String(filter.owner).toLowerCase());
  if (filter?.agent) out = out.filter(m => m.agentId === filter.agent);
  out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return out;
}

export async function createMandateRecord(mandate) {
  if (hasGitHub()) {
    await ghWrite(mandate.id, mandate, true);
  } else {
    _mem.set(mandate.id, mandate);
  }
  mandateCache.set(mandate.id, mandate);
  return mandate;
}

export async function updateMandateRecord(id, mutator) {
  let result;
  if (hasGitHub()) {
    result = await ghWriteWithRetry(id, mutator);
  } else {
    const current = _mem.get(id);
    if (!current) return null;
    const updated = mutator(current);
    if (updated === null) return null;
    _mem.set(id, updated);
    result = updated;
  }
  if (result) mandateCache.set(id, result);
  return result;
}

/**
 * Record a mandate spend. Called by /api/agent-purchase.js AFTER USDC tx
 * is verified on-chain AND txHash is marked as used.
 *
 * Idempotency: if the same txHash is spent twice, the second call is a
 * no-op (the mutator checks m.lastSpendTx).
 *
 * Returns: { ok: true, mandate } on success
 *          { ok: false, code, ... } on conflict (exhausted, expired, etc.)
 */
export async function recordSpend(id, amount, txHash, skill) {
  let conflict = null;
  const updated = await updateMandateRecord(id, (m) => {
    if (!m) { conflict = { code: 'not_found' }; return null; }
    if (m.status !== 'active') { conflict = { code: 'bad_status', status: m.status }; return null; }
    if (isExpired(m)) {
      m.status = 'expired';
      conflict = { code: 'expired' };
      return m;
    }
    // Idempotency: same txHash already recorded → no-op success
    if (txHash && m.lastSpendTx === txHash) {
      conflict = { code: 'already_recorded' };
      return m;
    }
    if (m.spentUsd + amount > m.spendingLimitUsd) {
      conflict = {
        code: 'exhausted',
        remaining: m.spendingLimitUsd - m.spentUsd,
        requested: amount,
      };
      return null;
    }
    m.spentUsd = Number((m.spentUsd + amount).toFixed(2));
    m.txCount = (m.txCount || 0) + 1;
    m.lastSpendAt = nowIso();
    m.lastSpendTx = txHash || null;
    m.lastSpendSkillId = skill?.id || null;
    m.lastSpendSkillName = skill?.name || null;
    return m;
  });

  if (conflict) {
    return { ok: conflict.code === 'already_recorded', ...conflict, mandate: updated };
  }
  if (!updated) {
    return { ok: false, code: 'not_found' };
  }

  // Autonomous limit check (mirrors mandates.js behavior)
  const autonomousRemaining = AUTONOMOUS_PURCHASE_LIMIT - (updated.txCount || 0);
  const requiresReapproval = autonomousRemaining <= 0;
  let finalMandate = updated;

  if (requiresReapproval) {
    finalMandate = await updateMandateRecord(id, (m) => {
      if (!m) return null;
      m.status = 'requires_reapproval';
      m.reapprovalReason = `Autonomous purchase limit (${AUTONOMOUS_PURCHASE_LIMIT}) reached. Human must re-approve.`;
      return m;
    }) || updated;
  }

  return {
    ok: true,
    mandate: finalMandate,
    remaining: finalMandate.spendingLimitUsd - finalMandate.spentUsd,
    autonomous_remaining: Math.max(0, autonomousRemaining),
    requires_reapproval: requiresReapproval,
  };
}

export function buildMandateMessage(agentId, spendingLimitUsd, owner) {
  return `MarketNow Mandate\nAgent: ${agentId}\nLimit: $${spendingLimitUsd}\nOwner: ${owner}`;
}

export function verifyMandateSignature(signature, agentId, spendingLimitUsd, owner) {
  if (!signature || !owner) return false;
  try {
    const message = buildMandateMessage(agentId, spendingLimitUsd, owner);
    const recoveredAddress = verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === owner.toLowerCase();
  } catch {
    return false;
  }
}

export function isExpiredMandate(m) { return isExpired(m); }
export function newMandateId() {
  return 'mand_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4);
}

export const constants = {
  MAX_TOTAL_LIMIT,
  MAX_PER_PURCHASE_CAP,
  MANDATE_TTL_DAYS,
  AUTONOMOUS_PURCHASE_LIMIT,
  VETO_WINDOW_SECONDS,
  DEFAULT_NOTIFICATION_MODE,
  NOTIFICATION_MODES,
};
