/**
 * D1 Seed Script - JavaScript version
 *
 * Usage with wrangler (recommended):
 *   wrangler d1 execute pharmacy-pos-db --file=./scripts/seed-d1.js
 *
 * Usage as standalone Node.js script:
 *   node scripts/seed-d1.js > seed-output.sql
 *
 * Seeds: 24 categories, 166 medicines, 3 users, 5 suppliers, 1 branch, settings
 */

import { kenyanMedicines, medicineCategories } from '../src/data/kenyan-medicines.js';
import bcrypt from 'bcryptjs';

function esc(str) {
  if (str === null || str === undefined) return 'NULL';
  return String(str).replace(/'/g, "''");
}

function sqlVal(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  return `'${esc(val)}'`;
}

function buildStatements() {
  const stmts = [];

  // Categories
  for (const cat of medicineCategories) {
    stmts.push(`INSERT OR IGNORE INTO medicine_categories (name, description) VALUES (${sqlVal(cat.name)}, ${sqlVal(cat.description)});`);
  }

  // Users (bcrypt hashes generated fresh each run)
  const adminHash = bcrypt.hashSync('admin123', 10);
  const pharmHash = bcrypt.hashSync('pharmacist123', 10);
  const cashHash = bcrypt.hashSync('cashier123', 10);

  stmts.push(`INSERT OR IGNORE INTO users (username, email, password, full_name, role, phone, is_active) VALUES ('admin', 'admin@pharmacy-pos.com', ${sqlVal(adminHash)}, 'System Administrator', 'admin', '+254700000001', 1);`);
  stmts.push(`INSERT OR IGNORE INTO users (username, email, password, full_name, role, phone, is_active) VALUES ('pharmacist', 'pharmacist@pharmacy-pos.com', ${sqlVal(pharmHash)}, 'Chief Pharmacist', 'pharmacist', '+254700000002', 1);`);
  stmts.push(`INSERT OR IGNORE INTO users (username, email, password, full_name, role, phone, is_active) VALUES ('cashier', 'cashier@pharmacy-pos.com', ${sqlVal(cashHash)}, 'Main Cashier', 'cashier', '+254700000003', 1);`);

  // Suppliers
  const suppliers = [
    { name: 'Lab & Allied', contact: 'John Mwangi', phone: '+254202501080', email: 'info@laballied.co.ke', addr: 'Industrial Area, Nairobi' },
    { name: 'Phillips Pharmaceuticals', contact: 'Alice Ochieng', phone: '+254202694935', email: 'sales@phillips.co.ke', addr: 'Lusaka Road, Nairobi' },
    { name: 'Medisel Kenya', contact: 'Peter Kamau', phone: '+254208234567', email: 'info@medisel.co.ke', addr: 'Enterprise Road, Nairobi' },
    { name: 'Cosmos Pharmaceuticals', contact: 'Grace Wanjiku', phone: '+254203456789', email: 'sales@cosmospharma.co.ke', addr: 'Mombasa Road, Nairobi' },
    { name: 'Dawa Limited', contact: 'David Omondi', phone: '+254206503600', email: 'info@dawa.co.ke', addr: 'Kangundo Road, Nairobi' }
  ];
  for (const s of suppliers) {
    stmts.push(`INSERT OR IGNORE INTO suppliers (name, contact_person, phone, email, address, city, outstanding_balance, payment_terms, is_active) VALUES (${sqlVal(s.name)}, ${sqlVal(s.contact)}, ${sqlVal(s.phone)}, ${sqlVal(s.email)}, ${sqlVal(s.addr)}, 'Nairobi', 0, 'Net 30', 1);`);
  }

  // Branch
  stmts.push(`INSERT OR IGNORE INTO branches (id, name, address, phone, manager_id, is_active) VALUES (1, 'Main Branch', 'Kenyatta Avenue, Nairobi', '+254202221234', 1, 1);`);

  // Medicines
  for (const med of kenyanMedicines) {
    const cols = ['brand_name', 'generic_name', 'strength', 'dosage_form', 'category_id', 'manufacturer', 'unit', 'default_selling_price', 'prescription_required', 'controlled_drug', 'storage_requirements'];
    const vals = [
      sqlVal(med.brand_name),
      sqlVal(med.generic_name),
      sqlVal(med.strength),
      sqlVal(med.dosage_form),
      `(SELECT id FROM medicine_categories WHERE name = ${sqlVal(med.category)})`,
      sqlVal(med.manufacturer),
      sqlVal(med.unit),
      String(med.default_selling_price),
      String(med.prescription_required),
      String(med.controlled_drug),
      sqlVal(med.storage_requirements)
    ];
    if (med.alternative_brands) {
      cols.push('alternative_brands');
      vals.push(sqlVal(med.alternative_brands));
    }
    stmts.push(`INSERT OR IGNORE INTO medicines (${cols.join(', ')}) VALUES (${vals.join(', ')});`);
  }

  // Settings
  const settings = [
    ['pharmacy_name', 'Pharmacy POS Kenya', 'general'],
    ['pharmacy_phone', '+254202221234', 'general'],
    ['pharmacy_email', 'info@pharmacypos.co.ke', 'general'],
    ['pharmacy_address', 'Kenyatta Avenue, Nairobi, Kenya', 'general'],
    ['currency', 'KES', 'general'],
    ['currency_symbol', 'KSh', 'general'],
    ['vat_rate', '16', 'tax'],
    ['vat_enabled', 'true', 'tax'],
    ['receipt_header', 'Thank you for shopping with us!', 'receipt'],
    ['receipt_footer', 'Get well soon!', 'receipt'],
    ['low_stock_threshold', '10', 'inventory'],
    ['expiry_alert_days', '90', 'inventory'],
    ['loyalty_points_per_kes', '1', 'loyalty'],
    ['loyalty_redemption_rate', '0.01', 'loyalty'],
    ['enable_prescription_verification', 'true', 'pharmacy'],
    ['enable_controlled_drug_tracking', 'true', 'pharmacy'],
    ['default_branch_id', '1', 'general']
  ];
  for (const [key, value, category] of settings) {
    stmts.push(`INSERT OR IGNORE INTO settings (key, value, category) VALUES (${sqlVal(key)}, ${sqlVal(value)}, ${sqlVal(category)});`);
  }

  return stmts;
}

// ============================================================
// Export for wrangler d1 execute --file
// wrangler imports the default export and executes each string
// ============================================================
const statements = buildStatements();
export default statements;

// ============================================================
// Standalone mode: print SQL to stdout
// ============================================================
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('seed-d1.js')) {
  for (const stmt of statements) {
    console.log(stmt);
  }
  console.error(`\n-- Generated ${statements.length} statements`);
  console.error(`-- Categories: ${medicineCategories.length}`);
  console.error(`-- Medicines: ${kenyanMedicines.length}`);
}
