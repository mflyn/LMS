/**
 * 消息路由测试 - 修改版（第一部分）
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

describe('消息路由测试 - 修改版（第一部分）', () => {
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

  describe('GET /api/interaction/messages', () => {
    it('应该返回消息列表和分页信息', async () => {
      // 模拟查询结果
      const mockMessages = [
        { _id: 'msg1', content: '消息1', sender: 'user1', receiver: 'user2' },
        { _id: 'msg2', content: '消息2', sender: 'user2', receiver: 'user1' }
      ];

      Message.find().exec.mockResolvedValue(mockMessages);

      const response = await request(app)
        .get('/api/interaction/messages')
        .query({ limit: 20, skip: 0 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.data).toEqual(mockMessages);
    });

    it('应该根据查询参数过滤消息', async () => {
      // 模拟查询结果
      const mockMessages = [
        { _id: 'msg1', content: '消息1', sender: 'user1', receiver: 'user2' }
      ];

      Message.find().exec.mockResolvedValue(mockMessages);

      const response = await request(app)
        .get('/api/interaction/messages')
        .query({
          sender: 'user1',
          receiver: 'user2',
          startDate: '2023-01-01',
          endDate: '2023-12-31',
          limit: 5,
          skip: 10
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toEqual(mockMessages);
    });

    it('应该处理查询错误', async () => {
      // 模拟查询错误
      Message.find().exec.mockRejectedValue(new Error('数据库错误'));

      const response = await request(app)
        .get('/api/interaction/messages');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', '获取消息列表失败');
      expect(response.body).toHaveProperty('error', '数据库错误');
    });
  });
});
