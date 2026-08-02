const { DbWrapper } = require('./db');

async function setup() {
  const db = new DbWrapper();
  await db.init();

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS property_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      rate_per_unit REAL NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      property_type_id INTEGER NOT NULL,
      address TEXT,
      monthly_rent REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (property_type_id) REFERENCES property_types(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      property_id INTEGER,
      move_in_date DATE,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (property_id) REFERENCES properties(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS meter_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      property_id INTEGER NOT NULL,
      reading_date DATE NOT NULL,
      month TEXT NOT NULL,
      year INTEGER NOT NULL,
      previous_reading REAL NOT NULL,
      current_reading REAL NOT NULL,
      units_consumed REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (property_id) REFERENCES properties(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS bills (
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
      paid_date DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (property_id) REFERENCES properties(id),
      FOREIGN KEY (meter_reading_id) REFERENCES meter_readings(id)
    )
  `);

  // Insert default property types
  const defaultTypes = [
    ['1 BHK', 8.0, '1 Bedroom Hall Kitchen'],
    ['2 BHK', 8.0, '2 Bedroom Hall Kitchen'],
    ['1 RK', 7.0, '1 Room Kitchen'],
    ['Asbestos House', 6.0, 'Asbestos roofed house'],
    ['Shop', 10.0, 'Market complex shop'],
  ];

  for (const [name, rate, desc] of defaultTypes) {
    try {
      db.prepare(
        'INSERT OR IGNORE INTO property_types (name, rate_per_unit, description) VALUES (?, ?, ?)'
      ).run(name, rate, desc);
    } catch (e) {
      // ignore duplicate
    }
  }

  console.log('Database setup complete!');
  console.log('Default property types created with rates:');
  defaultTypes.forEach(([name, rate]) => {
    console.log(`  ${name}: Rs.${rate}/unit`);
  });
}

setup().catch(console.error);
