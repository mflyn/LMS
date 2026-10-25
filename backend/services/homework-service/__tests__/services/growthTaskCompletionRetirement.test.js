const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const Task = require('../../models/GrowthTask');
const Operation = require('../../models/GrowthTaskCompletionOperation');
const Guard = require('../../models/CompletionMediaGuard');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');
const { createGrowthTaskCompletionService } = require('../../services/growthTaskCompletionService');
const { createCompletionMediaRetirementService } = require('../../services/completionMediaRetirementService');
const express = require('express');
const { createHttpTestHarness } = require('../../../../common/test/httpTestHarness');
const { errorHandler } = require('../../../../common/middleware/errorHandler');
const { createCompletionMediaRetirementRouter } = require('../../routes/completionMediaRetirements');
const { request, close } = createHttpTestHarness();
const token = 'synthetic-dedicated-retirement-credential-32';
const env = { COMPLETION_RETIREMENT_SERVICE_TOKEN: token,
  MEDIA_REFERENCE_SERVICE_TOKEN: 'synthetic-media-reference-credential-32',
  INTERNAL_SERVICE_TOKEN: 'synthetic-internal-stars-credential-32',
  GATEWAY_IDENTITY_SECRET: 'synthetic-gateway-signature-credential-32' };
const runner = work => runMongoTransaction({ mongooseInstance: mongoose, work });
const id = () => new mongoose.Types.ObjectId();
let family, child, parent, input, task, service;
const pendingClient = Object.fromEntries(['prepare', 'commit', 'status', 'abort', 'unbind']
  .map(action => [action, async () => { throw Error('synthetic remote unavailable'); }]));
const claim = (options = {}) => createGrowthTaskCompletionService({ transactionRunner: runner,
  mediaReferenceClient: pendingClient, ...options }).complete({ identity: parent, taskId: String(task._id),
  body: { operationId: randomUUID(), expectedCompletionVersion: 0, expectedChecklistVersion: 0,
    checkedItemIds: [], completionMediaIds: [input.mediaId] } });
const snapshot = () => Promise.all([Task, Operation, Guard].map(m => m.collection.find().sort({ _id: 1 }).toArray()));

beforeAll(async () => { for (const m of [Task, Operation, Guard, Family, User]) await m.init(); });
afterEach(close);
beforeEach(async () => {
  parent = { id: String(id()), role: 'parent' }; child = id();
  family = await Family.create({ familyName: 'Synthetic retirement', ownerParentId: parent.id,
    memberParentIds: [parent.id], childIds: [child] });
  await User.collection.insertMany([{ _id: new mongoose.Types.ObjectId(parent.id), username: parent.id,
    email: parent.id + '@example.test', role: 'parent' }, { _id: child, username: String(child),
    email: child + '@example.test', role: 'student', familyId: family._id }]);
  input = { familyId: String(family._id), childId: String(child), mediaId: String(id()), retirementId: randomUUID() };
  task = await Task.create({ familyId: family._id, childId: child, createdByParentId: parent.id,
    dimension: 'academic', title: 'Synthetic', taskType: 'practice', dueDate: '2026-10-23' });
  service = createCompletionMediaRetirementService({ transactionRunner: runner });
});

test('T2-G-002 retirement first blocks claim with no owner or ledger, replay preserves first retirement', async () => {
  expect(await service.retire(input)).toEqual({ ...input, state: 'granted' });
  const before = await snapshot();
  await expect(claim()).rejects.toMatchObject({ statusCode: 404, code: 'RESOURCE_NOT_FOUND' });
  expect(await snapshot()).toEqual(before);
  expect(await service.retire(input)).toEqual({ ...input, state: 'granted' });
  expect(await snapshot()).toEqual(before);
  await expect(service.retire({ ...input, retirementId: randomUUID() }))
    .rejects.toMatchObject({ statusCode: 409, code: 'MEDIA_RETIREMENT_CONFLICT' });
  expect(await snapshot()).toEqual(before);
});

test('T2-G-002 claim before remote prepare protects pending body', async () => {
  let release, entered;
  const wait = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { entered = resolve; });
  const client = { ...pendingClient, prepare: async () => { entered(); await wait; throw Error('synthetic loss'); } };
  const completing = claim({ mediaReferenceClient: client }).catch(e => e);
  try {
    await ready;
    expect(await service.retire(input)).toEqual({ ...input, state: 'in_use' });
    expect((await Guard.findOne({ mediaId: input.mediaId })).state).toBe('available');
    expect(await Operation.countDocuments()).toBe(1);
  } finally { release(); }
  expect(await completing).toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
});

