import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Register from '../../pages/Register';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock antd message
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  message: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(() => jest.fn()), // loading returns a function to hide
  },
}));

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock AuthContext
const mockRegister = jest.fn();
const mockAuthContextValue = {
  register: mockRegister,
  user: null,
  token: null,
  login: jest.fn(),
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

describe('Register 组件测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该渲染注册表单', () => {
    renderWithProviders(<Register />);
    
    expect(screen.getByText('用户注册')).toBeInTheDocument();
    expect(screen.getByText('邮箱注册')).toBeInTheDocument();
    expect(screen.getByText('手机号注册')).toBeInTheDocument();
    expect(screen.getByText('混合注册')).toBeInTheDocument();
  });

  it('应该在邮箱注册标签页显示邮箱输入框', () => {
    renderWithProviders(<Register />);
    
    // 默认应该在邮箱注册标签页
    expect(screen.getByPlaceholderText('请输入邮箱')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('请输入手机号')).not.toBeInTheDocument();
  });

  it('应该在手机号注册标签页显示手机号输入框', () => {
    renderWithProviders(<Register />);
    
    // 点击手机号注册标签
    fireEvent.click(screen.getByText('手机号注册'));
    
    expect(screen.getByPlaceholderText('请输入手机号')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('请输入邮箱')).not.toBeInTheDocument();
  });

  it('应该在混合注册标签页显示邮箱和手机号输入框', () => {
    renderWithProviders(<Register />);
    
    // 点击混合注册标签
    fireEvent.click(screen.getByText('混合注册'));
    
    expect(screen.getByPlaceholderText('请输入邮箱')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入手机号')).toBeInTheDocument();
  });

  it('应该验证邮箱格式', async () => {
    renderWithProviders(<Register />);
    
    // 填写无效邮箱
    const emailInput = screen.getByPlaceholderText('请输入邮箱');
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    
    // 触发验证
    fireEvent.blur(emailInput);
    
    await waitFor(() => {
      expect(screen.getByText('请输入有效的邮箱地址')).toBeInTheDocument();
    });
  });

  it('应该验证手机号格式', async () => {
    renderWithProviders(<Register />);
    
    // 切换到手机号注册
    fireEvent.click(screen.getByText('手机号注册'));
    
    // 填写无效手机号
    const phoneInput = screen.getByPlaceholderText('请输入手机号');
    fireEvent.change(phoneInput, { target: { value: '12345678901' } });
    
    // 触发验证
    fireEvent.blur(phoneInput);
    
    await waitFor(() => {
      expect(screen.getByText('请输入有效的中国手机号')).toBeInTheDocument();
    });
  });

  it('应该验证密码强度', async () => {
    renderWithProviders(<Register />);
    
    // 填写弱密码
    const passwordInput = screen.getByPlaceholderText('请输入密码');
    fireEvent.change(passwordInput, { target: { value: 'weak' } });
    
    // 触发验证
    fireEvent.blur(passwordInput);
    
    await waitFor(() => {
      expect(screen.getByText('密码必须包含大小写字母、数字和特殊字符，长度8-20位')).toBeInTheDocument();
    });
  });

  it('应该验证密码确认', async () => {
    renderWithProviders(<Register />);
    
    // 填写密码
    const passwordInput = screen.getByPlaceholderText('请输入密码');
    fireEvent.change(passwordInput, { target: { value: 'Test123!@#' } });
    
    // 填写不匹配的确认密码
    const confirmPasswordInput = screen.getByPlaceholderText('请确认密码');
    fireEvent.change(confirmPasswordInput, { target: { value: 'Different123!@#' } });
    
    // 触发验证
    fireEvent.blur(confirmPasswordInput);
    
    await waitFor(() => {
      expect(screen.getByText('两次输入的密码不一致')).toBeInTheDocument();
    });
  });

  it('应该成功提交邮箱注册表单', async () => {
    mockRegister.mockResolvedValue({ success: true });
    renderWithProviders(<Register />);
    
    // 填写表单
    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), { 
      target: { value: 'testuser' } 
    });
    fireEvent.change(screen.getByPlaceholderText('请输入姓名'), { 
      target: { value: '测试用户' } 
    });
    fireEvent.change(screen.getByPlaceholderText('请输入邮箱'), { 
      target: { value: 'test@example.com' } 
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { 
      target: { value: 'Test123!@#' } 
    });
    fireEvent.change(screen.getByPlaceholderText('请确认密码'), { 
      target: { value: 'Test123!@#' } 
    });
    
    // 选择角色
    fireEvent.mouseDown(screen.getByText('请选择角色'));
    fireEvent.click(screen.getByText('学生'));
    
    // 提交表单
    fireEvent.click(screen.getByText('注册'));
    
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        username: 'testuser',
        name: '测试用户',
        email: 'test@example.com',
        password: 'Test123!@#',
        role: 'student'
      });
    });
  });

  it('应该成功提交手机号注册表单', async () => {
    mockRegister.mockResolvedValue({ success: true });
    renderWithProviders(<Register />);
    
    // 切换到手机号注册
    fireEvent.click(screen.getByText('手机号注册'));
    
    // 填写表单
    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), { 
      target: { value: 'phoneuser' } 
    });
    fireEvent.change(screen.getByPlaceholderText('请输入姓名'), { 
      target: { value: '手机号用户' } 
    });
    fireEvent.change(screen.getByPlaceholderText('请输入手机号'), { 
      target: { value: '13800138000' } 
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { 
      target: { value: 'Test123!@#' } 
    });
    fireEvent.change(screen.getByPlaceholderText('请确认密码'), { 
      target: { value: 'Test123!@#' } 
    });
    
    // 选择角色
    fireEvent.mouseDown(screen.getByText('请选择角色'));
    fireEvent.click(screen.getByText('学生'));
    
    // 提交表单
    fireEvent.click(screen.getByText('注册'));
    
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        username: 'phoneuser',
        name: '手机号用户',
        phone: '13800138000',
        password: 'Test123!@#',
        role: 'student'
      });
    });
  });

  it('应该成功提交混合注册表单', async () => {
    mockRegister.mockResolvedValue({ success: true });
    renderWithProviders(<Register />);
    
    // 切换到混合注册
    fireEvent.click(screen.getByText('混合注册'));
    
    // 填写表单
    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), { 
      target: { value: 'mixeduser' } 
    });
    fireEvent.change(screen.getByPlaceholderText('请输入姓名'), { 
      target: { value: '混合用户' } 
    });
    fireEvent.change(screen.getByPlaceholderText('请输入邮箱'), { 
      target: { value: 'mixed@example.com' } 
    });
    fireEvent.change(screen.getByPlaceholderText('请输入手机号'), { 
      target: { value: '13900139000' } 
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { 
      target: { value: 'Test123!@#' } 
    });
    fireEvent.change(screen.getByPlaceholderText('请确认密码'), { 
      target: { value: 'Test123!@#' } 
    });
    
    // 选择角色
    fireEvent.mouseDown(screen.getByText('请选择角色'));
    fireEvent.click(screen.getByText('学生'));
    
    // 提交表单
    fireEvent.click(screen.getByText('注册'));
    
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        username: 'mixeduser',
        name: '混合用户',
        email: 'mixed@example.com',
        phone: '13900139000',
        password: 'Test123!@#',
        role: 'student'
      });
    });
  });

  it('应该处理注册失败', async () => {
    const { message } = require('antd');
    mockRegister.mockRejectedValue(new Error('注册失败'));
    renderWithProviders(<Register />);
    
    // 填写表单
    fireEvent.change(screen.getByPlaceholderText('请输入用户名'), { 
      target: { value: 'testuser' } 
    });
    fireEvent.change(screen.getByPlaceholderText('请输入姓名'), { 
      target: { value: '测试用户' } 
    });
    fireEvent.change(screen.getByPlaceholderText('请输入邮箱'), { 
      target: { value: 'test@example.com' } 
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), { 
      target: { value: 'Test123!@#' } 
    });
    fireEvent.change(screen.getByPlaceholderText('请确认密码'), { 
      target: { value: 'Test123!@#' } 
    });
    
    // 选择角色
    fireEvent.mouseDown(screen.getByText('请选择角色'));
    fireEvent.click(screen.getByText('学生'));
    
    // 提交表单
    fireEvent.click(screen.getByText('注册'));
    
    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('注册失败，请重试');
    });
  });

  it('应该显示返回登录链接', () => {
    renderWithProviders(<Register />);
    
    const loginLink = screen.getByText('已有账号？立即登录');
    expect(loginLink).toBeInTheDocument();
    
    fireEvent.click(loginLink);
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
}); 