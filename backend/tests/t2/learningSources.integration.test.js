const { randomUUID } = require('crypto');
const { createT2Runtime } = require('./serviceRuntime');
const { expectData } = require('./syntheticSeed');
let runtime, fixture, parent, coparent, child, sibling, outsider;
const taskUrl = task => `/api/growth-tasks/${task.taskId}`;
const mistakeUrl = mistake => `/api/mistakes/${mistake.mistakeId}`;
const correction = fields => ({ childId: fixture.actors.child.childId, title: 'Synthetic correction',
  dimension: 'academic', taskType: 'correction', dueDate: '2026-10-27', ...fields });
const mistakeInput = fields => ({ childId: fixture.actors.child.childId, subject: 'Math', reason: 'calculation',
  knowledgePointName: 'Synthetic arithmetic', reviewReminderDate: '2026-10-28', ...fields });
const finish = task => ({ operationId: randomUUID(), expectedCompletionVersion: task.completionVersion,
  expectedChecklistVersion: task.checklistVersion, checkedItemIds: [], completionMediaIds: [], childNote: 'Synthetic corrected work' });
beforeAll(async () => {
  runtime = await createT2Runtime(); fixture = await runtime.seed();
  [parent, coparent, child, sibling, outsider] = await Promise.all(
    ['parent', 'coparent', 'child', 'sibling', 'outsider'].map(runtime.login));
});
afterAll(async () => { await runtime?.stop(); });

test('child no-ID lost creation is discoverable by read only, isolated from sibling and stable on repeated reads', async () => {
  runtime.dropNextResponse({ method: 'POST', path: '/api/mistakes' });
  await expect(child.post('/api/mistakes', { subject: 'Synthetic unknown child creation', reason: 'concept',
    sourceTaskId: fixture.tasks.child.taskId, questionMediaIds: [], childAnswerMediaIds: [] })).rejects.toThrow();
  const before = await runtime.inspect();
  const saved = before.database.Mistake.filter(row => row.subject === 'Synthetic unknown child creation');
  expect(saved).toHaveLength(1);
  const list = expectData(await child.get('/api/mistakes?mastered=false&pageSize=100')).items;
  expect(list.filter(row => row.mistakeId === saved[0]._id)).toHaveLength(1);
  expect(list.find(row => row.mistakeId === saved[0]._id)).toMatchObject({ familyId: fixture.familyId,
    childId: fixture.actors.child.childId, sourceTaskId: fixture.tasks.child.taskId });
  expect(expectData(await sibling.get('/api/mistakes?mastered=false&pageSize=100')).items
    .some(row => row.mistakeId === saved[0]._id)).toBe(false);
  await child.get('/api/mistakes?mastered=false&pageSize=100');
  expect(await runtime.inspect()).toEqual(before);
});

