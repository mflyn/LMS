const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const { createHttpTestHarness } = require('../../../../common/test/httpTestHarness');
const { createIdentityHeaders } = require('../../../../common/middleware/gatewayIdentity');
const { createProductionApp } = require('../../server');
const Task = require('../../models/GrowthTask');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const Operation = require('../../models/GrowthTaskCompletionOperation');
const Guard = require('../../models/CompletionMediaGuard');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');
const { createGrowthTaskCompletionConfirmationService } = require('../../services/growthTaskCompletionConfirmationService');
const { createGrowthTaskHelpService } = require('../../services/growthTaskHelpService');
const { request, close } = createHttpTestHarness();
const id = () => String(new mongoose.Types.ObjectId());
const env = { NODE_ENV: 'test', ENABLE_RABBITMQ: 'false', COMPLETION_PROTOCOL_MODE: 'enabled',
  RESOURCE_SERVICE_URL: 'http://127.0.0.1:1', PROGRESS_SERVICE_URL: 'http://127.0.0.1:1',
  MEDIA_REFERENCE_SERVICE_TOKEN: 'synthetic-help-media-token-32chars',
  COMPLETION_RETIREMENT_SERVICE_TOKEN: 'synthetic-help-retirement-token-32chars',
  INTERNAL_SERVICE_TOKEN: process.env.INTERNAL_SERVICE_TOKEN, STAR_AWARD_RETRY_ATTEMPTS: '0' };
let app, parent, coparent, child, sibling, outsider, family, task;
const row = () => Task.collection.findOne({ _id: task._id });
const base = () => '/api/growth-tasks/' + task._id;
const command = (expectedHelpVersion = 0, extra = {}) => ({ action: 'request', expectedHelpVersion,
  helpType: 'stuck_midway', note: 'Synthetic question', ...extra });
const call = async (method, url, body, actor = child) => {
  let q = (await request(app))[method](url);
  if (actor) q = q.set(createIdentityHeaders({ method: method.toUpperCase(), originalUrl: url, user: actor,
    secret: process.env.GATEWAY_IDENTITY_SECRET }));
  return body === undefined ? q : q.send(body);
};
const help = (body = command(), actor = child) => call('patch', base() + '/help', body, actor);
const resolve = (version = 1, actor = parent) => help({ action: 'resolve', expectedHelpVersion: version,
  parentResponse: 'Try drawing first' }, actor);
const fail = (r, status, code) => {
  expect(r.status).toBe(status); expect(r.body).toMatchObject({ success: false, error: { code } });
};
const seedTask = extra => Task.create({ childId: child.id, familyId: family._id, createdByParentId: parent.id,
  title: 'Synthetic help', taskType: 'practice', dimension: 'academic', dueDate: '2026-01-01', ...extra });
beforeAll(async () => { for (const m of [Task, Family, User, Operation, Guard]) await m.init(); });
beforeEach(async () => {
  parent = { id: id(), role: 'parent' }; coparent = { id: id(), role: 'parent' };
  outsider = { id: id(), role: 'parent' }; child = { id: id(), role: 'student', tokenVersion: 0 };
  sibling = { id: id(), role: 'student', tokenVersion: 0 };
  family = await Family.create({ familyName: 'Synthetic help family', ownerParentId: parent.id,
    memberParentIds: [parent.id, coparent.id], childIds: [child.id, sibling.id] });
  for (const u of [child, sibling]) Object.assign(u, { familyId: String(family._id), childId: u.id });
  await User.collection.insertMany([parent, coparent, outsider, child, sibling].map(u => ({
    _id: new mongoose.Types.ObjectId(u.id), username: u.id, role: u.role, email: u.id + '@example.test',
    ...(u.role === 'student' ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {}) })));
  task = await seedTask(); app = createProductionApp({ env });
});
afterEach(async () => { jest.restoreAllMocks(); await close(); });

test('legacy GET projects version zero and null without writing or deriving a request from needsHelp', async () => {
  await Task.collection.updateOne({ _id: task._id }, { $set: { needsHelp: true }, $unset: { helpVersion: '', helpRequest: '' } });
  const before = await row(), r = await call('get', base());
  expect(r.status).toBe(200); expect(r.body.data.task).toMatchObject({ helpVersion: 0, helpRequest: null, needsHelp: true });
  expect(await row()).toEqual(before);
});

