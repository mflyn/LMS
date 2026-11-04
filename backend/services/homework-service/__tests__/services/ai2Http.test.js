const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const { createHash } = require('crypto');
const { createIdentityHeaders } = require('../../../../common/middleware/gatewayIdentity');
const { errorHandler } = require('../../../../common/middleware/errorHandler');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const A = require('../../models/Ai1');
const M = require('../../models/Ai2');
const { createAi2Service } = require('../../services/ai2Service');
const { createAi2Router, createAi2JsonParser } = require('../../routes/ai2');
const http = axios.create({ proxy: false, timeout: 5000, maxRedirects: 0, validateStatus: () => true });
const id = () => String(new mongoose.Types.ObjectId());
const cmd = () => ({ schemaVersion: 'ai2-min-v1', operationId: randomUUID() });
let parent, child, sibling, family, cycleId, service, base, servers, drop, newService;
async function listen(app) {
  const server = await new Promise((resolve, reject) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s)); s.once('error', reject);
  });
  servers.push(server); return `http://127.0.0.1:${server.address().port}`;
}
const request = (method, path, data, actor = parent, signed = true, extra = {}) => http.request({ method, url: base + path, data,
  ...extra, headers: { ...(signed ? createIdentityHeaders({ method, originalUrl: path, user: actor,
    secret: process.env.GATEWAY_IDENTITY_SECRET }) : {}), ...extra.headers } });
