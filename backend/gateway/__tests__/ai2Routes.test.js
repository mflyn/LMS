process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'synthetic-ai2-jwt-secret-at-least-32-characters';
process.env.GATEWAY_IDENTITY_SECRET = 'synthetic-ai2-envelope-at-least-32-characters';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/synthetic-ai2-gateway';
const express = require('express');
const jwt = require('jsonwebtoken');
const http = require('http');
const { gzipSync } = require('zlib');
const { randomUUID } = require('crypto');
const { createHttpTestHarness } = require('../../common/test/httpTestHarness');
const { createAi2JsonParser, createAi2Router } = require('../../services/homework-service/routes/ai2');
const { normalize } = require('../../services/homework-service/services/ai2Contract');
const { IDENTITY_HEADERS } = require('../../common/middleware/gatewayIdentity');
const { errorHandler } = require('../../common/middleware/errorHandler');
const { createApp } = require('../server');
const { request, close } = createHttpTestHarness();
const actor = 'a'.repeat(24), familyId = 'b'.repeat(24), childId = 'c'.repeat(24);
const packageId = 'd'.repeat(24), attemptId = 'e'.repeat(24), commandId = 'f'.repeat(24);
const packages = '/api/ai2/learning-packages', submitPath = `${packages}/${packageId}/attempts`;
const recoverPath = `/api/ai2/commands/${commandId}/recover`;
let app, host, calls, executions, childQueries, childTokenVersion, submitPhase;
const token = (role = 'parent', options) => jwt.sign(role === 'student'
  ? { id: childId, role, familyId, childId, tokenVersion: 7 }
  : { id: actor, role }, process.env.JWT_SECRET, options);
const command = (action = 'submit') => ({ schemaVersion: 'ai2-min-v1', operationId: randomUUID(), ...{
  submit: { expectedPackageVersion: 3, note: '12 < 30 & <synthetic>\r\n  next line', mediaIds: ['1'.repeat(24)] },
  publish: { cycleId: '2'.repeat(24), expectedCycleStateVersion: 4, artifactId: '3'.repeat(24), artifactVersion: 2,
    artifactContentHash: '4'.repeat(64), expectedArtifactReviewVersion: 2, childSnapshotHash: '5'.repeat(64), childContentConfirmed: true },
  review: { expectedPackageVersion: 3, expectedAttemptVersion: 1, attemptPayloadHash: '6'.repeat(64),
    decision: 'revise', comment: 'Check 12 < 30 & <synthetic>' },
  withdraw: { expectedPackageVersion: 3, reason: 'Synthetic <withdrawal> & reason' },
  recover: {}
}[action] });
const factory = options => createApp({ serviceHosts: { user: host, homework: host },
  jwtSecret: process.env.JWT_SECRET, identitySecret: process.env.GATEWAY_IDENTITY_SECRET, ...options });
const rawRequest = async (path, bytes, headers = {}, target = app) => {
  const base = new URL((await request(target)).get('/').url).origin;
  return new Promise((resolve, reject) => {
    const req = http.request(base + path, { method: 'POST', headers: {
      Authorization: 'Bearer ' + token('student'), 'Content-Type': 'application/json', ...headers
    } }, res => {
      const chunks = []; res.on('data', x => chunks.push(x)); res.on('error', reject);
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        try { resolve({ status: res.statusCode, headers: res.headers, body: text ? JSON.parse(text) : null }); }
        catch (error) { reject(error); }
      });
    });
    req.on('error', reject); req.setTimeout(5000, () => req.destroy(new Error('Synthetic request timeout')));
    req.end(bytes);
  });
};
beforeAll(async () => {
  const upstream = express();
  upstream.use((req, _res, next) => {
    const observed = { path: req.originalUrl, method: req.method, headers: { ...req.headers } }, chunks = [];
    calls.push(observed); req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => { observed.raw = Buffer.concat(chunks); }); next();
  });
  // Explicit boundary substitutes: no Mongo, Provider, media operations, or business state transitions.
  upstream.locals.userModel = { findOne: query => {
    childQueries.push(query);
    return { select: async () => ({ childProfile: { tokenVersion: childTokenVersion } }) };
  } };
  const actions = ['preview', 'listPackages', 'getPackage', 'listAttempts', 'getAttempt', 'listCommands', 'getCommand',
    'publish', 'withdraw', 'submit', 'review', 'recover'];
  const service = Object.fromEntries(actions.map(action => [action, async args => {
    const normalized = ['publish', 'withdraw', 'submit', 'review', 'recover'].includes(action)
      ? normalize(action, args.body) : undefined;
    executions.push({ action, args });
    return { action, identity: args.identity, body: args.body, normalized,
      ...(normalized ? { command: { id: commandId, operationId: normalized.operationId,
        endpointOperation: action === 'recover' ? 'ai2.submit' : `ai2.${action}`,
        phase: ['submit', 'recover'].includes(action) ? submitPhase : 'SUCCEEDED',
        resultReference: submitPhase === 'FAILED' ? null : { packageId, attemptId },
        failureCode: submitPhase === 'FAILED' ? 'AI2_MEDIA_UNAVAILABLE' : null },
      pending: !['SUCCEEDED', 'FAILED'].includes(submitPhase) } : {}) };
  }]));
  upstream.use('/api/ai2', createAi2JsonParser(), createAi2Router({ service }));
  upstream.use(errorHandler);
  host = new URL((await request(upstream)).get('/').url).origin; app = factory();
});
beforeEach(() => { calls = []; executions = []; childQueries = []; childTokenVersion = 7; submitPhase = 'SUCCEEDED'; });
afterAll(close);

