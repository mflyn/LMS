const express = require('express');
const jwt = require('jsonwebtoken');
const { createHttpTestHarness } = require('../../common/test/httpTestHarness');
const { createApp } = require('../server');
const { request, close } = createHttpTestHarness();
let app, calls;
const token = () => jwt.sign({ id: 'a'.repeat(24), role: 'parent' }, process.env.JWT_SECRET);
beforeEach(async () => {
  calls = [];
  const upstream = express();
  upstream.use(express.raw({ type: () => true, limit: '64kb' }));
  upstream.use((req, res) => { calls.push({ headers: req.headers, path: req.originalUrl, bytes: req.body.toString() });
    res.json({ success: true }); });
  const host = new URL((await request(upstream)).get('/').url).origin;
  app = createApp({ serviceHosts: { user: host, homework: host }, jwtSecret: process.env.JWT_SECRET,
    identitySecret: process.env.GATEWAY_IDENTITY_SECRET });
});
afterEach(close);
test('AI3 preserves raw math JSON and strips all internal credentials', async () => {
  const raw = ' { "note": "12 < 30 & <synthetic>", "$unknown": true } ';
  const res = await (await request(app)).post('/api/ai3/practice-rounds').set('Authorization', 'Bearer ' + token())
    .set('Content-Type', 'application/json').set('x-ai3-evidence-token', 'synthetic-forged')
    .set('x-service-token', 'synthetic-forged').set('x-ai1-service-token', 'synthetic-forged').send(raw);
  expect(res.status).toBe(200); expect(res.headers['cache-control']).toBe('no-store');
  expect(calls).toHaveLength(1); expect(calls[0].bytes).toBe(raw);
  for (const key of ['x-ai3-evidence-token', 'x-service-token', 'x-ai1-service-token']) expect(calls[0].headers[key]).toBeUndefined();
});
test.each([32768, 32769])('AI3 exact original byte limit %s', async size => {
  const res = await (await request(app)).post('/api/ai3/practice-rounds').set('Authorization', 'Bearer ' + token())
    .set('Content-Type', 'application/json').send('{}' + ' '.repeat(size - 2));
  expect(res.status).toBe(size === 32768 ? 200 : 413);
  expect(calls).toHaveLength(size === 32768 ? 1 : 0);
  if (size > 32768) expect(res.body.error.code).toBe('AI3_INPUT_TOO_LARGE');
});
test('invalid JSON still requires JWT and never reaches upstream', async () => {
  const res = await (await request(app)).post('/api/ai3/practice-rounds').set('Content-Type', 'application/json').send('{broken');
  expect(res.status).toBe(401); expect(calls).toHaveLength(0);
});
test.each(['/api/internal/ai3/final-reviews/x', '/api/internal/ai3/mistake-review-effects',
  '/api/internal/media/ai3/inspect', '/api/ai3evil', '/api/ai3%2Fcommands'])('never publicly proxies %s', async path => {
  const res = await (await request(app)).post(path).set('Authorization', 'Bearer ' + token()).send({});
  expect(res.status).toBe(404); expect(calls).toHaveLength(0);
});
