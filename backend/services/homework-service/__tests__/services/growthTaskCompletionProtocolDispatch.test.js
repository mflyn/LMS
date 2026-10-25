const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const { createMediaReferenceProtocolRouter } = require('../../../resource-service/routes/mediaReferenceProtocolRouter');
const { createMediaReferenceCredential } = require('../../../resource-service/middleware/mediaReferenceCredential');
const { createMediaReferenceService } = require('../../../resource-service/services/mediaReferenceService');
const { createMediaReferenceOperationService } = require('../../../resource-service/services/mediaReferenceOperationService');
const { createMediaReferenceClient, createCompletionMediaReferenceClient } = require('../../../../common/services/mediaReferenceClient');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');
const { errorHandler } = require('../../../../common/middleware/errorHandler');
const Asset = require('../../../resource-service/models/MediaAsset');
const Reference = require('../../../resource-service/models/MediaReference');
const RemoteOperation = require('../../../resource-service/models/MediaReferenceOperation');
const Receipt = require('../../../resource-service/models/MediaDeletionReceipt');
const Tombstone = require('../../../resource-service/models/MediaDeletionTombstone');
const Task = require('../../models/GrowthTask');
const LocalOperation = require('../../models/GrowthTaskCompletionOperation');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const { createGrowthTaskCompletionService } = require('../../services/growthTaskCompletionService');
const { createGrowthTaskAttachmentMediaService } = require('../../services/growthTaskAttachmentMediaService');

const TOKEN = 'synthetic-dispatch-service-token-32-characters';
const PREFIX = '/api/internal/media/references';
const id = () => String(new mongoose.Types.ObjectId());
const runner = work => runMongoTransaction({ mongooseInstance: mongoose, work });
const http = axios.create({ proxy: false, timeout: 3000 });
let server, url, legacy, completion, scope, oldClient, newClient, time, dropMaterialCommit, materialRequests;
const wire = (extra = {}) => ({ ...scope, resourceType: 'growth_task', operationId: randomUUID(),
  commandHash: 'a'.repeat(64), references: [{ mediaId: id(), field: 'completionMediaIds' }], ...extra });
const clientCommand = ({ operationId, ...body }) => ({ ...body, remoteOperationId: operationId });
const post = (action, body, token = TOKEN) => http.post(url + PREFIX + '/' + action, body,
  { headers: token ? { 'x-service-token': token } : {}, validateStatus: () => true });
const media = async purpose => String((await Asset.create({ familyId: scope.familyId, childId: scope.childId,
  uploadedBy: scope.childId, purpose, mimeType: 'image/jpeg', sizeBytes: 1, storageKey: randomUUID() }))._id);
beforeAll(async () => { for (const model of [Asset, Reference, RemoteOperation, Receipt, Tombstone, Task, LocalOperation, Family, User]) await model.init(); });
beforeEach(async () => {
  dropMaterialCommit = false; materialRequests = [];
  time = Date.parse('2026-10-22T00:00:00Z');
  scope = { familyId: id(), childId: id(), resourceId: id() };
  legacy = createMediaReferenceService({ transactionRunner: runner, now: () => time });
  completion = createMediaReferenceOperationService({ transactionRunner: runner, now: () => time });
  for (const action of ['prepare', 'commit', 'unbind']) jest.spyOn(legacy, action);
  for (const action of ['prepare', 'commit', 'unbind', 'status', 'abort']) jest.spyOn(completion, action);
  const app = express(); app.locals.logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  app.use(express.json());
  app.use((req, res, next) => {
    const isMaterial = Array.isArray(req.body?.references)
      && req.body.references.length > 0 && req.body.references.every(ref => ref && ref.field === 'attachmentMediaIds');
    if (isMaterial) materialRequests.push({ action: req.path.split('/').pop(), body: req.body });
    const send = res.json;
    res.json = function json(body) {
      // Drop only a successful response, after the real provider's transaction committed.
      if (dropMaterialCommit && isMaterial && req.path.endsWith('/commit') && body.success) {
        dropMaterialCommit = false; this.destroy(); return this;
      }
      return send.call(this, body);
    };
    next();
  });
  app.use(PREFIX, createMediaReferenceProtocolRouter({ credential: createMediaReferenceCredential(TOKEN),
    referenceService: legacy, operationService: completion }));
  app.use(errorHandler);
  server = await new Promise((resolve, reject) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); listening.once('error', reject);
  });
  url = 'http://127.0.0.1:' + server.address().port;
  const options = { axiosInstance: http, resourceServiceUrl: url, serviceToken: TOKEN };
  oldClient = createMediaReferenceClient(options); newClient = createCompletionMediaReferenceClient(options);
});
afterEach(async () => {
  if (server) { server.closeAllConnections(); await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve())); server = null; }
  jest.restoreAllMocks();
});
const expectNoDispatch = () => {
  for (const action of ['prepare', 'commit', 'unbind']) expect(legacy[action]).not.toHaveBeenCalled();
  for (const action of ['prepare', 'commit', 'unbind', 'status', 'abort']) expect(completion[action]).not.toHaveBeenCalled();
};

