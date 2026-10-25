const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const Task = require('../../models/GrowthTask');
const Operation = require('../../models/GrowthTaskCompletionOperation');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const { createGrowthTaskAttachmentMediaService } = require('../../services/growthTaskAttachmentMediaService');
const { createGrowthTaskCompletionService } = require('../../services/growthTaskCompletionService');
const { createGrowthTaskCompletionMutationService } = require('../../services/growthTaskCompletionMutationService');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');

const id = () => new mongoose.Types.ObjectId();
const hidden = '+activeCompletionOperation +completionPending +attachmentMediaBindings +mediaBindingOperationId'
  + ' +attachmentMediaPendingIds +attachmentMediaPreviousBindings +mediaBindingPhase +mediaPendingTaskPatch'
  + ' +mediaMutationKind +mediaRemoteOutcomeUncertain +mediaCompletionFence';
const pending = { status: 503, code: 'MEDIA_REFERENCE_PENDING' };
const runner = work => runMongoTransaction({ mongooseInstance: mongoose, work });
let task, parent, child, family, client, service, mediaA, mediaB, oldBinding;
const make = (options = {}) => createGrowthTaskAttachmentMediaService({ GrowthTaskModel: Task,
  mediaReferenceClient: client, randomUUID, logger: { info() {}, warn() {}, error() {} }, completionIsolation: true, ...options });
const row = () => Task.findById(task._id).select(hidden).lean();
const mutate = (extra = {}) => service.mutate({ task: task._id, attachmentMediaIds: [mediaB],
  taskPatch: [{ path: 'title', value: 'New material' }], ...extra });
const complete = () => createGrowthTaskCompletionService({ transactionRunner: runner,
  mediaReferenceClient: Object.fromEntries(['prepare', 'commit', 'status', 'abort', 'unbind'].map(action =>
    [action, () => { throw Error('Unexpected completion media call'); }])) })
  .complete({ identity: child, taskId: String(task._id), body: { operationId: randomUUID(),
    expectedCompletionVersion: 0, expectedChecklistVersion: 0, checkedItemIds: [], completionMediaIds: [] } });

beforeAll(async () => { for (const model of [Task, Operation, Family, User]) await model.init(); });
beforeEach(async () => {
  parent = { id: String(id()), role: 'parent' }; child = { id: String(id()), role: 'student', tokenVersion: 0 };
  family = await Family.create({ familyName: 'Synthetic materials', ownerParentId: parent.id,
    memberParentIds: [parent.id], childIds: [child.id] });
  Object.assign(child, { familyId: String(family._id), childId: child.id });
  await User.collection.insertMany([parent, child].map(user => ({ _id: new mongoose.Types.ObjectId(user.id),
    username: user.id, email: user.id + '@example.test', role: user.role,
    ...(user.role === 'student' ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {}) })));
  mediaA = String(id()); mediaB = String(id()); oldBinding = randomUUID();
  task = await Task.create({ familyId: family._id, childId: child.id, createdByParentId: parent.id,
    dimension: 'academic', title: 'Old material', taskType: 'practice', dueDate: '2026-10-22',
    attachmentMediaIds: [mediaA], attachmentMediaBindings: [{ mediaId: mediaA, bindingOperationId: oldBinding }],
    mediaReferenceState: 'bound' });
  client = Object.fromEntries([['prepare', 'prepared'], ['commit', 'bound'], ['unbind', 'released']]
    .map(([action, state]) => [action, jest.fn(async command => command.references.map(ref => ({ ...ref, state })))]));
  service = make();
});
afterEach(() => jest.restoreAllMocks());

