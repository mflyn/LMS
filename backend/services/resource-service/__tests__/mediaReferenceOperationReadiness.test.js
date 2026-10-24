const { randomUUID, createHash } = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet, MongoMemoryServer } = require('mongodb-memory-server');
const Operation = require('../models/MediaReferenceOperation');

jest.setTimeout(30000);
const NAME = 'mediareferenceoperations';
const KEY = { familyId: 1, childId: 1, resourceType: 1, resourceId: 1, field: 1, operationId: 1 };
const FIELD = 'completionMediaIds';
const id = () => new mongoose.Types.ObjectId();
const hash = refs => createHash('sha256').update(JSON.stringify(refs.map(ref => ({
  mediaId: String(ref.mediaId), field: ref.field
})))).digest('hex');
const command = (patch = {}) => {
  const references = [{ mediaId: id(), field: FIELD }, { mediaId: id(), field: FIELD }];
  return { familyId: id(), childId: id(), resourceType: 'growth_task', resourceId: id(), field: FIELD,
    operationId: randomUUID(), commandHash: 'a'.repeat(64), references, referenceSetHash: hash(references),
    state: 'PREPARED', version: 0, leaseExpiresAt: new Date('2026-10-22T00:15:00Z'),
    terminalAt: null, failureCode: null, ...patch };
};
let mongo, collection, check;
const run = (options = {}) => check({ connection: mongoose.connection, writesPaused: true, ...options });
const snapshot = async () => ({ rows: await collection.find().sort({ _id: 1 }).toArray(),
  indexes: await collection.listIndexes().toArray() });
