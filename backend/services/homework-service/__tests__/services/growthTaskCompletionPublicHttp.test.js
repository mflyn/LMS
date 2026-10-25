const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const { createIdentityHeaders } = require('../../../../common/middleware/gatewayIdentity');
const { errorHandler } = require('../../../../common/middleware/errorHandler');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');
const { createCompletionMediaReferenceClient } = require('../../../../common/services/mediaReferenceClient');
const { createCompletionMediaReferencesRouter } = require('../../../resource-service/routes/completionMediaReferences');
const { createMediaReferenceCredential } = require('../../../resource-service/middleware/mediaReferenceCredential');
const { createMediaReferenceOperationService } = require('../../../resource-service/services/mediaReferenceOperationService');
const { createGrowthTaskCompletionService } = require('../../services/growthTaskCompletionService');
const { createGrowthTaskCompletionConfirmationService } = require('../../services/growthTaskCompletionConfirmationService');
const Task = require('../../models/GrowthTask');
const Operation = require('../../models/GrowthTaskCompletionOperation');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const Asset = require('../../../resource-service/models/MediaAsset');
const Reference = require('../../../resource-service/models/MediaReference');
const RemoteOperation = require('../../../resource-service/models/MediaReferenceOperation');
const Receipt = require('../../../resource-service/models/MediaDeletionReceipt');
const Tombstone = require('../../../resource-service/models/MediaDeletionTombstone');

const TOKEN = 'synthetic-public-http-service-token-32-characters';
const PREFIX = '/api/growth-tasks';
const id = () => String(new mongoose.Types.ObjectId());
const runner = work => runMongoTransaction({ mongooseInstance: mongoose, work });
const http = axios.create({ proxy: false, timeout: 3000, maxRedirects: 0, validateStatus: () => true });
const hidden = '+activeCompletionOperation +completionPending +completionMediaBindings';
let servers, base, remote, completion, confirmation, parent, coparent, child, sibling, outsider, family, task;
let dropPublic, dropRemote, starLost, ledger, award, remoteCalls, createRouter;
const appForTest = () => {
  const app = express(); app.locals.logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  app.use(express.json()); return app;
};
const listen = async app => {
  const server = await new Promise((resolve, reject) => {
    const socket = app.listen(0, '127.0.0.1', () => resolve(socket)); socket.once('error', reject);
  });
  servers.push(server); return 'http://127.0.0.1:' + server.address().port;
};
const headers = (action, identity = child, extra = {}) => createIdentityHeaders({
  method: 'PATCH', originalUrl: `${PREFIX}/${task._id}/${action}`, user: identity,
  secret: process.env.GATEWAY_IDENTITY_SECRET, ...extra
});
const patch = (action, body, identity = child, override) => http.patch(`${base}${PREFIX}/${task._id}/${action}`,
  body, { headers: override || headers(action, identity) });
const command = (extra = {}) => ({ operationId: randomUUID(), expectedCompletionVersion: 0,
  expectedChecklistVersion: 0, checkedItemIds: [], completionMediaIds: [], ...extra });
const media = async (extra = {}) => String((await Asset.create({ familyId: family._id, childId: child.id,
  uploadedBy: child.id, purpose: 'task_completion', mimeType: 'image/jpeg', sizeBytes: 1,
  storageKey: randomUUID(), ...extra }))._id);
