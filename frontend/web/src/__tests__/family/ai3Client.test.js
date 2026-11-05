import axios from 'axios';
import { captureSession, saveParentSession, saveChildSession, clearParentSession,
  PARENT_SESSION_KEY, CHILD_SESSION_KEY } from '../../services/familySession';
import { resetChildScope } from '../../services/childScope';

const actor = 'a'.repeat(24), familyId = 'b'.repeat(24), childId = 'c'.repeat(24);
const roundId = 'd'.repeat(24), attemptId = 'e'.repeat(24), other = 'f'.repeat(24), digest = '1'.repeat(64);
const operationId = '11111111-1111-4111-8111-111111111111';
const scope = { familyId, childId }, common = { schemaVersion: 'ai3-min-v1', operationId };
const actions = ['create', 'revise_content', 'reject_content', 'publish', 'cancel', 'withdraw', 'generate', 'submit', 'review'];
const key = (role = 'parent', id = actor, child = childId, family = familyId) =>
  'family-growth.ai3-command.v1:' + JSON.stringify([role, id, family, child]);
const login = (role = 'parent', id = role === 'parent' ? actor : childId, token = 'synthetic-session-token') => {
  if (role === 'parent') saveParentSession({ token, user: { id, role } });
  else saveChildSession({ token, child: { childId: id, familyId, name: 'Synthetic' } });
  return captureSession(role);
};
const client = role => {
  expect(() => jest.requireActual('../../services/ai3Api')).not.toThrow();
  return jest.requireActual('../../services/ai3Api').createAi3Api(role);
};
const commands = () => {
  expect(() => jest.requireActual('../../services/ai3Commands')).not.toThrow();
  return jest.requireActual('../../services/ai3Commands');
};
const content = () => ({ instructions: 'Synthetic instructions', exercises: ['q1', 'q2'].map(exerciseId => ({
  exerciseId, questionText: '132 x 24', answerForParent: '3168', rubricForParent: 'Check place values'
})) });
const command = (action = 'create') => ({ action, targetId: action === 'create' ? null : roundId,
  attemptId: action === 'review' ? attemptId : null, body: { ...common, ...{
    create: { sourcePackageId: other, expectedSourcePackageVersion: 1, sourceAttemptId: attemptId,
      expectedSourceAttemptVersion: 1, sourceAttemptPayloadHash: digest, sourceReviewHash: digest,
      exerciseCount: 2, knowledgePointId: null },
    revise_content: { expectedRoundVersion: 1, expectedContentId: null, expectedContentVersion: null,
      expectedContentHash: null, content: content(), reason: 'Synthetic revision' },
    reject_content: { expectedRoundVersion: 2, contentId: other, contentVersion: 1, contentHash: digest, reason: 'Synthetic rejection' },
    publish: { expectedRoundVersion: 2, contentId: other, contentVersion: 1, contentHash: digest,
      childSnapshotHash: digest, childContentConfirmed: true, answersChecked: true },
    cancel: { expectedRoundVersion: 2, reason: 'Synthetic cancellation' },
    withdraw: { expectedRoundVersion: 2, reason: 'Synthetic withdrawal' },
    generate: { expectedRoundVersion: 1, generationInputHash: digest, modelProfileVersion: 'synthetic-model-v1',
      pricingProfileVersion: 'synthetic-price-v1', maxAuthorizedCostMicros: 100, externalSendConfirmed: true, deidentifiedConfirmed: true },
    submit: { expectedRoundVersion: 3, contentId: other, contentVersion: 1, childSnapshotHash: digest,
      note: '  original\r\ntext  ', mediaIds: [actor, other] },
    review: { expectedRoundVersion: 4, contentId: other, contentVersion: 1, contentHash: digest,
      expectedAttemptVersion: 1, attemptPayloadHash: digest, decision: 'approve', comment: '', evidenceSummary: 'Checked both',
      masteryConfirmed: true, reviewReminderDate: '2028-02-29', reviewContextHash: digest }
  }[action] } });
