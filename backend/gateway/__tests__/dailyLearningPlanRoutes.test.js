process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'synthetic-plan-jwt-secret-at-least-32-characters';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/synthetic-plan';
process.env.GATEWAY_IDENTITY_SECRET = process.env.GATEWAY_IDENTITY_SECRET || 'synthetic-plan-envelope-at-least-32-characters';
const express = require('express');
const jwt = require('jsonwebtoken');
const { createHttpTestHarness } = require('../../common/test/httpTestHarness');
const { authenticateGateway } = require('../../common/middleware/auth');
const { createApp } = require('../server');
const { request, close } = createHttpTestHarness();
let homework, user, app;
const token = () => jwt.sign({ id: '6656875da7f86a0012c2a201', role: 'parent' }, process.env.JWT_SECRET);
beforeAll(async () => {
  const upstream = async name => {
    const server = express(); server.use(express.json()); server.use(authenticateGateway);
    server.use((req, res) => res.json({ name, url: req.originalUrl, method: req.method, body: req.body,
      actor: req.user, credential: req.headers['x-service-token'] || null }));
    await request(server); return server;
  };
  homework = await upstream('homework'); user = await upstream('user');
  app = createApp({ serviceHosts: { user: new URL((await request(user)).get('/').url).origin,
    homework: new URL((await request(homework)).get('/').url).origin },
    jwtSecret: process.env.JWT_SECRET, identitySecret: process.env.GATEWAY_IDENTITY_SECRET });
});
afterAll(close);
test.each(['get', 'put'])('only exact daily plan route goes to homework using signed target for %s', async method => {
  const url = '/api/children/6656875da7f86a0012c2a202/daily-learning-plans/2026-10-26?probe=1';
  const r = await (await request(app))[method](url).set('Authorization', 'Bearer ' + token())
    .set('x-service-token', 'synthetic-forged-service').send({ expectedVersion: 0, items: [] });
  expect(r.status).toBe(200); expect(r.body).toMatchObject({ name: 'homework', url, method: method.toUpperCase(),
    actor: { id: '6656875da7f86a0012c2a201' }, credential: null });
});
test.each(['/api/children', '/api/children/6656875da7f86a0012c2a202',
  '/api/children/6656875da7f86a0012c2a202/pin', '/api/children/6656875da7f86a0012c2a202/daily-learning-plans',
  '/api/children/6656875da7f86a0012c2a202/daily-learning-plans/2026-10-26/extra'])('retains user-service ownership of %s', async url => {
  const r = await (await request(app)).get(url).set('Authorization', 'Bearer ' + token());
  expect(r.status).toBe(200); expect(r.body).toMatchObject({ name: 'user', url });
});
test('unauthenticated plan request never reaches upstream', async () => {
  expect((await (await request(app)).get('/api/children/6656875da7f86a0012c2a202/daily-learning-plans/2026-10-26')).status).toBe(401);
});

test.each(['/api/children/6656875da7f86a0012c2a202/pin',
  '/api/children/6656875da7f86a0012c2a202/daily-learning-plans/2026-10-26/extra'])('keeps default sanitization outside exact PUT path: %s', async url => {
  const r = await (await request(app)).put(url).set('Authorization', 'Bearer ' + token())
    .set('Content-Type', 'application/json').send('{"keep":true,"$unknown":1,"unknown.field":2}');
  expect(r.status).toBe(200);
  expect(r.body).toMatchObject({ name: 'user', body: { keep: true } });
  expect(r.body.body).toEqual({ keep: true });
});

test.each(['missing', 'invalid', 'expired'])('invalid raw daily PUT authenticates %s token before returning input errors', async kind => {
  const q = (await request(app)).put('/api/children/6656875da7f86a0012c2a202/daily-learning-plans/2026-10-26')
    .set('Content-Type', 'application/json');
  if (kind !== 'missing') q.set('Authorization', 'Bearer ' + (kind === 'invalid' ? 'invalid-token'
    : jwt.sign({ id: '6656875da7f86a0012c2a201', role: 'parent' }, process.env.JWT_SECRET, { expiresIn: -1 })));
  const r = await q.send('{"expectedVersion":0,"items":[],"$unknown":true}');
  expect(r.status).toBe(401);
  expect(r.body).toMatchObject({ success: false, error: { code: 'UNAUTHENTICATED' } });
});

test.each(['authenticated', 'missing', 'invalid'])('raw input errors consume the ordinary rate limit for %s callers', async kind => {
  const limited = createApp({ serviceHosts: { user: new URL((await request(user)).get('/').url).origin,
    homework: new URL((await request(homework)).get('/').url).origin },
    jwtSecret: process.env.JWT_SECRET, identitySecret: process.env.GATEWAY_IDENTITY_SECRET,
    rateLimitOptions: { max: 1, windowMs: 60000 } });
  const client = await request(limited), results = [];
  for (let n = 0; n < 3; n++) {
    const q = client.put('/api/children/6656875da7f86a0012c2a202/daily-learning-plans/2026-10-26')
      .set('Content-Type', 'application/json');
    if (kind !== 'missing') q.set('Authorization', 'Bearer ' + (kind === 'invalid' ? 'invalid-token' : token()));
    results.push(await q.send('{"expectedVersion":0,"items":[],"$unknown":true}'));
  }
  expect(results.map(r => r.status)).toEqual([kind === 'authenticated' ? 400 : 401, 429, 429]);
  expect(results[0].body.error.code).toBe(kind === 'authenticated' ? 'VALIDATION_ERROR' : 'UNAUTHENTICATED');
  for (const result of results) expect(result.headers['ratelimit-limit']).toBe('1');
  expect(results[1].body.error.code).toBe('RATE_LIMITED');
});
