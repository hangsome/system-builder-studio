 # 后端部署指南 - 阿里云服务器
 
 本文档提供完整的 Node.js 后端代码和部署步骤，用于序列号激活验证服务。
 
 ## 目录结构
 
 将以下代码保存到阿里云服务器的 `/var/www/simu-api/` 目录下：
 
 ```text
 simu-api/
 ├── index.js              # 主入口
 ├── routes/
 │   ├── activate.js       # 激活接口
 │   ├── verify.js         # 验证接口
 │   └── admin.js          # 管理接口
 ├── db/
 │   └── init.js           # 数据库初始化
 ├── utils/
 │   ├── license.js        # 序列号生成/验证
 │   └── auth.js           # 管理员认证
 ├── package.json
 └── .env                  # 环境变量配置
 ```
 
 ---
 
 ## 代码文件
 
 ### package.json
 
 ```json
 {
   "name": "simu-license-server",
   "version": "1.0.0",
   "description": "信息系统搭建模拟器 - 序列号激活服务",
   "main": "index.js",
   "scripts": {
     "start": "node index.js",
     "dev": "node --watch index.js"
   },
   "dependencies": {
     "better-sqlite3": "^9.4.3",
     "cors": "^2.8.5",
     "dotenv": "^16.4.5",
     "express": "^4.18.2"
   }
 }
 ```
 
 ### .env
 
 ```env
 # 服务器端口
 PORT=3000
 
 # 管理员密钥（用于生成序列号）
 ADMIN_SECRET=your-super-secret-key-change-this
 
 # 允许的前端域名（逗号分隔）
 ALLOWED_ORIGINS=https://your-domain.com,http://localhost:5173
 ```
 
 ### index.js
 
 ```javascript
 require('dotenv').config();
 const express = require('express');
 const cors = require('cors');
 const { initDatabase } = require('./db/init');
 const activateRouter = require('./routes/activate');
 const verifyRouter = require('./routes/verify');
 const adminRouter = require('./routes/admin');
 
 const app = express();
 const PORT = process.env.PORT || 3000;
 
 // CORS 配置
 const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
 app.use(cors({
   origin: (origin, callback) => {
     if (!origin || allowedOrigins.includes(origin)) {
       callback(null, true);
     } else {
       callback(new Error('Not allowed by CORS'));
     }
   },
   credentials: true,
 }));
 
 app.use(express.json());
 
 // 初始化数据库
 initDatabase();
 
 // 路由
 app.use('/api', activateRouter);
 app.use('/api', verifyRouter);
 app.use('/api/admin', adminRouter);
 
 // 健康检查
 app.get('/health', (req, res) => {
   res.json({ status: 'ok', timestamp: new Date().toISOString() });
 });
 
 app.listen(PORT, () => {
   console.log(`✅ 序列号激活服务已启动，端口: ${PORT}`);
 });
 ```
 
 ### db/init.js
 
 ```javascript
 const Database = require('better-sqlite3');
 const path = require('path');
 
 const dbPath = path.join(__dirname, 'licenses.db');
 let db;
 
 function getDatabase() {
   if (!db) {
     db = new Database(dbPath);
     db.pragma('journal_mode = WAL');
   }
   return db;
 }
 
 function initDatabase() {
   const db = getDatabase();
   
   db.exec(`
     CREATE TABLE IF NOT EXISTS licenses (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       license_key TEXT UNIQUE NOT NULL,
       license_type TEXT NOT NULL CHECK(license_type IN ('personal', 'teacher')),
       status TEXT DEFAULT 'unused' CHECK(status IN ('unused', 'activated', 'revoked')),
       device_id TEXT,
       activated_at DATETIME,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
       notes TEXT
     );
     
     CREATE INDEX IF NOT EXISTS idx_license_key ON licenses(license_key);
     CREATE INDEX IF NOT EXISTS idx_status ON licenses(status);
   `);
   
   console.log('✅ 数据库初始化完成');
 }
 
 module.exports = { getDatabase, initDatabase };
 ```
 
 ### utils/license.js
 
 ```javascript
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
 ```
 
 ### utils/auth.js
 
 ```javascript
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
 ```
 
 ### routes/activate.js
 
 ```javascript
 const express = require('express');
 const router = express.Router();
 const { getDatabase } = require('../db/init');
 const { validateLicenseFormat, parseLicenseType } = require('../utils/license');
 
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
     // 查找序列号
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
     
     if (license.status === 'activated') {
       // 检查是否同一设备
       if (license.device_id === deviceId) {
         return res.json({
           success: true,
           licenseType: license.license_type,
           message: '序列号已激活（同一设备）',
         });
       }
       
       return res.status(403).json({
         success: false,
         error: '此序列号已在其他设备上激活',
       });
     }
     
     // 激活序列号
     db.prepare(`
       UPDATE licenses 
       SET status = 'activated', device_id = ?, activated_at = datetime('now')
       WHERE license_key = ?
     `).run(deviceId, normalizedKey);
     
     console.log(`✅ 序列号激活成功: ${normalizedKey}, 设备: ${deviceId.substring(0, 8)}...`);
     
     res.json({
       success: true,
       licenseType: license.license_type,
       message: '激活成功！',
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
 ```
 
 ### routes/verify.js
 
 ```javascript
 const express = require('express');
 const router = express.Router();
 const { getDatabase } = require('../db/init');
 
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
     const license = db.prepare(`
       SELECT * FROM licenses 
       WHERE license_key = ? AND device_id = ? AND status = 'activated'
     `).get(licenseKey.toUpperCase(), deviceId);
     
     if (license) {
       res.json({
         valid: true,
         licenseType: license.license_type,
       });
     } else {
       res.json({
         valid: false,
         message: '验证失败',
       });
     }
   } catch (error) {
     console.error('验证错误:', error);
     res.json({ valid: false, message: '服务器错误' });
   }
 });
 
 module.exports = router;
 ```
 
 ### routes/admin.js
 
 ```javascript
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
       
       // 确保唯一性
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
     console.log(`✅ 生成 ${count} 个 ${type} 序列号`);
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
   let sql = 'SELECT * FROM licenses WHERE 1=1';
   const params = [];
   
   if (status) {
     sql += ' AND status = ?';
     params.push(status);
   }
   
   if (type) {
     sql += ' AND license_type = ?';
     params.push(type);
   }
   
   sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
   params.push(parseInt(limit), parseInt(offset));
   
   try {
     const licenses = db.prepare(sql).all(...params);
     const total = db.prepare('SELECT COUNT(*) as count FROM licenses').get();
     
     res.json({
       licenses,
       total: total.count,
       limit: parseInt(limit),
       offset: parseInt(offset),
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
       console.log(`⚠️ 序列号已撤销: ${licenseKey}`);
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
 ```
 
 ---
 
 ## 部署步骤
 
 ### 1. 服务器环境准备
 
 ```bash
 # 安装 Node.js 18+
 curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
 sudo apt-get install -y nodejs
 
 # 安装构建工具（better-sqlite3 需要）
 sudo apt-get install -y build-essential python3
 
 # 安装 PM2 进程管理器
 sudo npm install -g pm2
 
 # 安装 Nginx
 sudo apt-get install -y nginx
 ```
 
 ### 2. 上传代码
 
 ```bash
 # 创建目录
 sudo mkdir -p /var/www/simu-api
 sudo chown $USER:$USER /var/www/simu-api
 
 # 上传代码到服务器（使用 scp 或 rsync）
 scp -r ./simu-api/* user@your-server:/var/www/simu-api/
 ```
 
 ### 3. 安装依赖并启动
 
 ```bash
 cd /var/www/simu-api
 
 # 安装依赖
 npm install
 
 # 创建 .env 文件并配置
 cp .env.example .env
 nano .env  # 编辑配置
 
 # 使用 PM2 启动
 pm2 start index.js --name simu-api
 
 # 保存 PM2 配置并设置开机自启
 pm2 save
 pm2 startup
 ```
 
 ### 4. 配置 Nginx 反向代理
 
 创建文件 `/etc/nginx/sites-available/simu-api`：
 
 ```nginx
 server {
     listen 80;
     server_name api.your-domain.com;
     
     # HTTP 重定向到 HTTPS
     return 301 https://$server_name$request_uri;
 }
 
 server {
     listen 443 ssl http2;
     server_name api.your-domain.com;
     
     # SSL 证书配置
     ssl_certificate /etc/nginx/ssl/api.your-domain.com.pem;
     ssl_certificate_key /etc/nginx/ssl/api.your-domain.com.key;
     
     # SSL 安全配置
     ssl_protocols TLSv1.2 TLSv1.3;
     ssl_prefer_server_ciphers on;
     ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
     
     location / {
         proxy_pass http://127.0.0.1:3000;
         proxy_http_version 1.1;
         proxy_set_header Upgrade $http_upgrade;
         proxy_set_header Connection 'upgrade';
         proxy_set_header Host $host;
         proxy_set_header X-Real-IP $remote_addr;
         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
         proxy_set_header X-Forwarded-Proto $scheme;
         proxy_cache_bypass $http_upgrade;
     }
 }
 ```
 
 ```bash
 # 启用站点
 sudo ln -s /etc/nginx/sites-available/simu-api /etc/nginx/sites-enabled/
 
 # 测试配置
 sudo nginx -t
 
 # 重启 Nginx
 sudo systemctl reload nginx
 ```
 
 ### 5. 申请阿里云 SSL 证书
 
 1. 登录阿里云控制台 → SSL证书服务
 2. 申请免费证书（每年20个额度）
 3. 下载 Nginx 格式证书
 4. 上传到 `/etc/nginx/ssl/` 目录
 
 ---
 
 ## 生成测试序列号
 
 ```bash
 # 使用 curl 生成测试序列号
 curl -X POST https://api.your-domain.com/api/admin/generate \
   -H "Content-Type: application/json" \
   -H "Authorization: Bearer your-super-secret-key-change-this" \
   -d '{"count": 5, "type": "personal", "notes": "测试用"}'
 
 # 生成教师版序列号
 curl -X POST https://api.your-domain.com/api/admin/generate \
   -H "Content-Type: application/json" \
   -H "Authorization: Bearer your-super-secret-key-change-this" \
   -d '{"count": 2, "type": "teacher", "notes": "教师测试"}'
 ```
 
 ---
 
 ## 前端配置
 
 部署后端后，修改前端 `src/lib/api.ts` 中的配置：
 
 ```typescript
 const API_CONFIG = {
   useMock: false,  // 关闭 mock 模式
   baseUrl: 'https://api.your-domain.com',  // 替换为你的域名
   timeout: 10000,
 };
 ```
 
 ---
 
 ## 常用运维命令
 
 ```bash
 # 查看服务状态
 pm2 status
 
 # 查看日志
 pm2 logs simu-api
 
 # 重启服务
 pm2 restart simu-api
 
 # 备份数据库
 cp /var/www/simu-api/db/licenses.db ~/backups/licenses_$(date +%Y%m%d).db
 ```