const result = data => ({ data: { success: true, data } });
const send = (api, c, options) => c.action === 'create' ? api.create(c.body, options)
  : c.action === 'review' ? api.review(c.targetId, c.attemptId, c.body, options)
    : api[{ revise_content: 'reviseContent', reject_content: 'rejectContent' }[c.action] || c.action](c.targetId, c.body, options);
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); jest.resetAllMocks(); login(); });
afterEach(() => jest.restoreAllMocks());

test.each(['parent', 'student'])('AI3 %s GET paths, filters and session options are exact', async role => {
  const session = login(role), signal = new AbortController().signal, options = { session, signal };
  const api = client(role); axios.get.mockResolvedValue(result({ items: [] }));
  await api.rounds(childId, 2, options, { reviewFrom: '2026-01-01', reviewTo: '2026-12-31' });
  await api.detail(roundId, options); await api.generationPreview(roundId, options); await api.publicationPreview(roundId, options);
  await api.attempts(roundId, 3, options); await api.attempt(roundId, attemptId, options);
  await api.reviewContext(roundId, attemptId, options); await api.commands(childId, 4, options); await api.command(other, options);
  const base = `/api/ai3/practice-rounds/${roundId}`;
  expect(axios.get.mock.calls.map(([path]) => path)).toEqual([
    `/api/ai3/practice-rounds?childId=${childId}&page=2&pageSize=20&reviewFrom=2026-01-01&reviewTo=2026-12-31`,
    base, `${base}/generation-preview`, `${base}/publication-preview`, `${base}/attempts?page=3&pageSize=20`,
    `${base}/attempts/${attemptId}`, `${base}/attempts/${attemptId}/review-context`,
    `/api/ai3/commands?childId=${childId}&scope=mine&page=4&pageSize=20`, `/api/ai3/commands/${other}`
  ]);
  for (const [, config] of axios.get.mock.calls) expect(config).toEqual({ signal, headers: { Authorization: 'Bearer synthetic-session-token' } });
});
test('AI3 encodes route identifiers and permits omitted child filter', async () => {
  const api = client('student'); login('student'); axios.get.mockResolvedValue(result({}));
  await api.rounds(undefined, 1, undefined, { reviewFrom: '', reviewTo: '' }); await api.attempt('a/b', 'c?d');
  expect(axios.get.mock.calls.map(([path]) => path)).toEqual(['/api/ai3/practice-rounds?page=1&pageSize=20',
    '/api/ai3/practice-rounds/a%2Fb/attempts/c%3Fd']);
});
test.each(actions)('AI3 %s sends all original keys, and lost response never retries or clears command', async action => {
  const session = login(action === 'submit' ? 'student' : 'parent'), api = client(session.role), C = commands();
  const original = command(action), expected = JSON.parse(JSON.stringify(original));
  const saved = C.saveAi3Command(scope, original, session); original.body.operationId = 'changed';
  axios.post.mockRejectedValueOnce(Error('response lost'));
  await expect(send(api, saved, { session })).rejects.toThrow('response lost');
  expect(axios.post).toHaveBeenCalledTimes(1); expect(axios.post.mock.calls[0][1]).toEqual(expected.body);
  expect(C.readAi3Command(scope, session)).toEqual(expected);
  expect(sessionStorage.getItem(key(session.role, session.actorId))).not.toContain(session.token);
  const body = { ...saved.body, unknown: { mustReachServer: true } };
  axios.post.mockResolvedValue(result({ command: { phase: 'EFFECTS_PENDING' } }));
  await send(api, { ...saved, body }, { session }); expect(axios.post.mock.calls[1][1]).toBe(body);
  C.finishAi3Command(scope, 'wrong', session); expect(C.readAi3Command(scope, session)).toEqual(expected);
  C.finishAi3Command(scope, operationId, session); expect(C.readAi3Command(scope, session)).toBeNull();
});
test('AI3 all POST paths including recover are fixed and recovery body is not projected', async () => {
  const api = client('parent'); axios.post.mockResolvedValue(result({}));
  for (const action of actions) await send(api, command(action));
  const body = { ...common, forbidden: true }; await api.recover(other, body);
  const base = `/api/ai3/practice-rounds/${roundId}`;
  expect(axios.post.mock.calls.map(([path]) => path)).toEqual(['/api/ai3/practice-rounds', `${base}/content-revisions`,
    `${base}/reject-content`, `${base}/publish`, `${base}/cancel`, `${base}/withdraw`, `${base}/generate`, `${base}/attempts`,
    `${base}/attempts/${attemptId}/review`, `/api/ai3/commands/${other}/recover`]);
  expect(axios.post.mock.calls[9][1]).toBe(body);
});
test.each(actions)('AI3 %s closed command requires every key and valid target shape', action => {
  const C = commands(), valid = command(action); expect(C.validAi3Command(valid)).toBe(true);
  for (const field of Object.keys(valid.body)) {
    const bad = command(action); delete bad.body[field]; expect(C.validAi3Command(bad)).toBe(false);
  }
  for (const bad of [{ ...valid, extra: true }, { ...valid, body: { ...valid.body, actorId: actor } },
    { ...valid, targetId: action === 'create' ? roundId : null },
    { ...valid, attemptId: action === 'review' ? null : attemptId }, { ...valid, action: 'recover' }]) expect(C.validAi3Command(bad)).toBe(false);
});
test.each([
  ['create', 'exerciseCount', 4], ['create', 'knowledgePointId', 'bad'], ['publish', 'answersChecked', false],
  ['generate', 'maxAuthorizedCostMicros', -1], ['generate', 'externalSendConfirmed', false], ['generate', 'deidentifiedConfirmed', false],
  ['generate', 'pricingProfileVersion', ''], ['cancel', 'reason', '  '], ['withdraw', 'expectedRoundVersion', 0],
  ['submit', 'mediaIds', []], ['submit', 'mediaIds', [actor, actor]], ['submit', 'mediaIds', new Array(2)],
  ['submit', 'mediaIds', Array.from({ length: 11 }, (_, i) => i.toString(16).padStart(24, '0'))],
  ['submit', 'note', '\ud800'], ['submit', 'note', 'x'.repeat(1001)], ['review', 'reviewReminderDate', '2026-02-29'],
  ['review', 'reviewContextHash', null], ['review', 'masteryConfirmed', 'true'], ['review', 'evidenceSummary', ' '],
  ['review', 'expectedAttemptVersion', Number.MAX_SAFE_INTEGER + 1], ['review', 'decision', 'reject'],
  ['revise_content', 'expectedContentId', actor]
])('AI3 rejects malformed %s.%s', (action, field, value) => {
  const C = commands(), bad = command(action); bad.body[field] = value;
  expect(C.validAi3Command(bad)).toBe(false);
});
test('AI3 content nested shapes, exercise ordering, URL/HTML and revision triples are closed', () => {
  const C = commands();
  for (const change of [c => { c.body.content.extra = true; }, c => { c.body.content.exercises[0].extra = true; },
    c => { c.body.content.exercises.reverse(); }, c => { c.body.content.exercises = new Array(2); },
    c => { c.body.content.exercises[0].questionText = '<b>text</b>'; },
    c => { c.body.content.exercises[0].answerForParent = 'https://example.test'; }]) {
    const bad = command('revise_content'); change(bad); expect(C.validAi3Command(bad)).toBe(false);
  }
  const valid = command('revise_content'); Object.assign(valid.body, { expectedContentId: other, expectedContentVersion: 2, expectedContentHash: digest });
  expect(C.validAi3Command(valid)).toBe(true);
});
test('AI3 revise review and Unicode/CRLF preserve original values without normalization', () => {
  const C = commands(), value = command('review'); Object.assign(value.body, { decision: 'revise', comment: '  Check again\r\n',
    evidenceSummary: '', masteryConfirmed: false, reviewReminderDate: null, reviewContextHash: null });
  expect(C.validAi3Command(value)).toBe(true);
  expect(C.saveAi3Command(scope, value, captureSession('parent'))).toEqual(value);
  value.body.evidenceSummary = 'not permitted'; expect(C.validAi3Command(value)).toBe(false);
  const submit = command('submit'); submit.body.note = '\u{1F600}'.repeat(1000); expect(C.validAi3Command(submit)).toBe(true);
});
test.each(['parent', 'student'])('AI3 %s replacement identity fences late success and late 401', async role => {
  for (const rejected of [false, true]) {
    const session = login(role), api = client(role); let settle;
    axios.get.mockImplementationOnce(() => new Promise((resolve, reject) => { settle = rejected ? reject : resolve; }));
    const pending = expect(api.detail(roundId, { session })).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
    const next = login(role, other, 'replacement');
    settle(rejected ? { response: { status: 401 } } : result({ private: 'old' })); await pending;
    expect(captureSession(role)).toBe(next);
  }
});
test('AI3 parent child switch rejects already in-flight response without exposing it', async () => {
  const api = client('parent'); let resolve;
  axios.get.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const pending = expect(api.detail(roundId)).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  resetChildScope({ previousChildId: childId, nextChildId: other }); resolve(result({ private: 'old child' })); await pending;
});
test.each(['logout', 'switch', 'child', 'external-exit'])('AI3 corrupt body is cleared by canonical ownership on %s', reason => {
  commands(); const owned = key(), sibling = key('parent', actor, other), foreign = key('parent', other);
  for (const k of [owned, sibling, foreign, 'unrelated']) sessionStorage.setItem(k, '{damaged');
  if (reason === 'logout') clearParentSession();
  if (reason === 'switch') login('parent', other);
  if (reason === 'child') resetChildScope({ previousChildId: childId, nextChildId: other });
  if (reason === 'external-exit') {
    localStorage.setItem(`family-growth.session-exit.v1:parent:${actor}`, JSON.stringify({ revision: 'exit', reason: 'explicit_logout' }));
    window.dispatchEvent(new StorageEvent('storage', { key: PARENT_SESSION_KEY }));
  }
  expect(sessionStorage.getItem(owned)).toBeNull(); expect(sessionStorage.getItem(sibling)).toBe(reason === 'child' ? '{damaged' : null);
  expect(sessionStorage.getItem(foreign)).toBe('{damaged'); expect(sessionStorage.getItem('unrelated')).toBe('{damaged');
});
test('AI3 role actor family child isolation, corrupt lock and exact replay are enforced', () => {
  const C = commands(), parent = captureSession('parent'), student = login('student');
  const saved = C.saveAi3Command(scope, command(), parent); C.saveAi3Command(scope, command('submit'), student);
  expect(C.readAi3Command(scope, parent)).toEqual(saved);
  expect(C.readAi3Command({ ...scope, childId: other }, parent)).toBeNull();
  expect(C.readAi3Command({ ...scope, familyId: other }, parent)).toBeNull();
  expect(() => C.readAi3Command({ ...scope, childId: other }, student)).toThrow('AI3_SCOPE_INVALID');
  expect(() => C.readAi3Command({ ...scope, familyId: other }, student)).toThrow('AI3_SCOPE_INVALID');
  expect(() => C.saveAi3Command(scope, command('submit'), parent)).toThrow('AI3_COMMAND_INVALID');
  expect(() => C.saveAi3Command(scope, command(), student)).toThrow('AI3_COMMAND_INVALID');
  expect(() => C.saveAi3Command(scope, command('publish'), parent)).toThrow('AI3_COMMAND_UNRESOLVED');
  sessionStorage.setItem(key(), '{broken'); expect(C.readAi3Command(scope, parent)).toEqual({ corrupt: true });
  C.finishAi3Command(scope, operationId, parent); expect(sessionStorage.getItem(key())).toBe('{broken');
  expect(() => C.saveAi3Command(scope, saved, parent)).toThrow('AI3_COMMAND_UNRESOLVED');
});
test.each([403, 404, 409, 503])('AI3 error %s retains unresolved original command with zero retries', async status => {
  const C = commands(), session = login('student'), saved = C.saveAi3Command(scope, command('submit'), session);
  axios.post.mockRejectedValueOnce({ response: { status } });
  await expect(client('student').submit(roundId, saved.body, { session })).rejects.toMatchObject({ response: { status } });
  expect(axios.post).toHaveBeenCalledTimes(1); expect(C.readAi3Command(scope, session)).toEqual(saved);
});
// Contract correction: expired AI3 identities clear private staging; only explicit server discovery resumes the original operation.
test.each(['parent', 'student'].flatMap(role => [false, true].map(corrupt => [role, corrupt])))(
  'AI3 current %s expiry clears owned private/corrupt=%s commands without changing older protocol recovery', async (role, corrupt) => {
    const C = commands(), session = login(role), original = command(role === 'student' ? 'submit' : 'review');
    C.saveAi3Command(scope, original, session);
    const owned = key(role, session.actorId), opposite = key(role === 'parent' ? 'student' : 'parent', other, other);
    const foreign = key(role, other, other), ai2 = owned.replace('ai3-command', 'ai2-command');
    const completion = 'family-growth.completion-command.v1:' + JSON.stringify([
      session.actorId, role, familyId, childId, roundId, role === 'student' ? 'complete' : 'confirm']);
    const tutor = 'family-growth.ai1-command.v1:' + JSON.stringify([session.actorId, familyId, childId]);
    for (const k of [opposite, foreign, ai2, completion, tutor, 'unrelated']) sessionStorage.setItem(k, '{preserve');
    if (corrupt) sessionStorage.setItem(owned, '{private-damaged');
    axios.get.mockRejectedValueOnce({ response: { status: 401 } });
    await expect(client(role).command(other, { session })).rejects.toMatchObject({ response: { status: 401 } });
    expect(captureSession(role)).toBeNull(); expect(sessionStorage.getItem(owned)).toBeNull();
    for (const k of [opposite, foreign, ai2, completion, tutor, 'unrelated']) expect(sessionStorage.getItem(k)).toBe('{preserve');
    const next = login(role); expect(C.readAi3Command(scope, next)).toBeNull();
    expect(axios.post).not.toHaveBeenCalled(); expect(axios.get).toHaveBeenCalledTimes(1);
    axios.get.mockResolvedValueOnce(result({ items: [{ id: other, operationId, phase: 'EFFECTS_PENDING' }] }));
    const discovered = await client(role).commands(childId, 1, { session: next });
    expect(discovered.items[0].operationId).toBe(operationId); expect(axios.post).not.toHaveBeenCalled();
    axios.post.mockResolvedValueOnce(result({ command: discovered.items[0] }));
    await client(role).recover(discovered.items[0].id, { ...common, operationId: discovered.items[0].operationId }, { session: next });
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][1]).toEqual(common);
  });
