import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { ChildAuthProvider, useChildAuth } from '../../contexts/ChildAuthContext';
import ChildPinLoginPage from '../../pages/child/ChildPinLoginPage';
import { childPinLogin } from '../../services/childApi';
import { captureSession, saveChildSession, saveParentSession } from '../../services/familySession';

jest.mock('../../services/childApi', () => ({ childPinLogin: jest.fn() }));
const family = 'f'.repeat(24), a = 'a'.repeat(24), b = 'b'.repeat(24);
const link = (id = a, f = family) => `/child/login#familyId=${f}&childId=${id}`;
const payload = id => ({ token: `synthetic-${id}`, child: { familyId: family, childId: id, name: id === a ? '孩子A' : '孩子B' } });
let go;
const Navigation = () => {
  go = useNavigate();
  const { error } = useChildAuth();
  return <output aria-label="登录错误">{error || 'none'}</output>;
};
const mount = (path = link()) => {
  window.history.replaceState({}, '', path);
  return render(<ChildAuthProvider><BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Navigation /><Routes>
    <Route path="/child/login" element={<ChildPinLoginPage />} />
    <Route path="/child/today" element={<h1>今天的任务</h1>} />
    <Route path="/away" element={<h1>其他页面</h1>} />
  </Routes></BrowserRouter></ChildAuthProvider>);
};
const typePin = () => fireEvent.change(screen.getByLabelText('PIN'), { target: { value: '2468' } });
const submit = () => fireEvent.submit(screen.getByLabelText('PIN').closest('form'));
const storage = () => [JSON.stringify({ ...localStorage }), JSON.stringify({ ...sessionStorage })];
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); jest.clearAllMocks(); });
afterEach(() => jest.restoreAllMocks());

test('dedicated entry requires only PIN and uses the original three-field request', async () => {
  childPinLogin.mockResolvedValue(payload(a)); mount();
  expect(screen.queryByLabelText('家庭 ID')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('孩子 ID')).not.toBeInTheDocument();
  expect(childPinLogin).not.toHaveBeenCalled(); typePin(); submit();
  await screen.findByRole('heading', { name: '今天的任务' });
  expect(childPinLogin).toHaveBeenCalledTimes(1);
  expect(childPinLogin).toHaveBeenCalledWith({ familyId: family, childId: a, pin: '2468' });
  expect(window.location.hash).toBe('');
  expect(captureSession('student')?.actorId).toBe(a);
});

test.each([
  [link(b)], [link(a, b)], ['/child/login#bad', link(b)], ['/child/login', link(b)],
  [link(b), link()], ['/child/login#bad', link()], ['/child/login', link()]
])('unsubmitted PIN is cleared on intent changes without session or command writes: %j', (...paths) => {
  saveParentSession({ token: 'synthetic-parent', user: { id: 'parent', role: 'parent' } });
  sessionStorage.setItem('synthetic-pending-command', JSON.stringify({ operationId: 'original-uuid', state: 'unknown' }));
  localStorage.setItem(`family-growth.session-exit.v1:student:${b}`, JSON.stringify({ revision: 'prior-exit' }));
  mount(); typePin(); expect(screen.getByLabelText('PIN')).toHaveValue('2468');
  const before = storage();
  for (const path of paths) {
    act(() => go(path));
    const input = screen.queryByLabelText('PIN');
    if (input) { expect(input).toHaveValue(''); fireEvent.submit(input.closest('form')); }
    expect(childPinLogin).not.toHaveBeenCalled(); expect(storage()).toEqual(before);
  }
});

test('submit rejects an old input even before the route change has rendered', () => {
  mount(); typePin(); const form = screen.getByLabelText('PIN').closest('form');
  window.history.pushState({}, '', link(b));
  fireEvent.submit(form);
  expect(childPinLogin).not.toHaveBeenCalled(); expect(captureSession('student')).toBeNull();
});

test('equivalent target and ordinary renders preserve PIN; new target requires fresh input', async () => {
  mount(); typePin();
  act(() => go(`/child/login#childId=${a.toUpperCase()}&familyId=${family.toUpperCase()}`));
  expect(screen.getByLabelText('PIN')).toHaveValue('2468');
  act(() => go(`/child/login#childId=${a.toUpperCase()}&familyId=${family.toUpperCase()}`, { replace: true }));
  expect(screen.getByLabelText('PIN')).toHaveValue('2468');
  childPinLogin.mockResolvedValueOnce(payload(a));
  submit();
  await waitFor(() => expect(captureSession('student')?.actorId).toBe(a));
});

test.each(['success', 'failure'])('late %s after entry change cannot restore identity or clear the new PIN', async outcome => {
  let settle; childPinLogin.mockImplementationOnce(() => new Promise((resolve, reject) => {
    settle = () => outcome === 'success' ? resolve(payload(a)) : reject({ response: { status: 401 } });
  }));
  mount(); typePin(); submit(); act(() => go(link(b))); typePin();
  await act(async () => settle());
  expect(captureSession('student')).toBeNull(); expect(screen.getByLabelText('PIN')).toHaveValue('2468');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  childPinLogin.mockResolvedValueOnce(payload(b)); submit();
  await screen.findByRole('heading', { name: '今天的任务' });
  expect(captureSession('student')?.actorId).toBe(b);
});

