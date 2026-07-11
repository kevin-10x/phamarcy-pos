import { Router } from 'express';
import db from '../database/connection.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings ORDER BY category, key').all();
    const grouped = {};
    for (const s of settings) {
      if (!grouped[s.category]) grouped[s.category] = {};
      grouped[s.category][s.key] = s.value;
    }
    res.json(grouped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const updates = req.body;
    const upsert = db.prepare('INSERT INTO settings (key, value, category) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP');

    for (const [category, settings] of Object.entries(updates)) {
      for (const [key, value] of Object.entries(settings)) {
        upsert.run(key, value, category, value);
      }
    }

    res.json({ message: 'Settings updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Audit Logs
router.get('/audit-logs', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { action, entity, user_id, page = 1, limit = 50 } = req.query;
    let query = 'SELECT al.*, u.full_name as user_name FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id WHERE 1=1';
    const params = [];
    if (action) { query += ' AND al.action = ?'; params.push(action); }
    if (entity) { query += ' AND al.entity = ?'; params.push(entity); }
    if (user_id) { query += ' AND al.user_id = ?'; params.push(user_id); }
    query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
    const logs = db.prepare(query).all(...params);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Branches
router.get('/branches', authenticateToken, (req, res) => {
  try {
    const branches = db.prepare('SELECT b.*, u.full_name as manager_name FROM branches b LEFT JOIN users u ON b.manager_id = u.id WHERE b.is_active = 1').all();
    res.json(branches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/branches', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { name, address, phone, manager_id } = req.body;
    const result = db.prepare('INSERT INTO branches (name, address, phone, manager_id) VALUES (?, ?, ?, ?)').run(name, address || '', phone || '', manager_id || null);
    const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(branch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Insurance Providers
router.get('/insurance', authenticateToken, (req, res) => {
  try {
    const providers = db.prepare('SELECT * FROM insurance_providers WHERE is_active = 1').all();
    res.json(providers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/insurance', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { name, contact_person, phone, email, claim_percentage } = req.body;
    const result = db.prepare('INSERT INTO insurance_providers (name, contact_person, phone, email, claim_percentage) VALUES (?, ?, ?, ?, ?)')
      .run(name, contact_person || null, phone || null, email || null, claim_percentage || 80);
    const provider = db.prepare('SELECT * FROM insurance_providers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(provider);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
