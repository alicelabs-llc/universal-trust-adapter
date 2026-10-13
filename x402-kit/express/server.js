/**
 * UTA x402 Paywall — servidor Express de referencia (ATC/1.0)
 *
 * Vende verificación de confianza por llamada vía x402.
 * Basado en el patrón oficial de x402-foundation/x402 (paymentMiddleware).
 *
 * npm install @x402/core @x402/evm @x402/express express agent-trust-card
 */
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { x402ExactEvmScheme } from "@x402/evm/exact/server";
import { verifyAgentTrustCard } from "agent-trust-card";

const app = express();
app.use(express.json({ limit: "64kb" }));

const PAY_TO = process.env.PAY_TO || "0x0000000000000000000000000000000000000000";
const NETWORK = process.env.NETWORK || "base-sepolia";
const FACILITATOR = process.env.FACILITATOR || "https://x402.org/facilitator";

/** Definición de recursos pagados — precio por llamada en USDC */
const resources = {
  "POST /v1/trust/verify": {
    accepts: [{ scheme: "exact", payTo: PAY_TO, network: NETWORK, maxAmountRequired: "10000" }], // $0.01 (6 decimales)
    description: "UTA: verificación Ed25519 de Agent Trust Card + score de riesgo (ATC/1.0)",
    mimeType: "application/json",
  },
  "POST /v1/trust/batch": {
    accepts: [{ scheme: "exact", payTo: PAY_TO, network: NETWORK, maxAmountRequired: "80000" }], // $0.08
    description: "UTA: verificación por lote (hasta 10 tarjetas) para marketplaces con escrow",
    mimeType: "application/json",
  },
};

const scheme = new x402ExactEvmScheme();
const resourceServer = new x402ResourceServer({ facilitatorUrl: FACILITATOR })
  .registerResourceServerScheme(scheme);

app.use(paymentMiddleware(resources, resourceServer));

/** Health — gratis */
app.get("/health", (_req, res) => res.json({ ok: true, protocol: "ATC/1.0", rail: "x402", network: NETWORK }));

/** Lectura pública de tarjeta — gratis (funnel) */
app.get("/v1/card/:did", async (req, res) => {
  // TODO: conectar con el índice público de tarjetas de UTA
  res.json({ did: req.params.did, found: false, note: "public card index pending" });
});

/** Verificación pagada — 1 tarjeta */
app.post("/v1/trust/verify", async (req, res) => {
  const { card } = req.body || {};
  if (!card) return res.status(400).json({ error: "card required (ATC/1.0 JSON)" });
  try {
    const result = await verifyAgentTrustCard(card); // Ed25519: firma, expiración, revocación
    return res.json({ protocol: "ATC/1.0", verified: result.valid, risk: result.risk ?? null, detail: result });
  } catch (e) {
    return res.status(422).json({ error: "invalid_card", message: String(e.message || e) });
  }
});

/** Verificación pagada — lote de hasta 10 (para escrow de marketplaces) */
app.post("/v1/trust/batch", async (req, res) => {
  const cards = (req.body || {}).cards || [];
  if (!Array.isArray(cards) || cards.length === 0 || cards.length > 10) {
    return res.status(400).json({ error: "cards: 1..10 required" });
  }
  const results = [];
  for (const card of cards) {
    try {
      const r = await verifyAgentTrustCard(card);
      results.push({ did: card?.did ?? null, verified: r.valid, risk: r.risk ?? null });
    } catch (e) {
      results.push({ did: card?.did ?? null, verified: false, error: "invalid_card" });
    }
  }
  return res.json({ protocol: "ATC/1.0", count: results.length, results });
});

const port = process.env.PORT || 4020;
app.listen(port, () => console.log(`UTA x402 paywall on :${port} (${NETWORK})`));
