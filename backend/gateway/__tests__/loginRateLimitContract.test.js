const { createHttpTestHarness } = require('../../common/test/httpTestHarness');
const { request, close } = createHttpTestHarness();
const createBaseApp = require('../../common/createBaseApp');
const config = require('../config');
const { configManager } = require('../../common/config');

afterEach(close);

const expected = { success: false, error: {
  code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试'
} };

test('configured gateway general quota still rejects request 101 with structured 429 and headers', async () => {
  expect(config.rateLimitOptions).toMatchObject({ windowMs: 900000, max: 100 });
  const { createApp } = require('../server');
  const app = createApp();
  expect(app.get('trust proxy')).toBe(false);
  const client = await request(app);
  for (let i = 0; i < 100; i++) await client.get('/health').expect(200);
  const response = await client.post('/api/auth/login').send({});
  expect(response.status).toBe(429);
  expect(response.type).toBe('application/json');
  expect(response.body).toEqual(expected);
  expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
  expect(Number(response.headers['retry-after'])).toBeLessThanOrEqual(900);
  expect(response.headers['ratelimit-limit']).toBe('100');
  expect(response.headers['ratelimit-remaining']).toBe('0');
});

test('configured sensitive quota counts successful requests and rejects request 21', async () => {
  const options = configManager.get('SENSITIVE_RATE_LIMIT_CONFIG');
  expect(options).toMatchObject({ windowMs: 900000, max: 20, skipSuccessfulRequests: false });
  const app = createBaseApp({ rateLimitOptions: config.rateLimitOptions, sensitiveRateLimitOptions: options });
  const handled = jest.fn((_req, res) => res.json({ success: true }));
  app.post('/api/auth/login', app.get('sensitiveLimiter'), handled);
  const client = await request(app);
  for (let i = 0; i < 20; i++) await client.post('/api/auth/login').send({}).expect(200);
  const response = await client.post('/api/auth/login').send({});
  expect(response.status).toBe(429);
  expect(response.body).toEqual(expected);
  expect(response.headers['ratelimit-limit']).toBe('20');
  expect(response.headers['retry-after']).toBeDefined();
  expect(handled).toHaveBeenCalledTimes(20);
});

test('same peer business and login requests share quota; forged forwarding headers cannot create another bucket', async () => {
  const app = createBaseApp({ rateLimitOptions: config.rateLimitOptions });
  expect(app.get('trust proxy')).toBe(false);
  const peers = [];
  const login = jest.fn((_req, res) => res.json({ success: true }));
  app.get('/api/synthetic', (req, res) => { peers.push(req.ip); res.json({ success: true }); });
  app.post('/api/auth/login', login);
  const client = await request(app);
  // The first direct request establishes the default peer key. Later header changes must not change it.
  await client.get('/api/synthetic').expect(200);
  for (let i = 1; i < 100; i++) {
    await client.get('/api/synthetic').set('X-Forwarded-For', `192.0.2.${i}`)
      .set('X-Real-IP', `198.51.100.${i}`).expect(200);
  }
  expect(new Set(peers).size).toBe(1);
  expect(peers[0]).toBe('127.0.0.1');
  const response = await client.post('/api/auth/login').set('X-Forwarded-For', '203.0.113.1').send({});
  expect(response.status).toBe(429);
  expect(login).not.toHaveBeenCalled();
  expect(response.headers['ratelimit-remaining']).toBe('0');
});

test('a successful task PATCH at the shared quota boundary can precede a throttled login', async () => {
  const app = createBaseApp({ rateLimitOptions: config.rateLimitOptions });
  let edits = 0, logins = 0;
  app.get('/api/synthetic', (_req, res) => res.json({ success: true }));
  // Synthetic handlers isolate the middleware budget; this is not a production task-write attribution.
  app.patch('/api/growth-tasks/synthetic-task', (_req, res) => { edits++; res.json({ success: true }); });
  app.post('/api/auth/login', (_req, res) => { logins++; res.json({ success: true }); });
  const client = await request(app);
  for (let i = 0; i < 99; i++) await client.get('/api/synthetic').expect(200);
  await client.patch('/api/growth-tasks/synthetic-task').send({ title: 'Updated' }).expect(200);
  const result = await client.post('/api/auth/login').send({});
  expect(result.status).toBe(429);
  expect(result.body).toEqual(expected);
  expect(edits).toBe(1);
  expect(logins).toBe(0);
});
