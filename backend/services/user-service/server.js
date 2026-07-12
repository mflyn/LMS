const mongoose = require('mongoose');
const createBaseApp = require('../../common/createBaseApp');
const config = require('./config');
const routesModule = require('./routes');
const { createLogger } = require('../../common/config/logger');
const { errorHandler, setupUncaughtExceptionHandler } = require('../../common/middleware/errorHandler');

const logger = createLogger('user-service');

const createApp = ({ routes = routesModule, appLogger = logger } = {}) => {
  const app = createBaseApp({
    serviceName: 'user-service',
    enableSessions: false
  });
  app.locals.logger = appLogger;
  app.use('/api', routes);
  app.use(errorHandler);
  return app;
};

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
  return mongooseInstance.connection;
};

const startServer = async ({
  app = createApp(),
  port = Number(config.port || process.env.USER_SERVICE_PORT || 3001),
  connect = connectDatabase,
  appLogger = logger
} = {}) => {
  await connect();
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(port, () => resolve(listener));
    listener.once('error', reject);
  });
  appLogger.info('User service started', { port: server.address().port });
  return server;
};

const app = createApp();

if (require.main === module) {
  setupUncaughtExceptionHandler(logger);
  startServer({ app }).catch((error) => {
    logger.error('User service failed to start', { error: error.message, stack: error.stack });
    process.exitCode = 1;
  });
}

module.exports = app;
module.exports.connectDatabase = connectDatabase;
module.exports.createApp = createApp;
module.exports.startServer = startServer;
