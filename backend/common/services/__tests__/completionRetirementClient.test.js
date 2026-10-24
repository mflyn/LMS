const http = require('http');
const { createCompletionRetirementClient } = require('../completionRetirementClient');

const token = 'synthetic-retirement-only-service-token-32';
const body = () => ({ familyId: 'a'.repeat(24), childId: 'b'.repeat(24), mediaId: 'c'.repeat(24),
  retirementId: '00000000-0000-4000-8000-000000000001' });
const pending = { statusCode: 503, code: 'MEDIA_RETIREMENT_PENDING' };
let server, baseUrl, respond, requests;
beforeEach(async () => {
  requests = [];
  respond = (_req, res) => res.end(JSON.stringify({ success: true, data: { ...body(), state: 'granted' } }));
  server = http.createServer(async (req, res) => {
    let raw = ''; for await (const part of req) raw += part;
    requests.push({ method: req.method, url: req.url, headers: req.headers, body: JSON.parse(raw) });
    respond(req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
});
const client = options => createCompletionRetirementClient({ baseUrl, token, ...options });

test.each(['granted', 'in_use'])('POSTs only original scope with dedicated credential and returns %s', async state => {
  respond = (_req, res) => res.end(JSON.stringify({ success: true, data: { ...body(), state } }));
  await expect(client().retire(body())).resolves.toEqual({ ...body(), state });
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ method: 'POST', url: '/api/internal/completion-media-retirements', body: body(),
    headers: { 'x-service-token': token, 'content-type': 'application/json' } });
  expect(requests[0].headers.authorization).toBeUndefined();
});

test.each([
  ['array', () => []], ['missing', b => { delete b.childId; return b; }],
  ['extra', b => ({ ...b, actorId: b.childId })], ['undefined', b => ({ ...b, mediaId: undefined })],
  ['id newline', b => ({ ...b, mediaId: b.mediaId + '\n' })],
  ['uuid newline', b => ({ ...b, retirementId: b.retirementId + '\n' })],
  ['invalid id', b => ({ ...b, familyId: '../escape' })], ['invalid uuid', b => ({ ...b, retirementId: 'invalid' })]
])('rejects %s command before HTTP', async (_name, mutate) => {
  await expect(client().retire(mutate(body()))).rejects.toMatchObject(pending);
  expect(requests).toEqual([]);
});

test.each([
  ['false success', r => { r.success = false; }], ['extra envelope', r => { r.secret = token; }],
  ['extra data', r => { r.data.secret = token; }], ['missing data', r => { delete r.data; }],
  ['array data', r => { r.data = []; }], ['unknown state', r => { r.data.state = 'retired'; }],
  ...['familyId', 'childId', 'mediaId', 'retirementId'].map(key => [`mismatched ${key}`, r => { r.data[key] = 'd'.repeat(24); }])
])('malformed %s never grants retirement or exposes upstream content', async (_name, mutate) => {
  const response = { success: true, data: { ...body(), state: 'granted' } }; mutate(response);
  respond = (_req, res) => res.end(JSON.stringify(response));
  const error = await client().retire(body()).catch(e => e);
  expect(error).toMatchObject(pending);
  expect(JSON.stringify(error) + error.stack).not.toContain(token);
  expect(error.cause).toBeUndefined();
});

test.each([400, 401, 403, 404, 409, 500, 503])('upstream %s remains stable pending, not a terminal decision', async status => {
  respond = (_req, res) => { res.statusCode = status; res.end(token); };
  const error = await client().retire(body()).catch(e => e);
  expect(error).toMatchObject(pending);
  expect(JSON.stringify(error) + error.stack).not.toContain(token);
});

test('invalid JSON remains pending', async () => {
  respond = (_req, res) => res.end('not-json');
  await expect(client().retire(body())).rejects.toMatchObject(pending);
});
test('does not follow redirect or send the credential to the redirect target', async () => {
  let leaked = 0;
  const target = http.createServer((_req, res) => { leaked += 1; res.end('{}'); });
  await new Promise(resolve => target.listen(0, '127.0.0.1', resolve));
  try {
    respond = (_req, res) => { res.writeHead(307, { location: `http://127.0.0.1:${target.address().port}/leak` }); res.end(); };
    await expect(client().retire(body())).rejects.toMatchObject(pending);
    expect(leaked).toBe(0);
  } finally { target.closeAllConnections(); await new Promise(resolve => target.close(resolve)); }
});
test.each(['headers', 'body'])('bounds waiting for %s with a real HTTP timeout', async phase => {
  respond = (_req, res) => { if (phase === 'body') { res.writeHead(200); res.write('{'); } };
  const start = Date.now();
  await expect(client({ timeoutMs: 60 }).retire(body())).rejects.toMatchObject(pending);
  expect(Date.now() - start).toBeLessThan(2000);
});
test('connection loss is pending without leaking transport error', async () => {
  respond = req => req.socket.destroy();
  await expect(client().retire(body())).rejects.toMatchObject(pending);
});
test('injected fetch still has a deadline when it ignores cancellation', async () => {
  await expect(client({ timeoutMs: 20, fetchImpl: () => new Promise(() => {}) }).retire(body())).rejects.toMatchObject(pending);
});
test('snapshots the command before awaiting transport', async () => {
  let entered, release;
  const ready = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const input = body();
  const transport = async (...args) => { entered(); await gate; return fetch(...args); };
  const result = client({ fetchImpl: transport }).retire(input);
  await ready; input.mediaId = 'd'.repeat(24); release();
  await expect(result).resolves.toEqual({ ...body(), state: 'granted' });
  expect(requests[0].body).toEqual(body());
});
test.each([
  { token: '' }, { token: 'short' }, { token: token + '\n' }, { timeoutMs: 0 }, { timeoutMs: Infinity },
  { baseUrl: 'file:///tmp/secret' }, { baseUrl: 'http://user:secret@localhost' },
  { baseUrl: 'http://localhost?secret=yes' }, { baseUrl: 'http://localhost#secret' }, { fetchImpl: null }
])('invalid configuration fails closed (%#)', options => {
  expect(() => client(options)).toThrow(); expect(requests).toEqual([]);
});

describe('read-only status client', () => {
  test.each(['absent', 'available', 'retired'])('uses fixed status endpoint and accepts only exact %s scope', async state => {
    respond = (_req, res) => res.end(JSON.stringify({ success: true, data: { ...body(), state } }));
    await expect(client().status(body())).resolves.toEqual({ ...body(), state });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ method: 'POST', url: '/api/internal/completion-media-retirements/status',
      headers: { 'x-service-token': token, 'content-type': 'application/json' }, body: body() });
  });
  test.each([['status', 'granted'], ['status', 'in_use'], ['retire', 'absent'], ['retire', 'available'], ['retire', 'retired']])
  ('%s never accepts the other endpoint state %s', async (method, state) => {
    respond = (_req, res) => res.end(JSON.stringify({ success: true, data: { ...body(), state } }));
    await expect(client()[method](body())).rejects.toMatchObject(pending);
    expect(requests).toHaveLength(1);
  });
  test.each(['familyId', 'childId', 'mediaId', 'retirementId', 'extra data', 'extra envelope', 'missing state', 'false success'])
  ('status rejects malformed %s without exposing upstream data', async kind => {
    const response = { success: true, data: { ...body(), state: 'retired' } };
    if (kind === 'extra data') response.data.secret = token;
    else if (kind === 'extra envelope') response.secret = token;
    else if (kind === 'missing state') delete response.data.state;
    else if (kind === 'false success') response.success = false;
    else response.data[kind] = 'd'.repeat(24);
    respond = (_req, res) => res.end(JSON.stringify(response));
    const error = await client().status(body()).catch(e => e);
    expect(error).toMatchObject(pending); expect(JSON.stringify(error) + error.stack).not.toContain(token);
    expect(error.cause).toBeUndefined();
  });
  test.each([[], {}, { ...body(), actorId: 'unexpected' }, { ...body(), retirementId: 'bad' }])
  ('status rejects malformed commands locally (%#)', async input => {
    await expect(client().status(input)).rejects.toMatchObject(pending); expect(requests).toEqual([]);
  });
  test.each(['dropped response', 'headers timeout', 'body timeout', 'bad JSON', '403', '409', '503'])
  ('status %s remains pending, never absent or retired', async kind => {
    respond = (req, res) => {
      if (kind === 'dropped response') req.socket.destroy();
      else if (kind === 'body timeout') { res.writeHead(200); res.write('{'); }
      else if (kind === 'bad JSON') res.end('{');
      else if (kind !== 'headers timeout') { res.statusCode = Number(kind); res.end(token); }
    };
    const error = await client({ timeoutMs: 60 }).status(body()).catch(e => e);
    expect(error).toMatchObject(pending); expect(JSON.stringify(error) + error.stack).not.toContain(token);
  });
  test('status does not follow a redirect or retry it as a mutating retirement', async () => {
    respond = (_req, res) => { res.writeHead(307, { location: baseUrl + '/api/internal/completion-media-retirements' }); res.end(); };
    await expect(client().status(body())).rejects.toMatchObject(pending);
    expect(requests.map(req => req.url)).toEqual(['/api/internal/completion-media-retirements/status']);
  });
});
