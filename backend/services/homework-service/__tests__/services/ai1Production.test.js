const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const { createHttpTestHarness } = require('../../../../common/test/httpTestHarness');
const { createProductionApp } = require('../../server');
const { createApp: createGateway } = require('../../../../gateway/server');
const { createAi1Service } = require('../../services/ai1Service');
const express = require('express');
const { sha } = require('../../services/ai1Contract');
const Task = require('../../models/GrowthTask');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const M = require('../../models/Ai1');
const { request, close } = createHttpTestHarness();
const id = () => String(new mongoose.Types.ObjectId());
const env = { NODE_ENV: 'test', ENABLE_RABBITMQ: 'false', COMPLETION_PROTOCOL_MODE: 'enabled',
  RESOURCE_SERVICE_URL: 'http://127.0.0.1:1', PROGRESS_SERVICE_URL: 'http://127.0.0.1:1',
  MEDIA_REFERENCE_SERVICE_TOKEN: 'synthetic-ai1-media-credential-at-least32',
  COMPLETION_RETIREMENT_SERVICE_TOKEN: 'synthetic-ai1-retirement-credential-32',
  INTERNAL_SERVICE_TOKEN: process.env.INTERNAL_SERVICE_TOKEN };
let parent, coparent, child, sibling, outsider, family, app, cycle, original, price, fixture;
const cmd = () => ({ schemaVersion: 'ai1-min-v1', operationId: randomUUID() });
const snapshot = async () => JSON.stringify(await Promise.all(Object.values(M).map(m => m.find().sort({ _id: 1 }).lean())));
const call = async (method, path, body, actor = parent) => {
  let q = (await request(app))[method](path);
  if (actor) q = q.set('Authorization', 'Bearer ' + jwt.sign(actor, process.env.JWT_SECRET));
  return body === undefined ? q : q.send(body);
};
const formalApp = async (extra = {}, precheck = true) => {
  const homework = createProductionApp({ env: { ...env, ...extra } });
  if (Object.keys(extra).length && precheck) await homework.locals.assertAi1Ready();
  const host = new URL((await request(homework)).get('/').url).origin;
  return createGateway({ serviceHosts: { user: host, homework: host }, jwtSecret: process.env.JWT_SECRET,
    identitySecret: process.env.GATEWAY_IDENTITY_SECRET, rateLimitOptions: { max: 1000 } });
};
beforeAll(async () => { for (const m of [...Object.values(M), Family, User]) await m.init(); });
beforeEach(async () => {
  parent = { id: id(), role: 'parent' }; coparent = { id: id(), role: 'parent' }; outsider = { id: id(), role: 'parent' };
  child = { id: id(), role: 'student', tokenVersion: 0 }; sibling = { id: id(), role: 'student', tokenVersion: 0 };
  family = await Family.create({ familyName: 'Synthetic formal AI1', ownerParentId: parent.id,
    memberParentIds: [parent.id, coparent.id], childIds: [child.id, sibling.id], timezone: 'UTC' });
  for (const u of [child, sibling]) Object.assign(u, { familyId: String(family._id), childId: u.id });
  await User.collection.insertMany([parent, coparent, child, sibling, outsider].map(u => ({
    _id: new mongoose.Types.ObjectId(u.id), username: u.id, email: `${u.id}@example.test`, role: u.role,
    ...(u.role === 'student' ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {}) })));
  original = { ...cmd(), childId: child.id, source: { type: 'task', id: id() },
    input: { questionText: '124 < 230 & 230 > 124', answerText: null, parentContext: '' },
    chapter: { provenance: 'parent_declared', subject: 'math', grade: 4, term: 'upper', textbookLabel: 'Synthetic',
      chapterLabel: '\u591a\u4f4d\u6570\u4e58\u4e24\u4f4d\u6570' }, deidentifiedConfirmed: true };
  await Task.create({ _id: original.source.id, familyId: family._id, childId: child.id, createdByParentId: parent.id,
    title: 'Synthetic source never sent', taskType: 'practice', dimension: 'academic', subject: 'math', dueDate: '2026-11-01' });
  price = { model: 'synthetic', modelProfileVersion: 'm1', pricingProfileVersion: 'p1',
    checkedAt: new Date(Date.now() - 60000).toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(),
    callWindowMs: 60000, clockMarginMs: 5000, inputPriceMicrosPerMillion: 9000000, outputPriceMicrosPerMillion: 27000000 };
  // Seed a historical ready cycle locally. No Provider or remote operation is constructed.
  fixture = createAi1Service({
    getRuntime: () => ({ enabled: true, continuousStore: true }),
    getProfile: () => price,
    getLimits: () => ({ singleMicros: 184320, dayMicros: 1843200, monthMicros: 1843200, experimentMicros: 1843200 }),
    sourceReader: { require: async () => ({ id: original.source.id, familyId: String(family._id), childId: child.id, subject: 'math' }) }
  });
  cycle = await fixture.create({ identity: parent, body: original });
  app = await formalApp();
});
afterEach(close);

