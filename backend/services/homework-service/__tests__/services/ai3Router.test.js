const express = require('express');
const axios = require('axios');
const { createIdentityHeaders } = require('../../../../common/middleware/gatewayIdentity');
const { errorHandler } = require('../../../../common/middleware/errorHandler');
const { createAi3Router, createAi3JsonParser } = require('../../routes/ai3');
const http = axios.create({ proxy: false, maxRedirects: 0, timeout: 3000, validateStatus: () => true });
const id = '000000000000000000000001';
const actor = { id, role: 'parent' };
let servers, base, service;
async function listen(app) {
  const server = await new Promise((resolve, reject) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s)); s.once('error', reject);
  });
  servers.push(server); return `http://127.0.0.1:${server.address().port}`;
}
function appFor(misassembled = false) {
  const app = express(); app.locals.logger = { warn() {}, error() {} };
  if (misassembled) app.use(express.json());
  app.use('/api/ai3', createAi3JsonParser(), createAi3Router({ service }));
  app.use(errorHandler); return app;
}
const request = (method, path, data, { signed = true, address = base, headers = {} } = {}) => http.request({
  method, url: address + path, data, transformRequest: [v => Buffer.isBuffer(v) || typeof v === 'string' ? v : JSON.stringify(v)],
  headers: { 'Content-Type': 'application/json', ...(signed ? createIdentityHeaders({ method, originalUrl: path,
    user: actor, secret: process.env.GATEWAY_IDENTITY_SECRET }) : {}), ...headers }
});
beforeEach(async () => {
  servers = [];
  service = Object.fromEntries(['create','listRounds','getRound','generationPreview','generate','runGeneration','reviseContent',
    'rejectContent','publicationPreview','publish','cancel','withdraw','submit','listAttempts','getAttempt','reviewContext',
    'review','listCommands','getCommand','recover'].map(name => [name, jest.fn(async () => ({ command: { id, phase: 'SUCCEEDED' } }))]));
  base = await listen(appFor());
});
afterEach(async () => { for (const s of servers) { s.closeAllConnections(); await new Promise(resolve => s.close(resolve)); } });
test('verified identity and unprojected original body reach a single action', async () => {
  const body = { schemaVersion: 'ai3-min-v1', operationId: '00000000-0000-4000-8000-000000000001', expectedRoundVersion: 2 };
  const path = `/api/ai3/practice-rounds/${id}/publish`;
  const result = await request('POST', path, body);
  expect(result.status).toBe(201); expect(result.headers['cache-control']).toBe('no-store');
  expect(service.publish).toHaveBeenCalledTimes(1);
  expect(service.publish.mock.calls[0][0]).toMatchObject({ identity: actor, roundId: id, body });
  expect((await request('POST', path, body, { signed: false })).status).toBe(401);
  expect(service.publish).toHaveBeenCalledTimes(1);
});
test('unknown, repeated and malformed list query is rejected before service', async () => {
  for (const query of ['actorId=x','page=0','page=01','pageSize=101','page=1&page=2','reviewFrom=2026-02-29','reviewFrom=2026-11-06&reviewTo=2026-11-05']) {
    expect((await request('GET', `/api/ai3/practice-rounds?${query}`)).status).toBe(400);
  }
  expect(service.listRounds).not.toHaveBeenCalled();
  expect((await request('GET', `/api/ai3/practice-rounds?childId=${id}&reviewFrom=2024-02-29&page=2`)).status).toBe(200);
  expect(service.listRounds.mock.calls[0][0]).toMatchObject({ childId: id, reviewFrom: '2024-02-29', page: 2, pageSize: 20 });
  expect((await request('GET', `/api/ai3/commands?childId=${id}`)).status).toBe(400);
});
test('original byte limit, malformed UTF8 and parser misassembly cannot reach writes', async () => {
  const path = '/api/ai3/practice-rounds';
  expect((await request('POST', path, '{}' + ' '.repeat(32766))).status).toBe(201);
  expect((await request('POST', path, '{}' + ' '.repeat(32767))).status).toBe(413);
  expect((await request('POST', path, Buffer.from([123,34,255,34,58,49,125]))).status).toBe(400);
  const address = await listen(appFor(true));
  expect((await request('POST', path, {}, { address })).status).toBe(503);
  expect(service.create).toHaveBeenCalledTimes(1);
});
test('pending review and failed submission do not claim completed creation', async () => {
  service.review.mockResolvedValue({ command: { phase: 'EFFECTS_PENDING' }, reviewSaved: true });
  expect((await request('POST', `/api/ai3/practice-rounds/${id}/attempts/${id}/review`, {})).status).toBe(202);
  service.submit.mockResolvedValue({ command: { phase: 'FAILED' } });
  expect((await request('POST', `/api/ai3/practice-rounds/${id}/attempts`, {})).status).toBe(200);
  service.recover.mockResolvedValue({ command: { phase: 'UNKNOWN' } });
  expect((await request('POST', `/api/ai3/commands/${id}/recover`, {})).status).toBe(202);
});
test('explicit generation drives the reserved command but GET never dispatches', async () => {
  service.generate.mockResolvedValue({ command: { id, phase: 'RESERVED' } });
  expect((await request('POST', `/api/ai3/practice-rounds/${id}/generate`, {})).status).toBe(202);
  expect(service.runGeneration).toHaveBeenCalledTimes(1);
  expect(service.runGeneration.mock.calls[0][0]).toMatchObject({ identity: actor, commandId: id });
  await request('GET', `/api/ai3/commands/${id}`);
  expect(service.runGeneration).toHaveBeenCalledTimes(1);
});
test('stable errors preserved, unexpected errors sanitized and unsupported route returns envelope', async () => {
  service.getRound.mockRejectedValue(Object.assign(Error('private text'), { statusCode: 409, code: 'AI3_STATE_CONFLICT' }));
  let result = await request('GET', `/api/ai3/practice-rounds/${id}`);
  expect(result.status).toBe(409); expect(result.data.error).toMatchObject({ code: 'AI3_STATE_CONFLICT', details: [] });
  expect(JSON.stringify(result.data)).not.toContain('private text');
  service.getRound.mockRejectedValue(Error('private connection details'));
  result = await request('GET', `/api/ai3/practice-rounds/${id}`);
  expect(result.status).toBe(503); expect(JSON.stringify(result.data)).not.toContain('private');
  expect((await request('GET', '/api/ai3/unknown')).data.error.code).toBe('RESOURCE_NOT_FOUND');
});
