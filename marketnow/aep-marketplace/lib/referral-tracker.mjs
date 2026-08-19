/**
 * MarketNow — Referral Tracker
 * =============================
 *
 * Tracks referrals: when an agent calls get_install_command with a unique
 * ref code, and another agent later calls agent-purchase with that ref code,
 * the original referrer accumulates credit.
 *
 * This is the missing piece of the "agent magnet" — the viral loop was
 * designed but never actually tracked. Now it does.
 *
 * Storage: _data/referrals/{ref_code}.json (audit-ledger pattern, same as
 * ATC and receipts). Every referral is a git commit.
 *
 * Join-key map (for Vibe interop):
 *   ref_code       ↔ vibe_decision_ref (alternative citation)
 *   referrer_agent ↔ vibe_agent_id
 *
 * Endpoints (registered in /api/referrals):
 *   GET  /api/referrals?action=lookup&ref_code=ref_xxx   — get referral stats
 *   GET  /api/referrals?action=list&agent_id=agent_xxx   — list referrals by agent
 *   POST /api/referrals  { action: "mint", agent_id }    — mint a new ref code
 *   POST /api/referrals  { action: "credit", ref_code, skill_id, amount } — record credit
 */

import crypto from 'crypto';
import { canonicalize as rfc8785Canonicalize } from './canonical-json.mjs';

const GITHUB_TOKEN = process.env.MANDATES_GITHUB_TOKEN;
const REPO = process.env.MANDATES_REPO || 'edgarfloresguerra2011-a11y/marketnow';
const BRANCH = 'master';
const REFERRALS_DIR = '_data/referrals';

// ─── Helpers ─────────────────────────────────────────────────────────────

export function newRefCode(agentId) {
  // Format: ref_<8 hex chars based on agent_id + random>
  const seed = agentId || 'anon';
  const hash = crypto.createHash('sha256').update(seed + Date.now()).digest('hex');
  return 'ref_' + hash.slice(0, 8);
}

async function fetchReferral(refCode) {
  if (!refCode) return null;
  if (!GITHUB_TOKEN) return null;
  const url = `https://api.github.com/repos/${REPO}/contents/${REFERRALS_DIR}/${encodeURIComponent(refCode)}.json?ref=${encodeURIComponent(BRANCH)}`;
  try {
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'marketnow-referrals',
      },
    });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    const meta = await r.json();
    const content = Buffer.from(meta.content, 'base64').toString('utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function persistReferral(refCode, referral) {
  if (!GITHUB_TOKEN) {
    return { persisted: false, reason: 'no_github_token' };
  }

  const filePath = `${REFERRALS_DIR}/${encodeURIComponent(refCode)}.json`;

  // Check existing SHA for update
  let sha = null;
  try {
    const metaUrl = `https://api.github.com/repos/${REPO}/contents/${filePath}?ref=${encodeURIComponent(BRANCH)}`;
    const metaR = await fetch(metaUrl, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'marketnow-referrals',
      },
    });
    if (metaR.ok) {
      const meta = await metaR.json();
      sha = meta?.sha || null;
    }
  } catch {}

  const content = Buffer.from(JSON.stringify(referral, null, 2)).toString('base64');
  const url = `https://api.github.com/repos/${REPO}/contents/${filePath}`;
  const body = {
    message: `update referral ${refCode}`,
    content,
    branch: BRANCH,
  };
  if (sha) body.sha = sha;

  const r = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'marketnow-referrals',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const errBody = await r.text();
    throw new Error(`GitHub referral persist failed: ${r.status} ${errBody.slice(0, 200)}`);
  }

  return { persisted: true };
}

/**
 * Mint a new referral code for an agent.
 * @param {string} agentId - the agent that will share this ref code
 * @returns {Promise<{ref_code: string, agent_id: string, created_at: string, credits: number, total_earned_usd: number}>}
 */
