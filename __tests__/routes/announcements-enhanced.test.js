/**
 * 公告路由增强单元测试
 * 专注于提高测试覆盖率
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

// 创建模拟对象
const Announcement = {
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  countDocuments: jest.fn()
};

// 模拟模块
jest.mock('../../models/Announcement', () => Announcement, { virtual: true });

// 模拟winston日志
jest.mock('winston', () => ({
  format: {
    timestamp: jest.fn().mockReturnValue({}),
    json: jest.fn().mockReturnValue({}),
    combine: jest.fn().mockReturnValue({})
  },
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn()
  }),
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

describe('公告路由增强单元测试', () => {
  let app;
  let router;

  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();

    // 创建Express应用
    app = express();
    app.use(express.json());

    // 模拟认证中间件
    app.use((req, res, next) => {
      req.user = { id: 'test-user-id', name: 'Test User', role: 'teacher' };
      next();
    });

    // 导入路由
    router = require('../../routes/announcements');
    app.use('/api/interaction/announcements', router);

    // 设置模拟返回值
    const mockAnnouncements = [
      {
        _id: 'ann-id-1',
        title: '公告1',
        content: '公告内容1',
        author: { _id: 'user1', name: '教师1', role: 'teacher' },
        class: { _id: 'class1', name: '一年级一班', grade: '一年级' },
        createdAt: new Date('2023-01-01')
      },
      {
        _id: 'ann-id-2',
        title: '公告2',
        content: '公告内容2',
        author: { _id: 'user2', name: '教师2', role: 'teacher' },
        class: { _id: 'class2', name: '一年级二班', grade: '一年级' },
        createdAt: new Date('2023-01-02')
      }
    ];

    // 设置模拟方法
    Announcement.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(mockAnnouncements)
    });

    Announcement.countDocuments.mockResolvedValue(2);

    Announcement.findById.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(mockAnnouncements[0])
    });

    Announcement.findByIdAndUpdate.mockResolvedValue(mockAnnouncements[0]);
    Announcement.findByIdAndDelete.mockResolvedValue(mockAnnouncements[0]);

    // 模拟Announcement构造函数
    Announcement.mockImplementation(() => ({
      save: jest.fn().mockResolvedValue({
        _id: 'new-ann-id',
        title: '新公告',
        content: '新公告内容',
        author: 'test-user-id',
        class: 'class1',
        createdAt: new Date()
      })
    }));
  });

  describe('GET /api/interaction/announcements', () => {
    it('应该处理无效的日期格式', async () => {
      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements')
        .query({
          startDate: 'invalid-date',
          endDate: 'invalid-date'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取公告列表失败');
    });

    it('应该处理数据库查询错误', async () => {
      // 模拟数据库查询错误
      Announcement.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('数据库查询错误'))
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取公告列表失败');
      expect(response.body).toHaveProperty('error', '数据库查询错误');
    });

    it('应该处理计数错误', async () => {
      // 模拟计数错误
      Announcement.countDocuments.mockRejectedValue(new Error('计数错误'));

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取公告列表失败');
      expect(response.body).toHaveProperty('error', '计数错误');
    });
  });

  describe('GET /api/interaction/announcements/:id', () => {
    it('应该处理无效的ID格式', async () => {
      // 模拟mongoose.Types.ObjectId.isValid
      mongoose.Types.ObjectId = { isValid: jest.fn().mockReturnValue(false) };

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements/invalid-id');

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '无效的公告ID');
    });

    it('应该处理数据库查询错误', async () => {
      // 模拟mongoose.Types.ObjectId.isValid
      mongoose.Types.ObjectId = { isValid: jest.fn().mockReturnValue(true) };

      // 模拟数据库查询错误
      Announcement.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('数据库查询错误'))
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements/valid-id');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取公告失败');
      expect(response.body).toHaveProperty('error', '数据库查询错误');
    });
  });

  describe('POST /api/interaction/announcements', () => {
    it('应该处理保存错误', async () => {
      // 模拟保存错误
      Announcement.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(new Error('保存错误'))
      }));

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/announcements')
        .send({
          title: '新公告',
          content: '新公告内容',
          class: 'class1'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '创建公告失败');
      expect(response.body).toHaveProperty('error', '保存错误');
    });

    it('应该验证标题长度', async () => {
      // 发送请求（标题过长）
      const response = await request(app)
        .post('/api/interaction/announcements')
        .send({
          title: 'a'.repeat(101), // 超过100个字符
          content: '新公告内容',
          class: 'class1'
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题不能超过100个字符');
    });

    it('应该验证内容长度', async () => {
      // 发送请求（内容过长）
      const response = await request(app)
        .post('/api/interaction/announcements')
        .send({
          title: '新公告',
          content: 'a'.repeat(5001), // 超过5000个字符
          class: 'class1'
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '内容不能超过5000个字符');
    });
  });

  describe('PUT /api/interaction/announcements/:id', () => {
    it('应该处理无效的ID格式', async () => {
      // 模拟mongoose.Types.ObjectId.isValid
      mongoose.Types.ObjectId = { isValid: jest.fn().mockReturnValue(false) };

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/announcements/invalid-id')
        .send({
          title: '更新的公告',
          content: '更新的公告内容'
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '无效的公告ID');
    });

    it('应该处理更新错误', async () => {
      // 模拟mongoose.Types.ObjectId.isValid
      mongoose.Types.ObjectId = { isValid: jest.fn().mockReturnValue(true) };

      // 模拟更新错误
      Announcement.findByIdAndUpdate.mockRejectedValue(new Error('更新错误'));

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/announcements/valid-id')
        .send({
          title: '更新的公告',
          content: '更新的公告内容'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '更新公告失败');
      expect(response.body).toHaveProperty('error', '更新错误');
    });

    it('应该验证标题长度', async () => {
      // 模拟mongoose.Types.ObjectId.isValid
      mongoose.Types.ObjectId = { isValid: jest.fn().mockReturnValue(true) };

      // 发送请求（标题过长）
      const response = await request(app)
        .put('/api/interaction/announcements/valid-id')
        .send({
          title: 'a'.repeat(101), // 超过100个字符
          content: '更新的公告内容'
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题不能超过100个字符');
    });

    it('应该验证内容长度', async () => {
      // 模拟mongoose.Types.ObjectId.isValid
      mongoose.Types.ObjectId = { isValid: jest.fn().mockReturnValue(true) };

      // 发送请求（内容过长）
      const response = await request(app)
        .put('/api/interaction/announcements/valid-id')
        .send({
          title: '更新的公告',
          content: 'a'.repeat(5001) // 超过5000个字符
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '内容不能超过5000个字符');
    });
  });

  describe('DELETE /api/interaction/announcements/:id', () => {
    it('应该处理无效的ID格式', async () => {
      // 模拟mongoose.Types.ObjectId.isValid
      mongoose.Types.ObjectId = { isValid: jest.fn().mockReturnValue(false) };

      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/announcements/invalid-id');

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '无效的公告ID');
    });

    it('应该处理删除错误', async () => {
      // 模拟mongoose.Types.ObjectId.isValid
      mongoose.Types.ObjectId = { isValid: jest.fn().mockReturnValue(true) };

      // 模拟删除错误
      Announcement.findByIdAndDelete.mockRejectedValue(new Error('删除错误'));

      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/announcements/valid-id');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '删除公告失败');
      expect(response.body).toHaveProperty('error', '删除错误');
    });
  });

  describe('GET /api/interaction/announcements/class/:classId/latest', () => {
    it('应该返回班级最新公告', async () => {
      // 模拟Announcement.find
      Announcement.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([{
          _id: 'ann-id-1',
          title: '最新公告',
          content: '最新公告内容',
          author: { _id: 'user1', name: '教师1', role: 'teacher' },
          class: { _id: 'class1', name: '一年级一班', grade: '一年级' },
          createdAt: new Date()
        }])
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements/class/class1/latest');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty('title', '最新公告');
    });

    it('应该处理查询错误', async () => {
      // 模拟查询错误
      Announcement.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('查询错误'))
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements/class/class1/latest');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取班级最新公告失败');
      expect(response.body).toHaveProperty('error', '查询错误');
    });
  });
});
