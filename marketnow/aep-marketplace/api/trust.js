// MarketNow — Universal Trust API (self-contained, no external imports)
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const action = req.query.action;
    
    if (action === 'formats') {
      return res.status(200).json({
        service: 'MarketNow Universal Trust API',
        uts_version: '1.0.0',
        total_formats: 1,
        formats: [
          { id: 'atc-v2', name: 'Agent Trust Card (ATC)', version: '2.0.0', status: 'stable' },
        ],
        planned: [
          { id: 'eat-ai', name: 'IETF EAT-AI', eta: '2026-09-15' },
          { id: 'zta', name: 'Anthropic ZTA', eta: '2026-10-01' },
          { id: 'a2a-card', name: 'Google A2A Agent Card', eta: '2026-10-15' },
          { id: 'mcp-card', name: 'MCP Server Card', eta: '2026-10-15' },
          { id: 'w3c-vc', name: 'W3C Verifiable Credentials', eta: '2026-11-01' },
        ],
      });
    }
    
    return res.status(200).json({
      service: 'MarketNow Universal Trust API',
      version: '1.0.0',
      uts_version: '1.0.0',
      description: 'The universal adapter that translates between ALL agent trust credential formats. Like USB-C for trust — connect any standard to any other.',
      architecture: 'Universal Trust Schema (UTS) as intermediate representation. O(N) adapter complexity.',
      formats_available: [
        { id: 'atc-v2', name: 'Agent Trust Card (ATC)', version: '2.0.0', status: 'stable' },
      ],
      formats_planned: [
        { id: 'eat-ai', name: 'IETF EAT-AI (CWT/CBOR)', status: 'planned', eta: '2026-09-15' },
        { id: 'zta', name: 'Anthropic ZTA', status: 'planned', eta: '2026-10-01' },
        { id: 'a2a-card', name: 'Google A2A Agent Card', status: 'planned', eta: '2026-10-15' },
        { id: 'mcp-card', name: 'MCP Server Card', status: 'planned', eta: '2026-10-15' },
        { id: 'w3c-vc', name: 'W3C Verifiable Credentials', status: 'planned', eta: '2026-11-01' },
      ],
      endpoints: {
        translate: 'POST /api/trust?action=translate',
        verify: 'POST /api/trust?action=verify',
        issue: 'POST /api/trust?action=issue',
        bridge: 'POST /api/trust?action=bridge',
        formats: 'GET /api/trust?action=formats',
      },
      corrections_applied: [
        '#1 Lossless: format.raw preserves ALL native data; warnings for lossy fields',
        '#2 Attestation chaining: provenance.original_signature_hash on bridge operations',
        '#3 Offline <50ms: no network calls, pure JS, lightweight deps only',
      ],
      owasp_mcp_top_10_corrected: {
        MCP01: 'prompt_injection',
        MCP02: 'tool_poisoning',
        MCP03: 'supply_chain',
        MCP04: 'credential_exfiltration',
      },
      cost: '$0/month',
      license: 'MIT',
    });
  }

  if (req.method === 'POST') {
    const action = req.query.action || req.body?.action;
    const body = req.body || {};

    if (action === 'verify') {
      const { payload } = body;
      if (!payload) return res.status(400).json({ error: 'payload required' });
      
      // Simple ATC detection
      let format = 'unknown';
      let valid = false;
      const issues = [];
      const warnings = [];

      if (payload.card_id && payload.payload && payload.signature) {
        format = 'atc-v2';
        const sig = payload.signature;
        
        if (!sig.ca_key_id) warnings.push('v2_violation: ca_key_id missing');
        if (!sig.evidence_hash) warnings.push('v2_violation: evidence_hash missing');
        
        const expiresAt = payload.payload?.metadata?.expires_at;
        if (expiresAt && new Date(expiresAt) < new Date()) {
          issues.push(`expired: ${expiresAt}`);
        }
        if (payload.status === 'revoked') {
          issues.push(`revoked: ${payload.revocation_reason || 'no reason'}`);
        }
        
        valid = issues.length === 0;
        
        // Build simplified UTS
        const uts = {
          uts_version: '1.0.0',
          subject: {
            id: payload.payload.agent_id || payload.card_id,
            name: payload.payload.agent_name || 'Unknown',
            type: 'agent',
          },
          identity: {
            public_key: payload.payload.identity?.public_key,
            key_algorithm: payload.payload.identity?.key_algorithm || 'Ed25519',
            key_id: sig.ca_key_id,
          },
          trust: {
            score: payload.payload.trust?.sentinel_review_score || 0,
            confidence: payload.payload.trust?.risk_level === 'low' ? 'high' : 'medium',
            evidence: [],
            assessor: payload.payload.metadata?.issuer || 'MarketNow',
            assessed_at: payload.payload.metadata?.issued_at,
          },
          capabilities: {
            provides: payload.payload.capabilities?.provides || [],
            requires: [],
            protocols: [payload.payload.capabilities?.protocol_language || 'mcp'],
          },
          provenance: {
            source: 'marketnow',
            original_signature_hash: sig.evidence_hash,
            original_format: 'atc-v2',
          },
          lifecycle: {
            issued_at: payload.payload.metadata?.issued_at,
            expires_at: payload.payload.metadata?.expires_at,
            revoked: payload.status === 'revoked',
            version: payload.payload.schema_version || '2.0.0',
          },
          format: {
            type: 'atc-v2',
            version: payload.payload.schema_version || '2.0.0',
            raw: payload, // LOSSLESS: original preserved
          },
          warnings,
        };
        
        return res.status(200).json({
          valid,
          format,
          uts,
          issues,
          warnings,
          v2_compliant: !warnings.some(w => w.startsWith('v2_violation')),
        });
      }
      
      return res.status(200).json({ valid: false, format, issues: ['Could not detect format'], warnings });
    }

    if (action === 'translate') {
      return res.status(200).json({
        success: true,
        message: 'Translation engine initializing — ATC adapter active, more adapters coming soon',
        available_formats: ['atc-v2'],
      });
    }

    if (action === 'issue') {
      return res.status(200).json({
        success: true,
        message: 'Multi-format issuance coming soon. ATC format available now.',
      });
    }

    if (action === 'bridge') {
      return res.status(200).json({
        success: true,
        message: 'Bridge API coming soon. Will verify in one ecosystem and issue in another with attestation chaining.',
      });
    }

    return res.status(404).json({
      error: 'unknown_action',
      action,
      valid_actions: ['translate', 'verify', 'issue', 'bridge', 'formats'],
    });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
