const { randomUUID } = require('crypto');
const { createT2Runtime } = require('./serviceRuntime');
const { expectData } = require('./syntheticSeed');
const { formatLocalDate } = require('../../common/utils/familyDate');

let runtime, fixture, parent, coparent, outsider, children;
const taskPath = task => `/api/growth-tasks/${task.taskId}`;
const date = () => formatLocalDate(new Date(), 'Asia/Shanghai');
const monday = localDate => {
  const value = new Date(localDate + 'T00:00:00Z');
  value.setUTCDate(value.getUTCDate() - (value.getUTCDay() + 6) % 7);
  return value.toISOString().slice(0, 10);
};
const logBody = (childId, fields = {}) => ({ childId, date: date(), dimension: 'academic', subject: '数学',
  content: 'Synthetic mathematical reflection', childReflection: 'Synthetic check before answer', ...fields });
const logs = async (client, childId) => expectData(await client.get(`/api/growth-logs?childId=${childId}&pageSize=100`));
beforeAll(async () => {
  runtime = await createT2Runtime(); fixture = await runtime.seed();
  [parent, coparent, outsider] = await Promise.all(['parent', 'coparent', 'outsider'].map(runtime.login));
  children = [];
  for (const name of ['child', 'sibling']) {
    const childId = fixture.actors[name].childId;
    expectData(await parent.patch(`/api/children/${childId}`, { grade: 1 }));
    children.push({ childId, grade: 1, client: await runtime.login(name) });
  }
  const third = expectData(await parent.post('/api/children', { name: 'Synthetic grade four', grade: 4 }), 201).child;
  expectData(await parent.post(`/api/children/${third.childId}/pin`, { pin: '9753' }));
  const credentials = { familyId: fixture.familyId, childId: third.childId, pin: '9753' };
  children.push({ childId: third.childId, grade: 4, client: runtime.api.asChild(expectData(await runtime.api.loginChild(credentials)).token) });
});
afterAll(async () => { await runtime?.stop(); });

