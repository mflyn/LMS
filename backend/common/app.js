const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const hpp = require('hpp');

// 根据环境选择正确的模块
let session, sessionManagerModule;
if (process.env.NODE_ENV === 'test') {
  // 在测试环境中创建一个模拟的 session 中间件函数
  session = () => (req, res, next) => {
    req.session = {
      id: 'test-session-id',
      userId: 'test-user-id',
      userAgent: req.headers['user-agent'] || 'test-agent',
      ip: req.ip || '127.0.0.1',
      touch: () => {},
      destroy: (callback) => { if (callback) callback(); }
    };
    next();
  };
  sessionManagerModule = require('./middleware/mockSessionManager');
} else {
  session = require('express-session');
  sessionManagerModule = require('./middleware/sessionManager');
}
const { sessionConfig, sessionSecurity, sessionCleanup } = sessionManagerModule;
const passwordPolicy = require('./middleware/passwordPolicy');
const { validate, sanitizeInput } = require('./middleware/requestValidator');
const { upload, fileUploadSecurity } = require('./middleware/fileUploadSecurity');
const auditLogger = require('./middleware/auditLogger');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// 安全头部配置
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "same-site" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: "deny" },
  hidePoweredBy: true,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
  referrerPolicy: { policy: "no-referrer" },
  xssFilter: true
}));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个IP限制100个请求
  message: {
    status: 'error',
    message: '请求过于频繁，请稍后再试'
  }
});
app.use(limiter);

// CORS配置
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://your-frontend-domain.com']
    : ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
}));

// 会话配置
app.use(session(sessionConfig));
app.use(sessionSecurity);
app.use(sessionCleanup);

// 请求处理
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(xss());
app.use(hpp());

// 安全中间件
app.use(sanitizeInput);
app.use(auditLogger());

// 错误处理
app.use(errorHandler);

module.exports = app;