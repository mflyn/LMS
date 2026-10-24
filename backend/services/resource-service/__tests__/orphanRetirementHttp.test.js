const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const http = require('http');
const express = require('express');
const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('../../../../node_modules/mongodb-memory-server');
const Asset = require('../models/MediaAsset');
const Retirement = require('../models/MediaOrphanRetirement');
const UploadGuard = require('../models/CompletionUploadGuard');
const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');
const Task = require('../../homework-service/models/GrowthTask');
const LocalOperation = require('../../homework-service/models/GrowthTaskCompletionOperation');
const Guard = require('../../homework-service/models/CompletionMediaGuard');
const { errorHandler } = require('../../../common/middleware/errorHandler');
const { createCompletionMediaRetirementRouter } = require('../../homework-service/routes/completionMediaRetirements');
const { createCompletionMediaRetirementService } = require('../../homework-service/services/completionMediaRetirementService');
const { createGrowthTaskCompletionService } = require('../../homework-service/services/growthTaskCompletionService');
const { createCompletionRetirementClient } = require('../../../common/services/completionRetirementClient');
const { createOrphanRetirementService } = require('../services/orphanRetirementService');
const { createOrphanRetirementJournal } = require('../services/orphanRetirementJournal');
const { createMongoTransactionRunner } = require('../services/mongoTransaction');
const { createPrivateMediaStore } = require('../services/privateMediaStore');
const { createCompletionUploadService } = require('../services/completionUploadService');
const { createCompletionUploadJournal } = require('../services/completionUploadJournal');
const { runOrphanCleanup } = require('../services/orphanRetentionOperations');
const { checkCompletionOperations } = require('../services/completionOperations');
jest.setTimeout(30000);
const id = () => new mongoose.Types.ObjectId(), token = 'synthetic-completion-retirement-only-32';
let mongo, server, root, store, runner, journal, client, parent, childId, familyId, time, dropResponse, claims;
const make = options => createOrphanRetirementService({ transactionRunner: runner, retirementClient: client,
  journal, mediaStore: store, now: () => time, ...options });
