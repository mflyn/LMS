const http = require('http');
const { createAi2MediaAccessClient } = require('../services/ai2MediaAccessClient');
const { createMediaCapabilityService } = require('../services/mediaCapability');
const token = 'synthetic-service-token-with-at-least-32-characters';
const input = { familyId: '6656875da7f86a0012c2a101', childId: '6656875da7f86a0012c2a301',
  actorId: '6656875da7f86a0012c2a301', role: 'student', mediaId: '6656875da7f86a0012c2a401',
  bindings: [{ attemptId: '6656875da7f86a0012c2a501', bindingOperationId: 'ddda6183-e6e1-47d8-a81d-2f9d834320d4' }] };
let server, base, respond, calls;
beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    calls.push({ path: req.url, method: req.method, headers: req.headers, body: JSON.parse(Buffer.concat(chunks).toString()) });
    respond(req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(() => {
  calls = [];
  respond = (_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true, data: { allowed: true } })); };
});
afterAll(async () => { await new Promise(resolve => server.close(resolve)); });
const make = options => createAi2MediaAccessClient({ homeworkServiceUrl: base, serviceToken: token, ...options });

test('real HTTP POST uses only closed body and service credential', async () => {
  expect(await make().check(input)).toBe(true);
  expect(calls).toHaveLength(1); expect(calls[0]).toMatchObject({ path: '/api/internal/ai2/media-access-check', method: 'POST',
    body: input, headers: { 'x-service-token': token } });
  expect(calls[0].headers.authorization).toBeUndefined();
});
test('explicit denial is not a dependency failure', async () => {
  respond = (_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true, data: { allowed: false } })); };
  expect(await make().check(input)).toBe(false);
});
test.each([{ ...input, tokenVersion: 0 }, { ...input, bindings: Array(1) },
  { ...input, bindings: Array(101).fill(input.bindings[0]) }, { ...input, role: 'admin' },
  { ...input, bindings: [{ ...input.bindings[0], state: 'bound' }] }])('invalid input fails before transport', async command => {
  await expect(make().check(command)).rejects.toMatchObject({ statusCode: 503, code: 'MEDIA_SERVICE_UNAVAILABLE' });
  expect(calls).toHaveLength(0);
});
test.each([{}, { success: true, data: { allowed: 1 } }, { success: true, data: { allowed: true, mediaId: input.mediaId } },
  { success: false, data: { allowed: true } }])('unexpected response fails closed', async body => {
  respond = (_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
  await expect(make().check(input)).rejects.toMatchObject({ statusCode: 503 });
});
test('redirect is not followed and secret never escapes error', async () => {
  respond = (_req, res) => { res.writeHead(302, { Location: `${base}/other` }); res.end(token); };
  let error;
  try { await make().check(input); } catch (cause) { error = cause; }
  expect(error.statusCode).toBe(503); expect(calls).toHaveLength(1);
  expect(JSON.stringify(error)).not.toContain(token); expect(error.message).not.toContain(token);
});
test('HTTP failure and disconnected dependency remain 503', async () => {
  respond = (_req, res) => { res.writeHead(401); res.end(token); };
  await expect(make().check(input)).rejects.toMatchObject({ statusCode: 503 });
  respond = (req, _res) => req.socket.destroy();
  await expect(make().check(input)).rejects.toMatchObject({ statusCode: 503 });
});
test('capability binds authenticated path and cannot be moved to anonymous path', () => {
  let time = Date.now();
  const cap = createMediaCapabilityService({ secret: 'synthetic-signing-secret-at-least-32-characters', now: () => time });
  const access = cap.issue(input.mediaId, { requiresAuthorization: true });
  const url = new URL(access.url, 'http://localhost');
  const args = { ...Object.fromEntries(url.searchParams), path: url.pathname, mediaId: input.mediaId, requiresAuthorization: true };
  expect(cap.verify(args)).toBe(true);
  expect(() => cap.verify({ ...args, requiresAuthorization: false })).toThrow();
  expect(() => cap.verify({ ...args, path: url.pathname.replace('authenticated-content', 'content') })).toThrow();
  time += 300001; expect(() => cap.verify(args)).toThrow();
});
