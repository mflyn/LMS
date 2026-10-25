const { createCompletionMediaReferenceClient } = require('../mediaReferenceClient');

const TOKEN = 'synthetic-completion-client-token-32-characters';
const REMOTE = '7fe39b20-2bc9-45fb-b2d1-a91ff15a62d8';
const OTHER = '4d979020-09c5-4c94-8a9f-90b8fc8f0d55';
const command = () => ({ familyId: 'a'.repeat(24), childId: 'b'.repeat(24), resourceType: 'growth_task',
  resourceId: 'c'.repeat(24), remoteOperationId: REMOTE, commandHash: 'd'.repeat(64),
  references: [{ mediaId: 'e'.repeat(24), field: 'completionMediaIds' }] });
const result = (state = 'PREPARED') => ({ operation: { operationId: REMOTE, state,
  commandHash: state === 'ABSENT' ? null : 'd'.repeat(64),
  leaseExpiresAt: state === 'PREPARED' ? '2026-10-22T00:15:00.000Z' : null,
  leaseExpired: state === 'PREPARED' ? false : null,
  failureCode: state === 'ABORTED' ? 'MEDIA_OPERATION_ABORTED' : null },
references: [{ mediaId: 'e'.repeat(24), field: 'completionMediaIds',
  state: state === 'ABSENT' ? 'absent' : state === 'PREPARED' ? 'prepared' : state === 'COMMITTED' ? 'bound' : 'released',
  ...(state === 'ABSENT' ? {} : { bindingOperationId: REMOTE }), privacyDeletion: null }] });
const envelope = data => ({ status: 200, data: { success: true, data } });
const fixture = (response = envelope(result())) => {
  const transport = { post: jest.fn().mockResolvedValue(response) };
  const client = createCompletionMediaReferenceClient({ axiosInstance: transport,
    resourceServiceUrl: 'http://resource-service:3005/', serviceToken: TOKEN, timeout: 2000 });
  return { transport, client };
};
const pending = { status: 503, code: 'MEDIA_REFERENCE_PENDING', details: [] };

test.each(['prepare', 'commit', 'abort', 'status'])('%s uses explicit remote mapping and preserves full evidence', async action => {
  const data = result(action === 'commit' ? 'COMMITTED' : action === 'abort' ? 'ABORTED' : 'PREPARED');
  const { client, transport } = fixture(envelope(data));
  const input = { ...command(), ...(action === 'status' ? { mode: 'operation' } : {}) };
  await expect(client[action](input)).resolves.toEqual(data);
  const { remoteOperationId: _remoteOperationId, ...wire } = input;
  expect(transport.post).toHaveBeenCalledWith(`http://resource-service:3005/api/internal/media/references/${action}`,
    { ...wire, operationId: REMOTE }, { headers: { 'x-service-token': TOKEN }, timeout: 2000, maxRedirects: 0 });
  expect(input.remoteOperationId).toBe(REMOTE);
});

test('reference status sends no command identity and preserves another current generation', async () => {
  const data = result('COMMITTED'); data.operation = null; data.references[0].bindingOperationId = OTHER;
  const { client, transport } = fixture(envelope(data));
  const { remoteOperationId: _remoteOperationId, commandHash: _commandHash, ...scope } = command();
  const input = { ...scope, mode: 'references' };
  await expect(client.status(input)).resolves.toEqual(data);
  expect(transport.post.mock.calls[0][1]).toEqual(input);
});

test.each([
  ['missing mapping', c => { delete c.remoteOperationId; }],
  ['public id fallback', c => { delete c.remoteOperationId; c.operationId = OTHER; }],
  ['injected wire id', c => { c.operationId = OTHER; }],
  ['bad mapping', c => { c.remoteOperationId = 'invalid'; }],
  ['bad hash', c => { c.commandHash = 'D'.repeat(64); }],
  ['missing family', c => { delete c.familyId; }],
  ['wrong resource', c => { c.resourceType = 'child'; }],
  ['empty refs', c => { c.references = []; }],
  ['11 refs', c => { c.references = Array.from({ length: 11 }, (_, i) => ({ mediaId: i.toString(16).padStart(24, '0'), field: 'completionMediaIds' })); }],
  ['duplicate refs', c => { c.references.push({ ...c.references[0] }); }],
  ['case duplicate', c => { c.references.push({ ...c.references[0], mediaId: c.references[0].mediaId.toUpperCase() }); }],
  ['wrong field', c => { c.references[0].field = 'attachmentMediaIds'; }],
  ['supplied proof', c => { c.references[0].privacyDeletion = {}; }],
  ['supplied binding', c => { c.references[0].bindingOperationId = OTHER; }],
  ['unknown actor', c => { c.actorId = 'f'.repeat(24); }]
])('rejects %s before transport', async (_label, mutate) => {
  const { client, transport } = fixture(); const input = command(); mutate(input);
  await expect(client.prepare(input)).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
  expect(transport.post).not.toHaveBeenCalled();
});

