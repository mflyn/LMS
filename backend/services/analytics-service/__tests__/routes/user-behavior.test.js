const request = require('supertest');
const express = require('express');
const userBehaviorRoutes = require('../../routes/user-behavior');
const UserBehavior = require('../../models/UserBehavior');

// 模拟依赖
jest.mock('../../models/UserBehavior');

describe('User Behavior Routes', () => {
  let app;

  beforeEach(() => {
    // 创建Express应用
    app = express();
    app.use(express.json());
    app.use('/api/user-behavior', userBehaviorRoutes);

    // 重置所有模拟
    jest.clearAllMocks();
  });

  describe('POST /api/user-behavior/track', () => {
    it('应该成功记录用户行为', async () => {
      // 准备测试数据
      const behaviorData = {
        userId: 'user123',
        userRole: 'student',
        actionType: 'view_resource',
        sessionId: 'session123',
        deviceInfo: {
          deviceType: 'desktop',
          browser: 'Chrome',
          os: 'Windows',
          screenResolution: '1920x1080'
        },
        location: {
          page: '/resources',
          component: 'ResourceList',
          section: 'main'
        },
        metadata: {
          resourceId: 'resource123'
        },
        duration: 120000,
        success: true
      };

      // 模拟UserBehavior.prototype.save
      UserBehavior.prototype.save = jest.fn().mockResolvedValue({
        _id: 'behavior123',
        ...behaviorData
      });

      // 发送请求
      const response = await request(app)
        .post('/api/user-behavior/track')
        .send(behaviorData)
        .expect(201);

      // 验证响应
      expect(response.body).toEqual({
        message: '用户行为记录成功',
        id: 'behavior123'
      });

      // 验证UserBehavior构造函数被正确调用
      expect(UserBehavior).toHaveBeenCalledWith(behaviorData);
      
      // 验证save方法被调用
      expect(UserBehavior.prototype.save).toHaveBeenCalled();
    });

    it('应该处理记录用户行为时的错误', async () => {
      // 准备测试数据
      const behaviorData = {
        userId: 'user123',
        userRole: 'invalid_role', // 无效的角色
        actionType: 'view_resource'
      };

      // 模拟UserBehavior.prototype.save抛出错误
      const error = new Error('数据验证失败');
      UserBehavior.prototype.save = jest.fn().mockRejectedValue(error);

      // 发送请求
      const response = await request(app)
        .post('/api/user-behavior/track')
        .send(behaviorData)
        .expect(500);

      // 验证响应
      expect(response.body).toEqual({
        message: '记录用户行为失败',
        error: '数据验证失败'
      });
    });
  });

  describe('GET /api/user-behavior/activity/:userId', () => {
    it('应该返回用户活动摘要', async () => {
      // 准备请求头
      const headers = {
        'x-user-id': 'user123',
        'x-user-role': 'student'
      };

      // 模拟UserBehavior.getUserActivitySummary
      const mockActivitySummary = [
        { _id: 'view_resource', count: 50, avgDuration: 120000 },
        { _id: 'submit_homework', count: 10, avgDuration: 300000 }
      ];
      UserBehavior.getUserActivitySummary = jest.fn().mockResolvedValue(mockActivitySummary);

      // 模拟UserBehavior.find
      const mockRecentActivities = [
        { _id: 'activity1', actionType: 'view_resource', timestamp: new Date() },
        { _id: 'activity2', actionType: 'submit_homework', timestamp: new Date() }
      ];
      UserBehavior.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockRecentActivities)
      });

      // 发送请求
      const response = await request(app)
        .get('/api/user-behavior/activity/user123')
        .query({ startDate: '2023-01-01', endDate: '2023-01-31' })
        .set(headers)
        .expect(200);

      // 验证响应
      expect(response.body).toEqual({
        activitySummary: mockActivitySummary,
        recentActivities: mockRecentActivities
      });

      // 验证方法调用
      expect(UserBehavior.getUserActivitySummary).toHaveBeenCalledWith(
        'user123',
        expect.any(Date),
        expect.any(Date)
      );
      expect(UserBehavior.find).toHaveBeenCalledWith({ userId: 'user123' });
    });

    it('应该处理未认证的请求', async () => {
      // 发送请求（没有认证头）
      const response = await request(app)
        .get('/api/user-behavior/activity/user123')
        .expect(401);

      // 验证响应
      expect(response.body).toEqual({
        message: '未认证'
      });
    });

    it('应该处理权限不足的请求', async () => {
      // 准备请求头（学生尝试访问其他学生的数据）
      const headers = {
        'x-user-id': 'student1',
        'x-user-role': 'student'
      };

      // 发送请求
      const response = await request(app)
        .get('/api/user-behavior/activity/student2')
        .set(headers)
        .expect(403);

      // 验证响应
      expect(response.body).toEqual({
        message: '权限不足'
      });
    });
  });

  describe('GET /api/user-behavior/learning-habits/:userId', () => {
    it('应该返回学习习惯分析', async () => {
      // 准备请求头
      const headers = {
        'x-user-id': 'user123',
        'x-user-role': 'student'
      };

      // 模拟UserBehavior.getLearningHabitsAnalysis
      const mockHabitsData = [
        { 
          _id: { hour: 10, dayOfWeek: 1, actionType: 'view_resource' },
          count: 5,
          totalDuration: 60000
        },
        { 
          _id: { hour: 14, dayOfWeek: 2, actionType: 'submit_homework' },
          count: 3,
          totalDuration: 45000
        }
      ];
      UserBehavior.getLearningHabitsAnalysis = jest.fn().mockResolvedValue(mockHabitsData);

      // 发送请求
      const response = await request(app)
        .get('/api/user-behavior/learning-habits/user123')
        .query({ days: '30' })
        .set(headers)
        .expect(200);

      // 验证响应包含预期的字段
      expect(response.body).toEqual({
        timeHeatmap: expect.any(Array),
        actionTypeData: expect.any(Object),
        suggestions: expect.any(Array),
        rawData: mockHabitsData
      });

      // 验证方法调用
      expect(UserBehavior.getLearningHabitsAnalysis).toHaveBeenCalledWith('user123', 30);
    });
  });
});
