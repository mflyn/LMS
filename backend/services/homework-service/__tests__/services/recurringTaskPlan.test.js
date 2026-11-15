const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const Task = require('../../models/GrowthTask');
const Plan = require('../../models/RecurringTaskPlan');
const Command = require('../../models/RecurringTaskPlanCommand');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');
const { createRecurringTaskPlanService } = require('../../services/recurringTaskPlanService');
const { normalize, digest, countDays } = require('../../services/recurringTaskPlanCommand');

const id = () => String(new mongoose.Types.ObjectId());
let parent, coparent, child, family, clock, service;
const command = extra => ({ operationId: randomUUID(), childId: child.id, startDate: '2026-11-16',
  endDate: null, schedule: { kind: 'weekly', weekdays: [1, 2, 3, 4, 5] },
  template: { title: 'Synthetic exercise', dimension: 'physical', taskType: 'exercise', targetAmount: 500 }, ...extra });
const build = options => createRecurringTaskPlanService({ transactionRunner: work => runMongoTransaction({ mongooseInstance: mongoose, work }),
  now: () => clock, enabled: () => true, ...options });
const create = (body = command(), actor = parent, api = service) => api.execute({ identity: actor, action: 'create', body });
const scope = (_body, actor = parent) => ({ familyId: String(family._id), actorId: actor.id, childId: child.id });
const abortBody = (body, action = 'create', targetPlanId = null) => ({ childId: child.id, action, targetPlanId,
  requestDigest: digest(scope(body), action, targetPlanId, normalize(action, body)) });
const abort = (body, api = service) => api.abort({ identity: parent, operationId: body.operationId, body: abortBody(body) });
const counts = async () => [await Plan.countDocuments(), await Task.countDocuments(), await Command.countDocuments()];
beforeAll(async () => { for (const model of [Family, User, Task, Plan, Command]) await model.init(); });
beforeEach(async () => {
  clock = Date.parse('2026-11-16T04:00:00Z');
  parent = { id: id(), role: 'parent' }; coparent = { id: id(), role: 'parent' }; child = { id: id(), role: 'student' };
  family = await Family.create({ familyName: 'Synthetic recurring family', ownerParentId: parent.id,
    memberParentIds: [parent.id, coparent.id], childIds: [child.id], timezone: 'Asia/Shanghai' });
  await User.collection.insertMany([parent, coparent, child].map(actor => ({ _id: new mongoose.Types.ObjectId(actor.id),
    role: actor.role, username: actor.id, email: actor.id + '@example.test',
    ...(actor.role === 'student' ? { familyId: family._id } : {}) })));
  service = build();
});
afterEach(() => jest.restoreAllMocks());
const patchBody = (version = 1, extra = {}) => ({ operationId: randomUUID(), expectedVersion: version,
  endDate: null, schedule: { kind: 'daily' }, template: { title: 'Changed exercise', dimension: 'physical', taskType: 'exercise' }, ...extra });
const change = (planId, body = patchBody(), action = 'patch', api = service) => api.execute({ identity: parent, action, planId, body });
const stopped = (planId, version = 1) => change(planId, { operationId: randomUUID(), expectedVersion: version }, 'stop');
const query = (body, api = service, actor = parent) => api.getCommand({ identity: actor, childId: child.id, operationId: body.operationId });

test('creates today once and replays the exact original result without extra tasks or commands', async () => {
  const body = command(), first = await create(body);
  expect(first.httpStatus).toBe(201);
  expect(first.data.generatedTaskId).toMatch(/^[a-f0-9]{24}$/);
  expect(await create(body)).toEqual(first);
  expect(await counts()).toEqual([1, 1, 1]);
  const task = await Task.findOne().lean();
  expect(task).toMatchObject({ status: 'pending', dueDate: '2026-11-16', occurrenceDate: '2026-11-16',
    starAwardState: 'not_applicable', planRevision: 1 });
});

