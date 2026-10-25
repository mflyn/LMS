const { createCompletionMediaReferenceClient } = require('../mediaReferenceClient');
const CURRENT = '7fe39b20-2bc9-45fb-b2d1-a91ff15a62d8';
const OLD = '4d979020-09c5-4c94-8a9f-90b8fc8f0d55';
const TOKEN = 'synthetic-unbind-client-token-32-characters';
const command = () => ({ familyId: 'a'.repeat(24), childId: 'b'.repeat(24), resourceType: 'growth_task',
  resourceId: 'c'.repeat(24), remoteOperationId: CURRENT,
  references: [{ mediaId: 'e'.repeat(24), field: 'completionMediaIds', bindingOperationId: OLD }] });
const result = () => ({ operation: null, references: [{ ...command().references[0], state: 'released', privacyDeletion: null }] });
const proof = () => ({ ...command().references[0], resourceType: 'growth_task', resourceId: 'c'.repeat(24),
  deletedAt: '2026-10-22T00:00:00.000Z', releasedAt: '2026-10-22T00:00:00.000Z' });
const fixture = (data = result()) => {
  const transport = { post: jest.fn().mockResolvedValue({ status: 200, data: { success: true, data } }) };
  return { transport, client: createCompletionMediaReferenceClient({ axiosInstance: transport,
    resourceServiceUrl: 'http://synthetic-resource', serviceToken: TOKEN }) };
};
test('maps only persisted remote identity; preserves old binding and omits commandHash', async () => {
  const { client, transport } = fixture(), input = command();
  input.remoteOperationId = CURRENT.toUpperCase(); input.references[0].bindingOperationId = OLD.toUpperCase();
  await expect(client.unbind(input)).resolves.toEqual(result());
  const wire = transport.post.mock.calls[0][1];
  const { remoteOperationId: _remoteOperationId, ...expected } = command();
  expect(wire).toEqual({ ...expected, operationId: CURRENT });
  expect(Object.keys(wire)).not.toContain('remoteOperationId'); expect(Object.keys(wire)).not.toContain('commandHash');
  expect(transport.post.mock.calls[0][0]).toMatch(/\/unbind$/);
  expect(transport.post.mock.calls[0][2]).toMatchObject({ maxRedirects: 0, headers: { 'x-service-token': TOKEN } });
  expect(input.references[0].bindingOperationId).toBe(OLD.toUpperCase());
});
test.each(['released', 'absent'])('accepts exact old privacy proof for %s, not current audit id', async state => {
  const data = result(); data.references[0].state = state; data.references[0].privacyDeletion = proof();
  if (state === 'absent') delete data.references[0].bindingOperationId;
  await expect(fixture(data).client.unbind(command())).resolves.toEqual(data);
});
test.each([
  ['missing mapping', c => { delete c.remoteOperationId; }],
  ['public fallback', c => { delete c.remoteOperationId; c.operationId = CURRENT; }],
  ['hash', c => { c.commandHash = 'd'.repeat(64); }],
  ['mode', c => { c.mode = 'references'; }],
  ['missing binding', c => { delete c.references[0].bindingOperationId; }],
  ['invalid binding', c => { c.references[0].bindingOperationId = 'invalid'; }],
  ['empty', c => { c.references = []; }],
  ['duplicate', c => { c.references.push({ ...c.references[0] }); }],
  ['sparse', c => { c.references.length = 2; }]
])('rejects %s locally', async (_name, mutate) => {
  const { client, transport } = fixture(), input = command(); mutate(input);
  await expect(client.unbind(input)).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
  expect(transport.post).not.toHaveBeenCalled();
});
test.each([
  ['operation projection', d => { d.operation = {}; }],
  ['bound', d => { d.references[0].state = 'bound'; }],
  ['prepared', d => { d.references[0].state = 'prepared'; }],
  ['another binding', d => { d.references[0].bindingOperationId = CURRENT; }],
  ['missing ref', d => { d.references = []; }],
  ['sparse', d => { d.references = new Array(1); }],
  ['absent with binding', d => { d.references[0].state = 'absent'; }],
  ['absent wrong receipt', d => { d.references[0] = { ...d.references[0], state: 'absent', privacyDeletion: { ...proof(), bindingOperationId: CURRENT } }; delete d.references[0].bindingOperationId; }],
  ['released wrong receipt', d => { d.references[0].privacyDeletion = { ...proof(), bindingOperationId: CURRENT }; }]
])('keeps malformed %s pending', async (_name, mutate) => {
  const data = result(); mutate(data);
  await expect(fixture(data).client.unbind(command())).rejects.toMatchObject({ status: 503, code: 'MEDIA_REFERENCE_PENDING' });
});
test.each([409, 500, 'timeout'])('bare %s response is not release evidence', async status => {
  const { client, transport } = fixture(); transport.post.mockRejectedValue({ status, message: TOKEN, response: { data: 'private' } });
  await expect(client.unbind(command())).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING', details: [] });
  try { await client.unbind(command()); } catch (e) { expect(JSON.stringify(e)).not.toContain(TOKEN); }
});

test.each(['duplicate', 'missing', 'extra', 'wrong field', 'wrong binding'])('two-item response rejects %s without accepting partial success', async kind => {
  const input = command(); input.references.push({ mediaId: 'f'.repeat(24), field: 'completionMediaIds', bindingOperationId: CURRENT });
  const data = result(); data.references.push({ ...input.references[1], state: 'released', privacyDeletion: null });
  if (kind === 'duplicate') data.references[1] = { ...data.references[0] };
  if (kind === 'missing') data.references.pop();
  if (kind === 'extra') data.references.push({ ...data.references[1], mediaId: 'd'.repeat(24) });
  if (kind === 'wrong field') data.references[1].field = 'attachmentMediaIds';
  if (kind === 'wrong binding') data.references[1].bindingOperationId = OLD;
  await expect(fixture(data).client.unbind(input)).rejects.toMatchObject({ code: 'MEDIA_REFERENCE_PENDING' });
});
