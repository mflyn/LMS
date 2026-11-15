const http = require('http');
const C = require('../../services/ai1Contract');
const { buildRequest, validateOperation, createOperationClient } = require('../../services/ai3Operation');
const preview = () => C.buildPreview({ input: { questionText: '124 * 23', answerText: null, parentContext: '' },
  chapter: { subject: 'math' } }, { model: 'synthetic', modelProfileVersion: 'model-1', pricingProfileVersion: 'price-1',
  checkedAt: '2026-11-01T00:00:00.000Z', expiresAt: '2026-11-02T00:00:00.000Z', callWindowMs: 60000,
  clockMarginMs: 5000, inputPriceMicrosPerMillion: 9000000, outputPriceMicrosPerMillion: 27000000 }, Date.parse('2026-11-01T01:00:00Z'));
const job = () => {
  const j = { remoteOperationId: '11111111-1111-4111-8111-111111111111', preview: { ...preview(),
    providerProfile: 'ai3-practice-v1', promptVersion: 'ai3-practice-prompt-v1', outputSchemaVersion: 'ai3-practice-content-v1' } };
  j.remoteRequestHash = buildRequest(j).requestHash; return j;
};
const operation = (j, patch = {}) => ({ providerProfile: 'ai3-practice-v1', remoteOperationId: j.remoteOperationId, requestHash: buildRequest(j).requestHash,
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
test.each([32767, 32768, 32769])('complete request wire boundary: %i bytes including hash', bytes => {
  const j = job(); j.preview.messages = [{ role: 'user', content: '' }];
  const empty = buildRequest(j);
  j.preview.messages[0].content = 'a'.repeat(bytes - Buffer.byteLength(JSON.stringify(empty), 'utf8'));
  const expected = { ...empty, messages: j.preview.messages };
  expect(Buffer.byteLength(JSON.stringify(expected), 'utf8')).toBe(bytes);
  if (bytes > 32768) expect(() => buildRequest(j)).toThrow(expect.objectContaining({ code: 'AI_INPUT_TOO_LARGE', statusCode: 413 }));
  else expect(Buffer.byteLength(JSON.stringify(buildRequest(j)), 'utf8')).toBe(bytes);
});
test.each(['\u4e58'.repeat(11000), '"'.repeat(17000), '\\'.repeat(17000)])('wire bytes reject multibyte or escaped expansion: %#', content => {
  const j = job(); j.preview.messages = [{ role: 'user', content }];
  expect(content.length).toBeLessThan(32768);
  expect(() => buildRequest(j)).toThrow(expect.objectContaining({ code: 'AI_INPUT_TOO_LARGE', statusCode: 413 }));
});
test('real HTTP accepts exactly 32 KiB; oversized wire is rejected with zero extra requests', async () => {
  const j = job(), received = [];
  j.preview.messages = [{ role: 'user', content: '\u4e58"\\' }];
  const prefix = buildRequest(j);
  j.preview.messages[0].content += 'a'.repeat(32768 - Buffer.byteLength(JSON.stringify(prefix), 'utf8'));
  j.remoteRequestHash = buildRequest(j).requestHash;
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      received.push(Buffer.concat(chunks));
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, data: { operation: operation(j) } }));
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const client = createOperationClient({ baseUrl: `http://127.0.0.1:${server.address().port}`,
      token: 'synthetic-wire-budget-'.repeat(2), allowLoopback: true });
    expect((await client.put(j)).status).toBe('accepted');
    expect(received).toHaveLength(1); expect(received[0].length).toBe(32768);
    expect(received[0].toString('utf8')).toBe(JSON.stringify(buildRequest(j)));
    j.preview.messages[0].content += 'a';
    await expect(client.put(j)).rejects.toMatchObject({ statusCode: 413, code: 'AI_INPUT_TOO_LARGE' });
    expect(received).toHaveLength(1);
  } finally { await new Promise(resolve => server.close(resolve)); }
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
  { providerProfile: 'ai1' }, { sendClaimed: true }, { result: { text: 'bad', contentHash: C.sha('bad') } }, { error: 'PROVIDER_FAILED' },
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
    const entry = { method: req.method, url: req.url, token: req.headers['x-ai1-service-token'], body: '' };
    calls.push(entry);
    req.on('data', chunk => { entry.body += chunk; });
    req.on('end', () => {
    if (mode === 'lost') { req.socket.destroy(); return; }
    if (mode === 'redirect') { res.writeHead(302, { Location: '/forbidden' }); res.end(); return; }
    res.setHeader('Content-Type', 'application/json');
    if (mode === 'isolate') { res.statusCode = 503; res.end(JSON.stringify({ success: false, error: { code: 'AI_STORE_ISOLATED', message: 'AI_STORE_ISOLATED', details: [] } })); return; }
    res.end(mode === 'huge' ? 'x'.repeat(65537) : JSON.stringify(mode === 'bad' ? { success: true } : { success: true, data: { operation: operation(j) } }));
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`, token = 'synthetic-ai1-credential-'.repeat(2);
    expect(() => createOperationClient({ baseUrl, token })).toThrow();
    const client = createOperationClient({ baseUrl, token, allowLoopback: true });
    await expect(client.put({ ...j, remoteRequestHash: '0'.repeat(64) })).rejects.toMatchObject({ code: 'AI_REMOTE_CONTRACT_INVALID' });
    expect(calls).toHaveLength(0);
    expect((await client.put(j)).status).toBe('accepted');
    expect(calls[0]).toMatchObject({ method: 'PUT', url: `/internal/deeptutor/ai3/operations/${j.remoteOperationId}`, token });
    expect(JSON.parse(calls[0].body)).toEqual(buildRequest(j));
    expect((await client.get(j)).status).toBe('accepted'); expect(calls[1].body).toBe('');
    for (mode of ['lost', 'redirect', 'bad', 'huge', 'isolate']) {
      const before = calls.length;
      await expect(client.get(j)).rejects.toMatchObject({ code: mode === 'isolate' ? 'AI_STORE_ISOLATED' : mode === 'bad' ? 'AI_REMOTE_CONTRACT_INVALID' : 'AI_REMOTE_UNAVAILABLE' });
      expect(calls).toHaveLength(before + 1);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
