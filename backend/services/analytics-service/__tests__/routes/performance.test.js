const request = require('supertest');
const express = require('express');
const performanceRoutes = require('../../routes/performance');
const PerformanceData = require('../../models/PerformanceData');

// 模拟依赖
jest.mock('../../models/PerformanceData');

describe('Performance Routes', () => {
  let app;

  beforeEach(() => {
    // 创建Express应用
    app = express();
    app.use(express.json());
    app.use('/api/performance', performanceRoutes);

    // 重置所有模拟
    jest.clearAllMocks();
  });

  describe('POST /api/performance/record', () => {
    it('应该成功记录性能数据', async () => {
      // 准备测试数据
      const performanceData = {
        requestId: 'req123',
        serviceName: 'user-service',
        method: 'GET',
        url: '/api/users',
        route: '/users',
        statusCode: 200,
        duration: 150,
        slow: false,
        userAgent: 'Mozilla/5.0',
        userId: 'user123',
        userRole: 'student',
        memoryUsage: { rss: 50000000 },
        performanceLevel: 'good'
      };

      // 模拟PerformanceData.prototype.save
      PerformanceData.prototype.save = jest.fn().mockResolvedValue({
        _id: 'perf123',
        ...performanceData
      });

      // 发送请求
      const response = await request(app)
        .post('/api/performance/record')
        .send(performanceData)
        .expect(201);

      // 验证响应
      expect(response.body).toEqual({
        message: '性能数据记录成功',
        id: 'perf123'
      });

      // 验证PerformanceData构造函数被正确调用
      expect(PerformanceData).toHaveBeenCalledWith(performanceData);
      
      // 验证save方法被调用
      expect(PerformanceData.prototype.save).toHaveBeenCalled();
    });

    it('应该处理记录性能数据时的错误', async () => {
      // 准备测试数据
      const performanceData = {
        requestId: 'req123',
        serviceName: 'user-service'
        // 缺少必要字段
      };

      // 模拟PerformanceData.prototype.save抛出错误
      const error = new Error('数据验证失败');
      PerformanceData.prototype.save = jest.fn().mockRejectedValue(error);

      // 发送请求
      const response = await request(app)
        .post('/api/performance/record')
        .send(performanceData)
        .expect(500);

      // 验证响应
      expect(response.body).toEqual({
        message: '记录性能数据失败',
        error: '数据验证失败'
      });
    });
  });

  describe('GET /api/performance/service/:serviceName', () => {
    it('应该返回服务性能概览数据', async () => {
      // 准备请求头
      const headers = {
        'x-user-id': 'admin123',
        'x-user-role': 'admin'
      };

      // 模拟PerformanceData.getServicePerformance
      const mockServicePerformance = [{
        count: 100,
        avgDuration: 120,
        maxDuration: 500,
        minDuration: 50,
        slowRequests: 5
      }];
      PerformanceData.getServicePerformance = jest.fn().mockResolvedValue(mockServicePerformance);

      // 模拟PerformanceData.getEndpointPerformance
      const mockEndpointPerformance = [{
        route: '/users',
        count: 50,
        avgDuration: 100
      }];
      PerformanceData.getEndpointPerformance = jest.fn().mockResolvedValue(mockEndpointPerformance);

      // 模拟PerformanceData.getPerformanceTrend
      const mockPerformanceTrend = [{
        date: '2023-01-01',
        avgDuration: 110
      }];
      PerformanceData.getPerformanceTrend = jest.fn().mockResolvedValue(mockPerformanceTrend);

      // 发送请求
      const response = await request(app)
        .get('/api/performance/service/user-service')
        .query({ startDate: '2023-01-01', endDate: '2023-01-31' })
        .set(headers)
        .expect(200);

      // 验证响应
      expect(response.body).toEqual({
        serviceName: 'user-service',
        period: { start: expect.any(String), end: expect.any(String) },
        overview: mockServicePerformance[0],
        endpoints: mockEndpointPerformance,
        trend: mockPerformanceTrend
      });

      // 验证方法调用
      expect(PerformanceData.getServicePerformance).toHaveBeenCalledWith(
        'user-service',
        expect.any(Date),
        expect.any(Date)
      );
      expect(PerformanceData.getEndpointPerformance).toHaveBeenCalledWith(
        'user-service',
        expect.any(Date),
        expect.any(Date)
      );
      expect(PerformanceData.getPerformanceTrend).toHaveBeenCalledWith(
        'user-service',
        'day',
        30
      );
    });

    it('应该处理未认证的请求', async () => {
      // 发送请求（没有认证头）
      const response = await request(app)
        .get('/api/performance/service/user-service')
        .expect(401);

      // 验证响应
      expect(response.body).toEqual({
        message: '未认证'
      });
    });

    it('应该处理权限不足的请求', async () => {
      // 准备请求头（学生角色）
      const headers = {
        'x-user-id': 'student123',
        'x-user-role': 'student'
      };

      // 发送请求
      const response = await request(app)
        .get('/api/performance/service/user-service')
        .set(headers)
        .expect(403);

      // 验证响应
      expect(response.body).toEqual({
        message: '权限不足'
      });
    });
  });
});
