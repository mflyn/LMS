const { createAi3EvidenceClient } = require('../ai3EvidenceClient');
const C = require('../ai3ReviewEvidence');
const token = 'synthetic-ai3-evidence-token-only-32-chars';
const id = n => String(n).padStart(24, '0');
const scope = () => ({ familyId: id(1), childId: id(2), actorId: id(3), targetId: id(4) });
const envelope = data => new Response(JSON.stringify({ success: true, data }), { status: 200 });
const fixture = (fetchImpl = jest.fn(async () => envelope({ id: id(4), stateRevision: 0, knowledgePointId: null })), options = {}) => ({
  fetchImpl, client: createAi3EvidenceClient({ kind: 'mistake', baseUrl: 'http://analytics-service:3006', serviceToken: token, fetchImpl, ...options })
});
const evidence = () => {
  const effectId = '00000000-0000-4000-8000-000000000001';
  const finalReview = { schemaVersion: 'ai3-final-review-v1', id: id(5), familyId: id(1), childId: id(2),
    roundId: id(6), sourcePackageId: id(7), sourceAttemptId: id(8), sourceAttemptVersion: 1,
    sourceAttemptPayloadHash: 'a'.repeat(64), sourceReviewHash: 'b'.repeat(64), source: { type: 'mistake', id: id(4) },
    contentId: id(9), contentVersion: 1, contentHash: 'c'.repeat(64), childSnapshotHash: 'd'.repeat(64),
    attemptId: id(10), attemptVersion: 1, attemptPayloadHash: 'e'.repeat(64), reviewedByParentId: id(3),
    reviewedAt: '2026-11-05T00:00:00.000Z', evidenceSummary: 'Both exercises checked', comment: '',
    masteryConfirmed: false, reviewReminderDate: null,
    targets: { mistake: { id: id(4), stateRevision: 2, knowledgePointId: null, effectId }, knowledgePoint: null } };
  const finalReviewHash = C.hash(finalReview);
  const request = { schemaVersion: 'ai3-review-effect-v1', effectId, finalReviewId: id(5), finalReviewHash,
    familyId: id(1), childId: id(2), reviewedByParentId: id(3), targetId: id(4), expectedStateRevision: 2 };
  const receipt = { ...request, status: 'applied', reviewedAt: finalReview.reviewedAt,
    appliedAt: '2026-11-05T00:01:00.000Z', decidedAt: '2026-11-05T00:01:00.000Z', eventId: id(11) };
  delete receipt.schemaVersion;
  const proof = { finalReview, finalReviewHash, effect: { kind: 'mistake', effectId, targetId: id(4), expectedStateRevision: 2 } };
  return { request, receipt, proof };
};

test('apply sends one exact request and accepts only its persisted receipt', async () => {
  const { request, receipt } = evidence();
  const { client, fetchImpl } = fixture(jest.fn(async () => envelope(receipt)));
  await expect(client.apply({ body: request })).resolves.toEqual(receipt);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(fetchImpl.mock.calls[0][0]).toBe('http://analytics-service:3006/api/internal/ai3/mistake-review-effects');
  expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: 'POST', body: JSON.stringify(request) });
});
test.each(['familyId', 'childId', 'targetId', 'reviewedByParentId', 'finalReviewHash', 'expectedStateRevision'])('apply rejects receipt with wrong %s without retry', async field => {
  const { request, receipt } = evidence();
  receipt[field] = field === 'expectedStateRevision' ? 3 : field.endsWith('Hash') ? 'f'.repeat(64) : id(99);
  const { client, fetchImpl } = fixture(jest.fn(async () => envelope(receipt)));
  await expect(client.apply({ body: request })).rejects.toMatchObject({ statusCode: 503 });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});
test('invalid effect body is rejected before any outbound request', async () => {
  const { request } = evidence(); const { client, fetchImpl } = fixture();
  await expect(client.apply({ body: { ...request, masteryLevel: 'skilled' } })).rejects.toMatchObject({ statusCode: 400 });
  expect(fetchImpl).not.toHaveBeenCalled();
});
test('an in-flight caller mutation cannot replace the request used to verify a receipt', async () => {
  const { request, receipt } = evidence();
  let respond;
  const fetchImpl = jest.fn(() => new Promise(resolve => { respond = resolve; }));
  const { client } = fixture(fetchImpl);
  const original = JSON.parse(JSON.stringify(request));
  const pending = client.apply({ body: request });
  request.targetId = id(99);
  respond(envelope({ ...receipt, targetId: id(99) }));
  await expect(pending).rejects.toMatchObject({ statusCode: 503 });
  expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual(original);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});
