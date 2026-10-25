const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const http = require('http');
const express = require('express');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('../../../../node_modules/mongodb-memory-server');
const Asset = require('../models/MediaAsset');
const Retirement = require('../models/MediaOrphanRetirement');
const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');
const Task = require('../../homework-service/models/GrowthTask');
const Guard = require('../../homework-service/models/CompletionMediaGuard');
const { errorHandler } = require('../../../common/middleware/errorHandler');
const { createCompletionMediaRetirementRouter } = require('../../homework-service/routes/completionMediaRetirements');
const { createCompletionMediaRetirementService } = require('../../homework-service/services/completionMediaRetirementService');
const { createGrowthTaskCompletionService } = require('../../homework-service/services/growthTaskCompletionService');
const { createMediaReferenceOperationService } = require('../services/mediaReferenceOperationService');
const { createCompletionUploadService } = require('../services/completionUploadService');
const { createCompletionUploadJournal } = require('../services/completionUploadJournal');
const { createMongoTransactionRunner } = require('../services/mongoTransaction');
const { createPrivateMediaStore } = require('../services/privateMediaStore');
// Register the complete resource protocol before initializing the isolated database.
require('../services/orphanRetirementService');

jest.setTimeout(60000);
const execute = promisify(execFile);
const id = () => new mongoose.Types.ObjectId();
const token = 'synthetic-fairness-retirement-token-32';
const cli = path.resolve(__dirname, '../../../../scripts/completion-operations.js');
let mongo, server, root, store, runner, env, parent, familyId, childId, dropResponse;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri());
  for (const model of Object.values(mongoose.models)) await model.init();
  runner = createMongoTransactionRunner(mongoose.connection);
});
beforeEach(async () => {
  for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({});
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 't2-orphan-fairness-')));
  store = createPrivateMediaStore({ root: path.join(root, 'media') });
  await fs.mkdir(path.join(root, 'journal'), { mode: 0o700 });
  familyId = id(); childId = id(); parent = { id: String(id()), role: 'parent' };
  await Family.create({ _id: familyId, familyName: 'Synthetic fairness', ownerParentId: parent.id,
    memberParentIds: [parent.id], childIds: [childId] });
  await User.collection.insertMany([
    { _id: new mongoose.Types.ObjectId(parent.id), username: parent.id, email: parent.id + '@example.test', role: 'parent' },
    { _id: childId, username: String(childId), email: childId + '@example.test', familyId, role: 'student' }
  ]);
  dropResponse = false;
  const app = express(); app.use(express.json());
  app.use((_req, res, next) => {
    const send = res.json.bind(res);
    res.json = body => {
      if (dropResponse && body?.data?.state === 'granted') {
        dropResponse = false; res.socket.destroy(); return res;
      }
      return send(body);
    };
    next();
  });
  app.use('/api/internal/completion-media-retirements', createCompletionMediaRetirementRouter({
    env: { COMPLETION_RETIREMENT_SERVICE_TOKEN: token },
    service: createCompletionMediaRetirementService({ transactionRunner: runner })
  }));
  app.use(errorHandler);
  server = http.createServer(app);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  env = { ...process.env, MONGO_URI: mongo.getUri(), COMPLETION_PROTOCOL_MODE: 'enabled',
    COMPLETION_STORAGE_CONFIRMED: 'true', COMPLETION_ORPHAN_CLEANUP_ENABLED: 'true',
    COMPLETION_RETIREMENT_SERVICE_TOKEN: token, HOMEWORK_SERVICE_URL: `http://127.0.0.1:${server.address().port}`,
    PRIVATE_MEDIA_ROOT: path.join(root, 'media'), COMPLETION_DELETION_JOURNAL_ROOT: path.join(root, 'journal') };
});
afterEach(async () => {
  server?.closeAllConnections();
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await fs.rm(root, { recursive: true, force: true });
});
afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });

