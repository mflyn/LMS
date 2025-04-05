const session = require('express-session');
const MongoStore = require('connect-mongo');
const { v4: uuidv4 } = require('uuid');

const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  name: 'sessionId',
  genid: () => uuidv4(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24小时
    sameSite: 'strict'
  },
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 24 * 60 * 60, // 24小时
    autoRemove: 'native',
    touchAfter: 24 * 3600 // 24小时
  })
};

// 会话安全中间件
const sessionSecurity = (req, res, next) => {
  // 检查会话是否有效
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      status: 'error',
      message: '会话已过期，请重新登录'
    });
  }

  // 检查会话是否被劫持
  if (req.session.userAgent !== req.headers['user-agent'] ||
      req.session.ip !== req.ip) {
    req.session.destroy();
    return res.status(401).json({
      status: 'error',
      message: '检测到异常登录，请重新登录'
    });
  }

  // 更新会话时间
  req.session.touch();
  next();
};

// 会话清理中间件
const sessionCleanup = (req, res, next) => {
  // 清理过期的会话
  if (req.session && req.session.cookie && req.session.cookie.expires) {
    if (new Date() > new Date(req.session.cookie.expires)) {
      req.session.destroy();
      return res.status(401).json({
        status: 'error',
        message: '会话已过期，请重新登录'
      });
    }
  }
  next();
};

module.exports = {
  sessionConfig,
  sessionSecurity,
  sessionCleanup
}; 