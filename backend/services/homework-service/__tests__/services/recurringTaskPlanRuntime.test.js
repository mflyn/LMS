const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const Plan = require('../../models/RecurringTaskPlan');
const Command = require('../../models/RecurringTaskPlanCommand');
const Task = require('../../models/GrowthTask');
const Cursor = require('../../models/RecurringTaskScanState');
const { createRecurringTaskPlanRuntime, assertRecurringReady } = require('../../services/recurringTaskPlanRuntime');
const { createRecurringTaskPlanScanner } = require('../../services/recurringTaskPlanScanner');
const { createProductionApp, startServer } = require('../../server');
const { createApp: createGateway } = require('../../../../gateway/server');
const { createHttpTestHarness } = require('../../../../common/test/httpTestHarness');
const harness = createHttpTestHarness();
const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
const clock = () => Date.parse('2026-11-16T04:00:00Z');
const env = () => ({ NODE_ENV: 'test', COMPLETION_PROTOCOL_MODE: 'enabled', COMPLETION_WRITES_PAUSED: 'true',
  RECURRING_TASKS_ENABLED: 'true', ENABLE_RABBITMQ: 'false', MONGO_URI: mongoose.connection.client.s.url,
  RESOURCE_SERVICE_URL: 'http://127.0.0.1:1', PROGRESS_SERVICE_URL: 'http://127.0.0.1:1',
  MEDIA_REFERENCE_SERVICE_TOKEN: 'synthetic-recurring-media-token-at-least32',
  COMPLETION_RETIREMENT_SERVICE_TOKEN: 'synthetic-recurring-retirement-token-32',
  INTERNAL_SERVICE_TOKEN: 'synthetic-recurring-internal-token-atleast32' });
let parent, child, family, runtime;
const id = () => String(new mongoose.Types.ObjectId());
const body = () => ({ operationId: randomUUID(), childId: child.id, startDate: '2026-11-16', endDate: null,
  schedule: { kind: 'daily' }, template: { title: 'Synthetic exercise <5>', dimension: 'physical', taskType: 'exercise' } });
const create = input => runtime.service.execute({ identity: parent, action: 'create', body: input || body() });
const token = actor => jwt.sign(actor, process.env.JWT_SECRET, { expiresIn: '1h' });
const gateway = async app => {
  const upstream = await harness.request(app);
  const host = new URL(upstream.get('/').url).origin;
  return harness.request(createGateway({ serviceHosts: { user: host, homework: host },
    jwtSecret: process.env.JWT_SECRET, identitySecret: process.env.GATEWAY_IDENTITY_SECRET,
    rateLimitOptions: { max: 10000 }, appLogger: logger }));
};
beforeAll(async () => {
  for (const Model of [Family, User, Plan, Command, Task, Cursor,
    require('../../models/GrowthTaskCompletionOperation'), require('../../models/CompletionMediaGuard')]) await Model.init();
});
beforeEach(async () => {
  parent = { id: id(), role: 'parent' }; child = { id: id(), role: 'student', tokenVersion: 0 };
  family = await Family.create({ familyName: 'Synthetic runtime', ownerParentId: parent.id,
    memberParentIds: [parent.id], childIds: [child.id], timezone: 'Asia/Shanghai' });
  child.familyId = String(family._id); child.childId = child.id;
  await User.collection.insertMany([parent, child].map(actor => ({ _id: new mongoose.Types.ObjectId(actor.id),
    username: actor.id, email: actor.id + '@example.test', role: actor.role, status: 'active',
    ...(actor.role === 'student' ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {}) })));
  runtime = createRecurringTaskPlanRuntime({ env: env(), now: clock });
  await runtime.assertReady();
});
afterEach(async () => { await harness.close(); jest.restoreAllMocks(); jest.useRealTimers(); });

