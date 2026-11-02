process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'synthetic-ai1-jwt-secret-at-least-32-characters';
process.env.GATEWAY_IDENTITY_SECRET = 'synthetic-ai1-envelope-at-least-32-characters';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/synthetic-ai1';
const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const http = require('http');
const { gzipSync } = require('zlib');
const { randomUUID } = require('crypto');
const { createHttpTestHarness } = require('../../common/test/httpTestHarness');
const { createAi1Router, createAi1JsonParser } = require('../../services/homework-service/routes/ai1');
const { normalize } = require('../../services/homework-service/services/ai1Contract');
const { errorHandler } = require('../../common/middleware/errorHandler');
const { createApp } = require('../server');
const { request, close } = createHttpTestHarness();
const actor = 'a'.repeat(24), childId = 'c'.repeat(24), cycleId = 'd'.repeat(24);
let app, host, calls;
const token = () => jwt.sign({ id: actor, role: 'parent' }, process.env.JWT_SECRET);
const body = () => ({ schemaVersion: 'ai1-min-v1', operationId: randomUUID(), childId,
  source: { type: 'task', id: 'e'.repeat(24) }, input: { questionText: '12 < 30 & 30 > 12', answerText: null, parentContext: '' },
  chapter: { provenance: 'parent_declared', subject: 'math', grade: 4, term: 'upper', textbookLabel: 'Synthetic',
    chapterLabel: '\u591a\u4f4d\u6570\u4e58\u4e24\u4f4d\u6570' }, deidentifiedConfirmed: true });
const factory = options => createApp({ serviceHosts: { user: host, homework: host }, jwtSecret: process.env.JWT_SECRET,
  identitySecret: process.env.GATEWAY_IDENTITY_SECRET, ...options });
const rawRequest = async (path, bytes, headers = {}, target = app) => {
  const base = new URL((await request(target)).get('/').url).origin;
  return new Promise((resolve, reject) => {
    const req = http.request(base + path, { method: 'POST', headers: { Authorization: 'Bearer ' + token(),
      'Content-Type': 'application/json', ...headers } }, res => {
      const chunks = []; res.on('data', x => chunks.push(x)); res.on('error', reject);
      res.on('end', () => { const text = Buffer.concat(chunks).toString('utf8');
        try { resolve({ status: res.statusCode, text, body: text ? JSON.parse(text) : null }); }
        catch (error) { reject(error); } });
    });
    req.on('error', reject); req.setTimeout(5000, () => req.destroy(new Error('synthetic timeout')));
    req.write(bytes); req.end();
  });
};
beforeAll(async () => {
  const upstream = express(); upstream.use((req, _res, next) => { calls.push({ path: req.originalUrl,
    dedicated: req.headers['x-ai1-service-token'], forged: req.headers['x-user-id'] }); next(); });
  upstream.use(createAi1JsonParser());
  const service = Object.fromEntries(['listCycles', 'getCycle', 'listJobs', 'getJob', 'getArtifact', 'recover', 'close', 'review', 'revise', 'generateAndRun']
    .map(action => [action, async args => ({ action, identity: args.identity, body: args.body,
      ...(action === 'recover' ? { job: { status: 'unknown' } } : {}) })]));
  service.create = async args => ({ identity: args.identity, body: normalize('create', args.body) });
  upstream.use('/api', createAi1Router({ service })); upstream.use(errorHandler);
  host = new URL((await request(upstream)).get('/').url).origin; app = factory();
});
beforeEach(() => { calls = []; });
afterAll(close);

