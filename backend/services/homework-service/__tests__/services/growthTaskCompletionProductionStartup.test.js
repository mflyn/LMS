const mongoose = require('mongoose');
const { createProductionApp, startServer } = require('../../server');
const Task = require('../../models/GrowthTask');
const Operation = require('../../models/GrowthTaskCompletionOperation');
const Guard = require('../../models/CompletionMediaGuard');
const Family = require('../../../../common/models/Family');
const User = require('../../../../common/models/User');
const { randomUUID } = require('crypto');
const { createHttpTestHarness } = require('../../../../common/test/httpTestHarness');
const harness = createHttpTestHarness();
const appLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

const env = () => ({ NODE_ENV: 'test', COMPLETION_PROTOCOL_MODE: 'enabled', COMPLETION_WRITES_PAUSED: 'true',
  MONGO_URI: mongoose.connection.client.s.url, ENABLE_RABBITMQ: 'false',
  RESOURCE_SERVICE_URL: 'http://127.0.0.1:1', PROGRESS_SERVICE_URL: 'http://127.0.0.1:1',
  MEDIA_REFERENCE_SERVICE_TOKEN: 'synthetic-homework-startup-token-32chars',
  COMPLETION_RETIREMENT_SERVICE_TOKEN: 'synthetic-dedicated-retirement-startup-32',
  INTERNAL_SERVICE_TOKEN: 'synthetic-homework-startup-token-32chars' });
beforeAll(async () => { for (const model of [Task, Operation, Guard, Family, User]) await model.init(); });
afterEach(async () => { await harness.close(); jest.restoreAllMocks(); });