test('formal gateway and homework HTTP preserve command bytes and read-only terminal replay', async () => {
  const app = createProductionApp({ env: env(), appLogger: logger });
  await app.locals.recurringTasks.assertReady();
  const http = await gateway(app), input = body();
  // Use a current local date for the production clock, not the injected service clock.
  input.startDate = require('../../../../common/utils/familyDate').formatLocalDate(new Date(), 'Asia/Shanghai');
  const call = () => http.post('/api/recurring-task-plans').set('Authorization', 'Bearer ' + token(parent)).send(input);
  const first = await call(); expect(first.status).toBe(201); expect(first.body.success).toBe(true);
  expect(first.body.data.plan.currentRevision.template.title).toBe(input.template.title);
  expect((await call()).body).toEqual(first.body);
  const before = await Plan.find().lean();
  const result = await http.get(`/api/recurring-task-plan-commands/${input.operationId}?childId=${child.id}`)
    .set('Authorization', 'Bearer ' + token(parent));
  expect(result.status).toBe(200); expect(result.headers['cache-control']).toBe('no-store');
  expect(result.body.data.command.template.title).toBe(input.template.title);
  expect(await Plan.find().lean()).toEqual(before); expect(await Task.countDocuments()).toBe(1);
  expect(await Command.countDocuments()).toBe(1); expect(await Cursor.countDocuments()).toBe(0);
});

test('fair durable pagination visits beyond 50 despite failure and restarts without skipping a page', async () => {
  const first = (await create()).data.plan.id;
  const template = await Plan.findById(first).lean();
  await Plan.insertMany(Array.from({ length: 52 }, () => ({ ...template, _id: new mongoose.Types.ObjectId() })));
  const visited = [], generate = async ({ planId }) => { visited.push(planId); if (planId === first) throw new Error('private error'); };
  const scanner = createRecurringTaskPlanScanner({ service: { generate }, enabled: () => true });
  const one = await scanner.tick();
  expect(one).toMatchObject({ processed: 50, complete: false, failures: 1 });
  expect(await Plan.findById(first).lean()).toMatchObject({ lastFailureCode: 'RECURRING_PLAN_GENERATION_FAILED' });
  const restarted = createRecurringTaskPlanScanner({ service: { generate }, enabled: () => true });
  expect(await restarted.tick()).toMatchObject({ processed: 3, complete: true, healthy: false });
  expect(new Set(visited).size).toBe(53);
  expect((await Cursor.findById('recurring-task-plans-v1').lean()).afterId).toBeNull();
});

test('missing unique occurrence index fails readiness without automatic repair', async () => {
  await Task.collection.dropIndex('recurring_occurrence_identity');
  const before = await Task.collection.indexes();
  try { await expect(assertRecurringReady()).rejects.toMatchObject({ code: 'RECURRING_TASKS_NOT_READY' });
    expect(await Task.collection.indexes()).toEqual(before);
  } finally { const [key, options] = Task.schema.indexes().find(([, o]) => o.name === 'recurring_occurrence_identity');
    await Task.collection.createIndex(key, options); }
});

test('formal startup starts scanner only after prechecks and close drains it', async () => {
  const server = await startServer({ env: env(), host: '127.0.0.1', port: 0, appLogger: logger });
  try { expect((await request(server).get('/health')).status).toBe(200); }
  finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  expect(server.listening).toBe(false);
  expect(await Cursor.countDocuments()).toBe(1);
});

const productionHttp = async (overrides = {}) => {
  const app = createProductionApp({ env: { ...env(), ...overrides }, appLogger: logger });
  await app.locals.recurringTasks.assertReady();
  return gateway(app);
};
const auth = (http, method, path, actor = parent) => http[method](path).set('Authorization', 'Bearer ' + token(actor));
test('HTTP reads are paged, actor scoped and zero-write; disabled writes and replays stay disabled', async () => {
  const input = body(), original = await create(input);
  await create(); await create();
  const http = await productionHttp({ RECURRING_TASKS_ENABLED: 'false' });
  const before = await Plan.find().lean(), commands = await Command.find().lean();
  const list = await auth(http, 'get', `/api/recurring-task-plans?childId=${child.id}&page=2&pageSize=2`);
  expect(list.body.data).toMatchObject({ total: 3, page: 2, pageSize: 2 }); expect(list.body.data.items).toHaveLength(1);
  const index = await auth(http, 'get', `/api/recurring-task-plan-commands?childId=${child.id}`);
  expect(index.body.data.total).toBe(3);
  expect(Object.keys(index.body.data.items[0]).sort()).toEqual(['operationId', 'action', 'targetPlanId', 'state', 'settledAt'].sort());
  const co = { id: id(), role: 'parent' };
  await User.collection.insertOne({ _id: new mongoose.Types.ObjectId(co.id), role: 'parent', status: 'active' });
  await Family.updateOne({ _id: family._id }, { $addToSet: { memberParentIds: co.id } });
  expect((await auth(http, 'get', `/api/recurring-task-plan-commands?childId=${child.id}`, co)).body.data.total).toBe(0);
  expect((await auth(http, 'get', `/api/recurring-task-plan-commands/${input.operationId}?childId=${child.id}`, co)).body.data.state).toBe('not_found');
  const paths = [['post', '/api/recurring-task-plans', input],
    ['patch', `/api/recurring-task-plans/${original.data.plan.id}`, {}],
    ['post', `/api/recurring-task-plans/${original.data.plan.id}/stop`, {}],
    ['post', `/api/recurring-task-plan-commands/${input.operationId}/abort`, { childId: child.id }]];
  for (const [method, path, payload] of paths) {
    const result = await auth(http, method, path).send(payload);
    expect(result.status).toBe(503); expect(result.body.error.code).toBe('RECURRING_TASKS_DISABLED');
  }
  expect(await Plan.find().lean()).toEqual(before); expect(await Command.find().lean()).toEqual(commands);
  expect(await Cursor.countDocuments()).toBe(0);
});

