const mongoose = require('mongoose');
const express = require('express');
const axios = require('axios');
const { randomUUID } = require('crypto');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const { createIdentityHeaders } = require('../../../../common/middleware/gatewayIdentity');
const { errorHandler } = require('../../../../common/middleware/errorHandler');
const { runMongoTransaction } = require('../../../../common/services/mongoTransaction');
const { createCompletionMediaReferenceClient } = require('../../../../common/services/completionMediaReferenceClient');
const { createAi2Service } = require('../../services/ai2Service');
const { createAi2Router, createAi2JsonParser } = require('../../routes/ai2');
const { createAi2MediaAccessRouter } = require('../../routes/ai2MediaAccess');
const { createCompletionMediaReferencesRouter } = require('../../../resource-service/routes/completionMediaReferences');
const { createMediaReferenceCredential } = require('../../../resource-service/middleware/mediaReferenceCredential');
const { createMediaReferenceOperationService } = require('../../../resource-service/services/mediaReferenceOperationService');
const Asset = require('../../../resource-service/models/MediaAsset');
const Reference = require('../../../resource-service/models/MediaReference');
const Operation = require('../../../resource-service/models/MediaReferenceOperation');
const Receipt = require('../../../resource-service/models/MediaDeletionReceipt');
const Tombstone = require('../../../resource-service/models/MediaDeletionTombstone');
const M = require('../../models/Ai2');
const C = require('../../services/ai2Contract');
const id = () => String(new mongoose.Types.ObjectId());
const token = 'synthetic-ai2-integration-reference-token-32';
const http = axios.create({ proxy: false, timeout: 3000, validateStatus: () => true });
let servers, clock, runtime, family, child, parent, packageId, body, base, resourceBase, service, client, dropCommit, dropSubmit;
const runner = work => runMongoTransaction({ mongooseInstance: mongoose, work });
async function listen(app) {
  app.locals.logger = { info() {}, warn() {}, error() {} }; app.use(errorHandler);
  const server = await new Promise((resolve, reject) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); s.once('error', reject); });
  servers.push(server); return `http://127.0.0.1:${server.address().port}`;
}
function rebuild() { service = createAi2Service({ now: () => clock, getRuntime: () => runtime, mediaReferenceClient: client }); }
function dropResponse(app, matches) {
  app.use((req, res, next) => {
    const json = res.json.bind(res);
    res.json = value => { if (value.success && matches(req)) { req.socket.destroy(); return res; } return json(value); };
    next();
  });
}
const request = (method, path, data, identity = child) => http.request({ method, url: base + path, data,
  headers: createIdentityHeaders({ method, originalUrl: path, user: identity, secret: process.env.GATEWAY_IDENTITY_SECRET }) });
