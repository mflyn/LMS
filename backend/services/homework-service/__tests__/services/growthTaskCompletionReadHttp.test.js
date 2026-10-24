const express = require('express');
const { createHttpTestHarness } = require('../../../../common/test/httpTestHarness');
const { request, close: closeHttp } = createHttpTestHarness();
afterEach(closeHttp);
const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const Task = require('../../models/GrowthTask');
const Operation = require('../../models/GrowthTaskCompletionOperation');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const { createIdentityHeaders } = require('../../../../common/middleware/gatewayIdentity');
const { errorHandler } = require('../../../../common/middleware/errorHandler');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');
const { createGrowthTaskCompletionService } = require('../../services/growthTaskCompletionService');
const { createGrowthTaskCompletionReadService } = require('../../services/growthTaskCompletionReadService');
const { createGrowthTaskCompletionReadRouter } = require('../../routes/growthTaskCompletionRead');
const id = () => String(new mongoose.Types.ObjectId());
const runner = work => runMongoTransaction({ mongooseInstance: mongoose, work });
const NOW = Date.parse('2026-10-25T17:00:00.000Z'); // Monday in Shanghai, Sunday in UTC.
let app, service, family, parent, second, child, sibling, outsider, task, media;
const get = async (target, user = parent, headers) => (await request(app)).get(target).set(headers || createIdentityHeaders({
  method: 'GET', originalUrl: target, user, secret: process.env.GATEWAY_IDENTITY_SECRET
}));
const detail = () => '/api/growth-tasks/' + task._id;
const list = (query = '') => '/api/growth-tasks?childId=' + child.id + query;
const fail = (response, status, code) => {
  expect(response.status).toBe(status);
  expect(response.body).toMatchObject({ success: false, error: { code, details: [] } });
};
const noInternals = value => expect(JSON.stringify(value)).not.toMatch(
  /activeCompletionOperation|completionPending|completionMediaBindings|bindingOperationId|remoteOperationId|commandHash|mediaBinding|mediaPending|private-sentinel|storageKey|accessToken/
);
const makeTask = (extra = {}) => Task.create({ familyId: family._id, childId: child.id,
  createdByParentId: parent.id, title: 'Synthetic task', dimension: 'physical', taskType: 'practice',
  dueDate: '2026-10-26', ...extra });
const command = (version = 0, extra = {}) => ({ operationId: randomUUID(), expectedCompletionVersion: version,
  expectedChecklistVersion: 0, checkedItemIds: [], completionMediaIds: [], ...extra });
const completion = () => createGrowthTaskCompletionService({ transactionRunner: runner, mediaReferenceClient: media });
const snapshot = async () => ({ tasks: await Task.collection.find().sort({ _id: 1 }).toArray(),
  operations: await Operation.collection.find().sort({ _id: 1 }).toArray() });

beforeAll(async () => { for (const model of [Task, Operation, Family, User]) await model.init(); });
beforeEach(async () => {
  parent = { id: id(), role: 'parent' }; second = { id: id(), role: 'parent' }; outsider = { id: id(), role: 'parent' };
  child = { id: id(), role: 'student', tokenVersion: 0 }; sibling = { id: id(), role: 'student', tokenVersion: 0 };
  family = await Family.create({ familyName: 'Synthetic read', timezone: 'Asia/Shanghai', ownerParentId: parent.id,
    memberParentIds: [parent.id, second.id], childIds: [child.id, sibling.id] });
  for (const u of [child, sibling]) Object.assign(u, { childId: u.id, familyId: String(family._id) });
  await User.collection.insertMany([parent, second, outsider, child, sibling].map(u => ({ _id: new mongoose.Types.ObjectId(u.id),
    username: u.id, email: u.id + '@example.test', role: u.role,
    ...(u.role === 'student' ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {}) })));
  task = await makeTask();
  media = Object.fromEntries(['prepare', 'commit', 'abort', 'status', 'unbind'].map(k => [k, jest.fn(async () => { throw Error('synthetic unavailable'); })]));
  service = createGrowthTaskCompletionReadService({ transactionRunner: runner, now: () => NOW });
  app = express(); app.locals.logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn() }; app.use(express.json());
  app.use('/api/growth-tasks', createGrowthTaskCompletionReadRouter({ readService: service })); app.use(errorHandler);
});
afterEach(() => jest.restoreAllMocks());