const blocked = async (issue, options) => {
  let failure;
  try { await run(options); } catch (error) { failure = error; }
  expect(failure).toMatchObject({ code: 'MEDIA_OPERATION_PROTOCOL_NOT_READY', issues: expect.arrayContaining([issue]) });
  expect(failure.message).toBe('Media operation readiness check failed');
  expect(JSON.stringify(failure)).not.toMatch(/mongodb:|private-error|familyId|childId|operationId/);
  return failure;
};
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri()); await Operation.init();
});
beforeEach(async () => {
  ({ assertMediaReferenceOperationReadiness: check } = require('../services/mediaReferenceOperationReadiness'));
  expect(Operation.collection.collectionName).toBe(NAME);
  await mongoose.connection.db.dropCollection(NAME).catch(error => { if (error.code !== 26) throw error; });
  collection = await mongoose.connection.db.createCollection(NAME);
  await collection.createIndex(KEY, { unique: true, name: 'media_reference_operation_scope' });
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test('empty indexed replica-set ledger is ready without creating data', async () => {
  const before = await snapshot();
  expect(await run()).toEqual({ ready: true, service: 'resource-service', protocol: 'task-completion-v1', scope: 'operation-ledger' });
  expect(await snapshot()).toEqual(before);
});
test.each([undefined, false, 'true'])('requires explicit stopped-write acknowledgement %s before accessing the connection', async writesPaused => {
  await blocked('WRITES_NOT_PAUSED', { writesPaused, connection: { get db() { throw Error('private-error'); } } });
});
test.each([
  ['standalone', { isWritablePrimary: true, maxWireVersion: 17, logicalSessionTimeoutMinutes: 30 }],
  ['secondary', { setName: 'rs', isWritablePrimary: false, maxWireVersion: 17, logicalSessionTimeoutMinutes: 30 }],
  ['old wire', { setName: 'rs', isWritablePrimary: true, maxWireVersion: 6, logicalSessionTimeoutMinutes: 30 }],
  ['no sessions', { setName: 'rs', isWritablePrimary: true, maxWireVersion: 17 }]
])('%s topology is rejected before ledger reads', async (_name, hello) => {
  const open = jest.fn();
  await blocked('TRANSACTIONS_UNAVAILABLE', { connection: { db: { admin: () => ({ command: async () => hello }), collection: open } } });
  expect(open).not.toHaveBeenCalled();
});
test('real standalone and missing connection fail closed', async () => {
  const server = await MongoMemoryServer.create(), client = new mongoose.mongo.MongoClient(server.getUri());
  try {
    await client.connect(); await blocked('TRANSACTIONS_UNAVAILABLE', { connection: { db: client.db('standalone') } });
    await blocked('TRANSACTIONS_UNAVAILABLE', { connection: undefined });
  } finally { try { await client.close(); } finally { await server.stop(); } }
});
test('hello failures are sanitized and reads explicitly select primary', async () => {
  const query = jest.fn().mockRejectedValue(Error('mongodb://private-error'));
  await blocked('TRANSACTIONS_UNAVAILABLE', { connection: { db: { admin: () => ({ command: query }) } } });
  expect(query).toHaveBeenCalledWith({ hello: 1 }, { maxTimeMS: 5000, readPreference: 'primary' });
});
test('missing collection is not auto-created', async () => {
  await collection.drop(); await blocked('OPERATION_COLLECTION_MISSING');
  expect(await mongoose.connection.db.listCollections({ name: NAME }).toArray()).toEqual([]);
});
test.each(['missing', 'nonunique', 'sparse', 'partial', 'wrong-key', 'collation', 'prepareUnique'])
  ('rejects %s in place of the committed full scope constraint', async kind => {
    await collection.dropIndexes();
    if (kind !== 'missing') await collection.createIndex(kind === 'wrong-key' ? { operationId: 1 } : KEY, {
      name: 'candidate', unique: !['nonunique', 'prepareUnique'].includes(kind),
      ...(kind === 'sparse' ? { sparse: true } : {}),
      ...(kind === 'partial' ? { partialFilterExpression: { state: 'PREPARED' } } : {}),
      ...(kind === 'collation' ? { collation: { locale: 'en', strength: 2 } } : {})
    });
    if (kind === 'prepareUnique') await mongoose.connection.db.command({ collMod: NAME, index: { name: 'candidate', prepareUnique: true } });
    const before = await snapshot(); await blocked('COMMAND_SCOPE_INDEX_INVALID'); expect(await snapshot()).toEqual(before);
  });
test('equivalent hidden renamed reordered indexes are accepted', async () => {
  await collection.dropIndexes();
  await collection.createIndex(Object.fromEntries(Object.entries(KEY).reverse()), { name: 'equivalent', unique: true, hidden: true });
  await collection.createIndex({ state: 1 });
  expect((await run()).ready).toBe(true);
});
test.each(['unique', 'sparse', 'partial', 'prepareUnique'])('rejects extra %s constraints that narrow operation scope', async kind => {
  await collection.createIndex({ operationId: 1 }, { name: 'narrow', unique: kind !== 'prepareUnique',
    ...(kind === 'sparse' ? { sparse: true } : {}),
    ...(kind === 'partial' ? { partialFilterExpression: { state: 'PREPARED' } } : {}) });
  if (kind === 'prepareUnique') {
    await mongoose.connection.db.command({ collMod: NAME, index: { name: 'narrow', prepareUnique: true } });
    const first = command(); await collection.insertOne(first);
    await expect(collection.insertOne(command({ operationId: first.operationId }))).rejects.toMatchObject({ code: 11000 });
  }
  const before = await snapshot(); await blocked('UNEXPECTED_UNIQUE_INDEX'); expect(await snapshot()).toEqual(before);
});
test('TTL is forbidden on retained operation history', async () => {
  await collection.createIndex({ terminalAt: 1 }, { expireAfterSeconds: 86400 });
  await blocked('OPERATION_TTL_FORBIDDEN');
});
test('real building index blocks readiness until committed', async () => {
  const server = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ args: ['--setParameter', 'enableTestCommands=1'] }] });
  const client = new mongoose.mongo.MongoClient(server.getUri()); let admin, build;
  try {
    await client.connect(); const db = client.db('build'); admin = db.admin();
    const target = await db.createCollection(NAME); await target.insertOne(command());
    const point = await admin.command({ configureFailPoint: 'hangAfterStartingIndexBuild', mode: 'alwaysOn' });
    build = target.createIndex(KEY, { unique: true }).then(() => ({ ok: true }), error => ({ error }));
    await admin.command({ waitForFailPoint: 'hangAfterStartingIndexBuild', timesEntered: point.count + 1, maxTimeMS: 5000 });
    expect((await target.listIndexes().toArray()).some(index => index.unique === true)).toBe(true);
    await blocked('INDEX_BUILD_IN_PROGRESS', { connection: { db } });
    await admin.command({ configureFailPoint: 'hangAfterStartingIndexBuild', mode: 'off' });
    expect(await build).toEqual({ ok: true }); expect((await run({ connection: { db } })).ready).toBe(true);
  } finally {
    try {
      if (admin) await admin.command({ configureFailPoint: 'hangAfterStartingIndexBuild', mode: 'off' });
      if (build) expect(await build).toEqual({ ok: true });
    } finally { try { await client.close(); } finally { await server.stop(); } }
  }
});
test.each([
  ['missing UUID', { operationId: undefined }], ['null UUID', { operationId: null }],
  ['array UUID', { operationId: [randomUUID()] }], ['uppercase UUID', { operationId: randomUUID().toUpperCase() }],
  ['newline UUID', { operationId: randomUUID() + '\n' }], ['bad UUID', { operationId: 'bad' }],
  ['string family', { familyId: String(id()) }], ['null child', { childId: null }], ['missing resource', { resourceId: undefined }],
  ['legacy resource', { resourceType: 'child' }], ['legacy field', { field: 'attachmentMediaIds' }],
  ['bad command hash', { commandHash: 'A'.repeat(64) }], ['newline command hash', { commandHash: 'a'.repeat(64) + '\n' }]
])('rejects native identity corruption: %s', async (_label, patch) => {
  await collection.insertOne(command(patch)); const before = await snapshot();
  await blocked('OPERATION_IDENTITY_INVALID'); expect(await snapshot()).toEqual(before);
});
test.each(['missing', 'scalar', 'empty', 'eleven', 'duplicate', 'null item', 'string id', 'wrong field', 'unsorted', 'wrong hash', 'newline hash'])
  ('rejects native reference corruption: %s', async kind => {
    const value = command();
    if (kind === 'missing') delete value.references;
    if (kind === 'scalar') value.references = value.references[0];
    if (kind === 'empty') value.references = [];
    if (kind === 'eleven') value.references = Array.from({ length: 11 }, () => ({ mediaId: id(), field: FIELD }));
    if (kind === 'duplicate') value.references[1] = value.references[0];
    if (kind === 'null item') value.references[0] = null;
    if (kind === 'string id') value.references[0].mediaId = String(value.references[0].mediaId);
    if (kind === 'wrong field') value.references[0].field = 'attachmentMediaIds';
    if (kind === 'unsorted') { value.references.reverse(); value.referenceSetHash = hash(value.references); }
    if (kind === 'wrong hash') value.referenceSetHash = 'b'.repeat(64);
    if (kind === 'newline hash') value.referenceSetHash += '\n';
    await collection.insertOne(value); const before = await snapshot();
    await blocked('OPERATION_REFERENCES_INVALID'); expect(await snapshot()).toEqual(before);
  });