test('enabled homework factory and startup use formal composition after local precheck', async () => {
  expect(() => createProductionApp({ env: env() })).not.toThrow();
  const server = await startServer({ env: env(), port: 0, host: '127.0.0.1', appLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } });
  try {
    const response = await require('supertest')(server).get('/api/growth-tasks');
    expect(response.status).toBe(401); expect(response.body.error.code).toBe('INVALID_IDENTITY_ENVELOPE');
    expect(server.listening).toBe(true);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('T2-G-008 enabled formal factory exposes dedicated retirement credential boundary', async () => {
  const { createHttpTestHarness } = require('../../../../common/test/httpTestHarness');
  const harness = createHttpTestHarness();
  try {
    const app = createProductionApp({ env: { ...env(), COMPLETION_RETIREMENT_SERVICE_TOKEN: 'synthetic-dedicated-retirement-startup-32' } });
    const result = await (await harness.request(app)).post('/api/internal/completion-media-retirements/status').send({});
    expect(result.status).toBe(401); expect(result.body.error.code).toBe('INVALID_SERVICE_CREDENTIAL');
  } finally { await harness.close(); }
});

test('T2-G-008 enabled startup mounts retire and read-only status with formal models on the same connection', async () => {
  const parent = new mongoose.Types.ObjectId(), child = new mongoose.Types.ObjectId();
  const family = await Family.create({ familyName: 'Synthetic startup family', ownerParentId: parent,
    memberParentIds: [parent], childIds: [child] });
  await User.collection.insertMany([
    { _id: parent, username: String(parent), email: parent + '@example.test', role: 'parent' },
    { _id: child, username: String(child), email: child + '@example.test', role: 'student', familyId: family._id }
  ]);
  const command = { familyId: String(family._id), childId: String(child), mediaId: String(new mongoose.Types.ObjectId()), retirementId: randomUUID() };
  for (const model of [Task, Operation, Guard, Family, User]) expect(model.db).toBe(mongoose.connection);
  const runtimeEnv = env();
  const server = await startServer({ env: runtimeEnv, port: 0, host: '127.0.0.1', appLogger });
  try {
    const http = require('supertest')(server);
    for (const path of ['', '/status']) {
      const denied = await http.post('/api/internal/completion-media-retirements' + path).send(command);
      expect(denied.status).toBe(401); expect(denied.body.error.code).toBe('INVALID_SERVICE_CREDENTIAL');
    }
    const call = suffix => http.post('/api/internal/completion-media-retirements' + suffix)
      .set('x-service-token', runtimeEnv.COMPLETION_RETIREMENT_SERVICE_TOKEN).send(command);
    const absent = await call('/status');
    expect(absent.status).toBe(200); expect(absent.body.data).toEqual({ ...command, state: 'absent' });
    expect(await Guard.countDocuments()).toBe(0);
    const retired = await call('');
    expect(retired.status).toBe(200); expect(retired.body.data).toEqual({ ...command, state: 'granted' });
    const before = await Guard.collection.find().toArray();
    expect(before).toHaveLength(1);
    const status = await call('/status');
    expect(status.status).toBe(200); expect(status.body.data).toEqual({ ...command, state: 'retired' });
    expect(await Guard.collection.find().toArray()).toEqual(before);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test.each(['missing', 'shared'])('T2-G-008 enabled factory rejects %s retirement credential', kind => {
  const runtimeEnv = env();
  if (kind === 'missing') delete runtimeEnv.COMPLETION_RETIREMENT_SERVICE_TOKEN;
  else runtimeEnv.COMPLETION_RETIREMENT_SERVICE_TOKEN = runtimeEnv.MEDIA_REFERENCE_SERVICE_TOKEN;
  expect(() => createProductionApp({ env: runtimeEnv })).toThrow('COMPLETION_RETIREMENT_CREDENTIAL_INVALID');
});

const rejectedStartup = async options => {
  let failure;
  try {
    const server = await startServer({ env: env(), port: 0, host: '127.0.0.1', appLogger, ...options });
    await new Promise(resolve => server.close(resolve));
  } catch (cause) { failure = cause; }
  expect(failure).toBeInstanceOf(Error);
  return failure;
};
test('T2-G-008 enabled startup validates dedicated token before connecting', async () => {
  const runtimeEnv = env(); delete runtimeEnv.COMPLETION_RETIREMENT_SERVICE_TOKEN;
  const connect = jest.fn(async () => mongoose.connection);
  await rejectedStartup({ env: runtimeEnv, connect });
  expect(connect).not.toHaveBeenCalled();
});

test.each([undefined, 'legacy', 'maintenance'])('T2-G-008 %s startup needs no new token and exposes neither internal endpoint', async mode => {
  const runtimeEnv = env(); delete runtimeEnv.COMPLETION_RETIREMENT_SERVICE_TOKEN;
  if (mode === undefined) delete runtimeEnv.COMPLETION_PROTOCOL_MODE;
  else runtimeEnv.COMPLETION_PROTOCOL_MODE = mode;
  expect(() => createProductionApp({ env: runtimeEnv })).not.toThrow();
  const server = await startServer({ env: runtimeEnv, port: 0, host: '127.0.0.1', appLogger });
  try {
    for (const suffix of ['', '/status']) {
      const result = await require('supertest')(server).post('/api/internal/completion-media-retirements' + suffix).send({});
      expect(result.status).toBe(404);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('T2-G-008 missing guard unique index blocks enabled startup without repairing indexes', async () => {
  const name = 'completion_media_guard_scope';
  await Guard.collection.dropIndex(name);
  const before = await Guard.collection.indexes();
  try {
    await rejectedStartup();
    expect(await Guard.collection.indexes()).toEqual(before);
  } finally {
    await Guard.collection.createIndex({ familyId: 1, childId: 1, mediaId: 1 }, { name, unique: true });
  }
});
test('T2-G-008 corrupt guard blocks enabled startup without repair', async () => {
  await Guard.collection.insertOne({ familyId: new mongoose.Types.ObjectId(), childId: new mongoose.Types.ObjectId(),
    mediaId: new mongoose.Types.ObjectId(), state: 'retired', revision: 1, retirementId: randomUUID(), retiredAt: null });
  const before = await Guard.collection.find().toArray();
  await rejectedStartup();
  expect(await Guard.collection.find().toArray()).toEqual(before);
});
test('T2-G-008 guard readiness does not replace original completion operation readiness', async () => {
  await Operation.collection.insertOne({ remoteOperationId: 'invalid' });
  await expect(rejectedStartup()).resolves.toMatchObject({ code: 'COMPLETION_PROTOCOL_NOT_READY' });
});
test('T2-G-008 formal factory refuses a connection different from its models', async () => {
  const other = mongoose.createConnection();
  try {
    expect(() => createProductionApp({ env: env(), connection: other })).toThrow('COMPLETION_CONNECTION_MISMATCH');
  } finally { await other.close(); }
});
