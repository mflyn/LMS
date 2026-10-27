import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ChildAuthProvider, useChildAuth } from '../../contexts/ChildAuthContext';
import { captureSession, clearChildSession, expireChildSession, requestWithSession,
  saveChildSession, saveParentSession, PARENT_SESSION_KEY, CHILD_SESSION_KEY } from '../../services/familySession';

const saveChild = (id = 'child-a') => saveChildSession({ token: `synthetic-${id}`,
  child: { childId: id, familyId: 'synthetic-family', name: 'Synthetic child' } });
const Probe = () => {
  const { error, status, logout, clearError } = useChildAuth();
  return <><output data-testid="status">{status}</output><output data-testid="error">{error || 'none'}</output>
    <button onClick={logout}>logout</button><button onClick={clearError}>edit</button></>;
};
const mount = () => render(<ChildAuthProvider><Probe /></ChildAuthProvider>);
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

test('a current 401 before reload preserves expiry feedback on provider reconstruction without restoring private identity', async () => {
  saveParentSession({ token: 'synthetic-parent', user: { id: 'parent-a', role: 'parent' } });
  const parent = localStorage.getItem(PARENT_SESSION_KEY);
  saveChild();
  const first = mount();
  await act(async () => {
    await expect(requestWithSession('student', () => Promise.reject({ response: { status: 401 } })))
      .rejects.toMatchObject({ response: { status: 401 } });
  });
  expect(screen.getByTestId('error')).toHaveTextContent('会话已过期，请重新登录');
  expect(localStorage.getItem(CHILD_SESSION_KEY)).toBeNull();
  first.unmount();
  mount();
  expect(screen.getByTestId('status')).toHaveTextContent('anonymous');
  expect(screen.getByTestId('error')).toHaveTextContent('会话已过期，请重新登录');
  expect(localStorage.getItem(CHILD_SESSION_KEY)).toBeNull();
  expect(localStorage.getItem(PARENT_SESSION_KEY)).toBe(parent);
  act(() => window.dispatchEvent(new Event('focus')));
  expect(screen.getByTestId('error')).toHaveTextContent('会话已过期，请重新登录');
  fireEvent.click(screen.getByText('edit'));
  expect(screen.getByTestId('error')).toHaveTextContent('none');
});

test('explicit logout after expiry does not resurrect the expiry notice on reconstruction', () => {
  saveChild(); expireChildSession(captureSession('student'));
  const first = mount();
  fireEvent.click(screen.getByText('logout'));
  first.unmount(); mount();
  expect(screen.getByTestId('status')).toHaveTextContent('anonymous');
  expect(screen.getByTestId('error')).toHaveTextContent('none');
});

test('replacement login and a late old 401 cannot restore the old expiry notice or clear the new child', async () => {
  saveChild();
  let reject;
  const pending = requestWithSession('student', () => new Promise((_resolve, fail) => { reject = fail; }))
    .catch(error => error);
  expireChildSession(captureSession('student'));
  saveChild('child-b');
  mount();
  await act(async () => reject({ response: { status: 401 } }));
  expect((await pending).code).toBe('SESSION_CHANGED');
  expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
  expect(screen.getByTestId('error')).toHaveTextContent('none');
  expect(captureSession('student').actorId).toBe('child-b');
});

test.each(['missing', 'malformed', 'logout'])('%s change metadata never invents expiry feedback', kind => {
  if (kind === 'malformed') localStorage.setItem('family-growth.session-change.v1:student', '{bad');
  if (kind === 'logout') { saveChild(); clearChildSession(); }
  mount();
  expect(screen.getByTestId('status')).toHaveTextContent('anonymous');
  expect(screen.getByTestId('error')).toHaveTextContent('none');
});
