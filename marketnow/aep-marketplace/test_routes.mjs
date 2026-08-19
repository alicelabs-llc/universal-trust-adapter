import https from 'https';

const urls = ['/', '/registry', '/vault', '/governance', '/security', '/handshake', '/policies', '/skill/web-scraper-pro'];

Promise.all(urls.map(u => new Promise(r => {
  https.get('https://aep-marketplace.pages.dev' + u, res => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => r({ url: u, status: res.statusCode, size: body.length }));
  });
}))).then(results => {
  results.forEach(r => console.log(r.url, 'status:', r.status, 'size:', (r.size/1024).toFixed(1) + 'KB'));
});
