import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import skillsRouter from './routes/skills.js';
import authRouter from './routes/auth.js';
import vaultRouter from './routes/vault.js';
import checkoutRouter from './routes/checkout.js';
import governanceRouter from './routes/governance.js';
import securityRouter from './routes/security.js';
import handshakeRouter from './routes/handshake.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/skills', skillsRouter);
app.use('/api/auth', authRouter);
app.use('/api/vault', vaultRouter);
app.use('/api/checkout', checkoutRouter);
app.use('/api/governance', governanceRouter);
app.use('/api/security', securityRouter);
app.use('/api/handshake', handshakeRouter);

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server (only when not imported as module — Vercel serverless)
if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`AEP Marketplace API running on http://localhost:${PORT}`);
  });
}

export default app;
