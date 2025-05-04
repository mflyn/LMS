/**
 * 公告路由额外测试用例
 * 用于提高测试覆盖率
 */

const request = require('supertest');
const express = require('express');
const router = require('../../routes/announcements');
const mongoose = require('mongoose');

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
  mockAnnouncement.aggregate = jest.fn();

  // 默认返回值设置
  mockAnnouncement.countDocuments.mockResolvedValue(0);

  return mockAnnouncement;
});

describe('公告路由额外测试', () => {
  let app;
  const Announcement = require('../../models/Announcement');

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/announcements', router);

    // 重置所有模拟函数
    jest.clearAllMocks();
  });

  // 测试获取公告统计信息
  describe('GET /api/interaction/announcements/stats', () => {
    it('应该返回公告统计信息', async () => {
      // 模拟聚合结果
      const mockStats = [
        { class: '一年级', count: 5 },
        { class: '二年级', count: 3 }
      ];

      Announcement.aggregate.mockResolvedValue(mockStats);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements/stats');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStats);

      // 验证模拟函数被正确调用
      expect(Announcement.aggregate).toHaveBeenCalled();
    });

    it('应该处理聚合错误', async () => {
      // 模拟聚合错误
      Announcement.aggregate.mockRejectedValue(new Error('聚合错误'));

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements/stats');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取公告统计信息失败');
      expect(response.body).toHaveProperty('error', '聚合错误');
    });
  });

  // 测试获取最新公告
  describe('GET /api/interaction/announcements/latest', () => {
    it('应该返回最新公告', async () => {
      // 模拟数据
      const mockAnnouncements = [
        {
          _id: 'announcement-id-1',
          title: '最新公告1',
          content: '内容1',
          author: 'teacher-id-1',
          class: '一年级',
          createdAt: new Date()
        }
      ];

      // 设置模拟函数的返回值
      const mockLimit = jest.fn();
      mockLimit.mockReturnValue(mockAnnouncements);

      const mockSort = jest.fn();
      mockSort.mockReturnValue({
        limit: mockLimit
      });

      Announcement.find.mockReturnValue({
        sort: mockSort
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements/latest')
        .query({ limit: 5 });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAnnouncements);

      // 验证模拟函数被正确调用
      expect(Announcement.find).toHaveBeenCalled();
      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockLimit).toHaveBeenCalledWith(5);
    });

    it('应该使用默认限制', async () => {
      // 模拟数据
      const mockAnnouncements = [
        {
          _id: 'announcement-id-1',
          title: '最新公告1',
          content: '内容1',
          author: 'teacher-id-1',
          class: '一年级',
          createdAt: new Date()
        }
      ];

      // 设置模拟函数的返回值
      const mockLimit = jest.fn();
      mockLimit.mockReturnValue(mockAnnouncements);

      const mockSort = jest.fn();
      mockSort.mockReturnValue({
        limit: mockLimit
      });

      Announcement.find.mockReturnValue({
        sort: mockSort
      });

      // 发送请求（不提供限制）
      const response = await request(app)
        .get('/api/interaction/announcements/latest');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAnnouncements);

      // 验证模拟函数被正确调用
      expect(mockLimit).toHaveBeenCalledWith(10); // 默认限制为10
    });

    it('应该支持按班级筛选', async () => {
      // 模拟数据
      const mockAnnouncements = [
        {
          _id: 'announcement-id-1',
          title: '最新公告1',
          content: '内容1',
          author: 'teacher-id-1',
          class: '一年级',
          createdAt: new Date()
        }
      ];

      // 设置模拟函数的返回值
      const mockLimit = jest.fn();
      mockLimit.mockReturnValue(mockAnnouncements);

      const mockSort = jest.fn();
      mockSort.mockReturnValue({
        limit: mockLimit
      });

      Announcement.find.mockReturnValue({
        sort: mockSort
      });

      // 发送请求（提供班级）
      const response = await request(app)
        .get('/api/interaction/announcements/latest')
        .query({ class: '一年级' });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAnnouncements);

      // 验证模拟函数被正确调用
      expect(Announcement.find).toHaveBeenCalledWith({ class: '一年级' });
    });

    it('应该处理查询错误', async () => {
      // 模拟查询错误
      Announcement.find.mockImplementation(() => {
        throw new Error('查询错误');
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements/latest');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取最新公告失败');
      expect(response.body).toHaveProperty('error', '查询错误');
    });
  });

  // 测试添加公告附件
  describe('POST /api/interaction/announcements/:id/attachments', () => {
    it('应该成功添加公告附件', async () => {
      // 模拟数据
      const mockAnnouncement = {
        _id: 'announcement-id-1',
        title: '测试公告',
        content: '内容',
        author: 'teacher-id-1',
        class: '一年级',
        attachments: [],
        save: jest.fn().mockResolvedValue({
          _id: 'announcement-id-1',
          title: '测试公告',
          content: '内容',
          author: 'teacher-id-1',
          class: '一年级',
          attachments: [{
            name: '附件1.pdf',
            url: 'https://example.com/files/attachment1.pdf',
            size: 1024,
            type: 'application/pdf'
          }]
        })
      };

      // 设置模拟函数的返回值
      Announcement.findById.mockResolvedValue(mockAnnouncement);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/announcements/announcement-id-1/attachments')
        .send({
          name: '附件1.pdf',
          url: 'https://example.com/files/attachment1.pdf',
          size: 1024,
          type: 'application/pdf'
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body.attachments).toHaveLength(1);
      expect(response.body.attachments[0]).toHaveProperty('name', '附件1.pdf');
      expect(response.body.attachments[0]).toHaveProperty('url', 'https://example.com/files/attachment1.pdf');
      expect(response.body.attachments[0]).toHaveProperty('size', 1024);
      expect(response.body.attachments[0]).toHaveProperty('type', 'application/pdf');

      // 验证模拟函数被正确调用
      expect(Announcement.findById).toHaveBeenCalledWith('announcement-id-1');
      expect(mockAnnouncement.save).toHaveBeenCalled();
    });

    it('应该验证必要参数', async () => {
      // 发送请求（不提供URL）
      const response = await request(app)
        .post('/api/interaction/announcements/announcement-id-1/attachments')
        .send({
          name: '附件1.pdf',
          size: 1024,
          type: 'application/pdf'
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '附件名称和URL是必需的');
    });

    it('应该处理公告不存在的情况', async () => {
      // 设置模拟函数的返回值
      Announcement.findById.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/announcements/non-existent-id/attachments')
        .send({
          name: '附件1.pdf',
          url: 'https://example.com/files/attachment1.pdf',
          size: 1024,
          type: 'application/pdf'
        });

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '公告不存在');
    });

    it('应该处理保存错误', async () => {
      // 模拟数据
      const mockAnnouncement = {
        _id: 'announcement-id-1',
        title: '测试公告',
        content: '内容',
        author: 'teacher-id-1',
        class: '一年级',
        attachments: [],
        save: jest.fn().mockRejectedValue(new Error('保存错误'))
      };

      // 设置模拟函数的返回值
      Announcement.findById.mockResolvedValue(mockAnnouncement);

      // 发送请求
      const response = await request(app)
        .post('/api/interaction/announcements/announcement-id-1/attachments')
        .send({
          name: '附件1.pdf',
          url: 'https://example.com/files/attachment1.pdf',
          size: 1024,
          type: 'application/pdf'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '添加附件失败');
      expect(response.body).toHaveProperty('error', '保存错误');
    });
  });

  // 测试删除公告附件
  describe('DELETE /api/interaction/announcements/:id/attachments/:attachmentId', () => {
    it('应该成功删除公告附件', async () => {
      // 模拟数据
      const mockAnnouncement = {
        _id: 'announcement-id-1',
        title: '测试公告',
        content: '内容',
        author: 'teacher-id-1',
        class: '一年级',
        attachments: [{
          _id: 'attachment-id-1',
          name: '附件1.pdf',
          url: 'https://example.com/files/attachment1.pdf',
          size: 1024,
          type: 'application/pdf'
        }],
        save: jest.fn().mockResolvedValue({
          _id: 'announcement-id-1',
          title: '测试公告',
          content: '内容',
          author: 'teacher-id-1',
          class: '一年级',
          attachments: []
        })
      };

      // 设置模拟函数的返回值
      Announcement.findById.mockResolvedValue(mockAnnouncement);

      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/announcements/announcement-id-1/attachments/attachment-id-1');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body.attachments).toHaveLength(0);

      // 验证模拟函数被正确调用
      expect(Announcement.findById).toHaveBeenCalledWith('announcement-id-1');
      expect(mockAnnouncement.save).toHaveBeenCalled();
    });

    it('应该处理公告不存在的情况', async () => {
      // 设置模拟函数的返回值
      Announcement.findById.mockResolvedValue(null);

      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/announcements/non-existent-id/attachments/attachment-id-1');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '公告不存在');
    });

    it('应该处理附件不存在的情况', async () => {
      // 模拟数据
      const mockAnnouncement = {
        _id: 'announcement-id-1',
        title: '测试公告',
        content: '内容',
        author: 'teacher-id-1',
        class: '一年级',
        attachments: [{
          _id: 'attachment-id-1',
          name: '附件1.pdf',
          url: 'https://example.com/files/attachment1.pdf',
          size: 1024,
          type: 'application/pdf'
        }]
      };

      // 设置模拟函数的返回值
      Announcement.findById.mockResolvedValue(mockAnnouncement);

      // 发送请求（使用不存在的附件ID）
      const response = await request(app)
        .delete('/api/interaction/announcements/announcement-id-1/attachments/non-existent-attachment-id');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '附件不存在');
    });

    it('应该处理保存错误', async () => {
      // 模拟数据
      const mockAnnouncement = {
        _id: 'announcement-id-1',
        title: '测试公告',
        content: '内容',
        author: 'teacher-id-1',
        class: '一年级',
        attachments: [{
          _id: 'attachment-id-1',
          name: '附件1.pdf',
          url: 'https://example.com/files/attachment1.pdf',
          size: 1024,
          type: 'application/pdf'
        }],
        save: jest.fn().mockRejectedValue(new Error('保存错误'))
      };

      // 设置模拟函数的返回值
      Announcement.findById.mockResolvedValue(mockAnnouncement);

      // 发送请求
      const response = await request(app)
        .delete('/api/interaction/announcements/announcement-id-1/attachments/attachment-id-1');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '删除附件失败');
      expect(response.body).toHaveProperty('error', '保存错误');
    });
  });
});
