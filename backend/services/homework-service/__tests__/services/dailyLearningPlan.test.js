const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { createHttpTestHarness } = require('../../../../common/test/httpTestHarness');
const { createIdentityHeaders } = require('../../../../common/middleware/gatewayIdentity');
const { formatLocalDate, addLocalDateDays } = require('../../../../common/utils/familyDate');
const { createProductionApp } = require('../../server');
const { createApp: createGatewayApp } = require('../../../../gateway/server');
const Plan = require('../../models/DailyLearningPlan');
const Task = require('../../models/GrowthTask');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const { request, close } = createHttpTestHarness();
const id = () => String(new mongoose.Types.ObjectId());
const env = { NODE_ENV: 'test', ENABLE_RABBITMQ: 'false', COMPLETION_PROTOCOL_MODE: 'enabled',
  RESOURCE_SERVICE_URL: 'http://127.0.0.1:1', PROGRESS_SERVICE_URL: 'http://127.0.0.1:1',
  MEDIA_REFERENCE_SERVICE_TOKEN: 'synthetic-plan-media-token-32chars',
  COMPLETION_RETIREMENT_SERVICE_TOKEN: 'synthetic-plan-retirement-token-32chars',
  INTERNAL_SERVICE_TOKEN: process.env.INTERNAL_SERVICE_TOKEN };
let app, parent, coparent, child, sibling, outsider, family, task, today;
const plans = () => mongoose.connection.collection('dailylearningplans');
const path = (date = today, childId = child.id) => `/api/children/${childId}/daily-learning-plans/${date}`;
const call = async (method, body, actor = child, url = path()) => {
  let q = (await request(app))[method](url);
  if (actor) q = q.set(createIdentityHeaders({ method: method.toUpperCase(), originalUrl: url,
    user: actor, secret: process.env.GATEWAY_IDENTITY_SECRET }));
  return body === undefined ? q : q.send(body);
};
const body = (expectedVersion = 0, items = [{ taskId: String(task._id), childEstimatedMinutes: 15 }]) => ({ expectedVersion, items });
const fail = (result, status, code) => {
  expect(result.status).toBe(status); expect(result.body).toMatchObject({ success: false, error: { code } });
};
const seedTask = extra => Task.create({ familyId: family._id, childId: child.id, createdByParentId: parent.id,
  title: 'Synthetic daily task', taskType: 'practice', dimension: 'academic', dueDate: today, estimatedMinutes: 25, ...extra });
beforeAll(async () => {
  for (const model of [Task, Family, User]) await model.init();
  if (mongoose.models.DailyLearningPlan) await mongoose.models.DailyLearningPlan.init();
});
beforeEach(async () => {
  parent = { id: id(), role: 'parent' }; coparent = { id: id(), role: 'parent' };
  outsider = { id: id(), role: 'parent' };
  child = { id: id(), role: 'student', tokenVersion: 0 }; sibling = { id: id(), role: 'student', tokenVersion: 0 };
  family = await Family.create({ familyName: 'Synthetic daily family', ownerParentId: parent.id,
    memberParentIds: [parent.id, coparent.id], childIds: [child.id, sibling.id], timezone: 'Pacific/Honolulu' });
  today = formatLocalDate(new Date(), family.timezone);
  for (const u of [child, sibling]) Object.assign(u, { familyId: String(family._id), childId: u.id });
  await User.collection.insertMany([parent, coparent, outsider, child, sibling].map(u => ({
    _id: new mongoose.Types.ObjectId(u.id), username: u.id, role: u.role, email: u.id + '@example.test',
    ...(u.role === 'student' ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {}) })));
  task = await seedTask(); app = createProductionApp({ env });
});
afterEach(async () => { jest.restoreAllMocks(); await close(); });

