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
test.each(['enabled', 'query-only'])('mixed budget invalid owner prevents %s startup without repair or auto-creating AI3 collections', async mode => {
  const missing = new mongoose.Types.ObjectId();
  await M.Reservation.collection.insertOne({ _id: missing, jobId: missing, familyId: missing, childId: missing,
    ownerProfile: 'ai3', reservedMicros: 184320, state: 'reserved' });
  const before = await M.Reservation.find().lean();
  const collections = async () => (await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name).sort();
  const original = await collections();
  const runtime = createAi1Runtime({ env: env(mode), connection: mongoose.connection });
  await expect(runtime.assertReady()).rejects.toThrow(/^AI_PROFILE_UNAVAILABLE$/);
  expect(() => runtime.dependencies.getRuntime()).toThrow(/^AI_PROFILE_UNAVAILABLE$/);
  expect(await M.Reservation.find().lean()).toEqual(before);
  expect(await collections()).toEqual(original);
  expect(await M.Account.countDocuments()).toBe(0);
  expect(await M.Slot.countDocuments()).toBe(0);
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

const trialEnv = (mode = 'enabled') => {
  const config = env(mode);
  delete config.AI1_PROVIDER_PROFILE_CONFIRMED;
  config.AI1_MODEL_PROFILE = JSON.stringify({ ...profile(), feeMode: 'estimate_only', sourceReference: 'synthetic-price-source-v2' });
  config.AI1_TRIAL_AUTHORIZATION = JSON.stringify({ confirmed: true, authorizationVersion: 'synthetic-trial-v2', maxSubmissions: 3 });
  return config;
};
test('v2 runtime explicitly authorizes estimates and snapshots the shared three-submission grant', async () => {
  const config = trialEnv(), runtime = createAi1Runtime({ env: config });
  expect(() => runtime.dependencies.getRuntime()).toThrow('AI_PROFILE_UNAVAILABLE');
  await runtime.assertReady();
  expect(runtime.dependencies.getRuntime()).toEqual({ enabled: true, continuousStore: true });
  expect(runtime.dependencies.getTrial()).toEqual({ authorizationVersion: 'synthetic-trial-v2', maxSubmissions: 3 });
  const preview = require('../../services/ai1Contract').buildPreview({ input: {}, chapter: {} }, runtime.dependencies.getProfile(), Date.now());
  expect(preview).toMatchObject({ generationSchemaVersion: 'ai1-min-v2', feeMode: 'estimate_only', feeNoticeVersion: 'estimate-not-cap-v1',
    pricing: { sourceReference: 'synthetic-price-source-v2' }, requestOptions: { maxRequestBytes: 32768, maxOutputTokens: 4096, attemptLimit: 1 } });
  expect(preview.reservedCeilingMicros).toBeUndefined();
  const trial = runtime.dependencies.getTrial(); trial.maxSubmissions = 99; trial.authorizationVersion = 'changed';
  config.AI1_TRIAL_AUTHORIZATION = '{}'; config.AI1_MODEL_PROFILE = '{}';
  expect(runtime.dependencies.getTrial()).toEqual({ authorizationVersion: 'synthetic-trial-v2', maxSubmissions: 3 });
  expect(runtime.dependencies.getProfile().sourceReference).toBe('synthetic-price-source-v2');
});
test.each([undefined, '', '{', 'null', '[]', '{}', 'x'.repeat(8193),
  JSON.stringify({ authorizationVersion: 'synthetic-trial-v2', maxSubmissions: 3 }),
  ...[false, 'true', 1, null].map(confirmed => JSON.stringify({ confirmed, authorizationVersion: 'synthetic-trial-v2', maxSubmissions: 3 })),
  ...[undefined, 0, 2, 4, 3.5, '3', true].map(maxSubmissions => JSON.stringify({ confirmed: true, authorizationVersion: 'synthetic-trial-v2', maxSubmissions })),
  ...[undefined, '', ' ', ' padded ', 'a\nb', 'a\n', 1, {}, 'x'.repeat(129)].map(authorizationVersion => JSON.stringify({ confirmed: true, authorizationVersion, maxSubmissions: 3 })),
  JSON.stringify({ confirmed: true, authorizationVersion: 'synthetic-trial-v2', maxSubmissions: 3, extra: true })
])('v2 runtime rejects malformed or unconfirmed grant case %#', authorization => {
  expect(() => createAi1Runtime({ env: { ...trialEnv(), AI1_TRIAL_AUTHORIZATION: authorization } })).toThrow(/^AI_PROFILE_UNAVAILABLE$/);
});
test.each(['true', 'TRUE', '', true])('v2 runtime rejects strict or ambiguous confirmation %s', confirmed => {
  expect(() => createAi1Runtime({ env: { ...trialEnv(), AI1_PROVIDER_PROFILE_CONFIRMED: confirmed } })).toThrow(/^AI_PROFILE_UNAVAILABLE$/);
});
test('v2 permits explicitly disabled strict confirmation without inheriting its authority', async () => {
  const runtime = createAi1Runtime({ env: { ...trialEnv(), AI1_PROVIDER_PROFILE_CONFIRMED: 'false' } });
  await runtime.assertReady(); expect(runtime.dependencies.getTrial().maxSubmissions).toBe(3);
});
test.each(['missing-mode', 'wrong-mode', 'missing-source', 'empty-source', 'expired', 'future-checked', 'extra'])(
  'v2 runtime rejects invalid profile %s', kind => {
    const config = trialEnv(), p = JSON.parse(config.AI1_MODEL_PROFILE);
    if (kind === 'missing-mode') delete p.feeMode;
    if (kind === 'wrong-mode') p.feeMode = 'strict';
    if (kind === 'missing-source') delete p.sourceReference;
    if (kind === 'empty-source') p.sourceReference = '';
    if (kind === 'expired') p.expiresAt = new Date(Date.now() - 1).toISOString();
    if (kind === 'future-checked') p.checkedAt = new Date(Date.now() + 86400000).toISOString();
    if (kind === 'extra') p.estimateAcknowledged = true;
    config.AI1_MODEL_PROFILE = JSON.stringify(p);
    expect(() => createAi1Runtime({ env: config })).toThrow(/^AI_PROFILE_UNAVAILABLE$/);
  });
test('v2 readiness revokes an expired profile without rewriting it or its trial grant', async () => {
  const config = trialEnv(), runtime = createAi1Runtime({ env: config }); await runtime.assertReady();
  const p = runtime.dependencies.getProfile(), trial = runtime.dependencies.getTrial();
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse(p.expiresAt));
  await expect(runtime.assertReady()).rejects.toThrow(/^AI_PROFILE_UNAVAILABLE$/);
  expect(() => runtime.dependencies.getRuntime()).toThrow(/^AI_PROFILE_UNAVAILABLE$/);
  expect(runtime.dependencies.getProfile()).toEqual(p); expect(runtime.dependencies.getTrial()).toEqual(trial);
});
test('v1 keeps strict preview semantics and cannot mix a trial grant into its configuration', async () => {
  const runtime = createAi1Runtime({ env: env() }); await runtime.assertReady();
  expect(runtime.dependencies.getTrial()).toBeNull();
  const preview = require('../../services/ai1Contract').buildPreview({ input: {}, chapter: {} }, runtime.dependencies.getProfile(), Date.now());
  expect(preview.reservedCeilingMicros).toBe(184320); expect(preview.feeMode).toBeUndefined();
  expect(() => createAi1Runtime({ env: { ...env(), AI1_TRIAL_AUTHORIZATION: trialEnv().AI1_TRIAL_AUTHORIZATION } }))
    .toThrow(/^AI_PROFILE_UNAVAILABLE$/);
});
test.each([undefined, 'off', 'store-isolated', 'query-only'])('trial settings cannot enable mode %s or prevent query-only recovery', async mode => {
  const config = { ...trialEnv(), AI1_MODE: mode, AI1_TRIAL_AUTHORIZATION: '{', AI1_MODEL_PROFILE: '{' };
  const runtime = createAi1Runtime({ env: config }); await runtime.assertReady();
  expect(runtime.dependencies.getRuntime()).toEqual({ enabled: false, continuousStore: mode === 'query-only' });
  expect(runtime.dependencies.getTrial()).toBeNull(); expect(runtime.dependencies.getProfile()).toBeNull();
  expect(runtime.dependencies.operationClient?.put).toBeUndefined();
  if (mode === 'query-only') expect(Object.keys(runtime.dependencies.operationClient)).toEqual(['get']);
});
test('formal v2 startup rejects missing trial confirmation before connect, queue or listen', async () => {
  const config = { ...startupEnv(), ...trialEnv(), AI1_TRIAL_AUTHORIZATION: '{}' };
  delete config.AI1_PROVIDER_PROFILE_CONFIRMED;
  const connect = jest.fn(), queue = jest.fn(), listen = jest.spyOn(require('express').application, 'listen');
  await expect(startServer({ env: config, connect, initializeQueue: queue, port: 0, host: '127.0.0.1' }))
    .rejects.toMatchObject({ code: 'COMPLETION_STARTUP_FAILED' });
  expect(connect).not.toHaveBeenCalled(); expect(queue).not.toHaveBeenCalled(); expect(listen).not.toHaveBeenCalled();
});
test('formal v2 start uses real readiness with explicit estimate authorization', async () => {
  const config = { ...startupEnv(), ...trialEnv() }; delete config.AI1_PROVIDER_PROFILE_CONFIRMED;
  const server = await startServer({ env: config, port: 0, host: '127.0.0.1' });
  try {
    const r = await require('supertest')(server).get('/api/tutor-cycles');
    expect(r.status).toBe(401); expect(server.listening).toBe(true);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
