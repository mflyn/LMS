/**
 * 公告路由测试 - 日期边缘情况
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

describe('公告路由测试 - 日期边缘情况', () => {
  let app;
  const Announcement = require('../../models/Announcement');

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/announcements', router);

    // 重置所有模拟函数
    jest.clearAllMocks();
  });

  describe('GET /api/interaction/announcements - 日期处理边缘情况', () => {
    it('应该处理只有开始日期没有结束日期的情况', async () => {
      // 模拟数据
      const mockAnnouncements = [
        {
          _id: 'announcement-id-1',
          title: '测试公告1',
          content: '测试内容1',
          author: { _id: 'author-id-1', name: '作者1', role: 'teacher' },
          class: { _id: 'class-id-1', name: '一年级一班', grade: '一年级' },
          attachments: [],
          createdAt: new Date('2023-01-15')
        }
      ];

      // 设置模拟函数的返回值
      const mockPopulate = jest.fn();
      mockPopulate.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue(mockAnnouncements)
      });

      const mockLimit = jest.fn();
      mockLimit.mockReturnValue({
        populate: mockPopulate
      });

      const mockSkip = jest.fn();
      mockSkip.mockReturnValue({
        limit: mockLimit
      });

      const mockSort = jest.fn();
      mockSort.mockReturnValue({
        skip: mockSkip
      });

      Announcement.find.mockReturnValue({
        sort: mockSort
      });

      // 模拟 countDocuments 方法的返回值
      Announcement.countDocuments.mockResolvedValue(1);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements')
        .query({
          startDate: '2023-01-01'
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total', 1);

      // 验证模拟函数被正确调用
      expect(Announcement.find).toHaveBeenCalledWith({
        createdAt: {
          $gte: expect.any(Date)
        }
      });
    });

    it('应该处理只有结束日期没有开始日期的情况', async () => {
      // 模拟数据
      const mockAnnouncements = [
        {
          _id: 'announcement-id-1',
          title: '测试公告1',
          content: '测试内容1',
          author: { _id: 'author-id-1', name: '作者1', role: 'teacher' },
          class: { _id: 'class-id-1', name: '一年级一班', grade: '一年级' },
          attachments: [],
          createdAt: new Date('2023-01-15')
        }
      ];

      // 设置模拟函数的返回值
      const mockPopulate = jest.fn();
      mockPopulate.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue(mockAnnouncements)
      });

      const mockLimit = jest.fn();
      mockLimit.mockReturnValue({
        populate: mockPopulate
      });

      const mockSkip = jest.fn();
      mockSkip.mockReturnValue({
        limit: mockLimit
      });

      const mockSort = jest.fn();
      mockSort.mockReturnValue({
        skip: mockSkip
      });

      Announcement.find.mockReturnValue({
        sort: mockSort
      });

      // 模拟 countDocuments 方法的返回值
      Announcement.countDocuments.mockResolvedValue(1);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements')
        .query({
          endDate: '2023-01-31'
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total', 1);

      // 验证模拟函数被正确调用
      expect(Announcement.find).toHaveBeenCalledWith({
        createdAt: {
          $lte: expect.any(Date)
        }
      });
    });

    it('应该处理同时有开始日期和结束日期的情况', async () => {
      // 模拟数据
      const mockAnnouncements = [
        {
          _id: 'announcement-id-1',
          title: '测试公告1',
          content: '测试内容1',
          author: { _id: 'author-id-1', name: '作者1', role: 'teacher' },
          class: { _id: 'class-id-1', name: '一年级一班', grade: '一年级' },
          attachments: [],
          createdAt: new Date('2023-01-15')
        }
      ];

      // 设置模拟函数的返回值
      const mockPopulate = jest.fn();
      mockPopulate.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue(mockAnnouncements)
      });

      const mockLimit = jest.fn();
      mockLimit.mockReturnValue({
        populate: mockPopulate
      });

      const mockSkip = jest.fn();
      mockSkip.mockReturnValue({
        limit: mockLimit
      });

      const mockSort = jest.fn();
      mockSort.mockReturnValue({
        skip: mockSkip
      });

      Announcement.find.mockReturnValue({
        sort: mockSort
      });

      // 模拟 countDocuments 方法的返回值
      Announcement.countDocuments.mockResolvedValue(1);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/announcements')
        .query({
          startDate: '2023-01-01',
          endDate: '2023-01-31'
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
    });
  });
});
