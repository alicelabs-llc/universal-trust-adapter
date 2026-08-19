/**
 * MarketNow — Delegated Mandates API (ACP / AP2 compliant)
 * =================================================================
 *
 * v2.0 — Concurrency fixes (4 julio 2026)
 *   - Cache de lectura en memoria (TTL 30s) — reduce llamadas GitHub API
 *   - Invalidación write-through: writes invalidan cache
 *   - Rate limiting REAL por IP (30 req/min)
 *   - Sin esto, 100 usuarios activos saturaban los 5000 req/hour de GitHub
 *
 * Persistence: GitHub repo as a database (file-per-mandate at
 * `_data/mandates/mand_xxx.json` on master branch). No external
 * services required beyond a GitHub PAT — uses the existing
 * edgarfloresguerra2011-a11y/marketnow repo.
 *
 * Why GitHub?
 *   - Free, no signup, no new credentials
 *   - Durable across cold starts (unlike in-memory)
 *   - Transparent — every mandate write is a git commit, visible in the
 *     repo history. That's an audit log for free.
 *   - Rate limit: 5000 req/hour for authenticated requests
 *
 * Concurrency: writes use the contents API with the SHA of the previous
 * version. If two writes race, the second gets a 409 — we retry up to
 * 3 times by re-reading and re-applying the change.
 *
 * Required env vars:
 *   MANDATES_GITHUB_TOKEN  — GitHub PAT with repo scope
 *   MANDATES_REPO          — default: edgarfloresguerra2011-a11y/marketnow
 *   MANDATES_BRANCH        — default: master
 *   MANDATES_PATH          — default: _data/mandates
 *
 * Fallback: in-memory (resets on cold start) if no token configured.
 *
 * Endpoints (unchanged from v1.0.0):
 *   POST   /api/mandates            -> create
 *   GET    /api/mandates?id=...     -> get one
 *   GET    /api/mandates?owner=...  -> list by owner
 *   GET    /api/mandates?agent=...  -> list by agent
 *   POST   /api/mandates?action=revoke&id=...
 *   POST   /api/mandates?action=spend {id, amount, txHash}
 */

import * as mandateCache from '../lib/mandate-cache.mjs';
import { checkRateLimit } from '../lib/rate-limit.mjs';
import { setCorsHeaders } from '../lib/cors.mjs';
// FINDING P5 FIX (rushabdev): hash EIP-191 signatures before storing.
// The raw signature could be replayed in a non-EIP-191 context (e.g. as a
// personal_sign over the same message) by anyone reading the public GitHub
// repo. Storing only the SHA-256 hash lets us verify future signatures
// against the same mandate without retaining the replayable artifact.
import crypto from 'crypto';

const GITHUB_API = 'https://api.github.com';

