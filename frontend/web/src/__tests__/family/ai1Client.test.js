import axios from 'axios';
import { tutorApi } from '../../services/tutorApi';
import { confirmedTutorResult } from '../../services/tutorResponse';
import { readTutorCommand, saveTutorCommand, finishTutorCommand, tutorCommandKey } from '../../services/tutorCommands';
import { captureSession, saveParentSession, clearParentSession, expireParentSession,
  loadParentSession, PARENT_SESSION_KEY } from '../../services/familySession';
import { resetChildScope } from '../../services/childScope';

const actor = 'a'.repeat(24), familyId = 'b'.repeat(24), childId = 'c'.repeat(24), cycleId = 'd'.repeat(24);
const operationId = '11111111-1111-4111-8111-111111111111';
const scope = { familyId, childId };
const login = (id = actor, token = 'synthetic-parent') => saveParentSession({ token, user: { id, role: 'parent' } });
const command = () => ({ action: 'generate', targetId: cycleId, body: { schemaVersion: 'ai1-min-v1', operationId,
  expectedCycleStateVersion: 1, generationInputHash: 'e'.repeat(64), modelProfileVersion: 'model-synthetic',
  pricingProfileVersion: 'price-synthetic', maxAuthorizedCostMicros: 184320, externalSendConfirmed: true } });
const result = data => ({ data: { success: true, data } });
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); jest.clearAllMocks(); login(); });

