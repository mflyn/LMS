import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from '../../pages/Login';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock antd message
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  message: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(() => jest.fn()),
  },
}));

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock AuthContext
const mockLogin = jest.fn();
const mockLoginWithEmailOrPhone = jest.fn();
const mockAuthContextValue = {
  login: mockLogin,
  loginWithEmailOrPhone: mockLoginWithEmailOrPhone,
  user: null,
  token: null,
  register: jest.fn(),
  logout: jest.fn(),
  loading: false,
};

const renderWithProviders = (component) => {
  return render(
    <BrowserRouter>
      <AuthProvider value={mockAuthContextValue}>
        {component}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Login 组件测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该渲染登录表单', () => {
    renderWithProviders(<Login />);
    
    expect(screen.getByText('用户登录')).toBeInTheDocument();
    expect(screen.getByText('用户名登录')).toBeInTheDocument();
    expect(screen.getByText('邮箱/手机号登录')).toBeInTheDocument();
  });

  it('应该在用户名登录标签页显示用户名输入框和用户类型选择', () => {
    renderWithProviders(<Login />);
    
    // 默认应该在用户名登录标签页
    expect(screen.getByPlaceholderText('请输入用户名')).toBeInTheDocument();
    expect(screen.getByText('请选择用户类型')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('请输入邮箱或手机号')).not.toBeInTheDocument();
  });

  it('应该在邮箱/手机号登录标签页显示标识符输入框', () => {
    renderWithProviders(<Login />);
    
    // 点击邮箱/手机号登录标签
    fireEvent.click(screen.getByText('邮箱/手机号登录'));
    
    expect(screen.getByPlaceholderText('请输入邮箱或手机号')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('请输入用户名')).not.toBeInTheDocument();
    expect(screen.queryByText('请选择用户类型')).not.toBeInTheDocument();
  });

  it('应该验证邮箱/手机号格式', async () => {
    renderWithProviders(<Login />);
    
    // 切换到邮箱/手机号登录
    fireEvent.click(screen.getByText('邮箱/手机号登录'));
    
    // 填写无效格式
    const identifierInput = screen.getByPlaceholderText('请输入邮箱或手机号');
    fireEvent.change(identifierInput, { target: { value: 'invalid-format' } });
    
    // 触发验证
    fireEvent.blur(identifierInput);
    
    await waitFor(() => {
      expect(screen.getByText('请输入有效的邮箱地址或手机号')).toBeInTheDocument();
    });
  });

  it('应该成功提交用户名登录表单', async () => {
    mockLogin.mockResolvedValue({ success: true });
    renderWithProviders(<Login />);
    
    // 填写表单
    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), { 
      target: { value: 'testuser' } 
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { 
      target: { value: 'Test123!@#' } 
    });
    
    // 选择用户类型
    fireEvent.mouseDown(screen.getByText('请选择用户类型'));
    fireEvent.click(screen.getByText('学生'));
    
    // 提交表单
    fireEvent.click(screen.getByText('登录'));
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'Test123!@#',
        role: 'student'
      });
    });
  });

  it('应该成功提交邮箱登录表单', async () => {
    mockLoginWithEmailOrPhone.mockResolvedValue({ success: true });
    renderWithProviders(<Login />);
    
    // 切换到邮箱/手机号登录
    fireEvent.click(screen.getByText('邮箱/手机号登录'));
    
    // 填写表单
    fireEvent.change(screen.getByPlaceholderText('请输入邮箱或手机号'), { 
      target: { value: 'test@example.com' } 
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { 
      target: { value: 'Test123!@#' } 
    });
    
    // 提交表单
    fireEvent.click(screen.getByText('登录'));
    
    await waitFor(() => {
      expect(mockLoginWithEmailOrPhone).toHaveBeenCalledWith({
        identifier: 'test@example.com',
        password: 'Test123!@#'
      });
    });
  });

  it('应该成功提交手机号登录表单', async () => {
    mockLoginWithEmailOrPhone.mockResolvedValue({ success: true });
    renderWithProviders(<Login />);
    
    // 切换到邮箱/手机号登录
    fireEvent.click(screen.getByText('邮箱/手机号登录'));
    
    // 填写表单
    fireEvent.change(screen.getByPlaceholderText('请输入邮箱或手机号'), { 
      target: { value: '13800138000' } 
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { 
      target: { value: 'Test123!@#' } 
    });
    
    // 提交表单
    fireEvent.click(screen.getByText('登录'));
    
    await waitFor(() => {
      expect(mockLoginWithEmailOrPhone).toHaveBeenCalledWith({
        identifier: '13800138000',
        password: 'Test123!@#'
      });
    });
  });

  it('应该处理用户名登录失败', async () => {
    const { message } = require('antd');
    mockLogin.mockRejectedValue(new Error('登录失败'));
    renderWithProviders(<Login />);
    
    // 填写表单
    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), { 
      target: { value: 'testuser' } 
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { 
      target: { value: 'Test123!@#' } 
    });
    
    // 选择用户类型
    fireEvent.mouseDown(screen.getByText('请选择用户类型'));
    fireEvent.click(screen.getByText('学生'));
    
    // 提交表单
    fireEvent.click(screen.getByText('登录'));
    
    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('登录失败，请重试');
    });
  });

  it('应该处理邮箱/手机号登录失败', async () => {
    const { message } = require('antd');
    mockLoginWithEmailOrPhone.mockRejectedValue(new Error('登录失败'));
    renderWithProviders(<Login />);
    
    // 切换到邮箱/手机号登录
    fireEvent.click(screen.getByText('邮箱/手机号登录'));
    
    // 填写表单
    fireEvent.change(screen.getByPlaceholderText('请输入邮箱或手机号'), { 
      target: { value: 'test@example.com' } 
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { 
      target: { value: 'Test123!@#' } 
    });
    
    // 提交表单
    fireEvent.click(screen.getByText('登录'));
    
    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('登录失败，请重试');
    });
  });

  it('应该验证必填字段', async () => {
    renderWithProviders(<Login />);
    
    // 不填写任何字段直接提交
    fireEvent.click(screen.getByText('登录'));
    
    await waitFor(() => {
      expect(screen.getByText('请输入用户名')).toBeInTheDocument();
      expect(screen.getByText('请输入密码')).toBeInTheDocument();
      expect(screen.getByText('请选择用户类型')).toBeInTheDocument();
    });
  });

  it('应该在邮箱/手机号登录时验证必填字段', async () => {
    renderWithProviders(<Login />);
    
    // 切换到邮箱/手机号登录
    fireEvent.click(screen.getByText('邮箱/手机号登录'));
    
    // 不填写任何字段直接提交
    fireEvent.click(screen.getByText('登录'));
    
    await waitFor(() => {
      expect(screen.getByText('请输入邮箱或手机号')).toBeInTheDocument();
      expect(screen.getByText('请输入密码')).toBeInTheDocument();
    });
  });

  it('应该显示注册链接', () => {
    renderWithProviders(<Login />);
    
    const registerLink = screen.getByText('没有账号？立即注册');
    expect(registerLink).toBeInTheDocument();
    
    fireEvent.click(registerLink);
    expect(mockNavigate).toHaveBeenCalledWith('/register');
  });

  it('应该在登录成功后跳转到首页', async () => {
    mockLogin.mockResolvedValue({ success: true });
    renderWithProviders(<Login />);
    
    // 填写表单
    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), { 
      target: { value: 'testuser' } 
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { 
      target: { value: 'Test123!@#' } 
    });
    
    // 选择用户类型
    fireEvent.mouseDown(screen.getByText('请选择用户类型'));
    fireEvent.click(screen.getByText('学生'));
    
    // 提交表单
    fireEvent.click(screen.getByText('登录'));
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('应该在邮箱/手机号登录成功后跳转到首页', async () => {
    mockLoginWithEmailOrPhone.mockResolvedValue({ success: true });
    renderWithProviders(<Login />);
    
    // 切换到邮箱/手机号登录
    fireEvent.click(screen.getByText('邮箱/手机号登录'));
    
    // 填写表单
    fireEvent.change(screen.getByPlaceholderText('请输入邮箱或手机号'), { 
      target: { value: 'test@example.com' } 
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { 
      target: { value: 'Test123!@#' } 
    });
    
    // 提交表单
    fireEvent.click(screen.getByText('登录'));
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('应该正确识别邮箱格式', async () => {
    renderWithProviders(<Login />);
    
    // 切换到邮箱/手机号登录
    fireEvent.click(screen.getByText('邮箱/手机号登录'));
    
    // 测试有效邮箱格式
    const validEmails = [
      'test@example.com',
      'user.name@domain.co.uk',
      'test123@test-domain.com'
    ];
    
    for (const email of validEmails) {
      const identifierInput = screen.getByPlaceholderText('请输入邮箱或手机号');
      fireEvent.change(identifierInput, { target: { value: email } });
      fireEvent.blur(identifierInput);
      
      await waitFor(() => {
        expect(screen.queryByText('请输入有效的邮箱地址或手机号')).not.toBeInTheDocument();
      });
    }
  });

  it('应该正确识别手机号格式', async () => {
    renderWithProviders(<Login />);
    
    // 切换到邮箱/手机号登录
    fireEvent.click(screen.getByText('邮箱/手机号登录'));
    
    // 测试有效手机号格式
    const validPhones = [
      '13800138000',
      '15912345678',
      '18888888888'
    ];
    
    for (const phone of validPhones) {
      const identifierInput = screen.getByPlaceholderText('请输入邮箱或手机号');
      fireEvent.change(identifierInput, { target: { value: phone } });
      fireEvent.blur(identifierInput);
      
      await waitFor(() => {
        expect(screen.queryByText('请输入有效的邮箱地址或手机号')).not.toBeInTheDocument();
      });
    }
  });
}); 