function sha256hex(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

// L4 FIX: fail closed si INTERNAL_SECRET no está configurado
const INTERNAL_SECRET = process.env.MANDATES_INTERNAL_SECRET;
if (!INTERNAL_SECRET && process.env.NODE_ENV === 'production') {
  console.error('CRITICAL: MANDATES_INTERNAL_SECRET is not set. Internal spend calls will fail closed.');
}

// M7 FIX: allowlist de webhooks permitidos (anti-SSRF)
const ALLOWED_WEBHOOK_HOSTS = [
  'hooks.slack.com',
  'discord.com',
  'discordapp.com',
  'api.telegram.org',
  'events.hookdeck.com',
  'hook.us1.make.com',
  'zapier.com',
  'hooks.zapier.com',
];

function validateWebhookUrl(url) {
  if (!url) return { ok: true };
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') {
      return { ok: false, error: 'webhook must be https' };
    }
    const hostname = u.hostname.toLowerCase();
    const allowed = ALLOWED_WEBHOOK_HOSTS.some(h =>
      hostname === h || hostname.endsWith('.' + h)
    );
    if (!allowed) {
      return { ok: false, error: `webhook host '${hostname}' not allowlisted. Allowed: ${ALLOWED_WEBHOOK_HOSTS.join(', ')}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `invalid webhook URL: ${e.message}` };
  }
}

function repoConfig() {
  return {
    token: process.env.MANDATES_GITHUB_TOKEN,
    repo: process.env.MANDATES_REPO || 'edgarfloresguerra2011-a11y/marketnow',
    branch: process.env.MANDATES_BRANCH || 'master',
    path: process.env.MANDATES_PATH || '_data/mandates',
  };
}

function hasGitHub() {
  return !!process.env.MANDATES_GITHUB_TOKEN;
}

// In-memory fallback (dev / no-token configured).
const _mem = new Map();

function newId() {
  return 'mand_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
function nowIso() { return new Date().toISOString(); }
function isExpired(m) {
  if (!m.expiresAt) return false;
  return new Date(m.expiresAt).getTime() < Date.now();
}

// ---------- GitHub storage layer ----------

function fileUrl(cfg, id) {
  return `${GITHUB_API}/repos/${cfg.repo}/contents/${encodeURIComponent(cfg.path)}/${id}.json?ref=${encodeURIComponent(cfg.branch)}`;
}
function rawUrl(cfg, id) {
  return `https://raw.githubusercontent.com/${cfg.repo}/${encodeURIComponent(cfg.branch)}/${encodeURIComponent(cfg.path)}/${id}.json`;
}

async function ghGet(id) {
  const cfg = repoConfig();
  const r = await fetch(rawUrl(cfg, id), {
    headers: { 'User-Agent': 'marketnow-mandates' },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`ghGet ${r.status}: ${await r.text()}`);
  return await r.json();
}

async function ghListIds() {
  const cfg = repoConfig();
  const r = await fetch(
    `${GITHUB_API}/repos/${cfg.repo}/contents/${encodeURIComponent(cfg.path)}?ref=${encodeURIComponent(cfg.branch)}`,
    { headers: { 'User-Agent': 'marketnow-mandates', Authorization: `Bearer ${cfg.token}` } }
  );
  if (r.status === 404) return []; // directory doesn't exist yet
  if (!r.ok) throw new Error(`ghListIds ${r.status}: ${await r.text()}`);
  const items = await r.json();
  return items
    .filter(i => i.type === 'file' && i.name.endsWith('.json'))
    .map(i => i.name.replace(/\.json$/, ''));
}

async function ghWrite(id, mandate, isCreate) {
  const cfg = repoConfig();
  // Get current SHA (for update) or null (for create)
  let sha = null;
  if (!isCreate) {
    try {
      const r = await fetch(fileUrl(cfg, id), {
        headers: { 'User-Agent': 'marketnow-mandates', Authorization: `Bearer ${cfg.token}` },
      });
      if (r.ok) {
        const j = await r.json();
        sha = j.sha;
      }
    } catch {
      // ignore — treat as create
    }
  }
  const body = {
    message: isCreate
      ? `mandate: create ${id} (limit $${mandate.spendingLimitUsd}, agent ${mandate.agentId})`
      : `mandate: update ${id} (status=${mandate.status}, spent=$${mandate.spentUsd})`,
    content: Buffer.from(JSON.stringify(mandate, null, 2)).toString('base64'),
    branch: cfg.branch,
  };
  if (sha) body.sha = sha;
  const r = await fetch(fileUrl(cfg, id), {
    method: 'PUT',
    headers: {
      'User-Agent': 'marketnow-mandates',
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text();
    const err = new Error(`ghWrite ${r.status}: ${text}`);
    err.status = r.status;
    err.body = text;
    throw err;
  }
  return await r.json();
}

async function ghWriteWithRetry(id, mutator, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let current = await ghGet(id);
    const isCreate = current === null;
    if (current === null && attempt > 0) {
      // someone deleted it between our read and write — abort
      throw new Error('mandate disappeared during write');
    }
    const next = mutator(current);
    if (next === null) return null; // mutator decided no-op
    try {
      await ghWrite(id, next, isCreate);
      return next;
    } catch (e) {
      if (e.status === 409 && attempt < maxRetries - 1) {
        // SHA mismatch — someone else wrote first. Re-read, re-apply, retry.
        await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  throw new Error('ghWriteWithRetry exhausted');
}

// ---------- Public storage API ----------

async function getMandate(id) {
  // 1. Revisar cache de lectura (TTL 30s)
  const cached = mandateCache.get(id);
  if (cached) return cached;

  // 2. Fetch desde GitHub o memory
  let mandate;
  if (hasGitHub()) {
    mandate = await ghGet(id);
  } else {
    mandate = _mem.get(id) || null;
  }

  // 3. Guardar en cache si se encontró
  if (mandate) {
    mandateCache.set(id, mandate);
  }
  return mandate;
}

async function listMandates(filter) {
  if (hasGitHub()) {
    const ids = await ghListIds();
    const out = [];
    for (const id of ids) {
      const m = await ghGet(id);
      if (!m) continue;
      if (filter.owner && m.owner !== String(filter.owner).toLowerCase()) continue;
      if (filter.agent && m.agentId !== filter.agent) continue;
      out.push(m);
    }
    out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return out;
  }
  // memory
  let out = Array.from(_mem.values());
  if (filter.owner) out = out.filter(m => m.owner === String(filter.owner).toLowerCase());
  if (filter.agent) out = out.filter(m => m.agentId === filter.agent);
  out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return out;
}

async function createMandateRecord(mandate) {
  if (hasGitHub()) {
    await ghWrite(mandate.id, mandate, true);
  } else {
    _mem.set(mandate.id, mandate);
  }
  // Write-through cache
  mandateCache.set(mandate.id, mandate);
  return mandate;
}

async function updateMandateRecord(id, mutator) {
  let result;
  if (hasGitHub()) {
    result = await ghWriteWithRetry(id, mutator);
  } else {
    const current = _mem.get(id);
    if (!current) return null;
    const next = mutator(current);
    if (next === null) return null;
    _mem.set(id, next);
    result = next;
  }
  // Invalidar cache para que la próxima lectura vea la versión nueva
  if (result) {
    mandateCache.set(id, result);
  } else {
    mandateCache.invalidate(id);
  }
  return result;
}

// ---------- Notifications ----------

async function sendMandateNotification(mandate, event) {
  const { amount, txHash, skillId, skillName, type } = event;
  const subject = `[MarketNow] Mandate ${mandate.id} — $${amount.toFixed(2)} ${type}`;
  const text = [
    `A spend of $${amount.toFixed(2)} was recorded against your mandate.`,
    ``,
    `Mandate:    ${mandate.id}`,
    `Agent:      ${mandate.agentName} (${mandate.agentId})`,
    `Skill:      ${skillName || skillId || '(unknown)'}`,
    `TxHash:     ${txHash || '(direct — no on-chain tx)'}`,
    `Amount:     $${amount.toFixed(2)}`,
    `Remaining:  $${(mandate.spendingLimitUsd - mandate.spentUsd).toFixed(2)} of $${mandate.spendingLimitUsd.toFixed(2)}`,
    `Mode:       ${mandate.notificationMode}`,
    ``,
    `If you did not authorize this, revoke the mandate immediately:`,
    `https://marketnow.site/mandates`,
    ``,
    `— MarketNow (AliceLabs LLC)`,
  ].join('\n');

  // Webhook (preferred — supports Slack/Discord/Telegram/custom)
  if (mandate.notificationWebhook) {
    try {
      await fetch(mandate.notificationWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: subject + '\n\n' + text,
          mandate_id: mandate.id,
          amount, skillId, skillName, txHash,
          mode: mandate.notificationMode,
          timestamp: nowIso(),
        }),
      });
    } catch (e) {
      console.error('webhook notification failed:', e);
    }
  }

  // Email — we use Vercel's built-in email forwarding if RESEND_API_KEY is set.
  // Until then we log the email content (so it's visible in the function logs)
  // and skip actual delivery. This is disclosed on /trust.
  if (mandate.notificationEmail) {
    if (process.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'MarketNow <support@alicelabs.site>',
            to: mandate.notificationEmail,
            subject,
            text,
          }),
        });
      } catch (e) {
        console.error('email notification failed:', e);
      }
    } else {
      console.log(`[mandate-notification] (email not configured) To: ${mandate.notificationEmail}\n${subject}\n${text}`);
    }
  }
}

