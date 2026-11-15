jest.mock('../../../../common/config/logger', () => ({ createLogger: () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}) }));
const mongoose = require('mongoose');
const express = require('express');
const axios = require('axios');
const { randomUUID } = require('crypto');
const { createApp, createProductionApp, startServer } = require('../../server');
const { createAi2Router } = require('../../routes/ai2');
const { createIdentityHeaders } = require('../../../../common/middleware/gatewayIdentity');
const M = require('../../models/Ai2');
const A = require('../../models/Ai1');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const C = require('../../services/ai2Contract');
const id = () => String(new mongoose.Types.ObjectId());
const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
const token = 'synthetic-ai25-media-reference-token-32';
const config = () => ({ NODE_ENV: 'test', AI1_MODE: 'off', AI2_MODE: 'enabled', AI2_STORE_CONTINUOUS: 'true',
  COMPLETION_PROTOCOL_MODE: 'enabled', COMPLETION_WRITES_PAUSED: 'true', MONGO_URI: mongoose.connection.client.s.url,
  ENABLE_RABBITMQ: 'false', RESOURCE_SERVICE_URL: 'http://127.0.0.1:1', PROGRESS_SERVICE_URL: 'http://127.0.0.1:1',
  MEDIA_REFERENCE_SERVICE_TOKEN: token, COMPLETION_RETIREMENT_SERVICE_TOKEN: 'synthetic-ai25-retirement-token-32chars',
  INTERNAL_SERVICE_TOKEN: 'synthetic-ai25-internal-service-token-32' });
let servers, parent, child, family, packageId;
const listen = async app => {
  const server = await new Promise((resolve, reject) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); s.once('error', reject); });
  servers.push(server); return `http://127.0.0.1:${server.address().port}`;
};
const trackedStart = options => startServer({ port: 0, host: '127.0.0.1', ...options }).then(server => {
  servers.push(server); return server;
});
const request = (base, method, path, data, identity = parent, extra = {}) => axios.request({
  url: base + path, method, data, proxy: false, timeout: 5000, maxRedirects: 0, validateStatus: () => true, ...extra,
  headers: { ...(identity ? createIdentityHeaders({ method, originalUrl: path, user: identity,
    secret: process.env.GATEWAY_IDENTITY_SECRET }) : {}), ...extra.headers }
});
beforeAll(async () => { for (const model of Object.values(mongoose.models)) await model.init(); });
beforeEach(async () => {
  servers = []; parent = { id: id(), role: 'parent', username: 'PRIVATE_SYNTHETIC_NAME' };
  child = { id: id(), role: 'student', tokenVersion: 0 };
  family = await Family.create({ familyName: 'Synthetic AI25', ownerParentId: parent.id, memberParentIds: [parent.id], childIds: [child.id] });
  Object.assign(child, { familyId: String(family._id), childId: child.id });
  await User.collection.insertMany([parent, child].map(u => ({ _id: new mongoose.Types.ObjectId(u.id), role: u.role,
    username: u.id, email: `${u.id}@example.test`, ...(u.role === 'student' ? { familyId: family._id, childProfile: { tokenVersion: 0 } } : {}) })));
  packageId = id();
  await M.Package.create({ _id: packageId, familyId: family._id, childId: child.id, ai1CycleId: id(), source: {}, artifact: {},
    childSnapshot: {}, childSnapshotHash: C.hash({}), publishedBy: parent.id, publishedAt: new Date(),
    visibility: 'published', learningState: 'open', stateVersion: 1 });
});
afterEach(async () => {
  for (const server of servers) { server.closeAllConnections?.(); await new Promise(resolve => server.close(resolve)); }
  jest.restoreAllMocks();
});