test('formal services connect task, manual mistake, correction, review and due reminder without automatic mastery', async () => {
  const source = fixture.tasks.child;
  const original = expectData(await child.get(taskUrl(source))).task;
  const mistake = expectData(await parent.post('/api/mistakes', mistakeInput({ sourceTaskId: source.taskId })), 201).mistake;
  const storedMistake = expectData(await parent.get(mistakeUrl(mistake))).mistake;
  expect(storedMistake).toMatchObject({ sourceTaskId: source.taskId, sourceAvailable: true,
    source: { id: source.taskId, familyId: fixture.familyId, childId: source.childId } });
  const task = expectData(await parent.post('/api/growth-tasks', correction({ sourceMistakeId: mistake.mistakeId })), 201).task;
  expect(expectData(await child.get(taskUrl(task))).task).toMatchObject({ sourceMistakeId: mistake.mistakeId,
    sourceAvailable: true, source: { id: mistake.mistakeId, subject: 'Math' } });
  const before = await runtime.inspect();
  await child.get(taskUrl(task)); await parent.get(mistakeUrl(mistake));
  expect(await runtime.inspect()).toEqual(before);
  const command = finish(task);
  runtime.dropNextResponse({ method: 'PATCH', path: taskUrl(task) + '/complete' });
  await expect(child.patch(taskUrl(task) + '/complete', command)).rejects.toThrow();
  expectData(await child.patch(taskUrl(task) + '/complete', command));
  const seen = expectData(await coparent.get(taskUrl(task))).task;
  expect((await coparent.patch(taskUrl(task) + '/confirm', { expectedCompletionVersion: 0 })).status).toBe(409);
  expectData(await coparent.patch(taskUrl(task) + '/confirm', { expectedCompletionVersion: seen.completionVersion,
    parentFeedback: 'Synthetic correction reviewed' }));
  expectData(await parent.patch(taskUrl(task) + '/confirm', { expectedCompletionVersion: seen.completionVersion }));
  expect(expectData(await child.get(taskUrl(task))).task).toMatchObject({ status: 'confirmed',
    parentFeedback: 'Synthetic correction reviewed', sourceMistakeId: mistake.mistakeId });
  expect(expectData(await parent.get(mistakeUrl(mistake))).mistake).toEqual(storedMistake);
  expect(expectData(await child.get(taskUrl(source))).task).toEqual(original);
  expect((await runtime.inspect()).database.Ledger.filter(row => row.sourceId === task.taskId)).toHaveLength(1);
  const reminders = async date => expectData(await parent.get(`/api/notifications/family?childId=${source.childId}&date=${date}`)).items;
  expect((await reminders('2026-10-27')).filter(row => row.sourceId === mistake.mistakeId)).toHaveLength(0);
  expect((await reminders('2026-10-28')).filter(row => row.sourceId === mistake.mistakeId)).toHaveLength(1);
  expectData(await parent.patch(mistakeUrl(mistake), { corrected: true, reviewed: true, mastered: true }));
  expect((await reminders('2026-10-28')).filter(row => row.sourceId === mistake.mistakeId)).toHaveLength(0);
  const undated = expectData(await parent.post('/api/mistakes', mistakeInput({ reviewReminderDate: undefined })), 201).mistake;
  expect((await reminders('2026-10-27')).filter(row => row.sourceId === undated.mistakeId)).toHaveLength(1);
  const direct = expectData(await parent.post('/api/growth-tasks', correction({ sourceTaskId: source.taskId })), 201).task;
  expect(expectData(await child.get(taskUrl(direct))).task.source.id).toBe(source.taskId);
});

test('source validation refuses other children and families with identical public errors and zero writes', async () => {
  for (const endpoint of ['/api/mistakes', '/api/growth-tasks']) {
    const responses = [], before = await runtime.inspect();
    for (const sourceTaskId of [fixture.tasks.sibling.taskId, fixture.tasks.foreign.taskId, '000000000000000000000001']) {
      const response = await parent.post(endpoint, endpoint.endsWith('mistakes') ? mistakeInput({ sourceTaskId }) : correction({ sourceTaskId }));
      expect(response.status).toBe(404);
      expect(response.data.success).toBe(false);
      responses.push(response.data.error);
    }
    expect(responses).toEqual(Array(3).fill({ code: 'RESOURCE_NOT_FOUND', message: 'RESOURCE_NOT_FOUND', details: [] }));
    expect(await runtime.inspect()).toEqual(before);
  }
  const mistake = expectData(await parent.post('/api/mistakes', mistakeInput({ sourceTaskId: fixture.tasks.child.taskId })), 201).mistake;
  for (const actor of [sibling, outsider]) expect((await actor.get(mistakeUrl(mistake))).status).toBe(403);
  expect((await child.post('/api/growth-tasks', correction({ sourceMistakeId: mistake.mistakeId }))).status).toBe(403);
  expect((await parent.patch(mistakeUrl(mistake), { sourceTaskId: fixture.tasks.sibling.taskId })).status).toBe(403);
  for (const [kind, id] of [['mistakes', mistake.mistakeId], ['tasks', fixture.tasks.child.taskId]]) {
    const privatePath = `/api/internal/learning-sources/${kind}/${id}?familyId=${fixture.familyId}&childId=${fixture.actors.child.childId}`;
    expect((await parent.get(privatePath)).status).toBe(404);
  }
});

