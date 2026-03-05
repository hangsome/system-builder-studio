require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./db/init');
const activateRouter = require('./routes/activate');
const verifyRouter = require('./routes/verify');
const adminRouter = require('./routes/admin');
const webhooksRouter = require('./routes/webhooks');
const authRouter = require('./routes/auth');
const eduRouter = require('./routes/edu');

const app = express();
const PORT = Number(process.env.PORT || 3000);

function isEducationEnabled() {
  const featureMode = String(process.env.FEATURE_MODE || 'commercial').toLowerCase();
  const envEnabled = String(process.env.EDU_FEATURE_ENABLED || '').toLowerCase();
  if (envEnabled === 'true' || envEnabled === '1') return true;
  return featureMode === 'teaching' || featureMode === 'full';
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

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

app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: false }));

initDatabase();

// Legacy APIs: always enabled
app.use('/api', activateRouter);
app.use('/api', verifyRouter);
app.use('/api/admin', adminRouter);
app.use('/api/webhooks', webhooksRouter);

if (isEducationEnabled()) {
  app.use('/api/auth', authRouter);
  app.use('/api/edu', eduRouter);
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    educationEnabled: isEducationEnabled(),
    featureMode: process.env.FEATURE_MODE || 'commercial',
  });
});

app.listen(PORT, () => {
  console.log(`Backend service started on port ${PORT} (educationEnabled=${isEducationEnabled()})`);
});