test('formal public assembly stays blocked until preflight; off continuity preserves reads and withdrawal, not new writes', async () => {
  const env = config(), app = createProductionApp({ env, appLogger: logger }), base = await listen(app);
  expect(typeof app.locals.assertAi2Ready).toBe('function');
  expect((await request(base, 'GET', `/api/ai2/learning-packages?childId=${child.id}`)).status).toBe(503);
  await app.locals.assertAi2Ready();
  expect((await request(base, 'GET', `/api/ai2/learning-packages?childId=${child.id}`)).data.data.items).toHaveLength(1);
  env.AI2_MODE = 'off';
  expect((await request(base, 'GET', `/api/ai2/learning-packages?childId=${child.id}`)).status).toBe(200);
  const newWrite = await request(base, 'POST', `/api/ai2/learning-packages/${packageId}/attempts`, {
    schemaVersion: 'ai2-min-v1', operationId: randomUUID(), expectedPackageVersion: 1, note: '', mediaIds: [id()]
  }, child);
  expect(newWrite.status).toBe(503); expect(newWrite.data.error.code).toBe('AI2_DISABLED');
  expect(await M.Command.countDocuments()).toBe(0);
  const withdrawn = await request(base, 'POST', `/api/ai2/learning-packages/${packageId}/withdraw`, {
    schemaVersion: 'ai2-min-v1', operationId: randomUUID(), expectedPackageVersion: 1, reason: 'Synthetic withdrawal'
  });
  expect(withdrawn.status).toBe(200); expect(withdrawn.data.data.command.phase).toBe('SUCCEEDED');
  const commandId = withdrawn.data.data.command.id;
  expect((await request(base, 'GET', `/api/ai2/commands/${commandId}`)).status).toBe(200);
  env.AI2_STORE_CONTINUOUS = 'false';
  expect((await request(base, 'GET', `/api/ai2/commands/${commandId}`)).status).toBe(503);
});

test('off without continuity refuses known data even after its no-op preflight', async () => {
  const app = createProductionApp({ env: { ...config(), AI2_MODE: 'off', AI2_STORE_CONTINUOUS: 'false' }, appLogger: logger });
  await app.locals.assertAi2Ready(); const base = await listen(app);
  expect((await request(base, 'GET', `/api/ai2/learning-packages/${packageId}`)).status).toBe(503);
});

test('default off adds no credential requirement to legacy custom media assembly', async () => {
  const createMediaDependencies = jest.fn(() => ({ attachmentMediaService: {} }));
  const app = createProductionApp({ env: {}, createMediaDependencies, appLogger: logger });
  expect(createMediaDependencies).toHaveBeenCalledTimes(1);
  await app.locals.assertAi2Ready(); const base = await listen(app);
  expect((await request(base, 'GET', `/api/ai2/learning-packages/${packageId}`)).status).toBe(503);
  expect((await request(base, 'POST', '/api/internal/ai2/media-access-check', {}, null)).status).toBe(404);
});

test('off without continuity adds no metadata URL constraint to completion assembly', () => {
  const env = { ...config(), AI2_MODE: 'off', AI2_STORE_CONTINUOUS: 'false', RESOURCE_SERVICE_URL: 'http://127.0.0.1:1/prefix' };
  expect(() => createProductionApp({ env, appLogger: logger })).not.toThrow();
});

test('createApp mounts strict AI2 parser before generic JSON; raw excess/invalid UTF8 never dispatches', async () => {
  const publish = jest.fn(async ({ body }) => ({ echoed: body }));
  const app = createApp({ ai2Router: createAi2Router({ service: { publish } }), appLogger: logger });
  const base = await listen(app), path = '/api/ai2/learning-packages';
  const extra = { transformRequest: [v => v], headers: { 'Content-Type': 'application/json' } };
  expect((await request(base, 'POST', path, '{}' + ' '.repeat(32768), parent, extra)).status).toBe(413);
  expect((await request(base, 'POST', path, Buffer.from([123, 34, 255, 34, 58, 49, 125]), parent, extra)).status).toBe(400);
  expect(publish).not.toHaveBeenCalled();
  const normal = await request(base, 'POST', path, { unknown: true });
  expect(normal.status).toBe(201); expect(normal.data.data.echoed).toEqual({ unknown: true });
  expect(normal.headers['cache-control']).toBe('no-store');
});

