const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'licenses.db');
let db;

function getDatabase() {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDatabase() {
  const database = getDatabase();
  
  database.exec(`
    CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_key TEXT UNIQUE NOT NULL,
      license_type TEXT NOT NULL CHECK(license_type IN ('personal', 'teacher')),
      status TEXT DEFAULT 'unused' CHECK(status IN ('unused', 'activated', 'revoked')),
      activated_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT
    );
    
    CREATE TABLE IF NOT EXISTS license_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_key TEXT NOT NULL,
      device_id TEXT NOT NULL,
      activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(license_key, device_id),
      FOREIGN KEY(license_key) REFERENCES licenses(license_key) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS license_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT UNIQUE NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'processing',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS license_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      license_key TEXT NOT NULL,
      license_type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(order_id, license_key),
      FOREIGN KEY(order_id) REFERENCES license_orders(order_id) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_license_key ON licenses(license_key);
    CREATE INDEX IF NOT EXISTS idx_license_status ON licenses(status);
    CREATE INDEX IF NOT EXISTS idx_license_devices_key ON license_devices(license_key);
    CREATE INDEX IF NOT EXISTS idx_license_orders_order_id ON license_orders(order_id);
    CREATE INDEX IF NOT EXISTS idx_license_order_items_order_id ON license_order_items(order_id);
  `);
  
  console.log('数据库初始化完成');
}

module.exports = { getDatabase, initDatabase };