test('AI1 formal Gateway preserves original text and strips caller service credentials', async () => {
  const command = body();
  const res = await (await request(app)).post('/api/tutor-cycles').set('Authorization', 'Bearer ' + token())
    .set('x-user-id', 'f'.repeat(24)).set('x-ai1-service-token', 'synthetic-forged-dedicated-credential').send(command);
  expect(res.status).toBe(201); expect(res.body.data.body).toEqual(command);
  expect(res.body.data.identity.id).toBe(actor); expect(calls).toHaveLength(1);
  expect(calls[0].dedicated).toBeUndefined();
});
test('AI1 permits a valid original JSON body above 10 KiB but under 32 KiB', async () => {
  const command = body(); command.input.questionText = '\u6570'.repeat(4000); command.input.answerText = '\u6570'.repeat(4000);
  expect(Buffer.byteLength(JSON.stringify(command))).toBeGreaterThan(10240);
  const res = await (await request(app)).post('/api/tutor-cycles').set('Authorization', 'Bearer ' + token()).send(command);
  expect(res.status).toBe(201); expect(res.body.data.body).toEqual(command);
});
test.each([false, true])('AI1 chunked JSON preserves framing and original byte limit (large=%s)', async large => {
  const command = body(), raw = JSON.stringify(command) + (large ? ' '.repeat(33000) : '');
  const response = await rawRequest('/api/tutor-cycles', Buffer.from(raw), { 'Transfer-Encoding': 'chunked' });
  if (large) { expect(response.status).toBe(413); expect(calls).toHaveLength(0); }
  else { expect(response.status).toBe(201); expect(response.body.data.body).toEqual(command); expect(calls).toHaveLength(1); }
});
test.each([[32768, false], [32769, false], [32768, true], [32769, true]])(
  'AI1 exact %s byte boundary with chunked transfer and gzip=%s', async (size, compressed) => {
    const command = body(), json = JSON.stringify(command), raw = json + ' '.repeat(size - Buffer.byteLength(json));
    expect(Buffer.byteLength(raw)).toBe(size);
    const response = await rawRequest('/api/tutor-cycles', compressed ? gzipSync(raw) : Buffer.from(raw),
      { 'Transfer-Encoding': 'chunked', ...(compressed ? { 'Content-Encoding': 'gzip' } : {}) });
    expect(response.status).toBe(size === 32768 ? 201 : 413);
    if (size === 32768) { expect(response.body.data.body).toEqual(command); expect(calls).toHaveLength(1); }
    else { expect(response.body.error.code).toBe('AI_INPUT_TOO_LARGE'); expect(calls).toHaveLength(0); }
  });
test('AI1 encoding failures cannot bypass identity or rate-limit rejection', async () => {
  const limited = factory({ rateLimitOptions: { max: 1, windowMs: 60000 } });
  const statuses = [];
  for (let i = 0; i < 2; i++) {
    const response = await rawRequest('/api/tutor-cycles', Buffer.from('{"x":"\u6570"}', 'utf16le'),
      { Authorization: '', 'Content-Type': 'application/json; charset=utf-16le' }, limited);
    statuses.push(response.status);
  }
  expect(statuses).toEqual([401, 429]); expect(calls).toHaveLength(0);
});
test('AI1 UTF16 cannot bypass the original UTF8 JSON byte ceiling', async () => {
  const command = { text: '\u6570'.repeat(10000) }, raw = JSON.stringify(command) + ' '.repeat(4000);
  const wire = Buffer.from(raw, 'utf16le');
  expect(Buffer.byteLength(raw, 'utf8')).toBeGreaterThan(32768); expect(wire.length).toBeLessThan(32768);
  const response = await rawRequest('/api/tutor-cycles/' + cycleId + '/explanation-revisions', wire,
    { 'Content-Type': 'application/json; charset=utf-16le', 'Content-Length': wire.length });
  expect(response.status).toBe(400); expect(response.body.error.code).toBe('VALIDATION_ERROR'); expect(calls).toHaveLength(0);
});
test('AI1 invalid UTF8 cannot be silently replaced in the original command', async () => {
  const raw = JSON.stringify(body()).replace('12 < 30 & 30 > 12', 'BYTE_MARKER').split('BYTE_MARKER');
  const bytes = Buffer.concat([Buffer.from(raw[0]), Buffer.from([0xff]), Buffer.from(raw[1])]);
  const response = await rawRequest('/api/tutor-cycles', bytes, { 'Content-Length': bytes.length });
  expect(response.status).toBe(400); expect(response.body.error.code).toBe('VALIDATION_ERROR'); expect(calls).toHaveLength(0);
});
test.each([false, true])('AI1 compressed original JSON retains text and enforces inflated size (large=%s)', async large => {
  const command = body(), raw = JSON.stringify(command) + (large ? ' '.repeat(33000) : '');
  const base = new URL((await request(app)).get('/').url).origin;
  const result = await axios.post(base + '/api/tutor-cycles', gzipSync(raw), {
    proxy: false, maxRedirects: 0, timeout: 5000, validateStatus: () => true,
    headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' }
  });
  expect(result.headers['cache-control']).toBe('no-store');
  if (large) { expect(result.status).toBe(413); expect(calls).toHaveLength(0); }
  else { expect(result.status).toBe(201); expect(result.data.data.body).toEqual(command); expect(calls).toHaveLength(1); }
});
test.each(['application/json', 'text/plain', 'application/x-www-form-urlencoded'])(
  'AI1 invalid %s input fails safely after authentication', async contentType => {
    const response = await (await request(app)).post('/api/tutor-cycles').set('Authorization', 'Bearer ' + token())
      .set('Content-Type', contentType).send('{synthetic-private-invalid');
    expect(response.status).toBe(400); expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(response.body)).not.toContain('synthetic-private'); expect(calls).toHaveLength(0);
  });
