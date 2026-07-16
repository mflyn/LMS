const mongoose = require('mongoose');
const appModule = require('./app');
const { createLogger } = require('../../common/config/logger');
const { authenticateGateway } = require('../../common/middleware/auth');
const Family = require('../../common/models/Family');
const MediaAsset = require('./models/MediaAsset');
const MediaReference = require('./models/MediaReference');
const FamilyUser = require('./models/FamilyUser');
const { createMediaReferenceCredential } = require('./middleware/mediaReferenceCredential');
const { createPrivateMediaUpload } = require('./middleware/privateMediaUpload');
const { createInternalMediaReferencesRouter } = require('./routes/internalMediaReferences');
const { createMediaRouter } = require('./routes/media');
const { createMediaCapabilityService } = require('./services/mediaCapability');
const { createMediaReferenceService } = require('./services/mediaReferenceService');
const { createMediaService } = require('./services/mediaService');
const { createClamAvScanner } = require('./services/clamAvScanner');
const { createMongoTransactionRunner } = require('./services/mongoTransaction');
const { createPrivateMediaStore } = require('./services/privateMediaStore');
const { resolveMediaSecurity } = require('./config/mediaSecurity');

const logger = createLogger('resource-service');
const createApp = appModule.createApp;

const createTask6MediaDependencies = ({
  createScanner = createClamAvScanner,
  env = process.env,
  connection = mongoose.connection
} = {}) => {
  const security = resolveMediaSecurity(env);
  const scanner = security.profile === 'secure-production'
    ? createScanner(security.scannerConfig)
    : null;
  const privateRoot = env.PRIVATE_MEDIA_ROOT;
  const mediaStore = createPrivateMediaStore({ root: privateRoot });
  const capabilityService = createMediaCapabilityService({ secret: env.MEDIA_SIGNING_SECRET });
  const transactionRunner = createMongoTransactionRunner(connection);
  const referenceService = createMediaReferenceService({
    MediaAssetModel: MediaAsset,
    MediaReferenceModel: MediaReference,
    transactionRunner
  });
  const mediaService = createMediaService({
    MediaAssetModel: MediaAsset,
    MediaReferenceModel: MediaReference,
    FamilyModel: Family,
    UserModel: FamilyUser,
    capabilityService,
    mediaStore,
    scanner,
    securityProfile: security.profile,
    transactionRunner
  });

  return {
    mediaSecurity: Object.freeze({ profile: security.profile, scanner }),
    mediaRouter: createMediaRouter({
      authenticate: authenticateGateway,
      mediaService,
      upload: createPrivateMediaUpload({ privateRoot })
    }),
    internalMediaRouter: createInternalMediaReferencesRouter({
      credential: createMediaReferenceCredential(env.MEDIA_REFERENCE_SERVICE_TOKEN),
      referenceService
    })
  };
};

const createProductionApp = ({
  env = process.env,
  connection = mongoose.connection,
  createMediaDependencies = createTask6MediaDependencies
} = {}) => createApp(createMediaDependencies({ env, connection }));

const connectDatabase = async ({
  mongooseInstance = mongoose,
  mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/learning-tracker'
} = {}) => {
  if (mongooseInstance.connection.readyState === 0) {
    await mongooseInstance.connect(mongoURI);
  }
  return mongooseInstance.connection;
};

const startServer = async ({
  app = null,
  port = Number(process.env.PORT || 3005),
  connect = connectDatabase,
  createRuntimeApp = createProductionApp
} = {}) => {
  await connect();
  const runtimeApp = app || createRuntimeApp();
  const security = runtimeApp.locals && runtimeApp.locals.mediaSecurity;
  if (security && security.profile === 'secure-production') await security.scanner.ping();
  return runtimeApp.listen(port, () => {
    logger.info('Resource service started', { port });
  });
};

const app = createApp();

if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Resource service failed to start', { error: error.message, stack: error.stack });
    process.exitCode = 1;
  });
}

module.exports = app;
module.exports.connectDatabase = connectDatabase;
module.exports.createApp = createApp;
module.exports.createProductionApp = createProductionApp;
module.exports.createTask6MediaDependencies = createTask6MediaDependencies;
module.exports.startServer = startServer;