beforeAll(async () => { for (const model of [...Object.values(A), ...Object.values(M), Family, User]) await model.init(); });
beforeEach(async () => {
  servers = []; drop = false;
  parent = { id: id(), role: 'parent' }; child = { id: id(), role: 'student', tokenVersion: 0 }; sibling = { id: id(), role: 'student', tokenVersion: 0 };
  family = await Family.create({ familyName: 'Synthetic HTTP', ownerParentId: parent.id, memberParentIds: [parent.id], childIds: [child.id, sibling.id] });
  for (const u of [child, sibling]) Object.assign(u, { familyId: String(family._id), childId: u.id });
  await User.collection.insertMany([parent, child, sibling].map(u => ({ _id: new mongoose.Types.ObjectId(u.id), role: u.role,
    username: u.id, email: `${u.id}@example.test`, ...(u.role === 'student' ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {}) })));
  const artifactId = id(); cycleId = id();
  // HTTP adapter fixture only. ai2Service.test exercises real AI1 revision/approval separately.
  await A.Cycle.create({ _id: cycleId, familyId: family._id, childId: child.id, createdBy: parent.id, sourceType: 'task', sourceId: id(),
    sourceSubject: 'math', subjectAliasVersion: 'math-v1', input: { questionText: '124 * 23', answerText: 'PRIVATE_ANSWER', parentContext: 'PRIVATE_CONTEXT' },
    chapter: { provenance: 'parent_declared', subject: 'math', grade: 4, term: 'upper', textbookLabel: 'Synthetic', chapterLabel: 'Synthetic multiplication' },
    inputHash: '1'.repeat(64), preview: {}, status: 'approved', active: true, stateVersion: 4, currentArtifactId: artifactId, approvedArtifactId: artifactId });
  await A.Artifact.create({ _id: artifactId, familyId: family._id, childId: child.id, cycleId, version: 1, text: 'Synthetic explanation',
    contentHash: createHash('sha256').update('Synthetic explanation').digest('hex'), createdBy: parent.id, origin: 'parent_revision',
    generation: {}, status: 'parent_approved', reviewVersion: 2 });
  newService = () => createAi2Service({ getRuntime: () => ({ enabled: true, continuousStore: true }),
    sourceReader: { require: async q => ({ id: q.sourceTaskId, familyId: String(family._id), childId: child.id, subject: 'math' }) } });
  const app = express(); app.locals.logger = { info() {}, warn() {}, error() {} };
  service = newService();
  const adapter = Object.fromEntries(Object.keys(service).map(k => [k, args => service[k](args)]));
  app.use((req, res, next) => {
    const json = res.json.bind(res);
    res.json = value => {
      if (drop && req.method === 'POST' && req.originalUrl === '/api/ai2/learning-packages' && value.success) {
        req.socket.destroy(); return res;
      }
      return json(value);
    };
    next();
  });
  app.use('/api/ai2', createAi2JsonParser(), createAi2Router({ service: adapter })); app.use(errorHandler);
  base = await listen(app);
});
afterEach(async () => { for (const s of servers) { s.closeAllConnections(); await new Promise(resolve => s.close(resolve)); } });
async function body() {
  const r = await request('GET', `/api/ai2/publication-preview?cycleId=${cycleId}`);
  expect(r.status).toBe(200); const { childSnapshot: _snapshot, ...preview } = r.data.data.preview;
  return { ...cmd(), ...preview, childContentConfirmed: true };
}
test('real HTTP committed publication with response failure, rebuild and original replay; child visibility and withdrawal', async () => {
  const b = await body(); drop = true;
  await expect(request('POST', '/api/ai2/learning-packages', b)).rejects.toMatchObject({ code: 'ECONNRESET' });
  expect(await M.Package.countDocuments()).toBe(1); drop = false; service = newService();
  const result = await request('POST', '/api/ai2/learning-packages', b); expect(result.status).toBe(201);
  const packageId = result.data.data.package.id;
  const read = await request('GET', `/api/ai2/learning-packages/${packageId}`, undefined, child);
  expect(read.status).toBe(200); expect(read.headers['cache-control']).toBe('no-store'); expect(JSON.stringify(read.data)).not.toContain('PRIVATE_');
  expect((await request('GET', `/api/ai2/learning-packages/${packageId}`, undefined, sibling)).status).toBe(404);
  const list = await request('GET', `/api/ai2/commands?childId=${child.id}&scope=mine`);
  expect(list.data.data.items[0].phase).toBe('SUCCEEDED');
  expect((await request('POST', `/api/ai2/learning-packages/${packageId}/withdraw`, { ...cmd(), expectedPackageVersion: 1, reason: 'Stop' })).status).toBe(200);
  expect((await request('GET', `/api/ai2/learning-packages/${packageId}`, undefined, child)).status).toBe(404);
  expect(await M.Package.countDocuments()).toBe(1);
});
test('HTTP unsigned identity, old child token, unknown query and spoofed fields rejected', async () => {
  const b = await body();
  expect((await request('POST', '/api/ai2/learning-packages', b, parent, false)).status).toBe(401);
  expect((await request('POST', '/api/ai2/learning-packages', { ...b, actorId: parent.id })).status).toBe(400);
  expect((await request('GET', `/api/ai2/publication-preview?cycleId=${cycleId}&actorId=x`)).status).toBe(400);
  await User.updateOne({ _id: child.id }, { $set: { 'childProfile.tokenVersion': 1 } });
  expect((await request('GET', '/api/ai2/learning-packages', undefined, child)).status).toBe(401);
  expect(await M.Package.countDocuments()).toBe(0);
});
test('raw UTF8 size and invalid encoding are rejected before semantic normalization', async () => {
  const b = await body(), raw = JSON.stringify(b) + ' '.repeat(32768);
  const r = await request('POST', '/api/ai2/learning-packages', raw, parent, true,
    { transformRequest: [v => v], headers: { 'Content-Type': 'application/json' } });
  expect(r.status).toBe(413); expect(r.data.error.code).toBe('AI2_INPUT_TOO_LARGE');
  const bad = await request('POST', '/api/ai2/learning-packages', Buffer.from([123, 34, 255, 34, 58, 49, 125]), parent, true,
    { transformRequest: [v => v], headers: { 'Content-Type': 'application/json' } });
  expect(bad.status).toBe(400); expect(await M.Command.countDocuments()).toBe(0);
});
test('generic parser misassembly fails closed; submit/recover do not invent unknown package or command', async () => {
  const app = express(); app.locals.logger = { warn() {}, error() {} }; app.use(express.json());
  app.use('/api/ai2', createAi2JsonParser(), createAi2Router({ service })); app.use(errorHandler);
  const address = await listen(app);
  const r = await http.post(address + '/api/ai2/learning-packages', cmd());
  expect(r.status).toBe(503); expect(r.data.error.code).toBe('AI2_NOT_READY');
  expect((await request('POST', `/api/ai2/learning-packages/${id()}/attempts`, cmd(), child)).status).toBe(404);
  expect((await request('POST', `/api/ai2/commands/${id()}/recover`, cmd(), child)).status).toBe(404);
  expect(await M.Attempt.countDocuments()).toBe(0);
});
