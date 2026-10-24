const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const express = require('express');
const axios = require('axios');
const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('../../../../node_modules/mongodb-memory-server');
const Asset = require('../models/MediaAsset');
const Reference = require('../models/MediaReference');
const RemoteOperation = require('../models/MediaReferenceOperation');
const Retirement = require('../models/MediaOrphanRetirement');
const UploadGuard = require('../models/CompletionUploadGuard');
const Tombstone = require('../models/MediaDeletionTombstone');
const Receipt = require('../models/MediaDeletionReceipt');
const Family = require('../../../common/models/Family');
const User = require('../../../common/models/User');
const Task = require('../../homework-service/models/GrowthTask');
const LocalOperation = require('../../homework-service/models/GrowthTaskCompletionOperation');
const HomeworkGuard = require('../../homework-service/models/CompletionMediaGuard');
const Ledger = require('../../progress-service/models/StarLedgerEntry');
const { errorHandler } = require('../../../common/middleware/errorHandler');
const { createCompletionMediaReferenceClient } = require('../../../common/services/mediaReferenceClient');
const { createCompletionMediaReferencesRouter } = require('../routes/completionMediaReferences');
const { createMediaReferenceCredential } = require('../middleware/mediaReferenceCredential');
const { createMediaReferenceOperationService } = require('../services/mediaReferenceOperationService');
const { createCompletionMediaRetirementRouter } = require('../../homework-service/routes/completionMediaRetirements');
const { createCompletionMediaRetirementService } = require('../../homework-service/services/completionMediaRetirementService');
const { createGrowthTaskCompletionService } = require('../../homework-service/services/growthTaskCompletionService');
const { assertGrowthTaskCompletionReadiness } = require('../../homework-service/services/growthTaskCompletionReadiness');
const { assertCompletionMediaGuardReadiness } = require('../../homework-service/services/completionMediaGuardReadiness');
const { createMongoTransactionRunner } = require('../services/mongoTransaction');
const { createPrivateMediaStore } = require('../services/privateMediaStore');
const { createRetentionDependencies } = require('../services/orphanRetentionRuntime');
const { createCompletionUploadService } = require('../services/completionUploadService');
const { createOrphanRetirementService } = require('../services/orphanRetirementService');
const { createOrphanRetirementRestore } = require('../services/orphanRetirementRestore');
const { checkCompletionOperations } = require('../services/completionOperations');

jest.setTimeout(60000);
const START = Date.parse('2026-10-23T00:00:00Z'), DAY = 86400000;
const MEDIA_TOKEN = 'synthetic-recovery-reference-only-token-32';
const RETIREMENT_TOKEN = 'synthetic-recovery-retirement-only-token-32';
const id = () => new mongoose.Types.ObjectId();
const models = [Family, User, Task, LocalOperation, HomeworkGuard, Ledger,
  Asset, Reference, RemoteOperation, Retirement, UploadGuard, Tombstone, Receipt];
let mongo, root, store, runner, env, retention, time, parent, familyId, childId;
let servers, resourceUrl, dropPrepare, mediaCalls, retirementCalls;
const snapshot = () => Promise.all(models.map(model => model.collection.find().sort({ _id: 1 }).toArray()));
const listen = async app => {
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
};
const completion = () => createGrowthTaskCompletionService({ transactionRunner: runner, now: () => time,
  mediaReferenceClient: createCompletionMediaReferenceClient({ resourceServiceUrl: resourceUrl,
    serviceToken: MEDIA_TOKEN, axiosInstance: axios.create({ proxy: false, timeout: 3000, maxRedirects: 0 }) }) });
const retirementService = () => createOrphanRetirementService({ ...retention, transactionRunner: runner,
  mediaStore: store, now: () => time });
const restore = mediaId => createOrphanRetirementRestore({ ...retention, transactionRunner: runner,
  mediaStore: store, now: () => time }).restore({ mediaId: String(mediaId), writesPaused: true, execute: true });
