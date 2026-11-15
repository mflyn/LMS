const http = require('http');
const { createAi2MediaInspectClient } = require('../../services/ai2MediaInspectClient');

const id = n => n.toString(16).padStart(24, '0');
const token = 'synthetic-ai25-reference-credential-32chars';
const config = { resourceServiceUrl: 'http://resource-service:3005', serviceToken: token, timeout: 3000 };
const input = () => ({ familyId: id(1), childId: id(2), identity: { id: id(2), role: 'student',
  familyId: id(1), childId: id(2), tokenVersion: 0, username: 'PRIVATE_NAME', secret: 'PRIVATE_TOKEN' },
mediaIds: [id(3), id(4)], bindings: [3, 4].map(n => ({ mediaId: id(n), resourceType: 'ai2_attempt',
  resourceId: id(5), field: 'correctionMediaIds', bindingOperationId: '11111111-1111-4111-8111-111111111111' })) });
const items = () => [3, 4].map((n, i) => ({ mediaId: id(n), mimeType: i ? 'image/webp' : 'image/jpeg',
  sizeBytes: i ? 10485760 : 1, status: i ? 'deleted' : 'available' }));
const response = value => ({ status: 200, data: { success: true, data: { items: value } } });

test('inspect sends only closed metadata and whitelisted identity; returns ordered available/deleted descriptors', async () => {
  const transport = { post: jest.fn().mockResolvedValue(response(items())) };
  const client = createAi2MediaInspectClient({ ...config, axiosInstance: transport });
  expect(await client.inspect(input())).toEqual(items());
  const [url, body, options] = transport.post.mock.calls[0];
  expect(url).toBe('http://resource-service:3005/api/internal/media/ai2/inspect');
  expect(body).toEqual({ ...input(), identity: { id: id(2), role: 'student', familyId: id(1), childId: id(2), tokenVersion: 0 } });
  expect(JSON.stringify(body)).not.toMatch(/PRIVATE_|secret|username/);
  expect(options).toMatchObject({ headers: { 'x-service-token': token }, timeout: 3000, maxRedirects: 0 });
});

test.each([
  {}, { familyId: id(9), childId: id(8), tokenVersion: -1, username: 'PRIVATE_NAME', secret: 'PRIVATE_TOKEN' }
])('parent claims are not scope authority; wire identity is only id/role %#', async claims => {
  const transport = { post: jest.fn().mockResolvedValue(response(items())) };
  const body = { ...input(), identity: { id: id(7), role: 'parent', ...claims } };
  await expect(createAi2MediaInspectClient({ ...config, axiosInstance: transport }).inspect(body)).resolves.toEqual(items());
  expect(transport.post.mock.calls[0][1].identity).toEqual({ id: id(7), role: 'parent' });
});

test.each([
  { timeout: 0 }, { timeout: 30001 }, { timeout: NaN }, { timeout: 1.5 }, { serviceToken: 'short' },
  { resourceServiceUrl: 'file:///private' }, { resourceServiceUrl: 'http://user:pass@resource' },
  { resourceServiceUrl: 'http://resource/path' }, { resourceServiceUrl: 'http://resource?token=x' }
])('invalid client configuration %# is rejected without leaking credential', change => {
  expect(() => createAi2MediaInspectClient({ ...config, ...change })).toThrow(/^AI2_MEDIA_INSPECT_CONFIGURATION_INVALID$/);
});

test.each([
  body => ({ ...body, secret: token }), body => ({ ...body, familyId: 'invalid' }),
  body => ({ ...body, identity: { ...body.identity, tokenVersion: -1 } }),
  body => ({ ...body, identity: { ...body.identity, role: 'teacher' } }),
  body => ({ ...body, identity: { ...body.identity, childId: id(9) } }),
  body => ({ ...body, identity: { ...body.identity, familyId: id(9) } }),
  body => ({ ...body, identity: { ...body.identity, id: id(9) } }),
  body => ({ ...body, identity: { id: id(2), role: 'student' } }),
  body => ({ ...body, mediaIds: [] }), body => ({ ...body, mediaIds: [id(3), id(3)] }),
  body => ({ ...body, mediaIds: new Array(2) }), body => ({ ...body, bindings: body.bindings.slice(1) }),
  body => ({ ...body, bindings: body.bindings.map(b => ({ ...b, token })) }),
  body => ({ ...body, bindings: body.bindings.map(b => ({ ...b, field: 'completionMediaIds' })) }),
  body => ({ ...body, bindings: body.bindings.slice().reverse() })
])('invalid request %# fails closed before transport', change => {
  const transport = { post: jest.fn() }, client = createAi2MediaInspectClient({ ...config, axiosInstance: transport });
  return expect(client.inspect(change(input()))).rejects.toMatchObject({ code: 'MEDIA_SERVICE_UNAVAILABLE', statusCode: 503 })
    .then(() => expect(transport.post).not.toHaveBeenCalled());
});

