const express = require('express');
const cors = require('cors');

const routes = require('./routes');
const { errorHandler, requestTracker } = require('../../common/middleware/errorHandler');
const { createLogger } = require('../../common/config/logger');

const createApp = ({
  logger = createLogger('notification-service'),
  familyNotificationsRouter = null
} = {}) => {
  const app = express();
  app.locals.logger = logger;
  app.locals.serviceName = 'notification-service';

  app.use(cors());
  app.use(express.json());
  app.use(requestTracker);

  if (familyNotificationsRouter) {
    app.use('/api/notifications/family', familyNotificationsRouter);
  }

  app.use('/api/notifications', routes);

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'notification-service' });
  });

  app.use(errorHandler);

  return app;
};

module.exports = createApp();
module.exports.createApp = createApp;
