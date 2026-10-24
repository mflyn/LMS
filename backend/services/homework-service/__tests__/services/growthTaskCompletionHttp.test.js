const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { createCompletionMediaReferencesRouter } = require('../../../resource-service/routes/completionMediaReferences');
const { createMediaReferenceCredential } = require('../../../resource-service/middleware/mediaReferenceCredential');
const { createMediaReferenceOperationService } = require('../../../resource-service/services/mediaReferenceOperationService');
const { createCompletionMediaReferenceClient } = require('../../../../common/services/mediaReferenceClient');
const { createGrowthTaskCompletionService } = require('../../services/growthTaskCompletionService');
const { createCompletionMediaPrivacyService } = require('../../../resource-service/services/completionMediaPrivacyService');
const { createCompletionMediaCleanupService } = require('../../../resource-service/services/completionMediaCleanupService');
const { createMediaDeletionJournal } = require('../../../resource-service/services/mediaDeletionJournal');
const { createPrivateMediaStore } = require('../../../resource-service/services/privateMediaStore');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');
const { errorHandler } = require('../../../../common/middleware/errorHandler');
const Task = require('../../models/GrowthTask');
const Operation = require('../../models/GrowthTaskCompletionOperation');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const Asset = require('../../../resource-service/models/MediaAsset');
const Reference = require('../../../resource-service/models/MediaReference');
const RemoteOperation = require('../../../resource-service/models/MediaReferenceOperation');
const Receipt = require('../../../resource-service/models/MediaDeletionReceipt');
const Tombstone = require('../../../resource-service/models/MediaDeletionTombstone');

const TOKEN = 'synthetic-completion-http-token-32-characters';
const PREFIX = '/api/internal/media/references';
const id = () => new mongoose.Types.ObjectId();
const runner = work => runMongoTransaction({ mongooseInstance: mongoose, work });
const hidden = '+activeCompletionOperation +completionPending +completionMediaBindings';
const models = [Task, Operation, Family, User, Asset, Reference, RemoteOperation, Receipt, Tombstone];
let server, url, client, service, remote, time, parent, child, family, task, received, dropAction, root;
const http = axios.create({ proxy: false, timeout: 3000, maxRedirects: 0 });
const make = token => createGrowthTaskCompletionService({ transactionRunner: runner, now: () => time,
  mediaReferenceClient: token ? createCompletionMediaReferenceClient({ axiosInstance: http,
    resourceServiceUrl: url, serviceToken: token }) : client });
const command = (extra = {}) => ({ operationId: randomUUID(), expectedCompletionVersion: 0,
  expectedChecklistVersion: 0, checkedItemIds: [], completionMediaIds: [], ...extra });
const complete = (body, identity = parent) => service.complete({ identity, taskId: String(task._id), body });
const row = () => Task.findById(task._id).select(hidden).lean();
const op = (body, identity = parent) => Operation.findOne({ taskId: task._id, operationId: body.operationId, actorId: identity.id }).lean();
const media = async (extra = {}) => String((await Asset.create({ familyId: family._id, childId: child.id,
  uploadedBy: child.id, purpose: 'task_completion', mimeType: 'image/jpeg', sizeBytes: 1, storageKey: randomUUID(), ...extra }))._id);
const wire = (extra = {}) => ({ familyId: String(family._id), childId: child.id, resourceType: 'growth_task',
  resourceId: String(task._id), operationId: randomUUID(), commandHash: 'a'.repeat(64),
  references: [{ mediaId: String(id()), field: 'completionMediaIds' }], ...extra });
const post = (action, body, headers = { 'x-service-token': TOKEN }) => http.post(url + PREFIX + '/' + action, body,
  { headers, validateStatus: () => true });

