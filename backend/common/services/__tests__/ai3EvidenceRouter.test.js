const express = require('express');
const http = require('http');
const { gzipSync } = require('zlib');
const { createAi3EvidenceRouter } = require('../../routes/ai3EvidenceRouter');

const token = 'synthetic-ai3-evidence-token-at-least-32-characters';
const id = n => String(n).padStart(24, '0');
const effectId = '00000000-0000-4000-8000-000000000001';
const scope = { familyId: id(1), childId: id(2), actorId: id(3) };
const body = { schemaVersion: 'ai3-review-effect-v1', effectId, finalReviewId: id(4),
  finalReviewHash: 'a'.repeat(64), familyId: scope.familyId, childId: scope.childId,
  reviewedByParentId: scope.actorId, targetId: id(5), expectedStateRevision: 0 };
const prefix = '/api/internal/ai3';
const urls = {
  mistake: { context: `/mistakes/${id(5)}/review-context`, effects: '/mistake-review-effects' },
  mastery: { context: `/knowledge-points/${id(5)}/review-context`, effects: '/mastery-effects' }
};
const query = input => '?' + new URLSearchParams(input).toString();
const servers = [];
let service, continuity, escaped;
beforeEach(() => {
  service = { getContext: jest.fn(async () => ({ id: id(5), stateRevision: 0, knowledgePointId: null })),
    apply: jest.fn(async () => ({ effectId, status: 'applied' })),
    getReceipt: jest.fn(async () => ({ effectId, status: 'not_applied_conflict' })),
    getFinalReview: jest.fn(async () => ({ finalReview: { id: id(4) }, finalReviewHash: 'a'.repeat(64),
      effect: { kind: 'mistake', effectId, targetId: id(5), expectedStateRevision: 0 } })) };
  continuity = jest.fn(async () => {});
  escaped = jest.fn();
});
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  })));
});
const calls = () => Object.values(service).reduce((sum, fn) => sum + fn.mock.calls.length, 0);
async function start(options = {}, preparsed = false) {
  expect(typeof createAi3EvidenceRouter).toBe('function');
  const app = express();
  if (preparsed) app.use(express.json());
  app.use(prefix, createAi3EvidenceRouter({ kind: 'mistake', serviceToken: token, service,
    assertContinuous: continuity, ...options }));
  app.use((error, req, res, next) => {
    escaped(error); res.status(599).json({ leaked: error.message });
  });
  const server = http.createServer(app);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  servers.push(server);
  return server;
}
function request(server, pathname, { method = 'GET', payload, headers = {} } = {}) {
  const bytes = payload === undefined ? null : Buffer.isBuffer(payload) ? payload
    : Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload));
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: prefix + pathname, method,
      headers: { 'x-ai3-evidence-token': token,
        ...(bytes ? { 'content-type': 'application/json', 'content-length': bytes.length } : {}), ...headers } }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('error', reject);
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let data; try { data = JSON.parse(text); } catch (_) { data = text; }
        resolve({ status: res.statusCode, headers: res.headers, data, text });
      });
    });
    req.on('error', reject); req.end(bytes);
  });
}
function denied(response, status, code) {
  expect(response.status).toBe(status);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.data).toEqual({ success: false, error: { code, message: code, details: [] } });
  expect(escaped).not.toHaveBeenCalled();
}

