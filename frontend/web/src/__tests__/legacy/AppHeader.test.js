import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AppHeader from '../../../components/layout/AppHeader';
import { AuthProvider } from '../../../contexts/AuthContext';

// 模拟AuthContext
jest.mock('../../../contexts/AuthContext', () => {
  return {
    useAuth: () => ({
      currentUser: { id: '1', name: '张小明', role: 'student' },
      logout: jest.fn(),
      isAuthenticated: true
    }),
    AuthProvider: ({ children }) => <div>{children}</div>
  };
});

const renderAppHeader = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <AppHeader />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('AppHeader组件', () => {
  test('应该显示应用标题', () => {
    renderAppHeader();
    expect(screen.getByText(/小学生学习追踪系统/i)).toBeInTheDocument();
  });

  test('应该显示当前用户名', () => {
    renderAppHeader();
    expect(screen.getByText(/张小明/i)).toBeInTheDocument();
  });

  test('点击用户菜单应该显示下拉选项', () => {
    renderAppHeader();
    
    // 点击用户头像或名称打开下拉菜单
    const userMenu = screen.getByText(/张小明/i);
    fireEvent.click(userMenu);
    
    // 验证下拉菜单选项
    expect(screen.getByText(/个人信息/i)).toBeInTheDocument();
    expect(screen.getByText(/退出登录/i)).toBeInTheDocument();
  });

  test('点击退出登录应该调用logout函数', () => {
    renderAppHeader();
    
    // 点击用户头像或名称打开下拉菜单
    const userMenu = screen.getByText(/张小明/i);
    fireEvent.click(userMenu);
    
    // 点击退出登录
    const logoutButton = screen.getByText(/退出登录/i);
    fireEvent.click(logoutButton);
    
    // 验证logout函数被调用
    const { useAuth } = require('../../../contexts/AuthContext');
    expect(useAuth().logout).toHaveBeenCalled();
  });
});