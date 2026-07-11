import { Router } from 'express';
import db from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

const aiKnowledge = {
  'drug interaction': `Common Drug Interactions to be aware of:
- Warfarin + Aspirin: Increased bleeding risk
- Metformin + Alcohol: Risk of lactic acidosis
- Statins + Grapefruit: Increased drug levels
- ACE Inhibitors + Potassium: Risk of hyperkalemia
- SSRIs + Tramadol: Risk of serotonin syndrome
- Metronidazole + Alcohol: Disulfiram-like reaction
- Ciprofloxacin + Antacids: Reduced absorption
- Omepr唑ole + Clopidogrel: Reduced antiplatelet effect`,

  'dosage': `Standard Dosage Guidelines (Kenya):
- Paracetamol: 500mg-1g every 4-6 hours (max 4g/day)
- Amoxicillin: 500mg every 8 hours for 5-7 days
- Metformin: Start 500mg twice daily, max 2g/day
- Amlodipine: 5-10mg once daily
- Omeprazole: 20mg once daily before breakfast
- Ibuprofen: 200-400mg every 6-8 hours
- Azithromycin: 500mg day 1, then 250mg days 2-5
- Ciprofloxacin: 500mg every 12 hours`,

  'alternatives': `Common Medicine Alternatives in Kenya:
- Paracetamol ↔ Panadol ↔ Emzor Paracetamol
- Ibuprofen ↔ Brufen ↔ Advil
- Amoxicillin ↔ Amoxil ↔ Zamox
- Omeprazole ↔ Losec ↔ Omep
- Cetirizine ↔ Zyrtec ↔ Alerid
- Metformin ↔ Glucophage ↔ Glycomet
- Amlodipine ↔ Norvasc
- Losartan ↔ Cozaar
- Salbutamol ↔ Ventolin
- Fluconazole ↔ Diflucan`,

  'storage': `Medicine Storage Requirements:
- Most medicines: Store below 25°C in dry place
- Insulin: Refrigerate at 2-8°C before opening
- Eye drops: Store below 25°C, discard 28 days after opening
- Controlled substances: Locked cabinet, restricted access
- Light-sensitive medicines: Keep in original packaging
- Reconstituted antibiotics: Refrigerate and use within 7-14 days`,

  'expiry': `Expiry Management Best Practices:
- Use FEFO (First Expiry First Out) method
- Check expiry dates during every stock receipt
- Return expired medicines to supplier if possible
- Set 90-day expiry alerts for proactive management
- Document all expired medicines for audit trail
- PPB requires records of expired medicine disposal`,

  'insurance': `Insurance Claims Tips (Kenya):
- Most NHIF covers up to 80% of approved medicines
- Always verify patient insurance before dispensing
- Keep original prescriptions for claims
- Submit claims within 30 days
- Common approved providers: NHIF, Jubilee, AAR, Madison`
};

function generateAIResponse(query) {
  const q = query.toLowerCase();

  // Check for specific topics
  for (const [topic, info] of Object.entries(aiKnowledge)) {
    if (q.includes(topic)) return info;
  }

  // Search medicines for specific drug questions
  const medicines = db.prepare(`
    SELECT m.*, mc.name as category_name
    FROM medicines m LEFT JOIN medicine_categories mc ON m.category_id = mc.id
    WHERE m.is_active = 1 AND (
      LOWER(m.brand_name) LIKE ? OR LOWER(m.generic_name) LIKE ?
    ) LIMIT 5
  `).all(`%${q}%`, `%${q}%`);

  if (medicines.length > 0) {
    let response = `Found ${medicines.length} matching medicine(s):\n\n`;
    for (const med of medicines) {
      const stock = db.prepare("SELECT COALESCE(SUM(quantity), 0) as qty FROM batches WHERE medicine_id = ? AND status = 'active'").get(med.id);
      response += `**${med.brand_name}** (${med.generic_name})\n`;
      response += `  Strength: ${med.strength} | Form: ${med.dosage_form}\n`;
      response += `  Category: ${med.category_name}\n`;
      response += `  Current Stock: ${stock.qty} ${med.unit}(s)\n`;
      response += `  Price: KSh ${med.default_selling_price}\n`;
      response += `  Rx Required: ${med.prescription_required ? 'Yes' : 'No'}`;
      if (med.controlled_drug) response += ` | ⚠️ Controlled Drug`;
      response += '\n\n';
    }
    return response;
  }

  // General helpful responses
  if (q.includes('hello') || q.includes('hi') || q.includes('help')) {
    return `Welcome to Hauzral Pharmacy AI Assistant! I can help you with:

💊 **Drug Information** - Search any medicine by name
⚕️ **Drug Interactions** - Ask about drug interactions
💉 **Dosage Guidance** - Standard dosage information
🔄 **Alternatives** - Find alternative brands
📦 **Stock Check** - Check current inventory
📅 **Expiry Management** - Best practices for expiry tracking
🏥 **Insurance** - Claims and coverage information
📊 **Business Tips** - Pharmacy management advice

Just ask me anything about pharmacy operations!`;
  }

  if (q.includes('sales') || q.includes('business') || q.includes('report')) {
    return `Business Insights for Your Pharmacy:

📈 **Sales Tips:**
- Track daily, weekly, and monthly sales trends
- Monitor top-selling medicines for stocking decisions
- Keep an eye on slow-moving inventory

💰 **Profit Optimization:**
- Review margins on all categories regularly
- Negotiate better prices with suppliers for high-volume items
- Consider loyalty programs for repeat customers

📊 **Key Metrics to Watch:**
- Gross Profit Margin (should be 20-35%)
- Inventory Turnover Rate
- Customer Retention Rate
- Average Transaction Value

Use the Reports module to generate detailed analytics.`;
  }

  return `I searched for "${query}" but couldn't find specific information. Here are some things I can help with:

1. Search for a medicine by brand or generic name
2. Ask about drug interactions
3. Get dosage guidelines
4. Find medicine alternatives
5. Check storage requirements
6. Get expiry management tips
7. Learn about insurance claims

Please try rephrasing your question or ask about a specific medicine.`;
}

