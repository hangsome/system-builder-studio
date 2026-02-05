
# 商业化改造方案（阿里云服务器版）

## 后端技术选型

考虑到轻量便捷的原则，推荐以下方案：

### 推荐方案：Node.js + SQLite

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| Node.js + SQLite | 轻量、部署简单、与前端技术栈统一 | 高并发能力有限 | ★★★★★ |
| Node.js + MySQL | 性能更好、数据管理方便 | 需要额外安装MySQL | ★★★★ |
| Python Flask + SQLite | 你已熟悉Flask语法 | 需要Python环境 | ★★★ |
| Go + SQLite | 性能极佳、单文件部署 | 学习成本 | ★★★ |

**推荐 Node.js + SQLite 的理由**：
1. 与前端项目技术栈一致（都是 JavaScript/TypeScript）
2. SQLite 单文件数据库，备份迁移极其简单
3. 对于序列号激活这种低频请求，性能完全足够
4. 可以使用 Express 或 Hono 框架，代码量极少

---

## 系统架构

```text
┌─────────────────────────────────────────────────────────────┐
│                      用户端                                  │
├─────────────────────────────────────────────────────────────┤
│  浏览器访问 / PWA离线使用                                    │
│  https://your-domain.com (前端静态页面)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │ 激活请求 (HTTPS)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   阿里云服务器                               │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │   Nginx         │───▶│  Node.js API    │                 │
│  │   反向代理       │    │  (Express/Hono) │                 │
│  │   SSL证书        │    │  端口: 3000     │                 │
│  └─────────────────┘    └────────┬────────┘                 │
│                                  │                           │
│                         ┌────────▼────────┐                 │
│                         │    SQLite       │                 │
│                         │   licenses.db   │                 │
│                         └─────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 后端 API 设计

### 1. 激活验证接口
```text
POST /api/activate
请求体: { licenseKey: "SIMU-XXXX-XXXX-XXXX", deviceId: "xxx" }
响应: { success: true, licenseType: "personal", expiresAt: null }
```

### 2. 验证状态接口（可选，用于定期校验）
```text
POST /api/verify
请求体: { licenseKey: "xxx", deviceId: "xxx" }
响应: { valid: true, licenseType: "personal" }
```

### 3. 序列号生成接口（管理端）
```text
POST /api/admin/generate
请求头: Authorization: Bearer <admin_token>
请求体: { count: 10, type: "personal" }
响应: { licenses: ["SIMU-P001-XXXX-XXXX", ...] }
```

---

## 数据库设计

### licenses 表
```text
CREATE TABLE licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_key TEXT UNIQUE NOT NULL,      -- 序列号
    license_type TEXT NOT NULL,            -- personal/teacher
    status TEXT DEFAULT 'unused',          -- unused/activated/revoked
    device_id TEXT,                        -- 激活设备指纹
    activated_at DATETIME,                 -- 激活时间
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT                             -- 备注（如：xx学校批量采购）
);

CREATE INDEX idx_license_key ON licenses(license_key);
```

---

## 阿里云服务器部署步骤

### 第一步：服务器环境准备
```text
1. 安装 Node.js 18+
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs

2. 安装 PM2 进程管理器
   sudo npm install -g pm2

3. 安装 Nginx
   sudo apt-get install nginx
```

### 第二步：部署后端代码
```text
1. 上传后端代码到 /var/www/simu-api/
2. npm install
3. pm2 start index.js --name simu-api
4. pm2 save && pm2 startup
```

### 第三步：配置 Nginx 反向代理
```text
server {
    listen 443 ssl;
    server_name api.your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 第四步：配置 SSL 证书
```text
阿里云免费SSL证书申请：
1. 登录阿里云控制台 → SSL证书服务
2. 申请免费证书（每年20个额度）
3. 下载 Nginx 格式证书
4. 配置到 Nginx
```

---

## 前端改造清单

### 新增文件

| 文件路径 | 说明 |
|---------|------|
| `src/pages/Activation.tsx` | 激活/登录页面 |
| `src/lib/license.ts` | 序列号验证逻辑 |
| `src/lib/deviceFingerprint.ts` | 设备指纹生成 |
| `src/lib/api.ts` | 后端 API 调用封装 |
| `src/hooks/useLicense.ts` | 激活状态管理 Hook |
| `src/components/LicenseGuard.tsx` | 路由保护组件 |
| `src/components/UpgradePrompt.tsx` | 升级提示弹窗 |
| `public/manifest.json` | PWA 配置文件 |

### 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `src/App.tsx` | 添加激活页路由，包裹 LicenseGuard |
| `src/store/simulatorStore.ts` | 添加 licenseStatus 状态 |
| `src/components/simulator/SimulatorLayout.tsx` | 功能权限控制 |
| `index.html` | 添加 PWA meta 标签 |

---

## 后端代码结构（独立仓库）

```text
simu-license-server/
├── index.js              # 主入口
├── routes/
│   ├── activate.js       # 激活接口
│   ├── verify.js         # 验证接口
│   └── admin.js          # 管理接口
├── db/
│   ├── init.js           # 数据库初始化
│   └── licenses.db       # SQLite 数据库文件
├── utils/
│   ├── license.js        # 序列号生成/验证
│   └── auth.js           # 管理员认证
├── package.json
└── README.md
```

---

## 实施计划

### 阶段一：前端激活系统（本项目）
1. 创建激活页面 UI
2. 实现设备指纹生成
3. 实现本地激活状态存储
4. 添加功能权限控制
5. 配置 API 调用（先用 mock 数据测试）

### 阶段二：后端服务（阿里云服务器）
1. 提供完整的后端代码（我会生成一个独立的代码包）
2. 你上传到阿里云服务器
3. 按照部署文档配置运行
4. 配置域名和 SSL

### 阶段三：前后端联调
1. 配置真实 API 地址
2. 测试激活流程
3. 生成测试序列号验证

### 阶段四：PWA 离线支持
1. 配置 manifest.json
2. 添加 Service Worker
3. 测试离线使用

---

## 成本预估

| 项目 | 费用 |
|------|------|
| 阿里云服务器 | 你已有（0元） |
| 域名 | ~50元/年 |
| SSL证书 | 阿里云免费证书（0元） |
| 发卡平台 | 1-3%手续费 |

---

## 下一步行动

如果你同意这个方案，我将：

1. **先实现前端部分**：创建激活页面、权限控制、PWA 配置
2. **提供后端代码包**：完整的 Node.js 后端代码，你可以直接部署到阿里云
3. **提供部署文档**：详细的阿里云部署步骤

是否开始实施？