test.each(['completionEvidence.completionMediaIds', 'completionMediaBindings', 'completionPending.mediaIds',
  'completionPending.previousBindings', 'completionPending.additionIds', 'completionPending.removalBindings'])('T2-G-009 archived historical no-guard task protects %s', async field => {
  const value = /Bindings$/.test(field) ? [{ mediaId: new mongoose.Types.ObjectId(input.mediaId), bindingOperationId: randomUUID() }]
    : [new mongoose.Types.ObjectId(input.mediaId)];
  await Task.collection.updateOne({ _id: task._id }, { $set: { status: 'archived', [field]: value } });
  expect(await Guard.countDocuments()).toBe(0);
  expect(await service.retire(input)).toEqual({ ...input, state: 'in_use' });
  expect((await Guard.findOne({ mediaId: input.mediaId })).state).toBe('available');
});

test.each(['unknown family', 'wrong child', 'child removed', 'child projection changed'])('T2-G-008 rejects %s without creating a guard', async kind => {
  if (kind === 'unknown family') input.familyId = String(id());
  if (kind === 'wrong child') input.childId = String(id());
  if (kind === 'child removed') await Family.updateOne({ _id: family._id }, { $set: { childIds: [] } });
  if (kind === 'child projection changed') await User.updateOne({ _id: child }, { $set: { familyId: id() } });
  await expect(service.retire(input)).rejects.toMatchObject({ statusCode: 403, code: 'CHILD_ACCESS_DENIED' });
  expect(await Guard.countDocuments()).toBe(0);
});

test('T2-G-003 simultaneous first retirements and a new claim cannot both commit ownership', async () => {
  const results = await Promise.allSettled([service.retire(input), service.retire(input), claim()]);
  expect(await Guard.countDocuments()).toBe(1);
  const guard = await Guard.findOne({ mediaId: input.mediaId });
  if (guard.state === 'retired') {
    expect(await Operation.countDocuments()).toBe(0);
    expect(results[2]).toMatchObject({ status: 'rejected', reason: { code: 'RESOURCE_NOT_FOUND' } });
  } else {
    expect(await Operation.countDocuments()).toBe(1);
    expect(results[2]).toMatchObject({ status: 'rejected', reason: { code: 'MEDIA_REFERENCE_PENDING' } });
  }
  for (const result of results.slice(0, 2)) {
    expect(result).toMatchObject({ status: 'fulfilled', value: { state: guard.state === 'retired' ? 'granted' : 'in_use' } });
  }
});

test('T2-G-004 commit acknowledgement loss replays original retirement and rollback grants nothing', async () => {
  const lost = createCompletionMediaRetirementService({ transactionRunner: async work => {
    await runner(work); throw Error('synthetic post-commit failure');
  } });
  await expect(lost.retire(input)).rejects.toMatchObject({ statusCode: 503, code: 'MEDIA_RETIREMENT_PENDING' });
  const before = await snapshot();
  expect(await service.retire(input)).toEqual({ ...input, state: 'granted' });
  expect(await snapshot()).toEqual(before);
  const another = { ...input, mediaId: String(id()), retirementId: randomUUID() };
  const rolledBack = createCompletionMediaRetirementService({ transactionRunner: work => runner(async session => {
    await work(session); throw Error('synthetic pre-commit failure');
  }) });
  await expect(rolledBack.retire(another)).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_PENDING' });
  expect(await snapshot()).toEqual(before);
});

test.each([false, true])('T2-G-003 corrupt lost owner/pending cannot grant retirement (legacy guard=%s)', async legacy => {
  await expect(claim()).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  await Task.collection.updateOne({ _id: task._id }, { $unset: { activeCompletionOperation: '', completionPending: '' },
    $set: { completionMediaReferenceState: 'stable' } });
  if (legacy) await Guard.deleteMany({});
  const before = await snapshot();
  await expect(service.retire(input)).rejects.toMatchObject({ statusCode: 503, code: 'MEDIA_RETIREMENT_PENDING' });
  expect(await snapshot()).toEqual(before);
});

test('T2-G-003 unrelated intact active intent does not prevent proof of unused media', async () => {
  await expect(claim()).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  const unrelated = { ...input, mediaId: String(id()), retirementId: randomUUID() };
  expect(await service.retire(unrelated)).toEqual({ ...unrelated, state: 'granted' });
  expect((await Guard.findOne({ mediaId: input.mediaId })).state).toBe('available');
});

