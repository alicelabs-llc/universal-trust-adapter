import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { readDB, writeDB } from '../db.js';
import { generateToken } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password required' });
    }

    const db = readDB();

    // Check existing
    const existing = db.users.find(u => u.email === email || u.username === username);
    if (existing) {
      return res.status(409).json({ error: 'User already exists with that email or username' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      username,
      email,
      password: hashedPassword,
      credits: 1000,
      createdAt: new Date().toISOString(),
      ownedSkills: []
    };

    db.users.push(newUser);
    writeDB(db);

    const token = generateToken(newUser);
    res.status(201).json({
      token,
      user: { id: newUser.id, username: newUser.username, email: newUser.email, credits: newUser.credits }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const db = readDB();
    const user = db.users.find(u => u.email === email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, credits: user.credits }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
