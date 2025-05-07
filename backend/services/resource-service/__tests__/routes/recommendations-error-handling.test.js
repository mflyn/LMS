const request = require('supertest');
const mongoose = require('mongoose');
const express = require('express');
const recommendationsRouter = require('../../routes/recommendations');
const Resource = require('../../models/Resource');
const ResourceReview = require('../../models/ResourceReview');

// 创建一个模拟的 Express 应用
const app = express();
app.use(express.json());

// 添加中间件来模拟用户认证
app.use((req, res, next) => {
  if (req.headers['x-user-id']) {
    req.user = {
      id: req.headers['x-user-id'],
      role: req.headers['x-user-role'] || 'student'
    };
    next();
  } else {
    res.status(401).json({
      status: 'error',
      message: '未认证'
    });
  }
});

// 添加 logger 到 app.locals
app.locals.logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

app.use('/api/recommendations', recommendationsRouter);

// 错误处理中间件
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    status: err.status || 'error',
    message: err.message || '服务器错误'
  });
});

// 模拟 Resource 模型
jest.mock('../../models/Resource');

// 模拟 ResourceReview 模型
jest.mock('../../models/ResourceReview');

describe('Recommendations 路由错误处理测试', () => {
  const testUserId = new mongoose.Types.ObjectId().toString();
  const testResourceId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/recommendations/reviews/:resourceId', () => {
    it('应该处理数据库查询错误', async () => {
      // 模拟 Resource.findById 方法
      Resource.findById.mockResolvedValue({
        _id: testResourceId,
        title: '测试资源'
      });

      // 模拟 ResourceReview.find 方法抛出错误
      ResourceReview.find.mockImplementation(() => {
        throw new Error('数据库连接错误');
      });

      // 发送请求
      const response = await request(app)
        .get(`/api/recommendations/reviews/${testResourceId}`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('status', 'error');
    });
  });

  describe('POST /api/recommendations/reviews', () => {
    it('当前实现不检查资源是否存在', async () => {
      // 模拟 Resource.findById 方法返回 null
      Resource.findById.mockResolvedValue(null);

      // 模拟 ResourceReview.findOne 方法
      ResourceReview.findOne.mockResolvedValue(null);

      // 模拟 ResourceReview 实例
      const mockReview = {
        _id: new mongoose.Types.ObjectId(),
        resource: testResourceId,
        reviewer: testUserId,
        rating: 4,
        comment: '这是一个很好的资源',
        isRecommended: true,
        save: jest.fn().mockResolvedValue({
          _id: new mongoose.Types.ObjectId(),
          resource: testResourceId,
          reviewer: testUserId,
          rating: 4,
          comment: '这是一个很好的资源',
          isRecommended: true
        })
      };

      // 模拟 ResourceReview 构造函数
      ResourceReview.mockImplementation(() => mockReview);

      // 发送请求
      const response = await request(app)
        .post('/api/recommendations/reviews')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student')
        .send({
          resource: testResourceId,
          rating: 4,
          comment: '这是一个很好的资源'
        });

      // 验证响应 - 当前实现不检查资源是否存在
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', '评价已提交');
    });

    it('应该处理保存评论时的数据库错误', async () => {
      // 模拟 Resource.findById 方法
      Resource.findById.mockResolvedValue({
        _id: testResourceId,
        title: '测试资源'
      });

      // 模拟 ResourceReview.findOne 方法
      ResourceReview.findOne.mockResolvedValue(null);

      // 模拟 ResourceReview 实例
      const mockReview = {
        _id: new mongoose.Types.ObjectId(),
        resource: testResourceId,
        reviewer: testUserId,
        rating: 4,
        comment: '这是一个很好的资源',
        isRecommended: true,
        save: jest.fn().mockRejectedValue(new Error('保存失败'))
      };

      // 模拟 ResourceReview 构造函数
      ResourceReview.mockImplementation(() => mockReview);

      // 发送请求
      const response = await request(app)
        .post('/api/recommendations/reviews')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student')
        .send({
          resource: testResourceId,
          rating: 4,
          comment: '这是一个很好的资源'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('status', 'error');
    });
  });

  describe('GET /api/recommendations/recommended', () => {
    it('应该处理聚合查询错误', async () => {
      // 模拟 ResourceReview.aggregate 方法抛出错误
      ResourceReview.aggregate.mockRejectedValue(new Error('聚合查询失败'));

      // 发送请求
      const response = await request(app)
        .get('/api/recommendations/recommended')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('status', 'error');
    });

    it('应该处理资源查询错误', async () => {
      // 模拟 ResourceReview.aggregate 方法
      ResourceReview.aggregate.mockResolvedValue([
        {
          _id: testResourceId,
          averageRating: 4.5,
          reviewCount: 10
        }
      ]);

      // 模拟 Resource.find 方法抛出错误
      Resource.find.mockImplementation(() => {
        throw new Error('资源查询失败');
      });

      // 发送请求
      const response = await request(app)
        .get('/api/recommendations/recommended')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('status', 'error');
    });
  });

  describe('GET /api/recommendations/personalized', () => {
    it('应该处理用户评价查询错误', async () => {
      // 模拟 ResourceReview.find 方法抛出错误
      ResourceReview.find.mockRejectedValue(new Error('评价查询失败'));

      // 发送请求
      const response = await request(app)
        .get('/api/recommendations/personalized')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('status', 'error');
    });

    it('应该处理资源详情查询错误', async () => {
      // 模拟用户评价记录
      const userReviews = [
        {
          resource: new mongoose.Types.ObjectId(),
          rating: 4
        }
      ];

      // 模拟 ResourceReview.find 方法
      ResourceReview.find.mockResolvedValue(userReviews);

      // 模拟 Resource.find 方法抛出错误
      Resource.find.mockRejectedValue(new Error('资源详情查询失败'));

      // 发送请求
      const response = await request(app)
        .get('/api/recommendations/personalized')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('status', 'error');
    });
  });
});
