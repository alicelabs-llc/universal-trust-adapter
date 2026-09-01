// stripe-webhook handler
export default async function handler(req, res) {
  return res.status(200).json({
    service: 'MarketNow stripe-webhook',
    status: 'live',
    timestamp: new Date().toISOString(),
  });
}