test.each([0, 1, 2])('synthetic child %s completes formal mathematical chain and weekly reflection with real coparent audit', async index => {
  const { childId, client } = children[index];
  const reportPath = `/api/reports/weekly?childId=${childId}&weekStart=${monday(date())}`;
  const baseline = expectData(await parent.get(reportPath)).report;
  const task = expectData(await parent.post('/api/growth-tasks', { childId, title: `Synthetic T7 arithmetic ${index}`,
    dimension: 'academic', subject: '数学', taskType: 'practice', dueDate: date(),
    checklistSnapshot: [{ itemId: 'read', label: '读清题目', required: true }, { itemId: 'check', label: '检查结果', required: true }] }), 201).task;
  const planPath = `/api/children/${childId}/daily-learning-plans/${date()}`;
  const plan = expectData(await client.get(planPath)).plan;
  const planned = expectData(await client.put(planPath, { expectedVersion: plan.version,
    items: [{ taskId: task.taskId, childEstimatedMinutes: 10 }] })).plan;
  expect(planned.items[0].estimateRecordedBy).toEqual({ actorId: childId, role: 'student' });
  const requested = expectData(await client.patch(taskPath(task) + '/help', {
    action: 'request', expectedHelpVersion: 0, helpType: 'cannot_start', note: 'Synthetic guidance request' })).task;
  expect(requested.helpRequest.requestedByActor).toEqual({ id: childId, role: 'student' });
  const handled = expectData(await coparent.patch(taskPath(task) + '/help', {
    action: 'resolve', expectedHelpVersion: 1, parentResponse: 'Synthetic read the question first' })).task;
  expect(handled.helpRequest.resolvedByActor).toEqual({ id: fixture.actors.coparent.userId, role: 'parent' });
  const upload = new FormData(); upload.append('purpose', 'task_completion');
  upload.append('file', new Blob([fixture.image.bytes], { type: 'image/png' }), 'synthetic-math.png');
  const media = expectData(await client.post('/api/media', upload), 201).media;
  const command = { operationId: randomUUID(), expectedCompletionVersion: 0, expectedChecklistVersion: task.checklistVersion,
    checkedItemIds: ['read', 'check'], completionMediaIds: [media.mediaId], childNote: 'Synthetic checked work', actualMinutes: 10 };
  expect((await client.patch(taskPath(task) + '/complete', { ...command, expectedChecklistVersion: 0 })).status).toBe(409);
  runtime.dropNextResponse({ method: 'PATCH', path: taskPath(task) + '/complete' });
  await expect(client.patch(taskPath(task) + '/complete', command)).rejects.toThrow();
  const completed = expectData(await client.patch(taskPath(task) + '/complete', command)).task;
  expect(completed.completionVersion).toBe(1);
  const seen = expectData(await coparent.get(taskPath(task))).task;
  expect(seen.completionMediaIds).toEqual([media.mediaId]);
  expectData(await coparent.get(`/api/media/${media.mediaId}/access`));
  expect((await coparent.patch(taskPath(task) + '/confirm', { expectedCompletionVersion: 0 })).status).toBe(409);
  const confirmed = expectData(await coparent.patch(taskPath(task) + '/confirm', {
    expectedCompletionVersion: seen.completionVersion, parentFeedback: 'Synthetic reviewed this work' })).task;
  expect(confirmed).toMatchObject({ status: 'confirmed', parentFeedback: 'Synthetic reviewed this work' });
  expectData(await parent.patch(taskPath(task) + '/confirm', { expectedCompletionVersion: seen.completionVersion }));
  const mistake = expectData(await parent.post('/api/mistakes', { childId, sourceTaskId: task.taskId, subject: '数学',
    reason: 'calculation', reviewReminderDate: '2026-11-04' }), 201).mistake;
  const correction = expectData(await parent.post('/api/growth-tasks', { childId, sourceMistakeId: mistake.mistakeId,
    title: 'Synthetic correction', dimension: 'academic', subject: '数学', taskType: 'correction', dueDate: date() }), 201).task;
  expect(expectData(await client.get(taskPath(correction))).task.source.id).toBe(mistake.mistakeId);
  expectData(await client.patch(taskPath(correction) + '/complete', { operationId: randomUUID(), expectedCompletionVersion: 0,
    expectedChecklistVersion: 0, checkedItemIds: [], completionMediaIds: [] }));
  const correctionSeen = expectData(await parent.get(taskPath(correction))).task;
  expectData(await parent.patch(taskPath(correction) + '/confirm', { expectedCompletionVersion: correctionSeen.completionVersion }));
  const reminders = async day => expectData(await client.get(`/api/notifications/family?childId=${childId}&date=${day}`)).items;
  expect((await reminders('2026-11-03')).some(row => row.sourceId === mistake.mistakeId)).toBe(false);
  expect((await reminders('2026-11-04')).some(row => row.sourceId === mistake.mistakeId)).toBe(true);
  expectData(await client.patch(`/api/mistakes/${mistake.mistakeId}`, { reviewed: true, childExplanation: 'Synthetic corrected reasoning' }));
  expect(expectData(await client.get(`/api/mistakes/${mistake.mistakeId}`)).mistake).toMatchObject({ reviewed: true, mastered: false });
  const beforeReflection = await runtime.inspect();
  const beforeReport = expectData(await parent.get(reportPath)).report;
  expect(beforeReport.statistics).toMatchObject({ recordDays: 0, totalDurationMinutes: 0,
    completedTaskCount: 2, plannedTaskCount: baseline.statistics.plannedTaskCount + 2, mistakeCount: 1 });
  const log = expectData(await client.post('/api/growth-logs', logBody(childId)), 201).log;
  expect(log).toMatchObject({ familyId: fixture.familyId, childId, createdBy: childId, updatedBy: childId });
  expect((await logs(client, childId)).items.find(row => row.logId === log.logId)).toEqual(log);
  const proxy = expectData(await coparent.patch(`/api/growth-logs/${log.logId}`, { childReflection: 'Synthetic parent-assisted reflection' })).log;
  expect(proxy).toMatchObject({ createdBy: childId, updatedBy: fixture.actors.coparent.userId });
  const report = expectData(await coparent.get(reportPath)).report;
  expect(report.statistics).toEqual({ ...beforeReport.statistics, recordDays: 1 });
  expect(report.statistics.taskCompletionRate).toBe(Math.round(20000 / report.statistics.plannedTaskCount) / 100);
  const feedback = expectData(await coparent.patch(`/api/reports/weekly/${report.reportId}/feedback`, {
    parentNote: 'Synthetic review of learning', nextWeekSuggestion: 'Synthetic one careful check' })).report;
  expect(feedback.statistics).toEqual(report.statistics);
  expect(feedback.feedbackUpdatedBy).toBe(fixture.actors.coparent.userId);
  expect(expectData(await parent.get(reportPath)).report.parentNote).toBe(feedback.parentNote);
  const after = await runtime.inspect();
  expect(after.database.Task).toEqual(beforeReflection.database.Task);
  expect(after.database.Ledger).toEqual(beforeReflection.database.Ledger);
  expect(after.database.Ledger.filter(row => row.sourceId === task.taskId)).toHaveLength(1);
  expect(after.database.Reference.filter(row => row.mediaId === media.mediaId && row.state === 'bound')).toHaveLength(1);
});

