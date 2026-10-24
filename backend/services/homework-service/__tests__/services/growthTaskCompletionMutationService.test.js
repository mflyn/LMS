const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const Task = require('../../models/GrowthTask');
const Operation = require('../../models/GrowthTaskCompletionOperation');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');
const { createGrowthTaskCompletionService } = require('../../services/growthTaskCompletionService');
const { createGrowthTaskCompletionConfirmationService } = require('../../services/growthTaskCompletionConfirmationService');
const { createGrowthTaskCompletionMutationService } = require('../../services/growthTaskCompletionMutationService');

const id = () => new mongoose.Types.ObjectId();
const runner = work => runMongoTransaction({ mongooseInstance: mongoose, work });
const hidden = '+activeCompletionOperation +completionPending +completionMediaBindings';
let parent, second, child, family, task, service, time;
const make = options => createGrowthTaskCompletionMutationService({ transactionRunner: runner, now: () => time, ...options });
const edit = (body = { title: ' revised ' }, identity = parent) => service.edit({ identity, taskId: String(task._id), body });
const remove = (identity = parent) => service.remove({ identity, taskId: String(task._id) });
const row = () => Task.findById(task._id).select(hidden).lean();
const command = () => ({ operationId: randomUUID(), expectedCompletionVersion: 0,
  expectedChecklistVersion: 0, checkedItemIds: [], completionMediaIds: [], childNote: 'Synthetic evidence' });
const mediaClient = Object.fromEntries(['prepare', 'commit', 'abort', 'status', 'unbind'].map(k =>
  [k, async () => { throw Error('Unexpected media call'); }]));
const complete = (body = command(), options = {}) => createGrowthTaskCompletionService({ transactionRunner: runner,
  mediaReferenceClient: mediaClient, ...options }).complete({ identity: child, taskId: String(task._id), body });
const confirm = options => createGrowthTaskCompletionConfirmationService({ transactionRunner: runner,
  awardTaskStar: async () => ({ awarded: true, ledgerEntryId: 'synthetic-ledger', starBalance: 1 }), ...options })
  .confirm({ identity: parent, taskId: String(task._id), body: { expectedCompletionVersion: 1, parentFeedback: 'first' } });

beforeAll(async () => { for (const model of [Task, Operation, Family, User]) await model.init(); });
beforeEach(async () => {
  time = Date.parse('2026-10-22T00:00:00Z');
  parent = { id: String(id()), role: 'parent' }; second = { id: String(id()), role: 'parent' };
  child = { id: String(id()), role: 'student', tokenVersion: 0 };
  family = await Family.create({ familyName: 'Synthetic mutation', ownerParentId: parent.id,
    memberParentIds: [parent.id, second.id], childIds: [child.id] });
  child.familyId = String(family._id); child.childId = child.id;
  await User.collection.insertMany([parent, second, child].map(u => ({ _id: new mongoose.Types.ObjectId(u.id),
    username: u.id, email: u.id + '@example.test', role: u.role,
    ...(u.role === 'student' ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {}) })));
  task = await Task.create({ familyId: family._id, childId: child.id, createdByParentId: parent.id,
    dimension: 'academic', title: 'Synthetic mutation', taskType: 'practice', dueDate: '2026-10-22' });
  service = make();
});

test('pending edit uses the existing whitelist and does not initialize completion metadata', async () => {
  const before = await row();
  const result = await edit();
  expect(result).toMatchObject({ success: true, data: { task: { taskId: String(task._id), title: 'revised', status: 'pending' } } });
  const after = await row();
  expect(after.__v).toBe(before.__v + 1); expect(after.completionVersion).toBeUndefined();
  expect(after.completionEvidence).toBeUndefined(); expect(await Operation.countDocuments()).toBe(0);
});
test('remove cancels a pending task without physical deletion and preserves the first timestamp on replay', async () => {
  const result = await remove(); const before = await row(); time += 1000;
  expect(result).toMatchObject({ success: true, data: { deleted: false, task: { status: 'cancelled' } } });
  expect(before.cancelledAt).toEqual(new Date(time - 1000));
  await remove(second); expect(await row()).toEqual(before); expect(await Task.countDocuments()).toBe(1);
});