test.each(['parent', 'coparent', 'child'])('%s receives the same complete legacy projection from detail and list without backfill', async role => {
  const user = role === 'child' ? child : role === 'coparent' ? second : parent, before = await snapshot();
  const one = await get(detail(), user), many = await get(list(), user);
  expect(one.status).toBe(200); expect(many.status).toBe(200);
  expect(one.body.data.task).toEqual(many.body.data.items[0]);
  expect(one.body.data.task).toMatchObject({ taskId: String(task._id), childId: child.id, familyId: String(family._id),
    title: 'Synthetic task', status: 'pending', checklistVersion: 0, checklistSnapshot: [], completionVersion: 0,
    completionMediaIds: [], completionEvidence: null, completionMediaReferenceState: 'stable' });
  expect(many.body.data).toMatchObject({ page: 1, pageSize: 20, total: 1 });
  noInternals(one.body); noInternals(many.body); expect(await snapshot()).toEqual(before);
});

test('unsigned requests are rejected before reads', async () => {
  fail(await get(detail(), parent, { 'x-user-id': parent.id, 'x-user-role': 'parent' }), 401, 'INVALID_IDENTITY_ENVELOPE');
});
test.each(['tampered', 'expired', 'replay', 'stale-child'])('%s authentication rejects detail and list', async kind => {
  for (const target of [detail(), list()]) {
    let headers = createIdentityHeaders({ method: 'GET', originalUrl: target, user: child,
      secret: process.env.GATEWAY_IDENTITY_SECRET, ...(kind === 'expired' ? { now: Date.now() - 360000 } : {}) });
    let code = 'INVALID_IDENTITY_ENVELOPE';
    if (kind === 'tampered') headers['x-user-id'] = sibling.id;
    if (kind === 'expired') code = 'IDENTITY_ENVELOPE_EXPIRED';
    if (kind === 'replay') { expect((await get(target, child, headers)).status).toBe(200); code = 'IDENTITY_ENVELOPE_REPLAYED'; }
    if (kind === 'stale-child') { await User.updateOne({ _id: child.id }, { $set: { 'childProfile.tokenVersion': 1 } }); code = 'STALE_CHILD_TOKEN'; }
    fail(await get(target, child, headers), 401, code);
  }
});

test.each(['outsider', 'sibling', 'departed', 'deleted-parent', 'child-removed'])('%s cannot read either endpoint', async kind => {
  let user = kind === 'outsider' ? outsider : kind === 'sibling' ? sibling : kind === 'child-removed' ? child : second;
  if (kind === 'departed') await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: second.id } });
  if (kind === 'deleted-parent') await User.deleteOne({ _id: second.id });
  if (kind === 'child-removed') await Family.updateOne({ _id: family._id }, { $pull: { childIds: child.id } });
  fail(await get(detail(), user), 403, 'CHILD_ACCESS_DENIED');
  fail(await get(list(), user), 403, 'CHILD_ACCESS_DENIED');
});

test('missing and foreign task IDs share the same public refusal', async () => {
  const foreign = await makeTask({ familyId: new mongoose.Types.ObjectId(), childId: sibling.id });
  const missing = await get('/api/growth-tasks/' + id()), denied = await get('/api/growth-tasks/' + foreign._id);
  fail(missing, 403, 'CHILD_ACCESS_DENIED'); expect(denied.body.error).toEqual(missing.body.error);
  fail(await get('/api/growth-tasks/bad-id'), 400, 'VALIDATION_ERROR');
});

test('child defaults to own list but cannot override scope; parent requires childId', async () => {
  expect((await get('/api/growth-tasks', child)).body.data.items[0].taskId).toBe(String(task._id));
  fail(await get('/api/growth-tasks?childId=' + sibling.id, child), 403, 'CHILD_ACCESS_DENIED');
  fail(await get('/api/growth-tasks'), 400, 'VALIDATION_ERROR');
});

test('list enforces family and child together even for inconsistent stored tasks', async () => {
  await makeTask({ familyId: new mongoose.Types.ObjectId() }); await makeTask({ childId: sibling.id });
  const response = await get(list()); expect(response.status).toBe(200);
  expect(response.body.data.total).toBe(1); expect(response.body.data.items.map(t => t.taskId)).toEqual([String(task._id)]);
});

test.each(['&page=0', '&pageSize=101', '&page=9007199254740992', '&page=2&page=3', '&dimension[$ne]=x',
  '&scope=all', '&status=unknown', '&familyId=foreign', '&select=completionPending'])('invalid query %s is rejected', async query => {
  fail(await get(list(query)), 400, 'VALIDATION_ERROR');
});

test('valid unauthorized scope is rejected before unrelated query validation', async () => {
  fail(await get(list('&page=0'), outsider), 403, 'CHILD_ACCESS_DENIED');
});