test('HTTP enforces parent role, live membership and same-child terminal access', async () => {
  const input = body(), original = await create(input), http = await productionHttp();
  expect((await http.get('/api/recurring-task-plans?childId=' + child.id)).status).toBe(401);
  expect((await auth(http, 'get', '/api/recurring-task-plans?childId=' + child.id, child)).status).toBe(403);
  const outsider = { id: id(), role: 'parent' };
  await User.collection.insertOne({ _id: new mongoose.Types.ObjectId(outsider.id), role: 'parent' });
  for (const actor of [outsider, parent]) {
    if (actor === parent) await Family.updateOne({ _id: family._id }, { $set: { ownerParentId: outsider.id, memberParentIds: [outsider.id] } });
    for (const path of [`/api/recurring-task-plans/${original.data.plan.id}`,
      `/api/recurring-task-plan-commands/${input.operationId}?childId=${child.id}`]) {
      const result = await auth(http, 'get', path, actor);
      expect(result.status).toBe(403); expect(result.body.error.code).toBe('CHILD_ACCESS_DENIED');
      expect(result.body.data).toBeUndefined();
    }
  }
  expect(await Plan.countDocuments()).toBe(1); expect(await Command.countDocuments()).toBe(1);
});

test.each(['page=0', 'page=1.5', 'page=9007199254740992', 'pageSize=51', 'page=1&page=2', 'unexpected=1', 'childId[$ne]=x'])(
  'HTTP rejects invalid query %s instead of coercing it', async query => {
    const http = await productionHttp();
    const result = await auth(http, 'get', `/api/recurring-task-plans?childId=${child.id}&${query}`);
    expect(result.status).toBe(400); expect(await Plan.countDocuments()).toBe(0);
  });

test('Gateway preserves unknown operator keys for rejection rather than silently deleting them', async () => {
  const http = await productionHttp(), input = body();
  input.startDate = require('../../../../common/utils/familyDate').formatLocalDate(new Date(), 'Asia/Shanghai');
  input.template.$unexpected = 'reject';
  const result = await auth(http, 'post', '/api/recurring-task-plans').send(input);
  expect(result.status).toBe(400); expect(await Plan.countDocuments()).toBe(0);
});

test('HTTP committed create with lost response is discovered and replayed with the same ID', async () => {
  const app = createProductionApp({ env: env(), appLogger: logger });
  await app.locals.recurringTasks.assertReady();
  const originalJson = app.response.json;
  let dropped = false;
  app.response.json = function json(value) {
    if (!dropped && this.statusCode === 201) { dropped = true; this.destroy(); return this; }
    return originalJson.call(this, value);
  };
  const http = await gateway(app), input = body();
  input.startDate = require('../../../../common/utils/familyDate').formatLocalDate(new Date(), 'Asia/Shanghai');
  try {
    const lost = await auth(http, 'post', '/api/recurring-task-plans').send(input);
    expect(lost.status).toBeGreaterThanOrEqual(500); expect(dropped).toBe(true);
    const terminal = await auth(http, 'get', `/api/recurring-task-plan-commands/${input.operationId}?childId=${child.id}`);
    expect(terminal.body.data.state).toBe('succeeded');
    const replay = await auth(http, 'post', '/api/recurring-task-plans').send(input);
    expect(replay.body.data).toEqual(terminal.body.data.result.data);
    expect(await Plan.countDocuments()).toBe(1); expect(await Task.countDocuments()).toBe(1);
  } finally { app.response.json = originalJson; }
});