test.each(['prepare', 'commit', 'unbind', 'status', 'abort'])('%s authenticates before protocol classification', async action => {
  const response = await post(action, { invalid: true }, null);
  expect(response.status).toBe(401); expect(response.data.error.code).toBe('INVALID_SERVICE_CREDENTIAL'); expectNoDispatch();
});

test.each([
  ['growth_task', 'attachmentMediaIds', 'task_attachment'], ['child', 'avatarMediaId', 'avatar'],
  ['family_mistake', 'questionMediaId', 'mistake_question'], ['family_mistake', 'childAnswerMediaId', 'mistake_answer']
])('legacy %s.%s retains the array client contract without creating an operation', async (resourceType, field, purpose) => {
  const body = { ...scope, resourceType, operationId: randomUUID(), references: [{ mediaId: await media(purpose), field }] };
  expect(await oldClient.prepare(body)).toMatchObject([{ field, state: 'prepared' }]);
  expect(await oldClient.commit(body)).toMatchObject([{ field, state: 'bound' }]);
  expect(await oldClient.unbind({ ...body, operationId: randomUUID(), references: body.references.map(ref =>
    ({ ...ref, bindingOperationId: body.operationId })) })).toMatchObject([{ field, state: 'released' }]);
  expect(await RemoteOperation.countDocuments()).toBe(0); expect(completion.prepare).not.toHaveBeenCalled();
  expect(await Reference.countDocuments({ state: 'released' })).toBe(1);
});

test('completion uses the full operation contract and exact generation while legacy material bindings remain intact', async () => {
  const material = { ...scope, resourceType: 'growth_task', operationId: randomUUID(),
    references: [{ mediaId: await media('task_attachment'), field: 'attachmentMediaIds' }] };
  await oldClient.prepare(material); await oldClient.commit(material);
  const body = wire({ references: [{ mediaId: await media('task_completion'), field: 'completionMediaIds' }] });
  expect((await newClient.prepare(clientCommand(body))).operation.state).toBe('PREPARED');
  expect((await newClient.commit(clientCommand(body))).operation.state).toBe('COMMITTED');
  expect((await newClient.status({ ...clientCommand(body), mode: 'operation' })).operation.state).toBe('COMMITTED');
  const { commandHash: _commandHash, ...unbind } = { ...body, operationId: randomUUID(),
    references: body.references.map(ref => ({ ...ref, bindingOperationId: body.operationId })) };
  expect((await newClient.unbind(clientCommand(unbind))).references).toMatchObject([{ state: 'released', bindingOperationId: body.operationId }]);
  expect(await Reference.countDocuments({ field: 'attachmentMediaIds', state: 'bound' })).toBe(1);
  expect(await Reference.countDocuments({ field: 'completionMediaIds', state: 'released' })).toBe(1);
  expect(legacy.prepare).toHaveBeenCalledTimes(1); expect(completion.prepare).toHaveBeenCalledTimes(1);
});

test('completion abort persists terminal evidence and never falls back to the legacy provider', async () => {
  const body = clientCommand(wire()); expect((await newClient.abort(body)).operation.state).toBe('ABORTED');
  expect((await newClient.prepare(body)).operation.state).toBe('ABORTED');
  expect(legacy.prepare).not.toHaveBeenCalled(); expect(await Reference.countDocuments()).toBe(0);
});