// ---------- HTTP handler ----------

const MANDATE_TTL_DAYS = 90;
const MAX_PER_PURCHASE_CAP = 50;
const MAX_TOTAL_LIMIT = 500;

// AUTONOMOUS PURCHASE ALLOWANCE: first N purchases are fully autonomous
// (no human approval needed, but notification is sent). After N purchases,
// the mandate requires explicit human re-approval.
// This gives agents freedom to act quickly while keeping humans in control.
const AUTONOMOUS_PURCHASE_LIMIT = 3;

// Default notification mode is "notify" — every purchase within a mandate
const DEFAULT_NOTIFICATION_MODE = 'notify';
const VETO_WINDOW_SECONDS = 300;
const NOTIFICATION_MODES = ['silent', 'notify', 'notify_and_veto'];

// Internal secret for agent-purchase → mandates spend calls
// SECURITY FIX 2.1a: Must be set as independent env var, NOT derived from GitHub token
// If not set, we fail closed (reject all internal spend calls) — declared at top of file
// (INTERNAL_SECRET is already declared above with L4 fix)

// ============================================================
// EIP-191 Signature Verification (FIX 1.2 complete)
// Verifies that the signature was produced by the owner wallet
// ============================================================
import { verifyMessage } from 'ethers';

/**
 * Build the canonical message that the owner must sign.
 * Format: marketnow-mandate:{agentId}:{spendingLimitUsd}:{owner}
 */
