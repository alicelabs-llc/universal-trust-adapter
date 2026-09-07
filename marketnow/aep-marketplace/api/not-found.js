// /api/not-found.js — 404 real para rutas de archivo inexistentes (.sh, .py, etc.)
// Fix del reporte de anp2network: rutas inexistentes devolvían 200 + index.html,
// haciendo que curl|bash ejecutara HTML. Ahora devuelven 404 text/plain.
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-MarketNow-Note', 'static-miss');
  return res.status(404).send(
    '404 Not Found — MarketNow\n\n' +
    'This path does not exist as a static file.\n' +
    'If you expected a script here, verify the URL at https://www.marketnow.site/\n' +
    'Reported paths that end in .sh but do not exist intentionally return 404 (not HTML).\n'
  );
}
