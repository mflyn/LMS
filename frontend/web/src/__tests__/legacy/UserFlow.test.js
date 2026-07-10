import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from '../../App';
import { AuthProvider } from '../../contexts/AuthContext';
import { WebSocketProvider } from '../../contexts/WebSocketContext';
import axios from 'axios';

// 模拟axios
jest.mock('axios');

// 模拟react-router-dom的useNavigate
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

const renderApp = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <WebSocketProvider>
          <App />
        </WebSocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('用户流程集成测试', () => {
  beforeEach(() => {
    // 清除localStorage
    localStorage.clear();
    // 重置所有模拟
    jest.clearAllMocks();
  });

  test('用户登录并查看仪表盘的完整流程', async () => {
    // 模拟登录API响应
    const mockUser = { id: '1', name: '张小明', role: 'student' };
    axios.post.mockResolvedValueOnce({
      data: {
        token: 'fake-token',
        user: mockUser
      }
    });

    // 模拟仪表盘数据API响应
    const mockDashboardData = {
      overview: {
        completedCourses: 3,
        inProgressCourses: 2,
        completionRate: 75,
        learningTime: 120
      },
      recentProgress: [
        { id: '1', subject: '数学', chapter: '分数', section: '分数加减法', completionRate: 80, updatedAt: '2023-06-15T10:30:00Z' },
        { id: '2', subject: '语文', chapter: '古诗词', section: '唐诗赏析', completionRate: 65, updatedAt: '2023-06-14T14:20:00Z' }
      ],
      upcomingHomework: [
        { id: '1', title: '数学作业 - 分数应用题', dueDate: '2023-06-20T23:59:59Z', subject: '数学', status: 'pending' },
        { id: '2', title: '语文作业 - 作文', dueDate: '2023-06-18T23:59:59Z', subject: '语文', status: 'pending' }
      ],
      weakPoints: [
        { id: '1', subject: '数学', topic: '分数乘除法', masteryLevel: 40 },
        { id: '2', subject: '英语', topic: '过去完成时', masteryLevel: 35 }
      ]
    };
    axios.get.mockResolvedValueOnce({ data: mockDashboardData });

    renderApp();

    // 验证初始状态是登录页面
    expect(screen.getByText('小学生学习追踪系统')).toBeInTheDocument();
    expect(screen.getByText('请登录您的账号')).toBeInTheDocument();

    // 填写登录表单
    fireEvent.change(screen.getByPlaceholderText('用户名'), {
      target: { value: 'student1' },
    });
    fireEvent.change(screen.getByPlaceholderText('密码'), {
      target: { value: 'password123' },
    });

    // 提交登录表单
    fireEvent.click(screen.getByRole('button', { name: /登录/i }));

    // 等待登录完成并导航到仪表盘
    await waitFor(() => {
      // 验证axios.post被调用
      expect(axios.post).toHaveBeenCalledWith('/api/auth/login', {
        username: 'student1',
        password: 'password123'
      });
    });

    // 验证仪表盘页面加载
    await waitFor(() => {
      expect(screen.getByText('学习概览')).toBeInTheDocument();
      expect(screen.getByText('最近进度')).toBeInTheDocument();
      expect(screen.getByText('即将到期作业')).toBeInTheDocument();
    });

    // 验证仪表盘数据显示
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument(); // 已完成课程
      expect(screen.getByText('2')).toBeInTheDocument(); // 进行中课程
      expect(screen.getByText('75%')).toBeInTheDocument(); // 完成率
      
      // 验证最近进度
      expect(screen.getByText('分数加减法')).toBeInTheDocument();
      expect(screen.getByText('唐诗赏析')).toBeInTheDocument();
      
      // 验证即将到期作业
      expect(screen.getByText('数学作业 - 分数应用题')).toBeInTheDocument();
      expect(screen.getByText('语文作业 - 作文')).toBeInTheDocument();
    });

    // 验证导航到其他页面
    // 点击学习资源菜单项
    fireEvent.click(screen.getByText('学习资源'));
    
    // 模拟资源列表API响应
    axios.get.mockResolvedValueOnce({
      data: {
        resources: [
          { id: '1', title: '数学分数教学视频', type: 'video', subject: '数学' },
          { id: '2', title: '语文古诗词赏析', type: 'document', subject: '语文' }
        ]
      }
    });

    // 验证资源页面加载
    await waitFor(() => {
      expect(screen.getByText('学习资源')).toBeInTheDocument();
      expect(screen.getByText('数学分数教学视频')).toBeInTheDocument();
      expect(screen.getByText('语文古诗词赏析')).toBeInTheDocument();
    });
  });

  test('登录失败应显示错误信息', async () => {
    // 模拟登录失败
    axios.post.mockRejectedValueOnce({
      response: {
        status: 401,
        data: { message: '用户名或密码错误' }
      }
    });

    renderApp();

    // 填写登录表单
    fireEvent.change(screen.getByPlaceholderText('用户名'), {
      target: { value: 'wronguser' },
    });
    fireEvent.change(screen.getByPlaceholderText('密码'), {
      target: { value: 'wrongpass' },
    });

    // 提交登录表单
    fireEvent.click(screen.getByRole('button', { name: /登录/i }));

    // 等待错误消息显示
    await waitFor(() => {
      expect(screen.getByText('登录失败，请检查用户名和密码')).toBeInTheDocument();
    });

    // 验证仍然在登录页面
    expect(screen.getByText('请登录您的账号')).toBeInTheDocument();
  });
});