test('a preemptive abort prevents the original request arriving later and never creates business rows', async () => {
  const body = command(), settled = await abort(body);
  expect(settled.state).toBe('aborted');
  expect(await abort(body)).toEqual(settled);
  await expect(create(body)).rejects.toMatchObject({ code: 'RECURRING_PLAN_COMMAND_ABORTED' });
  expect(await counts()).toEqual([0, 0, 1]);
});

test('successful business wins over abort, with full canonical body and immutable result', async () => {
  const body = command(), original = await create(body), settled = await abort(body);
  expect(settled).toMatchObject({ state: 'succeeded', command: normalize('create', body), result: original });
  expect(await counts()).toEqual([1, 1, 1]);
});

test.each([
  { schedule: { kind: 'weekly', weekdays: [1, 1] } },
  { schedule: { kind: 'daily', weekdays: [1] } },
  { startDate: '2026-02-30' }, { familyId: 'forged' },
  { template: { title: 'x', taskType: 'x', dimension: 'physical', targetAmount: -1 } },
  { template: { title: 'x', taskType: 'x', dimension: 'physical', attachmentMediaIds: [] } }
])('invalid command rejects with zero side effects %j', async extra => {
  await expect(create(command(extra))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(await counts()).toEqual([0, 0, 0]);
});

test('week counting is inclusive and bounded across leap days and long outages', () => {
  expect(countDays('2026-11-16', '2026-11-22', { kind: 'weekly', weekdays: [1, 2, 3, 4, 5] })).toBe(5);
  expect(countDays('2024-02-28', '2024-03-01', { kind: 'daily' })).toBe(3);
  expect(countDays('2000-01-01', '2099-12-31', { kind: 'daily' })).toBe(36525);
  expect(countDays('2026-11-17', '2026-11-16', { kind: 'daily' })).toBe(0);
});

test('canonical digest preserves null/omission, scope and target while normalizing order and trim', () => {
  const body = command(), a = normalize('create', body);
  const b = normalize('create', { ...body, template: { ...body.template, title: ' Synthetic exercise ' },
    schedule: { weekdays: [5, 4, 3, 2, 1], kind: 'weekly' } });
  expect(digest(scope(body), 'create', null, a)).toBe(digest(scope(body), 'create', null, b));
  expect(digest(scope(body), 'create', null, a)).not.toBe(digest(scope(body, coparent), 'create', null, a));
  expect(digest(scope(body), 'create', null, a)).not.toBe(digest(scope(body), 'create', null,
    normalize('create', { ...body, template: { ...body.template, description: null } })));
});

test('future start stays empty and generates only its first actual date; ordinary tasks are not indexed together', async () => {
  const first = await create(command({ startDate: '2026-11-20' })), planId = first.data.plan.id;
  expect(first.data.generatedTaskId).toBeNull();
  expect(await service.generate({ planId })).toEqual({ generatedTaskId: null });
  clock = Date.parse('2026-11-20T04:00:00Z');
  const result = await service.generate({ planId });
  expect(result.generatedTaskId).not.toBeNull();
  await Task.create([1, 2].map(() => ({ familyId: family._id, childId: child.id, createdByParentId: parent.id,
    title: 'ordinary', dimension: 'physical', taskType: 'exercise', dueDate: '2026-11-20' })));
  expect(await Task.countDocuments()).toBe(3);
});

test.each(['cancelled', 'archived', 'confirmed'])('an existing %s task with edited dueDate is not recreated or overwritten', async status => {
  const first = await create(), planId = first.data.plan.id;
  await Task.updateOne({ _id: first.data.generatedTaskId }, { $set: { status, dueDate: '2026-11-25', parentFeedback: 'Keep history' } });
  const before = await Task.findOne().lean();
  await service.generate({ planId });
  expect(await Task.findOne().lean()).toEqual(before);
  expect(await Task.countDocuments()).toBe(1);
});

test('edits take effect tomorrow and never modify today; two edits supersede only pending rule', async () => {
  const first = await create(), planId = first.data.plan.id, before = await Task.findOne().lean();
  const one = patchBody(), result = await change(planId, one);
  expect(result.data.effectiveFrom).toBe('2026-11-17');
  expect(result.data.plan.currentRevision.template.title).toBe('Synthetic exercise');
  expect(result.data.plan.pendingRevision.template.title).toBe('Changed exercise');
  const two = patchBody(2, { template: { ...one.template, title: 'Last revision' } });
  await change(planId, two);
  expect(await change(planId, one)).toEqual(result);
  expect(await Task.findOne().lean()).toEqual(before);
  clock = Date.parse('2026-11-17T04:00:00Z');
  await service.generate({ planId });
  expect(await Task.findOne({ occurrenceDate: '2026-11-17' }).lean()).toMatchObject({ title: 'Last revision', planRevision: 3 });
  expect(await Task.findById(before._id).lean()).toEqual(before);
});

test('outage crosses revision and end boundaries without backfill or double-counting', async () => {
  const first = await create(), planId = first.data.plan.id;
  await change(planId, patchBody(1, { endDate: '2026-11-22' }));
  clock = Date.parse('2026-11-24T04:00:00Z');
  await service.generate({ planId });
  let plan = await service.getPlan({ identity: parent, planId });
  expect(plan.generationHealth).toMatchObject({ skippedOccurrenceCount: 6, lastEvaluatedDate: '2026-11-22' });
  expect(await Task.countDocuments()).toBe(1);
  await service.generate({ planId });
  plan = await service.getPlan({ identity: parent, planId });
  expect(plan.generationHealth.skippedOccurrenceCount).toBe(6);
  await expect(change(planId, patchBody(2))).rejects.toMatchObject({ code: 'RECURRING_PLAN_STATE_CONFLICT' });
});

test('stopping catches historical gaps but creates no today task and preserves all existing rows', async () => {
  const first = await create(), planId = first.data.plan.id, before = await Task.find().lean();
  clock = Date.parse('2026-11-19T04:00:00Z');
  const result = await stopped(planId);
  expect(result.data.plan.generationHealth.skippedOccurrenceCount).toBe(2);
  expect(result.data.existingTasksPreserved).toBe(true);
  await service.generate({ planId });
  expect(await Task.find().lean()).toEqual(before);
  await expect(stopped(planId, 2)).rejects.toMatchObject({ code: 'RECURRING_PLAN_STATE_CONFLICT' });
});

test('a weekday outage generates only today and retries keep gaps unchanged', async () => {
  const first = await create(), planId = first.data.plan.id;
  clock = Date.parse('2026-11-23T04:00:00Z');
  await service.generate({ planId }); await service.generate({ planId });
  expect((await Task.find().sort({ dueDate: 1 }).lean()).map(t => t.dueDate)).toEqual(['2026-11-16', '2026-11-23']);
  expect((await Plan.findById(planId).lean()).skippedOccurrenceCount).toBe(4);
});

test('plan timezone remains fixed and DST/local day is not host time', async () => {
  await Family.updateOne({ _id: family._id }, { $set: { timezone: 'America/New_York' } });
  clock = Date.parse('2026-11-16T04:30:00Z');
  const first = await create(command({ startDate: '2026-11-15', schedule: { kind: 'daily' } }));
  expect((await Task.findOne().lean()).dueDate).toBe('2026-11-15');
  await Family.updateOne({ _id: family._id }, { $set: { timezone: 'Asia/Shanghai' } });
  await service.generate({ planId: first.data.plan.id });
  expect(await Task.countDocuments()).toBe(1);
});

test('default disabled is fail closed but terminal reads remain read-only', async () => {
  const body = command(); await create(body);
  const api = createRecurringTaskPlanService({ transactionRunner: work => runMongoTransaction({ mongooseInstance: mongoose, work }) });
  const before = await Command.find().lean();
  await expect(create(command(), parent, api)).rejects.toMatchObject({ code: 'RECURRING_TASKS_DISABLED' });
  await expect(abort(body, api)).rejects.toMatchObject({ code: 'RECURRING_TASKS_DISABLED' });
  expect((await query(body, api)).state).toBe('succeeded');
  expect(await Command.find().lean()).toEqual(before);
});

test('replay checks live authorization and the same UUID belongs to different actors independently', async () => {
  const body = command(); await create(body); await create(body, coparent);
  expect(await Plan.countDocuments()).toBe(2);
  await Family.updateOne({ _id: family._id }, { $pull: { memberParentIds: coparent.id } });
  await expect(query(body, service, coparent)).rejects.toMatchObject({ code: 'CHILD_ACCESS_DENIED' });
  await expect(create(body, coparent)).rejects.toMatchObject({ code: 'CHILD_ACCESS_DENIED' });
  await expect(create(body, child)).rejects.toMatchObject({ code: 'CHILD_ACCESS_DENIED' });
});

test('inactive child and changed family relationship block generation without touching its previous task', async () => {
  const first = await create(), before = await Task.find().lean();
  clock = Date.parse('2026-11-17T04:00:00Z');
  await User.collection.updateOne({ _id: new mongoose.Types.ObjectId(child.id) }, { $set: { status: 'inactive' } });
  await expect(service.generate({ planId: first.data.plan.id })).rejects.toMatchObject({ code: 'CHILD_ACCESS_DENIED' });
  expect(await Task.find().lean()).toEqual(before);
});

test('different body, target or abort digest cannot overwrite a terminal', async () => {
  const body = command(); await create(body);
  const before = await Command.findOne().lean();
  await expect(create({ ...body, template: { ...body.template, title: 'different' } })).rejects.toMatchObject({ code: 'RECURRING_PLAN_COMMAND_CONFLICT' });
  await expect(service.abort({ identity: parent, operationId: body.operationId,
    body: { ...abortBody(body), requestDigest: 'a'.repeat(64) } })).rejects.toMatchObject({ code: 'RECURRING_PLAN_COMMAND_CONFLICT' });
  expect(await Command.findOne().lean()).toEqual(before);
});

test('rollback after business writes leaves no task or plan and allows a durable abort', async () => {
  const body = command(), original = Command.create.bind(Command);
  jest.spyOn(Command, 'create').mockImplementationOnce(() => { throw new Error('synthetic terminal write failure'); });
  await expect(create(body)).rejects.toMatchObject({ code: 'RECURRING_PLAN_WRITE_UNKNOWN' });
  expect(await counts()).toEqual([0, 0, 0]);
  Command.create.mockImplementation(original);
  expect((await query(body)).state).toBe('not_found');
  expect((await abort(body)).state).toBe('aborted');
  await expect(create(body)).rejects.toMatchObject({ code: 'RECURRING_PLAN_COMMAND_ABORTED' });
});

test('a lost commit response is discovered and replayed with the original command and no extra business writes', async () => {
  const body = command(); let lose = true;
  const api = build({ transactionRunner: async work => {
    const result = await runMongoTransaction({ mongooseInstance: mongoose, work });
    if (lose) { lose = false; throw new Error('synthetic lost commit response'); }
    return result;
  } });
  await expect(create(body, parent, api)).rejects.toMatchObject({ code: 'RECURRING_PLAN_WRITE_UNKNOWN' });
  const saved = await query(body);
  expect(saved.state).toBe('succeeded');
  expect(await create(body)).toEqual(saved.result);
  expect(await counts()).toEqual([1, 1, 1]);
});

test.each(['create', 'patch', 'stop'])('abort wins at final %s command insertion and rolls back every business write', async action => {
  let planId = null;
  if (action !== 'create') planId = (await create()).data.plan.id;
  const body = action === 'create' ? command() : action === 'patch' ? patchBody() : { operationId: randomUUID(), expectedVersion: 1 };
  const beforePlans = await Plan.find().lean(), beforeTasks = await Task.find().lean();
  let release, arrived, held = false;
  const hold = new Promise(resolve => { release = resolve; }), reached = new Promise(resolve => { arrived = resolve; });
  const original = Command.create.bind(Command);
  jest.spyOn(Command, 'create').mockImplementation(async (rows, options) => {
    if (!held && rows[0].state === 'succeeded' && rows[0].operationId === body.operationId) {
      held = true; arrived(); await hold;
    }
    return original(rows, options);
  });
  const running = service.execute({ identity: parent, action, planId, body }).then(value => ({ value }), cause => ({ cause }));
  try {
    await Promise.race([reached, running.then(() => { throw new Error('command failed before race barrier'); })]);
    expect((await query(body)).state).toBe('not_found');
    const result = await service.abort({ identity: parent, operationId: body.operationId, body: abortBody(body, action, planId) });
    expect(result.state).toBe('aborted');
  } finally { release(); await running; }
  expect((await running).cause).toMatchObject({ code: 'RECURRING_PLAN_COMMAND_ABORTED' });
  expect(await Plan.find().lean()).toEqual(beforePlans);
  expect(await Task.find().lean()).toEqual(beforeTasks);
  expect(await Command.countDocuments({ operationId: body.operationId })).toBe(1);
});

test('concurrent original retries commit one result and one occurrence', async () => {
  const body = command();
  const results = await Promise.all([create(body), create(body)]);
  expect(results[0]).toEqual(results[1]); expect(await counts()).toEqual([1, 1, 1]);
});

test('concurrent scans create one occurrence and co-parent edits reject the stale management version', async () => {
  const planId = (await create()).data.plan.id;
  clock = Date.parse('2026-11-17T04:00:00Z');
  await Promise.all([service.generate({ planId }), service.generate({ planId })]);
  expect(await Task.countDocuments({ occurrenceDate: '2026-11-17' })).toBe(1);
  const results = await Promise.allSettled([change(planId), service.execute({ identity: coparent, action: 'patch', planId, body: patchBody() })]);
  expect(results.filter(x => x.status === 'fulfilled')).toHaveLength(1);
  expect(results.find(x => x.status === 'rejected').reason.code).toBe('RECURRING_PLAN_VERSION_CONFLICT');
});

test('midnight crossing rolls back and recomputes the effective date, while a committed replay keeps its date', async () => {
  const planId = (await create()).data.plan.id, body = patchBody(), original = Command.create.bind(Command);
  let crossed = false;
  jest.spyOn(Command, 'create').mockImplementation(async (rows, options) => {
    const result = await original(rows, options);
    if (!crossed) { crossed = true; clock = Date.parse('2026-11-17T04:00:00Z'); }
    return result;
  });
  const result = await change(planId, body);
  expect(result.data.effectiveFrom).toBe('2026-11-18');
  clock = Date.parse('2026-11-20T04:00:00Z');
  expect(await change(planId, body)).toEqual(result);
  expect(await Command.countDocuments({ operationId: body.operationId })).toBe(1);
});

test.each(['stop', 'patch'].flatMap(action => [true, false].map(managementFirst => ({ action, managementFirst }))))(
  'generation fence serializes $action and generation, managementFirst=$managementFirst', async ({ action, managementFirst }) => {
    const planId = (await create()).data.plan.id;
    const previous = await Task.findOne().lean();
    clock = Date.parse('2026-11-17T04:00:00Z');
    let release, arrived, held = false;
    const hold = new Promise(resolve => { release = resolve; });
    const reached = new Promise(resolve => { arrived = resolve; });
    const original = Plan.updateOne.bind(Plan);
    jest.spyOn(Plan, 'updateOne').mockImplementation(async (filter, update, options) => {
      if (!held) { held = true; arrived(); await hold; }
      return original(filter, update, options);
    });
    const manage = () => action === 'stop' ? stopped(planId) : change(planId);
    const generate = () => service.generate({ planId });
    const running = (managementFirst ? generate() : manage()).then(value => ({ value }), cause => ({ cause }));
    try {
      await Promise.race([reached, running.then(() => { throw new Error('race barrier not reached'); })]);
      await (managementFirst ? manage() : generate());
    } finally { release(); await running; }
    expect((await running).cause).toBeUndefined();
    expect(await Task.findById(previous._id).lean()).toEqual(previous);
    const today = await Task.find({ occurrenceDate: '2026-11-17' }).lean();
    expect(today).toHaveLength(action === 'stop' && managementFirst ? 0 : 1);
    if (today.length) expect(today[0]).toMatchObject({ title: 'Synthetic exercise', planRevision: 1, starAwardState: 'not_applicable' });
    const plan = await Plan.findById(planId).lean();
    expect(plan.version).toBe(2);
    expect(plan.status).toBe(action === 'stop' ? 'stopped' : 'active');
    if (action === 'patch') expect(plan.pendingRevision.effectiveFrom).toBe('2026-11-18');
  }
);

test('abort lost response is recoverable and concurrent retries preserve its first terminal audit', async () => {
  const body = command();
  const lost = build({ transactionRunner: async work => {
    await runMongoTransaction({ mongooseInstance: mongoose, work });
    throw new Error('synthetic lost response');
  } });
  await expect(abort(body, lost)).rejects.toMatchObject({ code: 'RECURRING_PLAN_WRITE_UNKNOWN' });
  const first = await query(body);
  expect(first.state).toBe('aborted');
  clock += 60000;
  const results = await Promise.all([abort(body), abort(body)]);
  expect(results).toEqual([first, first]);
  expect(await counts()).toEqual([0, 0, 1]);
  await expect(create(body)).rejects.toMatchObject({ code: 'RECURRING_PLAN_COMMAND_ABORTED' });
});

test('read-only calls, stop replay and clock rollback preserve exact persisted rows', async () => {
  const planId = (await create()).data.plan.id;
  const before = await Plan.findById(planId).lean();
  clock -= 86400000;
  await expect(service.generate({ planId })).rejects.toMatchObject({ code: 'RECURRING_PLAN_WRITE_UNKNOWN' });
  clock += 2 * 86400000;
  await service.generate({ planId });
  const evaluated = await Plan.findById(planId).lean();
  clock -= 86400000;
  await expect(service.generate({ planId })).rejects.toMatchObject({ code: 'RECURRING_PLAN_WRITE_UNKNOWN' });
  expect(await Plan.findById(planId).lean()).toEqual(evaluated);
  clock += 86400000;
  const body = { operationId: randomUUID(), expectedVersion: 1 };
  const result = await change(planId, body, 'stop');
  const rows = await Plan.findById(planId).lean();
  clock += 86400000;
  expect(await change(planId, body, 'stop')).toEqual(result);
  await service.getPlan({ identity: parent, planId });
  await query(body);
  expect(await Plan.findById(planId).lean()).toEqual(rows);
  expect(rows.createdByParentId).toEqual(before.createdByParentId);
  await expect(stopped(planId, 2)).rejects.toMatchObject({ code: 'RECURRING_PLAN_STATE_CONFLICT' });
});

test('child, cross-family parent, revoked parent and wrong child cannot inspect or abort the original command', async () => {
  const body = command(); await create(body);
  const alien = { id: id(), role: 'parent' };
  const before = await counts();
  for (const actor of [child, alien]) {
    await expect(query(body, service, actor)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.abort({ identity: actor, operationId: body.operationId, body: abortBody(body) }))
      .rejects.toMatchObject({ statusCode: 403 });
  }
  await expect(service.getCommand({ identity: parent, childId: id(), operationId: body.operationId }))
    .rejects.toMatchObject({ statusCode: 403 });
  await Family.updateOne({ _id: family._id }, { $set: { ownerParentId: coparent.id, memberParentIds: [coparent.id] } });
  await expect(query(body)).rejects.toMatchObject({ statusCode: 403 });
  expect(await counts()).toEqual(before);
  clock += 86400000;
  const plan = await Plan.findOne();
  await service.generate({ planId: String(plan._id) });
  expect(await Task.countDocuments()).toBe(2);
});

test('occurrence index is unique and recurrence identity is complete, immutable and separate from ordinary tasks', async () => {
  const first = await create(), row = await Task.findById(first.data.generatedTaskId).lean();
  const index = (await Task.collection.indexes()).find(entry => entry.name === 'recurring_occurrence_identity');
  expect(index).toMatchObject({ unique: true, key: { recurringPlanId: 1, occurrenceDate: 1 },
    partialFilterExpression: { recurringPlanId: { $type: 'objectId' }, occurrenceDate: { $type: 'string' } } });
  const { _id: _ignored, ...duplicate } = row;
  await expect(Task.create(duplicate)).rejects.toMatchObject({ code: 11000 });
  for (const malformed of [{ planRevision: null }, { occurrenceDate: '2026-02-30' }, { sourceMistakeId: id() }]) {
    await expect(new Task({ ...duplicate, ...malformed }).validate()).rejects.toBeDefined();
  }
  const task = await Task.findById(row._id);
  task.occurrenceDate = '2026-11-17'; task.recurringPlanId = id(); task.planRevision = 99;
  await task.save();
  expect(await Task.findById(row._id).lean()).toMatchObject({ recurringPlanId: row.recurringPlanId,
    occurrenceDate: row.occurrenceDate, planRevision: row.planRevision });
  expect((await Plan.collection.indexes()).some(entry => Object.keys(entry.key).some(key => key.includes('template.')))).toBe(false);
});

test('future plan edits retain startDate and activate the latest rule only at the real start', async () => {
  const planId = (await create(command({ startDate: '2026-11-20' }))).data.plan.id;
  await change(planId);
  clock = Date.parse('2026-11-19T04:00:00Z');
  expect(await service.generate({ planId })).toEqual({ generatedTaskId: null });
  expect((await Plan.findById(planId)).lastEvaluatedDate).toBe('2026-11-19');
  clock = Date.parse('2026-11-20T04:00:00Z');
  await service.generate({ planId });
  expect(await Task.findOne().lean()).toMatchObject({ title: 'Changed exercise', occurrenceDate: '2026-11-20', planRevision: 2 });
  expect((await Plan.findById(planId)).skippedOccurrenceCount).toBe(0);
});

test('final enable boundary rolls back all business writes and replays only after explicit re-enable', async () => {
  const body = command(), original = Command.create.bind(Command);
  let enabled = true;
  jest.spyOn(Command, 'create').mockImplementation(async (...args) => {
    const rows = await original(...args); enabled = false; return rows;
  });
  const api = build({ enabled: () => enabled });
  await expect(create(body, parent, api)).rejects.toMatchObject({ code: 'RECURRING_TASKS_DISABLED' });
  expect(await counts()).toEqual([0, 0, 0]);
  expect((await query(body, api)).state).toBe('not_found');
  jest.restoreAllMocks(); enabled = true;
  await create(body, parent, api);
  expect(await counts()).toEqual([1, 1, 1]);
});

test.each(['patch', 'stop', 'generate'])('clock rollback before start after evaluation rejects %s with zero writes', async action => {
  const planId = (await create(command({ startDate: '2026-11-20' }))).data.plan.id;
  clock = Date.parse('2026-11-23T04:00:00Z');
  await service.generate({ planId });
  const before = await Plan.find().lean(), tasks = await Task.find().lean(), commands = await Command.find().lean();
  clock = Date.parse('2026-11-19T04:00:00Z');
  const run = action === 'generate' ? service.generate({ planId }) : action === 'patch' ? change(planId) : stopped(planId);
  await expect(run).rejects.toMatchObject({ code: 'RECURRING_PLAN_WRITE_UNKNOWN' });
  expect(await Plan.find().lean()).toEqual(before);
  expect(await Task.find().lean()).toEqual(tasks);
  expect(await Command.find().lean()).toEqual(commands);
});

test.each([true, false])('elapsed future rule is promoted before a later edit, explicit scan=%s', async scan => {
  const planId = (await create(command({ startDate: '2026-11-20' }))).data.plan.id;
  const firstBody = patchBody(), first = await change(planId, firstBody);
  clock = Date.parse('2026-11-18T04:00:00Z');
  if (scan) {
    await service.generate({ planId });
    const promoted = await Plan.findById(planId).lean();
    expect(promoted.currentRevision.revisionNumber).toBe(2);
    expect(promoted.pendingRevision).toBeNull();
  }
  const second = await change(planId, patchBody(2, { template: { title: 'Third rule', dimension: 'physical', taskType: 'exercise' } }));
  expect(second.data.plan.currentRevision).toMatchObject({ revisionNumber: 2, effectiveFrom: '2026-11-17', template: firstBody.template });
  expect(second.data.plan.pendingRevision).toMatchObject({ revisionNumber: 3, effectiveFrom: '2026-11-19' });
  expect(second.data.plan.generationHealth.lastEvaluatedDate).toBe('2026-11-19');
  expect(await Task.countDocuments()).toBe(0);
  expect(await change(planId, firstBody)).toEqual(first);
  clock = Date.parse('2026-11-20T04:00:00Z');
  await service.generate({ planId });
  expect(await Task.findOne().lean()).toMatchObject({ title: 'Third rule', planRevision: 3 });
});

test.each(['create', 'patch', 'stop'])('business %s wins while abort is in flight and both return the original success', async action => {
  const planId = action === 'create' ? null : (await create()).data.plan.id;
  const body = action === 'create' ? command() : action === 'patch' ? patchBody() : { operationId: randomUUID(), expectedVersion: 1 };
  let release, arrived, held = false;
  const hold = new Promise(resolve => { release = resolve; });
  const reached = new Promise(resolve => { arrived = resolve; });
  const original = Command.create.bind(Command);
  jest.spyOn(Command, 'create').mockImplementation(async (rows, options) => {
    if (!held && rows[0].state === 'aborted') { held = true; arrived(); await hold; }
    return original(rows, options);
  });
  const running = service.abort({ identity: parent, operationId: body.operationId, body: abortBody(body, action, planId) })
    .then(value => ({ value }), cause => ({ cause }));
  let success;
  try {
    await Promise.race([reached, running.then(() => { throw new Error('abort barrier not reached'); })]);
    success = await service.execute({ identity: parent, action, planId, body });
  } finally { release(); await running; }
  expect((await running).cause).toBeUndefined();
  expect((await running).value).toMatchObject({ state: 'succeeded', result: success, command: normalize(action, body) });
  expect(await Command.countDocuments({ operationId: body.operationId })).toBe(1);
  expect(await Plan.countDocuments()).toBe(1);
  expect(await Task.countDocuments()).toBe(1);
});

test('two first aborts race from not_found and settle one immutable tombstone', async () => {
  const body = command();
  let release, arrived, waiting = 0;
  const hold = new Promise(resolve => { release = resolve; });
  const reached = new Promise(resolve => { arrived = resolve; });
  const original = Command.create.bind(Command);
  jest.spyOn(Command, 'create').mockImplementation(async (rows, options) => {
    if (rows[0].state === 'aborted' && waiting < 2) {
      waiting++;
      if (waiting === 2) arrived();
      await hold;
    }
    return original(rows, options);
  });
  const runs = [abort(body), abort(body)].map(run => run.then(value => ({ value }), cause => ({ cause })));
  try {
    await Promise.race([reached, ...runs.map(run => run.then(() => { throw new Error('first abort race barrier not reached'); }))]);
    expect((await query(body)).state).toBe('not_found');
  } finally { release(); await Promise.all(runs); }
  const results = await Promise.all(runs);
  expect(results.every(result => !result.cause)).toBe(true);
  expect(results[0].value).toEqual(results[1].value);
  expect(results[0].value.state).toBe('aborted');
  expect(await counts()).toEqual([0, 0, 1]);
});