test('AI1 client preserves exact versioned command, session and abort without transport retry', async () => {
  const snapshot = captureSession('parent'), signal = new AbortController().signal, pending = command();
  axios.post.mockRejectedValueOnce(new Error('lost response'));
  await expect(tutorApi.generate(cycleId, pending.body, { session: snapshot, signal })).rejects.toThrow('lost response');
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.post).toHaveBeenCalledWith(`/api/tutor-cycles/${cycleId}/explanation-jobs`, pending.body,
    expect.objectContaining({ headers: { Authorization: 'Bearer synthetic-parent' }, signal }));
});
test('AI1 reads and all write actions use the narrow public endpoints', async () => {
  axios.get.mockResolvedValue(result({ items: [] })); axios.post.mockResolvedValue(result({ cycle: { id: cycleId } }));
  await tutorApi.cycles(childId, 2); await tutorApi.jobs(childId, 1);
  await tutorApi.detail(cycleId); await tutorApi.job(cycleId); await tutorApi.artifact(cycleId);
  expect(axios.get.mock.calls.map(c => c[0])).toEqual([
    `/api/tutor-cycles?childId=${childId}&page=2&pageSize=20`,
    `/api/tutor-jobs?childId=${childId}&scope=mine-unfinished&page=1&pageSize=20`,
    `/api/tutor-cycles/${cycleId}`, `/api/tutor-jobs/${cycleId}`, `/api/tutor-artifacts/${cycleId}`]);
  await tutorApi.create({ operationId });
  for (const action of ['recover', 'revise', 'review', 'close']) await tutorApi[action](cycleId, { operationId });
  expect(axios.post.mock.calls.map(c => c[0])).toEqual(['/api/tutor-cycles', `/api/tutor-jobs/${cycleId}/recover`,
    `/api/tutor-cycles/${cycleId}/explanation-revisions`, `/api/tutor-cycles/${cycleId}/explanation-review`, `/api/tutor-cycles/${cycleId}/cancel`]);
});
test.each([false, true])('AI1 stale success/401 cannot affect the new parent: reject=%s', async reject => {
  let settle;
  axios.get.mockImplementationOnce(() => new Promise((resolve, fail) => { settle = reject ? fail : resolve; }));
  const request = tutorApi.detail(cycleId);
  const assertion = expect(request).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  login('f'.repeat(24), 'new-parent');
  settle(reject ? { response: { status: 401 } } : result({ privateText: 'old' }));
  await assertion; expect(loadParentSession().token).toBe('new-parent');
});
test('AI1 pending command is cloned, survives reload/expiry and only exact completion clears it', () => {
  const session = captureSession('parent'), original = command();
  saveTutorCommand(scope, original, session); original.body.maxAuthorizedCostMicros = 1;
  expect(readTutorCommand(scope, session).body.maxAuthorizedCostMicros).toBe(184320);
  expect(() => saveTutorCommand(scope, { ...command(), body: { ...command().body, operationId: '22222222-2222-4222-8222-222222222222' } }, session))
    .toThrow();
  finishTutorCommand(scope, '22222222-2222-4222-8222-222222222222', session);
  expect(readTutorCommand(scope, session).body.operationId).toBe(operationId);
  expireParentSession(session); login();
  const next = captureSession('parent');
  expect(readTutorCommand(scope, next).body.operationId).toBe(operationId);
  finishTutorCommand(scope, operationId, next); expect(readTutorCommand(scope, next)).toBeNull();
});
test.each(['logout', 'switch', 'child'])('AI1 damaged pending command is cleared on %s', reason => {
  const session = captureSession('parent'), key = tutorCommandKey(scope, session);
  sessionStorage.setItem(key, '{damaged');
  expect(readTutorCommand(scope, session)).toEqual({ corrupt: true });
  if (reason === 'logout') clearParentSession();
  if (reason === 'switch') login('f'.repeat(24));
  if (reason === 'child') resetChildScope({ previousChildId: childId, nextChildId: 'e'.repeat(24) });
  expect(sessionStorage.getItem(key)).toBeNull();
});
test('AI1 suspended tab observes explicit exit marker and clears damaged private command', () => {
  const old = captureSession('parent'), key = tutorCommandKey(scope, old);
  sessionStorage.setItem(key, '{damaged');
  localStorage.setItem(`family-growth.session-exit.v1:parent:${actor}`, JSON.stringify({ revision: 'synthetic-exit', reason: 'explicit_logout' }));
  window.dispatchEvent(new StorageEvent('storage', { key: PARENT_SESSION_KEY }));
  expect(sessionStorage.getItem(key)).toBeNull();
});
test('AI1 old session cannot write or clear commands after reauthentication', () => {
  const old = captureSession('parent'); saveTutorCommand(scope, command(), old); login();
  expect(() => finishTutorCommand(scope, operationId, old)).toThrow('Session changed');
  expect(() => saveTutorCommand(scope, command(), old)).toThrow('Session changed');
  expect(readTutorCommand(scope, captureSession('parent')).body.operationId).toBe(operationId);
});
test.each(['missing', 'extra', 'type'])('AI1 parseable damaged command stays locked: %s', damage => {
  const session = captureSession('parent'), value = command();
  if (damage === 'missing') delete value.body.generationInputHash;
  if (damage === 'extra') value.body.actorId = actor;
  if (damage === 'type') value.body.maxAuthorizedCostMicros = '184320';
  const key = tutorCommandKey(scope, session), raw = JSON.stringify(value);
  sessionStorage.setItem(key, raw);
  expect(readTutorCommand(scope, session)).toEqual({ corrupt: true });
  finishTutorCommand(scope, operationId, session);
  expect(sessionStorage.getItem(key)).toBe(raw);
  expect(() => saveTutorCommand(scope, command(), session)).toThrow();
});
test('AI1 cleanup preserves other actors, children and unrelated completion commands', () => {
  const session = captureSession('parent'), key = tutorCommandKey(scope, session);
  const otherChild = tutorCommandKey({ familyId, childId: 'e'.repeat(24) }, session);
  const otherActor = 'family-growth.ai1-command.v1:' + JSON.stringify(['f'.repeat(24), familyId, childId]);
  for (const k of [key, otherChild, otherActor, 'unrelated-command']) sessionStorage.setItem(k, '{damaged');
  resetChildScope({ previousChildId: childId, nextChildId: 'e'.repeat(24) });
  expect(sessionStorage.getItem(key)).toBeNull();
  for (const k of [otherChild, otherActor, 'unrelated-command']) expect(sessionStorage.getItem(k)).toBe('{damaged');
  clearParentSession(); expect(sessionStorage.getItem(otherChild)).toBeNull();
  for (const k of [otherActor, 'unrelated-command']) expect(sessionStorage.getItem(k)).toBe('{damaged');
});

