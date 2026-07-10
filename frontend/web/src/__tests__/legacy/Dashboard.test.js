import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import Dashboard from '../../pages/Dashboard';
import { AuthProvider } from '../../contexts/AuthContext';
import axios from 'axios';

// 模拟axios
jest.mock('axios');

// 模拟AuthContext
jest.mock('../../contexts/AuthContext', () => {
  return {
    useAuth: () => ({
      userRole: 'student',
      currentUser: { id: '1', name: '张小明', role: 'student' },
      isAuthenticated: true
    }),
    AuthProvider: ({ children }) => <div>{children}</div>
  };
});

// 模拟WebSocketContext
jest.mock('../../contexts/WebSocketContext', () => {
  return {
    useWebSocket: () => ({
      subscribe: jest.fn(),
      unsubscribe: jest.fn()
    })
  };
});

describe('Dashboard页面', () => {
  const mockStudentDashboardData = {
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('应该显示加载状态', async () => {
    // 模拟API请求延迟
    axios.get.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ data: {} }), 100)));
    
    render(<Dashboard />);
    
    // 验证加载状态显示
    expect(screen.getByText(/加载中/i)).toBeInTheDocument();
  });

  test('学生仪表盘应该正确显示数据', async () => {
    // 模拟API请求返回
    axios.get.mockResolvedValueOnce({ data: mockStudentDashboardData });
    
    render(<Dashboard />);
    
    // 等待数据加载完成
    await waitFor(() => {
      // 验证概览数据
      expect(screen.getByText('3')).toBeInTheDocument(); // 已完成课程
      expect(screen.getByText('2')).toBeInTheDocument(); // 进行中课程
      expect(screen.getByText('75%')).toBeInTheDocument(); // 完成率
      
      // 验证最近进度
      expect(screen.getByText('分数加减法')).toBeInTheDocument();
      expect(screen.getByText('唐诗赏析')).toBeInTheDocument();
      
      // 验证即将到期作业
      expect(screen.getByText('数学作业 - 分数应用题')).toBeInTheDocument();
      expect(screen.getByText('语文作业 - 作文')).toBeInTheDocument();
      
      // 验证薄弱环节
      expect(screen.getByText('分数乘除法')).toBeInTheDocument();
      expect(screen.getByText('过去完成时')).toBeInTheDocument();
    });
  });

  test('API请求失败应该显示错误信息', async () => {
    // 模拟API请求失败
    axios.get.mockRejectedValueOnce(new Error('Failed to fetch dashboard data'));
    
    render(<Dashboard />);
    
    // 等待错误信息显示
    await waitFor(() => {
      expect(screen.getByText(/获取仪表盘数据失败/i)).toBeInTheDocument();
    });
  });
});