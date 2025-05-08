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

  // 检查资源是否存在
  const resource = await Resource.findById(resourceId);
  if (!resource) {
    return res.status(404).json({ message: '资源不存在' });
  }

  const reviews = await ResourceReview.find({ resource: resourceId })
    .populate('reviewer', 'name role')
    .sort({ createdAt: -1 });

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
    return res.status(400).json({ message: '资源ID和评分不能为空' });
  }

  // 检查资源是否存在
  const resourceExists = await Resource.findById(resource);
  if (!resourceExists) {
    return res.status(404).json({ message: '资源不存在' });
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

    app.locals.logger.info(`用户 ${req.user.id} 更新了资源 ${resource} 的评价`);
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

    app.locals.logger.info(`用户 ${req.user.id} 提交了资源 ${resource} 的新评价`);
    res.status(201).json({ message: '评价已提交', review: newReview });
  }
}));

// 获取推荐资源
app.get('/api/recommendations/recommended', authenticateToken, catchAsync(async (req, res) => {
  const { subject, grade, limit = 10 } = req.query;

  app.locals.logger.info(`用户 ${req.user.id} 请求推荐资源`, { subject, grade, limit });

  // 构建查询条件
  const query = {};
  if (subject) query.subject = subject;
  if (grade) query.grade = grade;

  // 获取推荐资源
  const recommendedResources = await Resource.find(query)
    .sort({ averageRating: -1 })
    .limit(parseInt(limit));

  app.locals.logger.info(`为用户 ${req.user.id} 返回 ${recommendedResources.length} 个推荐资源`);

  res.json({
    recommendedResources,
    count: recommendedResources.length
  });
}));

// 获取个性化推荐资源
app.get('/api/recommendations/personalized', authenticateToken, catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { subject, grade, limit = 10 } = req.query;

  app.locals.logger.info(`用户 ${userId} 请求个性化推荐资源`, { limit, subject, grade });

  // 获取用户历史评价
  const userReviews = await ResourceReview.find({ reviewer: userId })
    .populate('resource');

  // 如果用户没有评价记录，返回普通推荐
  if (userReviews.length === 0) {
    app.locals.logger.info(`用户 ${userId} 没有评价记录，重定向到普通推荐`);
    return res.json({
      message: '没有足够的评价记录，使用普通推荐'
    });
  }

  // 分析用户偏好
  const userPreferences = {
    subjects: {},
    types: {},
    grades: {}
  };

  // 分析用户偏好
  userReviews.forEach(review => {
    const resource = review.resource;
    const rating = review.rating;
    const weight = rating / 5; // 评分权重

    // 科目偏好
    if (resource.subject) {
      userPreferences.subjects[resource.subject] =
        (userPreferences.subjects[resource.subject] || 0) + weight;
    }

    // 资源类型偏好
    if (resource.type) {
      userPreferences.types[resource.type] =
        (userPreferences.types[resource.type] || 0) + weight;
    }

    // 年级偏好
    if (resource.grade) {
      userPreferences.grades[resource.grade] =
        (userPreferences.grades[resource.grade] || 0) + weight;
    }
  });

  // 找出用户最喜欢的科目、类型和年级
  const favoriteSubject = Object.entries(userPreferences.subjects)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  const favoriteType = Object.entries(userPreferences.types)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  const favoriteGrade = Object.entries(userPreferences.grades)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  app.locals.logger.info(`用户 ${userId} 的偏好分析结果`, {
    favoriteSubject,
    favoriteType,
    favoriteGrade
  });

  // 构建查询条件
  const query = {};
  if (subject) query.subject = subject;
  else if (favoriteSubject) query.subject = favoriteSubject;

  if (grade) query.grade = grade;
  else if (favoriteGrade) query.grade = favoriteGrade;

  if (favoriteType) query.type = favoriteType;

  // 获取推荐资源
  const personalizedResources = await Resource.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

  app.locals.logger.info(`为用户 ${userId} 返回 ${personalizedResources.length} 个个性化推荐资源`);

  res.json({
    personalizedResources,
    count: personalizedResources.length,
    userPreferences: {
      favoriteSubject,
      favoriteType,
      favoriteGrade
    }
  });
}));

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    status: err.status || 'error',
    message: err.message || '服务器错误'
  });
});

