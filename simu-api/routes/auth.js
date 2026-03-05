const express = require('express');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../db/init');
const { signAuthToken, authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const db = getDatabase();
  const user = db.prepare(`
    SELECT id, username, password_hash, role, display_name, must_change_password, status
    FROM users
    WHERE username = ?
  `).get(String(username).trim());

  if (!user || user.status !== 'active') {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const ok = bcrypt.compareSync(String(password), user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signAuthToken(user);
  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.display_name,
      mustChangePassword: Boolean(user.must_change_password),
    },
  });
});

router.get('/me', authMiddleware, (req, res) => {
  const db = getDatabase();
  const user = db.prepare(`
    SELECT id, username, role, display_name, must_change_password, status, created_at
    FROM users
    WHERE id = ?
  `).get(Number(req.user.sub));

  if (!user || user.status !== 'active') {
    return res.status(401).json({ error: 'User disabled or not found' });
  }

  return res.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.display_name,
      mustChangePassword: Boolean(user.must_change_password),
      createdAt: user.created_at,
    },
  });
});

router.post('/change-password', authMiddleware, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'oldPassword and newPassword are required' });
  }

  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: 'newPassword must be at least 6 chars' });
  }

  const db = getDatabase();
  const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(Number(req.user.sub));
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const ok = bcrypt.compareSync(String(oldPassword), user.password_hash);
  if (!ok) {
    return res.status(400).json({ error: 'Old password is incorrect' });
  }

  const nextHash = bcrypt.hashSync(String(newPassword), 10);
  db.prepare(`
    UPDATE users
    SET password_hash = ?, must_change_password = 0, updated_at = datetime('now')
    WHERE id = ?
  `).run(nextHash, user.id);

  return res.json({ success: true });
});

module.exports = router;