test('formal request and resolve persist actual actors, normalize text, preserve all teaching fields, and allow a new request', async () => {
  const before = await row(); const r = await help(command(0, { note: '  e\u0301 😀  ' }));
  expect(r.status).toBe(200); expect(r.body.data.task).toMatchObject({ status: 'pending', completionVersion: 0,
    helpVersion: 1, helpRequest: { status: 'pending', note: 'é 😀', requestedByActor: { id: child.id, role: 'student' } } });
  expect(Number.isFinite(Date.parse(r.body.data.task.helpRequest.requestedAt))).toBe(true);
  const after = await row(); for (const key of Object.keys(before).filter(k => !['__v', 'updatedAt', 'helpVersion', 'helpRequest'].includes(k))) {
    expect(after[key]).toEqual(before[key]);
  }
  expect(await Operation.countDocuments()).toBe(0); expect(await Guard.countDocuments()).toBe(0);
  const done = await resolve(1, coparent); expect(done.status).toBe(200);
  expect(done.body.data.task).toMatchObject({ status: 'pending', helpVersion: 2, helpRequest: {
    status: 'resolved', parentResponse: 'Try drawing first', resolvedByActor: { id: coparent.id, role: 'parent' } } });
  expect((await help(command(2))).body.data.task).toMatchObject({ helpVersion: 3, helpRequest: { status: 'pending' } });
  expect((await row()).helpRequest).not.toHaveProperty('resolvedAt');
  expect((await row()).helpRequest).not.toHaveProperty('parentResponse');
});

test.each(['instruction_unclear', 'cannot_start', 'stuck_midway', 'uncertain_result', 'fatigued', 'other'])('accepts type %s and optional note', async helpType => {
  const r = await help({ action: 'request', expectedHelpVersion: 0, helpType }, parent);
  expect(r.status).toBe(200); expect(r.body.data.task.helpRequest).toMatchObject({ helpType, note: '', requestedByActor: parent });
});

test.each([
  { expectedHelpVersion: -1 }, { expectedHelpVersion: 0.5 }, { expectedHelpVersion: '0' },
  { expectedHelpVersion: Number.MAX_SAFE_INTEGER + 1 }, { expectedHelpVersion: null },
  { helpType: 'unknown' }, { note: null }, { note: 12 }, { note: 'x'.repeat(201) },
  { action: 'delete' }, { familyId: 'forged' }, { requestedAt: '2020-01-01' },
  { requestedByActor: { id: 'forged' } }, { parentResponse: 'forged' }, { supportLevelUsed: 'S4' }
])('rejects malformed or forged request %j without writes', async extra => {
  const before = await row(); fail(await help(command(0, extra)), 400, 'VALIDATION_ERROR'); expect(await row()).toEqual(before);
});
test('unicode code point boundary is 200 after NFC and trim, not UTF16 units', async () => {
  expect((await help(command(0, { note: '  ' + '😀'.repeat(200) + '  ' }))).status).toBe(200);
  fail(await help(command(1, { note: '😀'.repeat(201) })), 400, 'VALIDATION_ERROR');
});
test.each([{ parentResponse: null }, { parentResponse: 'x'.repeat(201) }, { note: 'unexpected' },
  { resolvedByActor: { id: 'forged' } }, { resolvedAt: 'forged' }])('resolve rejects invalid fields %j', async extra => {
  await help(); const before = await row(); fail(await help({ action: 'resolve', expectedHelpVersion: 1, ...extra }, parent), 400, 'VALIDATION_ERROR');
  expect(await row()).toEqual(before);
});

