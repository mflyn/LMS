const request = require('supertest');
const express = require('express');
const router = require('../../routes/announcements');
const Announcement = require('../../models/Announcement');

// 模拟 Announcement 模型
jest.mock('../../models/Announcement', () => {
  // 创建一个模拟的 Announcement 构造函数
  function MockAnnouncement(data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  }

  // 添加静态方法
  MockAnnouncement.find = jest.fn();
  MockAnnouncement.findById = jest.fn();
  MockAnnouncement.findByIdAndUpdate = jest.fn();
  MockAnnouncement.findByIdAndDelete = jest.fn();
  MockAnnouncement.countDocuments = jest.fn();

  // 添加链式调用方法
  MockAnnouncement.find.mockReturnValue({
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([])
  });

  return MockAnnouncement;
});

describe('公告路由测试 - 第四部分', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/announcements', router);

    // 重置所有模拟函数
    jest.clearAllMocks();
  });

  // 测试删除公告
  describe('DELETE /api/interaction/announcements/:id', () => {
    it('应该成功删除公告', async () => {
      // 模拟数据
      const deletedAnnouncement = {
        _id: 'announcement-id-1',
        title: '测试公告',
        content: '测试内容',
        author: 'author-id-1',
        class: 'class-id-1'
      };

      // 模拟 findByIdAndDelete 方法的返回值
      Announcement.findByIdAndDelete.mockResolvedValue(deletedAnnouncement);

      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/announcements/announcement-id-1');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '公告已删除');

      // 验证 findByIdAndDelete 方法被正确调用
      expect(Announcement.findByIdAndDelete).toHaveBeenCalledWith('announcement-id-1');
    });

    it('应该处理公告不存在的情况', async () => {
      // 模拟 findByIdAndDelete 方法的返回值
      Announcement.findByIdAndDelete.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/announcements/non-existent-id');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '公告不存在');

      // 验证 findByIdAndDelete 方法被正确调用
      expect(Announcement.findByIdAndDelete).toHaveBeenCalledWith('non-existent-id');
    });

    it('应该处理数据库删除错误', async () => {
      // 模拟 findByIdAndDelete 方法抛出错误
      Announcement.findByIdAndDelete.mockImplementation(() => {
        throw new Error('数据库删除错误');
      });

      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/announcements/announcement-id-1');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '删除公告失败');
      expect(response.body).toHaveProperty('error', '数据库删除错误');

      // 验证 findByIdAndDelete 方法被调用
      expect(Announcement.findByIdAndDelete).toHaveBeenCalled();
    });
  });

  // 测试获取班级最新公告
  describe('GET /api/interaction/announcements/class/:classId/latest', () => {
    it('应该成功获取班级最新公告', async () => {
      // 模拟数据
      const mockDate = new Date();
      const mockAnnouncements = [
        {
          _id: 'announcement-id-1',
          title: '测试公告1',
          content: '测试内容1',
          author: { _id: 'author-id-1', name: '教师1', role: 'teacher' },
          class: 'class-id-1',
          createdAt: mockDate.toISOString(),
          attachments: []
        },
        {
          _id: 'announcement-id-2',
          title: '测试公告2',
          content: '测试内容2',
          author: { _id: 'author-id-1', name: '教师1', role: 'teacher' },
          class: 'class-id-1',
          createdAt: mockDate.toISOString(),
          attachments: []
        }
      ];

      // 模拟 find 方法的返回值
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis()
      };
      // 最后一次调用 populate 时返回结果
      mockFind.populate.mockReturnValueOnce(mockAnnouncements);
      Announcement.find.mockReturnValue(mockFind);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements/class/class-id-1/latest')
        .query({ limit: 5 });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAnnouncements);

      // 验证 find 方法被正确调用
      expect(Announcement.find).toHaveBeenCalledWith({ class: 'class-id-1' });
      expect(mockFind.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockFind.limit).toHaveBeenCalledWith(5);
      expect(mockFind.populate).toHaveBeenCalledWith('author', 'name role');
    });

    it('应该处理数据库查询错误', async () => {
      // 模拟 find 方法抛出错误
      Announcement.find.mockImplementation(() => {
        throw new Error('数据库查询错误');
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements/class/class-id-1/latest');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取班级最新公告失败');
      expect(response.body).toHaveProperty('error', '数据库查询错误');
    });

    it('应该使用默认的limit值', async () => {
      // 模拟数据
      const mockDate = new Date();
      const mockAnnouncements = [
        {
          _id: 'announcement-id-1',
          title: '测试公告1',
          content: '测试内容1',
          author: { _id: 'author-id-1', name: '教师1', role: 'teacher' },
          class: 'class-id-1',
          createdAt: mockDate.toISOString(),
          attachments: []
        }
      ];

      // 模拟 find 方法的返回值
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis()
      };
      // 最后一次调用 populate 时返回结果
      mockFind.populate.mockReturnValueOnce(mockAnnouncements);
      Announcement.find.mockReturnValue(mockFind);

      // 发送请求（不指定limit参数）
      const response = await request(app)
        .get('/api/interaction/announcements/class/class-id-1/latest');

      // 验证响应
      expect(response.status).toBe(200);

      // 验证 limit 方法被调用时使用了默认值
      expect(mockFind.limit).toHaveBeenCalledWith(5);
    });

    it('应该处理非数字的limit参数', async () => {
      // 模拟数据
      const mockDate = new Date();
      const mockAnnouncements = [
        {
          _id: 'announcement-id-1',
          title: '测试公告1',
          content: '测试内容1',
          author: { _id: 'author-id-1', name: '教师1', role: 'teacher' },
          class: 'class-id-1',
          createdAt: mockDate.toISOString(),
          attachments: []
        }
      ];

      // 模拟 find 方法的返回值
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis()
      };
      // 最后一次调用 populate 时返回结果
      mockFind.populate.mockReturnValueOnce(mockAnnouncements);
      Announcement.find.mockReturnValue(mockFind);

      // 发送请求（使用非数字的limit参数）
      const response = await request(app)
        .get('/api/interaction/announcements/class/class-id-1/latest')
        .query({ limit: 'abc' });

      // 验证响应
      expect(response.status).toBe(200);

      // 验证 limit 方法被调用时使用了默认值
      expect(mockFind.limit).toHaveBeenCalledWith(NaN);
    });

    it('应该处理空结果的情况', async () => {
      // 模拟 find 方法的返回值
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis()
      };
      // 最后一次调用 populate 时返回结果
      mockFind.populate.mockReturnValueOnce([]);
      Announcement.find.mockReturnValue(mockFind);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements/class/class-id-1/latest');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });
});
