const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { getDatabase } = require('../db/init');
const { generateLicenseKey } = require('../utils/license');

function md5(value) {
  return crypto.createHash('md5').update(value).digest('hex');
}

function parseProductIds(value) {
  return (value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function resolveLicenseType(productId) {
  const personalIds = parseProductIds(process.env.PRODUCT_PERSONAL_IDS);
  const teacherIds = parseProductIds(process.env.PRODUCT_TEACHER_IDS);
  if (personalIds.includes(productId)) return 'personal';
  if (teacherIds.includes(productId)) return 'teacher';
  return null;
}

/**
 * POST /api/webhooks/card-platform
 * 发卡平台回调接口（自动发货）
 */
router.post('/card-platform', (req, res) => {
  const orderId = req.body.order_id || req.body.orderId;
  const productId = req.body.product_id || req.body.productId;
  const quantityRaw = req.body.quantity || req.body.count || req.body.num || 1;
  const sign = req.body.sign || req.body.signature;
  
  if (!orderId || !productId || !sign) {
    return res.status(400).json({ success: false, error: '缺少必要参数' });
  }
  
  const quantity = Math.max(1, Number.parseInt(quantityRaw, 10) || 1);
  if (quantity > 100) {
    return res.status(400).json({ success: false, error: '数量超出上限' });
  }
  
  const secret = process.env.WEBHOOK_SECRET || '';
  const expectedSign = md5(`${orderId}${productId}${quantity}${secret}`);
  if (expectedSign !== sign) {
    return res.status(403).json({ success: false, error: '签名错误' });
  }
  
  const licenseType = resolveLicenseType(productId);
  if (!licenseType) {
    return res.status(400).json({ success: false, error: '未知商品ID' });
  }
  
  const db = getDatabase();
  
  try {
    const existingOrder = db.prepare('SELECT * FROM license_orders WHERE order_id = ?').get(orderId);
    if (existingOrder && existingOrder.status === 'fulfilled') {
      const items = db.prepare('SELECT license_key FROM license_order_items WHERE order_id = ?').all(orderId);
      return res.json({
        success: true,
        order_id: orderId,
        licenses: items.map((item) => item.license_key),
      });
    }
    
    const insertOrder = db.prepare(`
      INSERT INTO license_orders (order_id, product_id, quantity, status)
      VALUES (?, ?, ?, 'processing')
    `);
    const insertLicense = db.prepare(`
      INSERT INTO licenses (license_key, license_type, status, notes)
      VALUES (?, ?, 'unused', ?)
    `);
    const insertItem = db.prepare(`
      INSERT INTO license_order_items (order_id, license_key, license_type)
      VALUES (?, ?, ?)
    `);
    const updateOrder = db.prepare(`
      UPDATE license_orders SET status = 'fulfilled' WHERE order_id = ?
    `);
    
    const generatedKeys = [];
    const transaction = db.transaction(() => {
      if (!existingOrder) {
        insertOrder.run(orderId, productId, quantity);
      }
      
      for (let i = 0; i < quantity; i++) {
        let key;
        let attempts = 0;
        
        do {
          key = generateLicenseKey(licenseType);
          attempts++;
        } while (attempts < 10 && db.prepare('SELECT 1 FROM licenses WHERE license_key = ?').get(key));
        
        insertLicense.run(key, licenseType, `order:${orderId}`);
        insertItem.run(orderId, key, licenseType);
        generatedKeys.push(key);
      }
      
      updateOrder.run(orderId);
    });
    
    transaction();
    
    res.json({
      success: true,
      order_id: orderId,
      licenses: generatedKeys,
    });
  } catch (error) {
    console.error('Webhook 处理错误:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

module.exports = router;