test.each(['parent', 'student'])('AI2 %s JWT replaces forged identity and strips service credentials', async role => {
  const body = command(role === 'parent' ? 'publish' : 'submit');
  let q = (await request(app)).post(role === 'parent' ? packages : submitPath).set('Authorization', 'Bearer ' + token(role));
  for (const header of IDENTITY_HEADERS) q = q.set(header, 'synthetic-forged');
  const res = await q.set('x-service-token', 'synthetic-forged-service')
    .set('x-ai1-service-token', 'synthetic-forged-ai1').send(body);
  expect(res.status).toBe(201); expect(res.headers['cache-control']).toBe('no-store');
  expect(res.body.data.body).toEqual(body); expect(res.body.data.identity.id).toBe(role === 'parent' ? actor : childId);
  expect(res.body.data.identity.role).toBe(role); expect(calls).toHaveLength(1);
  expect(calls[0].headers['x-service-token']).toBeUndefined(); expect(calls[0].headers['x-ai1-service-token']).toBeUndefined();
  for (const header of IDENTITY_HEADERS) expect(calls[0].headers[header]).not.toBe('synthetic-forged');
  if (role === 'student') {
    expect(res.body.data.identity).toMatchObject({ familyId, childId, tokenVersion: 7 });
    expect(childQueries).toEqual([{ _id: childId, role: 'student', familyId }]);
  }
});
test('AI2 child request still reaches real signed-envelope tokenVersion validation', async () => {
  childTokenVersion = 8;
  const res = await (await request(app)).get(`${packages}/${packageId}`).set('Authorization', 'Bearer ' + token('student'));
  expect(res.status).toBe(401); expect(res.body.error.code).toBe('STALE_CHILD_TOKEN');
  expect(res.headers['cache-control']).toBe('no-store'); expect(executions).toHaveLength(0);
});
test('AI2 preserves raw whitespace, escapes, math text and CRLF before upstream normalization', async () => {
  const body = command(), raw = Buffer.from(' \n' + JSON.stringify(body).replace('next', '\\u006eext') + '\t\r\n');
  const res = await rawRequest(submitPath, raw, { 'Content-Length': raw.length });
  expect(res.status).toBe(201); expect(calls[0].raw).toEqual(raw); expect(res.body.data.body).toEqual(body);
  expect(res.body.data.normalized.note).toBe('12 < 30 & <synthetic>\n  next line');
});
test.each([[32768, false], [32769, false], [32768, true], [32769, true]])(
  'AI2 enforces %s inflated UTF8 bytes with chunked transfer and gzip=%s', async (size, compressed) => {
    const body = command(), json = JSON.stringify(body), raw = Buffer.from(json + ' '.repeat(size - Buffer.byteLength(json)));
    expect(raw.length).toBe(size);
    const res = await rawRequest(submitPath, compressed ? gzipSync(raw) : raw,
      { 'Transfer-Encoding': 'chunked', ...(compressed ? { 'Content-Encoding': 'gzip' } : {}) });
    expect(res.status).toBe(size === 32768 ? 201 : 413); expect(res.headers['cache-control']).toBe('no-store');
    if (size === 32768) {
      expect(res.body.data.body).toEqual(body); expect(calls).toHaveLength(1); expect(calls[0].raw).toEqual(raw);
      expect(calls[0].headers['content-encoding']).toBeUndefined();
    } else { expect(res.body.error.code).toBe('AI2_INPUT_TOO_LARGE'); expect(calls).toHaveLength(0); }
  });