test.each(['mistake', 'mastery'])('%s routes preserve explicit scope and raw DTO envelopes', async kind => {
  const server = await start({ kind });
  const other = { familyId: id(11), childId: id(12), actorId: id(13) };
  const response = await request(server, urls[kind].context + query(other));
  expect(response.status).toBe(200); expect(response.headers['cache-control']).toBe('no-store');
  expect(response.data).toEqual({ success: true, data: { id: id(5), stateRevision: 0, knowledgePointId: null } });
  expect(service.getContext).toHaveBeenCalledWith({ ...other, targetId: id(5) });
  const applied = await request(server, urls[kind].effects, { method: 'POST', payload: body });
  expect(applied.data).toEqual({ success: true, data: { effectId, status: 'applied' } });
  expect(service.apply).toHaveBeenCalledWith({ body });
  const receipt = await request(server, `${urls[kind].effects}/${effectId}` + query(other));
  expect(receipt.data).toEqual({ success: true, data: { effectId, status: 'not_applied_conflict' } });
  expect(service.getReceipt).toHaveBeenCalledWith({ ...other, effectId });
  expect(calls()).toBe(3); expect(continuity).toHaveBeenCalledTimes(6);
});
test('proof exposes only final-review lookup and preserves exact effect scope', async () => {
  const server = await start({ kind: 'proof' });
  const input = { familyId: id(11), childId: id(12), effectId };
  const response = await request(server, `/final-reviews/${id(4)}` + query(input));
  expect(response.status).toBe(200);
  expect(response.data).toEqual({ success: true, data: { finalReview: { id: id(4) }, finalReviewHash: 'a'.repeat(64),
    effect: { kind: 'mistake', effectId, targetId: id(5), expectedStateRevision: 0 } } });
  expect(service.getFinalReview).toHaveBeenCalledWith({ ...input, finalReviewId: id(4) });
  denied(await request(server, urls.mistake.effects, { method: 'POST', payload: body }), 404, 'RESOURCE_NOT_FOUND');
  expect(calls()).toBe(1);
});
test.each(['', 'wrong', [token, token]])('invalid or repeated credential is rejected before parsing: %s', async supplied => {
  const server = await start();
  const response = await request(server, urls.mistake.effects, { method: 'POST', payload: Buffer.alloc(32769, 0xff),
    headers: { 'x-ai3-evidence-token': supplied, 'x-service-token': token, 'x-ai1-service-token': token } });
  denied(response, 401, 'INVALID_SERVICE_CREDENTIAL'); expect(calls()).toBe(0);
  expect(continuity).not.toHaveBeenCalled();
});
test('factory rejects short credentials, unknown kinds and missing required service methods', () => {
  expect(typeof createAi3EvidenceRouter).toBe('function');
  for (const delta of [{ serviceToken: 'x'.repeat(31) }, { kind: 'other' }, { service: {} },
    { assertContinuous: null }, { serviceToken: token + '\n' }]) {
    expect(() => createAi3EvidenceRouter({ kind: 'mistake', serviceToken: token, service, ...delta })).toThrow();
  }
});
test.each(['mistake', 'mastery', 'proof'])('%s factory defaults to continuity denial', async kind => {
  const server = await start({ kind, assertContinuous: undefined });
  const pathname = kind === 'proof' ? `/final-reviews/${id(4)}` + query({ familyId: id(1), childId: id(2), effectId })
    : urls[kind].context + query(scope);
  denied(await request(server, pathname), 503, 'AI3_NOT_READY'); expect(calls()).toBe(0);
});
test.each([Buffer.from([0xff]), Buffer.from('{'), Buffer.from('{"x":"\xc0\xaf"}', 'latin1')])(
  'raw parser rejects malformed JSON or UTF8 without invoking apply: %s', async payload => {
    const server = await start();
    denied(await request(server, urls.mistake.effects, { method: 'POST', payload }), 400, 'VALIDATION_ERROR');
    expect(calls()).toBe(0);
  });
