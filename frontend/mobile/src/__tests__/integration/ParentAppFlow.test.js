import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider } from '../../contexts/AuthContext';
import LoginScreen from '../../components/LoginScreen';
import ParentDashboardScreen from '../../components/ParentDashboardScreen';
import ChildProgressScreen from '../../components/ChildProgressScreen';
import HomeworkDetailScreen from '../../components/HomeworkDetailScreen';
import axios from 'axios';

// 模拟axios
jest.mock('axios');

// 创建测试导航器
const Stack = createStackNavigator();
const TestNavigator = () => (
  <Stack.Navigator initialRouteName="Login">
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="ParentDashboard" component={ParentDashboardScreen} />
    <Stack.Screen name="ChildProgress" component={ChildProgressScreen} />
    <Stack.Screen name="HomeworkDetail" component={HomeworkDetailScreen} />
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

describe('家长应用流程集成测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // 模拟AsyncStorage
    jest.mock('@react-native-async-storage/async-storage', () => ({
      getItem: jest.fn(() => Promise.resolve(null)),
      setItem: jest.fn(() => Promise.resolve()),
      removeItem: jest.fn(() => Promise.resolve())
    }));
  });

  test('完整用户流程：登录 -> 查看孩子学习概览 -> 查看作业详情', async () => {
    // 模拟登录API响应
    const mockUser = { 
      id: '1', 
      name: '张爸爸', 
      role: 'parent',
      children: [
        { id: '101', name: '张小明', grade: '三年级', class: '2班' }
      ]
    };
    
    axios.post.mockResolvedValueOnce({
      data: {
        token: 'fake-token',
        user: mockUser
      }
    });

    // 模拟家长仪表盘数据API响应
    const mockDashboardData = {
      children: [
        {
          id: '101',
          name: '张小明',
          grade: '三年级',
          class: '2班',
          overview: {
            completedCourses: 3,
            inProgressCourses: 2,
            completionRate: 75,
            averageScore: 88
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
        }
      ],
      notifications: [
        { id: '1', title: '期中考试通知', content: '下周一将进行期中考试', createdAt: '2023-06-12T09:00:00Z', read: false },
        { id: '2', title: '家长会通知', content: '本周五下午3点举行家长会', createdAt: '2023-06-10T14:30:00Z', read: true }
      ]
    };
    
    axios.get.mockResolvedValueOnce({ data: mockDashboardData });

    // 模拟孩子进度详情API响应
    const mockChildProgressData = {
      childInfo: {
        id: '101',
        name: '张小明',
        grade: '三年级',
        class: '2班',
        avatar: 'url-to-avatar'
      },
      subjects: [
        {
          name: '数学',
          completionRate: 78,
          averageScore: 85,
          chapters: [
            { name: '分数', completionRate: 90, score: 88 },
            { name: '小数', completionRate: 75, score: 82 },
            { name: '百分数', completionRate: 60, score: 78 }
          ]
        },
        {
          name: '语文',
          completionRate: 82,
          averageScore: 90,
          chapters: [
            { name: '古诗词', completionRate: 85, score: 92 },
            { name: '阅读理解', completionRate: 80, score: 88 }
          ]
        }
      ],
      recentActivities: [
        { date: '2023-06-15', subject: '数学', activity: '完成了分数加减法练习', duration: 45, score: 85 },
        { date: '2023-06-14', subject: '语文', activity: '学习了唐诗赏析', duration: 30, score: 90 }
      ]
    };
    
    axios.get.mockResolvedValueOnce({ data: mockChildProgressData });

    // 模拟作业详情API响应
    const mockHomeworkDetail = {
      id: '1',
      title: '数学作业 - 分数应用题',
      description: '完成课本第15页的习题1-5',
      subject: '数学',
      teacher: '李老师',
      assignedDate: '2023-06-13T10:00:00Z',
      dueDate: '2023-06-20T23:59:59Z',
      status: 'pending',
      questions: [
        {
          type: 'multiple-choice',
          content: '1/2 + 1/4 = ?',
          options: ['1/6', '3/4', '3/6', '2/6'],
          answer: null,
          points: 10
        },
        {
          type: 'fill-blank',
          content: '2/3 - 1/6 = ?',
          answer: null,
          points: 15
        }
      ],
      attachments: [],
      feedback: null
    };
    
    axios.get.mockResolvedValueOnce({ data: mockHomeworkDetail });

    const { getByText, getByPlaceholderText, findByText, getAllByTestId } = renderApp();

    // 验证初始状态是登录页面
    expect(getByText('登录')).toBeTruthy();

    // 填写登录表单
    fireEvent.changeText(getByPlaceholderText('用户名'), 'parent1');
    fireEvent.changeText(getByPlaceholderText('密码'), 'password123');

    // 提交登录表单
    fireEvent.press(getByText('登录'));

    // 等待登录完成并导航到家长仪表盘
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/auth/login', {
        username: 'parent1',
        password: 'password123'
      });
    });

    // 验证家长仪表盘页面加载
    const dashboardTitle = await findByText('孩子学习概览');
    expect(dashboardTitle).toBeTruthy();

    // 验证孩子信息显示
    await waitFor(() => {
      expect(getByText('张小明')).toBeTruthy();
      expect(getByText('三年级2班')).toBeTruthy();
      
      // 验证学习概览
      expect(getByText('75%')).toBeTruthy(); // 完成率
      expect(getByText('88')).toBeTruthy(); // 平均分
      
      // 验证即将到期作业
      expect(getByText('数学作业 - 分数应用题')).toBeTruthy();
      expect(getByText('语文作业 - 作文')).toBeTruthy();
    });

    // 点击查看孩子详细进度
    const viewProgressButton = getByText('查看详细进度');
    fireEvent.press(viewProgressButton);

    // 验证孩子进度页面加载
    const progressTitle = await findByText('学习进度详情');
    expect(progressTitle).toBeTruthy();

    // 验证学科进度显示
    await waitFor(() => {
      expect(getByText('数学')).toBeTruthy();
      expect(getByText('语文')).toBeTruthy();
      expect(getByText('78%')).toBeTruthy(); // 数学完成率
      expect(getByText('82%')).toBeTruthy(); // 语文完成率
    });

    // 返回到家长仪表盘
    fireEvent.press(getByText('返回'));

    // 点击查看作业详情
    await waitFor(() => {
      const homeworkItems = getAllByTestId('homework-item');
      fireEvent.press(homeworkItems[0]);
    });

    // 验证作业详情页面加载
    const homeworkTitle = await findByText('数学作业 - 分数应用题');
    expect(homeworkTitle).toBeTruthy();

    // 验证作业详情内容
    await waitFor(() => {
      expect(getByText('完成课本第15页的习题1-5')).toBeTruthy();
      expect(getByText('李老师')).toBeTruthy();
      expect(getByText('待完成')).toBeTruthy();
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