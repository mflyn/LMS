const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const Operation = require('../../models/GrowthTaskCompletionOperation');

const NAME = 'growthtaskcompletionoperations';
const scopeKey = { familyId: 1, childId: 1, taskId: 1, actorId: 1, action: 1, operationId: 1 };
const indexNames = { scope: 'completion_command_scope', remote: 'completion_remote_operation' };
const keys = { scope: scopeKey, remote: { remoteOperationId: 1 } };
let check, collection;
const run = (options = {}) => check({ connection: mongoose.connection, writesPaused: true, ...options });
const command = (phase = 'PREPUBLISH') => {
  const value = {
    familyId: new mongoose.Types.ObjectId(), childId: new mongoose.Types.ObjectId(),
    taskId: new mongoose.Types.ObjectId(), actorId: new mongoose.Types.ObjectId(),
    action: 'complete', operationId: randomUUID(), remoteOperationId: randomUUID(), commandHash: 'a'.repeat(64),
    targetCompletionVersion: 1, version: 0, phase
  };
  if (phase === 'FAILED') Object.assign(value, { failureCode: 'MEDIA_OPERATION_ABORTED', failureStatus: 409 });
  if (['SUCCEEDED', 'PUBLISHED_CLEANUP'].includes(phase)) value.successResponse = {
    success: true, data: { task: { taskId: value.taskId, status: 'completed', checklistVersion: 0,
      completionVersion: 1, completionMediaIds: [], completionMediaReferenceState: 'stable',
      parentConfirmed: false, completedAt: new Date('2026-10-22T00:00:00Z') } }
  };
  return value;
};
const snapshot = async () => ({
  rows: await collection.find().sort({ _id: 1 }).toArray(),
  indexes: await collection.listIndexes().toArray()
});
const blocked = async (issue, options) => {
  let failure;
  try { await run(options); } catch (error) { failure = error; }
  expect(failure).toMatchObject({ code: 'COMPLETION_PROTOCOL_NOT_READY', issues: expect.arrayContaining([issue]) });
  expect(failure.message).toBe('Task completion readiness check failed');
  expect(JSON.stringify(failure)).not.toMatch(/mongodb:|private-database-error|familyId|childId|remoteOperationId/);
  return failure;
};

beforeAll(async () => { await Operation.init(); });
beforeEach(async () => {
  ({ assertGrowthTaskCompletionReadiness: check } = require('../../services/growthTaskCompletionReadiness'));
  expect(Operation.collection.collectionName).toBe(NAME);
  await mongoose.connection.db.dropCollection(NAME).catch(error => { if (error.code !== 26) throw error; });
  collection = await mongoose.connection.db.createCollection(NAME);
  for (const [key, options] of Operation.schema.indexes()) await collection.createIndex(key, options);
});
afterEach(() => jest.restoreAllMocks());

