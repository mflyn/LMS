import { webcrypto } from 'crypto';
import { TextEncoder } from 'util';
import { captureSession, saveParentSession, clearParentSession } from '../../services/familySession';
import { prepareRecurringCommand, readRecurringCommand, settleRecurringCommand, assertRecurringCommand } from '../../services/recurringCommands';
import { resetChildScope } from '../../services/childScope';

const scope = { familyId: '111111111111111111111111', childId: '222222222222222222222222' };
const actor = '333333333333333333333333';
const login = (id = actor) => { saveParentSession({ token: 'synthetic', user: { id, role: 'parent' } }); return captureSession('parent'); };
const input = () => ({ operationId: '11111111-1111-4111-8111-111111111111', childId: scope.childId,
  startDate: '2026-11-16', endDate: null, schedule: { kind: 'weekly', weekdays: [5, 1] },
  template: { title: ' 跳绳 ', dimension: 'physical', taskType: 'exercise' } });
const terminal = marker => ({ state: 'aborted', identity: Object.fromEntries(Object.entries(marker).filter(([k]) => k !== 'schemaVersion')),
  command: null, result: null, settledAt: '2026-11-16T04:00:00.000Z' });
beforeAll(() => { Object.defineProperty(window.crypto, 'subtle', { configurable: true, value: webcrypto.subtle }); globalThis.TextEncoder = TextEncoder; });
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

test('persist only minimal identity locally, retain exact normalized body in the tab, and block a second intent', async () => {
  const session = login(); const command = await prepareRecurringCommand(scope, 'create', null, input(), session);
  expect(command.body.template.title).toBe('跳绳'); expect(command.body.schedule.weekdays).toEqual([1, 5]);
  // Generated independently with the server normalizer and json-canonicalize.
  expect(command.marker.requestDigest).toBe('c4a6a2587a82fc702ed5b25ad7b95e3c9422dce4da848c904adb534c876da9ea');
  const raw = Object.keys(localStorage).filter(k => k.includes('recurring-marker')).map(k => localStorage.getItem(k)).join('');
  expect(raw).not.toContain('跳绳'); expect(raw).not.toContain('synthetic');
  expect(readRecurringCommand(scope, session)).toEqual(command);
  await expect(prepareRecurringCommand(scope, 'create', null, { ...input(), operationId: '22222222-2222-4222-8222-222222222222' }, session))
    .rejects.toMatchObject({ code: 'RECURRING_COMMAND_PENDING' });
});

test('interleaved tabs never overwrite another UUID marker; settling one leaves the other locked', async () => {
  const s = login(), b = await prepareRecurringCommand(scope, 'create', null,
    { ...input(), operationId: '22222222-2222-4222-8222-222222222222' }, s);
  const bKey = Object.keys(localStorage).find(k => k.includes('recurring-marker'));
  const encoded = localStorage.getItem(bKey); localStorage.removeItem(bKey);
  const original = Storage.prototype.setItem;
  const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function interleave(key, value) {
    if (this === localStorage && key.includes('recurring-marker')) original.call(this, bKey, encoded);
    return original.call(this, key, value);
  });
  let a;
  try { a = await prepareRecurringCommand(scope, 'create', null, input(), s); } finally { write.mockRestore(); }
  expect(Object.keys(localStorage).filter(k => k.includes('recurring-marker'))).toHaveLength(2);
  await settleRecurringCommand(scope, a.marker, terminal(a.marker), s);
  expect(readRecurringCommand(scope, s)?.marker).toEqual(b.marker);
  await expect(prepareRecurringCommand(scope, 'create', null, input(), s)).rejects.toMatchObject({ code: 'RECURRING_COMMAND_PENDING' });
  await settleRecurringCommand(scope, b.marker, terminal(b.marker), s);
  expect(readRecurringCommand(scope, s)).toBeNull();
});

test('same actor authentication without logout clears raw private bodies and retains marker', async () => {
  const s = login(), command = await prepareRecurringCommand(scope, 'create', null, input(), s);
  const next = login();
  expect(readRecurringCommand(scope, next)).toEqual({ marker: command.marker, body: null });
  expect(Object.keys(sessionStorage).filter(k => k.includes('recurring-body'))).toEqual([]);
});

