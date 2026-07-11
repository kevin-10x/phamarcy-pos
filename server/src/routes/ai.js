import { first, all, json } from '../utils/d1.js';

let kenyanMedicinesCache = null;

async function loadKnowledgeBase() {
  if (kenyanMedicinesCache) return kenyanMedicinesCache;
  try {
    const mod = await import('../data/kenyan-medicines.js');
    kenyanMedicinesCache = mod.kenyanMedicines || [];
  } catch {
    kenyanMedicinesCache = [];
  }
  return kenyanMedicinesCache;
}

async function findMedicineInfo(name) {
  const medicines = await loadKnowledgeBase();
  const lowerName = name.toLowerCase();
  return medicines.filter(med =>
    med.name.toLowerCase().includes(lowerName) ||
    (med.generic_name && med.generic_name.toLowerCase().includes(lowerName)) ||
    (med.active_ingredient && med.active_ingredient.toLowerCase().includes(lowerName))
  );
}

function generateChatResponse(message) {
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes('stock') || lowerMsg.includes('inventory')) {
    return {
      response: 'For inventory management, I recommend:\n1. Conduct regular stock counts\n2. Use FEFO (First Expiry First Out)\n3. Set appropriate reorder points\n4. Monitor low stock alerts regularly',
      type: 'inventory',
    };
  }

  if (lowerMsg.includes('sale') || lowerMsg.includes('pos') || lowerMsg.includes('billing')) {
    return {
      response: 'For POS operations:\n1. Always verify prescriptions for Rx medicines\n2. Apply discounts only with manager approval\n3. Issue proper receipts\n4. Handle returns through the void process',
      type: 'sales',
    };
  }

  if (lowerMsg.includes('expiry') || lowerMsg.includes('expire')) {
    return {
      response: 'To minimize expiry losses:\n1. Follow FEFO strictly\n2. Check expiry alerts weekly\n3. Return near-expiry items to suppliers\n4. Consider promotions for slow-moving items',
      type: 'expiry',
    };
  }

  if (lowerMsg.includes('customer') || lowerMsg.includes('loyalty')) {
    return {
      response: 'Customer management tips:\n1. Register customers with their details\n2. Track loyalty points (1 point per KES 100 spent)\n3. Keep insurance information updated\n4. Follow up with patients on chronic medication',
      type: 'customers',
    };
  }

  if (lowerMsg.includes('regulation') || lowerMsg.includes('compliance') || lowerMsg.includes('ppb')) {
    return {
      response: 'Key regulatory requirements for Kenyan pharmacies:\n1. Valid PPB registration\n2. Licensed pharmacist on duty\n3. Proper record-keeping for controlled substances\n4. Regular inspections compliance\n5. Proper storage conditions',
      type: 'regulatory',
    };
  }

  if (lowerMsg.includes('drug') || lowerMsg.includes('medicine') || lowerMsg.includes('medication')) {
    return {
      response: 'For medicine inquiries, I can help with:\n1. Drug information and interactions\n2. Storage requirements\n3. Dosage guidelines\n4. Side effects and contraindications\n\nYou can also use the /drug-info endpoint to search for specific medicines.',
      type: 'drug_info',
    };
  }

  return {
    response: "I'm here to help with your pharmacy management. You can ask about:\n- Inventory management and stock control\n- Sales and POS operations\n- Drug information and interactions\n- Customer and loyalty management\n- Regulatory compliance\n- Expiry management\n- Financial reporting",
    type: 'general',
  };
}

export async function aiRoutes(request, env, path, db) {
  const parts = path.split('/').filter(Boolean);
  const method = request.method;
  const segment = parts[0] || '';

  if (method === 'POST' && segment === 'chat') {
    const body = await request.json().catch(() => ({}));
    const { message } = body;

    if (!message) {
      return json({ error: 'Message is required' }, 400);
    }

    const response = generateChatResponse(message);
    return json(response);
  }

  if (method === 'GET' && segment === 'drug-info') {
    const name = parts[1];
    if (!name) {
      return json({ error: 'Drug name is required' }, 400);
    }

    const decoded = decodeURIComponent(name);
    const matches = await findMedicineInfo(decoded);

    if (matches.length === 0) {
      const dbResults = await all(
        db,
        `SELECT * FROM medicines WHERE (brand_name LIKE ? OR generic_name LIKE ?) AND is_active = 1`,
        [`%${decoded}%`, `%${decoded}%`]
      );
      return json({ results: dbResults, source: 'database' });
    }

    return json({ results: matches, source: 'knowledge_base' });
  }

  if (method === 'GET' && segment === 'inventory-forecast') {
    const medicines = await all(
      db,
      `SELECT m.id, m.brand_name, m.default_selling_price,
              COALESCE(SUM(b.quantity), 0) as total_stock,
              (SELECT COUNT(*) FROM sales s JOIN sale_items si ON si.sale_id = s.id
               WHERE si.medicine_id = m.id AND s.status = 'completed'
               AND s.created_at >= date('now', '-30 days')) as days_of_sales,
              (SELECT COALESCE(SUM(si.quantity), 0) FROM sale_items si
               JOIN sales s ON s.id = si.sale_id
               WHERE si.medicine_id = m.id AND s.status = 'completed'
               AND s.created_at >= date('now', '-30 days')) as total_sold
       FROM medicines m
       LEFT JOIN batches b ON b.medicine_id = m.id AND b.quantity > 0
       WHERE m.is_active = 1
       GROUP BY m.id`
    );

    const forecasts = medicines.map(med => {
      const avgDaily = med.total_sold / Math.max(med.days_of_sales, 1);
      const daysUntilReorder = avgDaily > 0 ? Math.max(0, med.total_stock / avgDaily) : Infinity;

      let status = 'ok';
      let reorder_urgency = 'low';

      if (med.total_stock <= 0) {
        status = 'out_of_stock';
        reorder_urgency = 'critical';
      } else if (med.total_stock <= 10) {
        status = 'low_stock';
        reorder_urgency = 'high';
      } else if (med.total_stock <= 30) {
        status = 'reorder_soon';
        reorder_urgency = 'medium';
      }

      return {
        medicine_id: med.id,
        medicine_name: med.brand_name,
        current_stock: med.total_stock,
        avg_daily_sales: avgDaily.toFixed(2),
        days_until_reorder: daysUntilReorder === Infinity ? 'N/A' : Math.round(daysUntilReorder),
        status,
        reorder_urgency,
        suggested_order: Math.max(0, Math.ceil(avgDaily * 30 - med.total_stock)),
      };
    });

    return json({ forecasts, generated_at: new Date().toISOString() });
  }

  return json({ error: 'Not found' }, 404);
}
