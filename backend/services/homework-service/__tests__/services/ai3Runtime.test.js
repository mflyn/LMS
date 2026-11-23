const mongoose = require('mongoose');
const M = require('../../models/Ai3');
const { createAi3Runtime } = require('../../services/ai3Runtime');
const { createAi1Runtime } = require('../../services/ai1Runtime');
const consumers = Object.fromEntries(['analytics', 'progress'].map(name => [name, {
  server: require(`../../../${name}-service/server`),
  Receipt: require(`../../../${name}-service/models/${name === 'analytics' ? 'Ai3ReviewEffectReceipt' : 'Ai3MasteryEffectReceipt'}`)
}]));
const config = mode => ({ AI3_MODE: mode, AI3_STORE_CONTINUOUS: 'true', AI2_STORE_CONTINUOUS: 'true',
  COMPLETION_PROTOCOL_MODE: 'enabled', AI3_EVIDENCE_TOKEN: 'synthetic-ai3-runtime-token-at-least32' });
beforeAll(async () => { for (const model of Object.values(mongoose.models)) await model.init(); });
test('default isolation cannot gain a readiness grant from later env flips', async () => {
  expect(typeof createAi3Runtime).toBe('function');
  const env = {}, runtime = createAi3Runtime({ env });
  await runtime.assertReady();
  expect(runtime.dependencies.getRuntime()).toEqual({ enabled: false, continuousStore: false });
  Object.assign(env, config('enabled'));
  await expect(runtime.assertReady()).rejects.toThrow('AI3_NOT_READY');
  expect(() => runtime.dependencies.getRuntime()).toThrow('AI3_NOT_READY');
});
test.each(['enabled', 'off'])('%s with continuity requires real index preflight and no provider for manual work', async mode => {
  expect(typeof createAi3Runtime).toBe('function');
  const env = config(mode), runtime = createAi3Runtime({ env });
  expect(() => runtime.dependencies.getRuntime()).toThrow('AI3_NOT_READY');
  await runtime.assertReady();
  expect(runtime.dependencies.getRuntime()).toEqual({ enabled: mode === 'enabled', continuousStore: true });
  expect(runtime.dependencies.operationClient).toBeUndefined();
  env.AI3_MODE = 'off'; expect(runtime.dependencies.getRuntime().continuousStore).toBe(true);
  env.AI3_STORE_CONTINUOUS = 'false'; expect(runtime.dependencies.getRuntime().continuousStore).toBe(false);
});
test('foreign connection and detached model fail before readiness', () => {
  expect(typeof createAi3Runtime).toBe('function');
  expect(() => createAi3Runtime({ env: config('off'), connection: {} })).toThrow('AI3_NOT_READY');
  const db = M.Attempt.db;
  try { M.Attempt.db = {}; expect(() => createAi3Runtime({ env: config('off') })).toThrow('AI3_NOT_READY'); }
  finally { M.Attempt.db = db; }
});
test('missing unique index revokes readiness without repairing it', async () => {
  expect(typeof createAi3Runtime).toBe('function');
  const runtime = createAi3Runtime({ env: config('off') }); await runtime.assertReady();
  const index = (await M.Command.collection.indexes()).find(i => i.unique && i.key.operationId);
  await M.Command.collection.dropIndex(index.name);
  try {
    await expect(runtime.assertReady()).rejects.toThrow('AI3_NOT_READY');
    expect(() => runtime.dependencies.getRuntime()).toThrow('AI3_NOT_READY');
    expect((await M.Command.collection.indexes()).some(i => i.name === index.name)).toBe(false);
  } finally { await M.Command.createIndexes(); }
});
test.each(['analytics', 'progress'])('%s preflight failure closes only the connection opened by startup', async name => {
  const { server, Receipt } = consumers[name];
  const uri = mongoose.connection.getClient().s.url;
  await Receipt.collection.dropIndexes();
  await mongoose.disconnect();
  const env = { ...config('off'), MONGO_URI: uri, HOMEWORK_SERVICE_URL: 'http://127.0.0.1:1',
    RESOURCE_SERVICE_URL: 'http://127.0.0.1:1', MEDIA_REFERENCE_SERVICE_TOKEN: 'synthetic-media-reference-token-32plus' };
  try {
    await expect(server.startServer({ env, host: '127.0.0.1', port: 0 })).rejects.toThrow('AI3_NOT_READY');
    expect(mongoose.connection.readyState).toBe(0);
  } finally {
    if (mongoose.connection.readyState === 0) await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
    await Receipt.createIndexes();
  }
});

