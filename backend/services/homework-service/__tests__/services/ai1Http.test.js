const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const { createIdentityHeaders } = require('../../../../common/middleware/gatewayIdentity');
const { errorHandler } = require('../../../../common/middleware/errorHandler');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const M = require('../../models/Ai1');
const C = require('../../services/ai1Contract');
const { createAi1Service } = require('../../services/ai1Service');
const { createOperationClient, buildRequest } = require('../../services/ai1Operation');
const { createAi1Router, createAi1JsonParser } = require('../../routes/ai1');
const token = 'synthetic-dedicated-ai1-service-credential';
const http = axios.create({ proxy: false, timeout: 5000, maxRedirects: 0, validateStatus: () => true });
const id = () => String(new mongoose.Types.ObjectId());
const cmd = () => ({ schemaVersion: 'ai1-min-v1', operationId: randomUUID() });
let servers, parent, coparent, child, sibling, outsider, family, base, remoteBase, service, collection, mode, calls, clock, profile, runtime;
const listen = async app => {
  const server = await new Promise((resolve, reject) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); s.once('error', reject); });
  servers.push(server); return `http://127.0.0.1:${server.address().port}`;
};
const request = (method, path, data, actor = parent, signed = true) => http.request({ method, url: base + path, data,
  headers: signed ? createIdentityHeaders({ method, originalUrl: path, user: actor, secret: process.env.GATEWAY_IDENTITY_SECRET }) : {} });
// Durable protocol double, NOT DeepTutor or a real tokenizer/Provider implementation.
const remoteApp = () => {
  const app = express(); app.use(express.json({ limit: '64kb' }));
  app.use((req, res, next) => {
    if (req.get('x-ai1-service-token') !== token) return res.status(401).json({ success: false, error: { code: 'INVALID_SERVICE_CREDENTIAL', message: 'INVALID_SERVICE_CREDENTIAL', details: [] } });
    if (mode === 'isolated') return res.status(503).json({ success: false, error: { code: 'AI_STORE_ISOLATED', message: 'AI_STORE_ISOLATED', details: [] } });
    next();
  });
  app.get('/internal/deeptutor/operations/:id', async (req, res) => {
    calls.get++;
    const row = await collection.findOne({ _id: req.params.id });
    if (!row) return res.status(404).json({ success: false, error: { code: 'RESOURCE_NOT_FOUND', message: 'RESOURCE_NOT_FOUND', details: [] } });
    res.json({ success: true, data: { operation: row.operation } });
  });
  app.put('/internal/deeptutor/operations/:id', async (req, res) => {
    calls.put++;
    const { requestHash, ...payload } = req.body;
    if (requestHash !== C.hash(payload)) return res.sendStatus(400);
    let row = await collection.findOne({ _id: req.params.id });
    if (row && row.operation.requestHash !== requestHash) return res.sendStatus(409);
    if (!row) {
      const operation = { remoteOperationId: req.params.id, requestHash, modelProfileVersion: payload.modelProfileVersion,
        pricingProfileVersion: payload.pricingProfileVersion, sendNotAfter: payload.sendNotAfter, status: 'accepted',
        result: null, error: null, usage: null, sendClaimed: false, updatedAt: new Date(clock).toISOString() };
      await collection.insertOne({ _id: req.params.id, operation });
      if (mode !== 'accepted') {
        const claimed = await collection.updateOne({ _id: req.params.id, 'operation.sendClaimed': false },
          { $set: { 'operation.sendClaimed': true, 'operation.status': 'sending' } });
        if (claimed.modifiedCount === 1) {
          calls.provider++;
          await collection.updateOne({ _id: req.params.id }, { $set: { 'operation.status': 'succeeded',
            'operation.result': { text: 'Synthetic explanation', contentHash: C.sha('Synthetic explanation') },
            'operation.usage': { inputTokens: 100, outputTokens: 50 } } });
        }
      }
      row = await collection.findOne({ _id: req.params.id });
    }
    if (mode === 'drop') { req.socket.destroy(); return; }
    res.json({ success: true, data: { operation: row.operation } });
  });
  return app;
};
const newService = () => createAi1Service({ now: () => clock, getProfile: () => profile, getRuntime: () => runtime,
  getLimits: () => ({ singleMicros: 184320, dayMicros: 1843200, monthMicros: 1843200, experimentMicros: 1843200 }),
  sourceReader: { require: async q => ({ id: q.sourceTaskId || q.sourceMistakeId, familyId: String(family._id), childId: child.id, subject: 'math' }) },
  operationClient: createOperationClient({ baseUrl: remoteBase, token, allowLoopback: true }) });
