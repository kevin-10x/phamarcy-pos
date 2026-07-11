import db from './connection.js';

export async function initializeDatabase() {
  await db.initConnection();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'cashier',
      phone TEXT,
      avatar TEXT,
      is_active INTEGER DEFAULT 1,
      two_factor_enabled INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      manager_id INTEGER REFERENCES users(id),
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS medicine_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      outstanding_balance REAL DEFAULT 0,
      payment_terms TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_name TEXT NOT NULL,
      generic_name TEXT NOT NULL,
      strength TEXT,
      dosage_form TEXT,
      category_id INTEGER REFERENCES medicine_categories(id),
      manufacturer TEXT,
      supplier_id INTEGER REFERENCES suppliers(id),
      barcode TEXT UNIQUE,
      kemsa_code TEXT,
      ppb_registration TEXT,
      unit TEXT DEFAULT 'tablet',
      default_selling_price REAL NOT NULL,
      purchase_price REAL DEFAULT 0,
      vat_rate REAL DEFAULT 16,
      prescription_required INTEGER DEFAULT 0,
      controlled_drug INTEGER DEFAULT 0,
      image TEXT,
      description TEXT,
      storage_requirements TEXT,
      drug_interactions TEXT,
      allergy_alerts TEXT,
      alternative_brands TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id INTEGER NOT NULL REFERENCES medicines(id),
      batch_number TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      initial_quantity INTEGER NOT NULL DEFAULT 0,
      purchase_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      expiry_date DATE NOT NULL,
      supplier_id INTEGER REFERENCES suppliers(id),
      purchase_id INTEGER REFERENCES purchases(id),
      branch_id INTEGER REFERENCES branches(id),
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      branch_id INTEGER REFERENCES branches(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      invoice_number TEXT,
      total_amount REAL NOT NULL DEFAULT 0,
      amount_paid REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL REFERENCES purchases(id),
      medicine_id INTEGER NOT NULL REFERENCES medicines(id),
      batch_number TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      purchase_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      expiry_date DATE NOT NULL,
      subtotal REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE,
      email TEXT,
      address TEXT,
      date_of_birth DATE,
      medical_notes TEXT,
      allergies TEXT,
      loyalty_points INTEGER DEFAULT 0,
      insurance_provider TEXT,
      insurance_number TEXT,
      total_purchases REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS prescriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER REFERENCES customers(id),
      doctor_name TEXT NOT NULL,
      doctor_license TEXT,
      hospital TEXT,
      prescription_date DATE NOT NULL,
      diagnosis TEXT,
      notes TEXT,
      image TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS prescription_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prescription_id INTEGER NOT NULL REFERENCES prescriptions(id),
      medicine_id INTEGER NOT NULL REFERENCES medicines(id),
      dosage TEXT,
      frequency TEXT,
      duration TEXT,
      quantity_prescribed INTEGER,
      quantity_dispensed INTEGER DEFAULT 0,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER REFERENCES customers(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      branch_id INTEGER REFERENCES branches(id),
      prescription_id INTEGER REFERENCES prescriptions(id),
      subtotal REAL NOT NULL DEFAULT 0,
      vat_amount REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      payment_method TEXT DEFAULT 'cash',
      amount_paid REAL DEFAULT 0,
      change_amount REAL DEFAULT 0,
      loyalty_points_earned INTEGER DEFAULT 0,
      loyalty_points_redeemed INTEGER DEFAULT 0,
      status TEXT DEFAULT 'completed',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id),
      medicine_id INTEGER NOT NULL REFERENCES medicines(id),
      batch_id INTEGER REFERENCES batches(id),
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      discount REAL DEFAULT 0,
      subtotal REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER REFERENCES sales(id),
      purchase_id INTEGER REFERENCES purchases(id),
      customer_id INTEGER REFERENCES customers(id),
      supplier_id INTEGER REFERENCES suppliers(id),
      amount REAL NOT NULL,
      method TEXT NOT NULL,
      reference TEXT,
      status TEXT DEFAULT 'completed',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS insurance_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      claim_percentage REAL DEFAULT 80,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS insurance_claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER REFERENCES sales(id),
      customer_id INTEGER REFERENCES customers(id),
      insurance_provider_id INTEGER REFERENCES insurance_providers(id),
      claim_amount REAL NOT NULL,
      approved_amount REAL,
      claim_number TEXT,
      status TEXT DEFAULT 'pending',
      submitted_date DATE,
      resolved_date DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stock_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_branch_id INTEGER NOT NULL REFERENCES branches(id),
      to_branch_id INTEGER NOT NULL REFERENCES branches(id),
      medicine_id INTEGER NOT NULL REFERENCES medicines(id),
      batch_id INTEGER REFERENCES batches(id),
      quantity INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      transferred_by INTEGER REFERENCES users(id),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inventory_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id INTEGER NOT NULL REFERENCES medicines(id),
      batch_id INTEGER REFERENCES batches(id),
      adjustment_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      reason TEXT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL,
      date DATE NOT NULL,
      user_id INTEGER REFERENCES users(id),
      branch_id INTEGER REFERENCES branches(id),
      receipt TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      priority TEXT DEFAULT 'normal',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      category TEXT DEFAULT 'general',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.save();
  console.log('Database schema initialized successfully');
}
