import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ChildAuthProvider, useChildAuth } from '../../contexts/ChildAuthContext';
import { childPinLogin } from '../../services/childApi';
import { captureSession, CHILD_SESSION_KEY, clearChildSession, expireChildSession, saveChildSession } from '../../services/familySession';

jest.mock('../../services/childApi', () => ({ childPinLogin: jest.fn() }));
const a = 'a'.repeat(24), b = 'b'.repeat(24), family = 'f'.repeat(24);
const make = (id = a, token = 'synthetic-original') => ({ token,
  child: { childId: id, familyId: family, name: 'Synthetic child' } });
const exitKey = (id = a, role = 'student') => `family-growth.session-exit.v1:${role}:${id}`;
let results, exitSequence;
const externalExit = (id = a, event = true, role = 'student') => {
  const key = exitKey(id, role);
  localStorage.setItem(key, JSON.stringify({ revision: `exit-${++exitSequence}`, reason: 'explicit_logout' }));
  if (event) window.dispatchEvent(new StorageEvent('storage', { key, storageArea: localStorage }));
};
const Probe = ({ childId = a }) => {
  const auth = useChildAuth();
  return <><output data-testid="actor">{auth.child?.childId || 'none'}</output>
    <output data-testid="error">{auth.error || 'none'}</output>
    <button onClick={async () => { results.push(await auth.login({ familyId: family, childId, pin: '2468' })); }}>PIN login</button></>;
};
const mount = childId => render(<ChildAuthProvider><Probe childId={childId} /></ChildAuthProvider>);
const start = childId => {
  mount(childId);
  fireEvent.click(screen.getByRole('button', { name: 'PIN login' }));
};
const pendingLogin = () => {
  let resolve, reject;
  childPinLogin.mockImplementationOnce(() => new Promise((ok, fail) => { resolve = ok; reject = fail; }));
  return { succeed: value => resolve(value || make()), fail: () => reject({ response: { status: 401 } }) };
};
const expectAnonymous = () => {
  expect(captureSession('student')).toBeNull();
  expect(sessionStorage.getItem(CHILD_SESSION_KEY)).toBeNull();
  expect(screen.getByTestId('actor')).toHaveTextContent('none');
};
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); jest.clearAllMocks(); results = []; exitSequence = 0; });
afterEach(() => jest.restoreAllMocks());

test.each([true, false])('same-child logout rejects an anonymous in-flight success, storage event=%s', async event => {
  const request = pendingLogin(); start();
  act(() => externalExit(a, event));
  await act(async () => request.succeed());
  expect(results).toEqual([false]); expectAnonymous();
  expect(screen.getByTestId('error')).toHaveTextContent('重新输入 PIN');
});

test('same-child logout wins over an old failed PIN response without reporting incorrect credentials', async () => {
  const request = pendingLogin(); start();
  act(() => externalExit());
  await act(async () => request.fail());
  expect(results).toEqual([false]); expectAnonymous();
  expect(screen.getByTestId('error')).toHaveTextContent('重新输入 PIN');
  expect(screen.getByTestId('error')).not.toHaveTextContent('不正确');
});

test.each(['student', 'parent'])('another %s logout does not cancel this child login', async role => {
  const request = pendingLogin(); start();
  act(() => externalExit(b, true, role));
  await act(async () => request.succeed());
  expect(results).toEqual([true]);
  expect(captureSession('student')?.actorId).toBe(a);
});

test.each(['logout', 'expired'])('a repeated exit of the previously %s child does not cancel a different target login', async reason => {
  saveChildSession(make(b));
  if (reason === 'logout') clearChildSession(); else expireChildSession();
  const request = pendingLogin(); start();
  act(() => externalExit(b));
  await act(async () => request.succeed());
  expect(results).toEqual([true]);
  expect(captureSession('student')?.actorId).toBe(a);
});

test('a fresh explicit PIN login after logout succeeds without adopting the earlier response', async () => {
  const old = pendingLogin(); start();
  act(() => externalExit());
  childPinLogin.mockResolvedValueOnce(make(a, 'synthetic-new'));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'PIN login' })));
  const current = captureSession('student');
  expect(current?.token).toBe('synthetic-new');
  await act(async () => old.succeed());
  expect(results).toEqual([true, false]);
  expect(captureSession('student')).toBe(current);
  expect(screen.getByTestId('error')).toHaveTextContent('none');
});

test.each(['succeed', 'fail'])('late %s cannot replace or clear a newer same-actor login', async outcome => {
  const old = pendingLogin(); start();
  childPinLogin.mockResolvedValueOnce(make(a, 'synthetic-new'));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'PIN login' })));
  const current = captureSession('student');
  await act(async () => old[outcome]());
  expect(results).toEqual([true, false]);
  expect(captureSession('student')).toBe(current);
  expect(screen.getByTestId('actor')).toHaveTextContent(a);
  expect(screen.getByTestId('error')).toHaveTextContent('none');
});

const denyMarkerRead = () => {
  const get = Storage.prototype.getItem;
  return jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
    if (this === localStorage && key === exitKey()) throw new Error('Synthetic storage denial');
    return get.call(this, key);
  });
};
test('unreadable initial exit marker prevents the PIN request and reports storage failure', async () => {
  childPinLogin.mockResolvedValueOnce(make());
  mount();
  const spy = denyMarkerRead();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'PIN login' })));
  spy.mockRestore();
  expect(childPinLogin).not.toHaveBeenCalled();
  expect(results).toEqual([false]); expectAnonymous();
  expect(screen.getByTestId('error')).toHaveTextContent('存储');
});

test.each(['succeed', 'fail'])('unreadable marker on %s is not treated as an unchanged absent marker', async outcome => {
  const request = pendingLogin(); start();
  const spy = denyMarkerRead();
  await act(async () => request[outcome]());
  spy.mockRestore();
  expect(results).toEqual([false]); expectAnonymous();
  expect(screen.getByTestId('error')).toHaveTextContent('存储');
});

test('uppercase ObjectId input still binds to the canonical actor exit marker', async () => {
  const request = pendingLogin(); start(a.toUpperCase());
  act(() => externalExit(a, false));
  await act(async () => request.succeed());
  expect(results).toEqual([false]); expectAnonymous();
});

test.each(['child', 'family'])('a mismatched response %s cannot be saved under the requested actor boundary', async field => {
  const payload = make(); payload.child[field === 'child' ? 'childId' : 'familyId'] = b;
  childPinLogin.mockResolvedValueOnce(payload);
  mount();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'PIN login' })));
  expect(results).toEqual([false]); expectAnonymous();
});

test('exit marker changing during persistence cannot return successful login or retain credentials', async () => {
  const request = pendingLogin(); start();
  const set = Storage.prototype.setItem;
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    set.call(this, key, value);
    if (this === sessionStorage && key === CHILD_SESSION_KEY) externalExit(a, false);
  });
  await act(async () => request.succeed());
  expect(results).toEqual([false]); expectAnonymous();
});
