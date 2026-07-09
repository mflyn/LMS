const express = require('express');
const cors = require('cors');
const { createLogger } = require('../../common/config/logger');
const { errorHandler, requestTracker, requestTimeout } = require('../../common/middleware/errorHandler');
const progressRouter = require('./routes/progress');
const reportsRouter = require('./routes/reports');
const trendsRouter = require('./routes/trends');
const longTermTrendsRouter = require('./routes/long-term-trends');
const behaviorRouter = require('./routes/behavior');
const integrationRouter = require('./routes/integration');
const performanceRouter = require('./routes/performance');
const { createFamilyMistakesRouter } = require('./routes/familyMistakes');
const { createWeeklyReportsRouter } = require('./routes/weeklyReports');

const createApp = ({
  logger = createLogger('analytics-service'),
  io = null,
  familyMistakeMediaService = null,
  familyMistakesRouter = createFamilyMistakesRouter({ familyMistakeMediaService }),
  weeklyReportsRouter = createWeeklyReportsRouter()
} = {}) => {
  const app = express();
  app.locals.logger = logger;
  app.locals.serviceName = 'analytics-service';
  app.locals.io = io;

  app.use(cors());
  app.use(express.json());
  app.use(requestTracker);
  app.use(requestTimeout());
  if (familyMistakesRouter) app.use('/api/mistakes', familyMistakesRouter);
  if (weeklyReportsRouter) app.use('/api/reports/weekly', weeklyReportsRouter);
  app.use('/api/analytics/progress', progressRouter);
  app.use('/api/analytics/reports', reportsRouter);
  app.use('/api/analytics/trends', trendsRouter);
  app.use('/api/analytics/long-term-trends', longTermTrendsRouter);
  app.use('/api/analytics/behavior', behaviorRouter);
  app.use('/api/analytics/performance', performanceRouter);
  app.use('/api/analytics', integrationRouter);
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'analytics-service' });
  });
  app.use(errorHandler);

  return app;
};

module.exports = createApp();
module.exports.createApp = createApp;
