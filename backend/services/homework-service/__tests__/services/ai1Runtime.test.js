const mongoose = require('mongoose');
const { createAi1Runtime } = require('../../services/ai1Runtime');
const { startServer } = require('../../server');
const M = require('../../models/Ai1');
require('../../models/GrowthTaskCompletionOperation');
require('../../models/CompletionMediaGuard');
const profile = () => ({ model: 'synthetic-no-provider', modelProfileVersion: 'synthetic-v1', pricingProfileVersion: 'synthetic-price-v1',
  checkedAt: new Date(Date.now() - 60000).toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(),
  callWindowMs: 60000, clockMarginMs: 5000, inputPriceMicrosPerMillion: 9000000, outputPriceMicrosPerMillion: 27000000 });
const env = (mode = 'enabled') => ({ NODE_ENV: 'test', AI1_MODE: mode,
  AI1_LOCAL_STORE_CONTINUOUS: 'true', AI1_REMOTE_STORE_CONTINUOUS: 'true', AI1_PROVIDER_PROFILE_CONFIRMED: 'true',
  AI1_OPERATION_URL: 'http://127.0.0.1:1', AI1_OPERATION_TOKEN: 'synthetic-ai1-exclusive-credential-32', AI1_ALLOW_LOOPBACK: 'true',
  AI1_MODEL_PROFILE: JSON.stringify(profile()), AI1_BUDGET_LIMITS: JSON.stringify({ singleMicros: 184320,
    dayMicros: 1843200, monthMicros: 1843200, experimentMicros: 1843200 }) });
beforeAll(async () => { for (const m of Object.values(mongoose.models)) await m.init(); });
afterEach(() => jest.restoreAllMocks());

test.each([undefined, 'off', 'store-isolated'])('runtime %s has no transport or send authority', async mode => {
  const runtime = createAi1Runtime({ env: mode ? { AI1_MODE: mode } : {}, connection: mongoose.connection });
  await runtime.assertReady();
  expect(runtime.dependencies.getRuntime()).toEqual({ enabled: false, continuousStore: false });
  expect(runtime.dependencies.operationClient).toBeUndefined();
  expect(runtime.dependencies.getProfile()).toBeNull(); expect(runtime.dependencies.getLimits()).toBeNull();
});
test.each(['', 'true', 'ENABLED', 'legacy', 'query', 1])('runtime rejects ambiguous mode %s', mode => {
  expect(() => createAi1Runtime({ env: { AI1_MODE: mode } })).toThrow('AI_PROFILE_UNAVAILABLE');
});
test.each(['AI1_LOCAL_STORE_CONTINUOUS', 'AI1_REMOTE_STORE_CONTINUOUS', 'AI1_PROVIDER_PROFILE_CONFIRMED',
  'AI1_OPERATION_TOKEN', 'AI1_OPERATION_URL', 'AI1_MODEL_PROFILE', 'AI1_BUDGET_LIMITS'])(
  'enabled runtime requires %s before receiving send authority', key => {
    const config = env(); delete config[key];
    expect(() => createAi1Runtime({ env: config, connection: mongoose.connection })).toThrow('AI_PROFILE_UNAVAILABLE');
  });