test('T2-G-003 orphan task intent without ledger blocks even another media retirement', async () => {
  await expect(claim()).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  await Operation.deleteMany({});
  const before = await snapshot();
  await expect(service.retire({ ...input, mediaId: String(id()) })).rejects.toMatchObject({ code: 'MEDIA_RETIREMENT_PENDING' });
  expect(await snapshot()).toEqual(before);
});

test('T2-G-003 forced overlap retries a claim snapshot after first guard insertion commits retired', async () => {
  let publish, ready, probed;
  const gate = new Promise(resolve => { publish = resolve; });
  const holding = new Promise(resolve => { ready = resolve; });
  const touched = new Promise(resolve => { probed = resolve; });
  const first = createCompletionMediaRetirementService({ transactionRunner: work => runner(async session => {
    const result = await work(session); ready(); await gate; return result;
  }) }).retire(input);
  await holding;
  const original = Guard.findOneAndUpdate;
  const probe = jest.spyOn(Guard, 'findOneAndUpdate').mockImplementation(function (...args) {
    const query = original.apply(this, args), exec = query.exec;
    query.exec = function (...execArgs) {
      const result = exec.apply(this, execArgs); probed(); return result;
    };
    return query;
  });
  let attempts = 0;
  const completing = claim({ transactionRunner: (work, label) => runner(session => {
    if (label === 'claim') attempts += 1;
    return work(session);
  }) }).then(value => ({ value }), reason => ({ reason }));
  let failure;
  try {
    await Promise.race([touched, completing.then(() => { throw Error('Claim bypassed the contested guard write'); })]);
  } catch (cause) { failure = cause; } finally { publish(); probe.mockRestore(); }
  const [retired, completion] = await Promise.all([first, completing]);
  if (failure) throw failure;
  expect(retired).toEqual({ ...input, state: 'granted' });
  expect(completion).toMatchObject({ reason: { code: 'RESOURCE_NOT_FOUND' } });
  expect(attempts).toBeGreaterThanOrEqual(2);
  expect(await Operation.countDocuments()).toBe(0);
  expect((await Guard.findOne()).state).toBe('retired');
});

test('T2-G-003 duplicate first-upsert retry re-reads retired state instead of granting new use', async () => {
  let first = true;
  const completing = claim({ transactionRunner: async (work, label) => {
    if (label === 'claim' && first) {
      first = false;
      await service.retire(input);
      throw Object.assign(Error('synthetic unique first-upsert collision'), { code: 11000,
        keyPattern: { familyId: 1, childId: 1, mediaId: 1 } });
    }
    return runner(work);
  } });
  await expect(completing).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  expect(first).toBe(false);
  expect(await Operation.countDocuments()).toBe(0);
  expect((await Guard.findOne()).state).toBe('retired');
});

test.each([null, [], {}, { mediaId: 'invalid' }, { retirementId: 'invalid' }, { actorId: 'not allowed' }])('T2-G-008 strict request rejects %j without writes', async extra => {
  const payload = extra === null || Array.isArray(extra) ? extra : Object.keys(extra).length ? { ...input, ...extra } : {};
  await expect(service.retire(payload)).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  expect(await Guard.countDocuments()).toBe(0);
});

const application = () => {
  const app = express(); app.use(express.json());
  app.use('/api/internal/completion-media-retirements', createCompletionMediaRetirementRouter({ env, service }));
  app.use(errorHandler); return app;
};
test.each([undefined, env.MEDIA_REFERENCE_SERVICE_TOKEN, env.INTERNAL_SERVICE_TOKEN, env.GATEWAY_IDENTITY_SECRET])('T2-G-008 internal HTTP denies missing or unrelated service credentials (%#)', async supplied => {
  let call = (await request(application())).post('/api/internal/completion-media-retirements')
    .set('x-user-id', parent.id).set('x-user-role', 'parent');
  if (supplied) call = call.set('x-service-token', supplied);
  const result = await call.send(input);
  expect(result.status).toBe(401);
  expect(result.body.error.code).toBe('INVALID_SERVICE_CREDENTIAL');
  expect(await Guard.countDocuments()).toBe(0);
});
test('T2-G-008 dedicated internal HTTP returns scoped result and rejects query overrides', async () => {
  const app = application();
  const call = path => request(app).then(client => client.post(path).set('x-service-token', token).send(input));
  expect((await call('/api/internal/completion-media-retirements?familyId=override')).status).toBe(400);
  expect(await Guard.countDocuments()).toBe(0);
  const result = await call('/api/internal/completion-media-retirements');
  expect(result.status).toBe(200);
  expect(result.headers['cache-control']).toBe('no-store');
  expect(result.body).toEqual({ success: true, data: { ...input, state: 'granted' } });
});
test.each([undefined, '', ' '.repeat(32), env.MEDIA_REFERENCE_SERVICE_TOKEN,
  env.INTERNAL_SERVICE_TOKEN, env.GATEWAY_IDENTITY_SECRET])('T2-G-008 invalid or reused configured credential fails closed (%#)', configured => {
  expect(() => createCompletionMediaRetirementRouter({ env: { ...env, COMPLETION_RETIREMENT_SERVICE_TOKEN: configured }, service }))
    .toThrow('COMPLETION_RETIREMENT_CREDENTIAL_INVALID');
});