test('formal metadata crosses HTTP with only reference credential and closed descriptors, including deleted', async () => {
  const mediaId = id(), attemptId = id(), bindings = [{ mediaId, resourceType: 'ai2_attempt', resourceId: attemptId,
    field: 'correctionMediaIds', bindingOperationId: randomUUID() }];
  await M.Attempt.create({ _id: attemptId, packageId, familyId: family._id, childId: child.id, submitCommandId: id(),
    attemptVersion: 1, submittedBy: child.id, submittedAt: new Date(), note: '', mediaIds: [mediaId], mediaBindings: bindings,
    payloadHash: C.hash({ note: '', mediaIds: [mediaId], bindings, submittedBy: child.id, attemptVersion: 1 }) });
  await M.Package.updateOne({ _id: packageId }, { $set: { currentAttemptId: attemptId, currentAttemptVersion: 1 } });
  const resource = express(), calls = []; resource.use(express.json());
  resource.post('/api/internal/media/ai2/inspect', (req, res) => {
    calls.push({ body: req.body, token: req.get('x-service-token'), authorization: req.get('Authorization') });
    res.json({ success: true, data: { items: [{ mediaId, mimeType: 'image/png', sizeBytes: 64, status: 'deleted' }] } });
  });
  const env = { ...config(), RESOURCE_SERVICE_URL: await listen(resource) };
  const app = createProductionApp({ env, appLogger: logger }); await app.locals.assertAi2Ready();
  const result = await request(await listen(app), 'GET', `/api/ai2/learning-packages/${packageId}`);
  expect(result.status).toBe(200);
  expect(result.data.data.package.attempts[0].media).toEqual([{ mediaId, mimeType: 'image/png', sizeBytes: 64, status: 'deleted' }]);
  expect(calls).toEqual([{ token, authorization: undefined, body: { familyId: String(family._id), childId: child.id,
    identity: { id: parent.id, role: 'parent' }, mediaIds: [mediaId], bindings } }]);
});

test('internal access check requires reference token, has no public alias, and is continuity-gated', async () => {
  const env = config(), app = createProductionApp({ env, appLogger: logger });
  await app.locals.assertAi2Ready(); const base = await listen(app);
  const path = '/api/internal/ai2/media-access-check', body = { familyId: String(family._id), childId: child.id,
    actorId: parent.id, role: 'parent', mediaId: id(), bindings: [{ attemptId: id(), bindingOperationId: randomUUID() }] };
  expect((await request(base, 'POST', path, body)).status).toBe(401);
  expect((await request(base, 'POST', path, body, null, { headers: { 'x-service-token': env.INTERNAL_SERVICE_TOKEN } })).status).toBe(401);
  const options = { headers: { 'x-service-token': token } };
  expect((await request(base, 'POST', path, body, null, options)).data).toEqual({ success: true, data: { allowed: false } });
  expect((await request(base, 'POST', '/api/ai2/media-access-check', body, null, options)).status).not.toBe(200);
  env.AI2_MODE = 'off'; env.AI2_STORE_CONTINUOUS = 'false';
  expect((await request(base, 'POST', path, body, null, options)).status).toBe(503);
});

test.each(['app', 'factory', 'configuration'])('enabled startup rejects %s bypass before connect despite custom validation', async bypass => {
  const env = config(), connect = jest.fn(), validateEnvironment = jest.fn();
  if (bypass === 'configuration') delete env.AI2_STORE_CONTINUOUS;
  await expect(trackedStart({ env, connect, validateEnvironment, appLogger: logger,
    ...(bypass === 'app' ? { app: express() } : {}), ...(bypass === 'factory' ? { createRuntimeApp: () => express() } : {}) }))
    .rejects.toBeDefined();
  expect(connect).not.toHaveBeenCalled();
});

test.each(['createMediaDependencies', 'growthTaskRouterFactory'])('enabled formal factory rejects custom %s', key => {
  const override = jest.fn(); expect(() => createProductionApp({ env: config(), [key]: override })).toThrow();
  expect(override).not.toHaveBeenCalled();
});

test.each(['enabled', 'off'])('%s missing index aborts startup before queue/listen and preserves borrowed connection', async mode => {
  const index = (await M.Command.collection.indexes()).find(i => i.unique && i.key.operationId);
  await M.Command.collection.dropIndex(index.name);
  const queue = jest.fn(), listenSpy = jest.spyOn(express.application, 'listen');
  try {
    await expect(trackedStart({ env: { ...config(), AI2_MODE: mode }, port: 0, host: '127.0.0.1',
      initializeQueue: queue, appLogger: logger })).rejects.toBeDefined();
    expect(queue).not.toHaveBeenCalled(); expect(listenSpy).not.toHaveBeenCalled(); expect(mongoose.connection.readyState).toBe(1);
  } finally { await M.Command.createIndexes(); }
});