test('AI1 narrow body parser does not raise the ordinary route limit or claim similar prefixes', async () => {
  for (const path of ['/api/homework', '/api/tutor-cycles-unrelated']) {
    const response = await (await request(app)).post(path).set('Authorization', 'Bearer ' + token())
      .send({ text: 'x'.repeat(12000) });
    expect(response.status).toBe(413); expect(calls).toHaveLength(0);
  }
});
test.each(['$unknown', 'unknown.field'])('AI1 cannot erase invalid raw key %s before upstream validation', async key => {
  const res = await (await request(app)).post('/api/tutor-cycles').set('Authorization', 'Bearer ' + token()).send({ ...body(), [key]: true });
  expect(res.status).toBe(400); expect(res.body.error.code).toBe('VALIDATION_ERROR');
});
test.each(['space', 'escape'])('AI1 original %s bytes over 32 KiB are rejected before upstream', async kind => {
  const command = body(); command.input.questionText = 'x';
  const raw = kind === 'space' ? JSON.stringify(command) + ' '.repeat(33000)
    : JSON.stringify(command).replace('"x"', '"' + '\\u0061'.repeat(4000) + '"') + ' '.repeat(10000);
  const res = await (await request(app)).post('/api/tutor-cycles').set('Authorization', 'Bearer ' + token())
    .set('Content-Type', 'application/json').send(raw);
  expect(res.status).toBe(413); expect(res.body.error.code).toBe('AI_INPUT_TOO_LARGE'); expect(calls).toHaveLength(0);
});
test.each([['get', '/api/tutor-cycles?childId=' + childId], ['get', '/api/tutor-cycles/' + cycleId],
  ['get', '/api/tutor-jobs?childId=' + childId + '&scope=mine-unfinished'], ['get', '/api/tutor-jobs/' + cycleId],
  ['get', '/api/tutor-artifacts/' + cycleId], ['post', '/api/tutor-cycles/' + cycleId + '/cancel']])(
  'AI1 %s %s uses the signed homework route', async (method, route) => {
    const res = await (await request(app))[method](route).set('Authorization', 'Bearer ' + token()).send(method === 'post' ? {} : undefined);
    expect(res.status).toBe(200); expect(res.body.data.identity.id).toBe(actor); expect(calls[0].path).toBe(route);
  });
test.each([['/api/tutor-cycles/' + cycleId + '/explanation-jobs', 202],
  ['/api/tutor-cycles/' + cycleId + '/explanation-revisions', 201],
  ['/api/tutor-cycles/' + cycleId + '/explanation-review', 200], ['/api/tutor-jobs/' + cycleId + '/recover', 202]])(
  'AI1 write %s preserves the full command through the signed route', async (path, status) => {
    const command = { operationId: randomUUID(), text: '<synthetic> & original' };
    const response = await (await request(app)).post(path).set('Authorization', 'Bearer ' + token()).send(command);
    expect(response.status).toBe(status); expect(response.body.data.body).toEqual(command);
    expect(response.body.data.identity.id).toBe(actor); expect(calls).toHaveLength(1); expect(calls[0].path).toBe(path);
  });
test.each(['missing', 'invalid', 'expired'])('AI1 malformed input authenticates %s identity before returning parse error', async kind => {
  const q = (await request(app)).post('/api/tutor-cycles').set('Content-Type', 'application/json');
  if (kind !== 'missing') q.set('Authorization', 'Bearer ' + (kind === 'invalid' ? 'invalid' : jwt.sign({ id: actor, role: 'parent' }, process.env.JWT_SECRET, { expiresIn: -1 })));
  const res = await q.send('{broken'); expect(res.status).toBe(401); expect(calls).toHaveLength(0);
});
test('AI1 malformed input still consumes the ordinary request rate limit', async () => {
  const limited = await request(factory({ rateLimitOptions: { max: 1, windowMs: 60000 } }));
  const responses = [];
  for (let i = 0; i < 2; i++) responses.push(await limited.post('/api/tutor-cycles').set('Content-Type', 'application/json').send('{broken'));
  expect(responses.map(r => r.status)).toEqual([401, 429]); expect(calls).toHaveLength(0);
});
test.each(['/internal/deeptutor/operations/' + cycleId, '/api/internal/deeptutor/operations/' + cycleId])(
  'AI1 internal operation %s is never publicly proxied', async route => {
    const res = await (await request(app)).get(route).set('Authorization', 'Bearer ' + token());
    expect(res.status).toBe(404); expect(calls).toHaveLength(0);
  });
