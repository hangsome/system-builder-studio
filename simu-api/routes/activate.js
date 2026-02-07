const express = require('express');
const router = express.Router();
const { getDatabase } = require('../db/init');
const { validateLicenseFormat } = require('../utils/license');

function getMaxDevices(licenseType) {
  const personalLimit = Number(process.env.MAX_DEVICES_PERSONAL || 1);
  const teacherLimit = Number(process.env.MAX_DEVICES_TEACHER || 3);
  return licenseType === 'teacher' ? teacherLimit : personalLimit;
}

/**
 * POST /api/activate
 * 激活序列号
 */
router.post('/activate', (req, res) => {
  const { licenseKey, deviceId } = req.body;
  
  // 参数验证
  if (!licenseKey || !deviceId) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数',
    });
  }
  
  // 格式验证
  const normalizedKey = licenseKey.toUpperCase();
  if (!validateLicenseFormat(normalizedKey)) {
    return res.status(400).json({
      success: false,
      error: '序列号格式不正确',
    });
  }
  
  const db = getDatabase();
  
  try {
    const license = db.prepare('SELECT * FROM licenses WHERE license_key = ?').get(normalizedKey);
    
    if (!license) {
      return res.status(404).json({
        success: false,
        error: '序列号无效，请检查输入是否正确',
      });
    }
    
    if (license.status === 'revoked') {
      return res.status(403).json({
        success: false,
        error: '此序列号已被撤销',
      });
    }
    
    const maxDevices = getMaxDevices(license.license_type);
    const deviceExists = db.prepare('SELECT 1 FROM license_devices WHERE license_key = ? AND device_id = ?').get(normalizedKey, deviceId);
    const deviceCount = db.prepare('SELECT COUNT(*) as count FROM license_devices WHERE license_key = ?').get(normalizedKey).count || 0;
    
    if (!deviceExists && deviceCount >= maxDevices) {
      return res.status(403).json({
        success: false,
        error: '设备数量已达上限',
      });
    }
    
    if (!deviceExists) {
      db.prepare(`
        INSERT INTO license_devices (license_key, device_id, activated_at)
        VALUES (?, ?, datetime('now'))
      `).run(normalizedKey, deviceId);
      
      if (license.status !== 'activated') {
        db.prepare(`
          UPDATE licenses
          SET status = 'activated', activated_at = datetime('now')
          WHERE license_key = ?
        `).run(normalizedKey);
      }
    }
    
    const updatedCount = deviceExists ? deviceCount : deviceCount + 1;
    const remainingDevices = Math.max(0, maxDevices - updatedCount);
    
    res.json({
      success: true,
      licenseType: license.license_type,
      remainingDevices,
      message: deviceExists ? '序列号已激活（同一设备）' : '激活成功！',
    });
  } catch (error) {
    console.error('激活错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
    });
  }
});

module.exports = router;
