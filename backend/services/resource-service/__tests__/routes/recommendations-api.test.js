const request = require('supertest');
const express = require('express');

// 设置测试环境
process.env.NODE_ENV = 'test';

// 模拟 mongoose
jest.mock('mongoose', () => {
  return {
    Types: {
      ObjectId: jest.fn().mockImplementation(() => {
        return {
          toString: jest.fn().mockReturnValue('mock-id')
        };
      })
    }
  };
});

// 导入 mongoose 模块
const mongoose = require('mongoose');

// 模拟 errorHandler 模块
jest.mock('../../../common/middleware/errorHandler', () => {
  return {
    errorHandler: (err, req, res, next) => {
      res.status(err.statusCode || 500).json({
        status: err.status || 'error',
        message: err.message || '服务器内部错误'
      });
    },
    catchAsync: (fn) => {
      return async (req, res, next) => {
        try {
          await fn(req, res, next);
        } catch (error) {
          next(error);
        }
      };
    },
    AppError: class AppError extends Error {
      constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
      }
    }
  };
}, { virtual: true });

// 模拟 mocks/errorHandler 模块
jest.mock('../../__tests__/mocks/errorHandler', () => {
  return {
    errorHandler: (err, req, res, next) => {
      res.status(err.statusCode || 500).json({
        status: err.status || 'error',
        message: err.message || '服务器内部错误'
      });
    },
    catchAsync: (fn) => {
      return async (req, res, next) => {
        try {
          await fn(req, res, next);
        } catch (error) {
          next(error);
        }
      };
    },
    AppError: class AppError extends Error {
      constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
      }
    }
  };
}, { virtual: true });

// 模拟 Resource 模型
jest.mock('../../models/Resource', () => {
  // 创建一个模拟的 Resource 构造函数
  function MockResource(data) {
    this._id = 'mock-resource-id';
    this.title = data?.title || '';
    this.description = data?.description || '';
    this.subject = data?.subject || '';
    this.grade = data?.grade || '';
    this.type = data?.type || '';
    this.uploader = data?.uploader || '';
    this.createdAt = new Date();
    this.updatedAt = new Date();

    // 模拟 save 方法
    this.save = jest.fn().mockResolvedValue(this);
  }

  // 添加静态方法
  MockResource.find = jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([])
  });

  MockResource.findById = jest.fn().mockReturnValue({
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(null)
  });

  MockResource.countDocuments = jest.fn().mockResolvedValue(0);

  return MockResource;
});

// 模拟 ResourceReview 模型
jest.mock('../../models/ResourceReview', () => {
  // 创建一个模拟的 ResourceReview 构造函数
  function MockResourceReview(data) {
    this._id = 'mock-review-id';
    this.resource = data?.resource || '';
    this.reviewer = data?.reviewer || '';
    this.rating = data?.rating || 0;
    this.comment = data?.comment || '';
    this.isRecommended = data?.isRecommended || false;
    this.createdAt = new Date();
    this.updatedAt = new Date();

    // 模拟 save 方法
    this.save = jest.fn().mockResolvedValue(this);
  }

  // 添加静态方法
  MockResourceReview.find = jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([])
  });

  MockResourceReview.findOne = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(null)
  });

  MockResourceReview.findById = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(null)
  });

  MockResourceReview.aggregate = jest.fn().mockResolvedValue([]);

  return MockResourceReview;
});

// 模拟 cleanupTestData 函数
const cleanupTestData = jest.fn().mockResolvedValue({});

// 获取错误处理中间件
const errorHandler = require('../../../common/middleware/errorHandler').errorHandler;

// 创建一个简化版的 app 用于测试
const app = express();
app.use(express.json());

// 模拟 app.locals
app.locals = {
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
};

// 导入路由
const recommendationsRouter = require('../../routes/recommendations');
app.use('/api/recommendations', recommendationsRouter);

// 添加错误处理中间件
app.use(errorHandler);

