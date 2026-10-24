const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const net = require('net');
const { createHash, randomUUID } = require('crypto');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { configureEnvironment, quietLogger, safeError } = require('./testEnvironment');
const { createTask11ApiClient } = require('../task11/apiClient');
let active = false;

const dependencies = () => {
  // Only observability is silenced. All authentication, services and responses are real.
  const logging = require('../../common/config/logger'), original = logging.createLogger;
  logging.createLogger = () => quietLogger;
  try {
    const user = require('../../services/user-service/server');
    const progress = require('../../services/progress-service/server');
    const resource = require('../../services/resource-service/server');
    const homework = require('../../services/homework-service/server');
    const gateway = require('../../gateway/server');
    const analytics = require('../../services/analytics-service/app');
    const notification = require('../../services/notification-service/app');
    const models = {
      Role: require('../../common/models/Role'), Family: require('../../common/models/Family'),
      User: require('../../common/models/User'), Task: require('../../services/homework-service/models/GrowthTask'),
      Operation: require('../../services/homework-service/models/GrowthTaskCompletionOperation'),
      Guard: require('../../services/homework-service/models/CompletionMediaGuard'),
      Asset: require('../../services/resource-service/models/MediaAsset'),
      UploadGuard: require('../../services/resource-service/models/CompletionUploadGuard'),
      Retirement: require('../../services/resource-service/models/MediaOrphanRetirement'),
      Reference: require('../../services/resource-service/models/MediaReference'),
      RemoteOperation: require('../../services/resource-service/models/MediaReferenceOperation'),
      Tombstone: require('../../services/resource-service/models/MediaDeletionTombstone'),
      Receipt: require('../../services/resource-service/models/MediaDeletionReceipt'),
      Ledger: require('../../services/progress-service/models/StarLedgerEntry')
    };
    return { user, progress, resource, homework, gateway, analytics, notification, models };
  } finally { logging.createLogger = original; }
};

const close = async server => {
  if (!server?.listening) return;
  const closed = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  server.closeAllConnections?.();
  await closed;
};
// These existing startups accept only (port, callback), not host. Do not replace their handlers.
const loopbackOnly = app => {
  const listen = app.listen.bind(app);
  app.listen = (port, callback) => listen(port, '127.0.0.1', callback);
  return app;
};
const listening = server => server.listening ? Promise.resolve(server) : new Promise((resolve, reject) => {
  server.once('listening', () => resolve(server)); server.once('error', reject);
});

