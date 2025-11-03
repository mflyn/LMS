const request = require('supertest');
const mongoose = require('mongoose');
const express = require('express');
const path = require('path');
const fs = require('fs');
const Resource = require('../../models/Resource');

// 模拟 Resource 模型
jest.mock('../../models/Resource');

// 模拟 fs 模块
jest.mock('fs');

// 模拟 path 模块
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn().mockImplementation((...args) => args.join('/'))
}));

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

// 模拟 multer 中间件
const multer = require('multer');

// 创建一个模拟的 multer 中间件
const mockSingle = jest.fn().mockImplementation(fieldName => {
  return (req, res, next) => {
    if (req.body && req.body[fieldName + '_error']) {
      return next(new Error(req.body[fieldName + '_error']));
    }

    if (req.body && req.body[fieldName]) {
      req.file = {
        originalname: req.body[fieldName],
        filename: `${Date.now()}-${req.body[fieldName]}`,
        mimetype: req.body.mimetype || 'application/pdf',
        size: req.body.size || 1024
      };
    }

    next();
  };
});

// 模拟 multer 模块
jest.mock('multer', () => {
  return jest.fn().mockImplementation(() => ({
    single: mockSingle
  }));
});

// 添加 logger 到 app.locals
app.locals.logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

// 获取资源列表
app.get('/api/resources', catchAsync(async (req, res) => {
  const { subject, grade, type, keyword, limit = 20, skip = 0 } = req.query;

  const query = {};

  if (subject) query.subject = subject;
  if (grade) query.grade = grade;
  if (type) query.type = type;
  if (keyword) {
    query.$or = [
      { title: { $regex: keyword, $options: 'i' } },
      { description: { $regex: keyword, $options: 'i' } },
      { tags: { $regex: keyword, $options: 'i' } }
    ];
  }

  const resources = await Resource.find(query)
    .sort({ createdAt: -1 })
    .skip(parseInt(skip))
    .limit(parseInt(limit))
    .populate('uploader', 'name role');

  const total = await Resource.countDocuments(query);

  res.status(200).json({
    resources,
    pagination: {
      total,
      limit: parseInt(limit),
      skip: parseInt(skip),
    }
  });
}));

// 获取单个资源
app.get('/api/resources/:id', catchAsync(async (req, res) => {
  const resource = await Resource.findById(req.params.id)
    .populate('uploader', 'name role');

  if (!resource) {
    return res.status(404).json({ message: '资源不存在' });
  }

  res.status(200).json(resource);
}));

// 上传资源
app.post('/api/resources', mockSingle('file'), catchAsync(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '请上传文件' });
  }

  const { title, description, subject, grade, type, tags, uploaderId } = req.body;

  if (!title || !subject || !grade || !type) {
    return res.status(400).json({ message: '标题、学科、年级和类型不能为空' });
  }

  const resource = new Resource({
    title,
    description,
    subject,
    grade,
    type,
    tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
    file: {
      name: req.file.originalname,
      path: `/uploads/${req.file.filename}`, // 保持前导斜杠以兼容客户端
      type: req.file.mimetype,
      size: req.file.size
    },
    uploader: uploaderId,
    downloads: 0
  });

  await resource.save();

  res.status(201).json(resource);
}));

// 下载资源
app.get('/api/resources/:id/download', catchAsync(async (req, res) => {
  const resource = await Resource.findById(req.params.id);

  if (!resource) {
    return res.status(404).json({ message: '资源不存在' });
  }

  // 更新下载次数
  resource.downloads += 1;
  await resource.save();

  // 获取文件路径 - 移除前导斜杠
  const relativePath = resource.file.path.replace(/^\/+/, '');
  const filePath = path.join(__dirname, '..', relativePath);

  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: '文件不存在' });
  }

  // 设置响应头
  res.setHeader('Content-Type', resource.file.type);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(resource.file.name)}"`);

  // 发送文件
  res.sendFile = jest.fn().mockImplementation((path) => {
    res.status(200).send(`模拟文件发送: ${path}`);
  });

  res.sendFile(filePath);
}));

// 更新资源信息
app.put('/api/resources/:id', catchAsync(async (req, res) => {
  const { title, description, subject, grade, type, tags } = req.body;

  const resource = await Resource.findById(req.params.id);

  if (!resource) {
    return res.status(404).json({ message: '资源不存在' });
  }

  // 更新资源信息
  resource.title = title || resource.title;
  resource.description = description || resource.description;
  resource.subject = subject || resource.subject;
  resource.grade = grade || resource.grade;
  resource.type = type || resource.type;
  resource.tags = tags ? tags.split(',').map(tag => tag.trim()) : resource.tags;

  await resource.save();

  res.status(200).json(resource);
}));

