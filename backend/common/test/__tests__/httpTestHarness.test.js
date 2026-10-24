const http = require('http');
const supertest = require('supertest');

const { createHttpTestHarness } = require('../httpTestHarness');

let harness;
beforeEach(() => { harness = createHttpTestHarness(); });
afterEach(async () => { await harness.close(); });

test('binds the listener to the same IPv4 loopback address used by Supertest', async () => {
  let localAddress;
  const client = await harness.request((req, res) => {
    localAddress = req.socket.localAddress;
    res.end('intended-app');
  });
  const response = await client.get('/probe');
  expect(response.text).toBe('intended-app');
  expect(localAddress).toBe('127.0.0.1');
});

test.each(['unauthorized', 'reset'])('reproduces wrong-destination %s with mismatched address families', async mode => {
  let intendedHits = 0;
  let otherHits = 0;
  const other = http.createServer((req, res) => {
    otherHits += 1;
    if (mode === 'reset') return req.socket.destroy();
    res.writeHead(401).end('synthetic-other-service');
  });
  const intended = http.createServer((req, res) => {
    intendedHits += 1;
    res.end('intended-app');
  });
  try {
    await new Promise((resolve, reject) => {
      other.once('error', reject);
      other.listen(0, '127.0.0.1', resolve);
    });
    await new Promise((resolve, reject) => {
      intended.once('error', reject);
      // Make the OS-dependent dual-stack hazard deterministic on Linux CI too.
      intended.listen({ port: other.address().port, host: '::', ipv6Only: true }, resolve);
    });
    const operation = supertest(intended).get('/probe');
    if (mode === 'reset') {
      await expect(operation).rejects.toMatchObject({ code: 'ECONNRESET', message: 'socket hang up' });
    } else {
      const response = await operation;
      expect(response.status).toBe(401);
      expect(response.text).toBe('synthetic-other-service');
    }
    expect(intendedHits).toBe(0);
    expect(otherHits).toBe(1);
    const client = await harness.request(intended.listeners('request')[0]);
    const response = await client.get('/probe');
    expect(response.status).toBe(200);
    expect(response.text).toBe('intended-app');
    expect(intendedHits).toBe(1);
    expect(otherHits).toBe(1);
  } finally {
    await Promise.all([intended, other].map(server => new Promise(resolve => server.close(resolve))));
  }
});

test('shares one listener for concurrent requests and closes it before reuse', async () => {
  const app = (req, res) => res.end('ok');
  const [first, second] = await Promise.all([harness.request(app), harness.request(app)]);
  const a = first.get('/a');
  const b = second.get('/b');
  expect(a.app).toBe(b.app);
  expect(a.app.address()).toMatchObject({ address: '127.0.0.1', family: 'IPv4' });
  expect(a._server).toBeUndefined();
  await Promise.all([a, b]);
  await harness.close();
  expect(a.app.address()).toBeNull();
  const third = (await harness.request(app)).get('/c');
  expect(third.app).not.toBe(a.app);
  expect((await third).status).toBe(200);
});

test.each(['unauthorized', 'reset'])('does not hide or retry an actual target %s', async mode => {
  let hits = 0;
  const client = await harness.request((req, res) => {
    hits += 1;
    if (mode === 'reset') return req.socket.destroy();
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: { code: 'INVALID_IDENTITY_ENVELOPE' } }));
  });
  const operation = client.get('/protected');
  if (mode === 'reset') {
    await expect(operation).rejects.toMatchObject({ code: 'ECONNRESET' });
  } else {
    const response = await operation;
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_IDENTITY_ENVELOPE');
  }
  expect(hits).toBe(1);
  await harness.close();
  expect(operation.app.address()).toBeNull();
});

test('closes every app variant and allows repeated teardown', async () => {
  const operations = await Promise.all([201, 403].map(async status => {
    const client = await harness.request((req, res) => res.writeHead(status).end());
    const operation = client.get('/');
    expect((await operation).status).toBe(status);
    return { server: operation.app };
  }));
  await harness.close();
  await harness.close();
  expect(operations.map(({ server }) => server.address())).toEqual([null, null]);
});

test('surfaces a listen failure and removes the failed cache entry', async () => {
  const app = (req, res) => res.end('ok');
  const listen = jest.spyOn(http.Server.prototype, 'listen').mockImplementationOnce(function () {
    process.nextTick(() => this.emit('error', Object.assign(new Error('synthetic bind failure'), { code: 'EADDRINUSE' })));
    return this;
  });
  try {
    await expect(harness.request(app)).rejects.toMatchObject({ code: 'EADDRINUSE' });
  } finally {
    listen.mockRestore();
  }
  expect((await (await harness.request(app)).get('/')).status).toBe(200);
});

test('closes successful listeners even when teardown overlaps another listen failure', async () => {
  const first = await harness.request((req, res) => res.end('ok'));
  const server = first.get('/probe').app;
  const listen = jest.spyOn(http.Server.prototype, 'listen').mockImplementationOnce(function () {
    process.nextTick(() => this.emit('error', Object.assign(new Error('synthetic bind failure'), { code: 'EADDRINUSE' })));
    return this;
  });
  try {
    const starting = harness.request((req, res) => res.end('other')).catch(error => error.code);
    const closing = harness.close().catch(error => error.code);
    expect(await starting).toBe('EADDRINUSE');
    expect(await closing).toBe('EADDRINUSE');
    expect(server.listening).toBe(false);
    await harness.close();
    expect(server.address()).toBeNull();
  } finally {
    listen.mockRestore();
    // Keep the failing (pre-fix) regression from leaking its listener as well.
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
});
