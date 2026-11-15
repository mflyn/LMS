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
const { createAi2Runtime } = require('./services/ai2Runtime');
const { createAi3Runtime } = require('./services/ai3Runtime');
const { createAi3StoreRuntime } = require('../../common/services/ai3Runtime');
const { validateAi3Environment } = require('../../common/services/ai3Activation');
const { createAi3MediaInspectRouter } = require('./routes/ai3MediaInspect');
const { createAi2MediaInspectRouter } = require('./routes/ai2MediaInspect');
const { validateAi2Environment } = require('../../common/services/ai2Activation');
const { createClamAvScanner } = require('./services/clamAvScanner');
const { createMongoTransactionRunner } = require('./services/mongoTransaction');
const { createPrivateMediaStore } = require('./services/privateMediaStore');
const { resolveMediaSecurity } = require('./config/mediaSecurity');
const { resolveCompletionMode, assertCompletionAssemblyAvailable, withCompletionMode,
  assertCompletionConnection, startCompletionService } = require('../../common/services/completionActivation');

const logger = createLogger('resource-service');
const createApp = appModule.createApp;
const ai3Models = () => [MediaAsset, MediaReference, Family, FamilyUser,
  ...['MediaReferenceOperation', 'CompletionUploadGuard', 'MediaDeletionReceipt', 'MediaDeletionTombstone',
    'MediaUserDeletionRecovery', 'MediaOrphanRetirement'].map(name => require('./models/' + name))];

