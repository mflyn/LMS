const http = require('http');
const C = require('../../services/ai1Contract');
const { buildRequest, validateOperation, createOperationClient } = require('../../services/ai1Operation');
const preview = () => C.buildPreview({ input: { questionText: '124 * 23', answerText: null, parentContext: '' },
  chapter: { subject: 'math' } }, { model: 'synthetic', modelProfileVersion: 'model-1', pricingProfileVersion: 'price-1',
  checkedAt: '2026-11-01T00:00:00.000Z', expiresAt: '2026-11-02T00:00:00.000Z', callWindowMs: 60000,
  clockMarginMs: 5000, inputPriceMicrosPerMillion: 9000000, outputPriceMicrosPerMillion: 27000000 }, Date.parse('2026-11-01T01:00:00Z'));
const job = () => ({ remoteOperationId: '11111111-1111-4111-8111-111111111111', preview: preview() });
const operation = (j, patch = {}) => ({ remoteOperationId: j.remoteOperationId, requestHash: buildRequest(j).requestHash,
  modelProfileVersion: j.preview.modelProfileVersion, pricingProfileVersion: j.preview.pricingProfileVersion,
  sendNotAfter: j.preview.sendNotAfter, status: 'accepted', result: null, error: null, usage: null,
  sendClaimed: false, updatedAt: '2026-11-01T01:00:00.000Z', ...patch });
test('wire projection is closed, stable and has no local identities', () => {
  const j = { ...job(), familyId: 'private', createdBy: 'private' }, r = buildRequest(j);
  const { requestHash, ...body } = r;
  expect(requestHash).toBe(C.hash(body)); expect(JSON.stringify(r)).not.toContain('private');
  expect(r.messages).toEqual(j.preview.messages);
  r.messages[0].content = 'changed'; expect(buildRequest(j).requestHash).toBe(requestHash);
});
test.each([
  { status: 'accepted' }, { status: 'sending', sendClaimed: true },
  { status: 'succeeded', sendClaimed: true, result: { text: 'draft', contentHash: C.sha('draft') } },
  { status: 'failed_not_sent', error: 'PREVIEW_STALE' },
  { status: 'failed_sent', sendClaimed: true, error: 'PROVIDER_FAILED' },
  { status: 'unknown', sendClaimed: true, error: 'RESULT_UNKNOWN' }
])('accepts closed state $status', patch => {
  const j = job(); expect(validateOperation(j, operation(j, patch)).status).toBe(patch.status);
});
test.each([
  { sendClaimed: true }, { result: { text: 'bad', contentHash: C.sha('bad') } }, { error: 'PROVIDER_FAILED' },
  { usage: { inputTokens: 0, outputTokens: 0 } }, { extra: true }, { remoteOperationId: 'wrong' },
  { requestHash: '0'.repeat(64) }, { sendNotAfter: '2026-11-03T00:00:00.000Z' },
  { pricingProfileVersion: 'wrong' }, { modelProfileVersion: 'wrong' }, { updatedAt: 'yesterday' },
  { status: 'failed_not_sent', sendClaimed: true, error: 'PREVIEW_STALE' },
  { status: 'unknown', sendClaimed: false, error: 'RESULT_UNKNOWN' },
  { status: 'succeeded', sendClaimed: true, result: { text: 'draft', contentHash: '0'.repeat(64) } },
  { status: 'succeeded', sendClaimed: true, result: { text: '\ud800', contentHash: C.sha('\ud800') } },
  { status: 'succeeded', sendClaimed: true, result: { text: 'draft', contentHash: C.sha('draft') }, usage: { inputTokens: 8193, outputTokens: 1 } }
])('rejects inconsistent envelope %j', patch => {
  const j = job(); expect(() => validateOperation(j, operation(j, patch))).toThrow('AI_REMOTE_CONTRACT_INVALID');
});
test('real HTTP: credential, exact path, no redirect/retry, malformed response and bounded body', async () => {
  const j = job(), calls = []; let mode = 'ok';
  const server = http.createServer((req, res) => {
    calls.push({ method: req.method, url: req.url, token: req.headers['x-ai1-service-token'] });
    req.resume();
    if (mode === 'lost') { req.socket.destroy(); return; }
    if (mode === 'redirect') { res.writeHead(302, { Location: '/forbidden' }); res.end(); return; }
    res.setHeader('Content-Type', 'application/json');
    if (mode === 'isolate') { res.statusCode = 503; res.end(JSON.stringify({ success: false, error: { code: 'AI_STORE_ISOLATED', message: 'AI_STORE_ISOLATED', details: [] } })); return; }
    res.end(mode === 'huge' ? 'x'.repeat(65537) : JSON.stringify(mode === 'bad' ? { success: true } : { success: true, data: { operation: operation(j) } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`, token = 'synthetic-ai1-credential-'.repeat(2);
    expect(() => createOperationClient({ baseUrl, token })).toThrow();
    const client = createOperationClient({ baseUrl, token, allowLoopback: true });
    await expect(client.put({ ...j, remoteRequestHash: '0'.repeat(64) })).rejects.toMatchObject({ code: 'AI_REMOTE_CONTRACT_INVALID' });
    expect(calls).toHaveLength(0);
    expect((await client.put(j)).status).toBe('accepted');
    expect(calls[0]).toEqual({ method: 'PUT', url: `/internal/deeptutor/operations/${j.remoteOperationId}`, token });
    for (mode of ['lost', 'redirect', 'bad', 'huge', 'isolate']) {
      const before = calls.length;
      await expect(client.get(j)).rejects.toMatchObject({ code: mode === 'isolate' ? 'AI_STORE_ISOLATED' : mode === 'bad' ? 'AI_REMOTE_CONTRACT_INVALID' : 'AI_REMOTE_UNAVAILABLE' });
      expect(calls).toHaveLength(before + 1);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
