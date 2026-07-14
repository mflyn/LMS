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

const logger = createLogger('analytics-service');
const createApp = appModule.createApp;

const connectDatabase = async ({
  mongooseInstance = mongoose,
  mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/learning-tracker'
} = {}) => {
  if (mongooseInstance.connection.readyState === 0) {
    await mongooseInstance.connect(mongoURI);
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

const startServer = async ({
  port = Number(process.env.PORT || 3006),
  connect = connectDatabase,
  createHttpServer = http.createServer,
  createIo = createSocketServer,
  createTask6Dependencies = createTask6MediaDependencies
} = {}) => {
  await connect();
  const app = createApp(createTask6Dependencies());
  const server = createHttpServer(app);
  app.locals.io = createIo(server, logger);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, resolve);
  });
  if (logger && typeof logger.info === 'function') {
    logger.info('Analytics service started', { port });
  }
  return server;
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
module.exports.createSocketServer = createSocketServer;
module.exports.createTask6MediaDependencies = createTask6MediaDependencies;
module.exports.startServer = startServer;