test.each(['remoteOperationId', 'operationId', 'commandHash'])('references mode rejects %s', async field => {
  const { client, transport } = fixture(); const { remoteOperationId: _remoteOperationId, commandHash: _commandHash, ...scope } = command();
  await expect(client.status({ ...scope, mode: 'references', [field]: REMOTE })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(transport.post).not.toHaveBeenCalled();
});

test.each([
  ['wrong operation', d => { d.operation.operationId = OTHER; }],
  ['wrong hash', d => { d.operation.commandHash = 'f'.repeat(64); }],
  ['missing operation', d => { delete d.operation; }],
  ['missing reference', d => { d.references = []; }],
  ['extra reference', d => { d.references.push({ ...d.references[0], mediaId: 'f'.repeat(24) }); }],
  ['wrong media', d => { d.references[0].mediaId = 'f'.repeat(24); }],
  ['wrong field', d => { d.references[0].field = 'attachmentMediaIds'; }],
  ['missing generation', d => { delete d.references[0].bindingOperationId; }],
  ['invalid generation', d => { d.references[0].bindingOperationId = 'invalid'; }],
  ['missing proof field', d => { delete d.references[0].privacyDeletion; }],
  ['content injection', d => { d.references[0].storageKey = 'private-key'; }],
  ['unexpected data field', d => { d.content = 'private'; }],
  ['missing lease', d => { d.operation.leaseExpiresAt = null; }],
  ['invalid date', d => { d.operation.leaseExpiresAt = 'tomorrow'; }],
  ['missing expiry boolean', d => { delete d.operation.leaseExpired; }],
  ['prepared failure', d => { d.operation.failureCode = 'MEDIA_OPERATION_ABORTED'; }],
  ['prepared missing group', d => { d.references[0].state = 'absent'; delete d.references[0].bindingOperationId; }],
  ['prepared wrong generation', d => { d.references[0].bindingOperationId = OTHER; }],
  ['unknown state', d => { d.operation.state = 'SUCCEEDED'; }]
])('malformed response %s stays pending', async (_label, mutate) => {
  const data = result(); mutate(data); const { client } = fixture(envelope(data));
  await expect(client.prepare(command())).rejects.toMatchObject(pending);
});

test.each([
  ['COMMITTED', d => { d.operation.leaseExpired = false; }],
  ['COMMITTED', d => { d.operation.failureCode = 'MEDIA_OPERATION_ABORTED'; }],
  ['ABORTED', d => { d.operation.failureCode = null; }],
  ['ABORTED', d => { d.operation.failureCode = 'UNKNOWN_REMOTE_CODE'; }],
  ['ABORTED', d => { d.references[0].state = 'bound'; }],
  ['COMMITTED', d => { d.references[0].state = 'prepared'; }],
  ['ABSENT', d => { d.operation.commandHash = 'd'.repeat(64); }],
  ['ABSENT', d => { d.references[0].bindingOperationId = REMOTE; }]
])('rejects contradictory %s projection %#', async (state, mutate) => {
  const data = result(state); mutate(data); const { client } = fixture(envelope(data));
  await expect(client.status({ ...command(), mode: 'operation' })).rejects.toMatchObject(pending);
});

test('ABSENT is evidence only for read-only operation status, never a write result', async () => {
  const { client } = fixture(envelope(result('ABSENT')));
  await expect(client.status({ ...command(), mode: 'operation' })).resolves.toEqual(result('ABSENT'));
  for (const action of ['prepare', 'commit', 'abort']) await expect(client[action](command())).rejects.toMatchObject(pending);
});

test('leaseExpired is the server observation and is not recalculated from the client clock', async () => {
  const data = result(); data.operation.leaseExpired = true;
  const { client } = fixture(envelope(data));
  await expect(client.prepare(command())).resolves.toEqual(data);
});

const deleted = () => {
  const data = result('COMMITTED'); data.references[0].state = 'absent'; delete data.references[0].bindingOperationId;
  data.references[0].privacyDeletion = { mediaId: 'e'.repeat(24), resourceType: 'growth_task', resourceId: 'c'.repeat(24),
    field: 'completionMediaIds', bindingOperationId: REMOTE, deletedAt: '2026-10-22T00:00:00.000Z', releasedAt: '2026-10-22T00:00:01.000Z' };
  return data;
};
test('exact deletion proof survives absent current row and remains separate from current binding', async () => {
  const { client } = fixture(envelope(deleted()));
  await expect(client.status({ ...command(), mode: 'operation' })).resolves.toEqual(deleted());
});
test.each([
  ['mediaId', 'f'.repeat(24)], ['resourceId', 'f'.repeat(24)], ['resourceType', 'child'],
  ['field', 'attachmentMediaIds'], ['bindingOperationId', OTHER], ['deletedAt', 'bad'], ['releasedAt', null], ['storageKey', 'private']
])('rejects deletion proof mismatch %s', async (field, value) => {
  const data = deleted(); data.references[0].privacyDeletion[field] = value;
  const { client } = fixture(envelope(data));
  await expect(client.status({ ...command(), mode: 'operation' })).rejects.toMatchObject(pending);
});

test('historical terminal preserves newer binding and does not claim it belongs to the old command', async () => {
  const data = result('COMMITTED'); data.references[0].bindingOperationId = OTHER;
  const { client } = fixture(envelope(data));
  await expect(client.commit(command())).resolves.toEqual(data);
});

test.each([400, 401, 403, 404, 409, 500, 503])('bare remote %s is not terminal evidence and is sanitized', async status => {
  const { client, transport } = fixture();
  transport.post.mockRejectedValue({ response: { status, data: { success: false, error: { code: 'MEDIA_OPERATION_ABORTED', message: TOKEN } } }, config: { secret: TOKEN } });
  const error = await client.abort(command()).catch(e => e);
  expect(error).toMatchObject(pending); expect(`${error.message} ${JSON.stringify(error)}`).not.toContain(TOKEN);
  expect(Object.keys(error).sort()).toEqual(['code', 'details', 'status']); expect(transport.post).toHaveBeenCalledTimes(1);
});
test.each([undefined, null, { status: 204, data: { success: true, data: result() } },
  { status: 200, data: { success: false, data: result() } }])('invalid HTTP/envelope %# is pending', async response => {
  const { client, transport } = fixture(); transport.post.mockResolvedValue(response);
  await expect(client.prepare(command())).rejects.toMatchObject(pending);
});
test('network failure is sanitized and not automatically retried', async () => {
  const { client, transport } = fixture(); transport.post.mockRejectedValue(new Error(`timeout ${TOKEN}`));
  await expect(client.prepare(command())).rejects.toMatchObject(pending); expect(transport.post).toHaveBeenCalledTimes(1);
});

test.each(['commit', 'abort'])('%s cannot acknowledge a still PREPARED operation', async action => {
  const { client } = fixture();
  await expect(client[action](command())).rejects.toMatchObject(pending);
});

test('ten references normalize identity and accept a reordered complete response without mutating input', async () => {
  const input = command(); input.remoteOperationId = REMOTE.toUpperCase(); input.familyId = input.familyId.toUpperCase();
  input.references = Array.from({ length: 10 }, (_, i) => ({ mediaId: (i + 10).toString(16).padStart(24, '0').toUpperCase(), field: 'completionMediaIds' }));
  const snapshot = JSON.stringify(input), data = result();
  data.references = input.references.map(r => ({ ...r, mediaId: r.mediaId.toLowerCase(), state: 'prepared', bindingOperationId: REMOTE, privacyDeletion: null })).reverse();
  const { client, transport } = fixture(envelope(data));
  await expect(client.prepare(input)).resolves.toEqual(data);
  expect(JSON.stringify(input)).toBe(snapshot);
  expect(transport.post.mock.calls[0][1]).toMatchObject({ familyId: 'a'.repeat(24), operationId: REMOTE });
});

test('duplicate response references cannot replace a missing member of the requested set', async () => {
  const input = command(); input.references.push({ mediaId: 'f'.repeat(24), field: 'completionMediaIds' });
  const data = result(); data.references.push({ ...data.references[0] });
  const { client } = fixture(envelope(data));
  await expect(client.prepare(input)).rejects.toMatchObject(pending);
});

test.each(['MEDIA_OPERATION_EXPIRED', 'MEDIA_OPERATION_ABORTED', 'RESOURCE_NOT_FOUND', 'CHILD_ACCESS_DENIED', 'MEDIA_PURPOSE_MISMATCH', 'RESOURCE_CONFLICT'])(
  'matching persisted ABORTED %s is returned as evidence, not thrown as a bare HTTP error', async code => {
    const data = result('ABORTED'); data.operation.failureCode = code;
    const { client } = fixture(envelope(data));
    await expect(client.prepare(command())).resolves.toEqual(data);
  });

test('references status accepts exact deleted binding proof without asserting an operation terminal', async () => {
  const data = deleted(); data.operation = null;
  const { client } = fixture(envelope(data)); const { remoteOperationId: _remoteOperationId, commandHash: _commandHash, ...scope } = command();
  await expect(client.status({ ...scope, mode: 'references' })).resolves.toEqual(data);
});

test.each(['bound proof', 'different live generation', 'missing proof key', 'uppercase live generation'])(
  'rejects contradictory proof/binding %s', async kind => {
    const data = deleted();
    if (kind === 'bound proof') { data.references[0].state = 'bound'; data.references[0].bindingOperationId = REMOTE; }
    if (kind === 'different live generation') { data.references[0].state = 'released'; data.references[0].bindingOperationId = OTHER; }
    if (kind === 'missing proof key') delete data.references[0].privacyDeletion.releasedAt;
    if (kind === 'uppercase live generation') { data.references[0].state = 'released'; data.references[0].bindingOperationId = REMOTE.toUpperCase(); data.references[0].privacyDeletion = null; }
    const { client } = fixture(envelope(data));
    await expect(client.status({ ...command(), mode: 'operation' })).rejects.toMatchObject(pending);
  });

test.each([null, {}, { mode: 'wrong' }])('status rejects incomplete mode/scope %# without transport', async input => {
  const { client, transport } = fixture();
  await expect(client.status(input)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(transport.post).not.toHaveBeenCalled();
});

test.each([{ serviceToken: 'short' }, { resourceServiceUrl: '' }, { timeout: 0 }, { axiosInstance: {} }])(
  'new factory rejects invalid configuration %#', options => {
    expect(() => createCompletionMediaReferenceClient({ resourceServiceUrl: 'http://resource-service:3005', serviceToken: TOKEN, ...options })).toThrow();
  });

test('real HTTP redirects are not followed with the internal credential', async () => {
  const http = require('http');
  let forwarded = 0;
  const server = http.createServer((req, res) => {
    if (req.url === '/redirect-target') { forwarded += 1; res.writeHead(200); res.end('{}'); }
    else { res.writeHead(307, { Location: '/redirect-target' }); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const client = createCompletionMediaReferenceClient({ resourceServiceUrl: `http://127.0.0.1:${server.address().port}`, serviceToken: TOKEN });
    await expect(client.prepare(command())).rejects.toMatchObject(pending);
    expect(forwarded).toBe(0);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('sparse request array is rejected before transport instead of becoming a permanent pending command', async () => {
  const { client, transport } = fixture();
  await expect(client.prepare({ ...command(), references: new Array(1) })).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
  expect(transport.post).not.toHaveBeenCalled();
});

test('sparse adapter response cannot satisfy the complete reference-set proof', async () => {
  const data = result('COMMITTED'); data.references = new Array(1);
  const { client } = fixture(envelope(data));
  await expect(client.commit(command())).rejects.toMatchObject(pending);
});
