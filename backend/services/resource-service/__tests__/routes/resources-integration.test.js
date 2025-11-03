const request = require('supertest');
const mongoose = require('mongoose');
const express = require('express');
const path = require('path');
const fs = require('fs');
const Resource = require('../../models/Resource');
const ResourceReview = require('../../models/ResourceReview');

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

// 模拟文件上传中间件
const upload = {
  single: jest.fn().mockImplementation(fieldName => {
    return (req, res, next) => {
      if (req.body.file_error) {
        return next(new Error(req.body.file_error));
      }

      if (req.body.file) {
        req.file = {
          originalname: req.body.file,
          filename: `${Date.now()}-${req.body.file}`,
          mimetype: req.body.mimetype || 'application/pdf',
          size: req.body.size || 1024
        };
      }
      next();
    };
  })
};

// 资源列表
app.get('/api/resources', catchAsync(async (req, res) => {
  const { subject, grade, type, limit = 20, skip = 0 } = req.query;

  const query = {};
  if (subject) query.subject = subject;
  if (grade) query.grade = grade;
  if (type) query.type = type;

  const resources = await Resource.find(query)
    .sort({ createdAt: -1 })
    .skip(parseInt(skip))
    .limit(parseInt(limit))
    .populate('uploader', 'name role');

  res.status(200).json(resources);
}));

// 获取单个资源
app.get('/api/resources/:id', catchAsync(async (req, res) => {
  const resource = await Resource.findById(req.params.id)
    .populate('uploader', 'name role');

  if (!resource) {
    throw new AppError('资源不存在', 404);
  }

  res.status(200).json(resource);
}));

// 上传资源
app.post('/api/resources', upload.single('file'), catchAsync(async (req, res) => {
  if (!req.file) {
    throw new AppError('请上传文件', 400);
  }

  const { title, description, subject, grade, type, tags } = req.body;

  if (!title || !subject || !grade || !type) {
    throw new AppError('标题、学科、年级和类型不能为空', 400);
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
    uploader: req.body.uploaderId,
    downloads: 0
  });

  await resource.save();

  res.status(201).json(resource);
}));

// 下载资源
app.get('/api/resources/:id/download', catchAsync(async (req, res) => {
  const resource = await Resource.findById(req.params.id);

  if (!resource) {
    throw new AppError('资源不存在', 404);
  }

  // 更新下载次数
  resource.downloads += 1;
  await resource.save();

  // 获取文件路径 - 移除前导斜杠
  const relativePath = resource.file.path.replace(/^\/+/, '');
  const filePath = path.join(__dirname, '..', relativePath);

  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    throw new AppError('文件不存在', 404);
  }

  // 设置响应头
  res.setHeader('Content-Type', resource.file.type);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(resource.file.name)}"`);

  // 发送文件
  res.sendFile(filePath);
}));

