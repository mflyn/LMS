const { randomUUID } = require('crypto');
const { createT2Runtime } = require('./serviceRuntime');
const { expectData } = require('./syntheticSeed');
const { formatLocalDate } = require('../../common/utils/familyDate');
let runtime, fixture, parent, coparent, child, sibling, outsider;
const url = childId => `/api/children/${childId}/daily-learning-plans/${formatLocalDate(new Date(), 'Asia/Shanghai')}`;
const read = async (actor, childId = fixture.actors.child.childId) => expectData(await actor.get(url(childId))).plan;
beforeAll(async () => {
  runtime = await createT2Runtime(); fixture = await runtime.seed();
  [parent, coparent, child, sibling, outsider] = await Promise.all(['parent', 'coparent', 'child', 'sibling', 'outsider'].map(runtime.login));
});
afterAll(async () => { await runtime?.stop(); });
test('formal Gateway plan lifecycle preserves actual estimator, scopes, task business fields and all other collections', async () => {
  const before = await runtime.inspect(), path = url(fixture.actors.child.childId);
  expect(await read(child)).toMatchObject({ version: 0, items: [] }); expect(await runtime.inspect()).toEqual(before);
  const item = { taskId: fixture.tasks.child.taskId, childEstimatedMinutes: 15 };
  const first = expectData(await child.put(path, { expectedVersion: 0, items: [item] })).plan;
  expect(first).toMatchObject({ version: 1, items: [{ ...item,
    estimateRecordedBy: { actorId: fixture.actors.child.userId, role: 'student' } }] });
  const same = expectData(await coparent.put(path, { expectedVersion: 1, items: [item] })).plan;
  expect(same.items[0].estimateRecordedBy).toEqual(first.items[0].estimateRecordedBy);
  expect(same.updatedByActor).toEqual({ actorId: fixture.actors.coparent.userId, role: 'parent' });
  const changed = expectData(await parent.put(path, { expectedVersion: 2, items: [{ ...item, childEstimatedMinutes: 30 }] })).plan;
  expect(changed.items[0].estimateRecordedBy).toEqual({ actorId: fixture.actors.parent.userId, role: 'parent' });
  const relogged = await runtime.login('child'); expect(await read(relogged)).toEqual(changed);
  const after = await runtime.inspect();
  for (const key of Object.keys(before.database).filter(key => !['Task', 'DailyPlan'].includes(key))) expect(after.database[key]).toEqual(before.database[key]);
  const withoutFence = rows => rows.map(({ __v, ...row }) => row);
  expect(withoutFence(after.database.Task)).toEqual(withoutFence(before.database.Task)); expect(after.files).toEqual(before.files);
  expect(after.database.DailyPlan).toHaveLength(1);
});
test('lost committed PUT is recovered with original version conflict and read, never a second write', async () => {
  const childId = fixture.actors.sibling.childId, path = url(childId);
  const original = { expectedVersion: 0, items: [{ taskId: fixture.tasks.sibling.taskId, childEstimatedMinutes: 5 }] };
  runtime.dropNextResponse({ method: 'PUT', path });
  await expect(sibling.put(path, original)).rejects.toThrow();
  const committed = await runtime.inspect();
  expect(committed.database.DailyPlan.find(row => row.childId === childId).version).toBe(1);
  const retry = await sibling.put(path, original);
  expect(retry.status).toBe(409); expect(retry.data.error.code).toBe('VERSION_CONFLICT');
  expect((await read(await runtime.login('sibling'), childId)).items[0]).toMatchObject(original.items[0]);
  expect(await runtime.inspect()).toEqual(committed);
  expect(runtime.droppedResponses).toEqual([{ service: 'api-gateway', method: 'PUT', path, status: 200 }]);
});
test('completion and confirmation are projected without a plan save changing completion, help, media or rewards', async () => {
  const task = fixture.tasks.child, taskPath = `/api/growth-tasks/${task.taskId}`;
  expectData(await child.patch(taskPath + '/complete', { operationId: randomUUID(), expectedCompletionVersion: 0,
    expectedChecklistVersion: 0, checkedItemIds: [], completionMediaIds: [], needsHelp: false }));
  expect((await read(child)).items[0].task.status).toBe('completed');
  expectData(await parent.patch(taskPath + '/confirm', { expectedCompletionVersion: 1, parentFeedback: 'Synthetic T5 feedback' }));
  const before = await runtime.inspect(), current = await read(child);
  expect(current.items[0].task.status).toBe('confirmed');
  expectData(await child.put(url(task.childId), { expectedVersion: current.version,
    items: current.items.map(({ taskId, childEstimatedMinutes }) => ({ taskId, childEstimatedMinutes })) }));
  const after = await runtime.inspect();
  for (const key of Object.keys(before.database).filter(key => key !== 'DailyPlan')) expect(after.database[key]).toEqual(before.database[key]);
  expect(after.files).toEqual(before.files); expect(after.database.Ledger.filter(row => row.sourceId === task.taskId)).toHaveLength(1);
});
test('anonymous, sibling, foreign, forged identity and removed coparent cannot read or mutate the plan', async () => {
  const path = url(fixture.actors.child.childId), current = await read(child);
  const body = { expectedVersion: current.version, items: [] }, before = await runtime.inspect();
  for (const actor of [sibling, outsider]) {
    expect((await actor.get(path)).status).toBe(403); expect((await actor.put(path, body)).status).toBe(403);
  }
  expect((await fetch(runtime.baseUrl + path)).status).toBe(401);
  expect((await child.put(path, { ...body, updatedByActor: { actorId: fixture.actors.parent.userId, role: 'parent' } })).status).toBe(400);
  expect(await runtime.inspect()).toEqual(before);
  expect((await parent.delete(`/api/families/${fixture.familyId}/members/${fixture.actors.coparent.userId}`)).status).toBe(204);
  const departed = await runtime.inspect();
  expect((await coparent.get(path)).status).toBe(403); expect((await coparent.put(path, body)).status).toBe(403);
  expect(await runtime.inspect()).toEqual(departed);
});