test('formal GET returns version zero and null audit without creating or modifying anything', async () => {
  const before = await Task.collection.findOne({ _id: task._id });
  const r = await call('get'); expect(r.status).toBe(200);
  expect(r.body).toMatchObject({ success: true, data: { plan: { childId: child.id, localDate: today,
    version: 0, items: [], updatedByActor: null } } });
  expect(await plans().countDocuments()).toBe(0);
  expect(await Task.collection.findOne({ _id: task._id })).toEqual(before);
});

test('save, read, reorder and clear preserve actual estimate provenance and all task business fields', async () => {
  const second = await seedTask({ title: 'Second task' }), before = await Task.collection.find().toArray();
  let r = await call('put', body()); expect(r.status).toBe(200);
  expect(r.body.data.plan).toMatchObject({ version: 1, updatedByActor: { actorId: child.id, role: 'student' },
    items: [{ taskId: String(task._id), childEstimatedMinutes: 15, estimateRecordedBy: { actorId: child.id, role: 'student' } }] });
  const items = [{ taskId: String(second._id), childEstimatedMinutes: 5 }, ...body().items];
  r = await call('put', body(1, items), parent); expect(r.status).toBe(200);
  expect(r.body.data.plan.items[0].estimateRecordedBy).toEqual({ actorId: parent.id, role: 'parent' });
  expect(r.body.data.plan.items[1].estimateRecordedBy.actorId).toBe(child.id);
  r = await call('put', body(2, items.slice().reverse()), coparent); expect(r.status).toBe(200);
  expect(r.body.data.plan.updatedByActor.actorId).toBe(coparent.id);
  expect(r.body.data.plan.items.map(i => i.estimateRecordedBy.actorId)).toEqual([child.id, parent.id]);
  expect((await call('get')).body).toEqual(r.body);
  r = await call('put', body(3, [{ taskId: String(task._id), childEstimatedMinutes: null }]), parent);
  expect(r.status).toBe(200); expect(r.body.data.plan.items[0]).toMatchObject({ childEstimatedMinutes: null, estimateRecordedBy: null });
  const after = await Task.collection.find().toArray();
  for (let i = 0; i < before.length; i++) {
    const { __v: _beforeVersion, ...a } = before[i], { __v: _afterVersion, ...b } = after[i]; expect(b).toEqual(a);
  }
});

test('first create and subsequent CAS each allow exactly one winner; stale replay has no side effects', async () => {
  const first = await Promise.all([call('put', body()), call('put', body(), parent)]);
  expect(first.map(r => r.status).sort()).toEqual([200, 409]); expect(await plans().countDocuments()).toBe(1);
  const next = await Promise.all([call('put', body(1, [])), call('put', body(1), coparent)]);
  expect(next.map(r => r.status).sort()).toEqual([200, 409]);
  const before = await plans().findOne({}); fail(await call('put', body(1)), 409, 'VERSION_CONFLICT');
  expect(await plans().findOne({})).toEqual(before);
});