test.each(['mutate', 'resume'].flatMap(method => [
  ['activeCompletionOperation', { actorId: id() }], ['completionPending', { phase: 'PREPUBLISH' }],
  ['completionMediaReferenceState', 'pending_recovery']
].map(([field, value]) => [method, field, value])))('%s blocks %s before remote calls or writes', async (method, field, value) => {
  await Task.collection.updateOne({ _id: task._id }, { $set: { [field]: value } });
  const before = await row();
  await expect(method === 'mutate' ? mutate() : service.resume(task._id)).rejects.toMatchObject(pending);
  expect(await row()).toEqual(before);
  for (const action of Object.values(client)) expect(action).not.toHaveBeenCalled();
});

test.each(['activeCompletionOperation', 'completionPending', 'completionVersion', 'checklistVersion', 'completionMediaReferenceState'])('final claim CAS rejects a concurrent %s change even without a document version increment', async field => {
    const original = Task.findOneAndUpdate.bind(Task); let changed;
    jest.spyOn(Task, 'findOneAndUpdate').mockImplementationOnce(async (...args) => {
      const value = field === 'activeCompletionOperation' ? { actorId: id() }
        : field === 'completionPending' ? { phase: 'PREPUBLISH' }
          : field === 'completionMediaReferenceState' ? 'pending_recovery' : 1;
      await Task.collection.updateOne({ _id: task._id }, { $set: { [field]: value } });
      changed = await row(); return original(...args);
    });
    await expect(mutate()).rejects.toMatchObject(pending);
    expect(await row()).toEqual(changed); expect(client.prepare).not.toHaveBeenCalled();
  });

test('material claim blocks real completion, then recovery permits completion and preserves material binding generations', async () => {
  client.prepare.mockImplementationOnce(async () => {
    await expect(complete()).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING', statusCode: 503 });
    throw Error('Lost response');
  });
  await expect(mutate()).rejects.toMatchObject(pending);
  const held = await row(); expect(held.mediaBindingPhase).toBe('binding');
  const result = await make().resume(task._id);
  expect(result.title).toBe('New material'); expect(result.mediaReferenceState).toBe('bound');
  expect(client.prepare.mock.calls[1][0].operationId).toBe(held.mediaBindingOperationId);
  expect(client.unbind.mock.calls[0][0].references).toEqual([{ mediaId: mediaA, field: 'attachmentMediaIds', bindingOperationId: oldBinding }]);
  const done = await complete(); expect(done.data.task.completionVersion).toBe(1);
  expect((await row()).attachmentMediaBindings[0].bindingOperationId).toBe(held.mediaBindingOperationId);
  await expect(mutate()).rejects.toMatchObject({ status: 409 });
});

test.each(['prepare', 'commit', 'unbind'])('loss after %s retains the same material owner and resumes without replacing completion evidence', async action => {
  client[action].mockRejectedValueOnce(Error('Lost response'));
  await expect(mutate()).rejects.toMatchObject(pending);
  const held = await row();
  const result = await make().resume(task._id);
  expect(result.mediaReferenceState).toBe('bound'); expect(result.title).toBe('New material');
  expect(result.attachmentMediaBindings[0].bindingOperationId).toBe(held.mediaBindingOperationId);
  expect(result.completionVersion).toBeUndefined(); expect(result.completionPending).toBeUndefined();
});

test('final publish cannot overwrite a concurrent completion owner and keeps recoverable material intent', async () => {
  client.commit.mockImplementationOnce(async command => {
    await Task.collection.updateOne({ _id: task._id }, { $set: { activeCompletionOperation: { actorId: id() } } });
    return command.references.map(ref => ({ ...ref, state: 'bound' }));
  });
  await expect(mutate()).rejects.toMatchObject(pending);
  const held = await row(); expect(held.title).toBe('Old material'); expect(held.mediaBindingPhase).toBe('binding');
  expect(client.unbind).not.toHaveBeenCalled();
});