test.each([
  value => value.slice(1), value => value.slice().reverse(), value => [value[0], value[0]],
  () => new Array(2), value => value.map(x => ({ ...x, url: 'PRIVATE_PATH' })),
  value => value.map(x => ({ ...x, mimeType: 'application/pdf' })),
  value => value.map(x => ({ ...x, status: 'missing' })),
  value => value.map(x => ({ ...x, sizeBytes: 0 })), value => value.map(x => ({ ...x, sizeBytes: 10485761 })),
  value => value.map(x => ({ ...x, sizeBytes: 1.5 })), value => value.map(x => ({ ...x, mediaId: token }))
])('malformed metadata response %# never returns partial or synthetic success', async change => {
  const transport = { post: jest.fn().mockResolvedValue(response(change(items()))) };
  await expect(createAi2MediaInspectClient({ ...config, axiosInstance: transport }).inspect(input()))
    .rejects.toMatchObject({ code: 'MEDIA_SERVICE_UNAVAILABLE', message: 'MEDIA_SERVICE_UNAVAILABLE', statusCode: 503, details: [] });
});

test.each([301, 302, 307, 308, 401, 403, 404, 503])('HTTP %i is unavailable, not a missing/deleted image', async status => {
  const transport = { post: jest.fn().mockResolvedValue({ ...response(items()), status }) };
  await expect(createAi2MediaInspectClient({ ...config, axiosInstance: transport }).inspect(input())).rejects.toThrow(/^MEDIA_SERVICE_UNAVAILABLE$/);
});

test('transport failures and unknown response envelope fields cannot leak remote secrets or diagnostics', async () => {
  const transport = { post: jest.fn().mockRejectedValueOnce(Object.assign(new Error(token), { config: { token }, response: { data: token } }))
    .mockResolvedValueOnce({ status: 200, data: { ...response(items()).data, diagnostic: token } }) };
  const client = createAi2MediaInspectClient({ ...config, axiosInstance: transport });
  for (let n = 0; n < 2; n++) {
    let failure; try { await client.inspect(input()); } catch (cause) { failure = cause; }
    expect(failure).toMatchObject({ message: 'MEDIA_SERVICE_UNAVAILABLE', code: 'MEDIA_SERVICE_UNAVAILABLE' });
    expect(JSON.stringify(failure)).not.toContain(token);
    expect(failure.cause).toBeUndefined(); expect(failure.response).toBeUndefined();
  }
});

test('real local HTTP refuses redirect without sending service credential to the target', async () => {
  const received = [], server = http.createServer((req, res) => {
    received.push({ path: req.url, token: req.headers['x-service-token'] });
    res.writeHead(307, { Location: '/unexpected' }); res.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const client = createAi2MediaInspectClient({ ...config, resourceServiceUrl: `http://127.0.0.1:${server.address().port}` });
    await expect(client.inspect(input())).rejects.toThrow(/^MEDIA_SERVICE_UNAVAILABLE$/);
    expect(received).toEqual([{ path: '/api/internal/media/ai2/inspect', token }]);
  } finally { server.closeAllConnections?.(); await new Promise(resolve => server.close(resolve)); }
});

test('real local HTTP timeout is bounded and sanitized', async () => {
  const server = http.createServer(() => {});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const client = createAi2MediaInspectClient({ ...config, timeout: 50, resourceServiceUrl: `http://127.0.0.1:${server.address().port}` });
    const started = Date.now();
    await expect(client.inspect(input())).rejects.toMatchObject({ code: 'MEDIA_SERVICE_UNAVAILABLE', message: 'MEDIA_SERVICE_UNAVAILABLE' });
    expect(Date.now() - started).toBeLessThan(2000);
  } finally { server.closeAllConnections?.(); await new Promise(resolve => server.close(resolve)); }
});
