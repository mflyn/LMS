const { randomUUID } = require('crypto');
const { createT2Runtime } = require('./serviceRuntime');
const { expectData } = require('./syntheticSeed');
const { formatLocalDate, addLocalDateDays } = require('../../common/utils/familyDate');
const url = task => `/api/growth-tasks/${task.taskId}`;
const rows = (snapshot, model, field, value) => snapshot.database[model].filter(row => row[field] === value);
let runtime, fixture, parent, coparent, child, sibling, outsider, prior;
beforeAll(async () => {
  prior = process.env.RECURRING_TASKS_ENABLED;
  runtime = await createT2Runtime({ beforeStart: async () => { process.env.RECURRING_TASKS_ENABLED = 'true'; } });
  fixture = await runtime.seed();
  [parent, coparent, child, sibling, outsider] = await Promise.all(['parent', 'coparent', 'child', 'sibling', 'outsider'].map(runtime.login));
});
afterAll(async () => {
  try { await runtime?.stop(); }
  finally { if (prior === undefined) delete process.env.RECURRING_TASKS_ENABLED; else process.env.RECURRING_TASKS_ENABLED = prior; }
});
const create = async () => {
  const body = { operationId: randomUUID(), childId: fixture.actors.child.childId,
    startDate: formatLocalDate(new Date(), 'Asia/Shanghai'), endDate: null,
    schedule: { kind: 'daily' }, template: { title: 'Synthetic recurring exercise', dimension: 'physical', taskType: 'exercise' } };
  const result = expectData(await parent.post('/api/recurring-task-plans', body), 201);
  const task = expectData(await child.get(`/api/growth-tasks/${result.generatedTaskId}`)).task;
  return { body, plan: result.plan, task };
};
const completion = (task, mediaIds = []) => ({ operationId: randomUUID(), expectedCompletionVersion: task.completionVersion,
  expectedChecklistVersion: task.checklistVersion, checkedItemIds: [], completionMediaIds: mediaIds, childNote: 'Synthetic daily work' });
const upload = async () => {
  const form = new FormData(); form.append('purpose', 'task_completion'); form.append('childId', fixture.actors.child.childId);
  form.append('file', new Blob([fixture.image.bytes], { type: fixture.image.mimeType }), fixture.image.name);
  return expectData(await child.post('/api/media', form), 201).media.mediaId;
};
const readImage = async (client, mediaId) => {
  const access = expectData(await client.get(`/api/media/${mediaId}/access`)).access;
  const response = await fetch(runtime.baseUrl + access.url);
  expect(response.status).toBe(200);
  expect((await require('sharp')(Buffer.from(await response.arrayBuffer())).metadata()).width).toBe(24);
};

test('recurring image completion survives lost response; real star loss resumes through coparent with first audit and private readback', async () => {
  const { task, plan } = await create(), mediaId = await upload(), original = completion(task, [mediaId]);
  runtime.dropNextResponse({ method: 'PATCH', path: url(task) + '/complete' });
  await expect(child.patch(url(task) + '/complete', original)).rejects.toThrow('HTTP request failed');
  const published = await runtime.snapshot();
  const operation = rows(published, 'Operation', 'taskId', task.taskId);
  expect(operation).toHaveLength(1);
  expect(operation[0].operationId).toBe(original.operationId);
  expect(rows(published, 'Reference', 'mediaId', mediaId)).toEqual([expect.objectContaining({
    familyId: fixture.familyId, childId: fixture.actors.child.childId, resourceType: 'growth_task',
    resourceId: task.taskId, field: 'completionMediaIds', state: 'bound', operationId: operation[0].remoteOperationId
  })]);
  expectData(await child.patch(url(task) + '/complete', original));
  expect(await runtime.snapshot()).toEqual(published);
  const seen = expectData(await parent.get(url(task))).task;
  expect(seen).toMatchObject({ completionVersion: 1, completionMediaIds: [mediaId] });
  expect(seen.completionEvidence.submittedByActor).toEqual({ id: fixture.actors.child.childId, role: 'student' });
  for (const denied of [sibling, outsider]) {
    expect((await denied.get(url(task))).status).toBe(403);
    expect((await denied.get(`/api/media/${mediaId}/access`)).status).toBe(403);
    expect((await denied.patch(url(task) + '/complete', original)).status).toBe(403);
  }
  expect((await parent.patch(url(task) + '/confirm', { expectedCompletionVersion: 0 })).status).toBe(409);
  expect(await runtime.snapshot()).toEqual(published);
  await readImage(parent, mediaId);
  runtime.dropNextResponse({ service: 'progress-service', method: 'POST', path: '/api/internal/stars/award' });
  const first = await parent.patch(url(task) + '/confirm', { expectedCompletionVersion: 1, parentFeedback: 'Synthetic first review' });
  expect(first.status).toBe(503);
  const pending = await runtime.snapshot();
  expect(rows(pending, 'Ledger', 'sourceId', task.taskId)).toHaveLength(1);
  expect(rows(pending, 'Task', '_id', task.taskId)[0]).toMatchObject({ status: 'confirmed', starAwardState: 'pending',
    confirmedByParentId: fixture.actors.parent.userId, parentFeedback: 'Synthetic first review' });
  await readImage(coparent, mediaId);
  expectData(await coparent.patch(url(task) + '/confirm', { expectedCompletionVersion: 1, parentFeedback: 'Must not replace' }));
  const stable = await runtime.snapshot();
  expect(rows(stable, 'Ledger', 'sourceId', task.taskId)).toEqual(rows(pending, 'Ledger', 'sourceId', task.taskId));
  expect(rows(stable, 'Task', '_id', task.taskId)[0]).toMatchObject({ starAwardState: 'awarded',
    confirmedByParentId: fixture.actors.parent.userId, confirmedAt: rows(pending, 'Task', '_id', task.taskId)[0].confirmedAt,
    parentFeedback: 'Synthetic first review' });
  expectData(await parent.patch(url(task) + '/confirm', { expectedCompletionVersion: 1 }));
  expect(expectData(await child.get(url(task))).task).toMatchObject({ status: 'confirmed', parentFeedback: 'Synthetic first review' });
  await readImage(child, mediaId);
  expect((await child.patch(url(task) + '/complete', completion(seen, [mediaId]))).status).toBe(409);
  expect(await runtime.snapshot()).toEqual(stable);
  expectData(await parent.post(`/api/recurring-task-plans/${plan.id}/stop`, { operationId: randomUUID(), expectedVersion: 1 }));
  expect(await runtime.snapshot()).toEqual(stable); // Plan/command collections are deliberately outside the legacy snapshot.
  expect((await child.delete(`/api/media/${mediaId}`)).status).toBe(204);
  const deleted = await runtime.snapshot();
  expect(deleted.database.Task).toEqual(stable.database.Task); expect(deleted.database.Ledger).toEqual(stable.database.Ledger);
  expect((await child.get(`/api/media/${mediaId}/access`)).status).toBe(404);
  expect(rows(deleted, 'Tombstone', 'mediaId', mediaId)).toHaveLength(1);
  expect(rows(deleted, 'Operation', 'taskId', task.taskId)).toHaveLength(1);
  expect(runtime.droppedResponses).toEqual(expect.arrayContaining([
    expect.objectContaining({ service: 'api-gateway', path: url(task) + '/complete', status: 200 }),
    expect.objectContaining({ service: 'progress-service', path: '/api/internal/stars/award', status: 200 })
  ]));
});

