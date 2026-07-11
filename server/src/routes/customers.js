import { Router } from 'express';
import db from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    let query = 'SELECT * FROM customers WHERE is_active = 1';
    const params = [];
    if (search) {
      query += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    query += ' ORDER BY name ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
    const customers = db.prepare(query).all(...params);
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authenticateToken, (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const sales = db.prepare('SELECT * FROM sales WHERE customer_id = ? ORDER BY created_at DESC LIMIT 20').all(req.params.id);
    customer.recent_sales = sales;

    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, (req, res) => {
  try {
    const { name, phone, email, address, date_of_birth, medical_notes, allergies, insurance_provider, insurance_number } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const result = db.prepare(`
      INSERT INTO customers (name, phone, email, address, date_of_birth, medical_notes, allergies, insurance_provider, insurance_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, phone || null, email || null, address || null, date_of_birth || null, medical_notes || null, allergies || null, insurance_provider || null, insurance_number || null);

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { name, phone, email, address, date_of_birth, medical_notes, allergies, insurance_provider, insurance_number } = req.body;
    db.prepare(`
      UPDATE customers SET name=?, phone=?, email=?, address=?, date_of_birth=?, medical_notes=?, allergies=?, insurance_provider=?, insurance_number=?
      WHERE id = ?
    `).run(name, phone, email, address, date_of_birth, medical_notes, allergies, insurance_provider, insurance_number, req.params.id);

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticateToken, (req, res) => {
  try {
    db.prepare('UPDATE customers SET is_active = 0 WHERE id = ?').run(req.params.id);
    res.json({ message: 'Customer removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/loyalty', authenticateToken, (req, res) => {
  try {
    const customer = db.prepare('SELECT id, name, loyalty_points, total_purchases FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
