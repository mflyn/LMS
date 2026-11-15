import axios from 'axios';
import { createAi2Api } from '../../services/ai2Api';
import { readAi2Command, saveAi2Command, finishAi2Command, newAi2OperationId,
  validAi2Command } from '../../services/ai2Commands';
import { captureSession, saveParentSession, saveChildSession, clearParentSession, clearChildSession,
  loadParentSession, loadChildSession, PARENT_SESSION_KEY } from '../../services/familySession';
import { resetChildScope } from '../../services/childScope';

const actor = 'a'.repeat(24), familyId = 'b'.repeat(24), childId = 'c'.repeat(24);
const packageId = 'd'.repeat(24), attemptId = 'e'.repeat(24), other = 'f'.repeat(24);
const operationId = '11111111-1111-4111-8111-111111111111';
const anotherOperation = '22222222-2222-4222-8222-222222222222';
const scope = { familyId, childId };
const common = { schemaVersion: 'ai2-min-v1', operationId };
const result = data => ({ data: { success: true, data } });
const login = (role = 'parent', id = role === 'parent' ? actor : childId, token = `synthetic-${role}`) => {
  if (role === 'parent') saveParentSession({ token, user: { id, role } });
  else saveChildSession({ token, child: { childId: id, familyId, name: 'Synthetic child' } });
  return captureSession(role);
};
const command = (action = 'publish') => ({ action, targetId: action === 'publish' ? null : packageId,
  attemptId: action === 'review' ? attemptId : null, body: { ...common, ...{
    publish: { cycleId: other, expectedCycleStateVersion: 4, artifactId: attemptId, artifactVersion: 2,
      artifactContentHash: '1'.repeat(64), expectedArtifactReviewVersion: 2, childSnapshotHash: '2'.repeat(64), childContentConfirmed: true },
    withdraw: { expectedPackageVersion: 2, reason: 'Synthetic withdrawal' },
    submit: { expectedPackageVersion: 3, note: '  x = 2\r\nNext line  ', mediaIds: [other, actor] },
    review: { expectedPackageVersion: 4, expectedAttemptVersion: 1, attemptPayloadHash: '3'.repeat(64), decision: 'revise', comment: 'Check the sum' }
  }[action] } });
const key = (role = 'parent', id = actor, child = childId, family = familyId) =>
  'family-growth.ai2-command.v1:' + JSON.stringify([role, id, family, child]);
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); jest.resetAllMocks(); login(); });
afterEach(() => jest.restoreAllMocks());

test.each(['parent', 'student'])('AI2 %s read routes preserve role, paging and abort scope', async role => {
  const session = login(role), signal = new AbortController().signal, options = { session, signal };
  const api = createAi2Api(role);
  axios.get.mockResolvedValue(result({ items: [] }));
  await api.packages(childId, undefined, options);
  await api.detail(packageId, options);
  await api.attempts(packageId, 2, options);
  await api.attempt(packageId, attemptId, options);
  await api.commands(childId, 3, options);
  await api.command(other, options);
  await api.preview(other, options);
  expect(axios.get.mock.calls.map(([path]) => path)).toEqual([
    `/api/ai2/learning-packages?childId=${childId}&page=1&pageSize=20`,
    `/api/ai2/learning-packages/${packageId}`,
    `/api/ai2/learning-packages/${packageId}/attempts?page=2&pageSize=20`,
    `/api/ai2/learning-packages/${packageId}/attempts/${attemptId}`,
    `/api/ai2/commands?childId=${childId}&scope=mine&page=3&pageSize=20`,
    `/api/ai2/commands/${other}`, `/api/ai2/publication-preview?cycleId=${other}`
  ]);
  for (const [, config] of axios.get.mock.calls) expect(config).toEqual({ signal, headers: { Authorization: `Bearer synthetic-${role}` } });
});

test('AI2 student can omit child filter; route identifiers are encoded as single segments', async () => {
  login('student'); axios.get.mockResolvedValue(result({ items: [] }));
  const api = createAi2Api('student');
  await api.packages(); await api.commands(); await api.attempt('a/b', 'c?d'); await api.preview('a&b');
  expect(axios.get.mock.calls.map(([path]) => path)).toEqual([
    '/api/ai2/learning-packages?page=1&pageSize=20', '/api/ai2/commands?scope=mine&page=1&pageSize=20',
    '/api/ai2/learning-packages/a%2Fb/attempts/c%3Fd', '/api/ai2/publication-preview?cycleId=a%26b'
  ]);
});