const row = () => Task.findById(task._id).select(hidden).lean();
const expectError = (response, status, code) => {
  expect(response.status).toBe(status);
  expect(response.data).toMatchObject({ success: false, error: { code, details: [] } });
  expect(typeof response.data.error.message).toBe('string');
  expect(JSON.stringify(response.data)).not.toMatch(/remoteOperationId|commandHash|completionPending|bindingOperationId/);
  expect(JSON.stringify(response.data)).not.toContain(TOKEN);
};
beforeAll(async () => {
  for (const model of [Task, Operation, Family, User, Asset, Reference, RemoteOperation, Receipt, Tombstone]) await model.init();
});
beforeEach(async () => {
  servers = []; dropPublic = null; dropRemote = null; starLost = false; ledger = new Map(); remoteCalls = [];
  ({ createGrowthTaskCompletionRouter: createRouter } = require('../../routes/growthTaskCompletion'));
  parent = { id: id(), role: 'parent' }; coparent = { id: id(), role: 'parent' }; outsider = { id: id(), role: 'parent' };
  child = { id: id(), role: 'student', tokenVersion: 0 }; sibling = { id: id(), role: 'student', tokenVersion: 0 };
  family = await Family.create({ familyName: 'Synthetic public HTTP', ownerParentId: parent.id,
    memberParentIds: [parent.id, coparent.id], childIds: [child.id, sibling.id] });
  for (const user of [child, sibling]) Object.assign(user, { childId: user.id, familyId: String(family._id) });
  await User.collection.insertMany([parent, coparent, outsider, child, sibling].map(user => ({
    _id: new mongoose.Types.ObjectId(user.id), role: user.role, username: user.id, email: user.id + '@example.test',
    ...(user.role === 'student' ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {})
  })));
  task = await Task.create({ familyId: family._id, childId: child.id, createdByParentId: parent.id,
    dimension: 'academic', title: 'Synthetic HTTP contract', taskType: 'practice', dueDate: '2026-10-22' });
  remote = createMediaReferenceOperationService({ transactionRunner: runner });
  const resource = appForTest();
  resource.use((req, res, next) => {
    const action = req.path.split('/').pop(); remoteCalls.push({ action, body: req.body });
    const json = res.json;
    res.json = function send(body) {
      if (dropRemote === action && body.success) { dropRemote = null; this.destroy(); return this; }
      return json.call(this, body);
    }; next();
  });
  resource.use('/api/internal/media/references', createCompletionMediaReferencesRouter({
    credential: createMediaReferenceCredential(TOKEN), operationService: remote
  }));
  resource.use(errorHandler);
  const resourceUrl = await listen(resource);
  // The client must reject HTTP errors, unlike the assertion transport above.
  const mediaClient = createCompletionMediaReferenceClient({ resourceServiceUrl: resourceUrl, serviceToken: TOKEN,
    axiosInstance: axios.create({ proxy: false, timeout: 3000 }) });
  completion = createGrowthTaskCompletionService({ transactionRunner: runner, mediaReferenceClient: mediaClient });
  award = jest.fn(async input => {
    const repeated = ledger.has(input.taskId);
    if (!ledger.has(input.taskId)) ledger.set(input.taskId, { awarded: true, ledgerEntryId: id(), starBalance: 1 });
    if (starLost) { starLost = false; throw Error('Synthetic lost star acknowledgement'); }
    return { ...ledger.get(input.taskId), awarded: !repeated };
  });
  confirmation = createGrowthTaskCompletionConfirmationService({ transactionRunner: runner, awardTaskStar: award });
  const homework = appForTest();
  homework.use((req, res, next) => {
    const json = res.json;
    res.json = function send(body) {
      if (dropPublic === req.path.split('/').pop() && body.success) { dropPublic = null; this.destroy(); return this; }
      return json.call(this, body);
    }; next();
  });
  homework.use(PREFIX, createRouter({ completionService: completion, confirmationService: confirmation }));
  homework.use(errorHandler); base = await listen(homework);
});
afterEach(async () => {
  for (const server of servers || []) {
    server.closeAllConnections(); await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
  }
  jest.restoreAllMocks();
});

test.each(['complete', 'confirm'])('%s rejects unsigned identities before invoking services', async action => {
  const spy = jest.spyOn(action === 'complete' ? completion : confirmation, action);
  const before = await row();
  expectError(await patch(action, { invalid: true }, child, { 'x-user-id': parent.id, 'x-user-role': 'parent' }),
    401, 'INVALID_IDENTITY_ENVELOPE');
  expect(spy).not.toHaveBeenCalled(); expect(await row()).toEqual(before);
  expect(remoteCalls).toHaveLength(0); expect(award).not.toHaveBeenCalled();
});

