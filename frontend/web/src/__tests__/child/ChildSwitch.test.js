import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ChildAuthProvider } from '../../contexts/ChildAuthContext';
import ChildPinLoginPage from '../../pages/child/ChildPinLoginPage';
import ChildShell from '../../components/child/ChildShell';
import { childPinLogin } from '../../services/childApi';
import { captureSession, saveChildSession, saveParentSession, PARENT_SESSION_KEY } from '../../services/familySession';

jest.mock('../../services/childApi', () => ({ childPinLogin: jest.fn() }));
const child = id => ({ token: `synthetic-${id}`, child: { childId: id, familyId: 'family', name: `孩子${id}` } });
const mount = (path = '/child/login') => render(<ChildAuthProvider><MemoryRouter initialEntries={[path]}
  future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes>
  <Route path="/child/login" element={<ChildPinLoginPage />} />
  <Route path="/child" element={<ChildShell />}><Route path="today" element={<h1>今天的任务</h1>} /></Route>
</Routes></MemoryRouter></ChildAuthProvider>);

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); jest.clearAllMocks(); });

test('existing identity offers an explicit continue action, including a copied-tab session', () => {
  saveChildSession(child('A')); mount();
  expect(screen.getByRole('heading', { name: '孩子登录' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '今天的任务' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '继续使用孩子A' }));
  expect(screen.getByRole('heading', { name: '今天的任务' })).toBeInTheDocument();
  expect(childPinLogin).not.toHaveBeenCalled();
});

test('cancelled switch keeps the current page and identity; confirmed switch requires a fresh PIN', async () => {
  saveParentSession({ token: 'synthetic-parent', user: { id: 'parent', role: 'parent' } });
  const parent = localStorage.getItem(PARENT_SESSION_KEY);
  saveChildSession(child('A')); const old = captureSession('student'); mount('/child/today');
  const confirm = jest.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
  try {
    fireEvent.click(screen.getByRole('button', { name: '切换孩子' }));
    expect(screen.getByRole('heading', { name: '今天的任务' })).toBeInTheDocument();
    expect(captureSession('student')).toBe(old);
    fireEvent.click(screen.getByRole('button', { name: '切换孩子' }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('未提交'));
    expect(screen.getByRole('heading', { name: '孩子登录' })).toBeInTheDocument();
    expect(captureSession('student')).toBeNull();
    expect(screen.getByLabelText('PIN')).toHaveValue('');
    expect(childPinLogin).not.toHaveBeenCalled();
    childPinLogin.mockResolvedValueOnce(child('B'));
    fireEvent.change(screen.getByLabelText('家庭 ID'), { target: { value: 'family' } });
    fireEvent.change(screen.getByLabelText('孩子 ID'), { target: { value: 'B' } });
    fireEvent.change(screen.getByLabelText('PIN'), { target: { value: '2468' } });
    fireEvent.click(screen.getByRole('button', { name: '进入我的成长空间' }));
    await waitFor(() => expect(captureSession('student')?.actorId).toBe('B'));
    expect(screen.getByRole('heading', { name: '今天的任务' })).toBeInTheDocument();
    expect(screen.getByText('孩子B')).toBeInTheDocument();
    expect(screen.queryByText('孩子A')).not.toBeInTheDocument();
    expect(localStorage.getItem(PARENT_SESSION_KEY)).toBe(parent);
  } finally { confirm.mockRestore(); }
});

test('storage failure reports a local login problem without navigating or persisting shared credentials', async () => {
  childPinLogin.mockResolvedValueOnce(child('A')); mount();
  const original = Storage.prototype.setItem;
  const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function set(key, value) {
    if (this === sessionStorage) throw new Error('unavailable');
    return original.call(this, key, value);
  });
  try {
    fireEvent.change(screen.getByLabelText('家庭 ID'), { target: { value: 'family' } });
    fireEvent.change(screen.getByLabelText('孩子 ID'), { target: { value: 'A' } });
    fireEvent.change(screen.getByLabelText('PIN'), { target: { value: '2468' } });
    fireEvent.click(screen.getByRole('button', { name: '进入我的成长空间' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('无法保存本页登录状态');
    expect(screen.getByRole('heading', { name: '孩子登录' })).toBeInTheDocument();
    expect(captureSession('student')).toBeNull();
    expect(screen.getByLabelText('PIN')).toHaveValue('');
  } finally { write.mockRestore(); }
});