const localApp = () => {
  const app = express(); app.locals.logger = { info() {}, warn() {}, error() {} }; app.use(createAi1JsonParser());
  app.use('/api', createAi1Router({ service })); app.use(errorHandler); return app;
};
beforeAll(async () => { for (const model of [...Object.values(M), Family, User]) await model.init(); });
beforeEach(async () => {
  servers = []; calls = { put: 0, get: 0, provider: 0 }; mode = 'ok'; clock = Date.parse('2026-11-01T01:00:00Z');
  runtime = { enabled: true, continuousStore: true };
  profile = { model: 'synthetic', modelProfileVersion: 'model-1', pricingProfileVersion: 'price-1', checkedAt: '2026-11-01T00:00:00.000Z',
    expiresAt: '2026-11-02T00:00:00.000Z', callWindowMs: 60000, clockMarginMs: 5000,
    inputPriceMicrosPerMillion: 9000000, outputPriceMicrosPerMillion: 27000000 };
  parent = { id: id(), role: 'parent' }; coparent = { id: id(), role: 'parent' }; outsider = { id: id(), role: 'parent' };
  child = { id: id(), role: 'student' }; sibling = { id: id(), role: 'student' };
  family = await Family.create({ familyName: 'Synthetic', ownerParentId: parent.id, memberParentIds: [parent.id, coparent.id], childIds: [child.id, sibling.id] });
  for (const u of [child, sibling]) Object.assign(u, { childId: u.id, familyId: String(family._id), tokenVersion: 0 });
  await User.collection.insertMany([parent, coparent, outsider, child, sibling].map(u => ({ _id: new mongoose.Types.ObjectId(u.id),
    role: u.role, username: u.id, email: `${u.id}@example.test`, ...(u.role === 'student' ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {}) })));
  collection = mongoose.connection.db.collection('synthetic_ai1_remote');
  remoteBase = await listen(remoteApp()); service = newService(); base = await listen(localApp());
});
test('review P2 raw whitespace and escaped Unicode count toward 32 KiB before JSON normalization', async () => {
  const body = { ...cmd(), childId: child.id, source: { type: 'task', id: id() },
    input: { questionText: 'x', answerText: null, parentContext: '' }, chapter: { provenance: 'parent_declared', subject: 'math', grade: 4,
      term: 'upper', textbookLabel: 'Synthetic', chapterLabel: '\u591a\u4f4d\u6570\u4e58\u4e24\u4f4d\u6570' }, deidentifiedConfirmed: true };
  const raw = JSON.stringify(body);
  const large = [raw + ' '.repeat(33000), raw.replace('"x"', '"' + '\\u0061'.repeat(4000) + '"') + ' '.repeat(10000)];
  for (const text of large) {
    expect(Buffer.byteLength(text)).toBeGreaterThan(32768);
    const response = await http.post(base + '/api/tutor-cycles', text, { transformRequest: [value => value],
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text),
      ...createIdentityHeaders({ method: 'POST', originalUrl: '/api/tutor-cycles', user: parent, secret: process.env.GATEWAY_IDENTITY_SECRET }) } });
    expect(response.status).toBe(413); expect(response.data.error.code).toBe('AI_INPUT_TOO_LARGE');
    expect(response.headers['cache-control']).toBe('no-store');
  }
  expect(await M.Cycle.countDocuments()).toBe(0); expect(calls.provider).toBe(0);
});
afterEach(async () => { for (const server of servers) await new Promise(resolve => server.close(resolve)); });
test.each(['utf16', 'invalid-utf8'])('private homework parser rejects %s before interpreting the original command', async encoding => {
  const path = '/api/tutor-cycles', text = JSON.stringify({ ...cmd(), childId: child.id, source: { type: 'task', id: id() },
    input: { questionText: 'BYTE_MARKER', answerText: null, parentContext: '' }, chapter: { provenance: 'parent_declared', subject: 'math',
      grade: 4, term: 'upper', textbookLabel: 'Synthetic', chapterLabel: '\u591a\u4f4d\u6570\u4e58\u4e24\u4f4d\u6570' }, deidentifiedConfirmed: true });
  const parts = text.split('BYTE_MARKER');
  const bytes = encoding === 'utf16' ? Buffer.from(text, 'utf16le')
    : Buffer.concat([Buffer.from(parts[0]), Buffer.from([0xff]), Buffer.from(parts[1])]);
  const r = await http.post(base + path, bytes, { transformRequest: [value => value],
    headers: { 'Content-Type': encoding === 'utf16' ? 'application/json; charset=utf-16le' : 'application/json',
      'Content-Length': bytes.length,
      ...createIdentityHeaders({ method: 'POST', originalUrl: path, user: parent, secret: process.env.GATEWAY_IDENTITY_SECRET }) } });
  expect(r.status).toBe(400); expect(r.data.error.code).toBe('VALIDATION_ERROR');
  expect(JSON.stringify(r.data)).not.toContain('BYTE_MARKER'); expect(calls).toEqual({ put: 0, get: 0, provider: 0 });
  expect(await M.Cycle.countDocuments()).toBe(0);
});
test('raw limit assembly fails closed if a generic parser consumed the body first', async () => {
  const app = express(); app.locals.logger = { warn() {}, error() {} }; app.use(express.json());
  app.use(createAi1JsonParser()); app.use('/api', createAi1Router({ service })); app.use(errorHandler);
  const address = await listen(app);
  const r = await http.post(address + '/api/tutor-cycles', cmd());
  expect(r.status).toBe(503); expect(r.data.error.code).toBe('AI_PROFILE_UNAVAILABLE'); expect(await M.Cycle.countDocuments()).toBe(0);
});
const create = async () => {
  const response = await request('POST', '/api/tutor-cycles', { ...cmd(), childId: child.id, source: { type: 'task', id: id() },
    input: { questionText: '124 * 23', answerText: null, parentContext: '' }, chapter: { provenance: 'parent_declared', subject: 'math', grade: 4,
      term: 'upper', textbookLabel: 'Synthetic', chapterLabel: '\u591a\u4f4d\u6570\u4e58\u4e24\u4f4d\u6570' }, deidentifiedConfirmed: true });
  expect(response.status).toBe(201); expect(response.headers['cache-control']).toBe('no-store'); return response.data.data;
};
const generate = (c, body) => request('POST', `/api/tutor-cycles/${c.cycle.id}/explanation-jobs`, body || { ...cmd(),
  expectedCycleStateVersion: 1, generationInputHash: c.preview.generationInputHash, modelProfileVersion: c.preview.modelProfileVersion,
  pricingProfileVersion: c.preview.pricingProfileVersion, maxAuthorizedCostMicros: c.preview.reservedCeilingMicros, externalSendConfirmed: true });
