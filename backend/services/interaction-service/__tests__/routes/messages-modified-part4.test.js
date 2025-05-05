/**
 * 消息路由测试 - 修改版（第四部分）
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
  mockMessageModel.countDocuments = jest.fn().mockResolvedValue(10);
  mockMessageModel.sort = jest.fn().mockReturnThis();
  mockMessageModel.skip = jest.fn().mockReturnThis();
  mockMessageModel.limit = jest.fn().mockReturnThis();
  mockMessageModel.populate = jest.fn().mockReturnThis();
  mockMessageModel.exec = jest.fn();

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

describe('消息路由测试 - 修改版（第四部分）', () => {
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

  describe('GET /api/interaction/messages/stats/unread', () => {
    it('应该返回未读消息数量', async () => {
      // 模拟未读消息数量
      Message.countDocuments.mockResolvedValue(5);

      const response = await request(app)
        .get('/api/interaction/messages/stats/unread')
        .query({ userId: 'user123' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('unreadCount', 5);
    });

    it('应该验证必要参数', async () => {
      // 缺少userId参数
      const response = await request(app)
        .get('/api/interaction/messages/stats/unread');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '用户ID不能为空');
    });

    it('应该处理查询错误', async () => {
      // 模拟查询错误
      Message.countDocuments.mockRejectedValue(new Error('查询失败'));

      const response = await request(app)
        .get('/api/interaction/messages/stats/unread')
        .query({ userId: 'user123' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取未读消息数量失败');
      expect(response.body).toHaveProperty('error', '查询失败');
    });
  });

  describe('GET /api/interaction/messages/between', () => {
    it('应该返回两个用户之间的消息', async () => {
      // 模拟查询结果
      const mockMessages = [
        { _id: 'msg1', content: '你好', sender: 'user1', receiver: 'user2' },
        { _id: 'msg2', content: '你好，有什么事吗？', sender: 'user2', receiver: 'user1' }
      ];

      Message.find().exec.mockResolvedValue(mockMessages);

      const response = await request(app)
        .get('/api/interaction/messages/between')
        .query({ user1: 'user1', user2: 'user2', limit: 20, skip: 0 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.data).toEqual(mockMessages);
    });

    it('应该验证必要参数', async () => {
      // 缺少user2参数
      const response = await request(app)
        .get('/api/interaction/messages/between')
        .query({ user1: 'user1' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', '两个用户ID不能为空');
    });

    it('应该处理查询错误', async () => {
      // 模拟查询错误
      Message.find().exec.mockRejectedValue(new Error('查询失败'));

      const response = await request(app)
        .get('/api/interaction/messages/between')
        .query({ user1: 'user1', user2: 'user2' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取用户间消息失败');
      expect(response.body).toHaveProperty('error', '查询失败');
    });
  });
});