const fixture = async () => {
  const stored = await store.writeCanonical(Buffer.from('synthetic'));
  const upload = createCompletionUploadService({ transactionRunner: runner, mediaStore: store,
    journal: createCompletionUploadJournal({ root: path.join(root, 'uploads') }), now: () => time });
  const asset = await upload.upload({ identity: parent, metadata: { familyId: String(familyId), childId: String(childId),
    uploadedBy: parent.id, purpose: 'task_completion', mimeType: 'image/jpeg', sizeBytes: 9,
    storageKey: stored.storageKey, malwareScanStatus: 'skipped_trusted_local', malwareScannedAt: null } });
  time += 86400000;
  return asset;
};
const claim = async asset => {
  const task = await Task.create({ familyId, childId, createdByParentId: parent.id, title: 'Synthetic',
    dimension: 'academic', taskType: 'practice', dueDate: '2026-10-23' });
  const mediaReferenceClient = Object.fromEntries(['prepare', 'commit', 'abort', 'status', 'unbind']
    .map(action => [action, async () => { claims.push(action); throw Error('synthetic pending remote'); }]));
  const service = createGrowthTaskCompletionService({ transactionRunner: runner, mediaReferenceClient });
  return service.complete({ identity: parent, taskId: String(task._id), body: { operationId: randomUUID(),
    expectedCompletionVersion: 0, expectedChecklistVersion: 0, checkedItemIds: [], completionMediaIds: [String(asset._id)] } });
};
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri());
  for (const model of Object.values(mongoose.models)) await model.init();
  runner = createMongoTransactionRunner(mongoose.connection);
});
beforeEach(async () => {
  for (const c of Object.values(mongoose.connection.collections)) await c.deleteMany({});
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 't2-orphan-http-')));
  store = createPrivateMediaStore({ root: path.join(root, 'media') });
  journal = createOrphanRetirementJournal({ root: path.join(root, 'system-journal') });
  time = Date.parse('2026-10-23T00:00:00Z'); familyId = id(); childId = id(); parent = { id: String(id()), role: 'parent' };
  await Family.create({ _id: familyId, familyName: 'Synthetic HTTP', ownerParentId: parent.id,
    memberParentIds: [parent.id], childIds: [childId] });
  await User.collection.insertMany([{ _id: new mongoose.Types.ObjectId(parent.id), username: parent.id, email: parent.id + '@example.test', role: 'parent' },
    { _id: childId, username: String(childId), email: childId + '@example.test', familyId, role: 'student' }]);
  claims = []; dropResponse = false;
  const app = express(); app.use(express.json());
  app.use((_req, res, next) => {
    const send = res.json.bind(res);
    res.json = body => {
      if (dropResponse && body?.data?.state === 'granted') { dropResponse = false; res.socket.destroy(); return res; }
      return send(body);
    }; next();
  });
  app.use('/api/internal/completion-media-retirements', createCompletionMediaRetirementRouter({
    env: { COMPLETION_RETIREMENT_SERVICE_TOKEN: token }, service: createCompletionMediaRetirementService({ transactionRunner: runner, now: () => time }) }));
  app.use(errorHandler); server = http.createServer(app);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  client = createCompletionRetirementClient({ baseUrl: `http://127.0.0.1:${server.address().port}`, token });
});
afterEach(async () => {
  if (server) { server.closeAllConnections(); await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
  jest.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true });
});
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test('T2-G-004 committed homework retirement response lost leaves exact persistent mapping for HTTP retry', async () => {
  const a = await fixture(); dropResponse = true;
  await expect(make().retire({ mediaId: String(a._id) })).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_PENDING' });
  expect(dropResponse).toBe(false);
  const local = await Retirement.findOne().lean(), remote = await Guard.findOne().lean();
  expect(local.state).toBe('CANDIDATE'); expect(remote.state).toBe('retired'); expect(remote.retirementId).toBe(local.retirementId);
  expect(await store.read(a.storageKey)).toHaveLength(9);
  expect((await make().retire({ mediaId: String(a._id) })).state).toBe('PURGED');
  expect(await Guard.findOne().lean()).toEqual(remote);
  const evidence = await journal.read(String(a._id));
  expect(evidence.retirement.retirementId).toBe(local.retirementId);
  expect(evidence.retirement.uploadMetadataHash).toBe((await UploadGuard.findOne()).metadataHash);
  expect((await UploadGuard.findOne()).state).toBe('RETIRED');
  expect((await make().retire({ mediaId: String(a._id) })).state).toBe('PURGED');
  expect(await journal.read(String(a._id))).toEqual(evidence);
});
test('T2-G-002 durable local completion before remote prepare protects bytes via actual retirement HTTP', async () => {
  const a = await fixture(); await expect(claim(a)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  const before = await LocalOperation.find().lean();
  expect((await make().retire({ mediaId: String(a._id) })).state).toBe('in_use');
  expect(await LocalOperation.find().lean()).toEqual(before); expect(await store.read(a.storageKey)).toHaveLength(9);
  expect(await journal.read(String(a._id))).toBeNull(); expect((await Guard.findOne()).state).toBe('available');
});
test('T2-G-002 retired first rejects new completion claim before any remote call or local operation', async () => {
  const a = await fixture(); await make().retire({ mediaId: String(a._id) });
  await expect(claim(a)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  expect(claims).toEqual([]); expect(await LocalOperation.countDocuments()).toBe(0);
  const task = await Task.findOne().select('+activeCompletionOperation +completionPending').lean();
  expect(task).not.toHaveProperty('activeCompletionOperation'); expect(task).not.toHaveProperty('completionPending');
});
test('T2-G-010 late upload convergence after system purge remains terminal across service reconstruction', async () => {
  const a = await fixture();
  const record = JSON.parse(await fs.readFile(path.join(root, 'uploads', String(a._id) + '.json'), 'utf8'));
  await make().retire({ mediaId: String(a._id) });
  const upload = createCompletionUploadService({ transactionRunner: runner, mediaStore: store,
    journal: createCompletionUploadJournal({ root: path.join(root, 'uploads') }) });
  await expect(upload.resume(record)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  expect(await Asset.countDocuments()).toBe(0); expect((await Retirement.findOne()).state).toBe('PURGED');
});

const cleanupEnv = async () => {
  const journalRoot = path.join(root, 'formal-journal');
  await fs.mkdir(journalRoot, { mode: 0o700 });
  return { COMPLETION_PROTOCOL_MODE: 'enabled', COMPLETION_STORAGE_CONFIRMED: 'true',
    COMPLETION_ORPHAN_CLEANUP_ENABLED: 'true', COMPLETION_RETIREMENT_SERVICE_TOKEN: token,
    HOMEWORK_SERVICE_URL: `http://127.0.0.1:${server.address().port}`,
    PRIVATE_MEDIA_ROOT: path.join(root, 'media'), COMPLETION_DELETION_JOURNAL_ROOT: journalRoot };
};
test('T2-G-008 explicit cleanup defaults to 50, status preflight is read-only, remaining candidate converges', async () => {
  for (let index = 0; index < 51; index += 1) {
    time = Date.now() - 2 * 86400000; await fixture();
  }
  const env = await cleanupEnv();
  expect(await runOrphanCleanup({ connection: mongoose.connection, writesPaused: true, execute: true, env }))
    .toEqual({ inspected: 50, purged: 50, skipped: 0, failed: 0 });
  expect(await Asset.countDocuments()).toBe(1);
  const guards = await Guard.find().sort({ _id: 1 }).lean(), retirements = await Retirement.find().sort({ _id: 1 }).lean();
  await checkCompletionOperations({ connection: mongoose.connection, writesPaused: true, env });
  expect(await Guard.find().sort({ _id: 1 }).lean()).toEqual(guards);
  expect(await Retirement.find().sort({ _id: 1 }).lean()).toEqual(retirements);
  expect(await runOrphanCleanup({ connection: mongoose.connection, writesPaused: true, execute: true, env }))
    .toEqual({ inspected: 1, purged: 1, skipped: 0, failed: 0 });
  expect(await Asset.countDocuments()).toBe(0);
}, 60000);

test('T2-G-008 cleanup exposes sanitized partial failure and resumes the same retired identity', async () => {
  const assets = [];
  for (let index = 0; index < 2; index += 1) { time = Date.now() - 2 * 86400000; assets.push(await fixture()); }
  const env = await cleanupEnv(); dropResponse = true;
  await expect(runOrphanCleanup({ connection: mongoose.connection, writesPaused: true, execute: true, env }))
    .rejects.toMatchObject({ code: 'COMPLETION_ORPHAN_CLEANUP_FAILED', counts: { inspected: 2, purged: 1, skipped: 0, failed: 1 } });
  const candidate = await Retirement.findOne({ state: 'CANDIDATE' }).lean();
  expect(candidate).not.toBeNull();
  const remote = await Guard.findOne({ mediaId: candidate.mediaId }).lean();
  expect(remote.retirementId).toBe(candidate.retirementId);
  expect(await runOrphanCleanup({ connection: mongoose.connection, writesPaused: true, execute: true, env }))
    .toEqual({ inspected: 1, purged: 1, skipped: 0, failed: 0 });
  expect(await Guard.findOne({ mediaId: candidate.mediaId }).lean()).toEqual(remote);
  expect(await Asset.countDocuments()).toBe(0);
});

test.each([false, true])('T2-G-005 explicit cleanup resumes missing journal but rejects corrupt evidence (corrupt=%s)', async corrupt => {
  time = Date.now() - 2 * 86400000; const asset = await fixture(), env = await cleanupEnv();
  const open = fs.open.bind(fs);
  const failure = jest.spyOn(fs, 'open').mockImplementation((filename, flags, ...args) => {
    if (String(filename).includes('/orphan-retirements-v1/') && typeof flags === 'number'
      && (flags & require('fs').constants.O_CREAT)) throw Error('synthetic journal failure');
    return open(filename, flags, ...args);
  });
  await expect(runOrphanCleanup({ connection: mongoose.connection, writesPaused: true, execute: true, env }))
    .rejects.toMatchObject({ code: 'COMPLETION_ORPHAN_CLEANUP_FAILED', counts: { inspected: 1, purged: 0, failed: 1 } });
  failure.mockRestore();
  const record = await Retirement.findOne().lean(); expect(record.state).toBe('DELETED');
  expect(await store.read(asset.storageKey)).toHaveLength(9);
  const target = path.join(env.COMPLETION_DELETION_JOURNAL_ROOT, 'orphan-retirements-v1', String(asset._id) + '.json');
  await expect(fs.stat(target)).rejects.toMatchObject({ code: 'ENOENT' });
  if (corrupt) await fs.writeFile(target, '{}\n', { mode: 0o600 });
  // Startup is intentionally stricter than an explicit, still-fenced recovery operation.
  await expect(checkCompletionOperations({ connection: mongoose.connection, writesPaused: true, env })).rejects.toBeDefined();
  const retry = runOrphanCleanup({ connection: mongoose.connection, writesPaused: true, execute: true, env });
  if (corrupt) {
    await expect(retry).rejects.toBeDefined();
    expect(await Retirement.findOne().lean()).toEqual(record);
    expect(await store.read(asset.storageKey)).toHaveLength(9);
    expect(await fs.readFile(target, 'utf8')).toBe('{}\n');
  } else {
    expect(await retry).toEqual({ inspected: 1, purged: 1, skipped: 0, failed: 0 });
    expect((await Retirement.findOne()).retirementId).toBe(record.retirementId);
    await checkCompletionOperations({ connection: mongoose.connection, writesPaused: true, env });
  }
});

test.each(['CANDIDATE', 'FENCED'].flatMap(state => [false, true].map(offline => [state, offline])))
('explicit cleanup can supersede %s after user deletion without touching body or first audit (offline=%s)', async (state, offline) => {
  time = Date.now() - 2 * 86400000; const asset = await fixture(), env = await cleanupEnv();
  if (state === 'CANDIDATE') {
    await expect(claim(asset)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
    expect(await runOrphanCleanup({ connection: mongoose.connection, writesPaused: true, execute: true, env }))
      .toMatchObject({ skipped: 1, purged: 0 });
  } else {
    const update = jest.spyOn(Asset, 'updateOne').mockImplementation(() => { throw Error('synthetic metadata write interruption'); });
    await expect(runOrphanCleanup({ connection: mongoose.connection, writesPaused: true, execute: true, env }))
      .rejects.toMatchObject({ code: 'COMPLETION_ORPHAN_CLEANUP_FAILED' });
    update.mockRestore();
  }
  const record = await Retirement.findOne().lean(); expect(record.state).toBe(state);
  const { createCompletionMediaPrivacyService } = require('../services/completionMediaPrivacyService');
  const { createMediaDeletionJournal } = require('../services/mediaDeletionJournal');
  await createCompletionMediaPrivacyService({ transactionRunner: runner,
    journal: createMediaDeletionJournal({ root: env.COMPLETION_DELETION_JOURNAL_ROOT }) })
    .deleteMedia({ identity: parent, mediaId: String(asset._id) });
  const Tombstone = require('../models/MediaDeletionTombstone');
  const audit = await Tombstone.findOne().lean(); expect(audit.reason).toBe('user_requested');
  const bytes = await fs.readFile(path.join(env.COMPLETION_DELETION_JOURNAL_ROOT, String(asset._id) + '.json'));
  const remoteGuards = await Guard.find().sort({ _id: 1 }).lean();
  if (offline) {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
    server = null;
  }
  expect(await runOrphanCleanup({ connection: mongoose.connection, writesPaused: true, execute: true, env }))
    .toEqual({ inspected: 1, purged: 0, skipped: 1, failed: 0 });
  expect((await Retirement.findOne()).state).toBe('SUPERSEDED');
  expect((await Retirement.findOne()).retirementId).toBe(record.retirementId);
  expect(await Tombstone.findOne().lean()).toEqual(audit);
  expect(await fs.readFile(path.join(env.COMPLETION_DELETION_JOURNAL_ROOT, String(asset._id) + '.json'))).toEqual(bytes);
  expect(await store.read(asset.storageKey)).toHaveLength(9);
  expect(await Guard.find().sort({ _id: 1 }).lean()).toEqual(remoteGuards);
});