const submitPath = () => `/api/ai2/learning-packages/${packageId}/attempts`;
beforeAll(async () => { for (const model of [...Object.values(M), Family, User, Asset, Reference, Operation, Receipt, Tombstone]) await model.init(); });
beforeEach(async () => {
  servers = []; dropCommit = false; dropSubmit = false; clock = Date.parse('2026-11-03T05:00:00Z');
  runtime = { enabled: true, continuousStore: true }; child = { id: id(), role: 'student', tokenVersion: 0 }; parent = { id: id(), role: 'parent' };
  family = await Family.create({ familyName: 'Synthetic combined HTTP', ownerParentId: parent.id, memberParentIds: [parent.id], childIds: [child.id] });
  Object.assign(child, { familyId: String(family._id), childId: child.id });
  await User.collection.insertMany([child, parent].map(u => ({ _id: new mongoose.Types.ObjectId(u.id), username: u.id, email: `${u.id}@example.test`, role: u.role,
    ...(u.role === 'student' ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {}) })));
  packageId = id();
  // Already-published AI2 fixture. Publication itself is covered by the separate real AI1 service tests.
  await M.Package.create({ _id: packageId, familyId: family._id, childId: child.id, ai1CycleId: id(), source: { type: 'task', id: id() },
    artifact: { id: id(), version: 1, contentHash: C.hash('synthetic') }, childSnapshot: { questionText: 'Synthetic correction' },
    childSnapshotHash: C.hash('synthetic'), publishedBy: parent.id, publishedAt: new Date(clock), visibility: 'published', learningState: 'open', stateVersion: 1 });
  const mediaIds = [id(), id()];
  for (const mediaId of mediaIds) await Asset.create({ _id: mediaId, familyId: family._id, childId: child.id, uploadedBy: child.id,
    purpose: 'ai2_correction', mimeType: 'image/png', sizeBytes: 100, storageKey: randomUUID() });
  body = { schemaVersion: 'ai2-min-v1', operationId: randomUUID(), expectedPackageVersion: 1, note: 'Synthetic work', mediaIds };
  const resourceApp = express(); resourceApp.use(express.json());
  dropResponse(resourceApp, req => dropCommit && req.originalUrl.endsWith('/commit'));
  resourceApp.use('/api/internal/media/references', createCompletionMediaReferencesRouter({ credential: createMediaReferenceCredential(token),
    operationService: createMediaReferenceOperationService({ transactionRunner: runner, now: () => clock, ai2Mode: () => runtime.enabled ? 'enabled' : 'off' }) }));
  resourceBase = await listen(resourceApp);
  client = createCompletionMediaReferenceClient({ resourceServiceUrl: resourceBase, serviceToken: token, axiosInstance: axios.create({ proxy: false }) });
  rebuild(); const homeworkApp = express();
  dropResponse(homeworkApp, req => dropSubmit && req.originalUrl === submitPath());
  const adapter = Object.fromEntries(Object.keys(service).map(k => [k, args => service[k](args)]));
  homeworkApp.use('/api/ai2', createAi2JsonParser(), createAi2Router({ service: adapter }));
  homeworkApp.use('/api/internal/ai2', express.json(), createAi2MediaAccessRouter({ serviceToken: token }));
  base = await listen(homeworkApp);
});
afterEach(async () => { for (const server of servers) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } });
test.each([[1, ''], [10, 'x'.repeat(1000)], [1, '\u{1f600}'.repeat(1000)]])(
  'ATTEMPT-02 real HTTP accepts %i unique images and note boundary %#', async (count, note) => {
    const mediaIds = Array.from({ length: count }, id);
    for (const mediaId of mediaIds) await Asset.create({ _id: mediaId, familyId: family._id, childId: child.id, uploadedBy: child.id,
      purpose: 'ai2_correction', mimeType: 'image/png', sizeBytes: 100, storageKey: randomUUID() });
    const original = { ...body, mediaIds, note };
    const response = await request('POST', submitPath(), original);
    expect(response.status).toBe(201);
    const command = await M.Command.findOne().lean(), attempt = await M.Attempt.findOne().lean();
    expect(command.phase).toBe('SUCCEEDED'); expect(attempt.note).toBe(note);
    expect(attempt.mediaIds.map(String)).toEqual(mediaIds); expect(attempt.mediaBindings).toEqual(command.references);
    expect(command.references.map(r => r.mediaId)).toEqual(mediaIds);
    const refs = await Reference.find({ resourceId: attempt._id }).lean();
    expect(refs).toHaveLength(count);
    for (const ref of refs) expect(ref).toMatchObject({ state: 'bound', operationId: command.remoteOperationId });
    expect((await request('POST', submitPath(), original)).status).toBe(201);
    expect(await M.Command.countDocuments()).toBe(1); expect(await M.Attempt.countDocuments()).toBe(1);
    expect(await Operation.countDocuments()).toBe(1);
  });