test('real HTTP lost response, both factories rebuilt, discovery and explicit original recovery settle exactly once', async () => {
  const c = await create(); mode = 'drop';
  expect((await generate(c)).status).toBe(503); const j = await M.Job.findOne().lean();
  expect(j.status).toBe('unknown'); expect(calls.provider).toBe(1);
  remoteBase = await listen(remoteApp()); service = newService(); base = await listen(localApp()); mode = 'ok';
  const path = `/api/tutor-jobs?childId=${child.id}&scope=mine-unfinished&page=1&pageSize=20`;
  expect((await request('GET', path)).data.data.items.map(x => x.id)).toEqual([String(j._id)]);
  expect(calls.get).toBe(0);
  const rpath = `/api/tutor-jobs/${j._id}/recover`, body = cmd();
  expect((await request('POST', rpath, body, coparent)).status).toBe(403);
  const result = await request('POST', rpath, body); expect(result.status).toBe(200); expect(result.data.data.job.status).toBe('succeeded');
  expect((await request('POST', rpath, body)).status).toBe(200);
  expect(calls).toEqual({ put: 1, get: 1, provider: 1 }); expect(await M.Artifact.countDocuments()).toBe(1);
  expect((await M.Account.findById('experiment')).settledMicros).toBe(2250);
  const artifactPath = `/api/tutor-artifacts/${result.data.data.job.artifactId}`;
  expect((await request('GET', artifactPath)).data.data.artifact.text).toBe('Synthetic explanation');
  expect((await request('GET', artifactPath, null, child)).status).toBe(403);
  expect((await request('GET', artifactPath, null, outsider)).status).toBe(403);
  expect((await request('GET', artifactPath, null, parent, false)).status).toBe(401);
  expect(JSON.stringify(result.data)).not.toContain(token); expect(JSON.stringify(result.data)).not.toContain(j.remoteOperationId);
  const detail = await request('GET', `/api/tutor-cycles/${c.cycle.id}`);
  expect(detail.data.data.artifacts.map(a => a.id)).toEqual([result.data.data.job.artifactId]);
  expect(detail.data.data.job.id).toBe(String(j._id)); expect(detail.data.data.cycle.currentArtifactId).toBe(result.data.data.job.artifactId);
});
test('restored accepted snapshot is isolated before PUT/GET; no redispatch or refund', async () => {
  const c = await create(); mode = 'accepted'; expect((await generate(c)).status).toBe(202);
  const j = await M.Job.findOne().lean(), saved = await collection.findOne({ _id: j.remoteOperationId });
  await collection.updateOne({ _id: saved._id }, { $set: { 'operation.status': 'succeeded', 'operation.sendClaimed': true } });
  calls.provider++;
  await collection.replaceOne({ _id: saved._id }, saved); mode = 'isolated';
  const before = await M.Reservation.findById(j.reservationId).lean();
  const r = await request('POST', `/api/tutor-jobs/${j._id}/recover`, cmd());
  expect(r.status).toBe(503); expect(r.data.error.code).toBe('AI_STORE_ISOLATED');
  expect(await M.Reservation.findById(j.reservationId).lean()).toEqual(before);
  expect(calls.provider).toBe(1); expect(calls.put).toBe(1); expect((await collection.findOne({ _id: saved._id })).operation.sendClaimed).toBe(false);
  const put = await http.put(`${remoteBase}/internal/deeptutor/operations/${j.remoteOperationId}`, buildRequest(j), { headers: { 'x-ai1-service-token': token } });
  expect(put.status).toBe(503); expect(calls.put).toBe(1);
});
