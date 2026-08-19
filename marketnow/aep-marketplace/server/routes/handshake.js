import { Router } from 'express';

const router = Router();

/**
 * POST /api/handshake/connect
 *
 * Genera un session ID para identificar las requests de un agente en los audit logs.
 * No requiere autenticación — el API key es opcional y se usa solo para identificar
 * agentes con cuenta premium en el futuro.
 *
 * NOTA: No hay "mesh network" real. MarketNow es una API HTTP estándar sobre
 * Cloudflare Pages + Vercel serverless. Este endpoint simplemente devuelve
 * un identificador de sesión para tracking.
 */
router.post('/connect', (req, res) => {
  const { apiKey } = req.body || {};

  // Generar sessionId corto y único
  const sessionId = `mn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

  // Si el cliente envió un API key, validar formato básico (no validamos contra DB todavía)
  const isAnonymous = !apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10;
  const tier = isAnonymous ? 'anonymous' : 'api_key';

  res.json({
    success: true,
    sessionId,
    tier,
    endpoints: [
      '/api/skills.json',
      '/api/categories.json',
      '/api/manifest.json',
    ],
    protocols: ['HTTP/1.1', 'HTTPS', 'JSON'],
    message: 'Session established. Use the sessionId in custom headers for tracking.',
  });
});

export default router;