test('pagination is stable for tied dates/timestamps and total uses all filters', async () => {
  await makeTask(); await makeTask(); await makeTask({ dimension: 'labor' });
  await Task.collection.updateMany({}, { $set: { createdAt: new Date(NOW) } });
  const expected = await Task.find({ dimension: 'physical' }).sort({ _id: 1 }).lean();
  const pages = [];
  for (const page of [1, 2, 3]) { const r = await get(list('&dimension=physical&status=pending&pageSize=1&page=' + page));
    expect(r.status).toBe(200); expect(r.body.data).toMatchObject({ page, pageSize: 1, total: 3 }); pages.push(r.body.data.items[0].taskId); }
  expect(pages).toEqual(expected.map(t => String(t._id)));
  expect((await get(list('&page=99'))).body.data.items).toEqual([]);
});

test('today and week use family timezone at the UTC date boundary', async () => {
  await makeTask({ dueDate: '2026-10-25' }); const end = await makeTask({ dueDate: '2026-11-01' }); await makeTask({ dueDate: '2026-11-02' });
  const today = await get(list('&scope=today')), week = await get(list('&scope=week'));
  expect(today.body.data.items.map(t => t.taskId)).toEqual([String(task._id)]);
  expect(week.body.data.items.map(t => t.taskId)).toEqual([String(task._id), String(end._id)]);
});

test('GET reflects the latest publication rather than an old immutable command response', async () => {
  const a = command(0, { childNote: 'first' }), b = command(1, { childNote: 'second', actualMinutes: 12 });
  await completion().complete({ identity: child, taskId: String(task._id), body: a });
  await completion().complete({ identity: child, taskId: String(task._id), body: b });
  const replay = await completion().complete({ identity: child, taskId: String(task._id), body: a });
  expect(replay.data.task.completionVersion).toBe(1);
  const before = await snapshot(), result = await get(detail()); expect(result.status).toBe(200);
  expect(result.body.data.task).toMatchObject({ completionVersion: 2, childNote: 'second', actualMinutes: 12,
    completionEvidence: { submittedByActor: { id: child.id, role: 'student' }, subjectChildId: child.id,
      completionMediaIds: [], checkedItemIds: [], childNote: 'second' } });
  expect(result.body.data.task.completionEvidence.childSubmittedAt).toBeTruthy();
  expect(await snapshot()).toEqual(before);
});

test('PREPUBLISH reads stable evidence, never pending patch and never retries the remote client', async () => {
  await completion().complete({ identity: child, taskId: String(task._id), body: command(0, { childNote: 'published' }) });
  await expect(completion().complete({ identity: child, taskId: String(task._id),
    body: command(1, { completionMediaIds: [id()], childNote: 'private-sentinel' }) })).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  const before = await snapshot(), calls = media.prepare.mock.calls.length;
  const one = await get(detail()), many = await get(list());
  expect(one.status).toBe(200); expect(one.body.data.task).toMatchObject({ childNote: 'published', completionVersion: 1,
    completionMediaReferenceState: 'pending_recovery', completionMediaIds: [] });
  expect(many.body.data.items[0]).toEqual(one.body.data.task); noInternals(one.body);
  expect(await snapshot()).toEqual(before); expect(media.prepare).toHaveBeenCalledTimes(calls); expect(media.status).not.toHaveBeenCalled();
});

test('raw nested fields and legacy material pending metadata are excluded without restoring', async () => {
  const mediaId = new mongoose.Types.ObjectId(), generation = randomUUID();
  await Task.collection.updateOne({ _id: task._id }, { $set: { completionVersion: 3, checklistVersion: 2,
    checklistSnapshot: [{ itemId: 'one', label: 'Synthetic check', required: true, secret: 'private-sentinel' }],
    status: 'completed', completionMediaReferenceState: 'pending_recovery',
    completionEvidence: { checkedItemIds: ['one'], completionMediaIds: [mediaId], submittedByActor: { id: child.id, role: 'student', secret: 'private-sentinel' },
      subjectChildId: new mongoose.Types.ObjectId(child.id), childSubmittedAt: new Date(NOW), secret: 'private-sentinel' },
    completionMediaBindings: [{ mediaId, bindingOperationId: generation }],
    completionPending: { phase: 'PUBLISHED_CLEANUP', patch: { childNote: 'private-sentinel' } }, activeCompletionOperation: { operationId: generation },
    mediaReferenceState: 'pending', mediaPendingTaskPatch: [{ path: 'title', value: 'private-sentinel' }],
    attachmentMediaBindings: [{ mediaId, bindingOperationId: generation }], attachments: [{ url: 'private-sentinel' }] } });
  const before = await snapshot(), one = await get(detail()), many = await get(list());
  expect(one.status).toBe(200); expect(one.body.data.task.completionMediaIds).toEqual([String(mediaId)]);
  expect(one.body.data.task.checklistSnapshot).toEqual([{ itemId: 'one', label: 'Synthetic check', required: true }]);
  expect(one.body.data.task.completionVersion).toBe(3); expect(many.body.data.items[0]).toEqual(one.body.data.task);
  noInternals(one.body); noInternals(many.body); expect(await snapshot()).toEqual(before);
});

