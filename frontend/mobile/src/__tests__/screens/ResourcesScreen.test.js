import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ResourcesScreen from '../../components/ResourcesScreen';
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

describe('ResourcesScreen', () => {
  const mockResourcesData = {
    resources: [
      { id: '1', title: '数学分数教学视频', type: 'video', subject: '数学', thumbnail: 'url-to-thumbnail' },
      { id: '2', title: '语文古诗词赏析', type: 'document', subject: '语文', thumbnail: 'url-to-thumbnail' },
      { id: '3', title: '英语单词记忆方法', type: 'audio', subject: '英语', thumbnail: 'url-to-thumbnail' }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('显示加载状态', async () => {
    // 模拟API请求延迟
    axios.get.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ data: {} }), 100)));
    
    const { getByTestId } = render(<ResourcesScreen />);
    
    // 验证加载状态显示
    expect(getByTestId('loading-indicator')).toBeTruthy();
  });

  test('成功加载并显示资源列表', async () => {
    // 模拟API请求返回
    axios.get.mockResolvedValueOnce({ data: mockResourcesData });
    
    const { getByText, getAllByTestId } = render(<ResourcesScreen />);
    
    // 等待数据加载完成
    await waitFor(() => {
      // 验证资源列表
      expect(getByText('数学分数教学视频')).toBeTruthy();
      expect(getByText('语文古诗词赏析')).toBeTruthy();
      expect(getByText('英语单词记忆方法')).toBeTruthy();
      
      // 验证资源类型
      expect(getByText('视频')).toBeTruthy();
      expect(getByText('文档')).toBeTruthy();
      expect(getByText('音频')).toBeTruthy();
    });
    
    // 验证资源项目数量
    const resourceItems = getAllByTestId('resource-item');
    expect(resourceItems.length).toBe(3);
  });

  test('点击资源项目应导航到资源详情页面', async () => {
    // 模拟API请求返回
    axios.get.mockResolvedValueOnce({ data: mockResourcesData });
    
    const { getAllByTestId } = render(<ResourcesScreen />);
    
    // 等待数据加载完成
    await waitFor(() => {
      const resourceItems = getAllByTestId('resource-item');
      expect(resourceItems.length).toBe(3);
    });
    
    // 点击第一个资源项目
    const resourceItems = getAllByTestId('resource-item');
    fireEvent.press(resourceItems[0]);
    
    // 验证导航到资源详情页面
    expect(mockNavigate).toHaveBeenCalledWith('ResourceDetail', { resourceId: '1' });
  });

  test('API请求失败时显示错误信息', async () => {
    // 模拟API请求失败
    axios.get.mockRejectedValueOnce(new Error('Failed to fetch resources'));
    
    const { findByText } = render(<ResourcesScreen />);
    
    // 等待错误信息显示
    const errorMessage = await findByText('获取资源失败，请稍后重试');
    expect(errorMessage).toBeTruthy();
  });

  test('筛选资源功能', async () => {
    // 模拟API请求返回
    axios.get.mockResolvedValueOnce({ data: mockResourcesData });
    
    const { getByText, getAllByTestId, getByPlaceholderText } = render(<ResourcesScreen />);
    
    // 等待数据加载完成
    await waitFor(() => {
      expect(getAllByTestId('resource-item').length).toBe(3);
    });
    
    // 输入搜索关键词
    fireEvent.changeText(getByPlaceholderText('搜索资源...'), '数学');
    
    // 验证筛选结果
    await waitFor(() => {
      const filteredItems = getAllByTestId('resource-item');
      expect(filteredItems.length).toBe(1);
      expect(getByText('数学分数教学视频')).toBeTruthy();
    });
  });

  test('按学科筛选资源', async () => {
    // 模拟API请求返回
    axios.get.mockResolvedValueOnce({ data: mockResourcesData });
    
    const { getByText, getAllByTestId } = render(<ResourcesScreen />);
    
    // 等待数据加载完成
    await waitFor(() => {
      expect(getAllByTestId('resource-item').length).toBe(3);
    });
    
    // 点击学科筛选按钮
    fireEvent.press(getByText('语文'));
    
    // 验证筛选结果
    await waitFor(() => {
      const filteredItems = getAllByTestId('resource-item');
      expect(filteredItems.length).toBe(1);
      expect(getByText('语文古诗词赏析')).toBeTruthy();
    });
  });
});