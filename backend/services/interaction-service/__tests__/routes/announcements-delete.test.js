/**
 * 公告路由测试 - 删除公告
 */

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

  return mockAnnouncement;
});

describe('公告路由测试 - 删除公告', () => {
  let app;
  const Announcement = require('../../models/Announcement');

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/announcements', router);

    // 重置所有模拟函数
    jest.clearAllMocks();
  });

  describe('DELETE /api/interaction/announcements/:id', () => {
    it('应该成功删除公告', async () => {
      // 模拟数据
      const deletedAnnouncement = {
        _id: 'announcement-id-1',
        title: '测试公告',
        content: '测试内容',
        author: 'author-id-1',
        class: 'class-id-1',
        attachments: []
      };

      // 设置模拟函数的返回值
      Announcement.findByIdAndDelete.mockResolvedValue(deletedAnnouncement);

      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/announcements/announcement-id-1');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '公告已删除');

      // 验证模拟函数被正确调用
      expect(Announcement.findByIdAndDelete).toHaveBeenCalledWith('announcement-id-1');
    });

    it('应该处理公告不存在的情况', async () => {
      // 设置模拟函数的返回值
      Announcement.findByIdAndDelete.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/announcements/non-existent-id');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '公告不存在');

      // 验证模拟函数被正确调用
      expect(Announcement.findByIdAndDelete).toHaveBeenCalledWith('non-existent-id');
    });

    it('应该处理数据库错误', async () => {
      // 设置模拟函数抛出错误
      Announcement.findByIdAndDelete.mockRejectedValue(new Error('数据库错误'));

      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/announcements/announcement-id-1');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '删除公告失败');
      expect(response.body).toHaveProperty('error', '数据库错误');

      // 验证模拟函数被正确调用
      expect(Announcement.findByIdAndDelete).toHaveBeenCalledWith('announcement-id-1');
    });
  });
});