test.each(['complete', 'confirm'])('%s enforces method/path signature and expiry', async action => {
  const signed = headers(action, parent);
  expectError(await patch(action, {}, parent, { ...signed, 'x-user-role': 'student' }), 401, 'INVALID_IDENTITY_ENVELOPE');
  expectError(await patch(action, {}, parent, headers(action, parent, { now: Date.now() - 360000 })), 401, 'IDENTITY_ENVELOPE_EXPIRED');
  const wrongTarget = createIdentityHeaders({ method: 'PATCH', originalUrl: '/api/growth-tasks/other/complete',
    user: parent, secret: process.env.GATEWAY_IDENTITY_SECRET });
  expectError(await patch(action, {}, parent, wrongTarget), 401, 'INVALID_IDENTITY_ENVELOPE');
  expectError(await patch(action, {}, parent, headers(action, parent, { method: 'POST' })), 401, 'INVALID_IDENTITY_ENVELOPE');
  expect(await Operation.countDocuments()).toBe(0);
});

test('stale child token is rejected by real authentication before completion', async () => {
  await User.updateOne({ _id: child.id }, { $set: { 'childProfile.tokenVersion': 1 } });
  expectError(await patch('complete', command()), 401, 'STALE_CHILD_TOKEN');
  expect(await Operation.countDocuments()).toBe(0); expect(remoteCalls).toHaveLength(0);
});

test.each(['outsider', 'sibling', 'departed'])('%s cannot write or probe command validation', async kind => {
  if (kind === 'departed') await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: coparent.id } });
  const identity = kind === 'outsider' ? outsider : kind === 'sibling' ? sibling : coparent;
  for (const action of ['complete', 'confirm']) expectError(await patch(action, { invalid: true }, identity), 403, 'CHILD_ACCESS_DENIED');
  expect(await Operation.countDocuments()).toBe(0); expect(remoteCalls).toHaveLength(0); expect(award).not.toHaveBeenCalled();
});

test('child cannot confirm even its own completed task', async () => {
  expect((await patch('complete', command())).status).toBe(200);
  expectError(await patch('confirm', { expectedCompletionVersion: 1 }), 403, 'CHILD_ACCESS_DENIED');
  expect(award).not.toHaveBeenCalled(); expect((await row()).status).toBe('completed');
});

test.each([
  ['missing contract', () => ({}), 'CLIENT_UPGRADE_REQUIRED'],
  ['remote identity injection', () => command({ remoteOperationId: randomUUID() }), 'VALIDATION_ERROR'],
  ['actor injection', () => command({ identity: { role: 'parent' } }), 'VALIDATION_ERROR'],
  ['too many media', () => command({ completionMediaIds: Array.from({ length: 11 }, id) }), 'MEDIA_ATTACHMENT_LIMIT_EXCEEDED'],
  ['duplicate media', () => { const m = id(); return command({ completionMediaIds: [m, m] }); }, 'VALIDATION_ERROR'],
  ['unknown checklist', () => command({ checkedItemIds: ['missing'] }), 'CHECKLIST_ITEM_INVALID']
])('complete preserves %s rejection contract', async (_label, body, code) => {
  expectError(await patch('complete', body()), 400, code);
  expect(await Operation.countDocuments()).toBe(0); expect(remoteCalls).toHaveLength(0);
});

