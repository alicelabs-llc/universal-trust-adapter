// Smoke test for Sentinel L1.7 — verifies it catches the prospector trojan
import { runL17, MALWARE_PATTERNS } from '../aep-marketplace/lib/sentinel-l17.mjs';
import fs from 'fs';
import path from 'path';

console.log('--- Sentinel L1.7 smoke test ---\n');

// 1. Test: skill with metadata containing "Download Latest Release" badge
//    (the typosquatting pattern from prospector trojan)
const skill1 = {
  id: 'test-typosquat-1',
  name: 'prospector-mcp-email-finder',
  description: 'Free B2B email finder MCP server.',
  doc: {
    system_prompt: `[![Download Latest Release](https://img.shields.io/badge/Download-Get%20It%20Here-green)](https://raw.githubusercontent.com/JuanquiFortuny/prospector-mcp-email-finder/main/test/mcp_prospector_email_finder_2.4-alpha.1.zip)`,
  },
};
const r1 = await runL17(skill1);
console.log('Test 1: skill metadata with external zip download badge');
console.log('  quarantine_recommended:', r1.quarantine_recommended);
console.log('  malware_patterns found:', r1.findings.malware_patterns.length);
console.log('  patterns:', r1.findings.malware_patterns.map(p => p.id));
console.log('  result:', r1.quarantine_recommended ? '✓ BLOCKED (correct)' : '✗ FAILED to block');
console.log();

// 2. Test: skill with obfuscated Lua bytecode in system_prompt
const skill2 = {
  id: 'test-lua-1',
  name: 'test-mcp',
  description: 'innocent',
  doc: {
    system_prompt: `return(function(...)return(function(o,R,F,U,b,p,E,M,Z,W,O,e,H,S,x,m,l,P,I,d,r,n,N,v,q)x,n,N,e,m,r,S,O,W,d,H,v,P,l,q,I,Z,M=function(o)local O,R=-805574+805575,o[68017]`,
  },
};
const r2 = await runL17(skill2);
console.log('Test 2: skill with obfuscated Lua bytecode signature');
console.log('  quarantine_recommended:', r2.quarantine_recommended);
console.log('  result:', r2.quarantine_recommended ? '✓ BLOCKED (correct)' : '✗ FAILED to block');
console.log();

// 3. Test: skill with "start X.exe Y.txt" launcher pattern
const skill3 = {
  id: 'test-launcher-1',
  name: 'test-mcp',
  description: 'innocent',
  doc: {
    setup: 'start unit.exe package.txt',
  },
};
const r3 = await runL17(skill3);
console.log('Test 3: skill with "start X.exe Y.txt" launcher pattern');
console.log('  quarantine_recommended:', r3.quarantine_recommended);
console.log('  result:', r3.quarantine_recommended ? '✓ BLOCKED (correct)' : '✗ FAILED to block');
console.log();

// 4. Test: innocent skill should NOT be quarantined
const skill4 = {
  id: 'test-clean-1',
  name: 'filesystem-mcp',
  description: 'Official Anthropic filesystem MCP server. Provides file read/write/list operations.',
  doc: {
    system_prompt: 'You are a filesystem assistant. Use the tools to read and write files.',
    setup: 'Run with: npx -y @modelcontextprotocol/server-filesystem /path/to/allowed/dir',
  },
  install: 'npx -y @modelcontextprotocol/server-filesystem',
};
const r4 = await runL17(skill4);
console.log('Test 4: innocent skill (filesystem MCP)');
console.log('  quarantine_recommended:', r4.quarantine_recommended);
console.log('  result:', !r4.quarantine_recommended ? '✓ ALLOWED (correct)' : '✗ FALSE POSITIVE');
console.log();

// 5. Test: scan the actual trojan zip (if available)
const trojanZipPath = '/tmp/original-prospector.zip';
if (fs.existsSync(trojanZipPath)) {
  console.log('Test 5: scanning actual trojan zip from git history');
  const buf = fs.readFileSync(trojanZipPath);
  // L1.7 needs JSZip to scan inside — check if it's available
  try {
    const r5 = await runL17({ id: 'test', name: 'test', description: '' }, { packageBuffer: buf });
    console.log('  quarantine_recommended:', r5.quarantine_recommended);
    console.log('  binary_files:', r5.findings.binary_files.length);
    console.log('  launcher_scripts:', r5.findings.launcher_scripts.length);
    console.log('  nested_archives:', r5.findings.nested_archives.length);
    console.log('  malware_patterns:', r5.findings.malware_patterns.length);
    console.log('  oversized_text_files:', r5.findings.oversized_text_files.length);
    console.log('  result:', r5.quarantine_recommended ? '✓ BLOCKED (correct)' : '✗ FAILED to block');
  } catch (e) {
    console.log('  ⚠ JSZip not available — package scanning skipped');
    console.log('  (metadata scan still works — see tests 1-3)');
  }
} else {
  console.log('Test 5: skipped (trojan zip not at /tmp/original-prospector.zip)');
}
console.log();

console.log('--- L1.7 smoke test complete ---');