test('two injected local dates generate distinct instances and independent rewards; rescans and stop never duplicate or alter work', async () => {
  const { task, plan, body } = await create();
  expectData(await child.patch(url(task) + '/complete', completion(task)));
  expectData(await parent.patch(url(task) + '/confirm', { expectedCompletionVersion: 1, parentFeedback: 'Day one' }));
  const dayOne = await runtime.snapshot();
  const tomorrow = addLocalDateDays(body.startDate, 1);
  const { createRecurringTaskPlanService } = require('../../services/homework-service/services/recurringTaskPlanService');
  const { runMongoTransaction } = require('../../common/services/mongoTransaction');
  const Task = require('../../services/homework-service/models/GrowthTask');
  const service = createRecurringTaskPlanService({ enabled: () => true, now: () => Date.parse(tomorrow + 'T04:00:00Z'),
    transactionRunner: work => runMongoTransaction({ mongooseInstance: Task.db, work }) });
  const generated = await service.generate({ planId: plan.id });
  expect(generated.generatedTaskId).not.toBe(task.taskId);
  expect(await service.generate({ planId: plan.id })).toEqual(generated);
  const second = expectData(await child.get('/api/growth-tasks/' + generated.generatedTaskId)).task;
  expect(second).toMatchObject({ status: 'pending', completionVersion: 0, dueDate: tomorrow, completionMediaIds: [] });
  expect(second.parentFeedback).toBe('');
  expect(rows(await runtime.snapshot(), 'Task', '_id', task.taskId)).toEqual(rows(dayOne, 'Task', '_id', task.taskId));
  expectData(await child.patch(url(second) + '/complete', completion(second)));
  expectData(await coparent.patch(url(second) + '/confirm', { expectedCompletionVersion: 1, parentFeedback: 'Day two' }));
  const stable = await runtime.snapshot();
  for (const item of [task, second]) {
    const ledger = rows(stable, 'Ledger', 'sourceId', item.taskId); expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ amount: 1, type: 'earn', sourceType: 'task_confirmation',
      familyId: fixture.familyId, childId: fixture.actors.child.childId });
    expectData(await parent.patch(url(item) + '/confirm', { expectedCompletionVersion: 1 }));
  }
  expect(expectData(await child.get(url(task))).task.parentFeedback).toBe('Day one');
  expect(expectData(await child.get(url(second))).task.parentFeedback).toBe('Day two');
  // Use the same injected day for stop; returning to yesterday is intentionally rejected by the waterline.
  await service.execute({ identity: { id: fixture.actors.parent.userId, role: 'parent' }, action: 'stop', planId: plan.id,
    body: { operationId: randomUUID(), expectedVersion: 1 } });
  expect(await service.generate({ planId: plan.id })).toEqual({ generatedTaskId: null });
  expect(await runtime.snapshot()).toEqual(stable);
  const occurrences = stable.database.Task.filter(row => row.recurringPlanId === plan.id);
  expect(occurrences.map(row => row.occurrenceDate).sort()).toEqual([body.startDate, tomorrow]);
});