test.each(['patch', 'stop'])('success for %s requires exact target and required result fields', async action => {
  const s = login(), target = '555555555555555555555555';
  const { childId: _child, startDate: _start, ...rest } = input();
  const c = await prepareRecurringCommand(scope, action, target, action === 'stop'
    ? { operationId: rest.operationId, expectedVersion: 1 } : { ...rest, expectedVersion: 1 }, s);
  const receipt = { ...terminal(c.marker), state: 'succeeded', command: c.body,
    result: { httpStatus: 200, data: { operationId: c.marker.operationId, plan: { id: target, childId: scope.childId } } } };
  for (const plan of [{ id: actor, childId: scope.childId }, { id: target }, null]) {
    await expect(settleRecurringCommand(scope, c.marker, { ...receipt, result: { ...receipt.result,
      data: { ...receipt.result.data, plan } } }, s)).rejects.toThrow();
    expect(readRecurringCommand(scope, s)?.marker).toEqual(c.marker);
  }
  await expect(settleRecurringCommand(scope, c.marker, receipt, s)).resolves.toBe(true);
});

test('matching succeeded requires original body hash and correctly scoped result before unlock', async () => {
  const s = login(), command = await prepareRecurringCommand(scope, 'create', null, input(), s);
  const receipt = { ...terminal(command.marker), state: 'succeeded', command: command.body,
    result: { httpStatus: 201, data: { operationId: command.marker.operationId, plan: { id: '555555555555555555555555', childId: scope.childId } } } };
  await expect(settleRecurringCommand(scope, command.marker, { ...receipt, command: { ...command.body, template: { ...command.body.template, title: 'changed' } } }, s)).rejects.toThrow();
  await expect(settleRecurringCommand(scope, command.marker, { ...receipt, result: { ...receipt.result,
    data: { ...receipt.result.data, plan: { ...receipt.result.data.plan, childId: actor } } } }, s)).rejects.toThrow();
  expect(readRecurringCommand(scope, s)).not.toBeNull();
  await expect(settleRecurringCommand(scope, command.marker, receipt, s)).resolves.toBe(true);
});

test('scope switch while digest is pending writes nothing; expired identity cannot finish receipt', async () => {
  const s = login(); let active = true, release;
  const original = window.crypto.subtle.digest.bind(window.crypto.subtle);
  const spy = jest.spyOn(window.crypto.subtle, 'digest').mockImplementationOnce((...args) => new Promise(resolve => { release = () => resolve(original(...args)); }));
  const pending = prepareRecurringCommand(scope, 'create', null, input(), s, () => active);
  active = false; release(); await expect(pending).rejects.toThrow(); spy.mockRestore();
  expect(Object.keys(localStorage).filter(k => k.includes('recurring-marker'))).toEqual([]);
});

test('child switch clears only that child private body, both minimal markers survive', async () => {
  const s = login(), other = { ...scope, childId: '444444444444444444444444' };
  await prepareRecurringCommand(scope, 'create', null, input(), s);
  await prepareRecurringCommand(other, 'create', null, { ...input(), childId: other.childId }, s);
  resetChildScope({ previousChildId: scope.childId, nextChildId: other.childId });
  expect(readRecurringCommand(scope, s).body).toBeNull(); expect(readRecurringCommand(other, s).body).not.toBeNull();
  expect(Object.keys(localStorage).filter(k => k.includes('recurring-marker'))).toHaveLength(2);
});

test('storage refusal or missing crypto never creates a dispatchable command', async () => {
  const s = login(); const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  await expect(prepareRecurringCommand(scope, 'create', null, input(), s)).rejects.toThrow(); write.mockRestore();
  expect(readRecurringCommand(scope, s)).toBeNull();
  const original = window.crypto.subtle;
  Object.defineProperty(window.crypto, 'subtle', { configurable: true, value: undefined });
  try { await expect(prepareRecurringCommand(scope, 'create', null, input(), s)).rejects.toMatchObject({ code: 'RECURRING_CRYPTO_UNAVAILABLE' }); }
  finally { Object.defineProperty(window.crypto, 'subtle', { configurable: true, value: original }); }
  expect(readRecurringCommand(scope, s)).toBeNull();
});