test('real PUBLISHED_CLEANUP reads the new publication without unbinding or clearing its owner', async () => {
  const oldId = id(), newId = id(), identity = child, taskId = String(task._id);
  const reply = (c, state) => ({ operation: { operationId: c.remoteOperationId, commandHash: c.commandHash,
    state, leaseExpired: false }, references: c.references.map(r => ({ ...r,
    bindingOperationId: c.remoteOperationId, state: state === 'PREPARED' ? 'prepared' : 'bound' })) });
  media.prepare.mockImplementation(async c => reply(c, 'PREPARED'));
  media.commit.mockImplementation(async c => reply(c, 'COMMITTED'));
  await completion().complete({ identity, taskId, body: command(0, { completionMediaIds: [oldId], childNote: 'old' }) });
  const first = await Operation.findOne().lean();
  media.status.mockImplementation(async c => ({ operation: null,
    references: c.references.map(r => ({ ...r, state: 'bound', bindingOperationId: first.remoteOperationId })) }));
  await expect(completion().complete({ identity, taskId,
    body: command(1, { completionMediaIds: [newId], childNote: 'new' }) })).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  const pending = await Operation.findOne({ phase: 'PUBLISHED_CLEANUP' }).lean(); expect(pending).not.toBeNull();
  const before = await snapshot(), callCounts = Object.values(media).map(fn => fn.mock.calls.length);
  const one = await get(detail()), many = await get(list()); expect(one.status).toBe(200);
  expect(one.body.data.task).toMatchObject({ completionVersion: 2, completionMediaIds: [newId], childNote: 'new',
    completionMediaReferenceState: 'pending_recovery' });
  expect(many.body.data.items[0]).toEqual(one.body.data.task); noInternals(one.body);
  expect(await snapshot()).toEqual(before); expect(Object.values(media).map(fn => fn.mock.calls.length)).toEqual(callCounts);
});

test('read service independently rejects stale child identity without relying on HTTP authentication', async () => {
  await User.updateOne({ _id: child.id }, { $set: { 'childProfile.tokenVersion': 1 } });
  await expect(service.detail({ identity: child, taskId: String(task._id) })).rejects.toMatchObject({ code: 'CHILD_ACCESS_DENIED' });
  await expect(service.list({ identity: child })).rejects.toMatchObject({ code: 'CHILD_ACCESS_DENIED' });
});

test('a missing transaction or database failure never returns a partial success', async () => {
  const noTransaction = createGrowthTaskCompletionReadService({ transactionRunner: work => work({ inTransaction: () => false }) });
  await expect(noTransaction.detail({ identity: parent, taskId: String(task._id) })).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  jest.spyOn(Task, 'countDocuments').mockImplementationOnce(() => { throw Error('private-sentinel'); });
  const response = await get(list()); fail(response, 503, 'MEDIA_REFERENCE_PENDING'); noInternals(response.body);
});

test('optional completion values retain null, zero and false rather than acquiring defaults', async () => {
  await Task.collection.updateOne({ _id: task._id }, { $set: { actualMinutes: 0, actualAmount: null, needsHelp: false,
    completionEvidence: { actualMinutes: 0, actualAmount: null, needsHelp: false, checkedItemIds: [], completionMediaIds: [] } } });
  const response = await get(detail()); expect(response.status).toBe(200);
  expect(response.body.data.task).toMatchObject({ actualMinutes: 0, actualAmount: null, needsHelp: false,
    completionEvidence: { actualMinutes: 0, actualAmount: null, needsHelp: false } });
});

test.each(['confirmed', 'archived'])('%s preserves published IDs and audit without claiming media readability', async status => {
  const mediaId = new mongoose.Types.ObjectId();
  await Task.collection.updateOne({ _id: task._id }, { $set: { status, confirmedByParentId: new mongoose.Types.ObjectId(second.id),
    confirmedAt: new Date(NOW), completionVersion: 1, completionEvidence: { completionMediaIds: [mediaId] } } });
  const before = await snapshot(), response = await get(detail()); expect(response.status).toBe(200);
  expect(response.body.data.task).toMatchObject({ status, confirmedByParentId: second.id, completionMediaIds: [String(mediaId)] });
  expect(response.body.data.task).not.toHaveProperty('access'); expect(await snapshot()).toEqual(before);
});

test('factories require explicit dependencies and unknown service errors are sanitized', async () => {
  expect(() => createGrowthTaskCompletionReadService()).toThrow(); expect(() => createGrowthTaskCompletionReadRouter()).toThrow();
  jest.spyOn(service, 'detail').mockRejectedValueOnce(Error('private-sentinel'));
  const result = await get(detail()); fail(result, 500, 'INTERNAL_ERROR'); noInternals(result.body);
});