test('only exact actor/version/body pending request replays with unchanged audit and metadata', async () => {
  const first = await help(), before = await row(); expect(first.status).toBe(200);
  const replay = await help(command(0, { note: ' Synthetic question ' })); expect(replay.status).toBe(200);
  expect(replay.body).toEqual(first.body); expect(await row()).toEqual(before);
  fail(await help(command(), parent), 409, 'VERSION_CONFLICT');
  fail(await help(command(0, { note: 'changed' })), 409, 'VERSION_CONFLICT');
  expect((await help(command(1))).status).toBe(200);
  fail(await help(command()), 409, 'VERSION_CONFLICT');
  expect((await resolve(2)).status).toBe(200);
  fail(await help(command(2)), 409, 'VERSION_CONFLICT');
});
test('child cannot resolve and forbidden actors cannot read or write help', async () => {
  await help(); const before = await row(); fail(await resolve(1, child), 403, 'CHILD_ACCESS_DENIED');
  for (const actor of [sibling, outsider]) { fail(await help(command(1), actor), 403, 'CHILD_ACCESS_DENIED');
    fail(await call('get', base(), undefined, actor), 403, 'CHILD_ACCESS_DENIED'); }
  await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: coparent.id } });
  fail(await resolve(1, coparent), 403, 'CHILD_ACCESS_DENIED');
  fail(await help(command(), null), 401, 'INVALID_IDENTITY_ENVELOPE');
  await User.updateOne({ _id: child.id }, { $set: { 'childProfile.tokenVersion': 1 } });
  fail(await help(), 401, 'STALE_CHILD_TOKEN'); expect(await row()).toEqual(before);
});
test.each(['completed', 'confirmed', 'cancelled', 'archived'])('new request rejects %s but completed/confirmed pending help remains resolvable', async status => {
  await help(); await Task.collection.updateOne({ _id: task._id }, { $set: { status } });
  fail(await help(command(1)), 409, 'TASK_STATE_CONFLICT');
  if (['completed', 'confirmed'].includes(status)) {
    expect((await help(command())).status).toBe(200); expect((await resolve()).status).toBe(200);
    expect((await row()).status).toBe(status);
  } else { const before = await row(); fail(await resolve(), 409, 'TASK_STATE_CONFLICT');
    fail(await help(command()), 409, 'TASK_STATE_CONFLICT'); expect(await row()).toEqual(before); }
});
test('two parents resolving one version produce exactly one update, and old resolve cannot close a newer request', async () => {
  await help(); const results = await Promise.all([resolve(1, parent), resolve(1, coparent)]);
  expect(results.map(r => r.status).sort()).toEqual([200, 409]);
  expect((await row()).helpVersion).toBe(2); expect((await help(command(2))).status).toBe(200);
  fail(await resolve(1), 409, 'VERSION_CONFLICT'); expect((await row()).helpRequest.status).toBe('pending');
});
test('helpVersion overflow rejects without writing', async () => {
  await Task.collection.updateOne({ _id: task._id }, { $set: { helpVersion: Number.MAX_SAFE_INTEGER } });
  const before = await row(); fail(await help(command(Number.MAX_SAFE_INTEGER)), 409, 'VERSION_CONFLICT'); expect(await row()).toEqual(before);
});
test('list filters across dates and states, excludes cancelled/archived, and preserves pagination', async () => {
  await help(); const template = (await row()).helpRequest;
  const done = await seedTask({ status: 'completed', helpVersion: 1, helpRequest: template });
  await seedTask({ status: 'cancelled', helpVersion: 1, helpRequest: template });
  await seedTask({ status: 'archived', helpVersion: 1, helpRequest: template });
  await seedTask({ childId: sibling.id, helpVersion: 1, helpRequest: template });
  const url = '/api/growth-tasks?childId=' + child.id + '&helpStatus=pending&pageSize=1';
  const before = await Task.collection.find().toArray(); const a = await call('get', url + '&page=1', undefined, parent);
  const b = await call('get', url + '&page=2', undefined, parent);
  expect(a.status).toBe(200); expect(a.body.data.total).toBe(2); expect(b.body.data.total).toBe(2);
  expect(new Set([a.body.data.items[0].taskId, b.body.data.items[0].taskId])).toEqual(new Set([String(task._id), String(done._id)]));
  expect(await Task.collection.find().toArray()).toEqual(before);
  fail(await call('get', '/api/growth-tasks?childId=' + child.id + '&helpStatus=bad', undefined, parent), 400, 'VALIDATION_ERROR');
});
test('completion and confirmation preserve current help, and resolving does not alter completion or award state', async () => {
  await help(); const original = (await row()).helpRequest;
  const completed = await call('patch', base() + '/complete', { operationId: randomUUID(), expectedCompletionVersion: 0,
    expectedChecklistVersion: 0, checkedItemIds: [], completionMediaIds: [], needsHelp: false });
  expect(completed.status).toBe(200); expect((await row()).helpRequest).toEqual(original);
  const award = jest.fn(async () => ({ awarded: true, ledgerEntryId: id(), starBalance: 1 }));
  const service = createGrowthTaskCompletionConfirmationService({ transactionRunner: work => runMongoTransaction({ mongooseInstance: mongoose, work }), awardTaskStar: award });
  await service.confirm({ identity: parent, taskId: String(task._id), body: { expectedCompletionVersion: 1, parentFeedback: 'Reviewed' } });
  expect((await row()).helpRequest).toEqual(original); const before = await row(), calls = award.mock.calls.length;
  expect((await resolve()).status).toBe(200); const after = await row();
  for (const k of ['status', 'completionVersion', 'completionEvidence', 'starAwardState', 'parentFeedback', 'confirmedAt', 'confirmedByParentId']) expect(after[k]).toEqual(before[k]);
  expect(award).toHaveBeenCalledTimes(calls);
});

