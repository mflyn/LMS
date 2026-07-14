const amqp = require('amqplib');
const cors = require('cors');
const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');

const { createLogger } = require('../../common/config/logger');
const { createMediaReferenceClient } = require('../../common/services/mediaReferenceClient');
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
const { createGrowthTaskAttachmentMediaService } = require('./services/growthTaskAttachmentMediaService');
const { validateClientConfig } = require('./services/starAwardClient');

const logger = createLogger('homework-service');

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
    attachmentMediaService: createGrowthTaskAttachmentMediaService({
      GrowthTaskModel: GrowthTask,
      mediaReferenceClient,
      randomUUID,
      logger: appLogger
    })
  };
};

const createApp = ({
  growthTaskRouter = growthTaskRoutes,
  homeworkRouter = homeworkRoutes,
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
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'homework-service' });
  });
  app.use(errorHandler);
  return app;
};

const createProductionApp = ({
  env = process.env,
  createMediaDependencies = createTask6MediaDependencies,
  growthTaskRouterFactory = createGrowthTaskRouter,
  appLogger = logger
} = {}) => {
  const { attachmentMediaService } = createMediaDependencies({ env, appLogger });
  return createApp({
    growthTaskRouter: growthTaskRouterFactory({ attachmentMediaService }),
    appLogger
  });
};

const connectDatabase = async ({
  mongooseInstance = mongoose,
  mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/learning-tracker'
} = {}) => {
  if (!mongoURI) throw new Error('MONGO_URI for homework-service is required');
  if (mongooseInstance.connection.readyState === 0) {
    await mongooseInstance.connect(mongoURI);
  }
  return mongooseInstance.connection;
};

const connectRabbitMQ = async ({
  rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost',
  amqpClient = amqp,
  appLogger = logger
} = {}) => {
  const connection = await amqpClient.connect(rabbitUrl);
  const channel = await connection.createChannel();
  const exchange = 'homework.events';
  await channel.assertExchange(exchange, 'topic', { durable: true });
  appLogger.info('Homework RabbitMQ connected');
  return { connection, channel, exchange };
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

const validateStarAwardEnvironment = (env = process.env) => validateClientConfig({
  progressServiceUrl: env.PROGRESS_SERVICE_URL || 'http://progress-service:3002',
  internalServiceToken: env.INTERNAL_SERVICE_TOKEN,
  timeout: Number(env.STAR_AWARD_TIMEOUT_MS || 3000),
  retryAttempts: Number(env.STAR_AWARD_RETRY_ATTEMPTS || 1),
  retryBackoffMs: Number(env.STAR_AWARD_RETRY_BACKOFF_MS || 100),
  maxRetryBackoffMs: Number(env.STAR_AWARD_MAX_RETRY_BACKOFF_MS || 1000)
});

const startServer = async ({
  app = null,
  port = Number(process.env.PORT || 3003),
  connect = connectDatabase,
  createRuntimeApp = createProductionApp,
  initializeQueue = initializeMessageQueue,
  validateEnvironment = validateStarAwardEnvironment,
  appLogger = logger
} = {}) => {
  validateEnvironment();
  await connect();
  const runtimeApp = app || createRuntimeApp({ appLogger });
  let server;
  await new Promise((resolve, reject) => {
    server = runtimeApp.listen(port, resolve);
    server.once('error', reject);
  });
  try {
    await initializeQueue({ app: runtimeApp });
  } catch (error) {
    await new Promise((resolve) => server.close(resolve));
    throw error;
  }
  appLogger.info('Homework service started', { port: server.address().port });
  return server;
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
    logger.error('Homework service failed to start', { error: error.message, stack: error.stack });
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
