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
const { createLearningSourceReader, createLearningSourceRouter } = require('../../common/services/learningSource');
const { createDailyLearningPlanRouter } = require('./routes/dailyLearningPlans');
const { createAi1Router, createAi1JsonParser } = require('./routes/ai1');
const { createAi1Service } = require('./services/ai1Service');
const { createAi1Runtime } = require('./services/ai1Runtime');
const { createAi2Router, createAi2JsonParser } = require('./routes/ai2');
const { createAi2MediaAccessRouter, checkAi2MediaAccess } = require('./routes/ai2MediaAccess');
const { createAi2Service } = require('./services/ai2Service');
const { createAi2Runtime } = require('./services/ai2Runtime');
const { createAi3Router, createAi3JsonParser } = require('./routes/ai3');
const { createAi3Service } = require('./services/ai3Service');
const { createAi3SourceReader } = require('./services/ai3SourceReader');
const { createAi3Runtime } = require('./services/ai3Runtime');
const { validateAi3Environment } = require('../../common/services/ai3Activation');
const { createAi3EvidenceClient } = require('../../common/services/ai3EvidenceClient');
const { createAi3EvidenceRouter } = require('../../common/routes/ai3EvidenceRouter');
const { createAi3MediaAccessRouter, checkAi3MediaAccess } = require('./routes/ai3MediaAccess');
const { createAi3MediaInspectClient } = require('./services/ai3MediaInspectClient');
const { createAi2MediaInspectClient } = require('./services/ai2MediaInspectClient');
const { validateAi2Environment } = require('../../common/services/ai2Activation');
const { error: ai2Error } = require('./services/ai2Contract');
const { createGrowthTaskAttachmentMediaService } = require('./services/growthTaskAttachmentMediaService');
const { validateClientConfig } = require('./services/starAwardClient');
const { resolveCompletionMode, assertCompletionAssemblyAvailable, withCompletionMode,
  assertCompletionConnection, startCompletionService, closeQueue } = require('../../common/services/completionActivation');

const logger = createLogger('homework-service');

