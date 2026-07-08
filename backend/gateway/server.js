const express = require('express');
const proxy = require('express-http-proxy');
const { jwtSecret } = require('../common/config/auth');
const createBaseApp = require('../common/createBaseApp');
const config = require('./config');
const { createLogger } = require('../common/config/logger');
const { errorHandler } = require('../common/middleware/errorHandler');
const { createAuthenticateToken, stripClientIdentity } = require('./identityMiddleware');
const logger = createLogger('api-gateway');

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

const authenticateToken = createAuthenticateToken({
  jwtSecret,
  identitySecret: process.env.GATEWAY_IDENTITY_SECRET
});

app.use(stripClientIdentity);

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

app.use('/api/families', authenticateToken, proxy(userServiceUrl, {
  proxyReqPathResolver: (req) => `/api/families${req.url}`
}));

app.use('/api/children', authenticateToken, proxy(userServiceUrl, {
  proxyReqPathResolver: (req) => `/api/children${req.url}`
}));

// 需要认证的数据服务路由 - 修正：确保路由路径与设计文档一致
app.use('/api/data', authenticateToken, proxy(dataServiceUrl, {
  proxyReqPathResolver: (req) => `/api/data${req.url}`
}));

// 添加其他核心服务路由（如果存在）
if (config.serviceHosts.analytics) {
  app.use('/api/analytics', authenticateToken, proxy(config.serviceHosts.analytics, {
    proxyReqPathResolver: (req) => `/api/analytics${req.url}`
  }));

  ['/api/mistakes', '/api/reports/weekly'].forEach((prefix) => {
    app.use(prefix, authenticateToken, proxy(config.serviceHosts.analytics, {
      proxyReqPathResolver: (req) => `${prefix}${req.url}`
    }));
  });
}

if (config.serviceHosts.homework) {
  app.use('/api/homework', authenticateToken, proxy(config.serviceHosts.homework, {
    proxyReqPathResolver: (req) => `/api/homework${req.url}`
  }));

  app.use('/api/growth-tasks', authenticateToken, proxy(config.serviceHosts.homework, {
    proxyReqPathResolver: (req) => `/api/growth-tasks${req.url}`
  }));
}

if (config.serviceHosts.progress) {
  app.use('/api/progress', authenticateToken, proxy(config.serviceHosts.progress, {
    proxyReqPathResolver: (req) => `/api/progress${req.url}`
  }));

  ['/api/growth-logs', '/api/knowledge-points', '/api/rewards'].forEach((prefix) => {
    app.use(prefix, authenticateToken, proxy(config.serviceHosts.progress, {
      proxyReqPathResolver: (req) => `${prefix}${req.url}`
    }));
  });
}

if (config.serviceHosts.notification) {
  ['/api/notifications/family', '/api/notifications/settings'].forEach((prefix) => {
    app.use(prefix, authenticateToken, proxy(config.serviceHosts.notification, {
      proxyReqPathResolver: (req) => `${prefix}${req.url}`
    }));
  });
}

if (config.serviceHosts.resource) {
  app.use('/api/media/:mediaId/content', proxy(config.serviceHosts.resource, {
    proxyReqPathResolver: (req) => req.originalUrl
      || `/api/media/${req.params.mediaId}/content${req.url}`
  }));

  app.use('/api/media', authenticateToken, proxy(config.serviceHosts.resource, {
    proxyReqPathResolver: (req) => `/api/media${req.url}`
  }));
}

// (其他之前定义的代理路由，如 progress, interaction, notification, resource, analytics)
// ... 如果这些服务存在并且需要通过网关暴露 ...
// app.use('/api/progress', authenticateToken, proxy(config.serviceHosts.progress, { proxyReqPathResolver: (req) => `/api/progress${req.url}` }));
// ...以此类推...

// 4. 健康检查 (可以由 createBaseApp 提供一个更通用的，或者网关可以有自己的)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'api-gateway' });
});

app.use(errorHandler);

const PORT = Number(process.env.PORT || process.env.GATEWAY_PORT || config.port || 5000);

const startServer = () => app.listen(PORT, () => {
  logger.info(`API Gateway service running on port ${PORT}`);
});

if (require.main === module) {
  startServer();
}

module.exports = app;
module.exports.authenticateToken = authenticateToken;
module.exports.startServer = startServer;
module.exports.port = PORT;
