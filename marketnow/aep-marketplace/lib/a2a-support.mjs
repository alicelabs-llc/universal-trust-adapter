/**
 * MarketNow — A2A (Agent-to-Agent) Agent Card Support
 * =====================================================
 *
 * Google's A2A protocol defines Agent Cards — JSON files at
 * /.well-known/agent-card.json that describe what an agent can do.
 *
 * MarketNow extends A2A Agent Cards with ATC (Agent Trust Card)
 * trust verification. When an agent presents its A2A card,
 * MarketNow:
 *   1. Parses the A2A card (name, description, capabilities, URL)
 *   2. Checks if the agent has an ATC (trust card)
 *   3. If yes → verifies the ATC (signature, expiry, revocation)
 *   4. Returns the A2A card enriched with trust information
 *
 * This makes MarketNow the trust layer for A2A — complementary
 * to Google's protocol, not competitive.
 *
 * A2A Agent Card spec: https://agentclientprotocol.com/get-started
 */

/**
 * Fetch and parse an A2A Agent Card from a well-known URL.
 * @param {string} agentUrl - the agent's base URL
 * @returns {Promise<Object|null>} the agent card, or null if not found
 */
export async function fetchA2ACard(agentUrl) {
  const cardUrl = `${agentUrl.replace(/\/$/, '')}/.well-known/agent-card.json`;
  try {
    const r = await fetch(cardUrl, {
      headers: { 'User-Agent': 'marketnow-a2a/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/**
 * Enrich an A2A Agent Card with MarketNow trust information.
 * If the agent has an ATC, add trust metadata to the card.
 *
 * @param {Object} a2aCard - the raw A2A Agent Card
 * @param {string} atcCardId - the agent's ATC card ID (optional)
 * @returns {Promise<Object>} the enriched card
 */
export async function enrichA2ACard(a2aCard, atcCardId) {
  const enriched = { ...a2aCard };

  // Add MarketNow trust extension
  enriched.marketnow = {
    trust_layer: 'ATC',
    atc_card_id: atcCardId || null,
    verified: false,
    sentinel_score: null,
    risk_level: null,
  };

  if (atcCardId) {
    try {
      // Verify the ATC
      const r = await fetch(
        `https://marketnow.site/api/atc?action=verify&card_id=${encodeURIComponent(atcCardId)}`
      );
      if (r.ok) {
        const trust = await r.json();
        enriched.marketnow.verified = trust.valid || false;
        enriched.marketnow.sentinel_score = trust.sentinel_score ?? null;
        enriched.marketnow.risk_level = trust.risk_level ?? null;
        enriched.marketnow.signature_valid = trust.signature_valid ?? false;
        enriched.marketnow.expires_at = trust.expires_at ?? null;

        if (!trust.valid) {
          enriched.marketnow.warning = `ATC verification failed: ${trust.reason || 'unknown'}`;
        }
      }
    } catch {
      enriched.marketnow.warning = 'Could not verify ATC (API unavailable)';
    }
  }

  return enriched;
}

/**
 * Validate an A2A Agent Card structure.
 * Checks for required fields per the A2A spec.
 *
 * @param {Object} card - the agent card to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateA2ACard(card) {
  const errors = [];

  if (!card) {
    return { valid: false, errors: ['Card is null or undefined'] };
  }

  // Required fields per A2A spec
  if (!card.name) errors.push('Missing required field: name');
  if (!card.description) errors.push('Missing required field: description');
  if (!card.url) errors.push('Missing required field: url');

  // Capabilities should be an array
  if (card.capabilities !== undefined && !Array.isArray(card.capabilities)) {
    errors.push('Field "capabilities" must be an array');
  }

  // Version should be a string
  if (card.version !== undefined && typeof card.version !== 'string') {
    errors.push('Field "version" must be a string');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Convert an A2A Agent Card to a MarketNow skill entry.
 * This lets A2A agents be listed in the MarketNow marketplace.
 *
 * @param {Object} a2aCard - the A2A Agent Card
 * @param {string} atcCardId - the agent's ATC (optional)
 * @returns {Object} a MarketNow-compatible skill object
 */
export function a2aCardToSkill(a2aCard, atcCardId) {
  return {
    id: `a2a-${a2aCard.name?.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`,
    name: a2aCard.name || 'Unknown Agent',
    slug: a2aCard.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'unknown-agent',
    description: a2aCard.description || '',
    category: 'A2A Agents',
    tags: ['a2a', 'agent', ...(a2aCard.capabilities || [])],
    price: 0,
    free: true,
    seller_priced: false,
    source: {
      type: 'a2a',
      url: a2aCard.url || null,
      note: `Imported from A2A Agent Card at ${a2aCard.url}/.well-known/agent-card.json`,
    },
    capabilities: a2aCard.capabilities || [],
    install: a2aCard.url ? `Connect via A2A: ${a2aCard.url}` : null,
    sentinel: {
      scanned_at: new Date().toISOString(),
      scan_version: 'L1.5-L1.9+L3',
      atc_card_id: atcCardId || null,
    },
    protocol: 'a2a',
    a2a_url: a2aCard.url,
    a2a_version: a2aCard.version,
  };
}
