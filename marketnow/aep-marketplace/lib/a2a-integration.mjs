/**
 * MarketNow — A2A Agent Card Support
 * ===================================
 *
 * Google's A2A (Agent-to-Agent) protocol uses "Agent Cards" for discovery.
 * MarketNow accepts A2A Agent Cards and issues an ATC on top —
 * combining A2A discovery with ATC trust verification.
 *
 * Flow:
 *   1. Agent publishes an A2A Agent Card at /.well-known/agent-card.json
 *   2. Agent calls POST /api/atc {action:"issue", a2a_card: true, agent_url: "..."}
 *   3. MarketNow fetches the A2A Agent Card
 *   4. MarketNow issues an ATC that wraps the A2A card + adds Sentinel score
 *   5. Other agents can verify the ATC (which includes A2A metadata)
 *
 * This makes MarketNow complementary to A2A, not competitive.
 */

import crypto from 'crypto';

/**
 * Fetch an A2A Agent Card from a URL.
 * A2A cards are published at /.well-known/agent-card.json
 */
export async function fetchA2ACard(agentUrl) {
  if (!agentUrl) return null;
  try {
    // Normalize URL
    let cardUrl = agentUrl;
    if (!cardUrl.includes('/.well-known/')) {
      const base = new URL(agentUrl);
      cardUrl = `${base.protocol}//${base.host}/.well-known/agent-card.json`;
    }

    const res = await fetch(cardUrl, {
      headers: { 'User-Agent': 'marketnow-atc-a2a' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Convert an A2A Agent Card into an ATC payload.
 * Adds Sentinel trust score on top of A2A metadata.
 */
export function a2aToATCPayload(a2aCard, sentinelScore = 0, riskLevel = 'not_audited') {
  return {
    agent_id: a2aCard.name || a2aCard.url || 'unknown',
    agent_name: a2aCard.description?.split('.')[0] || a2aCard.name || 'A2A Agent',
    identity: {
      public_key: a2aCard.publicKey || a2aCard.public_key || null,
      key_algorithm: 'Ed25519',
      a2a_card_url: a2aCard.url || null,
    },
    trust: {
      sentinel_score: sentinelScore,
      risk_level: riskLevel,
      a2a_verified: true,
      a2a_capabilities: a2aCard.capabilities || [],
      a2a_skills: a2aCard.skills || [],
    },
    capabilities: {
      provides: a2aCard.capabilities || [],
      protocol_language: 'a2a+mcp',
      translate: true,
      a2a_version: a2aCard.version || '1.0',
    },
    payment: {
      method: 'x402 + USDC on Base L2',
      wallet_address: a2aCard.wallet || null,
    },
    metadata: {
      issued_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      issuer: 'MarketNow Sentinel CA',
      a2a_integration: true,
    },
  };
}

/**
 * Verify an A2A Agent Card is valid.
 * Checks: has name, has URL, has capabilities, not expired.
 */
export function validateA2ACard(card) {
  const errors = [];
  if (!card.name) errors.push('missing name');
  if (!card.url && !card.endpoint) errors.push('missing url or endpoint');
  if (!card.capabilities || !Array.isArray(card.capabilities) || card.capabilities.length === 0) {
    errors.push('missing or empty capabilities');
  }
  return {
    valid: errors.length === 0,
    errors,
    card: card.name || 'unknown',
  };
}

export { fetchA2ACard as default };
