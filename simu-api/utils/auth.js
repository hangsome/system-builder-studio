/**
 * 验证管理员密钥
 */
function verifyAdminAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.substring(7);
  return token === process.env.ADMIN_SECRET;
}

/**
 * 管理员认证中间件
 */
function adminAuthMiddleware(req, res, next) {
  if (!verifyAdminAuth(req)) {
    return res.status(401).json({ error: '未授权访问' });
  }
  next();
}

module.exports = { verifyAdminAuth, adminAuthMiddleware };
