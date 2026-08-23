/**
 * Post-execution filter — inspects tool RESULTS (not just args).
 * Treats tool output as untrusted data.
 * @mads_hansen: "Install-time scanning misses runtime poisoning from tool results"
 */

export interface PostExecResult {
  allowed: boolean;
  reason?: string;
  blocked_patterns: string[];
}

const OUTPUT_DANGERS = [
  /-----BEGIN [A-Z]+ PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /ghp_[a-zA-Z0-9]{36}/,
  /sk-[a-zA-Z0-9]{48}/,
  /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/,
  /\/etc\/passwd/,
  /\/etc\/shadow/,
  /\/home\/[^/]+\/\.ssh\/id_/,
  /\/home\/[^/]+\/\.aws\/credentials/,
  /\/home\/[^/]+\/\.env/,
  /\beval\s*\(/,
  /\bexec\s*\(/,
  /\bsubprocess\./,
  /\bos\.system\(/,
  /\bchild_process\./,
  /ignore (all )?(previous |prior )?instructions/i,
  /you are now (in )?(admin|root|developer|DAN) mode/i,
  /disregard the above/i,
];

export function filterToolOutput(output: string | object | unknown): PostExecResult {
  const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
  const blocked: string[] = [];
  for (const pattern of OUTPUT_DANGERS) {
    if (pattern.test(outputStr)) blocked.push(pattern.source);
  }
  if (blocked.length > 0) {
    return { allowed: false, reason: `Dangerous pattern in tool output: ${blocked.join(', ')}`, blocked_patterns: blocked };
  }
  return { allowed: true, blocked_patterns: [] };
}
