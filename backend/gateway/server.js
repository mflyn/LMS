const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const proxy = require('express-http-proxy');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../common/config/auth');
const createBaseApp = require('../common/createBaseApp');
const { UnauthorizedError, ForbiddenError } = require('../common/middleware/errorTypes');
const config = require('./config');
const logger = require('../common/utils/logger');

// 1. 创建基础应用实例
const app = createBaseApp({
  serviceName: 'api-gateway',
  // 网关的CORS策略可能需要更开放或与 user-service 不同，可以通过 corsOptions 覆盖
  // corsOptions: { origin: '*' }, // 例如，如果需要更广泛的来源
  enableSessions: false, // API 网关通常是无状态的
  // 网关的速率限制可以由 createBaseApp 提供，或者如果需要更细致的针对特定路由的限制，可以在此定义并应用
  // 如果 createBaseApp 中的全局速率限制足够，则这里不需要额外配置。
  // rateLimitOptions: config.rateLimitOptions // 可以从网关配置中读取速率限制选项
});

// 2. 网关核心中间件: JWT认证 (这个中间件是网关特有的，因为它处理原始token并设置下游头部)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token == null) {
    // 对于公共路径 (如 /api/auth/login, /api/auth/register)，不应强制认证
    // 这个逻辑应该在路由层面决定，而不是全局应用 authenticateToken
    // 因此，对于期望公开的路径，不应使用此中间件，或此中间件需要更复杂的路径排除逻辑
    // 暂时保持原样，但这是一个需要根据实际公开API来调整的地方。
    // 如果路径本身在下游服务中不需要认证，网关层面也不应该拦截。
    // 如果是受保护路径没有token，则返回401
    return next(new UnauthorizedError('No token provided'));
  }
  
  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
      logger.warn(`JWT verification failed for token: ${token}`, { error: err.message, path: req.path });
      return next(new ForbiddenError('Invalid or expired token'));
    }
    req.user = user;
    if (user && user.id) req.headers['x-user-id'] = user.id;
    if (user && user.role) req.headers['x-user-role'] = user.role;
    if (user && user.username) req.headers['x-user-name'] = user.username;
    next();
  });
};

// 3. API 代理路由 (这些是网关的核心功能)
// 注意: 确保服务地址来自配置，并且是正确的
const userServiceUrl = config.serviceHosts.user; // 假设 user-service 包含 auth 和 user 模块
const dataServiceUrl = config.serviceHosts.data;
// ... 其他服务地址 ...

if (!userServiceUrl || !dataServiceUrl) {
  logger.error('FATAL ERROR: Upstream service URLs are not defined in gateway config.');
  process.exit(1);
}

// 公共认证路由 (通常不需要 authenticateToken 中间件)
app.use('/api/auth', proxy(userServiceUrl, {
  proxyReqPathResolver: (req) => `/api/auth${req.url}`
}));

// 需要认证的用户相关路由
app.use('/api/users', authenticateToken, proxy(userServiceUrl, {
  proxyReqPathResolver: (req) => `/api/users${req.url}`
}));

app.use('/api/students', authenticateToken, proxy(userServiceUrl, {
  proxyReqPathResolver: (req) => `/api/students${req.url}`
}));

// 需要认证的数据服务路由
app.use('/api/data', authenticateToken, proxy(dataServiceUrl, {
  proxyReqPathResolver: (req) => `/api/data${req.url}`
}));

// (其他之前定义的代理路由，如 progress, interaction, notification, resource, analytics)
// ... 如果这些服务存在并且需要通过网关暴露 ...
// app.use('/api/progress', authenticateToken, proxy(config.serviceHosts.progress, { proxyReqPathResolver: (req) => `/api/progress${req.url}` }));
// ...以此类推...

// 4. 健康检查 (可以由 createBaseApp 提供一个更通用的，或者网关可以有自己的)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'api-gateway' });
});

// 5. 启动服务器
const PORT = process.env.GATEWAY_PORT || config.port || 5000; // 网关通常在不同端口
if (!PORT) {
  logger.error('FATAL ERROR: Port for API Gateway is not defined.');
  process.exit(1);
}
app.listen(PORT, () => {
  logger.info(`API Gateway service running on port ${PORT}`);
});