test.each([
  { schedule: { kind: 'weekly', weekdays: [1, 1] } }, { schedule: { kind: 'weekly', weekdays: [] } },
  { schedule: { kind: 'daily', weekdays: [1] } }, { startDate: '2026-02-30' },
  { template: { ...input().template, attachmentMediaIds: [] } },
  { template: { ...input().template, estimatedMinutes: -1 } }
])('invalid input rejects before persisting minimal marker: %j', async changes => {
  const s = login(); await expect(prepareRecurringCommand(scope, 'create', null, { ...input(), ...changes }, s)).rejects.toThrow();
  expect(readRecurringCommand(scope, s)).toBeNull();
});

test('explicit logout clears private body including corrupt body; same actor relogin retains only marker', async () => {
  const s = login(), original = await prepareRecurringCommand(scope, 'create', null, input(), s);
  for (const key of Object.keys(sessionStorage).filter(k => k.includes('recurring-body'))) sessionStorage.setItem(key, '{broken');
  clearParentSession(); const other = login('444444444444444444444444');
  expect(readRecurringCommand(scope, other)).toBeNull();
  const current = login(); expect(readRecurringCommand(scope, current)).toEqual({ marker: original.marker, body: null });
  expect(Object.keys(sessionStorage).filter(k => k.includes('recurring-body'))).toEqual([]);
});

test('not_found and mismatched terminal keep the marker; matching aborted alone releases it', async () => {
  const s = login(), { marker } = await prepareRecurringCommand(scope, 'create', null, input(), s);
  await expect(settleRecurringCommand(scope, marker, { state: 'not_found' }, s)).resolves.toBe(false);
  await expect(settleRecurringCommand(scope, marker, { ...terminal(marker), identity: { ...terminal(marker).identity, actorId: '444444444444444444444444' } }, s)).rejects.toThrow();
  expect(readRecurringCommand(scope, s)).not.toBeNull();
  await expect(settleRecurringCommand(scope, marker, terminal(marker), s)).resolves.toBe(true);
  expect(readRecurringCommand(scope, s)).toBeNull();
});

test('late old-session receipt cannot remove marker after relogin', async () => {
  const s = login(), { marker } = await prepareRecurringCommand(scope, 'create', null, input(), s);
  clearParentSession(); const next = login();
  await expect(settleRecurringCommand(scope, marker, terminal(marker), s)).rejects.toMatchObject({ code: 'SESSION_CHANGED' });
  expect(readRecurringCommand(scope, next)?.marker).toEqual(marker);
});

test('session changes while succeeded receipt hash is pending cannot clear the persistent marker', async () => {
  const s = login(), c = await prepareRecurringCommand(scope, 'create', null, input(), s);
  const receipt = { ...terminal(c.marker), state: 'succeeded', command: c.body,
    result: { httpStatus: 201, data: { operationId: c.marker.operationId, plan: { id: actor, childId: scope.childId } } } };
  const original = window.crypto.subtle.digest.bind(window.crypto.subtle); let release;
  const spy = jest.spyOn(window.crypto.subtle, 'digest').mockImplementationOnce((...args) => new Promise(resolve => { release = () => resolve(original(...args)); }));
  const pending = settleRecurringCommand(scope, c.marker, receipt, s);
  clearParentSession(); const next = login(); release();
  try { await expect(pending).rejects.toMatchObject({ code: 'SESSION_CHANGED' }); }
  finally { spy.mockRestore(); }
  expect(readRecurringCommand(scope, next)?.marker).toEqual(c.marker);
});

test('cross-tab changed marker and corrupt marker refuse dispatch rather than deleting protection', async () => {
  const s = login(), original = await prepareRecurringCommand(scope, 'create', null, input(), s);
  const key = Object.keys(localStorage).find(k => k.includes('recurring-marker'));
  localStorage.setItem(key, '{broken');
  expect(readRecurringCommand(scope, s)).toEqual({ corrupt: true });
  await expect(assertRecurringCommand(scope, original, s)).rejects.toThrow();
  await expect(prepareRecurringCommand(scope, 'create', null, input(), s)).rejects.toThrow();
  expect(localStorage.getItem(key)).toBe('{broken');
});