test('image and PDF mistake attachments retain source and reject cross-purpose completion media', async () => {
  const upload = async (purpose, bytes = fixture.image.bytes, mime = 'image/png', name = 'synthetic.png') => {
    const form = new FormData(); form.append('purpose', purpose); form.append('childId', fixture.actors.child.childId);
    form.append('file', new Blob([bytes], { type: mime }), name);
    return expectData(await parent.post('/api/media', form), 201).media.mediaId;
  };
  const question = await upload('mistake_question');
  const pdf = await require('pdf-lib').PDFDocument.create(); pdf.addPage([100, 100]).drawText('Synthetic answer');
  const answer = await upload('mistake_answer', await pdf.save({ useObjectStreams: false }), 'application/pdf', 'synthetic.pdf');
  const created = expectData(await parent.post('/api/mistakes', mistakeInput({ sourceTaskId: fixture.tasks.child.taskId,
    questionMediaIds: [question], childAnswerMediaIds: [answer] })), 201).mistake;
  const detail = expectData(await child.get(mistakeUrl(created))).mistake;
  expect(detail).toMatchObject({ sourceTaskId: fixture.tasks.child.taskId, questionMediaIds: [question], childAnswerMediaIds: [answer], sourceAvailable: true });
  const completion = await upload('task_completion'), before = await runtime.inspect();
  const rejected = await parent.post('/api/mistakes', mistakeInput({ sourceTaskId: fixture.tasks.child.taskId, questionMediaIds: [completion] }));
  expect(rejected.status).toBe(400);
  expect(rejected.data.error.code).toBe('MEDIA_PURPOSE_MISMATCH');
  const after = await runtime.inspect();
  expect(after.database.Mistake).toEqual(before.database.Mistake);
  expect(after.database.MistakeStateEvent).toEqual(before.database.MistakeStateEvent);
  expect(after.database.Reference.filter(row => row.mediaId === completion)).toEqual(before.database.Reference.filter(row => row.mediaId === completion));
});

test('lost create acknowledgement preserves the saved sourced object and its materials for explicit inspection', async () => {
  const form = new FormData(); form.append('purpose', 'task_attachment'); form.append('childId', fixture.actors.child.childId);
  form.append('file', new Blob([fixture.image.bytes], { type: 'image/png' }), 'synthetic-material.png');
  const mediaId = expectData(await parent.post('/api/media', form), 201).media.mediaId;
  const title = 'Synthetic source lost create response';
  runtime.dropNextResponse({ method: 'POST', path: '/api/growth-tasks' });
  await expect(parent.post('/api/growth-tasks', correction({ title, sourceTaskId: fixture.tasks.child.taskId,
    attachmentMediaIds: [mediaId] }))).rejects.toThrow();
  const saved = await runtime.inspect();
  const rows = saved.database.Task.filter(row => row.title === title);
  expect(rows).toHaveLength(1);
  const listed = expectData(await parent.get(`/api/growth-tasks?childId=${fixture.actors.child.childId}&pageSize=100`)).items;
  const task = listed.find(row => row.taskId === rows[0]._id);
  expect(task).toMatchObject({ sourceTaskId: fixture.tasks.child.taskId, attachmentMediaIds: [mediaId] });
  expect(expectData(await parent.get(taskUrl(task))).task.source.id).toBe(fixture.tasks.child.taskId);
  expect(await runtime.inspect()).toEqual(saved);
  expect(saved.database.Reference.filter(row => row.mediaId === mediaId)).toMatchObject([{ state: 'bound' }]);
});