test.each(['JWT_SECRET', 'GATEWAY_IDENTITY_SECRET', 'INTERNAL_SERVICE_TOKEN', 'MEDIA_REFERENCE_SERVICE_TOKEN',
  'COMPLETION_RETIREMENT_SERVICE_TOKEN'])('AI operation credential must not reuse %s', key => {
  const config = env(); config[key] = config.AI1_OPERATION_TOKEN;
  expect(() => createAi1Runtime({ env: config, connection: mongoose.connection })).toThrow('AI_PROFILE_UNAVAILABLE');
});
test.each(['production', 'development', undefined])('loopback transport is never permitted for NODE_ENV=%s', nodeEnv => {
  expect(() => createAi1Runtime({ env: { ...env(), NODE_ENV: nodeEnv }, connection: mongoose.connection })).toThrow('AI_PROFILE_UNAVAILABLE');
});
test('enabled runtime remains unavailable until actual transaction/index checks pass and snapshots config', async () => {
  const config = env(), runtime = createAi1Runtime({ env: config, connection: mongoose.connection });
  expect(() => runtime.dependencies.getRuntime()).toThrow('AI_PROFILE_UNAVAILABLE');
  await runtime.assertReady();
  expect(runtime.dependencies.getRuntime()).toEqual({ enabled: true, continuousStore: true });
  const p = runtime.dependencies.getProfile(), b = runtime.dependencies.getLimits();
  config.AI1_MODE = 'off'; config.AI1_MODEL_PROFILE = '{}'; config.AI1_BUDGET_LIMITS = '{}';
  p.model = 'changed'; b.singleMicros = 999999;
  expect(runtime.dependencies.getProfile().model).toBe('synthetic-no-provider');
  expect(runtime.dependencies.getLimits().singleMicros).toBe(184320);
});
test('query-only needs continuous stores and dedicated transport but not a currently valid price profile', async () => {
  const config = env('query-only'); delete config.AI1_PROVIDER_PROFILE_CONFIRMED; delete config.AI1_MODEL_PROFILE; delete config.AI1_BUDGET_LIMITS;
  const runtime = createAi1Runtime({ env: config, connection: mongoose.connection }); await runtime.assertReady();
  expect(runtime.dependencies.getRuntime()).toEqual({ enabled: false, continuousStore: true });
  expect(runtime.dependencies.operationClient.get).toEqual(expect.any(Function));
  expect(runtime.dependencies.operationClient.put).toBeUndefined();
  expect(runtime.dependencies.getProfile()).toBeNull();
});
test.each(['extra', 'negative', 'fraction', 'string', 'unsafe'])('budget config rejects %s without exposing values', kind => {
  const config = env(), limits = JSON.parse(config.AI1_BUDGET_LIMITS);
  if (kind === 'extra') limits.secretMarker = 'synthetic-do-not-log';
  else limits.singleMicros = ({ negative: -1, fraction: 0.5, string: '184320', unsafe: Number.MAX_SAFE_INTEGER + 1 })[kind];
  config.AI1_BUDGET_LIMITS = JSON.stringify(limits);
  expect(() => createAi1Runtime({ env: config, connection: mongoose.connection })).toThrow(/^AI_PROFILE_UNAVAILABLE$/);
});
test.each(['extra', 'expired', 'future-checked', 'overflow', 'window'])('model profile rejects %s', kind => {
  const config = env(), p = profile();
  if (kind === 'extra') p.retry = 2;
  if (kind === 'expired') p.expiresAt = new Date(Date.now() - 1).toISOString();
  if (kind === 'future-checked') p.checkedAt = new Date(Date.now() + 86400000).toISOString();
  if (kind === 'overflow') p.outputPriceMicrosPerMillion = Number.MAX_SAFE_INTEGER + 1;
  if (kind === 'window') p.callWindowMs = 0;
  config.AI1_MODEL_PROFILE = JSON.stringify(p);
  expect(() => createAi1Runtime({ env: config, connection: mongoose.connection })).toThrow(/^AI_PROFILE_UNAVAILABLE$/);
});
test('runtime refuses a foreign model connection before readiness or transport', () => {
  expect(() => createAi1Runtime({ env: env(), connection: { readyState: 1 } })).toThrow('AI_PROFILE_UNAVAILABLE');
});
test('readiness bounds its primary hello command and rejects a non-transactional topology', async () => {
  const admin = mongoose.connection.db.admin(), command = jest.spyOn(admin, 'command');
  jest.spyOn(mongoose.connection.db, 'admin').mockReturnValue(admin);
  const runtime = createAi1Runtime({ env: env(), connection: mongoose.connection });
  await runtime.assertReady();
  expect(command).toHaveBeenCalledWith({ hello: 1 }, { maxTimeMS: 5000, readPreference: 'primary' });
  command.mockResolvedValueOnce({ isWritablePrimary: true, maxWireVersion: 17, logicalSessionTimeoutMinutes: 30 });
  await expect(runtime.assertReady()).rejects.toThrow('AI_PROFILE_UNAVAILABLE');
  expect(() => runtime.dependencies.getRuntime()).toThrow('AI_PROFILE_UNAVAILABLE');
});
test('missing unique index fails readiness without rebuilding it or exposing database errors', async () => {
  const index = (await M.Job.collection.indexes()).find(i => i.key.remoteOperationId === 1);
  await M.Job.collection.dropIndex(index.name);
  try {
    const runtime = createAi1Runtime({ env: env(), connection: mongoose.connection });
    await expect(runtime.assertReady()).rejects.toThrow(/^AI_PROFILE_UNAVAILABLE$/);
    expect(() => runtime.dependencies.getRuntime()).toThrow('AI_PROFILE_UNAVAILABLE');
    expect((await M.Job.collection.indexes()).some(i => i.name === index.name)).toBe(false);
  } finally { await M.Job.createIndexes(); }
});
const startupEnv = () => ({ ...env(), COMPLETION_PROTOCOL_MODE: 'enabled', COMPLETION_WRITES_PAUSED: 'true',
  MONGO_URI: mongoose.connection.client.s.url, ENABLE_RABBITMQ: 'false',
  RESOURCE_SERVICE_URL: 'http://127.0.0.1:1', PROGRESS_SERVICE_URL: 'http://127.0.0.1:1',
  MEDIA_REFERENCE_SERVICE_TOKEN: 'synthetic-ai1-startup-media-32chars',
  COMPLETION_RETIREMENT_SERVICE_TOKEN: 'synthetic-ai1-startup-retirement-32chars',
  INTERNAL_SERVICE_TOKEN: 'synthetic-ai1-startup-internal-32chars' });
