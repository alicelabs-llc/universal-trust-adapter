import { Router } from 'express';
import { readDB } from '../db.js';

const router = Router();

// GET /api/skills — List all skills
router.get('/', (req, res) => {
  const db = readDB();
  res.json({ skills: db.skills });
});

// GET /api/skills/:id — Skill individual
router.get('/:id', (req, res) => {
  const db = readDB();
  const skill = db.skills.find(s => s.id === req.params.id);
  if (!skill) {
    return res.status(404).json({ error: 'Skill not found' });
  }
  res.json({ skill });
});

export default router;