beforeAll(async () => { for (const model of models) await model.init(); });
beforeEach(async () => {
  time = Date.parse('2026-10-22T00:00:00Z'); received = []; dropAction = null;
  parent = { id: String(id()), role: 'parent' };
  child = { id: String(id()), role: 'student', tokenVersion: 0 };
  family = await Family.create({ familyName: 'Synthetic HTTP', ownerParentId: parent.id,
    memberParentIds: [parent.id], childIds: [child.id] });
  Object.assign(child, { familyId: String(family._id), childId: child.id });
  await User.collection.insertMany([parent, child].map(user => ({ _id: new mongoose.Types.ObjectId(user.id),
    role: user.role, username: user.id, email: user.id + '@example.test',
    ...(user.role === 'student' ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {}) })));
  task = await Task.create({ familyId: family._id, childId: child.id, createdByParentId: parent.id,
    dimension: 'academic', title: 'Synthetic HTTP task', taskType: 'practice', dueDate: '2026-10-22' });
  remote = createMediaReferenceOperationService({ transactionRunner: runner, now: () => time });
  const app = express();
  app.locals.logger = { warn: jest.fn(), error: jest.fn() };
  app.use(express.json());
  // Socket loss is injected only after the real provider has computed its response.
  app.use((req, res, next) => {
    received.push({ action: req.path.split('/').pop(), body: req.body });
    const json = res.json;
    res.json = function send(body) {
      if (dropAction === req.path.split('/').pop()) { dropAction = null; this.destroy(); return this; }
      return json.call(this, body);
    };
    next();
  });
  app.use(PREFIX, createCompletionMediaReferencesRouter({ credential: createMediaReferenceCredential(TOKEN), operationService: remote }));
  app.use(errorHandler);
  server = await new Promise((resolve, reject) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); listening.once('error', reject);
  });
  url = 'http://127.0.0.1:' + server.address().port;
  client = createCompletionMediaReferenceClient({ axiosInstance: http, resourceServiceUrl: url, serviceToken: TOKEN });
  service = make();
});
afterEach(async () => {
  if (server) { server.closeAllConnections(); await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve())); server = null; }
  if (root) { await fs.rm(root, { recursive: true, force: true }); root = null; }
});

test('HTTP credential rejects before validation or any operation write', async () => {
  const response = await post('prepare', { invalid: true }, {});
  expect(response.status).toBe(401);
  expect(response.data).toMatchObject({ success: false, error: { code: 'INVALID_SERVICE_CREDENTIAL', details: [] } });
  expect(await RemoteOperation.countDocuments()).toBe(0); expect(await Reference.countDocuments()).toBe(0);
});

test('real HTTP completion persists mapped remote identity and replays an immutable result', async () => {
  const body = command({ completionMediaIds: [await media()] });
  const result = await complete(body, child);
  expect(result.data.task).toMatchObject({ status: 'completed', completionVersion: 1,
    completionMediaIds: body.completionMediaIds, completionMediaReferenceState: 'stable' });
  const local = await op(body, child), target = await row();
  expect(local.phase).toBe('SUCCEEDED'); expect(local.remoteOperationId).not.toBe(body.operationId);
  expect(await RemoteOperation.findOne({ operationId: local.remoteOperationId }).lean()).toMatchObject({ state: 'COMMITTED' });
  expect(target.activeCompletionOperation).toBeUndefined(); expect(target.completionPending).toBeUndefined();
  expect(received.map(r => r.action)).toEqual(['prepare', 'commit']);
  expect(received.every(r => r.body.operationId === local.remoteOperationId)).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/remoteOperationId|commandHash|completionPending/);
  const count = received.length; time += 1000;
  expect(await complete(body, child)).toEqual(result); expect(await row()).toEqual(target); expect(received).toHaveLength(count);
});

test.each(['prepare', 'commit', 'abort', 'status', 'unbind'].flatMap(action => [
  [action, {}], [action, { 'x-service-token': 'incorrect-synthetic-token' }],
  [action, { authorization: 'Bearer synthetic-user-token', 'x-user-id': 'a'.repeat(24), 'x-user-role': 'parent' }]
]))('%s rejects missing, incorrect or user credentials %p before parsing the command', async (action, headers) => {
  const response = await post(action, { invalid: true }, headers);
  expect(response.status).toBe(401);
  expect(response.data).toMatchObject({ success: false, error: { code: 'INVALID_SERVICE_CREDENTIAL', details: [] } });
  expect(JSON.stringify(response.data)).not.toContain(TOKEN);
  expect(await RemoteOperation.countDocuments()).toBe(0); expect(await Reference.countDocuments()).toBe(0);
});

