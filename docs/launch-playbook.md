# 上线落地操作手册（阿里云单机 + SaaS发卡 + 简易后台）

本文档面向“个人ICP备案 + 阿里云单机部署”场景，覆盖前后端部署、管理员后台与发卡平台自动发货流程。具体实现以仓库 `simu-api/` 与前端代码为准。

---

## 1. 域名与ICP备案（个人主体）
1. 在阿里云购买域名，并绑定到当前云服务器。  
2. 登录阿里云控制台 → ICP备案 → 新增备案（个人主体）。  
3. 按提示完成实名认证、短信核验与管局审核。  
4. 备案通过后再进行解析与正式上线（中国大陆服务器强制要求）。  

---

## 2. 服务器环境准备（Ubuntu 20.04/22.04）
```bash
# Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 构建依赖（better-sqlite3 需要）
sudo apt-get install -y build-essential python3

# PM2 与 Nginx
sudo npm install -g pm2
sudo apt-get install -y nginx
```

---

## 3. 部署后端（simu-api）
1. 上传 `simu-api/` 到服务器：`/var/www/simu-api/`  
2. 配置环境变量：
```bash
cd /var/www/simu-api
cp .env.example .env
nano .env
```
3. 安装依赖并启动：
```bash
npm install
pm2 start index.js --name simu-api
pm2 save && pm2 startup
```

---

## 4. 部署前端（Vite）
1. 在本地构建：
```bash
cp .env.example .env.production
# 修改 .env.production 中的 VITE_API_BASE_URL 与 VITE_API_USE_MOCK=false
npm ci
npm run build
```
2. 上传 `dist/` 到服务器：`/var/www/simulator-frontend/`

---

## 5. Nginx 配置（前端 + API + BasicAuth）
创建 `/etc/nginx/sites-available/simulator`：
```nginx
server {
    listen 80;
    server_name www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.your-domain.com;

    ssl_certificate /etc/nginx/ssl/www.your-domain.com.pem;
    ssl_certificate_key /etc/nginx/ssl/www.your-domain.com.key;

    root /var/www/simulator-frontend;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    # 简易管理员后台 BasicAuth
    location /admin {
        auth_basic "Admin Area";
        auth_basic_user_file /etc/nginx/.htpasswd;
        try_files $uri /index.html;
    }
}

server {
    listen 80;
    server_name api.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    ssl_certificate /etc/nginx/ssl/api.your-domain.com.pem;
    ssl_certificate_key /etc/nginx/ssl/api.your-domain.com.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

生成 BasicAuth：
```bash
sudo apt-get install -y apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd admin
sudo nginx -t && sudo systemctl reload nginx
```

---

## 6. 管理员后台使用
1. 访问 `https://www.your-domain.com/admin`  
2. 输入 `ADMIN_SECRET`（Bearer Token）并保存  
3. 生成序列号、筛选、撤销、导出 CSV  

---

## 7. 发卡平台（通用流程）
选择支持“自动发货 + Webhook 回调”的 SaaS 发卡平台，按以下步骤配置：  
1. 注册与实名  
2. 创建商品（个人版 / 教师版）  
3. 将平台商品ID填写到后端 `.env`：  
   - `PRODUCT_PERSONAL_IDS`  
   - `PRODUCT_TEACHER_IDS`  
4. 设置回调地址：  
   - `https://api.your-domain.com/api/webhooks/card-platform`  
5. 回调签名规则：  
   - `sign = md5(order_id + product_id + quantity + WEBHOOK_SECRET)`  
6. 先跑一笔测试订单，确认回调可成功返回卡密  

---

## 8. 验收清单
1. personal：同设备重复激活成功，第二台设备失败  
2. teacher：最多 3 台设备  
3. 断网 7 天内可用，超期回退体验版  
4. 管理后台可生成/撤销/导出  
5. HTTPS 下前端和 API 均可访问  
