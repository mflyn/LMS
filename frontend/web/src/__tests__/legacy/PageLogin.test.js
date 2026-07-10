import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from '../../pages/Login';
import { AuthProvider } from '../../contexts/AuthContext';

// 模拟react-router-dom的useNavigate
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

// 模拟AuthContext
jest.mock('../../contexts/AuthContext', () => {
  const originalModule = jest.requireActual('../../contexts/AuthContext');
  return {
    ...originalModule,
    useAuth: () => ({
      login: jest.fn().mockImplementation((username, password) => {
        if (username === 'testuser' && password === 'password') {
          return Promise.resolve(true);
        } else {
          return Promise.reject(new Error('Invalid credentials'));
        }
      }),
      isAuthenticated: false,
    }),
  };
});

const renderLoginPage = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Login页面', () => {
  test('应该渲染登录表单', () => {
    renderLoginPage();
    
    // 验证页面标题
    expect(screen.getByText('小学生学习追踪系统')).toBeInTheDocument();
    expect(screen.getByText('请登录您的账号')).toBeInTheDocument();
    
    // 验证表单元素
    expect(screen.getByPlaceholderText('用户名')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /登录/i })).toBeInTheDocument();
  });

  test('用户名和密码为空时应该显示错误提示', async () => {
    renderLoginPage();
    
    // 点击登录按钮但不填写任何字段
    fireEvent.click(screen.getByRole('button', { name: /登录/i }));
    
    // 等待验证消息出现
    await waitFor(() => {
      expect(screen.getByText('请输入用户名')).toBeInTheDocument();
      expect(screen.getByText('请输入密码')).toBeInTheDocument();
    });
  });

  test('应该能够切换用户类型', () => {
    renderLoginPage();
    
    // 检查默认选中的是学生
    const studentRadio = screen.getByLabelText('学生');
    const teacherRadio = screen.getByLabelText('教师');
    const parentRadio = screen.getByLabelText('家长');
    
    expect(studentRadio).toBeChecked();
    
    // 切换到教师
    fireEvent.click(teacherRadio);
    expect(teacherRadio).toBeChecked();
    expect(studentRadio).not.toBeChecked();
    
    // 切换到家长
    fireEvent.click(parentRadio);
    expect(parentRadio).toBeChecked();
    expect(teacherRadio).not.toBeChecked();
  });

  test('提交有效凭据应该调用登录函数', async () => {
    renderLoginPage();
    
    // 填写表单
    fireEvent.change(screen.getByPlaceholderText('用户名'), {
      target: { value: 'testuser' },
    });
    fireEvent.change(screen.getByPlaceholderText('密码'), {
      target: { value: 'password' },
    });
    
    // 提交表单
    fireEvent.click(screen.getByRole('button', { name: /登录/i }));
    
    // 验证登录函数被调用
    const { useAuth } = require('../../contexts/AuthContext');
    await waitFor(() => {
      expect(useAuth().login).toHaveBeenCalledWith('testuser', 'password');
    });
  });
});