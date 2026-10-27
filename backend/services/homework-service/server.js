const amqp = require('amqplib');
const cors = require('cors');
const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');

const { createLogger } = require('../../common/config/logger');
const { createMediaReferenceClient, validateMediaReferenceClientConfig } = require('../../common/services/mediaReferenceClient');
const {
  errorHandler,
  requestTracker,
  requestTimeout,
  setupUncaughtExceptionHandler
} = require('../../common/middleware/errorHandler');
const homeworkRoutes = require('./routes/homework');
const growthTaskRoutes = require('./routes/growthTasks');
const { createGrowthTaskRouter } = growthTaskRoutes;
const GrowthTask = require('./models/GrowthTask');
const { createDailyLearningPlanRouter } = require('./routes/dailyLearningPlans');
const { createGrowthTaskAttachmentMediaService } = require('./services/growthTaskAttachmentMediaService');
const { validateClientConfig } = require('./services/starAwardClient');
const { resolveCompletionMode, assertCompletionAssemblyAvailable, withCompletionMode,
  assertCompletionConnection, startCompletionService, closeQueue } = require('../../common/services/completionActivation');

const logger = createLogger('homework-service');

const createTask6MediaDependencies = ({
  env = process.env,
  mediaReferenceClientFactory = createMediaReferenceClient,
  randomUUID = crypto.randomUUID,
  appLogger = logger,
  completionIsolation = false
} = {}) => {
  const mediaReferenceClient = mediaReferenceClientFactory({
    resourceServiceUrl: env.RESOURCE_SERVICE_URL,
    serviceToken: env.MEDIA_REFERENCE_SERVICE_TOKEN,
    timeout: Number(env.MEDIA_REFERENCE_TIMEOUT_MS || 3000)
  });
  return {
    attachmentMediaService: createGrowthTaskAttachmentMediaService({
      GrowthTaskModel: GrowthTask,
      mediaReferenceClient,
      randomUUID,
      logger: appLogger,
      completionIsolation
    })
  };
};

const createApp = ({
  growthTaskRouter = growthTaskRoutes,
  homeworkRouter = homeworkRoutes,
  retirementRouter,
  appLogger = logger
} = {}) => {
  const app = express();
  app.locals.logger = appLogger;
  app.locals.serviceName = 'homework-service';
  app.locals.mq = null;

  app.use(cors());
  app.use(express.json());
  app.use(requestTracker);
  app.use(requestTimeout());
  app.use('/api/homework', homeworkRouter);
  app.use('/api/growth-tasks', growthTaskRouter);
  app.use('/api/children', createDailyLearningPlanRouter());
  if (retirementRouter) app.use('/api/internal/completion-media-retirements', retirementRouter);
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'homework-service' });
  });
  app.use(errorHandler);
  return app;
};

const createProductionApp = ({
  env = process.env,
  connection = mongoose.connection,
  createMediaDependencies,
  growthTaskRouterFactory,
  appLogger = logger
} = {}) => {
  const mode = resolveCompletionMode(env);
  assertCompletionAssemblyAvailable(mode, 'homework');
  if (mode === 'enabled' && (createMediaDependencies || growthTaskRouterFactory)) {
    throw Object.assign(new Error('COMPLETION_ASSEMBLY_NOT_READY'), { code: 'COMPLETION_ASSEMBLY_NOT_READY' });
  }
  assertCompletionConnection(connection, mongoose.connection);
  const { attachmentMediaService } = (createMediaDependencies || createTask6MediaDependencies)({
    env, appLogger, completionIsolation: mode === 'enabled' });
  let growthTaskRouter, retirementRouter;
  if (mode === 'enabled') {
    const { runMongoTransaction } = require('../../common/services/mongoTransaction');
    const { createCompletionMediaReferenceClient } = require('../../common/services/completionMediaReferenceClient');
    const { createStarAwardClient } = require('./services/starAwardClient');
    const { createGrowthTaskCompletionService } = require('./services/growthTaskCompletionService');
    const { createGrowthTaskCompletionConfirmationService } = require('./services/growthTaskCompletionConfirmationService');
    const { createGrowthTaskCompletionReadService } = require('./services/growthTaskCompletionReadService');
    const { createGrowthTaskCompletionMutationService } = require('./services/growthTaskCompletionMutationService');
    const { createGrowthTaskCompletionProductionRouter } = require('./routes/growthTaskCompletionProduction');
    const { createCompletionMediaRetirementService } = require('./services/completionMediaRetirementService');
    const { createCompletionMediaRetirementRouter } = require('./routes/completionMediaRetirements');
    const transactionRunner = work => runMongoTransaction({ mongooseInstance: connection, work });
    const mediaReferenceClient = createCompletionMediaReferenceClient({ resourceServiceUrl: env.RESOURCE_SERVICE_URL,
      serviceToken: env.MEDIA_REFERENCE_SERVICE_TOKEN, timeout: Number(env.MEDIA_REFERENCE_TIMEOUT_MS || 3000) });
    const { awardTaskStar } = createStarAwardClient(starAwardConfig(env));
    growthTaskRouter = createGrowthTaskCompletionProductionRouter({ transactionRunner, attachmentMediaService,
      completionService: createGrowthTaskCompletionService({ transactionRunner, mediaReferenceClient }),
      confirmationService: createGrowthTaskCompletionConfirmationService({ transactionRunner, awardTaskStar }),
      readService: createGrowthTaskCompletionReadService({ transactionRunner }),
      mutationService: createGrowthTaskCompletionMutationService({ transactionRunner }) });
    retirementRouter = createCompletionMediaRetirementRouter({ env,
      service: createCompletionMediaRetirementService({ transactionRunner }) });
  } else {
    growthTaskRouter = (growthTaskRouterFactory || createGrowthTaskRouter)({ attachmentMediaService });
  }
  return withCompletionMode(createApp({
    growthTaskRouter,
    retirementRouter,
    appLogger
  }), { mode, service: 'homework', env });
};