test('cursor persistence failure retains the page, sanitizes errors and retries all occurrences idempotently', async () => {
  await create();
  const scanner = createRecurringTaskPlanScanner({ service: runtime.service, enabled: () => true, logger });
  const persist = jest.spyOn(Cursor, 'updateOne').mockRejectedValueOnce(new Error('private-uri/password'));
  await expect(scanner.tick()).rejects.toMatchObject({ code: 'RECURRING_SCAN_FAILED', message: 'RECURRING_SCAN_FAILED' });
  expect((await Cursor.findById('recurring-task-plans-v1').lean()).afterId).toBeNull();
  expect(scanner.getHealth()).toMatchObject({ healthy: false, complete: false });
  persist.mockRestore();
  expect(await scanner.tick()).toMatchObject({ complete: true, healthy: true, processed: 1 });
  expect(await Task.countDocuments()).toBe(1);
});

test('multiple scanner replicas keep unique occurrences and reject a stale cursor CAS', async () => {
  await create();
  let release, reached;
  const hold = new Promise(resolve => { release = resolve; }), barrier = new Promise(resolve => { reached = resolve; });
  const slow = createRecurringTaskPlanScanner({ enabled: () => true, service: { generate: async input => {
    reached(); await hold; return runtime.service.generate(input);
  } } });
  const pending = slow.tick().then(value => ({ value }), cause => ({ cause }));
  try {
    await Promise.race([barrier, pending.then(() => { throw new Error('barrier not reached'); })]);
    const fast = createRecurringTaskPlanScanner({ enabled: () => true, service: runtime.service });
    expect((await fast.tick()).healthy).toBe(true);
  } finally { release(); await pending; }
  expect((await pending).cause.code).toBe('RECURRING_SCAN_FAILED');
  expect(await Task.countDocuments()).toBe(1);
});

test('stop waits for active transaction, starts no next plan, and timeout is not success', async () => {
  await create(); await create();
  let release, reached;
  const hold = new Promise(resolve => { release = resolve; }), barrier = new Promise(resolve => { reached = resolve; });
  const generate = jest.fn(async () => { reached(); await hold; });
  const scanner = createRecurringTaskPlanScanner({ enabled: () => true, service: { generate }, stopTimeoutMs: 10 });
  const running = scanner.tick();
  try {
    await Promise.race([barrier, running.then(() => { throw new Error('barrier not reached'); })]);
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    const stopped = scanner.stop();
    const assertion = expect(stopped).rejects.toMatchObject({ code: 'RECURRING_SCAN_STOP_UNKNOWN' });
    await jest.advanceTimersByTimeAsync(10); await assertion;
    expect(generate).toHaveBeenCalledTimes(1);
    expect((await Cursor.findById('recurring-task-plans-v1').lean()).version).toBe(0);
    const repeated = expect(scanner.stop()).rejects.toMatchObject({ code: 'RECURRING_SCAN_STOP_UNKNOWN' });
    await jest.advanceTimersByTimeAsync(10); await repeated;
  } finally { jest.useRealTimers(); release(); await running; await expect(scanner.stop()).resolves.toBeUndefined(); }
  expect((await scanner.tick()).processed).toBe(0); expect(generate).toHaveBeenCalledTimes(1);
});

test('ended plan gets its final gap accounting once then leaves scan candidates', async () => {
  const input = body(); input.endDate = '2026-11-18';
  const planId = (await create(input)).data.plan.id;
  const late = createRecurringTaskPlanRuntime({ env: env(), now: () => Date.parse('2026-11-20T04:00:00Z') });
  await late.assertReady();
  expect((await late.scanner.tick()).processed).toBe(1);
  expect(await Plan.findById(planId).lean()).toMatchObject({ lastEvaluatedDate: '2026-11-18', skippedOccurrenceCount: 2 });
  expect((await late.scanner.tick()).processed).toBe(0); expect(await Task.countDocuments()).toBe(1);
});

