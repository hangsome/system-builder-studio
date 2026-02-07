const express = require('express');
const router = express.Router();
const { getDatabase } = require('../db/init');

function getMaxDevices(licenseType) {
  const personalLimit = Number(process.env.MAX_DEVICES_PERSONAL || 1);
  const teacherLimit = Number(process.env.MAX_DEVICES_TEACHER || 3);
  return licenseType === 'teacher' ? teacherLimit : personalLimit;
}

/**
 * POST /api/verify
 * 验证激活状态
 */
router.post('/verify', (req, res) => {
  const { licenseKey, deviceId } = req.body;
  
  if (!licenseKey || !deviceId) {
    return res.json({ valid: false, message: '缺少参数' });
  }
  
  const db = getDatabase();
  
  try {
    const license = db.prepare('SELECT * FROM licenses WHERE license_key = ?').get(licenseKey.toUpperCase());
    if (!license || license.status === 'revoked') {
      return res.json({ valid: false, message: '验证失败' });
    }
    
    const device = db.prepare(`
      SELECT 1 FROM license_devices WHERE license_key = ? AND device_id = ?
    `).get(licenseKey.toUpperCase(), deviceId);
    
    if (!device) {
      return res.json({ valid: false, message: '设备未授权' });
    }
    
    const deviceCount = db.prepare('SELECT COUNT(*) as count FROM license_devices WHERE license_key = ?').get(licenseKey.toUpperCase()).count || 0;
    const maxDevices = getMaxDevices(license.license_type);
    
    res.json({
      valid: true,
      licenseType: license.license_type,
      remainingDevices: Math.max(0, maxDevices - deviceCount),
    });
  } catch (error) {
    console.error('验证错误:', error);
    res.json({ valid: false, message: '服务器错误' });
  }
});

module.exports = router;