const upload = async () => {
  const stored = await store.writeCanonical(Buffer.from('synthetic'));
  return createCompletionUploadService({ transactionRunner: runner, mediaStore: store,
    journal: createCompletionUploadJournal({ root: path.join(root, 'journal/uploads-v1') }),
    now: () => Date.now() - 2 * 86400000 }).upload({ identity: parent, metadata: {
    familyId: String(familyId), childId: String(childId), uploadedBy: parent.id, purpose: 'task_completion',
    mimeType: 'image/jpeg', sizeBytes: 9, storageKey: stored.storageKey,
    malwareScanStatus: 'skipped_trusted_local', malwareScannedAt: null
  } });
};
const claim = async asset => {
  const task = await Task.create({ familyId, childId, createdByParentId: parent.id, title: 'Synthetic',
    dimension: 'academic', taskType: 'practice', dueDate: '2026-10-23' });
  const mediaReferenceClient = Object.fromEntries(['prepare', 'commit', 'abort', 'status', 'unbind']
    .map(action => [action, async () => { throw Error('synthetic remote unavailable'); }]));
  await expect(createGrowthTaskCompletionService({ transactionRunner: runner, mediaReferenceClient })
    .complete({ identity: parent, taskId: String(task._id), body: { operationId: randomUUID(),
      expectedCompletionVersion: 0, expectedChecklistVersion: 0, checkedItemIds: [], completionMediaIds: [String(asset._id)] } }))
    .rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
};
// Each call starts and terminates a new CLI process: no shared module cache or cursor.
const cleanup = async () => {
  let output;
  try { output = await execute(process.execPath, [cli, 'orphan-cleanup', '--writes-paused', '--apply', '--limit', '1'],
    { env, timeout: 20000 }); }
  catch (error) { if (error.code !== 1) throw error; output = error; }
  return JSON.parse(output.stdout.trim());
};
const withoutSchedule = row => {
  const { orphanLastCheckedAt, ...business } = row;
  return business;
};

test.each(['homework_in_use', 'resource_skipped'])('limit=1 rotates %s across CLI restarts without changing business state or first audit', async mode => {
  const a = await upload(), b = await upload();
  if (mode === 'homework_in_use') await claim(a);
  else {
    await createMediaReferenceOperationService({ transactionRunner: runner }).prepare({
      familyId: String(familyId), childId: String(childId), resourceType: 'growth_task', resourceId: String(id()),
      operationId: randomUUID(), commandHash: 'a'.repeat(64),
      references: [{ mediaId: String(a._id), field: 'completionMediaIds' }]
    });
  }
  const before = await Asset.collection.findOne({ _id: a._id });
  expect(await cleanup()).toEqual({ success: true, inspected: 1, purged: 0, skipped: 1, failed: 0 });
  const first = await Retirement.findOne({ mediaId: a._id }).lean();
  if (mode === 'homework_in_use') expect(first.state).toBe('CANDIDATE');
  else expect(first).toBeNull();
  expect(await cleanup()).toEqual({ success: true, inspected: 1, purged: 1, skipped: 0, failed: 0 });
  expect(await Asset.findById(b._id)).toBeNull();
  const checked = await Asset.collection.findOne({ _id: a._id });
  expect(checked.orphanLastCheckedAt).toBeInstanceOf(Date);
  expect(withoutSchedule(checked)).toEqual(before);
  expect(await store.read(a.storageKey)).toHaveLength(9);
  expect(await cleanup()).toEqual({ success: true, inspected: 1, purged: 0, skipped: 1, failed: 0 });
  expect(await Retirement.findOne({ mediaId: a._id }).lean()).toEqual(first);
  expect(withoutSchedule(await Asset.collection.findOne({ _id: a._id }))).toEqual(before);
});

test('a lost HTTP grant response rotates behind unchecked assets and retries the same retirement identity', async () => {
  const a = await upload(), b = await upload(); dropResponse = true;
  expect(await cleanup()).toEqual({ success: false, code: 'COMPLETION_ORPHAN_CLEANUP_FAILED',
    counts: { inspected: 1, purged: 0, skipped: 0, failed: 1 } });
  const first = await Retirement.findOne({ mediaId: a._id }).lean();
  const guard = await Guard.findOne({ mediaId: a._id }).lean();
  expect(first.state).toBe('CANDIDATE'); expect(guard.retirementId).toBe(first.retirementId);
  expect(await cleanup()).toEqual({ success: true, inspected: 1, purged: 1, skipped: 0, failed: 0 });
  expect(await Asset.findById(b._id)).toBeNull();
  expect(await Retirement.findOne({ mediaId: a._id }).lean()).toEqual(first);
  expect(await cleanup()).toEqual({ success: true, inspected: 1, purged: 1, skipped: 0, failed: 0 });
  const last = await Retirement.findOne({ mediaId: a._id }).lean();
  expect(last).toMatchObject({ retirementId: first.retirementId, createdAt: first.createdAt,
    orphanEligibleAt: first.orphanEligibleAt, uploadMetadataHash: first.uploadMetadataHash, state: 'PURGED' });
  expect(await Guard.findOne({ mediaId: a._id }).lean()).toEqual(guard);
});