test('AI2 all writes pass the whole original body, including unknown fields, without projection', async () => {
  axios.post.mockResolvedValue(result({ pending: true }));
  const api = createAi2Api('parent'), options = { session: captureSession('parent') };
  const body = { ...command().body, unexpected: { mustReachServerValidation: true } };
  await api.publish(body, options); await api.withdraw(packageId, body, options);
  await api.submit(packageId, body, options); await api.review(packageId, attemptId, body, options);
  await api.recover(other, body, options);
  expect(axios.post.mock.calls.map(([path]) => path)).toEqual([
    '/api/ai2/learning-packages', `/api/ai2/learning-packages/${packageId}/withdraw`,
    `/api/ai2/learning-packages/${packageId}/attempts`, `/api/ai2/learning-packages/${packageId}/attempts/${attemptId}/review`,
    `/api/ai2/commands/${other}/recover`
  ]);
  for (const [, sent] of axios.post.mock.calls) expect(sent).toBe(body);
});

test.each(['publish', 'withdraw', 'submit', 'review'])('AI2 %s lost response keeps exact cloned body for explicit retry', async action => {
  const role = action === 'submit' ? 'student' : 'parent', session = login(role), api = createAi2Api(role);
  const original = command(action), expected = JSON.parse(JSON.stringify(original));
  const saved = saveAi2Command(scope, original, session);
  original.body.operationId = anotherOperation;
  if (action === 'submit') original.body.mediaIds.reverse();
  const send = value => action === 'publish' ? api.publish(value.body, { session })
    : action === 'review' ? api.review(value.targetId, value.attemptId, value.body, { session })
      : api[action](value.targetId, value.body, { session });
  axios.post.mockRejectedValueOnce(new Error('response lost'));
  await expect(send(saved)).rejects.toThrow('response lost');
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(readAi2Command(scope, session)).toEqual(expected);
  const persisted = sessionStorage.getItem(key(role, session.actorId));
  expect(persisted).not.toContain(session.token);
  expect(localStorage.getItem(key(role, session.actorId))).toBeNull();
  axios.post.mockResolvedValueOnce(result({ command: { operationId, phase: 'SUCCEEDED' } }));
  await send(readAi2Command(scope, session));
  expect(axios.post).toHaveBeenCalledTimes(2);
  expect(axios.post.mock.calls.map(([, body]) => body)).toEqual([expected.body, expected.body]);
  finishAi2Command(scope, anotherOperation, session);
  expect(readAi2Command(scope, session)).toEqual(expected);
  finishAi2Command(scope, operationId, session);
  expect(readAi2Command(scope, session)).toBeNull();
});

