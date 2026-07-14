const crypto = require('crypto');
const mongoose = require('mongoose');
const createBaseApp = require('../../common/createBaseApp');
const User = require('../../common/models/User');
const { createMediaReferenceClient } = require('../../common/services/mediaReferenceClient');
const config = require('./config');
const routesModule = require('./routes');
const { createChildAvatarMediaService } = require('./services/childAvatarMediaService');
const { createLogger } = require('../../common/config/logger');
const { errorHandler, setupUncaughtExceptionHandler } = require('../../common/middleware/errorHandler');
const { assertTransactionCapability } = require('../../common/services/mongoTransaction');

const logger = createLogger('user-service');

const createTask6MediaDependencies = ({
  env = process.env,
  mediaReferenceClientFactory = createMediaReferenceClient,
  randomUUID = crypto.randomUUID,
  appLogger = logger
} = {}) => {
  const mediaReferenceClient = mediaReferenceClientFactory({
    resourceServiceUrl: env.RESOURCE_SERVICE_URL,
    serviceToken: env.MEDIA_REFERENCE_SERVICE_TOKEN,
    timeout: Number(env.MEDIA_REFERENCE_TIMEOUT_MS || 3000)
  });
  return {
    childAvatarMediaService: createChildAvatarMediaService({
      UserModel: User,
      mediaReferenceClient,
      randomUUID,
      logger: appLogger
    })
  };
};

const createApp = ({ routes = routesModule, appLogger = logger } = {}) => {
  const app = createBaseApp({
    serviceName: 'user-service',
    enableSessions: false
  });
  app.locals.logger = appLogger;
  app.use('/api', routes);
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'user-service' });
  });
  app.use(errorHandler);
  return app;
};

const createProductionApp = ({
  env = process.env,
  createMediaDependencies = createTask6MediaDependencies,
  routesFactory = routesModule.createRoutes,
  appLogger = logger
} = {}) => createApp({
  routes: routesFactory(createMediaDependencies({ env, appLogger })),
  appLogger
});

const connectDatabase = async ({
  mongooseInstance = mongoose,
  mongoURI = config.mongoURI
} = {}) => {
  if (!mongoURI) {
    throw new Error('mongoURI for user-service is required');
  }
  if (mongooseInstance.connection.readyState === 0) {
    await mongooseInstance.connect(mongoURI);
  }
  await assertTransactionCapability(mongooseInstance.connection, 'user-service');
  return mongooseInstance.connection;
};

const startServer = async ({
  app = null,
  port = Number(config.port || process.env.USER_SERVICE_PORT || 3001),
  connect = connectDatabase,
  createRuntimeApp = createProductionApp,
  appLogger = logger
} = {}) => {
  await connect();
  const runtimeApp = app || createRuntimeApp();
  let server;
  await new Promise((resolve, reject) => {
    server = runtimeApp.listen(port, resolve);
    server.once('error', reject);
  });
  appLogger.info('User service started', { port: server.address().port });
  return server;
};

const app = createApp();

if (require.main === module) {
  setupUncaughtExceptionHandler(logger);
  startServer().catch((error) => {
    logger.error('User service failed to start', { error: error.message, stack: error.stack });
    process.exitCode = 1;
  });
}

module.exports = app;
module.exports.connectDatabase = connectDatabase;
module.exports.createApp = createApp;
module.exports.createProductionApp = createProductionApp;
module.exports.createTask6MediaDependencies = createTask6MediaDependencies;
module.exports.startServer = startServer;
