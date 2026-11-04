const { resolveAi2Mode, validateAi2Environment } = require('../../services/ai2Activation');
const { assertLegacyCompletionState, withCompletionMode } = require('../../services/completionActivation');
const express = require('express');
const { createHttpTestHarness } = require('../../test/httpTestHarness');
const { createIdentityHeaders } = require('../../middleware/gatewayIdentity');
const { request, close } = createHttpTestHarness();
afterEach(close);

test('AI2 defaults off; explicit mode and continuity declarations are strict', () => {
  expect(resolveAi2Mode({})).toBe('off');
  expect(validateAi2Environment({})).toEqual({ mode: 'off', continuousStore: false });
  for (const AI2_MODE of ['', 'Enabled', true, 'legacy']) {
    expect(() => validateAi2Environment({ AI2_MODE })).toThrow('AI2_CONFIGURATION_REQUIRED');
  }
  for (const AI2_STORE_CONTINUOUS of ['', true, '1', 'TRUE']) {
    expect(() => validateAi2Environment({ AI2_STORE_CONTINUOUS })).toThrow('AI2_CONFIGURATION_REQUIRED');
  }
});
test('AI2 enable and retained reads require the formal completion store', () => {
  expect(() => validateAi2Environment({ AI2_MODE: 'enabled' })).toThrow('AI2_CONFIGURATION_REQUIRED');
  for (const mode of ['off', 'enabled']) {
    for (const completion of [undefined, 'legacy', 'maintenance']) {
      expect(() => validateAi2Environment({ AI2_MODE: mode, AI2_STORE_CONTINUOUS: 'true',
        COMPLETION_PROTOCOL_MODE: completion })).toThrow('AI2_CONFIGURATION_REQUIRED');
    }
    expect(validateAi2Environment({ AI2_MODE: mode, AI2_STORE_CONTINUOUS: 'true', COMPLETION_PROTOCOL_MODE: 'enabled' }))
      .toEqual({ mode, continuousStore: true });
  }
});
test('mode is read on every invocation, not captured from the process at import', () => {
  const env = { AI2_MODE: 'enabled', AI2_STORE_CONTINUOUS: 'true', COMPLETION_PROTOCOL_MODE: 'enabled' };
  expect(resolveAi2Mode(env)).toBe('enabled'); env.AI2_MODE = 'off';
  expect(resolveAi2Mode(env)).toBe('off');
});
test.each(['ai2packages', 'ai2attempts', 'ai2commands'])('legacy refuses persisted %s', async name => {
  const connection = { db: { collection: jest.fn(collection => ({ findOne: jest.fn(async () =>
    collection === name ? { _id: 'synthetic' } : null) })) } };
  await expect(assertLegacyCompletionState({ connection, service: 'homework' }))
    .rejects.toMatchObject({ code: 'COMPLETION_LEGACY_UNSAFE' });
});
test.each(['mediaassets', 'mediareferences'])('legacy refuses AI2 %s even without operation records', async name => {
  const findOne = jest.fn(async query => (query.purpose === 'ai2_correction' || query.field?.$in?.includes('correctionMediaIds'))
    ? { _id: 'synthetic' } : null);
  const connection = { db: { collection: jest.fn(collection => ({ findOne: collection === name ? findOne : async () => null })) } };
  await expect(assertLegacyCompletionState({ connection, service: 'resource' }))
    .rejects.toMatchObject({ code: 'COMPLETION_LEGACY_UNSAFE' });
  expect(findOne).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ readPreference: 'primary', maxTimeMS: 5000 }));
});
test.each([
  ['homework', '/api/ai2/learning-packages', false],
  ['homework', '/api/internal/ai2/media-access-check', true],
  ['resource', '/api/internal/media/ai2/inspect', true]
])('maintenance blocks %s %s before the inner app', async (service, url, internal) => {
  const token = 'synthetic-ai2-maintenance-token-32chars';
  const reached = jest.fn(); const inner = express();
  inner.use((_req, res) => { reached(); res.sendStatus(200); });
  const app = withCompletionMode(inner, { mode: 'maintenance', service, env: { MEDIA_REFERENCE_SERVICE_TOKEN: token } });
  expect((await (await request(app)).post(url)).status).toBe(401);
  const headers = internal ? { 'x-service-token': token } : createIdentityHeaders({ method: 'POST', originalUrl: url,
    user: { id: 'a'.repeat(24), role: 'parent' }, secret: process.env.GATEWAY_IDENTITY_SECRET });
  const response = await (await request(app)).post(url).set(headers);
  expect(response.status).toBe(503); expect(response.body.error.code).toBe('COMPLETION_MAINTENANCE');
  expect(reached).not.toHaveBeenCalled();
});
test('maintenance without an AI2 credential rejects internal requests but keeps health reachable', async () => {
  const inner = express(), reached = jest.fn();
  inner.use((_req, res) => { reached(); res.sendStatus(200); });
  const app = withCompletionMode(inner, { mode: 'maintenance', service: 'homework', env: {} });
  expect((await (await request(app)).post('/api/internal/ai2/media-access-check')
    .set('x-service-token', 'arbitrary-token')).status).toBe(401);
  expect((await (await request(app)).get('/health')).status).toBe(200);
  expect(reached).not.toHaveBeenCalled();
});
