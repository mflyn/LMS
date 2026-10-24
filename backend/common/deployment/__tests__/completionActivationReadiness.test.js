const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { assertLegacyCompletionState } = require('../../services/completionActivation');
const servers = {
  homework: require('../../../services/homework-service/server'),
  resource: require('../../../services/resource-service/server')
};
let mongo, connection, root, env;
jest.setTimeout(30000);
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  connection = await mongoose.createConnection(mongo.getUri(), { autoIndex: false, autoCreate: false }).asPromise();
});
beforeEach(async () => {
  await connection.db.dropDatabase();
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'completion-activation-')));
  await fs.chmod(root, 0o700);
  env = { COMPLETION_PROTOCOL_MODE: 'enabled', COMPLETION_WRITES_PAUSED: 'true', MONGO_URI: mongo.getUri(),
    COMPLETION_STORAGE_CONFIRMED: 'true', PRIVATE_MEDIA_ROOT: path.join(root, 'media'),
    COMPLETION_RETIREMENT_SERVICE_TOKEN: 'synthetic-distinct-retirement-token-32chars',
    COMPLETION_DELETION_JOURNAL_ROOT: path.join(root, 'journal') };
  await fs.mkdir(env.PRIVATE_MEDIA_ROOT, { mode: 0o700 });
  await fs.mkdir(env.COMPLETION_DELETION_JOURNAL_ROOT, { mode: 0o700 });
});
afterEach(async () => { jest.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true }); });
afterAll(async () => { await connection?.close(); await mongo?.stop(); });
const snapshot = async () => {
  const collections = await connection.db.listCollections().toArray();
  return Promise.all(collections.sort((a,b) => a.name.localeCompare(b.name)).map(async ({ name }) => ({ name,
    rows: await connection.db.collection(name).find().sort({ _id: 1 }).toArray(),
    indexes: await connection.db.collection(name).listIndexes().toArray() })));
};
const start = (service, overrides = {}) => {
  const app = { listen: jest.fn() };
  const promise = servers[service].startServer({ app, connection, env, connect: async () => connection,
    validateEnvironment: () => {}, appLogger: { info: jest.fn() }, ...overrides });
  return { app, promise };
};
const provision = async service => {
  if (service === 'homework') {
    await connection.db.createCollection('growthtasks');
    await connection.db.collection('growthtaskcompletionoperations').createIndex(
      { familyId: 1, childId: 1, taskId: 1, actorId: 1, action: 1, operationId: 1 }, { unique: true });
    await connection.db.collection('growthtaskcompletionoperations').createIndex({ remoteOperationId: 1 }, { unique: true });
    const guard = require('../../../services/homework-service/models/CompletionMediaGuard');
    for (const [key, options] of guard.schema.indexes()) await connection.db.collection(guard.collection.name).createIndex(key, options);
  } else {
    for (const name of ['MediaAsset', 'MediaReference', 'MediaReferenceOperation', 'MediaDeletionTombstone', 'MediaDeletionReceipt', 'CompletionUploadGuard', 'MediaOrphanRetirement']) {
      const model = require('../../../services/resource-service/models/' + name);
      const collection = connection.db.collection(model.collection.name);
      await connection.db.createCollection(collection.collectionName);
      for (const [key, options] of model.schema.indexes()) await collection.createIndex(key, options);
    }
  }
};

