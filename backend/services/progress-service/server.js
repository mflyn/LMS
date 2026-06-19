const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const config = require('./config');
const progressRoutes = require('./routes/progress');
const reportRoutes = require('./routes/reports');
const growthLogRoutes = require('./routes/growthLogs');
const knowledgePointRoutes = require('./routes/knowledgePoints');
const internalStarRoutes = require('./routes/internalStars');
const rewardRoutes = require('./routes/rewards');
const { errorHandler, requestTracker } = require('../../common/middleware/errorHandler');
const { createLogger } = require('../../common/config/logger');

const logger = createLogger('progress-service');

const createApp = () => {
  const app = express();
  app.locals.logger = logger;
  app.locals.serviceName = 'progress-service';

  app.use(cors());
  app.use(express.json());
  app.use(requestTracker);
  app.use('/api/progress', progressRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/growth-logs', growthLogRoutes);
  app.use('/api/knowledge-points', knowledgePointRoutes);
  app.use('/api/internal/stars', internalStarRoutes);
  app.use('/api/rewards', rewardRoutes);
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'progress-service' });
  });
  app.use(errorHandler);

  return app;
};

const connectDatabase = async ({
  mongooseInstance = mongoose,
  mongoURI = config.db.uri
} = {}) => {
  if (mongooseInstance.connection.readyState !== 0) {
    return mongooseInstance.connection;
  }

  await mongooseInstance.connect(mongoURI, config.db.options);
  logger.info('MongoDB connected');
  return mongooseInstance.connection;
};

const startServer = async ({
  app = createApp(),
  port = config.server.port,
  connect = connectDatabase
} = {}) => {
  await connect();
  return app.listen(port, () => {
    logger.info(`Progress service running on port ${port}`);
  });
};

const app = createApp();

if (require.main === module) {
  startServer({ app }).catch((error) => {
    logger.error('Progress service failed to start', { error: error.message, stack: error.stack });
    process.exitCode = 1;
  });
}

module.exports = app;
module.exports.connectDatabase = connectDatabase;
module.exports.createApp = createApp;
module.exports.startServer = startServer;