test('reflection POST lost acknowledgement is discoverable after relogin without repost; history stays frozen', async () => {
  const { childId, client } = children[0];
  const reportPath = `/api/reports/weekly?childId=${childId}&weekStart=2020-01-06`;
  const frozen = expectData(await parent.get(reportPath)).report;
  expect(frozen.frozen).toBe(true);
  const body = logBody(childId, { date: '2020-01-07', content: 'Synthetic lost reflection' });
  const count = (await logs(client, childId)).total;
  runtime.dropNextResponse({ method: 'POST', path: '/api/growth-logs' });
  await expect(client.post('/api/growth-logs', body)).rejects.toThrow();
  const relogged = await runtime.login('child');
  const listed = await logs(relogged, childId);
  expect(listed.total).toBe(count + 1);
  expect(listed.items.filter(row => row.content === body.content)).toHaveLength(1);
  const saved = listed.items.find(row => row.content === body.content);
  expectData(await relogged.patch(`/api/growth-logs/${saved.logId}`, { childReflection: '' }));
  expect((await logs(relogged, childId)).items.find(row => row.logId === saved.logId).childReflection).toBe('');
  const reread = expectData(await parent.get(reportPath)).report;
  expect(reread.reportId).toBe(frozen.reportId);
  expect(reread.frozen).toBe(true);
  expect(reread.generatedAt).toBe(frozen.generatedAt);
  expect(reread.statistics).toEqual(frozen.statistics);
  expect(reread.sourceCutoffAt).toEqual(frozen.sourceCutoffAt);
  expect((await logs(relogged, childId)).total).toBe(count + 1);
});

test('a nonzero historical snapshot survives an eligible source mutation while reflection and feedback remain editable', async () => {
  const { childId, client } = children[0];
  const log = expectData(await parent.post('/api/growth-logs', logBody(childId, {
    date: '2020-01-14', durationMinutes: 25, content: 'Synthetic historical learning'
  })), 201).log;
  // Only the temporary runtime fixture is backdated; all reads and business edits use real HTTP.
  const mongoose = runtime.mongooseInstances.find(instance => instance.models.GrowthLog);
  expect(mongoose).toBeDefined();
  const seeded = await mongoose.connection.collection('growthlogs').updateOne({ _id: new mongoose.Types.ObjectId(log.logId) },
    { $set: { createdAt: new Date('2020-01-14T04:00:00Z') } });
  expect(seeded.modifiedCount).toBe(1);
  const reportPath = `/api/reports/weekly?childId=${childId}&weekStart=2020-01-13`;
  const frozen = expectData(await parent.get(reportPath)).report;
  expect(frozen.frozen).toBe(true);
  expect(frozen.statistics).toMatchObject({ recordDays: 1, totalDurationMinutes: 25 });
  expectData(await parent.patch(`/api/growth-logs/${log.logId}`, { durationMinutes: 90 }));
  expectData(await client.patch(`/api/growth-logs/${log.logId}`, { childReflection: 'Synthetic later reflection' }));
  expectData(await coparent.patch(`/api/reports/weekly/${frozen.reportId}/feedback`, { parentNote: 'Synthetic later feedback' }));
  const reread = expectData(await parent.get(reportPath)).report;
  expect(reread).toMatchObject({ reportId: frozen.reportId, frozen: true, generatedAt: frozen.generatedAt,
    sourceCutoffAt: frozen.sourceCutoffAt, statistics: frozen.statistics,
    parentNote: 'Synthetic later feedback', feedbackUpdatedBy: fixture.actors.coparent.userId });
  expect(reread.statistics).toEqual(frozen.statistics);
  const source = (await logs(client, childId)).items.find(row => row.logId === log.logId);
  expect(source).toMatchObject({ durationMinutes: 90, childReflection: 'Synthetic later reflection' });
});