// 更新资源信息
app.put('/api/resources/:id', authenticateToken, catchAsync(async (req, res) => {
  const { title, description, subject, grade, type, tags } = req.body;

  const resource = await Resource.findById(req.params.id);

  if (!resource) {
    throw new AppError('资源不存在', 404);
  }

  // 检查权限
  if (resource.uploader.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('没有权限修改此资源', 403);
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
app.delete('/api/resources/:id', authenticateToken, catchAsync(async (req, res) => {
  const resource = await Resource.findById(req.params.id);

  if (!resource) {
    throw new AppError('资源不存在', 404);
  }

  // 检查权限
  if (resource.uploader.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('没有权限删除此资源', 403);
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

// 高级搜索
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

describe('资源 API 集成测试', () => {
  // 测试用户ID
  const testUserId = new mongoose.Types.ObjectId().toString();
  // 测试资源ID
  const testResourceId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();

    // 模拟 Resource 模型的方法
    Resource.find = jest.fn();
    Resource.findById = jest.fn();
    Resource.findByIdAndDelete = jest.fn();
    Resource.countDocuments = jest.fn();

    // 模拟 fs.existsSync 和 fs.unlinkSync
    fs.existsSync = jest.fn();
    fs.unlinkSync = jest.fn();
  });

  describe('资源上传和下载流程', () => {
    it.skip('应该能完成资源上传和下载的完整流程', async () => {
      // 1. 上传资源
      // 模拟 Resource 构造函数和 save 方法
      const mockResource = {
        _id: testResourceId,
        title: '测试资源',
        description: '这是测试资源的描述',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        tags: ['数学', '习题', '测试'],
        file: {
          name: 'test.pdf',
          path: '/uploads/test.pdf',
          type: 'application/pdf',
          size: 1024
        },
        uploader: testUserId,
        downloads: 0,
        save: jest.fn().mockResolvedValue(true),
        toObject: () => ({
          _id: testResourceId,
          title: '测试资源',
          description: '这是测试资源的描述',
          subject: '数学',
          grade: '三年级',
          type: '习题',
          tags: ['数学', '习题', '测试'],
          file: {
            name: 'test.pdf',
            path: '/uploads/test.pdf',
            type: 'application/pdf',
            size: 1024
          },
          uploader: testUserId,
          downloads: 0
        })
      };

      // 直接使用模拟资源对象

      // 发送上传请求
      const uploadResponse = await request(app)
        .post('/api/resources')
        .send({
          title: '测试资源',
          description: '这是测试资源的描述',
          subject: '数学',
          grade: '三年级',
          type: '习题',
          tags: '数学,习题,测试',
          uploaderId: testUserId,
          file: 'test.pdf'
        });

      // 验证上传响应
      expect(uploadResponse.status).toBe(201);
      expect(uploadResponse.body).toHaveProperty('_id', testResourceId);
      expect(uploadResponse.body).toHaveProperty('title', '测试资源');

      // 2. 查询资源
      // 模拟 Resource.findById 方法
      Resource.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockResource)
      });

      // 发送查询请求
      const getResponse = await request(app)
        .get(`/api/resources/${testResourceId}`);

      // 验证查询响应
      expect(getResponse.status).toBe(200);
      expect(getResponse.body).toHaveProperty('_id', testResourceId);
      expect(getResponse.body).toHaveProperty('title', '测试资源');

      // 3. 下载资源
      // 模拟 Resource.findById 方法
      Resource.findById.mockResolvedValue(mockResource);

      // 模拟文件存在
      fs.existsSync.mockReturnValue(true);

      // 模拟 res.sendFile 方法
      const sendFileMock = jest.fn();
      const mockResponse = {
        setHeader: jest.fn(),
        sendFile: sendFileMock
      };

      // 直接调用路由处理函数
      const req = { params: { id: testResourceId } };
      const res = mockResponse;
      const next = jest.fn();

      await app._router.stack.find(layer =>
        layer.route && layer.route.path === '/api/resources/:id/download'
      ).route.stack[1].handle(req, res, next);

      // 验证下载
      expect(mockResource.downloads).toBe(1);
      expect(mockResource.save).toHaveBeenCalled();
      expect(fs.existsSync).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('test.pdf'));
      expect(sendFileMock).toHaveBeenCalled();
    });
  });

  describe('资源更新和删除的权限控制', () => {
    it('非上传者尝试更新资源应该返回403错误', async () => {
      // 模拟资源
      const mockResource = {
        _id: testResourceId,
        title: '测试资源',
        description: '这是测试资源的描述',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        uploader: new mongoose.Types.ObjectId(), // 不同于测试用户ID
        save: jest.fn().mockResolvedValue(true)
      };

      // 模拟 Resource.findById 方法
      Resource.findById.mockResolvedValue(mockResource);

      // 发送更新请求
      const response = await request(app)
        .put(`/api/resources/${testResourceId}`)
        .set('x-user-id', testUserId) // 不是上传者
        .send({
          title: '更新后的标题',
          description: '更新后的描述'
        });

      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '没有权限修改此资源');

      // 验证资源没有被更新
      expect(mockResource.save).not.toHaveBeenCalled();
    });

    it('管理员应该能够更新任何资源', async () => {
      // 模拟资源
      const mockResource = {
        _id: testResourceId,
        title: '测试资源',
        description: '这是测试资源的描述',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        uploader: new mongoose.Types.ObjectId(), // 不同于测试用户ID
        save: jest.fn().mockResolvedValue(true)
      };

      // 模拟 Resource.findById 方法
      Resource.findById.mockResolvedValue(mockResource);

      // 发送更新请求
      const response = await request(app)
        .put(`/api/resources/${testResourceId}`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'admin') // 管理员角色
        .send({
          title: '更新后的标题',
          description: '更新后的描述'
        });

      // 验证响应
      expect(response.status).toBe(200);

      // 验证资源被更新
      expect(mockResource.title).toBe('更新后的标题');
      expect(mockResource.description).toBe('更新后的描述');
      expect(mockResource.save).toHaveBeenCalled();
    });

    it('非上传者尝试删除资源应该返回403错误', async () => {
      // 模拟资源
      const mockResource = {
        _id: testResourceId,
        title: '测试资源',
        description: '这是测试资源的描述',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        file: {
          path: '/uploads/test.pdf'
        },
        uploader: new mongoose.Types.ObjectId() // 不同于测试用户ID
      };

      // 模拟 Resource.findById 方法
      Resource.findById.mockResolvedValue(mockResource);

      // 发送删除请求
      const response = await request(app)
        .delete(`/api/resources/${testResourceId}`)
        .set('x-user-id', testUserId); // 不是上传者

      // 验证响应
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '没有权限删除此资源');

      // 验证资源没有被删除
      expect(Resource.findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('管理员应该能够删除任何资源', async () => {
      // 模拟资源
      const mockResource = {
        _id: testResourceId,
        title: '测试资源',
        description: '这是测试资源的描述',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        file: {
          path: '/uploads/test.pdf'
        },
        uploader: new mongoose.Types.ObjectId() // 不同于测试用户ID
      };

      // 模拟 Resource.findById 方法
      Resource.findById.mockResolvedValue(mockResource);

      // 模拟文件存在
      fs.existsSync.mockReturnValue(true);

      // 模拟 Resource.findByIdAndDelete 方法
      Resource.findByIdAndDelete.mockResolvedValue(true);

      // 发送删除请求
      const response = await request(app)
        .delete(`/api/resources/${testResourceId}`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'admin'); // 管理员角色

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '资源已删除');

      // 验证文件被删除
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.unlinkSync).toHaveBeenCalled();

      // 验证资源被删除
      expect(Resource.findByIdAndDelete).toHaveBeenCalledWith(testResourceId);
    });
  });
});