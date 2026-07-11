import { Router } from 'express';
import db from '../database/connection.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';

const router = Router();

router.get('/', authenticateToken, requireRole('admin', 'pharmacist'), (req, res) => {
  try {
    const employees = db.prepare('SELECT id, username, email, full_name, role, phone, is_active, created_at FROM users ORDER BY full_name').all();
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { username, email, password, full_name, role, phone } = req.body;
    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existing) return res.status(409).json({ error: 'Username or email already exists' });

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (username, email, password, full_name, role, phone) VALUES (?, ?, ?, ?, ?, ?)')
      .run(username, email, hashedPassword, full_name, role || 'cashier', phone || null);

    const employee = db.prepare('SELECT id, username, email, full_name, role, phone, is_active FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(employee);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/performance', authenticateToken, requireRole('admin', 'pharmacist'), (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const startDate = start_date || today;
    const endDate = end_date || today;

    const performance = db.prepare(`
      SELECT u.id, u.full_name, u.role,
        COUNT(s.id) as total_sales,
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        COALESCE(SUM(s.amount_paid), 0) as total_collected
      FROM users u
      LEFT JOIN sales s ON s.user_id = u.id AND s.status = 'completed' AND date(s.created_at) BETWEEN ? AND ?
      WHERE u.is_active = 1 AND u.role IN ('cashier', 'pharmacist')
      GROUP BY u.id ORDER BY total_revenue DESC
    `).all(startDate, endDate);

    res.json(performance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/activity-log', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT al.*, u.full_name as user_name
      FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC LIMIT 100
    `).all();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
