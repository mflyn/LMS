const request = require('supertest');
const express = require('express');
const router = require('../../routes/announcements');

// 模拟 Announcement 模型
jest.mock('../../models/Announcement', () => {
  // 创建一个模拟的 Announcement 构造函数
  const mockAnnouncement = jest.fn().mockImplementation(function(data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  });

  // 添加静态方法
  mockAnnouncement.find = jest.fn();
  mockAnnouncement.findById = jest.fn();
  mockAnnouncement.findByIdAndUpdate = jest.fn();
  mockAnnouncement.findByIdAndDelete = jest.fn();
  mockAnnouncement.countDocuments = jest.fn();

  // 创建可重用的模拟链式调用构建器
  const createMockChain = () => {
    const chain = {};

    // 创建一个支持多次 populate 调用的模拟对象
    chain.populate = jest.fn().mockImplementation(() => chain);
    chain.sort = jest.fn().mockImplementation(() => chain);
    chain.skip = jest.fn().mockImplementation(() => chain);
    chain.limit = jest.fn().mockImplementation(() => chain);

    return chain;
  };

  // 默认返回值设置
  mockAnnouncement.countDocuments.mockResolvedValue(0);

  return mockAnnouncement;
});

describe('公告路由测试 - 第一部分', () => {
  let app;

  const Announcement = require('../../models/Announcement');

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/announcements', router);

    // 重置所有模拟函数
    jest.clearAllMocks();
  });

  // 测试获取公告列表
  describe('GET /api/interaction/announcements', () => {
    it('应该成功获取公告列表', async () => {
      // 模拟数据
      const mockAnnouncements = [
        {
          _id: 'announcement-id-1',
          title: '测试公告1',
          content: '测试内容1',
          author: { _id: 'author-id-1', name: '教师1', role: 'teacher' },
          class: { _id: 'class-id-1', name: '一年级一班', grade: '一年级' },
          createdAt: new Date(),
          attachments: []
        },
        {
          _id: 'announcement-id-2',
          title: '测试公告2',
          content: '测试内容2',
          author: { _id: 'author-id-2', name: '教师2', role: 'teacher' },
          class: { _id: 'class-id-1', name: '一年级一班', grade: '一年级' },
          createdAt: new Date(),
          attachments: []
        }
      ];

      // 创建模拟链式调用
      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
      };

      // 设置最终返回值 - 只在第二次调用 populate 后返回结果
      mockChain.populate.mockReturnValueOnce(mockChain).mockReturnValueOnce(mockAnnouncements);

      // 设置模拟函数的返回值
      Announcement.find.mockReturnValue(mockChain);

      // 模拟 countDocuments 方法的返回值
      Announcement.countDocuments.mockResolvedValue(2);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements')
        .query({ limit: 10, skip: 0 });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total', 2);
      expect(response.body.pagination).toHaveProperty('limit', 10);
      expect(response.body.pagination).toHaveProperty('skip', 0);

      // 验证模拟函数被正确调用
      expect(Announcement.find).toHaveBeenCalledWith({});
      expect(mockChain.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockChain.skip).toHaveBeenCalledWith(0);
      expect(mockChain.limit).toHaveBeenCalledWith(10);
      expect(mockChain.populate).toHaveBeenCalledWith('author', 'name role');
      expect(mockChain.populate).toHaveBeenCalledWith('class', 'name grade');
      expect(Announcement.countDocuments).toHaveBeenCalledWith({});
    });

    it('应该支持按班级筛选', async () => {
      // 模拟数据
      const mockAnnouncements = [
        {
          _id: 'announcement-id-1',
          title: '测试公告1',
          content: '测试内容1',
          author: { _id: 'author-id-1', name: '教师1', role: 'teacher' },
          class: { _id: 'class-id-1', name: '一年级一班', grade: '一年级' },
          createdAt: new Date(),
          attachments: []
        }
      ];

      // 创建模拟链式调用
      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
      };

      // 设置最终返回值 - 只在第二次调用 populate 后返回结果
      mockChain.populate.mockReturnValueOnce(mockChain).mockReturnValueOnce(mockAnnouncements);

      // 设置模拟函数的返回值
      Announcement.find.mockReturnValue(mockChain);

      // 模拟 countDocuments 方法的返回值
      Announcement.countDocuments.mockResolvedValue(1);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements')
        .query({ classId: 'class-id-1', limit: 10, skip: 0 });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total', 1);

      // 验证模拟函数被正确调用
      expect(Announcement.find).toHaveBeenCalledWith({ class: 'class-id-1' });
      expect(mockChain.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockChain.skip).toHaveBeenCalledWith(0);
      expect(mockChain.limit).toHaveBeenCalledWith(10);
      expect(mockChain.populate).toHaveBeenCalledWith('author', 'name role');
      expect(mockChain.populate).toHaveBeenCalledWith('class', 'name grade');
      expect(Announcement.countDocuments).toHaveBeenCalledWith({ class: 'class-id-1' });
    });

    it('应该支持按日期范围筛选', async () => {
      // 模拟数据
      const mockAnnouncements = [
        {
          _id: 'announcement-id-1',
          title: '测试公告1',
          content: '测试内容1',
          author: { _id: 'author-id-1', name: '教师1', role: 'teacher' },
          class: { _id: 'class-id-1', name: '一年级一班', grade: '一年级' },
          createdAt: new Date('2023-01-01'),
          attachments: []
        }
      ];

      // 创建模拟链式调用
      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
      };

      // 设置最终返回值 - 只在第二次调用 populate 后返回结果
      mockChain.populate.mockReturnValueOnce(mockChain).mockReturnValueOnce(mockAnnouncements);

      // 设置模拟函数的返回值
      Announcement.find.mockReturnValue(mockChain);

      // 模拟 countDocuments 方法的返回值
      Announcement.countDocuments.mockResolvedValue(1);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements')
        .query({
          startDate: '2023-01-01',
          endDate: '2023-01-31',
          limit: 10,
          skip: 0
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total', 1);

      // 验证模拟函数被正确调用
      expect(Announcement.find).toHaveBeenCalledWith({
        createdAt: {
          $gte: expect.any(Date),
          $lte: expect.any(Date)
        }
      });
      expect(mockChain.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockChain.skip).toHaveBeenCalledWith(0);
      expect(mockChain.limit).toHaveBeenCalledWith(10);
      expect(mockChain.populate).toHaveBeenCalledWith('author', 'name role');
      expect(mockChain.populate).toHaveBeenCalledWith('class', 'name grade');
      expect(Announcement.countDocuments).toHaveBeenCalledWith({
        createdAt: {
          $gte: expect.any(Date),
          $lte: expect.any(Date)
        }
      });
    });

    it('应该处理数据库查询错误', async () => {
      // 模拟 find 方法抛出错误
      Announcement.find.mockImplementation(() => {
        throw new Error('数据库查询错误');
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取公告列表失败');
      expect(response.body).toHaveProperty('error', '数据库查询错误');
    });
  });

  // 测试获取单个公告
  describe('GET /api/interaction/announcements/:id', () => {
    it('应该成功获取单个公告', async () => {
      // 模拟数据
      const mockDate = new Date();
      const mockAnnouncement = {
        _id: 'announcement-id-1',
        title: '测试公告1',
        content: '测试内容1',
        author: { _id: 'author-id-1', name: '教师1', role: 'teacher' },
        class: { _id: 'class-id-1', name: '一年级一班', grade: '一年级' },
        createdAt: mockDate.toISOString(),
        attachments: []
      };

      // 创建模拟链式调用
      const mockChain = {
        populate: jest.fn().mockReturnThis(),
      };

      // 设置最终返回值 - 只在第二次调用 populate 后返回结果
      mockChain.populate.mockReturnValueOnce(mockChain).mockReturnValueOnce(mockAnnouncement);

      // 设置模拟函数的返回值
      Announcement.findById.mockReturnValue(mockChain);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements/announcement-id-1');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAnnouncement);

      // 验证模拟函数被正确调用
      expect(Announcement.findById).toHaveBeenCalledWith('announcement-id-1');
      expect(mockChain.populate).toHaveBeenCalledWith('author', 'name role');
      expect(mockChain.populate).toHaveBeenCalledWith('class', 'name grade');
    });

    it('应该处理公告不存在的情况', async () => {
      // 创建模拟链式调用
      const mockChain = {
        populate: jest.fn().mockReturnThis(),
      };

      // 设置最终返回值 - 只在第二次调用 populate 后返回结果
      mockChain.populate.mockReturnValueOnce(mockChain).mockReturnValueOnce(null);

      // 设置模拟函数的返回值
      Announcement.findById.mockReturnValue(mockChain);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements/non-existent-id');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '公告不存在');

      // 验证模拟函数被正确调用
      expect(Announcement.findById).toHaveBeenCalledWith('non-existent-id');
      expect(mockChain.populate).toHaveBeenCalledWith('author', 'name role');
      expect(mockChain.populate).toHaveBeenCalledWith('class', 'name grade');
    });

    it('应该处理数据库查询错误', async () => {
      // 模拟 findById 方法抛出错误
      Announcement.findById.mockImplementation(() => {
        throw new Error('数据库查询错误');
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements/announcement-id-1');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取公告失败');
      expect(response.body).toHaveProperty('error', '数据库查询错误');
    });
  });
});
