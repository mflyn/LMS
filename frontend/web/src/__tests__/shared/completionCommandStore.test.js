import { randomFillSync } from 'crypto';
import * as commandStore from '../../services/completionCommandStore';

const api = () => commandStore;
const id = n => n.toString(16).padStart(24, '0');
const operationId = 'abcdef01-2345-4678-9123-abcdef012345';
const scope = { actorId: id(1), role: 'parent', familyId: id(2), childId: id(3), taskId: id(4) };
const input = () => ({ operationId, expectedCompletionVersion: 0, expectedChecklistVersion: 0,
  checkedItemIds: ['a', 'b'], completionMediaIds: [id(11), id(10)], actualMinutes: 0, childNote: 'note' });
const envelope = (action = 'complete') => ({ schemaVersion: 1, scope: { ...scope }, action,
  body: action === 'complete' ? input() : { expectedCompletionVersion: 0, parentFeedback: 'new feedback' }, uncertain: false });
const error = (status, code) => ({ response: { status, data: { success: false, error: { code, message: 'Synthetic rejection', details: [] } } } });
const completed = () => ({ task: { taskId: id(4), status: 'completed', checklistVersion: 0, completionVersion: 1,
  completionMediaIds: [id(11), id(10)], completionMediaReferenceState: 'stable', parentConfirmed: false,
  completedAt: '2026-10-24T00:00:00.000Z' } });
const confirmed = () => ({ task: { taskId: id(4), status: 'confirmed', checklistVersion: 0, completionVersion: 0,
  completionMediaIds: [], completionMediaReferenceState: 'stable', parentConfirmed: true, parentFeedback: 'first feedback',
  confirmedByParentId: id(9), confirmedAt: '2026-10-24T01:00:00.000Z', completedAt: '2026-10-24T00:00:00.000Z', starAwardState: 'awarded' } });
const originalCrypto = Object.getOwnPropertyDescriptor(window, 'crypto');

beforeEach(() => {
  api(); sessionStorage.clear(); localStorage.clear();
  // This repository's jsdom lacks Web Crypto; use real CSPRNG bytes in the test host.
  Object.defineProperty(window, 'crypto', { configurable: true,
    value: { getRandomValues: values => randomFillSync(values) } });
});
afterEach(() => {
  jest.restoreAllMocks();
  if (originalCrypto) Object.defineProperty(window, 'crypto', originalCrypto);
  else delete window.crypto;
});

