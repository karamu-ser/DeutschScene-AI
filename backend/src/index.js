require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { getDb } = require('./services/db');
const logger = require('./services/logger');
const { authMiddleware } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';
const apiRateLimitMax = Number(process.env.API_RATE_LIMIT_MAX || (isProduction ? 100 : 1000));
const authRateLimitMax = Number(process.env.AUTH_RATE_LIMIT_MAX || (isProduction ? 10 : 100));

const allowedOrigins = new Set([
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174'
]);

function isDevFrontendOrigin(origin) {
  return /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+):517[34]$/.test(origin || '');
}

// Security middleware
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin) || isDevFrontendOrigin(origin)) return callback(null, true);
    return callback(new Error(`Origin non autorisée: ${origin}`));
  }
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: apiRateLimitMax,
  message: { error: 'Too many requests from this IP, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: authRateLimitMax,
  skipSuccessfulRequests: true,
  message: { error: 'Trop de tentatives. Réessaie dans 15 minutes.' },
});

app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });
  next();
});

// Initialize DB before routes
(async () => {
  await getDb();
  logger.info('✅ Database initialized');

  // Auth routes (no auth required)
  app.use('/api/auth', require('./routes/auth'));

  // Protected routes (auth required)
  app.use('/api/upload', authMiddleware, require('./routes/upload'));
  app.use('/api/words', authMiddleware, require('./routes/words'));
  app.use('/api/quiz', authMiddleware, require('./routes/quiz'));
  app.use('/api/pronunciation', authMiddleware, require('./routes/pronunciation'));
  app.use('/api/conversation', authMiddleware, require('./routes/conversation'));
  app.use('/api/progress', authMiddleware, require('./routes/progress'));
  app.use('/api/tts', authMiddleware, require('./routes/tts'));
  app.use('/api/mistakes', authMiddleware, require('./routes/mistakes'));
  app.use('/api/generated-content', authMiddleware, require('./routes/generatedContent'));
  app.use('/api/ai-lehrer', authMiddleware, require('./routes/aiLehrer'));
  app.use('/api/exam', authMiddleware, require('./routes/exam'));
  app.use('/api/story', authMiddleware, require('./routes/story'));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Deutsch Lernen API is running 🇩🇪', timestamp: new Date().toISOString() });
  });

  // Error handler
  app.use((err, req, res, next) => {
    logger.error('Unhandled error', {
      message: err.message,
      stack: err.stack,
      path: req.path,
    });
    res.status(500).json({
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
  });

  app.listen(PORT, () => {
    logger.info(`🚀 Backend running on http://localhost:${PORT}`);
    logger.info(`📚 API: http://localhost:${PORT}/api/health`);
    logger.info(`🔐 Auth: http://localhost:${PORT}/api/auth`);
  });
})();

module.exports = app;
