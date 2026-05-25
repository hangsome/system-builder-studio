require('dotenv').config();
const bcrypt = require('bcryptjs');
const { initDatabase, getDatabase } = require('../db/init');

function upsertUser({ username, password, role, displayName }) {
  const db = getDatabase();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  const hash = bcrypt.hashSync(password, 10);

  if (existing) {
    db.prepare(`
      UPDATE users
      SET password_hash = ?, role = ?, display_name = ?, must_change_password = 1, status = 'active', updated_at = datetime('now')
      WHERE id = ?
    `).run(hash, role, displayName, existing.id);
    return { id: existing.id, updated: true };
  }

  const result = db.prepare(`
    INSERT INTO users (username, password_hash, role, display_name, must_change_password, status)
    VALUES (?, ?, ?, ?, 1, 'active')
  `).run(username, hash, role, displayName);

  return { id: result.lastInsertRowid, updated: false };
}

function main() {
  initDatabase();

  const admin = upsertUser({
    username: process.env.SEED_ADMIN_USERNAME || 'admin',
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
    role: 'admin',
    displayName: process.env.SEED_ADMIN_DISPLAY_NAME || 'System Admin',
  });

  const teacher = upsertUser({
    username: process.env.SEED_TEACHER_USERNAME || 'teacher',
    password: process.env.SEED_TEACHER_PASSWORD || 'teacher@123',
    role: 'teacher',
    displayName: process.env.SEED_TEACHER_DISPLAY_NAME || 'Demo Teacher',
  });

  console.log(JSON.stringify({
    success: true,
    admin,
    teacher,
  }, null, 2));
}

main();
