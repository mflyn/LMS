/**
 * 公告路由测试 - 更新公告
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

describe('公告路由测试 - 更新公告', () => {
  let app;
  const Announcement = require('../../models/Announcement');

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/announcements', router);

    // 重置所有模拟函数
    jest.clearAllMocks();
  });

  describe('PUT /api/interaction/announcements/:id', () => {
    it('应该成功更新公告 - 包含所有字段', async () => {
      // 模拟数据
      const updateData = {
        title: '更新后的标题',
        content: '更新后的内容',
        attachments: [
          {
            name: '新附件.pdf',
            url: 'http://example.com/files/new-attachment.pdf',
            type: 'application/pdf',
            size: 2048
          }
        ]
      };

      const updatedAnnouncement = {
        _id: 'announcement-id-1',
        title: updateData.title,
        content: updateData.content,
        author: 'author-id-1',
        class: 'class-id-1',
        attachments: updateData.attachments,
        updatedAt: new Date()
      };

      // 设置模拟函数的返回值
      Announcement.findByIdAndUpdate.mockResolvedValue(updatedAnnouncement);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/announcements/announcement-id-1')
        .send(updateData);

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id', 'announcement-id-1');
      expect(response.body).toHaveProperty('title', updateData.title);
      expect(response.body).toHaveProperty('content', updateData.content);
      expect(response.body).toHaveProperty('attachments');
      expect(response.body.attachments).toHaveLength(1);
      expect(response.body.attachments[0]).toHaveProperty('name', updateData.attachments[0].name);

      // 验证模拟函数被正确调用
      expect(Announcement.findByIdAndUpdate).toHaveBeenCalledWith(
        'announcement-id-1',
        {
          title: updateData.title,
          content: updateData.content,
          attachments: updateData.attachments,
          updatedAt: expect.any(Number)
        },
        { new: true }
      );
    });

    it('应该成功更新公告 - 不包含附件', async () => {
      // 模拟数据
      const updateData = {
        title: '更新后的标题',
        content: '更新后的内容'
      };

      const updatedAnnouncement = {
        _id: 'announcement-id-1',
        title: updateData.title,
        content: updateData.content,
        author: 'author-id-1',
        class: 'class-id-1',
        attachments: [],
        updatedAt: new Date()
      };

      // 设置模拟函数的返回值
      Announcement.findByIdAndUpdate.mockResolvedValue(updatedAnnouncement);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/announcements/announcement-id-1')
        .send(updateData);

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id', 'announcement-id-1');
      expect(response.body).toHaveProperty('title', updateData.title);
      expect(response.body).toHaveProperty('content', updateData.content);
      expect(response.body).toHaveProperty('attachments');
      expect(response.body.attachments).toHaveLength(0);

      // 验证模拟函数被正确调用
      expect(Announcement.findByIdAndUpdate).toHaveBeenCalledWith(
        'announcement-id-1',
        {
          title: updateData.title,
          content: updateData.content,
          attachments: [],
          updatedAt: expect.any(Number)
        },
        { new: true }
      );
    });

    it('应该验证必填字段 - 缺少标题', async () => {
      // 模拟数据 - 缺少标题
      const updateData = {
        content: '更新后的内容'
      };

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/announcements/announcement-id-1')
        .send(updateData);

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题和内容不能为空');

      // 验证模拟函数没有被调用
      expect(Announcement.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('应该验证必填字段 - 缺少内容', async () => {
      // 模拟数据 - 缺少内容
      const updateData = {
        title: '更新后的标题'
      };

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/announcements/announcement-id-1')
        .send(updateData);

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '标题和内容不能为空');

      // 验证模拟函数没有被调用
      expect(Announcement.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('应该处理公告不存在的情况', async () => {
      // 模拟数据
      const updateData = {
        title: '更新后的标题',
        content: '更新后的内容'
      };

      // 设置模拟函数的返回值
      Announcement.findByIdAndUpdate.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/announcements/non-existent-id')
        .send(updateData);

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '公告不存在');

      // 验证模拟函数被正确调用
      expect(Announcement.findByIdAndUpdate).toHaveBeenCalledWith(
        'non-existent-id',
        {
          title: updateData.title,
          content: updateData.content,
          attachments: [],
          updatedAt: expect.any(Number)
        },
        { new: true }
      );
    });

    it('应该处理数据库错误', async () => {
      // 模拟数据
      const updateData = {
        title: '更新后的标题',
        content: '更新后的内容'
      };

      // 设置模拟函数抛出错误
      Announcement.findByIdAndUpdate.mockImplementation(() => {
        throw new Error('数据库错误');
      });

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/announcements/announcement-id-1')
        .send(updateData);

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '更新公告失败');
      expect(response.body).toHaveProperty('error', '数据库错误');

      // 验证模拟函数被正确调用
      expect(Announcement.findByIdAndUpdate).toHaveBeenCalledWith(
        'announcement-id-1',
        {
          title: updateData.title,
          content: updateData.content,
          attachments: [],
          updatedAt: expect.any(Number)
        },
        { new: true }
      );
    });
  });
});
