import { Router } from 'express';
import db from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, (req, res) => {
  try {
    const { search, category_id, prescription_required, controlled_drug, low_stock, page = 1, limit = 50 } = req.query;
    let query = 'SELECT m.*, mc.name as category_name FROM medicines m LEFT JOIN medicine_categories mc ON m.category_id = mc.id WHERE m.is_active = 1';
    const params = [];

    if (search) {
      query += ' AND (m.brand_name LIKE ? OR m.generic_name LIKE ? OR m.barcode LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (category_id) {
      query += ' AND m.category_id = ?';
      params.push(category_id);
    }
    if (prescription_required !== undefined) {
      query += ' AND m.prescription_required = ?';
      params.push(prescription_required);
    }
    if (controlled_drug !== undefined) {
      query += ' AND m.controlled_drug = ?';
      params.push(controlled_drug);
    }

    const countQuery = query.replace('SELECT m.*, mc.name as category_name', 'SELECT COUNT(*) as total');
    const { total } = db.prepare(countQuery).get(...params);

    query += ' ORDER BY m.brand_name ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const medicines = db.prepare(query).all(...params);

    // Attach current stock for each medicine
    for (const med of medicines) {
      const stock = db.prepare('SELECT COALESCE(SUM(quantity), 0) as stock FROM batches WHERE medicine_id = ? AND status = ? AND expiry_date > date('now')').get(med.id, 'active');
      med.current_stock = stock.stock;
    }

    res.json({ medicines, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/categories', authenticateToken, (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM medicine_categories ORDER BY name').all();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authenticateToken, (req, res) => {
  try {
    const medicine = db.prepare('SELECT m.*, mc.name as category_name FROM medicines m LEFT JOIN medicine_categories mc ON m.category_id = mc.id WHERE m.id = ?').get(req.params.id);
    if (!medicine) return res.status(404).json({ error: 'Medicine not found' });

    const batches = db.prepare('SELECT b.*, s.name as supplier_name FROM batches b LEFT JOIN suppliers s ON b.supplier_id = s.id WHERE b.medicine_id = ? AND b.status = ? ORDER BY b.expiry_date ASC').all(medicine.id, 'active');
    medicine.batches = batches;
    medicine.current_stock = batches.reduce((sum, b) => sum + b.quantity, 0);

    res.json(medicine);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, (req, res) => {
  try {
    const { brand_name, generic_name, strength, dosage_form, category_id, manufacturer, unit, default_selling_price, barcode, prescription_required, controlled_drug, storage_requirements, alternative_brands, purchase_price } = req.body;

    const result = db.prepare(`
      INSERT INTO medicines (brand_name, generic_name, strength, dosage_form, category_id, manufacturer, unit, default_selling_price, barcode, prescription_required, controlled_drug, storage_requirements, alternative_brands, purchase_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(brand_name, generic_name, strength, dosage_form, category_id, manufacturer, unit, default_selling_price, barcode, prescription_required || 0, controlled_drug || 0, storage_requirements, alternative_brands, purchase_price || 0);

    const medicine = db.prepare('SELECT * FROM medicines WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(medicine);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { brand_name, generic_name, strength, dosage_form, category_id, manufacturer, unit, default_selling_price, barcode, prescription_required, controlled_drug, storage_requirements, alternative_brands, purchase_price } = req.body;

    db.prepare(`
      UPDATE medicines SET brand_name=?, generic_name=?, strength=?, dosage_form=?, category_id=?, manufacturer=?, unit=?, default_selling_price=?, barcode=?, prescription_required=?, controlled_drug=?, storage_requirements=?, alternative_brands=?, purchase_price=?, updated_at=CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(brand_name, generic_name, strength, dosage_form, category_id, manufacturer, unit, default_selling_price, barcode, prescription_required, controlled_drug, storage_requirements, alternative_brands, purchase_price, req.params.id);

    const medicine = db.prepare('SELECT * FROM medicines WHERE id = ?').get(req.params.id);
    res.json(medicine);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticateToken, (req, res) => {
  try {
    db.prepare('UPDATE medicines SET is_active = 0 WHERE id = ?').run(req.params.id);
    res.json({ message: 'Medicine deactivated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/low-stock/alert', authenticateToken, (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 20;
    const medicines = db.prepare(`
      SELECT m.*, COALESCE(SUM(b.quantity), 0) as current_stock, mc.name as category_name
      FROM medicines m
      LEFT JOIN batches b ON b.medicine_id = m.id AND b.status = 'active' AND b.expiry_date > date('now')
      LEFT JOIN medicine_categories mc ON m.category_id = mc.id
      WHERE m.is_active = 1
      GROUP BY m.id
      HAVING current_stock <= ?
      ORDER BY current_stock ASC
    `).all(threshold);
    res.json(medicines);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/expiry/alert', authenticateToken, (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const batches = db.prepare(`
      SELECT b.*, m.brand_name, m.generic_name, m.strength, m.dosage_form, s.name as supplier_name
      FROM batches b
      JOIN medicines m ON b.medicine_id = m.id
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      WHERE b.status = 'active' AND b.expiry_date <= date('now', '+' || ? || ' days') AND b.expiry_date > date('now')
      ORDER BY b.expiry_date ASC
    `).all(days);
    res.json(batches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
