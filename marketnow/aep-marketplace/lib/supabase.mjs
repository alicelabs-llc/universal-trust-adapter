// ============================================================================
// MarketNow — Supabase Client Library
// ============================================================================
// Replaces GitHub API as the database backend. Eliminates:
//   - 5,000 req/hour GitHub API limit
//   - Race conditions (HTTP 409) on concurrent commits
//   - Single point of failure (GitHub shadowban)
//
// Setup:
//   1. Create a project at https://supabase.com (free tier, 500MB)
//   2. Run db/supabase_schema.sql in the SQL editor
//   3. Get the URL + anon key from Settings > API
//   4. Set Vercel env vars:
//        SUPABASE_URL=https://yourproject.supabase.co
//        SUPABASE_ANON_KEY=eyJ...
//        SUPABASE_SERVICE_ROLE_KEY=eyJ...  (for writes)
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Public client (read-only, anon role)
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

// Service client (full access, service_role — for writes)
export const supabaseService = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

// ============================================================================
// ATC Card operations (replaces _data/atc/*.json read/write)
// ============================================================================

export async function getATCCard(cardId) {
  const { data, error } = await supabasePublic
    .from('atc_cards')
    .select('*')
    .eq('card_id', cardId)
    .single();
  if (error) throw error;
  return data;
}

export async function listATCCards({ status = 'active', limit = 100 } = {}) {
  const { data, error } = await supabasePublic
    .from('atc_cards')
    .select('card_id, agent_id, agent_name, status, sentinel_review_score, issued_at, expires_at')
    .eq('status', status)
    .order('issued_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function getRevocationList() {
  // Returns revoked cards (CRL — Certificate Revocation List)
  const { data, error } = await supabasePublic
    .from('atc_cards')
    .select('card_id, agent_id, status, revoked_at, revocation_reason')
    .eq('status', 'revoked')
    .order('revoked_at', { ascending: false });
  if (error) throw error;
  return { cards: data || [], total: data?.length || 0 };
}

export async function issueATCCard(card) {
  // Insert a new ATC card
  const { data, error } = await supabaseService
    .from('atc_cards')
    .insert({
      card_id: card.card_id,
      schema_version: card.payload.schema_version || '2.0.0',
      agent_id: card.payload.agent_id,
      agent_name: card.payload.agent_name,
      status: 'active',
      payload: card.payload,
      signature: card.signature,
      sentinel_review_score: card.payload.trust?.sentinel_review_score || 0,
      sentinel_score: card.payload.trust?.sentinel_score || 0,
      risk_level: card.payload.trust?.risk_level || 'not_audited',
      ca_key_id: card.signature.ca_key_id,
      canonicalization_method: card.signature.canonical_json,
      evidence_hash: card.signature.evidence_hash,
      policy_version: card.signature.policy_version,
      issued_at: card.payload.metadata?.issued_at,
      expires_at: card.payload.metadata?.expires_at,
    });
  if (error) throw error;
  return data;
}

export async function revokeATCCard(cardId, reason) {
  const { data, error } = await supabaseService
    .from('atc_cards')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      revocation_reason: reason,
    })
    .eq('card_id', cardId);
  if (error) throw error;
  return data;
}

// ============================================================================
// Mandate operations (replaces _data/mandates/*.json)
// ============================================================================

export async function createMandate(mandate) {
  const { data, error } = await supabaseService
    .from('mandates')
    .insert({
      mandate_id: mandate.mandate_id,
      wallet_address: mandate.wallet_address,
      principal_email: mandate.principal_email,
      spending_limit_usd: Math.min(mandate.spending_limit_usd, 500),
      per_purchase_cap_usd: Math.min(mandate.per_purchase_cap_usd, 50),
      notification_mode: mandate.notification_mode || 'notify',
      expires_at: mandate.expires_at,
      tx_hash: mandate.tx_hash,
    });
  if (error) throw error;
  return data;
}