test.each(['space', 'escape'])('AI2 counts original %s bytes rather than reserialized JSON', async kind => {
  const body = command(); body.note = 'x';
  const raw = kind === 'space' ? JSON.stringify(body) + ' '.repeat(33000)
    : JSON.stringify(body).replace('"x"', '"' + '\\u0061'.repeat(1000) + '"') + ' '.repeat(27000);
  const res = await rawRequest(submitPath, Buffer.from(raw));
  expect(res.status).toBe(413); expect(res.body.error.code).toBe('AI2_INPUT_TOO_LARGE'); expect(calls).toHaveLength(0);
});
test('AI2 rejects invalid UTF8 rather than replacing a byte inside the original note', async () => {
  const body = command(); body.note = 'BYTE_MARKER'; const parts = JSON.stringify(body).split('BYTE_MARKER');
  const raw = Buffer.concat([Buffer.from(parts[0]), Buffer.from([0xff]), Buffer.from(parts[1])]);
  const res = await rawRequest(submitPath, raw);
  expect(res.status).toBe(400); expect(res.body.error.code).toBe('VALIDATION_ERROR'); expect(calls).toHaveLength(0);
});
test('AI2 rejects UTF16 despite its smaller wire representation', async () => {
  const raw = JSON.stringify({ text: '\u6570'.repeat(10000) }) + ' '.repeat(4000), wire = Buffer.from(raw, 'utf16le');
  expect(Buffer.byteLength(raw)).toBeGreaterThan(32768); expect(wire.length).toBeLessThan(32768);
  const res = await rawRequest(submitPath, wire, { 'Content-Type': 'application/json; charset=utf-16le', 'Content-Length': wire.length });
  expect(res.status).toBe(400); expect(res.body.error.code).toBe('VALIDATION_ERROR'); expect(calls).toHaveLength(0);
});
test.each(['application/json', 'text/plain', 'application/x-www-form-urlencoded'])(
  'AI2 invalid %s fails without disclosing private body', async contentType => {
    const res = await rawRequest(submitPath, Buffer.from('{synthetic-private-invalid'), { 'Content-Type': contentType });
    expect(res.status).toBe(400); expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.headers['cache-control']).toBe('no-store'); expect(JSON.stringify(res.body)).not.toContain('synthetic-private');
    expect(calls).toHaveLength(0);
  });
test.each(['$unknown', 'unknown.field'])('AI2 preserves forbidden %s for upstream closed validation', async key => {
  const body = { ...command(), [key]: true };
  const res = await (await request(app)).post(submitPath).set('Authorization', 'Bearer ' + token('student')).send(body);
  expect(res.status).toBe(400); expect(res.body.error.code).toBe('VALIDATION_ERROR');
  expect(calls).toHaveLength(1); expect(JSON.parse(calls[0].raw.toString('utf8'))).toEqual(body); expect(executions).toHaveLength(0);
});
test.each(['missing', 'invalid', 'expired'])('AI2 malformed input does not take priority over %s JWT', async kind => {
  const res = await rawRequest(submitPath, Buffer.from('{broken'), { Authorization: kind === 'missing' ? ''
    : 'Bearer ' + (kind === 'invalid' ? 'invalid' : token('student', { expiresIn: -1 })) });
  expect(res.status).toBe(401); expect(res.headers['cache-control']).toBe('no-store'); expect(calls).toHaveLength(0);
});
test.each(['malformed', 'large', 'encoding'])('AI2 %s input still passes limiter and JWT before input error', async kind => {
  const limited = factory({ rateLimitOptions: { max: 1, windowMs: 60000 } }), results = [];
  const raw = kind === 'large' ? Buffer.from(JSON.stringify(command()) + ' '.repeat(33000))
    : kind === 'encoding' ? Buffer.from('{}', 'utf16le') : Buffer.from('{broken');
  for (let i = 0; i < 2; i++) results.push(await rawRequest(submitPath, raw, { Authorization: '',
    ...(kind === 'encoding' ? { 'Content-Type': 'application/json; charset=utf-16le' } : {}) }, limited));
  expect(results.map(r => r.status)).toEqual([401, 429]);
  expect(results[1].body.error.code).toBe('RATE_LIMITED');
  for (const res of results) expect(res.headers['cache-control']).toBe('no-store');
  expect(calls).toHaveLength(0);
});
test.each(['/api/ai20', '/api/ai2-unrelated', '/api/ai2evil', '/api/ai2%2Flearning-packages'])(
  'AI2 exact prefix does not proxy %s', async path => {
    const res = await (await request(app)).get(path).set('Authorization', 'Bearer ' + token());
    expect(res.status).toBe(404); expect(calls).toHaveLength(0);
  });