const trialConfig = (mode = 'enabled') => ({ ...config('enabled'), NODE_ENV: 'test', AI1_MODE: mode,
  AI1_LOCAL_STORE_CONTINUOUS: 'true', AI1_REMOTE_STORE_CONTINUOUS: 'true', AI1_ALLOW_LOOPBACK: 'true',
  AI1_OPERATION_URL: 'http://127.0.0.1:1', AI1_OPERATION_TOKEN: 'synthetic-ai1-exclusive-credential-32',
  AI1_MODEL_PROFILE: JSON.stringify({ model: 'synthetic-no-provider', modelProfileVersion: 'synthetic-v2', pricingProfileVersion: 'synthetic-price-v2',
    checkedAt: new Date(Date.now() - 60000).toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(),
    callWindowMs: 60000, clockMarginMs: 5000, inputPriceMicrosPerMillion: 9000000, outputPriceMicrosPerMillion: 27000000,
    feeMode: 'estimate_only', sourceReference: 'synthetic-price-source-v2' }),
  AI1_BUDGET_LIMITS: JSON.stringify({ singleMicros: 184320, dayMicros: 1843200, monthMicros: 1843200, experimentMicros: 1843200 }),
  AI1_TRIAL_AUTHORIZATION: JSON.stringify({ confirmed: true, authorizationVersion: 'synthetic-trial-v2', maxSubmissions: 3 }) });
test('both namespaces receive one immutable trial grant and profile but distinct operation clients', async () => {
  const env = trialConfig(), ai1Runtime = createAi1Runtime({ env }), ai3Runtime = createAi3Runtime({ env, ai1Runtime });
  await ai1Runtime.assertReady(); await ai3Runtime.assertReady();
  const one = ai1Runtime.dependencies, three = ai3Runtime.dependencies;
  expect(three.getTrial).toBe(one.getTrial); expect(three.getProfile).toBe(one.getProfile); expect(three.getLimits).toBe(one.getLimits);
  expect(three.getTrial()).toEqual({ authorizationVersion: 'synthetic-trial-v2', maxSubmissions: 3 });
  expect(three.getProfile()).toMatchObject({ feeMode: 'estimate_only', sourceReference: 'synthetic-price-source-v2' });
  expect(three.operationClient).not.toBe(one.operationClient); expect(three.operationClient.put).not.toBe(one.operationClient.put);
  expect(three.operationClient.put).toEqual(expect.any(Function)); expect(one.operationClient.put).toEqual(expect.any(Function));
  const grant = three.getTrial(); grant.authorizationVersion = 'other'; grant.maxSubmissions = 4;
  env.AI1_TRIAL_AUTHORIZATION = '{}';
  expect(one.getTrial()).toEqual({ authorizationVersion: 'synthetic-trial-v2', maxSubmissions: 3 });
  expect(three.getTrial()).toEqual(one.getTrial());
});
test.each(['enabled', 'query-only', 'off'])('reconstruction in %s preserves trial identity or read-only recovery without data changes', async mode => {
  const env = trialConfig(), original = createAi1Runtime({ env }); await original.assertReady();
  const A1 = require('../../models/Ai1'), oid = () => new mongoose.Types.ObjectId();
  await A1.Account.create({ _id: 'experiment', trialAuthorizationVersion: 'synthetic-trial-v2', trialMaxSubmissions: 3,
    trialUsedSubmissions: 3, halted: true, haltReason: 'cost_unknown', outstandingMicros: 100 });
  await A1.Command.create({ familyId: oid(), childId: oid(), actorId: oid(), endpointOperation: 'ai1.create',
    operationId: 'synthetic-old-ai1-command', requestHash: 'a'.repeat(64), result: { schemaVersion: 'ai1-min-v1', synthetic: true } });
  await M.Command.create({ familyId: oid(), childId: oid(), actorId: oid(), roundId: oid(), endpointOperation: 'ai3.create',
    operationId: 'synthetic-old-ai3-command', requestHash: 'b'.repeat(64), payload: { schemaVersion: 'ai3-min-v1', synthetic: true }, phase: 'SUCCEEDED' });
  const models = [...Object.values(A1), ...Object.values(M)];
  const snapshot = () => Promise.all(models.map(model => model.find().sort({ _id: 1 }).lean()));
  const before = await snapshot();
  env.AI1_MODE = mode;
  if (mode !== 'enabled') { env.AI1_TRIAL_AUTHORIZATION = '{}'; env.AI1_MODEL_PROFILE = '{}'; }
  const ai1Runtime = createAi1Runtime({ env }), runtime = createAi3Runtime({ env, ai1Runtime });
  await ai1Runtime.assertReady(); await runtime.assertReady();
  expect(runtime.dependencies.getTrial()).toEqual(mode === 'enabled' ? original.dependencies.getTrial() : null);
  if (mode === 'query-only') {
    expect(Object.keys(runtime.dependencies.operationClient)).toEqual(['get']);
    expect(Object.keys(ai1Runtime.dependencies.operationClient)).toEqual(['get']);
    expect(runtime.dependencies.getProfile()).toBeNull();
  }
  if (mode === 'off') expect(runtime.dependencies.operationClient).toBeUndefined();
  expect(await snapshot()).toEqual(before);
});
test('AI3 cannot independently acquire a trial grant from environment without AI1 runtime', async () => {
  const runtime = createAi3Runtime({ env: trialConfig() }); await runtime.assertReady();
  expect(runtime.dependencies.getTrial()).toBeNull(); expect(runtime.dependencies.getProfile()).toBeNull();
  expect(runtime.dependencies.operationClient).toBeUndefined();
});
