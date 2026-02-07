const express = require('express');
const router = express.Router();
const { getDatabase } = require('../db/init');
const { generateLicenseKey } = require('../utils/license');
const { adminAuthMiddleware } = require('../utils/auth');

// 所有管理接口都需要认证
router.use(adminAuthMiddleware);

/**
 * POST /api/admin/generate
 * 批量生成序列号
 */
router.post('/generate', (req, res) => {
  const { count = 1, type = 'personal', notes = '' } = req.body;
  
  if (count < 1 || count > 100) {
    return res.status(400).json({ error: '数量必须在1-100之间' });
  }
  
  if (!['personal', 'teacher'].includes(type)) {
    return res.status(400).json({ error: '无效的许可证类型' });
  }
  
  const db = getDatabase();
  const insert = db.prepare(`
    INSERT INTO licenses (license_key, license_type, notes)
    VALUES (?, ?, ?)
  `);
  
  const licenses = [];
  const insertMany = db.transaction(() => {
    for (let i = 0; i < count; i++) {
      let key;
      let attempts = 0;
      
      do {
        key = generateLicenseKey(type);
        attempts++;
      } while (attempts < 10 && db.prepare('SELECT 1 FROM licenses WHERE license_key = ?').get(key));
      
      insert.run(key, type, notes);
      licenses.push(key);
    }
  });
  
  try {
    insertMany();
    res.json({ success: true, licenses, count: licenses.length });
  } catch (error) {
    console.error('生成错误:', error);
    res.status(500).json({ error: '生成序列号失败' });
  }
});

/**
 * GET /api/admin/licenses
 * 查询序列号列表
 */
router.get('/licenses', (req, res) => {
  const { status, type, limit = 50, offset = 0 } = req.query;
  
  const db = getDatabase();
  let sql = `
    SELECT l.*,
      (SELECT COUNT(*) FROM license_devices d WHERE d.license_key = l.license_key) AS device_count
    FROM licenses l
    WHERE 1=1
  `;
  let countSql = 'SELECT COUNT(*) as count FROM licenses WHERE 1=1';
  const params = [];
  const countParams = [];
  
  if (status) {
    sql += ' AND l.status = ?';
    countSql += ' AND status = ?';
    params.push(status);
    countParams.push(status);
  }
  
  if (type) {
    sql += ' AND l.license_type = ?';
    countSql += ' AND license_type = ?';
    params.push(type);
    countParams.push(type);
  }
  
  sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit, 10), parseInt(offset, 10));
  
  try {
    const licenses = db.prepare(sql).all(...params);
    const total = db.prepare(countSql).get(...countParams);
    
    res.json({
      licenses,
      total: total.count,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
  } catch (error) {
    console.error('查询错误:', error);
    res.status(500).json({ error: '查询失败' });
  }
});

/**
 * POST /api/admin/revoke
 * 撤销序列号
 */
router.post('/revoke', (req, res) => {
  const { licenseKey } = req.body;
  
  if (!licenseKey) {
    return res.status(400).json({ error: '缺少序列号' });
  }
  
  const db = getDatabase();
  
  try {
    const result = db.prepare(`
      UPDATE licenses SET status = 'revoked' WHERE license_key = ?
    `).run(licenseKey.toUpperCase());
    
    if (result.changes > 0) {
      res.json({ success: true, message: '序列号已撤销' });
    } else {
      res.status(404).json({ error: '序列号不存在' });
    }
  } catch (error) {
    console.error('撤销错误:', error);
    res.status(500).json({ error: '撤销失败' });
  }
});

module.exports = router;