test.each(['prepare', 'commit', 'abort', 'status', 'unbind'])('%s returns the shared validation envelope for authorized invalid commands', async action => {
  const response = await post(action, { invalid: true });
  expect(response.status).toBe(400);
  expect(response.data).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR', details: [] } });
  expect(await RemoteOperation.countDocuments()).toBe(0); expect(await Reference.countDocuments()).toBe(0);
});

test('status is read-only and abort persists ABSENT terminal evidence over HTTP', async () => {
  const body = wire();
  const before = await post('status', { ...body, mode: 'operation' });
  expect(before.status).toBe(200); expect(before.data.data.operation.state).toBe('ABSENT');
  expect(await RemoteOperation.countDocuments()).toBe(0);
  const aborted = await post('abort', body);
  expect(aborted.status).toBe(200);
  expect(aborted.data.data.operation).toMatchObject({ operationId: body.operationId, state: 'ABORTED',
    commandHash: body.commandHash, failureCode: 'MEDIA_OPERATION_ABORTED', leaseExpiresAt: null, leaseExpired: null });
  const terminal = await RemoteOperation.find().lean();
  expect((await post('commit', body)).data).toEqual(aborted.data);
  expect((await post('prepare', body)).data).toEqual(aborted.data);
  expect(await RemoteOperation.find().lean()).toEqual(terminal); expect(await Reference.countDocuments()).toBe(0);
});

test('stable media refusal is HTTP 200 persisted ABORTED, not an untrusted bare 404', async () => {
  const body = wire();
  const response = await post('prepare', body);
  expect(response.status).toBe(200);
  expect(response.data.data.operation).toMatchObject({ state: 'ABORTED', failureCode: 'RESOURCE_NOT_FOUND' });
  expect(await RemoteOperation.findOne({ operationId: body.operationId }).lean()).toMatchObject({ state: 'ABORTED' });
  expect(await Reference.countDocuments()).toBe(0);
});