test.each([0, 1, 10])('child can complete with %i images and parent confirms the exact version', async count => {
  const ids = []; for (let i = 0; i < count; i += 1) ids.push(await media());
  const result = await patch('complete', command({ completionMediaIds: ids, childNote: 'Synthetic private note' }));
  expect(result.status).toBe(200); expect(result.data).toMatchObject({ success: true, data: { task: {
    completionVersion: 1, completionMediaIds: ids, status: 'completed', parentConfirmed: false
  } } });
  expect(JSON.stringify(result.data)).not.toMatch(/Synthetic private note|remoteOperationId|completionPending|bindingOperationId|commandHash/);
  const accepted = await patch('confirm', { expectedCompletionVersion: 1, parentFeedback: 'Reviewed' }, coparent);
  expect(accepted.status).toBe(200); expect(accepted.data.data.task).toMatchObject({ status: 'confirmed',
    completionVersion: 1, confirmedByParentId: coparent.id, starAwardState: 'awarded' });
  expect(ledger.size).toBe(1); expect(await Reference.countDocuments({ state: 'bound' })).toBe(count);
});

test('old version confirmation fails without star side effects', async () => {
  expect((await patch('complete', command())).status).toBe(200);
  expectError(await patch('confirm', { expectedCompletionVersion: 0 }, parent), 409, 'VERSION_CONFLICT');
  expect(award).not.toHaveBeenCalled();
});

test.each(['complete', 'confirm'])('%s public success response loss is safely replayed', async action => {
  const body = command({ completionMediaIds: [await media()] });
  if (action === 'confirm') expect((await patch('complete', body)).status).toBe(200);
  const payload = action === 'complete' ? body : { expectedCompletionVersion: 1, parentFeedback: 'First' };
  const identity = action === 'complete' ? child : parent;
  dropPublic = action;
  await expect(patch(action, payload, identity)).rejects.toMatchObject({ code: 'ECONNRESET' });
  expect(dropPublic).toBeNull();
  const before = await row(), calls = remoteCalls.length, awards = award.mock.calls.length;
  expect(before.status).toBe(action === 'complete' ? 'completed' : 'confirmed');
  const replay = await patch(action, payload, identity);
  expect(replay.status).toBe(200); expect(replay.data.data.task.completionVersion).toBe(1);
  expect(await row()).toEqual(before); expect(remoteCalls).toHaveLength(calls); expect(award).toHaveBeenCalledTimes(awards);
  if (action === 'complete') {
    const stored = (await Operation.findOne({ taskId: task._id }).lean()).successResponse;
    expect(replay.data).toEqual(JSON.parse(JSON.stringify(stored)));
  }
});

test.each(['prepare', 'commit'])('remote %s response loss returns 503 and same public PATCH resumes original mapping', async action => {
  const body = command({ completionMediaIds: [await media()] }); dropRemote = action;
  expectError(await patch('complete', body), 503, 'MEDIA_REFERENCE_PENDING');
  const op = await Operation.findOne({ taskId: task._id }).lean();
  expect(op.phase).toBe('PREPUBLISH'); expect(dropRemote).toBeNull();
  expect(await RemoteOperation.findOne({ operationId: op.remoteOperationId }).lean())
    .toMatchObject({ state: action === 'prepare' ? 'PREPARED' : 'COMMITTED' });
  expectError(await patch('confirm', { expectedCompletionVersion: 0 }, parent), 503, 'MEDIA_REFERENCE_PENDING');
  expectError(await patch('complete', { ...body, childNote: 'Changed' }), 409, 'IDEMPOTENCY_KEY_REUSED');
  expect((await patch('complete', body)).status).toBe(200);
  const recovered = await row();
  expect(recovered.completionVersion).toBe(1);
  expect(recovered.completionMediaReferenceState).toBe('stable');
  expect(recovered.activeCompletionOperation).toBeUndefined(); expect(recovered.completionPending).toBeUndefined();
  expect(await Operation.findOne({ taskId: task._id }).lean()).toMatchObject({ phase: 'SUCCEEDED', remoteOperationId: op.remoteOperationId });
  expect(await RemoteOperation.findOne({ operationId: op.remoteOperationId }).lean()).toMatchObject({ state: 'COMMITTED' });
  expect(recovered.completionMediaBindings.map(ref => ({ mediaId: String(ref.mediaId), bindingOperationId: ref.bindingOperationId })))
    .toEqual(body.completionMediaIds.map(mediaId => ({ mediaId, bindingOperationId: op.remoteOperationId })));
  const references = await Reference.find({ resourceId: task._id, field: 'completionMediaIds' }).lean();
  expect(references).toHaveLength(body.completionMediaIds.length);
  expect(references.map(ref => String(ref.mediaId)).sort()).toEqual([...body.completionMediaIds].sort());
  expect(references.every(ref => ref.state === 'bound' && ref.operationId === op.remoteOperationId)).toBe(true);
  expect(await Operation.countDocuments()).toBe(1);
  expect(remoteCalls.every(call => call.body.operationId === op.remoteOperationId)).toBe(true);
});