const createAi3MediaBoundary = ({ serviceToken, check }) => {
  const router = express.Router();
  const digest = value => crypto.createHash('sha256').update(value).digest();
  const raw = express.raw({ type: () => true, limit: 32768 });
  const C = require('../../common/services/ai3ReviewEvidence');
  router.post('/media-access-check', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const supplied = req.get('x-service-token');
    if (!supplied || !crypto.timingSafeEqual(digest(supplied), digest(serviceToken))) return next(C.error(401, 'INVALID_SERVICE_CREDENTIAL'));
    if (req.body !== undefined || req._body) return next(C.error(503, 'AI3_NOT_READY'));
    return raw(req, res, cause => {
      if (cause) return next(C.error(cause.type === 'entity.too.large' ? 413 : 400,
        cause.type === 'entity.too.large' ? 'AI3_INPUT_TOO_LARGE' : 'VALIDATION_ERROR'));
      try { req.body = C.parseRaw(req.body); return next(); } catch (error) { return next(error); }
    });
  });
  router.use(createAi3MediaAccessRouter({ serviceToken, check }));
  router.use((cause, _req, res, _next) => {
    const safe = new Map([['INVALID_SERVICE_CREDENTIAL', 401], ['VALIDATION_ERROR', 400], ['AI3_INPUT_TOO_LARGE', 413], ['AI3_NOT_READY', 503]]);
    const code = safe.has(cause?.code) && safe.get(cause.code) === cause.statusCode ? cause.code : 'AI3_NOT_READY';
    res.set('Cache-Control', 'no-store'); res.status(safe.get(code)).json({ success: false, error: { code, message: code, details: [] } });
  });
  return router;
};

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
  tutorRouter,
  ai2Router,
  ai2MediaAccessRouter,
  ai3Router,
  ai3EvidenceRouter,
  ai3MediaAccessRouter,
  learningSourceRouter = createLearningSourceRouter({ kind: 'tasks', Model: GrowthTask,
    serviceToken: process.env.INTERNAL_SERVICE_TOKEN }),
  appLogger = logger
} = {}) => {
  const app = express();
  app.locals.logger = appLogger;
  app.locals.serviceName = 'homework-service';
  app.locals.mq = null;

  app.use(cors());
  app.use(requestTracker);
  app.use(requestTimeout());
  if (tutorRouter) {
    const parseTutor = createAi1JsonParser();
    app.use('/api', (req, res, next) => {
      if (!/^\/tutor-(?:cycles|jobs|artifacts)(?=\/|$)/i.test(req.path)) return next();
      return parseTutor(req, res, cause => cause ? next(cause) : tutorRouter(req, res, next));
    });
  }
  if (ai2Router) app.use('/api/ai2', createAi2JsonParser(), ai2Router);
  if (ai3Router) app.use('/api/ai3', createAi3JsonParser(), ai3Router);
  // The media check has its own credential/protocol; do not let the proof router consume its path.
  if (ai3MediaAccessRouter) app.use('/api/internal/ai3', ai3MediaAccessRouter);
  if (ai3EvidenceRouter) app.use('/api/internal/ai3', ai3EvidenceRouter);
  app.use(express.json());
  app.use('/api/homework', homeworkRouter);
  app.use('/api/growth-tasks', growthTaskRouter);
  app.use('/api/children', createDailyLearningPlanRouter());
  app.use('/api/internal/learning-sources', learningSourceRouter);
  if (retirementRouter) app.use('/api/internal/completion-media-retirements', retirementRouter);
  if (ai2MediaAccessRouter) app.use('/api/internal/ai2', ai2MediaAccessRouter);
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
  const ai2Config = validateAi2Environment(env);
  const ai1Runtime = createAi1Runtime({ env, connection });
  const ai2Runtime = createAi2Runtime({ env, connection });
  const ai3Config = validateAi3Environment(env);
  const ai3Runtime = createAi3Runtime({ env, connection, ai1Runtime });
  const { attachmentMediaService } = (createMediaDependencies || createTask6MediaDependencies)({
    env, appLogger, completionIsolation: mode === 'enabled' });
  const sourceReader = createLearningSourceReader({ TaskModel: GrowthTask,
    mistakeUrl: env.ANALYTICS_SERVICE_URL, serviceToken: env.INTERNAL_SERVICE_TOKEN });
  let growthTaskRouter, retirementRouter, mediaReferenceClient, mediaReader;
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
    mediaReferenceClient = createCompletionMediaReferenceClient({ resourceServiceUrl: env.RESOURCE_SERVICE_URL,
      serviceToken: env.MEDIA_REFERENCE_SERVICE_TOKEN, timeout: Number(env.MEDIA_REFERENCE_TIMEOUT_MS || 3000) });
    if (ai2Config.continuousStore) mediaReader = createAi2MediaInspectClient({ resourceServiceUrl: env.RESOURCE_SERVICE_URL,
      serviceToken: env.MEDIA_REFERENCE_SERVICE_TOKEN, timeout: Number(env.MEDIA_REFERENCE_TIMEOUT_MS || 3000) });
    const { awardTaskStar } = createStarAwardClient(starAwardConfig(env));
    growthTaskRouter = createGrowthTaskCompletionProductionRouter({ transactionRunner, attachmentMediaService, sourceReader,
      completionService: createGrowthTaskCompletionService({ transactionRunner, mediaReferenceClient }),
      confirmationService: createGrowthTaskCompletionConfirmationService({ transactionRunner, awardTaskStar }),
      readService: createGrowthTaskCompletionReadService({ transactionRunner, sourceReader }),
      mutationService: createGrowthTaskCompletionMutationService({ transactionRunner }) });
    retirementRouter = createCompletionMediaRetirementRouter({ env,
      service: createCompletionMediaRetirementService({ transactionRunner }) });
  } else {
    growthTaskRouter = (growthTaskRouterFactory || createGrowthTaskRouter)({ attachmentMediaService, sourceReader });
  }
  // Service reads also need continuity: their factory is usable independently of production activation.
  const requireAi2Store = () => {
    if (!ai2Runtime.dependencies.getRuntime().continuousStore) throw ai2Error(503, 'AI2_STORE_ISOLATED');
  };
  const ai2Service = createAi2Service({ sourceReader, mediaReader, mediaReferenceClient, ...ai2Runtime.dependencies });
  const guardedAi2Service = Object.fromEntries(Object.entries(ai2Service).map(([name, action]) => [name, async input => {
    requireAi2Store();
    const result = await action(input);
    requireAi2Store();
    return result;
  }]));
  let mistakeEvidenceClient, masteryEvidenceClient, ai3MediaInspectClient;
  if (ai3Config.continuousStore) {
    mistakeEvidenceClient = createAi3EvidenceClient({ kind: 'mistake', baseUrl: env.ANALYTICS_SERVICE_URL, serviceToken: env.AI3_EVIDENCE_TOKEN });
    masteryEvidenceClient = createAi3EvidenceClient({ kind: 'mastery', baseUrl: env.PROGRESS_SERVICE_URL, serviceToken: env.AI3_EVIDENCE_TOKEN });
    ai3MediaInspectClient = createAi3MediaInspectClient({ resourceServiceUrl: env.RESOURCE_SERVICE_URL,
      serviceToken: env.MEDIA_REFERENCE_SERVICE_TOKEN, timeout: Number(env.MEDIA_REFERENCE_TIMEOUT_MS || 3000) });
  }
  const knowledgePointReader = { read: async ({ familyId, childId, actorId, knowledgePointId }) => {
    const point = await masteryEvidenceClient.getContext({ familyId, childId, actorId, targetId: knowledgePointId });
    // This scoped endpoint only returns authorized academic/math targets.
    return { ...point, familyId, childId, dimension: 'academic', subject: 'math' };
  } };
  const ai3SourceReader = createAi3SourceReader({ sourceReader, mistakeEvidenceClient });
  const ai3Service = createAi3Service({ sourceReader: ai3SourceReader, knowledgePointReader, mediaReferenceClient,
    mediaInspectClient: ai3MediaInspectClient, mistakeEvidenceClient, masteryEvidenceClient, ...ai3Runtime.dependencies });
  const guardedAi3Service = Object.fromEntries(Object.entries(ai3Service).map(([name, action]) => [name, async input => {
    ai3Runtime.assertContinuous(); const result = await action(input); ai3Runtime.assertContinuous(); return result;
  }]));
  const app = createApp({
    growthTaskRouter,
    retirementRouter,
    tutorRouter: createAi1Router({ service: createAi1Service({ sourceReader, ...ai1Runtime.dependencies }) }),
    ai2Router: createAi2Router({ service: guardedAi2Service }),
    ai3Router: createAi3Router({ service: guardedAi3Service }),
    ai3EvidenceRouter: ai3Config.continuousStore ? createAi3EvidenceRouter({ kind: 'proof', serviceToken: env.AI3_EVIDENCE_TOKEN,
      service: guardedAi3Service, assertContinuous: ai3Runtime.assertContinuous }) : undefined,
    ai3MediaAccessRouter: ai3Config.continuousStore ? createAi3MediaBoundary({ serviceToken: env.MEDIA_REFERENCE_SERVICE_TOKEN,
      check: async body => { ai3Runtime.assertContinuous(); const result = await checkAi3MediaAccess(body);
        ai3Runtime.assertContinuous(); return result; } }) : undefined,
    ai2MediaAccessRouter: ai2Config.continuousStore ? createAi2MediaAccessRouter({ serviceToken: env.MEDIA_REFERENCE_SERVICE_TOKEN,
      check: async body => {
        requireAi2Store();
        const result = await checkAi2MediaAccess(body);
        requireAi2Store();
        return result;
      } }) : undefined,
    learningSourceRouter: createLearningSourceRouter({ kind: 'tasks', Model: GrowthTask, serviceToken: env.INTERNAL_SERVICE_TOKEN }),
    appLogger
  });
  app.locals.assertAi1Ready = ai1Runtime.assertReady;
  app.locals.assertAi2Ready = ai2Runtime.assertReady;
  app.locals.assertAi3Ready = ai3Runtime.assertReady;
  return withCompletionMode(app, { mode, service: 'homework', env });
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
  validateAi2Environment(env);
  validateAi3Environment(env);
  createAi1Runtime({ env });
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
      const ai3 = validateAi3Environment(runtimeEnv);
      if (ai3.continuousStore && (app || connect !== connectDatabase || createRuntimeApp !== createProductionApp
        || validateEnvironment !== validateStartupEnvironment)) throw ai2Error(503, 'AI3_NOT_READY');
      const ai2 = validateAi2Environment(runtimeEnv);
      if (ai2.continuousStore && (app || createRuntimeApp !== createProductionApp)) throw ai2Error(503, 'AI2_NOT_READY');
      if (ai2.continuousStore && validateEnvironment !== validateStartupEnvironment) validateStartupEnvironment(runtimeEnv);
      if (['enabled', 'query-only'].includes(runtimeEnv.AI1_MODE) && (app || createRuntimeApp !== createProductionApp)) {
        throw Object.assign(new Error('AI_PROFILE_UNAVAILABLE'), { code: 'AI_PROFILE_UNAVAILABLE' });
      }
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
    initializeRuntime: async ({ app: runtimeApp }) => {
      if (runtimeApp.locals.assertAi1Ready) await runtimeApp.locals.assertAi1Ready();
      if (runtimeApp.locals.assertAi2Ready) await runtimeApp.locals.assertAi2Ready();
      if (runtimeApp.locals.assertAi3Ready) await runtimeApp.locals.assertAi3Ready();
      return initializeQueue({ app: runtimeApp,
        enableRabbitMQ: env.ENABLE_RABBITMQ !== 'false' && env.NODE_ENV !== 'test',
        connect: () => connectRabbitMQ({ rabbitUrl: env.RABBITMQ_URL, appLogger }) });
    } });
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
