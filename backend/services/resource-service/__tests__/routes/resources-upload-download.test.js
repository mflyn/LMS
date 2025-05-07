const request = require('supertest');
const mongoose = require('mongoose');
const express = require('express');
const path = require('path');
const fs = require('fs');
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

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

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

describe('Resources 路由上传下载测试', () => {
  const testUserId = new mongoose.Types.ObjectId().toString();
  const testResourceId = new mongoose.Types.ObjectId().toString();
  
  // 创建一个临时测试文件
  const testFilePath = path.join(uploadDir, 'test-file.txt');
  
  beforeAll(() => {
    // 创建测试文件
    fs.writeFileSync(testFilePath, 'This is a test file content');
  });
  
  afterAll(() => {
    // 清理测试文件
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/resources', () => {
    it('应该成功上传资源文件', async () => {
      // 模拟 Resource 实例
      const mockResource = {
        _id: testResourceId,
        title: '测试资源',
        description: '这是一个测试资源',
        subject: '数学',
        grade: '三年级',
        type: '习题',
        tags: ['测试', '数学'],
        file: {
          name: 'test-file.txt',
          path: '/uploads/test-file.txt',
          type: 'text/plain',
          size: 28
        },
        uploader: testUserId,
        downloads: 0,
        save: jest.fn().mockResolvedValue(true)
      };

      // 模拟 Resource 构造函数
      Resource.mockImplementation(() => mockResource);

      // 发送请求
      const response = await request(app)
        .post('/api/resources')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'teacher')
        .field('title', '测试资源')
        .field('description', '这是一个测试资源')
        .field('subject', '数学')
        .field('grade', '三年级')
        .field('type', '习题')
        .field('tags', '测试,数学')
        .field('uploaderId', testUserId)
        .attach('file', testFilePath);

      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('title', '测试资源');
      expect(response.body).toHaveProperty('subject', '数学');
      expect(response.body).toHaveProperty('file');
      expect(response.body.file).toHaveProperty('name', 'test-file.txt');
      expect(mockResource.save).toHaveBeenCalled();
    });

    it('应该处理缺少必要字段的情况', async () => {
      // 发送请求，缺少必要字段
      const response = await request(app)
        .post('/api/resources')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'teacher')
        .field('title', '测试资源')
        .field('uploaderId', testUserId)
        .attach('file', testFilePath);

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题、学科、年级和类型不能为空');
    });

    it('应该处理缺少文件的情况', async () => {
      // 发送请求，不上传文件
      const response = await request(app)
        .post('/api/resources')
        .set('x-user-id', testUserId)
        .set('x-user-role', 'teacher')
        .field('title', '测试资源')
        .field('description', '这是一个测试资源')
        .field('subject', '数学')
        .field('grade', '三年级')
        .field('type', '习题')
        .field('uploaderId', testUserId);

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '请上传文件');
    });
  });

  describe('GET /api/resources/:id/download', () => {
    it('应该成功下载资源文件', async () => {
      // 模拟 Resource.findById 方法
      Resource.findById.mockResolvedValue({
        _id: testResourceId,
        title: '测试资源',
        file: {
          name: 'test-file.txt',
          path: '/uploads/test-file.txt',
          type: 'text/plain',
          size: 28
        },
        downloads: 0,
        save: jest.fn().mockResolvedValue(true)
      });

      // 发送请求
      const response = await request(app)
        .get(`/api/resources/${testResourceId}/download`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.header['content-type']).toBe('text/plain');
      expect(response.header['content-disposition']).toContain('attachment; filename="test-file.txt"');
    });

    it('应该处理资源不存在的情况', async () => {
      // 模拟 Resource.findById 方法返回 null
      Resource.findById.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .get(`/api/resources/${testResourceId}/download`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '资源不存在');
    });

    it('应该处理文件不存在的情况', async () => {
      // 模拟 Resource.findById 方法
      Resource.findById.mockResolvedValue({
        _id: testResourceId,
        title: '测试资源',
        file: {
          name: 'non-existent-file.txt',
          path: '/uploads/non-existent-file.txt',
          type: 'text/plain',
          size: 28
        },
        downloads: 0,
        save: jest.fn().mockResolvedValue(true)
      });

      // 发送请求
      const response = await request(app)
        .get(`/api/resources/${testResourceId}/download`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '文件不存在');
    });

    it('应该增加资源的下载次数', async () => {
      // 模拟 Resource.findById 方法
      const mockResource = {
        _id: testResourceId,
        title: '测试资源',
        file: {
          name: 'test-file.txt',
          path: '/uploads/test-file.txt',
          type: 'text/plain',
          size: 28
        },
        downloads: 5,
        save: jest.fn().mockResolvedValue(true)
      };

      Resource.findById.mockResolvedValue(mockResource);

      // 发送请求
      await request(app)
        .get(`/api/resources/${testResourceId}/download`)
        .set('x-user-id', testUserId)
        .set('x-user-role', 'student');

      // 验证下载次数增加
      expect(mockResource.downloads).toBe(6);
      expect(mockResource.save).toHaveBeenCalled();
    });
  });
});