test.each([
  { expectedVersion: -1 }, { expectedVersion: '0' }, { expectedVersion: null }, { expectedVersion: 0.5 },
  { expectedVersion: Number.MAX_SAFE_INTEGER }, { items: null }, { items: {} }, { familyId: 'forged' },
  { childId: 'forged' }, { updatedByActor: { actorId: 'forged' } }
])('rejects invalid top-level input %j without writes', async patch => {
  fail(await call('put', { ...body(), ...patch }), 400, 'VALIDATION_ERROR');
  expect(await plans().countDocuments()).toBe(0);
});
test.each([0, 241, 1.5, '15', false, {}, []])('rejects invalid estimate %j', async value => {
  fail(await call('put', body(0, [{ taskId: String(task._id), childEstimatedMinutes: value }])), 400, 'VALIDATION_ERROR');
  expect(await plans().countDocuments()).toBe(0);
});
test('rejects forged item audit, duplicate and over-limit arrays, invalid dates and query fields', async () => {
  const item = body().items[0];
  for (const items of [[{ ...item, estimateRecordedBy: child }], [item, item], Array.from({ length: 21 }, () => ({ taskId: id() })), [null]]) {
    fail(await call('put', body(0, items)), 400, 'VALIDATION_ERROR');
  }
  for (const date of ['2026-02-30', '2026-2-01', 'not-a-date']) fail(await call('get', undefined, child, path(date)), 400, 'VALIDATION_ERROR');
  fail(await call('get', undefined, child, path() + '?familyId=forged'), 400, 'VALIDATION_ERROR');
});
test('only family today is writable, historical empty GET is read-only, future is rejected', async () => {
  for (const offset of [-1, 1]) fail(await call('put', body(), child, path(addLocalDateDays(today, offset))), 409, 'LOCAL_DATE_NOT_WRITABLE');
  expect((await call('get', undefined, child, path(addLocalDateDays(today, -1)))).status).toBe(200);
  fail(await call('get', undefined, child, path(addLocalDateDays(today, 1))), 400, 'VALIDATION_ERROR');
  expect(await plans().countDocuments()).toBe(0);
});
test('missing version rejects old clients and missing items is not an implicit empty plan', async () => {
  fail(await call('put', { items: [] }), 400, 'CLIENT_UPGRADE_REQUIRED');
  fail(await call('put', { expectedVersion: 0 }), 400, 'VALIDATION_ERROR');
  expect(await plans().countDocuments()).toBe(0);
});
test('missing unique index fails closed without writes, including an empty first plan', async () => {
  await plans().dropIndex('familyId_1_childId_1_localDate_1');
  try {
    fail(await call('put', body(0, [])), 503, 'SERVICE_UNAVAILABLE');
    expect(await plans().countDocuments()).toBe(0);
  } finally { await mongoose.models.DailyLearningPlan.createIndexes(); }
});
test('20 distinct tasks and estimates at boundaries save, empty PUT retains actor and version', async () => {
  const tasks = [task]; for (let n = 1; n < 20; n++) tasks.push(await seedTask());
  const items = tasks.map((t, n) => ({ taskId: String(t._id), childEstimatedMinutes: n % 2 ? 1 : 240 }));
  expect((await call('put', body(0, items))).status).toBe(200);
  const r = await call('put', body(1, []), parent); expect(r.status).toBe(200);
  expect(r.body.data.plan).toMatchObject({ version: 2, items: [], updatedByActor: { actorId: parent.id, role: 'parent' } });
});
test('same estimate keeps unknown legacy provenance, omission clears it, changed value records actual actor', async () => {
  await call('put', body());
  await plans().updateOne({}, { $unset: { 'items.0.estimateRecordedBy': '', updatedByActor: '' } });
  let r = await call('get'); expect(r.body.data.plan.updatedByActor).toBe(null);
  expect(r.body.data.plan.items[0].estimateRecordedBy).toBe(null);
  r = await call('put', body(1), parent); expect(r.body.data.plan.items[0].estimateRecordedBy).toBe(null);
  r = await call('put', body(2, [{ taskId: String(task._id) }]), coparent);
  expect(r.body.data.plan.items[0]).toMatchObject({ childEstimatedMinutes: null, estimateRecordedBy: null });
  r = await call('put', body(3), coparent);
  expect(r.body.data.plan.items[0].estimateRecordedBy).toEqual({ actorId: coparent.id, role: 'parent' });
});
test('three children have independent plans on the same day and task scope cannot be forged', async () => {
  const third = { id: id(), role: 'student', tokenVersion: 0, familyId: String(family._id) };
  await User.collection.insertOne({ _id: new mongoose.Types.ObjectId(third.id), role: 'student', familyId: family._id, childProfile: { tokenVersion: 0 } });
  await Family.updateOne({ _id: family._id }, { $addToSet: { childIds: third.id } });
  for (const actor of [child, sibling, third]) {
    const r = await call('put', body(0, []), actor, path(today, actor.id)); expect(r.status).toBe(200);
    expect(r.body.data.plan.childId).toBe(actor.id);
  }
  expect(await plans().countDocuments()).toBe(3);
  fail(await call('put', body(1), sibling, path(today, sibling.id)), 404, 'RESOURCE_NOT_FOUND');
  fail(await call('put', body(1, [{ taskId: id() }])), 404, 'RESOURCE_NOT_FOUND');
});
test('missing or wrongly scoped historical reference projects null without leaking or writing', async () => {
  await call('put', body());
  await Task.collection.updateOne({ _id: task._id }, { $set: { childId: new mongoose.Types.ObjectId(sibling.id) } });
  const before = await plans().findOne({}), r = await call('get');
  expect(r.status).toBe(200); expect(r.body.data.plan.items[0].task).toBe(null);
  expect(await plans().findOne({})).toEqual(before);
});
test.each(['completed', 'cancelled', 'archived'])('a %s transition overtaking a new item fence rejects the stale plan', async status => {
  let entered, release;
  const reached = new Promise(r => { entered = r; }), held = new Promise(r => { release = r; });
  const update = Task.updateOne.bind(Task); let intercepted = false;
  jest.spyOn(Task, 'updateOne').mockImplementation(async (...args) => {
    if (args[1]?.$inc?.__v && args[2]?.timestamps === false && !intercepted) { intercepted = true; entered(); await held; }
    return update(...args);
  });
  const saving = call('put', body());
  try {
    await reached;
    await Task.collection.updateOne({ _id: task._id }, { $set: { status }, $inc: { __v: 1 } });
    const before = await Task.collection.findOne({ _id: task._id }); release();
    fail(await saving, 409, 'TASK_STATE_CONFLICT'); expect(await plans().countDocuments()).toBe(0);
    expect(await Task.collection.findOne({ _id: task._id })).toEqual(before);
  } finally { release(); await saving; }
});
test('transaction failure rolls back task fences and plan; unknown committed outcome is read then CAS-conflicted', async () => {
  const { createDailyLearningPlanService } = require('../../services/dailyLearningPlanService');
  const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');
  const input = { identity: child, childId: child.id, localDate: today, body: body() };
  const before = await Task.collection.findOne({ _id: task._id });
  const rollback = createDailyLearningPlanService({ transactionRunner: work => runMongoTransaction({ mongooseInstance: mongoose,
    work: async session => { await work(session); throw Error('synthetic rollback'); } }) });
  await expect(rollback.put(input)).rejects.toMatchObject({ statusCode: 503 });
  expect(await plans().countDocuments()).toBe(0); expect(await Task.collection.findOne({ _id: task._id })).toEqual(before);
  const unknown = createDailyLearningPlanService({ transactionRunner: async work => {
    await runMongoTransaction({ mongooseInstance: mongoose, work }); throw Error('synthetic unknown commit');
  } });
  await expect(unknown.put(input)).rejects.toMatchObject({ statusCode: 503 });
  const saved = await plans().findOne({}); expect(saved.version).toBe(1);
  fail(await call('put', body()), 409, 'VERSION_CONFLICT'); expect(await plans().findOne({})).toEqual(saved);
  expect((await call('get')).body.data.plan.items[0].childEstimatedMinutes).toBe(15);
});
test('family clock crossing midnight before persistence rolls back the item fence', async () => {
  const { createDailyLearningPlanService } = require('../../services/dailyLearningPlanService');
  let clock = Date.parse('2026-10-26T09:59:59Z');
  const service = createDailyLearningPlanService({ now: () => clock });
  const before = await Task.collection.findOne({ _id: task._id });
  const update = Task.updateOne.bind(Task);
  jest.spyOn(Task, 'updateOne').mockImplementation(async (...args) => {
    const result = await update(...args); clock = Date.parse('2026-10-26T10:00:00Z'); return result;
  });
  await expect(service.put({ identity: child, childId: child.id, localDate: '2026-10-25', body: body() }))
    .rejects.toMatchObject({ statusCode: 409, code: 'LOCAL_DATE_NOT_WRITABLE' });
  expect(await plans().countDocuments()).toBe(0); expect(await Task.collection.findOne({ _id: task._id })).toEqual(before);
});

