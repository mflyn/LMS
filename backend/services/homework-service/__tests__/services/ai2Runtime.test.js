const mongoose = require('mongoose');
const { createAi2Runtime } = require('../../services/ai2Runtime');
const M = require('../../models/Ai2');
const config = (mode = 'enabled') => ({ AI2_MODE: mode, AI2_STORE_CONTINUOUS: 'true', COMPLETION_PROTOCOL_MODE: 'enabled' });
beforeAll(async () => { for (const model of Object.values(mongoose.models)) await model.init(); });
afterEach(() => jest.restoreAllMocks());

test('default off never reports store readiness, including after no-op assertReady', async () => {
  const env = {}, runtime = createAi2Runtime({ env });
  expect(runtime.dependencies.getRuntime()).toEqual({ enabled: false, continuousStore: false });
  await runtime.assertReady();
  expect(runtime.dependencies.getRuntime()).toEqual({ enabled: false, continuousStore: false });
  Object.assign(env, config());
  expect(() => runtime.dependencies.getRuntime()).toThrow('AI2_NOT_READY');
});

test.each(['', 'ENABLED', 'true', true, null, 'query-only'])('mode %s is rejected', mode => {
  expect(() => createAi2Runtime({ env: config(mode) })).toThrow();
});

test.each([{ AI2_STORE_CONTINUOUS: undefined }, { AI2_STORE_CONTINUOUS: true },
  { COMPLETION_PROTOCOL_MODE: 'legacy' }, { COMPLETION_PROTOCOL_MODE: 'maintenance' }])('enabled rejects incomplete prerequisites %#', change => {
  expect(() => createAi2Runtime({ env: { ...config(), ...change } })).toThrow();
});

test.each(['enabled', 'off'])('%s continuous store must pass actual initial readiness and respects live mode changes', async mode => {
  const env = config(mode), runtime = createAi2Runtime({ env });
  expect(() => runtime.dependencies.getRuntime()).toThrow('AI2_NOT_READY');
  await runtime.assertReady();
  expect(runtime.dependencies.getRuntime()).toEqual({ enabled: mode === 'enabled', continuousStore: true });
  env.AI2_MODE = 'off';
  expect(runtime.dependencies.getRuntime()).toEqual({ enabled: false, continuousStore: true });
  env.AI2_STORE_CONTINUOUS = 'false';
  expect(runtime.dependencies.getRuntime()).toEqual({ enabled: false, continuousStore: false });
  env.AI2_STORE_CONTINUOUS = 'true'; env.COMPLETION_PROTOCOL_MODE = 'maintenance';
  expect(() => runtime.dependencies.getRuntime()).toThrow();
  env.AI2_MODE = 'enabled';
  expect(() => runtime.dependencies.getRuntime()).toThrow();
});

test('foreign connection and a detached formal model never qualify as ready', () => {
  expect(() => createAi2Runtime({ env: config(), connection: {} })).toThrow('AI2_NOT_READY');
  const connection = M.Attempt.db;
  try { M.Attempt.db = {}; expect(() => createAi2Runtime({ env: config() })).toThrow('AI2_NOT_READY'); }
  finally { M.Attempt.db = connection; }
});

test('missing unique index fails off-with-continuity too, never repairs it, and sanitizes failures', async () => {
  const index = (await M.Command.collection.indexes()).find(i => i.unique && i.key.operationId);
  await M.Command.collection.dropIndex(index.name);
  try {
    const runtime = createAi2Runtime({ env: config('off') });
    await expect(runtime.assertReady()).rejects.toMatchObject({ code: 'AI2_NOT_READY', message: 'AI2_NOT_READY' });
    expect(() => runtime.dependencies.getRuntime()).toThrow('AI2_NOT_READY');
    expect((await M.Command.collection.indexes()).some(i => i.name === index.name)).toBe(false);
  } finally { await M.Command.createIndexes(); }
});

test('transaction topology failure revokes an earlier successful preflight', async () => {
  const runtime = createAi2Runtime({ env: config() }); await runtime.assertReady();
  const admin = mongoose.connection.db.admin();
  jest.spyOn(mongoose.connection.db, 'admin').mockReturnValue(admin);
  jest.spyOn(admin, 'command').mockResolvedValue({ isWritablePrimary: true, maxWireVersion: 17, logicalSessionTimeoutMinutes: 30 });
  await expect(runtime.assertReady()).rejects.toThrow(/^AI2_NOT_READY$/);
  expect(() => runtime.dependencies.getRuntime()).toThrow('AI2_NOT_READY');
});
