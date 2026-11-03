// Synthetic dual-store restore only. The Python driver owns actual DeepTutor processes.
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const { createT2Runtime } = require('./serviceRuntime');
const { expectData } = require('./syntheticSeed');
const cmd = () => ({ schemaVersion: 'ai1-min-v1', operationId: randomUUID() });
let runtime, previous;
afterEach(async () => {
  try { await runtime?.stop(); } finally {
    for (const [key, value] of Object.entries(previous || {})) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    runtime = null; previous = null;
  }
});

test('actual dual-store restoration cannot resend, settle, refund or unlock an old job', async () => {
  const directory = process.env.AI1_RESTORE_CONTROL;
  const historical = process.env.AI1_RESTORE_HISTORICAL;
  expect(['accepted', 'sending', 'succeeded', 'failed_not_sent', 'empty']).toContain(historical);
  const exchange = async (phase, data) => {
    const temporary = path.join(directory, phase + '.tmp');
    await fs.writeFile(temporary, JSON.stringify(data), { flag: 'wx', mode: 0o600 });
    await fs.rename(temporary, path.join(directory, phase + '.request.json'));
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      try { return JSON.parse(await fs.readFile(path.join(directory, phase + '.response.json'), 'utf8')); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error('Synthetic restore handshake timed out: ' + phase);
  };
  const profile = JSON.parse(process.env.AI1_ACTUAL_REMOTE_PROFILE);
  const settings = { AI1_MODE: 'enabled', AI1_ALLOW_LOOPBACK: 'true', AI1_LOCAL_STORE_CONTINUOUS: 'true',
    AI1_REMOTE_STORE_CONTINUOUS: 'true', AI1_PROVIDER_PROFILE_CONFIRMED: 'true',
    AI1_OPERATION_URL: 'http://127.0.0.1:1', AI1_OPERATION_TOKEN: 'synthetic-service-credential-00000001',
    AI1_MODEL_PROFILE: JSON.stringify(profile), AI1_BUDGET_LIMITS: JSON.stringify({
      singleMicros: 16384, dayMicros: 163840, monthMicros: 163840, experimentMicros: 163840 }) };
  previous = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]));
  runtime = await createT2Runtime({ beforeStart: () => Object.assign(process.env, settings) });
  const seed = await runtime.seed(), parent = await runtime.login('parent'), outsider = await runtime.login('outsider');
  expectData(await parent.patch(`/api/growth-tasks/${seed.tasks.child.taskId}`, { subject: 'math' }));
  const learningBaseline = await runtime.snapshot();
  const source = { type: 'task', id: seed.tasks.child.taskId };
  const original = { ...cmd(), childId: seed.actors.child.childId, source,
    input: { questionText: '206 * 30', answerText: null, parentContext: '' },
    chapter: { provenance: 'parent_declared', subject: 'math', grade: 4, term: 'upper',
      textbookLabel: 'Synthetic', chapterLabel: '\u591a\u4f4d\u6570\u4e58\u4e24\u4f4d\u6570' }, deidentifiedConfirmed: true };
  const created = expectData(await parent.post('/api/tutor-cycles', original), 201);
  const M = require('../../services/homework-service/models/Ai1');
  const Task = require('../../services/homework-service/models/GrowthTask');
  const { createAi1Service } = require('../../services/homework-service/services/ai1Service');
  const { buildRequest, createOperationClient } = require('../../services/homework-service/services/ai1Operation');
  const identity = { id: seed.actors.parent.userId, role: 'parent' };
  // Reserve without dispatch via the real transactional service, reading the actual synthetic task.
  const setup = createAi1Service({ getRuntime: () => ({ enabled: true, continuousStore: true }),
    getProfile: () => profile, getLimits: () => JSON.parse(settings.AI1_BUDGET_LIMITS),
    sourceReader: { require: async scope => {
      const task = await Task.findOne({ _id: scope.sourceTaskId, familyId: scope.familyId, childId: scope.childId }).lean();
      return task && { id: String(task._id), familyId: String(task.familyId), childId: String(task.childId), subject: task.subject };
    } } });
  const generation = { ...cmd(), expectedCycleStateVersion: created.cycle.stateVersion,
    generationInputHash: created.preview.generationInputHash, modelProfileVersion: created.preview.modelProfileVersion,
    pricingProfileVersion: created.preview.pricingProfileVersion, maxAuthorizedCostMicros: 16384, externalSendConfirmed: true };
  const { job } = await setup.generate({ identity, cycleId: created.cycle.id, body: generation });
  const snapshot = async () => JSON.stringify(await Promise.all(Object.values(M).map(m => m.find().sort({ _id: 1 }).lean())));
  const capture = async () => Promise.all(Object.values(M).map(async model => ({ model,
    bytes: Task.db.base.mongo.BSON.serialize({ rows: await model.collection.find({}).sort({ _id: 1 }).toArray() }) })));
  let saved = await capture(), baseline = await snapshot();
  const claim = await setup.claim({ identity, jobId: job.id });
  expect(claim.claimed).toBe(true);
  await setup.markUnknown({ jobId: job.id, owner: claim.owner });
  if (historical === 'accepted') { saved = await capture(); baseline = await snapshot(); }
  const persisted = await M.Job.findById(job.id).lean();
  const recoveryPath = `/api/tutor-jobs/${job.id}/recover`, cyclePath = `/api/tutor-cycles/${created.cycle.id}`;
  const home = runtime.servers.find(row => row.name === 'homework-service');
  const closeHome = async () => {
    if (!home.server.listening) return;
    const stopped = new Promise((resolve, reject) => home.server.close(error => error ? reject(error) : resolve()));
    home.server.closeAllConnections(); await stopped;
  };
  const startHome = async (origin, isolated) => {
    const target = new URL(origin); expect(target.protocol).toBe('http:'); expect(target.hostname).toBe('127.0.0.1');
    home.server = await require('../../services/homework-service/server').startServer({ host: '127.0.0.1',
      port: Number(new URL(home.url).port), connection: Task.db,
      env: { ...process.env, ...settings, AI1_OPERATION_URL: origin,
        AI1_MODE: isolated ? 'store-isolated' : 'query-only',
        AI1_LOCAL_STORE_CONTINUOUS: isolated ? 'false' : 'true', AI1_REMOTE_STORE_CONTINUOUS: isolated ? 'false' : 'true',
        RESOURCE_SERVICE_URL: runtime.urls['resource-service'], PROGRESS_SERVICE_URL: runtime.urls['progress-service'] } });
  };
  const prepared = await exchange('prepare', { id: persisted.remoteOperationId, payload: buildRequest(persisted) });
  await closeHome(); await startHome(prepared.origin, false);
  const outcome = expectData(await parent.post(recoveryPath, cmd()), historical === 'sending' ? 202 : 200);
  expect(outcome.job.status).toBe(historical === 'sending' ? 'unknown' : historical === 'failed_not_sent' ? 'failed' : 'succeeded');
  const pending = historical === 'sending', failed = historical === 'failed_not_sent';
  const advancedAccounts = await M.Account.find().lean();
  expect(advancedAccounts.map(a => a._id).sort()).toEqual(['experiment', String(persisted.familyId)].sort());
  for (const account of advancedAccounts) expect(account).toMatchObject({
    outstandingMicros: pending ? 16384 : 0, settledMicros: pending || failed ? 0 : 200
  });
  expect(await M.Reservation.findById(persisted.reservationId).lean()).toMatchObject({
    reservedMicros: 16384, settledMicros: pending ? null : failed ? 0 : 200,
    state: pending ? 'reserved_unknown' : failed ? 'released' : 'settled'
  });
  await closeHome();
  const isolated = await exchange('restore', { id: persisted.remoteOperationId });
  for (const { model, bytes } of saved) {
    await model.collection.deleteMany({});
    const { rows } = Task.db.base.mongo.BSON.deserialize(bytes);
    if (rows.length) await model.collection.insertMany(rows);
  }
  expect(await snapshot()).toBe(baseline);
  await startHome(isolated.origin, true);
  for (const [url, body, code] of [
    [recoveryPath, cmd(), 'AI_STORE_ISOLATED'],
    [cyclePath + '/explanation-jobs', generation, 'AI_STORE_ISOLATED'],
    [cyclePath + '/explanation-jobs', { ...generation, operationId: randomUUID() }, 'AI_DISABLED']
  ]) {
    const response = await parent.post(url, body);
    expect(response.status).toBe(503); expect(response.data.error.code).toBe(code);
    expect(await snapshot()).toBe(baseline);
  }
  const detail = expectData(await parent.get(cyclePath));
  expect(detail.job).toMatchObject({ id: job.id, status: historical === 'accepted' ? 'unknown' : 'reserved', canRecover: false });
  expect(detail.artifacts).toEqual([]);
  expect((await outsider.get(cyclePath)).status).toBe(404);
  const remote = createOperationClient({ baseUrl: isolated.origin, token: settings.AI1_OPERATION_TOKEN, allowLoopback: true });
  for (const record of [persisted, { ...persisted, remoteOperationId: randomUUID() }]) {
    for (const method of ['get', 'put']) await expect(remote[method](record)).rejects.toMatchObject({
      code: 'AI_STORE_ISOLATED', statusCode: 503 });
  }
  expect(await snapshot()).toBe(baseline);
  const restored = await M.Job.findById(job.id).lean(), reservation = await M.Reservation.findById(restored.reservationId).lean();
  expect(restored.remoteOperationId).toBe(persisted.remoteOperationId);
  expect(restored.remoteRequestHash).toBe(persisted.remoteRequestHash);
  expect(reservation).toMatchObject({ reservedMicros: 16384, settledMicros: null,
    state: historical === 'accepted' ? 'reserved_unknown' : 'reserved' });
  const accounts = await M.Account.find().lean(); expect(accounts).toHaveLength(2);
  for (const account of accounts) expect(account).toMatchObject({ outstandingMicros: 16384, settledMicros: 0 });
  const slot = await M.Slot.findById('global').lean();
  if (historical === 'accepted') expect(String(slot.jobId)).toBe(job.id);
  else expect(slot?.jobId || null).toBeNull();
  expect(await runtime.snapshot()).toEqual(learningBaseline);
  await fs.writeFile(path.join(directory, 'result.json'), JSON.stringify({ id: restored.remoteOperationId,
    hash: restored.remoteRequestHash, historical, noLocalChange: true }), { mode: 0o600 });
});