test.each(['parent', 'student'])('AI3 late old %s 401 never clears replacement account command', async role => {
  const C = commands(), old = login(role), api = client(role); let reject;
  axios.get.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  const pending = expect(api.command(roundId, { session: old })).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  const next = login(role, other, 'replacement'), nextScope = { ...scope, childId: role === 'student' ? other : childId };
  const saved = C.saveAi3Command(nextScope, command(role === 'student' ? 'submit' : 'review'), next);
  reject({ response: { status: 401 } }); await pending;
  expect(captureSession(role)).toBe(next); expect(C.readAi3Command(nextScope, next)).toEqual(saved);
  expect(axios.post).not.toHaveBeenCalled();
});
test.each(['parent', 'student'].flatMap(role => ['storage', 'pageshow'].map(event => [role, event])))(
  'AI3 %s %s reconciles expiry without clearing AI2 or replaying after reauthentication', (role, event) => {
    const C = commands(), session = login(role), owned = key(role, session.actorId);
    const ai2 = owned.replace('ai3-command', 'ai2-command');
    sessionStorage.setItem(owned, '{private-damaged'); sessionStorage.setItem(ai2, '{legacy-preserve');
    const marker = `family-growth.ai3-session-expiry.v1:${role}:${session.actorId}`;
    localStorage.setItem(marker, JSON.stringify({ revision: 'remote-expiry', reason: 'expired' }));
    const sessionKey = role === 'parent' ? PARENT_SESSION_KEY : CHILD_SESSION_KEY;
    if (event === 'storage') {
      localStorage.removeItem(sessionKey);
      window.dispatchEvent(new StorageEvent('storage', { key: marker }));
    } else {
      // A suspended tab can miss both expiry and same-actor login storage events.
      const replacement = JSON.parse(localStorage.getItem(sessionKey)); replacement.token = 'replacement'; replacement.revision = 'new-login';
      localStorage.setItem(sessionKey, JSON.stringify(replacement));
      localStorage.setItem(`family-growth.session-change.v1:${role}`, JSON.stringify({ actorId: session.actorId, reason: 'authenticated' }));
      window.dispatchEvent(new Event('pageshow'));
    }
    expect(sessionStorage.getItem(owned)).toBeNull(); expect(sessionStorage.getItem(ai2)).toBe('{legacy-preserve');
    const next = event === 'storage' ? (login(role), captureSession(role)) : captureSession(role);
    expect(C.readAi3Command(scope, next)).toBeNull(); expect(axios.get).not.toHaveBeenCalled(); expect(axios.post).not.toHaveBeenCalled();
    const saved = C.saveAi3Command(scope, command(role === 'student' ? 'submit' : 'review'), next);
    window.dispatchEvent(new Event('pageshow'));
    expect(C.readAi3Command(scope, next)).toEqual(saved);
  });