test.each([
  ['mixed completion first', [{ field: 'completionMediaIds' }, { field: 'attachmentMediaIds' }], 'growth_task'],
  ['mixed legacy first', [{ field: 'attachmentMediaIds' }, { field: 'completionMediaIds' }], 'growth_task'],
  ['unknown field', [{ field: 'unknown' }], 'growth_task'],
  ['wrong resource type', [{ field: 'completionMediaIds' }], 'child'],
  ['null reference', [null], 'growth_task'], ['empty references', [], 'growth_task']
])('%s rejects before either provider and writes nothing', async (name, references, resourceType) => {
  const response = await post('prepare', wire({ resourceType, references: references.map(ref => ref && { mediaId: id(), ...ref }) }));
  expect(response.status).toBe(400); expect(response.data.error.code).toBe('VALIDATION_ERROR'); expectNoDispatch();
  expect(await RemoteOperation.countDocuments()).toBe(0); expect(await Reference.countDocuments()).toBe(0);
});

test.each(['commandHash', 'mode', 'remoteOperationId'])('legacy field cannot downgrade a command containing %s', async key => {
  const body = { ...scope, resourceType: 'growth_task', operationId: randomUUID(),
    references: [{ mediaId: await media('task_attachment'), field: 'attachmentMediaIds' }], [key]: 'a'.repeat(64) };
  expect((await post('prepare', body)).status).toBe(400); expectNoDispatch();
  expect(await Reference.countDocuments()).toBe(0);
});
test.each(['status', 'abort'])('legacy %s has no operation protocol fallback', async action => {
  const { commandHash: _commandHash, ...body } = wire({ references: [{ mediaId: id(), field: 'attachmentMediaIds' }] });
  expect((await post(action, body)).status).toBe(400); expectNoDispatch();
});
test('missing completion digest is rejected by the completion provider without fallback', async () => {
  const { commandHash: _commandHash, ...body } = wire();
  expect((await post('prepare', body)).status).toBe(400);
  expect(completion.prepare).toHaveBeenCalledTimes(1); expect(legacy.prepare).not.toHaveBeenCalled();
});

test('real homework material and completion orchestrators exclude each other through the same HTTP dispatcher', async () => {
  const parent = id(), child = { id: scope.childId, childId: scope.childId, familyId: scope.familyId, role: 'student', tokenVersion: 0 };
  await Family.create({ _id: scope.familyId, familyName: 'Synthetic dispatch', ownerParentId: parent,
    memberParentIds: [parent], childIds: [child.id] });
  await User.collection.insertMany([{ _id: new mongoose.Types.ObjectId(parent), role: 'parent', username: parent, email: parent + '@example.test' },
    { _id: new mongoose.Types.ObjectId(child.id), role: 'student', familyId: new mongoose.Types.ObjectId(scope.familyId),
      childProfile: { tokenVersion: 0 }, username: child.id, email: child.id + '@example.test' }]);
  const task = await Task.create({ _id: scope.resourceId, familyId: scope.familyId, childId: scope.childId, createdByParentId: parent,
    dimension: 'academic', title: 'Synthetic shared transport', taskType: 'practice', dueDate: '2026-10-22' });
  const materialService = createGrowthTaskAttachmentMediaService({ GrowthTaskModel: Task, mediaReferenceClient: oldClient,
    randomUUID, logger: { info() {}, warn() {}, error() {} }, completionIsolation: true });
  const completionService = createGrowthTaskCompletionService({ transactionRunner: runner, mediaReferenceClient: newClient });
  const body = { operationId: randomUUID(), expectedCompletionVersion: 0, expectedChecklistVersion: 0,
    checkedItemIds: [], completionMediaIds: [await media('task_completion')] };
  const complete = () => completionService.complete({ identity: child, taskId: String(task._id), body });
  const prepareMaterial = legacy.prepare.getMockImplementation();
  legacy.prepare.mockImplementationOnce(async command => {
    await expect(complete()).rejects.toMatchObject({ statusCode: 503, code: 'MEDIA_REFERENCE_PENDING' });
    return prepareMaterial(command);
  });
  const materialId = await media('task_attachment');
  await materialService.mutate({ task: task._id, attachmentMediaIds: [materialId] });
  const before = await Task.findById(task._id).select('+attachmentMediaBindings').lean();
  const prepareCompletion = completion.prepare.getMockImplementation();
  completion.prepare.mockImplementationOnce(async command => {
    await expect(materialService.mutate({ task: task._id, taskPatch: [{ path: 'title', value: 'Must not publish' }] }))
      .rejects.toMatchObject({ status: 503, code: 'MEDIA_REFERENCE_PENDING' });
    return prepareCompletion(command);
  });
  const response = await complete(); expect(response.data.task.status).toBe('completed');
  const after = await Task.findById(task._id).select('+attachmentMediaBindings +mediaCompletionFence').lean();
  expect(after.title).toBe(before.title); expect(after.attachmentMediaBindings).toEqual(before.attachmentMediaBindings);
  expect(after.mediaCompletionFence).toBeUndefined(); expect(after.completionVersion).toBe(1);
  expect(await Reference.countDocuments({ field: 'attachmentMediaIds', state: 'bound' })).toBe(1);
  expect(await Reference.countDocuments({ field: 'completionMediaIds', state: 'bound' })).toBe(1);
  expect(await RemoteOperation.countDocuments({ state: 'COMMITTED' })).toBe(1);
});

