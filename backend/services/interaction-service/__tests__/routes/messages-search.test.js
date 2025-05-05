/**
 * 消息搜索功能测试
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Message = require('../../models/Message');

// 模拟Message模型
jest.mock('../../models/Message', () => {
  const mockMessageModel = jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue({
      _id: 'new-msg-id',
      sender: 'user1',
      receiver: 'user2',
      content: '测试消息',
      read: false,
      createdAt: new Date()
    })
  }));

  mockMessageModel.find = jest.fn().mockReturnThis();
  mockMessageModel.findById = jest.fn().mockReturnThis();
  mockMessageModel.findByIdAndUpdate = jest.fn().mockReturnThis();
  mockMessageModel.findByIdAndDelete = jest.fn().mockReturnThis();
  mockMessageModel.updateMany = jest.fn().mockReturnThis();
  mockMessageModel.countDocuments = jest.fn().mockResolvedValue(10);
  mockMessageModel.sort = jest.fn().mockReturnThis();
  mockMessageModel.skip = jest.fn().mockReturnThis();
  mockMessageModel.limit = jest.fn().mockReturnThis();
  mockMessageModel.populate = jest.fn().mockReturnThis();
  mockMessageModel.exec = jest.fn();
  mockMessageModel.aggregate = jest.fn();

  return mockMessageModel;
});

// 模拟winston日志
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

describe('消息搜索功能测试', () => {
  let app;
  let messagesRouter;

  beforeEach(() => {
    // 重置模块缓存
    jest.resetModules();

    // 导入路由
    messagesRouter = require('../../routes/messages');

    // 创建Express应用
    app = express();
    app.use(express.json());

    // 模拟认证中间件
    app.use((req, res, next) => {
      req.user = { id: 'user123', role: 'teacher' };
      next();
    });

    // 使用消息路由
    app.use('/api/interaction/messages', messagesRouter);
  });

  afterEach(() => {
    // 清除所有模拟
    jest.clearAllMocks();
  });

  describe('GET /api/interaction/messages/search', () => {
    it('应该根据关键词搜索消息', async () => {
      // 模拟搜索结果
      const mockMessages = [
        {
          _id: 'msg1',
          content: '这是一条测试消息',
          sender: 'user1',
          receiver: 'user2',
          createdAt: new Date()
        }
      ];

      Message.find().exec.mockResolvedValue(mockMessages);

      const response = await request(app)
        .get('/api/interaction/messages/search')
        .query({ keyword: '测试消息', userId: 'user123' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockMessages);
      expect(Message.find).toHaveBeenCalled();
    });

    it('应该验证必要参数', async () => {
      const response = await request(app)
        .get('/api/interaction/messages/search')
        .query({ keyword: '测试消息' }); // 缺少userId

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '用户ID和搜索关键词不能为空');
    });

    it('应该处理空关键词', async () => {
      const response = await request(app)
        .get('/api/interaction/messages/search')
        .query({ keyword: '', userId: 'user123' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '用户ID和搜索关键词不能为空');
    });

    it('应该处理搜索错误', async () => {
      Message.find().exec.mockRejectedValue(new Error('搜索失败'));

      const response = await request(app)
        .get('/api/interaction/messages/search')
        .query({ keyword: '测试消息', userId: 'user123' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '搜索消息失败');
      expect(response.body).toHaveProperty('error', '搜索失败');
    });
  });

  describe('PUT /api/interaction/messages/batch/read', () => {
    it('应该批量标记消息为已读', async () => {
      // 模拟更新结果
      const updateResult = {
        nModified: 5,
        n: 5
      };

      Message.updateMany.mockResolvedValue(updateResult);

      const response = await request(app)
        .put('/api/interaction/messages/batch/read')
        .send({ messageIds: ['msg1', 'msg2', 'msg3', 'msg4', 'msg5'] });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', '5条消息已标记为已读');
      expect(Message.updateMany).toHaveBeenCalled();
    });

    it('应该验证消息ID数组', async () => {
      const response = await request(app)
        .put('/api/interaction/messages/batch/read')
        .send({ messageIds: [] }); // 空数组

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '消息ID列表不能为空');
    });

    it('应该处理没有消息被更新的情况', async () => {
      // 模拟没有消息被更新
      const updateResult = {
        nModified: 0,
        n: 0
      };

      Message.updateMany.mockResolvedValue(updateResult);

      const response = await request(app)
        .put('/api/interaction/messages/batch/read')
        .send({ messageIds: ['nonexistent1', 'nonexistent2'] });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', '没有找到指定的消息');
    });

    it('应该处理更新错误', async () => {
      Message.updateMany.mockRejectedValue(new Error('更新失败'));

      const response = await request(app)
        .put('/api/interaction/messages/batch/read')
        .send({ messageIds: ['msg1', 'msg2'] });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '批量标记消息已读失败');
      expect(response.body).toHaveProperty('error', '更新失败');
    });
  });

  describe('GET /api/interaction/messages/conversation/:userId1/:userId2', () => {
    it('应该获取两个用户之间的对话', async () => {
      // 模拟对话消息
      const mockConversation = [
        {
          _id: 'msg1',
          sender: 'user1',
          receiver: 'user2',
          content: '你好',
          createdAt: new Date(Date.now() - 3600000)
        },
        {
          _id: 'msg2',
          sender: 'user2',
          receiver: 'user1',
          content: '你好，有什么事吗？',
          createdAt: new Date()
        }
      ];

      Message.find().exec.mockResolvedValue(mockConversation);

      const response = await request(app)
        .get('/api/interaction/messages/conversation/user1/user2')
        .query({ limit: 20, skip: 0 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.data).toEqual(mockConversation);
      expect(Message.find).toHaveBeenCalled();
    });

    it('应该处理分页参数', async () => {
      // 模拟对话消息
      const mockConversation = [
        {
          _id: 'msg2',
          sender: 'user2',
          receiver: 'user1',
          content: '你好，有什么事吗？',
          createdAt: new Date()
        }
      ];

      Message.find().exec.mockResolvedValue(mockConversation);
      Message.countDocuments.mockResolvedValue(10);

      const response = await request(app)
        .get('/api/interaction/messages/conversation/user1/user2')
        .query({ limit: 1, skip: 1 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toEqual({
        total: 10,
        limit: 1,
        skip: 1
      });
      expect(Message.limit).toHaveBeenCalledWith(1);
      expect(Message.skip).toHaveBeenCalledWith(1);
    });

    it('应该处理查询错误', async () => {
      Message.find().exec.mockRejectedValue(new Error('查询失败'));

      const response = await request(app)
        .get('/api/interaction/messages/conversation/user1/user2');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取对话失败');
      expect(response.body).toHaveProperty('error', '查询失败');
    });
  });

  describe('GET /api/interaction/messages/stats/conversation', () => {
    it('应该返回对话统计信息', async () => {
      // 模拟聚合结果
      const mockConversations = [
        {
          _id: 'user2',
          lastMessage: {
            _id: 'msg1',
            content: '最新消息',
            createdAt: new Date()
          },
          unreadCount: 3,
          totalCount: 10
        },
        {
          _id: 'user3',
          lastMessage: {
            _id: 'msg2',
            content: '另一条消息',
            createdAt: new Date(Date.now() - 3600000)
          },
          unreadCount: 0,
          totalCount: 5
        }
      ];

      // 模拟聚合查询
      Message.aggregate.mockResolvedValue(mockConversations);

      const response = await request(app)
        .get('/api/interaction/messages/stats/conversation')
        .query({ userId: 'user1' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockConversations);
      expect(Message.aggregate).toHaveBeenCalled();
    });

    it('应该验证必要参数', async () => {
      const response = await request(app)
        .get('/api/interaction/messages/stats/conversation')
        .query({}); // 缺少userId

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '用户ID不能为空');
    });

    it('应该处理聚合错误', async () => {
      Message.aggregate.mockRejectedValue(new Error('聚合失败'));

      const response = await request(app)
        .get('/api/interaction/messages/stats/conversation')
        .query({ userId: 'user1' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取对话统计失败');
      expect(response.body).toHaveProperty('error', '聚合失败');
    });
  });
});