test.each([
  ['ABSENT', { state: 'ABSENT' }], ['missing version', { version: undefined }], ['negative version', { version: -1 }],
  ['fractional version', { version: 0.5 }], ['unsafe version', { version: Number.MAX_SAFE_INTEGER + 1 }],
  ['missing lease', { leaseExpiresAt: null }], ['string lease', { leaseExpiresAt: '2026-10-22' }],
  ['prepared terminal', { terminalAt: new Date() }], ['prepared code', { failureCode: 'MEDIA_OPERATION_EXPIRED' }],
  ['committed lease', { state: 'COMMITTED', terminalAt: new Date() }],
  ['missing terminal', { state: 'COMMITTED', leaseExpiresAt: null }],
  ['string terminal', { state: 'COMMITTED', leaseExpiresAt: null, terminalAt: '2026-10-22' }],
  ['committed code', { state: 'COMMITTED', leaseExpiresAt: null, terminalAt: new Date(), failureCode: 'FAILURE' }],
  ['aborted without code', { state: 'ABORTED', leaseExpiresAt: null, terminalAt: new Date() }],
  ['aborted bad code', { state: 'ABORTED', leaseExpiresAt: null, terminalAt: new Date(), failureCode: 'BAD\n' }]
])('rejects native lifecycle corruption: %s', async (_label, patch) => {
  await collection.insertOne(command(patch)); const before = await snapshot();
  await blocked('OPERATION_STATE_INVALID'); expect(await snapshot()).toEqual(before);
});
test('valid three states, expired lease, ten references and scoped UUID reuse remain unchanged', async () => {
  const first = command({ leaseExpiresAt: new Date('2000-01-01') });
  const ten = Array.from({ length: 10 }, () => ({ mediaId: id(), field: FIELD }));
  await Operation.create([first,
    command({ operationId: first.operationId, state: 'COMMITTED', leaseExpiresAt: null, terminalAt: new Date(), references: ten, referenceSetHash: hash(ten) }),
    command({ state: 'ABORTED', leaseExpiresAt: null, terminalAt: new Date(), failureCode: 'MEDIA_OPERATION_EXPIRED' })]);
  const before = await snapshot(); expect((await run()).ready).toBe(true); expect(await snapshot()).toEqual(before);
});
test('historical duplicate scopes are reported without leaking values or repairing rows', async () => {
  await collection.dropIndexes(); const first = command();
  await collection.insertMany([first, { ...first, commandHash: 'c'.repeat(64) }]);
  const before = await snapshot(), error = await blocked('COMMAND_SCOPE_DUPLICATE');
  expect(JSON.stringify(error)).not.toContain(first.operationId); expect(JSON.stringify(error)).not.toContain(String(first.familyId));
  expect(await snapshot()).toEqual(before);
});
test('a stored ordinary object with a BSON-looking tag is not a scope ObjectId', async () => {
  const value = command(); await collection.insertOne(value);
  await collection.updateOne({ _id: value._id }, [{ $set: {
    familyId: { $arrayToObject: { $literal: [{ k: '_bsontype', v: 'ObjectId' }] } }
  } }]);
  const stored = await collection.findOne({ _id: value._id });
  expect(stored.familyId).toEqual({ _bsontype: 'ObjectId' });
  expect(typeof stored.familyId.toHexString).toBe('undefined');
  await blocked('OPERATION_IDENTITY_INVALID');
});
test('non-ObjectId ledger _id cannot pass readiness for a transition that hydrate rejects', async () => {
  const value = command({ _id: 'invalid-ledger-id' }); await collection.insertOne(value);
  const stored = await collection.findOne({ _id: value._id });
  await expect(Operation.hydrate({ ...stored, state: 'ABORTED', leaseExpiresAt: null,
    terminalAt: new Date(), failureCode: 'MEDIA_OPERATION_ABORTED' }).validate()).rejects.toMatchObject({
    errors: { _id: expect.anything() }
  });
  const error = await blocked('OPERATION_IDENTITY_INVALID');
  expect(JSON.stringify(error)).not.toContain(value._id);
});
test.each([false, true])('non-simple collection defaults are blocked explicitly, not reported as duplicate UUIDs (rows=%s)', async populated => {
  await collection.drop();
  collection = await mongoose.connection.db.createCollection(NAME, { collation: { locale: 'en', numericOrdering: true } });
  await collection.createIndex(KEY, { unique: true, collation: { locale: 'simple' } });
  if (populated) {
    const first = command({ operationId: '0a001aaa-1111-4111-8111-111111111111' });
    await collection.insertMany([first, { ...first, operationId: '00a01aaa-1111-4111-8111-111111111111' }]);
    expect(await collection.countDocuments({ operationId: first.operationId })).toBe(2);
    expect(await collection.countDocuments({ operationId: first.operationId }, { collation: { locale: 'simple' } })).toBe(1);
  }
  const before = await snapshot(), error = await blocked('OPERATION_COLLECTION_COLLATION_INVALID');
  expect(error.issues).not.toContain('COMMAND_SCOPE_DUPLICATE'); expect(await snapshot()).toEqual(before);
});
test('cold loading cannot import models or mongoose, and the dependency tripwire detects an attempted import', () => {
  const { spawnSync } = require('child_process');
  const target = require.resolve('../services/mediaReferenceOperationReadiness');
  const script = `
    const Module = require('module');
    const original = Module._load;
    Module._load = function(request, parent, isMain) {
      const resolved = Module._resolveFilename(request, parent);
      if (request === 'mongoose' || /[\\\\/]models[\\\\/]|[\\\\/]mongoose[\\\\/]/.test(resolved)) {
        throw Error('Model import forbidden in readiness');
      }
      return original.apply(this, arguments);
    };
    require(${JSON.stringify(target)});
    if (process.argv[1] === 'probe') require('mongoose');
  `;
  const clean = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  expect({ status: clean.status, stderr: clean.stderr }).toEqual({ status: 0, stderr: '' });
  const probe = spawnSync(process.execPath, ['-e', script, 'probe'], { encoding: 'utf8' });
  expect(probe.status).not.toBe(0); expect(probe.stderr).toContain('Model import forbidden in readiness');
});
test('corruption beyond the first document batch cannot yield ready', async () => {
  await collection.insertMany([command(), command({ state: 'ABSENT' })]);
  const read = collection.find.bind(collection); let cursor;
  jest.spyOn(collection, 'find').mockImplementation((query, options) => {
    cursor = read(query, { ...options, batchSize: 1 }).sort({ _id: 1 }); jest.spyOn(cursor, 'close'); return cursor;
  });
  jest.spyOn(mongoose.connection.db, 'collection').mockReturnValue(collection);
  await blocked('OPERATION_STATE_INVALID'); expect(cursor.close).toHaveBeenCalled();
});
test.each(['indexes', 'documents'])('%s cursor close rejection fails sanitized', async kind => {
  const close = jest.fn().mockRejectedValue(Error('mongodb://private-error'));
  if (kind === 'indexes') {
    jest.spyOn(mongoose.connection.db, 'runCursorCommand').mockReturnValue({
      toArray: async () => [{ key: KEY, unique: true }], close
    });
  } else {
    jest.spyOn(collection, 'find').mockReturnValue({ close, async *[Symbol.asyncIterator]() { yield command(); } });
    jest.spyOn(mongoose.connection.db, 'collection').mockReturnValue(collection);
  }
  await blocked('READINESS_QUERY_FAILED'); expect(close).toHaveBeenCalledTimes(1);
});
test('index cursor errors close and fail sanitized without helper fallback', async () => {
  const close = jest.fn().mockResolvedValue(), helper = jest.spyOn(collection, 'listIndexes');
  jest.spyOn(mongoose.connection.db, 'runCursorCommand').mockReturnValue({ toArray: async () => { throw Error('mongodb://private-error'); }, close });
  await blocked('READINESS_QUERY_FAILED'); expect(close).toHaveBeenCalledTimes(1); expect(helper).not.toHaveBeenCalled();
});
test.each(['read', 'close'])('collection metadata %s failure is sanitized and closes the cursor', async kind => {
  const close = kind === 'close' ? jest.fn().mockRejectedValue(Error('mongodb://private-error')) : jest.fn().mockResolvedValue();
  jest.spyOn(mongoose.connection.db, 'listCollections').mockReturnValue({ close,
    next: async () => { if (kind === 'read') throw Error('mongodb://private-error'); return { name: NAME, options: {} }; }
  });
  await blocked('READINESS_QUERY_FAILED'); expect(close).toHaveBeenCalledTimes(1);
});
test('stream failures close the document cursor and never return partial ready', async () => {
  const close = jest.fn().mockResolvedValue();
  jest.spyOn(collection, 'find').mockReturnValue({ close, async *[Symbol.asyncIterator]() { yield command(); throw Error('mongodb://private-error'); } });
  jest.spyOn(mongoose.connection.db, 'collection').mockReturnValue(collection);
  await blocked('READINESS_QUERY_FAILED'); expect(close).toHaveBeenCalledTimes(1);
});
test('aggregate errors fail closed without raw driver errors', async () => {
  jest.spyOn(collection, 'aggregate').mockImplementation(() => { throw Error('mongodb://private-error'); });
  jest.spyOn(mongoose.connection.db, 'collection').mockReturnValue(collection);
  await blocked('READINESS_QUERY_FAILED');
});
test('primary native reads consume multiple batches and close without model init or writes', async () => {
  await collection.insertMany(Array.from({ length: 3 }, () => command()));
  const before = await snapshot(), db = mongoose.connection.db, original = db.runCursorCommand.bind(db);
  let indexCursor, rowCursor, metadataCursor; const read = collection.find.bind(collection);
  const metadata = db.listCollections.bind(db);
  const listCollections = jest.spyOn(db, 'listCollections').mockImplementation((filter, options) => {
    metadataCursor = metadata(filter, options); jest.spyOn(metadataCursor, 'close'); return metadataCursor;
  });
  const list = jest.spyOn(db, 'runCursorCommand').mockImplementation((cmd, options) => {
    indexCursor = original({ ...cmd, cursor: { batchSize: 1 } }, options); jest.spyOn(indexCursor, 'close'); return indexCursor;
  });
  const find = jest.spyOn(collection, 'find').mockImplementation((query, options) => {
    rowCursor = read(query, { ...options, batchSize: 1 }); jest.spyOn(rowCursor, 'close'); return rowCursor;
  });
  const aggregate = jest.spyOn(collection, 'aggregate'), init = jest.spyOn(Operation, 'init');
  const writes = ['insertOne', 'updateMany', 'deleteMany', 'createIndex', 'drop', 'dropIndexes'];
  for (const method of writes) jest.spyOn(collection, method).mockImplementation(() => { throw Error('Unexpected write'); });
  jest.spyOn(db, 'collection').mockImplementation(name => { expect(name).toBe(NAME); return collection; });
  expect((await run()).ready).toBe(true);
  expect(list).toHaveBeenCalledWith({ listIndexes: NAME, includeBuildUUIDs: true, cursor: { batchSize: 100 }, maxTimeMS: 5000 }, { readPreference: 'primary' });
  expect(listCollections).toHaveBeenCalledWith({ name: NAME }, { nameOnly: false, maxTimeMS: 5000, readPreference: 'primary' });
  expect(find).toHaveBeenCalledWith({}, { batchSize: 100, maxTimeMS: 5000, readPreference: 'primary',
    projection: { _id: 1, ...KEY, commandHash: 1, referenceSetHash: 1, references: 1,
      state: 1, version: 1, leaseExpiresAt: 1, terminalAt: 1, failureCode: 1 } });
  expect(aggregate.mock.calls[0][1]).toEqual({ maxTimeMS: 5000, readPreference: 'primary', allowDiskUse: false });
  expect(metadataCursor.close).toHaveBeenCalled(); expect(indexCursor.close).toHaveBeenCalled(); expect(rowCursor.close).toHaveBeenCalled();
  expect(init).not.toHaveBeenCalled(); for (const method of writes) expect(collection[method]).not.toHaveBeenCalled();
  jest.restoreAllMocks(); expect(await snapshot()).toEqual(before);
});
test('real protocol transactions produce accepted evidence without preflight recovering an expired lease', async () => {
  const Asset = require('../models/MediaAsset'), Reference = require('../models/MediaReference');
  const Receipt = require('../models/MediaDeletionReceipt'), Tombstone = require('../models/MediaDeletionTombstone');
  const { createMongoTransactionRunner } = require('../services/mongoTransaction');
  const { createMediaReferenceOperationService } = require('../services/mediaReferenceOperationService');
  for (const model of [Asset, Reference, Receipt, Tombstone]) await model.init();
  let time = Date.parse('2026-10-22T00:00:00Z');
  const service = createMediaReferenceOperationService({ transactionRunner: createMongoTransactionRunner(mongoose.connection), now: () => time });
  for (const state of ['PREPARED', 'COMMITTED', 'ABORTED']) {
    const value = command();
    const assets = await Asset.create(value.references.map(() => ({ familyId: value.familyId, childId: value.childId,
      uploadedBy: id(), purpose: 'task_completion', mimeType: 'image/jpeg', sizeBytes: 100, storageKey: randomUUID() })));
    const wire = { familyId: String(value.familyId), childId: String(value.childId), resourceId: String(value.resourceId),
      resourceType: 'growth_task', operationId: value.operationId.toUpperCase(), commandHash: value.commandHash,
      references: assets.reverse().map(asset => ({ mediaId: String(asset._id), field: FIELD })) };
    await service.prepare(wire);
    if (state === 'COMMITTED') await service.commit(wire);
    if (state === 'ABORTED') await service.abort(wire);
  }
  time += 3600000;
  const before = await snapshot(), references = await Reference.find().lean();
  expect(before.rows.map(row => row.state).sort()).toEqual(['ABORTED', 'COMMITTED', 'PREPARED']);
  expect(before.rows.find(row => row.state === 'PREPARED').leaseExpiresAt.getTime()).toBeLessThan(time);
  expect((await run()).ready).toBe(true);
  expect(await snapshot()).toEqual(before); expect(await Reference.find().lean()).toEqual(references);
});