const connectDatabase = async ({
  mongooseInstance = mongoose,
  connection = mongooseInstance.connection,
  mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/learning-tracker'
} = {}) => {
  if (!mongoURI) throw new Error('MONGO_URI for homework-service is required');
  if (connection.readyState === 0) {
    const options = { autoIndex: false, autoCreate: false,
      serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, socketTimeoutMS: 15000 };
    if (connection === mongooseInstance.connection) await mongooseInstance.connect(mongoURI, options);
    else await connection.openUri(mongoURI, options);
  }
  return connection;
};

const connectRabbitMQ = async ({
  rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost',
  amqpClient = amqp,
  appLogger = logger
} = {}) => {
  const connection = await amqpClient.connect(rabbitUrl);
  let channel;
  try {
    channel = await connection.createChannel();
    const exchange = 'homework.events';
    await channel.assertExchange(exchange, 'topic', { durable: true });
    appLogger.info('Homework RabbitMQ connected');
    return { connection, channel, exchange };
  } catch (cause) {
    await closeQueue({ channel, connection });
    throw cause;
  }
};

const initializeMessageQueue = async ({
  app,
  enableRabbitMQ = process.env.ENABLE_RABBITMQ !== 'false' && process.env.NODE_ENV !== 'test',
  connect = connectRabbitMQ
} = {}) => {
  if (!enableRabbitMQ) {
    app.locals.mq = {
      channel: { publish: () => true },
      exchange: 'homework.events'
    };
    return app.locals.mq;
  }
  app.locals.mq = await connect();
  return app.locals.mq;
};

const starAwardConfig = (env = process.env) => ({
  progressServiceUrl: env.PROGRESS_SERVICE_URL || 'http://progress-service:3002',
  internalServiceToken: env.INTERNAL_SERVICE_TOKEN,
  timeout: Number(env.STAR_AWARD_TIMEOUT_MS || 3000),
  retryAttempts: Number(env.STAR_AWARD_RETRY_ATTEMPTS || 1),
  retryBackoffMs: Number(env.STAR_AWARD_RETRY_BACKOFF_MS || 100),
  maxRetryBackoffMs: Number(env.STAR_AWARD_MAX_RETRY_BACKOFF_MS || 1000)
});
const validateStarAwardEnvironment = (env = process.env) => validateClientConfig(starAwardConfig(env));

const validateStartupEnvironment = env => {
  validateStarAwardEnvironment(env);
  validateMediaReferenceClientConfig({ resourceServiceUrl: env.RESOURCE_SERVICE_URL,
    serviceToken: env.MEDIA_REFERENCE_SERVICE_TOKEN, timeout: Number(env.MEDIA_REFERENCE_TIMEOUT_MS || 3000) });
  if (resolveCompletionMode(env) === 'enabled') {
    require('../../common/middleware/completionRetirementCredential').createCompletionRetirementCredential(env);
  }
};

const startServer = async ({
  app = null,
  env = process.env,
  connection = mongoose.connection,
  host,
  port = Number(process.env.PORT || 3003),
  connect = connectDatabase,
  createRuntimeApp = createProductionApp,
  initializeQueue = initializeMessageQueue,
  validateEnvironment = validateStartupEnvironment,
  appLogger = logger
} = {}) => {
  return startCompletionService({ service: 'homework', env, connection, app, port, host, appLogger,
    connect: () => connect({ mongoURI: env.MONGO_URI, connection }), createRuntimeApp,
    validateEnvironment: runtimeEnv => {
      if (runtimeEnv.COMPLETION_PROTOCOL_MODE === 'enabled' && createRuntimeApp !== createProductionApp) {
        throw Object.assign(new Error('COMPLETION_ASSEMBLY_NOT_READY'), { code: 'COMPLETION_ASSEMBLY_NOT_READY' });
      }
      if (!app && createRuntimeApp === createProductionApp) assertCompletionConnection(connection, mongoose.connection);
      validateEnvironment(runtimeEnv);
    },
    checkEnabled: async options => {
      await require('./services/growthTaskCompletionReadiness').assertGrowthTaskCompletionReadiness(options);
      await require('./services/completionMediaGuardReadiness').assertCompletionMediaGuardReadiness(options);
    },
    initializeRuntime: ({ app: runtimeApp }) => initializeQueue({ app: runtimeApp,
      enableRabbitMQ: env.ENABLE_RABBITMQ !== 'false' && env.NODE_ENV !== 'test',
      connect: () => connectRabbitMQ({ rabbitUrl: env.RABBITMQ_URL, appLogger }) }) });
};

const app = createApp();

if (require.main === module) {
  setupUncaughtExceptionHandler(logger);
  startServer().then((server) => {
    process.on('SIGTERM', () => {
      server.close(() => {
        mongoose.connection.close(false).finally(() => {
          process.exitCode = 0;
        });
      });
    });
  }).catch((error) => {
    logger.error('Homework service failed to start', { code: error.code });
    process.exitCode = 1;
  });
}

module.exports = app;
module.exports.connectDatabase = connectDatabase;
module.exports.connectRabbitMQ = connectRabbitMQ;
module.exports.createApp = createApp;
module.exports.createProductionApp = createProductionApp;
module.exports.createTask6MediaDependencies = createTask6MediaDependencies;
module.exports.initializeMessageQueue = initializeMessageQueue;
module.exports.startServer = startServer;
module.exports.validateStarAwardEnvironment = validateStarAwardEnvironment;