test.each(['familyId', 'childId', 'status', 'completionVersion', 'completionPending', 'starAwardState', 'confirmedAt', 'checklistSnapshot'])
  ('edit rejects protected field %s without writes', async field => {
    const before = await row(); await expect(edit({ [field]: 'untrusted' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    expect(await row()).toEqual(before);
  });
test.each([{ title: '' }, { estimatedMinutes: -1 }, { dimension: 'unknown' }])('model-invalid edit %p rolls back', async body => {
  const before = await row(); await expect(edit(body)).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
  expect(await row()).toEqual(before);
});
test('materials are explicitly unsupported and repeat rules keep the existing error', async () => {
  const before = await row();
  await expect(edit({ attachmentMediaIds: [] })).rejects.toMatchObject({ code: 'MEDIA_NOT_ENABLED', statusCode: 400 });
  await expect(edit({ repeatRule: {} })).rejects.toMatchObject({ code: 'REPEAT_RULE_NOT_SUPPORTED', statusCode: 400 });
  expect(await row()).toEqual(before);
});
test.each(['edit', 'remove'])('%s rejects children, removed parents and missing tasks before body validation', async method => {
  const args = { taskId: String(task._id), body: { status: 'untrusted' } };
  await expect(service[method]({ ...args, identity: child })).rejects.toMatchObject({ code: 'CHILD_ACCESS_DENIED', statusCode: 403 });
  await Family.updateOne({ _id: family._id }, { $set: { ownerParentId: second.id, memberParentIds: [second.id] } });
  await expect(service[method]({ ...args, identity: parent })).rejects.toMatchObject({ code: 'CHILD_ACCESS_DENIED', statusCode: 403 });
  await expect(service[method]({ ...args, taskId: String(id()), identity: second })).rejects.toMatchObject({ code: 'CHILD_ACCESS_DENIED', statusCode: 403 });
  expect((await row()).status).toBe('pending');
});
test.each(['completed', 'confirmed', 'cancelled', 'archived'])('%s tasks cannot be edited', async status => {
  await Task.collection.updateOne({ _id: task._id }, { $set: { status } }); const before = await row();
  await expect(edit()).rejects.toMatchObject({ code: 'TASK_STATE_CONFLICT', statusCode: 409 });
  expect(await row()).toEqual(before);
});
test.each(['edit', 'remove'].flatMap(method => [
  ['activeCompletionOperation', { actorId: new mongoose.Types.ObjectId() }],
  ['completionPending', { phase: 'PREPUBLISH' }],
  ['completionMediaReferenceState', 'pending_recovery'], ['mediaReferenceState', 'pending']
].map(([field, value]) => [method, field, value])))('%s blocks %s without clearing intent', async (method, field, value) => {
  await Task.collection.updateOne({ _id: task._id }, { $set: { [field]: value } }); const before = await row();
  await expect(service[method]({ identity: parent, taskId: String(task._id), body: { title: 'revised' } }))
    .rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING', statusCode: 503 });
  expect(await row()).toEqual(before);
});
test('completed archive preserves evidence and original completion command replay', async () => {
  const body = command(), response = await complete(body), before = await row();
  const archived = await remove(second);
  expect(archived.data.task.status).toBe('archived'); expect(archived.data.deleted).toBe(false);
  const after = await row();
  for (const field of ['completionVersion', 'completionEvidence', 'completionMediaBindings', 'completedAt', 'starAwardState']) {
    expect(after[field]).toEqual(before[field]);
  }
  expect(await complete(body)).toEqual(response); expect(await row()).toEqual(after);
  expect(JSON.stringify(archived)).not.toMatch(/completionPending|activeCompletionOperation|completionMediaBindings|remoteOperationId/);
  await remove(); expect(await row()).toEqual(after);
});
test('confirmed pending stars block archive until recovery, preserving first audit and evidence', async () => {
  await complete();
  await expect(confirm({ awardTaskStar: async () => { throw Error('Synthetic unavailable award'); } }))
    .rejects.toMatchObject({ code: 'STAR_AWARD_PENDING' });
  const pending = await row();
  await expect(remove()).rejects.toMatchObject({ code: 'STAR_AWARD_PENDING', statusCode: 409 }); expect(await row()).toEqual(pending);
  await confirm(); const before = await row(); await remove(second); const after = await row();
  for (const field of ['confirmedByParentId', 'confirmedAt', 'parentFeedback', 'starAwardState', 'completionEvidence', 'completionVersion']) {
    expect(after[field]).toEqual(before[field]);
  }
  expect(after.status).toBe('archived');
});
test('legacy cancellation without __v does not rewrite missing completion fields', async () => {
  await Task.collection.updateOne({ _id: task._id }, { $unset: { __v: '' } });
  await remove(); const after = await row();
  expect(after.__v).toBe(1); expect(after.completionVersion).toBeUndefined(); expect(after.completionMediaReferenceState).toBeUndefined();
});
test.each(['edit', 'remove'])('%s transaction rollback leaves no partial mutation', async method => {
  const before = await row(); let failed = false;
  service = make({ transactionRunner: (work, label) => runner(async session => { const result = await work(session);
    if (label === method) { failed = true; throw Error('Synthetic rollback'); } return result; }) });
  await expect(service[method]({ identity: parent, taskId: String(task._id), body: { title: 'revised' } }))
    .rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING', statusCode: 503 });
  expect(failed).toBe(true); expect(await row()).toEqual(before);
  service = make(); await service[method]({ identity: parent, taskId: String(task._id), body: { title: 'revised' } });
});
test.each(['edit', 'remove'])('%s lost commit acknowledgement retries from current task state', async method => {
  let failed = false;
  service = make({ transactionRunner: async (work, label) => { const result = await runner(work);
    if (label === method) { failed = true; throw Error('Synthetic lost acknowledgement'); } return result; } });
  await expect(service[method]({ identity: parent, taskId: String(task._id), body: { title: 'revised' } }))
    .rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  expect(failed).toBe(true); const before = await row(); service = make(); time += 1000;
  await service[method]({ identity: second, taskId: String(task._id), body: { title: 'revised' } });
  const after = await row();
  expect(after.title).toBe(before.title); expect(after.cancelledAt).toEqual(before.cancelledAt);
  expect(after.completionVersion).toBeUndefined();
});
test.each(['edit', 'remove'])('%s CAS miss rolls back even after an update was attempted', async method => {
  const before = await row(), update = Task.updateOne.bind(Task);
  const spy = jest.spyOn(Task, 'updateOne').mockImplementationOnce(async (...args) => { await update(...args); return { matchedCount: 0 }; });
  try { await expect(service[method]({ identity: parent, taskId: String(task._id), body: { title: 'revised' } }))
    .rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' }); } finally { spy.mockRestore(); }
  expect(await row()).toEqual(before);
});
test('completion owns task before edits and cancellation: both are blocked until completion finishes', async () => {
  let release, arrived; const gate = new Promise(r => { release = r; }), signal = new Promise(r => { arrived = r; });
  const work = complete(command(), { transactionRunner: async (fn, label) => { const result = await runner(fn);
    if (label === 'claim') { arrived(); await gate; } return result; } });
  try { await signal;
    await expect(edit()).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
    await expect(remove()).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
    release(); await work;
    await expect(edit()).rejects.toMatchObject({ code: 'TASK_STATE_CONFLICT' });
    await remove(); expect((await row()).status).toBe('archived');
  } finally { release(); await work; }
});
test('cancellation wins before completion claim: no operation can be inserted', async () => {
  await remove(); await expect(complete()).rejects.toMatchObject({ code: 'TASK_STATE_CONFLICT' });
  expect(await Operation.countDocuments()).toBe(0); expect((await row()).status).toBe('cancelled');
});
test('edit commits before completion: completion preserves new task metadata', async () => {
  await edit(); await complete(); expect((await row()).title).toBe('revised'); expect((await row()).status).toBe('completed');
});
test('archive wins before confirmation: no star request is sent', async () => {
  await complete(); await remove(); const awardTaskStar = jest.fn();
  await expect(confirm({ awardTaskStar })).rejects.toMatchObject({ code: 'TASK_STATE_CONFLICT' });
  expect(awardTaskStar).not.toHaveBeenCalled();
});
test('confirmation commits before remote award: archive cannot interrupt the pending award', async () => {
  await complete(); let release, arrived;
  const gate = new Promise(r => { release = r; }), signal = new Promise(r => { arrived = r; });
  const work = confirm({ transactionRunner: async (fn, label) => { const result = await runner(fn);
    if (label === 'confirm') { arrived(); await gate; } return result; } });
  try { await signal; await expect(remove()).rejects.toMatchObject({ code: 'STAR_AWARD_PENDING', statusCode: 409 });
    release(); await work; await remove(); expect((await row()).starAwardState).toBe('awarded');
  } finally { release(); await work; }
});
test('concurrent parent cancellations preserve one first cancellation timestamp', async () => {
  await Promise.all([remove(), remove(second)]); const before = await row();
  expect(before.__v).toBe(1); expect(before.cancelledAt).toEqual(new Date(time));
  time += 1000; await remove(); expect(await row()).toEqual(before);
});
test.each(['edit', 'remove'])('%s stale transaction snapshot cannot overwrite a newly claimed completion owner', async method => {
  let releaseWrite, reachedWrite, releaseClaim, reachedClaim;
  const writeGate = new Promise(r => { releaseWrite = r; }), writeSignal = new Promise(r => { reachedWrite = r; });
  const claimGate = new Promise(r => { releaseClaim = r; }), claimSignal = new Promise(r => { reachedClaim = r; });
  const update = Task.updateOne.bind(Task);
  const spy = jest.spyOn(Task, 'updateOne').mockImplementationOnce(async (...args) => {
    reachedWrite(); await writeGate; return update(...args);
  });
  const mutation = service[method]({ identity: parent, taskId: String(task._id), body: { title: 'stale write' } });
  let completion;
  try {
    await writeSignal;
    completion = complete(command(), { transactionRunner: async (work, label) => {
      const result = await runner(work); if (label === 'claim') { reachedClaim(); await claimGate; } return result;
    } });
    await claimSignal; const claimed = await row(); releaseWrite();
    await expect(mutation).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
    expect(await row()).toEqual(claimed);
    releaseClaim(); await completion;
    expect((await row()).status).toBe('completed'); expect((await row()).title).toBe('Synthetic mutation');
  } finally {
    releaseWrite(); releaseClaim(); spy.mockRestore();
    await Promise.allSettled([mutation, completion]);
  }
});
test('edit rechecks current parent membership after the initial authorization read', async () => {
  service = make({ transactionRunner: async (work, label) => {
    const result = await runner(work);
    if (label === 'read') await Family.updateOne({ _id: family._id }, { $set: { ownerParentId: second.id, memberParentIds: [second.id] } });
    return result;
  } });
  const before = await row(); await expect(edit()).rejects.toMatchObject({ code: 'CHILD_ACCESS_DENIED' });
  expect(await row()).toEqual(before);
});
test('unknown edit result cannot replay over a subsequently completed task', async () => {
  service = make({ transactionRunner: async (work, label) => { const result = await runner(work);
    if (label === 'edit') throw Error('Synthetic lost acknowledgement'); return result; } });
  await expect(edit()).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  await complete(); const before = await row(); service = make();
  await expect(edit()).rejects.toMatchObject({ code: 'TASK_STATE_CONFLICT' }); expect(await row()).toEqual(before);
});
test('invalid clock and inactive transaction cannot leave a cancellation', async () => {
  const before = await row(); service = make({ now: () => NaN });
  await expect(remove()).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' }); expect(await row()).toEqual(before);
  service = make({ transactionRunner: work => work({ inTransaction: () => false }) });
  await expect(remove()).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' }); expect(await row()).toEqual(before);
});
test.each([{ dimension: 'unknown' }, { title: '' }])('invalid edit schema %p takes precedence over a completion lock', async body => {
  await Task.collection.updateOne({ _id: task._id }, { $set: { activeCompletionOperation: { actorId: parent.id } } });
  const before = await row();
  await expect(edit(body)).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
  expect(await row()).toEqual(before);
});

// A bounded assertion reports an uncompleted validation promise without hanging the suite.
const settleEdit = async promise => {
  let timer;
  try {
    return await Promise.race([
      promise.then(value => ({ value }), cause => ({ code: cause.code, statusCode: cause.statusCode })),
      new Promise(resolve => { timer = setTimeout(() => resolve({ unsettled: true }), 2000); })
    ]);
  } finally { clearTimeout(timer); }
};
test.each([false, true].flatMap(locked => [
  ['single', { estimatedMinutes: 'not-a-number' }],
  ['multiple', { estimatedMinutes: 'bad', targetAmount: 'bad' }]
].map(([kind, body]) => [kind, locked, body])))('cast failure %s with locked=%s returns 400 without starting edit', async (_kind, locked, body) => {
  if (locked) await Task.collection.updateOne({ _id: task._id }, { $set: { activeCompletionOperation: { actorId: parent.id } } });
  const before = await row(), phases = [];
  service = make({ transactionRunner: (work, label) => { phases.push(label); return runner(work); } });
  expect(await settleEdit(edit(body))).toEqual({ code: 'VALIDATION_ERROR', statusCode: 400 });
  expect(phases).toEqual(['read']); expect(await row()).toEqual(before);
});
test.each(['child', 'removed-parent'])('cast failure cannot bypass %s authorization', async role => {
  if (role === 'removed-parent') await Family.updateOne({ _id: family._id }, { $set: { ownerParentId: second.id, memberParentIds: [second.id] } });
  const before = await row(), cast = jest.spyOn(Task, 'castObject');
  try {
    expect(await settleEdit(edit({ estimatedMinutes: 'bad' }, role === 'child' ? child : parent)))
      .toEqual({ code: 'CHILD_ACCESS_DENIED', statusCode: 403 });
    expect(cast).not.toHaveBeenCalled(); expect(await row()).toEqual(before);
  } finally { cast.mockRestore(); }
});
test('mixed cast failure and valid field rejects the whole patch', async () => {
  const before = await row();
  expect(await settleEdit(edit({ title: 'valid title', estimatedMinutes: 'bad' })))
    .toEqual({ code: 'VALIDATION_ERROR', statusCode: 400 });
  expect(await row()).toEqual(before);
});
test('valid cast keeps numeric and trimmed string behavior', async () => {
  const body = { estimatedMinutes: '15', title: ' revised ' };
  await edit(body); const after = await row();
  expect(after.estimatedMinutes).toBe(15); expect(after.title).toBe('revised');
  expect(body).toEqual({ estimatedMinutes: '15', title: ' revised ' });
});
test('required null remains a validation error before lock checking', async () => {
  await Task.collection.updateOne({ _id: task._id }, { $set: { activeCompletionOperation: { actorId: parent.id } } });
  const before = await row();
  expect(await settleEdit(edit({ title: null }))).toEqual({ code: 'VALIDATION_ERROR', statusCode: 400 });
  expect(await row()).toEqual(before);
});
test('optional null still clears the field instead of disappearing from the patch', async () => {
  await Task.updateOne({ _id: task._id }, { $set: { estimatedMinutes: 15 } });
  const result = await settleEdit(edit({ estimatedMinutes: null }));
  expect(result.value.success).toBe(true); expect((await row()).estimatedMinutes).toBeNull();
});
test('empty edit resolves without validation or writes', async () => {
  const before = await row(), validate = jest.spyOn(Task, 'validate');
  try {
    const result = await settleEdit(edit({})); expect(result.value.success).toBe(true);
    expect(validate).not.toHaveBeenCalled(); expect(await row()).toEqual(before);
  } finally { validate.mockRestore(); }
});
