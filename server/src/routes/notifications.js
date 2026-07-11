import { Router } from 'express';
import db from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, (req, res) => {
  try {
    const { user_id, is_read, type } = req.query;
    let query = 'SELECT * FROM notifications WHERE 1=1';
    const params = [];
    if (user_id) { query += ' AND user_id = ?'; params.push(user_id); }
    if (is_read !== undefined) { query += ' AND is_read = ?'; params.push(is_read); }
    if (type) { query += ' AND type = ?'; params.push(type); }
    query += ' ORDER BY created_at DESC LIMIT 50';
    const notifications = db.prepare(query).all(...params);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, (req, res) => {
  try {
    const { user_id, type, title, message, priority } = req.body;
    const result = db.prepare('INSERT INTO notifications (user_id, type, title, message, priority) VALUES (?, ?, ?, ?, ?)')
      .run(user_id || null, type || 'info', title, message, priority || 'normal');
    const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(notification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/read', authenticateToken, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
    res.json({ message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/read-all', authenticateToken, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
    res.json({ message: 'All marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/check', authenticateToken, (req, res) => {
  try {
    const notifications = [];

    // Check low stock
    const lowStock = db.prepare(`
      SELECT m.brand_name, COALESCE(SUM(b.quantity), 0) as stock
      FROM medicines m LEFT JOIN batches b ON b.medicine_id = m.id AND b.status = 'active'
      WHERE m.is_active = 1 GROUP BY m.id HAVING stock <= 5 AND stock > 0
    `).all();
    for (const item of lowStock) {
      notifications.push({ type: 'low_stock', title: 'Low Stock Alert', message: `${item.brand_name} has only ${item.stock} units left`, priority: 'high' });
    }

    // Check expiring medicines
    const expiring = db.prepare(`
      SELECT b.batch_number, m.brand_name, b.expiry_date, b.quantity
      FROM batches b JOIN medicines m ON b.medicine_id = m.id
      WHERE b.status = 'active' AND b.expiry_date <= date('now', '+30 days') AND b.expiry_date > date('now')
      ORDER BY b.expiry_date LIMIT 5
    `).all();
    for (const item of expiring) {
      notifications.push({ type: 'expiry', title: 'Expiry Alert', message: `${item.brand_name} (Batch: ${item.batch_number}) expires on ${item.expiry_date}`, priority: 'high' });
    }

    // Check out-of-stock
    const outOfStock = db.prepare(`
      SELECT m.brand_name FROM medicines m
      LEFT JOIN batches b ON b.medicine_id = m.id AND b.status = 'active'
      WHERE m.is_active = 1 GROUP BY m.id HAVING COALESCE(SUM(b.quantity), 0) = 0
      LIMIT 5
    `).all();
    for (const item of outOfStock) {
      notifications.push({ type: 'out_of_stock', title: 'Out of Stock', message: `${item.brand_name} is out of stock`, priority: 'critical' });
    }

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
