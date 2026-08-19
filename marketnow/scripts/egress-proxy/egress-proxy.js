#!/usr/bin/env node
// ⚠️ SENTINEL PROPRIETARY — Copyright (c) 2026 AliceLabs LLC. All Rights Reserved.
//
// L2.6 — Egress Proxy with Domain Allowlist
// ==========================================
//
// A lightweight HTTP/HTTPS proxy that only allows requests to pre-approved
// domains. All other traffic is blocked and logged.
//
// Suggested by @custralis on dev.to:
// "For servers that genuinely need outbound calls, a pinned egress proxy
//  (host allowlist) beats full network access while keeping none everywhere else."
//
// Usage:
//   node egress-proxy.js --port 3128 --allowlist allowlist.json
//
// The proxy listens on 3128 and:
//   1. Receives HTTP CONNECT requests (HTTPS proxying)
//   2. Checks if the target domain is in the allowlist
//   3. If allowed: forwards the request and logs it
//   4. If blocked: returns 403 and logs the violation
//
// All requests are logged to /tmp/l2_output/egress_log.json

const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');

// Parse args
const args = process.argv.slice(2);
let port = 3128;
let allowlistPath = 'allowlist.json';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port') port = parseInt(args[i + 1]);
  if (args[i] === '--allowlist') allowlistPath = args[i + 1];
}

// Load allowlist
let allowlist = { domains: [], wildcard_domains: [] };
try {
  allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf-8'));
  console.log(`[egress-proxy] Loaded ${allowlist.domains.length} domains + ${allowlist.wildcard_domains.length} wildcards`);
} catch (e) {
  console.error(`[egress-proxy] Could not load allowlist: ${e.message}`);
  process.exit(1);
}

// Log file
const logFile = '/tmp/l2_output/egress_log.json';
const logEntries = [];

function logEntry(entry) {
  logEntries.push({
    timestamp: new Date().toISOString(),
    ...entry,
  });
  // Write to file
  try {
    fs.mkdirSync('/tmp/l2_output', { recursive: true });
    fs.writeFileSync(logFile, JSON.stringify(logEntries, null, 2));
  } catch (e) {}
}

function isAllowed(hostname) {
  // Check exact match
  if (allowlist.domains.includes(hostname)) return true;
  
  // Check wildcard (e.g., "*.github.com" matches "api.github.com")
  for (const wildcard of allowlist.wildcard_domains) {
    if (wildcard.startsWith('*.')) {
      const base = wildcard.slice(2);
      if (hostname === base || hostname.endsWith('.' + base)) return true;
    }
  }
  
  return false;
}

// Create proxy server
const proxy = http.createServer((req, res) => {
  // Handle regular HTTP requests (not HTTPS CONNECT)
  const url = new URL(req.url, `http://${req.headers.host}`);
  const hostname = url.hostname;
  
  if (!isAllowed(hostname)) {
    logEntry({
      action: 'BLOCKED',
      method: req.method,
      hostname,
      path: url.pathname,
      reason: 'Domain not in allowlist',
    });
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Blocked by egress proxy', hostname, reason: 'Not in allowlist' }));
    return;
  }
  
  logEntry({
    action: 'ALLOWED',
    method: req.method,
    hostname,
    path: url.pathname,
  });
  
  // Forward the request
  const options = {
    hostname,
    port: url.port || 80,
    path: url.pathname + url.search,
    method: req.method,
    headers: req.headers,
  };
  
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  
  proxyReq.on('error', (e) => {
    logEntry({ action: 'ERROR', hostname, error: e.message });
    res.writeHead(502);
    res.end('Proxy error: ' + e.message);
  });
  
  req.pipe(proxyReq);
});

// Handle HTTPS CONNECT (for HTTPS traffic)
proxy.on('connect', (req, clientSocket, head) => {
  const [hostname, port] = req.url.split(':');
  
  if (!isAllowed(hostname)) {
    logEntry({
      action: 'BLOCKED',
      method: 'CONNECT',
      hostname,
      port: port || 443,
      reason: 'Domain not in allowlist',
    });
    clientSocket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    clientSocket.end();
    return;
  }
  
  logEntry({
    action: 'ALLOWED',
    method: 'CONNECT',
    hostname,
    port: port || 443,
  });
  
  // Connect to the target server
  const serverSocket = net.connect(port || 443, hostname, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    serverSocket.write(head);
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });
  
  serverSocket.on('error', (e) => {
    logEntry({ action: 'ERROR', hostname, error: e.message });
    clientSocket.end();
  });
});

proxy.listen(port, '127.0.0.1', () => {
  console.log(`[egress-proxy] Listening on 127.0.0.1:${port}`);
  console.log(`[egress-proxy] Allowlist: ${allowlist.domains.length} domains, ${allowlist.wildcard_domains.length} wildcards`);
  console.log('[egress-proxy] Blocked domains will be logged to ' + logFile);
});

// Handle shutdown
process.on('SIGTERM', () => {
  console.log('[egress-proxy] Shutting down...');
  logEntry({ action: 'PROXY_SHUTDOWN' });
  proxy.close();
  process.exit(0);
});
