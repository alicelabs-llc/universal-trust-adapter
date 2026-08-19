#!/usr/bin/env node
/**
 * MarketNow Install Stack CLI
 * ============================
 * 
 * Usage:
 *   npx -y @marketnow/install-stack <stack-name>
 *   npx -y @marketnow/install-stack financial-auditor
 *   npx -y @marketnow/install-stack growth-hacking
 *   npx -y @marketnow/install-stack dev-productivity
 *   npx -y @marketnow/install-stack security-analyst
 *   npx -y @marketnow/install-stack data-pipeline
 * 
 * Output: prints the claude_desktop_config.json snippet to stdout
 * and optionally writes to ~/.claude/claude_desktop_config.json
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const STACKS_API = 'https://marketnow.site/api/stacks';
const CONFIG_PATHS = {
  'claude': path.join(require('os').homedir(), '.claude', 'claude_desktop_config.json'),
  'cursor': path.join(require('os').homedir(), '.cursor', 'mcp.json'),
  'cline': path.join(require('os').homedir(), '.cline', 'config.json'),
};

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': '@marketnow/install-stack' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function main() {
  const stackName = process.argv[2];
  const targetAgent = process.argv[3] || 'claude';

  if (!stackName) {
    console.log('MarketNow Install Stack');
    console.log('=======================');
    console.log('');
    console.log('Usage: npx @marketnow/install-stack <stack-name> [agent]');
    console.log('');
    console.log('Available stacks:');
    try {
      const data = await fetchJson(STACKS_API);
      if (data.stacks) {
        data.stacks.forEach(s => {
          console.log(`  ${s.name.padEnd(20)} ${s.display_name}`);
          console.log(`  ${' '.repeat(20)} ${s.description}`);
          console.log('');
        });
      }
    } catch {}
    console.log('Agents: claude (default), cursor, cline');
    process.exit(0);
  }

  console.log(`Fetching stack "${stackName}"...`);
  
  let stack;
  try {
    const data = await fetchJson(`${STACKS_API}?name=${stackName}`);
    stack = data;
  } catch (e) {
    console.error(`✗ Failed to fetch stack: ${e.message}`);
    process.exit(1);
  }

  if (!stack || !stack.skills) {
    console.error(`✗ Stack "${stackName}" not found`);
    console.error('Available stacks: financial-auditor, growth-hacking, dev-productivity, security-analyst, data-pipeline');
    process.exit(1);
  }

  console.log(`✓ Stack: ${stack.display_name || stack.name}`);
  console.log(`  Skills: ${stack.skills.length}`);
  console.log(`  Description: ${stack.description || 'N/A'}`);
  console.log('');

  // Generate config
  const config = { mcpServers: {} };
  for (const skillId of stack.skills) {
    config.mcpServers[skillId] = {
      command: 'npx',
      args: ['-y', 'marketnow-mcp', '--skill', skillId],
    };
  }

  const configJson = JSON.stringify(config, null, 2);

  // Check if we should write to file
  const configPath = CONFIG_PATHS[targetAgent];
  if (configPath && fs.existsSync(path.dirname(configPath))) {
    // Merge with existing config
    let existing = { mcpServers: {} };
    try {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (!existing.mcpServers) existing.mcpServers = {};
    } catch {}
    
    // Add new servers
    Object.assign(existing.mcpServers, config.mcpServers);
    
    fs.writeFileSync(configPath, JSON.stringify(existing, null, 2));
    console.log(`✓ Config written to ${configPath}`);
    console.log(`  Added ${stack.skills.length} MCP servers`);
  } else {
    // Just print the config
    console.log('Add this to your MCP config:\n');
    console.log(configJson);
  }

  console.log('');
  console.log('Install command:');
  console.log(`  ${stack.install || `npx -y @marketnow/install-stack ${stackName}`}`);
}

main().catch(e => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});
