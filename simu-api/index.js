require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./db/init');
const activateRouter = require('./routes/activate');
const verifyRouter = require('./routes/verify');
const adminRouter = require('./routes/admin');
const webhooksRouter = require('./routes/webhooks');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS 配置
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 初始化数据库
initDatabase();

// 路由
app.use('/api', activateRouter);
app.use('/api', verifyRouter);
app.use('/api/admin', adminRouter);
app.use('/api/webhooks', webhooksRouter);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`序列号激活服务已启动，端口: ${PORT}`);
});
