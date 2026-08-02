const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'billing.db');

let db = null;

async function getDb() {
  if (db) return db;
  
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  return db;
}

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// Helper methods to match better-sqlite3 style API
class DbWrapper {
  constructor() {
    this._db = null;
  }

  async init() {
    this._db = await getDb();
    return this;
  }

  exec(sql) {
    this._db.run(sql);
    saveDb();
  }

  prepare(sql) {
    return new Statement(this._db, sql);
  }

  close() {
    if (this._db) {
      saveDb();
      this._db.close();
      this._db = null;
      db = null;
    }
  }
}

class Statement {
  constructor(db, sql) {
    this._db = db;
    this._sql = sql;
  }

  run(...params) {
    this._db.run(this._sql, params);
    saveDb();
    return { lastInsertRowid: this._db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] || 0 };
  }

  get(...params) {
    const stmt = this._db.prepare(this._sql);
    stmt.bind(params);
    if (stmt.step()) {
      const cols = stmt.getColumnNames();
      const values = stmt.get();
      stmt.free();
      const row = {};
      cols.forEach((col, i) => row[col] = values[i]);
      return row;
    }
    stmt.free();
    return undefined;
  }

  all(...params) {
    const results = [];
    const stmt = this._db.prepare(this._sql);
    stmt.bind(params);
    while (stmt.step()) {
      const cols = stmt.getColumnNames();
      const values = stmt.get();
      const row = {};
      cols.forEach((col, i) => row[col] = values[i]);
      results.push(row);
    }
    stmt.free();
    return results;
  }
}

module.exports = { DbWrapper, saveDb };