test.each([
  ['zero images', () => ({ mediaIds: [] })],
  ['eleven unique images', () => ({ mediaIds: Array.from({ length: 11 }, id) })],
  ['duplicate images', () => ({ mediaIds: [body.mediaIds[0], body.mediaIds[0]] })],
  ['null array slot', () => ({ mediaIds: [body.mediaIds[0], null] })],
  ['wrong ID type', () => ({ mediaIds: [42] })],
  ['1001 note code points', () => ({ note: 'x'.repeat(1001) })],
  ['1001 astral code points', () => ({ note: '\u{1f600}'.repeat(1001) })],
  ['unpaired surrogate', () => ({ note: '\ud800' })],
  ['null note', () => ({ note: null })],
  ['actor injection', () => ({ actorId: parent.id })]
])('ATTEMPT-02 invalid %s has no reservation, business writes or resource HTTP', async (_, change) => {
  const models = [...Object.values(M), Asset, Reference, Operation, Receipt, Tombstone];
  const snapshot = () => Promise.all(models.map(model => model.find().sort({ _id: 1 }).lean()));
  const before = await snapshot(), calls = [];
  const observe = req => calls.push({ method: req.method, url: req.url });
  servers[0].on('request', observe);
  try {
    const response = await request('POST', submitPath(), { ...body, ...change() });
    expect(response.status).toBe(400); expect(response.data.error.code).toBe('VALIDATION_ERROR');
    expect(await snapshot()).toEqual(before); expect(calls).toEqual([]);
  } finally { servers[0].removeListener('request', observe); }
});
test('real resource commit response loss -> readonly discovery -> rebuilt original command recovery publishes exactly one Attempt', async () => {
  dropCommit = true;
  const pending = await request('POST', submitPath(), body); expect(pending.status).toBe(202);
  const saved = await M.Command.findById(pending.data.data.command.id).lean();
  expect(saved.remoteOperationId).not.toBe(body.operationId);
  expect((await Operation.findOne({ operationId: saved.remoteOperationId })).state).toBe('COMMITTED');
  expect(await M.Attempt.countDocuments()).toBe(0);
  const before = JSON.stringify(await M.Command.find().lean());
  expect((await request('GET', '/api/ai2/commands?scope=mine')).data.data.items[0].phase).toBe(saved.phase);
  expect(JSON.stringify(await M.Command.find().lean())).toBe(before);
  clock += 31000; dropCommit = false; rebuild();
  const recovered = await request('POST', `/api/ai2/commands/${saved._id}/recover`, { schemaVersion: body.schemaVersion, operationId: body.operationId });
  expect(recovered.status).toBe(200); expect(recovered.data.data.command.phase).toBe('SUCCEEDED');
  const a = await M.Attempt.findOne().lean(); expect(a.mediaIds.map(String)).toEqual(body.mediaIds);
  expect(a.mediaBindings).toEqual(saved.references);
  expect((await request('POST', submitPath(), body)).status).toBe(201);
  expect(await M.Attempt.countDocuments()).toBe(1); expect(await Operation.countDocuments()).toBe(1);
  const access = await http.post(base + '/api/internal/ai2/media-access-check', { familyId: String(family._id), childId: child.id,
    actorId: child.id, role: child.role, mediaId: body.mediaIds[0], bindings: [{ attemptId: String(a._id), bindingOperationId: saved.remoteOperationId }] },
  { headers: { 'x-service-token': token } });
  expect(access.data).toEqual({ success: true, data: { allowed: true } });
});
test('public response loss replays same terminal; parent cannot submit or restore a child command', async () => {
  expect((await request('POST', submitPath(), body, parent)).status).toBe(403);
  dropSubmit = true; await expect(request('POST', submitPath(), body)).rejects.toMatchObject({ code: 'ECONNRESET' });
  const c = await M.Command.findOne().lean(); expect(c.phase).toBe('SUCCEEDED');
  dropSubmit = false; rebuild(); const result = await request('POST', submitPath(), body);
  expect(result.status).toBe(201); expect(result.data.data.command.id).toBe(String(c._id));
  expect((await request('POST', `/api/ai2/commands/${c._id}/recover`, { schemaVersion: body.schemaVersion, operationId: body.operationId }, parent)).status).toBe(403);
  expect(await M.Attempt.countDocuments()).toBe(1);
  await User.updateOne({ _id: child.id }, { $set: { 'childProfile.tokenVersion': 1 } });
  expect((await request('POST', submitPath(), body)).status).toBe(401);
  expect(await M.Attempt.countDocuments()).toBe(1);
});
test.each(['pending', 'terminal'].flatMap(phase => ['membership', 'token', 'deletedActor'].map(revocation => [phase, revocation])))(
  'AUTH-01/RECOVER-04 %s original actor loses %s: discovery, recovery and replay cannot mutate or call resource', async (phase, revocation) => {
    dropCommit = phase === 'pending';
    expect((await request('POST', submitPath(), body)).status).toBe(phase === 'pending' ? 202 : 201);
    const saved = await M.Command.findOne().lean();
    expect(saved.phase === 'SUCCEEDED').toBe(phase === 'terminal');
    if (revocation === 'membership') await Family.updateOne({ _id: family._id }, { $pull: { childIds: child.id } });
    if (revocation === 'token') await User.updateOne({ _id: child.id }, { $inc: { 'childProfile.tokenVersion': 1 } });
    if (revocation === 'deletedActor') await User.deleteOne({ _id: child.id });
    // Lease expiry removes the live-owner shortcut: rejection must be authorization, not a busy receipt.
    clock += 31000; dropCommit = false; rebuild();
    const snapshot = () => Promise.all([...Object.values(M), Asset, Reference, Operation, Receipt, Tombstone]
      .map(model => model.find().sort({ _id: 1 }).lean()));
    const before = await snapshot(), calls = [];
    const observe = req => calls.push(req.method + ' ' + req.url);
    servers[0].on('request', observe);
    try {
      for (const [method, path, payload] of [
        ['GET', '/api/ai2/commands?scope=mine'], ['GET', `/api/ai2/commands/${saved._id}`],
        ['POST', `/api/ai2/commands/${saved._id}/recover`, { schemaVersion: body.schemaVersion, operationId: body.operationId }],
        ['POST', submitPath(), body]
      ]) {
        const response = await request(method, path, payload);
        expect(response.status).toBe(revocation === 'membership' ? 403 : 401);
        expect(response.data.error.code).toBe(revocation === 'membership' ? 'CHILD_ACCESS_DENIED' : 'STALE_CHILD_TOKEN');
        expect(response.data).not.toHaveProperty('data');
        expect(await snapshot()).toEqual(before); expect(calls).toEqual([]);
      }
    } finally { servers[0].removeListener('request', observe); }
  });