test('normalizes only public fields without changing media order, zero or false', () => {
  const source = { ...input(), operationId: operationId.toUpperCase(), checkedItemIds: ['b', 'a'],
    completionMediaIds: [id(11).toUpperCase(), id(10)], actualAmount: 0, needsHelp: false, childNote: ' note ',
    token: 'never persist', url: 'https://private.invalid', bytes: new Uint8Array([1]), remoteOperationId: 'private' };
  expect(api().normalizeCompletionBody(source)).toEqual({ ...input(), actualAmount: 0, needsHelp: false });
  expect(source.checkedItemIds).toEqual(['b', 'a']);
});
test('blank optional numeric inputs are omitted, not converted to zero', () => {
  const value = api().normalizeCompletionBody({ ...input(), actualMinutes: '', actualAmount: '  ', needsHelp: undefined });
  expect(value).not.toHaveProperty('actualMinutes'); expect(value).not.toHaveProperty('actualAmount'); expect(value).not.toHaveProperty('needsHelp');
});
test.each(['operationId', 'expectedCompletionVersion', 'expectedChecklistVersion', 'checkedItemIds', 'completionMediaIds'])(
'missing required %s is never defaulted', field => {
  const value = input(); delete value[field]; expect(() => api().normalizeCompletionBody(value)).toThrow();
});
test.each([
  ['operationId', operationId + '\n'], ['operationId', 'not-uuid'],
  ['expectedCompletionVersion', null], ['expectedCompletionVersion', '0'], ['expectedCompletionVersion', -1],
  ['expectedCompletionVersion', Number.MAX_SAFE_INTEGER], ['expectedChecklistVersion', undefined], ['expectedChecklistVersion', 0.5],
  ['checkedItemIds', ['a', 'a']], ['checkedItemIds', Array(6).fill('a')], ['checkedItemIds', ['']], ['checkedItemIds', [null]],
  ['completionMediaIds', [id(10), id(10).toUpperCase()]], ['completionMediaIds', Array.from({ length: 11 }, (_, n) => id(n))],
  ['completionMediaIds', [id(10) + '\n']], ['completionMediaIds', null],
  ['actualMinutes', null], ['actualMinutes', -1], ['actualMinutes', Infinity], ['actualAmount', NaN], ['actualAmount', '0'],
  ['needsHelp', null], ['needsHelp', 0], ['difficulty', 'unknown'], ['difficulty', null], ['childNote', null]
])('rejects invalid completion %s=%s', (field, value) => {
  expect(() => api().normalizeCompletionBody({ ...input(), [field]: value })).toThrow();
});
test.each([0, 1, 10])('keeps %s ordered media IDs', count => {
  const ids = Array.from({ length: count }, (_, n) => id(30 - n));
  expect(api().normalizeCompletionBody({ ...input(), completionMediaIds: ids }).completionMediaIds).toEqual(ids);
});
test('checklist identifiers retain case and whitespace as the backend does', () => {
  expect(api().normalizeCompletionBody({ ...input(), checkedItemIds: ['a', ' A ', 'A'] }).checkedItemIds).toEqual([' A ', 'A', 'a']);
});
test('confirmation is versioned, trimmed, public-only and contains no generated operation ID', () => {
  expect(api().normalizeConfirmationBody({ expectedCompletionVersion: 0, parentFeedback: ' first ', operationId, token: 'private' }))
    .toEqual({ expectedCompletionVersion: 0, parentFeedback: 'first' });
  expect(api().normalizeConfirmationBody({ expectedCompletionVersion: 0 })).toEqual({ expectedCompletionVersion: 0 });
});
test.each([{}, { expectedCompletionVersion: null }, { expectedCompletionVersion: '0' },
  { expectedCompletionVersion: -1 }, { expectedCompletionVersion: 0, parentFeedback: null }])(
'invalid confirmation is rejected %j', value => { expect(() => api().normalizeConfirmationBody(value)).toThrow(); });

