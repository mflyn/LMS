const express = require('express');
const cors = require('cors');
const proxy = require('express-http-proxy');
const jwt = require('jsonwebtoken');
const config = require('./config');

const app = express();

// 基础中间件
app.use(cors());
app.use(express.json());

// JWT认证中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token == null) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    if (user && user.id) req.headers['x-user-id'] = user.id;
    if (user && user.role) req.headers['x-user-role'] = user.role;
    if (user && user.username) req.headers['x-user-name'] = user.username;
    next();
  });
};

// 健康检查
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'api-gateway' });
});

// 公共认证路由
app.use('/api/auth', proxy(config.serviceHosts.user, {
  proxyReqPathResolver: (req) => `/api/auth${req.url}`
}));

// 需要认证的用户相关路由
app.use('/api/users', authenticateToken, proxy(config.serviceHosts.user, {
  proxyReqPathResolver: (req) => `/api/users${req.url}`
}));

app.use('/api/students', authenticateToken, proxy(config.serviceHosts.user, {
  proxyReqPathResolver: (req) => `/api/students${req.url}`
}));

// 数据服务路由
app.use('/api/data', authenticateToken, proxy(config.serviceHosts.data, {
  proxyReqPathResolver: (req) => `/api/data${req.url}`
}));

// 启动服务器
const PORT = process.env.GATEWAY_PORT || config.port || 8000;
app.listen(PORT, () => {
  console.log(`简化版API网关在端口 ${PORT} 启动成功`);
}); 