test.each([false, true])('WITHDRAW-02 withdrawal during real prepared response, commit loss=%s, retains exact mapping until cleanup', async lost => {
  let enter, release, pending;
  const entered = new Promise(resolve => { enter = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const prepare = client.prepare.bind(client);
  const spy = jest.spyOn(client, 'prepare').mockImplementation(async args => {
    const result = await prepare(args);
    enter(); await gate; return result;
  });
  try {
    pending = request('POST', submitPath(), body).then(value => ({ value }), error => ({ error }));
    await Promise.race([entered, pending.then(() => { throw Error('Submit completed before prepare barrier'); })]);
    const saved = await M.Command.findOne({ endpointOperation: 'ai2.submit' }).lean();
    expect(saved).toMatchObject({ phase: 'RESERVED', payload: body });
    expect((await Operation.findOne({ operationId: saved.remoteOperationId })).state).toBe('PREPARED');
    const prepared = await Reference.find({ resourceId: saved.attemptId }).lean();
    expect(prepared).toHaveLength(body.mediaIds.length);
    expect(prepared.every(r => r.state === 'prepared' && r.operationId === saved.remoteOperationId)).toBe(true);
    const withdrawal = await request('POST', `/api/ai2/learning-packages/${packageId}/withdraw`, {
      schemaVersion: body.schemaVersion, operationId: randomUUID(), expectedPackageVersion: 2, reason: 'Withdraw while prepare pending'
    }, parent);
    expect(withdrawal.status).toBe(200);
    expect((await M.Package.findById(packageId)).activeCommandId).toEqual(saved._id);
    const audit = (await M.Package.findById(packageId).lean()).withdrawal;
    dropCommit = lost; release();
    const outcome = await pending; if (outcome.error) throw outcome.error;
    expect(outcome.value.status).toBe(lost ? 202 : 200);
    if (lost) {
      expect((await Operation.findOne({ operationId: saved.remoteOperationId })).state).toBe('COMMITTED');
      expect((await M.Package.findById(packageId)).activeCommandId).toEqual(saved._id);
      expect(await M.Attempt.countDocuments()).toBe(0);
      clock += 31000; dropCommit = false; runtime.enabled = false; rebuild();
    }
    const recovered = await request('POST', `/api/ai2/commands/${saved._id}/recover`, {
      schemaVersion: body.schemaVersion, operationId: body.operationId });
    expect(recovered.status).toBe(200);
    expect(recovered.data.data.command).toMatchObject({ id: String(saved._id), phase: 'FAILED', failureCode: 'AI2_PACKAGE_WITHDRAWN' });
    expect(recovered.data.data).not.toHaveProperty('package'); expect(recovered.data.data).not.toHaveProperty('attempt');
    const final = await M.Command.findById(saved._id).lean();
    for (const key of ['remoteOperationId', 'referencesHash', 'references', 'payload', 'attemptId', 'actorId']) expect(final[key]).toEqual(saved[key]);
    expect(final.owner).toBeNull(); expect(final.leaseExpiresAt).toBeNull();
    expect(await M.Attempt.countDocuments()).toBe(0);
    const rows = await Reference.find({ resourceId: saved.attemptId }).lean();
    expect(rows.map(r => String(r.mediaId)).sort()).toEqual(body.mediaIds.slice().sort());
    for (const row of rows) expect(row).toMatchObject({ state: 'released', operationId: saved.remoteOperationId, resourceType: 'ai2_attempt', field: 'correctionMediaIds' });
    const p = await M.Package.findById(packageId).lean();
    expect(p).toMatchObject({ visibility: 'withdrawn', learningState: 'open', activeCommandId: null, currentAttemptId: null, currentAttemptVersion: null });
    expect(p.withdrawal).toEqual(audit);
    expect(await Receipt.countDocuments()).toBe(0); expect(await Tombstone.countDocuments()).toBe(0);
  } finally { release(); if (pending) await pending; spy.mockRestore(); }
});
test('withdrawal after unknown commit converges exact unbind in off mode without exposing withdrawn body or creating Attempt', async () => {
  dropCommit = true; const pending = await request('POST', submitPath(), body); expect(pending.status).toBe(202);
  const c = await M.Command.findOne().lean();
  const withdrawn = await request('POST', `/api/ai2/learning-packages/${packageId}/withdraw`, {
    schemaVersion: body.schemaVersion, operationId: randomUUID(), expectedPackageVersion: 2, reason: 'Synthetic stop' }, parent);
  expect(withdrawn.status).toBe(200); runtime.enabled = false; clock += 31000; dropCommit = false; rebuild();
  const result = await request('POST', `/api/ai2/commands/${c._id}/recover`, { schemaVersion: body.schemaVersion, operationId: body.operationId });
  expect(result.status).toBe(200); expect(result.data.data.command).toMatchObject({ phase: 'FAILED', failureCode: 'AI2_PACKAGE_WITHDRAWN' });
  expect(result.data.data).not.toHaveProperty('package'); expect(await M.Attempt.countDocuments()).toBe(0);
  const refs = await Reference.find({ resourceId: c.attemptId }).lean();
  expect(refs).toHaveLength(2); for (const ref of refs) expect(ref).toMatchObject({ operationId: c.remoteOperationId, state: 'released' });
  expect((await M.Package.findById(packageId)).activeCommandId).toBeNull();
  expect((await request('GET', `/api/ai2/commands/${c._id}`)).data.data.command).not.toHaveProperty('payload');
  const stable = JSON.stringify({ operations: await Operation.find().lean(), refs: await Reference.find().lean(), commands: await M.Command.find().lean() });
  for (const [path, payload] of [[submitPath(), body], [`/api/ai2/commands/${c._id}/recover`, { schemaVersion: body.schemaVersion, operationId: body.operationId }]]) {
    const replay = await request('POST', path, payload);
    expect(replay.status).toBe(200);
    expect(replay.data.data.pending).toBe(false);
    expect(replay.data.data.command).toMatchObject({ id: String(c._id), phase: 'FAILED', failureCode: 'AI2_PACKAGE_WITHDRAWN', resultReference: null });
    expect(replay.data.data.command).not.toHaveProperty('payload');
    for (const key of ['package', 'attempt', 'payload']) expect(replay.data.data).not.toHaveProperty(key);
  }
  expect(JSON.stringify({ operations: await Operation.find().lean(), refs: await Reference.find().lean(), commands: await M.Command.find().lean() })).toBe(stable);
});