test('co-parent resumes unknown star outcome without replacing first confirmation audit', async () => {
  expect((await patch('complete', command())).status).toBe(200); starLost = true;
  expectError(await patch('confirm', { expectedCompletionVersion: 1, parentFeedback: 'First' }, parent), 503, 'STAR_AWARD_PENDING');
  const before = await row(); expect(before.starAwardState).toBe('pending'); expect(ledger.size).toBe(1);
  const result = await patch('confirm', { expectedCompletionVersion: 1, parentFeedback: 'Must not overwrite' }, coparent);
  expect(result.status).toBe(200); expect(result.data.data.task).toMatchObject({ confirmedByParentId: parent.id,
    confirmedAt: before.confirmedAt.toISOString(), parentFeedback: 'First', starAwardState: 'awarded' });
  const after = await row();
  expect(after.confirmedByParentId).toEqual(before.confirmedByParentId);
  expect(after.confirmedAt).toEqual(before.confirmedAt); expect(after.parentFeedback).toBe(before.parentFeedback);
  expect(after.starAwardState).toBe('awarded'); expect(result.data.data.starAward.awarded).toBe(false);
  expect(ledger.size).toBe(1); expect(award).toHaveBeenLastCalledWith(expect.objectContaining({ confirmedByParentId: coparent.id }));
});

test('terminal completion replay stays immutable after confirmation and still requires current membership', async () => {
  const body = command(), first = await patch('complete', body, coparent);
  expect(first.status).toBe(200);
  expect((await patch('confirm', { expectedCompletionVersion: 1 }, parent)).status).toBe(200);
  const confirmed = await row();
  expect((await patch('complete', body, coparent)).data).toEqual(first.data); expect(await row()).toEqual(confirmed);
  expectError(await patch('complete', command({ expectedCompletionVersion: 1 })), 409, 'TASK_STATE_CONFLICT');
  await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: coparent.id } });
  expectError(await patch('complete', body, coparent), 403, 'CHILD_ACCESS_DENIED');
});

test('legacy completed task confirms version zero without inventing completion media', async () => {
  await Task.updateOne({ _id: task._id }, { $set: { status: 'completed', completedAt: new Date() } });
  const result = await patch('confirm', { expectedCompletionVersion: 0 }, parent);
  expect(result.status).toBe(200); expect(result.data.data.task).toMatchObject({ completionVersion: 0, completionMediaIds: [] });
  expect(remoteCalls).toHaveLength(0);
});

test('factory rejects partial dependencies and never exposes a recover or read endpoint', async () => {
  expect(() => createRouter()).toThrow();
  expect(() => createRouter({ completionService: completion })).toThrow();
  expect(() => createRouter({ completionService: {}, confirmationService: confirmation })).toThrow();
  for (const suffix of ['', '/recover']) {
    const response = await http.get(`${base}${PREFIX}/${task._id}${suffix}`); expect(response.status).toBe(404);
  }
  expect((await http.post(`${base}${PREFIX}/${task._id}/recover`, {})).status).toBe(404);
});