test('empty, explicitly indexed replica-set collection is ready without writes', async () => {
  const before = await snapshot();
  expect(await run()).toEqual({ ready: true, service: 'homework-service', protocol: 'task-completion-v1' });
  expect(await snapshot()).toEqual(before);
});
test.each([undefined, false, 'true'])('requires an explicit stopped-write acknowledgement (%s) before any database access', async writesPaused => {
  const connection = { get db() { throw Error('private-database-error'); } };
  await blocked('WRITES_NOT_PAUSED', { writesPaused, connection });
});
test('missing connection fails closed and does not expose connection errors', async () => {
  await blocked('TRANSACTIONS_UNAVAILABLE', { connection: undefined });
});
test.each([
  ['standalone', { isWritablePrimary: true, maxWireVersion: 17, logicalSessionTimeoutMinutes: 30 }],
  ['secondary', { setName: 'rs0', isWritablePrimary: false, maxWireVersion: 17, logicalSessionTimeoutMinutes: 30 }],
  ['old wire', { setName: 'rs0', isWritablePrimary: true, maxWireVersion: 6, logicalSessionTimeoutMinutes: 30 }],
  ['no sessions', { setName: 'rs0', isWritablePrimary: true, maxWireVersion: 17 }]
])('%s topology cannot reach the ledger checks', async (_label, hello) => {
  const open = jest.fn();
  await blocked('TRANSACTIONS_UNAVAILABLE', { connection: { db: { admin: () => ({ command: async () => hello }), collection: open } } });
  expect(open).not.toHaveBeenCalled();
});
test('a real standalone MongoDB is not accepted as a transaction-capable replica set', async () => {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const server = await MongoMemoryServer.create();
  const client = new mongoose.mongo.MongoClient(server.getUri());
  try {
    await client.connect(); await blocked('TRANSACTIONS_UNAVAILABLE', { connection: { db: client.db('readiness') } });
  } finally { await client.close(); await server.stop(); }
});
test('topology queries are bounded and driver failures are sanitized', async () => {
  const query = jest.fn().mockRejectedValue(Error('mongodb://private-database-error'));
  await blocked('TRANSACTIONS_UNAVAILABLE', { connection: { db: { admin: () => ({ command: query }) } } });
  expect(query).toHaveBeenCalledWith({ hello: 1 }, { maxTimeMS: 5000, readPreference: 'primary' });
});
test('missing collection is blocked without creating it or its indexes', async () => {
  await collection.drop(); await blocked('OPERATION_COLLECTION_MISSING');
  expect(await mongoose.connection.db.listCollections({ name: NAME }).toArray()).toEqual([]);
});

test.each(['scope', 'remote'].flatMap(kind => ['missing', 'nonunique', 'sparse', 'partial', 'wrong-key', 'collation']
  .map(variant => [kind, variant])))('%s %s index cannot substitute for the required full unique constraint', async (kind, variant) => {
  await collection.dropIndex(indexNames[kind]);
  if (variant !== 'missing') await collection.createIndex(variant === 'wrong-key' ? { [kind + 'WrongKey']: 1 } : keys[kind], {
    name: indexNames[kind], unique: variant !== 'nonunique',
    ...(variant === 'sparse' ? { sparse: true } : {}),
    ...(variant === 'partial' ? { partialFilterExpression: { phase: 'PREPUBLISH' } } : {}),
    ...(variant === 'collation' ? { collation: { locale: 'en', strength: 2 } } : {})
  });
  const before = await snapshot();
  await blocked(kind === 'scope' ? 'COMMAND_SCOPE_INDEX_INVALID' : 'REMOTE_MAPPING_INDEX_INVALID');
  expect(await snapshot()).toEqual(before);
});
test('equivalent differently named and hidden unique indexes still enforce the contract', async () => {
  await collection.dropIndexes();
  await collection.createIndex(Object.fromEntries(Object.entries(scopeKey).reverse()), { unique: true, name: 'equivalent_scope', hidden: true });
  await collection.createIndex(keys.remote, { unique: true, name: 'equivalent_remote', hidden: true });
  await collection.createIndex({ phase: 1 });
  const before = await snapshot(); expect((await run()).ready).toBe(true); expect(await snapshot()).toEqual(before);
});
test.each([{}, { sparse: true }, { partialFilterExpression: { phase: 'PREPUBLISH' } }])('an extra public UUID unique index %p is refused even with both correct indexes present', async options => {
  await collection.createIndex({ operationId: 1 }, { unique: true, ...options });
  const before = await snapshot(); await blocked('UNEXPECTED_UNIQUE_INDEX'); expect(await snapshot()).toEqual(before);
});
test('an operation TTL index is refused without removing it', async () => {
  await collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 });
  const before = await snapshot(); await blocked('OPERATION_TTL_FORBIDDEN'); expect(await snapshot()).toEqual(before);
});
test('an extra prepareUnique constraint already rejects valid cross-actor UUID reuse and must block readiness', async () => {
  await collection.createIndex({ operationId: 1 }, { name: 'narrow_prepared_unique' });
  await mongoose.connection.db.command({ collMod: NAME, index: { name: 'narrow_prepared_unique', prepareUnique: true } });
  const first = command(); await collection.insertOne(first);
  const second = { ...command(), operationId: first.operationId };
  await expect(collection.insertOne(second)).rejects.toMatchObject({ code: 11000 });
  const before = await snapshot(); await blocked('UNEXPECTED_UNIQUE_INDEX'); expect(await snapshot()).toEqual(before);
});
test('an actual unfinished unique index build cannot authorize protocol activation', async () => {
  const { MongoMemoryReplSet } = require('mongodb-memory-server');
  const server = await MongoMemoryReplSet.create({ replSet: { count: 1 },
    instanceOpts: [{ args: ['--setParameter', 'enableTestCommands=1'] }] });
  const client = new mongoose.mongo.MongoClient(server.getUri());
  let build, admin;
  try {
    await client.connect(); const db = client.db('readiness_build'); admin = db.admin();
    const target = await db.createCollection(NAME);
    await target.createIndex(scopeKey, { unique: true }); await target.insertOne(command());
    const configured = await admin.command({ configureFailPoint: 'hangAfterStartingIndexBuild', mode: 'alwaysOn' });
    build = target.createIndex(keys.remote, { unique: true }).then(() => ({ ok: true }), error => ({ error }));
    await admin.command({ waitForFailPoint: 'hangAfterStartingIndexBuild', timesEntered: configured.count + 1, maxTimeMS: 5000 });
    const specs = await target.listIndexes().toArray();
    expect(specs.some(index => index.key.remoteOperationId === 1 && index.unique === true)).toBe(true);
    const before = await target.find().toArray();
    await blocked('INDEX_BUILD_IN_PROGRESS', { connection: { db } });
    expect(await target.find().toArray()).toEqual(before);
    await admin.command({ configureFailPoint: 'hangAfterStartingIndexBuild', mode: 'off' });
    expect(await build).toEqual({ ok: true });
    expect((await run({ connection: { db } })).ready).toBe(true);
  } finally {
    try {
      if (admin) await admin.command({ configureFailPoint: 'hangAfterStartingIndexBuild', mode: 'off' });
      if (build) expect(await build).toEqual({ ok: true });
    } finally { try { await client.close(); } finally { await server.stop(); } }
  }
});

