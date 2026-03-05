const jwt = require('jsonwebtoken');

function getJwtSecret() {
  return process.env.EDU_JWT_SECRET || process.env.ADMIN_SECRET || 'dev-insecure-secret';
}

function signAuthToken(user) {
  const ttl = process.env.EDU_JWT_EXPIRES_IN || '12h';
  return jwt.sign(
    {
      sub: String(user.id),
      username: user.username,
      role: user.role,
      displayName: user.display_name,
      mustChangePassword: Boolean(user.must_change_password),
    },
    getJwtSecret(),
    { expiresIn: ttl }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, getJwtSecret());
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

module.exports = {
  signAuthToken,
  authMiddleware,
  requireRole,
};
