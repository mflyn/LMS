const { randomUUID } = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { createT2Runtime } = require('./serviceRuntime');
const { expectData } = require('./syntheticSeed');
const taskUrl = task => '/api/growth-tasks/' + task.taskId;
const recoveryUrl = (task, operationId) => `${taskUrl(task)}/completion-operations/${operationId}/recover`;
const command = (task, mediaIds = []) => ({ operationId: randomUUID(), expectedCompletionVersion: task.completionVersion,
  expectedChecklistVersion: task.checklistVersion, checkedItemIds: [], completionMediaIds: mediaIds,
  actualMinutes: 12, difficulty: 'normal', needsHelp: false, childNote: 'Synthetic work completed' });
const rowsFor = (snapshot, model, field, id) => snapshot.database[model].filter(row => row[field] === id);

describe('T2 real login and official HTTP completion protocol', () => {
  let runtime, fixture, parent, coparent, child, sibling, outsider;
  beforeAll(async () => {
    runtime = await createT2Runtime(); fixture = await runtime.seed();
    [parent, coparent, child, sibling, outsider] = await Promise.all(
      ['parent', 'coparent', 'child', 'sibling', 'outsider'].map(runtime.login));
  });
  afterAll(async () => { await runtime?.stop(); });
  const newTask = async () => expectData(await parent.post('/api/growth-tasks', {
    childId: fixture.actors.child.childId, title: 'Synthetic HTTP work', dimension: 'academic', taskType: 'practice',
    dueDate: new Date().toISOString().slice(0, 10), estimatedMinutes: 15
  }), 201).task;
  const upload = async (client = child) => {
    const form = new FormData();
    form.append('purpose', 'task_completion'); form.append('childId', fixture.actors.child.childId);
    form.append('file', new Blob([fixture.image.bytes], { type: fixture.image.mimeType }), fixture.image.name);
    return expectData(await client.post('/api/media', form), 201).media;
  };
  const detail = async (client, task) => expectData(await client.get(taskUrl(task))).task;
  const imageAccess = async (client, mediaId) => {
    const { access } = expectData(await client.get(`/api/media/${mediaId}/access`));
    const response = await fetch(runtime.baseUrl + access.url);
    expect(response.status).toBe(200);
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(20);
    expect((await require('sharp')(bytes).metadata()).width).toBe(24);
    return access.url;
  };

  test('seed exposes known synthetic identities and details without tokens; core reads are write-free', async () => {
    expect(await runtime.seed()).toBe(fixture);
    expect(fixture.actors.parent.userId).not.toBe(fixture.actors.coparent.userId);
    expect(fixture.actors.sibling.familyId).toBe(fixture.familyId);
    expect(fixture.actors.foreignChild.familyId).toBe(fixture.foreignFamilyId);
    expect(fixture.foreignFamilyId).not.toBe(fixture.familyId);
    expect(JSON.stringify(fixture)).not.toMatch(/"token"|Bearer |eyJ[A-Za-z0-9_-]+\./);
    const before = await runtime.inspect();
    expect(await detail(child, fixture.tasks.child)).toEqual(fixture.tasks.child);
    expect(await detail(coparent, fixture.tasks.sibling)).toEqual(fixture.tasks.sibling);
    expect(await runtime.inspect()).toEqual(before);
  });

  test('upload -> complete -> refresh -> version confirmation -> child review has one ledger and first audit', async () => {
    const task = await newTask(), media = await upload();
    const body = command(task, [media.mediaId]);
    const completed = expectData(await child.patch(taskUrl(task) + '/complete', body)).task;
    expect(completed).toMatchObject({ status: 'completed', completionVersion: 1, completionMediaIds: [media.mediaId] });
    const beforeRead = await runtime.inspect();
    const seen = await detail(coparent, task);
    expect(seen.completionEvidence.submittedByActor).toEqual({ id: fixture.actors.child.userId, role: 'student' });
    await imageAccess(coparent, media.mediaId);
    expect(await runtime.inspect()).toEqual(beforeRead);
    const confirmed = expectData(await coparent.patch(taskUrl(task) + '/confirm', {
      expectedCompletionVersion: seen.completionVersion, parentFeedback: 'Synthetic first feedback'
    })).task;
    expect(confirmed).toMatchObject({ status: 'confirmed', starAwardState: 'awarded', confirmedByParentId: fixture.actors.coparent.userId });
    const stable = await runtime.inspect();
    expect(await detail(await runtime.login('child'), task)).toMatchObject({
      status: 'confirmed', parentFeedback: 'Synthetic first feedback', completionMediaIds: [media.mediaId]
    });
    await imageAccess(child, media.mediaId);
    expectData(await parent.patch(taskUrl(task) + '/confirm', { expectedCompletionVersion: 1, parentFeedback: 'Must not replace first audit' }));
    expect((await child.patch(taskUrl(task) + '/complete', command(confirmed, [media.mediaId]))).status).toBe(409);
    expect(await runtime.inspect()).toEqual(stable);
    expect(rowsFor(stable, 'Ledger', 'sourceId', task.taskId)).toHaveLength(1);
    expect(rowsFor(stable, 'Operation', 'taskId', task.taskId)).toHaveLength(1);
    expect(rowsFor(stable, 'Reference', 'mediaId', media.mediaId)).toMatchObject([{ state: 'bound' }]);
    expect(rowsFor(stable, 'UploadGuard', 'mediaId', media.mediaId)).toMatchObject([{ state: 'REGISTERED' }]);
    expect(stable.files.some(row => row.path === `journal/uploads-v1/${media.mediaId}.json`)).toBe(true);
    expect(stable.database.Retirement).toEqual([]);
    await expect(fs.access(path.join(runtime.journalRoot, 'user-deletions-v2'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('a replacement snapshot clears omitted compatibility values and replays without republishing or changing first audit', async () => {
    const task = await newTask();
    const first = { ...command(task), actualAmount: 5, needsHelp: true };
    expectData(await child.patch(taskUrl(task) + '/complete', first));
    const seen = await detail(child, task);
    const fields = ['actualMinutes', 'actualAmount', 'difficulty', 'needsHelp', 'childNote'];
    for (const field of fields) {
      expect(seen[field]).toEqual(first[field]);
      expect(seen.completionEvidence[field]).toEqual(first[field]);
    }
    const next = { operationId: randomUUID(), expectedCompletionVersion: 1,
      expectedChecklistVersion: seen.checklistVersion, checkedItemIds: [], completionMediaIds: [] };
    const response = expectData(await child.patch(taskUrl(task) + '/complete', next));
    const published = await runtime.inspect();
    const storedTask = rowsFor(published, 'Task', '_id', task.taskId)[0];
    for (const field of fields) {
      expect(storedTask).not.toHaveProperty(field);
      expect(storedTask.completionEvidence).not.toHaveProperty(field);
    }
    // A fresh GET checks snapshot persistence; relogin is covered separately, within the real auth rate limit.
    const refreshed = await detail(child, task);
    for (const field of fields) {
      expect(refreshed).not.toHaveProperty(field);
      expect(refreshed.completionEvidence).not.toHaveProperty(field);
    }
    expect(refreshed.completionVersion).toBe(2);
    expectData(await child.patch(taskUrl(task) + '/complete', next));
    expectData(await child.post(recoveryUrl(task, next.operationId), {}));
    // Old successful operations replay their stored result, not a write of their old snapshot.
    expect(expectData(await child.patch(taskUrl(task) + '/complete', first)).task.completionVersion).toBe(1);
    expect(expectData(await child.patch(taskUrl(task) + '/complete', next))).toEqual(response);
    expect(await runtime.inspect()).toEqual(published);
    expectData(await coparent.patch(taskUrl(task) + '/confirm', { expectedCompletionVersion: 2, parentFeedback: 'First audit' }));
    const confirmed = await runtime.inspect();
    expectData(await parent.patch(taskUrl(task) + '/confirm', { expectedCompletionVersion: 2, parentFeedback: 'Ignored retry' }));
    expect(await runtime.inspect()).toEqual(confirmed);
    const final = await detail(child, task);
    expect(final).toMatchObject({ completionVersion: 2, status: 'confirmed', parentFeedback: 'First audit',
      confirmedByParentId: fixture.actors.coparent.userId });
    for (const field of fields) expect(final).not.toHaveProperty(field);
    expect(rowsFor(confirmed, 'Ledger', 'sourceId', task.taskId)).toHaveLength(1);
  });

  test('parent entry without images records the real actor; enabled protocol rejects legacy completion bodies', async () => {
    const task = await newTask(), before = await runtime.inspect();
    const legacy = await child.patch(taskUrl(task) + '/complete', { actualMinutes: 10, childNote: 'Old request' });
    expect(legacy.status).toBe(400); expect(await runtime.inspect()).toEqual(before);
    expectData(await coparent.patch(taskUrl(task) + '/complete', command(task)));
    const seen = await detail(child, task);
    expect(seen.completionEvidence).toMatchObject({ subjectChildId: fixture.actors.child.childId,
      submittedByActor: { id: fixture.actors.coparent.userId, role: 'parent' }, completionMediaIds: [] });
    expectData(await parent.patch(taskUrl(task) + '/confirm', { expectedCompletionVersion: seen.completionVersion }));
    const completed = await runtime.inspect();
    expect(rowsFor(completed, 'Ledger', 'sourceId', task.taskId)).toHaveLength(1);
    expect((await detail(child, task)).confirmedByParentId).toBe(fixture.actors.parent.userId);
  });

  test('losing a committed public completion response retries the same UUID without republishing', async () => {
    const task = await newTask(), media = await upload(), body = command(task, [media.mediaId]);
    const target = taskUrl(task) + '/complete';
    runtime.dropNextResponse({ method: 'PATCH', path: target });
    await expect(child.patch(target, body)).rejects.toThrow('HTTP request failed');
    expect(runtime.droppedResponses.at(-1)).toMatchObject({ service: 'api-gateway', path: target, status: 200 });
    const committed = await runtime.inspect();
    expect(rowsFor(committed, 'Task', '_id', task.taskId)[0].completionVersion).toBe(1);
    expect(rowsFor(committed, 'Operation', 'taskId', task.taskId)).toMatchObject([{ phase: 'SUCCEEDED', operationId: body.operationId }]);
    const relogged = await runtime.login('child');
    expectData(await relogged.patch(target, body));
    expectData(await relogged.post(recoveryUrl(task, body.operationId), {}));
    expect(await runtime.inspect()).toEqual(committed);
    expect(rowsFor(committed, 'Ledger', 'sourceId', task.taskId)).toEqual([]);
  });

  test('real remote COMMITTED lost acknowledgement is discovered read-only after login and only original actor can recover', async () => {
    const task = await newTask(), media = await upload(), body = command(task, [media.mediaId]);
    runtime.dropNextResponse({ service: 'resource-service', method: 'POST', path: '/api/internal/media/references/commit' });
    const response = await child.patch(taskUrl(task) + '/complete', body);
    expect(response.status).toBe(503); expect(response.data.error.code).toBe('MEDIA_REFERENCE_PENDING');
    const unknown = await runtime.inspect(), local = rowsFor(unknown, 'Operation', 'taskId', task.taskId)[0];
    expect(local.phase).toBe('PREPUBLISH');
    expect(rowsFor(unknown, 'RemoteOperation', 'operationId', local.remoteOperationId)).toMatchObject([{ state: 'COMMITTED' }]);
    const relogged = await runtime.login('child');
    const discovery = expectData(await relogged.get(taskUrl(task) + '/completion-recovery')).recovery;
    expect(discovery).toMatchObject({ state: 'recoverable', operationId: body.operationId });
    expect(expectData(await relogged.get('/api/growth-tasks/completion-recoveries')).items)
      .toContainEqual(expect.objectContaining({ taskId: task.taskId, operationId: body.operationId }));
    expect(expectData(await parent.get(taskUrl(task) + '/completion-recovery')).recovery).toMatchObject({ state: 'other_actor', operationId: null });
    expect((await parent.post(recoveryUrl(task, body.operationId), {})).status).toBe(404);
    expect(await runtime.inspect()).toEqual(unknown);
    expectData(await relogged.post(recoveryUrl(task, body.operationId), {}));
    const done = await runtime.inspect(), completed = await detail(child, task);
    expect(completed).toMatchObject({ completionVersion: 1, completionMediaIds: [media.mediaId] });
    expect(rowsFor(done, 'Operation', 'taskId', task.taskId)).toHaveLength(1);
    expect(rowsFor(done, 'Operation', 'taskId', task.taskId)[0]).toMatchObject({ remoteOperationId: local.remoteOperationId,
      commandHash: local.commandHash, operationId: body.operationId, phase: 'SUCCEEDED' });
    expectData(await relogged.post(recoveryUrl(task, body.operationId), {}));
    expect(await runtime.inspect()).toEqual(done);
  });

  test('parent cannot confirm an unseen replacement version; lost confirmation response preserves one ledger and audit', async () => {
    const task = await newTask(), first = await upload(), second = await upload();
    expectData(await child.patch(taskUrl(task) + '/complete', command(task, [first.mediaId])));
    const seen = await detail(parent, task);
    expectData(await child.patch(taskUrl(task) + '/complete', command(seen, [second.mediaId])));
    const replaced = await runtime.inspect();
    const stale = await parent.patch(taskUrl(task) + '/confirm', { expectedCompletionVersion: seen.completionVersion });
    expect(stale.status).toBe(409); expect(await runtime.inspect()).toEqual(replaced);
    const current = await detail(parent, task); await imageAccess(parent, second.mediaId);
    const target = taskUrl(task) + '/confirm';
    runtime.dropNextResponse({ method: 'PATCH', path: target });
    await expect(parent.patch(target, { expectedCompletionVersion: current.completionVersion, parentFeedback: 'First visible version' }))
      .rejects.toThrow('HTTP request failed');
    const awarded = await runtime.inspect();
    expect(rowsFor(awarded, 'Ledger', 'sourceId', task.taskId)).toHaveLength(1);
    expectData(await (await runtime.login('parent')).patch(target, { expectedCompletionVersion: current.completionVersion, parentFeedback: 'Later retry' }));
    expect(await runtime.inspect()).toEqual(awarded);
    expect(await detail(child, task)).toMatchObject({ completionVersion: 2, parentFeedback: 'First visible version',
      confirmedByParentId: fixture.actors.parent.userId });
  });

  test('sibling, foreign family and stale child cannot read or change work; public internal endpoints stay closed', async () => {
    const task = await newTask(), media = await upload();
    expectData(await child.patch(taskUrl(task) + '/complete', command(task, [media.mediaId])));
    const before = await runtime.inspect();
    for (const denied of [sibling, outsider]) {
      expect((await denied.get(taskUrl(task))).status).toBe(403);
      const deniedMedia = await denied.get(`/api/media/${media.mediaId}/access`);
      expect(deniedMedia.status).toBe(403); expect(deniedMedia.data.error.code).toBe('CHILD_ACCESS_DENIED');
      expect(deniedMedia.data.data).toBeUndefined();
      expect((await denied.patch(taskUrl(task) + '/complete', command(task))).status).toBe(403);
    }
    for (const endpoint of ['/api/internal/media/references/prepare', '/api/internal/stars/award', '/api/internal/completion-media-retirements/status']) {
      expect((await parent.post(endpoint, {})).status).toBe(404);
    }
    expect(await runtime.inspect()).toEqual(before);
    expectData(await parent.post(`/api/children/${fixture.actors.child.childId}/pin`, { pin: fixture.actors.child.pin }));
    const revoked = await runtime.inspect();
    expect((await child.get(taskUrl(task))).status).toBe(401);
    expect((await child.get(`/api/media/${media.mediaId}/access`)).status).toBe(401);
    expect(await runtime.inspect()).toEqual(revoked);
    child = await runtime.login('child');
    expect((await detail(child, task)).completionVersion).toBe(1);
  });

  test('normal privacy deletion invalidates a prior capability without changing teaching state, reward or first deletion audit', async () => {
    const task = await newTask(), media = await upload();
    expectData(await child.patch(taskUrl(task) + '/complete', command(task, [media.mediaId])));
    expectData(await parent.patch(taskUrl(task) + '/confirm', { expectedCompletionVersion: 1, parentFeedback: 'Keep teaching audit' }));
    const signed = await imageAccess(child, media.mediaId), before = await runtime.inspect();
    expect((await child.delete('/api/media/' + media.mediaId)).status).toBe(204);
    const deleted = await runtime.inspect();
    expect(rowsFor(deleted, 'Task', '_id', task.taskId)).toEqual(rowsFor(before, 'Task', '_id', task.taskId));
    expect(deleted.database.Ledger).toEqual(before.database.Ledger);
    expect(rowsFor(deleted, 'Tombstone', 'mediaId', media.mediaId)).toMatchObject([{ actorId: fixture.actors.child.userId, reason: 'user_requested' }]);
    expect(rowsFor(deleted, 'Receipt', 'mediaId', media.mediaId)).toHaveLength(1);
    expect(rowsFor(deleted, 'UploadGuard', 'mediaId', media.mediaId)).toMatchObject([{ state: 'RETIRED' }]);
    expect((await fetch(runtime.baseUrl + signed)).status).toBe(404);
    expect((await parent.get(`/api/media/${media.mediaId}/access`)).status).toBe(404);
    expect((await coparent.delete('/api/media/' + media.mediaId)).status).toBe(204);
    expect(await runtime.inspect()).toEqual(deleted);
    expect(await detail(child, task)).toMatchObject({ status: 'confirmed', parentFeedback: 'Keep teaching audit' });
  });
});