test.each(['PREPUBLISH', 'PUBLISHED_CLEANUP', 'SUCCEEDED', 'FAILED'])('missing mapping in %s blocks readiness including empty-media commands', async phase => {
  const value = command(phase); delete value.remoteOperationId; await collection.insertOne(value);
  const before = await snapshot(); await blocked('REMOTE_MAPPING_INVALID'); expect(await snapshot()).toEqual(before);
});
test.each([null, '', 'not-a-uuid', 42, {}, [], [randomUUID()], '123E4567-E89B-42D3-A456-426614174000'])('noncanonical remote mapping %p cannot pass native ledger validation', async value => {
    await collection.insertOne({ ...command(), remoteOperationId: value });
    const before = await snapshot(); await blocked('REMOTE_MAPPING_INVALID'); expect(await snapshot()).toEqual(before);
  });
test('a UUID with a final newline cannot pass the native database regex', async () => {
  await collection.insertOne({ ...command(), remoteOperationId: randomUUID() + '\n' });
  const before = await snapshot(); await blocked('REMOTE_MAPPING_INVALID'); expect(await snapshot()).toEqual(before);
});
test('all phases and two actors sharing a public UUID retain their own valid mapping', async () => {
  const values = ['PREPUBLISH', 'PUBLISHED_CLEANUP', 'SUCCEEDED', 'FAILED'].map(command);
  values[1] = { ...values[1], familyId: values[0].familyId, childId: values[0].childId,
    taskId: values[0].taskId, operationId: values[0].operationId };
  values[1].successResponse.data.task.taskId = values[1].taskId;
  await Operation.create(values);
  const before = await snapshot(); expect((await run()).ready).toBe(true); expect(await snapshot()).toEqual(before);
});
test.each(['scope', 'remote'])('%s duplicate historical rows are reported without returning keys or repairing data', async kind => {
  await collection.dropIndex(indexNames[kind]);
  const first = command(), second = kind === 'scope' ? { ...first, remoteOperationId: randomUUID() }
    : { ...command(), remoteOperationId: first.remoteOperationId };
  await collection.insertMany([first, second]); const before = await snapshot();
  const error = await blocked(kind === 'scope' ? 'COMMAND_SCOPE_DUPLICATE' : 'REMOTE_MAPPING_DUPLICATE');
  expect(JSON.stringify(error)).not.toContain(first.remoteOperationId);
  expect(JSON.stringify(error)).not.toContain(String(first.familyId)); expect(await snapshot()).toEqual(before);
});
test('query errors fail closed without leaking driver text', async () => {
  const db = mongoose.connection.db;
  jest.spyOn(db, 'runCursorCommand').mockImplementation(() => { throw Error('mongodb://private-database-error'); });
  await blocked('READINESS_QUERY_FAILED');
});
test.each(['findOne', 'aggregate'])('%s errors cannot yield a partial ready result or expose database errors', async method => {
  const before = await snapshot();
  jest.spyOn(collection, method).mockImplementation(() => { throw Error('mongodb://private-database-error'); });
  jest.spyOn(mongoose.connection.db, 'collection').mockReturnValue(collection);
  await blocked('READINESS_QUERY_FAILED');
  expect(await snapshot()).toEqual(before);
});
test('native reads are bounded and never call collection writes, index creation or model initialization', async () => {
  const db = mongoose.connection.db, open = db.collection.bind(db);
  const writes = ['insertOne', 'insertMany', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'createIndex', 'createIndexes', 'drop', 'dropIndexes'];
  for (const method of writes) jest.spyOn(collection, method).mockImplementation(() => { throw Error('Unexpected write'); });
  const list = jest.spyOn(db, 'runCursorCommand'), find = jest.spyOn(collection, 'findOne'), aggregate = jest.spyOn(collection, 'aggregate');
  const init = jest.spyOn(Operation, 'init');
  jest.spyOn(db, 'collection').mockImplementation(name => { expect(name).toBe(NAME); return name === NAME ? collection : open(name); });
  expect((await run()).ready).toBe(true);
  expect(list).toHaveBeenCalledWith({ listIndexes: NAME, includeBuildUUIDs: true, cursor: { batchSize: 100 }, maxTimeMS: 5000 }, { readPreference: 'primary' });
  expect(find).toHaveBeenCalledWith(expect.any(Object), { projection: { _id: 1 }, maxTimeMS: 5000, readPreference: 'primary' });
  expect(aggregate).toHaveBeenCalledTimes(2);
  for (const [pipeline, options] of aggregate.mock.calls) {
    expect(pipeline).toContainEqual({ $limit: 1 });
    expect(options).toEqual({ maxTimeMS: 5000, allowDiskUse: false, readPreference: 'primary' });
  }
  expect(init).not.toHaveBeenCalled(); for (const method of writes) expect(collection[method]).not.toHaveBeenCalled();
});
test('index enumeration consumes all cursor batches and closes the native cursor', async () => {
  const db = mongoose.connection.db, open = db.runCursorCommand.bind(db); let cursor;
  jest.spyOn(db, 'runCursorCommand').mockImplementation((command, options) => {
    cursor = open({ ...command, cursor: { batchSize: 1 } }, options); jest.spyOn(cursor, 'close'); return cursor;
  });
  const before = await snapshot(); expect((await run()).ready).toBe(true);
  expect(cursor.close).toHaveBeenCalled(); expect(await snapshot()).toEqual(before);
});
test('a failed index cursor is closed and cannot fall back to plain listIndexes', async () => {
  const close = jest.fn().mockResolvedValue(), list = jest.spyOn(collection, 'listIndexes');
  jest.spyOn(mongoose.connection.db, 'runCursorCommand').mockReturnValue({
    toArray: async () => { throw Error('private-database-error'); }, close
  });
  await blocked('READINESS_QUERY_FAILED'); expect(close).toHaveBeenCalledTimes(1); expect(list).not.toHaveBeenCalled();
});
