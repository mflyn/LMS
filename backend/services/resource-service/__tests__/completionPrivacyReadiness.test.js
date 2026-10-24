const { randomUUID, createHash } = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const Asset = require('../models/MediaAsset');
const Reference = require('../models/MediaReference');
const Operation = require('../models/MediaReferenceOperation');
const Tombstone = require('../models/MediaDeletionTombstone');
const Receipt = require('../models/MediaDeletionReceipt');

jest.setTimeout(30000);
const models = { ASSET: Asset, REFERENCE: Reference, TOMBSTONE: Tombstone, RECEIPT: Receipt };
const id = () => new mongoose.Types.ObjectId();
const DATE = new Date('2026-10-22T00:00:00Z');
const FIELD = 'completionMediaIds';
let mongo, check;
const run = (options = {}) => check({ connection: mongoose.connection, writesPaused: true, ...options });
const snapshot = async () => {
  const result = {};
  for (const model of [...Object.values(models), Operation]) result[model.modelName] = {
    rows: await model.collection.find().sort({ _id: 1 }).toArray(), indexes: await model.collection.listIndexes().toArray()
  };
  return result;
};
const blocked = async (issue, options) => {
  let error; try { await run(options); } catch (failure) { error = failure; }
  expect(error).toMatchObject({ code: 'COMPLETION_PRIVACY_NOT_READY', issues: expect.arrayContaining([issue]) });
  expect(error.message).toBe('Completion privacy readiness check failed');
  expect(JSON.stringify(error)).not.toMatch(/mongodb:|private-error|familyId|childId|storageKey|bindingOperationId/);
  return error;
};
const fixture = async () => {
  const familyId = id(), childId = id(), mediaId = id(), resourceId = id(), actorId = id(), operationId = randomUUID();
  const references = [{ mediaId, field: FIELD }];
  const scope = { familyId, childId, resourceId, resourceType: 'growth_task', field: FIELD };
  const asset = { _id: mediaId, familyId, childId, purpose: 'task_completion', status: 'deleted',
    privacyDeletionRecorded: true, deletedAt: DATE, storageKey: randomUUID() };
  const operation = { _id: id(), ...scope, operationId, commandHash: 'a'.repeat(64),
    referenceSetHash: createHash('sha256').update(JSON.stringify([{ mediaId: String(mediaId), field: FIELD }])).digest('hex'),
    references, state: 'COMMITTED', version: 1, leaseExpiresAt: null, terminalAt: DATE, failureCode: null };
  const tombstone = { _id: id(), mediaId, familyId, childId, actorId, role: 'parent',
    purpose: 'task_completion', reason: 'user_requested', deletedAt: DATE };
  const receipt = { _id: id(), ...scope, mediaId, bindingOperationId: operationId, releasedAt: DATE };
  const reference = { _id: id(), ...scope, mediaId, operationId, state: 'released',
    leaseExpiresAt: null, releasedAt: DATE, releaseOperationId: null };
  for (const [model, value] of [[Asset, asset], [Operation, operation], [Tombstone, tombstone], [Receipt, receipt], [Reference, reference]]) {
    await model.collection.insertOne(value);
  }
  return { asset, operation, tombstone, receipt, reference };
};
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ args: ['--setParameter', 'enableTestCommands=1'] }] });
  await mongoose.connect(mongo.getUri());
  for (const model of [...Object.values(models), Operation]) await model.init();
});
beforeEach(async () => {
  ({ assertCompletionPrivacyReadiness: check } = require('../services/completionPrivacyReadiness'));
  for (const model of [...Object.values(models), Operation]) {
    await model.collection.drop();
    const collection = await mongoose.connection.db.createCollection(model.collection.collectionName);
    for (const [key, options] of model.schema.indexes()) await collection.createIndex(key, options);
  }
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test('empty explicitly indexed collections are ready without writes', async () => {
  const before = await snapshot();
  expect(await run()).toEqual({ ready: true, service: 'resource-service', protocol: 'task-completion-v1', scope: 'privacy-evidence' });
  expect(await snapshot()).toEqual(before);
});
test.each([false, undefined, 'true'])('requires explicit paused writes %s before database access', async writesPaused => {
  await blocked('WRITES_NOT_PAUSED', { writesPaused, connection: { get db() { throw Error('private-error'); } } });
});
test('failed operation prerequisite cannot be bypassed', async () => {
  await Operation.collection.dropIndexes(); await blocked('OPERATION_LEDGER_NOT_READY');
});
test('invalid topology cannot reach any evidence collection', async () => {
  const open = jest.fn();
  await blocked('OPERATION_LEDGER_NOT_READY', { connection: { db: {
    admin: () => ({ command: async () => ({ isWritablePrimary: true, maxWireVersion: 17, logicalSessionTimeoutMinutes: 30 }) }), collection: open
  } } });
  expect(open).not.toHaveBeenCalled();
});
test.each(Object.keys(models))('%s collection absence blocks without recreating it', async kind => {
  await models[kind].collection.drop(); await blocked(kind + '_COLLECTION_MISSING');
  expect(await mongoose.connection.db.listCollections({ name: models[kind].collection.collectionName }).toArray()).toEqual([]);
});
test.each(Object.keys(models))('%s non-simple default collation blocks even on an empty collection', async kind => {
  const model = models[kind]; await model.collection.drop();
  const collection = await mongoose.connection.db.createCollection(model.collection.collectionName, { collation: { locale: 'en', strength: 2 } });
  for (const [key, options] of model.schema.indexes()) await collection.createIndex(key, { ...options, collation: { locale: 'simple' } });
  await blocked(kind + '_COLLATION_INVALID');
});
test.each(Object.keys(models))('%s required unique constraint cannot be missing', async kind => {
  await models[kind].collection.dropIndexes(); await blocked(kind + '_INDEX_INVALID');
});
test.each(['sparse', 'partial', 'nonunique', 'prepareUnique'])('receipt %s cannot substitute for complete uniqueness', async kind => {
  const collection = Receipt.collection;
  await collection.dropIndexes(); const [key] = Receipt.schema.indexes()[0];
  await collection.createIndex(key, { name: 'candidate', unique: !['nonunique', 'prepareUnique'].includes(kind),
    ...(kind === 'sparse' ? { sparse: true } : {}),
    ...(kind === 'partial' ? { partialFilterExpression: { field: FIELD } } : {}) });
  if (kind === 'prepareUnique') await mongoose.connection.db.command({ collMod: collection.collectionName,
    index: { name: 'candidate', prepareUnique: true } });
  await blocked('RECEIPT_INDEX_INVALID');
});
test.each(Object.keys(models))('%s TTL must not bypass protocol retention', async kind => {
  await models[kind].collection.createIndex({ syntheticTtl: 1 }, { expireAfterSeconds: 86400 });
  await blocked(kind + '_TTL_FORBIDDEN');
});
test('extra receipt prepareUnique would collapse distinct generations and blocks', async () => {
  await Receipt.collection.createIndex({ mediaId: 1 }, { name: 'narrow' });
  await mongoose.connection.db.command({ collMod: Receipt.collection.collectionName, index: { name: 'narrow', prepareUnique: true } });
  const { receipt } = await fixture();
  await expect(Receipt.collection.insertOne({ ...receipt, _id: id(), bindingOperationId: randomUUID() })).rejects.toMatchObject({ code: 11000 });
  await blocked('RECEIPT_UNEXPECTED_UNIQUE_INDEX');
});
test('equivalent renamed reordered hidden indexes still enforce constraints', async () => {
  await Receipt.collection.dropIndexes(); const [key] = Receipt.schema.indexes()[0];
  await Receipt.collection.createIndex(Object.fromEntries(Object.entries(key).reverse()), { unique: true, hidden: true });
  await fixture(); expect((await run()).ready).toBe(true);
});
test('valid deletion evidence remains valid after content retention removes asset and references', async () => {
  await fixture(); const before = await snapshot(); expect((await run()).ready).toBe(true); expect(await snapshot()).toEqual(before);
  await Asset.collection.deleteMany({}); await Reference.collection.deleteMany({});
  const cleaned = await snapshot(); expect((await run()).ready).toBe(true); expect(await snapshot()).toEqual(cleaned);
});
test('cleaned evidence rejects conflicting generations for the same task and media', async () => {
  const { operation, receipt } = await fixture();
  const otherGeneration = randomUUID();
  await Operation.collection.insertOne({ ...operation, _id: id(), operationId: otherGeneration });
  await Receipt.collection.insertOne({ ...receipt, _id: id(), bindingOperationId: otherGeneration });
  await Asset.collection.deleteMany({}); await Reference.collection.deleteMany({});
  await blocked('RECEIPT_GENERATION_CONFLICT');
});
test('cleaned receipt still requires media membership in the exact operation reference set', async () => {
  await fixture();
  const references = [{ mediaId: id(), field: FIELD }];
  const referenceSetHash = createHash('sha256').update(JSON.stringify(references.map(ref => ({
    mediaId: String(ref.mediaId), field: ref.field
  })))).digest('hex');
  await Operation.collection.updateMany({}, { $set: { references, referenceSetHash } });
  await Asset.collection.deleteMany({}); await Reference.collection.deleteMany({});
  await blocked('RECEIPT_LINK_INVALID');
});
test.each([
  ['invalid actor', { actorId: 'bad' }], ['invalid _id', { _id: 'bad' }], ['invalid role', { role: 'teacher' }],
  ['wrong purpose', { purpose: 'task_attachment' }], ['wrong reason', { reason: 'expired' }],
  ['missing date', { deletedAt: null }], ['string date', { deletedAt: '2026-10-22' }],
  ['student actor mismatch', { role: 'student', actorId: id() }]
])('rejects malformed tombstone: %s', async (_label, patch) => {
  const { tombstone } = await fixture(); await Tombstone.collection.deleteMany({});
  await Tombstone.collection.insertOne({ ...tombstone, ...patch }); await blocked('TOMBSTONE_INVALID');
});
test.each([
  ['invalid _id', { _id: 'bad' }], ['bad UUID', { bindingOperationId: 'bad' }], ['newline UUID', { bindingOperationId: randomUUID() + '\n' }],
  ['wrong field', { field: 'attachmentMediaIds' }], ['string identity', { resourceId: String(id()) }], ['bad date', { releasedAt: '2026-10-22' }]
])('rejects malformed receipt: %s', async (_label, patch) => {
  const { receipt } = await fixture(); await Receipt.collection.deleteMany({});
  await Receipt.collection.insertOne({ ...receipt, ...patch }); await blocked('RECEIPT_INVALID');
});
test.each(['missing tombstone', 'wrong child', 'wrong family', 'wrong generation', 'missing operation', 'aborted operation', 'wrong media'])
  ('receipt cannot fabricate exact deletion proof: %s', async kind => {
    await fixture();
    if (kind === 'missing tombstone') await Tombstone.collection.deleteMany({});
    if (kind === 'wrong child') await Receipt.collection.updateMany({}, { $set: { childId: id() } });
    if (kind === 'wrong family') await Receipt.collection.updateMany({}, { $set: { familyId: id() } });
    if (kind === 'wrong generation') await Receipt.collection.updateMany({}, { $set: { bindingOperationId: randomUUID() } });
    if (kind === 'missing operation') await Operation.collection.deleteMany({});
    if (kind === 'aborted operation') await Operation.collection.updateMany({}, { $set: { state: 'ABORTED', failureCode: 'RESOURCE_NOT_FOUND' } });
    if (kind === 'wrong media') await Receipt.collection.updateMany({}, { $set: { mediaId: id() } });
    await blocked('RECEIPT_LINK_INVALID');
  });
test.each(['active', 'no marker', 'wrong child', 'wrong family', 'wrong purpose', 'wrong date'])
  ('tombstone cannot coexist with mismatching asset: %s', async kind => {
    await fixture();
    const patch = kind === 'active' ? { status: 'active' } : kind === 'no marker' ? { privacyDeletionRecorded: false }
      : kind === 'wrong child' ? { childId: id() } : kind === 'wrong family' ? { familyId: id() }
        : kind === 'wrong purpose' ? { purpose: 'task_attachment' } : { deletedAt: new Date(DATE.getTime() + 1) };
    await Asset.collection.updateMany({}, { $set: patch }); await blocked('DELETED_ASSET_INVALID');
  });
test('new-protocol marked deletion requires its tombstone; legacy unmarked deletion is not upgraded', async () => {
  await fixture(); await Tombstone.collection.deleteMany({}); await Receipt.collection.deleteMany({}); await Reference.collection.deleteMany({});
  await blocked('DELETED_ASSET_INVALID');
  await Asset.collection.updateMany({}, { $unset: { privacyDeletionRecorded: '' } });
  const before = await snapshot(); expect((await run()).ready).toBe(true); expect(await snapshot()).toEqual(before);
});
test.each(['missing receipt', 'wrong generation', 'wrong time', 'wrong child', 'bound', 'prepared', 'remaining after cleanup'])
  ('deleted media reference cannot bypass proof consistency: %s', async kind => {
    await fixture();
    if (kind === 'missing receipt') await Receipt.collection.deleteMany({});
    if (kind === 'wrong generation') await Reference.collection.updateMany({}, { $set: { operationId: randomUUID() } });
    if (kind === 'wrong time') await Reference.collection.updateMany({}, { $set: { releasedAt: new Date(DATE.getTime() + 1) } });
    if (kind === 'wrong child') await Reference.collection.updateMany({}, { $set: { childId: id() } });
    if (['bound', 'prepared'].includes(kind)) await Reference.collection.updateMany({}, { $set: { state: kind } });
    if (kind === 'remaining after cleanup') await Asset.collection.deleteMany({});
    await blocked('DELETED_REFERENCE_INVALID');
  });
test('receipt cannot survive a prematurely removed reference while the deleted asset remains', async () => {
  await fixture(); await Reference.collection.deleteMany({}); await blocked('RECEIPT_LINK_INVALID');
});
test('a privacy-released reference exposes missing evidence even after the asset marker is lost', async () => {
  await fixture(); await Receipt.collection.deleteMany({}); await Tombstone.collection.deleteMany({});
  await Asset.collection.updateMany({}, { $unset: { privacyDeletionRecorded: '' } });
  await blocked('DELETED_REFERENCE_INVALID');
});
test.each(['unbound', 'normal unbind', 'group abort'])('deletion without committed privacy receipt is valid for %s', async kind => {
  await fixture(); await Receipt.collection.deleteMany({});
  if (kind === 'unbound') { await Reference.collection.deleteMany({}); await Operation.collection.deleteMany({}); }
  else {
    const operation = await Operation.collection.findOne({});
    await Reference.collection.updateMany({}, { $set: { releaseOperationId: kind === 'group abort' ? operation.operationId : randomUUID() } });
    if (kind === 'group abort') await Operation.collection.updateMany({}, { $set: { state: 'ABORTED', failureCode: 'RESOURCE_NOT_FOUND' } });
  }
  const before = await snapshot(); expect((await run()).ready).toBe(true); expect(await snapshot()).toEqual(before);
});
test('query failure returns only fixed codes and closes the failing stream', async () => {
  const db = mongoose.connection.db, open = db.collection.bind(db), target = open(Tombstone.collection.collectionName);
  const close = jest.fn().mockResolvedValue();
  jest.spyOn(target, 'find').mockReturnValue({ close, async *[Symbol.asyncIterator]() { throw Error('mongodb://private-error'); } });
  jest.spyOn(db, 'collection').mockImplementation(name => name === target.collectionName ? target : open(name));
  await blocked('READINESS_QUERY_FAILED'); expect(close).toHaveBeenCalledTimes(1);
});
test('cold loading never imports mongoose or models', () => {
  const { spawnSync } = require('child_process'); const target = require.resolve('../services/completionPrivacyReadiness');
  const script = `const Module=require('module'),load=Module._load;Module._load=function(request,parent){
    const file=Module._resolveFilename(request,parent);if(request==='mongoose'||/[\\\\/]models[\\\\/]|[\\\\/]mongoose[\\\\/]/.test(file))throw Error('forbidden model');
    return load.apply(this,arguments);};require(${JSON.stringify(target)});if(process.argv[1]==='probe')require('mongoose');`;
  const clean = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', timeout: 5000 });
  expect({ status: clean.status, stderr: clean.stderr }).toEqual({ status: 0, stderr: '' });
  const probe = spawnSync(process.execPath, ['-e', script, 'probe'], { encoding: 'utf8', timeout: 5000 });
  expect(probe.status).not.toBe(0); expect(probe.stderr).toContain('forbidden model');
});
test('an actually building receipt index blocks until committed', async () => {
  await fixture(); await Receipt.collection.dropIndexes();
  const admin = mongoose.connection.db.admin(); let build;
  try {
    const point = await admin.command({ configureFailPoint: 'hangAfterStartingIndexBuild', mode: 'alwaysOn' });
    build = Receipt.collection.createIndex(Receipt.schema.indexes()[0][0], { unique: true })
      .then(() => ({ ok: true }), error => ({ error }));
    await admin.command({ waitForFailPoint: 'hangAfterStartingIndexBuild', timesEntered: point.count + 1, maxTimeMS: 5000 });
    await blocked('RECEIPT_INDEX_BUILD_IN_PROGRESS');
  } finally {
    await admin.command({ configureFailPoint: 'hangAfterStartingIndexBuild', mode: 'off' });
    if (build) expect(await build).toEqual({ ok: true });
  }
  expect((await run()).ready).toBe(true);
});
test.each(['metadata read', 'metadata close', 'indexes read', 'indexes close'])('%s errors are sanitized and the evidence cursor closes', async kind => {
  const db = mongoose.connection.db;
  const close = kind.endsWith('close') ? jest.fn().mockRejectedValue(Error('mongodb://private-error')) : jest.fn().mockResolvedValue();
  const value = async () => { if (kind.endsWith('read')) throw Error('mongodb://private-error');
    return kind.startsWith('metadata') ? { name: Receipt.collection.collectionName, options: {} } : []; };
  if (kind.startsWith('metadata')) {
    const original = db.listCollections.bind(db);
    jest.spyOn(db, 'listCollections').mockImplementation((filter, options) => filter.name === Receipt.collection.collectionName
      ? { next: value, close } : original(filter, options));
  } else {
    const original = db.runCursorCommand.bind(db);
    jest.spyOn(db, 'runCursorCommand').mockImplementation((command, options) => command.listIndexes === Receipt.collection.collectionName
      ? { toArray: value, close } : original(command, options));
  }
  await blocked('READINESS_QUERY_FAILED'); expect(close).toHaveBeenCalledTimes(1);
});
test('lookup failure cannot be treated as missing evidence or leak raw database text', async () => {
  await fixture();
  const db = mongoose.connection.db, original = db.collection.bind(db), target = original(Asset.collection.collectionName);
  jest.spyOn(target, 'findOne').mockRejectedValue(Error('mongodb://private-error'));
  jest.spyOn(db, 'collection').mockImplementation(name => name === target.collectionName ? target : original(name));
  await blocked('READINESS_QUERY_FAILED');
});
test('multi-batch scans detect late corruption, close cursors and use only bounded projected primary reads', async () => {
  await fixture(); const second = await fixture();
  await Receipt.collection.updateOne({ _id: second.receipt._id }, { $set: { releasedAt: 'bad' } });
  const before = await snapshot(), db = mongoose.connection.db, open = db.collection.bind(db);
  const opened = new Map(), cursors = [], findSpies = [], oneSpies = [], writeSpies = [];
  jest.spyOn(db, 'collection').mockImplementation(name => {
    expect([...Object.values(models), Operation].map(model => model.collection.collectionName)).toContain(name);
    if (!opened.has(name)) {
      const target = open(name), find = target.find.bind(target);
      findSpies.push(jest.spyOn(target, 'find').mockImplementation((filter, options) => {
        const cursor = find(filter, { ...options, batchSize: 1 }); jest.spyOn(cursor, 'close'); cursors.push(cursor); return cursor;
      }));
      oneSpies.push(jest.spyOn(target, 'findOne'));
      for (const method of ['insertOne', 'insertMany', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'createIndex', 'drop']) {
        writeSpies.push(jest.spyOn(target, method).mockImplementation(() => { throw Error('Unexpected write'); }));
      }
      opened.set(name, target);
    }
    return opened.get(name);
  });
  await blocked('RECEIPT_INVALID');
  for (const spy of [...findSpies, ...oneSpies]) for (const [, options] of spy.mock.calls) {
    expect(options).toMatchObject({ maxTimeMS: 5000, readPreference: 'primary', projection: expect.any(Object) });
    expect(options.projection).not.toHaveProperty('storageKey');
  }
  for (const cursor of cursors) expect(cursor.close).toHaveBeenCalled();
  for (const spy of writeSpies) expect(spy).not.toHaveBeenCalled();
  jest.restoreAllMocks(); expect(await snapshot()).toEqual(before);
});
test.each(['PREPARED', 'COMMITTED', 'UNBOUND'])('real %s deletion, journal-unknown retry and retention preserve valid evidence', async state => {
  const Family = require('../../../common/models/Family'), User = require('../models/FamilyUser');
  const { createMongoTransactionRunner } = require('../services/mongoTransaction');
  const { createMediaReferenceOperationService } = require('../services/mediaReferenceOperationService');
  const { createCompletionMediaPrivacyService } = require('../services/completionMediaPrivacyService');
  const { createCompletionMediaCleanupService } = require('../services/completionMediaCleanupService');
  for (const model of [Family, User]) await model.init();
  const parent = { id: String(id()), role: 'parent' }, childId = id();
  const family = await Family.create({ familyName: 'Synthetic', ownerParentId: parent.id, memberParentIds: [parent.id], childIds: [childId] });
  await User.create({ _id: parent.id, role: 'parent' });
  const asset = await Asset.create({ familyId: family._id, childId, uploadedBy: parent.id, purpose: 'task_completion',
    mimeType: 'image/jpeg', sizeBytes: 10, storageKey: randomUUID() });
  const sibling = state === 'PREPARED' ? await Asset.create({ familyId: family._id, childId, uploadedBy: parent.id,
    purpose: 'task_completion', mimeType: 'image/jpeg', sizeBytes: 10, storageKey: randomUUID() }) : null;
  const transactionRunner = createMongoTransactionRunner(mongoose.connection); let time = DATE.getTime();
  const operations = createMediaReferenceOperationService({ transactionRunner, now: () => time });
  const command = { familyId: String(family._id), childId: String(childId), resourceType: 'growth_task', resourceId: String(id()),
    operationId: randomUUID(), commandHash: 'a'.repeat(64), references: [asset, ...(sibling ? [sibling] : [])]
      .map(item => ({ mediaId: String(item._id), field: FIELD })) };
  if (state !== 'UNBOUND') await operations.prepare(command);
  if (state === 'COMMITTED') await operations.commit(command);
  const journal = { persist: jest.fn().mockRejectedValueOnce(Error('synthetic journal failure')).mockResolvedValue(undefined) };
  const privacy = createCompletionMediaPrivacyService({ transactionRunner, now: () => time, journal });
  await expect(privacy.deleteMedia({ identity: parent, mediaId: String(asset._id) })).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  const unknown = await snapshot(); expect((await run()).ready).toBe(true); expect(await snapshot()).toEqual(unknown);
  expect(journal.persist).toHaveBeenCalledTimes(1); // The preflight never acknowledges the durable journal.
  await privacy.deleteMedia({ identity: parent, mediaId: String(asset._id) });
  expect((await run()).ready).toBe(true);
  if (sibling) {
    expect((await Asset.findById(sibling._id)).status).toBe('active');
    expect(await Reference.countDocuments({ operationId: command.operationId, state: 'released',
      releaseOperationId: command.operationId, leaseExpiresAt: null })).toBe(2);
    expect(await Receipt.countDocuments()).toBe(0);
    const aborted = await operations.status({ ...command, mode: 'operation' });
    expect(aborted.operation).toMatchObject({ state: 'ABORTED', failureCode: 'RESOURCE_NOT_FOUND' });
    expect(aborted.references.every(ref => ref.state === 'released' && ref.privacyDeletion === null)).toBe(true);
  }
  const mediaStore = { remove: jest.fn().mockRejectedValueOnce(Error('synthetic storage failure')).mockResolvedValue(undefined) };
  const cleanup = createCompletionMediaCleanupService({ transactionRunner, journal, mediaStore, now: () => time });
  time += 31 * 86400000;
  await expect(cleanup.cleanupDeletedMedia()).rejects.toThrow('synthetic storage failure');
  expect((await run()).ready).toBe(true);
  expect((await cleanup.cleanupDeletedMedia()).cleaned).toBe(1);
  const cleaned = await snapshot(); expect((await run()).ready).toBe(true); expect(await snapshot()).toEqual(cleaned);
  expect(await Receipt.countDocuments()).toBe(state === 'COMMITTED' ? 1 : 0);
  expect(await Tombstone.countDocuments()).toBe(1);
  const tombstone = await Tombstone.findOne().lean();
  if (sibling) {
    expect((await Asset.findById(sibling._id)).status).toBe('active');
    expect(await Reference.countDocuments({ state: 'released', operationId: command.operationId })).toBe(1);
  }
  const terminal = await operations.status({ ...command, mode: 'operation' });
  expect(terminal.operation.state).toBe(state === 'PREPARED' ? 'ABORTED' : state === 'COMMITTED' ? 'COMMITTED' : 'ABSENT');
  if (state === 'PREPARED') expect(terminal.operation.failureCode).toBe('RESOURCE_NOT_FOUND');
  const deleted = terminal.references.find(ref => ref.mediaId === String(asset._id));
  expect(deleted.state).toBe('absent');
  if (state === 'COMMITTED') expect(deleted.privacyDeletion).toMatchObject({ bindingOperationId: command.operationId });
  else expect(terminal.references.every(ref => ref.privacyDeletion === null)).toBe(true);
  const { operationId, commandHash, ...referenceQuery } = command;
  const current = await operations.status({ ...referenceQuery, mode: 'references' });
  expect(current.references).toEqual(terminal.references);
  time += 86400000;
  await privacy.deleteMedia({ identity: parent, mediaId: String(asset._id) });
  expect(await Tombstone.findOne().lean()).toEqual(tombstone);
  expect(await snapshot()).toEqual(cleaned);
});
test('real rebind and multiple tasks keep only exact privacy generations through cleanup and replay', async () => {
  const Family = require('../../../common/models/Family'), User = require('../models/FamilyUser');
  const { createMongoTransactionRunner } = require('../services/mongoTransaction');
  const { createMediaReferenceOperationService } = require('../services/mediaReferenceOperationService');
  const { createCompletionMediaPrivacyService } = require('../services/completionMediaPrivacyService');
  const { createCompletionMediaCleanupService } = require('../services/completionMediaCleanupService');
  for (const model of [Family, User]) await model.init();
  const parent = { id: String(id()), role: 'parent' }, childId = id();
  const family = await Family.create({ familyName: 'Synthetic', ownerParentId: parent.id, memberParentIds: [parent.id], childIds: [childId] });
  await User.create({ _id: parent.id, role: 'parent' });
  const asset = await Asset.create({ familyId: family._id, childId, uploadedBy: parent.id,
    purpose: 'task_completion', mimeType: 'image/jpeg', sizeBytes: 10, storageKey: randomUUID() });
  const transactionRunner = createMongoTransactionRunner(mongoose.connection); let time = DATE.getTime();
  const operations = createMediaReferenceOperationService({ transactionRunner, now: () => time });
  const command = () => ({ familyId: String(family._id), childId: String(childId), resourceType: 'growth_task', resourceId: String(id()),
    operationId: randomUUID(), commandHash: 'a'.repeat(64), references: [{ mediaId: String(asset._id), field: FIELD }] });
  const old = command(), rebound = { ...old, operationId: randomUUID() }, otherTask = command(), unbound = command();
  const bind = async cmd => { await operations.prepare(cmd); await operations.commit(cmd); };
  const unbind = async cmd => {
    const { commandHash, ...request } = cmd;
    await operations.unbind({ ...request, operationId: randomUUID(),
      references: cmd.references.map(ref => ({ ...ref, bindingOperationId: cmd.operationId })) });
  };
  await bind(old); await unbind(old); await bind(rebound);
  await bind(otherTask); await bind(unbound); await unbind(unbound);
  const journal = { persist: jest.fn().mockResolvedValue(undefined) };
  const privacy = createCompletionMediaPrivacyService({ transactionRunner, journal, now: () => time });
  await privacy.deleteMedia({ identity: parent, mediaId: String(asset._id) });
  const firstAudit = await Tombstone.findOne().lean();
  const receipts = await Receipt.find().lean();
  expect(receipts.map(row => row.bindingOperationId).sort()).toEqual([rebound.operationId, otherTask.operationId].sort());
  const before = await snapshot(); expect((await run()).ready).toBe(true); expect(await snapshot()).toEqual(before);
  time += 31 * 86400000;
  const cleanup = createCompletionMediaCleanupService({ transactionRunner, journal, now: () => time,
    mediaStore: { remove: jest.fn().mockResolvedValue(undefined) } });
  expect((await cleanup.cleanupDeletedMedia()).cleaned).toBe(1);
  const cleaned = await snapshot(); expect((await run()).ready).toBe(true); expect(await snapshot()).toEqual(cleaned);
  for (const cmd of [old, rebound, otherTask, unbound]) {
    const result = await operations.status({ ...cmd, mode: 'operation' });
    expect(result.operation.state).toBe('COMMITTED'); expect(result.references[0].state).toBe('absent');
    if ([rebound, otherTask].includes(cmd)) expect(result.references[0].privacyDeletion).toMatchObject({
      resourceId: cmd.resourceId, bindingOperationId: cmd.operationId
    }); else expect(result.references[0].privacyDeletion).toBeNull();
  }
  for (const cmd of [rebound, otherTask, unbound]) {
    const { operationId, commandHash, ...query } = cmd;
    const result = await operations.status({ ...query, mode: 'references' });
    if (cmd === unbound) expect(result.references[0].privacyDeletion).toBeNull();
    else expect(result.references[0].privacyDeletion).toMatchObject({ bindingOperationId: cmd.operationId });
  }
  await privacy.deleteMedia({ identity: parent, mediaId: String(asset._id) });
  expect(await Tombstone.findOne().lean()).toEqual(firstAudit); expect(await snapshot()).toEqual(cleaned);
  const receipt = receipts.find(row => row.bindingOperationId === rebound.operationId);
  await Receipt.collection.insertOne({ ...receipt, _id: id(), bindingOperationId: old.operationId });
  await blocked('RECEIPT_GENERATION_CONFLICT');
  const { operationId, commandHash, ...query } = rebound;
  await expect(operations.status({ ...query, mode: 'references' })).rejects.toMatchObject({ code: 'MEDIA_OPERATION_INCONSISTENT' });
});