test('formal factories keep new creation and generation off without changing persisted evidence', async () => {
  const before = await snapshot();
  const created = await call('post', '/api/tutor-cycles', { ...original, operationId: randomUUID() });
  expect(created.status).toBe(503); expect(created.body.error.code).toBe('AI_DISABLED');
  const generated = await call('post', `/api/tutor-cycles/${cycle.cycle.id}/explanation-jobs`, {
    ...cmd(), expectedCycleStateVersion: cycle.cycle.stateVersion, generationInputHash: cycle.preview.generationInputHash,
    modelProfileVersion: cycle.preview.modelProfileVersion, pricingProfileVersion: cycle.preview.pricingProfileVersion,
    maxAuthorizedCostMicros: cycle.preview.reservedCeilingMicros, externalSendConfirmed: true
  });
  expect(generated.status).toBe(503); expect(generated.body.error.code).toBe('AI_DISABLED');
  expect(await snapshot()).toBe(before); expect(await M.Job.countDocuments()).toBe(0);
});
test('formal authorized reads remain private and side-effect free across app reconstruction', async () => {
  const before = await snapshot();
  for (const actor of [parent, coparent]) {
    app = await formalApp();
    const r = await call('get', `/api/tutor-cycles/${cycle.cycle.id}`, undefined, actor);
    expect(r.status).toBe(200); expect(r.body.data.preview).toEqual(cycle.preview);
    expect(r.body.data.cycle.id).toBe(cycle.cycle.id);
    expect(r.headers['cache-control']).toBe('no-store');
  }
  expect((await call('get', `/api/tutor-cycles?childId=${child.id}`)).body.data.items).toHaveLength(1);
  expect((await call('get', `/api/tutor-jobs?childId=${child.id}&scope=mine-unfinished`)).body.data.items).toEqual([]);
  expect(await snapshot()).toBe(before);
});
test('formal parent-only routes reject children, outsiders and revoked membership without private content', async () => {
  const before = await snapshot();
  for (const actor of [child, sibling, outsider, null]) {
    const r = await call('get', `/api/tutor-cycles/${cycle.cycle.id}`, undefined, actor);
    expect(r.status).toBe(actor ? 403 : 401); expect(JSON.stringify(r.body)).not.toContain(original.input.questionText);
  }
  await Family.updateOne({ _id: family._id }, { $set: { memberParentIds: [parent.id] } });
  expect((await call('get', `/api/tutor-cycles/${cycle.cycle.id}`, undefined, coparent)).status).toBe(403);
  expect(await snapshot()).toBe(before);
});
test('formal AI mounting does not consume signed identity on manual task routes', async () => {
  const r = await call('get', `/api/growth-tasks?childId=${child.id}`);
  expect(r.status).toBe(200); expect(JSON.stringify(r.body)).not.toContain(original.input.questionText);
});