test.each(['/api/homework', '/api/ai2-unrelated'])('AI2 parser does not raise ordinary 10 KiB limit at %s', async path => {
  const res = await (await request(app)).post(path).set('Authorization', 'Bearer ' + token()).send({ text: 'x'.repeat(12000) });
  expect(res.status).toBe(413); expect(calls).toHaveLength(0);
});
test.each(['/internal/ai2/media-access-check', '/api/internal/ai2/media-access-check',
  '/api/internal/media-reference-operations', '/api/internal/ai2/media-inspect'])(
  'AI2 internal path %s is never publicly proxied even with caller credentials', async path => {
    const res = await (await request(app)).post(path).set('Authorization', 'Bearer ' + token())
      .set('x-service-token', 'synthetic-forged-service').send({});
    expect(res.status).toBe(404); expect(calls).toHaveLength(0);
  });
test.each([
  ['/api/ai2/publication-preview?cycleId=' + packageId, 'preview'],
  [packages + '?childId=' + childId + '&page=2&pageSize=20', 'listPackages'],
  [`${packages}/${packageId}`, 'getPackage'],
  [`${submitPath}?page=2&pageSize=20`, 'listAttempts'],
  [`${submitPath}/${attemptId}`, 'getAttempt'],
  [`/api/ai2/commands?childId=${childId}&scope=mine&page=2&pageSize=20`, 'listCommands'],
  [`/api/ai2/commands/${commandId}`, 'getCommand']
])('AI2 GET %s forwards original signed route', async (path, action) => {
  const res = await (await request(app)).get(path).set('Authorization', 'Bearer ' + token());
  expect(res.status).toBe(200); expect(res.headers['cache-control']).toBe('no-store');
  expect(res.body.data.action).toBe(action); expect(res.body.data.identity.id).toBe(actor);
  expect(calls).toHaveLength(1); expect(calls[0].path).toBe(path);
  if (action.startsWith('list')) expect(executions[0].args).toMatchObject({ page: 2, pageSize: 20 });
});
test.each([
  [packages, 'publish', 201], [`${packages}/${packageId}/withdraw`, 'withdraw', 200],
  [submitPath, 'submit', 201], [`${submitPath}/${attemptId}/review`, 'review', 200], [recoverPath, 'recover', 200]
])('AI2 POST %s preserves the complete versioned command', async (path, action, status) => {
  const body = command(action), role = ['submit', 'recover'].includes(action) ? 'student' : 'parent';
  const res = await (await request(app)).post(path).set('Authorization', 'Bearer ' + token(role)).send(body);
  expect(res.status).toBe(status); expect(res.headers['cache-control']).toBe('no-store');
  expect(res.body.data.body).toEqual(body); expect(res.body.data.action).toBe(action);
  expect(calls).toHaveLength(1); expect(calls[0].path).toBe(path);
});
test.each([[submitPath, 'submit', 'RESOLVING', 202], [submitPath, 'submit', 'FAILED', 200],
  [recoverPath, 'recover', 'MEDIA_PREPARED', 202], [recoverPath, 'recover', 'FAILED', 200]])(
  'AI2 %s preserves %s confirmation phase %s with status %s', async (path, action, phase, status) => {
    submitPhase = phase;
    const res = await (await request(app)).post(path).set('Authorization', 'Bearer ' + token('student')).send(command(action));
    expect(res.status).toBe(status); expect(res.body.data.command.phase).toBe(phase);
    expect(res.body.data.pending).toBe(phase !== 'FAILED'); expect(res.headers['cache-control']).toBe('no-store');
    expect(calls).toHaveLength(1);
  });
test('AI2 query sanitization cannot erase an invalid original query key', async () => {
  const path = packages + '?childId=' + childId + '&%24unknown=true';
  const res = await (await request(app)).get(path).set('Authorization', 'Bearer ' + token());
  expect(res.status).toBe(400); expect(res.body.error.code).toBe('VALIDATION_ERROR');
  expect(calls).toHaveLength(1); expect(calls[0].path).toBe(path); expect(executions).toHaveLength(0);
});