const upload = async () => {
  const { storageKey } = await store.writeCanonical(Buffer.from('synthetic'));
  return createCompletionUploadService({ transactionRunner: runner, mediaStore: store,
    journal: retention.uploadJournal, now: () => time }).upload({ identity: parent, metadata: {
    familyId: String(familyId), childId: String(childId), uploadedBy: parent.id,
    purpose: 'task_completion', mimeType: 'image/jpeg', sizeBytes: 9, storageKey,
    malwareScanStatus: 'skipped_trusted_local', malwareScannedAt: null
  } });
};
const business = task => Object.fromEntries(['status', 'completionVersion', 'checklistVersion', 'completedAt',
  'confirmedAt', 'confirmedByParentId', 'parentFeedback', 'starAwardState', 'completionMediaIds',
  'completionMediaBindings', 'checkedItemIds'].map(key => [key, task[key]]));
const taskRow = task => Task.collection.findOne({ _id: task._id });
const command = assets => ({ operationId: randomUUID(), expectedCompletionVersion: 0,
  expectedChecklistVersion: 0, checkedItemIds: [], completionMediaIds: assets.map(asset => String(asset._id)) });
const recover = (task, body) => completion().recover({ identity: parent, taskId: String(task._id), operationId: body.operationId });
const readonlyReady = async () => {
  const before = await snapshot(), callStart = retirementCalls.length;
  expect(await checkCompletionOperations({ connection: mongoose.connection, writesPaused: true, env }))
    .toMatchObject({ ready: true });
  await assertGrowthTaskCompletionReadiness({ connection: mongoose.connection, writesPaused: true });
  await assertCompletionMediaGuardReadiness({ connection: mongoose.connection, writesPaused: true });
  expect(await snapshot()).toEqual(before);
  const checks = retirementCalls.slice(callStart);
  expect(checks.length).toBeGreaterThan(0);
  expect(checks.every(call => call.action === 'status')).toBe(true);
};

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(mongo.getUri());
  for (const model of Object.values(mongoose.models)) await model.init();
  runner = createMongoTransactionRunner(mongoose.connection);
});
beforeEach(async () => {
  for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({});
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'lms-t2-g-recovery-http-')));
  time = START; servers = []; mediaCalls = []; retirementCalls = []; dropPrepare = false;
  jest.spyOn(mongoose, 'now').mockImplementation(() => new Date(time));
  parent = { id: String(id()), role: 'parent' }; familyId = id(); childId = id();
  await Family.create({ _id: familyId, familyName: 'Synthetic recovery', ownerParentId: parent.id,
    memberParentIds: [parent.id], childIds: [childId] });
  await User.collection.insertMany([
    { _id: new mongoose.Types.ObjectId(parent.id), role: 'parent', username: parent.id, email: parent.id + '@example.test' },
    { _id: childId, role: 'student', familyId, username: String(childId), email: childId + '@example.test', childProfile: { tokenVersion: 0 } }
  ]);
  const resource = express(); resource.use(express.json());
  resource.use((req, res, next) => {
    const action = req.path.split('/').pop(); mediaCalls.push({ action, body: req.body });
    const send = res.json.bind(res);
    res.json = body => {
      // Drop only the response, after the real provider durably created PREPARED.
      if (dropPrepare && action === 'prepare' && body.success) { dropPrepare = false; res.destroy(); return res; }
      return send(body);
    }; next();
  });
  resource.use('/api/internal/media/references', createCompletionMediaReferencesRouter({
    credential: createMediaReferenceCredential(MEDIA_TOKEN),
    operationService: createMediaReferenceOperationService({ transactionRunner: runner, now: () => time }) }));
  resource.use(errorHandler); resourceUrl = await listen(resource);
  const homework = express(); homework.use(express.json());
  homework.use((req, res, next) => {
    const entry = { action: req.path.endsWith('/status') ? 'status' : 'retire', body: req.body };
    retirementCalls.push(entry);
    const send = res.json.bind(res);
    res.json = body => { entry.response = body; return send(body); }; next();
  });
  homework.use('/api/internal/completion-media-retirements', createCompletionMediaRetirementRouter({
    env: { COMPLETION_RETIREMENT_SERVICE_TOKEN: RETIREMENT_TOKEN },
    service: createCompletionMediaRetirementService({ transactionRunner: runner, now: () => time }) }));
  homework.use(errorHandler);
  const homeworkUrl = await listen(homework);
  const journalRoot = path.join(root, 'journal'); await fs.mkdir(journalRoot, { mode: 0o700 });
  env = { COMPLETION_PROTOCOL_MODE: 'enabled', COMPLETION_STORAGE_CONFIRMED: 'true',
    COMPLETION_ORPHAN_CLEANUP_ENABLED: 'true', COMPLETION_RETIREMENT_SERVICE_TOKEN: RETIREMENT_TOKEN,
    HOMEWORK_SERVICE_URL: homeworkUrl, PRIVATE_MEDIA_ROOT: path.join(root, 'media'),
    COMPLETION_DELETION_JOURNAL_ROOT: journalRoot };
  store = createPrivateMediaStore({ root: env.PRIVATE_MEDIA_ROOT });
  retention = createRetentionDependencies(env);
});
afterEach(async () => {
  for (const server of servers) {
    server.closeAllConnections(); await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  jest.restoreAllMocks(); await fs.rm(root, { recursive: true, force: true });
});
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test.each(['existing', 'absent'])('T2-G-007 BSON rollback with %s upload guard converges through original actor and HTTP retirement barrier', async guardState => {
  const target = await upload(), sibling = await upload();
  const fields = { familyId, childId, createdByParentId: parent.id, title: 'Synthetic task',
    dimension: 'academic', taskType: 'practice', dueDate: '2026-10-23' };
  const task = await Task.create(fields);
  // A nonempty historical audit/ledger makes preservation checks non-vacuous.
  const historical = await Task.create({ ...fields, status: 'confirmed', completionVersion: 1,
    completedAt: new Date(START - 2000), confirmedAt: new Date(START - 1000),
    confirmedByParentId: parent.id, parentFeedback: 'Synthetic first audit', starAwardState: 'awarded' });
  await Ledger.create({ familyId, childId, type: 'earn', amount: 1, sourceType: 'task_confirmation',
    sourceId: String(historical._id), createdBy: 'homework-service' });
  const historyBefore = await taskRow(historical), ledgerBefore = await Ledger.collection.find().toArray();
  const businessBefore = business(await taskRow(task));
  const guardBefore = await UploadGuard.findOne({ mediaId: target._id }).lean();
  const a = command([target, sibling]); dropPrepare = true;
  await expect(completion().complete({ identity: parent, taskId: String(task._id), body: a }))
    .rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  expect(dropPrepare).toBe(false);
  const pending = await LocalOperation.findOne({ operationId: a.operationId }).lean();
  expect(pending).toMatchObject({ phase: 'PREPUBLISH' });
  expect(await taskRow(task)).toHaveProperty('activeCompletionOperation');
  const prepared = await RemoteOperation.findOne({ operationId: pending.remoteOperationId }).lean();
  expect(prepared).toMatchObject({ state: 'PREPARED', commandHash: pending.commandHash });
  const originalRequest = mediaCalls.find(call => call.action === 'prepare').body;
  expect(originalRequest.operationId).toBe(pending.remoteOperationId);
  expect(prepared.references).toHaveLength(2);
  const siblingBefore = await Asset.findById(sibling._id).lean();
  const backup = mongoose.mongo.BSON.serialize({ collections: await snapshot() });

  time = prepared.leaseExpiresAt.getTime();
  await expect(recover(task, a)).rejects.toMatchObject({ code: 'MEDIA_OPERATION_EXPIRED' });
  const failed = await LocalOperation.findById(pending._id).lean();
  expect(failed).toMatchObject({ phase: 'FAILED', remoteOperationId: pending.remoteOperationId,
    commandHash: pending.commandHash, failureCode: 'MEDIA_OPERATION_EXPIRED', failureStatus: 409 });
  expect(await taskRow(task)).not.toHaveProperty('activeCompletionOperation');
  // Obtain B through another actual local claim, never manufacture a remote mapping or hash.
  const b = command([target, sibling]); dropPrepare = true;
  await expect(completion().complete({ identity: parent, taskId: String(task._id), body: b }))
    .rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  const localB = await LocalOperation.findOne({ operationId: b.operationId }).lean();
  time = (await RemoteOperation.findOne({ operationId: localB.remoteOperationId })).leaseExpiresAt.getTime();
  await expect(recover(task, b)).rejects.toMatchObject({ code: 'MEDIA_OPERATION_EXPIRED' });
  time = START + DAY;
  expect(await retirementService().retire({ mediaId: String(target._id) })).toMatchObject({ state: 'PURGED' });
  const proof = await retention.journal.read(String(target._id));
  expect(proof.operations.map(op => op.operationId).sort()).toEqual([pending.remoteOperationId, localB.remoteOperationId].sort());
  expect(proof.operations.every(op => op.state === 'ABORTED' && op.references.length === 2)).toBe(true);
  const journalPath = path.join(env.COMPLETION_DELETION_JOURNAL_ROOT, 'orphan-retirements-v1', `${target._id}.json`);
  const journalBytes = await fs.readFile(journalPath);
  expect(await Asset.findById(target._id)).toBeNull();
  await expect(store.read(target.storageKey)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });

  // Rewind only the isolated database via BSON. External deletion/upload journals and bytes stay current.
  const restored = mongoose.mongo.BSON.deserialize(backup).collections;
  for (let index = 0; index < models.length; index += 1) {
    await models[index].collection.deleteMany({});
    if (restored[index].length) await models[index].collection.insertMany(restored[index]);
  }
  expect(await LocalOperation.findById(pending._id).lean()).toEqual(pending);
  expect(await RemoteOperation.findById(prepared._id).lean()).toEqual(prepared);
  // An older/enrolled backup may legitimately predate the upload guard collection.
  if (guardState === 'absent') await UploadGuard.collection.deleteOne({ mediaId: target._id });
  expect(await fs.readFile(journalPath)).toEqual(journalBytes);
  time += 1000;
  const reconstructionTime = new Date(time);
  const remove = jest.spyOn(store, 'remove');
  expect(await restore(target._id)).toMatchObject({ ready: false, state: 'RESOURCE_RESTORED_PENDING_HOMEWORK',
    retirementId: proof.retirement.retirementId, nextAction: 'RECOVER_HOMEWORK_ORIGINAL_ACTOR' });
  expect(retirementCalls.at(-1)).toMatchObject({ action: 'retire', response: { data: { state: 'in_use' } } });
  expect(await LocalOperation.findById(pending._id).lean()).toEqual(pending);
  for (const evidence of proof.operations) {
    expect(await RemoteOperation.findById(evidence._id).lean()).toMatchObject({ state: 'ABORTED',
      operationId: evidence.operationId, commandHash: evidence.commandHash, referenceSetHash: evidence.referenceSetHash,
      version: evidence.version, failureCode: evidence.failureCode, terminalAt: new Date(evidence.terminalAt) });
  }
  const refs = await Reference.find().lean();
  expect(refs).toHaveLength(2); expect(refs.every(ref => ref.state === 'released')).toBe(true);
  expect(refs.find(ref => String(ref.mediaId) === String(sibling._id))).toMatchObject({
    operationId: pending.remoteOperationId, releaseOperationId: pending.remoteOperationId });
  expect(await Asset.findById(target._id).lean()).toMatchObject({ status: 'deleted',
    deletedAt: new Date(proof.retirement.deletedAt), orphanRetirementId: proof.retirement.retirementId });
  const restoredGuard = await UploadGuard.findOne({ mediaId: target._id }).lean();
  expect(restoredGuard).toMatchObject({ state: 'RETIRED', metadataHash: guardBefore.metadataHash,
    ...(guardState === 'existing' ? { _id: guardBefore._id, createdAt: guardBefore.createdAt, updatedAt: guardBefore.updatedAt }
      : { createdAt: reconstructionTime, updatedAt: reconstructionTime }) });
  expect(await Retirement.findOne().lean()).toMatchObject({ state: 'DELETED', evidence: proof, purgedAt: null });
  const uploadRecord = JSON.parse(await fs.readFile(path.join(env.COMPLETION_DELETION_JOURNAL_ROOT,
    'uploads-v1', `${target._id}.json`), 'utf8'));
  await expect(createCompletionUploadService({ transactionRunner: runner, mediaStore: store,
    journal: retention.uploadJournal, now: () => time }).resume(uploadRecord)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  const notReady = await snapshot();
  await expect(checkCompletionOperations({ connection: mongoose.connection, writesPaused: true, env }))
    .rejects.toMatchObject({ code: 'COMPLETION_REFERENCES_NOT_READY', issues: ['REFERENCE_ASSET_INVALID'] });
  expect(retirementCalls.at(-1)).toMatchObject({ action: 'status', response: { data: { state: 'available' } } });
  expect(await snapshot()).toEqual(notReady);

  const recoverStart = mediaCalls.length;
  await expect(recover(task, a)).rejects.toMatchObject({ code: failed.failureCode });
  const recovered = await LocalOperation.findById(pending._id).lean();
  expect(recovered).toMatchObject({ _id: failed._id, phase: failed.phase, commandHash: failed.commandHash,
    remoteOperationId: failed.remoteOperationId, failureCode: failed.failureCode, failureStatus: failed.failureStatus,
    version: failed.version, createdAt: failed.createdAt });
  expect(mediaCalls.slice(recoverStart).map(call => call.action)).toEqual(['status']);
  expect(mediaCalls.at(-1).body).toEqual({ ...originalRequest, mode: 'operation' });
  expect(await taskRow(task)).not.toHaveProperty('activeCompletionOperation');
  expect(await taskRow(task)).not.toHaveProperty('completionPending');
  time += 1000;
  expect(await restore(target._id)).toMatchObject({ ready: false, state: 'RESOURCE_RESTORED_HOMEWORK_RETIRED',
    retirementId: proof.retirement.retirementId, nextAction: 'VERIFY_RECOVERY_READINESS' });
  const grantedGuard = await HomeworkGuard.findOne({ mediaId: target._id }).lean();
  expect(grantedGuard).toMatchObject({ state: 'retired', retirementId: proof.retirement.retirementId });
  const retireCalls = retirementCalls.filter(call => call.action === 'retire');
  expect(retireCalls.map(call => call.response.data.state)).toEqual(['granted', 'in_use', 'granted']);
  for (const call of retireCalls) expect(call.body).toEqual(retireCalls[0].body);
  await readonlyReady();
  expect(remove).not.toHaveBeenCalled();
  expect(await retirementService().retire({ mediaId: String(target._id) })).toMatchObject({ state: 'PURGED' });
  expect(remove).toHaveBeenCalledTimes(1); expect(remove).toHaveBeenCalledWith(target.storageKey);
  await readonlyReady();
  expect(await restore(target._id)).toMatchObject({ ready: false, state: 'RESOURCE_RESTORED_HOMEWORK_RETIRED' });
  expect(await HomeworkGuard.findOne({ mediaId: target._id }).lean()).toEqual(grantedGuard);
  expect(await Retirement.findOne().lean()).toMatchObject({ state: 'PURGED', evidence: proof,
    retirementId: proof.retirement.retirementId, createdAt: new Date(proof.retirement.createdAt),
    deletedAt: new Date(proof.retirement.deletedAt) });
  expect(await UploadGuard.findOne({ mediaId: target._id }).lean()).toEqual(restoredGuard);
  expect(await Asset.findById(target._id)).toBeNull();
  expect(await Reference.countDocuments({ mediaId: target._id })).toBe(0);
  expect(await Asset.findById(sibling._id).lean()).toEqual(siblingBefore);
  expect(await store.read(sibling.storageKey)).toEqual(Buffer.from('synthetic'));
  await expect(store.read(target.storageKey)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  expect(await fs.readFile(journalPath)).toEqual(journalBytes);
  expect(business(await taskRow(task))).toEqual(businessBefore);
  expect(await taskRow(historical)).toEqual(historyBefore);
  expect(await Ledger.collection.find().toArray()).toEqual(ledgerBefore);
  expect(await LocalOperation.countDocuments()).toBe(1); expect(await RemoteOperation.countDocuments()).toBe(2);
  expect(await Tombstone.countDocuments()).toBe(0); expect(await Receipt.countDocuments()).toBe(0);
});