// Protocol-only remote double: no actual DeepTutor implementation or Provider.
const remote = async () => {
  const state = { puts: 0, gets: 0, operation: null, drop: true, sent: null };
  const server = express(); server.use(express.json());
  server.use((req, res, next) => req.get('x-ai1-service-token') === 'synthetic-ai1-operation-dedicated-32'
    ? next() : res.status(401).end());
  server.put('/internal/deeptutor/operations/:id', (req, res) => {
    state.puts++;
    const b = req.body;
    state.sent = b;
    state.operation = { remoteOperationId: req.params.id, requestHash: b.requestHash,
      modelProfileVersion: b.modelProfileVersion, pricingProfileVersion: b.pricingProfileVersion, sendNotAfter: b.sendNotAfter,
      status: 'succeeded', result: { text: 'Synthetic explanation', contentHash: sha('Synthetic explanation') },
      error: null, usage: { inputTokens: 100, outputTokens: 50 }, sendClaimed: true, updatedAt: new Date().toISOString() };
    if (state.drop) return req.socket.destroy();
    res.json({ success: true, data: { operation: state.operation } });
  });
  server.get('/internal/deeptutor/operations/:id', (req, res) => {
    state.gets++;
    if (state.operation?.remoteOperationId !== req.params.id) return res.status(404).json({ success: false });
    res.json({ success: true, data: { operation: state.operation } });
  });
  const host = new URL((await request(server)).get('/').url).origin;
  return { state, config: { NODE_ENV: 'test', AI1_MODE: 'enabled', AI1_ALLOW_LOOPBACK: 'true',
    AI1_LOCAL_STORE_CONTINUOUS: 'true', AI1_REMOTE_STORE_CONTINUOUS: 'true', AI1_PROVIDER_PROFILE_CONFIRMED: 'true',
    AI1_OPERATION_URL: host, AI1_OPERATION_TOKEN: 'synthetic-ai1-operation-dedicated-32', AI1_MODEL_PROFILE: JSON.stringify(price),
    AI1_BUDGET_LIMITS: JSON.stringify({ singleMicros: 184320, dayMicros: 1843200, monthMicros: 1843200, experimentMicros: 1843200 }) } };
};
const generation = () => ({ ...cmd(), expectedCycleStateVersion: cycle.cycle.stateVersion,
  generationInputHash: cycle.preview.generationInputHash, modelProfileVersion: cycle.preview.modelProfileVersion,
  pricingProfileVersion: cycle.preview.pricingProfileVersion, maxAuthorizedCostMicros: cycle.preview.reservedCeilingMicros,
  externalSendConfirmed: true });
