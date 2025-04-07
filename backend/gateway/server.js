const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const proxy = require('express-http-proxy');
const jwt = require('jsonwebtoken');
const config = require('./config');

const app = express();

// 安全中间件
app.use(helmet());
app.use(cors());
app.use(express.json());

// 速率限制
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个IP在windowMs内最多100个请求
  standardHeaders: true,
  legacyHeaders: false,
  message: '请求过于频繁，请稍后再试'
});

app.use('/api/', apiLimiter);

// 认证中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token == null) return res.sendStatus(401);
  
  jwt.verify(token, config.jwtSecret, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// 公共路由
app.use('/api/auth', proxy('http://localhost:5001', {
  proxyReqPathResolver: (req) => `/api/auth${req.url}`
}));

// 需要认证的路由
app.use('/api/users', authenticateToken, proxy('http://localhost:5001', {
  proxyReqPathResolver: (req) => `/api/users${req.url}`
}));

app.use('/api/students', authenticateToken, proxy('http://localhost:5001', {
  proxyReqPathResolver: (req) => `/api/students${req.url}`
}));

app.use('/api/data', authenticateToken, proxy('http://localhost:5002', {
  proxyReqPathResolver: (req) => `/api/data${req.url}`
}));

app.use('/api/progress', authenticateToken, proxy('http://localhost:5003', {
  proxyReqPathResolver: (req) => `/api/progress${req.url}`
}));

app.use('/api/interaction', authenticateToken, proxy('http://localhost:5004', {
  proxyReqPathResolver: (req) => `/api/interaction${req.url}`
}));

app.use('/api/notification', authenticateToken, proxy('http://localhost:5005', {
  proxyReqPathResolver: (req) => `/api/notification${req.url}`
}));

app.use('/api/resource', authenticateToken, proxy('http://localhost:5006', {
  proxyReqPathResolver: (req) => `/api/resource${req.url}`
}));

app.use('/api/analytics', authenticateToken, proxy('http://localhost:5007', {
  proxyReqPathResolver: (req) => `/api/analytics${req.url}`
}));

// 健康检查
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'api-gateway' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : '请联系系统管理员'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`API网关服务运行在端口 ${PORT}`);
});