test('AI3 malformed success envelope and inaccessible storage fail closed', async () => {
  const C = commands(), session = captureSession('parent'), saved = C.saveAi3Command(scope, command(), session);
  axios.post.mockResolvedValueOnce({ data: { success: true, data: [] } });
  await expect(client('parent').create(saved.body)).rejects.toMatchObject({ code: 'AI3_RESPONSE_UNVERIFIED' });
  expect(C.readAi3Command(scope, session)).toEqual(saved);
  C.finishAi3Command(scope, operationId, session); jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
  expect(() => C.saveAi3Command(scope, command(), session)).toThrow('AI3_COMMAND_STORAGE_UNAVAILABLE');
});
test('AI3 preview wrappers and raw review context are preserved, never silently projected', async () => {
  const api = client('parent'), preview = { contentHash: digest }, context = { reviewContextHash: digest };
  axios.get.mockResolvedValueOnce(result({ preview })).mockResolvedValueOnce(result({ preview })).mockResolvedValueOnce(result(context));
  expect(await api.generationPreview(roundId)).toEqual({ preview });
  expect(await api.publicationPreview(roundId)).toEqual({ preview });
  expect(await api.reviewContext(roundId, attemptId)).toBe(context);
});
test('AI3 cannot dispatch through stale, wrong-role or unsupported sessions', async () => {
  expect(() => client('teacher')).toThrow(); const old = captureSession('parent'); login();
  await expect(client('parent').detail(roundId, { session: old })).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  await expect(client('student').detail(roundId, { session: captureSession('parent') })).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  expect(axios.get).not.toHaveBeenCalled();
});
test('AI3 UUIDs, byte limits, nested property descriptors and years align with the server contract', () => {
  const C = commands(), ids = new Set(Array.from({ length: 16 }, C.newAi3OperationId)); expect(ids.size).toBe(16);
  for (const value of ids) expect(value).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  const oversized = command('revise_content'); oversized.body.content.exercises.push({ ...oversized.body.content.exercises[0], exerciseId: 'q3' });
  for (const item of oversized.body.content.exercises) for (const key of ['questionText', 'answerForParent', 'rubricForParent']) item[key] = '\u{1F600}'.repeat(1000);
  expect(C.validAi3Command(oversized)).toBe(false);
  const accessor = command('submit'); Object.defineProperty(accessor.body.mediaIds, '0', { get: () => actor, enumerable: true });
  expect(C.validAi3Command(accessor)).toBe(false);
  for (const date of ['0000-01-01', '0099-01-01', '2026-04-31']) {
    const value = command('review'); value.body.reviewReminderDate = date; expect(C.validAi3Command(value)).toBe(false);
  }
});
