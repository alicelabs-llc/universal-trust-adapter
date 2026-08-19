const fs = require('fs');
const fp = process.argv[2];
let code = fs.readFileSync(fp, 'utf8');

const routeCode = `  // ── Google Search Console Verification ───────────────────────────────
  if (path === '/googlecfd72b7c796e2ead.html') {
    return new Response('google-site-verification: googlecfd72b7c796e2ead.html', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' }
    });
  }

`;

code = code.replace('  // ── Sitemap XML', routeCode + '  // ── Sitemap XML');

fs.writeFileSync(fp, code);
console.log('✓ Google verification route inserted');