test('stale publisher cannot adopt another material owner in unbinding phase', async () => {
  const other = randomUUID();
  client.commit.mockImplementationOnce(async command => {
    await Task.collection.updateOne({ _id: task._id }, { $set: { mediaBindingOperationId: other, mediaBindingPhase: 'unbinding' } });
    return command.references.map(ref => ({ ...ref, state: 'bound' }));
  });
  await expect(mutate()).rejects.toMatchObject(pending);
  expect((await row()).mediaBindingOperationId).toBe(other); expect(client.unbind).not.toHaveBeenCalled();
});

test('stable refusal clears only the current material intent and leaves previous public data intact', async () => {
  client.prepare.mockRejectedValueOnce(Object.assign(Error('Rejected'), { status: 404, code: 'RESOURCE_NOT_FOUND' }));
  await expect(mutate()).rejects.toMatchObject({ status: 404 });
  const result = await row(); expect(result.title).toBe('Old material'); expect(result.mediaReferenceState).toBe('bound');
  expect(result.mediaBindingOperationId).toBeUndefined(); expect(client.commit).not.toHaveBeenCalled();
});

test('stable refusal cannot clear intent after checklist version changes', async () => {
  client.prepare.mockImplementationOnce(async () => {
    await Task.collection.updateOne({ _id: task._id }, { $set: { checklistVersion: 1 } });
    throw Object.assign(Error('Rejected'), { status: 404 });
  });
  await expect(mutate()).rejects.toMatchObject(pending);
  expect((await row()).mediaBindingPhase).toBe('binding');
});

test('legacy default remains unchanged until production activation is approved', async () => {
  await Task.collection.updateOne({ _id: task._id }, { $set: { completionMediaReferenceState: 'pending_recovery' } });
  const legacy = make({ completionIsolation: false });
  expect((await legacy.mutate({ task: task._id, taskPatch: [{ path: 'title', value: 'Legacy' }] })).title).toBe('Legacy');
});

test.each(['completionVersion', 'checklistVersion'])('restart must not rebase pending material intent onto a changed %s', async field => {
  client.commit.mockRejectedValueOnce(Error('Lost response'));
  await expect(mutate()).rejects.toMatchObject(pending);
  await Task.collection.updateOne({ _id: task._id }, { $set: { [field]: 1 } });
  const before = await row(), calls = client.prepare.mock.calls.length;
  await expect(make().resume(task._id)).rejects.toMatchObject(pending);
  expect(await row()).toEqual(before); expect(client.prepare).toHaveBeenCalledTimes(calls);
});

test.each(['claim', 'publish', 'finalize'])('lost local %s response recovers only the persisted stage of the same owner', async stage => {
  const original = Task.findOneAndUpdate.bind(Task); let injected = false;
  jest.spyOn(Task, 'findOneAndUpdate').mockImplementation(async (filter, update, options) => {
    const result = await original(filter, update, options).select(hidden);
    const match = stage === 'claim' ? update.$set.mediaMutationKind === 'patch'
      : stage === 'publish' ? update.$set.mediaBindingPhase === 'unbinding'
        : filter.mediaBindingPhase === 'unbinding' && update.$unset;
    if (match && !injected) { injected = true; throw Error('Lost local acknowledgement'); }
    return result;
  });
  const result = await mutate(); expect(injected).toBe(true);
  expect(result.title).toBe('New material'); expect(result.mediaReferenceState).toBe('bound');
  expect(client.unbind.mock.calls[0][0].references[0].bindingOperationId).toBe(oldBinding);
});

test.each(['activeCompletionOperation', 'completionVersion', 'checklistVersion'])('final cleanup preserves intent when %s changes after unbind', async field => {
  client.unbind.mockImplementationOnce(async command => {
    await Task.collection.updateOne({ _id: task._id }, { $set: { [field]: field === 'activeCompletionOperation' ? { actorId: id() } : 1 } });
    return command.references.map(ref => ({ ...ref, state: 'released' }));
  });
  await expect(mutate()).rejects.toMatchObject(pending);
  const held = await row(); expect(held.mediaBindingPhase).toBe('unbinding'); expect(held.title).toBe('New material');
});