test('dispatcher preserves completion lease terminalization and historical replay', async () => {
  const body = wire({ references: [{ mediaId: await media('task_completion'), field: 'completionMediaIds' }] });
  expect((await newClient.prepare(clientCommand(body))).operation.state).toBe('PREPARED');
  time += 901000;
  const result = await newClient.commit(clientCommand(body));
  expect(result.operation).toMatchObject({ state: 'ABORTED', failureCode: 'MEDIA_OPERATION_EXPIRED' });
  expect(await newClient.prepare(clientCommand(body))).toEqual(result);
  expect(legacy.commit).not.toHaveBeenCalled();
});

test('provider errors do not cause protocol fallback or leak private error details', async () => {
  completion.prepare.mockRejectedValueOnce(Error(TOKEN + ' private synthetic failure'));
  const response = await post('prepare', wire());
  expect(response.status).toBe(500); expect(response.data.success).toBe(false);
  expect(JSON.stringify(response.data)).not.toContain(TOKEN); expect(legacy.prepare).not.toHaveBeenCalled();
});

test('factory rejects incomplete dependencies and non-POST requests do not dispatch', async () => {
  expect(() => createMediaReferenceProtocolRouter()).toThrow();
  expect(() => createMediaReferenceProtocolRouter({ credential: createMediaReferenceCredential(TOKEN), referenceService: legacy })).toThrow();
  const response = await http.get(url + PREFIX + '/status', { validateStatus: () => true });
  expect(response.status).toBe(404); expectNoDispatch();
});

const materialHidden = '+attachmentMediaBindings +mediaBindingOperationId +mediaBindingPhase +mediaCompletionFence'
  + ' +attachmentMediaPendingIds +attachmentMediaPreviousBindings +mediaPendingTaskPatch +mediaRemoteOutcomeUncertain';