test('an in-flight caller mutation does not reject the valid receipt for the actual sent request', async () => {
  const { request, receipt } = evidence();
  let respond;
  const { client } = fixture(() => new Promise(resolve => { respond = resolve; }));
  const pending = client.apply({ body: request });
  request.expectedStateRevision = 99;
  respond(envelope(receipt));
  await expect(pending).resolves.toEqual(receipt);
});
test('receipt lookup is read-only, keeps a permanent conflict and rejects another actor', async () => {
  const { request, receipt } = evidence();
  Object.assign(receipt, { status: 'not_applied_conflict', appliedAt: null, eventId: null });
  const { client, fetchImpl } = fixture(jest.fn(async () => envelope(receipt)));
  const input = { familyId: id(1), childId: id(2), actorId: id(3), effectId: request.effectId };
  await expect(client.getReceipt(input)).resolves.toEqual(receipt);
  await expect(client.getReceipt({ ...input, actorId: id(99) })).rejects.toMatchObject({ statusCode: 503 });
  expect(fetchImpl.mock.calls.every(([, options]) => options.method === 'GET')).toBe(true);
});
test('proof lookup binds full immutable hash and caller scope before use', async () => {
  const { request, proof } = evidence();
  const fetchImpl = jest.fn(async () => envelope(proof));
  const { client } = fixture(fetchImpl, { kind: 'proof', baseUrl: 'http://homework-service:3003' });
  const input = { familyId: id(1), childId: id(2), effectId: request.effectId, finalReviewId: id(5) };
  await expect(client.getFinalReview(input)).resolves.toEqual(proof);
  await expect(client.getFinalReview({ ...input, childId: id(99) })).rejects.toMatchObject({ statusCode: 503 });
  proof.finalReview.comment = 'Changed after review';
  await expect(client.getFinalReview(input)).rejects.toMatchObject({ statusCode: 503 });
  expect(fetchImpl.mock.calls.every(([, options]) => options.method === 'GET')).toBe(true);
});

test('context uses only fixed internal route and dedicated credential without retries/redirects', async () => {
  const { client, fetchImpl } = fixture();
  await expect(client.getContext(scope())).resolves.toEqual({ id: id(4), stateRevision: 0, knowledgePointId: null });
  const [url, options] = fetchImpl.mock.calls[0];
  expect(url).toBe(`http://analytics-service:3006/api/internal/ai3/mistakes/${id(4)}/review-context?familyId=${id(1)}&childId=${id(2)}&actorId=${id(3)}`);
  expect(options).toMatchObject({ method: 'GET', redirect: 'error', headers: { 'x-ai3-evidence-token': token } });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});
test.each(['https://user:password@host', 'http://host/path', 'http://host/?x=1', 'file:///x', 'http://host/#x'])('configuration rejects base %s', baseUrl => {
  expect(() => fixture(undefined, { baseUrl })).toThrow();
});
test.each([{ host: 'http://other' }, { targetId: '../other' }, { childId: null }, { actorId: [id(3)] }])('invalid input is zero outbound %p', delta => {
  const { client, fetchImpl } = fixture();
  return expect(client.getContext({ ...scope(), ...delta })).rejects.toMatchObject({ statusCode: 400 }).then(() => {
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
test.each([{ id: id(5), stateRevision: 0, knowledgePointId: null }, { id: id(4), stateRevision: -1, knowledgePointId: null },
  { id: id(4), stateRevision: 0, knowledgePointId: null, rawAnswer: 'private' }])('rejects malformed context %p', body => {
  const { client } = fixture(jest.fn(async () => envelope(body)));
  return expect(client.getContext(scope())).rejects.toMatchObject({ statusCode: 503, code: 'AI3_EVIDENCE_UNAVAILABLE' });
});
test('timeout and connection failure stay unknown and do not retry', async () => {
  const { client, fetchImpl } = fixture(jest.fn(async () => { throw Error(`secret ${token}`); }));
  await expect(client.getContext(scope())).rejects.toMatchObject({ statusCode: 503, message: 'AI3_EVIDENCE_UNAVAILABLE' });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  const hanging = fixture(() => new Promise(() => {}), { timeoutMs: 10 });
  await expect(hanging.client.getContext(scope())).rejects.toMatchObject({ statusCode: 503 });
});
test.each([[403, 'CHILD_ACCESS_DENIED'], [404, 'RESOURCE_NOT_FOUND'], [409, 'AI3_EFFECT_CONFLICT'], [503, 'AI3_NOT_READY']])('preserves trusted stable error %s/%s', async (status, code) => {
  const { client } = fixture(async () => new Response(JSON.stringify({ success: false, error: { code, message: code, details: [] } }), { status }));
  await expect(client.getContext(scope())).rejects.toMatchObject({ statusCode: status, code });
});
test('mismatched status/code, reflected credential and oversized chunked response are unavailable', async () => {
  for (const response of [new Response(JSON.stringify({ success: false, error: { code: 'RESOURCE_NOT_FOUND' } }), { status: 503 }),
    envelope({ id: id(4), stateRevision: 0, knowledgePointId: null, token }),
    new Response('x'.repeat(32769)), new Response(Buffer.from([0xff]))]) {
    await expect(fixture(async () => response).client.getContext(scope())).rejects.toMatchObject({ statusCode: 503 });
  }
});
test('GET receipt preserves scoped not-found and never attempts POST', async () => {
  const fetchImpl = jest.fn(async () => new Response(JSON.stringify({ success: false,
    error: { code: 'RESOURCE_NOT_FOUND', message: 'RESOURCE_NOT_FOUND', details: [] } }), { status: 404 }));
  const { client } = fixture(fetchImpl);
  await expect(client.getReceipt({ familyId: id(1), childId: id(2), actorId: id(3), effectId: '00000000-0000-4000-8000-000000000001' }))
    .rejects.toMatchObject({ statusCode: 404 });
  expect(fetchImpl.mock.calls).toHaveLength(1);
  expect(fetchImpl.mock.calls[0][1].method).toBe('GET');
});