test('direct enabled factory denies writes until actual precheck, without reserving or sending', async () => {
  const { state, config } = await remote(); app = await formalApp(config, false);
  const before = await snapshot();
  const r = await call('post', `/api/tutor-cycles/${cycle.cycle.id}/explanation-jobs`, generation());
  expect(r.status).toBe(503); expect(r.body.error.code).toBe('AI_PROFILE_UNAVAILABLE');
  expect(await snapshot()).toBe(before); expect(state.puts).toBe(0); expect(state.gets).toBe(0);
});
test('formal enabled send loss then query-only restart converges original mapping without another PUT', async () => {
  const { state, config } = await remote(); app = await formalApp(config);
  const response = await call('post', `/api/tutor-cycles/${cycle.cycle.id}/explanation-jobs`, generation());
  expect(response.status).toBe(503); expect(response.body.error.code).toBe('AI_REMOTE_UNAVAILABLE');
  const j = await M.Job.findOne().lean(); expect(j.status).toBe('unknown'); expect(state.puts).toBe(1);
  const reservation = await M.Reservation.findById(j.reservationId).lean(); expect(reservation.settledMicros).toBeNull();
  app = await formalApp({ ...config, AI1_MODE: 'query-only', AI1_MODEL_PROFILE: undefined, AI1_BUDGET_LIMITS: undefined,
    AI1_PROVIDER_PROFILE_CONFIRMED: undefined });
  const discovery = await call('get', `/api/tutor-jobs?childId=${child.id}&scope=mine-unfinished`);
  expect(discovery.body.data.items.map(x => x.id)).toEqual([String(j._id)]); expect(state.gets).toBe(0);
  const path = `/api/tutor-jobs/${j._id}/recover`, command = cmd();
  expect((await call('post', path, command, coparent)).status).toBe(403); expect(state.gets).toBe(0);
  const restored = await call('post', path, command); expect(restored.status).toBe(200);
  expect(restored.body.data.job.status).toBe('succeeded'); expect((await call('post', path, command)).status).toBe(200);
  expect(state.puts).toBe(1); expect(state.gets).toBe(1); expect(await M.Artifact.countDocuments()).toBe(1);
  expect((await M.Job.findById(j._id)).remoteOperationId).toBe(j.remoteOperationId);
  expect((await M.Account.findById('experiment')).settledMicros).toBe(2250);
  expect((await call('post', '/api/tutor-cycles', { ...original, operationId: randomUUID() })).body.error.code).toBe('AI_DISABLED');
  expect((await call('get', `/api/tutor-cycles/${cycle.cycle.id}`)).body.data.artifacts[0].text).toBe('Synthetic explanation');
});
test('formal storage isolation after send loss preserves pending mapping and fees without remote access', async () => {
  const { state, config } = await remote(); app = await formalApp(config);
  expect((await call('post', `/api/tutor-cycles/${cycle.cycle.id}/explanation-jobs`, generation())).status).toBe(503);
  const j = await M.Job.findOne().lean(), before = await snapshot();
  app = await formalApp({ AI1_MODE: 'store-isolated' });
  const r = await call('post', `/api/tutor-jobs/${j._id}/recover`, cmd());
  expect(r.status).toBe(503); expect(r.body.error.code).toBe('AI_STORE_ISOLATED');
  expect(await snapshot()).toBe(before); expect(state.puts).toBe(1); expect(state.gets).toBe(0);
  expect((await call('get', `/api/tutor-cycles/${cycle.cycle.id}`)).status).toBe(200);
});
test.each(['reserved', 'unknown'])('restored BSON %s snapshot cannot resume or release financial ownership', async historical => {
  const { state, config } = await remote(), command = generation();
  const reserved = await fixture.generate({ identity: parent, cycleId: cycle.cycle.id, body: command });
  app = await formalApp(config);
  const recoveryPath = `/api/tutor-jobs/${reserved.job.id}/recover`;
  if (historical === 'unknown') {
    expect((await call('post', recoveryPath, cmd())).status).toBe(503);
  }
  const originalJob = await M.Job.findById(reserved.job.id).lean();
  expect(originalJob.status).toBe(historical);
  const ceiling = cycle.preview.reservedCeilingMicros;
  expect(ceiling).toBeGreaterThan(0);
  expect(await M.Reservation.findById(originalJob.reservationId).lean()).toMatchObject({
    reservedMicros: ceiling, settledMicros: null, state: historical === 'unknown' ? 'reserved_unknown' : 'reserved'
  });
  for (const key of [String(family._id), 'experiment']) {
    expect(await M.Account.findById(key).lean()).toMatchObject({ outstandingMicros: ceiling, settledMicros: 0 });
  }
  const slot = await M.Slot.findById('global').lean();
  if (historical === 'unknown') expect(String(slot.jobId)).toBe(reserved.job.id);
  else expect(slot?.jobId || null).toBeNull();
  const bson = mongoose.mongo.BSON;
  const saved = await Promise.all(Object.values(M).map(async model => ({ model,
    bytes: bson.serialize({ rows: await model.collection.find({}).sort({ _id: 1 }).toArray() }) })));
  const before = await snapshot();
  // Advance the actual local transaction/HTTP path before restoring only this test database.
  state.drop = false;
  expect((await call('post', recoveryPath, cmd())).status).toBe(200);
  expect((await M.Job.findById(reserved.job.id)).status).toBe('succeeded');
  expect((await M.Account.findById('experiment')).settledMicros).toBeGreaterThan(0);
  expect(await M.Artifact.countDocuments()).toBe(1);
  const io = { puts: state.puts, gets: state.gets };
  for (const { model, bytes } of saved) {
    await model.collection.deleteMany({});
    const { rows } = bson.deserialize(bytes);
    if (rows.length) await model.collection.insertMany(rows);
  }
  expect(await snapshot()).toBe(before);
  app = await formalApp({ ...config, AI1_MODE: 'store-isolated',
    AI1_LOCAL_STORE_CONTINUOUS: 'false', AI1_REMOTE_STORE_CONTINUOUS: 'false' });
  for (const [path, body, code] of [
    [recoveryPath, cmd(), 'AI_STORE_ISOLATED'],
    [`/api/tutor-cycles/${cycle.cycle.id}/explanation-jobs`, command, 'AI_STORE_ISOLATED'],
    [`/api/tutor-cycles/${cycle.cycle.id}/explanation-jobs`, { ...command, operationId: randomUUID() }, 'AI_DISABLED']
  ]) {
    const result = await call('post', path, body);
    expect(result.status).toBe(503);
    expect(result.body.error.code).toBe(code);
    expect(await snapshot()).toBe(before);
  }
  const detail = await call('get', `/api/tutor-cycles/${cycle.cycle.id}`);
  expect(detail.status).toBe(200);
  expect(detail.body.data.job.id).toBe(reserved.job.id);
  expect(detail.body.data.job.status).toBe(historical);
  expect(detail.body.data.artifacts).toEqual([]);
  expect((await call('get', `/api/tutor-cycles/${cycle.cycle.id}`, undefined, outsider)).status).toBe(403);
  expect(await snapshot()).toBe(before);
  expect({ puts: state.puts, gets: state.gets }).toEqual(io);
});
test('query-only reserved job cannot send through recovery, original replay or a new command', async () => {
  const { state, config } = await remote(), command = generation();
  const reserved = await fixture.generate({ identity: parent, cycleId: cycle.cycle.id, body: command });
  app = await formalApp({ ...config, AI1_MODE: 'query-only', AI1_MODEL_PROFILE: undefined,
    AI1_BUDGET_LIMITS: undefined, AI1_PROVIDER_PROFILE_CONFIRMED: undefined });
  // Explicit recovery may record its command; the reservation and all financial ownership must stay intact.
  const finances = async () => JSON.stringify(await Promise.all([M.Job, M.Reservation, M.Account, M.Slot, M.Cycle]
    .map(m => m.find().sort({ _id: 1 }).lean())));
  const before = await finances();
  const discovery = await call('get', `/api/tutor-jobs?childId=${child.id}&scope=mine-unfinished`);
  expect(discovery.status).toBe(200);
  expect(discovery.body.data.items).toHaveLength(1);
  expect(discovery.body.data.items[0]).toMatchObject({ id: reserved.job.id, canRecover: false });
  for (const [path, body] of [
    [`/api/tutor-jobs/${reserved.job.id}/recover`, cmd()],
    [`/api/tutor-cycles/${cycle.cycle.id}/explanation-jobs`, command],
    [`/api/tutor-cycles/${cycle.cycle.id}/explanation-jobs`, { ...command, operationId: randomUUID() }]
  ]) {
    const response = await call('post', path, body);
    expect(response.status).toBe(503); expect(response.body.error.code).toBe('AI_DISABLED');
    expect(await finances()).toBe(before);
    expect(state.puts).toBe(0); expect(state.gets).toBe(0);
  }
});
test('formal task preview, generation, co-parent revision/review and reread preserve source and first audit', async () => {
  const { state, config } = await remote(); state.drop = false; app = await formalApp(config);
  const task = await Task.create({ familyId: family._id, childId: child.id, createdByParentId: parent.id,
    title: 'Synthetic title never externally sent', taskType: 'practice', dimension: 'academic', subject: ' \u6570\u5b66 ', dueDate: '2026-11-01' });
  const tasksBefore = JSON.stringify(await Task.find().sort({ _id: 1 }).lean());
  const created = await call('post', '/api/tutor-cycles', { ...original, operationId: randomUUID(), source: { type: 'task', id: String(task._id) } });
  expect(created.status).toBe(201); cycle = created.body.data;
  expect(cycle.preview.requestOptions).toMatchObject({ maxInputTokens: 8192, maxOutputTokens: 4096, thinking: 'disabled', tools: [], attemptLimit: 1 });
  const generationCommand = generation(), generatePath = `/api/tutor-cycles/${cycle.cycle.id}/explanation-jobs`;
  expect((await call('post', generatePath, generationCommand)).status).toBe(202);
  expect((await call('post', generatePath, generationCommand)).status).toBe(202);
  const detail = (await call('get', `/api/tutor-cycles/${cycle.cycle.id}`)).body.data, initial = detail.artifacts[0];
  const seen = { ...cmd(), artifactId: initial.id, artifactVersion: initial.version, artifactContentHash: initial.contentHash,
    expectedArtifactReviewVersion: initial.reviewVersion, expectedCycleStateVersion: detail.cycle.stateVersion };
  const revised = await call('post', `/api/tutor-cycles/${cycle.cycle.id}/explanation-revisions`, {
    ...seen, revisedText: 'Synthetic parent revision', revisionReason: 'Clarify the counting unit'
  }, coparent);
  expect(revised.status).toBe(201); const latest = revised.body.data.artifact;
  const checks = { mathCorrect: true, gradeAppropriate: true, chapterAppropriate: true, wordingReviewed: true };
  const reviewPath = `/api/tutor-cycles/${cycle.cycle.id}/explanation-review`;
  expect((await call('post', reviewPath, { ...seen, operationId: randomUUID(), decision: 'approve', comment: '', checks })).status).toBe(409);
  const review = { ...cmd(), artifactId: latest.id, artifactVersion: latest.version, artifactContentHash: latest.contentHash,
    expectedArtifactReviewVersion: latest.reviewVersion, expectedCycleStateVersion: revised.body.data.cycleStateVersion,
    decision: 'approve', comment: '', checks };
  const approved = await call('post', reviewPath, review, coparent);
  expect(approved.status).toBe(200); expect((await call('post', reviewPath, review, coparent)).body.data).toEqual(approved.body.data);
  expect(approved.body.data.artifact.status).toBe('parent_approved');
  expect(approved.body.data.artifact.review.decision).toBe('approve');
  app = await formalApp(config);
  const reread = await call('get', `/api/tutor-cycles/${cycle.cycle.id}`);
  expect(reread.status).toBe(200);
  expect(reread.body.data.cycle).toMatchObject({ status: 'approved', approvedArtifactId: latest.id });
  expect(reread.body.data.artifacts[1].status).toBe('parent_approved');
  expect(reread.body.data.artifacts[1].review.decision).toBe('approve');
  expect(reread.body.data.artifacts.map(x => x.text)).toEqual(['Synthetic explanation', 'Synthetic parent revision']);
  expect(reread.body.data.artifacts[1].review.reviewerId).toBe(coparent.id);
  expect(reread.body.data.artifacts[1].review).toEqual(approved.body.data.artifact.review);
  expect((await call('get', `/api/tutor-cycles/${cycle.cycle.id}`, undefined, child)).status).toBe(403);
  expect(state.puts).toBe(1); expect(state.gets).toBe(0); expect(await M.Job.countDocuments()).toBe(1);
  expect(state.sent.messages).toEqual(cycle.preview.messages);
  expect(JSON.stringify(state.sent)).not.toContain(task.title); expect(JSON.stringify(state.sent)).not.toContain(child.id);
  expect(JSON.stringify(await Task.find().sort({ _id: 1 }).lean())).toBe(tasksBefore);
});
