/**
 * 公告路由基础测试
 * 专注于测试 announcements.js 中的基本路由
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

describe('公告路由基础测试', () => {
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

  describe('GET /api/interaction/announcements', () => {
    it('应该返回公告列表', async () => {
      // 模拟数据
      const mockAnnouncements = [
        {
          _id: 'announcement-id-1',
          title: '测试公告1',
          content: '这是测试公告1的内容',
          author: 'user-id-1',
          targetGroups: ['all'],
          createdAt: new Date()
        },
        {
          _id: 'announcement-id-2',
          title: '测试公告2',
          content: '这是测试公告2的内容',
          author: 'user-id-1',
          targetGroups: ['teachers'],
          createdAt: new Date()
        }
      ];

      // 设置模拟函数的返回值
      Announcement.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue(mockAnnouncements)
        })
      });

      Announcement.countDocuments = jest.fn().mockResolvedValue(2);

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

      // 验证 Announcement.find 被调用
      expect(Announcement.find).toHaveBeenCalled();
      expect(Announcement.countDocuments).toHaveBeenCalled();
    });

    it('应该处理查询参数', async () => {
      // 发送请求
      await request(app)
        .get('/api/interaction/announcements')
        .query({
          author: 'user-id-1',
          targetGroup: 'teachers',
          startDate: '2023-01-01',
          endDate: '2023-12-31',
          limit: 20,
          skip: 10
        });

      // 验证 Announcement.find 被调用
      expect(Announcement.find).toHaveBeenCalled();

      // 验证分页参数
      expect(Announcement.find().skip).toHaveBeenCalledWith(10);
      expect(Announcement.find().limit).toHaveBeenCalledWith(20);
    });

    it('应该处理查询错误', async () => {
      // 模拟查询错误
      Announcement.find = jest.fn().mockImplementation(() => {
        throw new Error('查询错误');
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements')
        .query({ limit: 10, skip: 0 });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取公告列表失败');
      expect(response.body).toHaveProperty('error', '查询错误');
    });
  });

  describe('GET /api/interaction/announcements/:id', () => {
    it('应该返回指定ID的公告', async () => {
      // 模拟数据
      const mockAnnouncement = {
        _id: 'announcement-id-1',
        title: '测试公告1',
        content: '这是测试公告1的内容',
        author: 'user-id-1',
        targetGroups: ['all'],
        createdAt: new Date()
      };

      // 设置模拟函数的返回值
      Announcement.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockAnnouncement)
        })
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements/announcement-id-1');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id', 'announcement-id-1');
      expect(response.body).toHaveProperty('title', '测试公告1');
      expect(response.body).toHaveProperty('content', '这是测试公告1的内容');

      // 验证 Announcement.findById 被调用
      expect(Announcement.findById).toHaveBeenCalledWith('announcement-id-1');
    });

    it('应该处理公告不存在的情况', async () => {
      // 设置模拟函数的返回值
      Announcement.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null)
        })
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements/non-existent-id');

      // 验证响应
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '公告不存在');
    });

    it('应该处理查询错误', async () => {
      // 模拟查询错误
      Announcement.findById = jest.fn().mockImplementation(() => {
        throw new Error('查询错误');
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements/announcement-id-1');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取公告失败');
      expect(response.body).toHaveProperty('error', '查询错误');
    });
  });
});
