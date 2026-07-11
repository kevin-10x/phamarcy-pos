import { Router } from 'express';
import db from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/sale', authenticateToken, (req, res) => {
  try {
    const { customer_id, items, payment_method, amount_paid, discount_amount, prescription_id, notes } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items in sale' });
    }

    let subtotal = 0;
    let vatAmount = 0;

    const validatedItems = [];
    for (const item of items) {
      const medicine = db.prepare('SELECT * FROM medicines WHERE id = ?').get(item.medicine_id);
      if (!medicine) return res.status(404).json({ error: `Medicine ${item.medicine_id} not found` });

      // Find batch using FEFO (First Expiry First Out)
      const batch = db.prepare(`
        SELECT * FROM batches WHERE medicine_id = ? AND status = 'active' AND quantity >= ? AND expiry_date > date('now')
        ORDER BY expiry_date ASC LIMIT 1
      `).get(item.medicine_id, item.quantity);

      if (!batch) {
        return res.status(400).json({ error: `Insufficient stock for ${medicine.brand_name}` });
      }

      const itemSubtotal = batch.selling_price * item.quantity;
      const itemDiscount = item.discount || 0;
      const itemVat = (itemSubtotal - itemDiscount) * (medicine.vat_rate / 100);

      subtotal += itemSubtotal - itemDiscount;
      vatAmount += itemVat;

      validatedItems.push({ ...item, batch_id: batch.id, unit_price: batch.selling_price, subtotal: itemSubtotal - itemDiscount, vat: itemVat });
    }

    const totalAmount = subtotal + vatAmount - (discount_amount || 0);
    const amountPaid = amount_paid || totalAmount;
    const changeAmount = amountPaid > totalAmount ? amountPaid - totalAmount : 0;

    // Create sale
    const saleResult = db.prepare(`
      INSERT INTO sales (customer_id, user_id, prescription_id, subtotal, vat_amount, discount_amount, total_amount, payment_method, amount_paid, change_amount, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(customer_id || null, req.user.id, prescription_id || null, subtotal, vatAmount, discount_amount || 0, totalAmount, payment_method || 'cash', amountPaid, changeAmount, notes || null);

    const saleId = saleResult.lastInsertRowid;

    // Insert sale items and update batch quantities
    for (const item of validatedItems) {
      db.prepare('INSERT INTO sale_items (sale_id, medicine_id, batch_id, quantity, unit_price, discount, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(saleId, item.medicine_id, item.batch_id, item.quantity, item.unit_price, item.discount || 0, item.subtotal);

      db.prepare('UPDATE batches SET quantity = quantity - ? WHERE id = ?').run(item.quantity, item.batch_id);
    }

    // Update customer loyalty
    if (customer_id) {
      const points = Math.floor(totalAmount / 100);
      db.prepare('UPDATE customers SET loyalty_points = loyalty_points + ?, total_purchases = total_purchases + ? WHERE id = ?')
        .run(points, totalAmount, customer_id);
    }

    // Update medicine purchase price from latest batch if not set
    for (const item of validatedItems) {
      const med = db.prepare('SELECT purchase_price FROM medicines WHERE id = ?').get(item.medicine_id);
      if (med && med.purchase_price === 0) {
        const batch = db.prepare('SELECT purchase_price FROM batches WHERE id = ?').get(item.batch_id);
        if (batch) {
          db.prepare('UPDATE medicines SET purchase_price = ? WHERE id = ?').run(batch.purchase_price, item.medicine_id);
        }
      }
    }

    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
    const saleItems = db.prepare(`
      SELECT si.*, m.brand_name, m.generic_name, m.strength, m.dosage_form
      FROM sale_items si JOIN medicines m ON si.medicine_id = m.id WHERE si.sale_id = ?
    `).all(saleId);

    res.status(201).json({ ...sale, items: saleItems });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sales', authenticateToken, (req, res) => {
  try {
    const { date, start_date, end_date, user_id, page = 1, limit = 50 } = req.query;
    let query = 'SELECT s.*, u.full_name as cashier_name, c.name as customer_name FROM sales s LEFT JOIN users u ON s.user_id = u.id LEFT JOIN customers c ON s.customer_id = c.id WHERE s.status = ?';
    const params = ['completed'];

    if (date) {
      query += " AND date(s.created_at) = ?";
      params.push(date);
    }
    if (start_date && end_date) {
      query += " AND date(s.created_at) BETWEEN ? AND ?";
      params.push(start_date, end_date);
    }
    if (user_id) {
      query += ' AND s.user_id = ?';
      params.push(user_id);
    }

    const countQuery = query.replace('SELECT s.*, u.full_name as cashier_name, c.name as customer_name', 'SELECT COUNT(*) as total');
    const { total } = db.prepare(countQuery).get(...params);

    query += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const sales = db.prepare(query).all(...params);
    res.json({ sales, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sales/:id', authenticateToken, (req, res) => {
  try {
    const sale = db.prepare('SELECT s.*, u.full_name as cashier_name, c.name as customer_name FROM sales s LEFT JOIN users u ON s.user_id = u.id LEFT JOIN customers c ON s.customer_id = c.id WHERE s.id = ?').get(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });

    const items = db.prepare('SELECT si.*, m.brand_name, m.generic_name, m.strength, m.dosage_form FROM sale_items si JOIN medicines m ON si.medicine_id = m.id WHERE si.sale_id = ?').all(sale.id);
    sale.items = items;

    res.json(sale);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/void/:id', authenticateToken, (req, res) => {
  try {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    if (sale.status === 'voided') return res.status(400).json({ error: 'Sale already voided' });

    db.prepare("UPDATE sales SET status = 'voided' WHERE id = ?").run(req.params.id);

    // Restore batch quantities
    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(req.params.id);
    for (const item of items) {
      if (item.batch_id) {
        db.prepare('UPDATE batches SET quantity = quantity + ? WHERE id = ?').run(item.quantity, item.batch_id);
      }
    }

    // Reverse loyalty points
    if (sale.customer_id) {
      const points = Math.floor(sale.total_amount / 100);
      db.prepare('UPDATE customers SET loyalty_points = loyalty_points - ?, total_purchases = total_purchases - ? WHERE id = ?')
        .run(points, sale.total_amount, sale.customer_id);
    }

    res.json({ message: 'Sale voided successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/today-summary', authenticateToken, (req, res) => {
  try {
    const summary = db.prepare(`
      SELECT
        COUNT(*) as total_sales,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(vat_amount), 0) as total_vat,
        COALESCE(SUM(discount_amount), 0) as total_discounts,
        COALESCE(SUM(amount_paid), 0) as total_collected
      FROM sales WHERE status = 'completed' AND date(created_at) = date('now')
    `).get();

    const paymentBreakdown = db.prepare(`
      SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total
      FROM sales WHERE status = 'completed' AND date(created_at) = date('now')
      GROUP BY payment_method
    `).all();

    const topSelling = db.prepare(`
      SELECT m.brand_name, m.generic_name, SUM(si.quantity) as qty_sold, SUM(si.subtotal) as revenue
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN medicines m ON si.medicine_id = m.id
      WHERE s.status = 'completed' AND date(s.created_at) = date('now')
      GROUP BY m.id ORDER BY qty_sold DESC LIMIT 10
    `).all();

    res.json({ summary, paymentBreakdown, topSelling });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/profit', authenticateToken, (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const startDate = start_date || today;
    const endDate = end_date || today;

    const profit = db.prepare(`
      SELECT
        SUM(si.subtotal) as total_sales,
        SUM(si.quantity * m.purchase_price) as total_cost,
        SUM(si.subtotal) - SUM(si.quantity * m.purchase_price) as gross_profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN medicines m ON si.medicine_id = m.id
      WHERE s.status = 'completed' AND date(s.created_at) BETWEEN ? AND ?
    `).get(startDate, endDate);

    const expenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total_expenses
      FROM expenses WHERE date BETWEEN ? AND ?
    `).get(startDate, endDate);

    const netProfit = (profit.gross_profit || 0) - expenses.total_expenses;

    res.json({ ...profit, total_expenses: expenses.total_expenses, net_profit: netProfit });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