test('create generates one UUID, persists and read-validates a deeply frozen snapshot', () => {
  const random = jest.spyOn(window.crypto, 'getRandomValues');
  const { operationId: _ignored, ...draft } = input();
  const result = api().createCompletionCommand(scope, draft);
  expect(result.body.operationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(random).toHaveBeenCalledTimes(1);
  expect(result).toEqual({ schemaVersion: 1, scope, action: 'complete', body: { ...draft, operationId: result.body.operationId }, uncertain: false });
  expect(api().loadCompletionCommand(scope)).toEqual(result);
  for (const value of [result, result.scope, result.body, result.body.checkedItemIds, result.body.completionMediaIds]) expect(Object.isFrozen(value)).toBe(true);
  draft.completionMediaIds.reverse(); expect(result.body.completionMediaIds).toEqual([id(11), id(10)]);
  expect(localStorage.length).toBe(0);
});
test('create never replaces an unresolved or corrupted command with a new UUID', () => {
  api().saveCompletionCommand(envelope()); const random = jest.spyOn(window.crypto, 'getRandomValues');
  const { operationId: _ignored, ...draft } = input();
  expect(() => api().createCompletionCommand(scope, draft)).toThrow(); expect(random).not.toHaveBeenCalled();
  sessionStorage.setItem(sessionStorage.key(0), '{broken');
  expect(() => api().createCompletionCommand(scope, draft)).toThrow(); expect(random).not.toHaveBeenCalled();
});
test('invalid new input does not consume UUID or store anything', () => {
  const random = jest.spyOn(window.crypto, 'getRandomValues');
  expect(() => api().createCompletionCommand(scope, { expectedCompletionVersion: 0 })).toThrow();
  expect(random).not.toHaveBeenCalled(); expect(sessionStorage.length).toBe(0);
});
test('native randomUUID is called once and normalized; unavailable secure randomness is not replaced with Math.random', () => {
  const randomUUID = jest.fn(() => operationId.toUpperCase()); window.crypto.randomUUID = randomUUID;
  const { operationId: _ignored, ...draft } = input();
  expect(api().createCompletionCommand(scope, draft).body.operationId).toBe(operationId); expect(randomUUID).toHaveBeenCalledTimes(1);
  api().clearCompletionCommand(scope);
  window.crypto.randomUUID = undefined; window.crypto.getRandomValues = undefined;
  expect(() => api().createCompletionCommand(scope, draft)).toThrow(); expect(sessionStorage.length).toBe(0);
});
test('create rejects an already identified command instead of silently generating another operation ID', () => {
  expect(() => api().createCompletionCommand(scope, input())).toThrow(); expect(sessionStorage.length).toBe(0);
});
test('save reads back exact content, retains actor/role and uncertainty without permitting body replacement', () => {
  const value = api().saveCompletionCommand(envelope());
  expect(sessionStorage.key(0)).toMatch(/^family-growth\.completion-command\.v1:/);
  expect(JSON.parse(sessionStorage.getItem(sessionStorage.key(0))).scope).toEqual(scope);
  const uncertain = api().saveCompletionCommand({ ...value, uncertain: true });
  expect(uncertain.uncertain).toBe(true);
  expect(() => api().saveCompletionCommand(value)).toThrow();
  expect(() => api().saveCompletionCommand({ ...uncertain, body: { ...uncertain.body, childNote: 'changed' } })).toThrow();
  expect(api().loadCompletionCommand(scope)).toEqual(uncertain);
});
test.each(['actorId', 'role', 'familyId', 'childId', 'taskId', 'action'])('storage isolates %s and clears only the addressed command', field => {
  const first = envelope(), second = envelope();
  if (field === 'action') { second.action = 'confirm'; second.body = { expectedCompletionVersion: 0 }; }
  else if (field === 'role') { first.scope.actorId = first.scope.childId; second.scope.actorId = second.scope.childId; second.scope.role = 'student'; }
  else second.scope[field] = id(99);
  api().saveCompletionCommand(first); api().saveCompletionCommand(second);
  expect(sessionStorage.length).toBe(2);
  api().clearCompletionCommand(first.scope, first.action);
  expect(api().loadCompletionCommand(first.scope, first.action)).toBeNull();
  expect(api().loadCompletionCommand(second.scope, second.action)).toEqual(second);
});
test.each(['schema', 'scope', 'extra', 'body extra', 'body noncanonical', 'uncertain', 'action', 'json'])(
'damaged stored %s fails closed and is not silently deleted', kind => {
  api().saveCompletionCommand(envelope()); const key = sessionStorage.key(0), value = envelope();
  if (kind === 'schema') value.schemaVersion = 2;
  if (kind === 'scope') value.scope.actorId = id(88);
  if (kind === 'extra') value.token = 'private';
  if (kind === 'body extra') value.body.accessUrl = 'https://private.invalid';
  if (kind === 'body noncanonical') value.body.checkedItemIds.reverse();
  if (kind === 'uncertain') value.uncertain = 'false';
  if (kind === 'action') value.action = 'confirm';
  const raw = kind === 'json' ? '{broken' : JSON.stringify(value); sessionStorage.setItem(key, raw);
  expect(() => api().loadCompletionCommand(scope)).toThrow(); expect(sessionStorage.getItem(key)).toBe(raw);
});
test.each(['set throws', 'get throws', 'not stored', 'readback changed'])('storage failure %s never grants a prepared command', kind => {
  if (kind === 'set throws') jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('private quota'); });
  if (kind === 'get throws') jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('private denied'); });
  if (kind === 'not stored') jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
  if (kind === 'readback changed') {
    const set = Storage.prototype.setItem;
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function changed(key, text) {
      const value = JSON.parse(text); value.body.childNote = 'changed'; set.call(this, key, JSON.stringify(value));
    });
  }
  expect(() => api().saveCompletionCommand(envelope())).toThrow();
});
test('student must be the subject and cannot persist a confirmation command', () => {
  expect(() => api().saveCompletionCommand({ ...envelope(), scope: { ...scope, role: 'student' } })).toThrow();
  expect(() => api().saveCompletionCommand({ ...envelope('confirm'), scope: { ...scope, role: 'student', actorId: scope.childId } })).toThrow();
});