const makeMaterialService = (completionIsolation = true) => createGrowthTaskAttachmentMediaService({
  GrowthTaskModel: Task, mediaReferenceClient: oldClient, randomUUID,
  logger: { info() {}, warn() {}, error() {} }, completionIsolation
});
const startMaterialCommitLoss = async scenario => {
  const input = { familyId: scope.familyId, childId: scope.childId, createdByParentId: id(),
    dimension: 'academic', title: 'Before recovery', taskType: 'practice', dueDate: '2026-10-22' };
  const additions = [await media('task_attachment'), await media('task_attachment')];
  let task, retained, removed, oldOperation;
  if (scenario !== 'create') {
    retained = await media('task_attachment'); removed = await media('task_attachment'); oldOperation = randomUUID();
    task = await Task.create({ _id: scope.resourceId, ...input, attachmentMediaIds: [retained, removed],
      attachmentMediaBindings: [retained, removed].map(mediaId => ({ mediaId, bindingOperationId: oldOperation })), mediaReferenceState: 'bound' });
    const seed = { ...scope, resourceType: 'growth_task', operationId: oldOperation,
      references: [retained, removed].map(mediaId => ({ mediaId, field: 'attachmentMediaIds' })) };
    await oldClient.prepare(seed); await oldClient.commit(seed);
  }
  materialRequests = []; dropMaterialCommit = true;
  const desired = retained ? [retained, ...additions] : additions;
  const service = makeMaterialService(scenario !== 'legacy-pending');
  await expect(scenario === 'create'
    ? service.create({ taskInput: input, attachmentMediaIds: desired })
    : service.mutate({ task: task._id, attachmentMediaIds: desired, taskPatch: [{ path: 'title', value: 'After recovery' }] }))
    .rejects.toMatchObject({ status: 503, code: 'MEDIA_REFERENCE_PENDING' });
  expect(dropMaterialCommit).toBe(false);
  task = await Task.findOne({ familyId: scope.familyId }).select(materialHidden).lean();
  expect(task.mediaReferenceState).toBe('pending'); expect(task.mediaBindingPhase).toBe('binding');
  const rows = await Reference.find({ mediaId: { $in: additions } }).lean();
  expect(rows).toHaveLength(2);
  for (const row of rows) expect(row).toMatchObject({ state: 'bound', operationId: task.mediaBindingOperationId });
  expect(task.mediaCompletionFence).toEqual(scenario === 'legacy-pending' ? undefined : { completionVersion: 0, checklistVersion: 0 });
  expect(materialRequests.map(req => req.action)).toEqual(['prepare', 'commit']);
  return { task, desired, additions, retained, removed, oldOperation };
};

test.each(['create', 'patch', 'legacy-pending'])('%s recovers after real HTTP material commit succeeded but its response was lost', async scenario => {
  const { task, desired, additions, retained, removed, oldOperation } = await startMaterialCommitLoss(scenario);
  const prepare = legacy.prepare.getMockImplementation();
  let replayStates;
  legacy.prepare.mockImplementationOnce(async command => {
    const result = await prepare(command); replayStates = result.map(ref => ref.state); return result;
  });
  const result = await makeMaterialService().resume(task._id);
  expect(replayStates).toEqual(['bound', 'bound']);
  expect(result.mediaReferenceState).toBe('bound'); expect(result.attachmentMediaIds.map(String)).toEqual(desired);
  expect(result.title).toBe(scenario === 'create' ? 'Before recovery' : 'After recovery');
  expect(result.mediaCompletionFence).toBeUndefined(); expect(result.mediaBindingOperationId).toBeUndefined();
  expect(result.mediaBindingPhase).toBeUndefined(); expect(result.completionVersion).toBeUndefined();
  expect(result.attachmentMediaBindings.map(binding => ({ mediaId: String(binding.mediaId), bindingOperationId: binding.bindingOperationId })))
    .toEqual(desired.map(mediaId => ({ mediaId, bindingOperationId: mediaId === retained ? oldOperation : task.mediaBindingOperationId })));
  const replay = materialRequests.slice(2);
  expect(replay.map(req => req.action)).toEqual(removed ? ['prepare', 'commit', 'unbind'] : ['prepare', 'commit']);
  expect(replay.every(req => req.body.operationId === task.mediaBindingOperationId)).toBe(true);
  expect(replay[0].body.references.map(ref => ref.mediaId)).toEqual(additions);
  if (removed) {
    expect(replay[2].body.references).toEqual([{ mediaId: removed, field: 'attachmentMediaIds', bindingOperationId: oldOperation }]);
    expect(await Reference.findOne({ mediaId: removed }).lean()).toMatchObject({ state: 'released', operationId: oldOperation });
  }
  const stable = await Task.findById(task._id).select(materialHidden).lean(), count = materialRequests.length;
  await makeMaterialService().resume(task._id);
  expect(await Task.findById(task._id).select(materialHidden).lean()).toEqual(stable);
  expect(materialRequests).toHaveLength(count); expect(await RemoteOperation.countDocuments()).toBe(0);
});

