import { Router } from 'express';
import db from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/dashboard', authenticateToken, (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const todaySales = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total, COALESCE(SUM(amount_paid), 0) as collected
      FROM sales WHERE status = 'completed' AND date(created_at) = ?
    `).get(today);

    const todayProfit = db.prepare(`
      SELECT COALESCE(SUM(si.subtotal - (si.quantity * m.purchase_price)), 0) as profit
      FROM sale_items si JOIN sales s ON si.sale_id = s.id JOIN medicines m ON si.medicine_id = m.id
      WHERE s.status = 'completed' AND date(s.created_at) = ?
    `).get(today);

    const monthRevenue = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as revenue, COALESCE(SUM(amount_paid), 0) as collected
      FROM sales WHERE status = 'completed' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
    `).get();

    const monthProfit = db.prepare(`
      SELECT COALESCE(SUM(si.subtotal - (si.quantity * m.purchase_price)), 0) as profit
      FROM sale_items si JOIN sales s ON si.sale_id = s.id JOIN medicines m ON si.medicine_id = m.id
      WHERE s.status = 'completed' AND strftime('%Y-%m', s.created_at) = strftime('%Y-%m', 'now')
    `).get();

    const lowStock = db.prepare(`
      SELECT m.id, m.brand_name, m.generic_name, m.strength, m.dosage_form,
        COALESCE(SUM(b.quantity), 0) as current_stock, mc.name as category_name
      FROM medicines m
      LEFT JOIN batches b ON b.medicine_id = m.id AND b.status = 'active' AND b.expiry_date > date('now')
      LEFT JOIN medicine_categories mc ON m.category_id = mc.id
      WHERE m.is_active = 1 GROUP BY m.id HAVING current_stock <= 20
      ORDER BY current_stock ASC LIMIT 5
    `).all();

    const expiringMedicines = db.prepare(`
      SELECT b.*, m.brand_name, m.generic_name, m.strength
      FROM batches b JOIN medicines m ON b.medicine_id = m.id
      WHERE b.status = 'active' AND b.expiry_date <= date('now', '+90 days') AND b.expiry_date > date('now')
      ORDER BY b.expiry_date ASC LIMIT 5
    `).all();

    const topSelling = db.prepare(`
      SELECT m.brand_name, m.generic_name, m.strength, SUM(si.quantity) as qty_sold, SUM(si.subtotal) as revenue
      FROM sale_items si JOIN sales s ON si.sale_id = s.id JOIN medicines m ON si.medicine_id = m.id
      WHERE s.status = 'completed' AND strftime('%Y-%m', s.created_at) = strftime('%Y-%m', 'now')
      GROUP BY m.id ORDER BY qty_sold DESC LIMIT 5
    `).all();

    const pendingPrescriptions = db.prepare("SELECT COUNT(*) as count FROM prescriptions WHERE status = 'active'").get();

    const todayExpenses = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date = ?").get(today);

    const recentSales = db.prepare(`
      SELECT s.*, c.name as customer_name, u.full_name as cashier_name
      FROM sales s LEFT JOIN customers c ON s.customer_id = c.id LEFT JOIN users u ON s.user_id = u.id
      WHERE s.status = 'completed' ORDER BY s.created_at DESC LIMIT 5
    `).all();

    const totalMedicines = db.prepare('SELECT COUNT(*) as count FROM medicines WHERE is_active = 1').get().count;
    const totalCustomers = db.prepare('SELECT COUNT(*) as count FROM customers WHERE is_active = 1').get().count;
    const totalStock = db.prepare("SELECT COALESCE(SUM(quantity), 0) as total FROM batches WHERE status = 'active'").get().total;

    res.json({
      todaySales, todayProfit, monthRevenue, monthProfit,
      lowStock, expiringMedicines, topSelling,
      pendingPrescriptions: pendingPrescriptions.count,
      todayExpenses: todayExpenses.total,
      recentSales,
      totalMedicines, totalCustomers, totalStock
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sales-report', authenticateToken, (req, res) => {
  try {
    const { period = 'daily', start_date, end_date } = req.query;
    let groupBy, dateFormat;

    switch (period) {
      case 'daily': groupBy = "date(created_at)"; dateFormat = '%Y-%m-%d'; break;
      case 'weekly': groupBy = "strftime('%Y-W%W', created_at)"; dateFormat = '%Y-W%W'; break;
      case 'monthly': groupBy = "strftime('%Y-%m', created_at)"; dateFormat = '%Y-%m'; break;
      case 'yearly': groupBy = "strftime('%Y', created_at)"; dateFormat = '%Y'; break;
      default: groupBy = "date(created_at)"; dateFormat = '%Y-%m-%d';
    }

    let dateFilter = '';
    const params = ['completed'];
    if (start_date && end_date) {
      dateFilter = 'AND date(created_at) BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    const report = db.prepare(`
      SELECT ${groupBy} as period,
        COUNT(*) as sales_count,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(amount_paid), 0) as total_collected,
        COALESCE(SUM(vat_amount), 0) as total_vat,
        COALESCE(SUM(discount_amount), 0) as total_discounts
      FROM sales WHERE status = ? ${dateFilter}
      GROUP BY ${groupBy} ORDER BY period DESC LIMIT 30
    `).all(...params);

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/inventory-report', authenticateToken, (req, res) => {
  try {
    const currentStock = db.prepare(`
      SELECT m.*, COALESCE(SUM(b.quantity), 0) as current_stock, mc.name as category_name
      FROM medicines m
      LEFT JOIN batches b ON b.medicine_id = m.id AND b.status = 'active'
      LEFT JOIN medicine_categories mc ON m.category_id = mc.id
      WHERE m.is_active = 1 GROUP BY m.id ORDER BY m.brand_name
    `).all();

    const categoryBreakdown = db.prepare(`
      SELECT mc.name as category, COUNT(DISTINCT m.id) as medicine_count,
        COALESCE(SUM(b.quantity), 0) as total_stock
      FROM medicine_categories mc
      LEFT JOIN medicines m ON m.category_id = mc.id AND m.is_active = 1
      LEFT JOIN batches b ON b.medicine_id = m.id AND b.status = 'active'
      GROUP BY mc.id ORDER BY mc.name
    `).all();

    res.json({ currentStock, categoryBreakdown });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/financial-report', authenticateToken, (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const startDate = start_date || today;
    const endDate = end_date || today;

    const revenue = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(vat_amount), 0) as total_vat
      FROM sales WHERE status = 'completed' AND date(created_at) BETWEEN ? AND ?
    `).get(startDate, endDate);

    const cost = db.prepare(`
      SELECT COALESCE(SUM(si.quantity * m.purchase_price), 0) as total_cost
      FROM sale_items si JOIN sales s ON si.sale_id = s.id JOIN medicines m ON si.medicine_id = m.id
      WHERE s.status = 'completed' AND date(s.created_at) BETWEEN ? AND ?
    `).get(startDate, endDate);

    const expenses = db.prepare(`
      SELECT category, COALESCE(SUM(amount), 0) as total
      FROM expenses WHERE date BETWEEN ? AND ?
      GROUP BY category
    `).all(startDate, endDate);

    const totalExpenses = expenses.reduce((sum, e) => sum + e.total, 0);
    const grossProfit = revenue.total_revenue - cost.total_cost;
    const netProfit = grossProfit - totalExpenses;

    res.json({ revenue, cost: cost.total_cost, expenses, totalExpenses, grossProfit, netProfit });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/cash-summary', authenticateToken, (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const summary = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount_paid ELSE 0 END), 0) as cash,
        COALESCE(SUM(CASE WHEN payment_method = 'mpesa' THEN amount_paid ELSE 0 END), 0) as mpesa,
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN amount_paid ELSE 0 END), 0) as card,
        COALESCE(SUM(CASE WHEN payment_method = 'insurance' THEN amount_paid ELSE 0 END), 0) as insurance,
        COALESCE(SUM(CASE WHEN payment_method = 'credit' THEN total_amount ELSE 0 END), 0) as credit,
        COALESCE(SUM(amount_paid), 0) as total_collected
      FROM sales WHERE status = 'completed' AND date(created_at) = ?
    `).get(today);

    const expenses = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date = ?').get(today);

    res.json({ ...summary, expenses: expenses.total, net: summary.total_collected - expenses.total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Expenses
router.get('/expenses', authenticateToken, (req, res) => {
  try {
    const { start_date, end_date, category } = req.query;
    let query = 'SELECT e.*, u.full_name as recorded_by FROM expenses e LEFT JOIN users u ON e.user_id = u.id WHERE 1=1';
    const params = [];
    if (start_date && end_date) { query += ' AND date BETWEEN ? AND ?'; params.push(start_date, end_date); }
    if (category) { query += ' AND category = ?'; params.push(category); }
    query += ' ORDER BY e.created_at DESC';
    const expenses = db.prepare(query).all(...params);
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/expenses', authenticateToken, (req, res) => {
  try {
    const { category, description, amount, date } = req.body;
    if (!category || !amount) return res.status(400).json({ error: 'Category and amount required' });

    const result = db.prepare('INSERT INTO expenses (category, description, amount, date, user_id) VALUES (?, ?, ?, ?, ?)')
      .run(category, description || '', amount, date || new Date().toISOString().split('T')[0], req.user.id);

    const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
