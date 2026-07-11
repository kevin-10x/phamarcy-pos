import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../database/connection.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    const { password: _, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/register', authenticateToken, (req, res) => {
  try {
    const { username, email, password, full_name, role, phone } = req.body;
    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existing) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (username, email, password, full_name, role, phone) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(username, email, hashedPassword, full_name, role || 'cashier', phone || null);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/me', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/users', authenticateToken, (req, res) => {
  try {
    const users = db.prepare('SELECT id, username, email, full_name, role, phone, is_active, created_at FROM users').all();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/users/:id', authenticateToken, (req, res) => {
  try {
    const { full_name, email, role, phone, is_active } = req.body;
    db.prepare('UPDATE users SET full_name = ?, email = ?, role = ?, phone = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(full_name, email, role, phone, is_active ?? 1, req.params.id);
    const user = db.prepare('SELECT id, username, email, full_name, role, phone, is_active FROM users WHERE id = ?').get(req.params.id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/users/:id', authenticateToken, (req, res) => {
  try {
    db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(req.params.id);
    res.json({ message: 'User deactivated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