function buildMandateMessage(agentId, spendingLimitUsd, owner) {
  return `marketnow-mandate:${agentId}:${spendingLimitUsd}:${owner.toLowerCase()}`;
}

/**
 * Verify EIP-191 signature.
 * Returns true if the signature was produced by the owner wallet.
 * Returns false if verification fails.
 */
function verifyMandateSignature(signature, agentId, spendingLimitUsd, owner) {
  if (!signature || !owner) return false;
  try {
    const message = buildMandateMessage(agentId, spendingLimitUsd, owner);
    const recoveredAddress = verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === owner.toLowerCase();
  } catch (e) {
    console.error('Signature verification error:', e.message);
    return false;
  }
}

// Check if caller is authorized for spend action
// Only internal calls from agent-purchase.js should hit spend
function isInternalCall(body) {
  // L4 FIX: fail closed si INTERNAL_SECRET no está configurado
  if (!INTERNAL_SECRET) return false;
  return body._internal === true && body._secret === INTERNAL_SECRET;
}

function jsonHeaders(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  // H1 FIX: CORS allowlist en vez de *
  setCorsHeaders(req, res);
  res.setHeader('Vary', 'Origin');
}

export default async function handler(req, res) {
  jsonHeaders(req, res);
  if (req.method === 'OPTIONS' || req.method === 'HEAD') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'GET or POST only' });
  }

  // ===== FIX: Rate limiting REAL (30 req/min) =====
  if (checkRateLimit(req, res, 'mandates')) return;

  try {
    const body = req.body || {};
    const query = req.query || {};
    const action = body.action || query.action;

    // ---------- CREATE ----------
    if (req.method === 'POST' && !action) {
      const {
        owner, agentId, agentName, spendingLimitUsd,
        perPurchaseCapUsd, categories, expiresAt, signature,
        notificationMode, notificationEmail, notificationWebhook,
        // AP2-compatible fields (Agent Payments Protocol)
        ap2_format, ap2_mandate_id, ap2_signature, ap2_issuer,
        // Task-scoped mandate fields (future direction)
        task_description, task_hash,
      } = body;

      if (!owner || !agentId || !spendingLimitUsd) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['owner (wallet)', 'agentId', 'spendingLimitUsd', 'signature (EIP-191)'],
          optional: ['perPurchaseCapUsd', 'categories', 'expiresAt', 'agentName', 'notificationMode', 'notificationEmail', 'notificationWebhook'],
          security_note: 'signature is now REQUIRED — EIP-191 signature over mandate data, signed by the owner wallet. Prevents creating mandates on behalf of another wallet.',
        });
      }

      // SECURITY FIX 1.2: Require AND verify EIP-191 signature cryptographically
      // Prevents anyone from creating mandates on behalf of another wallet
      if (!signature) {
        return res.status(400).json({
          error: 'signature is required',
          reason: 'You must sign the mandate data with the owner wallet (EIP-191). This proves you control the wallet address specified as owner.',
          how_to_sign: `Sign this message with your wallet: ${buildMandateMessage(agentId, spendingLimitUsd, owner)}`,
        });
      }

      // Verify the signature cryptographically using ethers.js
      const sigValid = verifyMandateSignature(signature, agentId, spendingLimitUsd, owner);
      if (!sigValid) {
        return res.status(403).json({
          error: 'invalid_signature',
          reason: 'The signature does not match the owner wallet. Ensure you signed the exact message with the wallet that matches the owner address.',
          expected_message: buildMandateMessage(agentId, spendingLimitUsd, owner),
          expected_signer: owner,
        });
      }

      // Validate notification mode (default to "notify" — human in loop by default)
      const notifMode = NOTIFICATION_MODES.includes(notificationMode)
        ? notificationMode
        : DEFAULT_NOTIFICATION_MODE;
      // If mode is silent, require explicit confirmation field
      if (notifMode === 'silent' && !body.confirmSilentAutonomy) {
        return res.status(400).json({
          error: 'silent mode requires explicit confirmation',
          field: 'confirmSilentAutonomy: true',
          reason: 'silent mode means the agent spends with NO human notification. This is opt-in by design — set confirmSilentAutonomy=true to acknowledge.',
          recommended: 'Use "notify" (default) or "notify_and_veto" instead.',
        });
      }
      // If notify or notify_and_veto, require email or webhook
      if ((notifMode === 'notify' || notifMode === 'notify_and_veto') && !notificationEmail && !notificationWebhook) {
        return res.status(400).json({
          error: `notificationMode "${notifMode}" requires notificationEmail or notificationWebhook`,
          reason: 'The principal must have a way to receive the alerts for them to mean anything.',
        });
      }

      // M7 FIX: validar webhook URL contra allowlist (anti-SSRF)
      if (notificationWebhook) {
        const webhookCheck = validateWebhookUrl(notificationWebhook);
        if (!webhookCheck.ok) {
          return res.status(400).json({
            error: 'invalid_webhook',
            message: webhookCheck.error,
          });
        }
      }

      const limit = Number(spendingLimitUsd);
      // M6 FIX: default perPurchase a min(MAX_PER_PURCHASE_CAP, limit), no al limit completo
      const perPurchase = perPurchaseCapUsd != null
        ? Number(perPurchaseCapUsd)
        : Math.min(MAX_PER_PURCHASE_CAP, limit);

      if (isNaN(limit) || limit <= 0 || limit > MAX_TOTAL_LIMIT) {
        return res.status(400).json({
          error: `spendingLimitUsd must be between 0.01 and ${MAX_TOTAL_LIMIT}`,
        });
      }
      if (perPurchase > limit || perPurchase > MAX_PER_PURCHASE_CAP) {
        return res.status(400).json({
          error: `perPurchaseCapUsd cannot exceed ${Math.min(limit, MAX_PER_PURCHASE_CAP)}`,
        });
      }

      const id = newId();
      const mandate = {
        id,
        owner: owner.toLowerCase(),
        agentId,
        agentName: agentName || 'unspecified',
        spendingLimitUsd: limit,
        spentUsd: 0,
        perPurchaseCapUsd: perPurchase,
        categories: Array.isArray(categories) && categories.length ? categories : ['*'],
        expiresAt: expiresAt || new Date(Date.now() + MANDATE_TTL_DAYS * 86400000).toISOString(),
        createdAt: nowIso(),
        status: 'active',
        // FINDING P5 FIX (rushabdev): store SHA-256 hash, not raw signature.
        // The raw EIP-191 signature is replayable in a different signing
        // context (personal_sign over the same message) by anyone who reads
        // this public GitHub file. The hash is sufficient for our use case
        // (verify-at-create-time, then trust the mandate record itself).
        signature_hash: signature ? sha256hex(signature) : null,
        signature_algorithm: signature ? 'EIP-191-SHA256' : null,
        txCount: 0,
        notificationMode: notifMode,
        notificationEmail: notificationEmail || null,
        notificationWebhook: notificationWebhook || null,
        vetoWindowSeconds: notifMode === 'notify_and_veto' ? VETO_WINDOW_SECONDS : 0,
        // AP2 compatibility fields — if a mandate was issued by an AP2-compliant
        // issuer, we store the cross-platform reference so it can be verified
        // by any AP2-aware agent. See /standards.
        // FINDING P5 FIX (rushabdev): hash AP2 signature too.
        ap2: ap2_format ? {
          format: ap2_format,
          mandate_id: ap2_mandate_id || null,
          signature_hash: ap2_signature ? sha256hex(ap2_signature) : null,
          issuer: ap2_issuer || null,
          verified: false, // we have not yet verified the AP2 signature
        } : null,
        // Task-scoped mandate fields (roadmap — see /standards)
        taskScope: task_description ? {
          description: task_description,
          hash: task_hash || null,
        } : null,
      };

      await createMandateRecord(mandate);
      return res.status(201).json({
        success: true,
        mandate,
        autonomous_purchase_limit: AUTONOMOUS_PURCHASE_LIMIT,
        autonomous_note: `Agent can make ${AUTONOMOUS_PURCHASE_LIMIT} purchases autonomously. After that, human re-approval is required. This balances agent freedom with human control per LLM provider policies.`,
        persistence: hasGitHub() ? 'github' : 'memory',
        documentation: 'https://marketnow.site/mandates',
        note: 'Agent may now purchase autonomously up to the limit. Beyond it, /api/agent-purchase returns mode=requires_human_approval.',
      });
    }

    // ---------- REVOKE ----------
    // SECURITY FIX 2.1b: Require EIP-191 signature from owner to revoke
    if (req.method === 'POST' && action === 'revoke') {
      const id = body.id || query.id;
      if (!id) return res.status(400).json({ error: 'id required' });
      
      // Fetch the mandate first to check ownership
      const mandate = await getMandate(id);
      if (!mandate) return res.status(404).json({ error: 'Mandate not found' });
      
      // Require signature from the owner wallet
      const revokeSignature = body.signature || query.signature;
      if (!revokeSignature) {
        return res.status(400).json({
          error: 'signature is required to revoke',
          reason: 'You must sign the revoke message with the owner wallet to prove you control it.',
          how_to_sign: `Sign this message with your wallet: marketnow-revoke:${id}`,
          owner: mandate.owner,
        });
      }
      
      // Verify the signature cryptographically
      const revokeMessage = `marketnow-revoke:${id}`;
      let sigValid = false;
      try {
        const recoveredAddress = verifyMessage(revokeMessage, revokeSignature);
        sigValid = recoveredAddress.toLowerCase() === mandate.owner.toLowerCase();
      } catch (e) {
        console.error('Revoke signature verification error:', e.message);
      }
      
      if (!sigValid) {
        return res.status(403).json({
          error: 'invalid_signature',
          reason: 'The signature does not match the owner wallet of this mandate. Only the owner can revoke.',
          expected_message: revokeMessage,
          expected_signer: mandate.owner,
        });
      }
      
      const updated = await updateMandateRecord(id, (m) => {
        if (!m) return null;
        m.status = 'revoked';
        m.revokedAt = nowIso();
        m.revokedBy = mandate.owner;
        return m;
      });
      if (!updated) return res.status(404).json({ error: 'Mandate not found' });
      return res.status(200).json({ success: true, mandate: updated });
    }

    // ---------- SPEND ----------
    // SECURITY: spend is INTERNAL ONLY — only agent-purchase.js should call this
    // after verifying the USDC payment on-chain. External callers are rejected.
    if (req.method === 'POST' && action === 'spend') {
      if (!isInternalCall(body)) {
        return res.status(403).json({
          error: 'forbidden',
          reason: 'spend action is internal-only. External callers must use POST /api/agent-purchase which verifies payment on-chain before recording spend.',
        });
      }
      const id = body.id || query.id;
      const amount = Number(body.amount || query.amount);
      const txHash = body.txHash || query.txHash;
      const skillName = body.skillName || query.skillName;
      const skillId = body.skillId || query.skillId;
      if (!id || !amount) return res.status(400).json({ error: 'id and amount required' });

      // Pre-spend: if notify_and_veto mode, return a "pending" response
      // that the agent must confirm after the veto window elapses.
      // (For now we accept the spend but log it — full veto flow requires
      // a pending-spends store which is on the roadmap. See /trust page.)

      let conflict = null;
      const updated = await updateMandateRecord(id, (m) => {
        if (!m) { conflict = { code: 'not_found' }; return null; }
        if (m.status !== 'active') { conflict = { code: 'bad_status', status: m.status }; return null; }
        if (isExpired(m)) {
          m.status = 'expired';
          conflict = { code: 'expired' };
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
        m.lastSpendSkillId = skillId || null;
        m.lastSpendSkillName = skillName || null;
        return m;
      });

      // Best-effort notification (fire-and-forget — don't block the response)
      if (updated && (updated.notificationMode === 'notify' || updated.notificationMode === 'notify_and_veto')) {
        try {
          await sendMandateNotification(updated, {
            amount, txHash, skillId, skillName, type: 'spend',
          });
        } catch (e) {
          console.error('notification failed (non-fatal):', e);
        }
      }

      if (conflict) {
        return res.status(409).json({ error: 'spend_rejected', ...conflict });
      }
      if (!updated) {
        return res.status(404).json({ error: 'Mandate not found' });
      }
      // AUTONOMOUS PURCHASE ALLOWANCE CHECK
      // BUG FIX: was `updated = await updateMandateRecord(...)` which crashes
      // with TypeError: Assignment to constant variable (updated is const).
      // This was triggered every time an agent hit the AUTONOMOUS_PURCHASE_LIMIT
      // (3 purchases), crashing the /api/mandates?action=spend endpoint with 500
      // instead of cleanly setting the mandate to requires_reapproval.
      // Fix: use a separate `let` variable for the re-approval update.
      const autonomousRemaining = AUTONOMOUS_PURCHASE_LIMIT - (updated.txCount || 0);
      const requiresReapproval = autonomousRemaining <= 0;
      let finalMandate = updated;

      if (requiresReapproval) {
        finalMandate = await updateMandateRecord(id, (m) => {
          if (!m) return null;
          m.status = 'requires_reapproval';
          m.reapprovalReason = `Autonomous purchase limit (${AUTONOMOUS_PURCHASE_LIMIT}) reached. Human must re-approve.`;
          return m;
        });
        // If the re-approval update failed, still return the original updated record
        // but flag that re-approval is needed (don't crash)
        if (!finalMandate) {
          finalMandate = updated;
          finalMandate.status = 'requires_reapproval';
          finalMandate.reapprovalReason = `Autonomous purchase limit (${AUTONOMOUS_PURCHASE_LIMIT}) reached. Human must re-approve.`;
        }
      }
      
      return res.status(200).json({
        success: true,
        mandate: finalMandate,
        remaining: finalMandate.spendingLimitUsd - finalMandate.spentUsd,
        notification_sent: finalMandate.notificationMode !== 'silent',
        notification_mode: finalMandate.notificationMode,
        autonomous_remaining: Math.max(0, autonomousRemaining),
        requires_reapproval: requiresReapproval,
        message: requiresReapproval 
          ? `Autonomous limit reached (${AUTONOMOUS_PURCHASE_LIMIT} purchases). Human re-approval required to continue.`
          : `${autonomousRemaining} autonomous purchase${autonomousRemaining === 1 ? '' : 's'} remaining before human re-approval needed.`,
      });
    }

    // ---------- GET (single) ----------
    if (req.method === 'GET' && query.id) {
      const m = await getMandate(query.id);
      if (!m) return res.status(404).json({ error: 'Not found' });
      if (m.status === 'active' && isExpired(m)) {
        const updated = await updateMandateRecord(query.id, (mm) => {
          if (!mm) return null;
          mm.status = 'expired';
          return mm;
        });
        return res.status(200).json({ mandate: updated || m });
      }
      return res.status(200).json({ mandate: m });
    }

    // ---------- LIST ----------
    if (req.method === 'GET' && (query.owner || query.agent)) {
      // OPSEC note: anyone can list mandates for any wallet.
      // Future: require EIP-191 signature from owner.
      const out = await listMandates({
        owner: query.owner,
        agent: query.agent,
      });
      // mark expired in-place
      for (const m of out) {
        if (m.status === 'active' && isExpired(m)) {
          m.status = 'expired';
        }
      }
      // H2 FIX: redact PII en list responses (emails, webhooks)
      // Para ver detalles completos, usar GET /api/mandates?id=mand_xxx
      const redacted = out.map(m => ({
        id: m.id,
        owner: m.owner,
        agentId: m.agentId,
        agentName: m.agentName,
        spendingLimitUsd: m.spendingLimitUsd,
        spentUsd: m.spentUsd,
        perPurchaseCapUsd: m.perPurchaseCapUsd,
        categories: m.categories,
        expiresAt: m.expiresAt,
        createdAt: m.createdAt,
        status: m.status,
        txCount: m.txCount,
        notificationMode: m.notificationMode,
        hasEmail: !!m.notificationEmail,
        hasWebhook: !!m.notificationWebhook,
        lastSpendAt: m.lastSpendAt || null,
        lastSpendSkillName: m.lastSpendSkillName || null,
      }));
      return res.status(200).json({ count: redacted.length, mandates: redacted });
    }

    // ---------- INDEX ----------
    return res.status(200).json({
      service: 'MarketNow Mandates API',
      version: '1.1.0',
      protocol: 'ACP/AP2 (delegated mandates)',
      persistence: hasGitHub() ? 'github' : 'memory',
      persistence_detail: hasGitHub()
        ? 'Each mandate stored as a JSON file in the GitHub repo — durable, transparent, audit-log via commit history.'
        : 'WARNING: In-memory only. Mandates will be lost on cold start. Set MANDATES_GITHUB_TOKEN env var to enable persistence.',
      description:
        'Pre-approved spending allowances that a human principal grants to an AI agent. Agents buy autonomously within the limit; beyond it, human approval is required.',
      endpoints: {
        create: { method: 'POST', path: '/api/mandates' },
        get: { method: 'GET', path: '/api/mandates?id=mand_xxx' },
        listByOwner: { method: 'GET', path: '/api/mandates?owner=0x...' },
        listByAgent: { method: 'GET', path: '/api/mandates?agent=agent_xxx' },
        revoke: { method: 'POST', path: '/api/mandates?action=revoke&id=mand_xxx' },
        spend: { method: 'POST', path: '/api/mandates?action=spend', body: { id: 'mand_xxx', amount: 1.99, txHash: '0x...' } },
      },
      limits: {
        maxTotalLimitUsd: MAX_TOTAL_LIMIT,
        maxPerPurchaseCapUsd: MAX_PER_PURCHASE_CAP,
        defaultTtlDays: MANDATE_TTL_DAYS,
      },
      audit_log: 'Every create / spend / revoke is a git commit on master — visible in the repo history at _data/mandates/.',
      ui: 'https://marketnow.site/mandates',
    });
  } catch (err) {
    console.error('Mandates API error:', err);
    return res.status(500).json({ error: 'mandates_failed', message: err.message });
  }
}
