const { randomUUID } = require('crypto');
const C = require('../../services/ai2Contract');
const cmd = () => ({ schemaVersion: 'ai2-min-v1', operationId: randomUUID() });
const id = 'a'.repeat(24), hash = 'b'.repeat(64);
const publish = () => ({ ...cmd(), cycleId: id, expectedCycleStateVersion: 1, artifactId: id,
  artifactVersion: 1, artifactContentHash: hash, expectedArtifactReviewVersion: 2,
  childSnapshotHash: hash, childContentConfirmed: true });
test('closed publish contract and exact confirmation', () => {
  const body = publish(); expect(C.normalize('publish', body)).toEqual(body);
  for (const changed of [{ ...body, childContentConfirmed: false }, { ...body, actorId: id },
    { ...body, expectedCycleStateVersion: 0 }, { ...body, cycleId: id.toUpperCase() },
    { ...body, schemaVersion: 'ai1-min-v1' }]) expect(() => C.normalize('publish', changed)).toThrow();
});
test('review/withdraw require feedback, preserve whitespace and normalize only CRLF', () => {
  const body = { ...cmd(), expectedPackageVersion: 1, expectedAttemptVersion: 1, attemptPayloadHash: hash,
    decision: 'revise', comment: '  one\r\ntwo  ' };
  expect(C.normalize('review', body).comment).toBe('  one\ntwo  ');
  for (const comment of ['', ' \n\t', 'x'.repeat(1001), '\ud800']) {
    expect(() => C.normalize('review', { ...body, comment })).toThrow();
  }
  expect(C.normalize('review', { ...body, decision: 'approve', comment: '' }).comment).toBe('');
  expect(() => C.normalize('withdraw', { ...cmd(), expectedPackageVersion: 1, reason: ' ' })).toThrow();
});
test('digest binds endpoint path actor-independent body and all canonical fields', () => {
  const body = publish(); const a = C.requestHash('publish', '/api/ai2/learning-packages', body);
  expect(C.requestHash('publish', '/other', body)).not.toBe(a);
  expect(C.requestHash('publish', '/api/ai2/learning-packages', { ...body, artifactVersion: 2 })).not.toBe(a);
  expect(C.hash({ a: 1, b: 2 })).toBe(C.hash({ b: 2, a: 1 }));
});
test('submit accepts only ordered unique 1-10 IDs and closed original command; recover carries no replacement body', () => {
  const body = { ...cmd(), expectedPackageVersion: 1, note: '', mediaIds: [id] };
  expect(C.normalize('submit', body)).toEqual(body);
  for (const mediaIds of [[], [id, id], new Array(1), [null], [id.toUpperCase()], Array(11).fill(id)]) {
    expect(() => C.normalize('submit', { ...body, mediaIds })).toThrow();
  }
  expect(() => C.normalize('submit', { ...body, actorId: id })).toThrow();
  const recovery = cmd();
  expect(C.normalize('recover', recovery)).toEqual(recovery);
  expect(() => C.normalize('recover', { ...recovery, mediaIds: [id] })).toThrow();
  expect(() => C.normalize('recover', {})).toThrow();
});
test('normalized submit owns its media array instead of accepting delayed caller mutation', () => {
  const body = { ...cmd(), expectedPackageVersion: 1, note: 'one\r\ntwo', mediaIds: [id] };
  const normalized = C.normalize('submit', body);
  body.mediaIds[0] = 'c'.repeat(24);
  expect(normalized.mediaIds).toEqual([id]); expect(normalized.note).toBe('one\ntwo');
});
