import { Router } from 'express';
import { readDB } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// GET /api/vault — Skills compradas por el usuario autenticado
router.get('/', authenticateToken, (req, res) => {
  const db = readDB();
  const userPurchases = db.purchases.filter(p => p.userId === req.user.id);

  // Enrich with skill details
  const enriched = userPurchases.map(p => {
    const skill = db.skills.find(s => s.id === p.skillId);
    return {
      ...p,
      skill: skill || null
    };
  });

  res.json({ purchases: enriched });
});

export default router;