test.each([{}, { success: false, data: {} }, { success: 'true', data: {} }, { success: true },
  { success: true, data: null }, { success: true, data: [] }, { success: true, data: 'ok' }])(
  'AI2 malformed envelope leaves the original command unresolved: %j', async data => {
    const session = captureSession('parent'), saved = saveAi2Command(scope, command(), session);
    axios.post.mockResolvedValueOnce({ data });
    await expect(createAi2Api('parent').publish(saved.body, { session })).rejects.toMatchObject({ code: 'AI2_RESPONSE_UNVERIFIED' });
    expect(readAi2Command(scope, session)).toEqual(saved);
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

test.each(['RESERVED', 'RESOLVING', 'FAILED', 'SUCCEEDED'])('AI2 envelope preserves phase %s without completing local command', async phase => {
  const session = login('student'), saved = saveAi2Command(scope, command('submit'), session);
  const data = { command: { id: other, operationId, phase, resultReference: null }, pending: false };
  axios.post.mockResolvedValueOnce(result(data));
  expect(await createAi2Api('student').recover(other, common, { session })).toEqual(data);
  expect(readAi2Command(scope, session)).toEqual(saved);
});

test.each([403, 404, 409, 503])('AI2 HTTP %s never retries, rotates UUID or drops the unresolved body', async status => {
  const session = login('student'), saved = saveAi2Command(scope, command('submit'), session);
  const failure = { response: { status, data: { success: false, error: { code: 'SYNTHETIC_ERROR', details: [] } } } };
  axios.post.mockRejectedValueOnce(failure);
  await expect(createAi2Api('student').submit(packageId, saved.body, { session })).rejects.toBe(failure);
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(captureSession('student')).toBe(session);
  expect(readAi2Command(scope, session)).toEqual(saved);
});

test.each(['parent', 'student'])('AI2 %s late success and late 401 cannot affect a replacement session', async role => {
  for (const rejected of [false, true]) {
    const session = login(role), api = createAi2Api(role);
    let settle;
    axios.get.mockImplementationOnce(() => new Promise((resolve, reject) => { settle = rejected ? reject : resolve; }));
    const assertion = expect(api.detail(packageId, { session })).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    const next = login(role, other, 'synthetic-replacement');
    const nextScope = role === 'student' ? { familyId, childId: other } : scope;
    const saved = saveAi2Command(nextScope, command(role === 'student' ? 'submit' : 'publish'), next);
    settle(rejected ? { response: { status: 401 } } : result({ privateText: 'old actor' }));
    await assertion;
    expect((role === 'parent' ? loadParentSession() : loadChildSession()).token).toBe('synthetic-replacement');
    expect(readAi2Command(nextScope, next)).toEqual(saved);
  }
});

test.each(['parent', 'student'])('AI2 %s current 401 retains command for same-actor reauthentication', async role => {
  const session = login(role), saved = saveAi2Command(scope, command(role === 'student' ? 'submit' : 'publish'), session);
  axios.get.mockRejectedValueOnce({ response: { status: 401 } });
  await expect(createAi2Api(role).command(other, { session })).rejects.toMatchObject({ response: { status: 401 } });
  expect(captureSession(role)).toBeNull();
  const next = login(role);
  expect(readAi2Command(scope, next)).toEqual(saved);
  expect(() => finishAi2Command(scope, operationId, session)).toThrow('Session changed');
  expect(() => saveAi2Command(scope, saved, session)).toThrow('Session changed');
});

test('AI2 rejects unsupported role, stale session and role-mismatched transport before dispatch', async () => {
  expect(() => createAi2Api('teacher')).toThrow();
  const stale = captureSession('parent'); login();
  await expect(createAi2Api('parent').packages(childId, 1, { session: stale })).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  await expect(createAi2Api('student').packages(childId, 1, { session: captureSession('parent') })).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  expect(axios.get).not.toHaveBeenCalled();
});

test('AI2 store isolates roles, actors, families and children and rejects student scope substitution', () => {
  const parent = captureSession('parent'), student = login('student');
  saveAi2Command(scope, command(), parent);
  saveAi2Command(scope, command('submit'), student);
  expect(readAi2Command(scope, parent).action).toBe('publish');
  expect(readAi2Command(scope, student).action).toBe('submit');
  expect(readAi2Command({ ...scope, childId: other }, parent)).toBeNull();
  expect(readAi2Command({ ...scope, familyId: other }, parent)).toBeNull();
  expect(() => readAi2Command({ ...scope, childId: other }, student)).toThrow('AI2_SCOPE_INVALID');
  expect(() => readAi2Command({ ...scope, familyId: other }, student)).toThrow('AI2_SCOPE_INVALID');
  expect(() => saveAi2Command(scope, command('submit'), parent)).toThrow('AI2_COMMAND_INVALID');
  expect(() => saveAi2Command(scope, command(), student)).toThrow('AI2_COMMAND_INVALID');
  login('parent', other);
  expect(readAi2Command(scope, captureSession('parent'))).toBeNull();
  expect(readAi2Command(scope, student).action).toBe('submit');
});

test.each(['bad-json', 'missing-field', 'extra-field', 'wrong-role'])('AI2 corrupt data locks rather than overwrites: %s', damage => {
  const session = captureSession('parent'), bad = command();
  if (damage === 'missing-field') delete bad.body.childSnapshotHash;
  if (damage === 'extra-field') bad.body.token = 'must-not-be-trusted';
  const raw = damage === 'bad-json' ? '{broken' : JSON.stringify(damage === 'wrong-role' ? command('submit') : bad);
  sessionStorage.setItem(key(), raw);
  expect(readAi2Command(scope, session)).toEqual({ corrupt: true });
  finishAi2Command(scope, operationId, session);
  expect(() => saveAi2Command(scope, command(), session)).toThrow('AI2_COMMAND_UNRESOLVED');
  expect(sessionStorage.getItem(key())).toBe(raw);
});

test('AI2 unresolved command accepts exact replay only, including array ordering and versions', () => {
  const session = login('student'), saved = saveAi2Command(scope, command('submit'), session);
  expect(saveAi2Command(scope, saved, session)).toEqual(saved);
  for (const body of [{ ...saved.body, operationId: anotherOperation }, { ...saved.body, note: 'edited' },
    { ...saved.body, mediaIds: [...saved.body.mediaIds].reverse() }, { ...saved.body, expectedPackageVersion: 9 }]) {
    expect(() => saveAi2Command(scope, { ...saved, body }, session)).toThrow('AI2_COMMAND_UNRESOLVED');
  }
  expect(readAi2Command(scope, session)).toEqual(saved);
});

test.each(['logout', 'switch', 'child', 'external-exit'])('AI2 clears corrupt canonical owned data on %s only', reason => {
  const owned = key(), sibling = key('parent', actor, other), otherActor = key('parent', other);
  const student = key('student', childId, childId);
  for (const k of [owned, sibling, otherActor, student, 'unrelated']) sessionStorage.setItem(k, '{damaged');
  if (reason === 'logout') clearParentSession();
  if (reason === 'switch') login('parent', other);
  if (reason === 'child') resetChildScope({ previousChildId: childId, nextChildId: other });
  if (reason === 'external-exit') {
    localStorage.setItem(`family-growth.session-exit.v1:parent:${actor}`, JSON.stringify({ revision: 'synthetic-exit', reason: 'explicit_logout' }));
    window.dispatchEvent(new StorageEvent('storage', { key: PARENT_SESSION_KEY }));
  }
  expect(sessionStorage.getItem(owned)).toBeNull();
  expect(sessionStorage.getItem(sibling)).toBe(reason === 'child' ? '{damaged' : null);
  for (const k of [otherActor, student, 'unrelated']) expect(sessionStorage.getItem(k)).toBe('{damaged');
});

test('AI2 student explicit logout after expiry still removes damaged private command', async () => {
  login('student'); sessionStorage.setItem(key('student', childId), '{damaged');
  axios.get.mockRejectedValueOnce({ response: { status: 401 } });
  await expect(createAi2Api('student').command(other)).rejects.toMatchObject({ response: { status: 401 } });
  clearChildSession(); expect(sessionStorage.getItem(key('student', childId))).toBeNull();
});

test('AI2 unavailable storage fails closed without returning a dispatchable command', () => {
  const session = captureSession('parent');
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
  expect(() => saveAi2Command(scope, command(), session)).toThrow('AI2_COMMAND_STORAGE_UNAVAILABLE');
});

test('AI2 operation IDs use UUIDv4 and valid complete bodies round-trip', () => {
  const ids = new Set(Array.from({ length: 16 }, newAi2OperationId));
  expect(ids.size).toBe(16);
  for (const id of ids) expect(id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  for (const action of ['publish', 'withdraw', 'submit', 'review']) expect(validAi2Command(command(action))).toBe(true);
  const review = command('review'); review.body.decision = 'approve'; review.body.comment = '';
  expect(validAi2Command(review)).toBe(true);
  const submit = command('submit'); submit.body.note = '\u{1F600}'.repeat(1000);
  expect(validAi2Command(submit)).toBe(true);
  submit.body.note = '\r\n'.repeat(1000);
  expect(validAi2Command(submit)).toBe(true);
});

const invalidBodies = [
  ['publish', 'schemaVersion', 'ai1-min-v1'], ['publish', 'operationId', anotherOperation.toUpperCase().replace('22222222', 'AAAAAAAA')],
  ['publish', 'cycleId', 'A'.repeat(24)], ['publish', 'artifactId', null], ['publish', 'artifactVersion', 0],
  ['publish', 'expectedCycleStateVersion', Number.MAX_SAFE_INTEGER + 1], ['publish', 'expectedArtifactReviewVersion', 1.5],
  ['publish', 'artifactContentHash', 'bad'], ['publish', 'childSnapshotHash', 'A'.repeat(64)], ['publish', 'childContentConfirmed', false],
  ['withdraw', 'expectedPackageVersion', '2'], ['withdraw', 'reason', ' \n '], ['withdraw', 'reason', 'x'.repeat(501)],
  ['submit', 'note', null], ['submit', 'note', 'x'.repeat(1001)], ['submit', 'note', '\ud800'],
  ['submit', 'mediaIds', []], ['submit', 'mediaIds', [other, other]],
  ['submit', 'mediaIds', Object.assign(new Array(3), { 0: other, 2: actor })],
  ['submit', 'mediaIds', [null]], ['submit', 'mediaIds', Array.from({ length: 11 }, (_, i) => i.toString(16).padStart(24, '0'))],
  ['review', 'expectedAttemptVersion', 0], ['review', 'attemptPayloadHash', 'bad'], ['review', 'decision', 'reject'],
  ['review', 'comment', '  '], ['review', 'comment', 'x'.repeat(1001)]
];
test.each(invalidBodies)('AI2 rejects invalid %s.%s = %j without storing it', (action, field, value) => {
  const session = login(action === 'submit' ? 'student' : 'parent'), invalid = command(action);
  invalid.body[field] = value;
  expect(validAi2Command(invalid)).toBe(false);
  expect(() => saveAi2Command(scope, invalid, session)).toThrow('AI2_COMMAND_INVALID');
  expect(readAi2Command(scope, session)).toBeNull();
});

test.each(['publish', 'withdraw', 'submit', 'review'])('AI2 %s contract is closed and requires every field and exact target shape', action => {
  const valid = command(action);
  for (const field of Object.keys(valid.body)) {
    const invalid = command(action); delete invalid.body[field];
    expect(validAi2Command(invalid)).toBe(false);
  }
  for (const invalid of [
    { ...valid, token: 'forbidden' }, { ...valid, body: { ...valid.body, actorId: actor } },
    { ...valid, targetId: action === 'publish' ? packageId : null },
    { ...valid, attemptId: action === 'review' ? null : attemptId }, { ...valid, action: 'recover' }
  ]) expect(validAi2Command(invalid)).toBe(false);
});