test('formal start checks AI readiness before queue and listen; failed precheck preserves borrowed DB', async () => {
  const index = (await M.Job.collection.indexes()).find(i => i.key.remoteOperationId === 1);
  await M.Job.collection.dropIndex(index.name);
  const queue = jest.fn(), listen = jest.spyOn(require('express').application, 'listen');
  try {
    await expect(startServer({ env: startupEnv(), port: 0, host: '127.0.0.1', initializeQueue: queue }))
      .rejects.toMatchObject({ code: 'COMPLETION_STARTUP_FAILED', message: 'COMPLETION_STARTUP_FAILED' });
    expect(queue).not.toHaveBeenCalled(); expect(listen).not.toHaveBeenCalled(); expect(mongoose.connection.readyState).toBe(1);
  } finally { await M.Job.createIndexes(); }
});
test('invalid AI startup configuration stops before database connection', async () => {
  const connect = jest.fn(), config = startupEnv(); delete config.AI1_OPERATION_TOKEN;
  await expect(startServer({ env: config, connect, port: 0, host: '127.0.0.1' })).rejects.toMatchObject({ code: 'COMPLETION_STARTUP_FAILED' });
  expect(connect).not.toHaveBeenCalled();
});
test.each(['enabled', 'query-only'])('active %s refuses replacement app or factory before connecting', async mode => {
  for (const injection of [{ app: require('express')() }, { createRuntimeApp: () => require('express')() }]) {
    const connect = jest.fn();
    await expect(startServer({ env: { ...startupEnv(), COMPLETION_PROTOCOL_MODE: 'legacy', AI1_MODE: mode }, connect, ...injection,
      port: 0, host: '127.0.0.1' })).rejects.toMatchObject({ code: 'COMPLETION_STARTUP_FAILED' });
    expect(connect).not.toHaveBeenCalled();
  }
});
test('failed AI precheck closes newly owned DB without starting queue or listener', async () => {
  const config = startupEnv(), uri = config.MONGO_URI;
  const index = (await M.Job.collection.indexes()).find(i => i.key.remoteOperationId === 1);
  await M.Job.collection.dropIndex(index.name);
  await mongoose.disconnect();
  const closeDb = jest.spyOn(mongoose.connection, 'close');
  const queue = jest.fn(), listen = jest.spyOn(require('express').application, 'listen');
  try {
    await expect(startServer({ env: config, initializeQueue: queue, port: 0, host: '127.0.0.1' }))
      .rejects.toMatchObject({ code: 'COMPLETION_STARTUP_FAILED' });
    expect(closeDb).toHaveBeenCalledTimes(1); expect(mongoose.connection.readyState).toBe(0);
    expect(queue).not.toHaveBeenCalled(); expect(listen).not.toHaveBeenCalled();
  } finally {
    jest.restoreAllMocks();
    await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
    await M.Job.createIndexes();
  }
});
test('formal enabled start runs actual AI checks and closes its synthetic listener', async () => {
  const server = await startServer({ env: startupEnv(), port: 0, host: '127.0.0.1' });
  try {
    const r = await require('supertest')(server).get('/api/tutor-cycles');
    expect(r.status).toBe(401); expect(server.listening).toBe(true);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
