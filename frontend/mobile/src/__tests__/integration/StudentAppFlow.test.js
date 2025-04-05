import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider } from '../../contexts/AuthContext';
import LoginScreen from '../../components/LoginScreen';
import DashboardScreen from '../../components/DashboardScreen';
import ResourcesScreen from '../../components/ResourcesScreen';
import ResourceDetailScreen from '../../components/ResourceDetailScreen';
import axios from 'axios';

// 模拟axios
jest.mock('axios');

// 创建测试导航器
const Stack = createStackNavigator();
const TestNavigator = () => (
  <Stack.Navigator initialRouteName="Login">
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Dashboard" component={DashboardScreen} />
    <Stack.Screen name="Resources" component={ResourcesScreen} />
    <Stack.Screen name="ResourceDetail" component={ResourceDetailScreen} />
  </Stack.Navigator>
);

const renderApp = () => {
  return render(
    <NavigationContainer>
      <AuthProvider>
        <TestNavigator />
      </AuthProvider>
    </NavigationContainer>
  );
};

describe('学生应用流程集成测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // 模拟AsyncStorage
    jest.mock('@react-native-async-storage/async-storage', () => ({
      getItem: jest.fn(() => Promise.resolve(null)),
      setItem: jest.fn(() => Promise.resolve()),
      removeItem: jest.fn(() => Promise.resolve())
    }));
  });

  test('完整用户流程：登录 -> 查看仪表盘 -> 查看学习资源', async () => {
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

    // 模拟资源列表API响应
    const mockResourcesData = {
      resources: [
        { id: '1', title: '数学分数教学视频', type: 'video', subject: '数学', thumbnail: 'url-to-thumbnail' },
        { id: '2', title: '语文古诗词赏析', type: 'document', subject: '语文', thumbnail: 'url-to-thumbnail' }
      ]
    };
    axios.get.mockResolvedValueOnce({ data: mockResourcesData });

    // 模拟资源详情API响应
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
      tags: ['分数', '小学数学', '基础知识']
    };
    axios.get.mockResolvedValueOnce({ data: mockResourceDetail });

    const { getByText, getByPlaceholderText, findByText, getAllByTestId } = renderApp();

    // 验证初始状态是登录页面
    expect(getByText('登录')).toBeTruthy();

    // 填写登录表单
    fireEvent.changeText(getByPlaceholderText('用户名'), 'student1');
    fireEvent.changeText(getByPlaceholderText('密码'), 'password123');

    // 提交登录表单
    fireEvent.press(getByText('登录'));

    // 等待登录完成并导航到仪表盘
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/auth/login', {
        username: 'student1',
        password: 'password123'
      });
    });

    // 验证仪表盘页面加载
    const dashboardTitle = await findByText('学习概览');
    expect(dashboardTitle).toBeTruthy();

    // 验证仪表盘数据显示
    await waitFor(() => {
      expect(getByText('3')).toBeTruthy(); // 已完成课程
      expect(getByText('2')).toBeTruthy(); // 进行中课程
      expect(getByText('75%')).toBeTruthy(); // 完成率
      
      // 验证最近进度
      expect(getByText('分数加减法')).toBeTruthy();
      expect(getByText('唐诗赏析')).toBeTruthy();
    });

    // 导航到学习资源页面
    const resourcesTab = getByText('学习资源');
    fireEvent.press(resourcesTab);

    // 验证资源页面加载
    const resourcesTitle = await findByText('学习资源');
    expect(resourcesTitle).toBeTruthy();

    // 验证资源列表显示
    await waitFor(() => {
      expect(getByText('数学分数教学视频')).toBeTruthy();
      expect(getByText('语文古诗词赏析')).toBeTruthy();
    });

    // 点击第一个资源项目
    const resourceItems = getAllByTestId('resource-item');
    fireEvent.press(resourceItems[0]);

    // 验证资源详情页面加载
    const resourceDetailTitle = await findByText('数学分数教学视频');
    expect(resourceDetailTitle).toBeTruthy();

    // 验证资源详情内容
    await waitFor(() => {
      expect(getByText('本视频详细讲解小学生分数的基本概念和运算方法')).toBeTruthy();
      expect(getByText('王老师')).toBeTruthy();
      expect(getByText('25:30')).toBeTruthy();
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

    const { getByText, getByPlaceholderText, findByText } = renderApp();

    // 填写登录表单
    fireEvent.changeText(getByPlaceholderText('用户名'), 'wronguser');
    fireEvent.changeText(getByPlaceholderText('密码'), 'wrongpass');

    // 提交登录表单
    fireEvent.press(getByText('登录'));

    // 等待错误消息显示
    const errorMessage = await findByText('登录失败，请检查用户名和密码');
    expect(errorMessage).toBeTruthy();

    // 验证仍然在登录页面
    expect(getByText('登录')).toBeTruthy();
  });
});