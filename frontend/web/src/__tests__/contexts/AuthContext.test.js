import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import axios from 'axios';

// 模拟axios
jest.mock('axios');

// 创建一个测试组件来使用useAuth钩子
const TestComponent = () => {
  const { isAuthenticated, login, logout, currentUser } = useAuth();
  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'not-authenticated'}</div>
      <div data-testid="user-info">{currentUser ? JSON.stringify(currentUser) : 'no-user'}</div>
      <button onClick={() => login('testuser', 'password')} data-testid="login-button">Login</button>
      <button onClick={logout} data-testid="logout-button">Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    // 清除localStorage
    localStorage.clear();
    // 重置所有模拟
    jest.clearAllMocks();
  });

  test('初始状态应该是未认证的', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
    expect(screen.getByTestId('user-info')).toHaveTextContent('no-user');
  });

  test('登录成功后应该更新认证状态', async () => {
    // 模拟登录成功响应
    const mockUser = { id: '1', name: 'Test User', role: 'student' };
    axios.post.mockResolvedValueOnce({
      data: {
        token: 'fake-token',
        user: mockUser
      }
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // 点击登录按钮
    fireEvent.click(screen.getByTestId('login-button'));

    // 等待状态更新
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-info')).toHaveTextContent(JSON.stringify(mockUser));
    });

    // 验证localStorage中保存了token
    expect(localStorage.getItem('token')).toBe('fake-token');
  });

  test('登录失败应该保持未认证状态', async () => {
    // 模拟登录失败
    axios.post.mockRejectedValueOnce(new Error('Invalid credentials'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // 点击登录按钮
    fireEvent.click(screen.getByTestId('login-button'));

    // 等待操作完成
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/auth/login', {
        username: 'testuser',
        password: 'password'
      });
    });

    // 状态应该保持未认证
    expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
    expect(screen.getByTestId('user-info')).toHaveTextContent('no-user');
    expect(localStorage.getItem('token')).toBeNull();
  });

  test('登出应该清除认证状态', async () => {
    // 先设置一个token到localStorage
    localStorage.setItem('token', 'fake-token');
    
    // 模拟获取用户信息的响应
    const mockUser = { id: '1', name: 'Test User', role: 'student' };
    axios.get.mockResolvedValueOnce({
      data: {
        user: mockUser
      }
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // 等待初始化完成
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });

    // 点击登出按钮
    fireEvent.click(screen.getByTestId('logout-button'));

    // 验证状态已更新
    expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
    expect(screen.getByTestId('user-info')).toHaveTextContent('no-user');
    expect(localStorage.getItem('token')).toBeNull();
  });
});