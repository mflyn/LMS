/**
 * 公告路由 CRUD 测试
 * 专注于测试 announcements.js 中的 POST、PUT 和 DELETE 路由
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Announcement = require('../../models/Announcement');
const winston = require('winston');

// 模拟 Announcement 模型
jest.mock('../../models/Announcement');

// 模拟 winston 日志
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

describe('公告路由 CRUD 测试', () => {
  let app;

  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();

    // 创建 Express 应用
    app = express();
    app.use(express.json());

    // 导入路由
    const announcementsRouter = require('../../routes/announcements');
    app.use('/api/interaction/announcements', announcementsRouter);

    // 模拟 mongoose.Types.ObjectId.isValid
    mongoose.Types.ObjectId = { isValid: jest.fn().mockReturnValue(true) };
  });

  describe('POST /api/interaction/announcements', () => {
    it('应该成功创建公告', async () => {
      // 保存原始的 Announcement 构造函数
      const OriginalAnnouncement = Announcement;

      // 创建一个带有 _id 的公告对象
      const savedAnnouncement = {
        _id: 'new-announcement-id',
        title: '新公告',
        content: '这是新公告的内容',
        author: 'user-id-1',
        class: 'class-id-1',
        attachments: [],
        createdAt: new Date(),
        toJSON: function() {
          return {
            _id: 'new-announcement-id',
            title: '新公告',
            content: '这是新公告的内容',
            author: 'user-id-1',
            class: 'class-id-1',
            attachments: [],
            createdAt: this.createdAt
          };
        }
      };

      // 模拟 Announcement 构造函数
      const mockAnnouncementInstance = {
        title: '新公告',
        content: '这是新公告的内容',
        author: 'user-id-1',
        class: 'class-id-1',
        attachments: [],
        save: jest.fn().mockResolvedValue(savedAnnouncement)
      };

      // 替换 Announcement 构造函数
      global.Announcement = jest.fn().mockImplementation(() => mockAnnouncementInstance);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/announcements')
        .send({
          title: '新公告',
          content: '这是新公告的内容',
          author: 'user-id-1',
          classId: 'class-id-1'
        });

      // 验证响应
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('_id', 'new-announcement-id');
      expect(response.body).toHaveProperty('title', '新公告');
      expect(response.body).toHaveProperty('content', '这是新公告的内容');
      expect(response.body).toHaveProperty('author', 'user-id-1');

      // 验证 Announcement 构造函数被调用
      expect(global.Announcement).toHaveBeenCalledWith({
        title: '新公告',
        content: '这是新公告的内容',
        author: 'user-id-1',
        class: 'class-id-1',
        attachments: []
      });

      // 验证 save 方法被调用
      expect(mockAnnouncementInstance.save).toHaveBeenCalled();

      // 恢复原始的 Announcement 构造函数
      global.Announcement = OriginalAnnouncement;
    });

    it('应该验证必要参数', async () => {
      // 发送请求（不提供标题）
      const response1 = await request(app)
        .post('/api/interaction/announcements')
        .send({
          content: '这是新公告的内容',
          author: 'user-id-1',
          classId: 'class-id-1'
        });

      // 验证响应
      expect(response1.status).toBe(400);
      expect(response1.body).toHaveProperty('message', '标题、内容、作者和班级不能为空');

      // 发送请求（不提供内容）
      const response2 = await request(app)
        .post('/api/interaction/announcements')
        .send({
          title: '新公告',
          author: 'user-id-1',
          classId: 'class-id-1'
        });

      // 验证响应
      expect(response2.status).toBe(400);
      expect(response2.body).toHaveProperty('message', '标题、内容、作者和班级不能为空');
    });

    it('应该处理保存错误', async () => {
      // 保存原始的 Announcement 构造函数
      const OriginalAnnouncement = Announcement;

      // 模拟 Announcement 构造函数
      const mockAnnouncementInstance = {
        title: '新公告',
        content: '这是新公告的内容',
        author: 'user-id-1',
        class: 'class-id-1',
        attachments: [],
        save: jest.fn().mockRejectedValue(new Error('保存错误'))
      };

      // 替换 Announcement 构造函数
      global.Announcement = jest.fn().mockImplementation(() => mockAnnouncementInstance);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/announcements')
        .send({
          title: '新公告',
          content: '这是新公告的内容',
          author: 'user-id-1',
          classId: 'class-id-1'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '创建公告失败');
      expect(response.body).toHaveProperty('error', '保存错误');

      // 恢复原始的 Announcement 构造函数
      global.Announcement = OriginalAnnouncement;
    });
  });

  describe('PUT /api/interaction/announcements/:id', () => {
    it('应该成功更新公告', async () => {
      // 模拟 findByIdAndUpdate 方法
      Announcement.findByIdAndUpdate = jest.fn().mockResolvedValue({
        _id: 'announcement-id-1',
        title: '更新后的公告',
        content: '这是更新后的公告内容',
        author: 'user-id-1',
        targetGroups: ['all']
      });

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/announcements/announcement-id-1')
        .send({
          title: '更新后的公告',
          content: '这是更新后的公告内容'
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('title', '更新后的公告');
      expect(response.body).toHaveProperty('content', '这是更新后的公告内容');

      // 验证 findByIdAndUpdate 方法被调用
      expect(Announcement.findByIdAndUpdate).toHaveBeenCalledWith(
        'announcement-id-1',
        {
          title: '更新后的公告',
          content: '这是更新后的公告内容'
        },
        { new: true }
      );
    });

    it('应该处理公告不存在的情况', async () => {
      // 模拟 findByIdAndUpdate 方法
      Announcement.findByIdAndUpdate = jest.fn().mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/announcements/non-existent-id')
        .send({
          title: '更新后的公告',
          content: '这是更新后的公告内容'
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '公告不存在');
    });

    it('应该处理更新错误', async () => {
      // 模拟 findByIdAndUpdate 方法
      Announcement.findByIdAndUpdate = jest.fn().mockRejectedValue(new Error('更新错误'));

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/announcements/announcement-id-1')
        .send({
          title: '更新后的公告',
          content: '这是更新后的公告内容'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '更新公告失败');
      expect(response.body).toHaveProperty('error', '更新错误');
    });
  });

  describe('DELETE /api/interaction/announcements/:id', () => {
    it('应该成功删除公告', async () => {
      // 模拟 findByIdAndDelete 方法
      Announcement.findByIdAndDelete = jest.fn().mockResolvedValue({
        _id: 'announcement-id-1',
        title: '测试公告',
        content: '这是测试公告的内容'
      });

      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/announcements/announcement-id-1');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '公告已删除');

      // 验证 findByIdAndDelete 方法被调用
      expect(Announcement.findByIdAndDelete).toHaveBeenCalledWith('announcement-id-1');
    });

    it('应该处理公告不存在的情况', async () => {
      // 模拟 findByIdAndDelete 方法
      Announcement.findByIdAndDelete = jest.fn().mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/announcements/non-existent-id');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '公告不存在');
    });

    it('应该处理删除错误', async () => {
      // 模拟 findByIdAndDelete 方法
      Announcement.findByIdAndDelete = jest.fn().mockRejectedValue(new Error('删除错误'));

      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/announcements/announcement-id-1');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '删除公告失败');
      expect(response.body).toHaveProperty('error', '删除错误');
    });
  });
});