test('native legacy checks permit missing collections and legacy zero versions without writing', async () => {
  const before = await snapshot();
  for (const service of Object.keys(servers)) await assertLegacyCompletionState({ connection, service });
  expect(await snapshot()).toEqual(before);
  await connection.db.collection('growthtasks').insertMany([{ title: 'synthetic' }, { completionVersion: 0, checklistVersion: 0 }]);
  const old = await snapshot();
  await assertLegacyCompletionState({ connection, service: 'homework' }); expect(await snapshot()).toEqual(old);
});
test.each([
  ['homework', 'growthtaskcompletionoperations', { phase: 'FAILED' }],
  ['homework', 'growthtasks', { activeCompletionOperation: { operationId: 'synthetic' } }],
  ['homework', 'growthtasks', { completionPending: {} }],
  ['homework', 'growthtasks', { completionVersion: 1 }],
  ['homework', 'growthtasks', { completionVersion: null }],
  ['homework', 'growthtasks', { checklistVersion: 1 }],
  ['homework', 'growthtasks', { completionEvidence: {} }],
  ['homework', 'growthtasks', { completionMediaBindings: [] }],
  ['homework', 'growthtasks', { completionMediaReferenceState: 'pending_recovery' }],
  ['resource', 'mediareferenceoperations', { state: 'ABORTED' }],
  ['resource', 'mediadeletiontombstones', { mediaId: 'synthetic' }],
  ['resource', 'mediadeletionreceipts', { mediaId: 'synthetic' }],
  ['resource', 'mediareferences', { field: 'completionMediaIds', state: 'released' }],
  ['resource', 'completionuploadguards', { state: 'RETIRED' }],
  ['resource', 'mediaorphanretirements', { state: 'PURGED' }],
  ['homework', 'completionmediaguards', { state: 'retired' }]
])('legacy %s rejects persisted %s %j without repairing it', async (service, collection, record) => {
  await connection.db.collection(collection).insertOne(record);
  const before = await snapshot(); const { app, promise } = start(service, { env: {} });
  await expect(promise).rejects.toMatchObject({ code: 'COMPLETION_LEGACY_UNSAFE' });
  expect(app.listen).not.toHaveBeenCalled(); expect(await snapshot()).toEqual(before);
  expect(connection.readyState).toBe(1);
});
test.each(['homework', 'resource'])('%s checks only its database boundary', async service => {
  const collection = service === 'homework' ? 'mediareferenceoperations' : 'growthtaskcompletionoperations';
  await connection.db.collection(collection).insertOne({ synthetic: true });
  await expect(assertLegacyCompletionState({ connection, service })).resolves.toBeUndefined();
});
test.each(['homework', 'resource'])('%s missing indexes block enabled without automatic DDL', async service => {
  const before = await snapshot(), { app, promise } = start(service);
  await expect(promise).rejects.toMatchObject({ code: service === 'homework' ? 'COMPLETION_PROTOCOL_NOT_READY' : 'COMPLETION_REFERENCES_NOT_READY' });
  expect(app.listen).not.toHaveBeenCalled(); expect(await snapshot()).toEqual(before);
});
test.each(['homework', 'resource'])('%s successful real precheck still blocks not-yet-assembled routes', async service => {
  await provision(service); const before = await snapshot(), { app, promise } = start(service);
  await expect(promise).rejects.toMatchObject({ code: 'COMPLETION_ASSEMBLY_NOT_READY' });
  expect(app.listen).not.toHaveBeenCalled(); expect(await snapshot()).toEqual(before);
  expect(await fs.readdir(env.PRIVATE_MEDIA_ROOT)).toEqual([]);
  expect(await fs.readdir(env.COMPLETION_DELETION_JOURNAL_ROOT)).toEqual([]);
});
test('resource storage failure propagates a sanitized startup rejection after database readiness', async () => {
  await provision('resource'); await fs.chmod(env.COMPLETION_DELETION_JOURNAL_ROOT, 0o755);
  const before = await snapshot(), { app, promise } = start('resource');
  await expect(promise).rejects.toMatchObject({ code: 'COMPLETION_STORAGE_NOT_READY', message: 'COMPLETION_STORAGE_NOT_READY' });
  expect(app.listen).not.toHaveBeenCalled(); expect(await snapshot()).toEqual(before);
  expect((await fs.stat(env.COMPLETION_DELETION_JOURNAL_ROOT)).mode & 0o777).toBe(0o755);
});

test.each(['homework', 'resource'])('%s cannot precheck empty B while formal models use new-protocol A', async service => {
  await mongoose.connect(mongo.getUri('activation-models'), { autoIndex: false, autoCreate: false });
  const name = service === 'homework' ? 'growthtaskcompletionoperations' : 'mediareferenceoperations';
  const collection = mongoose.connection.db.collection(name);
  await collection.insertOne({ synthetic: true, state: 'ABORTED' });
  const before = await collection.find().toArray(), databaseB = await snapshot();
  const connect = jest.fn(async () => connection);
  const listen = jest.spyOn(require('express').application, 'listen');
  let listener;
  try {
    const promise = servers[service].startServer({ connection, connect, port: 0, host: '127.0.0.1',
      validateEnvironment: () => {}, appLogger: { info: jest.fn() },
      env: { ...env, COMPLETION_PROTOCOL_MODE: 'legacy', ENABLE_RABBITMQ: 'false',
        MEDIA_SECURITY_PROFILE: 'trusted-local', MEDIA_SIGNING_SECRET: 'synthetic-only-signing-secret-32chars',
        MEDIA_REFERENCE_SERVICE_TOKEN: 'synthetic-only-service-token-32chars', RESOURCE_SERVICE_URL: 'http://synthetic-resource:3005' }
    }).then(value => { listener = value; return value; });
    await expect(promise).rejects.toMatchObject({ code: 'COMPLETION_CONNECTION_MISMATCH' });
    expect(connect).not.toHaveBeenCalled(); expect(listen).not.toHaveBeenCalled();
    expect(await collection.find().toArray()).toEqual(before); expect(await snapshot()).toEqual(databaseB);
    expect(mongoose.connection.readyState).toBe(1); expect(connection.readyState).toBe(1);
  } finally {
    if (listener) await new Promise(resolve => listener.close(resolve));
    await mongoose.connection.db.dropDatabase(); await mongoose.connection.close();
  }
});