test('readiness failure closes newly owned connection via existing completion lifecycle', async () => {
  const env = config(), index = (await M.Command.collection.indexes()).find(i => i.unique && i.key.operationId);
  await M.Command.collection.dropIndex(index.name); await mongoose.disconnect();
  const close = jest.spyOn(mongoose.connection, 'close'), queue = jest.fn(), listenSpy = jest.spyOn(express.application, 'listen');
  try {
    await expect(trackedStart({ env, port: 0, host: '127.0.0.1', initializeQueue: queue, appLogger: logger })).rejects.toBeDefined();
    expect(close).toHaveBeenCalledTimes(1); expect(mongoose.connection.readyState).toBe(0);
    expect(queue).not.toHaveBeenCalled(); expect(listenSpy).not.toHaveBeenCalled();
  } finally {
    jest.restoreAllMocks(); await mongoose.connect(env.MONGO_URI, { autoIndex: false, autoCreate: false }); await M.Command.createIndexes();
  }
});

test('formal start completes both preflights before exposing its local listener', async () => {
  const server = await startServer({ env: config(), port: 0, host: '127.0.0.1', appLogger: logger }); servers.push(server);
  const result = await request(`http://127.0.0.1:${server.address().port}`, 'GET', `/api/ai2/learning-packages?childId=${child.id}`);
  expect(result.status).toBe(200); expect(result.data.data.items).toHaveLength(1);
  expect(Object.values(A).every(model => model.db === mongoose.connection)).toBe(true);
});

test('off continuous formal assembly recovers a reserved submission through the existing HTTP reference client', async () => {
  const { typedScope, referenceSetHash } = require('../../../../common/services/completionMediaProtocol');
  const resource = express(), calls = []; let available = false;
  resource.use(express.json());
  resource.post('/api/internal/media/references/:action', (req, res) => {
    calls.push({ action: req.params.action, token: req.get('x-service-token'), body: req.body });
    if (!available) return res.status(503).json({ success: false });
    const q = req.body, aborted = req.params.action === 'abort', scope = typedScope(q);
    return res.json({ success: true, data: {
      operation: { operationId: q.operationId, state: aborted ? 'ABORTED' : 'ABSENT', ...scope,
        commandHash: aborted ? q.commandHash : null, referenceSetHash: aborted ? referenceSetHash(q) : null,
        leaseExpiresAt: null, leaseExpired: null, failureCode: aborted ? 'MEDIA_OPERATION_ABORTED' : null },
      references: q.references.map(r => ({ ...r, ...scope, state: 'absent', privacyDeletion: null }))
    } });
  });
  const env = { ...config(), RESOURCE_SERVICE_URL: await listen(resource) };
  const app = createProductionApp({ env, appLogger: logger }); await app.locals.assertAi2Ready(); const base = await listen(app);
  const body = { schemaVersion: 'ai2-min-v1', operationId: randomUUID(), expectedPackageVersion: 1, note: '', mediaIds: [id()] };
  const pending = await request(base, 'POST', `/api/ai2/learning-packages/${packageId}/attempts`, body, child);
  expect(pending.status).toBe(202); expect(pending.data.data.command.phase).toBe('RESERVED');
  const commandId = pending.data.data.command.id;
  await M.Command.updateOne({ _id: commandId }, { $set: { owner: null, leaseExpiresAt: null } });
  env.AI2_MODE = 'off'; available = true;
  const recovered = await request(base, 'POST', `/api/ai2/commands/${commandId}/recover`, {
    schemaVersion: body.schemaVersion, operationId: body.operationId
  }, child);
  expect(recovered.status).toBe(200); expect(recovered.data.data.command.phase).toBe('FAILED');
  expect(recovered.data.data.command.failureCode).toBe('AI2_DISABLED');
  expect(calls.map(c => c.action)).toEqual(['status', 'status', 'status', 'abort']);
  expect(calls.every(c => c.token === token)).toBe(true);
  expect(new Set(calls.map(c => c.body.operationId)).size).toBe(1);
  expect(calls[0].body.operationId).not.toBe(body.operationId);
  expect(await M.Attempt.countDocuments()).toBe(0);
  expect((await M.Package.findById(packageId)).activeCommandId).toBeNull();
});