test('the same pending task can be planned across family midnight with independent daily versions', async () => {
  const { createDailyLearningPlanService } = require('../../services/dailyLearningPlanService');
  let clock = Date.parse('2026-10-26T09:59:59Z');
  const service = createDailyLearningPlanService({ now: () => clock });
  const input = (localDate, expectedVersion, minutes, identity = child) => ({ identity,
    childId: child.id, localDate, body: body(expectedVersion, [{ taskId: String(task._id), childEstimatedMinutes: minutes }]) });
  const beforeTask = await Task.collection.findOne({ _id: task._id });
  const yesterday = await service.put(input('2026-10-25', 0, 15, parent));
  expect(yesterday.data.plan).toMatchObject({ localDate: '2026-10-25', version: 1,
    items: [{ taskId: String(task._id), childEstimatedMinutes: 15 }] });
  const oldPlan = await plans().findOne({ localDate: '2026-10-25' });

  clock = Date.parse('2026-10-26T10:00:01Z');
  const firstToday = await service.put(input('2026-10-26', 0, 30));
  expect(firstToday.data.plan).toMatchObject({ localDate: '2026-10-26', version: 1,
    items: [{ taskId: String(task._id), childEstimatedMinutes: 30, estimateRecordedBy: { actorId: child.id, role: 'student' } }] });
  const updatedToday = await service.put(input('2026-10-26', 1, 45, coparent));
  expect(updatedToday.data.plan.version).toBe(2);
  expect(await service.get(input('2026-10-25', 1, 15))).toEqual(yesterday);
  await expect(service.put(input('2026-10-25', 1, 20))).rejects.toMatchObject({ statusCode: 409, code: 'LOCAL_DATE_NOT_WRITABLE' });
  expect(await plans().findOne({ localDate: '2026-10-25' })).toEqual(oldPlan);
  expect(await plans().countDocuments()).toBe(2);
  expect(await Task.collection.findOne({ _id: task._id })).toEqual({ ...beforeTask, __v: beforeTask.__v + 2 });
});