test('valid completion fixed projection matches the original version and ordered media', () => {
  expect(api().validateCompletionResult(completed(), envelope())).toBe(true);
});
test.each(['taskId', 'status', 'checklistVersion', 'completionVersion', 'completionMediaIds', 'completionMediaReferenceState', 'parentConfirmed', 'completedAt'])(
'completion cannot accept missing %s', field => {
  const payload = completed(); delete payload.task[field]; expect(api().validateCompletionResult(payload, envelope())).toBe(false);
});
test.each([
  ['taskId', id(9)], ['status', 'confirmed'], ['completionVersion', 0], ['checklistVersion', 1],
  ['completionMediaIds', [id(10), id(11)]], ['completionMediaIds', [id(11), id(11)]],
  ['completionMediaReferenceState', 'pending_recovery'], ['parentConfirmed', true], ['completedAt', '2026-02-30T00:00:00.000Z']
])('completion rejects mismatched %s', (field, value) => {
  expect(api().validateCompletionResult({ task: { ...completed().task, [field]: value } }, envelope())).toBe(false);
});
test('confirmation accepts immutable other-parent audit and awarded replay with no starAward object', () => {
  expect(api().validateConfirmationResult(confirmed(), envelope('confirm'))).toBe(true);
  expect(api().validateConfirmationResult({ ...confirmed(), starAward: { awarded: false, ledgerEntryId: 'synthetic-ledger', starBalance: 0 } }, envelope('confirm'))).toBe(true);
});
test('legacy confirmation may omit completedAt and feedback; neither is invented or matched to the retry body', () => {
  const payload = confirmed(); delete payload.task.completedAt; delete payload.task.parentFeedback;
  expect(api().validateConfirmationResult(payload, envelope('confirm'))).toBe(true);
});
test.each(['taskId', 'status', 'completionVersion', 'checklistVersion', 'completionMediaIds', 'completionMediaReferenceState',
  'parentConfirmed', 'confirmedByParentId', 'confirmedAt', 'starAwardState'])('confirmation rejects missing %s', field => {
  const payload = confirmed(); delete payload.task[field]; expect(api().validateConfirmationResult(payload, envelope('confirm'))).toBe(false);
});
test.each([['completionVersion', 1], ['status', 'completed'], ['starAwardState', 'pending'], ['parentConfirmed', false],
  ['confirmedByParentId', 'unknown'], ['confirmedAt', 'not-a-date'], ['completionMediaIds', [id(10), id(10)]]])(
'confirmation rejects invalid %s', (field, value) => {
  expect(api().validateConfirmationResult({ task: { ...confirmed().task, [field]: value } }, envelope('confirm'))).toBe(false);
});
test.each([null, {}, { awarded: 'true', ledgerEntryId: 'x', starBalance: 0 }, { awarded: true, ledgerEntryId: '', starBalance: 0 },
  { awarded: true, ledgerEntryId: 'x', starBalance: -1 }])('confirmation rejects malformed optional award %j', starAward => {
  expect(api().validateConfirmationResult({ ...confirmed(), starAward }, envelope('confirm'))).toBe(false);
});
test('result validators return false on wrong action, HTTP wrappers and malformed values', () => {
  for (const payload of [null, {}, [], { success: false, data: completed() }, { data: completed(), status: 200 }]) {
    expect(api().validateCompletionResult(payload, envelope())).toBe(false);
    expect(api().validateConfirmationResult(payload, envelope('confirm'))).toBe(false);
  }
  expect(api().validateCompletionResult(completed(), envelope('confirm'))).toBe(false);
  expect(api().validateConfirmationResult(confirmed(), envelope())).toBe(false);
});

