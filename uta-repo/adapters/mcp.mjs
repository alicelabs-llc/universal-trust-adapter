// MarketNow — MCP Server Card Adapter (Anthropic MCP spec)
export class MCPAdapter {
  constructor() {
    this.formatId = 'mcp-card';
    this.formatName = 'MCP Server Card';
    this.formatVersion = '1.0';
    this.status = 'beta';
  }
  detect(payload) {
    if (payload.protocolVersion && payload.tools && payload.serverInfo)
      return { match: true, confidence: 0.90 };
    return { match: false, confidence: 0 };
  }
  fromNative(payload) {
    const info = payload.serverInfo || {};
    return {
      uts_version: '1.0.0',
      subject: { id: info.name || 'unknown', name: info.name || 'MCP Server', type: 'tool', description: info.description },
      identity: {},
      trust: { score: 0, confidence: 'low', evidence: [], assessor: 'none', assessed_at: undefined },
      capabilities: { provides: (payload.tools || []).map(t => t.name), requires: [], protocols: ['mcp'] },
      provenance: { source: 'mcp-registry', original_format: 'mcp-card' },
      lifecycle: { issued_at: undefined, revoked: false, version: payload.protocolVersion || '1.0' },
      format: { type: 'mcp-card', version: payload.protocolVersion || '1.0', raw: payload },
      warnings: ['MCP Server Cards have no cryptographic trust — score is 0'],
    };
  }
  toNative(uts) {
    return {
      protocolVersion: '1.0',
      serverInfo: { name: uts.subject.name, version: uts.lifecycle.version || '1.0', description: uts.subject.description },
      tools: uts.capabilities.provides.map(p => ({ name: p, description: '' })),
      capabilities: { tools: { listChanged: true } },
    };
  }
  async verify(payload, caKey) {
    const uts = this.fromNative(payload);
    const issues = [];
    if (!payload.serverInfo) issues.push('MCP: missing serverInfo');
    if (!payload.tools) issues.push('MCP: missing tools');
    return { valid: issues.length === 0, format: 'mcp-card', uts, issues, warnings: uts.warnings };
  }
}
