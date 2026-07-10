import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { PARENT_SESSION_EXPIRED_EVENT, PARENT_SESSION_KEY } from '../../services/familySession';

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
