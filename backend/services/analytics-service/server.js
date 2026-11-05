const http = require('http');
const crypto = require('crypto');
const mongoose = require('mongoose');
const appModule = require('./app');
const { createLogger } = require('../../common/config/logger');
const { createMediaReferenceClient } = require('../../common/services/mediaReferenceClient');
const { assertTransactionCapability } = require('../../common/services/mongoTransaction');
const FamilyMistake = require('./models/FamilyMistake');
const FamilyMistakeStateEvent = require('./models/FamilyMistakeStateEvent');
const { createFamilyMistakeMediaService } = require('./services/familyMistakeMediaService');
const { createAi3Runtime } = require('./services/ai3Runtime');
const { validateAi3Environment } = require('../../common/services/ai3Activation');

const logger = createLogger('analytics-service');
const createApp = appModule.createApp;

const connectDatabase = async ({
  env = process.env,
  mongooseInstance = mongoose,
  mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/learning-tracker'
} = {}) => {
  if (mongooseInstance.connection.readyState === 0) {
    if (validateAi3Environment(env).continuousStore) await mongooseInstance.connect(mongoURI, { autoIndex: false, autoCreate: false });
    else await mongooseInstance.connect(mongoURI);
  }
  const hello = await assertTransactionCapability(mongooseInstance.connection, 'analytics-service');
  logger.info('Analytics MongoDB connected with transaction support', { replicaSet: hello.setName });
  return mongooseInstance.connection;
};

const createSocketServer = (server, socketLogger = logger) => {
  const socketIo = require('socket.io');
  const io = socketIo(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });
  io.on('connection', (socket) => {
    socketLogger.info('Analytics WebSocket connected');
    socket.on('join', (userId) => socket.join(userId));
    socket.on('disconnect', () => socketLogger.info('Analytics WebSocket disconnected'));
  });
  return io;
};

const createTask6MediaDependencies = ({
  env = process.env,
  mediaReferenceClientFactory = createMediaReferenceClient,
  randomUUID = crypto.randomUUID
} = {}) => {
  const mediaReferenceClient = mediaReferenceClientFactory({
    resourceServiceUrl: env.RESOURCE_SERVICE_URL,
    serviceToken: env.MEDIA_REFERENCE_SERVICE_TOKEN,
    timeout: Number(env.MEDIA_REFERENCE_TIMEOUT_MS || 3000)
  });

  return {
    familyMistakeMediaService: createFamilyMistakeMediaService({
      FamilyMistakeModel: FamilyMistake,
      FamilyMistakeStateEventModel: FamilyMistakeStateEvent,
      mediaReferenceClient,
      randomUUID
    })
  };
};

const createProductionApp = ({ env = process.env, connection = mongoose.connection, appLogger = logger } = {}) => {
  const runtime = createAi3Runtime({ env, connection });
  const app = createApp({ ...createTask6MediaDependencies({ env }), env, logger: appLogger, ai3EvidenceRouter: runtime.router });
  app.locals.assertAi3Ready = runtime.assertReady;
  return app;
};

const startServer = async ({
  env = process.env,
  connection = mongoose.connection,
  host,
  port = Number(process.env.PORT || 3006),
  connect = connectDatabase,
  createHttpServer = http.createServer,
  createIo = createSocketServer,
  createTask6Dependencies = createTask6MediaDependencies
} = {}) => {
  const ai3Config = validateAi3Environment(env);
  if (ai3Config.continuousStore && (connection !== mongoose.connection || connect !== connectDatabase
    || createTask6Dependencies !== createTask6MediaDependencies || createHttpServer !== http.createServer || createIo !== createSocketServer)) {
    throw Object.assign(new Error('AI3_NOT_READY'), { code: 'AI3_NOT_READY' });
  }
  const ownsConnection = connection.readyState === 0;
  let app, server, io;
  try {
    await connect({ env, mongoURI: env.MONGO_URI });
    app = ai3Config.continuousStore ? createProductionApp({ env, connection }) : createApp({ ...createTask6Dependencies({ env }), env });
    if (app.locals.assertAi3Ready) await app.locals.assertAi3Ready();
    server = createHttpServer(app);
    io = createIo(server, logger);
    app.locals.io = io;
    let onError;
    await new Promise((resolve, reject) => {
      onError = reject;
      server.once('error', onError);
      if (host === undefined) server.listen(port, resolve); else server.listen(port, host, resolve);
    });
    server.removeListener?.('error', onError);
    if (logger && typeof logger.info === 'function') logger.info('Analytics service started', { port });
    return server;
  } catch (cause) {
    // Each cleanup is independent: preserve the startup error and never close a caller-owned database.
    try { if (io) await io.close(); } catch (_) { /* Continue releasing the other owned resources. */ }
    try {
      if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    } catch (_) { /* Socket.IO may already have closed the HTTP server. */ }
    try { if (ownsConnection) await connection.close(); } catch (_) { /* Keep the original startup failure. */ }
    throw cause;
  }
};

const app = createApp();

if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Analytics service failed to start', { error: error.message, stack: error.stack });
    process.exitCode = 1;
  });
}

module.exports = app;
module.exports.assertTransactionCapability = (connection) => (
  assertTransactionCapability(connection, 'analytics-service')
);
module.exports.connectDatabase = connectDatabase;
module.exports.createApp = createApp;
module.exports.createProductionApp = createProductionApp;
module.exports.createSocketServer = createSocketServer;
module.exports.createTask6MediaDependencies = createTask6MediaDependencies;
module.exports.startServer = startServer;
