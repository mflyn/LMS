/**
 * 模拟会话管理器，用于测试环境
 */

// 模拟会话配置
const sessionConfig = {
  secret: 'test-secret-key',
  name: 'sessionId',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
};

// 模拟会话安全中间件
const sessionSecurity = (req, res, next) => {
  // 在测试环境中，我们假设会话总是有效的
  if (!req.session) {
    req.session = {
      userId: 'test-user-id',
      userAgent: req.headers['user-agent'] || 'test-agent',
      ip: req.ip || '127.0.0.1',
      touch: () => {}
    };
  }
  next();
};

// 模拟会话清理中间件
const sessionCleanup = (req, res, next) => {
  // 在测试环境中，我们不做任何清理
  next();
};

module.exports = {
  sessionConfig,
  sessionSecurity,
  sessionCleanup
};
