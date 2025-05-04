/**
 * 消息路由额外测试用例
 * 用于提高测试覆盖率
 */

const request = require('supertest');
const express = require('express');
const router = require('../../routes/messages');
const mongoose = require('mongoose');

// 模拟 Message 模型
jest.mock('../../models/Message', () => {
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
  mockMessage.aggregate = jest.fn();

  // 默认返回值设置
  mockMessage.countDocuments.mockResolvedValue(0);

  return mockMessage;
});

describe('消息路由额外测试', () => {
  let app;
  const Message = require('../../models/Message');

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/interaction/messages', router);

    // 重置所有模拟函数
    jest.clearAllMocks();
  });

  // 测试获取消息统计信息
  describe('GET /api/interaction/messages/stats', () => {
    it('应该返回消息统计信息', async () => {
      // 模拟聚合结果
      const mockStats = [
        { status: 'unread', count: 5 },
        { status: 'read', count: 10 }
      ];

      Message.aggregate.mockResolvedValue(mockStats);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages/stats');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStats);

      // 验证模拟函数被正确调用
      expect(Message.aggregate).toHaveBeenCalled();
    });

    it('应该处理聚合错误', async () => {
      // 模拟聚合错误
      Message.aggregate.mockRejectedValue(new Error('聚合错误'));

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages/stats');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取消息统计信息失败');
      expect(response.body).toHaveProperty('error', '聚合错误');
    });
  });

  // 测试获取会话列表
  describe('GET /api/interaction/messages/conversations/:userId', () => {
    it('应该返回用户的会话列表', async () => {
      // 模拟聚合结果
      const mockConversations = [
        {
          _id: 'user-id-2',
          lastMessage: {
            content: '最新消息内容',
            createdAt: new Date()
          },
          unreadCount: 3
        }
      ];

      Message.aggregate.mockResolvedValue(mockConversations);

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages/conversations/user-id-1');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockConversations);

      // 验证模拟函数被正确调用
      expect(Message.aggregate).toHaveBeenCalled();
    });

    it('应该验证用户ID参数', async () => {
      // 发送请求（不提供用户ID）
      const response = await request(app)
        .get('/api/interaction/messages/conversations/');

      // 验证响应（应该是404，因为路由不匹配）
      expect(response.status).toBe(404);
    });

    it('应该处理聚合错误', async () => {
      // 模拟聚合错误
      Message.aggregate.mockRejectedValue(new Error('聚合错误'));

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages/conversations/user-id-1');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取会话列表失败');
      expect(response.body).toHaveProperty('error', '聚合错误');
    });
  });

  // 测试获取会话消息
  describe('GET /api/interaction/messages/conversation', () => {
    it('应该返回两个用户之间的会话消息', async () => {
      // 模拟数据
      const mockMessages = [
        {
          _id: 'message-id-1',
          sender: 'user-id-1',
          receiver: 'user-id-2',
          content: '你好',
          createdAt: new Date(),
          read: true
        },
        {
          _id: 'message-id-2',
          sender: 'user-id-2',
          receiver: 'user-id-1',
          content: '你好，有什么可以帮助你的？',
          createdAt: new Date(),
          read: false
        }
      ];

      // 设置模拟函数的返回值
      const mockSort = jest.fn();
      mockSort.mockReturnValue(mockMessages);

      Message.find.mockReturnValue({
        sort: mockSort
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages/conversation')
        .query({
          user1: 'user-id-1',
          user2: 'user-id-2'
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockMessages);

      // 验证模拟函数被正确调用
      expect(Message.find).toHaveBeenCalledWith({
        $or: [
          { sender: 'user-id-1', receiver: 'user-id-2' },
          { sender: 'user-id-2', receiver: 'user-id-1' }
        ]
      });
      expect(mockSort).toHaveBeenCalledWith({ createdAt: 1 });
    });

    it('应该验证必要参数', async () => {
      // 发送请求（只提供一个用户ID）
      const response = await request(app)
        .get('/api/interaction/messages/conversation')
        .query({
          user1: 'user-id-1'
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '需要两个用户ID');
    });

    it('应该处理查询错误', async () => {
      // 模拟查询错误
      Message.find.mockImplementation(() => {
        throw new Error('查询错误');
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages/conversation')
        .query({
          user1: 'user-id-1',
          user2: 'user-id-2'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取会话消息失败');
      expect(response.body).toHaveProperty('error', '查询错误');
    });
  });

  // 测试标记会话为已读
  describe('PUT /api/interaction/messages/read-conversation', () => {
    it('应该将会话中的所有消息标记为已读', async () => {
      // 模拟更新结果
      const mockUpdateResult = {
        nModified: 3,
        n: 3
      };

      Message.updateMany = jest.fn().mockResolvedValue(mockUpdateResult);

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/messages/read-conversation')
        .send({
          sender: 'user-id-2',
          receiver: 'user-id-1'
        });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '已将所有消息标记为已读');
      expect(response.body).toHaveProperty('updatedCount', 3);

      // 验证模拟函数被正确调用
      expect(Message.updateMany).toHaveBeenCalledWith(
        { sender: 'user-id-2', receiver: 'user-id-1', read: false },
        { $set: { read: true } }
      );
    });

    it('应该验证必要参数', async () => {
      // 发送请求（不提供接收者）
      const response = await request(app)
        .put('/api/interaction/messages/read-conversation')
        .send({
          sender: 'user-id-2'
        });

      // 验证响应
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '发送者和接收者是必需的');
    });

    it('应该处理更新错误', async () => {
      // 模拟更新错误
      Message.updateMany = jest.fn().mockRejectedValue(new Error('更新错误'));

      // 发送请求
      const response = await request(app)
        .put('/api/interaction/messages/read-conversation')
        .send({
          sender: 'user-id-2',
          receiver: 'user-id-1'
        });

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '标记会话为已读失败');
      expect(response.body).toHaveProperty('error', '更新错误');
    });
  });

  // 测试获取最近消息
  describe('GET /api/interaction/messages/recent/:userId', () => {
    it('应该返回用户的最近消息', async () => {
      // 模拟数据
      const mockMessages = [
        {
          _id: 'message-id-1',
          sender: 'user-id-2',
          receiver: 'user-id-1',
          content: '最新消息',
          createdAt: new Date(),
          read: false
        }
      ];

      // 设置模拟函数的返回值
      const mockLimit = jest.fn();
      mockLimit.mockReturnValue(mockMessages);

      const mockSort = jest.fn();
      mockSort.mockReturnValue({
        limit: mockLimit
      });

      Message.find.mockReturnValue({
        sort: mockSort
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages/recent/user-id-1')
        .query({ limit: 5 });

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockMessages);

      // 验证模拟函数被正确调用
      expect(Message.find).toHaveBeenCalledWith({
        receiver: 'user-id-1'
      });
      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockLimit).toHaveBeenCalledWith(5);
    });

    it('应该使用默认限制', async () => {
      // 模拟数据
      const mockMessages = [
        {
          _id: 'message-id-1',
          sender: 'user-id-2',
          receiver: 'user-id-1',
          content: '最新消息',
          createdAt: new Date(),
          read: false
        }
      ];

      // 设置模拟函数的返回值
      const mockLimit = jest.fn();
      mockLimit.mockReturnValue(mockMessages);

      const mockSort = jest.fn();
      mockSort.mockReturnValue({
        limit: mockLimit
      });

      Message.find.mockReturnValue({
        sort: mockSort
      });

      // 发送请求（不提供限制）
      const response = await request(app)
        .get('/api/interaction/messages/recent/user-id-1');

      // 验证响应
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockMessages);

      // 验证模拟函数被正确调用
      expect(mockLimit).toHaveBeenCalledWith(10); // 默认限制为10
    });

    it('应该处理查询错误', async () => {
      // 模拟查询错误
      Message.find.mockImplementation(() => {
        throw new Error('查询错误');
      });

      // 发送请求
      const response = await request(app)
        .get('/api/interaction/messages/recent/user-id-1');

      // 验证响应
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取最近消息失败');
      expect(response.body).toHaveProperty('error', '查询错误');
    });
  });
});
