import { Router } from 'express';
import db from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, (req, res) => {
  try {
    const suppliers = db.prepare('SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name').all();
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authenticateToken, (req, res) => {
  try {
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

    const purchases = db.prepare('SELECT * FROM purchases WHERE supplier_id = ? ORDER BY created_at DESC LIMIT 20').all(req.params.id);
    supplier.recent_purchases = purchases;
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, (req, res) => {
  try {
    const { name, contact_person, phone, email, address, city, payment_terms } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const result = db.prepare('INSERT INTO suppliers (name, contact_person, phone, email, address, city, payment_terms) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(name, contact_person || null, phone || null, email || null, address || null, city || null, payment_terms || null);
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(supplier);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { name, contact_person, phone, email, address, city, payment_terms } = req.body;
    db.prepare('UPDATE suppliers SET name=?, contact_person=?, phone=?, email=?, address=?, city=?, payment_terms=? WHERE id = ?')
      .run(name, contact_person, phone, email, address, city, payment_terms, req.params.id);
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticateToken, (req, res) => {
  try {
    db.prepare('UPDATE suppliers SET is_active = 0 WHERE id = ?').run(req.params.id);
    res.json({ message: 'Supplier removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/payments', authenticateToken, (req, res) => {
  try {
    const payments = db.prepare('SELECT * FROM payments WHERE supplier_id = ? ORDER BY created_at DESC').all(req.params.id);
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/payment', authenticateToken, (req, res) => {
  try {
    const { amount, method, reference } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    db.prepare('INSERT INTO payments (supplier_id, amount, method, reference) VALUES (?, ?, ?, ?)')
      .run(req.params.id, amount, method || 'cash', reference || null);
    db.prepare('UPDATE suppliers SET outstanding_balance = outstanding_balance - ? WHERE id = ?')
      .run(amount, req.params.id);

    res.json({ message: 'Payment recorded' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Purchase Orders
router.get('/purchases/all', authenticateToken, (req, res) => {
  try {
    const purchases = db.prepare(`
      SELECT p.*, s.name as supplier_name, u.full_name as created_by
      FROM purchases p JOIN suppliers s ON p.supplier_id = s.id LEFT JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `).all();
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/purchases', authenticateToken, (req, res) => {
  try {
    const { supplier_id, invoice_number, items, notes } = req.body;
    if (!supplier_id || !items || items.length === 0) {
      return res.status(400).json({ error: 'Supplier and items required' });
    }

    let totalAmount = 0;
    const purchaseResult = db.prepare('INSERT INTO purchases (supplier_id, user_id, invoice_number, notes) VALUES (?, ?, ?, ?)')
      .run(supplier_id, req.user.id, invoice_number || null, notes || null);
    const purchaseId = purchaseResult.lastInsertRowid;

    for (const item of items) {
      const subtotal = item.quantity * item.purchase_price;
      totalAmount += subtotal;

      db.prepare('INSERT INTO purchase_items (purchase_id, medicine_id, batch_number, quantity, purchase_price, selling_price, expiry_date, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(purchaseId, item.medicine_id, item.batch_number, item.quantity, item.purchase_price, item.selling_price, item.expiry_date, subtotal);

      // Auto-create batch
      db.prepare('INSERT INTO batches (medicine_id, batch_number, quantity, initial_quantity, purchase_price, selling_price, expiry_date, supplier_id, purchase_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(item.medicine_id, item.batch_number, item.quantity, item.quantity, item.purchase_price, item.selling_price, item.expiry_date, supplier_id, purchaseId, 'active');
    }

    db.prepare('UPDATE purchases SET total_amount = ? WHERE id = ?').run(totalAmount, purchaseId);
    db.prepare('UPDATE suppliers SET outstanding_balance = outstanding_balance + ? WHERE id = ?').run(totalAmount, supplier_id);

    const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
    res.status(201).json(purchase);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
