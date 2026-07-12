const crypto = require('crypto');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { redactRuntimeError } = require('./testEnvironment');
const Role = require('../../common/models/Role');
const { authenticateGateway } = require('../../common/middleware/auth');
const { createMediaReferenceClient } = require('../../common/services/mediaReferenceClient');

const userServer = require('../../services/user-service/server');
const homeworkServer = require('../../services/homework-service/server');
const GrowthTask = require('../../services/homework-service/models/GrowthTask');
const { createGrowthTaskRouter } = require('../../services/homework-service/routes/growthTasks');
const { createGrowthTaskAttachmentMediaService } = require('../../services/homework-service/services/growthTaskAttachmentMediaService');
const progressServer = require('../../services/progress-service/server');
const resourceApp = require('../../services/resource-service/app');
const FamilyUser = require('../../services/resource-service/models/FamilyUser');
const MediaAsset = require('../../services/resource-service/models/MediaAsset');
const MediaReference = require('../../services/resource-service/models/MediaReference');
const { createMediaReferenceCredential } = require('../../services/resource-service/middleware/mediaReferenceCredential');
const { createPrivateMediaUpload } = require('../../services/resource-service/middleware/privateMediaUpload');
const { createInternalMediaReferencesRouter } = require('../../services/resource-service/routes/internalMediaReferences');
const { createMediaRouter } = require('../../services/resource-service/routes/media');
const { createMediaCapabilityService } = require('../../services/resource-service/services/mediaCapability');
const { createMediaReferenceService } = require('../../services/resource-service/services/mediaReferenceService');
const { createMediaService } = require('../../services/resource-service/services/mediaService');
const { createMongoTransactionRunner } = require('../../services/resource-service/services/mongoTransaction');
const { createPrivateMediaStore } = require('../../services/resource-service/services/privateMediaStore');
const analyticsApp = require('../../services/analytics-service/app');
const FamilyMistake = require('../../services/analytics-service/models/FamilyMistake');
const FamilyMistakeStateEvent = require('../../services/analytics-service/models/FamilyMistakeStateEvent');
const { createFamilyMistakeMediaService } = require('../../services/analytics-service/services/familyMistakeMediaService');
const notificationApp = require('../../services/notification-service/app');
const gatewayServer = require('../../gateway/server');

const quietLogger = {
  error: () => undefined,
  info: () => undefined,
  warn: () => undefined
};

const createResourceApp = ({ privateRoot, transactionRunner }) => {
  const mediaStore = createPrivateMediaStore({ root: privateRoot });
  const capabilityService = createMediaCapabilityService({
    secret: process.env.MEDIA_SIGNING_SECRET
  });
  const referenceService = createMediaReferenceService({
    MediaAssetModel: MediaAsset,
    MediaReferenceModel: MediaReference,
    transactionRunner
  });
  const mediaService = createMediaService({
    MediaAssetModel: MediaAsset,
    MediaReferenceModel: MediaReference,
    UserModel: FamilyUser,
    capabilityService,
    mediaStore,
    transactionRunner
  });
  const mediaRouter = createMediaRouter({
    authenticate: authenticateGateway,
    fsPromises: fs,
    mediaService,
    upload: createPrivateMediaUpload({ privateRoot })
  });
  const internalMediaRouter = createInternalMediaReferencesRouter({
    credential: createMediaReferenceCredential(process.env.MEDIA_REFERENCE_SERVICE_TOKEN),
    referenceService
  });
  return resourceApp.createApp({ logger: quietLogger, mediaRouter, internalMediaRouter });
};

const listen = (name, app) => new Promise((resolve, reject) => {
  const server = app.listen(0, '127.0.0.1', () => {
    resolve({ name, server, url: `http://127.0.0.1:${server.address().port}` });
  });
  server.once('error', reject);
});

const closeServer = (server) => new Promise((resolve, reject) => {
  if (!server || !server.listening) {
    resolve();
    return;
  }
  server.close((error) => (error ? reject(error) : resolve()));
});

