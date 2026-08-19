import { Router } from 'express';
import { readDB } from '../db.js';

const router = Router();

// GET /api/security/audit-logs
router.get('/audit-logs', (req, res) => {
  const db = readDB();
  res.json({ auditLogs: db.auditLogs });
});

export default router;
