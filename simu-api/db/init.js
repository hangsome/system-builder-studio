const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'licenses.db');
let db;

function getDatabase() {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma(`busy_timeout = ${Number(process.env.SQLITE_BUSY_TIMEOUT_MS || 5000)}`);
  }
  return db;
}

function initLicenseTables(database) {
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
}

function initEducationTables(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'teacher', 'student')),
      display_name TEXT NOT NULL,
      must_change_password INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'disabled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      class_code TEXT NOT NULL UNIQUE,
      teacher_id INTEGER NOT NULL,
      term TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(teacher_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS class_students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      student_no TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(class_id, student_id),
      UNIQUE(class_id, student_no),
      FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      scenario_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      due_at DATETIME,
      published_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY(published_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      attempt_no INTEGER NOT NULL,
      snapshot_json TEXT NOT NULL,
      evidence_json TEXT,
      lab_report_json TEXT,
      auto_score_json TEXT NOT NULL,
      auto_total REAL NOT NULL,
      teacher_override_json TEXT,
      final_total REAL NOT NULL,
      teacher_comment TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      graded_at DATETIME,
      graded_by INTEGER,
      FOREIGN KEY(assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
      FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(graded_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS score_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL,
      previous_score REAL NOT NULL,
      override_score REAL NOT NULL,
      override_by INTEGER NOT NULL,
      override_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reason TEXT,
      override_json TEXT,
      FOREIGN KEY(submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
      FOREIGN KEY(override_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_class_students_class ON class_students(class_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(class_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON submissions(submitted_at DESC);
    CREATE INDEX IF NOT EXISTS idx_score_overrides_submission ON score_overrides(submission_id);
  `);
}

function initDatabase() {
  const database = getDatabase();
  initLicenseTables(database);
  initEducationTables(database);
  console.log('Database initialization completed');
}

module.exports = { getDatabase, initDatabase };