test('raw 32KiB boundary is exact, including whitespace and inflated bytes', async () => {
  const server = await start(), json = JSON.stringify(body);
  const at = Buffer.from(json + ' '.repeat(32768 - Buffer.byteLength(json)));
  expect((await request(server, urls.mistake.effects, { method: 'POST', payload: at })).status).toBe(200);
  for (const compressed of [false, true]) {
    const over = Buffer.concat([at, Buffer.from(' ')]);
    denied(await request(server, urls.mistake.effects, { method: 'POST', payload: compressed ? gzipSync(over) : over,
      headers: compressed ? { 'content-encoding': 'gzip' } : {} }), 413, 'AI3_INPUT_TOO_LARGE');
  }
  expect(service.apply).toHaveBeenCalledTimes(1);
});
test.each([null, [], {}, { ...body, masteryLevel: 'skilled' }, { ...body, reviewReminderDate: '2026-11-05' },
  { ...body, expectedStateRevision: -1 }, { ...body, expectedStateRevision: 0.5 },
  { ...body, familyId: id(1).toUpperCase() + 'f' }, { ...body, finalReviewHash: 'no' },
  { ...body, effectId: '00000000-0000-1000-8000-000000000001' }])('apply rejects non-contract body %j', async payload => {
  const server = await start();
  denied(await request(server, urls.mistake.effects, { method: 'POST', payload }), 400, 'VALIDATION_ERROR');
  expect(calls()).toBe(0);
});
test.each(['', query({ familyId: id(1), childId: id(2) }), query({ ...scope, extra: 'x' }),
  query(scope) + '&familyId=' + id(9), query(scope) + '&__proto__[x]=1',
  query(scope) + '&actorId[x]=1', query({ ...scope, actorId: 'invalid' })])('context query is closed and scalar: %s', async suffix => {
  const server = await start();
  denied(await request(server, urls.mistake.context + suffix), 400, 'VALIDATION_ERROR'); expect(calls()).toBe(0);
});
test('proof query rejects actorId and receipt query rejects injected target/hash', async () => {
  const proof = await start({ kind: 'proof' }), consumer = await start();
  denied(await request(proof, `/final-reviews/${id(4)}` + query({ ...scope, effectId })), 400, 'VALIDATION_ERROR');
  denied(await request(consumer, `${urls.mistake.effects}/${effectId}` + query({ ...scope, targetId: id(5) })), 400, 'VALIDATION_ERROR');
  denied(await request(consumer, '/mistakes/invalid/review-context' + query(scope)), 400, 'VALIDATION_ERROR');
  expect(calls()).toBe(0);
});
test('GET bodies and POST queries are rejected, not silently discarded', async () => {
  const server = await start();
  denied(await request(server, urls.mistake.context + query(scope), { payload: {} }), 400, 'VALIDATION_ERROR');
  denied(await request(server, urls.mistake.effects + '?extra=x', { method: 'POST', payload: body }), 400, 'VALIDATION_ERROR');
  expect(calls()).toBe(0);
});
test('preparsed bodies and unsupported content types cannot bypass raw verification', async () => {
  const parsed = await start({}, true), raw = await start();
  denied(await request(parsed, urls.mistake.effects, { method: 'POST', payload: body }), 503, 'AI3_NOT_READY');
  denied(await request(raw, urls.mistake.effects, { method: 'POST', payload: body,
    headers: { 'content-type': 'text/plain' } }), 400, 'VALIDATION_ERROR');
  denied(await request(raw, urls.mistake.effects, { method: 'POST' }), 400, 'VALIDATION_ERROR');
  expect(calls()).toBe(0);
});
test.each([[401, 'INVALID_SERVICE_CREDENTIAL'], [403, 'CHILD_ACCESS_DENIED'], [404, 'RESOURCE_NOT_FOUND'],
  [409, 'AI3_EFFECT_CONFLICT'], [413, 'AI3_INPUT_TOO_LARGE'], [503, 'AI3_NOT_READY'], [503, 'AI3_EVIDENCE_UNAVAILABLE']])(
  'known service failure %s/%s is returned without private details', async (statusCode, code) => {
    const server = await start();
    service.getContext.mockRejectedValueOnce(Object.assign(new Error('private-child ' + token),
      { statusCode, code, details: ['private-answer'], config: { token } }));
    const response = await request(server, urls.mistake.context + query(scope));
    denied(response, statusCode, code); expect(response.text).not.toContain(token);
    expect(response.text).not.toContain('private');
  });
test.each([new Error('private secret'), Object.assign(new Error('private'), { statusCode: 200, code: 'CHILD_ACCESS_DENIED' }),
  Object.assign(new Error('private'), { statusCode: 500, code: 'DATABASE_PASSWORD' })])('unknown failures fail closed without reaching host logger', async error => {
  const server = await start(); service.apply.mockRejectedValueOnce(error);
  denied(await request(server, urls.mistake.effects, { method: 'POST', payload: body }), 503, 'AI3_EVIDENCE_UNAVAILABLE');
});
test('a scope denial is preserved and cannot be replaced by a request header identity', async () => {
  const server = await start();
  service.getContext.mockImplementationOnce(async input => {
    expect(input).toEqual({ ...scope, familyId: id(99), targetId: id(5) });
    throw Object.assign(new Error('denied'), { statusCode: 403, code: 'CHILD_ACCESS_DENIED' });
  });
  denied(await request(server, urls.mistake.context + query({ ...scope, familyId: id(99) }),
    { headers: { 'x-family-id': scope.familyId, 'x-user-id': scope.actorId } }), 403, 'CHILD_ACCESS_DENIED');
});
test('continuity revoked during service await denies the original response', async () => {
  let enabled = true;
  const server = await start({ assertContinuous: async () => {
    if (!enabled) throw Object.assign(new Error('private'), { statusCode: 503, code: 'AI3_NOT_READY' });
  } });
  service.getContext.mockImplementationOnce(async () => { enabled = false; return { id: id(5), stateRevision: 0 }; });
  denied(await request(server, urls.mistake.context + query(scope)), 503, 'AI3_NOT_READY');
  expect(calls()).toBe(1);
});
test('oversized or unserializable service DTOs fail without partial success', async () => {
  const server = await start();
  for (const value of [{ oversized: 'x'.repeat(32768) }, undefined, { value: 1n }]) {
    service.getContext.mockResolvedValueOnce(value);
    denied(await request(server, urls.mistake.context + query(scope)), 503, 'AI3_EVIDENCE_UNAVAILABLE');
  }
});
test.each([['GET', '/unknown'], ['POST', '/mastery-effects'], ['GET', '/final-reviews/' + id(4)],
  ['POST', '/mistakes/' + id(5) + '/review-context'], ['GET', '/mistakes/' + id(5) + '/review-context/'],
  ['GET', '/Mistakes/' + id(5) + '/review-context'], ['PUT', '/mistake-review-effects']])(
  'unregistered route %s %s is a closed 404', async (method, pathname) => {
    const server = await start();
    denied(await request(server, pathname, { method }), 404, 'RESOURCE_NOT_FOUND'); expect(calls()).toBe(0);
  });

