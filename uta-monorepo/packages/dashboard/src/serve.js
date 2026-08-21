#!/usr/bin/env node
/**
 * UTA Dashboard Server — serves the dashboard HTML and proxies API requests.
 *
 * Usage:
 *   node packages/dashboard/src/serve.js [--port 8080]
 *
 * The dashboard connects directly to the UTA REST API server (configured via
 * the URL input in the UI). This server only serves the static HTML file.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = parseInt(process.argv[2] || process.env.DASHBOARD_PORT || '8080', 10);
const DIST_DIR = path.join(__dirname, '..', 'public');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');

  let url = req.url || '/';
  if (url === '/') url = '/index.html';

  const filePath = path.join(DIST_DIR, url);
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  const content = fs.readFileSync(filePath);
  res.writeHead(200, { 'content-type': mime });
  res.end(content);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`UTA Dashboard: http://localhost:${PORT}`);
  console.log(`  Point the dashboard at your UTA REST API server (default: http://localhost:3000)`);
});