test('missing and null scheduling dates precede checked assets without enrolling or accelerating retained assets', async () => {
  const a = await upload(), b = await upload(), c = await upload(), retained = await upload();
  await claim(a);
  await Asset.updateOne({ _id: a._id }, { $set: { orphanLastCheckedAt: new Date(Date.now() - 1000) } }, { timestamps: false });
  await Asset.collection.updateOne({ _id: b._id }, { $set: { orphanLastCheckedAt: null } });
  await Asset.collection.updateOne({ _id: retained._id }, { $set: { orphanEligibleAt: new Date(Date.now() + 86400000) } });
  const retainedBefore = await Asset.collection.findOne({ _id: retained._id });
  expect((await Asset.findById(a._id)).orphanLastCheckedAt).toBeInstanceOf(Date);
  for (const asset of [b, c]) {
    expect(await cleanup()).toEqual({ success: true, inspected: 1, purged: 1, skipped: 0, failed: 0 });
    expect(await Asset.findById(asset._id)).toBeNull();
  }
  expect(await cleanup()).toEqual({ success: true, inspected: 1, purged: 0, skipped: 1, failed: 0 });
  expect(await Asset.collection.findOne({ _id: retained._id })).toEqual(retainedBefore);
  expect(await Retirement.findOne({ mediaId: retained._id })).toBeNull();
});

test('clock rollback rotates beyond the whole candidate maximum across actual CLI processes', async () => {
  const a = await upload(), b = await upload(); await claim(a);
  await cleanup();
  const first = await Retirement.findOne({ mediaId: a._id }).lean();
  const future = new Date(Date.now() + 365 * 86400000);
  await Asset.collection.updateOne({ _id: a._id }, { $set: { orphanLastCheckedAt: new Date(Date.now() - 1000) } });
  await Asset.collection.updateOne({ _id: b._id }, { $set: { orphanLastCheckedAt: future } });
  const before = await Asset.collection.findOne({ _id: a._id });
  expect(await cleanup()).toEqual({ success: true, inspected: 1, purged: 0, skipped: 1, failed: 0 });
  expect(await cleanup()).toEqual({ success: true, inspected: 1, purged: 1, skipped: 0, failed: 0 });
  const after = await Asset.collection.findOne({ _id: a._id });
  expect(after.orphanLastCheckedAt.getTime()).toBeGreaterThan(future.getTime());
  expect(withoutSchedule(after)).toEqual(withoutSchedule(before));
  expect(await Retirement.findOne({ mediaId: a._id }).lean()).toEqual(first);
  expect(await Asset.findById(b._id)).toBeNull();
  expect(await store.read(a.storageKey)).toHaveLength(9);
});

const databaseSnapshot = async () => {
  const result = {};
  for (const collection of Object.values(mongoose.connection.collections)) {
    // Raw BSON preserves out-of-JavaScript-range dates instead of comparing NaN.
    const rows = await mongoose.connection.db.collection(collection.name).find({}, { raw: true }).sort({ _id: 1 }).toArray();
    for (const row of rows) expect(Buffer.isBuffer(row)).toBe(true);
    result[collection.name] = rows;
  }
  return result;
};
test.each(['date_limit', 'bson_date_overflow', 'bson_date_underflow', 'string', 'array'])
('unselected candidate scheduling %s fails closed before any attempt or write', async malformed => {
  const a = await upload(), b = await upload(); await claim(a);
  if (['bson_date_overflow', 'bson_date_underflow'].includes(malformed)) {
    await Asset.collection.updateOne({ _id: b._id }, [{ $set: {
      orphanLastCheckedAt: { $toDate: mongoose.mongo.Long.fromString(
        malformed === 'bson_date_overflow' ? '8640000000000001' : '-8640000000000001') }
    } }]);
  } else {
    const value = { date_limit: new Date(8640000000000000), string: 'future', array: [new Date()] }[malformed];
    await Asset.collection.updateOne({ _id: b._id }, { $set: { orphanLastCheckedAt: value } });
  }
  const before = await databaseSnapshot();
  expect(await cleanup()).toEqual(malformed === 'date_limit'
    ? { success: false, code: 'COMPLETION_ORPHAN_CLEANUP_FAILED', counts: { inspected: 0, purged: 0, skipped: 0, failed: 1 } }
    : { success: false, code: 'COMPLETION_RETENTION_NOT_READY' });
  expect(await databaseSnapshot()).toEqual(before);
  expect(await store.read(a.storageKey)).toHaveLength(9);
  expect(await store.read(b.storageKey)).toHaveLength(9);
});

