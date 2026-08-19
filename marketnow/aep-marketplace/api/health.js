// MarketNow — Health Check (ultra-lightweight)
// GET /api/health — returns 34 bytes of JSON
// Agents poll this to check if MarketNow is up

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');
  res.status(200).json({
    ok: true,
    v: '4.0.0',
    t: Date.now(),
  });
}
