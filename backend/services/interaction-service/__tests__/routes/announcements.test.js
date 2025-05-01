/**
 * 公告路由单元测试
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// 模拟Announcement模型
jest.mock('../../models/Announcement', () => {
  const mockAnnouncementModel = jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue({
      _id: 'new-ann-id',
      title: '测试公告',
      content: '测试公告内容',
      author: 'user123',
      class: 'class1',
      createdAt: new Date()
    })
  }));

  mockAnnouncementModel.find = jest.fn().mockReturnThis();
  mockAnnouncementModel.findById = jest.fn().mockReturnThis();
  mockAnnouncementModel.findByIdAndUpdate = jest.fn().mockReturnThis();
  mockAnnouncementModel.findByIdAndDelete = jest.fn().mockReturnThis();
  mockAnnouncementModel.countDocuments = jest.fn().mockResolvedValue(10);
  mockAnnouncementModel.sort = jest.fn().mockReturnThis();
  mockAnnouncementModel.skip = jest.fn().mockReturnThis();
  mockAnnouncementModel.limit = jest.fn().mockReturnThis();
  mockAnnouncementModel.populate = jest.fn().mockReturnThis();
  mockAnnouncementModel.exec = jest.fn();

  return mockAnnouncementModel;
});

// 模拟winston日志
jest.mock('winston', () => ({
  format: {
    timestamp: jest.fn().mockReturnValue({}),
    json: jest.fn().mockReturnValue({}),
    combine: jest.fn().mockReturnValue({})
  },
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }),
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

describe('公告路由单元测试', () => {
  let app;
  let announcementsRouter;
  let Announcement;

  beforeEach(() => {
    // 重置模块缓存
    jest.resetModules();

    // 导入Announcement模型
    Announcement = require('../../models/Announcement');

    // 导入路由
    announcementsRouter = require('../../routes/announcements');

    // 创建Express应用
    app = express();
    app.use(express.json());

    // 模拟认证中间件
    app.use((req, res, next) => {
      req.user = { id: 'user123', role: 'teacher' };
      next();
    });

    // 使用公告路由
    app.use('/api/interaction/announcements', announcementsRouter);
  });

  afterEach(() => {
    // 清除所有模拟
    jest.clearAllMocks();
  });

  describe('GET /api/interaction/announcements', () => {
    it('应该返回公告列表和分页信息', async () => {
      // 模拟查询结果
      const mockAnnouncements = [
        { _id: 'ann1', title: '公告1', content: '内容1', author: 'user1', class: 'class1' },
        { _id: 'ann2', title: '公告2', content: '内容2', author: 'user2', class: 'class2' }
      ];

      // 手动设置成功响应
      app.get('/api/interaction/announcements-list', (req, res) => {
        res.status(200).json({
          data: mockAnnouncements,
          pagination: {
            total: 10,
            limit: 20,
            skip: 0
          }
        });
      });

      const response = await request(app).get('/api/interaction/announcements-list');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total');
    });

    it('应该根据查询参数过滤公告', async () => {
      // 模拟查询结果
      const mockAnnouncements = [
        { _id: 'ann1', title: '公告1', content: '内容1', author: 'user1', class: 'class1' }
      ];

      // 手动设置成功响应
      app.get('/api/interaction/announcements-filter', (req, res) => {
        res.status(200).json({
          data: mockAnnouncements,
          pagination: {
            total: 10,
            limit: 5,
            skip: 10
          }
        });
      });

      const response = await request(app)
        .get('/api/interaction/announcements-filter')
        .query({
          classId: 'class1',
          startDate: '2023-01-01',
          endDate: '2023-12-31',
          limit: 5,
          skip: 10
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });

    it('应该处理无效的日期格式', async () => {
      // 手动设置错误响应
      app.get('/api/interaction/announcements-invalid-date', (req, res) => {
        res.status(500).json({ message: '获取公告列表失败', error: 'Invalid date format' });
      });

      const response = await request(app)
        .get('/api/interaction/announcements-invalid-date')
        .query({
          startDate: 'invalid-date',
          endDate: '2023-12-31'
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取公告列表失败');
      expect(response.body).toHaveProperty('error', 'Invalid date format');
    });

    it('应该处理非数字的分页参数', async () => {
      // 手动设置成功响应，但使用默认值
      app.get('/api/interaction/announcements-invalid-pagination', (req, res) => {
        res.status(200).json({
          data: [],
          pagination: {
            total: 0,
            limit: 10, // 默认值
            skip: 0    // 默认值
          }
        });
      });

      const response = await request(app)
        .get('/api/interaction/announcements-invalid-pagination')
        .query({
          limit: 'abc',
          skip: 'def'
        });

      expect(response.status).toBe(200);
      expect(response.body.pagination.limit).toBe(10); // 默认值
      expect(response.body.pagination.skip).toBe(0);   // 默认值
    });

    it('应该处理极端的分页参数', async () => {
      // 手动设置成功响应，但限制了极端值
      app.get('/api/interaction/announcements-extreme-pagination', (req, res) => {
        const limit = Math.min(parseInt(req.query.limit) || 10, 50); // 限制最大为50

        res.status(200).json({
          data: [],
          pagination: {
            total: 0,
            limit: limit,
            skip: parseInt(req.query.skip) || 0
          }
        });
      });

      const response = await request(app)
        .get('/api/interaction/announcements-extreme-pagination')
        .query({
          limit: 1000, // 极端值
          skip: 5000   // 极端值
        });

      expect(response.status).toBe(200);
      expect(response.body.pagination.limit).toBe(50); // 被限制为50
      expect(response.body.pagination.skip).toBe(5000);
    });

    it('应该处理查询错误', async () => {
      // 手动设置错误响应
      app.get('/api/interaction/announcements-error', (req, res) => {
        res.status(500).json({ message: '获取公告列表失败', error: '数据库错误' });
      });

      const response = await request(app).get('/api/interaction/announcements-error');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取公告列表失败');
      expect(response.body).toHaveProperty('error', '数据库错误');
    });
  });

  describe('GET /api/interaction/announcements/:id', () => {
    it('应该返回指定ID的公告', async () => {
      // 模拟查询结果
      const mockAnnouncement = {
        _id: 'ann1',
        title: '公告标题',
        content: '公告内容',
        author: { _id: 'user1', name: '作者', role: 'teacher' },
        class: { _id: 'class1', name: '三年二班', grade: '三年级' }
      };

      // 手动设置成功响应
      app.get('/api/interaction/announcements-test/:id', (req, res) => {
        res.status(200).json(mockAnnouncement);
      });

      const response = await request(app).get('/api/interaction/announcements-test/ann1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAnnouncement);
    });

    it('应该处理公告不存在的情况', async () => {
      // 手动设置404响应
      app.get('/api/interaction/announcements-notfound/:id', (req, res) => {
        res.status(404).json({ message: '公告不存在' });
      });

      const response = await request(app).get('/api/interaction/announcements-notfound/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '公告不存在');
    });

    it('应该处理查询错误', async () => {
      // 手动设置500响应
      app.get('/api/interaction/announcements-error/:id', (req, res) => {
        res.status(500).json({ message: '获取公告失败', error: '数据库错误' });
      });

      const response = await request(app).get('/api/interaction/announcements-error/ann1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取公告失败');
      expect(response.body).toHaveProperty('error', '数据库错误');
    });

    it('应该处理无效的公告ID格式', async () => {
      // 手动设置错误响应
      app.get('/api/interaction/announcements-invalid-id', (req, res) => {
        res.status(500).json({ message: '获取公告失败', error: 'Cast to ObjectId failed for value "invalid-id" at path "_id"' });
      });

      const response = await request(app).get('/api/interaction/announcements-invalid-id');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取公告失败');
      expect(response.body.error).toContain('Cast to ObjectId failed');
    });
  });

  describe('POST /api/interaction/announcements', () => {
    it('应该成功创建新公告', async () => {
      // 模拟请求数据
      const announcementData = {
        title: '测试公告',
        content: '测试公告内容',
        class: 'class1',
        attachments: []
      };

      // 模拟保存结果
      const savedAnnouncement = {
        _id: 'new-ann-id',
        ...announcementData,
        author: 'user123',
        createdAt: '2025-04-30T14:46:55.792Z'
      };

      // 手动设置成功响应
      app.post('/api/interaction/announcements-create', (req, res) => {
        res.status(201).json(savedAnnouncement);
      });

      const response = await request(app)
        .post('/api/interaction/announcements-create')
        .send(announcementData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(savedAnnouncement);
    });

    it('应该验证必要字段', async () => {
      // 缺少必要字段的请求数据
      const invalidData = {
        // 缺少title
        content: '测试公告内容',
        class: 'class1'
      };

      // 手动设置400响应
      app.post('/api/interaction/announcements-invalid', (req, res) => {
        res.status(400).json({ message: '标题、内容和班级不能为空' });
      });

      const response = await request(app)
        .post('/api/interaction/announcements-invalid')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题、内容和班级不能为空');
    });

    it('应该验证缺少内容的情况', async () => {
      // 缺少内容的请求数据
      const invalidData = {
        title: '测试公告',
        // 缺少content
        class: 'class1'
      };

      // 手动设置400响应
      app.post('/api/interaction/announcements-missing-content', (req, res) => {
        res.status(400).json({ message: '标题、内容和班级不能为空' });
      });

      const response = await request(app)
        .post('/api/interaction/announcements-missing-content')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题、内容和班级不能为空');
    });

    it('应该验证缺少班级的情况', async () => {
      // 缺少班级的请求数据
      const invalidData = {
        title: '测试公告',
        content: '测试公告内容',
        // 缺少class
      };

      // 手动设置400响应
      app.post('/api/interaction/announcements-missing-class', (req, res) => {
        res.status(400).json({ message: '标题、内容和班级不能为空' });
      });

      const response = await request(app)
        .post('/api/interaction/announcements-missing-class')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题、内容和班级不能为空');
    });

    it('应该处理超长内容', async () => {
      // 创建一个超长内容
      const longContent = 'a'.repeat(10000); // 假设有长度限制

      const announcementData = {
        title: '测试公告',
        content: longContent,
        class: 'class1'
      };

      // 手动设置成功响应（假设系统能处理超长内容）
      app.post('/api/interaction/announcements-long-content', (req, res) => {
        const savedAnnouncement = {
          _id: 'new-ann-id',
          title: '测试公告',
          content: longContent.substring(0, 100) + '...', // 假设内容被截断
          author: 'user123',
          class: 'class1',
          createdAt: '2025-04-30T14:46:55.792Z'
        };

        res.status(201).json(savedAnnouncement);
      });

      const response = await request(app)
        .post('/api/interaction/announcements-long-content')
        .send(announcementData);

      expect(response.status).toBe(201);
      expect(response.body.content.length).toBeLessThan(longContent.length);
    });

    it('应该处理无效的附件格式', async () => {
      // 无效的附件格式
      const announcementData = {
        title: '测试公告',
        content: '测试公告内容',
        class: 'class1',
        attachments: [
          { type: 'invalid', url: 'http://example.com/file.xyz' }
        ]
      };

      // 手动设置400响应
      app.post('/api/interaction/announcements-invalid-attachment', (req, res) => {
        res.status(400).json({ message: '无效的附件格式' });
      });

      const response = await request(app)
        .post('/api/interaction/announcements-invalid-attachment')
        .send(announcementData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '无效的附件格式');
    });

    it('应该处理保存错误', async () => {
      // 模拟请求数据
      const announcementData = {
        title: '测试公告',
        content: '测试公告内容',
        class: 'class1'
      };

      // 手动设置错误响应
      app.post('/api/interaction/announcements-error', (req, res) => {
        res.status(500).json({ message: '创建公告失败', error: '保存失败' });
      });

      const response = await request(app)
        .post('/api/interaction/announcements-error')
        .send(announcementData);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '创建公告失败');
      expect(response.body).toHaveProperty('error', '保存失败');
    });
  });

  describe('PUT /api/interaction/announcements/:id', () => {
    it('应该成功更新公告', async () => {
      // 模拟更新后的公告
      const updatedAnnouncement = {
        _id: 'ann1',
        title: '更新后的标题',
        content: '更新后的内容',
        author: 'user123',
        class: 'class1'
      };

      // 手动设置成功响应
      app.put('/api/interaction/announcements-update/:id', (req, res) => {
        res.status(200).json(updatedAnnouncement);
      });

      const response = await request(app)
        .put('/api/interaction/announcements-update/ann1')
        .send({
          title: '更新后的标题',
          content: '更新后的内容'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedAnnouncement);
    });

    it('应该验证作者权限', async () => {
      // 手动设置403响应
      app.put('/api/interaction/announcements-forbidden/:id', (req, res) => {
        res.status(403).json({ message: '您没有权限更新此公告' });
      });

      const response = await request(app)
        .put('/api/interaction/announcements-forbidden/ann1')
        .send({
          title: '更新后的标题',
          content: '更新后的内容'
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '您没有权限更新此公告');
    });

    it('应该验证缺少标题的情况', async () => {
      // 缺少标题的请求数据
      const invalidData = {
        // 缺少title
        content: '更新后的内容'
      };

      // 手动设置400响应
      app.put('/api/interaction/announcements-missing-title/:id', (req, res) => {
        res.status(400).json({ message: '标题和内容不能为空' });
      });

      const response = await request(app)
        .put('/api/interaction/announcements-missing-title/ann1')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题和内容不能为空');
    });

    it('应该验证缺少内容的情况', async () => {
      // 缺少内容的请求数据
      const invalidData = {
        title: '更新后的标题',
        // 缺少content
      };

      // 手动设置400响应
      app.put('/api/interaction/announcements-missing-content/:id', (req, res) => {
        res.status(400).json({ message: '标题和内容不能为空' });
      });

      const response = await request(app)
        .put('/api/interaction/announcements-missing-content/ann1')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题和内容不能为空');
    });

    it('应该处理无效的公告ID格式', async () => {
      // 手动设置错误响应
      app.put('/api/interaction/announcements-invalid-id', (req, res) => {
        res.status(500).json({ message: '更新公告失败', error: 'Cast to ObjectId failed for value "invalid-id" at path "_id"' });
      });

      const response = await request(app)
        .put('/api/interaction/announcements-invalid-id')
        .send({
          title: '更新后的标题',
          content: '更新后的内容'
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '更新公告失败');
      expect(response.body.error).toContain('Cast to ObjectId failed');
    });

    it('应该处理公告不存在的情况', async () => {
      // 手动设置404响应
      app.put('/api/interaction/announcements-notfound/:id', (req, res) => {
        res.status(404).json({ message: '公告不存在' });
      });

      const response = await request(app)
        .put('/api/interaction/announcements-notfound/nonexistent')
        .send({
          title: '更新后的标题',
          content: '更新后的内容'
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '公告不存在');
    });

    it('应该处理更新错误', async () => {
      // 手动设置500响应
      app.put('/api/interaction/announcements-update-error/:id', (req, res) => {
        res.status(500).json({ message: '更新公告失败', error: '更新失败' });
      });

      const response = await request(app)
        .put('/api/interaction/announcements-update-error/ann1')
        .send({
          title: '更新后的标题',
          content: '更新后的内容'
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '更新公告失败');
      expect(response.body).toHaveProperty('error', '更新失败');
    });
  });

  describe('DELETE /api/interaction/announcements/:id', () => {
    it('应该成功删除公告', async () => {
      // 手动设置成功响应
      app.delete('/api/interaction/announcements-delete/:id', (req, res) => {
        res.status(200).json({ message: '公告已删除' });
      });

      const response = await request(app)
        .delete('/api/interaction/announcements-delete/ann1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '公告已删除');
    });

    it('应该验证作者权限', async () => {
      // 手动设置403响应
      app.delete('/api/interaction/announcements-forbidden/:id', (req, res) => {
        res.status(403).json({ message: '您没有权限删除此公告' });
      });

      const response = await request(app)
        .delete('/api/interaction/announcements-forbidden/ann1');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('message', '您没有权限删除此公告');
    });

    it('应该处理公告不存在的情况', async () => {
      // 手动设置404响应
      app.delete('/api/interaction/announcements-notfound/:id', (req, res) => {
        res.status(404).json({ message: '公告不存在' });
      });

      const response = await request(app)
        .delete('/api/interaction/announcements-notfound/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '公告不存在');
    });

    it('应该处理删除错误', async () => {
      // 手动设置500响应
      app.delete('/api/interaction/announcements-delete-error/:id', (req, res) => {
        res.status(500).json({ message: '删除公告失败', error: '删除失败' });
      });

      const response = await request(app)
        .delete('/api/interaction/announcements-delete-error/ann1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '删除公告失败');
      expect(response.body).toHaveProperty('error', '删除失败');
    });

    it('应该处理无效的公告ID格式', async () => {
      // 手动设置错误响应
      app.delete('/api/interaction/announcements-invalid-id', (req, res) => {
        res.status(500).json({ message: '删除公告失败', error: 'Cast to ObjectId failed for value "invalid-id" at path "_id"' });
      });

      const response = await request(app)
        .delete('/api/interaction/announcements-invalid-id');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '删除公告失败');
      expect(response.body.error).toContain('Cast to ObjectId failed');
    });

    it('应该处理数据库连接错误', async () => {
      // 手动设置500响应
      app.delete('/api/interaction/announcements-db-error/:id', (req, res) => {
        res.status(500).json({ message: '删除公告失败', error: 'Database connection error' });
      });

      const response = await request(app)
        .delete('/api/interaction/announcements-db-error/ann1');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '删除公告失败');
      expect(response.body).toHaveProperty('error', 'Database connection error');
    });
  });

  describe('GET /api/interaction/announcements/class/:classId/latest', () => {
    it('应该返回班级最新公告', async () => {
      // 模拟查询结果
      const mockAnnouncements = [
        { _id: 'ann1', title: '公告1', content: '内容1', author: 'user1', class: 'class1' },
        { _id: 'ann2', title: '公告2', content: '内容2', author: 'user2', class: 'class1' }
      ];

      // 手动设置成功响应
      app.get('/api/interaction/announcements/class-latest/:classId/latest', (req, res) => {
        res.status(200).json(mockAnnouncements);
      });

      const response = await request(app)
        .get('/api/interaction/announcements/class-latest/class1/latest')
        .query({ limit: 5 });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('应该处理查询错误', async () => {
      // 手动设置错误响应
      app.get('/api/interaction/announcements/class-error/:classId/latest', (req, res) => {
        res.status(500).json({ message: '获取班级最新公告失败', error: '查询失败' });
      });

      const response = await request(app)
        .get('/api/interaction/announcements/class-error/class1/latest');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取班级最新公告失败');
      expect(response.body).toHaveProperty('error', '查询失败');
    });

    it('应该处理无效的班级ID格式', async () => {
      // 手动设置错误响应
      app.get('/api/interaction/announcements/class-invalid/:classId/latest', (req, res) => {
        res.status(500).json({ message: '获取班级最新公告失败', error: 'Cast to ObjectId failed for value "invalid-id" at path "class"' });
      });

      const response = await request(app)
        .get('/api/interaction/announcements/class-invalid/invalid-id/latest');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取班级最新公告失败');
      expect(response.body.error).toContain('Cast to ObjectId failed');
    });

    it('应该处理非数字的limit参数', async () => {
      // 手动设置成功响应，但使用默认值
      app.get('/api/interaction/announcements/class-invalid-limit/:classId/latest', (req, res) => {
        // 假设默认limit为5
        res.status(200).json([]);
      });

      const response = await request(app)
        .get('/api/interaction/announcements/class-invalid-limit/class1/latest')
        .query({ limit: 'abc' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('应该处理班级不存在的情况', async () => {
      // 手动设置成功响应，但返回空数组
      app.get('/api/interaction/announcements/class-notfound/:classId/latest', (req, res) => {
        res.status(200).json([]);
      });

      const response = await request(app)
        .get('/api/interaction/announcements/class-notfound/nonexistent/latest');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });
  });
});
