const proxy = require('express-http-proxy');
const { jwtSecret: defaultJwtSecret } = require('../common/config/auth');
const createBaseApp = require('../common/createBaseApp');
const config = require('./config');
const { createLogger } = require('../common/config/logger');
const { errorHandler } = require('../common/middleware/errorHandler');
const { createAuthenticateToken, stripClientIdentity } = require('./identityMiddleware');

const logger = createLogger('api-gateway');

const requireServiceHost = (serviceHosts, name) => {
  const value = serviceHosts && serviceHosts[name];
  if (!value) throw new Error(`Missing gateway service host: ${name}`);
  return value;
};

const resolveProxyPath = (prefix, url = '') => {
  if (url === '/') return prefix;
  if (url.startsWith('/?')) return `${prefix}${url.slice(1)}`;
  return `${prefix}${url}`;
};

const mountProtectedProxy = (app, prefix, serviceUrl, authenticateToken, proxyOptions = {}) => {
  app.use(prefix, authenticateToken, proxy(serviceUrl, {
    ...proxyOptions,
    proxyReqPathResolver: (req) => resolveProxyPath(prefix, req.url)
  }));
};

const createApp = ({
  serviceHosts = config.serviceHosts,
  jwtSecret = defaultJwtSecret,
  identitySecret = process.env.GATEWAY_IDENTITY_SECRET,
  appLogger = logger
} = {}) => {
  const userServiceUrl = requireServiceHost(serviceHosts, 'user');
  const dataServiceUrl = requireServiceHost(serviceHosts, 'data');
  const app = createBaseApp({ serviceName: 'api-gateway', enableSessions: false });
  app.locals = app.locals || {};
  app.locals.logger = appLogger;
  const authenticateToken = createAuthenticateToken({ jwtSecret, identitySecret });
  app.locals.authenticateToken = authenticateToken;

  app.use(stripClientIdentity);
  app.use('/api/auth', proxy(userServiceUrl, {
    proxyReqPathResolver: (req) => resolveProxyPath('/api/auth', req.url)
  }));

  ['/api/users', '/api/students', '/api/families', '/api/children'].forEach((prefix) => {
    mountProtectedProxy(app, prefix, userServiceUrl, authenticateToken);
  });
  mountProtectedProxy(app, '/api/data', dataServiceUrl, authenticateToken);

  if (serviceHosts.analytics) {
    ['/api/analytics', '/api/mistakes', '/api/reports/weekly'].forEach((prefix) => {
      mountProtectedProxy(app, prefix, serviceHosts.analytics, authenticateToken);
    });
  }
  if (serviceHosts.homework) {
    ['/api/homework', '/api/growth-tasks'].forEach((prefix) => {
      mountProtectedProxy(app, prefix, serviceHosts.homework, authenticateToken);
    });
  }
  if (serviceHosts.progress) {
    ['/api/progress', '/api/growth-logs', '/api/knowledge-points', '/api/rewards'].forEach((prefix) => {
      mountProtectedProxy(app, prefix, serviceHosts.progress, authenticateToken);
    });
  }
  if (serviceHosts.notification) {
    ['/api/notifications/family', '/api/notifications/settings'].forEach((prefix) => {
      mountProtectedProxy(app, prefix, serviceHosts.notification, authenticateToken);
    });
  }
  if (serviceHosts.resource) {
    app.use('/api/media/:mediaId/content', proxy(serviceHosts.resource, {
      proxyReqPathResolver: (req) => req.originalUrl
        || `/api/media/${req.params.mediaId}/content${req.url}`
    }));
    mountProtectedProxy(app, '/api/media', serviceHosts.resource, authenticateToken, {
      parseReqBody: false
    });
  }

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'api-gateway' });
  });
  app.use(errorHandler);
  return app;
};

const startServer = async ({
  app = createApp(),
  port = Number(process.env.PORT || process.env.GATEWAY_PORT || config.port || 5000),
  appLogger = logger
} = {}) => {
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(port, () => resolve(listener));
    listener.once('error', reject);
  });
  appLogger.info('API Gateway service started', { port: server.address().port });
  return server;
};

const app = createApp();

if (require.main === module) {
  startServer({ app }).catch((error) => {
    logger.error('API Gateway failed to start', { error: error.message, stack: error.stack });
    process.exitCode = 1;
  });
}

module.exports = app;
module.exports.authenticateToken = app.locals.authenticateToken;
module.exports.createApp = createApp;
module.exports.port = Number(process.env.PORT || process.env.GATEWAY_PORT || config.port || 5000);
module.exports.startServer = startServer;
