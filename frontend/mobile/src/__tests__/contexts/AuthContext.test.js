import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import axios from 'axios';

// 模拟axios
jest.mock('axios');

// 创建一个测试组件来使用useAuth钩子
const TestComponent = () => {
  const { isAuthenticated, login, logout, currentUser } = useAuth();
  return (
    <>
      <TestAuthStatus status={isAuthenticated ? 'authenticated' : 'not-authenticated'} />
      <TestUserInfo user={currentUser ? JSON.stringify(currentUser) : 'no-user'} />
      <TestLoginButton onPress={() => login('testuser', 'password')} />
      <TestLogoutButton onPress={logout} />
    </>
  );
};

// 辅助测试组件
const TestAuthStatus = ({ status }) => <>{status}</>;
const TestUserInfo = ({ user }) => <>{user}</>;
const TestLoginButton = ({ onPress }) => <button onPress={onPress}>Login</button>;
const TestLogoutButton = ({ onPress }) => <button onPress={onPress}>Logout</button>;

describe('AuthContext (Mobile)', () => {
  beforeEach(() => {
    // 清除AsyncStorage模拟
    jest.clearAllMocks();
    // 模拟AsyncStorage
    jest.mock('@react-native-async-storage/async-storage', () => ({
      getItem: jest.fn(() => Promise.resolve(null)),
      setItem: jest.fn(() => Promise.resolve()),
      removeItem: jest.fn(() => Promise.resolve())
    }));
  });

  test('初始状态应该是未认证的', async () => {
    const { getByText } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByText('not-authenticated')).toBeTruthy();
      expect(getByText('no-user')).toBeTruthy();
    });
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

    const AsyncStorage = require('@react-native-async-storage/async-storage');

    const { getByText } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // 点击登录按钮
    const loginButton = getByText('Login');
    await act(async () => {
      loginButton.props.onPress();
    });

    // 等待状态更新
    await waitFor(() => {
      expect(getByText('authenticated')).toBeTruthy();
      expect(getByText(JSON.stringify(mockUser))).toBeTruthy();
    });

    // 验证AsyncStorage中保存了token
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('token', 'fake-token');
  });

  test('登录失败应该保持未认证状态', async () => {
    // 模拟登录失败
    axios.post.mockRejectedValueOnce(new Error('Invalid credentials'));

    const { getByText } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // 点击登录按钮
    const loginButton = getByText('Login');
    await act(async () => {
      loginButton.props.onPress();
    });

    // 等待操作完成
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/auth/login', {
        username: 'testuser',
        password: 'password'
      });
    });

    // 状态应该保持未认证
    expect(getByText('not-authenticated')).toBeTruthy();
    expect(getByText('no-user')).toBeTruthy();
  });

  test('登出应该清除认证状态', async () => {
    // 模拟已登录状态
    const mockUser = { id: '1', name: 'Test User', role: 'student' };
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    
    // 模拟AsyncStorage已存储token
    AsyncStorage.getItem.mockResolvedValueOnce('fake-token');
    
    // 模拟获取用户信息的响应
    axios.get.mockResolvedValueOnce({
      data: {
        user: mockUser
      }
    });

    const { getByText } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // 等待初始化完成
    await waitFor(() => {
      expect(getByText('authenticated')).toBeTruthy();
    });

    // 点击登出按钮
    const logoutButton = getByText('Logout');
    await act(async () => {
      logoutButton.props.onPress();
    });

    // 验证状态已更新
    await waitFor(() => {
      expect(getByText('not-authenticated')).toBeTruthy();
      expect(getByText('no-user')).toBeTruthy();
    });
    
    // 验证AsyncStorage中的token被清除
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('token');
  });
});