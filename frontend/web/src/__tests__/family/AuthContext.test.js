import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { PARENT_SESSION_EXPIRED_EVENT, PARENT_SESSION_KEY, saveParentSession } from '../../services/familySession';

const AuthProbe = () => {
  const { error, login, logout, status, user } = useAuth();

  return (
    <div>
      <output data-testid="auth-status">{status}</output>
      <output data-testid="auth-user">{user ? user.role : 'none'}</output>
      <output data-testid="auth-error">{error || 'none'}</output>
      <button onClick={() => login('parent_ming', 'parent123')}>登录</button>
      <button onClick={logout}>退出</button>
    </div>
  );
};

describe('parent auth context', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test.each([
    ['legacy 429', { status: 429, data: '请求过于频繁，请稍后再试' }, '请求过于频繁，请稍后再试'],
    ['structured 429', { status: 429, data: { error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' } } }, '请求过于频繁，请稍后再试'],
    ['empty 429', { status: 429 }, '请求过于频繁，请稍后再试'],
    ['misleading 429', { status: 429, data: { error: { message: '密码错误' } } }, '请求过于频繁，请稍后再试'],
    ['401', { status: 401 }, '登录失败，请检查账号和密码'],
    ['structured 401', { status: 401, data: { error: { message: '用户名或密码错误' } } }, '用户名或密码错误'],
    ['503', { status: 503, data: '<html>private upstream failure</html>' }, '登录服务暂时不可用，请稍后再试'],
    ['500 misleading body', { status: 500, data: { error: { message: '密码错误' } } }, '登录服务暂时不可用，请稍后再试'],
    ['network', undefined, '无法连接登录服务，请检查网络后重试'],
    ['unexpected response', { status: 418 }, '登录失败，请稍后再试'],
    ['invalid message type', { status: 400, data: { error: { message: { private: true } } } }, '登录失败，请稍后再试']
  ])('classifies %s without writing a session or retrying', async (_name, response, message) => {
    axios.post.mockRejectedValueOnce({ response });
    localStorage.setItem('synthetic-original-command', 'unchanged');
    render(<AuthProvider><AuthProbe /></AuthProvider>);
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    await waitFor(() => expect(screen.getByTestId('auth-error')).toHaveTextContent(message));
    expect(screen.getByTestId('auth-status')).toHaveTextContent('anonymous');
    expect(localStorage.getItem(PARENT_SESSION_KEY)).toBeNull();
    expect(localStorage.getItem('synthetic-original-command')).toBe('unchanged');
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  test.each(['429', '401', 'success'])('late %s cannot overwrite an externally changed parent identity', async kind => {
    let resolve, reject;
    axios.post.mockImplementationOnce(() => new Promise((yes, no) => { resolve = yes; reject = no; }));
    render(<AuthProvider><AuthProbe /></AuthProvider>);
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    act(() => saveParentSession({ token: 'fresh-token', user: { id: 'parent-b', name: 'B', role: 'parent' } }));
    const before = localStorage.getItem(PARENT_SESSION_KEY);
    await act(async () => {
      if (kind === 'success') resolve({ data: { token: 'old-token', user: { id: 'parent-a', role: 'parent' } } });
      else reject({ response: { status: Number(kind) } });
    });
    expect(localStorage.getItem(PARENT_SESSION_KEY)).toBe(before);
    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('auth-error')).toHaveTextContent('none');
  });

  test('a late throttled attempt cannot overwrite a newer successful attempt', async () => {
    let reject;
    axios.post.mockImplementationOnce(() => new Promise((_yes, no) => { reject = no; }));
    axios.post.mockResolvedValueOnce({ data: { token: 'new-token', user: { id: 'parent-b', role: 'parent' } } });
    render(<AuthProvider><AuthProbe /></AuthProvider>);
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated'));
    await act(async () => reject({ response: { status: 429 } }));
    expect(localStorage.getItem(PARENT_SESSION_KEY)).toContain('new-token');
    expect(screen.getByTestId('auth-error')).toHaveTextContent('none');
  });

  test.each(['429', 'success'])('logout invalidates a held %s', async kind => {
    let resolve, reject;
    axios.post.mockImplementationOnce(() => new Promise((yes, no) => { resolve = yes; reject = no; }));
    render(<AuthProvider><AuthProbe /></AuthProvider>);
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    fireEvent.click(screen.getByRole('button', { name: '退出' }));
    await act(async () => {
      if (kind === 'success') resolve({ data: { token: 'old-token', user: { id: 'parent-a', role: 'parent' } } });
      else reject({ response: { status: 429 } });
    });
    expect(localStorage.getItem(PARENT_SESSION_KEY)).toBeNull();
    expect(screen.getByTestId('auth-error')).toHaveTextContent('none');
  });

  test('persists only a parent login session', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        data: {
          token: 'parent-token',
          user: { id: 'parent-a', name: '小明妈妈', role: 'parent', email: 'private@example.com' }
        }
      }
    });

    render(<AuthProvider><AuthProbe /></AuthProvider>);
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('auth-user')).toHaveTextContent('parent');
    expect(localStorage.getItem(PARENT_SESSION_KEY)).toContain('parent-token');
    expect(localStorage.getItem('token')).toBeNull();
    expect(axios.post).toHaveBeenCalledWith('/api/auth/login', {
      username: 'parent_ming',
      password: 'parent123'
    });
  });

  test('rejects a non-parent login response without creating a parent session', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        data: {
          token: 'student-token',
          user: { id: 'child-a', name: '小明', role: 'student' }
        }
      }
    });

    render(<AuthProvider><AuthProbe /></AuthProvider>);
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => expect(screen.getByTestId('auth-error')).toHaveTextContent('该账号不能进入家长端'));
    expect(screen.getByTestId('auth-status')).toHaveTextContent('anonymous');
    expect(localStorage.getItem(PARENT_SESSION_KEY)).toBeNull();
  });

  test('logout clears the parent session', async () => {
    localStorage.setItem(PARENT_SESSION_KEY, JSON.stringify({
      token: 'parent-token',
      user: { id: 'parent-a', name: '小明妈妈', role: 'parent' }
    }));

    render(<AuthProvider><AuthProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated'));
    fireEvent.click(screen.getByRole('button', { name: '退出' }));

    expect(screen.getByTestId('auth-status')).toHaveTextContent('anonymous');
    expect(localStorage.getItem(PARENT_SESSION_KEY)).toBeNull();
  });

  test('reacts to the shared parent-session expiry event', async () => {
    localStorage.setItem(PARENT_SESSION_KEY, JSON.stringify({
      token: 'expired-parent-token',
      user: { id: 'parent-a', name: '小明妈妈', role: 'parent' }
    }));

    render(<AuthProvider><AuthProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated'));
    act(() => window.dispatchEvent(new Event(PARENT_SESSION_EXPIRED_EVENT)));

    await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('anonymous'));
    expect(localStorage.getItem(PARENT_SESSION_KEY)).toBeNull();
  });
});
