const mongoose = require('mongoose');
const M = require('../../models/Ai3');
const { createAi3Runtime } = require('../../services/ai3Runtime');
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
