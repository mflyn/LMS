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
const { errorHandler, requestTracker, requestTimeout } = require('../../common/middleware/errorHandler');
const { createLogger } = require('../../common/config/logger');
const { createAi3Runtime } = require('./services/ai3Runtime');
const { validateAi3Environment } = require('../../common/services/ai3Activation');

const logger = createLogger('progress-service');

const assertTransactionCapability = async (connection) => {
  const hello = await connection.db.admin().command({ hello: 1 });
  const transactionReady = Boolean(hello.setName)
    && hello.isWritablePrimary === true
    && Number.isInteger(hello.maxWireVersion)
    && hello.maxWireVersion >= 7
    && Number.isFinite(hello.logicalSessionTimeoutMinutes);

  if (!transactionReady) {
    throw new Error('progress-service requires a transaction-capable writable replica-set primary');
  }

  return hello;
};

const createApp = ({ ai3EvidenceRouter } = {}) => {
  const app = express();
  app.locals.logger = logger;
  app.locals.serviceName = 'progress-service';

  app.use(cors());
  if (ai3EvidenceRouter) app.use('/api/internal/ai3', ai3EvidenceRouter);
  app.use(express.json());
  app.use(requestTracker);
  app.use(requestTimeout());
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
  env = process.env,
  mongooseInstance = mongoose,
  mongoURI = config.db.uri
} = {}) => {
  if (mongooseInstance.connection.readyState === 0) {
    const options = validateAi3Environment(env).continuousStore ? { ...config.db.options, autoIndex: false, autoCreate: false } : config.db.options;
    await mongooseInstance.connect(mongoURI, options);
  }

  const hello = await assertTransactionCapability(mongooseInstance.connection);
  logger.info('MongoDB connected with transaction support', { replicaSet: hello.setName });
  return mongooseInstance.connection;
};

const createProductionApp = ({ env = process.env, connection = mongoose.connection } = {}) => {
  const runtime = createAi3Runtime({ env, connection });
  const app = createApp({ ai3EvidenceRouter: runtime.router });
  app.locals.assertAi3Ready = runtime.assertReady;
  return app;
};

const startServer = async ({
  app = null,
  env = process.env,
  connection = mongoose.connection,
  host,
  port = config.server.port,
  connect = connectDatabase
} = {}) => {
  const ai3Config = validateAi3Environment(env);
  if (ai3Config.continuousStore && (app || connection !== mongoose.connection || connect !== connectDatabase)) {
    throw Object.assign(new Error('AI3_NOT_READY'), { code: 'AI3_NOT_READY' });
  }
  const ownsConnection = connection.readyState === 0;
  let runtimeApp, server;
  try {
    await connect({ env, mongoURI: env.MONGO_URI || config.db.uri });
    runtimeApp = app || createProductionApp({ env, connection });
    if (runtimeApp.locals.assertAi3Ready) await runtimeApp.locals.assertAi3Ready();
    let onError;
    await new Promise((resolve, reject) => {
      onError = reject;
      server = host === undefined ? runtimeApp.listen(port, resolve) : runtimeApp.listen(port, host, resolve);
      server.once('error', onError);
    });
    server.removeListener('error', onError);
    logger.info(`Progress service running on port ${port}`);
    return server;
  } catch (cause) {
    // A failed listener belongs to this startup, even when the database belongs to its caller.
    try {
      if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    } catch (_) { /* Continue to the owned database even if HTTP cleanup fails. */ }
    try { if (ownsConnection) await connection.close(); } catch (_) { /* Keep the original startup failure. */ }
    throw cause;
  }
};

const app = createApp();

if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Progress service failed to start', { error: error.message, stack: error.stack });
    process.exitCode = 1;
  });
}

module.exports = app;
module.exports.assertTransactionCapability = assertTransactionCapability;
module.exports.connectDatabase = connectDatabase;
module.exports.createApp = createApp;
module.exports.createProductionApp = createProductionApp;
module.exports.startServer = startServer;
