import { first, all, run, json, authenticate } from '../utils/d1.js';

export async function inventoryRoutes(request, env, path, db) {
  const parts = path.split('/').filter(Boolean);
  const method = request.method;
  const segment = parts[0] || '';
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  if (method === 'GET' && segment === 'batches') {
    const medicineId = searchParams.get('medicine_id');
    let sql = `SELECT b.*, m.brand_name, m.barcode
               FROM batches b
               JOIN medicines m ON m.id = b.medicine_id
               WHERE b.quantity > 0`;
    const params = [];

    if (medicineId) {
      sql += ' AND b.medicine_id = ?';
      params.push(parseInt(medicineId));
    }

    sql += ' ORDER BY b.expiry_date ASC';
    const batches = await all(db, sql, params);
    return json(batches);
  }

  if (method === 'POST' && segment === 'stock-in') {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const { medicine_id, batch_number, quantity, purchase_price, selling_price, expiry_date, supplier_id, purchase_id, branch_id } = body;

    if (!medicine_id || !batch_number || !quantity || !expiry_date) {
      return json({ error: 'medicine_id, batch_number, quantity, and expiry_date are required' }, 400);
    }

    const medicine = await first(db, 'SELECT id, purchase_price, default_selling_price FROM medicines WHERE id = ? AND is_active = 1', [medicine_id]);
    if (!medicine) {
      return json({ error: 'Medicine not found' }, 404);
    }

    const now = new Date().toISOString();
    const finalPurchasePrice = purchase_price || medicine.purchase_price;
    const finalSellingPrice = selling_price || medicine.default_selling_price;

    const existingBatch = await first(
      db,
      'SELECT id, quantity FROM batches WHERE medicine_id = ? AND batch_number = ?',
      [medicine_id, batch_number]
    );

    let batchId;
    if (existingBatch) {
      const newQty = existingBatch.quantity + quantity;
      await run(
        db,
        'UPDATE batches SET quantity = ?, purchase_price = ?, selling_price = ? WHERE id = ?',
        [newQty, finalPurchasePrice, finalSellingPrice, existingBatch.id]
      );
      batchId = existingBatch.id;
    } else {
      const info = await run(
        db,
        `INSERT INTO batches (medicine_id, batch_number, quantity, initial_quantity, purchase_price, selling_price, expiry_date, supplier_id, purchase_id, branch_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
        [medicine_id, batch_number, quantity, quantity, finalPurchasePrice, finalSellingPrice, expiry_date, supplier_id || null, purchase_id || null, branch_id || null, now]
      );
      batchId = info.lastInsertRowid;
    }

    await run(
      db,
      `INSERT INTO inventory_adjustments (medicine_id, batch_id, adjustment_type, quantity, reason, user_id, created_at)
       VALUES (?, ?, 'stock_in', ?, ?, ?, ?)`,
      [medicine_id, batchId, quantity, `Stock in: ${batch_number}`, authUser.id, now]
    );

    const batch = await first(db, 'SELECT * FROM batches WHERE id = ?', [batchId]);
    return json(batch, 201);
  }

  if (method === 'POST' && segment === 'adjust') {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const { medicine_id, batch_id, adjustment_type, quantity, reason } = body;

    if (!medicine_id || !batch_id || adjustment_type === undefined || quantity === undefined) {
      return json({ error: 'medicine_id, batch_id, adjustment_type, and quantity are required' }, 400);
    }

    const batch = await first(db, 'SELECT * FROM batches WHERE id = ?', [batch_id]);
    if (!batch) {
      return json({ error: 'Batch not found' }, 404);
    }

    let newQty;
    if (adjustment_type === 'increase') {
      newQty = batch.quantity + Math.abs(quantity);
    } else if (adjustment_type === 'decrease') {
      newQty = batch.quantity - Math.abs(quantity);
      if (newQty < 0) {
        return json({ error: 'Adjustment would result in negative stock' }, 400);
      }
    } else {
      return json({ error: 'adjustment_type must be increase or decrease' }, 400);
    }

    await run(db, 'UPDATE batches SET quantity = ? WHERE id = ?', [newQty, batch_id]);

    await run(
      db,
      `INSERT INTO inventory_adjustments (medicine_id, batch_id, adjustment_type, quantity, reason, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [medicine_id, batch_id, adjustment_type, quantity, reason || 'Manual adjustment', authUser.id, new Date().toISOString()]
    );

    const updated = await first(db, 'SELECT * FROM batches WHERE id = ?', [batch_id]);
    return json(updated);
  }

  if (method === 'GET' && segment === 'stock-take') {
    const results = await all(
      db,
      `SELECT m.id, m.brand_name, m.barcode, m.category_id, mc.name as category_name, m.unit,
              COALESCE(SUM(b.quantity), 0) as total_stock,
              COALESCE(SUM(b.initial_quantity), 0) as total_received,
              COUNT(b.id) as batch_count
       FROM medicines m
       LEFT JOIN medicine_categories mc ON mc.id = m.category_id
       LEFT JOIN batches b ON b.medicine_id = m.id AND b.quantity > 0
       WHERE m.is_active = 1
       GROUP BY m.id
       ORDER BY m.brand_name`
    );
    return json(results);
  }

  if (method === 'GET' && segment === 'summary') {
    const totalMedicines = await first(db, 'SELECT COUNT(*) as count FROM medicines WHERE is_active = 1');
    const totalBatches = await first(db, 'SELECT COUNT(*) as count FROM batches WHERE quantity > 0');
    const lowStockCount = await first(
      db,
      `SELECT COUNT(DISTINCT m.id) as count
       FROM medicines m
       LEFT JOIN batches b ON b.medicine_id = m.id AND b.quantity > 0
       WHERE m.is_active = 1
       GROUP BY m.id
       HAVING COALESCE(SUM(b.quantity), 0) <= 10`
    );
    const expiringSoon = await first(
      db,
      `SELECT COUNT(*) as count FROM batches b
       JOIN medicines m ON m.id = b.medicine_id
       WHERE b.quantity > 0 AND m.is_active = 1
       AND b.expiry_date <= date('now', '+90 days')`
    );
    const totalStockValue = await first(
      db,
      'SELECT COALESCE(SUM(quantity * purchase_price), 0) as value FROM batches WHERE quantity > 0'
    );
    const totalRetailValue = await first(
      db,
      'SELECT COALESCE(SUM(quantity * selling_price), 0) as value FROM batches WHERE quantity > 0'
    );

    return json({
      total_medicines: totalMedicines ? totalMedicines.count : 0,
      total_batches: totalBatches ? totalBatches.count : 0,
      low_stock_count: lowStockCount ? lowStockCount.count : 0,
      expiring_soon_count: expiringSoon ? expiringSoon.count : 0,
      total_stock_value: totalStockValue ? totalStockValue.value : 0,
      total_retail_value: totalRetailValue ? totalRetailValue.value : 0,
    });
  }

  return json({ error: 'Not found' }, 404);
}
