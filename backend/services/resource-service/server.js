const mongoose = require('mongoose');
const appModule = require('./app');
const { createLogger } = require('../../common/config/logger');

const logger = createLogger('resource-service');
const createApp = appModule.createApp;

const connectDatabase = async ({
  mongooseInstance = mongoose,
  mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/learning-tracker'
} = {}) => {
  if (mongooseInstance.connection.readyState === 0) {
    await mongooseInstance.connect(mongoURI);
  }
  return mongooseInstance.connection;
};

const startServer = async ({
  app = createApp(),
  port = Number(process.env.PORT || 3005),
  connect = connectDatabase
} = {}) => {
  await connect();
  return app.listen(port, () => {
    logger.info('Resource service started', { port });
  });
};

const app = createApp();

if (require.main === module) {
  startServer({ app }).catch((error) => {
    logger.error('Resource service failed to start', { error: error.message, stack: error.stack });
    process.exitCode = 1;
  });
}

module.exports = app;
module.exports.connectDatabase = connectDatabase;
module.exports.createApp = createApp;
module.exports.startServer = startServer;