test('access is live, siblings and outsiders denied, unauthenticated and stale tokens rejected', async () => {
  for (const actor of [sibling, outsider]) {
    fail(await call('get', undefined, actor), 403, 'CHILD_ACCESS_DENIED');
    fail(await call('put', body(), actor), 403, 'CHILD_ACCESS_DENIED');
  }
  await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: coparent.id } });
  fail(await call('put', body(), coparent), 403, 'CHILD_ACCESS_DENIED');
  fail(await call('get', undefined, null), 401, 'INVALID_IDENTITY_ENVELOPE');
  await User.updateOne({ _id: child.id }, { $set: { 'childProfile.tokenVersion': 1 } });
  fail(await call('put', body()), 401, 'STALE_CHILD_TOKEN'); expect(await plans().countDocuments()).toBe(0);
});
test.each(['completed', 'confirmed', 'cancelled', 'archived'])('rejects new %s items but projects existing task state without copying it', async status => {
  expect((await call('put', body())).status).toBe(200);
  await Task.collection.updateOne({ _id: task._id }, { $set: { status } });
  const read = await call('get'); expect(read.status).toBe(200);
  expect(read.body.data.plan.items[0].task).toMatchObject({ status, taskId: String(task._id) });
  expect((await call('put', body(1))).status).toBe(200);
  expect((await call('put', body(2, []))).status).toBe(200);
  fail(await call('put', body(3)), 409, 'TASK_STATE_CONFLICT');
  expect((await plans().findOne({})).items).toEqual([]);
});

const gatewayClient = async () => {
  const home = await request(app);
  const host = new URL(home.get('/').url).origin;
  const gateway = createGatewayApp({ serviceHosts: { homework: host, user: host },
    jwtSecret: process.env.JWT_SECRET, identitySecret: process.env.GATEWAY_IDENTITY_SECRET });
  return request(gateway);
};
const rawGatewayPut = (client, raw, actor = parent) => {
  const q = client.put(path()).set('Content-Type', 'application/json');
  if (actor) q.set('Authorization', 'Bearer ' + jwt.sign(actor, process.env.JWT_SECRET));
  return q.send(raw);
};

