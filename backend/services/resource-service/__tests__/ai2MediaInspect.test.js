process.env.JWT_SECRET = 'synthetic-ai25-inspect-jwt-secret-32chars';
process.env.GATEWAY_IDENTITY_SECRET = 'synthetic-ai25-inspect-gateway-secret-32';
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/synthetic-unused';
jest.mock('../../../common/config/logger', () => ({ createLogger: () => ({
  debug() {}, info() {}, warn() {}, error() {}
}) }));
const { createApp } = require('../app');
const { createHttpTestHarness } = require('../../../common/test/httpTestHarness');
const { AppError } = require('../../../common/middleware/errorTypes');
const { request, close } = createHttpTestHarness();
const token = 'synthetic-ai25-inspect-service-token-32chars';
const id = n => n.toString(16).padStart(24, '0');
const input = () => ({ familyId: id(1), childId: id(2), identity: { id: id(3), role: 'parent' },
  mediaIds: [id(4)], bindings: [{ mediaId: id(4), resourceType: 'ai2_attempt', resourceId: id(5),
    field: 'correctionMediaIds', bindingOperationId: '11111111-1111-4111-8111-111111111111' }] });
let inspect, app;
beforeEach(() => {
  inspect = jest.fn(async () => [{ mediaId: id(4), mimeType: 'image/png', sizeBytes: 123, status: 'available' }]);
  const { createAi2MediaInspectRouter } = require('../routes/ai2MediaInspect');
  app = createApp({ ai2MediaInspectRouter: createAi2MediaInspectRouter({ serviceToken: token, mediaService: { inspect } }) });
});
afterEach(close);
const post = async (body = input(), credential = token) => {
  const req = (await request(app)).post('/api/internal/media/ai2/inspect');
  if (credential) req.set('x-service-token', credential);
  return req.send(body);
};
test.each([undefined, 'wrong-synthetic-token'])('rejects missing/wrong service credential: %s', async credential => {
  const result = await post(input(), credential || null);
  expect(result.status).toBe(401); expect(inspect).not.toHaveBeenCalled();
});
test('authenticates before parsing malformed JSON and sanitizes parser errors', async () => {
  const raw = '{"private":"synthetic-secret';
  for (const auth of [false, true]) {
    const req = (await request(app)).post('/api/internal/media/ai2/inspect').set('Content-Type', 'application/json');
    if (auth) req.set('x-service-token', token);
    const result = await req.send(raw);
    expect(result.status).toBe(auth ? 400 : 401); expect(JSON.stringify(result.body)).not.toContain('synthetic-secret');
  }
  expect(inspect).not.toHaveBeenCalled();
});
test.each([
  body => ({ ...body, bytes: 'private' }),
  body => ({ ...body, identity: { ...body.identity, token: 'private' } }),
  body => ({ ...body, identity: { ...body.identity, role: 'admin' } }),
  body => ({ ...body, identity: { role: 'parent' } }),
  body => ({ ...body, identity: { ...body.identity, tokenVersion: -1 } }),
  body => ({ ...body, identity: { ...body.identity, childId: false } }),
  body => ({ ...body, bindings: [{ ...body.bindings[0], storageKey: 'private' }] }),
  body => ({ ...body, bindings: [{ ...body.bindings[0], field: 'completionMediaIds' }] }),
  body => ({ ...body, bindings: [{ ...body.bindings[0], bindingOperationId: 'invalid' }] }),
  body => ({ ...body, bindings: [{ ...body.bindings[0], mediaId: id(6) }] }),
  body => ({ ...body, bindings: [] }),
  body => ({ ...body, familyId: 'bad' }),
  body => ({ ...body, mediaIds: [] }),
  body => ({ ...body, mediaIds: Array(11).fill(id(4)), bindings: Array(11).fill(body.bindings[0]) }),
  body => ({ ...body, mediaIds: [id(4), id(4)], bindings: [body.bindings[0], body.bindings[0]] }),
  () => [], () => null
])('rejects closed-contract violation %# without consulting media service', async change => {
  const result = await post(change(input())); expect(result.status).toBe(400); expect(inspect).not.toHaveBeenCalled();
});
test('preserves approved identity/body and returns metadata only', async () => {
  const body = input(); body.identity = { id: id(2), role: 'student', familyId: id(1), childId: id(2), tokenVersion: 0 };
  const result = await post(body);
  expect(inspect).toHaveBeenCalledWith(body);
  expect(result.body).toEqual({ success: true, data: { items: [
    { mediaId: id(4), mimeType: 'image/png', sizeBytes: 123, status: 'available' }
  ] } });
  expect(result.headers['cache-control']).toContain('no-store');
});
test.each(['available', 'deleted'])('only approved metadata escapes for %s', async status => {
  inspect.mockResolvedValue([{ mediaId: id(4), mimeType: 'image/webp', sizeBytes: 10, status,
    bytes: Buffer.from('private'), storageKey: '/private/secret', identity: 'private' }]);
  const result = await post();
  expect(result.body).toEqual({ success: true, data: { items: [
    { mediaId: id(4), mimeType: 'image/webp', sizeBytes: 10, status }
  ] } });
});
test.each([[], [{ mediaId: id(6), mimeType: 'image/png', sizeBytes: 1, status: 'available' }],
  [{ mediaId: id(4), mimeType: 'application/pdf', sizeBytes: 1, status: 'available' }],
  [{ mediaId: id(4), mimeType: 'image/png', sizeBytes: 0, status: 'available' }],
  [{ mediaId: id(4), mimeType: 'image/png', sizeBytes: 1, status: 'unknown' }]].map(items => ({ items })))(
  'invalid inspect output fails closed %#', async ({ items }) => {
    inspect.mockResolvedValue(items); expect((await post()).status).toBe(503);
  });
test.each([[403, 'CHILD_ACCESS_DENIED'], [404, 'RESOURCE_NOT_FOUND'], [503, 'MEDIA_SERVICE_UNAVAILABLE']])(
  'sanitizes known dependency errors %s', async (status, code) => {
    inspect.mockRejectedValue(new AppError('/private/secret token=private', status, code, true, ['private']));
    const result = await post(); expect(result.status).toBe(status);
    expect(result.body).toEqual({ success: false, error: { code, message: code, details: [] } });
  });
test('unexpected errors do not expose raw stack/body/path/token', async () => {
  inspect.mockRejectedValue(Error('/private/secret token=private'));
  const result = await post(); expect(result.status).toBe(503);
  expect(result.body).toEqual({ success: false, error: {
    code: 'MEDIA_SERVICE_UNAVAILABLE', message: 'MEDIA_SERVICE_UNAVAILABLE', details: []
  } });
});