const assembleMediaDependencies = ({
  createScanner = createClamAvScanner,
  env = process.env,
  connection = mongoose.connection,
  completionProtocol = false
} = {}, isReady = () => false) => {
  const { mode: ai2Mode } = validateAi2Environment(env);
  const ai3Config = validateAi3Environment(env);
  if (ai2Mode === 'enabled' || ai3Config.continuousStore) {
    if (createScanner !== createClamAvScanner) {
      throw Object.assign(new Error('AI2_ASSEMBLY_NOT_READY'), { code: 'AI2_ASSEMBLY_NOT_READY' });
    }
    assertCompletionConnection(connection, mongoose.connection);
  }
  const ai2 = createAi2Runtime({ env, completionProtocol, isReady });
  const ai3Store = ai3Config.continuousStore ? createAi3StoreRuntime({ env, connection, models: ai3Models() }) : null;
  const ai3 = createAi3Runtime({ env, completionProtocol, isReady: () => {
    if (!ai3Store) return false; ai3Store.assertContinuous(); return isReady();
  } });
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
    completionUploadService = createCompletionUploadService({ transactionRunner, mediaStore, journal: uploadJournal,
      ai2Mode: ai2.getAi2Mode, ai3Mode: ai3.getAi3Mode });
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
    getAi2Mode: ai2.getAi2Mode,
    assertAi2Continuous: ai2.assertAi2Continuous,
    ai2MediaAccessClient: ai2.ai2MediaAccessClient,
    getAi3Mode: ai3.getAi3Mode,
    assertAi3Continuous: ai3.assertAi3Continuous,
    ai3MediaAccessClient: ai3.ai3MediaAccessClient,
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
    const operationService = createMediaReferenceOperationService({ transactionRunner,
      ai2Mode: ai2.getAi2Mode, ai3Mode: ai3.getAi3Mode });
    const privacyService = createCompletionMediaPrivacyService({ transactionRunner, assertAi3Continuous: ai3.assertAi3Continuous,
      journal: createMediaDeletionJournal({ root: env.COMPLETION_DELETION_JOURNAL_ROOT }) });
    deletionService = { ...mediaService, deleteMedia: createMediaDeletionDispatcher({ mediaService, privacyService, retirementService,
      assertAi2Continuous: ai2.assertAi2Continuous, assertAi3Continuous: ai3.assertAi3Continuous }) };
    internalMediaRouter = createMediaReferenceProtocolRouter({ credential, referenceService, operationService,
      assertAi2Continuous: ai2.assertAi2Continuous, assertAi3Continuous: ai3.assertAi3Continuous });
  } else {
    internalMediaRouter = createInternalMediaReferencesRouter({ credential, referenceService });
  }

  return {
    assertAi3Ready: ai3Store?.assertReady,
    ai3MediaInspectRouter: ai3Config.continuousStore ? createAi3MediaInspectRouter({ serviceToken: env.MEDIA_REFERENCE_SERVICE_TOKEN,
      mediaService, assertAi3Continuous: ai3.assertAi3Continuous }) : undefined,
    ai2MediaInspectRouter: createAi2MediaInspectRouter({ serviceToken: env.MEDIA_REFERENCE_SERVICE_TOKEN,
      mediaService, assertAi2Continuous: ai2.assertAi2Continuous }),
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
const createTask6MediaDependencies = options => assembleMediaDependencies(options);

const assembleProductionApp = ({
  env = process.env,
  connection = mongoose.connection,
  createMediaDependencies
} = {}, isReady = () => false) => {
  validateAi2Environment(env);
  const ai3Config = validateAi3Environment(env);
  const mode = resolveCompletionMode(env);
  assertCompletionAssemblyAvailable(mode, 'resource');
  if ((mode === 'enabled' || ai3Config.continuousStore) && createMediaDependencies) {
    throw Object.assign(new Error('COMPLETION_ASSEMBLY_NOT_READY'), { code: 'COMPLETION_ASSEMBLY_NOT_READY' });
  }
  assertCompletionConnection(connection, mongoose.connection);
  const options = { env, connection, completionProtocol: mode === 'enabled' };
  const dependencies = createMediaDependencies ? createMediaDependencies(options) : assembleMediaDependencies(options, isReady);
  return withCompletionMode(createApp(dependencies), { mode, service: 'resource', env });
};
const createProductionApp = options => assembleProductionApp(options);

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
  createAi2Runtime({ env, completionProtocol: env.COMPLETION_PROTOCOL_MODE === 'enabled' });
  createAi3Runtime({ env, completionProtocol: env.COMPLETION_PROTOCOL_MODE === 'enabled' });
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
  let prechecked = false, ready = false;
  return startCompletionService({ service: 'resource', env, connection, app, port, host, appLogger,
    connect: () => connect({ mongoURI: env.MONGO_URI, connection }),
    createRuntimeApp: options => createRuntimeApp === createProductionApp
      ? assembleProductionApp(options, () => ready && connection.readyState === 1) : createRuntimeApp(options),
    validateEnvironment: runtimeEnv => {
      const ai3Config = validateAi3Environment(runtimeEnv);
      if (ai3Config.continuousStore && (app || connect !== connectDatabase || validateEnvironment !== validateMediaEnvironment
        || createRuntimeApp !== createProductionApp)) throw Object.assign(new Error('AI3_NOT_READY'), { code: 'AI3_NOT_READY' });
      const { mode: ai2Mode } = validateAi2Environment(runtimeEnv);
      if (ai2Mode === 'enabled' && (app || connect !== connectDatabase || validateEnvironment !== validateMediaEnvironment
        || createRuntimeApp !== createProductionApp)) {
        throw Object.assign(new Error('AI2_ASSEMBLY_NOT_READY'), { code: 'AI2_ASSEMBLY_NOT_READY' });
      }
      if (runtimeEnv.COMPLETION_PROTOCOL_MODE === 'enabled' && createRuntimeApp !== createProductionApp) {
        throw Object.assign(new Error('COMPLETION_ASSEMBLY_NOT_READY'), { code: 'COMPLETION_ASSEMBLY_NOT_READY' });
      }
      if (!app && createRuntimeApp === createProductionApp) assertCompletionConnection(connection, mongoose.connection);
      validateEnvironment(runtimeEnv);
    },
    checkEnabled: async options => {
      const result = await require('./services/completionOperations').checkCompletionOperations(options);
      if (result?.ready !== true) {
        throw Object.assign(new Error('COMPLETION_PROTOCOL_NOT_READY'), { code: 'COMPLETION_PROTOCOL_NOT_READY' });
      }
      prechecked = true;
      return result;
    },
    initializeRuntime: async ({ app: runtimeApp }) => {
      if (runtimeApp.locals?.assertAi3Ready) await runtimeApp.locals.assertAi3Ready();
      const security = runtimeApp.locals?.mediaSecurity;
      if (security?.profile === 'secure-production') await security.scanner.ping();
      ready = prechecked;
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
