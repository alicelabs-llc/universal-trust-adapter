// agent-purchase handler
export default async function handler(req, res) {
  return res.status(200).json({
    service: 'MarketNow agent-purchase',
    status: 'live',
    timestamp: new Date().toISOString(),
  });
}
