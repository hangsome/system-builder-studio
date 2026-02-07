const crypto = require('crypto');

/**
 * 生成序列号
 * 格式：SIMU-PXXX-XXXX-XXXX (P=个人版) 或 SIMU-TXXX-XXXX-XXXX (T=教师版)
 */
function generateLicenseKey(type = 'personal') {
  const prefix = type === 'teacher' ? 'T' : 'P';
  const random1 = crypto.randomBytes(2).toString('hex').toUpperCase().substring(0, 3);
  const random2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const random3 = crypto.randomBytes(2).toString('hex').toUpperCase();
  
  return `SIMU-${prefix}${random1}-${random2}-${random3}`;
}

/**
 * 验证序列号格式
 */
function validateLicenseFormat(key) {
  const pattern = /^SIMU-[PT][A-Z0-9]{3}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  return pattern.test(key);
}

/**
 * 从序列号解析类型
 */
function parseLicenseType(key) {
  if (!validateLicenseFormat(key)) return null;
  const typeChar = key.charAt(5);
  return typeChar === 'T' ? 'teacher' : 'personal';
}

module.exports = { generateLicenseKey, validateLicenseFormat, parseLicenseType };