test.each([{}, { success: false, data: {} }, { success: true }, { success: true, data: null }, { success: true, data: [] }])(
  'AI1 transport never treats a malformed success envelope as a confirmed write: %j', async data => {
    axios.post.mockResolvedValueOnce({ data });
    await expect(tutorApi.generate(cycleId, command().body)).rejects.toMatchObject({ code: 'AI_RESPONSE_UNVERIFIED' });
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

const resultCases = () => {
  const artifactId = '1'.repeat(24), jobId = '2'.repeat(24), contentHash = '3'.repeat(64);
  const seen = { artifactId, artifactVersion: 1, artifactContentHash: contentHash,
    expectedArtifactReviewVersion: 1, expectedCycleStateVersion: 2 };
  const cycle = { id: cycleId, childId, stateVersion: 1, status: 'ready', createdBy: actor, source: { type: 'task', id: '4'.repeat(24) } };
  const job = { id: jobId, cycleId, operationId, createdBy: actor, status: 'unknown' };
  const artifact = { id: artifactId, cycleId, contentHash, text: 'Synthetic text', version: 1, reviewVersion: 2,
    status: 'parent_approved', review: { reviewerId: actor, decision: 'approve' } };
  return [
    ['create', null, { source: cycle.source }, { cycle, preview: { generationInputHash: contentHash } }],
    ['generate', cycleId, command().body, { job }],
    ['recover', jobId, { operationId }, { job }],
    ['revise', cycleId, seen, { artifact: { ...artifact, id: '5'.repeat(24), version: 2, reviewVersion: 1,
      status: 'candidate', origin: 'parent_revision', createdBy: actor, derivedFromArtifactId: artifactId }, cycleStateVersion: 3 }],
    ['review', cycleId, { ...seen, decision: 'approve' }, { artifact, cycleStateVersion: 3 }],
    ['close', cycleId, { expectedCycleStateVersion: 2 }, { cycle: { ...cycle, status: 'closed', stateVersion: 3 } }]
  ];
};
test.each(resultCases())('AI1 %s validates its own result linkage before completing a command', (action, targetId, body, result) => {
  const saved = { action, targetId, body }, session = captureSession('parent');
  expect(confirmedTutorResult(saved, result, scope, session)).toBe(cycleId);
  for (const missing of [undefined, {}, { ...result, cycle: undefined, job: undefined, artifact: undefined }]) {
    expect(() => confirmedTutorResult(saved, missing, scope, session)).toThrow('Unverified AI1 response');
  }
  const wrong = JSON.parse(JSON.stringify(result));
  if (wrong.cycle) wrong.cycle.childId = '9'.repeat(24);
  if (wrong.job) wrong.job.createdBy = '9'.repeat(24);
  if (wrong.artifact) wrong.artifact.cycleId = '9'.repeat(24);
  expect(() => confirmedTutorResult(saved, wrong, scope, session)).toThrow('Unverified AI1 response');
});
test('AI1 generation UUID, recovery Job and reviewed version/hash cannot be substituted', () => {
  for (const [action, targetId, body, result] of resultCases().filter(([action]) => ['generate', 'recover', 'review'].includes(action))) {
    if (action === 'generate') result.job.operationId = '22222222-2222-4222-8222-222222222222';
    if (action === 'recover') result.job.id = '9'.repeat(24);
    if (action === 'review') result.artifact.contentHash = '9'.repeat(64);
    expect(() => confirmedTutorResult({ action, targetId, body }, result, scope, captureSession('parent'))).toThrow('Unverified AI1 response');
  }
});