describe('推荐 API 测试', () => {
  // 测试用户ID
  const testUserId = new mongoose.Types.ObjectId().toString();
  const testResourceId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/recommendations/reviews/:resourceId', () => {
    it('应该返回资源的评论列表和统计信息', async () => {
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

      // 由于 Date 对象在 JSON 序列化时会转换为字符串，我们不直接比较对象
      expect(response.body.reviews.length).toBe(mockReviews.length);
      expect(response.body.reviews[0].rating).toBe(mockReviews[0].rating);
      expect(response.body.reviews[0].comment).toBe(mockReviews[0].comment);
      expect(response.body.reviews[1].rating).toBe(mockReviews[1].rating);
      expect(response.body.reviews[1].comment).toBe(mockReviews[1].comment);

      expect(response.body.stats).toHaveProperty('count', 2);
      expect(response.body.stats).toHaveProperty('averageRating', 4.5);
    });

    it('资源不存在时应该返回404错误', async () => {
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

    it('数据库错误时应该返回500错误', async () => {
      // 暂时模拟 console.error，抑制其输出
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

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

      // 发送请求
      const response = await request(app)
        .get(`/api/recommendations/reviews/${testResourceId}`)
        .set('x-user-id', testUserId);

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '数据库错误');

      // (可选) 验证 console.error 是否被调用了一次
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

      // 恢复 console.error 的原始实现
      consoleErrorSpy.mockRestore();
    });
  });

  describe('POST /api/recommendations/reviews', () => {
    it('应该成功提交新评论', async () => {
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
        isRecommended: true,
        createdAt: expect.any(Number)
      });
      expect(mockReview.save).toHaveBeenCalled();

      // 验证日志记录
      expect(app.locals.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('提交了资源')
      );
    });

    it('应该更新已存在的评论', async () => {
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
        expect.stringContaining('更新了资源')
      );
    });

    it('资源不存在时应该返回404错误', async () => {
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

    it('缺少必要参数时应该返回400错误', async () => {
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

    it('数据库错误时应该返回500错误', async () => {
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
      expect(response.body).toHaveProperty('message', '数据库错误');
    });
  });

  describe('GET /api/recommendations/recommended', () => {
    it('应该返回推荐资源列表', async () => {
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
          subject: '语文',
          grade: '四年级',
          type: '教材',
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
        .get('/api/recommendations/recommended')
        .set('x-user-id', testUserId);

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('recommendedResources');
      expect(response.body).toHaveProperty('count');
      expect(response.body.count).toBe(2);

      // 验证资源内容
      expect(response.body.recommendedResources.length).toBe(2);
      expect(response.body.recommendedResources[0].title).toBe('推荐资源1');
      expect(response.body.recommendedResources[1].title).toBe('推荐资源2');

      // 验证日志记录
      expect(app.locals.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('请求推荐资源'),
        expect.any(Object)
      );
    });

    it('应该根据科目和年级过滤推荐资源', async () => {
      // 模拟推荐资源
      const mockResources = [
        {
          _id: new mongoose.Types.ObjectId(),
          title: '数学习题1',
          description: '这是数学习题1的描述',
          subject: '数学',
          grade: '三年级',
          type: '习题',
          averageRating: 4.5
        }
      ];

      // 模拟 Resource.find 方法
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
      expect(response.body.recommendedResources.length).toBe(1);
      expect(response.body.recommendedResources[0].subject).toBe('数学');
      expect(response.body.recommendedResources[0].grade).toBe('三年级');

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

    it('数据库错误时应该返回500错误', async () => {
      // 模拟 Resource.find 方法抛出错误
      Resource.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockRejectedValue(new Error('数据库错误'))
        })
      });

      // 发送请求
      const response = await request(app)
        .get('/api/recommendations/recommended')
        .set('x-user-id', testUserId);

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '数据库错误');
    });
  });

  describe('GET /api/recommendations/personalized', () => {
    it('当用户没有评价记录时应该返回普通推荐', async () => {
      // 模拟 ResourceReview.find 方法返回空数组
      ResourceReview.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([])
      });

      // 发送请求
      const response = await request(app)
        .get('/api/recommendations/personalized')
        .set('x-user-id', testUserId);

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '没有足够的评价记录，使用普通推荐');

      // 验证日志记录
      expect(app.locals.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('没有评价记录，重定向到普通推荐')
      );
    });

    it('应该根据用户偏好返回个性化推荐', async () => {
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
      expect(response.body.personalizedResources.length).toBe(2);

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