test.each([
  ['positive overflow', taskId => `{"expectedVersion":1,"items":[{"taskId":"${taskId}","childEstimatedMinutes":1e309}]}`],
  ['negative overflow', taskId => `{"expectedVersion":1,"items":[{"taskId":"${taskId}","childEstimatedMinutes":-1e309}]}`],
  ['top-level dollar key', () => '{"expectedVersion":1,"items":[],"$unknown":true}'],
  ['top-level dotted key', () => '{"expectedVersion":1,"items":[],"unknown.field":true}'],
  ['item dollar key', taskId => `{"expectedVersion":1,"items":[{"taskId":"${taskId}","$unknown":true}]}`],
  ['item dotted key', taskId => `{"expectedVersion":1,"items":[{"taskId":"${taskId}","unknown.field":true}]}`]
])('real Gateway and formal homework reject raw %s without changing plan, audit or tasks', async (_label, raw) => {
  const client = await gatewayClient();
  expect((await rawGatewayPut(client, JSON.stringify(body()))).status).toBe(200);
  const beforePlan = await plans().findOne({});
  const beforeTasks = await Task.collection.find().sort({ _id: 1 }).toArray();
  const result = await rawGatewayPut(client, raw(String(task._id)), coparent);
  // Check persisted effects even when the HTTP rejection itself regresses.
  expect(await plans().findOne({})).toEqual(beforePlan);
  expect(await Task.collection.find().sort({ _id: 1 }).toArray()).toEqual(beforeTasks);
  fail(result, 400, 'VALIDATION_ERROR');
});

test('real Gateway retains missing-version, valid estimate and explicit clearing semantics', async () => {
  const client = await gatewayClient();
  fail(await rawGatewayPut(client, '{"items":[]}'), 400, 'CLIENT_UPGRADE_REQUIRED');
  expect((await rawGatewayPut(client, JSON.stringify(body()))).status).toBe(200);
  const cleared = await rawGatewayPut(client, JSON.stringify(body(1, [{ taskId: String(task._id), childEstimatedMinutes: null }])));
  expect(cleared.status).toBe(200);
  expect(cleared.body.data.plan).toMatchObject({ version: 2, updatedByActor: { actorId: parent.id, role: 'parent' },
    items: [{ childEstimatedMinutes: null, estimateRecordedBy: null }] });
});

test.each(['empty', 'disjoint tasks'])('controlled first-create race with %s rolls back the losing transaction', async kind => {
  const second = await seedTask({ title: 'Other candidate' });
  const beforeTasks = await Task.collection.find().sort({ _id: 1 }).toArray();
  const candidates = kind === 'empty' ? [[], []] : [[{ taskId: String(task._id) }], [{ taskId: String(second._id) }]];
  const create = Plan.create.bind(Plan);
  let arrivals = 0, release, timer;
  const gate = new Promise((resolve, reject) => {
    release = resolve;
    timer = setTimeout(() => reject(new Error('Both first-create transactions must reach the barrier')), 5000);
  });
  // Both transactions have read absence and applied any task fences before either inserts.
  jest.spyOn(Plan, 'create').mockImplementation(async (...args) => {
    arrivals += 1;
    if (arrivals === 2) { clearTimeout(timer); release(); }
    await gate;
    return create(...args);
  });
  const saves = [call('put', body(0, candidates[0])), call('put', body(0, candidates[1]), coparent)];
  try {
    const results = await Promise.all(saves);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    fail(results.find(r => r.status === 409), 409, 'VERSION_CONFLICT');
    expect(await plans().countDocuments()).toBe(1);
    const winner = results.findIndex(r => r.status === 200), saved = await plans().findOne({});
    expect(saved).toMatchObject({ version: 1, updatedByActor: { actorId: new mongoose.Types.ObjectId(winner === 0 ? child.id : coparent.id) } });
    expect(saved.items.map(i => String(i.taskId))).toEqual(candidates[winner].map(i => i.taskId));
    for (const before of beforeTasks) {
      const after = await Task.collection.findOne({ _id: before._id });
      const addedByWinner = candidates[winner].some(i => i.taskId === String(before._id));
      expect(after).toEqual({ ...before, __v: before.__v + (addedByWinner ? 1 : 0) });
    }
  } finally { clearTimeout(timer); release(); await Promise.allSettled(saves); }
});

