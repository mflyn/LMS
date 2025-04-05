import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ResourceDetailScreen from '../../components/ResourceDetailScreen';
import axios from 'axios';

// 模拟axios
jest.mock('axios');

// 模拟导航和路由
const mockGoBack = jest.fn();
const mockRoute = {
  params: { resourceId: '1' }
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    goBack: mockGoBack,
  }),
  useRoute: () => mockRoute,
}));

// 模拟AuthContext
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { id: '1', name: '张小明', role: 'student' },
    isAuthenticated: true,
  }),
}));

describe('ResourceDetailScreen', () => {
  const mockResourceDetail = {
    id: '1',
    title: '数学分数教学视频',
    type: 'video',
    subject: '数学',
    description: '本视频详细讲解小学生分数的基本概念和运算方法',
    content: 'https://example.com/video/math-fractions',
    duration: '25:30',
    author: '王老师',
    createdAt: '2023-05-10T08:00:00Z',
    tags: ['分数', '小学数学', '基础知识'],
    viewCount: 1250,
    rating: 4.8
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('显示加载状态', async () => {
    // 模拟API请求延迟
    axios.get.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ data: {} }), 100)));
    
    const { getByTestId } = render(<ResourceDetailScreen />);
    
    // 验证加载状态显示
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  test('成功加载并显示资源详情', async () => {
    // 模拟API请求返回
    axios.get.mockResolvedValueOnce({ data: mockResourceDetail });
    
    const { getByText, getByTestId } = render(<ResourceDetailScreen />);
    
    // 等待数据加载完成
    await waitFor(() => {
      // 验证资源标题
      expect(getByText('数学分数教学视频')).toBeTruthy();
      
      // 验证资源描述
      expect(getByText('本视频详细讲解小学生分数的基本概念和运算方法')).toBeTruthy();
      
      // 验证资源作者
      expect(getByText('王老师')).toBeTruthy();
      
      // 验证资源时长
      expect(getByText('25:30')).toBeTruthy();
      
      // 验证资源标签
      expect(getByText('分数')).toBeTruthy();
      expect(getByText('小学数学')).toBeTruthy();
      expect(getByText('基础知识')).toBeTruthy();
    });
    
    // 验证视频播放器存在
    expect(getByTestId('video-player')).toBeTruthy();
  });

  test('点击返回按钮应返回上一页', async () => {
    // 模拟API请求返回
    axios.get.mockResolvedValueOnce({ data: mockResourceDetail });
    
    const { getByTestId } = render(<ResourceDetailScreen />);
    
    // 等待数据加载完成
    await waitFor(() => {
      expect(getByTestId('back-button')).toBeTruthy();
    });
    
    // 点击返回按钮
    fireEvent.press(getByTestId('back-button'));
    
    // 验证返回函数被调用
    expect(mockGoBack).toHaveBeenCalled();
  });

  test('API请求失败时显示错误信息', async () => {
    // 模拟API请求失败
    axios.get.mockRejectedValueOnce(new Error('Failed to fetch resource details'));
    
    const { findByText } = render(<ResourceDetailScreen />);
    
    // 等待错误信息显示
    const errorMessage = await findByText('获取资源详情失败，请稍后重试');
    expect(errorMessage).toBeTruthy();
  });

  test('点击下载按钮应触发下载功能', async () => {
    // 模拟下载函数
    const mockDownload = jest.fn();
    global.downloadResource = mockDownload;
    
    // 模拟API请求返回
    axios.get.mockResolvedValueOnce({ data: mockResourceDetail });
    
    const { getByTestId } = render(<ResourceDetailScreen />);
    
    // 等待数据加载完成
    await waitFor(() => {
      expect(getByTestId('download-button')).toBeTruthy();
    });
    
    // 点击下载按钮
    fireEvent.press(getByTestId('download-button'));
    
    // 验证下载函数被调用
    expect(mockDownload).toHaveBeenCalledWith(mockResourceDetail.content, mockResourceDetail.title);
  });

  test('点击收藏按钮应触发收藏功能', async () => {
    // 模拟API请求
    axios.get.mockResolvedValueOnce({ data: mockResourceDetail });
    axios.post.mockResolvedValueOnce({ data: { success: true } });
    
    const { getByTestId } = render(<ResourceDetailScreen />);
    
    // 等待数据加载完成
    await waitFor(() => {
      expect(getByTestId('favorite-button')).toBeTruthy();
    });
    
    // 点击收藏按钮
    fireEvent.press(getByTestId('favorite-button'));
    
    // 验证API请求被调用
    expect(axios.post).toHaveBeenCalledWith('/api/resources/1/favorite', { userId: '1' });
  });

  test('点击评分按钮应显示评分对话框', async () => {
    // 模拟API请求返回
    axios.get.mockResolvedValueOnce({ data: mockResourceDetail });
    
    const { getByTestId, findByTestId } = render(<ResourceDetailScreen />);
    
    // 等待数据加载完成
    await waitFor(() => {
      expect(getByTestId('rate-button')).toBeTruthy();
    });
    
    // 点击评分按钮
    fireEvent.press(getByTestId('rate-button'));
    
    // 验证评分对话框显示
    const ratingDialog = await findByTestId('rating-dialog');
    expect(ratingDialog).toBeTruthy();
  });
});