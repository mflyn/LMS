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
const { resolveCompletionMode, assertCompletionAssemblyAvailable, withCompletionMode,
  assertCompletionConnection, startCompletionService } = require('../../common/services/completionActivation');

const logger = createLogger('resource-service');
const createApp = appModule.createApp;

const createTask6MediaDependencies = ({
  createScanner = createClamAvScanner,
  env = process.env,
  connection = mongoose.connection,
  completionProtocol = false
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
  let completionUploadService, retirementService;
  if (completionProtocol) {
    const { createRetentionDependencies } = require('./services/orphanRetentionRuntime');
    const { createCompletionUploadService } = require('./services/completionUploadService');
    const { createOrphanRetirementService } = require('./services/orphanRetirementService');
    const { journal, uploadJournal, retirementClient } = createRetentionDependencies(env);
    // Safe upload and deletion replay remain required even when new orphan cleanup is disabled.
    completionUploadService = createCompletionUploadService({ transactionRunner, mediaStore, journal: uploadJournal });
    retirementService = createOrphanRetirementService({ transactionRunner, mediaStore, journal, retirementClient });
  }
  const mediaService = createMediaService({
    MediaAssetModel: MediaAsset,
    MediaReferenceModel: MediaReference,
    FamilyModel: Family,
    UserModel: FamilyUser,
    capabilityService,
    mediaStore,
    scanner,
    securityProfile: security.profile,
    transactionRunner,
    completionUploadService
  });

  const credential = createMediaReferenceCredential(env.MEDIA_REFERENCE_SERVICE_TOKEN);
  let deletionService = mediaService;
  let internalMediaRouter;
  if (completionProtocol) {
    const { createMediaReferenceOperationService } = require('./services/mediaReferenceOperationService');
    const { createCompletionMediaPrivacyService } = require('./services/completionMediaPrivacyService');
    const { createMediaDeletionJournal } = require('./services/mediaDeletionJournal');
    const { createMediaDeletionDispatcher } = require('./services/mediaDeletionDispatcher');
    const { createMediaReferenceProtocolRouter } = require('./routes/mediaReferenceProtocolRouter');
    const operationService = createMediaReferenceOperationService({ transactionRunner });
    const privacyService = createCompletionMediaPrivacyService({ transactionRunner,
      journal: createMediaDeletionJournal({ root: env.COMPLETION_DELETION_JOURNAL_ROOT }) });
    deletionService = { ...mediaService, deleteMedia: createMediaDeletionDispatcher({ mediaService, privacyService, retirementService }) };
    internalMediaRouter = createMediaReferenceProtocolRouter({ credential, referenceService, operationService });
  } else {
    internalMediaRouter = createInternalMediaReferencesRouter({ credential, referenceService });
  }

  return {
    mediaSecurity: Object.freeze({ profile: security.profile, scanner }),
    mediaRouter: createMediaRouter({
      authenticate: authenticateGateway,
      mediaService: deletionService,
      rejectDeleteBody: completionProtocol,
      upload: createPrivateMediaUpload({ privateRoot })
    }),
    internalMediaRouter
  };
};

const createProductionApp = ({
  env = process.env,
  connection = mongoose.connection,
  createMediaDependencies
} = {}) => {
  const mode = resolveCompletionMode(env);
  assertCompletionAssemblyAvailable(mode, 'resource');
  if (mode === 'enabled' && createMediaDependencies) {
    throw Object.assign(new Error('COMPLETION_ASSEMBLY_NOT_READY'), { code: 'COMPLETION_ASSEMBLY_NOT_READY' });
  }
  assertCompletionConnection(connection, mongoose.connection);
  const dependencies = (createMediaDependencies || createTask6MediaDependencies)({ env, connection,
    completionProtocol: mode === 'enabled' });
  return withCompletionMode(createApp(dependencies), { mode, service: 'resource', env });
};

const connectDatabase = async ({
  mongooseInstance = mongoose,
  connection = mongooseInstance.connection,
  mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/learning-tracker'
} = {}) => {
  if (connection.readyState === 0) {
    const options = { autoIndex: false, autoCreate: false,
      serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, socketTimeoutMS: 15000 };
    if (connection === mongooseInstance.connection) await mongooseInstance.connect(mongoURI, options);
    else await connection.openUri(mongoURI, options);
  }
  return connection;
};

const validateMediaEnvironment = env => {
  resolveMediaSecurity(env);
  createMediaReferenceCredential(env.MEDIA_REFERENCE_SERVICE_TOKEN);
  createMediaCapabilityService({ secret: env.MEDIA_SIGNING_SECRET });
  createPrivateMediaStore({ root: env.PRIVATE_MEDIA_ROOT });
};

const startServer = async ({
  app = null,
  env = process.env,
  connection = mongoose.connection,
  host,
  appLogger = logger,
  validateEnvironment = validateMediaEnvironment,
  port = Number(process.env.PORT || 3005),
  connect = connectDatabase,
  createRuntimeApp = createProductionApp
} = {}) => {
  return startCompletionService({ service: 'resource', env, connection, app, port, host, appLogger,
    connect: () => connect({ mongoURI: env.MONGO_URI, connection }), createRuntimeApp,
    validateEnvironment: runtimeEnv => {
      if (runtimeEnv.COMPLETION_PROTOCOL_MODE === 'enabled' && createRuntimeApp !== createProductionApp) {
        throw Object.assign(new Error('COMPLETION_ASSEMBLY_NOT_READY'), { code: 'COMPLETION_ASSEMBLY_NOT_READY' });
      }
      if (!app && createRuntimeApp === createProductionApp) assertCompletionConnection(connection, mongoose.connection);
      validateEnvironment(runtimeEnv);
    },
    checkEnabled: options => require('./services/completionOperations').checkCompletionOperations(options),
    initializeRuntime: async ({ app: runtimeApp }) => {
      const security = runtimeApp.locals?.mediaSecurity;
      if (security?.profile === 'secure-production') await security.scanner.ping();
    } });
};

const app = createApp();

if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Resource service failed to start', { code: error.code });
    process.exitCode = 1;
  });
}

module.exports = app;
module.exports.connectDatabase = connectDatabase;
module.exports.createApp = createApp;
module.exports.createProductionApp = createProductionApp;
module.exports.createTask6MediaDependencies = createTask6MediaDependencies;
module.exports.startServer = startServer;
module.exports.validateMediaEnvironment = validateMediaEnvironment;