export async function getMandate(mandateId) {
  const { data, error } = await supabasePublic
    .from('mandates')
    .select('*')
    .eq('mandate_id', mandateId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateMandateSpent(mandateId, additionalUsd) {
  // Atomic increment — eliminates the race condition that GitHub had
  const { data, error } = await supabaseService.rpc('increment_mandate_spent', {
    p_mandate_id: mandateId,
    p_additional_usd: additionalUsd,
  });
  if (error) throw error;
  return data;
}

export async function revokeMandate(mandateId) {
  const { data, error } = await supabaseService
    .from('mandates')
    .update({ revoked_at: new Date().toISOString() })
    .eq('mandate_id', mandateId);
  if (error) throw error;
  return data;
}

// ============================================================================
// Quarantine decision operations (replaces _data/quarantine_decisions/)
// ============================================================================

export async function recordQuarantineDecision(decision) {
  const { data, error } = await supabaseService
    .from('quarantine_decisions')
    .insert({
      decision_id: decision.decision_id,
      decision_date: decision.decision_date,
      skill_id: decision.skill_id,
      skill_name: decision.skill_name,
      skill_repo: decision.skill_repo,
      sentinel_score: decision.sentinel_score,
      sentinel_version: decision.sentinel_version,
      layers_run: decision.layers_run,
      layer_findings: decision.layer_findings,
      decision: decision.decision,
      decision_reason: decision.decision_reason,
      decision_authority: decision.decision_authority,
      sha256_artifact: decision.sha256_artifact,
      record_sha256: decision.record_sha256,
    });
  if (error) throw error;
  return data;
}

export async function listQuarantineDecisions({ limit = 100, since } = {}) {
  let query = supabasePublic
    .from('quarantine_decisions')
    .select('*')
    .order('decision_date', { ascending: false })
    .limit(limit);
  if (since) query = query.gte('decision_date', since);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function fileAppeal(decisionId, reason) {
  const { data, error } = await supabaseService
    .from('quarantine_decisions')
    .update({
      appeal_status: 'pending',
      appeal_reason: reason,
    })
    .eq('decision_id', decisionId);
  if (error) throw error;
  return data;
}

export async function resolveAppeal(decisionId, decision, reviewer) {
  const { data, error } = await supabaseService
    .from('quarantine_decisions')
    .update({
      appeal_status: 'approved',
      appeal_decision: decision,  // 'false_positive' | 'confirmed'
      appeal_decision_date: new Date().toISOString(),
      appeal_reviewer: reviewer,
    })
    .eq('decision_id', decisionId);
  if (error) throw error;
  return data;
}

// ============================================================================
// Trust decision logging (replaces in-memory evidence records)
// ============================================================================

export async function logTrustDecision(decision) {
  const { data, error } = await supabaseService
    .from('trust_decisions')
    .insert({
      decision_id: decision.decision_id,
      decision: decision.decision,
      rule_id: decision.rule_id,
      rule_fired_at: decision.rule_fired_at,
      policy_version: decision.policy_version,
      agent_id: decision.agent_id,
      skill_id: decision.skill_id,
      action: decision.action,
      atc_card_id: decision.atc_card_id,
      inputs: decision.inputs,
      reasons: decision.reasons,
      violations: decision.violations,
      evidence_hash: decision.evidence_hash,
      caller_ip: decision.caller_ip,
      caller_user_agent: decision.caller_user_agent,
    });
  if (error) throw error;
  return data;
}

export async function getTrustDecision(decisionId) {
  // Used by /api/trust/evidence/{decision_id}
  const { data, error } = await supabasePublic
    .from('trust_decisions')
    .select('*')
    .eq('decision_id', decisionId)
    .single();
  if (error) throw error;
  return data;
}

// ============================================================================
// License operations (new — Ed25519-signed licenses)
// ============================================================================

export async function issueLicense(license) {
  const { data, error } = await supabaseService
    .from('licenses')
    .insert({
      license_id: license.license_id,
      license_token: license.license_token,
      skill_id: license.skill_id,
      buyer_wallet: license.buyer_wallet,
      buyer_email: license.buyer_email,
      expires_at: license.expires_at,
      signature_value: license.signature_value,
      ca_key_id: license.ca_key_id,
      evidence_hash: license.evidence_hash,
      metadata: license.metadata,
    });
  if (error) throw error;
  return data;
}

export async function getLicenseByToken(token) {
  const { data, error } = await supabasePublic
    .from('licenses')
    .select('*')
    .eq('license_token', token)
    .single();
  if (error) throw error;
  return data;
}

// ============================================================================
// Skills catalog operations
// ============================================================================

export async function getSkill(skillId) {
  const { data, error } = await supabasePublic
    .from('skills')
    .select('*')
    .or(`skill_id.eq.${skillId},slug.eq.${skillId}`)
    .single();
  if (error) throw error;
  return data;
}

export async function listSkills({ category, free, limit = 100, offset = 0 } = {}) {
  let query = supabasePublic
    .from('skills')
    .select('*')
    .order('sentinel_score', { ascending: false })
    .range(offset, offset + limit - 1);
  if (category) query = query.eq('category', category);
  if (free !== undefined) query = query.eq('free', free);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ============================================================================
// Health check
// ============================================================================

export async function checkDatabaseHealth() {
  try {
    const { data, error } = await supabasePublic
      .from('skills')
      .select('count', { count: 'exact', head: true });
    if (error) throw error;
    return { healthy: true, skills_count: data?.length || 0 };
  } catch (e) {
    return { healthy: false, error: e.message };
  }
}