test('the last valid scheduling millisecond is usable once and cannot overflow on the next run', async () => {
  const a = await upload(); await claim(a);
  await Asset.collection.updateOne({ _id: a._id }, { $set: { orphanLastCheckedAt: new Date(8639999999999999) } });
  expect(await cleanup()).toEqual({ success: true, inspected: 1, purged: 0, skipped: 1, failed: 0 });
  expect((await Asset.collection.findOne({ _id: a._id })).orphanLastCheckedAt.getTime()).toBe(8640000000000000);
  const before = await databaseSnapshot();
  expect(await cleanup()).toEqual({ success: false, code: 'COMPLETION_ORPHAN_CLEANUP_FAILED',
    counts: { inspected: 0, purged: 0, skipped: 0, failed: 1 } });
  expect(await databaseSnapshot()).toEqual(before);
});

test('assetless valid user supersession mixes with rollback candidates without changing its first audit or mapping', async () => {
  const gone = await upload(); await claim(gone); await cleanup();
  const original = await Retirement.findOne({ mediaId: gone._id }).lean();
  const { createCompletionMediaPrivacyService } = require('../services/completionMediaPrivacyService');
  const { createCompletionMediaCleanupService } = require('../services/completionMediaCleanupService');
  const { createMediaDeletionJournal } = require('../services/mediaDeletionJournal');
  const journal = createMediaDeletionJournal({ root: env.COMPLETION_DELETION_JOURNAL_ROOT });
  await createCompletionMediaPrivacyService({ transactionRunner: runner, journal })
    .deleteMedia({ identity: parent, mediaId: String(gone._id) });
  await cleanup();
  expect((await Retirement.findOne({ mediaId: gone._id })).state).toBe('SUPERSEDED');
  expect(await createCompletionMediaCleanupService({ transactionRunner: runner, journal, mediaStore: store,
    now: () => Date.now() + 31 * 86400000 }).cleanupDeletedMedia()).toMatchObject({ cleaned: 1 });
  // Reproduce a lagging retirement backup after the user cleanup already removed metadata.
  await Retirement.collection.replaceOne({ _id: original._id }, original);
  const Tombstone = require('../models/MediaDeletionTombstone');
  const audit = await Tombstone.findOne({ mediaId: gone._id }).lean();
  const journalPath = path.join(env.COMPLETION_DELETION_JOURNAL_ROOT, String(gone._id) + '.json');
  const evidence = await fs.readFile(journalPath);
  const a = await upload(), b = await upload(); await claim(a);
  await Asset.collection.updateOne({ _id: a._id }, { $set: { orphanLastCheckedAt: new Date(Date.now() - 1000) } });
  await Asset.collection.updateOne({ _id: b._id }, { $set: { orphanLastCheckedAt: new Date(Date.now() + 365 * 86400000) } });
  expect(await cleanup()).toEqual({ success: true, inspected: 1, purged: 0, skipped: 1, failed: 0 });
  expect(await Asset.findById(gone._id)).toBeNull();
  expect(await Retirement.findOne({ mediaId: gone._id }).lean()).toMatchObject({
    state: 'SUPERSEDED', retirementId: original.retirementId, createdAt: original.createdAt
  });
  expect(await cleanup()).toEqual({ success: true, inspected: 1, purged: 0, skipped: 1, failed: 0 });
  expect(await cleanup()).toEqual({ success: true, inspected: 1, purged: 1, skipped: 0, failed: 0 });
  expect(await Asset.findById(b._id)).toBeNull();
  expect(await Tombstone.findOne({ mediaId: gone._id }).lean()).toEqual(audit);
  expect(await fs.readFile(journalPath)).toEqual(evidence);
});