test('creation rollback cannot delete a task after a completion version change', async () => {
  const input = { familyId: family._id, childId: child.id, createdByParentId: parent.id, dimension: 'academic',
    title: 'Synthetic create', taskType: 'practice', dueDate: '2026-10-22' };
  let createdId;
  client.prepare.mockImplementationOnce(async command => {
    createdId = new mongoose.Types.ObjectId(command.resourceId);
    await Task.collection.updateOne({ _id: createdId }, { $set: { completionVersion: 1 } });
    throw Object.assign(Error('Rejected'), { status: 404 });
  });
  await expect(service.create({ taskInput: input, attachmentMediaIds: [mediaB] })).rejects.toMatchObject(pending);
  expect(await Task.exists({ _id: createdId, mediaReferenceState: 'pending' })).not.toBeNull();
});

test('local-only patch and reorder share the final completion fence', async () => {
  const original = Task.findOneAndUpdate.bind(Task);
  jest.spyOn(Task, 'findOneAndUpdate').mockImplementationOnce(async (...args) => {
    await Task.collection.updateOne({ _id: task._id }, { $set: { completionPending: { phase: 'PREPUBLISH' } } });
    return original(...args);
  });
  await expect(mutate({ attachmentMediaIds: [mediaA] })).rejects.toMatchObject(pending);
  expect((await row()).title).toBe('Old material'); expect(client.prepare).not.toHaveBeenCalled();
});

test.each(['binding', 'unbinding'])('version-zero legacy %s intent is adopted without changing its operation or binding generations', async phase => {
  client[phase === 'binding' ? 'commit' : 'unbind'].mockRejectedValueOnce(Error('Lost legacy response'));
  await expect(make({ completionIsolation: false }).mutate({ task: task._id, attachmentMediaIds: [mediaB],
    taskPatch: [{ path: 'title', value: 'Legacy intent' }] })).rejects.toMatchObject(pending);
  const before = await row(); expect(before.mediaCompletionFence).toBeUndefined();
  const result = await make().resume(task._id);
  expect(result.title).toBe('Legacy intent'); expect(result.mediaReferenceState).toBe('bound');
  expect(result.attachmentMediaBindings[0].bindingOperationId).toBe(before.mediaBindingOperationId);
  expect((await row()).mediaCompletionFence).toBeUndefined();
});

test('legacy pending with an unknown nonzero baseline is not silently adopted', async () => {
  client.commit.mockRejectedValueOnce(Error('Lost legacy response'));
  await expect(make({ completionIsolation: false }).mutate({ task: task._id, attachmentMediaIds: [mediaB] })).rejects.toMatchObject(pending);
  await Task.collection.updateOne({ _id: task._id }, { $set: { completionVersion: 1 } });
  const before = await row(), calls = client.prepare.mock.calls.length;
  await expect(make().resume(task._id)).rejects.toMatchObject(pending);
  expect(await row()).toEqual(before); expect(client.prepare).toHaveBeenCalledTimes(calls);
});

test('lost adoption acknowledgement is recoverable from the persisted version fence', async () => {
  client.commit.mockRejectedValueOnce(Error('Lost legacy response'));
  await expect(make({ completionIsolation: false }).mutate({ task: task._id, attachmentMediaIds: [mediaB] })).rejects.toMatchObject(pending);
  const original = Task.findOneAndUpdate.bind(Task);
  jest.spyOn(Task, 'findOneAndUpdate').mockImplementationOnce(async (...args) => {
    await original(...args); throw Error('Lost adoption acknowledgement');
  });
  await expect(make().resume(task._id)).rejects.toMatchObject(pending);
  expect((await row()).mediaCompletionFence).toEqual({ completionVersion: 0, checklistVersion: 0 });
  expect((await make().resume(task._id)).mediaReferenceState).toBe('bound');
});

