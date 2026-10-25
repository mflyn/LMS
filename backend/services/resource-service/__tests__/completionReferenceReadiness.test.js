const { randomUUID, createHash } = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const Asset = require('../models/MediaAsset');
const Reference = require('../models/MediaReference');
const Operation = require('../models/MediaReferenceOperation');
const Tombstone = require('../models/MediaDeletionTombstone');
const Receipt = require('../models/MediaDeletionReceipt');

jest.setTimeout(30000);
const models = [Asset, Reference, Operation, Tombstone, Receipt];
const id = () => new mongoose.Types.ObjectId();
const FIELD = 'completionMediaIds', DATE = new Date('2026-10-22T00:00:00Z');
let mongo, check;
const run = (options = {}) => check({ connection: mongoose.connection, writesPaused: true, ...options });
const snapshot = async () => {
  const result = {};
  for (const model of models) result[model.modelName] = {
    rows: await model.collection.find().sort({ _id: 1 }).toArray(), indexes: await model.collection.listIndexes().toArray()
  };
  return result;
};
const blocked = async (issue, options) => {
  let error; try { await run(options); } catch (failure) { error = failure; }
  expect(error).toMatchObject({ code: 'COMPLETION_REFERENCES_NOT_READY', issues: expect.arrayContaining([issue]) });
  expect(error.message).toBe('Completion reference readiness check failed');
  expect(JSON.stringify(error)).not.toMatch(/mongodb:|private-error|familyId|childId|storageKey|operationId/);
};
const fixture = async (state = 'PREPARED', count = 2) => {
  const scope = { familyId: id(), childId: id(), resourceType: 'growth_task', resourceId: id(), field: FIELD };
  const media = Array.from({ length: count }, () => id()).sort((a, b) => String(a).localeCompare(String(b)));
  const references = media.map(mediaId => ({ mediaId, field: FIELD })), operationId = randomUUID();
  const operation = { _id: id(), ...scope, operationId, commandHash: 'a'.repeat(64), references,
    referenceSetHash: createHash('sha256').update(JSON.stringify(references.map(ref => ({ mediaId: String(ref.mediaId), field: FIELD })))).digest('hex'),
    state, version: 0, leaseExpiresAt: state === 'PREPARED' ? DATE : null,
    terminalAt: state === 'PREPARED' ? null : DATE, failureCode: state === 'ABORTED' ? 'MEDIA_OPERATION_ABORTED' : null };
  await Operation.collection.insertOne(operation);
  const rows = [];
  for (const mediaId of media) {
    await Asset.collection.insertOne({ _id: mediaId, familyId: scope.familyId, childId: scope.childId,
      purpose: 'task_completion', status: 'active', mimeType: 'image/jpeg', deletedAt: null,
      privacyDeletionRecorded: false, storageKey: randomUUID() });
    const row = { _id: id(), ...scope, mediaId, operationId,
      state: state === 'PREPARED' ? 'prepared' : state === 'COMMITTED' ? 'bound' : 'released',
      leaseExpiresAt: operation.leaseExpiresAt, releasedAt: state === 'ABORTED' ? DATE : null,
      releaseOperationId: state === 'ABORTED' ? operationId : null };
    await Reference.collection.insertOne(row); rows.push(row);
  }
  return { scope, operation, rows, media };
};
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  for (const model of models) await model.init();
});
beforeEach(async () => {
  ({ assertCompletionReferenceReadiness: check } = require('../services/completionReferenceReadiness'));
  for (const model of models) await model.deleteMany({});
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test('empty collections are ready without mutations', async () => {
  const before = await snapshot();
  expect(await run()).toEqual({ ready: true, service: 'resource-service', protocol: 'task-completion-v1', scope: 'reference-consistency' });
  expect(await snapshot()).toEqual(before);
});
test.each(['valid', 'recovery gap', 'strict gap', 'missing journal', 'wrong status', 'bare marker', 'missing original'])
('system deleted released asset requires complete native evidence: %s', async kind => {
  const { scope, operation, rows, media } = await fixture('ABORTED', 1);
  const db = mongoose.connection.db, storageKey = randomUUID(), retirementId = randomUUID(), uploadedBy = id();
  const metadata = { familyId: String(scope.familyId), childId: String(scope.childId), uploadedBy: String(uploadedBy),
    purpose: 'task_completion', mimeType: 'image/jpeg', displayName: 'task-completion', sizeBytes: 9,
    pageCount: null, storageKey, malwareScanStatus: 'skipped_trusted_local', malwareScannedAt: null };
  const metadataHash = createHash('sha256').update(JSON.stringify(metadata)).digest('hex');
  const record = { _id: id(), familyId: scope.familyId, childId: scope.childId, mediaId: media[0], storageKey,
    retirementId, uploadMetadataHash: metadataHash, retentionPolicyVersion: 1, orphanEligibleAt: DATE,
    actorType: 'system', state: 'DELETED', revision: 3, createdAt: DATE, deletedAt: DATE, purgedAt: null };
  record.evidence = { version: 1, retirement: { mediaId: String(media[0]), familyId: String(scope.familyId), childId: String(scope.childId),
    retirementId, storageKey, uploadMetadataHash: metadataHash, retentionPolicyVersion: 1, orphanEligibleAt: DATE.toISOString(),
    actorType: 'system', createdAt: DATE.toISOString(), deletedAt: DATE.toISOString() },
  operations: [{ ...operation, _id: String(operation._id), familyId: String(scope.familyId), childId: String(scope.childId),
    resourceId: String(scope.resourceId), references: [{ mediaId: String(media[0]), field: FIELD }], terminalAt: DATE.toISOString() }],
  references: [{ ...rows[0], _id: String(rows[0]._id), familyId: String(scope.familyId), childId: String(scope.childId),
    resourceId: String(scope.resourceId), mediaId: String(media[0]), releasedAt: DATE.toISOString() }] };
  await Asset.collection.updateOne({ _id: media[0] }, { $set: { ...metadata, familyId: scope.familyId, childId: scope.childId,
    uploadedBy, status: 'deleted', privacyDeletionRecorded: false, deletedAt: DATE,
    orphanRetirementId: retirementId, retentionPolicyVersion: 1, orphanEligibleAt: DATE } });
  await db.collection('completionuploadguards').insertOne({ _id: id(), familyId: scope.familyId, childId: scope.childId,
    mediaId: media[0], storageKey, metadataHash, state: 'RETIRED', revision: 2, createdAt: DATE, updatedAt: DATE });
  if (kind !== 'bare marker') await db.collection('mediaorphanretirements').insertOne(record);
  if (kind === 'missing original') await Operation.collection.deleteOne({ _id: operation._id });
  const options = { journal: kind === 'missing journal' ? undefined : { read: async () => kind.endsWith('gap') ? null : record.evidence },
    allowMissingDeletedJournal: kind === 'recovery gap',
    retirementClient: { status: async body => ({ ...body, state: kind === 'wrong status' ? 'available' : 'retired' }),
      retire: () => { throw Error('Unexpected write'); } } };
  try {
    if (kind === 'valid' || kind === 'recovery gap') {
      const before = await snapshot(); expect((await run(options)).ready).toBe(true); expect(await snapshot()).toEqual(before);
    } else await blocked('REFERENCE_ASSET_INVALID', options);
  } finally {
    await db.collection('completionuploadguards').deleteMany({}); await db.collection('mediaorphanretirements').deleteMany({});
  }
});
test.each([false, undefined, 'true'])('requires paused writes %s before database access', async writesPaused => {
  await blocked('WRITES_NOT_PAUSED', { writesPaused, connection: { get db() { throw Error('private-error'); } } });
});
test('privacy and operation prerequisites cannot be bypassed', async () => {
  await Operation.collection.dropIndexes();
  try { await blocked('PRIVACY_EVIDENCE_NOT_READY'); }
  finally { for (const [key, options] of Operation.schema.indexes()) await Operation.collection.createIndex(key, options); }
});
test.each(['PREPARED', 'COMMITTED', 'ABORTED'])('valid %s group passes without changing expired leases or terminals', async state => {
  await fixture(state); const before = await snapshot(); expect((await run()).ready).toBe(true); expect(await snapshot()).toEqual(before);
});
test.each([
  ['string _id', { _id: 'bad' }], ['string family', { familyId: String(id()) }],
  ['wrong resource type', { resourceType: 'child' }], ['bad UUID', { operationId: 'bad' }],
  ['newline UUID', { operationId: randomUUID() + '\n' }], ['unknown state', { state: 'unknown' }],
  ['missing lease', { leaseExpiresAt: null }], ['string lease', { leaseExpiresAt: DATE.toISOString() }],
  ['prepared release date', { releasedAt: DATE }], ['prepared release id', { releaseOperationId: randomUUID() }]
])('rejects malformed current reference %s', async (_label, patch) => {
  const { rows } = await fixture(); await Reference.collection.deleteOne({ _id: rows[0]._id });
  await Reference.collection.insertOne({ ...rows[0], ...patch }); await blocked('REFERENCE_INVALID');
});
test.each([
  ['foreign family', { familyId: id() }], ['sibling', { childId: id() }],
  ['wrong purpose', { purpose: 'task_attachment' }], ['pdf', { mimeType: 'application/pdf' }],
  ['unknown status', { status: 'unknown' }], ['active with deletedAt', { deletedAt: DATE }],
  ['invalid marker type', { privacyDeletionRecorded: 'false' }]
])('rejects incompatible active asset %s', async (_label, patch) => {
  const { media } = await fixture(); await Asset.collection.updateOne({ _id: media[0] }, { $set: patch });
  await blocked('REFERENCE_ASSET_INVALID');
});
test('missing asset cannot back a current reference', async () => {
  const { media } = await fixture(); await Asset.collection.deleteOne({ _id: media[0] }); await blocked('REFERENCE_ASSET_INVALID');
});
test.each(['missing operation', 'wrong generation', 'lease mismatch', 'bound before commit', 'released before terminal', 'extra member'])
  ('current reference must match its exact operation: %s', async kind => {
    const { rows, scope, media } = await fixture();
    if (kind === 'missing operation') await Operation.collection.deleteMany({});
    if (kind === 'wrong generation') await Reference.collection.updateOne({ _id: rows[0]._id }, { $set: { operationId: randomUUID() } });
    if (kind === 'lease mismatch') await Reference.collection.updateOne({ _id: rows[0]._id }, { $set: { leaseExpiresAt: new Date(DATE.getTime() + 1) } });
    if (kind === 'bound before commit') await Reference.collection.updateOne({ _id: rows[0]._id }, { $set: { state: 'bound', leaseExpiresAt: null } });
    if (kind === 'released before terminal') await Reference.collection.updateOne({ _id: rows[0]._id }, { $set: {
      state: 'released', leaseExpiresAt: null, releasedAt: DATE, releaseOperationId: randomUUID() } });
    if (kind === 'extra member') {
      const extra = id(); const asset = await Asset.collection.findOne({ _id: media[0] });
      await Asset.collection.insertOne({ ...asset, _id: extra, storageKey: randomUUID() });
      await Reference.collection.insertOne({ ...rows[0], ...scope, _id: id(), mediaId: extra });
    }
    await blocked('REFERENCE_OPERATION_INVALID');
  });
test.each(['PREPARED', 'COMMITTED'])('%s reverse scan detects missing current members', async state => {
  const { rows } = await fixture(state); await Reference.collection.deleteOne({ _id: rows[0]._id });
  await blocked('OPERATION_REFERENCE_SET_INVALID');
});
test('prepared operation cannot lose its whole current set', async () => {
  await fixture(); await Reference.collection.deleteMany({}); await blocked('OPERATION_REFERENCE_SET_INVALID');
});
test('prepared operation cannot be replaced by a newer terminal before recovery', async () => {
  const { operation } = await fixture(); const replacement = randomUUID();
  await Operation.collection.insertOne({ ...operation, _id: id(), operationId: replacement, state: 'COMMITTED',
    terminalAt: DATE, leaseExpiresAt: null });
  await Reference.collection.updateMany({}, { $set: { operationId: replacement, state: 'bound', leaseExpiresAt: null } });
  await blocked('OPERATION_REFERENCE_SET_INVALID');
});
test.each(['PREPARED', 'COMMITTED', 'ABORTED'])('old COMMITTED history permits a valid newer %s generation', async state => {
  const { operation } = await fixture(state);
  await Operation.collection.insertOne({ ...operation, _id: id(), operationId: randomUUID(), state: 'COMMITTED',
    failureCode: null, terminalAt: DATE, leaseExpiresAt: null });
  const before = await snapshot(); expect((await run()).ready).toBe(true); expect(await snapshot()).toEqual(before);
});
test('ABORTED without ever preparing needs neither assets nor current references', async () => {
  await fixture('ABORTED'); await Reference.collection.deleteMany({}); await Asset.collection.deleteMany({});
  expect((await run()).ready).toBe(true);
});
test('ordinary COMMITTED unbind does not need a separate release operation ledger', async () => {
  await fixture('COMMITTED'); await Reference.collection.updateMany({}, { $set: {
    state: 'released', releasedAt: DATE, releaseOperationId: randomUUID() } });
  expect((await run()).ready).toBe(true);
});
test('ABORTED releases must carry their own binding generation', async () => {
  await fixture('ABORTED'); await Reference.collection.updateMany({}, { $set: { releaseOperationId: randomUUID() } });
  await blocked('REFERENCE_OPERATION_INVALID');
});
test.each(['lease', 'releasedAt', 'releaseOperationId'])('bound reference rejects stale %s', async field => {
  await fixture('COMMITTED'); const patch = field === 'lease' ? { leaseExpiresAt: DATE }
    : field === 'releasedAt' ? { releasedAt: DATE } : { releaseOperationId: randomUUID() };
  await Reference.collection.updateMany({}, { $set: patch }); await blocked('REFERENCE_INVALID');
});
test.each(['lease', 'missing date', 'bad release UUID'])('released reference rejects %s', async kind => {
  await fixture('COMMITTED'); await Reference.collection.updateMany({}, { $set: {
    state: 'released', releasedAt: kind === 'missing date' ? null : DATE,
    leaseExpiresAt: kind === 'lease' ? DATE : null, releaseOperationId: kind === 'bad release UUID' ? 'bad' : randomUUID()
  } }); await blocked('REFERENCE_INVALID');
});
test('cleared COMMITTED rows without deletion evidence cannot be called retention', async () => {
  await fixture('COMMITTED'); await Reference.collection.deleteMany({}); await Asset.collection.deleteMany({});
  await blocked('OPERATION_REFERENCE_SET_INVALID');
});
test('cleaned ordinary unbind may retain only a same-scope tombstone and old terminal', async () => {
  const { media, scope } = await fixture('COMMITTED');
  await Reference.collection.deleteMany({}); await Asset.collection.deleteMany({});
  for (const mediaId of media) await Tombstone.create({ mediaId, familyId: scope.familyId, childId: scope.childId,
    actorId: id(), role: 'parent', purpose: 'task_completion', reason: 'user_requested', deletedAt: DATE });
  expect((await run()).ready).toBe(true);
  await Tombstone.collection.updateOne({ mediaId: media[0] }, { $set: { childId: id() } });
  await blocked('OPERATION_REFERENCE_SET_INVALID');
});
test('a tombstone cannot excuse a missing reference while its deleted asset remains', async () => {
  const { media, scope } = await fixture('COMMITTED', 1);
  await Reference.collection.deleteMany({});
  await Asset.collection.updateOne({ _id: media[0] }, { $set: {
    status: 'deleted', privacyDeletionRecorded: true, deletedAt: DATE
  } });
  await Tombstone.create({ mediaId: media[0], familyId: scope.familyId, childId: scope.childId,
    actorId: id(), role: 'parent', purpose: 'task_completion', reason: 'user_requested', deletedAt: DATE });
  const { assertCompletionPrivacyReadiness } = require('../services/completionPrivacyReadiness');
  expect((await assertCompletionPrivacyReadiness({ connection: mongoose.connection, writesPaused: true })).ready).toBe(true);
  await blocked('OPERATION_REFERENCE_SET_INVALID');
  await Asset.collection.deleteOne({ _id: media[0] });
  const before = await snapshot(); expect((await run()).ready).toBe(true); expect(await snapshot()).toEqual(before);
});
test('unreferenced active uploads and old protocol fields are not upgraded', async () => {
  const { rows } = await fixture(); await Operation.collection.deleteMany({});
  await Reference.collection.updateMany({}, { $set: { field: 'attachmentMediaIds', operationId: 'synthetic-legacy' } });
  const before = await snapshot(); expect(rows).toHaveLength(2); expect((await run()).ready).toBe(true);
  expect(await snapshot()).toEqual(before);
});
test('cold loading never imports models or mongoose', () => {
  const { spawnSync } = require('child_process'); const target = require.resolve('../services/completionReferenceReadiness');
  const script = `const Module=require('module'),load=Module._load;Module._load=function(request,parent){
    const file=Module._resolveFilename(request,parent);if(request==='mongoose'||/[\\\\/]models[\\\\/]|[\\\\/]mongoose[\\\\/]/.test(file))throw Error('forbidden model');
    return load.apply(this,arguments);};require(${JSON.stringify(target)});if(process.argv[1]==='probe')require('mongoose');`;
  const clean = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', timeout: 5000 });
  expect({ status: clean.status, stderr: clean.stderr }).toEqual({ status: 0, stderr: '' });
  const probe = spawnSync(process.execPath, ['-e', script, 'probe'], { encoding: 'utf8', timeout: 5000 });
  expect(probe.status).not.toBe(0); expect(probe.stderr).toContain('forbidden model');
});
test.each(['reference read', 'reference close', 'operation read', 'operation close'])('%s failure closes cursor and returns no raw data', async kind => {
  await fixture(); const db = mongoose.connection.db, open = db.collection.bind(db);
  const name = kind.startsWith('reference') ? 'mediareferences' : 'mediareferenceoperations';
  const target = open(name), find = target.find.bind(target);
  const close = kind.endsWith('close') ? jest.fn().mockRejectedValue(Error('mongodb://private-error')) : jest.fn().mockResolvedValue();
  jest.spyOn(target, 'find').mockImplementation((filter, options) => {
    const ownScan = name === 'mediareferences' ? Object.keys(filter).length === 1 && filter.field === FIELD : Boolean(filter.state?.$in);
    return ownScan ? { close, async *[Symbol.asyncIterator]() { if (kind.endsWith('read')) throw Error('mongodb://private-error'); } }
      : find(filter, options);
  });
  jest.spyOn(db, 'collection').mockImplementation(n => n === name ? target : open(n));
  await blocked('READINESS_QUERY_FAILED'); expect(close).toHaveBeenCalledTimes(1);
});
test('reference asset lookup failure is sanitized rather than treated as missing', async () => {
  await fixture(); const db = mongoose.connection.db, open = db.collection.bind(db), target = open('mediaassets');
  jest.spyOn(target, 'findOne').mockRejectedValue(Error('mongodb://private-error'));
  jest.spyOn(db, 'collection').mockImplementation(n => n === 'mediaassets' ? target : open(n));
  await blocked('READINESS_QUERY_FAILED');
});
test('native multi-batch reads detect late corruption, close cursors and cannot write or read content', async () => {
  await fixture(); const second = await fixture();
  await Reference.collection.updateOne({ _id: second.rows[1]._id }, { $set: { operationId: 'bad' } });
  const before = await snapshot(), db = mongoose.connection.db, open = db.collection.bind(db);
  const opened = new Map(), cursors = [], reads = [], writes = [];
  jest.spyOn(db, 'collection').mockImplementation(name => {
    expect(models.map(model => model.collection.collectionName)).toContain(name);
    if (!opened.has(name)) {
      const target = open(name), find = target.find.bind(target);
      reads.push(jest.spyOn(target, 'find').mockImplementation((filter, options) => {
        const cursor = find(filter, { ...options, batchSize: 1 }); jest.spyOn(cursor, 'close'); cursors.push(cursor); return cursor;
      }));
      reads.push(jest.spyOn(target, 'findOne'));
      for (const method of ['insertOne', 'insertMany', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'createIndex', 'drop']) {
        writes.push(jest.spyOn(target, method).mockImplementation(() => { throw Error('Unexpected write'); }));
      }
      opened.set(name, target);
    }
    return opened.get(name);
  });
  await blocked('REFERENCE_INVALID');
  for (const spy of reads) for (const [, options] of spy.mock.calls) {
    expect(options).toMatchObject({ maxTimeMS: 5000, readPreference: 'primary', projection: expect.any(Object) });
    for (const field of ['storageKey', 'displayName', 'uploadedBy']) expect(options.projection).not.toHaveProperty(field);
  }
  for (const cursor of cursors) expect(cursor.close).toHaveBeenCalled();
  for (const spy of writes) expect(spy).not.toHaveBeenCalled();
  jest.restoreAllMocks(); expect(await snapshot()).toEqual(before);
});
test.each(['rebind', 'expired abort', 'prepared privacy deletion'])('real %s lifecycle stays ready without preflight mutations', async scenario => {
  const Family = require('../../../common/models/Family'), User = require('../models/FamilyUser');
  const { createMongoTransactionRunner } = require('../services/mongoTransaction');
  const { createMediaReferenceOperationService } = require('../services/mediaReferenceOperationService');
  const { createCompletionMediaPrivacyService } = require('../services/completionMediaPrivacyService');
  const { createCompletionMediaCleanupService } = require('../services/completionMediaCleanupService');
  const { scope, operation, media } = await fixture();
  await Operation.deleteMany({}); await Reference.deleteMany({});
  for (const model of [Family, User]) await model.init();
  const parent = { id: String(id()), role: 'parent' };
  await User.create({ _id: parent.id, role: 'parent' });
  await Family.create({ _id: scope.familyId, familyName: 'Synthetic', ownerParentId: parent.id,
    memberParentIds: [parent.id], childIds: [scope.childId] });
  const transactionRunner = createMongoTransactionRunner(mongoose.connection); let time = DATE.getTime();
  const operations = createMediaReferenceOperationService({ transactionRunner, now: () => time });
  const journal = { persist: jest.fn().mockResolvedValue(undefined) }, mediaStore = { remove: jest.fn().mockResolvedValue(undefined) };
  const privacy = createCompletionMediaPrivacyService({ transactionRunner, journal, now: () => time });
  const cleanup = createCompletionMediaCleanupService({ transactionRunner, journal, mediaStore, now: () => time });
  const cmd = { familyId: String(scope.familyId), childId: String(scope.childId), resourceType: 'growth_task',
    resourceId: String(scope.resourceId), operationId: operation.operationId, commandHash: operation.commandHash,
    references: media.map(mediaId => ({ mediaId: String(mediaId), field: FIELD })) };
  const unchanged = async () => {
    const before = await snapshot(), journalCalls = journal.persist.mock.calls.length, storeCalls = mediaStore.remove.mock.calls.length;
    expect((await run()).ready).toBe(true); expect(await snapshot()).toEqual(before);
    expect(journal.persist).toHaveBeenCalledTimes(journalCalls); expect(mediaStore.remove).toHaveBeenCalledTimes(storeCalls);
  };
  await operations.prepare(cmd); await unchanged();
  if (scenario === 'rebind') {
    await operations.commit(cmd); await unchanged();
    const { commandHash, ...release } = cmd;
    await operations.unbind({ ...release, operationId: randomUUID(),
      references: cmd.references.map(ref => ({ ...ref, bindingOperationId: cmd.operationId })) });
    await unchanged();
    const newer = { ...cmd, operationId: randomUUID(), references: [cmd.references[0]] };
    await operations.prepare(newer); await unchanged(); await operations.commit(newer); await unchanged();
    await privacy.deleteMedia({ identity: parent, mediaId: String(media[0]) }); await unchanged();
    expect((await Receipt.findOne().lean()).bindingOperationId).toBe(newer.operationId);
  } else if (scenario === 'expired abort') {
    time += 901000; await unchanged(); await operations.abort(cmd); await unchanged();
    expect((await Operation.findOne().lean()).failureCode).toBe('MEDIA_OPERATION_EXPIRED');
    await privacy.deleteMedia({ identity: parent, mediaId: String(media[0]) }); await unchanged();
  } else {
    await privacy.deleteMedia({ identity: parent, mediaId: String(media[0]) }); await unchanged();
    expect((await Operation.findOne().lean()).state).toBe('ABORTED');
    expect(await Reference.countDocuments({ state: 'released', releaseOperationId: cmd.operationId })).toBe(2);
  }
  const audit = await Tombstone.findOne().lean(); time += 31 * 86400000;
  expect((await cleanup.cleanupDeletedMedia()).cleaned).toBe(1); await unchanged();
  expect(await Asset.findById(media[0])).toBeNull(); expect((await Asset.findById(media[1])).status).toBe('active');
  const status = await operations.status({ ...cmd, mode: 'operation' });
  expect(status.operation.state).toBe(scenario === 'rebind' ? 'COMMITTED' : 'ABORTED');
  expect(status.references.find(ref => ref.mediaId === String(media[0]))).toMatchObject({ state: 'absent', privacyDeletion: null });
  await privacy.deleteMedia({ identity: parent, mediaId: String(media[0]) });
  expect(await Tombstone.findOne().lean()).toEqual(audit); await unchanged();
});