test.each(['prepare', 'commit'])('a lost HTTP %s response recovers the same persisted remote operation after restart', async action => {
  const body = command({ completionMediaIds: [await media()] }); dropAction = action;
  await expect(complete(body)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  expect(dropAction).toBeNull(); const before = await op(body);
  expect(before.phase).toBe('PREPUBLISH'); expect((await row()).completionVersion).toBeUndefined();
  service = make();
  const result = await service.recover({ identity: parent, taskId: String(task._id), operationId: body.operationId });
  expect(result.data.task.completionVersion).toBe(1); expect((await op(body)).remoteOperationId).toBe(before.remoteOperationId);
  expect(await RemoteOperation.countDocuments()).toBe(1);
  expect((await row()).activeCompletionOperation).toBeUndefined();
  expect(received.filter(r => r.body.operationId).every(r => r.body.operationId === before.remoteOperationId)).toBe(true);
});

test('expired prepared HTTP command aborts the entire group and replays the same failure', async () => {
  const body = command({ completionMediaIds: [await media(), await media()] }); dropAction = 'prepare';
  await expect(complete(body)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  const local = await op(body); time += 900000;
  await expect(complete(body)).rejects.toMatchObject({ code: 'MEDIA_OPERATION_EXPIRED' });
  expect((await op(body)).phase).toBe('FAILED'); const taskRow = await row();
  expect(taskRow.completionVersion).toBeUndefined(); expect(taskRow.activeCompletionOperation).toBeUndefined();
  expect((await Reference.find().lean()).map(r => r.state)).toEqual(['released', 'released']);
  expect(await RemoteOperation.findOne({ operationId: local.remoteOperationId }).lean()).toMatchObject({ state: 'ABORTED' });
  const count = received.length; await expect(complete(body)).rejects.toMatchObject({ code: 'MEDIA_OPERATION_EXPIRED' });
  expect(received).toHaveLength(count); expect(await row()).toEqual(taskRow);
});

test.each(['SUCCEEDED', 'FAILED'])('different actors reuse a public UUID after %s without aliasing remote history', async phase => {
  const uuid = randomUUID(), firstMedia = await media({ purpose: phase === 'FAILED' ? 'task_attachment' : 'task_completion' });
  const a = command({ operationId: uuid, completionMediaIds: [firstMedia] });
  let first;
  if (phase === 'FAILED') await expect(complete(a, child)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  else first = await complete(a, child);
  const localA = await op(a, child), remoteA = await RemoteOperation.findOne({ operationId: localA.remoteOperationId }).lean();
  expect(localA.phase).toBe(phase);
  const b = command({ operationId: uuid, expectedCompletionVersion: phase === 'FAILED' ? 0 : 1,
    completionMediaIds: [await media()] });
  await complete(b); const localB = await op(b);
  expect(localB.remoteOperationId).not.toBe(localA.remoteOperationId); expect(localB.phase).toBe('SUCCEEDED');
  const afterA = await RemoteOperation.findOne({ operationId: localA.remoteOperationId }).lean();
  // Exact unbind fences the old terminal by incrementing its concurrency version, not changing its outcome.
  const { version, updatedAt, ...history } = remoteA;
  const { version: afterVersion, updatedAt: afterUpdatedAt, ...afterHistory } = afterA;
  expect(afterHistory).toEqual(history); expect(afterVersion).toBe(version + (phase === 'SUCCEEDED' ? 1 : 0));
  if (phase === 'FAILED') expect(afterUpdatedAt).toEqual(updatedAt);
  if (phase === 'SUCCEEDED') expect(await Reference.findOne({ mediaId: firstMedia }).lean())
    .toMatchObject({ state: 'released', operationId: localA.remoteOperationId, releaseOperationId: localB.remoteOperationId });
  expect(await RemoteOperation.countDocuments()).toBe(2);
  const before = await row(), count = received.length;
  if (phase === 'FAILED') await expect(complete(a, child)).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  else expect(await complete(a, child)).toEqual(first);
  expect(await row()).toEqual(before); expect(received).toHaveLength(count);
});

test('wrong service credentials cannot become terminal evidence or clear local intent', async () => {
  service = make('synthetic-wrong-service-token-32-characters');
  const body = command({ completionMediaIds: [await media()] });
  await expect(complete(body)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  const before = await op(body); expect(before.phase).toBe('PREPUBLISH');
  expect(await RemoteOperation.countDocuments()).toBe(0); expect((await row()).activeCompletionOperation).toBeDefined();
  service = make();
  await expect(complete(body)).rejects.toMatchObject({ code: 'MEDIA_OPERATION_ABORTED' });
  expect((await op(body)).remoteOperationId).toBe(before.remoteOperationId);
  expect((await row()).completionVersion).toBeUndefined(); expect((await row()).activeCompletionOperation).toBeUndefined();
});

test('a bare HTTP hash conflict cannot clear an existing prepared intent', async () => {
  const body = command({ completionMediaIds: [await media()] }); dropAction = 'prepare';
  await expect(complete(body)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  const local = await op(body), before = await row();
  const conflict = await post('abort', { ...received[0].body, commandHash: 'f'.repeat(64) });
  expect(conflict.status).toBe(409); expect(conflict.data.success).toBe(false);
  expect(await row()).toEqual(before);
  expect(await RemoteOperation.findOne({ operationId: local.remoteOperationId }).lean()).toMatchObject({ state: 'PREPARED' });
  await complete(body); expect((await row()).completionVersion).toBe(1);
});

test('lost unbind response recovers exact old generation without another publish or remote operation', async () => {
  const a = await media(), b = await media(), first = command({ completionMediaIds: [a] });
  await complete(first); const old = await op(first);
  const replacement = command({ expectedCompletionVersion: 1, completionMediaIds: [b] }); dropAction = 'unbind';
  await expect(complete(replacement)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  const local = await op(replacement), published = await row();
  expect(local.phase).toBe('PUBLISHED_CLEANUP'); expect(published.completionVersion).toBe(2);
  expect(received.find(r => r.action === 'unbind').body).toMatchObject({ operationId: local.remoteOperationId,
    references: [{ mediaId: a, bindingOperationId: old.remoteOperationId }] });
  const released = await Reference.findOne({ mediaId: a }).lean();
  expect(released.state).toBe('released'); received = []; time += 1000; service = make();
  await complete(replacement);
  expect(received.map(r => r.action)).toEqual(['status']);
  expect(await Reference.findOne({ mediaId: a }).lean()).toEqual(released);
  expect((await row()).completedAt).toEqual(published.completedAt); expect((await row()).completionVersion).toBe(2);
  expect((await row()).activeCompletionOperation).toBeUndefined(); expect(await RemoteOperation.countDocuments()).toBe(2);
});

test.each([false, true])('real deletion proof crosses HTTP and recovers committed media (retention=%s)', async cleaned => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'completion-http-'));
  const store = createPrivateMediaStore({ root: path.join(root, 'media') });
  const journal = createMediaDeletionJournal({ root: path.join(root, 'journal') });
  const stored = await store.writeCanonical(Buffer.from('synthetic-image'));
  const mediaId = await media({ storageKey: stored.storageKey });
  const body = command({ completionMediaIds: [mediaId] }); dropAction = 'commit';
  await expect(complete(body)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  const local = await op(body);
  const options = { transactionRunner: runner, now: () => time, mediaStore: store, journal };
  await createCompletionMediaPrivacyService(options).deleteMedia({ identity: parent, mediaId });
  if (cleaned) { time += 31 * 86400000; expect((await createCompletionMediaCleanupService(options).cleanupDeletedMedia()).cleaned).toBe(1); }
  const request = { ...received.find(r => r.action === 'commit').body, mode: 'operation' };
  const response = await post('status', request);
  expect(response.status).toBe(200);
  expect(response.data.data.references[0]).toMatchObject({ state: cleaned ? 'absent' : 'released',
    privacyDeletion: { mediaId, resourceId: String(task._id), bindingOperationId: local.remoteOperationId,
      deletedAt: '2026-10-22T00:00:00.000Z', releasedAt: '2026-10-22T00:00:00.000Z' } });
  const result = await complete(body);
  expect(result.data.task.completionMediaIds).toEqual([mediaId]); expect((await op(body)).phase).toBe('SUCCEEDED');
  expect((await row()).activeCompletionOperation).toBeUndefined(); expect(await Asset.countDocuments({ status: 'active' })).toBe(0);
  expect(await Receipt.countDocuments()).toBe(1); expect(await Tombstone.countDocuments()).toBe(1);
});

test('HTTP factory fails closed if credential or any protocol method is missing', () => {
  expect(() => createCompletionMediaReferencesRouter({ operationService: remote })).toThrow();
  for (const method of ['prepare', 'commit', 'abort', 'status', 'unbind']) {
    const incomplete = { ...remote }; delete incomplete[method];
    expect(() => createCompletionMediaReferencesRouter({ credential: createMediaReferenceCredential(TOKEN), operationService: incomplete })).toThrow();
  }
});

test('completion router rejects legacy attachment fields without mutating the old protocol', async () => {
  const body = wire({ references: [{ mediaId: await media({ purpose: 'task_attachment' }), field: 'attachmentMediaIds' }] });
  const response = await post('prepare', body);
  expect(response.status).toBe(400); expect(response.data.error.code).toBe('VALIDATION_ERROR');
  expect(await RemoteOperation.countDocuments()).toBe(0); expect(await Reference.countDocuments()).toBe(0);
});

test.each(['sync', 'async'])('provider %s failure uses the shared error handler without leaking internals', async kind => {
  const original = remote.prepare;
  remote.prepare = kind === 'sync'
    ? () => { throw Error('synthetic-internal-detail'); }
    : async () => { throw Error('synthetic-internal-detail'); };
  try {
    const response = await post('prepare', wire());
    expect(response.status).toBe(500);
    expect(response.data).toMatchObject({ success: false, error: { code: 'INTERNAL_ERROR', details: [] } });
    expect(JSON.stringify(response.data)).not.toMatch(/synthetic-internal-detail|stack|synthetic-completion-http-token/);
    expect(await RemoteOperation.countDocuments()).toBe(0);
  } finally { remote.prepare = original; }
});

test('non-POST requests cannot mutate or inspect completion operations', async () => {
  for (const action of ['prepare', 'commit', 'abort', 'status', 'unbind']) {
    const response = await http.get(url + PREFIX + '/' + action,
      { headers: { 'x-service-token': TOKEN }, validateStatus: () => true });
    expect(response.status).toBe(404);
  }
  expect(await RemoteOperation.countDocuments()).toBe(0); expect(await Reference.countDocuments()).toBe(0);
});
