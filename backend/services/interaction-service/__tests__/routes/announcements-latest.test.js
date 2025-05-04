const request = require('supertest');
const express = require('express');
const router = require('../../routes/announcements');

// 模拟 Announcement 模型
jest.mock('../../models/Announcement', () => {
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

  return mockAnnouncement;
});

describe('公告路由测试 - 获取班级最新公告', () => {
  let app;
  const Announcement = require('../../models/Announcement');

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/announcements', router);

    // 重置所有模拟函数
    jest.clearAllMocks();
  });

  // 测试获取班级最新公告
  describe('GET /api/interaction/announcements/class/:classId/latest', () => {
    it('应该成功获取班级最新公告', async () => {
      // 模拟数据
      const mockAnnouncements = [
        {
          _id: 'announcement-id-1',
          title: '测试公告1',
          content: '测试内容1',
          author: { _id: 'author-id-1', name: '教师1', role: 'teacher' },
          class: 'class-id-1',
          createdAt: new Date(),
          attachments: []
        },
        {
          _id: 'announcement-id-2',
          title: '测试公告2',
          content: '测试内容2',
          author: { _id: 'author-id-1', name: '教师1', role: 'teacher' },
          class: 'class-id-1',
          createdAt: new Date(),
          attachments: []
        }
      ];

      // 创建模拟链式调用
      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnValue(mockAnnouncements)
      };

      // 设置模拟函数的返回值
      Announcement.find.mockReturnValue(mockChain);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements/class/class-id-1/latest')
        .query({ limit: 5 });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('_id', 'announcement-id-1');
      expect(response.body[1]).toHaveProperty('_id', 'announcement-id-2');

      // 验证模拟函数被正确调用
      expect(Announcement.find).toHaveBeenCalledWith({ class: 'class-id-1' });
      expect(mockChain.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockChain.limit).toHaveBeenCalledWith(5);
      expect(mockChain.populate).toHaveBeenCalledWith('author', 'name role');
    });

    it('应该使用默认的limit值', async () => {
      // 模拟数据
      const mockAnnouncements = [
        {
          _id: 'announcement-id-1',
          title: '测试公告1',
          content: '测试内容1',
          author: { _id: 'author-id-1', name: '教师1', role: 'teacher' },
          class: 'class-id-1',
          createdAt: new Date(),
          attachments: []
        }
      ];

      // 创建模拟链式调用
      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnValue(mockAnnouncements)
      };

      // 设置模拟函数的返回值
      Announcement.find.mockReturnValue(mockChain);

      // 发送请求（不指定limit参数）
      const response = await request(app)
        .get('/api/interaction/announcements/class/class-id-1/latest');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty('_id', 'announcement-id-1');

      // 验证 limit 方法被调用时使用了默认值
      expect(mockChain.limit).toHaveBeenCalledWith(5);
    });

    it('应该处理数据库查询错误', async () => {
      // 模拟 find 方法抛出错误
      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockImplementation(() => {
          throw new Error('数据库查询错误');
        })
      };
      Announcement.find.mockReturnValue(mockChain);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements/class/class-id-1/latest');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取班级最新公告失败');
      expect(response.body).toHaveProperty('error', '数据库查询错误');
    });
  });

  // 测试成功删除公告
  describe('DELETE /api/interaction/announcements/:id - 成功路径', () => {
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
  });

  // 测试成功更新公告
  describe('PUT /api/interaction/announcements/:id - 成功路径', () => {
    it('应该成功更新公告', async () => {
      // 模拟数据
      const updatedAnnouncement = {
        _id: 'announcement-id-1',
        title: '更新后的标题',
        content: '更新后的内容',
        author: 'author-id-1',
        class: 'class-id-1',
        attachments: [
          { name: '附件1', url: 'http://example.com/attachment1.pdf' }
        ],
        updatedAt: new Date()
      };

      // 模拟 findByIdAndUpdate 方法的返回值
      Announcement.findByIdAndUpdate.mockResolvedValue(updatedAnnouncement);

      // 准备请求数据
      const updateData = {
        title: '更新后的标题',
        content: '更新后的内容',
        attachments: [
          { name: '附件1', url: 'http://example.com/attachment1.pdf' }
        ]
      };

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/announcements/announcement-id-1')
        .send(updateData);

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id', 'announcement-id-1');
      expect(response.body).toHaveProperty('title', '更新后的标题');
      expect(response.body).toHaveProperty('content', '更新后的内容');
      expect(response.body).toHaveProperty('attachments');
      expect(response.body.attachments).toHaveLength(1);

      // 验证 findByIdAndUpdate 方法被正确调用
      expect(Announcement.findByIdAndUpdate).toHaveBeenCalledWith(
        'announcement-id-1',
        expect.objectContaining({
          title: '更新后的标题',
          content: '更新后的内容',
          attachments: [
            { name: '附件1', url: 'http://example.com/attachment1.pdf' }
          ]
        }),
        { new: true }
      );
    });
  });
});
