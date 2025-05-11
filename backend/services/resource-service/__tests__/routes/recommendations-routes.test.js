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
      id: req.headers['x-user-id'], // 注意这里使用 id 而不是 _id
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

describe('Recommendations 路由测试', () => {
  const testUserId = new mongoose.Types.ObjectId().toString();
  const testResourceId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/recommendations/reviews/:resourceId', () => {
    it.skip('应该返回资源的评论列表和统计信息', async () => {
      // 模拟 Resource.findById 方法
      Resource.findById.mockResolvedValue({
        _id: testResourceId,
        title: '测试资源'
      });

      // 模拟 ResourceReview.find 方法
      const mockReviews = [
        {
          _id: new mongoose.Types.ObjectId(),
          resource: testResourceId,
          reviewer: {
            _id: new mongoose.Types.ObjectId(),
            name: '测试用户1'
          },
          rating: 4,
          comment: '测试评论1',
          isRecommended: true,
          createdAt: new Date()
        },
        {
          _id: new mongoose.Types.ObjectId(),
          resource: testResourceId,
          reviewer: {
            _id: new mongoose.Types.ObjectId(),
            name: '测试用户2'
          },
          rating: 5,
          comment: '测试评论2',
          isRecommended: true,
          createdAt: new Date()
        }
      ];

      ResourceReview.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockReviews)
        })
      });

      // 发送请求
      const response = await request(app)
        .get(`/api/recommendations/reviews/${testResourceId}`)
        .set('x-user-id', testUserId);

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('reviews');
      expect(response.body).toHaveProperty('stats');
      expect(response.body.reviews).toEqual(mockReviews);
      expect(response.body.stats).toHaveProperty('count', 2);
      expect(response.body.stats).toHaveProperty('averageRating', 4.5);

      // 验证 Resource.findById 和 ResourceReview.find 被调用
      expect(Resource.findById).toHaveBeenCalledWith(testResourceId);
      expect(ResourceReview.find).toHaveBeenCalledWith({ resource: testResourceId });
    });

    it.skip('资源不存在时应该返回404错误', async () => {
      // 模拟 Resource.findById 方法返回 null
      Resource.findById.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .get(`/api/recommendations/reviews/${testResourceId}`)
        .set('x-user-id', testUserId);

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '资源不存在');
    });

    it('未授权时应该返回401错误', async () => {
      // 发送请求，不设置用户ID
      const response = await request(app)
        .get(`/api/recommendations/reviews/${testResourceId}`);

      // 验证响应
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未认证');
    });

    it.skip('数据库错误时应该返回500错误', async () => {
      // 模拟 Resource.findById 方法
      Resource.findById.mockResolvedValue({
        _id: testResourceId,
        title: '测试资源'
      });

      // 模拟 ResourceReview.find 方法抛出错误
      ResourceReview.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockRejectedValue(new Error('数据库错误'))
        })
      });

      // 模拟控制台错误输出
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // 发送请求
      const response = await request(app)
        .get(`/api/recommendations/reviews/${testResourceId}`)
        .set('x-user-id', testUserId);

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '服务器错误');

      // 恢复控制台
      consoleSpy.mockRestore();
    });
  });

  describe('POST /api/recommendations/reviews', () => {
    it.skip('应该成功提交新评论', async () => {
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
        .send({
          resource: testResourceId,
          rating: 4,
          comment: '这是一个很好的资源',
          isRecommended: true
        });

      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', '评价已提交');
      expect(response.body).toHaveProperty('review');
      expect(response.body.review).toHaveProperty('rating', 4);
      expect(response.body.review).toHaveProperty('comment', '这是一个很好的资源');
      expect(response.body.review).toHaveProperty('isRecommended', true);

      // 验证 ResourceReview 构造函数和 save 方法被调用
      expect(ResourceReview).toHaveBeenCalledWith({
        resource: testResourceId,
        reviewer: testUserId,
        rating: 4,
        comment: '这是一个很好的资源',
        isRecommended: true
      });
      expect(mockReview.save).toHaveBeenCalled();

      // 验证日志记录
      expect(app.locals.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('提交了资源'),
        expect.any(String)
      );
    });

    it.skip('应该更新已存在的评论', async () => {
      // 模拟 Resource.findById 方法
      Resource.findById.mockResolvedValue({
        _id: testResourceId,
        title: '测试资源'
      });

      // 模拟已存在的评论
      const existingReview = {
        _id: new mongoose.Types.ObjectId(),
        resource: testResourceId,
        reviewer: testUserId,
        rating: 3,
        comment: '初始评论',
        isRecommended: false,
        save: jest.fn().mockResolvedValue({
          _id: new mongoose.Types.ObjectId(),
          resource: testResourceId,
          reviewer: testUserId,
          rating: 5,
          comment: '更新后的评论',
          isRecommended: true
        })
      };

      // 模拟 ResourceReview.findOne 方法
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
      expect(response.body.review).toHaveProperty('rating', 5);
      expect(response.body.review).toHaveProperty('comment', '更新后的评论');
      expect(response.body.review).toHaveProperty('isRecommended', true);

      // 验证 existingReview 被更新
      expect(existingReview.rating).toBe(5);
      expect(existingReview.comment).toBe('更新后的评论');
      expect(existingReview.isRecommended).toBe(true);
      expect(existingReview.save).toHaveBeenCalled();

      // 验证日志记录
      expect(app.locals.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('更新了资源'),
        expect.any(String)
      );
    });

    it.skip('资源不存在时应该返回404错误', async () => {
      // 模拟 Resource.findById 方法返回 null
      Resource.findById.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .post('/api/recommendations/reviews')
        .set('x-user-id', testUserId)
        .send({
          resource: testResourceId,
          rating: 4,
          comment: '这是一个很好的资源',
          isRecommended: true
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '资源不存在');
    });

    it.skip('缺少必要参数时应该返回400错误', async () => {
      // 发送请求，缺少 rating
      const response = await request(app)
        .post('/api/recommendations/reviews')
        .set('x-user-id', testUserId)
        .send({
          resource: testResourceId,
          comment: '这是一个很好的资源'
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
          comment: '这是一个很好的资源'
        });

      // 验证响应
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未认证');
    });

    it.skip('数据库错误时应该返回500错误', async () => {
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
        save: jest.fn().mockRejectedValue(new Error('数据库错误'))
      };

      // 模拟 ResourceReview 构造函数
      ResourceReview.mockImplementation(() => mockReview);

      // 模拟控制台错误输出
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // 发送请求
      const response = await request(app)
        .post('/api/recommendations/reviews')
        .set('x-user-id', testUserId)
        .send({
          resource: testResourceId,
          rating: 4,
          comment: '这是一个很好的资源',
          isRecommended: true
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '服务器错误');

      // 恢复控制台
      consoleSpy.mockRestore();
    });
  });

  describe('GET /api/recommendations/recommended', () => {
    it.skip('应该返回推荐资源列表', async () => {
      // 模拟 Resource.find 方法
      const mockResources = [
        {
          _id: new mongoose.Types.ObjectId(),
          title: '测试资源1',
          description: '这是测试资源1的描述',
          subject: '数学',
          grade: '三年级',
          type: '习题',
          averageRating: 4.5,
          reviewCount: 10
        },
        {
          _id: new mongoose.Types.ObjectId(),
          title: '测试资源2',
          description: '这是测试资源2的描述',
          subject: '语文',
          grade: '四年级',
          type: '教材',
          averageRating: 4.8,
          reviewCount: 15
        }
      ];

      Resource.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockResources)
        })
      });

      // 发送请求
      const response = await request(app)
        .get('/api/recommendations/recommended')
        .set('x-user-id', testUserId);

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('recommendedResources');
      expect(response.body).toHaveProperty('count');
      expect(response.body.recommendedResources).toEqual(mockResources);
      expect(response.body.count).toBe(2);

      // 验证 Resource.find 被调用
      expect(Resource.find).toHaveBeenCalled();

      // 验证日志记录
      expect(app.locals.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('请求推荐资源'),
        expect.any(Object)
      );
    });

    it.skip('应该根据科目和年级过滤推荐资源', async () => {
      // 模拟 Resource.find 方法
      const mockResources = [
        {
          _id: new mongoose.Types.ObjectId(),
          title: '测试资源1',
          description: '这是测试资源1的描述',
          subject: '数学',
          grade: '三年级',
          type: '习题',
          averageRating: 4.5,
          reviewCount: 10
        }
      ];

      Resource.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockResources)
        })
      });

      // 发送请求，带过滤条件
      const response = await request(app)
        .get('/api/recommendations/recommended')
        .query({ subject: '数学', grade: '三年级' })
        .set('x-user-id', testUserId);

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('recommendedResources');
      expect(response.body.recommendedResources).toEqual(mockResources);

      // 验证 Resource.find 被调用，并且带有过滤条件
      expect(Resource.find).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '数学',
          grade: '三年级'
        })
      );
    });

    it('未授权时应该返回401错误', async () => {
      // 发送请求，不设置用户ID
      const response = await request(app)
        .get('/api/recommendations/recommended');

      // 验证响应
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未认证');
    });

    it.skip('数据库错误时应该返回500错误', async () => {
      // 模拟 Resource.find 方法抛出错误
      Resource.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockRejectedValue(new Error('数据库错误'))
        })
      });

      // 模拟控制台错误输出
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // 发送请求
      const response = await request(app)
        .get('/api/recommendations/recommended')
        .set('x-user-id', testUserId);

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '服务器错误');

      // 恢复控制台
      consoleSpy.mockRestore();
    });
  });

  describe('GET /api/recommendations/personalized', () => {
    it.skip('当用户没有评价记录时应该重定向到普通推荐', async () => {
      // 模拟 ResourceReview.find 方法返回空数组
      ResourceReview.find.mockResolvedValue([]);

      // 发送请求
      const response = await request(app)
        .get('/api/recommendations/personalized')
        .set('x-user-id', testUserId);

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '没有足够的评价记录，使用普通推荐');

      // 验证日志记录
      expect(app.locals.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('没有评价记录'),
        expect.any(String)
      );
    });

    it.skip('应该根据用户偏好返回个性化推荐', async () => {
      // 模拟用户评价记录
      const userReviews = [
        {
          resource: {
            _id: new mongoose.Types.ObjectId(),
            subject: '数学',
            grade: '三年级',
            type: '习题'
          },
          rating: 5
        },
        {
          resource: {
            _id: new mongoose.Types.ObjectId(),
            subject: '数学',
            grade: '三年级',
            type: '习题'
          },
          rating: 4
        },
        {
          resource: {
            _id: new mongoose.Types.ObjectId(),
            subject: '语文',
            grade: '四年级',
            type: '教材'
          },
          rating: 3
        }
      ];

      // 模拟 ResourceReview.find 方法
      ResourceReview.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue(userReviews)
      });

      // 模拟推荐资源
      const mockResources = [
        {
          _id: new mongoose.Types.ObjectId(),
          title: '推荐资源1',
          description: '这是推荐资源1的描述',
          subject: '数学',
          grade: '三年级',
          type: '习题',
          averageRating: 4.5
        },
        {
          _id: new mongoose.Types.ObjectId(),
          title: '推荐资源2',
          description: '这是推荐资源2的描述',
          subject: '数学',
          grade: '三年级',
          type: '习题',
          averageRating: 4.2
        }
      ];

      // 模拟 Resource.find 方法
      Resource.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockResources)
        })
      });

      // 发送请求
      const response = await request(app)
        .get('/api/recommendations/personalized')
        .set('x-user-id', testUserId);

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('personalizedResources');
      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('userPreferences');
      expect(response.body.personalizedResources).toEqual(mockResources);
      expect(response.body.count).toBe(2);

      // 验证用户偏好
      expect(response.body.userPreferences).toHaveProperty('favoriteSubject', '数学');
      expect(response.body.userPreferences).toHaveProperty('favoriteGrade', '三年级');
      expect(response.body.userPreferences).toHaveProperty('favoriteType', '习题');

      // 验证日志记录
      expect(app.locals.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('请求个性化推荐资源'),
        expect.any(Object)
      );
    });

    it('未授权时应该返回401错误', async () => {
      // 发送请求，不设置用户ID
      const response = await request(app)
        .get('/api/recommendations/personalized');

      // 验证响应
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未认证');
    });
  });
});
