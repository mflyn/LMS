import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { ChildAuthProvider, useChildAuth } from '../../contexts/ChildAuthContext';
import { FamilyProvider, useFamily } from '../../contexts/FamilyContext';
import * as session from '../../services/familySession';
import { getMyFamily } from '../../services/familyApi';
jest.mock('../../services/familyApi', () => ({ getMyFamily: jest.fn() }));
const parent = actor => ({ token: actor, user: { id: actor, name: actor, role: 'parent' } });
const student = actor => ({ token: actor, child: { childId: actor, familyId: 'f', name: actor } });
const command = (actorId, role) => {
  const key = `family-growth.completion-command.v1:${role}:${actorId}`;
  sessionStorage.setItem(key, JSON.stringify({ scope: { actorId, role } })); return key;
};
const AuthProbe = () => {
  const auth = useAuth(); return <><output data-testid="parent">{auth.user?.id || 'none'}</output>
    <button onClick={() => auth.login('a', 'synthetic')}>login</button><button onClick={auth.logout}>logout</button></>;
};
const ChildProbe = () => {
  const auth = useChildAuth(); return <><output data-testid="student">{auth.child?.childId || 'none'}</output>
    <button onClick={() => auth.login({ familyId: 'f', childId: 'a', pin: '1234' })}>child login</button>
    <button onClick={auth.logout}>child logout</button></>;
};
const FamilyProbe = () => {
  const value = useFamily(); return <><output data-testid="family">{value.family?.familyId || 'none'}</output>
    <output data-testid="status">{value.familyStatus}</output></>;
};
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); jest.clearAllMocks(); });

test.each(['parent', 'student'])('%s context follows cross-tab replacement and unknown clearing without discarding commands', async role => {
  const save = role === 'parent' ? session.saveParentSession : session.saveChildSession;
  const make = role === 'parent' ? parent : student;
  const key = role === 'parent' ? session.PARENT_SESSION_KEY : session.CHILD_SESSION_KEY;
  save(make('a'));
  render(role === 'parent' ? <AuthProvider><AuthProbe /></AuthProvider> : <ChildAuthProvider><ChildProbe /></ChildAuthProvider>);
  act(() => {
    localStorage.setItem(key, JSON.stringify(make('b')));
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: localStorage.getItem(key) }));
  });
  await waitFor(() => expect(screen.getByTestId(role)).toHaveTextContent('b'));
  const own = command('b', role);
  act(() => { localStorage.clear(); window.dispatchEvent(new StorageEvent('storage', { key: null })); });
  await waitFor(() => expect(screen.getByTestId(role)).toHaveTextContent('none'));
  expect(sessionStorage.getItem(own)).not.toBeNull();
});

test.each(['parent', 'student'])('%s expiry clears UI but preserves commands, explicit exit removes them', async role => {
  const save = role === 'parent' ? session.saveParentSession : session.saveChildSession;
  const make = role === 'parent' ? parent : student;
  save(make('a')); const own = command('a', role);
  render(role === 'parent' ? <AuthProvider><AuthProbe /></AuthProvider> : <ChildAuthProvider><ChildProbe /></ChildAuthProvider>);
  act(() => (role === 'parent' ? session.expireParentSession : session.expireChildSession)());
  expect(screen.getByTestId(role)).toHaveTextContent('none');
  expect(sessionStorage.getItem(own)).not.toBeNull();
  act(() => save(make('a')));
  fireEvent.click(screen.getByRole('button', { name: role === 'parent' ? 'logout' : 'child logout' }));
  expect(sessionStorage.getItem(own)).toBeNull();
});

test('family switches parent while authenticated, clears view and rejects old success and old 401', async () => {
  session.saveParentSession(parent('a'));
  let finishA, failB;
  getMyFamily.mockImplementationOnce(() => new Promise(resolve => { finishA = resolve; }))
    .mockImplementationOnce(() => new Promise((_, reject) => { failB = reject; }))
    .mockResolvedValue({ family: { familyId: 'c-family' }, children: [] });
  render(<AuthProvider><FamilyProvider><AuthProbe /><FamilyProbe /></FamilyProvider></AuthProvider>);
  await waitFor(() => expect(getMyFamily).toHaveBeenCalledTimes(1));
  act(() => session.saveParentSession(parent('b')));
  await waitFor(() => expect(getMyFamily).toHaveBeenCalledTimes(2));
  await act(async () => finishA({ family: { familyId: 'a-family' }, children: [] }));
  expect(screen.getByTestId('family')).toHaveTextContent('none');
  act(() => session.saveParentSession(parent('c')));
  await waitFor(() => expect(screen.getByTestId('family')).toHaveTextContent('c-family'));
  await act(async () => failB({ response: { status: 401 } }));
  expect(screen.getByTestId('parent')).toHaveTextContent('c');
  expect(screen.getByTestId('family')).toHaveTextContent('c-family');
});

test('ready family is cleared during another actor load, not reused as a background refresh', async () => {
  session.saveParentSession(parent('a'));
  getMyFamily.mockResolvedValueOnce({ family: { familyId: 'a-family' }, children: [] })
    .mockImplementationOnce(() => new Promise(() => {}));
  render(<AuthProvider><FamilyProvider><FamilyProbe /></FamilyProvider></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('family')).toHaveTextContent('a-family'));
  act(() => session.saveParentSession(parent('b')));
  expect(screen.getByTestId('family')).toHaveTextContent('none');
  expect(screen.getByTestId('status')).toHaveTextContent('unknown');
});

test.each(['parent', 'student'])('late %s login after logout cannot recreate credentials', async role => {
  let finish;
  axios.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(role === 'parent' ? <AuthProvider><AuthProbe /></AuthProvider> : <ChildAuthProvider><ChildProbe /></ChildAuthProvider>);
  fireEvent.click(screen.getByRole('button', { name: role === 'parent' ? 'login' : 'child login' }));
  fireEvent.click(screen.getByRole('button', { name: role === 'parent' ? 'logout' : 'child logout' }));
  await act(async () => finish({ data: { data: (role === 'parent' ? parent : student)('a') } }));
  expect(screen.getByTestId(role)).toHaveTextContent('none');
  expect(session.captureSession(role)).toBeNull();
});

test('resuming a tab synchronizes context even when a storage event was missed', () => {
  session.saveParentSession(parent('a'));
  render(<AuthProvider><AuthProbe /></AuthProvider>);
  act(() => {
    localStorage.setItem(session.PARENT_SESSION_KEY, JSON.stringify(parent('b')));
    window.dispatchEvent(new Event('pageshow'));
  });
  expect(screen.getByTestId('parent')).toHaveTextContent('b');
});

test.each(['parent', 'student'])('unchanged visibility refresh does not cancel an in-flight %s login', async role => {
  let finish;
  axios.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(role === 'parent' ? <AuthProvider><AuthProbe /></AuthProvider> : <ChildAuthProvider><ChildProbe /></ChildAuthProvider>);
  fireEvent.click(screen.getByRole('button', { name: role === 'parent' ? 'login' : 'child login' }));
  act(() => window.dispatchEvent(new Event('focus')));
  await act(async () => finish({ data: { data: (role === 'parent' ? parent : student)('a') } }));
  expect(screen.getByTestId(role)).toHaveTextContent('a');
});
