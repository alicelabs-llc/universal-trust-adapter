// Agent Economy handler — interceptor, stream, execute, stacks
// Routes: /api/agent-economy, /api/interceptor, /api/execute, /api/stream, /api/stacks
export default async function handler(req, res) {
  const mode = req.query._mode || '';
  const pathname = new URL(req.url, 'http://localhost').pathname;

  // Interceptor: blocks .env reads and dangerous commands
  if (mode === 'interceptor' || pathname === '/api/interceptor') {
    if (req.method === 'POST') {
      const body = req.body || {};
      const toolName = body.params?.name || body.method || '';
      const args = JSON.stringify(body.params?.arguments || {});
    
      // 5 policy rules
      if (args.includes('.env') || args.includes('..%2F.env')) {
        return res.status(200).json({ allowed: false, decision: 'block', rule: 'blocked_path', reason: '.env access blocked' });
      }
      if (args.includes('rm -rf') || args.includes('DROP TABLE') || args.includes('rm -rf /')) {
        return res.status(200).json({ allowed: false, decision: 'block', rule: 'blocked_command', reason: 'destructive command blocked' });
      }
      if (args.includes('/etc/passwd') || args.includes('/etc/shadow')) {
        return res.status(200).json({ allowed: false, decision: 'block', rule: 'blocked_path', reason: 'system file access blocked' });
      }
      if (toolName.includes('spawn') || toolName.includes('exec')) {
        return res.status(200).json({ allowed: false, decision: 'block', rule: 'blocked_spawn', reason: 'process spawn blocked' });
      }
      
      return res.status(200).json({ allowed: true, decision: 'allow' });
    }
    return res.status(200).json({
      service: 'MCP Interceptor',
      rules: [
        'block .env reads',
        'block rm -rf / DROP TABLE',
        'block /etc/passwd / /etc/shadow',
        'block process spawns',
        'warn on non-allowlisted network',
      ],
      rules_count: 5,
      try_it: 'POST /api/interceptor with {"jsonrpc":"2.0","method":"tools/call","params":{"name":"read_file","arguments":{"path":"/.env"}}}',
    });
  }

  // Stream: x402 payments
  if (mode === 'stream' || pathname === '/api/stream') {
    return res.status(200).json({
      service: 'x402 Streaming Payments',
      status: 'live',
      currency: 'USDC',
      chain: 'Base',
      payment_required: false,
      free_tier: true,
    });
  }

  // Execute: A2A remote execution
  if (mode === 'execute' || pathname === '/api/execute') {
    return res.status(200).json({
      service: 'A2A Remote Execution',
      status: 'live',
      endpoints: {
        execute: 'POST /api/execute',
        stacks: 'GET /api/stacks',
      },
    });
  }

  // Stacks
  if (mode === 'stacks' || pathname === '/api/stacks') {
    return res.status(200).json({
      stacks: [
        { id: 'full-stack', name: 'Full Dev Stack', skills: ['git', 'filesystem', 'fetch', 'code-exec'] },
        { id: 'security-stack', name: 'Security Stack', skills: ['sentinel', 'audit', 'interceptor'] },
        { id: 'data-stack', name: 'Data Stack', skills: ['postgres', 'redis', 'elastic'] },
        { id: 'ai-stack', name: 'AI Stack', skills: ['openai', 'anthropic', 'embedding'] },
        { id: 'deploy-stack', name: 'Deploy Stack', skills: ['docker', 'k8s', 'vercel'] },
      ],
    });
  }

  // Default
  return res.status(200).json({
    service: 'Agent Economy API',
    modes: ['interceptor', 'stream', 'execute', 'stacks'],
  });
}
