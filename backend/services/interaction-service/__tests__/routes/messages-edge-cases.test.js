/**
 * 消息路由测试 - 边缘情况
 */

const request = require('supertest');
const express = require('express');
const router = require('../../routes/messages');

// 模拟 Message 模型
jest.mock('../../models/Message', () => {
  // 创建一个模拟的 Message 构造函数
  const mockMessage = jest.fn().mockImplementation(function(data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  });

  // 添加静态方法
  mockMessage.find = jest.fn();
  mockMessage.findById = jest.fn();
  mockMessage.findByIdAndUpdate = jest.fn();
  mockMessage.findByIdAndDelete = jest.fn();
  mockMessage.countDocuments = jest.fn();

  return mockMessage;
});

describe('消息路由测试 - 边缘情况', () => {
  let app;
  const Message = require('../../models/Message');

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/messages', router);

    // 重置所有模拟函数
    jest.clearAllMocks();
  });

  describe('GET /api/interaction/messages - 日期处理边缘情况', () => {
    it('应该处理只有开始日期没有结束日期的情况', async () => {
      // 模拟数据
      const mockMessages = [
        {
          _id: 'message-id-1',
          sender: { _id: 'sender-id-1', name: '发送者1', role: 'teacher' },
          receiver: { _id: 'receiver-id-1', name: '接收者1', role: 'parent' },
          content: '测试消息1',
          attachments: [],
          read: false,
          createdAt: new Date('2023-01-15')
        }
      ];

      // 设置模拟函数的返回值
      const mockPopulate = jest.fn();
      mockPopulate.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue(mockMessages)
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

      Message.find.mockReturnValue({
        sort: mockSort
      });

      // 模拟 countDocuments 方法的返回值
      Message.countDocuments.mockResolvedValue(1);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages')
        .query({
          startDate: '2023-01-01'
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total', 1);

      // 验证模拟函数被正确调用
      expect(Message.find).toHaveBeenCalledWith({
        createdAt: {
          $gte: expect.any(Date)
        }
      });
    });

    it('应该处理只有结束日期没有开始日期的情况', async () => {
      // 模拟数据
      const mockMessages = [
        {
          _id: 'message-id-1',
          sender: { _id: 'sender-id-1', name: '发送者1', role: 'teacher' },
          receiver: { _id: 'receiver-id-1', name: '接收者1', role: 'parent' },
          content: '测试消息1',
          attachments: [],
          read: false,
          createdAt: new Date('2023-01-15')
        }
      ];

      // 设置模拟函数的返回值
      const mockPopulate = jest.fn();
      mockPopulate.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue(mockMessages)
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

      Message.find.mockReturnValue({
        sort: mockSort
      });

      // 模拟 countDocuments 方法的返回值
      Message.countDocuments.mockResolvedValue(1);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages')
        .query({
          endDate: '2023-01-31'
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total', 1);

      // 验证模拟函数被正确调用
      expect(Message.find).toHaveBeenCalledWith({
        createdAt: {
          $lte: expect.any(Date)
        }
      });
    });
  });
});