test.each(['$parent-feedback', ''])('formal GET delayed before persistence preserves concurrent coparent feedback %s', async nextWeekSuggestion => {
  const childId = children[0].childId;
  const reportPath = `/api/reports/weekly?childId=${childId}&weekStart=${monday(date())}`;
  const before = expectData(await parent.get(reportPath)).report;
  const Model = runtime.mongooseInstances.find(instance => instance.models.WeeklyReport).models.WeeklyReport;
  const original = Model.findOneAndUpdate.bind(Model);
  let enter, release, intercepted = false, pending;
  const entered = new Promise(resolve => { enter = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  const spy = jest.spyOn(Model, 'findOneAndUpdate').mockImplementation(async (...args) => {
    if (!intercepted && args[0].frozen === false && args[0].weekStart === before.weekStart) {
      intercepted = true; enter(); await held;
    }
    return original(...args);
  });
  try {
    pending = parent.get(reportPath);
    await Promise.race([entered, pending.then(() => { throw new Error('GET did not reach the held database write'); })]);
    const saved = expectData(await coparent.patch(`/api/reports/weekly/${before.reportId}/feedback`, {
      parentNote: 'Synthetic concurrent feedback', nextWeekSuggestion
    })).report;
    expect(saved.feedbackUpdatedBy).toBe(fixture.actors.coparent.userId);
    release();
    const delayed = expectData(await pending).report;
    const reread = expectData(await parent.get(reportPath)).report;
    for (const report of [delayed, reread]) {
      expect(report).toMatchObject({ reportId: saved.reportId, nextWeekSuggestion,
        parentNote: saved.parentNote, feedbackUpdatedBy: saved.feedbackUpdatedBy, feedbackUpdatedAt: saved.feedbackUpdatedAt });
      expect(report.statistics).toEqual(before.statistics);
    }
  } finally {
    release();
    if (pending) await Promise.allSettled([pending]);
    spy.mockRestore();
  }
});

test('real services reject sibling/family/field escalation and anonymous access, without altering reflection', async () => {
  const { childId, client } = children[0];
  const log = expectData(await client.post('/api/growth-logs', logBody(childId)), 201).log;
  for (const actor of [children[1].client, outsider]) {
    expect((await actor.get(`/api/growth-logs?childId=${childId}`)).status).toBe(403);
    expect((await actor.patch(`/api/growth-logs/${log.logId}`, { childReflection: 'forbidden' })).status).toBe(403);
  }
  for (const field of ['parentNote', 'updatedBy', 'familyId']) {
    expect((await client.patch(`/api/growth-logs/${log.logId}`, { [field]: fixture.actors.parent.userId })).status).toBe(403);
  }
  expect((await client.post('/api/growth-logs', logBody(children[1].childId))).status).toBe(403);
  const report = expectData(await parent.get(`/api/reports/weekly?childId=${childId}&weekStart=${monday(date())}`)).report;
  for (const response of [
    await outsider.get(`/api/reports/weekly?childId=${childId}&weekStart=${monday(date())}`),
    await outsider.patch(`/api/reports/weekly/${report.reportId}/feedback`, { parentNote: 'forbidden outsider' })
  ]) {
    expect(response.status).toBe(403);
    expect(response.data?.data).toBeUndefined();
  }
  expect((await client.patch(`/api/reports/weekly/${report.reportId}/feedback`, { parentNote: 'forbidden' })).status).toBe(403);
  expect((await fetch(runtime.baseUrl + `/api/growth-logs?childId=${childId}`)).status).toBe(401);
  const beforeExpired = await logs(client, childId);
  for (const name of ['child', 'parent']) {
    const token = require('jsonwebtoken').sign({ id: fixture.actors[name].userId,
      role: name === 'child' ? 'student' : 'parent', tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: -1 });
    const expired = name === 'child' ? runtime.api.asChild(token) : runtime.api.asParent(token);
    for (const response of [
      await expired.get(`/api/growth-logs?childId=${childId}`),
      await expired.post('/api/growth-logs', logBody(childId, { content: 'Expired identity must not create' })),
      await expired.patch(`/api/growth-logs/${log.logId}`, { childReflection: 'Expired identity must not update' }),
      await expired.patch(`/api/reports/weekly/${report.reportId}/feedback`, { parentNote: 'Expired feedback' })
    ]) {
      expect(response.status).toBe(401);
      expect(response.data.error.code).toBe('UNAUTHENTICATED');
      expect(response.data.data).toBeUndefined();
    }
  }
  expect(await logs(client, childId)).toEqual(beforeExpired);
  expect((await logs(client, childId)).items.find(row => row.logId === log.logId)).toEqual(log);
  const after = expectData(await parent.get(`/api/reports/weekly?childId=${childId}&weekStart=${monday(date())}`)).report;
  for (const field of ['reportId', 'parentNote', 'nextWeekSuggestion', 'feedbackUpdatedBy', 'feedbackUpdatedAt', 'statistics']) {
    expect(after[field]).toEqual(report[field]);
  }
  const foreignChild = fixture.actors.foreignChild.childId;
  const foreign = expectData(await outsider.post('/api/growth-logs', logBody(foreignChild, {
    content: 'Synthetic foreign family record', durationMinutes: 91
  })), 201).log;
  const sibling = expectData(await parent.post('/api/growth-logs', logBody(children[1].childId, {
    content: 'Synthetic sibling record', durationMinutes: 73
  })), 201).log;
  const own = await logs(client, childId);
  expect(own.items.some(row => [foreign.logId, sibling.logId].includes(row.logId))).toBe(false);
  expect(own.items.every(row => row.familyId === fixture.familyId && row.childId === childId)).toBe(true);
  expect(expectData(await parent.get(`/api/reports/weekly?childId=${childId}&weekStart=${monday(date())}`)).report.statistics).toEqual(after.statistics);
});