test.each(['complete', 'confirm'])('%s preserves absent-task authorization and rejects reused identity envelopes', async action => {
  const signed = headers(action, parent);
  expectError(await patch(action, {}, parent, signed), 400, 'CLIENT_UPGRADE_REQUIRED');
  expectError(await patch(action, {}, parent, signed), 401, 'IDENTITY_ENVELOPE_REPLAYED');
  task = { _id: new mongoose.Types.ObjectId() };
  expectError(await patch(action, {}, parent), 403, 'CHILD_ACCESS_DENIED');
  expect(await Operation.countDocuments()).toBe(0); expect(award).not.toHaveBeenCalled();
});

test.each([
  ['missing version', {}, 'CLIENT_UPGRADE_REQUIRED'],
  ['wrong type', { expectedCompletionVersion: '0' }, 'VALIDATION_ERROR'],
  ['negative version', { expectedCompletionVersion: -1 }, 'VALIDATION_ERROR'],
  ['remote identity', { expectedCompletionVersion: 0, remoteOperationId: randomUUID() }, 'VALIDATION_ERROR']
])('confirm rejects %s without writes', async (_label, body, code) => {
  const before = await row();
  expectError(await patch('confirm', body, parent), 400, code);
  expect(await row()).toEqual(before); expect(award).not.toHaveBeenCalled();
});

test.each(['purpose', 'child', 'deleted'])('media %s refusal is a stable opaque HTTP error with no completion publication', async kind => {
  const extra = kind === 'purpose' ? { purpose: 'task_attachment' }
    : kind === 'child' ? { childId: sibling.id } : { status: 'deleted', deletedAt: new Date() };
  const body = command({ completionMediaIds: [await media(extra)] });
  expectError(await patch('complete', body), 404, 'RESOURCE_NOT_FOUND');
  expect((await row()).status).toBe('pending'); expect((await row()).activeCompletionOperation).toBeUndefined();
  const local = await Operation.findOne({ taskId: task._id }).lean(); expect(local.phase).toBe('FAILED');
  expect(await RemoteOperation.findOne({ operationId: local.remoteOperationId }).lean()).toMatchObject({ state: 'ABORTED' });
  const calls = remoteCalls.length;
  expectError(await patch('complete', body), 404, 'RESOURCE_NOT_FOUND'); expect(remoteCalls).toHaveLength(calls);
});

test.each(['sync', 'async'])('unexpected %s service errors reach the real error handler without leaking details', async kind => {
  const spy = jest.spyOn(completion, 'complete');
  const cause = Error(TOKEN + ' synthetic private failure');
  if (kind === 'sync') spy.mockImplementationOnce(() => { throw cause; });
  else spy.mockRejectedValueOnce(cause);
  expectError(await patch('complete', command()), 500, 'INTERNAL_ERROR');
  expect(await Operation.countDocuments()).toBe(0); expect(remoteCalls).toHaveLength(0);
});

test('two authorized actors reuse one public UUID without sharing a remote operation', async () => {
  const operationId = randomUUID();
  const first = command({ operationId, completionMediaIds: [await media()] });
  const a = await patch('complete', first, child); expect(a.status).toBe(200);
  const second = command({ operationId, expectedCompletionVersion: 1, completionMediaIds: [await media()] });
  const b = await patch('complete', second, coparent); expect(b.status).toBe(200);
  const ops = await Operation.find({ taskId: task._id }).lean();
  expect(ops).toHaveLength(2); expect(new Set(ops.map(op => op.remoteOperationId)).size).toBe(2);
  expect(ops.every(op => op.phase === 'SUCCEEDED' && op.operationId === operationId)).toBe(true);
  const stable = await row(), calls = remoteCalls.length;
  expect((await patch('complete', first, child)).data).toEqual(a.data);
  expect(await row()).toEqual(stable); expect(stable.completionVersion).toBe(2); expect(remoteCalls).toHaveLength(calls);
});