const createT2Runtime = async ({ beforeStart } = {}) => {
  if (active) throw safeError({ code: 'T2_RUNTIME_ALREADY_ACTIVE' });
  active = true;
  const state = { servers: [], reservations: [], instances: [], faults: [], dropped: [], prechecks: [] };
  let stopPromise, restoreEnvironment;
  const stop = () => {
    if (stopPromise) return stopPromise;
    stopPromise = (async () => {
      const errors = [];
      for (const server of [...state.servers.map(row => row.server), ...state.reservations].reverse()) {
        try { await close(server); } catch (error) { errors.push(error); }
      }
      for (const instance of state.instances) {
        try { await instance.disconnect(); } catch (error) { errors.push(error); }
      }
      try { await state.mongo?.stop(); } catch (error) { errors.push(error); }
      try { if (state.root) await fs.rm(state.root, { recursive: true, force: true }); } catch (error) { errors.push(error); }
      restoreEnvironment?.(); active = false;
      if (errors.length) throw safeError({ code: 'T2_TEARDOWN_FAILED' });
    })();
    return stopPromise;
  };
  const reserve = async () => {
    const server = net.createServer(socket => socket.destroy()); state.reservations.push(server);
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    return { server, port: server.address().port, url: `http://127.0.0.1:${server.address().port}` };
  };
  const add = async (name, server) => {
    state.servers.push({ name, server, url: null });
    await listening(server);
    const row = state.servers.at(-1); row.url = `http://127.0.0.1:${server.address().port}`;
    server.prependListener('request', (req, res) => {
      const index = state.faults.findIndex(f => f.service === name && f.method === req.method && f.path === req.url);
      if (index < 0) return;
      const fault = state.faults.splice(index, 1)[0], write = res.write.bind(res), end = res.end.bind(res);
      // The handler has already committed before it emits a successful response.
      res.write = (...args) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const callback = args.at(-1); if (typeof callback === 'function') queueMicrotask(callback);
          return true;
        }
        return write(...args);
      };
      res.end = (...args) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          state.dropped.push({ ...fault, status: res.statusCode }); res.destroy(); return res;
        }
        return end(...args);
      };
    });
    return row.url;
  };
  try {
    state.root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'lms-t2-http-')));
    await fs.chmod(state.root, 0o700);
    const mediaRoot = path.join(state.root, 'media'), journalRoot = path.join(state.root, 'journal');
    for (const directory of [mediaRoot, journalRoot]) await fs.mkdir(directory, { mode: 0o700 });
    state.mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    const mongoURI = state.mongo.getUri('t2_synthetic');
    const resourceAddress = await reserve(), homeworkAddress = await reserve();
    restoreEnvironment = configureEnvironment({ MONGO_URI: mongoURI, USER_SERVICE_MONGO_URI: mongoURI,
      PRIVATE_MEDIA_ROOT: mediaRoot, COMPLETION_DELETION_JOURNAL_ROOT: journalRoot,
      RESOURCE_SERVICE_URL: resourceAddress.url, HOMEWORK_SERVICE_URL: homeworkAddress.url });
    const deps = dependencies(), { models } = deps;
    const instances = [...new Set(Object.values(models).map(model => model.db.base))];
    if (instances.some(instance => instance.connection.readyState !== 0)) throw safeError({ code: 'T2_CONNECTION_ALREADY_OPEN' });
    state.instances = instances;
    for (const instance of instances) {
      await instance.connect(mongoURI, { autoIndex: false, autoCreate: false });
      for (const model of Object.values(instance.models)) { await model.createCollection(); await model.createIndexes(); }
    }
    const mongoHello = await models.Task.db.db.admin().command({ hello: 1 });
    const context = { privateRoot: state.root, mediaRoot, journalRoot, mongooseInstances: instances,
      resourceConnection: models.Asset.db, homeworkConnection: models.Task.db, servers: state.servers };
    if (beforeStart) await beforeStart(context);
    const env = { ...process.env };
    await add('user-service', await deps.user.startServer({ port: 0, appLogger: quietLogger,
      app: loopbackOnly(deps.user.createProductionApp({ env, appLogger: quietLogger })),
      connect: async () => { const value = await deps.user.connectDatabase({ mongooseInstance: models.User.db.base, mongoURI });
        state.prechecks.push('user'); return value; } }));
    env.PROGRESS_SERVICE_URL = await add('progress-service', await deps.progress.startServer({ port: 0,
      app: loopbackOnly(deps.progress.createApp()), connect: async () => {
        const value = await deps.progress.connectDatabase({ mongooseInstance: models.Ledger.db.base, mongoURI });
        state.prechecks.push('progress'); return value;
      } }));
    await close(resourceAddress.server);
    await add('resource-service', await deps.resource.startServer({ env, connection: models.Asset.db,
      host: '127.0.0.1', port: resourceAddress.port, appLogger: quietLogger }));
    state.prechecks.push('resource');
    await close(homeworkAddress.server);
    await add('homework-service', await deps.homework.startServer({ env, connection: models.Task.db,
      host: '127.0.0.1', port: homeworkAddress.port, appLogger: quietLogger }));
    state.prechecks.push('homework');
    const { createMediaReferenceClient } = require('../../common/services/mediaReferenceClient');
    const { createFamilyMistakeMediaService } = require('../../services/analytics-service/services/familyMistakeMediaService');
    const analytics = deps.analytics.createApp({ logger: quietLogger, familyMistakeMediaService: createFamilyMistakeMediaService({
      FamilyMistakeModel: require('../../services/analytics-service/models/FamilyMistake'),
      FamilyMistakeStateEventModel: require('../../services/analytics-service/models/FamilyMistakeStateEvent'),
      mediaReferenceClient: createMediaReferenceClient({ resourceServiceUrl: env.RESOURCE_SERVICE_URL,
        serviceToken: env.MEDIA_REFERENCE_SERVICE_TOKEN, timeout: 2000 }), randomUUID, logger: quietLogger
    }) });
    await add('analytics-service', analytics.listen(0, '127.0.0.1'));
    await add('notification-service', deps.notification.createApp({ logger: quietLogger }).listen(0, '127.0.0.1'));
    const urls = Object.fromEntries(state.servers.map(row => [row.name, row.url]));
    const gatewayApp = deps.gateway.createApp({ appLogger: quietLogger, enableLegacyDataProxy: false,
      jwtSecret: env.JWT_SECRET, identitySecret: env.GATEWAY_IDENTITY_SECRET,
      serviceHosts: Object.fromEntries(['user', 'progress', 'resource', 'homework', 'analytics', 'notification']
        .map(name => [name, urls[name + '-service']])),
      rateLimitOptions: { windowMs: 900000, max: 2000, standardHeaders: true, legacyHeaders: false } });
    const gatewayAddress = await reserve();
    await close(gatewayAddress.server);
    const baseUrl = await add('api-gateway', await deps.gateway.startServer({
      app: loopbackOnly(gatewayApp), port: gatewayAddress.port, appLogger: quietLogger
    }));
    urls['api-gateway'] = baseUrl;
    const api = createTask11ApiClient({ baseURL: baseUrl, httpClient: require('axios').create({
      baseURL: baseUrl, proxy: false, timeout: 10000, validateStatus: () => true
    }) });
    const fileSnapshot = async (directory, relative = '') => {
      const rows = [];
      for (const name of (await fs.readdir(directory)).sort()) {
        const filename = path.join(directory, name), key = path.join(relative, name), stat = await fs.lstat(filename);
        if (stat.isDirectory()) rows.push(...await fileSnapshot(filename, key));
        else rows.push({ path: key, mode: stat.mode & 0o777, size: stat.size,
          sha256: createHash('sha256').update(await fs.readFile(filename)).digest('hex') });
      }
      return rows;
    };
    const snapshot = async () => {
      const database = {};
      for (const [name, model] of Object.entries(models)) {
        const options = name === 'User' ? { projection: { _id: 1, role: 1, familyId: 1, 'childProfile.tokenVersion': 1 } } : {};
        database[name] = JSON.parse(JSON.stringify(await model.collection.find({}, options).sort({ _id: 1 }).toArray()));
      }
      return { database, files: await fileSnapshot(state.root) };
    };
    const { createSeed } = require('./syntheticSeed');
    const { seed, login } = createSeed({ api, models });
    return { baseUrl, baseURL: baseUrl, gatewayUrl: baseUrl, api, seed, login, snapshot, inspect: snapshot, stop,
      privateRoot: state.root, mediaRoot, journalRoot, servers: state.servers, urls, mongooseInstances: instances,
      mode: 'enabled', cleanupEnabled: false, mongoHello, prechecks: state.prechecks,
      modelConnectionsMatch: models.Task.db === models.Operation.db && models.Task.db === models.Guard.db
        && models.Asset.db === models.Reference.db && models.Asset.db === models.RemoteOperation.db
        && models.Asset.db === models.UploadGuard.db && models.User.db === models.Family.db,
      composition: { core: ['gateway', 'user production factory', 'homework enabled production factory',
        'resource enabled production factory', 'progress official factory'],
      auxiliary: ['analytics existing app/routes', 'notification existing app/routes'],
      disabled: ['orphan cleanup execution', 'restore execution', 'user deletion v2 writer', 'D2b assembly'],
      scanner: 'trusted-local; no ClamAV claim', database: 'shared isolated synthetic database; cross-service commands use HTTP' },
      droppedResponses: state.dropped,
      dropNextResponse: ({ service = 'api-gateway', method, path: target }) => {
        if (!state.servers.some(row => row.name === service) || !['POST', 'PATCH', 'DELETE'].includes(method)
          || typeof target !== 'string' || !target.startsWith('/api/') || target.includes('?')) throw safeError({ code: 'T2_INVALID_FAULT' });
        state.faults.push({ service, method, path: target });
      }
    };
  } catch (error) {
    await stop(); throw safeError(error);
  }
};
module.exports = { createT2Runtime };