test.each([[409, 'MEDIA_OPERATION_EXPIRED'], [409, 'MEDIA_OPERATION_ABORTED'], [404, 'RESOURCE_NOT_FOUND'],
  [409, 'VERSION_CONFLICT'], [409, 'TASK_STATE_CONFLICT']])('formal %s/%s terminates even an uncertain original request', (status, code) => {
  for (const uncertain of [false, true]) expect(api().classifyCompletionError(error(status, code), { uncertain })).toBe('terminal');
});
test.each(['VALIDATION_ERROR', 'CHECKLIST_ITEM_INVALID', 'MEDIA_ATTACHMENT_LIMIT_EXCEEDED', 'CLIENT_UPGRADE_REQUIRED'])(
'400/%s cannot clear a command with uncertain history', code => {
  expect(api().classifyCompletionError(error(400, code))).toBe('terminal');
  expect(api().classifyCompletionError(error(400, code), { uncertain: true })).toBe('blocked');
  expect(api().classifyCompletionError(error(409, code))).toBe('uncertain');
});
test.each([[401, 'UNAUTHENTICATED', 'awaiting_auth'], [401, 'INVALID_IDENTITY_ENVELOPE', 'awaiting_auth'],
  [403, 'CHILD_ACCESS_DENIED', 'awaiting_auth'], [403, 'ACCESS_DENIED', 'awaiting_auth'], [409, 'IDEMPOTENCY_KEY_REUSED', 'blocked'],
  [503, 'MEDIA_REFERENCE_PENDING', 'uncertain'], [500, 'VALIDATION_ERROR', 'uncertain'], [404, 'VERSION_CONFLICT', 'uncertain']])(
'formal %s/%s classifies as %s', (status, code, expected) => { expect(api().classifyCompletionError(error(status, code))).toBe(expected); });
test.each(['bare', 'success', 'details', 'message', 'code', 'status', 'html', 'unknown'])('malformed error %s cannot prove terminal failure', kind => {
  const value = error(409, 'MEDIA_OPERATION_ABORTED');
  if (kind === 'bare') delete value.response.data;
  if (kind === 'success') value.response.data.success = true;
  if (kind === 'details') delete value.response.data.error.details;
  if (kind === 'message') value.response.data.error.message = 42;
  if (kind === 'code') value.response.data.error.code += '\n';
  if (kind === 'status') value.response.status = '409';
  if (kind === 'html') value.response.data = '<html>error</html>';
  if (kind === 'unknown') value.response.data.error.code = 'UNKNOWN';
  expect(api().classifyCompletionError(value, { uncertain: true })).toBe('uncertain');
});
test.each([undefined, null, new Error('network'), { name: 'AbortError' }, { code: 'ECONNABORTED' }, { response: { status: 401 } }])(
'network/cancel/bare auth is not proof of a server terminal outcome', value => { expect(api().classifyCompletionError(value)).toBe('uncertain'); });

test.each([[401, 'UNAUTHENTICATED'], [401, 'INVALID_IDENTITY_ENVELOPE'], [401, 'STALE_CHILD_TOKEN'],
  [401, 'IDENTITY_ENVELOPE_EXPIRED'], [401, 'IDENTITY_ENVELOPE_REPLAYED'], [401, 'INVALID_SERVICE_CREDENTIAL'],
  [403, 'CHILD_ACCESS_DENIED'], [403, 'ACCESS_DENIED'], [403, 'FIELD_ACCESS_DENIED']])(
  'production auth %s/%s with requestId clears private view via awaiting_auth without clearing the command', (status, code) => {
    const original = api().saveCompletionCommand({ ...envelope(), uncertain: true });
    const value = error(status, code); value.response.data.requestId = operationId;
    expect(api().classifyCompletionError(value, { uncertain: true })).toBe('awaiting_auth');
    expect(api().loadCompletionCommand(scope)).toEqual(original);
    expect(api().classifyCompletionError(error(409, code))).toBe('uncertain');
  }
);
test.each([[409, 'MEDIA_OPERATION_EXPIRED'], [409, 'MEDIA_OPERATION_ABORTED'], [404, 'RESOURCE_NOT_FOUND'],
  [409, 'VERSION_CONFLICT'], [409, 'TASK_STATE_CONFLICT'], [400, 'VALIDATION_ERROR'], [400, 'CHECKLIST_ITEM_INVALID'],
  [400, 'MEDIA_ATTACHMENT_LIMIT_EXCEEDED'], [400, 'CLIENT_UPGRADE_REQUIRED']])(
  'production requestId does not mask stable %s/%s', (status, code) => {
    const value = error(status, code); value.response.data.requestId = operationId;
    expect(api().classifyCompletionError(value)).toBe('terminal');
    expect(api().classifyCompletionError(value, { uncertain: true })).toBe(status === 400 ? 'blocked' : 'terminal');
  }
);
test.each([null, 1, {}, []])('malformed requestId %j does not relax the formal error contract', requestId => {
  const value = error(409, 'MEDIA_OPERATION_ABORTED'); value.response.data.requestId = requestId;
  expect(api().classifyCompletionError(value)).toBe('uncertain');
});
