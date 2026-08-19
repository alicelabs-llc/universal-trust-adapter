import { Router } from 'express';
import { readDB, writeDB } from '../db.js';  // FINDING S6 FIX: added writeDB
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// GET /api/governance/proposals
router.get('/proposals', (req, res) => {
  const db = readDB();
  res.json({ proposals: db.governance.proposals, stats: db.governance });
});

// POST /api/governance/vote
router.post('/vote', authenticateToken, (req, res) => {
  const { proposalId } = req.body;
  if (!proposalId) {
    return res.status(400).json({ error: 'proposalId required' });
  }

  const db = readDB();
  const proposal = db.governance.proposals.find(p => p.id === proposalId);
  if (!proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }

  proposal.votes += 1;
  writeDB(db);

  res.json({ success: true, message: `Vote cast on ${proposalId}`, proposal });
});

export default router;
