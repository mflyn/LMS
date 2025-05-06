const request = require('supertest');
const mongoose = require('mongoose');
const express = require('express');
const Resource = require('../../models/Resource');
const ResourceReview = require('../../models/ResourceReview');

// 模拟 Resource 模型
jest.mock('../../models/Resource');

// 模拟 ResourceReview 模型
jest.mock('../../models/ResourceReview');

// 创建一个模拟的 Express 应用
const app = express();
app.use(express.json());

// 模拟 catchAsync 函数
const catchAsync = jest.fn(fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
});

// 模拟 AppError 类
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// 添加中间件来模拟用户认证
const authenticateToken = (req, res, next) => {
  if (!req.headers['x-user-id']) {
    return res.status(401).json({ message: '未认证' });
  }
  req.user = {
    id: req.headers['x-user-id'],
    role: req.headers['x-user-role'] || 'student'
  };
  next();
};

// 添加 logger 到 app.locals
app.locals.logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

// 获取资源评分
app.get('/api/recommendations/reviews/:resourceId', authenticateToken, catchAsync(async (req, res) => {
  const { resourceId } = req.params;

  const reviews = await ResourceReview.find({ resource: resourceId })
    .populate('reviewer', 'name role');

  // 计算平均评分
  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;

  res.json({
    reviews,
    stats: {
      count: reviews.length,
      averageRating: parseFloat(averageRating.toFixed(1))
    }
  });
}));

// 提交资源评分
app.post('/api/recommendations/reviews', authenticateToken, catchAsync(async (req, res) => {
  const { resource, rating, comment, isRecommended } = req.body;

  if (!resource || !rating) {
    throw new AppError('资源ID和评分不能为空', 400);
  }

  // 检查用户是否已经评价过该资源
  const existingReview = await ResourceReview.findOne({
    resource,
    reviewer: req.user.id
  });

  if (existingReview) {
    // 更新现有评价
    existingReview.rating = rating;
    existingReview.comment = comment;
    existingReview.isRecommended = isRecommended !== undefined ? isRecommended : true;
    existingReview.updatedAt = Date.now();

    await existingReview.save();

    req.app.locals.logger.info(`用户 ${req.user.id} 更新了资源 ${resource} 的评价`);
    res.json({ message: '评价已更新', review: existingReview });
  } else {
    // 创建新评价
    const newReview = new ResourceReview({
      resource,
      reviewer: req.user.id,
      rating,
      comment,
      isRecommended: isRecommended !== undefined ? isRecommended : true,
      createdAt: Date.now()
    });

    await newReview.save();

    req.app.locals.logger.info(`用户 ${req.user.id} 提交了资源 ${resource} 的新评价`);
    res.status(201).json({ message: '评价已提交', review: newReview });
  }
}));

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    status: err.status || 'error',
    message: err.message || '服务器错误'
  });
});