test.each(['complete', 'cancel', 'archive'])('a competing %s after the help snapshot cannot be bypassed by the final update', async action => {
  if (action === 'archive') {
    await help();
    expect((await call('patch', base() + '/complete', { operationId: randomUUID(), expectedCompletionVersion: 0,
      expectedChecklistVersion: 0, checkedItemIds: [], completionMediaIds: [] })).status).toBe(200);
  }
  let entered, release;
  const reached = new Promise(resolve => { entered = resolve; }), held = new Promise(resolve => { release = resolve; });
  const original = Task.updateOne.bind(Task); let intercepted = false;
  jest.spyOn(Task, 'updateOne').mockImplementation(async (...args) => {
    if (args[1]?.$set?.helpRequest && !intercepted) { intercepted = true; entered(); await held; }
    return original(...args);
  });
  const pendingHelp = action === 'archive' ? resolve() : help();
  try {
    await reached;
    const other = action === 'complete'
      ? await call('patch', base() + '/complete', { operationId: randomUUID(), expectedCompletionVersion: 0,
        expectedChecklistVersion: 0, checkedItemIds: [], completionMediaIds: [], childNote: 'Concurrent work' })
      : await call('delete', base(), undefined, parent);
    expect(other.status).toBe(200);
    const before = await row(); release();
    fail(await pendingHelp, 409, 'TASK_STATE_CONFLICT'); expect(await row()).toEqual(before);
  } finally { release(); await pendingHelp; }
});

test('a request overtaking an old resolve cannot be closed by its stale transaction', async () => {
  await help(); let entered, release;
  const reached = new Promise(r => { entered = r; }), held = new Promise(r => { release = r; });
  const original = Task.updateOne.bind(Task); let intercepted = false;
  jest.spyOn(Task, 'updateOne').mockImplementation(async (...args) => {
    if (args[1]?.$set?.helpRequest?.status === 'resolved' && !intercepted) { intercepted = true; entered(); await held; }
    return original(...args);
  });
  const oldResolve = resolve();
  try {
    await reached; expect((await help(command(1, { note: 'New question' }))).status).toBe(200);
    const before = await row(); release(); fail(await oldResolve, 409, 'VERSION_CONFLICT');
    expect(await row()).toEqual(before); expect(before.helpRequest.status).toBe('pending');
  } finally { release(); await oldResolve; }
});

test('aborted transaction leaves no help, while unknown commit recovers only via exact request replay', async () => {
  const input = { identity: child, taskId: String(task._id), body: command() }, before = await row();
  const rollback = createGrowthTaskHelpService({ transactionRunner: work => runMongoTransaction({ mongooseInstance: mongoose,
    work: async session => { await work(session); throw Error('synthetic abort'); } }) });
  await expect(rollback.update(input)).rejects.toMatchObject({ statusCode: 503, code: 'HELP_UPDATE_PENDING' });
  expect(await row()).toEqual(before);
  const uncertain = createGrowthTaskHelpService({ transactionRunner: async work => {
    await runMongoTransaction({ mongooseInstance: mongoose, work }); throw Error('synthetic lost commit response');
  } });
  await expect(uncertain.update(input)).rejects.toMatchObject({ statusCode: 503, code: 'HELP_UPDATE_PENDING' });
  const committed = await row(); expect(committed.helpVersion).toBe(1);
  expect((await help()).status).toBe(200); expect(await row()).toEqual(committed);
  fail(await help(command(), parent), 409, 'VERSION_CONFLICT');
});