test.each(['ended', 'stopped'])('committed generation UNKNOWN is rechecked even after plan is %s', async state => {
  const input = body(); input.endDate = '2026-11-16';
  const planId = (await create(input)).data.plan.id;
  // The final scan already committed before its reply was lost.
  let fail = true;
  const generate = async request => {
    const value = await runtime.service.generate(request);
    if (fail) { fail = false; throw Object.assign(new Error('private lost response'), { code: 'RECURRING_PLAN_WRITE_UNKNOWN' }); }
    return value;
  };
  // Put the last date back one day so this replica first visits the final occurrence.
  await Plan.updateOne({ _id: planId }, { $set: { lastEvaluatedDate: '2026-11-15' } });
  const scanner = createRecurringTaskPlanScanner({ enabled: () => true, service: { generate } });
  expect(await scanner.tick()).toMatchObject({ processed: 1, failures: 1, healthy: false });
  if (state === 'stopped') await runtime.service.execute({ identity: parent, action: 'stop', planId,
    body: { operationId: randomUUID(), expectedVersion: 1 } });
  expect(await scanner.tick()).toMatchObject({ processed: 1, failures: 0, healthy: true });
  expect(await Task.countDocuments({ recurringPlanId: planId })).toBe(1);
  expect((await scanner.tick()).processed).toBe(0);
  await expect(scanner.stop()).resolves.toBeUndefined();
});

test('disabled runtime never scans and import/factory construction creates no state', async () => {
  const disabled = createRecurringTaskPlanRuntime({ env: { ...env(), RECURRING_TASKS_ENABLED: 'false' } });
  disabled.scanner.start();
  expect((await disabled.scanner.tick()).processed).toBe(0);
  expect(await Cursor.countDocuments()).toBe(0); expect(await Plan.countDocuments()).toBe(0);
  await disabled.scanner.stop();
});

test.each(['legacy', 'maintenance'])('enabled plans reject %s mode before any database access', async mode => {
  const connect = jest.fn();
  await expect(startServer({ env: { ...env(), COMPLETION_PROTOCOL_MODE: mode }, connect, port: 0 }))
    .rejects.toMatchObject({ code: 'RECURRING_TASKS_NOT_READY' });
  expect(connect).not.toHaveBeenCalled(); expect(await Cursor.countDocuments()).toBe(0);
});

test.each(['prepareUnique', 'buildUUID', 'hidden', 'sparse', 'collation', 'partialFilterExpression', 'unique'])(
  'readiness rejects invalid command index %s and closes raw cursors', async field => {
    const raw = mongoose.connection.db.runCursorCommand.bind(mongoose.connection.db), closed = jest.fn();
    jest.spyOn(mongoose.connection.db, 'runCursorCommand').mockImplementation((command, options) => {
      const cursor = raw(command, options), toArray = cursor.toArray.bind(cursor), close = cursor.close.bind(cursor);
      cursor.toArray = async () => (await toArray()).map(index => command.listIndexes === Command.collection.collectionName
        && index.name === 'recurring_command_identity' ? { ...index, [field]: field === 'unique' ? false
          : field === 'collation' ? { locale: 'en' } : field === 'partialFilterExpression' ? { state: 'succeeded' } : true } : index);
      cursor.close = async () => { closed(); return close(); }; return cursor;
    });
    await expect(assertRecurringReady()).rejects.toMatchObject({ code: 'RECURRING_TASKS_NOT_READY' });
    expect(closed).toHaveBeenCalledTimes(2);
  });

test('standalone hello is rejected with a sanitized startup error', async () => {
  jest.spyOn(mongoose.connection.db, 'admin').mockReturnValue({ command: async () => ({ isWritablePrimary: true, maxWireVersion: 17 }) });
  await expect(assertRecurringReady()).rejects.toMatchObject({ code: 'RECURRING_TASKS_NOT_READY', message: 'RECURRING_TASKS_NOT_READY' });
});

test('original completion precheck rejects a changed occurrence filter, not every new unique index', async () => {
  const { assertCompletionMediaGuardReadiness } = require('../../services/completionMediaGuardReadiness');
  const raw = mongoose.connection.db.runCursorCommand.bind(mongoose.connection.db);
  await expect(assertCompletionMediaGuardReadiness({ connection: mongoose.connection, writesPaused: true })).resolves.toMatchObject({ ready: true });
  jest.spyOn(mongoose.connection.db, 'runCursorCommand').mockImplementation((command, options) => {
    const cursor = raw(command, options), read = cursor.toArray.bind(cursor);
    cursor.toArray = async () => (await read()).map(index => index.name === 'recurring_occurrence_identity'
      ? { ...index, partialFilterExpression: { status: 'pending' } } : index); return cursor;
  });
  await expect(assertCompletionMediaGuardReadiness({ connection: mongoose.connection, writesPaused: true }))
    .rejects.toMatchObject({ code: 'COMPLETION_RETENTION_NOT_READY', issues: ['UNEXPECTED_UNIQUE_INDEX'] });
});