export async function mintReferral(agentId) {
  if (!agentId) throw new Error('agent_id required to mint a ref code');
  const refCode = newRefCode(agentId);
  const now = new Date().toISOString();

  const referral = {
    ref_code: refCode,
    agent_id: agentId,
    created_at: now,
    status: 'active',
    clicks: 0,
    installs: 0,
    purchases: 0,
    total_earned_usd: 0,
    history: [],
  };

  try {
    await persistReferral(refCode, referral);
  } catch (e) {
    console.error('Referral mint persist failed (non-fatal):', e.message);
  }

  return referral;
}

/**
 * Credit a referral when a purchase is made with a ref code.
 * @param {string} refCode - the ref code used in the purchase
 * @param {object} purchase - { skill_id, license_key, amount_usd, tx_hash, receipt_id }
 * @returns {Promise<object>} updated referral record
 */
export async function creditReferral(refCode, purchase) {
  if (!refCode) return null;
  if (!refCode.startsWith('ref_')) return null;

  const referral = await fetchReferral(refCode);
  if (!referral) {
    // Referral not found — silently ignore (don't break the purchase)
    return null;
  }
  if (referral.status === 'revoked') return null;

  const commissionRate = 0.05; // 5% commission to referrer
  const commission = Number((purchase.amount_usd * commissionRate).toFixed(2));

  referral.purchases += 1;
  referral.installs += 1;
  referral.total_earned_usd = Number((referral.total_earned_usd + commission).toFixed(2));
  referral.history.push({
    timestamp: new Date().toISOString(),
    action: 'purchase',
    skill_id: purchase.skill_id,
    license_key: purchase.license_key,
    amount_usd: purchase.amount_usd,
    commission_earned_usd: commission,
    tx_hash: purchase.tx_hash || null,
    receipt_id: purchase.receipt_id || null,
  });

  try {
    await persistReferral(refCode, referral);
  } catch (e) {
    console.error('Referral credit persist failed (non-fatal):', e.message);
  }

  return referral;
}

/**
 * Increment the click counter when an agent calls get_install_command
 * with a ref code (regardless of whether they later purchase).
 */
export async function recordReferralClick(refCode) {
  if (!refCode) return null;
  if (!refCode.startsWith('ref_')) return null;

  const referral = await fetchReferral(refCode);
  if (!referral) return null;
  if (referral.status === 'revoked') return null;

  referral.clicks += 1;
  referral.history.push({
    timestamp: new Date().toISOString(),
    action: 'click',
  });

  try {
    await persistReferral(refCode, referral);
  } catch (e) {
    console.error('Referral click persist failed (non-fatal):', e.message);
  }

  return referral;
}

/**
 * Get referral stats.
 */
export async function lookupReferral(refCode) {
  return await fetchReferral(refCode);
}

/**
 * List all referrals by agent_id.
 * Walks the referrals directory (limited to first 50 to stay under rate limit).
 */
export async function listReferralsByAgent(agentId) {
  if (!agentId) return [];
  if (!GITHUB_TOKEN) return [];

  const url = `https://api.github.com/repos/${REPO}/contents/${REFERRALS_DIR}?ref=${encodeURIComponent(BRANCH)}`;
  try {
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'marketnow-referrals',
      },
    });
    if (!r.ok) return [];
    const files = await r.json();
    if (!Array.isArray(files)) return [];

    const matching = [];
    const refFiles = files.filter(f => f.type === 'file' && f.name.startsWith('ref_') && f.name.endsWith('.json'));
    // Limit to first 50 to avoid rate limit
    const batch = refFiles.slice(0, 50);
    const results = await Promise.all(batch.map(async f => {
      try {
        const fr = await fetch(f.download_url, { headers: { 'User-Agent': 'marketnow-referrals' } });
        if (!fr.ok) return null;
        return await fr.json();
      } catch { return null; }
    }));
    for (const ref of results) {
      if (ref && ref.agent_id === agentId) {
        matching.push({
          ref_code: ref.ref_code,
          created_at: ref.created_at,
          status: ref.status,
          clicks: ref.clicks,
          installs: ref.installs,
          purchases: ref.purchases,
          total_earned_usd: ref.total_earned_usd,
        });
      }
    }
    return matching;
  } catch {
    return [];
  }
}
