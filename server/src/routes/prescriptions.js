import { Router } from 'express';
import db from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, (req, res) => {
  try {
    const prescriptions = db.prepare(`
      SELECT p.*, c.name as customer_name, c.phone as customer_phone
      FROM prescriptions p LEFT JOIN customers c ON p.customer_id = c.id
      ORDER BY p.created_at DESC LIMIT 100
    `).all();
    res.json(prescriptions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authenticateToken, (req, res) => {
  try {
    const prescription = db.prepare(`
      SELECT p.*, c.name as customer_name, c.phone as customer_phone
      FROM prescriptions p LEFT JOIN customers c ON p.customer_id = c.id
      WHERE p.id = ?
    `).get(req.params.id);
    if (!prescription) return res.status(404).json({ error: 'Prescription not found' });

    const items = db.prepare(`
      SELECT pi.*, m.brand_name, m.generic_name, m.strength, m.dosage_form
      FROM prescription_items pi JOIN medicines m ON pi.medicine_id = m.id
      WHERE pi.prescription_id = ?
    `).all(req.params.id);
    prescription.items = items;

    res.json(prescription);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, (req, res) => {
  try {
    const { customer_id, doctor_name, doctor_license, hospital, prescription_date, diagnosis, notes, items } = req.body;
    if (!doctor_name || !items || items.length === 0) {
      return res.status(400).json({ error: 'Doctor name and items required' });
    }

    const result = db.prepare(`
      INSERT INTO prescriptions (customer_id, doctor_name, doctor_license, hospital, prescription_date, diagnosis, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(customer_id || null, doctor_name, doctor_license || null, hospital || null, prescription_date || new Date().toISOString().split('T')[0], diagnosis || null, notes || null);

    const prescriptionId = result.lastInsertRowid;

    for (const item of items) {
      db.prepare('INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, duration, quantity_prescribed, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(prescriptionId, item.medicine_id, item.dosage || null, item.frequency || null, item.duration || null, item.quantity_prescribed || null, item.notes || null);
    }

    const prescription = db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(prescriptionId);
    prescription.items = items;
    res.status(201).json(prescription);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { status } = req.body;
    db.prepare('UPDATE prescriptions SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ message: 'Prescription updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
