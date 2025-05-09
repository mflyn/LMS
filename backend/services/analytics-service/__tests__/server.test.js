const request = require('supertest');
const app = require('../server');

// 模拟 mongoose 连接
jest.mock('mongoose', () => {
  const mMongoDB = {
    connect: jest.fn().mockResolvedValue(true),
    connection: {
      on: jest.fn()
    },
    Schema: function() {
      return {
        pre: jest.fn().mockReturnThis(),
        index: jest.fn().mockReturnThis()
      };
    }
  };

  // 添加 Schema.Types
  mMongoDB.Schema.Types = {
    ObjectId: 'ObjectId',
    String: String,
    Number: Number,
    Date: Date,
    Boolean: Boolean,
    Array: Array,
    Mixed: 'Mixed'
  };

  // 添加 model 方法
  mMongoDB.model = jest.fn().mockReturnValue({});

  return mMongoDB;
});

describe('Analytics Service 服务器测试', () => {
  // 测试健康检查端点
  describe('GET /health', () => {
    it('应该返回服务健康状态', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('service', 'analytics-service');
    });
  });

  // 测试错误处理中间件
  describe('错误处理', () => {
    it('应该处理不存在的路由', async () => {
      const response = await request(app).get('/non-existent-route');

      expect(response.status).toBe(404);
    });
  });

  // 测试路由是否正确挂载
  describe('路由挂载', () => {
    it('应该正确挂载进度分析路由', async () => {
      // 由于需要真实数据才能完全测试，这里只验证路由是否存在
      const response = await request(app).get('/api/analytics/progress/student/123');

      // 即使没有数据，也不应该返回404（路由不存在）
      expect(response.status).not.toBe(404);
    });

    it('应该正确挂载报告路由', async () => {
      const response = await request(app).get('/api/analytics/reports/student/123');

      // 即使没有数据，也不应该返回404（路由不存在）
      expect(response.status).not.toBe(404);
    });

    it('应该正确挂载趋势路由', async () => {
      const response = await request(app).get('/api/analytics/trends/student/123');

      // 即使没有数据，也不应该返回404（路由不存在）
      expect(response.status).not.toBe(404);
    });

    it('应该正确挂载长期趋势路由', async () => {
      const response = await request(app).get('/api/analytics/long-term-trends/student/123');

      // 即使没有数据，也不应该返回404（路由不存在）
      expect(response.status).not.toBe(404);
    });

    it('应该正确挂载行为分析路由', async () => {
      const response = await request(app).get('/api/analytics/behavior/student/123');

      // 即使没有数据，也不应该返回404（路由不存在）
      expect(response.status).not.toBe(404);
    });
  });
});
