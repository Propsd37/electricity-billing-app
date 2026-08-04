const express = require('express');
const cors = require('cors');
const path = require('path');
const { DbWrapper } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

async function startServer() {
  // Initialize database
  const db = new DbWrapper();
  await db.init();

  // Run setup inline (create tables if not exist)
  db.exec(`CREATE TABLE IF NOT EXISTS property_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    rate_per_unit REAL NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    property_type_id INTEGER NOT NULL,
    group_id INTEGER,
    address TEXT,
    monthly_rent REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS property_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    property_id INTEGER,
    move_in_date DATE,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS meter_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    property_id INTEGER NOT NULL,
    reading_date DATE NOT NULL,
    month TEXT NOT NULL,
    year INTEGER NOT NULL,
    previous_reading REAL NOT NULL,
    current_reading REAL NOT NULL,
    units_consumed REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    property_id INTEGER NOT NULL,
    meter_reading_id INTEGER,
    month TEXT NOT NULL,
    year INTEGER NOT NULL,
    rent_amount REAL DEFAULT 0,
    electricity_units REAL DEFAULT 0,
    rate_per_unit REAL DEFAULT 0,
    electricity_amount REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    is_paid INTEGER DEFAULT 0,
    rent_paid INTEGER DEFAULT 0,
    electricity_paid INTEGER DEFAULT 0,
    paid_date DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Add columns if they don't exist (for existing databases)
  try { db.exec('ALTER TABLE bills ADD COLUMN rent_paid INTEGER DEFAULT 0'); } catch(e) {}
  try { db.exec('ALTER TABLE bills ADD COLUMN electricity_paid INTEGER DEFAULT 0'); } catch(e) {};

  // Seed default property types
  const defaults = [
    ['1 BHK', 5.0, '1 Bedroom Hall Kitchen'],
    ['2 BHK', 5.0, '2 Bedroom Hall Kitchen'],
    ['1 RK', 5.0, '1 Room Kitchen'],
    ['Asbestos House', 3.0, 'Asbestos roofed house'],
    ['Shop', 8.0, 'Market complex - Single shop'],
    ['Joint Shop', 8.0, 'Market complex - Joint shop (1st floor)'],
  ];
  for (const [name, rate, desc] of defaults) {
    try {
      db.prepare('INSERT OR IGNORE INTO property_types (name, rate_per_unit, description) VALUES (?, ?, ?)').run(name, rate, desc);
    } catch (e) { /* ignore duplicates */ }
  }

  // Seed all properties (run only if no properties exist yet)
  const propCount = db.prepare('SELECT COUNT(*) as count FROM properties').get();
  if (propCount.count === 0) {
    const types = db.prepare('SELECT * FROM property_types').all();
    const typeMap = {};
    types.forEach(t => { typeMap[t.name] = t.id; });

    // Create property groups
    const groups = [
      ['Karuna Bhavana RCC', 'RCC building - 2BHK, 1RK, 1BHK units'],
      ['Karuna Bhavana Asbestos', 'Asbestos roofed houses'],
      ['RJ Market Complex', 'Market complex - Shops (GF & 1st Floor)'],
    ];
    for (const [name, desc] of groups) {
      db.prepare('INSERT OR IGNORE INTO property_groups (name, description) VALUES (?, ?)').run(name, desc);
    }
    const grpList = db.prepare('SELECT * FROM property_groups').all();
    const grpMap = {};
    grpList.forEach(g => { grpMap[g.name] = g.id; });

    const allProperties = [
      // Karuna Bhavana RCC
      ['2 BHK - Unit 1', typeMap['2 BHK'], grpMap['Karuna Bhavana RCC'], 0],
      ['2 BHK - Unit 2', typeMap['2 BHK'], grpMap['Karuna Bhavana RCC'], 0],
      ['2 BHK - Unit 3', typeMap['2 BHK'], grpMap['Karuna Bhavana RCC'], 0],
      ['1 RK - Unit 1', typeMap['1 RK'], grpMap['Karuna Bhavana RCC'], 0],
      ['1 BHK - Unit 1', typeMap['1 BHK'], grpMap['Karuna Bhavana RCC'], 0],
      ['1 BHK - Unit 2', typeMap['1 BHK'], grpMap['Karuna Bhavana RCC'], 0],
      ['1 BHK - Unit 3', typeMap['1 BHK'], grpMap['Karuna Bhavana RCC'], 0],
      ['1 BHK - Unit 4', typeMap['1 BHK'], grpMap['Karuna Bhavana RCC'], 0],
      // Karuna Bhavana Asbestos
      ['Asbestos - Unit 1', typeMap['Asbestos House'], grpMap['Karuna Bhavana Asbestos'], 0],
      ['Asbestos - Unit 2', typeMap['Asbestos House'], grpMap['Karuna Bhavana Asbestos'], 0],
      ['Asbestos - Unit 3', typeMap['Asbestos House'], grpMap['Karuna Bhavana Asbestos'], 0],
      ['Asbestos - Unit 4', typeMap['Asbestos House'], grpMap['Karuna Bhavana Asbestos'], 0],
      ['Asbestos - Unit 5', typeMap['Asbestos House'], grpMap['Karuna Bhavana Asbestos'], 0],
      // RJ Market Complex
      ['Shop 1 (GF)', typeMap['Shop'], grpMap['RJ Market Complex'], 0],
      ['Shop 2 (GF)', typeMap['Shop'], grpMap['RJ Market Complex'], 0],
      ['Shop 3 (GF)', typeMap['Shop'], grpMap['RJ Market Complex'], 0],
      ['Shop 4 (GF)', typeMap['Shop'], grpMap['RJ Market Complex'], 0],
      ['Shop 5 (GF)', typeMap['Shop'], grpMap['RJ Market Complex'], 0],
      ['Shop 6 (GF)', typeMap['Shop'], grpMap['RJ Market Complex'], 0],
      ['Shop 7 (GF)', typeMap['Shop'], grpMap['RJ Market Complex'], 0],
      ['Shop 8 (GF)', typeMap['Shop'], grpMap['RJ Market Complex'], 0],
      ['Joint Shop 1 (1st Floor)', typeMap['Joint Shop'], grpMap['RJ Market Complex'], 0],
      ['Joint Shop 2 (1st Floor)', typeMap['Joint Shop'], grpMap['RJ Market Complex'], 0],
    ];

    for (const [name, typeId, groupId, rent] of allProperties) {
      db.prepare('INSERT INTO properties (name, property_type_id, group_id, monthly_rent) VALUES (?, ?, ?, ?)').run(name, typeId, groupId, rent);
    }
    console.log('  3 groups and 23 properties seeded successfully!');
  }

  // Make db available to routes
  app.locals.db = db;

  // --- ROUTES ---

  // Property Types
  app.get('/api/property-types', (req, res) => {
    const types = db.prepare('SELECT * FROM property_types ORDER BY name').all();
    res.json(types);
  });

  app.post('/api/property-types', (req, res) => {
    const { name, rate_per_unit, description } = req.body;
    try {
      const result = db.prepare('INSERT INTO property_types (name, rate_per_unit, description) VALUES (?, ?, ?)').run(name, rate_per_unit, description || '');
      res.json({ id: result.lastInsertRowid, name, rate_per_unit, description });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/property-types/:id', (req, res) => {
    const { name, rate_per_unit, description } = req.body;
    try {
      db.prepare('UPDATE property_types SET name = ?, rate_per_unit = ?, description = ? WHERE id = ?').run(name, rate_per_unit, description || '', parseInt(req.params.id));
      res.json({ id: req.params.id, name, rate_per_unit, description });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Properties
  app.get('/api/properties', (req, res) => {
    const properties = db.prepare(`
      SELECT p.*, pt.name as type_name, pt.rate_per_unit,
             pg.name as group_name, pg.id as group_id,
             t.name as tenant_name, t.id as tenant_id
      FROM properties p
      JOIN property_types pt ON p.property_type_id = pt.id
      LEFT JOIN property_groups pg ON p.group_id = pg.id
      LEFT JOIN tenants t ON t.property_id = p.id AND t.is_active = 1
      ORDER BY pg.name, pt.name, p.name
    `).all();
    res.json(properties);
  });

  // Property Groups
  app.get('/api/property-groups', (req, res) => {
    const groups = db.prepare(`
      SELECT pg.*, COUNT(p.id) as property_count
      FROM property_groups pg
      LEFT JOIN properties p ON p.group_id = pg.id
      GROUP BY pg.id
      ORDER BY pg.name
    `).all();
    res.json(groups);
  });

  app.post('/api/property-groups', (req, res) => {
    const { name, description } = req.body;
    try {
      const result = db.prepare('INSERT INTO property_groups (name, description) VALUES (?, ?)').run(name, description || '');
      res.json({ id: result.lastInsertRowid, name, description });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/property-groups/:id', (req, res) => {
    try {
      // Unassign properties from this group
      db.prepare('UPDATE properties SET group_id = NULL WHERE group_id = ?').run(parseInt(req.params.id));
      db.prepare('DELETE FROM property_groups WHERE id = ?').run(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/properties', (req, res) => {
    const { name, property_type_id, address, monthly_rent, group_id } = req.body;
    try {
      const result = db.prepare('INSERT INTO properties (name, property_type_id, group_id, address, monthly_rent) VALUES (?, ?, ?, ?, ?)').run(name, parseInt(property_type_id), group_id ? parseInt(group_id) : null, address || '', monthly_rent || 0);
      res.json({ id: result.lastInsertRowid, ...req.body });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/properties/:id', (req, res) => {
    const { name, property_type_id, address, monthly_rent, group_id } = req.body;
    try {
      if (group_id !== undefined) {
        db.prepare('UPDATE properties SET name = ?, property_type_id = ?, address = ?, monthly_rent = ?, group_id = ? WHERE id = ?').run(name, parseInt(property_type_id), address || '', monthly_rent || 0, parseInt(group_id), parseInt(req.params.id));
      } else {
        db.prepare('UPDATE properties SET name = ?, property_type_id = ?, address = ?, monthly_rent = ? WHERE id = ?').run(name, parseInt(property_type_id), address || '', monthly_rent || 0, parseInt(req.params.id));
      }
      res.json({ id: req.params.id, ...req.body });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/properties/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM properties WHERE id = ?').run(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Tenants
  app.get('/api/tenants', (req, res) => {
    const tenants = db.prepare(`
      SELECT t.*, p.name as property_name, pt.name as property_type,
             p.monthly_rent, pt.rate_per_unit
      FROM tenants t
      LEFT JOIN properties p ON t.property_id = p.id
      LEFT JOIN property_types pt ON p.property_type_id = pt.id
      ORDER BY t.is_active DESC, t.name
    `).all();
    res.json(tenants);
  });

  app.get('/api/tenants/active', (req, res) => {
    const tenants = db.prepare(`
      SELECT t.*, p.name as property_name, pt.name as property_type,
             p.monthly_rent, pt.rate_per_unit
      FROM tenants t
      LEFT JOIN properties p ON t.property_id = p.id
      LEFT JOIN property_types pt ON p.property_type_id = pt.id
      WHERE t.is_active = 1
      ORDER BY t.name
    `).all();
    res.json(tenants);
  });

  app.post('/api/tenants', (req, res) => {
    const { name, phone, property_id, move_in_date } = req.body;
    try {
      const result = db.prepare('INSERT INTO tenants (name, phone, property_id, move_in_date) VALUES (?, ?, ?, ?)').run(name, phone || '', parseInt(property_id), move_in_date || null);
      res.json({ id: result.lastInsertRowid, ...req.body });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/tenants/:id', (req, res) => {
    const { name, phone, property_id, move_in_date, is_active } = req.body;
    try {
      db.prepare('UPDATE tenants SET name = ?, phone = ?, property_id = ?, move_in_date = ?, is_active = ? WHERE id = ?').run(name, phone || '', parseInt(property_id), move_in_date || null, is_active !== undefined ? is_active : 1, parseInt(req.params.id));
      res.json({ id: req.params.id, ...req.body });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/tenants/:id', (req, res) => {
    try {
      db.prepare('UPDATE tenants SET is_active = 0 WHERE id = ?').run(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Meter Readings
  app.get('/api/meter-readings', (req, res) => {
    const { month, year, tenant_id } = req.query;
    let query = `
      SELECT mr.*, t.name as tenant_name, p.name as property_name,
             pt.name as property_type, pt.rate_per_unit
      FROM meter_readings mr
      JOIN tenants t ON mr.tenant_id = t.id
      JOIN properties p ON mr.property_id = p.id
      JOIN property_types pt ON p.property_type_id = pt.id
      WHERE 1=1
    `;
    const params = [];
    if (month && year) {
      query += ' AND mr.month = ? AND mr.year = ?';
      params.push(month, parseInt(year));
    }
    if (tenant_id) {
      query += ' AND mr.tenant_id = ?';
      params.push(parseInt(tenant_id));
    }
    query += ' ORDER BY mr.year DESC, mr.id DESC';
    const readings = db.prepare(query).all(...params);
    res.json(readings);
  });

  // Save only the previous reading (stored separately, not in meter_readings)
  app.post('/api/meter-readings/save-previous', (req, res) => {
    const { tenant_id, property_id, previous_reading } = req.body;
    try {
      // Store in a simple key-value style: update or insert into a last_readings table
      db.exec(`CREATE TABLE IF NOT EXISTS last_readings (
        tenant_id INTEGER PRIMARY KEY,
        previous_reading REAL NOT NULL
      )`);
      const existing = db.prepare('SELECT tenant_id FROM last_readings WHERE tenant_id = ?').get(parseInt(tenant_id));
      if (existing) {
        db.prepare('UPDATE last_readings SET previous_reading = ? WHERE tenant_id = ?').run(previous_reading, parseInt(tenant_id));
      } else {
        db.prepare('INSERT INTO last_readings (tenant_id, previous_reading) VALUES (?, ?)').run(parseInt(tenant_id), previous_reading);
      }
      res.json({ success: true, previous_reading });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Get saved previous reading for a tenant
  app.get('/api/meter-readings/last/:tenantId', (req, res) => {
    db.exec(`CREATE TABLE IF NOT EXISTS last_readings (tenant_id INTEGER PRIMARY KEY, previous_reading REAL NOT NULL)`);
    // First check last_readings table
    const saved = db.prepare('SELECT previous_reading FROM last_readings WHERE tenant_id = ?').get(parseInt(req.params.tenantId));
    if (saved) {
      res.json({ current_reading: saved.previous_reading });
      return;
    }
    // Fallback: check actual meter_readings for last current_reading
    const reading = db.prepare(`
      SELECT current_reading FROM meter_readings WHERE tenant_id = ? AND units_consumed > 0 ORDER BY year DESC, id DESC LIMIT 1
    `).get(parseInt(req.params.tenantId));
    res.json(reading || { current_reading: 0 });
  });

  app.post('/api/meter-readings', (req, res) => {
    const { tenant_id, property_id, reading_date, month, year, previous_reading, current_reading, existing_bill_id } = req.body;
    try {
      const unitsConsumed = current_reading - previous_reading;

      const result = db.prepare(`
        INSERT INTO meter_readings (tenant_id, property_id, reading_date, month, year, previous_reading, current_reading, units_consumed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(parseInt(tenant_id), parseInt(property_id), reading_date, month, parseInt(year), previous_reading, current_reading, unitsConsumed);

      const readingId = result.lastInsertRowid;

      // Get rate for this property
      const property = db.prepare(`
        SELECT p.monthly_rent, pt.rate_per_unit 
        FROM properties p 
        JOIN property_types pt ON p.property_type_id = pt.id 
        WHERE p.id = ?
      `).get(parseInt(property_id));

      const electricityAmount = unitsConsumed * property.rate_per_unit;
      const totalAmount = property.monthly_rent + electricityAmount;

      // Check if a bill already exists for this month (auto-generated rent bill)
      const existingBill = db.prepare('SELECT id FROM bills WHERE tenant_id = ? AND month = ? AND year = ?').get(parseInt(tenant_id), month, parseInt(year));

      if (existingBill) {
        // Update existing bill with electricity data
        db.prepare(`
          UPDATE bills SET meter_reading_id = ?, electricity_units = ?, rate_per_unit = ?, electricity_amount = ?, total_amount = rent_amount + ?
          WHERE id = ?
        `).run(readingId, unitsConsumed, property.rate_per_unit, electricityAmount, electricityAmount, existingBill.id);
      } else {
        // Create new full bill
        db.prepare(`
          INSERT INTO bills (tenant_id, property_id, meter_reading_id, month, year, rent_amount, electricity_units, rate_per_unit, electricity_amount, total_amount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(parseInt(tenant_id), parseInt(property_id), readingId, month, parseInt(year), property.monthly_rent, unitsConsumed, property.rate_per_unit, electricityAmount, totalAmount);
      }

      // Update last_readings with current reading (for next month's previous)
      const existingLast = db.prepare('SELECT tenant_id FROM last_readings WHERE tenant_id = ?').get(parseInt(tenant_id));
      if (existingLast) {
        db.prepare('UPDATE last_readings SET previous_reading = ? WHERE tenant_id = ?').run(current_reading, parseInt(tenant_id));
      } else {
        db.prepare('INSERT INTO last_readings (tenant_id, previous_reading) VALUES (?, ?)').run(parseInt(tenant_id), current_reading);
      }

      res.json({
        reading_id: readingId,
        units_consumed: unitsConsumed,
        rate_per_unit: property.rate_per_unit,
        electricity_amount: electricityAmount,
        rent_amount: property.monthly_rent,
        total_amount: totalAmount
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Update meter reading by bill ID
  app.put('/api/meter-readings/update-by-bill/:billId', (req, res) => {
    const { previous_reading, current_reading } = req.body;
    const billId = parseInt(req.params.billId);
    try {
      const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId);
      if (!bill) { res.status(404).json({ error: 'Bill not found' }); return; }

      const unitsConsumed = current_reading - previous_reading;
      const property = db.prepare(`
        SELECT p.monthly_rent, pt.rate_per_unit FROM properties p
        JOIN property_types pt ON p.property_type_id = pt.id WHERE p.id = ?
      `).get(bill.property_id);

      const electricityAmount = unitsConsumed * property.rate_per_unit;
      const totalAmount = bill.rent_amount + electricityAmount;

      if (bill.meter_reading_id && bill.meter_reading_id > 0) {
        // Update existing meter reading
        db.prepare('UPDATE meter_readings SET previous_reading = ?, current_reading = ?, units_consumed = ? WHERE id = ?')
          .run(previous_reading, current_reading, unitsConsumed, bill.meter_reading_id);
      } else {
        // Create new meter reading and link to bill
        const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const result = db.prepare(`
          INSERT INTO meter_readings (tenant_id, property_id, reading_date, month, year, previous_reading, current_reading, units_consumed)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(bill.tenant_id, bill.property_id, new Date().toISOString().split('T')[0], bill.month, bill.year, previous_reading, current_reading, unitsConsumed);
        db.prepare('UPDATE bills SET meter_reading_id = ? WHERE id = ?').run(result.lastInsertRowid, billId);
      }

      // Update bill amounts
      db.prepare('UPDATE bills SET electricity_units = ?, rate_per_unit = ?, electricity_amount = ?, total_amount = ? WHERE id = ?')
        .run(unitsConsumed, property.rate_per_unit, electricityAmount, totalAmount, billId);

      res.json({ success: true, units: unitsConsumed, electricity_amount: electricityAmount, total_amount: totalAmount });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/meter-readings/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM bills WHERE meter_reading_id = ?').run(parseInt(req.params.id));
      db.prepare('DELETE FROM meter_readings WHERE id = ?').run(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Bills
  app.get('/api/bills', (req, res) => {
    const { month, year, is_paid, tenant_id } = req.query;
    let query = `
      SELECT b.*, t.name as tenant_name, t.phone as tenant_phone,
             p.name as property_name, pt.name as property_type,
             COALESCE(mr.previous_reading, mr2.previous_reading) as prev_reading,
             COALESCE(mr.current_reading, mr2.current_reading) as curr_reading,
             COALESCE(mr.reading_date, mr2.reading_date) as reading_date
      FROM bills b
      JOIN tenants t ON b.tenant_id = t.id
      JOIN properties p ON b.property_id = p.id
      JOIN property_types pt ON p.property_type_id = pt.id
      LEFT JOIN meter_readings mr ON mr.id = b.meter_reading_id AND b.meter_reading_id > 0
      LEFT JOIN meter_readings mr2 ON mr2.tenant_id = b.tenant_id AND mr2.month = b.month AND mr2.year = b.year AND (b.meter_reading_id IS NULL OR b.meter_reading_id = 0)
      WHERE 1=1
    `;
    const params = [];
    if (month && year) {
      query += ' AND b.month = ? AND b.year = ?';
      params.push(month, parseInt(year));
    }
    if (is_paid !== undefined && is_paid !== '') {
      query += ' AND b.is_paid = ?';
      params.push(parseInt(is_paid));
    }
    if (tenant_id) {
      query += ' AND b.tenant_id = ?';
      params.push(parseInt(tenant_id));
    }
    query += ' ORDER BY b.year DESC, b.month DESC, t.name';
    const bills = db.prepare(query).all(...params);
    res.json(bills);
  });

  app.put('/api/bills/:id/pay', (req, res) => {
    const { paid_date } = req.body;
    try {
      db.prepare('UPDATE bills SET is_paid = 1, rent_paid = 1, electricity_paid = 1, paid_date = ? WHERE id = ?').run(paid_date || new Date().toISOString().split('T')[0], parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/bills/:id/unpay', (req, res) => {
    try {
      db.prepare('UPDATE bills SET is_paid = 0, rent_paid = 0, electricity_paid = 0, paid_date = NULL WHERE id = ?').run(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Mark only rent as paid
  app.put('/api/bills/:id/pay-rent', (req, res) => {
    try {
      db.prepare('UPDATE bills SET rent_paid = 1 WHERE id = ?').run(parseInt(req.params.id));
      // If both are paid, mark whole bill as paid
      const bill = db.prepare('SELECT rent_paid, electricity_paid FROM bills WHERE id = ?').get(parseInt(req.params.id));
      if (bill.rent_paid && bill.electricity_paid) {
        db.prepare('UPDATE bills SET is_paid = 1, paid_date = ? WHERE id = ?').run(new Date().toISOString().split('T')[0], parseInt(req.params.id));
      }
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Mark only electricity as paid
  app.put('/api/bills/:id/pay-electricity', (req, res) => {
    try {
      db.prepare('UPDATE bills SET electricity_paid = 1 WHERE id = ?').run(parseInt(req.params.id));
      // If both are paid, mark whole bill as paid
      const bill = db.prepare('SELECT rent_paid, electricity_paid FROM bills WHERE id = ?').get(parseInt(req.params.id));
      if (bill.rent_paid && bill.electricity_paid) {
        db.prepare('UPDATE bills SET is_paid = 1, paid_date = ? WHERE id = ?').run(new Date().toISOString().split('T')[0], parseInt(req.params.id));
      }
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/bills/:id', (req, res) => {
    try {
      const bill = db.prepare('SELECT meter_reading_id FROM bills WHERE id = ?').get(parseInt(req.params.id));
      if (bill && bill.meter_reading_id) {
        db.prepare('DELETE FROM meter_readings WHERE id = ?').run(bill.meter_reading_id);
      }
      db.prepare('DELETE FROM bills WHERE id = ?').run(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Auto-generate monthly rent bills
  app.post('/api/generate-monthly-bills', (req, res) => {
    const { month, year } = req.body;
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const m = month || months[new Date().getMonth()];
    const y = year || new Date().getFullYear();

    // Get all active tenants with property info
    const tenants = db.prepare(`
      SELECT t.id as tenant_id, t.name, p.id as property_id, p.monthly_rent, pt.rate_per_unit
      FROM tenants t
      JOIN properties p ON t.property_id = p.id
      JOIN property_types pt ON p.property_type_id = pt.id
      WHERE t.is_active = 1
    `).all();

    let created = 0;
    for (const t of tenants) {
      // Check if bill already exists for this tenant/month
      const existing = db.prepare('SELECT id FROM bills WHERE tenant_id = ? AND month = ? AND year = ?').get(t.tenant_id, m, y);
      if (!existing) {
        // Create rent-only bill (electricity will be added later with meter reading)
        db.prepare(`
          INSERT INTO bills (tenant_id, property_id, month, year, rent_amount, electricity_units, rate_per_unit, electricity_amount, total_amount)
          VALUES (?, ?, ?, ?, ?, 0, ?, 0, ?)
        `).run(t.tenant_id, t.property_id, m, y, t.monthly_rent, t.rate_per_unit, t.monthly_rent);
        created++;
      }
    }
    res.json({ success: true, bills_created: created, month: m, year: y });
  });

  // Auto-generate bills on dashboard load if not yet done for current month
  function autoGenerateMonthlyBills() {
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const m = months[new Date().getMonth()];
    const y = new Date().getFullYear();

    const tenants = db.prepare(`
      SELECT t.id as tenant_id, p.id as property_id, p.monthly_rent, pt.rate_per_unit
      FROM tenants t
      JOIN properties p ON t.property_id = p.id
      JOIN property_types pt ON p.property_type_id = pt.id
      WHERE t.is_active = 1
    `).all();

    let created = 0;
    for (const t of tenants) {
      const existing = db.prepare('SELECT id FROM bills WHERE tenant_id = ? AND month = ? AND year = ?').get(t.tenant_id, m, y);
      if (!existing && t.monthly_rent > 0) {
        db.prepare(`
          INSERT INTO bills (tenant_id, property_id, month, year, rent_amount, electricity_units, rate_per_unit, electricity_amount, total_amount)
          VALUES (?, ?, ?, ?, ?, 0, ?, 0, ?)
        `).run(t.tenant_id, t.property_id, m, y, t.monthly_rent, t.rate_per_unit, t.monthly_rent);
        created++;
      }
    }
    if (created > 0) console.log(`  Auto-generated ${created} rent bills for ${m} ${y}`);
  }

  // Migrate: move "save previous only" entries from meter_readings to last_readings
  db.exec(`CREATE TABLE IF NOT EXISTS last_readings (tenant_id INTEGER PRIMARY KEY, previous_reading REAL NOT NULL)`);
  const dummyReadings = db.prepare('SELECT tenant_id, previous_reading FROM meter_readings WHERE units_consumed = 0').all();
  for (const r of dummyReadings) {
    const existing = db.prepare('SELECT tenant_id FROM last_readings WHERE tenant_id = ?').get(r.tenant_id);
    if (!existing) {
      db.prepare('INSERT INTO last_readings (tenant_id, previous_reading) VALUES (?, ?)').run(r.tenant_id, r.previous_reading);
    }
  }
  // Remove dummy readings (units_consumed = 0) from meter_readings
  db.prepare('DELETE FROM meter_readings WHERE units_consumed = 0').run();
  if (dummyReadings.length > 0) console.log(`  Migrated ${dummyReadings.length} previous readings to last_readings table`);

  // Run auto-generation on startup
  autoGenerateMonthlyBills();

  // Dashboard
  app.get('/api/dashboard', (req, res) => {
    const { month, year } = req.query;
    const currentDate = new Date();
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const m = month || months[currentDate.getMonth()];
    const y = year ? parseInt(year) : currentDate.getFullYear();

    const totalTenants = db.prepare('SELECT COUNT(*) as count FROM tenants WHERE is_active = 1').get();
    const totalProperties = db.prepare('SELECT COUNT(*) as count FROM properties').get();

    const monthlySummary = db.prepare(`
      SELECT 
        COUNT(*) as total_bills,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN is_paid = 1 THEN total_amount ELSE 0 END), 0) as collected,
        COALESCE(SUM(CASE WHEN is_paid = 0 THEN total_amount ELSE 0 END), 0) as pending,
        COALESCE(SUM(CASE WHEN is_paid = 1 THEN 1 ELSE 0 END), 0) as paid_count,
        COALESCE(SUM(CASE WHEN is_paid = 0 THEN 1 ELSE 0 END), 0) as unpaid_count,
        COALESCE(SUM(rent_amount), 0) as total_rent,
        COALESCE(SUM(electricity_amount), 0) as total_electricity
      FROM bills b
      JOIN tenants t ON b.tenant_id = t.id AND t.is_active = 1
      WHERE b.month = ? AND b.year = ?
    `).get(m, y);

    const pendingBills = db.prepare(`
      SELECT b.*, t.name as tenant_name, t.phone as tenant_phone,
             p.name as property_name, pt.name as property_type
      FROM bills b
      JOIN tenants t ON b.tenant_id = t.id
      JOIN properties p ON b.property_id = p.id
      JOIN property_types pt ON p.property_type_id = pt.id
      WHERE b.is_paid = 0 AND b.month = ? AND b.year = ?
      ORDER BY b.total_amount DESC
    `).all(m, y);

    // Tenant profiles with their property and current month bill status
    const tenantProfiles = db.prepare(`
      SELECT t.id, t.name, t.phone, t.move_in_date,
             p.name as property_name, p.monthly_rent,
             pt.name as property_type, pt.rate_per_unit,
             pg.name as group_name, pg.id as group_id,
             b.total_amount as current_bill,
             b.electricity_units, b.electricity_amount,
             b.is_paid as bill_paid
      FROM tenants t
      LEFT JOIN properties p ON t.property_id = p.id
      LEFT JOIN property_types pt ON p.property_type_id = pt.id
      LEFT JOIN property_groups pg ON p.group_id = pg.id
      LEFT JOIN bills b ON b.tenant_id = t.id AND b.month = ? AND b.year = ?
      WHERE t.is_active = 1
      ORDER BY pg.name, pt.name, p.name
    `).all(m, y);

    // All properties with tenant + bill info (for property cards on dashboard)
    const propertyCards = db.prepare(`
      SELECT p.id as property_id, p.name as property_name, p.monthly_rent, p.group_id,
             pt.name as property_type, pt.rate_per_unit,
             pg.name as group_name,
             t.id as tenant_id, t.name as tenant_name, t.phone as tenant_phone,
             b.id as bill_id, b.total_amount as current_bill,
             b.electricity_units, b.electricity_amount, b.rent_amount,
             b.is_paid as bill_paid, b.rent_paid, b.electricity_paid,
             mr.previous_reading as prev_reading, mr.current_reading as curr_reading,
             mr.reading_date as reading_date
      FROM properties p
      JOIN property_types pt ON p.property_type_id = pt.id
      LEFT JOIN property_groups pg ON p.group_id = pg.id
      LEFT JOIN tenants t ON t.property_id = p.id AND t.is_active = 1
      LEFT JOIN bills b ON b.tenant_id = t.id AND b.month = ? AND b.year = ?
      LEFT JOIN meter_readings mr ON mr.id = b.meter_reading_id
      ORDER BY pg.name, pt.name, p.name
    `).all(m, y);

    // For properties without electricity reading, get previous reading from last_readings
    db.exec(`CREATE TABLE IF NOT EXISTS last_readings (tenant_id INTEGER PRIMARY KEY, previous_reading REAL NOT NULL)`);
    for (const card of propertyCards) {
      if (card.tenant_id && (!card.prev_reading || card.prev_reading === 0)) {
        const saved = db.prepare('SELECT previous_reading FROM last_readings WHERE tenant_id = ?').get(card.tenant_id);
        if (saved) {
          card.prev_reading = saved.previous_reading;
        }
      }
    }

    res.json({
      month: m,
      year: y,
      total_tenants: totalTenants.count,
      total_properties: totalProperties.count,
      summary: monthlySummary,
      pending_bills: pendingBills,
      tenant_profiles: tenantProfiles,
      property_cards: propertyCards
    });
  });

  // Reset routes
  app.post('/api/reset/bills', (req, res) => {
    const billCount = db.prepare('SELECT COUNT(*) as c FROM bills').get();
    const readingCount = db.prepare('SELECT COUNT(*) as c FROM meter_readings').get();
    db.exec('DELETE FROM bills');
    db.exec('DELETE FROM meter_readings');
    res.json({ success: true, deleted_bills: billCount.c, deleted_readings: readingCount.c });
  });

  app.post('/api/reset/all', (req, res) => {
    db.exec('DELETE FROM bills');
    db.exec('DELETE FROM meter_readings');
    db.exec('DELETE FROM tenants');
    res.json({ success: true });
  });

  // Serve frontend
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  Electricity Billing App running at http://localhost:${PORT}`);
    console.log(`  Dashboard: http://localhost:${PORT}`);
    console.log(`\n  Press Ctrl+C to stop.\n`);
  });
}

startServer().catch(console.error);
