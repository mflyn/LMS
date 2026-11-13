import {
  CHILD_SESSION_KEY, PARENT_SESSION_KEY, captureSession, clearChildSession,
  expireChildSession, loadChildSession, requestWithSession, saveChildSession, saveParentSession,
  subscribeSessionChanges, wasChildSessionExpired
} from '../../services/familySession';

const a = 'a'.repeat(24), b = 'b'.repeat(24), family = 'f'.repeat(24);
const child = id => ({ token: `synthetic-${id}`, child: { childId: id, familyId: family, name: id } });
const exitKey = id => `family-growth.session-exit.v1:student:${id}`;
const command = id => {
  const key = 'family-growth.completion-command.v1:' + JSON.stringify([id, 'student', family, id, 'c'.repeat(24), 'complete']);
  sessionStorage.setItem(key, '{damaged-owned-command');
  return key;
};
const externalExit = (id, dispatch = true) => {
  localStorage.setItem(exitKey(id), JSON.stringify({ revision: `exit-${id}`, reason: 'explicit_logout' }));
  if (dispatch) window.dispatchEvent(new StorageEvent('storage', { key: exitKey(id), storageArea: localStorage }));
};

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

test('child credentials stay in this tab; parent credentials remain shared', () => {
  saveParentSession({ token: 'synthetic-parent', user: { id: 'parent', role: 'parent' } });
  const parent = localStorage.getItem(PARENT_SESSION_KEY);
  saveChildSession(child(a));
  expect(sessionStorage.getItem(CHILD_SESSION_KEY)).toContain(`synthetic-${a}`);
  expect(localStorage.getItem(CHILD_SESSION_KEY)).toBeNull();
  expect(sessionStorage.getItem(PARENT_SESSION_KEY)).toBeNull();
  expect(localStorage.getItem(PARENT_SESSION_KEY)).toBe(parent);
  expect(loadChildSession()).toEqual(child(a));
});

test('a fresh tab with only legacy shared credentials must log in, preserving unknown commands', () => {
  localStorage.setItem('family-growth.child-session.v1', JSON.stringify(child(a)));
  const pending = command(a);
  expect(loadChildSession()).toBeNull();
  expect(localStorage.getItem('family-growth.child-session.v1')).toBeNull();
  expect(sessionStorage.getItem(pending)).not.toBeNull();
});

test('another tab cannot replace this child by publishing credentials or change metadata', () => {
  saveChildSession(child(a)); const initial = captureSession('student'), pending = command(a);
  localStorage.setItem(CHILD_SESSION_KEY, JSON.stringify(child(b)));
  localStorage.setItem('family-growth.session-change.v1:student', JSON.stringify({ actorId: b, reason: 'authenticated' }));
  window.dispatchEvent(new StorageEvent('storage', { key: CHILD_SESSION_KEY, storageArea: localStorage }));
  window.dispatchEvent(new Event('focus'));
  expect(captureSession('student')).toBe(initial);
  expect(loadChildSession()).toEqual(child(a));
  expect(sessionStorage.getItem(pending)).not.toBeNull();
});

test('a different child exit neither clears credentials/commands nor broadcasts this tab logout', () => {
  saveChildSession(child(a)); const initial = captureSession('student'), pending = command(a);
  const observer = jest.fn(), unsubscribe = subscribeSessionChanges(observer);
  try {
    externalExit(b);
    expect(captureSession('student')).toBe(initial);
    expect(sessionStorage.getItem(pending)).not.toBeNull();
    expect(observer).not.toHaveBeenCalled();
  } finally { unsubscribe(); }
});

test.each([true, false])('same-child exit rejects old credentials before HTTP, even with storage event=%s', dispatch => {
  saveChildSession(child(a)); const initial = captureSession('student'), pending = command(a), other = command(b);
  externalExit(a, dispatch);
  const send = jest.fn();
  expect(captureSession('student')).toBeNull();
  expect(sessionStorage.getItem(CHILD_SESSION_KEY)).toBeNull();
  expect(sessionStorage.getItem(pending)).toBeNull();
  expect(sessionStorage.getItem(other)).not.toBeNull();
  return expect(requestWithSession('student', send, { session: initial })).rejects
    .toMatchObject({ code: 'SESSION_CHANGED' }).then(() => expect(send).not.toHaveBeenCalled());
});

test('new PIN login consumes the prior exit marker without immediately expiring the new session', () => {
  externalExit(a, false);
  saveChildSession(child(a));
  const snapshot = captureSession('student');
  expect(snapshot.actorId).toBe(a);
  window.dispatchEvent(new Event('pageshow'));
  expect(captureSession('student')).toBe(snapshot);
});

test('expiry keeps the original command and remains local when another child authenticates', () => {
  saveChildSession(child(a)); const pending = command(a);
  expireChildSession();
  localStorage.setItem('family-growth.session-change.v1:student', JSON.stringify({ actorId: b, reason: 'authenticated' }));
  expect(wasChildSessionExpired()).toBe(true);
  expect(sessionStorage.getItem(pending)).not.toBeNull();
  saveChildSession(child(a));
  expect(sessionStorage.getItem(pending)).not.toBeNull();
  clearChildSession();
  expect(sessionStorage.getItem(pending)).toBeNull();
});

test.each(['throw', 'silent'])('child login fails closed when sessionStorage write is %s; no shared fallback', failure => {
  const original = Storage.prototype.setItem;
  const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function set(key, value) {
    if (this === sessionStorage && key === CHILD_SESSION_KEY) {
      if (failure === 'throw') throw new Error('storage unavailable');
      return;
    }
    return original.call(this, key, value);
  });
  try {
    expect(() => saveChildSession(child(a))).toThrow();
    expect(captureSession('student')).toBeNull();
    expect(localStorage.getItem(CHILD_SESSION_KEY)).toBeNull();
  } finally { spy.mockRestore(); }
});

test.each(['success', '401'])('late %s after a same-child external exit cannot revive credentials', async result => {
  saveChildSession(child(a));
  let resolve, reject;
  const response = new Promise((yes, no) => { resolve = yes; reject = no; });
  const pending = requestWithSession('student', () => response).catch(error => error);
  externalExit(a, false);
  if (result === 'success') resolve({ private: 'old' });
  else reject({ response: { status: 401 } });
  expect((await pending).code).toBe('SESSION_CHANGED');
  expect(captureSession('student')).toBeNull();
});