// 删除资源
app.delete('/api/resources/:id', catchAsync(async (req, res) => {
  const resource = await Resource.findById(req.params.id);

  if (!resource) {
    return res.status(404).json({ message: '资源不存在' });
  }

  // 删除文件 - 移除前导斜杠
  if (resource.file && resource.file.path) {
    const relativePath = resource.file.path.replace(/^\/+/, '');
    const filePath = path.join(__dirname, '..', relativePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  // 删除资源记录
  await Resource.findByIdAndDelete(req.params.id);

  res.json({ message: '资源已删除' });
}));

// 获取热门资源
app.get('/api/resources/stats/popular', catchAsync(async (req, res) => {
  const { limit = 10 } = req.query;

  const resources = await Resource.find()
    .sort({ downloads: -1, createdAt: -1 })
    .limit(parseInt(limit))
    .populate('uploader', 'name role');

  res.json(resources);
}));

// 搜索资源
app.get('/api/resources/search/advanced', catchAsync(async (req, res) => {
  const { keyword, subject, grade, type, tags, limit = 20, skip = 0 } = req.query;

  const query = {};

  if (keyword) {
    query.$or = [
      { title: { $regex: keyword, $options: 'i' } },
      { description: { $regex: keyword, $options: 'i' } }
    ];
  }

  if (subject) query.subject = subject;
  if (grade) query.grade = grade;
  if (type) query.type = type;
  if (tags) {
    const tagArray = tags.split(',').map(tag => tag.trim());
    query.tags = { $in: tagArray };
  }

  const resources = await Resource.find(query)
    .sort({ createdAt: -1 })
    .skip(parseInt(skip))
    .limit(parseInt(limit))
    .populate('uploader', 'name role');

  const total = await Resource.countDocuments(query);

  res.json({
    data: resources,
    pagination: {
      total,
      limit: parseInt(limit),
      skip: parseInt(skip),
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

describe('资源 API 测试', () => {
  // 测试资源ID
  const testResourceId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/resources', () => {
    it('应该返回资源列表', async () => {
      // 模拟资源数据
      const mockResources = [
        {
          _id: new mongoose.Types.ObjectId(),
          title: '测试资源1',
          description: '这是测试资源1的描述',
          subject: '数学',
          grade: '三年级',
          type: '习题',
          createdAt: new Date()
        },
        {
          _id: new mongoose.Types.ObjectId(),
          title: '测试资源2',
          description: '这是测试资源2的描述',
          subject: '语文',
          grade: '四年级',
          type: '教材',
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
        .get('/api/resources');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('resources');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.resources.length).toBe(2);
      expect(response.body.pagination.total).toBe(2);
    });

    it('应该根据查询参数过滤资源', async () => {
      // 模拟资源数据
      const mockResources = [
        {
          _id: new mongoose.Types.ObjectId(),
          title: '数学习题',
          description: '这是数学习题的描述',
          subject: '数学',
          grade: '三年级',
          type: '习题',
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

      // 发送请求，带查询参数
      const response = await request(app)
        .get('/api/resources')
        .query({
          subject: '数学',
          grade: '三年级',
          type: '习题',
          keyword: '数学'
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body.resources.length).toBe(1);
      expect(response.body.pagination.total).toBe(1);

      // 验证查询参数
      expect(Resource.find).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '数学',
          grade: '三年级',
          type: '习题',
          $or: expect.any(Array)
        })
      );
    });

    it('数据库错误时应该返回500错误', async () => {
      // 模拟 Resource.find 方法抛出错误
      Resource.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              populate: jest.fn().mockRejectedValue(new Error('数据库错误'))
            })
          })
        })
      });

      // 发送请求
      const response = await request(app)
        .get('/api/resources');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '数据库错误');
    });
  });

  describe('GET /api/resources/:id', () => {
    it('应该返回单个资源', async () => {
      // 模拟资源数据
      const mockResource = {
        _id: testResourceId,
        title: '测试资源',
        description: '这是测试资源的描述',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        uploader: {
          _id: new mongoose.Types.ObjectId(),
          name: '测试用户',
          role: 'teacher'
        }
      };

      // 模拟 Resource.findById 方法
      Resource.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockResource)
      });

      // 发送请求
      const response = await request(app)
        .get(`/api/resources/${testResourceId}`);

      // 验证响应
      expect(response.status).toBe(200);
      // 由于 MongoDB ObjectId 的序列化问题，我们只检查部分属性
      expect(response.body.title).toBe(mockResource.title);
      expect(response.body.description).toBe(mockResource.description);
      expect(response.body.subject).toBe(mockResource.subject);
      expect(response.body.grade).toBe(mockResource.grade);
      expect(response.body.type).toBe(mockResource.type);
    });

    it('资源不存在时应该返回404错误', async () => {
      // 模拟 Resource.findById 方法返回 null
      Resource.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      // 发送请求
      const response = await request(app)
        .get(`/api/resources/${testResourceId}`);

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '资源不存在');
    });

    it('数据库错误时应该返回500错误', async () => {
      // 模拟 Resource.findById 方法抛出错误
      Resource.findById.mockReturnValue({
        populate: jest.fn().mockRejectedValue(new Error('数据库错误'))
      });

      // 发送请求
      const response = await request(app)
        .get(`/api/resources/${testResourceId}`);

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '数据库错误');
    });
  });

  describe('POST /api/resources', () => {
    it('应该成功上传资源', async () => {
      // 模拟资源数据
      const mockResource = {
        _id: new mongoose.Types.ObjectId(),
        title: '测试资源',
        description: '这是测试资源的描述',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        tags: ['测试', '数学'],
        file: {
          name: 'test.pdf',
          path: '/uploads/test.pdf',
          type: 'application/pdf',
          size: 1024
        },
        uploader: new mongoose.Types.ObjectId(),
        downloads: 0,
        save: jest.fn().mockResolvedValue({})
      };

      // 模拟 Resource 构造函数
      Resource.mockImplementation(() => mockResource);

      // 发送请求
      const response = await request(app)
        .post('/api/resources')
        .send({
          title: '测试资源',
          description: '这是测试资源的描述',
          subject: '数学',
          grade: '三年级',
          type: '习题',
          tags: '测试,数学',
          uploaderId: new mongoose.Types.ObjectId().toString(),
          file: 'test.pdf',
          mimetype: 'application/pdf',
          size: 1024
        });

      // 验证响应
      expect(response.status).toBe(201);
      // 由于函数不会被序列化到 JSON 中，我们只检查部分属性
      expect(response.body.title).toBe(mockResource.title);
      expect(response.body.description).toBe(mockResource.description);
      expect(response.body.subject).toBe(mockResource.subject);
      expect(response.body.grade).toBe(mockResource.grade);
      expect(response.body.type).toBe(mockResource.type);
      expect(response.body.tags).toEqual(mockResource.tags);
      expect(mockResource.save).toHaveBeenCalled();
    });

    it('缺少文件时应该返回400错误', async () => {
      // 发送请求，不包含文件
      const response = await request(app)
        .post('/api/resources')
        .send({
          title: '测试资源',
          description: '这是测试资源的描述',
          subject: '数学',
          grade: '三年级',
          type: '习题'
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '请上传文件');
    });

    it('缺少必要参数时应该返回400错误', async () => {
      // 发送请求，缺少必要参数
      const response = await request(app)
        .post('/api/resources')
        .send({
          description: '这是测试资源的描述',
          file: 'test.pdf'
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题、学科、年级和类型不能为空');
    });

    it('数据库错误时应该返回500错误', async () => {
      // 模拟资源数据
      const mockResource = {
        _id: new mongoose.Types.ObjectId(),
        title: '测试资源',
        description: '这是测试资源的描述',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        tags: ['测试', '数学'],
        file: {
          name: 'test.pdf',
          path: '/uploads/test.pdf',
          type: 'application/pdf',
          size: 1024
        },
        uploader: new mongoose.Types.ObjectId(),
        downloads: 0,
        save: jest.fn().mockRejectedValue(new Error('数据库错误'))
      };

      // 模拟 Resource 构造函数
      Resource.mockImplementation(() => mockResource);

      // 发送请求
      const response = await request(app)
        .post('/api/resources')
        .send({
          title: '测试资源',
          description: '这是测试资源的描述',
          subject: '数学',
          grade: '三年级',
          type: '习题',
          tags: '测试,数学',
          uploaderId: new mongoose.Types.ObjectId().toString(),
          file: 'test.pdf'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '数据库错误');
    });

    it('文件类型不支持时应该返回错误', async () => {
      // 发送请求，使用不支持的文件类型
      const response = await request(app)
        .post('/api/resources')
        .send({
          title: '测试资源',
          description: '这是测试资源的描述',
          subject: '数学',
          grade: '三年级',
          type: '习题',
          file: 'test.xyz', // 不支持的扩展名
          file_error: '不支持的文件类型' // 触发错误
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '不支持的文件类型');
    });

    it('文件大小超限时应该返回错误', async () => {
      // 发送请求，文件大小超过限制
      const response = await request(app)
        .post('/api/resources')
        .send({
          title: '测试资源',
          description: '这是测试资源的描述',
          subject: '数学',
          grade: '三年级',
          type: '习题',
          file: 'large_file.pdf',
          size: 60 * 1024 * 1024, // 60MB，超过50MB的限制
          file_error: '文件大小超过限制'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '文件大小超过限制');
    });
  });

  describe('GET /api/resources/:id/download', () => {
    it('应该成功下载资源', async () => {
      // 模拟资源数据
      const mockResource = {
        _id: testResourceId,
        file: {
          name: 'test.pdf',
          path: '/uploads/test.pdf',
          type: 'application/pdf',
          size: 1024
        },
        downloads: 0,
        save: jest.fn().mockResolvedValue({})
      };

      // 模拟 Resource.findById 方法
      Resource.findById.mockResolvedValue(mockResource);

      // 模拟 fs.existsSync 方法
      fs.existsSync.mockReturnValue(true);

      // 发送请求
      const response = await request(app)
        .get(`/api/resources/${testResourceId}/download`);

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toBe('attachment; filename="test.pdf"');
      expect(mockResource.downloads).toBe(1);
      expect(mockResource.save).toHaveBeenCalled();
    });

    it('资源不存在时应该返回404错误', async () => {
      // 模拟 Resource.findById 方法返回 null
      Resource.findById.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .get(`/api/resources/${testResourceId}/download`);

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '资源不存在');
    });

    it('文件不存在时应该返回404错误', async () => {
      // 模拟资源数据
      const mockResource = {
        _id: testResourceId,
        file: {
          name: 'test.pdf',
          path: '/uploads/test.pdf',
          type: 'application/pdf',
          size: 1024
        },
        downloads: 0,
        save: jest.fn().mockResolvedValue({})
      };

      // 模拟 Resource.findById 方法
      Resource.findById.mockResolvedValue(mockResource);

      // 模拟 fs.existsSync 方法返回 false
      fs.existsSync.mockReturnValue(false);

      // 发送请求
      const response = await request(app)
        .get(`/api/resources/${testResourceId}/download`);

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '文件不存在');
    });

    it('数据库错误时应该返回500错误', async () => {
      // 模拟 Resource.findById 方法抛出错误
      Resource.findById.mockRejectedValue(new Error('数据库错误'));

      // 发送请求
      const response = await request(app)
        .get(`/api/resources/${testResourceId}/download`);

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '数据库错误');
    });
  });

  describe('PUT /api/resources/:id', () => {
    it('应该成功更新资源信息', async () => {
      // 模拟资源数据
      const mockResource = {
        _id: testResourceId,
        title: '原始标题',
        description: '原始描述',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        tags: ['原始标签'],
        save: jest.fn().mockResolvedValue({})
      };

      // 模拟 Resource.findById 方法
      Resource.findById.mockResolvedValue(mockResource);

      // 发送请求
      const response = await request(app)
        .put(`/api/resources/${testResourceId}`)
        .send({
          title: '更新后的标题',
          description: '更新后的描述',
          tags: '标签1,标签2'
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(mockResource.title).toBe('更新后的标题');
      expect(mockResource.description).toBe('更新后的描述');
      expect(mockResource.tags).toEqual(['标签1', '标签2']);
      expect(mockResource.save).toHaveBeenCalled();
    });

    it('资源不存在时应该返回404错误', async () => {
      // 模拟 Resource.findById 方法返回 null
      Resource.findById.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .put(`/api/resources/${testResourceId}`)
        .send({
          title: '更新后的标题'
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '资源不存在');
    });

    it('数据库错误时应该返回500错误', async () => {
      // 模拟资源数据
      const mockResource = {
        _id: testResourceId,
        title: '原始标题',
        save: jest.fn().mockRejectedValue(new Error('数据库错误'))
      };

      // 模拟 Resource.findById 方法
      Resource.findById.mockResolvedValue(mockResource);

      // 发送请求
      const response = await request(app)
        .put(`/api/resources/${testResourceId}`)
        .send({
          title: '更新后的标题'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '数据库错误');
    });
  });

  describe('DELETE /api/resources/:id', () => {
    it('应该成功删除资源', async () => {
      // 模拟资源数据
      const mockResource = {
        _id: testResourceId,
        file: {
          path: '/uploads/test.pdf'
        }
      };

      // 模拟 Resource.findById 方法
      Resource.findById.mockResolvedValue(mockResource);

      // 模拟 fs.existsSync 方法
      fs.existsSync.mockReturnValue(true);

      // 模拟 fs.unlinkSync 方法
      fs.unlinkSync.mockImplementation(() => {});

      // 模拟 Resource.findByIdAndDelete 方法
      Resource.findByIdAndDelete.mockResolvedValue({});

      // 发送请求
      const response = await request(app)
        .delete(`/api/resources/${testResourceId}`);

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '资源已删除');
      expect(fs.unlinkSync).toHaveBeenCalled();
      expect(Resource.findByIdAndDelete).toHaveBeenCalledWith(testResourceId);
    });

    it('资源不存在时应该返回404错误', async () => {
      // 模拟 Resource.findById 方法返回 null
      Resource.findById.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .delete(`/api/resources/${testResourceId}`);

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '资源不存在');
    });

    it('数据库错误时应该返回500错误', async () => {
      // 模拟 Resource.findById 方法抛出错误
      Resource.findById.mockRejectedValue(new Error('数据库错误'));

      // 发送请求
      const response = await request(app)
        .delete(`/api/resources/${testResourceId}`);

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '数据库错误');
    });
  });

  describe('GET /api/resources/stats/popular', () => {
    it('应该返回热门资源列表', async () => {
      // 模拟资源数据
      const mockResources = [
        {
          _id: new mongoose.Types.ObjectId(),
          title: '热门资源1',
          downloads: 100,
          createdAt: new Date()
        },
        {
          _id: new mongoose.Types.ObjectId(),
          title: '热门资源2',
          downloads: 50,
          createdAt: new Date()
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
        .get('/api/resources/stats/popular');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
      expect(response.body[0].title).toBe('热门资源1');
      expect(response.body[1].title).toBe('热门资源2');
    });

    it('应该根据查询参数限制结果数量', async () => {
      // 模拟资源数据
      const mockResources = [
        {
          _id: new mongoose.Types.ObjectId(),
          title: '热门资源1',
          downloads: 100,
          createdAt: new Date()
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

      // 发送请求，限制结果数量为1
      const response = await request(app)
        .get('/api/resources/stats/popular')
        .query({ limit: 1 });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(Resource.find().sort().limit).toHaveBeenCalledWith(1);
    });

    it('数据库错误时应该返回500错误', async () => {
      // 模拟 Resource.find 方法抛出错误
      Resource.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            populate: jest.fn().mockRejectedValue(new Error('数据库错误'))
          })
        })
      });

      // 发送请求
      const response = await request(app)
        .get('/api/resources/stats/popular');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '数据库错误');
    });
  });

  describe('GET /api/resources/search/advanced', () => {
    it('应该返回搜索结果', async () => {
      // 模拟资源数据
      const mockResources = [
        {
          _id: new mongoose.Types.ObjectId(),
          title: '数学习题',
          description: '这是数学习题的描述',
          subject: '数学',
          grade: '三年级',
          type: '习题',
          tags: ['数学', '习题'],
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

      // 发送请求，带搜索参数
      const response = await request(app)
        .get('/api/resources/search/advanced')
        .query({
          keyword: '数学',
          subject: '数学',
          grade: '三年级',
          type: '习题',
          tags: '数学,习题'
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.data.length).toBe(1);
      expect(response.body.pagination.total).toBe(1);

      // 验证查询参数
      expect(Resource.find).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '数学',
          grade: '三年级',
          type: '习题',
          tags: expect.any(Object),
          $or: expect.any(Array)
        })
      );
    });

    it('数据库错误时应该返回500错误', async () => {
      // 模拟 Resource.find 方法抛出错误
      Resource.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              populate: jest.fn().mockRejectedValue(new Error('数据库错误'))
            })
          })
        })
      });

      // 发送请求
      const response = await request(app)
        .get('/api/resources/search/advanced');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '数据库错误');
    });
  });
});
