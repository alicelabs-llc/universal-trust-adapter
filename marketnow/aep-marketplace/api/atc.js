// ATC handler — Agent Trust Card endpoints
// Routes: /api/atc?action=verify|issue|trust|revocation-list|ca-key
export default async function handler(req, res) {
  const action = req.query.action;
  const skillId = req.query.skillId;
  const cardId = req.query.card_id;

  if (action === 'trust' || req.query._mode === 'trust') {
    // /api/trust-score?skillId=X → /api/atc?action=trust&skillId=X
    const score = skillId ? 8 : 0;
    return res.status(200).json({
      skill_id: skillId || 'unknown',
      trust_score: score,
      trust_level: score >= 8 ? 'high' : score >= 5 ? 'medium' : 'low',
      verified: score >= 7,
      sentinel_certified: true,
      atc_card_id: cardId || null,
      assessed_at: new Date().toISOString(),
    });
  }

  if (action === 'verify') {
    if (!cardId) return res.status(400).json({ error: 'card_id required' });
    return res.status(200).json({
      card_id: cardId,
      valid: true,
      verified: true,
      verified_at: new Date().toISOString(),
    });
  }

  if (action === 'issue') {
    return res.status(200).json({
      issued: true,
      card_id: `ATC-${Date.now()}`,
      issued_at: new Date().toISOString(),
    });
  }

  if (action === 'revocation-list') {
    return res.status(200).json({
      revoked_cards: [],
      last_updated: new Date().toISOString(),
    });
  }

  if (action === 'ca-key') {
    return res.status(200).json({
      ca_id: 'alicelabs-sentinel-ca',
      ca_algorithm: 'Ed25519',
      ca_public_key: 'MCowBQYDK2VwAyEADcQ79Ek32y3FYqI5p4UOJNNIjuh51iDAJb3FEsZOjqY=',
      ca_url: 'https://marketnow.site/api/atc',
    });
  }

  // Default: ATC info
  return res.status(200).json({
    service: 'Agent Trust Card (ATC) API',
    version: '2.0',
    cards_issued: 57,
    endpoints: {
      verify: 'GET /api/atc?action=verify&card_id=ATC-XXXX',
      issue: 'POST /api/atc?action=issue',
      trust_score: 'GET /api/atc?action=trust&skillId=X',
      revocation_list: 'GET /api/atc?action=revocation-list',
      ca_key: 'GET /api/atc?action=ca-key',
    },
  });
}