test.each([
  ['non-unique', { unique: false }],
  ['sparse', { unique: true, sparse: true }],
  ['partial', { unique: true, partialFilterExpression: { localDate: { $gte: '2000-01-01' } } }],
  ['non-simple collation', { unique: true, collation: { locale: 'en', strength: 2 } }]
])('a %s index fails closed for existing and first plans before any task fence', async (_label, options) => {
  expect((await call('put', body())).status).toBe(200);
  const second = await seedTask();
  const beforePlan = await plans().findOne({}), beforeTasks = await Task.collection.find().sort({ _id: 1 }).toArray();
  const name = 'familyId_1_childId_1_localDate_1';
  await plans().dropIndex(name);
  try {
    await plans().createIndex({ familyId: 1, childId: 1, localDate: 1 }, options);
    fail(await call('put', body(1, [{ taskId: String(second._id) }]), coparent), 503, 'SERVICE_UNAVAILABLE');
    fail(await call('put', body(0, []), sibling, path(today, sibling.id)), 503, 'SERVICE_UNAVAILABLE');
    expect(await plans().countDocuments()).toBe(1);
    expect(await plans().findOne({})).toEqual(beforePlan);
    expect(await Task.collection.find().sort({ _id: 1 }).toArray()).toEqual(beforeTasks);
  } finally {
    const indexes = await plans().indexes();
    if (indexes.some(index => index.name === name)) await plans().dropIndex(name);
    await Plan.createIndexes();
  }
});

test('a deleted reference stays read-only, cannot be retained, and can be explicitly removed', async () => {
  expect((await call('put', body())).status).toBe(200);
  await Task.collection.deleteOne({ _id: task._id });
  const before = await plans().findOne({});
  const read = await call('get'); expect(read.status).toBe(200);
  expect(read.body.data.plan.items[0]).toMatchObject({ taskId: String(task._id), task: null,
    childEstimatedMinutes: 15, estimateRecordedBy: { actorId: child.id, role: 'student' } });
  expect(await plans().findOne({})).toEqual(before);
  fail(await call('put', body(1), coparent), 404, 'RESOURCE_NOT_FOUND');
  expect(await plans().findOne({})).toEqual(before);
  const removed = await call('put', body(1, []), parent); expect(removed.status).toBe(200);
  expect(removed.body.data.plan).toMatchObject({ items: [], version: 2, updatedByActor: { actorId: parent.id, role: 'parent' } });
  expect(await Task.countDocuments()).toBe(0);
});