const invalidReplays = [
  ['prepare', 'missing', rows => rows.slice(0, 1)],
  ['prepare', 'duplicate', rows => [rows[0], rows[0]]],
  ['prepare', 'extra', rows => [...rows, { ...rows[0], mediaId: id() }]],
  ['prepare', 'wrong media', rows => [{ ...rows[0], mediaId: id() }, rows[1]]],
  ['prepare', 'wrong field', rows => [{ ...rows[0], field: 'questionMediaId' }, rows[1]]],
  ['prepare', 'released', rows => [{ ...rows[0], state: 'released' }, rows[1]]],
  ['prepare', 'sparse', rows => { const sparse = rows.slice(); delete sparse[0]; return sparse; }],
  ['commit', 'prepared', rows => rows.map(row => ({ ...row, state: 'prepared' }))],
  ['commit', 'released', rows => rows.map(row => ({ ...row, state: 'released' }))]
];
test.each(['create', 'patch'].flatMap(scenario => invalidReplays.map(([action, label, corrupt]) => [scenario, action, label, corrupt])))('%s rejects %s replay with %s without publishing or clearing intent', async (scenario, action, label, corrupt) => {
    const { task } = await startMaterialCommitLoss(scenario);
    const before = await Task.findById(task._id).select(materialHidden).lean();
    const execute = legacy[action].getMockImplementation();
    legacy[action].mockImplementationOnce(async command => corrupt(await execute(command)));
    await expect(makeMaterialService().resume(task._id)).rejects.toMatchObject({ status: 503, code: 'MEDIA_REFERENCE_PENDING' });
    expect(await Task.findById(task._id).select(materialHidden).lean()).toEqual(before);
    expect(materialRequests.slice(2).map(req => req.action)).toEqual(action === 'prepare' ? ['prepare'] : ['prepare', 'commit']);
    expect((await makeMaterialService().resume(task._id)).mediaReferenceState).toBe('bound');
  });

test.each(['create', 'patch'].flatMap(scenario => ['mediaBindingOperationId', 'mediaBindingPhase', 'completionVersion', 'checklistVersion', 'activeCompletionOperation']
  .map(field => [scenario, field])))('%s bound replay still honors final %s CAS', async (scenario, field) => {
  const { task } = await startMaterialCommitLoss(scenario);
  const commit = legacy.commit.getMockImplementation(); let changed;
  legacy.commit.mockImplementationOnce(async command => {
    const result = await commit(command);
    const value = field === 'mediaBindingOperationId' ? randomUUID() : field === 'mediaBindingPhase' ? 'unbinding'
      : field === 'activeCompletionOperation' ? { actorId: new mongoose.Types.ObjectId() } : 1;
    await Task.collection.updateOne({ _id: task._id }, { $set: { [field]: value } });
    changed = await Task.findById(task._id).select(materialHidden + ' +activeCompletionOperation').lean();
    return result;
  });
  await expect(makeMaterialService().resume(task._id)).rejects.toMatchObject({ status: 503, code: 'MEDIA_REFERENCE_PENDING' });
  expect(await Task.findById(task._id).select(materialHidden + ' +activeCompletionOperation').lean()).toEqual(changed);
  expect(materialRequests.slice(2).map(req => req.action)).toEqual(['prepare', 'commit']);
});

test('bound replay also repairs the unchanged default legacy composition without activating completion', async () => {
  const { task } = await startMaterialCommitLoss('legacy-pending');
  const result = await makeMaterialService(false).resume(task._id);
  expect(result.mediaReferenceState).toBe('bound'); expect(result.title).toBe('After recovery');
  expect(await Task.findById(task._id).select('+mediaCompletionFence').lean()).not.toHaveProperty('mediaCompletionFence');
  expect(await RemoteOperation.countDocuments()).toBe(0);
});

test.each(['create', 'patch'])('%s accepts a complete reordered prepared/bound set but still commits before publication', async scenario => {
  const { task, desired } = await startMaterialCommitLoss(scenario);
  const prepare = legacy.prepare.getMockImplementation();
  legacy.prepare.mockImplementationOnce(async command => {
    const rows = await prepare(command);
    return [{ ...rows[1], state: 'prepared' }, rows[0]];
  });
  const result = await makeMaterialService().resume(task._id);
  expect(result.attachmentMediaIds.map(String)).toEqual(desired);
  expect(result.mediaReferenceState).toBe('bound');
  expect(materialRequests.slice(2).map(req => req.action)).toEqual(scenario === 'create' ? ['prepare', 'commit'] : ['prepare', 'commit', 'unbind']);
});