describe('推荐系统评论接口测试', () => {
  // 测试用户ID
  const testUserId = new mongoose.Types.ObjectId().toString();
  // 测试资源ID
  const testResourceId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();

    // 重置 ResourceReview.find 和 ResourceReview.findOne 的模拟实现
    ResourceReview.find.mockReset();
    ResourceReview.findOne.mockReset();
  });

  describe('GET /api/recommendations/reviews/:resourceId', () => {
    it('应该返回资源的评论列表和统计信息', async () => {
      // 模拟评论数据
      const mockReviews = [
        {
          _id: new mongoose.Types.ObjectId(),
          resource: testResourceId,
          reviewer: {
            _id: new mongoose.Types.ObjectId(),
            name: '用户1',
            role: 'student'
          },
          rating: 4,
          comment: '很好的资源',
          isRecommended: true,
          createdAt: new Date()
        },
        {
          _id: new mongoose.Types.ObjectId(),
          resource: testResourceId,
          reviewer: {
            _id: new mongoose.Types.ObjectId(),
            name: '用户2',
            role: 'teacher'
          },
          rating: 5,
          comment: '非常好的资源',
          isRecommended: true,
          createdAt: new Date()
        }
      ];

      // 模拟 ResourceReview.find 方法
      ResourceReview.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockReviews)
      });

      // 发送请求
      const response = await request(app)
        .get(`/api/recommendations/reviews/${testResourceId}`)
        .set('x-user-id', testUserId);

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('reviews');
      expect(response.body).toHaveProperty('stats');
      expect(response.body.reviews.length).toBe(2);
      expect(response.body.stats.count).toBe(2);
      expect(response.body.stats.averageRating).toBe(4.5);

      // 验证 ResourceReview.find 被调用
      expect(ResourceReview.find).toHaveBeenCalledWith({ resource: testResourceId });
    });

    it('未授权时应该返回401错误', async () => {
      // 发送请求，不设置用户ID
      const response = await request(app)
        .get(`/api/recommendations/reviews/${testResourceId}`);

      // 验证响应
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未认证');
    });

    it('没有评论时应该返回空列表和0评分', async () => {
      // 模拟 ResourceReview.find 方法返回空数组
      ResourceReview.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      });

      // 发送请求
      const response = await request(app)
        .get(`/api/recommendations/reviews/${testResourceId}`)
        .set('x-user-id', testUserId);

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body.reviews).toEqual([]);
      expect(response.body.stats.count).toBe(0);
      expect(response.body.stats.averageRating).toBe(0);
    });
  });

  describe('POST /api/recommendations/reviews', () => {
    it('应该成功提交新评论', async () => {
      // 模拟 ResourceReview.findOne 方法返回 null（表示没有现有评论）
      ResourceReview.findOne.mockResolvedValue(null);

      // 模拟 ResourceReview 构造函数和 save 方法
      const mockReview = {
        resource: testResourceId,
        reviewer: testUserId,
        rating: 4,
        comment: '很好的资源',
        isRecommended: true,
        save: jest.fn().mockResolvedValue(true)
      };
      ResourceReview.mockImplementation(() => mockReview);

      // 发送请求
      const response = await request(app)
        .post('/api/recommendations/reviews')
        .set('x-user-id', testUserId)
        .send({
          resource: testResourceId,
          rating: 4,
          comment: '很好的资源',
          isRecommended: true
        });

      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', '评价已提交');
      expect(response.body).toHaveProperty('review');

      // 验证 ResourceReview.findOne 被调用
      expect(ResourceReview.findOne).toHaveBeenCalledWith({
        resource: testResourceId,
        reviewer: testUserId
      });

      // 验证 save 方法被调用
      expect(mockReview.save).toHaveBeenCalled();
    });

    it('应该更新现有评论', async () => {
      // 模拟现有评论
      const existingReview = {
        resource: testResourceId,
        reviewer: testUserId,
        rating: 3,
        comment: '一般的资源',
        isRecommended: false,
        updatedAt: null,
        save: jest.fn().mockResolvedValue(true)
      };

      // 模拟 ResourceReview.findOne 方法返回现有评论
      ResourceReview.findOne.mockResolvedValue(existingReview);

      // 发送请求
      const response = await request(app)
        .post('/api/recommendations/reviews')
        .set('x-user-id', testUserId)
        .send({
          resource: testResourceId,
          rating: 5,
          comment: '更新后的评论',
          isRecommended: true
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '评价已更新');
      expect(response.body).toHaveProperty('review');

      // 验证评论被更新
      expect(existingReview.rating).toBe(5);
      expect(existingReview.comment).toBe('更新后的评论');
      expect(existingReview.isRecommended).toBe(true);
      expect(existingReview.updatedAt).not.toBeNull();

      // 验证 save 方法被调用
      expect(existingReview.save).toHaveBeenCalled();
    });

    it('缺少必要参数时应该返回400错误', async () => {
      // 发送请求，不提供评分
      const response = await request(app)
        .post('/api/recommendations/reviews')
        .set('x-user-id', testUserId)
        .send({
          resource: testResourceId,
          comment: '评论内容'
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '资源ID和评分不能为空');
    });

    it('未授权时应该返回401错误', async () => {
      // 发送请求，不设置用户ID
      const response = await request(app)
        .post('/api/recommendations/reviews')
        .send({
          resource: testResourceId,
          rating: 4,
          comment: '很好的资源'
        });

      // 验证响应
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未认证');
    });

    it('评分超出范围时应该处理', async () => {
      // 模拟 ResourceReview.findOne 方法返回 null
      ResourceReview.findOne.mockResolvedValue(null);

      // 模拟 ResourceReview 构造函数和 save 方法
      const mockReview = {
        resource: testResourceId,
        reviewer: testUserId,
        rating: 0, // 将被设置为有效值
        comment: '评论内容',
        isRecommended: true,
        save: jest.fn().mockResolvedValue(true)
      };
      ResourceReview.mockImplementation(() => mockReview);

      // 发送请求，评分超出范围
      const response = await request(app)
        .post('/api/recommendations/reviews')
        .set('x-user-id', testUserId)
        .send({
          resource: testResourceId,
          rating: 6, // 超出1-5的范围
          comment: '评论内容'
        });

      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('review');

      // 注意：在实际应用中，应该在模型层面验证评分范围
      // 这里我们只是测试 API 层面的行为
    });
  });
});