test('ABA invalidates the old owned request', async () => {
  let settle; childPinLogin.mockImplementationOnce(() => new Promise(resolve => { settle = resolve; }));
  mount(); typePin(); submit(); act(() => go(link(b))); act(() => go(link()));
  await act(async () => settle(payload(a)));
  expect(captureSession('student')).toBeNull();
  expect(screen.getByRole('heading', { name: '孩子登录' })).toBeInTheDocument();
});

test.each(['success', 'failure'])('unmount alone rejects late %s with provider and target unchanged', async outcome => {
  let settle;
  childPinLogin.mockImplementationOnce(() => new Promise((resolve, reject) => {
    settle = () => outcome === 'success' ? resolve(payload(a)) : reject({ response: { status: 401 } });
  }));
  sessionStorage.setItem('synthetic-pending-command', JSON.stringify({ operationId: 'original-uuid', state: 'unknown' }));
  localStorage.setItem(`family-growth.session-exit.v1:student:${b}`, JSON.stringify({ revision: 'prior-exit' }));
  mount(); typePin(); submit();
  const hash = window.location.hash, before = storage();
  act(() => go('/away' + hash));
  expect(window.location.hash).toBe(hash);
  await act(async () => settle());
  expect(childPinLogin).toHaveBeenCalledTimes(1);
  expect(storage()).toEqual(before);
  expect(captureSession('student')).toBeNull();
  expect(window.location.pathname).toBe('/away');
  expect(screen.getByRole('heading', { name: '其他页面' })).toBeInTheDocument();
  expect(screen.getByLabelText('登录错误')).toHaveTextContent('none');
});

test('mode changes and manual target edits clear PIN, then fresh manual input works', async () => {
  mount(); typePin();
  fireEvent.click(screen.getByRole('button', { name: '手工填写标识' }));
  expect(screen.getByLabelText('PIN')).toHaveValue('');
  expect(window.location.hash).toBe('');
  for (const [label, value] of [['家庭 ID', family], ['孩子 ID', b]]) {
    typePin(); fireEvent.change(screen.getByLabelText(label), { target: { value } });
    expect(screen.getByLabelText('PIN')).toHaveValue(''); submit();
    expect(childPinLogin).not.toHaveBeenCalled();
  }
  typePin(); act(() => go(link()));
  expect(screen.getByLabelText('PIN')).toHaveValue(''); submit(); expect(childPinLogin).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '手工填写标识' }));
  fireEvent.change(screen.getByLabelText('家庭 ID'), { target: { value: family } });
  fireEvent.change(screen.getByLabelText('孩子 ID'), { target: { value: b } });
  childPinLogin.mockResolvedValueOnce(payload(b)); typePin(); submit();
  await screen.findByRole('heading', { name: '今天的任务' });
  expect(childPinLogin).toHaveBeenCalledTimes(1);
  expect(childPinLogin).toHaveBeenCalledWith({ familyId: family, childId: b, pin: '2468' });
});

test.each(['resolve', 'reject'])('old page cleanup and %s do not cancel a newer page login', async outcome => {
  let resolve, reject;
  childPinLogin.mockImplementationOnce(() => new Promise((ok, fail) => { resolve = ok; reject = fail; }));
  mount(); typePin(); submit(); act(() => go('/away')); act(() => go(link(b)));
  childPinLogin.mockResolvedValueOnce(payload(b)); typePin(); submit();
  await screen.findByRole('heading', { name: '今天的任务' });
  const current = captureSession('student');
  await act(async () => outcome === 'resolve' ? resolve(payload(a)) : reject({ response: { status: 401 } }));
  expect(captureSession('student')).toBe(current);
  expect(current.actorId).toBe(b);
});

test('StrictMode cleanup does not discard the next valid PIN input', async () => {
  window.history.replaceState({}, '', link());
  render(<React.StrictMode><ChildAuthProvider><BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes><Route path="/child/login" element={<ChildPinLoginPage />} /><Route path="/child/today" element={<h1>今天的任务</h1>} /></Routes>
  </BrowserRouter></ChildAuthProvider></React.StrictMode>);
  childPinLogin.mockResolvedValueOnce(payload(a)); typePin();
  expect(screen.getByLabelText('PIN')).toHaveValue('2468'); submit();
  await screen.findByRole('heading', { name: '今天的任务' });
  expect(captureSession('student')?.actorId).toBe(a);
});

test('explicit keep current clears the other target without requesting it', () => {
  saveChildSession(payload(a)); mount(link(b)); const initial = captureSession('student');
  fireEvent.click(screen.getByRole('button', { name: '保留当前孩子' }));
  expect(window.location.pathname).toBe('/child/today'); expect(window.location.hash).toBe('');
  expect(captureSession('student')).toBe(initial); expect(childPinLogin).not.toHaveBeenCalled();
});

test('different existing identity cannot continue silently; cancel and stale confirmation preserve identity', () => {
  saveChildSession(payload(a)); mount(link(b)); const initial = captureSession('student');
  expect(screen.queryByRole('button', { name: '继续使用孩子A' })).not.toBeInTheDocument();
  const confirm = jest.spyOn(window, 'confirm').mockReturnValueOnce(false);
  const before = storage(); fireEvent.click(screen.getByRole('button', { name: '切换到此入口' }));
  expect(storage()).toEqual(before); expect(captureSession('student')).toBe(initial);
  confirm.mockImplementationOnce(() => { saveChildSession(payload(b)); return true; });
  fireEvent.click(screen.getByRole('button', { name: '切换到此入口' }));
  expect(captureSession('student')?.actorId).toBe(b); expect(childPinLogin).not.toHaveBeenCalled();
});
