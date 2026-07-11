import { Router } from 'express';
import db from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/batches', authenticateToken, (req, res) => {
  try {
    const { medicine_id, status = 'active' } = req.query;
    let query = `SELECT b.*, m.brand_name, m.generic_name, m.strength, m.dosage_form, s.name as supplier_name
      FROM batches b JOIN medicines m ON b.medicine_id = m.id LEFT JOIN suppliers s ON b.supplier_id = s.id WHERE b.status = ?`;
    const params = [status];
    if (medicine_id) { query += ' AND b.medicine_id = ?'; params.push(medicine_id); }
    query += ' ORDER BY b.expiry_date ASC';
    const batches = db.prepare(query).all(...params);
    res.json(batches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/stock-in', authenticateToken, (req, res) => {
  try {
    const { medicine_id, batch_number, quantity, purchase_price, selling_price, expiry_date, supplier_id } = req.body;
    if (!medicine_id || !batch_number || !quantity || !expiry_date) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const existing = db.prepare('SELECT id FROM batches WHERE medicine_id = ? AND batch_number = ?').get(medicine_id, batch_number);
    if (existing) {
      db.prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ?').run(quantity, existing.id);
      const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(existing.id);
      return res.json(batch);
    }

    const medicine = db.prepare('SELECT default_selling_price FROM medicines WHERE id = ?').get(medicine_id);
    const result = db.prepare(`
      INSERT INTO batches (medicine_id, batch_number, quantity, initial_quantity, purchase_price, selling_price, expiry_date, supplier_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(medicine_id, batch_number, quantity, quantity, purchase_price || 0, selling_price || medicine?.default_selling_price || 0, expiry_date, supplier_id || null);

    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(batch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/adjust', authenticateToken, (req, res) => {
  try {
    const { medicine_id, batch_id, adjustment_type, quantity, reason } = req.body;
    if (!medicine_id || !adjustment_type || !quantity) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    if (batch_id) {
      const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batch_id);
      if (!batch) return res.status(404).json({ error: 'Batch not found' });

      const newQty = adjustment_type === 'add' ? batch.quantity + quantity : batch.quantity - quantity;
      if (newQty < 0) return res.status(400).json({ error: 'Insufficient stock' });
      db.prepare('UPDATE batches SET quantity = ? WHERE id = ?').run(newQty, batch_id);
    }

    db.prepare('INSERT INTO inventory_adjustments (medicine_id, batch_id, adjustment_type, quantity, reason, user_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(medicine_id, batch_id || null, adjustment_type, quantity, reason || '', req.user.id);

    res.json({ message: 'Stock adjusted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stock-take', authenticateToken, (req, res) => {
  try {
    const stock = db.prepare(`
      SELECT m.id, m.brand_name, m.generic_name, m.strength, m.dosage_form,
        COALESCE(SUM(b.quantity), 0) as system_stock, mc.name as category_name
      FROM medicines m
      LEFT JOIN batches b ON b.medicine_id = m.id AND b.status = 'active'
      LEFT JOIN medicine_categories mc ON m.category_id = mc.id
      WHERE m.is_active = 1
      GROUP BY m.id
      ORDER BY m.brand_name
    `).all();
    res.json(stock);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/summary', authenticateToken, (req, res) => {
  try {
    const totalMedicines = db.prepare('SELECT COUNT(*) as count FROM medicines WHERE is_active = 1').get().count;
    const totalStock = db.prepare("SELECT COALESCE(SUM(quantity), 0) as total FROM batches WHERE status = 'active'").get().total;
    const totalBatches = db.prepare("SELECT COUNT(*) as count FROM batches WHERE status = 'active'").get().count;
    const expiringCount = db.prepare("SELECT COUNT(*) as count FROM batches WHERE status = 'active' AND expiry_date <= date('now', '+90 days') AND expiry_date > date('now')").get().count;
    const lowStockCount = db.prepare(`
      SELECT COUNT(*) as count FROM (
        SELECT m.id, COALESCE(SUM(b.quantity), 0) as stock
        FROM medicines m LEFT JOIN batches b ON b.medicine_id = m.id AND b.status = 'active'
        WHERE m.is_active = 1 GROUP BY m.id HAVING stock <= 20
      )
    `).get().count;
    const expiredCount = db.prepare("SELECT COUNT(*) as count FROM batches WHERE status = 'active' AND expiry_date <= date('now')").get().count;

    res.json({ totalMedicines, totalStock, totalBatches, expiringCount, lowStockCount, expiredCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