test.each(['patch', 'stop', 'abort'])('formal HTTP %s committed then lost response recovers the original terminal', async action => {
  const input = body();
  const app = createProductionApp({ env: env(), appLogger: logger });
  await app.locals.recurringTasks.assertReady();
  const http = await gateway(app);
  input.startDate = require('../../../../common/utils/familyDate').formatLocalDate(new Date(), 'Asia/Shanghai');
  const original = await auth(http, 'post', '/api/recurring-task-plans').send(input);
  expect(original.status).toBe(201);
  const planId = original.body.data.plan.id;
  const operationId = randomUUID();
  let payload, path, method;
  if (action === 'abort') {
    input.operationId = operationId;
    const { normalize, digest } = require('../../services/recurringTaskPlanCommand');
    payload = { childId: child.id, action: 'create', targetPlanId: null, requestDigest: digest({ familyId: String(family._id),
      actorId: parent.id, childId: child.id }, 'create', null, normalize('create', input)) };
    path = `/api/recurring-task-plan-commands/${operationId}/abort`; method = 'post';
  } else {
    payload = { operationId, expectedVersion: 1, ...(action === 'patch' ? {
      endDate: null, schedule: { kind: 'daily' }, template: input.template } : {}) };
    path = `/api/recurring-task-plans/${planId}${action === 'stop' ? '/stop' : ''}`;
    method = action === 'patch' ? 'patch' : 'post';
  }
  const originalJson = app.response.json;
  let dropped = false;
  app.response.json = function json(value) {
    if (!dropped && this.statusCode === 200) { dropped = true; this.destroy(); return this; }
    return originalJson.call(this, value);
  };
  try {
    const tasks = await Task.find().lean();
    expect((await auth(http, method, path).send(payload)).status).toBeGreaterThanOrEqual(500);
    expect(dropped).toBe(true);
    const state = await auth(http, 'get', `/api/recurring-task-plan-commands/${operationId}?childId=${child.id}`);
    expect(state.status).toBe(200); expect(state.body.data.state).toBe(action === 'abort' ? 'aborted' : 'succeeded');
    const before = await Plan.find().lean();
    const retry = await auth(http, method, path).send(payload);
    expect(retry.status).toBe(200);
    expect(retry.body.data).toEqual(action === 'abort' ? state.body.data : state.body.data.result.data);
    expect(await Plan.find().lean()).toEqual(before); expect(await Task.find().lean()).toEqual(tasks);
    expect(await Command.countDocuments({ operationId })).toBe(1);
  } finally { app.response.json = originalJson; }
});

test('missing startup index prevents both listening and scanning and retains prior connection', async () => {
  await Command.collection.dropIndex('recurring_command_identity');
  const listen = jest.spyOn(require('express').application, 'listen');
  try {
    await expect(startServer({ env: env(), host: '127.0.0.1', port: 0, appLogger: logger }))
      .rejects.toMatchObject({ code: 'RECURRING_TASKS_NOT_READY' });
    expect(listen).not.toHaveBeenCalled(); expect(await Cursor.countDocuments()).toBe(0);
    expect(mongoose.connection.readyState).toBe(1);
  } finally {
    const [key, options] = Command.schema.indexes().find(([, o]) => o.name === 'recurring_command_identity');
    await Command.collection.createIndex(key, options);
  }
});

test('failed health and fallback cursor persistence does not advance durable cursor or claim success', async () => {
  await create();
  const save = jest.spyOn(Plan, 'updateOne').mockRejectedValueOnce(new Error('private health storage error'));
  jest.spyOn(Cursor, 'updateOne').mockRejectedValueOnce(new Error('private cursor storage error'));
  const scanner = createRecurringTaskPlanScanner({ enabled: () => true, service: { generate: async () => { throw new Error('private'); } } });
  await expect(scanner.tick()).rejects.toMatchObject({ code: 'RECURRING_SCAN_FAILED' });
  expect((await Cursor.findById('recurring-task-plans-v1').lean()).version).toBe(0);
  expect(scanner.getHealth().healthy).toBe(false); save.mockRestore();
});