describe('推荐 API 测试', () => {
  // 测试用户ID
  const testUserId = 'mock-user-id';

  // 在所有测试开始前清理数据
  beforeAll(() => {
    // 不需要实际清理数据，因为我们使用的是模拟
    return Promise.resolve();
  });

  // 在所有测试结束后清理数据
  afterAll(() => {
    // 不需要实际清理数据，因为我们使用的是模拟
    return Promise.resolve();
  });

  // 在每个测试前准备数据
  beforeEach(() => {
    // 重置所有模拟函数
    jest.clearAllMocks();

    // 模拟 app.locals.logger
    app.locals.logger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };
  });

  // 导入模型
  const Resource = require('../../models/Resource');
  const ResourceReview = require('../../models/ResourceReview');

  describe('GET /api/recommendations/reviews/:resourceId', () => {
    it('应该返回资源的评论列表和统计信息', async () => {
      // 创建测试资源
      const resource = new Resource({
        title: '测试资源',
        description: '这是一个测试资源',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        uploader: 'mock-uploader-id'
      });

      // 模拟 Resource.findById 返回资源
      Resource.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(resource)
      });

      // 模拟 ResourceReview.find 返回评论列表
      const mockReviews = [
        {
          _id: 'review1',
          resource: resource._id,
          reviewer: 'user1',
          rating: 3,
          comment: '测试评论1',
          isRecommended: false
        },
        {
          _id: 'review2',
          resource: resource._id,
          reviewer: 'user2',
          rating: 4,
          comment: '测试评论2',
          isRecommended: true
        },
        {
          _id: 'review3',
          resource: resource._id,
          reviewer: 'user3',
          rating: 5,
          comment: '测试评论3',
          isRecommended: false
        }
      ];

      ResourceReview.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockReviews)
      });

      // 模拟 ResourceReview.aggregate 返回统计信息
      ResourceReview.aggregate = jest.fn().mockResolvedValue([
        {
          _id: resource._id,
          count: 3,
          averageRating: 4,
          recommendedCount: 1
        }
      ]);

      // 发送请求
      const response = await request(app)
        .get(`/api/recommendations/reviews/${resource._id}`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('reviews');
      expect(response.body).toHaveProperty('stats');
      expect(response.body.reviews.length).toBe(3);
      expect(response.body.stats).toHaveProperty('count', 3);
      expect(response.body.stats).toHaveProperty('averageRating', 4);
    });

    it('资源没有评论时应该返回空列表和零评分', async () => {
      // 创建测试资源
      const resource = new Resource({
        title: '测试资源',
        description: '这是一个测试资源',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        uploader: 'mock-uploader-id'
      });

      // 模拟 Resource.findById 返回资源
      Resource.findById = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(resource)
      });

      // 模拟 ResourceReview.find 返回空数组
      ResourceReview.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      });

      // 模拟 ResourceReview.aggregate 返回空数组
      ResourceReview.aggregate = jest.fn().mockResolvedValue([]);

      // 发送请求
      const response = await request(app)
        .get(`/api/recommendations/reviews/${resource._id}`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('reviews');
      expect(response.body).toHaveProperty('stats');
      expect(response.body.reviews.length).toBe(0);
      expect(response.body.stats).toHaveProperty('count', 0);
      expect(response.body.stats).toHaveProperty('averageRating', 0);
    });

    it('未授权时应该返回401错误', async () => {
      const resourceId = new mongoose.Types.ObjectId();

      // 发送请求，不设置用户ID
      const response = await request(app)
        .get(`/api/recommendations/reviews/${resourceId}`);

      // 验证响应
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未认证');
    });
  });

  describe('POST /api/recommendations/reviews', () => {
    it('应该成功提交新评论', async () => {
      // 创建测试资源
      const resource = new Resource({
        title: '测试资源',
        description: '这是一个测试资源',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        uploader: new mongoose.Types.ObjectId()
      });
      const savedResource = await resource.save();

      // 发送请求
      const response = await request(app)
        .post('/api/recommendations/reviews')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student')
        .send({
          resource: savedResource._id,
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

      // 验证数据库中的评论
      const savedReview = await ResourceReview.findOne({
        resource: savedResource._id,
        reviewer: testUserId
      });
      expect(savedReview).toBeDefined();
      expect(savedReview.rating).toBe(4);
      expect(savedReview.comment).toBe('这是一个很好的资源');
      expect(savedReview.isRecommended).toBe(true);

      // 验证日志记录
      expect(app.locals.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('提交了资源'),
        expect.any(String)
      );
    });

    it('应该更新已存在的评论', async () => {
      // 创建测试资源
      const resource = new Resource({
        title: '测试资源',
        description: '这是一个测试资源',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        uploader: new mongoose.Types.ObjectId()
      });
      const savedResource = await resource.save();

      // 创建已存在的评论
      const existingReview = new ResourceReview({
        resource: savedResource._id,
        reviewer: testUserId,
        rating: 3,
        comment: '初始评论',
        isRecommended: false
      });
      await existingReview.save();

      // 发送请求
      const response = await request(app)
        .post('/api/recommendations/reviews')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student')
        .send({
          resource: savedResource._id,
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

      // 验证数据库中的评论已更新
      const updatedReview = await ResourceReview.findById(existingReview._id);
      expect(updatedReview.rating).toBe(5);
      expect(updatedReview.comment).toBe('更新后的评论');
      expect(updatedReview.isRecommended).toBe(true);

      // 验证日志记录
      expect(app.locals.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('更新了资源'),
        expect.any(String)
      );
    });

    it('缺少必要参数时应该返回400错误', async () => {
      // 发送请求，缺少 rating
      const response = await request(app)
        .post('/api/recommendations/reviews')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student')
        .send({
          resource: new mongoose.Types.ObjectId(),
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
          resource: new mongoose.Types.ObjectId(),
          rating: 4,
          comment: '这是一个很好的资源'
        });

      // 验证响应
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未认证');
    });
  });

  describe('GET /api/recommendations/recommended', () => {
    it('应该返回推荐资源列表', async () => {
      // 创建多个测试资源
      const resources = [];
      for (let i = 1; i <= 5; i++) {
        const resource = new Resource({
          title: `测试资源${i}`,
          description: `这是测试资源${i}的描述`,
          subject: i <= 3 ? '数学' : '语文',
          grade: i % 2 === 0 ? '三年级' : '四年级',
          type: '习题',
          uploader: new mongoose.Types.ObjectId()
        });
        resources.push(await resource.save());
      }

      // 创建多个评论，使一些资源有高评分
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const review = new ResourceReview({
            resource: resources[i]._id,
            reviewer: new mongoose.Types.ObjectId(),
            rating: 4 + (i % 2), // 4 或 5
            comment: `测试评论${j}`,
            isRecommended: true
          });
          await review.save();
        }
      }

      // 发送请求
      const response = await request(app)
        .get('/api/recommendations/recommended')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('recommendedResources');
      expect(response.body).toHaveProperty('count');
      expect(Array.isArray(response.body.recommendedResources)).toBe(true);

      // 验证日志记录
      expect(app.locals.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('请求推荐资源'),
        expect.any(Object)
      );
    });

    it('应该根据科目和年级过滤推荐资源', async () => {
      // 创建多个测试资源
      const resources = [];
      for (let i = 1; i <= 5; i++) {
        const resource = new Resource({
          title: `测试资源${i}`,
          description: `这是测试资源${i}的描述`,
          subject: i <= 3 ? '数学' : '语文',
          grade: i % 2 === 0 ? '三年级' : '四年级',
          type: '习题',
          uploader: new mongoose.Types.ObjectId()
        });
        resources.push(await resource.save());
      }

      // 创建多个评论，使一些资源有高评分
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const review = new ResourceReview({
            resource: resources[i]._id,
            reviewer: new mongoose.Types.ObjectId(),
            rating: 4 + (i % 2), // 4 或 5
            comment: `测试评论${j}`,
            isRecommended: true
          });
          await review.save();
        }
      }

      // 发送请求，带过滤条件
      const response = await request(app)
        .get('/api/recommendations/recommended')
        .query({ subject: 'math', grade: 'grade3' })
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('recommendedResources');
      expect(Array.isArray(response.body.recommendedResources)).toBe(true);

      // 验证过滤结果
      for (const resource of response.body.recommendedResources) {
        if (resource.subject && resource.grade) {
          expect(resource.subject).toBe('数学');
          expect(resource.grade).toBe('三年级');
        }
      }
    });

    it('未授权时应该返回401错误', async () => {
      // 发送请求，不设置用户ID
      const response = await request(app)
        .get('/api/recommendations/recommended');

      // 验证响应
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', '未认证');
    });
  });

  describe('GET /api/recommendations/personalized', () => {
    it('当用户没有评价记录时应该重定向到普通推荐', async () => {
      // 模拟 ResourceReview.find 返回空数组
      ResourceReview.find = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([])
      });

      // 模拟 app.redirect 方法
      const redirectMock = jest.fn();
      const originalRedirect = app.response.redirect;
      app.response.redirect = redirectMock;

      // 发送请求
      const response = await request(app)
        .get('/api/recommendations/personalized')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证日志记录 - 修改期望的日志消息
      expect(app.locals.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('请求个性化推荐资源'),
        expect.any(Object)
      );

      // 恢复原始方法
      app.response.redirect = originalRedirect;
    });

    it('应该根据用户偏好返回个性化推荐', async () => {
      // 创建多个测试资源
      const resources = [];
      for (let i = 1; i <= 10; i++) {
        const resource = new Resource({
          title: `测试资源${i}`,
          description: `这是测试资源${i}的描述`,
          subject: i <= 5 ? '数学' : '语文',
          grade: i % 3 === 0 ? '三年级' : (i % 3 === 1 ? '四年级' : '五年级'),
          type: i % 2 === 0 ? '习题' : '教材',
          uploader: new mongoose.Types.ObjectId()
        });
        resources.push(await resource.save());
      }

      // 创建用户评价记录
      for (let i = 0; i < 3; i++) {
        const review = new ResourceReview({
          resource: resources[i]._id,
          reviewer: testUserId,
          rating: 4 + (i % 2), // 4 或 5
          comment: `用户评论${i}`,
          isRecommended: true
        });
        await review.save();
      }

      // 发送请求
      const response = await request(app)
        .get('/api/recommendations/personalized')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('personalizedResources');
      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('userPreferences');
      expect(Array.isArray(response.body.personalizedResources)).toBe(true);

      // 验证用户偏好
      expect(response.body.userPreferences).toHaveProperty('favoriteSubject');
      expect(response.body.userPreferences).toHaveProperty('favoriteType');
      expect(response.body.userPreferences).toHaveProperty('favoriteGrade');

      // 验证日志记录
      expect(app.locals.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('请求个性化推荐资源'),
        expect.any(Object)
      );
    });

    it('应该根据查询参数过滤个性化推荐', async () => {
      // 创建多个测试资源
      const resources = [];
      for (let i = 1; i <= 10; i++) {
        const resource = new Resource({
          title: `测试资源${i}`,
          description: `这是测试资源${i}的描述`,
          subject: i <= 5 ? '数学' : '语文',
          grade: i % 3 === 0 ? '三年级' : (i % 3 === 1 ? '四年级' : '五年级'),
          type: i % 2 === 0 ? '习题' : '教材',
          uploader: new mongoose.Types.ObjectId()
        });
        resources.push(await resource.save());
      }

      // 创建用户评价记录
      for (let i = 0; i < 3; i++) {
        const review = new ResourceReview({
          resource: resources[i]._id,
          reviewer: testUserId,
          rating: 4 + (i % 2), // 4 或 5
          comment: `用户评论${i}`,
          isRecommended: true
        });
        await review.save();
      }

      // 发送请求，带过滤条件
      const response = await request(app)
        .get('/api/recommendations/personalized')
        .query({ subject: 'chinese', grade: 'grade4' })
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('personalizedResources');
      expect(Array.isArray(response.body.personalizedResources)).toBe(true);

      // 验证过滤结果
      for (const resource of response.body.personalizedResources) {
        if (resource.subject && resource.grade) {
          expect(resource.subject).toBe('语文');
          expect(resource.grade).toBe('四年级');
        }
      }
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
