/**
 * MarketNow — OWASP Compliance + Tool Fingerprinting API
 * =======================================================
 * 
 * Implements OWASP MCP Cheat Sheet recommendations:
 * - Tool integrity verification (cryptographic fingerprints)
 * - Capability declarations
 * - Confidence scoring
 * - Compliance status
 * 
 * GET /api/owasp — compliance overview
 * GET /api/owasp?fingerprint=<skillId> — tool fingerprint
 * GET /api/owasp?capabilities=<skillId> — capability manifest
 * GET /api/owasp?compliance — OWASP checklist
 * POST /api/owasp {action:"fingerprint", tools_list_response, skill_id} — generate fingerprint
 */

import crypto from 'crypto';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  const url = new URL(req.url, 'http://localhost');
  const fingerprintId = req.query?.fingerprint || url.searchParams.get('fingerprint');
  const capabilitiesId = req.query?.capabilities || url.searchParams.get('capabilities');
  const showCompliance = req.query?.compliance !== undefined || url.searchParams.has('compliance');

  // ── GET: Compliance overview ──
  if (req.method === 'GET' && !fingerprintId && !capabilitiesId && !showCompliance) {
    return res.status(200).json({
      service: 'MarketNow OWASP Compliance API',
      version: '1.0.0',
      description: 'OWASP MCP Cheat Sheet alignment — tool integrity, capabilities, confidence scoring',
      owasp_version: 'MCP Security Cheat Sheet 2026',
      endpoints: {
        compliance: 'GET /api/owasp?compliance — OWASP checklist with MarketNow status',
        fingerprint: 'GET /api/owasp?fingerprint=<skillId> — tool integrity hash',
        capabilities: 'GET /api/owasp?capabilities=<skillId> — capability manifest',
        generate: 'POST /api/owasp {action:"fingerprint", tools_list_response, skill_id}',
      },
    });
  }

  // ── GET: OWASP Compliance Checklist ──
  if (showCompliance) {
    return res.status(200).json({
      standard: 'OWASP MCP Security Cheat Sheet',
      version: '2026',
      url: 'https://cheatsheetseries.owasp.org/cheatsheets/MCP_Security_Cheat_Sheet.html',
      controls: [
        {
          id: 'OWASP-MCP-01',
          name: 'Verify tool descriptions haven\'t changed',
          owasp_recommendation: 'Cryptographically pin tool definitions and alert on changes',
          marketnow_status: 'v5.1 (planned)',
          marketnow_implementation: 'Tool Fingerprinting API — hashes tools/list response, stores in Trust Card, auto-revokes on mismatch',
          endpoint: 'GET /api/owasp?fingerprint=<skillId>',
        },
        {
          id: 'OWASP-MCP-02',
          name: 'Validate input/output schemas',
          owasp_recommendation: 'Pin schema definitions, detect mutations',
          marketnow_status: 'v5.1 (planned)',
          marketnow_implementation: 'Schema hash stored in fingerprint, compared at runtime',
        },
        {
          id: 'OWASP-MCP-03',
          name: 'Monitor for tool poisoning',
          owasp_recommendation: 'Runtime monitoring for behavior changes',
          marketnow_status: 'v5.0 (partial) → v5.2 (full)',
          marketnow_implementation: 'L3 Interceptor (live) + Behavioral Baseline + Drift Detection (v5.2)',
        },
        {
          id: 'OWASP-MCP-04',
          name: 'Implement least privilege',
          owasp_recommendation: 'Restrict tool capabilities to minimum required',
          marketnow_status: 'v5.3 (planned)',
          marketnow_implementation: 'Capability Graph — filesystem.read, network.discord.com, shell.execute=NO',
        },
        {
          id: 'OWASP-MCP-05',
          name: 'Log all tool invocations',
          owasp_recommendation: 'Audit trail with agent identity',
          marketnow_status: 'v5.3 (planned)',
          marketnow_implementation: 'Agent Identity + Task Identity + Session ID in every call',
        },
        {
          id: 'OWASP-MCP-06',
          name: 'Isolate tool execution',
          owasp_recommendation: 'Sandbox tools from host system',
          marketnow_status: 'v5.0 (LIVE)',
          marketnow_implementation: 'L2.5 gVisor sandbox — network=none, read-only, cap-drop ALL',
        },
        {
          id: 'OWASP-MCP-07',
          name: 'Scan for prompt injection',
          owasp_recommendation: 'Detect injection in tool descriptions and results',
          marketnow_status: 'v5.0 (LIVE)',
          marketnow_implementation: 'L1.9 — 32 prompt injection rules across 10 categories',
        },
        {
          id: 'OWASP-MCP-08',
          name: 'Monitor runtime behavior',
          owasp_recommendation: 'Track network, filesystem, process behavior',
          marketnow_status: 'v5.2 (planned)',
          marketnow_implementation: 'Behavioral Baseline + Network/FS/Process Analysis',
        },
        {
          id: 'OWASP-MCP-09',
          name: 'Verify supply chain integrity',
          owasp_recommendation: 'Provenance from source to deployment',
          marketnow_status: 'v5.1 (planned)',
          marketnow_implementation: 'Provenance/SLSA — source repo, commit SHA, build hash, package hash',
        },
        {
          id: 'OWASP-MCP-10',
          name: 'Implement revocation',
          owasp_recommendation: 'Revoke trust when tools change or are compromised',
          marketnow_status: 'v5.0 (LIVE) → v5.1 (enhanced)',
          marketnow_implementation: 'ATC revocation (live, requires ca_secret) + Transparency Log (v5.1)',
        },
        {
          id: 'OWASP-MCP-11',
          name: 'Detect typosquatting',
          owasp_recommendation: 'Flag packages with similar names to popular tools',
          marketnow_status: 'v6.0 (planned)',
          marketnow_implementation: 'Levenshtein distance, package age, publisher analysis',
        },
        {
          id: 'OWASP-MCP-12',
          name: 'Track data flow',
          owasp_recommendation: 'Monitor untrusted data → credential → external paths',
          marketnow_status: 'v5.4 (planned)',
          marketnow_implementation: 'Data Flow Tracking + Trajectory Security',
        },
      ],
      summary: {
        total_controls: 12,
        live: 4,
        planned_v51: 4,
        planned_v52: 1,
        planned_v53: 2,
        planned_v54: 1,
        planned_v60: 1,
        coverage: '100% mapped to OWASP MCP Cheat Sheet',
      },
    });
  }

  // ── GET: Tool Fingerprint ──
  if (fingerprintId) {
    try {
      const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://marketnow.site';
      const resp = await fetch(`${baseUrl}/api/skills-lite.json`);
      const skills = await resp.json();
      const skill = skills.find(s => s.id === fingerprintId || s.slug === fingerprintId);

      if (!skill) {
        return res.status(404).json({ error: 'Skill not found', skillId: fingerprintId });
      }

      // Generate deterministic fingerprint from skill metadata
      const toolData = {
        id: skill.id,
        name: skill.name,
        slug: skill.slug,
        description: skill.description || '',
        category: skill.category || '',
        sentinel_score: skill.sentinel_score || 0,
        risk_level: skill.risk_level || 'not_audited',
        l2_eligible: skill.l2_eligible || false,
      };

      const toolHash = crypto.createHash('sha256').update(JSON.stringify(toolData)).digest('hex');
      const descHash = crypto.createHash('sha256').update(skill.description || '').digest('hex');
      const nameHash = crypto.createHash('sha256').update(skill.name || '').digest('hex');

      // Capability inference (basic — v5.3 will have full capability graph)
      const capabilities = inferCapabilities(skill);

      return res.status(200).json({
        skill_id: skill.id,
        skill_name: skill.name,
        fingerprint: {
          tool_hash: toolHash,
          name_hash: nameHash,
          description_hash: descHash,
          algorithm: 'SHA-256',
          generated_at: new Date().toISOString(),
          note: 'This fingerprint pins the tool identity. If any hash changes, the Trust Card should be revoked. Full tools/list fingerprinting requires POST with the actual MCP response.',
        },
        capabilities,
        trust: {
          score: skill.sentinel_score || 0,
          risk: skill.risk_level || 'not_audited',
          recommendation: (skill.sentinel_score || 0) >= 8 ? 'safe_to_install' : (skill.sentinel_score || 0) >= 5 ? 'install_with_caution' : 'do_not_install',
        },
        owasp_alignment: {
          'OWASP-MCP-01': 'Tool fingerprint generated',
          'OWASP-MCP-04': 'Capabilities inferred (basic — full graph in v5.3)',
        },
      });
    } catch (e) {
      return res.status(500).json({ error: 'Fingerprint failed', detail: e.message });
    }
  }

  // ── GET: Capability Manifest ──
  if (capabilitiesId) {
    try {
      const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://marketnow.site';
      const resp = await fetch(`${baseUrl}/api/skills-lite.json`);
      const skills = await resp.json();
      const skill = skills.find(s => s.id === capabilitiesId || s.slug === capabilitiesId);

      if (!skill) {
        return res.status(404).json({ error: 'Skill not found' });
      }

      const capabilities = inferCapabilities(skill);

      return res.status(200).json({
        skill_id: skill.id,
        skill_name: skill.name,
        capability_manifest: capabilities,
        policy_template: {
          allow: `score >= 8 AND ${capabilities.filesystem === 'none' ? 'no filesystem' : 'filesystem: ' + capabilities.filesystem} AND ${capabilities.shell_execute ? 'shell: yes' : 'shell: no'}`,
          note: 'Organizations can define custom policies based on these capabilities (v5.3)',
        },
        owasp_alignment: 'OWASP-MCP-04 (least privilege) — capability-based policy',
      });
    } catch (e) {
      return res.status(500).json({ error: 'Capability lookup failed' });
    }
  }

  // ── POST: Generate fingerprint from tools/list response ──
  if (req.method === 'POST') {
    const body = req.body || {};
    const { action, tools_list_response, skill_id } = body;

    if (action === 'fingerprint') {
      if (!tools_list_response || !skill_id) {
        return res.status(400).json({
          error: 'tools_list_response and skill_id required',
          example: {
            action: 'fingerprint',
            skill_id: 'mn-real-xxx',
            tools_list_response: { tools: [{ name: 'read_file', description: '...', inputSchema: {type:'object'} }] },
          },
        });
      }

      // Generate comprehensive fingerprint
      const toolsJson = JSON.stringify(tools_list_response);
      const toolsHash = crypto.createHash('sha256').update(toolsJson).digest('hex');

      // Hash each tool individually
      const toolHashes = (tools_list_response.tools || []).map(t => ({
        name: t.name,
        hash: crypto.createHash('sha256').update(JSON.stringify(t)).digest('hex'),
        schema_hash: t.inputSchema ? crypto.createHash('sha256').update(JSON.stringify(t.inputSchema)).digest('hex') : null,
        description_hash: t.description ? crypto.createHash('sha256').update(t.description).digest('hex') : null,
      }));

      // Overall schema hash
      const schemaHash = crypto.createHash('sha256')
        .update(JSON.stringify(tools_list_response.tools?.map(t => t.inputSchema) || []))
        .digest('hex');

      return res.status(201).json({
        skill_id,
        fingerprint: {
          tools_hash: toolsHash,
          schema_hash: schemaHash,
          tool_count: toolHashes.length,
          individual_hashes: toolHashes,
          algorithm: 'SHA-256',
          generated_at: new Date().toISOString(),
        },
        verification: {
          how_to_verify: 'Store this fingerprint. At runtime, hash the tools/list response again and compare. If any hash differs, the tool has been modified (tool poisoning).',
          auto_revoke: 'If tools_hash changes, Trust Card should be automatically revoked.',
          owasp_reference: 'OWASP MCP Cheat Sheet — "Verify tool descriptions haven\'t changed"',
        },
      });
    }

    return res.status(400).json({ error: 'Unknown action', available: ['fingerprint'] });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

/**
 * Infer capabilities from skill metadata.
 * In v5.3, this will be a full capability graph from sandbox analysis.
 */
function inferCapabilities(skill) {
  const name = (skill.name || '').toLowerCase();
  const desc = (skill.description || '').toLowerCase();
  const cat = (skill.category || '').toLowerCase();
  const all = `${name} ${desc} ${cat}`;

  return {
    filesystem: 
      all.includes('file') || all.includes('filesystem') || all.includes('read') || all.includes('write') ? 
      (all.includes('write') ? 'read-write' : 'read-only') : 'none',
    network: 
      all.includes('http') || all.includes('api') || all.includes('web') || all.includes('fetch') || all.includes('url') ? 
      'outbound' : 'none',
    shell_execute: 
      all.includes('exec') || all.includes('shell') || all.includes('command') || all.includes('terminal') || all.includes('bash'),
    process_spawn: 
      all.includes('spawn') || all.includes('fork') || all.includes('child_process') || all.includes('subprocess'),
    credential_access: 
      all.includes('credential') || all.includes('token') || all.includes('secret') || all.includes('key') || all.includes('password') || all.includes('.env') || all.includes('.aws'),
    database: 
      all.includes('database') || all.includes('sql') || all.includes('query') || all.includes('db'),
    prompt_handling: 
      all.includes('prompt') || all.includes('llm') || all.includes('model') || all.includes('ai'),
    risk_factors: {
      high_risk: all.includes('admin') || all.includes('root') || all.includes('sudo') || all.includes('rm -rf'),
      network_exfil: all.includes('upload') || all.includes('send') || all.includes('post') || all.includes('webhook'),
      data_access: all.includes('email') || all.includes('slack') || all.includes('discord') || all.includes('github'),
    },
    inference_note: 'Capabilities inferred from metadata. Full capability graph requires v5.3 sandbox behavioral analysis.',
  };
}