test('HEAD is not an implicit context read and a 32-character credential is sufficient', async () => {
  const short = 's'.repeat(32), server = await start({ serviceToken: short });
  const headers = { 'x-ai3-evidence-token': short };
  const head = await request(server, urls.mistake.context + query(scope), { method: 'HEAD', headers });
  expect(head.status).toBe(404); expect(head.headers['cache-control']).toBe('no-store'); expect(calls()).toBe(0);
  expect((await request(server, urls.mistake.context + query(scope), { headers })).status).toBe(200);
});
test('real evidence client consumes each kind through loopback HTTP without envelope translation', async () => {
  const { createAi3EvidenceClient } = require('../ai3EvidenceClient');
  const C = require('../ai3ReviewEvidence');
  const finalReview = { schemaVersion: 'ai3-final-review-v1', id: id(4), familyId: scope.familyId, childId: scope.childId,
    roundId: id(6), sourcePackageId: id(7), sourceAttemptId: id(8), sourceAttemptVersion: 1,
    sourceAttemptPayloadHash: 'a'.repeat(64), sourceReviewHash: 'b'.repeat(64), source: { type: 'mistake', id: id(5) },
    contentId: id(9), contentVersion: 1, contentHash: 'c'.repeat(64), childSnapshotHash: 'd'.repeat(64),
    attemptId: id(10), attemptVersion: 1, attemptPayloadHash: 'e'.repeat(64), reviewedByParentId: scope.actorId,
    reviewedAt: '2026-11-04T00:00:00.000Z', evidenceSummary: 'Synthetic review', comment: '', masteryConfirmed: false,
    reviewReminderDate: null, targets: { mistake: { id: id(5), stateRevision: 0, knowledgePointId: null, effectId }, knowledgePoint: null } };
  const requestBody = { ...body, finalReviewHash: C.hash(finalReview) };
  const { schemaVersion: _schemaVersion, ...receiptFields } = requestBody;
  const receipt = { ...receiptFields, status: 'applied', reviewedAt: finalReview.reviewedAt,
    appliedAt: '2026-11-04T00:01:00.000Z', decidedAt: '2026-11-04T00:01:00.000Z', eventId: id(11) };
  service.apply.mockResolvedValue(receipt); service.getReceipt.mockResolvedValue(receipt);
  service.getFinalReview.mockResolvedValue({ finalReview, finalReviewHash: requestBody.finalReviewHash,
    effect: { kind: 'mistake', effectId, targetId: body.targetId, expectedStateRevision: 0 } });
  for (const kind of ['mistake', 'mastery', 'proof']) {
    const server = await start({ kind });
    const client = createAi3EvidenceClient({ kind, baseUrl: `http://127.0.0.1:${server.address().port}`, serviceToken: token });
    if (kind === 'proof') {
      const result = await client.getFinalReview({ familyId: scope.familyId, childId: scope.childId, effectId, finalReviewId: id(4) });
      expect(result.finalReview).toEqual(finalReview); expect(result.effect.effectId).toBe(effectId);
    } else {
      const context = { id: id(5), stateRevision: 0, ...(kind === 'mistake' ? { knowledgePointId: null } : {}) };
      service.getContext.mockResolvedValue(context);
      expect(await client.getContext({ ...scope, targetId: id(5) })).toEqual(context);
      expect(await client.apply({ body: requestBody })).toEqual(receipt);
      expect(await client.getReceipt({ ...scope, effectId })).toEqual(receipt);
    }
  }
});
