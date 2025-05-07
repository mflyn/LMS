const request = require('supertest');
const mongoose = require('mongoose');
const express = require('express');
const resourcesRouter = require('../../routes/resources');
const Resource = require('../../models/Resource');

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

app.use('/api/resources', resourcesRouter);

// 错误处理中间件
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    status: err.status || 'error',
    message: err.message || '服务器错误'
  });
});

// 模拟 Resource 模型
jest.mock('../../models/Resource');

describe('Resources 路由搜索过滤测试', () => {
  const testUserId = new mongoose.Types.ObjectId().toString();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/resources', () => {
    it('应该返回资源列表', async () => {
      // 模拟资源数据
      const mockResources = [
        {
          _id: new mongoose.Types.ObjectId(),
          title: '数学习题集',
          description: '小学三年级数学习题集',
          subject: '数学',
          grade: '三年级',
          type: '习题',
          tags: ['数学', '习题', '小学'],
          uploader: {
            _id: new mongoose.Types.ObjectId(),
            name: '张老师',
            role: 'teacher'
          },
          downloads: 10,
          createdAt: new Date()
        },
        {
          _id: new mongoose.Types.ObjectId(),
          title: '语文阅读理解',
          description: '小学四年级语文阅读理解练习',
          subject: '语文',
          grade: '四年级',
          type: '习题',
          tags: ['语文', '阅读', '小学'],
          uploader: {
            _id: new mongoose.Types.ObjectId(),
            name: '李老师',
            role: 'teacher'
          },
          downloads: 15,
          createdAt: new Date()
        }
      ];

      // 模拟 Resource.find 方法
      Resource.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              populate: jest.fn().mockResolvedValue(mockResources)
            })
          })
        })
      });

      // 模拟 Resource.countDocuments 方法
      Resource.countDocuments.mockResolvedValue(2);

      // 发送请求
      const response = await request(app)
        .get('/api/resources')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('resources');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.resources).toHaveLength(2);
      expect(response.body.pagination).toHaveProperty('total', 2);
    });

    it('应该根据科目过滤资源', async () => {
      // 模拟资源数据
      const mockResources = [
        {
          _id: new mongoose.Types.ObjectId(),
          title: '数学习题集',
          description: '小学三年级数学习题集',
          subject: '数学',
          grade: '三年级',
          type: '习题',
          tags: ['数学', '习题', '小学'],
          uploader: {
            _id: new mongoose.Types.ObjectId(),
            name: '张老师',
            role: 'teacher'
          },
          downloads: 10,
          createdAt: new Date()
        }
      ];

      // 模拟 Resource.find 方法
      Resource.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              populate: jest.fn().mockResolvedValue(mockResources)
            })
          })
        })
      });

      // 模拟 Resource.countDocuments 方法
      Resource.countDocuments.mockResolvedValue(1);

      // 发送请求，带过滤条件
      const response = await request(app)
        .get('/api/resources')
        .query({ subject: '数学' })
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('resources');
      expect(response.body.resources).toHaveLength(1);
      expect(response.body.resources[0]).toHaveProperty('subject', '数学');

      // 验证 Resource.find 被调用，并且带有过滤条件
      expect(Resource.find).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '数学'
        })
      );
    });

    it('应该根据关键词搜索资源', async () => {
      // 模拟资源数据
      const mockResources = [
        {
          _id: new mongoose.Types.ObjectId(),
          title: '数学习题集',
          description: '小学三年级数学习题集',
          subject: '数学',
          grade: '三年级',
          type: '习题',
          tags: ['数学', '习题', '小学'],
          uploader: {
            _id: new mongoose.Types.ObjectId(),
            name: '张老师',
            role: 'teacher'
          },
          downloads: 10,
          createdAt: new Date()
        }
      ];

      // 模拟 Resource.find 方法
      Resource.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              populate: jest.fn().mockResolvedValue(mockResources)
            })
          })
        })
      });

      // 模拟 Resource.countDocuments 方法
      Resource.countDocuments.mockResolvedValue(1);

      // 发送请求，带关键词搜索
      const response = await request(app)
        .get('/api/resources')
        .query({ keyword: '习题' })
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('resources');
      expect(response.body.resources).toHaveLength(1);

      // 验证 Resource.find 被调用，并且带有关键词搜索条件
      expect(Resource.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [
            { title: { $regex: '习题', $options: 'i' } },
            { description: { $regex: '习题', $options: 'i' } },
            { tags: { $regex: '习题', $options: 'i' } }
          ]
        })
      );
    });

    it('应该处理分页参数', async () => {
      // 模拟资源数据
      const mockResources = [
        {
          _id: new mongoose.Types.ObjectId(),
          title: '数学习题集',
          description: '小学三年级数学习题集',
          subject: '数学',
          grade: '三年级',
          type: '习题'
        }
      ];

      // 模拟 Resource.find 方法
      Resource.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              populate: jest.fn().mockResolvedValue(mockResources)
            })
          })
        })
      });

      // 模拟 Resource.countDocuments 方法
      Resource.countDocuments.mockResolvedValue(100);

      // 发送请求，带分页参数
      const response = await request(app)
        .get('/api/resources')
        .query({ limit: 10, skip: 20 })
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total', 100);
      expect(response.body.pagination).toHaveProperty('limit', 10);
      expect(response.body.pagination).toHaveProperty('skip', 20);

      // 验证 Resource.find 方法的 skip 和 limit 参数
      const sortMock = Resource.find().sort;
      const skipMock = sortMock().skip;
      const limitMock = skipMock().limit;

      expect(skipMock).toHaveBeenCalledWith(20);
      expect(limitMock).toHaveBeenCalledWith(10);
    });
  });

  describe('GET /api/resources/search/advanced', () => {
    it('应该执行高级搜索', async () => {
      // 模拟资源数据
      const mockResources = [
        {
          _id: new mongoose.Types.ObjectId(),
          title: '数学习题集',
          description: '小学三年级数学习题集',
          subject: '数学',
          grade: '三年级',
          type: '习题',
          tags: ['数学', '习题', '小学']
        }
      ];

      // 模拟 Resource.find 方法
      Resource.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              populate: jest.fn().mockResolvedValue(mockResources)
            })
          })
        })
      });

      // 模拟 Resource.countDocuments 方法
      Resource.countDocuments.mockResolvedValue(1);

      // 发送请求，带高级搜索参数
      const response = await request(app)
        .get('/api/resources/search/advanced')
        .query({
          keyword: '习题',
          subject: '数学',
          grade: '三年级',
          type: '习题',
          tags: '数学,习题'
        })
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveLength(1);

      // 验证 Resource.find 被调用，并且带有高级搜索条件
      expect(Resource.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [
            { title: { $regex: '习题', $options: 'i' } },
            { description: { $regex: '习题', $options: 'i' } }
          ],
          subject: '数学',
          grade: '三年级',
          type: '习题',
          tags: { $in: ['数学', '习题'] }
        })
      );
    });
  });

  describe('GET /api/resources/stats/popular', () => {
    it('应该返回热门资源', async () => {
      // 模拟资源数据
      const mockResources = [
        {
          _id: new mongoose.Types.ObjectId(),
          title: '数学习题集',
          description: '小学三年级数学习题集',
          subject: '数学',
          grade: '三年级',
          type: '习题',
          downloads: 100
        },
        {
          _id: new mongoose.Types.ObjectId(),
          title: '语文阅读理解',
          description: '小学四年级语文阅读理解练习',
          subject: '语文',
          grade: '四年级',
          type: '习题',
          downloads: 80
        }
      ];

      // 模拟 Resource.find 方法
      Resource.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockResources)
          })
        })
      });

      // 发送请求
      const response = await request(app)
        .get('/api/resources/stats/popular')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('downloads', 100);
      expect(response.body[1]).toHaveProperty('downloads', 80);

      // 验证 Resource.find 方法的 sort 参数
      const sortMock = Resource.find().sort;
      expect(sortMock).toHaveBeenCalledWith({ downloads: -1, createdAt: -1 });
    });
  });
});