describe('T2-G status read-only retirement evidence', () => {
  const statusPath = '/api/internal/completion-media-retirements/status';
  const statusSnapshot = () => Promise.all([Family, User, Task, Operation, Guard]
    .map(model => model.collection.find().sort({ _id: 1 }).toArray()));
  const seed = async state => {
    if (state === 'retired') await service.retire(input);
    if (state === 'available') await expect(claim()).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
  };

  test.each(['absent', 'available', 'retired'])('%s returns normalized scope with zero writes including timestamps/revision', async state => {
    await seed(state);
    const before = await statusSnapshot();
    const uppercase = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value.toUpperCase()]));
    expect(await service.status(uppercase)).toEqual({ ...input, state });
    expect(await service.status(input)).toEqual({ ...input, state });
    expect(await statusSnapshot()).toEqual(before);
    expect(await Guard.countDocuments()).toBe(state === 'absent' ? 0 : 1);
  });
  test.each(['absent', 'available'])('%s echoes any requested retirementId without storing that identity', async state => {
    await seed(state);
    const before = await statusSnapshot(), other = { ...input, retirementId: randomUUID() };
    expect(await service.status(other)).toEqual({ ...other, state });
    expect(await statusSnapshot()).toEqual(before);
    if (state === 'available') expect((await Guard.findOne()).retirementId).toBeNull();
  });
  test('retired with a different command returns conflict and preserves original evidence', async () => {
    await seed('retired'); const before = await statusSnapshot();
    await expect(service.status({ ...input, retirementId: randomUUID() }))
      .rejects.toMatchObject({ statusCode: 409, code: 'MEDIA_RETIREMENT_CONFLICT' });
    expect(await statusSnapshot()).toEqual(before);
  });
  test.each(['unknown family', 'wrong child', 'child removed', 'child projection changed', 'child role changed'])('live %s is denied even with an existing retired guard', async kind => {
    await seed('retired'); let command = { ...input };
    if (kind === 'unknown family') command.familyId = String(id());
    if (kind === 'wrong child') command.childId = String(id());
    if (kind === 'child removed') await Family.updateOne({ _id: family._id }, { $set: { childIds: [] } });
    if (kind === 'child projection changed') await User.updateOne({ _id: child }, { $set: { familyId: id() } });
    if (kind === 'child role changed') await User.collection.updateOne({ _id: child }, { $set: { role: 'parent' } });
    const before = await statusSnapshot();
    await expect(service.status(command)).rejects.toMatchObject({ statusCode: 403, code: 'CHILD_ACCESS_DENIED' });
    expect(await statusSnapshot()).toEqual(before);
  });
  test('another valid family sees absent, never a foreign retired state or conflict', async () => {
    await seed('retired');
    const anotherChild = id(), anotherParent = id();
    const anotherFamily = await Family.create({ familyName: 'Other synthetic family', ownerParentId: anotherParent,
      memberParentIds: [anotherParent], childIds: [anotherChild] });
    await User.collection.insertMany([
      { _id: anotherParent, username: String(anotherParent), email: anotherParent + '@example.test', role: 'parent' },
      { _id: anotherChild, username: String(anotherChild), email: anotherChild + '@example.test', role: 'student', familyId: anotherFamily._id }
    ]);
    const command = { ...input, familyId: String(anotherFamily._id), childId: String(anotherChild), retirementId: randomUUID() };
    const before = await statusSnapshot();
    expect(await service.status(command)).toEqual({ ...command, state: 'absent' });
    expect(await statusSnapshot()).toEqual(before);
  });
  test.each([
    ['missing state', { $unset: { state: '' } }], ['unknown state', { $set: { state: 'broken' } }],
    ['missing revision', { $unset: { revision: '' } }], ['zero revision', { $set: { revision: 0 } }],
    ['fractional revision', { $set: { revision: 1.5 } }], ['string revision', { $set: { revision: '1' } }],
    ['missing retirementId', { $unset: { retirementId: '' } }], ['missing retiredAt', { $unset: { retiredAt: '' } }],
    ['available with identity', { $set: { retirementId: '00000000-0000-4000-8000-000000000001' } }],
    ['retired without evidence', { $set: { state: 'retired' } }],
    ['invalid retirement UUID', { $set: { state: 'retired', retirementId: 'invalid', retiredAt: new Date() } }],
    ['invalid retired date', { $set: { state: 'retired', retirementId: '00000000-0000-4000-8000-000000000001', retiredAt: 'invalid' } }]
  ])('corrupt %s fails closed without repairing raw persisted evidence', async (_name, mutation) => {
    await seed('available'); await Guard.collection.updateOne({ mediaId: new mongoose.Types.ObjectId(input.mediaId) }, mutation);
    const before = await statusSnapshot();
    await expect(service.status(input)).rejects.toMatchObject({ statusCode: 503, code: 'MEDIA_RETIREMENT_PENDING' });
    expect(await statusSnapshot()).toEqual(before);
  });
  test.each([null, [], {}, { mediaId: 'invalid' }, { retirementId: 'invalid' }, { actorId: 'unexpected' }])('strict invalid body %j writes nothing', async extra => {
    const body = extra === null || Array.isArray(extra) ? extra : Object.keys(extra).length ? { ...input, ...extra } : {};
    const before = await statusSnapshot();
    await expect(service.status(body)).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
    expect(await statusSnapshot()).toEqual(before);
  });
  test('a failed or absent transaction cannot return an authoritative status', async () => {
    const before = await statusSnapshot();
    for (const transactionRunner of [work => work(null), async () => { throw Error('synthetic unavailable'); }]) {
      const reader = createCompletionMediaRetirementService({ transactionRunner });
      await expect(reader.status(input)).rejects.toMatchObject({ statusCode: 503, code: 'MEDIA_RETIREMENT_PENDING' });
    }
    expect(await statusSnapshot()).toEqual(before);
  });
  test.each(['absent', 'available', 'retired'])('dedicated HTTP returns exact %s projection with no-store and zero writes', async state => {
    await seed(state); const before = await statusSnapshot();
    const result = await (await request(application())).post(statusPath).set('x-service-token', token).send(input);
    expect(result.status).toBe(200); expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body).toEqual({ success: true, data: { ...input, state } });
    expect(await statusSnapshot()).toEqual(before);
  });
  test.each([undefined, env.MEDIA_REFERENCE_SERVICE_TOKEN, env.INTERNAL_SERVICE_TOKEN, env.GATEWAY_IDENTITY_SECRET])('HTTP rejects absent/shared credentials before body or query validation (%#)', async supplied => {
    const before = await statusSnapshot();
    let call = (await request(application())).post(statusPath + '?override=true')
      .set('x-user-id', parent.id).set('x-user-role', 'parent');
    if (supplied) call = call.set('x-service-token', supplied);
    const result = await call.send({ ...input, extra: true });
    expect(result.status).toBe(401); expect(result.body.error.code).toBe('INVALID_SERVICE_CREDENTIAL');
    expect(await statusSnapshot()).toEqual(before);
  });
  test.each(['query', 'body extra', 'array body'])('HTTP rejects %s with zero writes', async kind => {
    const before = await statusSnapshot();
    const result = await (await request(application())).post(statusPath + (kind === 'query' ? '?mediaId=override' : ''))
      .set('x-service-token', token).send(kind === 'array body' ? [] : kind === 'body extra' ? { ...input, extra: true } : input);
    expect(result.status).toBe(400); expect(result.body.error.code).toBe('VALIDATION_ERROR');
    expect(await statusSnapshot()).toEqual(before);
  });
  test('HTTP preserves conflict and scope-denial classifications without writes', async () => {
    await seed('retired'); const before = await statusSnapshot(), app = application();
    const conflict = await (await request(app)).post(statusPath).set('x-service-token', token)
      .send({ ...input, retirementId: randomUUID() });
    expect(conflict.status).toBe(409); expect(conflict.body.error.code).toBe('MEDIA_RETIREMENT_CONFLICT');
    const denied = await (await request(app)).post(statusPath).set('x-service-token', token)
      .send({ ...input, familyId: String(id()) });
    expect(denied.status).toBe(403); expect(denied.body.error.code).toBe('CHILD_ACCESS_DENIED');
    expect(await statusSnapshot()).toEqual(before);
  });
});
