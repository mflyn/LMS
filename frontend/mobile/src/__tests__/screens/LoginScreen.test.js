import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../../components/LoginScreen';

// 模拟导航
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => {
  return {
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
  };
});

// 模拟AuthContext
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: jest.fn().mockImplementation((username, password) => {
      if (username === 'student1' && password === 'password123') {
        return Promise.resolve(true);
      } else {
        return Promise.reject(new Error('Invalid credentials'));
      }
    }),
    isAuthenticated: false,
  }),
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('渲染登录表单', () => {
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);
    
    // 验证表单元素存在
    expect(getByPlaceholderText('用户名')).toBeTruthy();
    expect(getByPlaceholderText('密码')).toBeTruthy();
    expect(getByText('登录')).toBeTruthy();
  });

  test('输入无效凭据时显示错误信息', async () => {
    const { getByPlaceholderText, getByText, findByText } = render(<LoginScreen />);
    
    // 输入无效凭据
    fireEvent.changeText(getByPlaceholderText('用户名'), 'wronguser');
    fireEvent.changeText(getByPlaceholderText('密码'), 'wrongpass');
    
    // 点击登录按钮
    fireEvent.press(getByText('登录'));
    
    // 等待错误消息显示
    const errorMessage = await findByText('登录失败，请检查用户名和密码');
    expect(errorMessage).toBeTruthy();
    
    // 验证导航没有被调用
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('输入有效凭据时导航到仪表盘', async () => {
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);
    
    // 输入有效凭据
    fireEvent.changeText(getByPlaceholderText('用户名'), 'student1');
    fireEvent.changeText(getByPlaceholderText('密码'), 'password123');
    
    // 点击登录按钮
    fireEvent.press(getByText('登录'));
    
    // 等待导航被调用
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('Dashboard');
    });
  });

  test('表单验证 - 空字段', async () => {
    const { getByText, findByText } = render(<LoginScreen />);
    
    // 不输入任何内容，直接点击登录
    fireEvent.press(getByText('登录'));
    
    // 等待验证消息显示
    const usernameError = await findByText('请输入用户名');
    const passwordError = await findByText('请输入密码');
    
    expect(usernameError).toBeTruthy();
    expect(passwordError).toBeTruthy();
    
    // 验证login函数没有被调用
    const { useAuth } = require('../../contexts/AuthContext');
    expect(useAuth().login).not.toHaveBeenCalled();
  });

  test('登录过程中显示加载状态', async () => {
    // 模拟登录函数返回一个延迟的Promise
    const { useAuth } = require('../../contexts/AuthContext');
    useAuth().login.mockImplementationOnce(() => {
      return new Promise(resolve => {
        setTimeout(() => resolve(true), 100);
      });
    });
    
    const { getByPlaceholderText, getByText, findByTestId } = render(<LoginScreen />);
    
    // 输入有效凭据
    fireEvent.changeText(getByPlaceholderText('用户名'), 'student1');
    fireEvent.changeText(getByPlaceholderText('密码'), 'password123');
    
    // 点击登录按钮
    fireEvent.press(getByText('登录'));
    
    // 等待加载指示器显示
    const loadingIndicator = await findByTestId('loading-indicator');
    expect(loadingIndicator).toBeTruthy();
    
    // 等待导航被调用
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('Dashboard');
    });
  });
});