test('generation unknown during stop is propagated and a second stop cannot erase it', async () => {
  await create();
  let release, reached;
  const hold = new Promise(resolve => { release = resolve; }), barrier = new Promise(resolve => { reached = resolve; });
  const scanner = createRecurringTaskPlanScanner({ enabled: () => true, service: { generate: async () => {
    reached(); await hold; throw Object.assign(new Error('private'), { code: 'RECURRING_PLAN_WRITE_UNKNOWN' });
  } } });
  const running = scanner.tick().then(value => ({ value }), cause => ({ cause }));
  let stopped;
  try {
    await Promise.race([barrier, running.then(() => { throw new Error('barrier not reached'); })]);
    stopped = scanner.stop().then(() => ({ ok: true }), cause => ({ cause }));
  } finally { release(); await running; await stopped; }
  expect((await stopped).cause).toMatchObject({ code: 'RECURRING_SCAN_STOP_UNKNOWN' });
  await expect(scanner.stop()).rejects.toMatchObject({ code: 'RECURRING_SCAN_STOP_UNKNOWN' });
  expect((await Cursor.findById('recurring-task-plans-v1').lean()).version).toBe(0);
  expect((await Plan.findOne().lean()).lastFailureCode).toBeNull();
});

test('persistent per-plan health failure does not starve later pages and is retained in cursor evidence', async () => {
  const first = (await create()).data.plan.id, template = await Plan.findById(first).lean();
  await Plan.insertMany(Array.from({ length: 50 }, () => ({ ...template, _id: new mongoose.Types.ObjectId() })));
  const visited = [], generate = async ({ planId }) => { visited.push(planId); if (planId === first) throw new Error('private'); };
  jest.spyOn(Plan, 'updateOne').mockRejectedValue(new Error('private health storage failure'));
  const scanner = createRecurringTaskPlanScanner({ service: { generate }, enabled: () => true, logger });
  expect(await scanner.tick()).toMatchObject({ processed: 50, complete: false, healthy: false, healthWriteFailures: 1 });
  expect(await Cursor.findById('recurring-task-plans-v1').lean()).toMatchObject({ failures: 1, healthWriteFailures: 1 });
  const restart = createRecurringTaskPlanScanner({ service: { generate }, enabled: () => true, logger });
  expect(await restart.tick()).toMatchObject({ processed: 1, complete: true, healthy: false, healthWriteFailures: 1 });
  expect(new Set(visited).size).toBe(51);
  expect(await Cursor.findById('recurring-task-plans-v1').lean()).toMatchObject({ afterId: null,
    lastRoundFailures: 1, lastRoundHealthWriteFailures: 1 });
});

test('normal stop awaits successful in-flight work without closing early and writes no health after disable', async () => {
  await create();
  let release, reached, enabled = true, closed = false;
  const hold = new Promise(resolve => { release = resolve; }), barrier = new Promise(resolve => { reached = resolve; });
  const scanner = createRecurringTaskPlanScanner({ enabled: () => enabled, service: { generate: async () => {
    reached(); await hold;
  } } });
  const running = scanner.tick(); let stopping;
  try {
    await Promise.race([barrier, running.then(() => { throw new Error('barrier not reached'); })]);
    enabled = false; stopping = scanner.stop().then(() => { closed = true; });
    await Promise.resolve(); expect(closed).toBe(false);
  } finally { release(); await running; await stopping; }
  expect(closed).toBe(true); expect((await Plan.findOne().lean()).lastFailureCode).toBeNull();
  expect((await Cursor.findById('recurring-task-plans-v1').lean()).version).toBe(0);
});

test('startup listen failure never starts scan and does not close an existing connection', async () => {
  const blocker = await harness.request(require('express')());
  const port = Number(new URL(blocker.get('/').url).port);
  await expect(startServer({ env: env(), host: '127.0.0.1', port, appLogger: logger }))
    .rejects.toMatchObject({ code: 'COMPLETION_STARTUP_FAILED' });
  expect(await Cursor.countDocuments()).toBe(0); expect(mongoose.connection.readyState).toBe(1);
});

test('startup schedules one immediate page and one page each sixty seconds without duplicate timers', async () => {
  await create();
  const generate = jest.fn(async () => {});
  const scanner = createRecurringTaskPlanScanner({ service: { generate }, enabled: () => true });
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  try {
    scanner.start(); scanner.start(); await scanner.tick();
    expect(generate).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(59999); expect(generate).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1); await scanner.tick();
    expect(generate).toHaveBeenCalledTimes(2);
  } finally { await scanner.stop(); jest.useRealTimers(); }
});
