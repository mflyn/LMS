const { randomUUID } = require('crypto');
const { createT2Runtime } = require('./serviceRuntime');
const { expectData } = require('./syntheticSeed');
let runtime, fixture, parent, coparent, child, sibling, outsider;
const url = task => `/api/growth-tasks/${task.taskId}`;
const body = (version = 0) => ({ action: 'request', expectedHelpVersion: version, helpType: 'cannot_start', note: 'Synthetic help' });
const resolve = version => ({ action: 'resolve', expectedHelpVersion: version, parentResponse: 'Synthetic response' });
const taskRow = (snapshot, task) => snapshot.database.Task.find(row => row._id === task.taskId);
const newTask = async () => expectData(await parent.post('/api/growth-tasks', {
  childId: fixture.actors.child.childId, title: 'Synthetic help HTTP', dimension: 'academic', taskType: 'practice', dueDate: '2026-01-01'
}), 201).task;
beforeAll(async () => {
  runtime = await createT2Runtime(); fixture = await runtime.seed();
  [parent, coparent, child, sibling, outsider] = await Promise.all(['parent', 'coparent', 'child', 'sibling', 'outsider'].map(runtime.login));
});
afterAll(async () => { await runtime?.stop(); });

test('real Gateway help lifecycle is persistent, actor-correct, write-free on GET and free of unrelated effects', async () => {
  const task = await newTask(), before = await runtime.inspect();
  const first = expectData(await child.patch(url(task) + '/help', body())).task;
  expect(first).toMatchObject({ status: 'pending', completionVersion: 0, helpVersion: 1,
    helpRequest: { requestedByActor: { id: fixture.actors.child.userId, role: 'student' } } });
  const waiting = await runtime.inspect();
  expect(expectData(await child.get(url(task))).task.helpRequest).toEqual(first.helpRequest);
  const list = expectData(await coparent.get(`/api/growth-tasks?childId=${task.childId}&helpStatus=pending&pageSize=1`));
  expect(list.items.map(row => row.taskId)).toContain(task.taskId);
  expect(await runtime.inspect()).toEqual(waiting);
  const done = expectData(await coparent.patch(url(task) + '/help', resolve(1))).task;
  expect(done.helpRequest).toMatchObject({ status: 'resolved', parentResponse: 'Synthetic response',
    resolvedByActor: { id: fixture.actors.coparent.userId, role: 'parent' } });
  expect(expectData(await (await runtime.login('child')).get(url(task))).task.helpRequest).toEqual(done.helpRequest);
  const after = await runtime.inspect();
  for (const name of Object.keys(before.database).filter(name => name !== 'Task')) expect(after.database[name]).toEqual(before.database[name]);
  expect(after.files).toEqual(before.files);
  const original = taskRow(before, task), changed = taskRow(after, task);
  for (const key of Object.keys(original).filter(key => !['__v', 'updatedAt', 'helpVersion', 'helpRequest'].includes(key))) expect(changed[key]).toEqual(original[key]);
  expect(expectData(await child.patch(url(task) + '/help', body(2))).task.helpVersion).toBe(3);
});

test('committed response loss replays original request without audit refresh and resolve loss never closes a newer request', async () => {
  const task = await newTask(); runtime.dropNextResponse({ method: 'PATCH', path: url(task) + '/help' });
  await expect(child.patch(url(task) + '/help', body())).rejects.toThrow();
  const committed = await runtime.inspect(); expect(taskRow(committed, task).helpVersion).toBe(1);
  expectData(await child.patch(url(task) + '/help', body())); expect(await runtime.inspect()).toEqual(committed);
  expect((await parent.patch(url(task) + '/help', body())).status).toBe(409);
  runtime.dropNextResponse({ method: 'PATCH', path: url(task) + '/help' });
  await expect(parent.patch(url(task) + '/help', resolve(1))).rejects.toThrow();
  expectData(await child.patch(url(task) + '/help', body(2)));
  const next = await runtime.inspect(); expect((await parent.patch(url(task) + '/help', resolve(1))).status).toBe(409);
  expect(await runtime.inspect()).toEqual(next);
  expect(runtime.droppedResponses).toHaveLength(2);
});

test('real authentication rejects anonymous, sibling, foreign family, forged actor and departed coparent', async () => {
  const task = await newTask(); expectData(await child.patch(url(task) + '/help', body()));
  for (const actor of [sibling, outsider]) {
    expect((await actor.patch(url(task) + '/help', body(1))).status).toBe(403);
    expect((await actor.get(url(task))).status).toBe(403);
  }
  expect((await fetch(runtime.baseUrl + url(task) + '/help', { method: 'PATCH',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body()) })).status).toBe(401);
  expect((await child.patch(url(task) + '/help', resolve(1))).status).toBe(403);
  expect((await child.patch(url(task) + '/help', { ...body(1), requestedByActor: { id: fixture.actors.parent.userId, role: 'parent' } })).status).toBe(400);
  expect((await parent.delete(`/api/families/${fixture.familyId}/members/${fixture.actors.coparent.userId}`)).status).toBe(204);
  const before = await runtime.inspect();
  expect((await coparent.patch(url(task) + '/help', resolve(1))).status).toBe(403);
  expect(await runtime.inspect()).toEqual(before);
});

test('work completion, edit and real confirmation preserve help; resolving after confirmation preserves the sole star ledger', async () => {
  const task = await newTask(); expectData(await child.patch(url(task) + '/help', body()));
  const initial = expectData(await child.get(url(task))).task.helpRequest;
  expectData(await parent.patch(url(task), { title: 'Synthetic edited task' }));
  expect(expectData(await child.get(url(task))).task.helpRequest).toEqual(initial);
  expectData(await child.patch(url(task) + '/complete', { operationId: randomUUID(), expectedCompletionVersion: 0,
    expectedChecklistVersion: 0, checkedItemIds: [], completionMediaIds: [], needsHelp: false }));
  expect(expectData(await parent.get(`/api/growth-tasks?childId=${task.childId}&helpStatus=pending`)).items.map(row => row.taskId)).toContain(task.taskId);
  expectData(await parent.patch(url(task) + '/confirm', { expectedCompletionVersion: 1, parentFeedback: 'Synthetic first review' }));
  const before = await runtime.inspect(); expect(taskRow(before, task).helpRequest).toEqual(initial);
  expectData(await parent.patch(url(task) + '/help', resolve(1)));
  const after = await runtime.inspect(); expect(after.database.Ledger).toEqual(before.database.Ledger);
  expect(after.database.Ledger.filter(row => row.sourceId === task.taskId)).toHaveLength(1);
  for (const key of ['completionVersion', 'completionEvidence', 'status', 'starAwardState', 'confirmedAt', 'confirmedByParentId', 'parentFeedback']) {
    expect(taskRow(after, task)[key]).toEqual(taskRow(before, task)[key]);
  }
});