router.post('/chat', authenticateToken, (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const response = generateAIResponse(message);

    // Log AI interaction
    db.prepare('INSERT INTO audit_logs (user_id, action, entity, details) VALUES (?, ?, ?, ?)')
      .run(req.user.id, 'ai_chat', 'assistant', message);

    res.json({ response, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/drug-info/:name', authenticateToken, (req, res) => {
  try {
    const medicines = db.prepare(`
      SELECT m.*, mc.name as category_name
      FROM medicines m LEFT JOIN medicine_categories mc ON m.category_id = mc.id
      WHERE m.is_active = 1 AND (
        LOWER(m.brand_name) LIKE ? OR LOWER(m.generic_name) LIKE ?
      )
    `).all(`%${req.params.name.toLowerCase()}%`, `%${req.params.name.toLowerCase()}%`);

    if (medicines.length === 0) return res.status(404).json({ error: 'Medicine not found' });

    const enriched = medicines.map(med => {
      const stock = db.prepare("SELECT COALESCE(SUM(quantity), 0) as qty FROM batches WHERE medicine_id = ? AND status = 'active'").get(med.id);
      const batches = db.prepare("SELECT batch_number, quantity, expiry_date FROM batches WHERE medicine_id = ? AND status = 'active' ORDER BY expiry_date ASC").all(med.id);
      return { ...med, current_stock: stock.qty, batches };
    });

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/inventory-forecast', authenticateToken, (req, res) => {
  try {
    const forecast = db.prepare(`
      SELECT m.id, m.brand_name, m.generic_name, m.strength,
        COALESCE(SUM(b.quantity), 0) as current_stock,
        (SELECT COALESCE(SUM(si.quantity), 0) FROM sale_items si JOIN sales s ON si.sale_id = s.id
         WHERE si.medicine_id = m.id AND s.status = 'completed' AND s.created_at >= date('now', '-30 days')
        ) as monthly_usage,
        mc.name as category_name
      FROM medicines m
      LEFT JOIN batches b ON b.medicine_id = m.id AND b.status = 'active'
      LEFT JOIN medicine_categories mc ON m.category_id = mc.id
      WHERE m.is_active = 1 GROUP BY m.id
      HAVING current_stock > 0
      ORDER BY CASE WHEN monthly_usage > 0 THEN current_stock * 1.0 / monthly_usage ELSE 999 END ASC
      LIMIT 20
    `).all();

    const enriched = forecast.map(m => ({
      ...m,
      days_until_stockout: m.monthly_usage > 0 ? Math.round((m.current_stock / m.monthly_usage) * 30) : null,
      recommendation: m.monthly_usage > 0 && (m.current_stock / m.monthly_usage) < 1 ? 'Reorder urgently' :
        m.monthly_usage > 0 && (m.current_stock / m.monthly_usage) < 2 ? 'Reorder soon' : 'Stock adequate'
    }));

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