test('a real paused unique index build rejects simultaneous first PUTs without writes', async () => {
  const { MongoMemoryReplSet } = require('mongodb-memory-server');
  const { createDailyLearningPlanService } = require('../../services/dailyLearningPlanService');
  const originalUri = mongoose.connection.getClient().s.url;
  const users = await User.collection.find().toArray();
  const familyRecord = family.toObject(), taskRecord = task.toObject();
  const server = await MongoMemoryReplSet.create({ replSet: { count: 1 },
    instanceOpts: [{ args: ['--setParameter', 'enableTestCommands=1'] }] });
  let admin, build, pending, release, timer, buildResult;
  const create = Plan.create.bind(Plan);
  try {
    // The service uses default-connection models; isolate this failpoint without changing shared setup.
    await mongoose.disconnect();
    await mongoose.connect(server.getUri(), { autoIndex: false, autoCreate: false });
    for (const model of [Plan, Task, Family, User]) await model.createCollection();
    await User.collection.insertMany(users);
    await Family.collection.insertOne(familyRecord);
    await Task.collection.insertOne(taskRecord);
    await Plan.collection.insertOne({ familyId: family._id, childId: new mongoose.Types.ObjectId(child.id),
      localDate: '2026-10-25', version: 1, items: [] });
    const before = await Plan.collection.find().toArray();
    admin = mongoose.connection.db.admin();
    const point = await admin.command({ configureFailPoint: 'hangAfterStartingIndexBuild', mode: 'alwaysOn' });
    build = Plan.collection.createIndex({ familyId: 1, childId: 1, localDate: 1 }, { unique: true })
      .then(() => ({ ok: true }), cause => ({ ok: false, code: cause.code }));
    await admin.command({ waitForFailPoint: 'hangAfterStartingIndexBuild', timesEntered: point.count + 1, maxTimeMS: 5000 });
    // The lossy driver listing really advertises the unfinished index as unique.
    expect((await Plan.collection.indexes()).some(index => index.unique && index.key.localDate === 1)).toBe(true);
    let arrivals = 0;
    const gate = new Promise((resolve, reject) => {
      release = resolve;
      timer = setTimeout(() => reject(new Error('Both unsafe first creates must reach the barrier')), 5000);
    });
    gate.catch(() => {});
    jest.spyOn(Plan, 'create').mockImplementation(async (...args) => {
      if (++arrivals === 2) { clearTimeout(timer); release(); }
      await gate;
      return create(...args);
    });
    const service = createDailyLearningPlanService({ now: () => Date.parse('2026-10-26T12:00:00Z') });
    const input = { identity: child, childId: child.id, localDate: '2026-10-26', body: body(0, []) };
    pending = Promise.all([service.put(input), service.put(input)].map(promise => promise.then(
      result => ({ status: 200, version: result.data.plan.version }),
      cause => ({ status: cause.statusCode, code: cause.code }))));
    expect(await pending).toEqual([{ status: 503, code: 'SERVICE_UNAVAILABLE' }, { status: 503, code: 'SERVICE_UNAVAILABLE' }]);
    expect(await Plan.collection.find().toArray()).toEqual(before);
    expect(await Task.collection.findOne({ _id: task._id })).toEqual(taskRecord);
    await admin.command({ configureFailPoint: 'hangAfterStartingIndexBuild', mode: 'off' });
    buildResult = await build;
    expect(buildResult).toEqual({ ok: true });
    jest.restoreAllMocks();
    expect((await service.put(input)).data.plan.version).toBe(1);
  } finally {
    clearTimeout(timer); release?.();
    try {
      if (admin) await admin.command({ configureFailPoint: 'hangAfterStartingIndexBuild', mode: 'off' });
      if (build) buildResult = await build;
      if (pending) await pending;
    } finally {
      jest.restoreAllMocks();
      await mongoose.disconnect();
      try { await server.stop(); }
      finally { await mongoose.connect(originalUri, { autoIndex: true, autoCreate: true }); }
    }
  }
});

test('a prepareUnique index cannot authorize plan writes', async () => {
  const name = 'familyId_1_childId_1_localDate_1';
  const beforeTask = await Task.collection.findOne({ _id: task._id });
  await plans().dropIndex(name);
  try {
    await plans().createIndex({ familyId: 1, childId: 1, localDate: 1 }, { name });
    await mongoose.connection.db.command({ collMod: 'dailylearningplans', index: { name, prepareUnique: true } });
    fail(await call('put', body()), 503, 'SERVICE_UNAVAILABLE');
    expect(await plans().countDocuments()).toBe(0);
    expect(await Task.collection.findOne({ _id: task._id })).toEqual(beforeTask);
  } finally { await plans().dropIndex(name); await Plan.createIndexes(); }
});