const createFamilyRuntime = async () => {
  const state = {
    mongoServer: null,
    privateRoot: null,
    servers: [],
    stopped: false
  };

  const stop = async () => {
    if (state.stopped) return;
    state.stopped = true;

    const errors = [];
    for (const { server } of [...state.servers].reverse()) {
      try {
        await closeServer(server);
      } catch (error) {
        errors.push(error);
      }
    }
    if (mongoose.connection.readyState !== 0) {
      try {
        await mongoose.disconnect();
      } catch (error) {
        errors.push(error);
      }
    }
    if (state.mongoServer) {
      try {
        await state.mongoServer.stop();
      } catch (error) {
        errors.push(error);
      }
    }
    if (state.privateRoot) {
      try {
        await fs.rm(state.privateRoot, { recursive: true, force: true });
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, 'Task 11 runtime teardown failed');
    }
  };

  try {
    state.mongoServer = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' }
    });
    const mongoUri = state.mongoServer.getUri(`task11_${Date.now()}`);
    process.env.MONGO_URI = mongoUri;
    process.env.USER_SERVICE_MONGO_URI = mongoUri;
    await mongoose.connect(mongoUri);
    const mongoHello = await mongoose.connection.db.admin().command({ hello: 1 });
    await Role.create([
      { name: 'parent', description: 'Family parent', permissions: [] },
      { name: 'student', description: 'Family child', permissions: [] }
    ]);

    state.privateRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'family-growth-task11-'));
    await fs.chmod(state.privateRoot, 0o700);

    const transactionRunner = createMongoTransactionRunner(mongoose.connection);
    const foundationalApps = [
      ['user-service', userServer.createApp({ appLogger: quietLogger })],
      ['progress-service', progressServer.createApp()],
      ['resource-service', createResourceApp({
        privateRoot: state.privateRoot,
        transactionRunner
      })]
    ];
    for (const [name, app] of foundationalApps) {
      state.servers.push(await listen(name, app));
    }

    const serviceUrl = (name) => state.servers.find((entry) => entry.name === name).url;
    process.env.PROGRESS_SERVICE_URL = serviceUrl('progress-service');
    process.env.RESOURCE_SERVICE_URL = serviceUrl('resource-service');
    const mediaReferenceClient = createMediaReferenceClient({
      resourceServiceUrl: process.env.RESOURCE_SERVICE_URL,
      serviceToken: process.env.MEDIA_REFERENCE_SERVICE_TOKEN,
      timeout: Number(process.env.MEDIA_REFERENCE_TIMEOUT_MS)
    });
    const attachmentMediaService = createGrowthTaskAttachmentMediaService({
      GrowthTaskModel: GrowthTask,
      mediaReferenceClient,
      randomUUID: crypto.randomUUID,
      logger: quietLogger
    });
    const homeworkApp = homeworkServer.createApp({
      appLogger: quietLogger,
      growthTaskRouter: createGrowthTaskRouter({ attachmentMediaService })
    });
    const familyMistakeMediaService = createFamilyMistakeMediaService({
      FamilyMistakeModel: FamilyMistake,
      FamilyMistakeStateEventModel: FamilyMistakeStateEvent,
      mediaReferenceClient,
      randomUUID: crypto.randomUUID
    });
    const dependentApps = [
      ['homework-service', homeworkApp],
      ['analytics-service', analyticsApp.createApp({
        familyMistakeMediaService,
        logger: quietLogger
      })],
      ['notification-service', notificationApp.createApp({ logger: quietLogger })]
    ];
    for (const [name, app] of dependentApps) {
      state.servers.push(await listen(name, app));
    }

    const gatewayApp = gatewayServer.createApp({
      serviceHosts: {
        user: serviceUrl('user-service'),
        data: serviceUrl('user-service'),
        homework: serviceUrl('homework-service'),
        progress: serviceUrl('progress-service'),
        resource: serviceUrl('resource-service'),
        analytics: serviceUrl('analytics-service'),
        notification: serviceUrl('notification-service')
      },
      jwtSecret: process.env.JWT_SECRET,
      identitySecret: process.env.GATEWAY_IDENTITY_SECRET,
      rateLimitOptions: {
        windowMs: 15 * 60 * 1000,
        max: 1000,
        standardHeaders: true,
        legacyHeaders: false
      }
    });
    state.servers.push(await listen('api-gateway', gatewayApp));

    const urls = Object.fromEntries(state.servers.map(({ name, url }) => [name, url]));
    return {
      mongoHello,
      privateRoot: state.privateRoot,
      servers: state.servers,
      stop,
      urls,
      gatewayUrl: urls['api-gateway']
    };
  } catch (error) {
    await stop();
    throw redactRuntimeError(error, { privateRoot: state.privateRoot });
  }
};

module.exports = {
  createFamilyRuntime,
  listen
};