test('fence adoption final CAS refuses a newly acquired completion owner', async () => {
  client.commit.mockRejectedValueOnce(Error('Lost legacy response'));
  await expect(make({ completionIsolation: false }).mutate({ task: task._id, attachmentMediaIds: [mediaB] })).rejects.toMatchObject(pending);
  const original = Task.findOneAndUpdate.bind(Task), calls = client.prepare.mock.calls.length;
  jest.spyOn(Task, 'findOneAndUpdate').mockImplementationOnce(async (...args) => {
    await Task.collection.updateOne({ _id: task._id }, { $set: { completionPending: { phase: 'PREPUBLISH' } } });
    return original(...args);
  });
  await expect(make().resume(task._id)).rejects.toMatchObject(pending);
  expect((await row()).mediaCompletionFence).toBeUndefined(); expect(client.prepare).toHaveBeenCalledTimes(calls);
});

test('creation establishes and clears its version fence while stable rejection still rolls back atomically', async () => {
  const input = { familyId: family._id, childId: child.id, createdByParentId: parent.id, dimension: 'academic',
    title: 'Synthetic create', taskType: 'practice', dueDate: '2026-10-22' };
  const result = await service.create({ taskInput: input, attachmentMediaIds: [mediaB] });
  expect(result.mediaReferenceState).toBe('bound'); expect(result.mediaCompletionFence).toBeUndefined();
  expect(await Task.countDocuments()).toBe(2);
  client.prepare.mockRejectedValueOnce(Object.assign(Error('Rejected'), { status: 404, code: 'RESOURCE_NOT_FOUND' }));
  await expect(service.create({ taskInput: input, attachmentMediaIds: [mediaB] })).rejects.toMatchObject({ status: 404 });
  expect(await Task.countDocuments()).toBe(2);
});

test('reordering preserves retained binding generations without a remote operation', async () => {
  await mutate({ attachmentMediaIds: [mediaA, mediaB] });
  const before = await row(); for (const action of Object.values(client)) action.mockClear();
  const result = await mutate({ attachmentMediaIds: [mediaB, mediaA], taskPatch: [] });
  expect(result.attachmentMediaBindings.map(binding => binding.bindingOperationId))
    .toEqual(before.attachmentMediaBindings.map(binding => binding.bindingOperationId).reverse());
  for (const action of Object.values(client)) expect(action).not.toHaveBeenCalled();
});

test('stale stable result with different binding provenance is not accepted after a lost publication', async () => {
  const original = Task.findOneAndUpdate.bind(Task); let injected = false;
  jest.spyOn(Task, 'findOneAndUpdate').mockImplementation(async (filter, update, options) => {
    if (!injected && update.$set.attachmentMediaBindings) {
      injected = true;
      await original(filter, update, options);
      await Task.collection.updateOne({ _id: task._id }, { $set: { 'attachmentMediaBindings.0.bindingOperationId': randomUUID() } });
      throw Error('Lost local acknowledgement');
    }
    return original(filter, update, options);
  });
  await expect(mutate({ attachmentMediaIds: [mediaA, mediaB] })).rejects.toMatchObject(pending);
  expect(injected).toBe(true);
});

test.each(['edit', 'remove'])('pending materials exclude independent %s until recovery', async method => {
  client.commit.mockRejectedValueOnce(Error('Lost response'));
  await expect(mutate()).rejects.toMatchObject(pending);
  const before = await row();
  const mutation = createGrowthTaskCompletionMutationService({ transactionRunner: runner });
  await expect(mutation[method]({ identity: parent, taskId: String(task._id), body: { title: 'Forbidden' } }))
    .rejects.toMatchObject({ statusCode: 503, code: 'MEDIA_REFERENCE_PENDING' });
  expect(await row()).toEqual(before);
  await make().resume(task._id);
  expect((await mutation[method]({ identity: parent, taskId: String(task._id), body: { title: 'Allowed' } })).success).toBe(true);
});
