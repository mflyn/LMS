import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import DashboardScreen from '../../components/DashboardScreen';
import axios from 'axios';

// 模拟axios
jest.mock('axios');

// 模拟导航
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

// 模拟AuthContext
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { id: '1', name: '张小明', role: 'student' },
    isAuthenticated: true,
  }),
}));

describe('DashboardScreen', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('显示加载状态', async () => {
    // 模拟API请求延迟
    axios.get.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ data: {} }), 100)));
    
    const { getByTestId } = render(<DashboardScreen />);
    
    // 验证加载状态显示
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  test('成功加载并显示仪表盘数据', async () => {
    // 模拟API请求返回
    axios.get.mockResolvedValueOnce({ data: mockDashboardData });
    
    const { getByText, getAllByText } = render(<DashboardScreen />);
    
    // 等待数据加载完成
    await waitFor(() => {
      // 验证概览数据
      expect(getByText('3')).toBeTruthy(); // 已完成课程
      expect(getByText('2')).toBeTruthy(); // 进行中课程
      expect(getByText('75%')).toBeTruthy(); // 完成率
      
      // 验证最近进度
      expect(getByText('分数加减法')).toBeTruthy();
      expect(getByText('唐诗赏析')).toBeTruthy();
      
      // 验证即将到期作业
      expect(getByText('数学作业 - 分数应用题')).toBeTruthy();
      expect(getByText('语文作业 - 作文')).toBeTruthy();
      
      // 验证薄弱环节
      expect(getByText('分数乘除法')).toBeTruthy();
      expect(getByText('过去完成时')).toBeTruthy();
    });
  });

  test('API请求失败时显示错误信息', async () => {
    // 模拟API请求失败
    axios.get.mockRejectedValueOnce(new Error('Failed to fetch dashboard data'));
    
    const { findByText } = render(<DashboardScreen />);
    
    // 等待错误信息显示
    const errorMessage = await findByText('获取数据失败，请稍后重试');
    expect(errorMessage).toBeTruthy();
  });

  test('点击进度项目应导航到详情页面', async () => {
    // 模拟API请求返回
    axios.get.mockResolvedValueOnce({ data: mockDashboardData });
    
    const { getByText, getAllByTestId } = render(<DashboardScreen />);
    
    // 等待数据加载完成
    await waitFor(() => {
      expect(getByText('分数加减法')).toBeTruthy();
    });
    
    // 点击第一个进度项目
    const progressItems = getAllByTestId('progress-item');
    fireEvent.press(progressItems[0]);
    
    // 验证导航到详情页面
    expect(mockNavigate).toHaveBeenCalledWith('ProgressDetail', { progressId: '1' });
  });

  test('点击作业项目应导航到作业详情页面', async () => {
    // 模拟API请求返回
    axios.get.mockResolvedValueOnce({ data: mockDashboardData });
    
    const { getByText, getAllByTestId } = render(<DashboardScreen />);
    
    // 等待数据加载完成
    await waitFor(() => {
      expect(getByText('数学作业 - 分数应用题')).toBeTruthy();
    });
    
    // 点击第一个作业项目
    const homeworkItems = getAllByTestId('homework-item');
    fireEvent.press(homeworkItems[0]);
    
    // 验证导航到作业详情页面
    expect(mockNavigate).toHaveBeenCalledWith('HomeworkDetail', { homeworkId: '1' });
  });
});